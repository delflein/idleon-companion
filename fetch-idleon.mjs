#!/usr/bin/env node
/**
 * fetch-idleon.mjs — pull your Legends of IdleOn cloud save without manual copy-paste.
 *
 * How it works (same mechanism as IdleOn Toolbox, MIT: github.com/Morta1/IdleonToolbox):
 *   The game stores your save in its own Firebase project ("idlemmo").
 *   Steam accounts authenticate via Steam OpenID -> the game's cloud function
 *   mints a Firebase custom token -> that gives us an id/refresh token pair.
 *   The refresh token is long-lived, so after ONE manual login you can fetch
 *   fresh data any time with just `node fetch-idleon.mjs`.
 *
 * Usage:
 *   node fetch-idleon.mjs login   # one-time: prints a Steam URL, paste the redirect URL back
 *   node fetch-idleon.mjs         # fetch save -> savegame.json, savedata.js, history.json/js
 *
 * Files written next to this script:
 *   .idleon-auth.json  (KEEP PRIVATE — refresh token; add to .gitignore)
 *   savegame.json      raw save (same shape as IdleOn Toolbox "raw data" export)
 *   savedata.js        window.SAVEGAME/SAVEMETA for dashboard.html
 *   history.json/.js   metric snapshots over time (one appended per fetch)
 *
 * Zero dependencies. Node 18+.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createInterface } from "node:readline";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const DIR = dirname(fileURLToPath(import.meta.url));
const API_KEY = "AIzaSyAU62kOE6xhSrFqoXQPv6_WHxYilmoUxDk"; // idlemmo public web key (same one the game website ships)
const AUTH_FILE = join(DIR, ".idleon-auth.json");
const STEAM_RETURN = "https://www.legendsofidleon.com/steamsso/";

const args = process.argv.slice(2);
const cmd = args[0] || "fetch";

/* ---------------- helpers ---------------- */
async function post(url, body, form = false) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": form ? "application/x-www-form-urlencoded" : "application/json" },
    body: form ? new URLSearchParams(body).toString() : JSON.stringify(body),
  });
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch { json = { raw: text }; }
  if (!res.ok) throw new Error(`POST ${url} -> ${res.status}: ${text.slice(0, 300)}`);
  return json;
}
const ask = (q) => new Promise((resolve) => {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  rl.question(q, (a) => { rl.close(); resolve(a.trim()); });
});
const jwtPayload = (t) => JSON.parse(Buffer.from(t.split(".")[1], "base64url").toString());

/* Firestore REST typed value -> plain JS */
function fromFs(v) {
  if (v == null) return null;
  if ("stringValue" in v) return v.stringValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return v.doubleValue;
  if ("booleanValue" in v) return v.booleanValue;
  if ("nullValue" in v) return null;
  if ("timestampValue" in v) return v.timestampValue;
  if ("arrayValue" in v) return (v.arrayValue.values || []).map(fromFs);
  if ("mapValue" in v) return Object.fromEntries(Object.entries(v.mapValue.fields || {}).map(([k, x]) => [k, fromFs(x)]));
  return v;
}

