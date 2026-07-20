#!/usr/bin/env node
/* companion.mjs — IdleOn Companion local server.
 *
 * DEPRECATED (2026-07-20, docs/ARCHITECTURE.md D8): the SPA/PWA replaces this server
 * entirely — sync, storage, and every page now run client-side (src/). Kept only until
 * the SQLite history in idleon.db is exported (scripts/export-sqlite.mjs) and imported
 * into the PWA's Data page; then delete this file with db.mjs, fetch-idleon.mjs and
 * the legacy root pages — the ready-made command is in README "Legacy".
 *
 *   node companion.mjs            → http://localhost:8317
 *   (or double-click start-companion.command on macOS)
 *
 * Serves the UI + REST API backed by idleon.db (SQLite):
 *   GET  /api/state              latest snapshot (entities + metrics + meta)
 *   POST /api/sync               fetch live save from the game now, ingest
 *   GET  /api/history            time-series {metric:[{ts,v}]}  ?keys=a,b&from=ISO
 *   GET  /api/w1                 W1 (Blunder Hills) static glossary — anvil product names,
 *                                forge/owl/bribe flavor text (entities.w1 has the numbers)
 *   GET  /api/w2                 W2 (Yum-Yum Desert) static glossary — bubble/vial/sigil tooltip
 *                                text, Poppy/Tar Pit descriptions (entities.w2 has the numbers)
 *   GET  /api/w3                 W3 (Frostbite Tundra) static glossary — tower/atom/salt-lick/
 *                                printer-slot/shrine flavor text (entities.w3 has the numbers)
 *   GET  /api/w4                 W4 (Hyperion Nebula) static glossary — breeding-upgrade/cooking-
 *                                mastery/rift-reward/skill-mastery/meal-cap flavor text (entities.w4
 *                                has the numbers)
 *   GET  /api/w5                 W5 (Smolderin' Plateau) static glossary — superbit/god/villager
 *                                flavor text (entities.w5 has the numbers)
 *   GET  /api/w6                 W6 (Spirited Valley) static glossary — jade emporium/golden
 *                                food/summoning-upgrade/ninja-upgrade flavor text (entities.w6
 *                                has the numbers)
 *   GET  /api/w7                 W7 (Shimmerfin Deep) static glossary — research grid tool/
 *                                observation-pool flavor, spelunking/sushi/minehead shop
 *                                descriptions, lore chapter names, Button task pool, Zenith
 *                                Market flavor (entities.w7 has the numbers)
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
import { readFileSync, writeFileSync, existsSync, statSync } from "node:fs";
import { dirname, join, extname, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { openDb, ingest, ingestMetricsOnly, latest, history, rawOf, rebuildDerived, getSetting, setSetting } from "./db.mjs";
import { RECIPES, evaluatePerChar } from "./src/core/stats/index.mjs";
import { farmingReport } from "./src/core/stats/farming-report.mjs";
import { w1Glossary } from "./src/core/stats/w1-report.mjs";
import { w2Glossary } from "./src/core/stats/w2-report.mjs";
import { w3Glossary } from "./src/core/stats/w3-report.mjs";
import { w4Glossary } from "./src/core/stats/w4-report.mjs";
import { w5Glossary } from "./src/core/stats/w5-report.mjs";
import { w6Glossary } from "./src/core/stats/w6-report.mjs";
import { w7Glossary } from "./src/core/stats/w7-report.mjs";
import { openSave } from "./src/core/savemap.mjs";
import { artifactSourceChar } from "./src/core/domain.mjs";

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

    /* Companion ownership is NOT in the Firestore save — it lives in the Realtime DB at
     * _comp/{uid}, which is what the client's native getCompanionInfoMe() bridge is backed by.
     * Same uid, same idToken; no new auth. It is worth up to ~5x on artifact find.
     * Merged INTO `raw` (rather than a new snapshots column) because rebuildDerived() replays
     * extractEntities(raw, ...) over the gzipped raws — anything outside `raw` is invisible to
     * that replay and would silently produce companion-less history. `__` cannot collide: zero
     * of the 817 real save keys start with an underscore.
     * On failure we leave the key ABSENT, which the stat recipes read as "unknown" and flag.
     * Absent must never be mistaken for "owns nothing" — that would silently under-report. */
    try {
      const r3 = await fetch(`https://idlemmo.firebaseio.com/_comp/${uid}.json?auth=${t.id_token}`);
      if (r3.ok) { const j = await r3.json(); if (j) raw.__companions = j; else console.warn("companions: _comp doc empty"); }
      else console.warn(`companions: _comp read failed HTTP ${r3.status} — artifact odds will be a lower bound`);
    } catch (e) { console.warn("companions: _comp fetch failed:", e.message, "— artifact odds will be a lower bound"); }

    /* SERVER VARS — the Firestore doc `_vars/_vars` (same project, same token; discovered via
     * IdleonToolbox). Holds remote-config the client fetches at runtime: THE ACTIVE VOTE
     * (voteCategories[0] + votePercent), the Meritocracy server state (voteCat2/votePercent2),
     * and — critically — AncientOddPerIsland / AncientArtiPCT, the two artifact-odds server
     * vars we previously could only CALIBRATE. Merged into raw as __serverVars for the same
     * reason as __companions: rebuilds replay from the stored raw. Absent on failure ->
     * dependent terms stay honestly unknown / calibrated. */
    try {
      const r4 = await fetch(`https://firestore.googleapis.com/v1/projects/idlemmo/databases/(default)/documents/_vars/_vars`,
        { headers: { Authorization: `Bearer ${t.id_token}` } });
      if (r4.ok) {
        const doc4 = await r4.json();
        raw.__serverVars = Object.fromEntries(Object.entries(doc4.fields || {}).map(([k, v]) => [k, fromFs(v)]));
      } else console.warn(`serverVars: _vars read failed HTTP ${r4.status} — vote/odds fall back to unknown/calibrated`);
    } catch (e) { console.warn("serverVars: _vars fetch failed:", e.message); }

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

