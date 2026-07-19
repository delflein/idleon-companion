#!/usr/bin/env node
/* scripts/smoke-derived.mjs — NODE PARITY HARNESS for the M5-prep derivation layer.
 *
 * THE POINT: prove src/data/derived.js reproduces the legacy Node server's actual JSON, leaf for
 * leaf. It (1) loads the latest raw from ./idleon.db (node:sqlite, skip-if-missing like
 * smoke-core.mjs), (2) runs deriveEntities/deriveMetrics/deriveStats/deriveFarming + every wN
 * glossary, and (3) if the live companion server on :8317 responds, deep-diffs each derivation
 * against the matching endpoint (/api/state, /api/stats, /api/farming, /api/w1..w7), reporting the
 * count of differing leaves and the first 10 paths. Metrics/stats MUST match exactly — same code
 * paths on both sides (the server calls the very functions derived.js wraps).
 *
 * The manual stat inputs are read from idleon.db's own settings table so statOpts matches what the
 * server used. If the server isn't running, the derivations still run (self-check) and the
 * server-comparison is skipped gracefully.
 */
import { existsSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { DatabaseSync } from "node:sqlite";

import { openSave } from "../src/core/savemap.mjs";
import {
  deriveEntities, deriveMetrics, deriveStats, deriveFarming,
  w1Glossary, w2Glossary, w3Glossary, w4Glossary, w5Glossary, w6Glossary, w7Glossary,
} from "../src/data/derived.js";

const DB_PATH = new URL("../idleon.db", import.meta.url).pathname;
const SERVER = process.env.COMPANION_URL || "http://localhost:8317";

if (!existsSync(DB_PATH)) {
  console.log("SKIP: idleon.db not found (CI has no save data — expected there).");
  process.exit(0);
}

const db = new DatabaseSync(DB_PATH, { readOnly: true });
const snap = db.prepare("SELECT id, ts, char_names, raw_gz FROM snapshots WHERE raw_gz IS NOT NULL ORDER BY ts DESC LIMIT 1").get();
const getSetting = (k, d = "") => db.prepare("SELECT value FROM settings WHERE key=?").get(k)?.value ?? d;
const settings = {
  statTomePoints: getSetting("statTomePoints", ""),
  statLabConnected: getSetting("statLabConnected", ""),
  statActiveVote: getSetting("statActiveVote", ""),
};
db.close();

if (!snap) {
  console.log("SKIP: idleon.db has no snapshot with raw_gz.");
  process.exit(0);
}

// statOpts() — companion.mjs's parser verbatim, from the DB's own settings (so we match the server).
const statOpts = {
  tomePoints: settings.statTomePoints !== "" && isFinite(Number(settings.statTomePoints)) ? Number(settings.statTomePoints) : null,
  labConnectedIds: settings.statLabConnected !== ""
    ? settings.statLabConnected.split(",").map((x) => Number(x.trim())).filter(Number.isFinite) : null,
  activeVote: settings.statActiveVote !== "" && isFinite(Number(settings.statActiveVote)) ? Number(settings.statActiveVote) : null,
};

const raw = JSON.parse(gunzipSync(snap.raw_gz).toString("utf8"));
const charNames = snap.char_names ? JSON.parse(snap.char_names) : null;
const save = openSave(raw, charNames);

/* ---- run the derivation layer ---- */
const derived = {
  entities: deriveEntities(raw, charNames),
  stats: deriveStats(save, statOpts),
  farming: deriveFarming(save, statOpts),
  glossaries: { w1: w1Glossary(), w2: w2Glossary(), w3: w3Glossary(), w4: w4Glossary(), w5: w5Glossary(), w6: w6Glossary(), w7: w7Glossary() },
};
derived.metrics = deriveMetrics(derived.entities);

console.log(`derivation layer ran: snapshot #${snap.id} @ ${snap.ts}`);
console.log(`  entities: ${Object.keys(derived.entities).length} systems`);
console.log(`  metrics:  ${Object.keys(derived.metrics).length} keys`);
console.log(`  stats:    ${Object.keys(derived.stats).length} recipes`);
console.log(`  farming:  ${derived.farming ? "report built" : "null"}`);
console.log(`  glossaries: w1..w7 built`);

/* ---- deep-diff helper: collect leaf paths whose values differ ---- */
function diffLeaves(a, b, path = "", out = []) {
  if (out.length > 5000) return out; // safety cap
  const ta = typeof a, tb = typeof b;
  const isObjA = a && ta === "object", isObjB = b && tb === "object";
  if (isObjA || isObjB) {
    if (!isObjA || !isObjB || Array.isArray(a) !== Array.isArray(b)) { out.push(path || "(root)"); return out; }
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const k of keys) {
      if (!(k in a) || !(k in b)) { out.push(`${path}${path ? "." : ""}${k}`); continue; }
      diffLeaves(a[k], b[k], `${path}${path ? "." : ""}${k}`, out);
    }
    return out;
  }
  // primitives — exact equality (Object.is treats NaN===NaN true, -0!==0; game values are finite)
  if (!Object.is(a, b)) out.push(path || "(root)");
  return out;
}

