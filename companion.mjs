#!/usr/bin/env node
/* companion.mjs — IdleOn Companion local server.
 *
 *   node companion.mjs            → http://localhost:8317
 *   (or double-click start-companion.command on macOS)
 *
 * Serves the UI + REST API backed by idleon.db (SQLite):
 *   GET  /api/state              latest snapshot (entities + metrics + meta)
 *   POST /api/sync               fetch live save from the game now, ingest
 *   GET  /api/history            time-series {metric:[{ts,v}]}  ?keys=a,b&from=ISO
 *   GET  /api/snapshots          snapshot list
 *   GET  /api/snapshot/:id/raw   full raw save of a snapshot
 *   GET/POST /api/settings       {autoRefreshMin: 0|1|5|15|60}
 *   POST /api/connect            {url: steamsso-redirect} one-time login (server-side)
 *   GET  /api/auth               {connected, uid}
 *   POST /api/rebuild            re-derive entities/metrics from stored raws
 *
 * Auth: reuses .idleon-auth.json (same file as fetch-idleon.mjs). Auto-refresh
 * per settings. Zero npm deps — needs Node 22.5+ (node:sqlite).
 */
import { createServer } from "node:http";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join, extname, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { openDb, ingest, ingestMetricsOnly, latest, history, rawOf, rebuildDerived, getSetting, setSetting } from "./db.mjs";

const DIR = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 8317);
const API_KEY = "AIzaSyAU62kOE6xhSrFqoXQPv6_WHxYilmoUxDk";
const AUTH_FILE = join(DIR, ".idleon-auth.json");
const STEAM_RETURN = "https://www.legendsofidleon.com/steamsso/";

const [major, minor] = process.versions.node.split(".").map(Number);
if (major < 22 || (major === 22 && minor < 5)) {
  console.error(`Node ${process.versions.node} is too old — the companion needs Node 22.5+ (built-in SQLite). brew install node`);
  process.exit(1);
}

const db = openDb(join(DIR, "idleon.db"));

/* ---------- game backend (same flow as fetch-idleon.mjs / sync.js) ---------- */
async function post(url, body, form = false) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": form ? "application/x-www-form-urlencoded" : "application/json" },
    body: form ? new URLSearchParams(body).toString() : JSON.stringify(body),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((j.error && (j.error.message || j.error)) || `HTTP ${res.status}`);
  return j;
}
const fromFs = (v) => {
  if (v == null) return null;
  if ("stringValue" in v) return v.stringValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return v.doubleValue;
  if ("booleanValue" in v) return v.booleanValue;
  if ("nullValue" in v) return null;
  if ("arrayValue" in v) return (v.arrayValue.values || []).map(fromFs);
  if ("mapValue" in v) return Object.fromEntries(Object.entries(v.mapValue.fields || {}).map(([k, x]) => [k, fromFs(x)]));
  return v;
};
const getAuth = () => existsSync(AUTH_FILE) ? JSON.parse(readFileSync(AUTH_FILE, "utf8")) : null;

async function connectSteam(redirectUrl) {
  if (!redirectUrl?.startsWith(STEAM_RETURN)) throw new Error("Paste the full legendsofidleon.com/steamsso/… URL");
  const p = Object.fromEntries(new URL(redirectUrl).searchParams);
  const claimedId = (p["openid.claimed_id"] || "").match(/\/(\d+)$/)?.[1];
  if (!claimedId) throw new Error("No SteamID in that URL");
  const fn = await post("https://us-central1-idlemmo.cloudfunctions.net/asil", { data: {
    claimedId, nonce: p["openid.response_nonce"], assocHandle: p["openid.assoc_handle"], sig: p["openid.sig"], signed: p["openid.signed"] } });
  if (!fn.result) throw new Error("Token exchange failed (assertion expired? sign in again)");
  const auth = await post(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${API_KEY}`,
    { token: fn.result, returnSecureToken: true });
  const uid = JSON.parse(Buffer.from(auth.idToken.split(".")[1], "base64url").toString()).user_id;
  writeFileSync(AUTH_FILE, JSON.stringify({ uid, refreshToken: auth.refreshToken, createdAt: new Date().toISOString() }, null, 2));
  return uid;
}

let syncing = false;
async function syncNow(source = "sync") {
  if (syncing) throw new Error("sync already running");
  syncing = true;
  try {
    const a = getAuth();
    if (!a) throw new Error("Not connected — POST /api/connect first");
    const t = await post(`https://securetoken.googleapis.com/v1/token?key=${API_KEY}`,
      { grant_type: "refresh_token", refresh_token: a.refreshToken }, true);
    if (t.refresh_token && t.refresh_token !== a.refreshToken)
      writeFileSync(AUTH_FILE, JSON.stringify({ ...a, refreshToken: t.refresh_token }, null, 2));
    const uid = t.user_id || a.uid;
    const res = await fetch(`https://firestore.googleapis.com/v1/projects/idlemmo/databases/(default)/documents/_data/${uid}`,
      { headers: { Authorization: `Bearer ${t.id_token}` } });
    if (!res.ok) throw new Error(`Save read failed: HTTP ${res.status}`);
    const doc = await res.json();
    const raw = Object.fromEntries(Object.entries(doc.fields || {}).map(([k, v]) => [k, fromFs(v)]));
    let charNames = null;
    try {
      const r2 = await fetch(`https://idlemmo.firebaseio.com/_uid/${uid}.json?auth=${t.id_token}`);
      if (r2.ok) { const j = await r2.json(); if (j) charNames = Object.values(j); }
    } catch {}
    const result = ingest(db, raw, { source, charNames });
    console.log(`[${new Date().toISOString()}] synced snapshot #${result.id} (${source})`);
    return result;
  } finally { syncing = false; }
}