/* ---------------- login (one-time) ---------------- */
async function login() {
  const steamUrl = "https://steamcommunity.com/openid/login?" + new URLSearchParams({
    "openid.ns": "http://specs.openid.net/auth/2.0",
    "openid.mode": "checkid_setup",
    "openid.claimed_id": "http://specs.openid.net/auth/2.0/identifier_select",
    "openid.identity": "http://specs.openid.net/auth/2.0/identifier_select",
    "openid.return_to": STEAM_RETURN,
    "openid.realm": STEAM_RETURN,
  }).toString();

  console.log("\n1) Open this URL in your browser and sign in with Steam:\n");
  console.log(steamUrl);
  console.log(`\n2) After login you land on a ${STEAM_RETURN} page.`);
  console.log("   Copy the FULL address-bar URL of that page and paste it here.\n");
  const redirect = await ask("Paste redirect URL: ");
  if (!redirect.startsWith(STEAM_RETURN)) throw new Error("That doesn't look like the legendsofidleon.com/steamsso/ URL.");

  const p = Object.fromEntries(new URL(redirect).searchParams);
  const claimedId = (p["openid.claimed_id"] || "").match(/\/(\d+)$/)?.[1];
  if (!claimedId) throw new Error("Could not extract SteamID from openid.claimed_id");

  // game's own cloud function verifies the OpenID assertion and mints a Firebase custom token
  console.log("Exchanging Steam assertion for a game token...");
  const fn = await post("https://us-central1-idlemmo.cloudfunctions.net/asil", {
    data: {
      claimedId,
      nonce: p["openid.response_nonce"],
      assocHandle: p["openid.assoc_handle"],
      sig: p["openid.sig"],
      signed: p["openid.signed"],
    },
  });
  const customToken = fn.result;
  if (!customToken) throw new Error("Token exchange failed: " + JSON.stringify(fn).slice(0, 300));

  const auth = await post(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${API_KEY}`,
    { token: customToken, returnSecureToken: true });
  const uid = jwtPayload(auth.idToken).user_id || auth.localId;

  writeFileSync(AUTH_FILE, JSON.stringify({ uid, refreshToken: auth.refreshToken, createdAt: new Date().toISOString() }, null, 2));
  console.log(`\n✓ Logged in. uid=${uid}`);
  console.log(`✓ Saved ${AUTH_FILE} — keep it private (it grants read access to your save).`);
  console.log("  From now on just run: node fetch-idleon.mjs\n");
}

/* ---------------- fetch ---------------- */
async function refresh() {
  if (!existsSync(AUTH_FILE)) throw new Error("No auth file. Run: node fetch-idleon.mjs login");
  const auth = JSON.parse(readFileSync(AUTH_FILE, "utf8"));
  const r = await post(`https://securetoken.googleapis.com/v1/token?key=${API_KEY}`,
    { grant_type: "refresh_token", refresh_token: auth.refreshToken }, true);
  if (r.refresh_token && r.refresh_token !== auth.refreshToken) {
    writeFileSync(AUTH_FILE, JSON.stringify({ ...auth, refreshToken: r.refresh_token }, null, 2));
  }
  return { idToken: r.id_token, uid: r.user_id || auth.uid };
}

async function fetchSave() {
  const { idToken, uid } = await refresh();
  console.log("Fetching cloud save for", uid, "...");
  const res = await fetch(`https://firestore.googleapis.com/v1/projects/idlemmo/databases/(default)/documents/_data/${uid}`,
    { headers: { Authorization: `Bearer ${idToken}` } });
  if (!res.ok) throw new Error(`Firestore read failed: ${res.status} ${await res.text()}`);
  const doc = await res.json();
  const raw = Object.fromEntries(Object.entries(doc.fields || {}).map(([k, v]) => [k, fromFs(v)]));
  if (!raw.OptLacc) console.warn("Warning: save looks unexpected (no OptLacc key).");

  // char names (best effort, Realtime DB)
  let charNames = null;
  try {
    const r2 = await fetch(`https://idlemmo.firebaseio.com/_uid/${uid}.json?auth=${idToken}`);
    if (r2.ok) { const j = await r2.json(); if (j) charNames = Object.values(j); }
  } catch { /* optional */ }

  const now = new Date().toISOString();
  writeFileSync(join(DIR, "savegame.json"), JSON.stringify(raw));
  writeFileSync(join(DIR, "savedata.js"),
    `window.SAVEGAME=${JSON.stringify(raw)};\nwindow.SAVEMETA=${JSON.stringify({ fetchedAt: now, charNames })};\n`);

  // history snapshot
  const histFile = join(DIR, "history.json");
  const hist = existsSync(histFile) ? JSON.parse(readFileSync(histFile, "utf8")) : [];
  const snap = { ts: now, metrics: extractMetrics(raw) };
  const last = hist[hist.length - 1];
  if (last && last.ts.slice(0, 10) === now.slice(0, 10)) hist[hist.length - 1] = snap; // one point per day
  else hist.push(snap);
  writeFileSync(histFile, JSON.stringify(hist, null, 1));
  writeFileSync(join(DIR, "history.js"), `window.SAVEHISTORY=${JSON.stringify(hist)};\n`);

  console.log(`✓ savegame.json (${(JSON.stringify(raw).length / 1024).toFixed(0)} KB), savedata.js, history updated (${hist.length} snapshots).`);
  console.log("  Open dashboard.html to see the update.");
}