function report(label, ours, theirs) {
  const paths = diffLeaves(ours, theirs);
  if (paths.length === 0) { console.log(`  ✓ ${label}: exact match`); return 0; }
  console.log(`  ✗ ${label}: ${paths.length} differing leaf/leaves`);
  for (const p of paths.slice(0, 10)) console.log(`      ${p}`);
  return paths.length;
}

/* ---- compare against the live legacy server, if it's up ---- */
/** Returns { status, json } — status 0 on network error. Never throws (per-endpoint resilience:
 * a stale server missing /api/w3..w7 must skip those, not abort the whole run). */
async function getJson(path) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(`${SERVER}${path}`, { signal: ctrl.signal });
    const json = await res.json().catch(() => null);
    return { status: res.status, json };
  } catch { return { status: 0, json: null }; }
  finally { clearTimeout(t); }
}

const probe = await getJson("/api/state");
if (probe.status === 0) {
  console.log(`\nSKIP server parity: ${SERVER} not responding (start companion.mjs to compare). Derivations ran clean above.`);
  process.exit(0);
}

console.log(`\ncomparing against live server ${SERVER} ...`);
let totalDiffs = 0, compared = 0, skipped = 0;

/** Compare one endpoint; skip (not fail) if the server lacks it or returned an error payload.
 * `theirs` is already JSON-parsed from the wire; we JSON-normalise `ours` too so the comparison is
 * wire-shape vs wire-shape — otherwise in-memory `-0` (e.g. a `(v)=>-v` transform on 0) would
 * spuriously differ from the server's JSON-collapsed `0`. That is the honest comparison: the page
 * receives exactly this JSON today. */
function compare(label, theirs, ours) {
  if (theirs === undefined || theirs === null) { console.log(`  – ${label}: server has no such data (skipped)`); skipped++; return; }
  compared++;
  totalDiffs += report(label, JSON.parse(JSON.stringify(ours)), theirs);
}

// /api/state serves entities/metrics PERSISTED in SQLite (writeDerived at ingest/rebuild time) —
// it matches a fresh derive only if the server rebuilt with the SAME code. Flagged, not asserted.
if (probe.json?.snapshot) {
  compare("/api/state entities", probe.json.snapshot.entities, derived.entities);
  compare("/api/state metrics", probe.json.snapshot.metrics, derived.metrics);
}

const stats = await getJson("/api/stats");
compare("/api/stats stats", stats.json?.stats, derived.stats);

const farming = await getJson("/api/farming");
compare("/api/farming report", farming.json?.report, derived.farming);

for (const w of [1, 2, 3, 4, 5, 6, 7]) {
  const resp = await getJson(`/api/w${w}`);
  if (resp.status === 404 || resp.json?.ok === false) { console.log(`  – /api/w${w} glossary: endpoint absent on this server (skipped)`); skipped++; continue; }
  const { ok, ...gloss } = resp.json ?? {}; // server spreads glossary into { ok, ...wNGlossary() }
  void ok;
  compare(`/api/w${w} glossary`, gloss, derived.glossaries[`w${w}`]);
}

console.log(`\n${totalDiffs === 0 ? "PASS" : "DIFF"} — ${compared} endpoints compared, ${skipped} skipped, ${totalDiffs} differing leaves total.`);
if (totalDiffs !== 0) console.log("(A DIFF against a STALE server is expected — start a current-code server for a true parity number; see the harness header.)");
process.exit(totalDiffs === 0 ? 0 : 1);
