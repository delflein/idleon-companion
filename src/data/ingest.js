/* src/data/ingest.js — the browser port of db.mjs's ingest()/history()/rebuildDerived(), the
 * single derived-write path whose replay-from-raw property is the backbone of the app
 * (docs/ARCHITECTURE.md D3/D8). Framework-free; runs unchanged on the main thread (tests) or
 * inside worker.js (the real app, so parsing years of raws never janks the UI).
 *
 * THE UNIFIED-METRICS CONTRACT (how one Dexie store reproduces db.mjs's metrics + metrics_live):
 *
 *   - Daily anchor rows: written at the snapshot's ts with `snapshotId` SET. These are what
 *     rebuildDerived() recomputes. Exactly one anchor ts per calendar day (the day's latest sync).
 *   - Live rows: written at every sync ts with `snapshotId` null; never rewritten by rebuild.
 *   - Because the primary key is [key+ts], the daily anchor and the live point for the SAME sync
 *     ts are physically one row (db.mjs's history() union deduped these by (ts,key); here the key
 *     enforces it). The anchor write lands second, so the shared row carries the snapshotId — a
 *     daily, rebuildable row.
 *   - On a same-day re-sync the snapshot's ts moves forward, so the previous anchor must move too.
 *     Rather than delete it (which would erase that earlier sync's intra-day point — db.mjs kept
 *     it in metrics_live), we DEMOTE it: set snapshotId → null. It becomes a live-only row at its
 *     original ts, precisely mirroring db.mjs, and rebuild then leaves it alone.
 *
 * Net effect: history() is a plain index scan (no union/GROUP BY needed — the dedupe is physical),
 * and `rebuildDerived` rewrites only daily rows, never live rows — the same guarantee the SQLite
 * layer gave.
 *
 * DEPENDENCY INJECTION: `deps` defaults to the real parser (extractEntities/metricsFrom from
 * src/core/domain.mjs). Tests inject stubs so they can drive the store contract with a tiny
 * synthetic raw instead of a full ~800-key save (extractEntities runs the whole recipe engine).
 */
import { extractEntities, metricsFrom } from "../core/domain.mjs";
import { db as defaultDb, gzipJson, gunzipJson } from "./db.js";

const REAL_DEPS = { extractEntities, metricsFrom };

/** Keep only finite numeric metrics — db.mjs's `typeof v === "number" && isFinite(v)` guard. */
function numericEntries(metrics) {
  return Object.entries(metrics).filter(([, v]) => typeof v === "number" && isFinite(v));
}

/**
 * Ingest a raw save. One snapshot per calendar day: a same-day sync replaces the snapshot's raw +
 * ts and re-anchors its daily metrics at the new ts (demoting the previous anchor to a live row).
 * Mirrors db.mjs's ingest(db, raw, {ts, source, charNames}).
 *
 * @returns {Promise<{id:number, ts:string, day:string, metricsCount:number}>}
 */
export async function ingest(db, raw, { ts = new Date().toISOString(), source = "sync", charNames = null, deps = REAL_DEPS } = {}) {
  const day = ts.slice(0, 10);
  const e = deps.extractEntities(raw, charNames);
  const metrics = numericEntries(deps.metricsFrom(e));
  const rawGz = await gzipJson(raw);

  return db.transaction("rw", db.snapshots, db.metrics, async () => {
    const existing = await db.snapshots.where("day").equals(day).first();

    let id;
    if (existing) {
      id = existing.id;
      // Demote the previous anchor (only its ts moves; the raw is replaced below). Its rows drop
      // out of the snapshotId index and survive as live-only points at the old ts.
      if (existing.ts !== ts) {
        await db.metrics.where("snapshotId").equals(id).modify({ snapshotId: null });
      } else {
        // Re-sync at the identical ts (unlikely): clear the old anchor so stale keys don't linger.
        await db.metrics.where("snapshotId").equals(id).delete();
      }
      await db.snapshots.update(id, { ts, source, rawGz, charNames });
    } else {
      id = await db.snapshots.add({ ts, day, source, rawGz, charNames });
    }

    // Live rows first (snapshotId null), then daily anchor rows (snapshotId set) at the same ts —
    // the anchor write wins the shared [key+ts], so the final-sync row is a rebuildable daily row.
    await db.metrics.bulkPut(metrics.map(([key, value]) => ({ key, ts, value, snapshotId: null })));
    await db.metrics.bulkPut(metrics.map(([key, value]) => ({ key, ts, value, snapshotId: id })));

    return { id, ts, day, metricsCount: metrics.length };
  });
}

/**
 * Re-derive daily metric rows for every stored raw (run after a parser fix or a new recipe, so all
 * history backfills). Rewrites ONLY snapshotId-set rows — live rows are never touched, exactly as
 * db.mjs's rebuildDerived left metrics_live alone. onProgress({done,total}) is optional.
 *
 * @returns {Promise<number>} number of snapshots replayed
 */
export async function rebuildDerived(db, { deps = REAL_DEPS, onProgress } = {}) {
  const snaps = await db.snapshots.orderBy("ts").toArray();
  const withRaw = snaps.filter((s) => s.rawGz);
  let done = 0;
  for (const snap of withRaw) {
    const raw = await gunzipJson(snap.rawGz);
    const e = deps.extractEntities(raw, snap.charNames ?? null);
    const metrics = numericEntries(deps.metricsFrom(e));
    await db.transaction("rw", db.metrics, async () => {
      // Delete this snapshot's current daily anchor (snapshotId-set rows only — the index excludes
      // the null/live rows), then re-write it at the snapshot's ts. Live rows are untouched.
      await db.metrics.where("snapshotId").equals(snap.id).delete();
      await db.metrics.bulkPut(metrics.map(([key, value]) => ({ key, ts: snap.ts, value, snapshotId: snap.id })));
    });
    done += 1;
    onProgress?.({ done, total: withRaw.length });
  }
  return withRaw.length;
}

/**
 * Time-series over the unified metrics store — db.mjs's history() shape: {key: [{ts, v}, ...]}
 * sorted by ts. No union/dedupe step: the [key+ts] primary key already collapsed the daily/live
 * overlap. `keys` null = every key; `from` = inclusive ISO lower bound.
 */
export async function history(db, keys = null, from = null) {
  const out = {};
  const push = (key, ts, v) => (out[key] ??= []).push({ ts, v });

  if (keys && keys.length) {
    for (const key of keys) {
      const lo = [key, from ?? ""];
      const hi = [key, "￿"]; // sorts after any real ISO ts, so the range is [from, end-of-key]
      await db.metrics.where("[key+ts]").between(lo, hi, true, true).each((r) => push(r.key, r.ts, r.value));
    }
  } else {
    // All keys: a single scan, optionally ts-filtered in JS (rare path — the app always passes keys).
    await db.metrics.orderBy("[key+ts]").each((r) => {
      if (!from || r.ts >= from) push(r.key, r.ts, r.value);
    });
  }

  // `between` already yields ts-ascending per key; the all-keys path is [key+ts]-ordered too.
  return out;
}

/** Convenience for the default app connection (worker.js and appState.js pass their own handle). */
export const ingestInto = (raw, opts) => ingest(defaultDb, raw, opts);
