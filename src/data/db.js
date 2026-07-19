/* src/data/db.js — Dexie 4 (IndexedDB) storage layer, the browser replacement for db.mjs's
 * node:sqlite persistence (docs/ARCHITECTURE.md D3). Framework-free (no Vue import) so it is
 * reusable from a Web Worker — worker.js opens its own connection to the same database.
 *
 * SCHEMA v1 — three stores (D3 collapses db.mjs's 7 tables to 3; the derived tables
 * `entities`/`players`/`player_skills`/`achievement_state` are dropped, not ported: they existed
 * only so HTTP endpoints could avoid re-parsing, and in-browser the parse result lives in memory):
 *
 *   snapshots  ++id, ts (ISO), &day (unique — one snapshot per calendar day), source, rawGz
 *              (Uint8Array, CompressionStream gzip of the raw save JSON), charNames (string[]|null)
 *
 *   metrics    [key+ts] (compound primary key), value, snapshotId
 *              This ONE store unifies db.mjs's `metrics` + `metrics_live`. `snapshotId` set = a
 *              daily rebuildable anchor row (rebuildDerived rewrites these); `snapshotId` null =
 *              a live-only intra-day row (never rewritten). Because the primary key is [key+ts],
 *              the day's-final-sync row is physically SHARED between the two layers — that is the
 *              old history() union's (ts,key) dedupe, now enforced by the key itself rather than a
 *              GROUP BY. See ingest.js for the daily/live write + demote-on-resync contract.
 *              IndexedDB does not index null keys, so `where('snapshotId').equals(id)` naturally
 *              returns ONLY the daily (set) rows — exactly what demote/rebuild need.
 *
 *   settings   key (primary), value
 */
import Dexie from "dexie";

/** Open (or create) a database handle. A factory rather than a bare singleton so tests can spin
 * up isolated databases; the app and worker use the default-named connections below. */
export function createDb(name = "idleon") {
  const db = new Dexie(name);
  db.version(1).stores({
    // Only `day` is unique; `ts` is indexed for latest()/date-range queries. rawGz + charNames
    // are stored but not indexed. Compound PK on metrics; `snapshotId` indexed for demote/rebuild.
    snapshots: "++id, ts, &day, source",
    metrics: "[key+ts], snapshotId",
    settings: "key",
  });
  return db;
}

/** The app-wide (main-thread) connection. worker.js opens its own with the SAME name. */
export const db = createDb();

/* ---------- gzip helpers (CompressionStream/DecompressionStream — framework-free, worker-safe,
 * Baseline-available; the direct map of db.mjs's node:zlib gzipSync/gunzipSync) ---------- */

/** JSON-serialise + gzip an object to a Uint8Array (what `snapshots.rawGz` stores). */
export async function gzipJson(obj) {
  const bytes = new TextEncoder().encode(JSON.stringify(obj));
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream("gzip"));
  const buf = await new Response(stream).arrayBuffer();
  return new Uint8Array(buf);
}

/** Inverse of gzipJson: gunzip a Uint8Array back into a parsed object. */
export async function gunzipJson(u8) {
  const stream = new Blob([u8]).stream().pipeThrough(new DecompressionStream("gzip"));
  const buf = await new Response(stream).arrayBuffer();
  return JSON.parse(new TextDecoder().decode(buf));
}

/* ---------- read helpers used by appState.js / DataPage.vue (thin wrappers over Dexie) ---------- */

/** The most recent snapshot row (by ts), or null. Mirrors db.mjs's latest() shape sans entities/
 * metrics — those are recomputed in memory (openSave) rather than persisted. */
export async function latestSnapshot(database = db) {
  return (await database.snapshots.orderBy("ts").last()) ?? null;
}

/** Gunzip + parse a stored snapshot's raw save (db.mjs's rawOf). Null if the snapshot or its raw
 * is missing (legacy metric-only imports carry no rawGz). */
export async function getRaw(id, database = db) {
  const snap = await database.snapshots.get(id);
  if (!snap?.rawGz) return null;
  return gunzipJson(snap.rawGz);
}

/** {count, first, last} over the snapshots store — for DataPage's "N snapshots, DATE–DATE". */
export async function snapshotStats(database = db) {
  const count = await database.snapshots.count();
  if (!count) return { count: 0, first: null, last: null };
  const first = await database.snapshots.orderBy("ts").first();
  const last = await database.snapshots.orderBy("ts").last();
  return { count, first: first.ts, last: last.ts };
}

/* ---------- settings (db.mjs's getSetting/setSetting; values stored as strings, as before) ---------- */

export async function getSetting(key, dflt = null, database = db) {
  const row = await database.settings.get(key);
  return row ? row.value : dflt;
}

export async function setSetting(key, value, database = db) {
  await database.settings.put({ key, value: String(value) });
}
