/* test/data.test.js — the src/data storage-layer contract (docs/ARCHITECTURE.md D3).
 * Run with `npm test` (node --test + fake-indexeddb, no browser needed).
 *
 * The parser is stubbed via ingest()'s `deps` injection: extractEntities/metricsFrom run the whole
 * ~25k-LOC recipe engine over a full ~800-key save, which is impractical to synthesise here. The
 * stub lets a tiny raw drive every store-contract path (same-day replace, daily/live union+dedupe,
 * rebuild-daily-not-live, import/export). The real parser is exercised by M2's core smoke tests.
 */
import "./setup.js"; // MUST be first: installs fake-indexeddb + aliases `self` for dexie-export-import
import { test } from "node:test";
import assert from "node:assert/strict";

import { createDb, getRaw } from "../src/data/db.js";
import { ingest, rebuildDerived, history } from "../src/data/ingest.js";
import { exportFile, importFile } from "../src/data/importExport.js";

let dbSeq = 0;
function freshDb() {
  return createDb(`test-${Date.now()}-${dbSeq++}`);
}

/** Stub parser: metrics come straight from the raw, so a test controls each snapshot's values. */
function stubDeps(metricKeys = ["foo", "bar"]) {
  return {
    extractEntities: (raw, charNames) => ({ raw, charNames }),
    metricsFrom: (e) => Object.fromEntries(metricKeys.map((k) => [k, e.raw[k]])),
  };
}
const deps = stubDeps();

test("ingest: one snapshot per calendar day; same-day sync replaces raw + ts", async () => {
  const db = freshDb();
  await ingest(db, { foo: 1, bar: 10 }, { ts: "2026-01-01T08:00:00.000Z", source: "sync", deps });
  await ingest(db, { foo: 2, bar: 20 }, { ts: "2026-01-01T20:00:00.000Z", source: "sync", deps });

  const snaps = await db.snapshots.toArray();
  assert.equal(snaps.length, 1, "same day collapses to a single snapshot");
  assert.equal(snaps[0].ts, "2026-01-01T20:00:00.000Z", "ts advances to the latest sync");
  assert.equal(snaps[0].day, "2026-01-01");
  assert.deepEqual(await getRaw(snaps[0].id, db), { foo: 2, bar: 20 }, "raw is replaced by the latest sync");

  // A different day makes a new snapshot.
  await ingest(db, { foo: 3, bar: 30 }, { ts: "2026-01-02T09:00:00.000Z", deps });
  assert.equal(await db.snapshots.count(), 2);
});

test("history: union + (ts,key) dedupe across daily anchors and intra-day live rows", async () => {
  const db = freshDb();
  // Three syncs on day 1 (intra-day) + one on day 2.
  await ingest(db, { foo: 1, bar: 0 }, { ts: "2026-03-01T08:00:00.000Z", deps });
  await ingest(db, { foo: 2, bar: 0 }, { ts: "2026-03-01T12:00:00.000Z", deps });
  await ingest(db, { foo: 3, bar: 0 }, { ts: "2026-03-01T18:00:00.000Z", deps });
  await ingest(db, { foo: 9, bar: 0 }, { ts: "2026-03-02T10:00:00.000Z", deps });

  const h = await history(db, ["foo"]);
  assert.deepEqual(
    h.foo,
    [
      { ts: "2026-03-01T08:00:00.000Z", v: 1 }, // demoted to live when 12:00 synced
      { ts: "2026-03-01T12:00:00.000Z", v: 2 }, // demoted to live when 18:00 synced
      { ts: "2026-03-01T18:00:00.000Z", v: 3 }, // day-1 final anchor (daily)
      { ts: "2026-03-02T10:00:00.000Z", v: 9 }, // day-2 anchor
    ],
    "every sync ts survives once, ts-ascending, no duplicate at the shared final-sync ts"
  );

  // `from` lower bound (inclusive) filters older points.
  const h2 = await history(db, ["foo"], "2026-03-01T12:00:00.000Z");
  assert.deepEqual(h2.foo.map((p) => p.v), [2, 3, 9]);
});

test("history: the day's final-sync row is physically shared (one row, not two)", async () => {
  const db = freshDb();
  await ingest(db, { foo: 5, bar: 0 }, { ts: "2026-04-01T09:00:00.000Z", deps });
  // Exactly one metrics row exists at the anchor ts for key foo (daily+live collapsed by [key+ts]).
  const rows = await db.metrics.where("[key+ts]").equals(["foo", "2026-04-01T09:00:00.000Z"]).toArray();
  assert.equal(rows.length, 1);
  assert.notEqual(rows[0].snapshotId, null, "the shared row is the rebuildable daily row (snapshotId set)");
});