/* ---------------- metrics (keep in sync with dashboard.html) ---------------- */
const ACH_REAL_IDX=[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51,52,53,54,55,56,57,58,59,60,61,62,70,71,72,73,74,75,76,77,78,79,80,81,82,83,84,85,86,87,88,89,90,91,92,93,94,95,96,97,98,99,100,101,102,103,104,105,106,107,108,109,110,111,112,113,114,115,116,117,118,119,120,121,122,123,124,140,141,142,143,144,145,146,147,148,149,150,151,152,153,154,155,156,157,158,159,160,161,162,163,164,165,166,167,168,169,170,171,172,173,174,175,176,177,178,179,180,181,182,183,184,185,186,187,188,189,210,211,212,213,214,215,216,217,218,219,220,221,222,223,224,225,226,227,228,229,230,231,232,233,234,235,236,237,238,239,240,241,242,280,281,282,283,284,285,286,287,288,289,290,291,292,293,294,295,296,297,298,299,300,301,302,303,304,305,306,307,308,309,310,311,350,351,352,353,354,355,356,357,358,359,360,361,362,363,364,365,366,367,368,369,370,371,372,373,374,375,376,377,378,379,380,381,382,383,384];
const ACH_STEAM_MAP=[[0,42],[1,14],[2,46],[3,45],[5,43],[7,3],[9,9],[11,0],[12,20],[13,17],[14,44],[19,4],[25,33],[28,27],[29,23],[31,28],[35,12],[36,25],[38,29],[39,30],[43,36],[50,39],[51,40],[52,38],[53,41],[55,24],[70,1],[71,5],[72,10],[73,15],[85,18],[86,21],[88,31],[89,32],[90,34],[91,47],[92,51],[105,26],[106,37],[140,2],[141,6],[142,16],[149,52],[150,53],[161,11],[164,13],[165,7],[167,54],[168,55],[172,19],[174,22],[175,35],[177,48],[182,56],[210,60],[214,8],[217,58],[223,59],[236,49],[237,57]];
const ACH_HARD_IDX=[28,33,38,39,54,61,62,88,89,93,98,100,104,107,110,121,122,145,148,152,156,157,160,167,178,181,184,188,219,221,230,238,239,240,241,282,286,289,295,302,303,304,308,353,357,373,377,378,384];

export function extractMetrics(raw) {
  const J = (v) => { if (typeof v === "string") { try { return JSON.parse(v); } catch { return v; } } return v; };
  const dictVals = (o) => Object.keys(o).filter((k) => k !== "length").map((k) => o[k]);
  const sumPos = (a) => a.reduce((s, x) => s + (typeof x === "number" && x > 0 ? x : 0), 0);
  const P = (k) => J(raw[k]);
  const m = {};
  let accountLv = 0, skillsLv = 0;
  for (let i = 0; i < 13; i++) {
    if (!(("Lv0_" + i) in raw)) continue;
    const lv = J(raw["Lv0_" + i]);
    accountLv += lv[0]; skillsLv += sumPos(lv.slice(1));
  }
  m.accountLv = accountLv; m.skillsLv = skillsLv;
  const ci = P("CauldronInfo") || [];
  let bl = 0;
  for (let i = 0; i < 4 && i < ci.length; i++) {
    const arr = Array.isArray(ci[i]) ? ci[i] : dictVals(ci[i] || {});
    bl += sumPos(arr.map(Number).filter((x) => !isNaN(x)));
  }
  m.bubbleLv = Math.round(bl);
  const st = P("StampLv");
  const stampVals = (Array.isArray(st) ? st : [st]).flatMap((pg) => Array.isArray(pg) ? pg : (pg && typeof pg === "object" ? dictVals(pg) : [pg]));
  m.stampLv = Math.round(sumPos(stampVals.map(Number).filter((x) => !isNaN(x))));
  m.vaultLv = sumPos((P("UpgVault") || []).slice(0, 90));
  const wb = P("WeeklyBoss") || {};
  m.dreamsDone = Object.keys(wb).filter((k) => k.startsWith("d_") && wb[k] === -1).length;
  // proper achievement count: 268 real slots; 60 steam-exclusive live in SteamAchieve
  const ach = P("AchieveReg") || [], sta = P("SteamAchieve") || [];
  const steam = Object.fromEntries(ACH_STEAM_MAP);
  m.achievesDone = ACH_REAL_IDX.filter((i) => (i in steam) ? sta[steam[i]] === -1 : ach[i] === -1).length;
  m.artifactScore = ((P("Sailing") || [])[3] || []).slice(0, 41).reduce((s, x) => s + x, 0);
  m.atomLvTotal = sumPos((P("Atoms") || []).slice(0, 15));
  m.greenstacks = (P("GreenStacks") || []).length;
  m.mealLvTotal = sumPos(((P("Meals") || [])[0] || []).filter((x) => typeof x === "number").slice(0, 74));
  m.cardsFound = Object.keys(P("Cards0") || {}).length;
  m.researchNodes = (((P("Research") || [])[0]) || []).filter((x) => x > 0).length;
  m.spelunkZones = (((P("Spelunk") || [])[0]) || []).filter((x) => x > 0).length;
  m.emperorShowdown = (P("OptLacc") || [])[369] || 0;
  return m;
}

/* ---------------- main ---------------- */
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  (cmd === "login" ? login() : fetchSave()).catch((e) => { console.error("\n✗ " + e.message); process.exit(1); });
}
