#!/usr/bin/env node
/* scripts/export-sqlite.mjs — one-time migration dump from the SQLite era (db.mjs / idleon.db) to
 * the browser data layer (docs/ARCHITECTURE.md D3/D8). Reads ./idleon.db and writes
 * idleon-export.json.gz for src/data/importExport.js to consume.
 *
 * File shape (version 1):
 *   {
 *     version: 1,
 *     snapshots: [{ ts, source, charNames, rawB64 }],   // rawB64 = the stored gzipped raw,
 *                                                        //          base64'd (NOT re-compressed)
 *     settings: { key: value, ... },
 *     liveMetrics: [{ ts, key, value }]                  // intra-day rows — NOT rebuildable, so
 *                                                        //   they must travel in the file
 *   }
 *
 * `metrics` (daily) is deliberately OMITTED: every daily row re-derives from the raws on import via
 * rebuildDerived(). Only the raws, the live intra-day points, and settings are non-recomputable.
 *
 * Node 22.5+ (built-in node:sqlite), zero npm deps — same runtime as companion.mjs.
 */
import { DatabaseSync } from "node:sqlite";
import { gzipSync } from "node:zlib";
import { writeFileSync, existsSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const DIR = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(DIR, "..", "idleon.db");
const OUT_PATH = join(DIR, "..", "idleon-export.json.gz");

if (!existsSync(DB_PATH)) {
  console.error(`No database at ${DB_PATH} — nothing to export.`);
  process.exit(1);
}

const db = new DatabaseSync(DB_PATH);

const snapshots = db
  .prepare("SELECT ts, source, raw_gz, char_names FROM snapshots WHERE raw_gz IS NOT NULL ORDER BY ts")
  .all()
  .map((r) => ({
    ts: r.ts,
    source: r.source,
    charNames: r.char_names ? JSON.parse(r.char_names) : null,
    // raw_gz is already gzipped by db.mjs — base64 it as-is; the browser stores these bytes back
    // into snapshots.rawGz untouched.
    rawB64: Buffer.from(r.raw_gz).toString("base64"),
  }));

const settings = Object.fromEntries(
  db.prepare("SELECT key, value FROM settings").all().map((r) => [r.key, r.value])
);

const liveMetrics = db
  .prepare("SELECT ts, key, value FROM metrics_live ORDER BY ts, key")
  .all()
  .map((r) => ({ ts: r.ts, key: r.key, value: r.value }));

const payload = { version: 1, snapshots, settings, liveMetrics };
const gz = gzipSync(Buffer.from(JSON.stringify(payload)));
writeFileSync(OUT_PATH, gz);

const size = statSync(OUT_PATH).size;
console.log(
  `Wrote ${OUT_PATH}\n` +
    `  ${snapshots.length} snapshots, ${liveMetrics.length} live-metric rows, ` +
    `${Object.keys(settings).length} settings\n` +
    `  ${size} bytes (${(size / 1024).toFixed(1)} KiB)`
);
