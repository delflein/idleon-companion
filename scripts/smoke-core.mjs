/* scripts/smoke-core.mjs — parity smoke test for the M2 core move (docs/ARCHITECTURE.md).
 *
 * Opens ./idleon.db (read-only), takes the latest snapshot's raw_gz, gunzips it, and runs the
 * full pipeline a page would: openSave -> extractEntities -> metricsFrom -> every registered
 * stat recipe via evaluatePerChar (artifactSourceChar for activeChar, matching domain.mjs's own
 * e.stats computation — no manual per-recipe opts). Writes a deterministic JSON digest to the
 * path given as argv[2]: entities key-counts, every metric key/value, and every stat's
 * value/lowerBound/unknown-count, per character where the recipe is active-char-sensitive.
 *
 * Used to prove the M2 file move (root -> src/core, src/gamedata) is byte-for-byte behavior
 * preserving: run once before the move, once after (this file's own imports get repointed as
 * part of the move), and diff the two digests.
 *
 * CI has no idleon.db (it holds real save data, gitignored) — this prints SKIP and exits 0
 * rather than failing the build.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { DatabaseSync } from "node:sqlite";

import { openSave } from "../src/core/savemap.mjs";
import { extractEntities, metricsFrom, artifactSourceChar } from "../src/core/domain.mjs";
import { RECIPES, evaluatePerChar } from "../src/core/stats/index.mjs";

const DB_PATH = new URL("../idleon.db", import.meta.url).pathname;
const outPath = process.argv[2];
if (!outPath) {
  console.error("usage: node scripts/smoke-core.mjs <output-digest.json>");
  process.exit(1);
}

if (!existsSync(DB_PATH)) {
  console.log("SKIP: idleon.db not found (CI has no save data — this is expected there).");
  process.exit(0);
}

const db = new DatabaseSync(DB_PATH, { readOnly: true });
const snap = db.prepare("SELECT id, ts, char_names, raw_gz FROM snapshots ORDER BY ts DESC LIMIT 1").get();
db.close();

if (!snap || !snap.raw_gz) {
  console.log("SKIP: idleon.db has no snapshot with raw_gz.");
  process.exit(0);
}

const raw = JSON.parse(gunzipSync(snap.raw_gz).toString("utf8"));
const charNames = snap.char_names ? JSON.parse(snap.char_names) : null;

const save = openSave(raw, charNames);
const e = extractEntities(raw, charNames);
const metrics = metricsFrom(e);
const activeChar = artifactSourceChar(save);

/* entities: key-counts only (not full content — the digest must stay small and readable; the
 * recipe/metric sections below are the actual behavior-parity signal). */
const entityCounts = {};
for (const [name, val] of Object.entries(e)) {
  if (Array.isArray(val)) entityCounts[name] = val.length;
  else if (val && typeof val === "object") entityCounts[name] = Object.keys(val).length;
  else entityCounts[name] = val;
}

const statResult = (result) => ({
  value: result.value,
  lowerBound: result.lowerBound,
  unknownCount: result.unknown.length,
});

const stats = {};
for (const recipe of RECIPES) {
  const { byChar, collapsed } = evaluatePerChar(recipe, save, { activeChar });
  stats[recipe.name] = {
    collapsed: statResult(collapsed),
    byChar: byChar ? byChar.map((c) => ({ charIdx: c.charIdx, ...statResult(c.result) })) : null,
  };
}

/* Canonicalize key order recursively so the digest is byte-identical run-to-run regardless of
 * any incidental insertion-order differences — the actual parity signal is the values. */
function sortKeys(v) {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === "object") {
    const out = {};
    for (const k of Object.keys(v).sort()) out[k] = sortKeys(v[k]);
    return out;
  }
  return v;
}

const digest = sortKeys({
  snapshotId: snap.id,
  snapshotTs: snap.ts,
  entities: entityCounts,
  metrics,
  stats,
});

writeFileSync(outPath, JSON.stringify(digest, null, 2) + "\n");
console.log(`wrote ${outPath} (snapshot ${snap.id}, ${Object.keys(metrics).length} metrics, ${RECIPES.length} recipes)`);