/* ---------- auto-refresh timer ---------- */
let timer = null;
function schedule() {
  if (timer) clearInterval(timer);
  const min = Number(getSetting(db, "autoRefreshMin", "0"));
  if (min > 0) {
    timer = setInterval(() => syncNow("auto").catch((e) => console.error("auto-sync:", e.message)), min * 60_000);
    console.log(`auto-refresh: every ${min} min`);
  } else console.log("auto-refresh: OFF");
}

/* ---------- one-time migration from file era ---------- */
function migrate() {
  if (getSetting(db, "migrated")) return;
  try {
    if (existsSync(join(DIR, "history.json"))) {
      const hist = JSON.parse(readFileSync(join(DIR, "history.json"), "utf8"));
      for (const h of hist) ingestMetricsOnly(db, h.ts, h.metrics);
    }
    if (existsSync(join(DIR, "savegame.json"))) {
      const raw = JSON.parse(readFileSync(join(DIR, "savegame.json"), "utf8"));
      let charNames = null;
      try { const m = readFileSync(join(DIR, "savedata.js"), "utf8").match(/window\.SAVEMETA=(\{.*?\});\n/s); if (m) charNames = JSON.parse(m[1]).charNames; } catch {}
      ingest(db, raw, { source: "import", charNames });
    }
    setSetting(db, "migrated", "1");
    console.log("migrated existing savegame.json + history.json into idleon.db");
  } catch (e) { console.error("migration:", e.message); }
}

/* ---------- http ---------- */
const MIME = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".css": "text/css", ".png": "image/png", ".svg": "image/svg+xml" };
const send = (res, code, body, type = "application/json") => {
  const data = type === "application/json" ? JSON.stringify(body) : body;
  res.writeHead(code, { "Content-Type": type, "Cache-Control": "no-store" });
  res.end(data);
};
const readBody = (req) => new Promise((resolve) => { let b = ""; req.on("data", (c) => b += c); req.on("end", () => { try { resolve(JSON.parse(b || "{}")); } catch { resolve({}); } }); });

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const p = url.pathname;
  try {
    if (p === "/api/state") {
      const l = latest(db);
      return send(res, 200, { ok: true, connected: !!getAuth(), autoRefreshMin: Number(getSetting(db, "autoRefreshMin", "0")), snapshot: l });
    }
    if (p === "/api/sync" && req.method === "POST") {
      const r = await syncNow("manual");
      return send(res, 200, { ok: true, id: r.id, ts: r.ts });
    }
    if (p === "/api/history") {
      const keys = url.searchParams.get("keys")?.split(",").filter(Boolean) || null;
      return send(res, 200, { ok: true, series: history(db, keys, url.searchParams.get("from")) });
    }
    if (p === "/api/snapshots") {
      const rows = db.prepare("SELECT id, ts, source, raw_gz IS NOT NULL AS hasRaw FROM snapshots ORDER BY ts").all();
      return send(res, 200, { ok: true, snapshots: rows });
    }
    const mRaw = p.match(/^\/api\/snapshot\/(\d+)\/raw$/);
    if (mRaw) {
      const raw = rawOf(db, Number(mRaw[1]));
      return raw ? send(res, 200, raw) : send(res, 404, { ok: false, error: "no raw stored" });
    }
    if (p === "/api/settings") {
      if (req.method === "POST") {
        const body = await readBody(req);
        if ("autoRefreshMin" in body) { setSetting(db, "autoRefreshMin", Number(body.autoRefreshMin) || 0); schedule(); }
        return send(res, 200, { ok: true, autoRefreshMin: Number(getSetting(db, "autoRefreshMin", "0")) });
      }
      return send(res, 200, { ok: true, autoRefreshMin: Number(getSetting(db, "autoRefreshMin", "0")) });
    }
    if (p === "/api/connect" && req.method === "POST") {
      const body = await readBody(req);
      const uid = await connectSteam(body.url);
      return send(res, 200, { ok: true, uid });
    }
    if (p === "/api/auth") return send(res, 200, { ok: true, connected: !!getAuth(), uid: getAuth()?.uid ?? null });
    if (p === "/api/rebuild" && req.method === "POST") {
      return send(res, 200, { ok: true, rebuilt: rebuildDerived(db) });
    }
    // static files
    let file = p === "/" ? "/dashboard.html" : p;
    file = normalize(file).replace(/^(\.\.[/\\])+/, "");
    const full = join(DIR, file);
    if (!full.startsWith(DIR) || !existsSync(full)) return send(res, 404, { ok: false, error: "not found" });
    return send(res, 200, readFileSync(full), MIME[extname(full)] || "application/octet-stream");
  } catch (e) {
    return send(res, 500, { ok: false, error: e.message });
  }
});

migrate();
schedule();
server.listen(PORT, "127.0.0.1", () => {
  console.log(`IdleOn Companion → http://localhost:${PORT}`);
  console.log(`auth: ${getAuth() ? "connected (" + getAuth().uid + ")" : "not connected — use Connect in the UI"}`);
});