test("rebuildDerived: rewrites daily anchors, never touches live rows", async () => {
  const db = freshDb();
  // Two same-day syncs: 08:00 becomes a live row, 18:00 is the daily anchor.
  await ingest(db, { foo: 1, bar: 0 }, { ts: "2026-05-01T08:00:00.000Z", deps });
  await ingest(db, { foo: 2, bar: 0 }, { ts: "2026-05-01T18:00:00.000Z", deps });

  // A parser change: foo now reads doubled. Rebuild replays the STORED raws (which hold foo:2 for
  // this day's snapshot — the raw was replaced on the 18:00 sync).
  const doubling = {
    extractEntities: (raw, charNames) => ({ raw, charNames }),
    metricsFrom: (e) => ({ foo: e.raw.foo * 100, bar: e.raw.bar }),
  };
  const n = await rebuildDerived(db, { deps: doubling });
  assert.equal(n, 1, "one raw-bearing snapshot replayed");

  const h = await history(db, ["foo"]);
  assert.deepEqual(
    h.foo,
    [
      { ts: "2026-05-01T08:00:00.000Z", v: 1 }, // live row: untouched by rebuild
      { ts: "2026-05-01T18:00:00.000Z", v: 200 }, // daily anchor: recomputed (2 * 100)
    ],
    "rebuild rewrote only the daily anchor; the intra-day live point kept its original value"
  );
});

test("export/import (dexie backup): roundtrip preserves snapshot bytes and metrics", async () => {
  const src = freshDb();
  await ingest(src, { foo: 7, bar: 70 }, { ts: "2026-06-01T08:00:00.000Z", source: "sync", charNames: ["Alice", "Bob"], deps });
  await ingest(src, { foo: 8, bar: 80 }, { ts: "2026-06-02T08:00:00.000Z", source: "sync", charNames: ["Alice", "Bob"], deps });

  const blob = await exportFile({ db: src });

  const dst = freshDb();
  const res = await importFile(new File([blob], "backup.json"), { db: dst });
  assert.equal(res.format, "dexie");

  assert.equal(await dst.snapshots.count(), 2);
  const raw = await getRaw((await dst.snapshots.orderBy("ts").last()).id, dst);
  assert.deepEqual(raw, { foo: 8, bar: 80 }, "raw survives the roundtrip byte-for-byte");

  const h = await history(dst, ["foo"]);
  assert.deepEqual(h.foo.map((p) => p.v), [7, 8]);
});

test("import (SQLite-era file): raws + settings + live rows restored, daily metrics rebuilt", async () => {
  // Build a v1 export payload by hand: rawB64 is a gzipped raw, exactly what the store keeps.
  const { gzipJson } = await import("../src/data/db.js");
  const toB64 = (u8) => btoa(String.fromCharCode(...u8)); // browser-safe (no Node Buffer)
  const rawA = { foo: 4, bar: 40 };
  const payload = {
    version: 1,
    snapshots: [{ ts: "2026-07-01T10:00:00.000Z", source: "import", charNames: ["X"], rawB64: toB64(await gzipJson(rawA)) }],
    settings: { autoRefreshMin: "15", statTomePoints: "44931" },
    liveMetrics: [{ ts: "2026-07-01T06:00:00.000Z", key: "foo", value: 3 }],
  };
  const file = new File([JSON.stringify(payload)], "idleon-export.json");

  const db = freshDb();
  // Drive the REAL importFile SQLite path; inject the stub parser so the rebuild leg stays
  // parser-free (rebuildDerived-with-real-parser is out of scope — covered by M2 core smoke tests).
  const res = await importFile(file, { db, deps });
  assert.equal(res.format, "sqlite");
  assert.equal(res.snapshots, 1);

  assert.equal((await db.settings.get("statTomePoints")).value, "44931");
  assert.deepEqual(await getRaw((await db.snapshots.orderBy("ts").first()).id, db), rawA);

  const h = await history(db, ["foo"]);
  assert.deepEqual(
    h.foo,
    [
      { ts: "2026-07-01T06:00:00.000Z", v: 3 }, // live intra-day row from the file (not rebuildable)
      { ts: "2026-07-01T10:00:00.000Z", v: 4 }, // daily anchor rebuilt from the raw
    ],
    "live rows travel in the file; daily rows rebuild from the raw"
  );
});
