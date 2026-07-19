/* src/data/importExport.js — backup + one-time SQLite-era migration (docs/ARCHITECTURE.md D3/D8).
 *
 * Two formats are read by importFile():
 *   1. The dexie-export-import blob (the ONGOING backup format, D3) — plain JSON, detected by its
 *      `{formatName:"dexie"}` header. Restored verbatim via dexie-export-import.
 *   2. The SQLite-era migration file idleon-export.json.gz produced by scripts/export-sqlite.mjs —
 *      `{version:1, snapshots:[{ts,source,charNames,rawB64}], settings, liveMetrics}`. Metrics are
 *      NOT in the file: daily rows REBUILD from the raws (D3's replay invariant), while the
 *      intra-day liveMetrics rows (which cannot be rebuilt) are restored directly as null-snapshot
 *      rows. rawB64 is the gzipped raw already, so it is stored as rawGz with no re-compression.
 *
 * exportFile() always writes format (1) — the dexie blob — because it round-trips the exact stored
 * bytes (including live rows) losslessly.
 */
import { exportDB, importInto } from "dexie-export-import";
import { db as defaultDb, gunzipJson } from "./db.js";
import { rebuildDerived } from "./ingest.js";

/* ---------- helpers ---------- */

function isGzip(u8) {
  return u8.length >= 2 && u8[0] === 0x1f && u8[1] === 0x8b;
}

function b64ToU8(b64) {
  const bin = atob(b64);
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return u8;
}

/** Read a File/Blob into a parsed object, transparently gunzipping if it carries the gzip magic. */
async function readMaybeGzippedJson(file) {
  const u8 = new Uint8Array(await file.arrayBuffer());
  if (isGzip(u8)) return gunzipJson(u8);
  return JSON.parse(new TextDecoder().decode(u8));
}

/* ---------- import ---------- */

/**
 * Import either format. Returns a small summary. onProgress({done,total}) fires during a SQLite-era
 * rebuild (the slow leg). The dexie path streams internally and reports through importInto's own
 * progress callback.
 */
export async function importFile(file, { db = defaultDb, onProgress, deps } = {}) {
  // A dexie blob is plain (non-gzip) JSON; peek at the first bytes to route without a full parse.
  const head = new Uint8Array(await file.slice(0, 2).arrayBuffer());
  if (!isGzip(head)) {
    const text = await file.text();
    let parsed = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      /* not JSON — fall through to the gzip/custom path below */
    }
    if (parsed?.formatName === "dexie") {
      await importInto(db, new Blob([text]), {
        acceptNameDiff: true,
        clearTablesBeforeImport: true,
        progressCallback: ({ completedRows, totalRows }) => {
          onProgress?.({ done: completedRows, total: totalRows ?? 0 });
          return true;
        },
      });
      return { format: "dexie" };
    }
  }

  // SQLite-era migration file (gzipped custom JSON).
  const data = await readMaybeGzippedJson(file);
  if (data?.version !== 1 || !Array.isArray(data.snapshots)) {
    throw new Error("Unrecognised backup file (neither a dexie export nor a v1 SQLite export)");
  }
  return importSqliteExport(db, data, onProgress, deps);
}

async function importSqliteExport(db, data, onProgress, deps) {
  await db.transaction("rw", db.snapshots, db.metrics, db.settings, async () => {
    await db.snapshots.clear();
    await db.metrics.clear();
    await db.settings.clear();

    // Snapshots: rawB64 is the gzipped raw already → store straight as rawGz.
    for (const s of data.snapshots) {
      await db.snapshots.add({
        ts: s.ts,
        day: s.ts.slice(0, 10),
        source: s.source ?? "import",
        rawGz: s.rawB64 ? b64ToU8(s.rawB64) : null,
        charNames: s.charNames ?? null,
      });
    }

    // Live intra-day rows (not rebuildable) restored as null-snapshot rows BEFORE the rebuild, so
    // the daily anchors written by rebuildDerived win any shared [key+ts] (same contract as ingest).
    if (Array.isArray(data.liveMetrics)) {
      await db.metrics.bulkPut(
        data.liveMetrics
          .filter((m) => typeof m.value === "number" && isFinite(m.value))
          .map((m) => ({ key: m.key, ts: m.ts, value: m.value, snapshotId: null }))
      );
    }

    // Settings k/v.
    if (data.settings) {
      for (const [key, value] of Object.entries(data.settings)) {
        await db.settings.put({ key, value: String(value) });
      }
    }
  });

  // Daily metrics rebuild from the raws (D3 invariant). Outside the import transaction because
  // rebuildDerived opens its own per-snapshot transactions.
  const rebuilt = await rebuildDerived(db, { onProgress, ...(deps ? { deps } : {}) });
  return { format: "sqlite", snapshots: data.snapshots.length, rebuilt };
}

/* ---------- export ---------- */

/** Produce the ongoing-backup blob (dexie-export-import format). Caller triggers the download. */
export async function exportFile({ db = defaultDb } = {}) {
  return exportDB(db, { prettyJson: false });
}