/* ---------- stat evaluation manual inputs ---------- */
/** Raw settings values as stored (strings; "" = not set) — for the UI. */
const statInputs = () => ({
  statTomePoints: getSetting(db, "statTomePoints", ""),
  statLabConnected: getSetting(db, "statLabConnected", ""),
  statActiveVote: getSetting(db, "statActiveVote", ""),
});
/** Parsed into evaluate() opts. Blank stays null — the engine reports the term unknown. */
function statOpts() {
  const i = statInputs();
  return {
    tomePoints: i.statTomePoints !== "" && isFinite(Number(i.statTomePoints)) ? Number(i.statTomePoints) : null,
    labConnectedIds: i.statLabConnected !== ""
      ? i.statLabConnected.split(",").map((x) => Number(x.trim())).filter(Number.isFinite) : null,
    activeVote: i.statActiveVote !== "" && isFinite(Number(i.statActiveVote)) ? Number(i.statActiveVote) : null,
  };
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
    /* Stat Explorer: every registered recipe evaluated FRESH from the latest stored raw
     * (not the cached entities), including per-character as-if-active results. The raw
     * carries __companions when the sync could fetch the _comp doc; older snapshots
     * legitimately evaluate with those terms unknown.
     * MANUAL INPUTS: some evaluation inputs exist only on the user's screen, never in the
     * save — the Tome score ("<N>_PTS" on the Tome page), lab-board connectivity, and the
     * weekly active vote. They persist in settings (statOpts()) and feed every evaluation;
     * terms driven by them show as "user-anchored computed" rather than unknown. Blank =
     * honestly unknown, never guessed. */
    if (p === "/api/stats") {
      const snap = db.prepare("SELECT id, ts, char_names FROM snapshots WHERE raw_gz IS NOT NULL ORDER BY ts DESC LIMIT 1").get();
      if (!snap) return send(res, 200, { ok: true, stats: null });
      const raw = rawOf(db, snap.id);
      const charNames = snap.char_names ? JSON.parse(snap.char_names) : null;
      const s = openSave(raw, charNames);
      /* ?villager=N — only stats/villager-exp.mjs reads ctx.args.villager (default 0, the
       * Explorer); every other recipe ignores the extra arg. Lets w5.html's Cavern module ask
       * for a specific villager's term breakdown without a per-recipe endpoint. */
      const villagerArg = url.searchParams.get("villager");
      const args = villagerArg !== null && isFinite(Number(villagerArg)) ? { villager: Number(villagerArg) } : {};
      const opts = { activeChar: artifactSourceChar(s), args, ...statOpts() };
      const stats = {};
      for (const r of RECIPES)
        stats[r.name] = { name: r.name, label: r.label, format: r.format ?? "multiplier", display: r.display ?? {}, ...evaluatePerChar(r, s, opts) };
      return send(res, 200, { ok: true, id: snap.id, ts: snap.ts, charNames, charIdxs: s.charIdxs, inputs: statInputs(), stats });
    }
    /* Farming page: the full four-module report (medal evo push, exotic planner, OG &
     * stickers, markets), computed FRESH from the latest raw. Exotic week comes from the
     * server's wall clock, never from the save's age. */
    if (p === "/api/farming") {
      const snap = db.prepare("SELECT id, ts, char_names FROM snapshots WHERE raw_gz IS NOT NULL ORDER BY ts DESC LIMIT 1").get();
      if (!snap) return send(res, 200, { ok: true, report: null });
      const raw = rawOf(db, snap.id);
      const charNames = snap.char_names ? JSON.parse(snap.char_names) : null;
      const s = openSave(raw, charNames);
      const report = farmingReport(s, { activeChar: artifactSourceChar(s), ...statOpts() });
      return send(res, 200, { ok: true, id: snap.id, ts: snap.ts, charNames, report });
    }
    /* World 1 (Blunder Hills) page: a small STATIC glossary (anvil product names, forge/owl/
     * bribe flavor text) — no save parsing, same payload on every call. See stats/w1-report.mjs
     * for why entities.w1 alone can't label these. Stamps/statues/anvil/forge/owl/bribes save
     * data itself comes straight from /api/state's entities.w1 — this only fills the gaps. */
    if (p === "/api/w1") return send(res, 200, { ok: true, ...w1Glossary() });
    /* World 2 (Yum-Yum Desert) page: a small STATIC glossary (bubble/vial/sigil tooltip text,
     * Poppy/Tar Pit descriptions, Fractal thresholds) — no save parsing, same payload on every
     * call. See stats/w2-report.mjs for why entities.w2 alone can't label these. Bubbles/vials/
     * sigils/cauldron/liquids/fishing/ballot/killroy/islands numbers come straight from
     * /api/state's entities.w2 — this only fills the gaps. */
    if (p === "/api/w2") return send(res, 200, { ok: true, ...w2Glossary() });
    /* World 3 (Frostbite Tundra) page: a small STATIC glossary (tower/atom/salt-lick/printer-
     * slot/shrine flavor text) — no save parsing, same payload on every call. See
     * stats/w3-report.mjs for why entities.w3 alone can't label these. Printer/refinery/worship/
     * towers/atoms/shrines/library numbers come straight from /api/state's entities.w3 — this
     * only fills the gaps. */
    if (p === "/api/w3") return send(res, 200, { ok: true, ...w3Glossary() });
    /* World 4 (Hyperion Nebula) page: a small STATIC glossary (breeding-upgrade effect text,
     * cooking-mastery category rank gates, rift reward milestones, skill-mastery thresholds,
     * meal-cap sources) — no save parsing, same payload on every call. See stats/w4-report.mjs
     * for why entities.w4 alone can't label these. Meals/kitchens/cooking mastery/breeding/
     * territory/rift/skill-mastery numbers come straight from /api/state's entities.w4 — this
     * only fills the gaps. */
    if (p === "/api/w4") return send(res, 200, { ok: true, ...w4Glossary() });
    /* World 5 (Smolderin' Plateau) page: a small STATIC glossary (superbit/god/villager flavor
     * text) — no save parsing, same payload on every call. See stats/w5-report.mjs for why
     * entities.w5 alone can't label these. Gaming/palette/divinity/villagers/caverns/slab numbers
     * come straight from /api/state's entities.w5 — this only fills the gaps. */
    if (p === "/api/w5") return send(res, 200, { ok: true, ...w5Glossary() });
    /* World 6 (Spirited Valley) page: a small STATIC glossary (jade emporium/golden food/
     * summoning-upgrade/ninja-upgrade flavor text) — no save parsing, same payload on every
     * call. See stats/w6-report.mjs for why entities.w6 alone can't label these. Summoning/
     * sneaking/emperor/beanstalk numbers come straight from /api/state's entities.w6 — this
     * only fills the gaps. */
    if (p === "/api/w6") return send(res, 200, { ok: true, ...w6Glossary() });
    /* World 7 (Shimmerfin Deep) — a small STATIC glossary (research grid tool/observation-pool
     * flavor, spelunking/sushi/minehead shop descriptions, lore chapter names, Button task pool,
     * Zenith Market flavor) — no save parsing, same payload on every call. See stats/w7-report.mjs
     * for why entities.w7 alone can't label these. Research/legend talents/spelunking/sushi/
     * minehead/zenith/coral reef/clam work/advice fish/button NUMBERS come straight from
     * /api/state's entities.w7 — this only fills the gaps. */
    if (p === "/api/w7") return send(res, 200, { ok: true, ...w7Glossary() });
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
        /* stat evaluation inputs — empty string clears back to "unknown" */
        for (const k of ["statTomePoints", "statLabConnected", "statActiveVote"])
          if (k in body) setSetting(db, k, String(body[k] ?? "").trim());
        return send(res, 200, { ok: true, autoRefreshMin: Number(getSetting(db, "autoRefreshMin", "0")), ...statInputs() });
      }
      return send(res, 200, { ok: true, autoRefreshMin: Number(getSetting(db, "autoRefreshMin", "0")), ...statInputs() });
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
    let full = join(DIR, file);
    if (!full.startsWith(DIR) || !existsSync(full)) return send(res, 404, { ok: false, error: "not found" });
    if (statSync(full).isDirectory()) {
      full = join(full, "index.html");
      if (!existsSync(full)) return send(res, 404, { ok: false, error: "not found" });
    }
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
