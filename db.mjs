/* db.mjs — SQLite persistence for the IdleOn companion (node:sqlite, Node 22.5+).
 * Schema: full raw saves (gzipped) + structured entities per snapshot + long-format metrics.
 * New metrics/entities can be backfilled retroactively from stored raws (rebuildDerived).
 */
import { DatabaseSync } from "node:sqlite";
import { gzipSync, gunzipSync } from "node:zlib";
import { extractEntities, metricsFrom } from "./domain.mjs";
import { SKILL } from "./savemap.mjs";

const SKILL_NAMES = Object.keys(SKILL);

/* The single derived-write path. ingest() and rebuildDerived() both go through this, so adding
 * a table here backfills over all history automatically — that property is the backbone of the
 * app and must not regress. */
function writeDerived(db, id, e, metrics) {
  for (const t of ["metrics", "entities", "achievement_state", "players", "player_skills"])
    db.prepare(`DELETE FROM ${t} WHERE snapshot_id=?`).run(id);

  const mIns = db.prepare("INSERT INTO metrics (snapshot_id, key, value) VALUES (?,?,?)");
  for (const [k, v] of Object.entries(metrics)) if (typeof v === "number" && isFinite(v)) mIns.run(id, k, v);

  const eIns = db.prepare("INSERT INTO entities (snapshot_id, entity, json) VALUES (?,?,?)");
  for (const [name, val] of Object.entries(e)) eIns.run(id, name, JSON.stringify(val));

  const aIns = db.prepare("INSERT INTO achievement_state (snapshot_id, ach_i, done, progress) VALUES (?,?,?,?)");
  for (const a of e.achievements) aIns.run(id, a.i, a.done ? 1 : 0, a.progress);

  const pIns = db.prepare("INSERT INTO players (snapshot_id, char_idx, name, class_id, class_name, level, skills_total) VALUES (?,?,?,?,?,?,?)");
  const sIns = db.prepare("INSERT INTO player_skills (snapshot_id, char_idx, skill, level) VALUES (?,?,?,?)");
  for (const c of e.characters) {
    pIns.run(id, c.idx, c.name, c.classId ?? null, c.className ?? null, c.level ?? null, c.skillsTotal ?? null);
    // skillLevels is Lv0_N.slice(1), i.e. already skill-id indexed. -1 means "not unlocked".
    (c.skillLevels || []).forEach((lv, i) => {
      if (SKILL_NAMES[i] && typeof lv === "number" && lv >= 0) sIns.run(id, c.idx, SKILL_NAMES[i], lv);
    });
  }
}

export function openDb(path) {
  const db = new DatabaseSync(path);
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ts TEXT NOT NULL,                 -- ISO time of fetch
      source TEXT NOT NULL,             -- 'sync' | 'import' | 'file'
      raw_gz BLOB,                      -- gzipped raw save JSON (nullable for legacy imports)
      char_names TEXT                   -- JSON array
    );
    CREATE INDEX IF NOT EXISTS idx_snap_ts ON snapshots(ts);
    CREATE TABLE IF NOT EXISTS metrics (
      snapshot_id INTEGER NOT NULL REFERENCES snapshots(id) ON DELETE CASCADE,
      key TEXT NOT NULL,
      value REAL NOT NULL,
      PRIMARY KEY (snapshot_id, key)
    );
    CREATE TABLE IF NOT EXISTS entities (
      snapshot_id INTEGER NOT NULL REFERENCES snapshots(id) ON DELETE CASCADE,
      entity TEXT NOT NULL,             -- 'characters' | 'achievements' | 'artifacts' | ...
      json TEXT NOT NULL,
      PRIMARY KEY (snapshot_id, entity)
    );
    CREATE TABLE IF NOT EXISTS achievement_state (
      snapshot_id INTEGER NOT NULL REFERENCES snapshots(id) ON DELETE CASCADE,
      ach_i INTEGER NOT NULL,
      done INTEGER NOT NULL,
      progress REAL,
      PRIMARY KEY (snapshot_id, ach_i)
    );
    /* One row per character per snapshot, so "show me character 2" / "chart character 2 over
     * time" is a plain query rather than a JSON dig. Derived from e.characters, so it rebuilds
     * from the raw saves like everything else. */
    CREATE TABLE IF NOT EXISTS players (
      snapshot_id INTEGER NOT NULL REFERENCES snapshots(id) ON DELETE CASCADE,
      char_idx INTEGER NOT NULL,
      name TEXT,
      class_id INTEGER,
      class_name TEXT,
      level INTEGER,
      skills_total INTEGER,
      PRIMARY KEY (snapshot_id, char_idx)
    );
    /* Long-format: there are ~19 skills and the set GROWS with game updates, so a column per
     * skill would need a migration every patch. Long format needs none. */
    CREATE TABLE IF NOT EXISTS player_skills (
      snapshot_id INTEGER NOT NULL REFERENCES snapshots(id) ON DELETE CASCADE,
      char_idx INTEGER NOT NULL,
      skill TEXT NOT NULL,
      level INTEGER NOT NULL,
      PRIMARY KEY (snapshot_id, char_idx, skill)
    );
    CREATE INDEX IF NOT EXISTS idx_pskill ON player_skills(skill, char_idx);
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY, value TEXT NOT NULL
    );
  `);
  return db;
}

/** ingest a raw save; dedupes to one snapshot per calendar day unless force */
export function ingest(db, raw, { ts = new Date().toISOString(), source = "sync", charNames = null, perDay = true } = {}) {
  const day = ts.slice(0, 10);
  let existing = null;
  if (perDay) {
    existing = db.prepare("SELECT id FROM snapshots WHERE substr(ts,1,10)=? ORDER BY id DESC LIMIT 1").get(day);
  }
  const e = extractEntities(raw, charNames);
  const metrics = metricsFrom(e);
  const rawGz = gzipSync(Buffer.from(JSON.stringify(raw)));

  let id;
  if (existing) {
    id = existing.id;
    db.prepare("UPDATE snapshots SET ts=?, source=?, raw_gz=?, char_names=? WHERE id=?")
      .run(ts, source, rawGz, JSON.stringify(charNames), id);
  } else {
    const r = db.prepare("INSERT INTO snapshots (ts, source, raw_gz, char_names) VALUES (?,?,?,?)")
      .run(ts, source, rawGz, JSON.stringify(charNames));
    id = Number(r.lastInsertRowid);
  }
  writeDerived(db, id, e, metrics);
  return { id, ts, metrics, entities: e };
}

/** legacy metric-only snapshot (from old history.json) */
export function ingestMetricsOnly(db, ts, metrics) {
  const day = ts.slice(0, 10);
  const existing = db.prepare("SELECT id FROM snapshots WHERE substr(ts,1,10)=? LIMIT 1").get(day);
  if (existing) return existing.id;
  const r = db.prepare("INSERT INTO snapshots (ts, source, raw_gz, char_names) VALUES (?, 'import', NULL, NULL)").run(ts);
  const id = Number(r.lastInsertRowid);
  const mIns = db.prepare("INSERT INTO metrics (snapshot_id, key, value) VALUES (?,?,?)");
  for (const [k, v] of Object.entries(metrics)) if (typeof v === "number" && isFinite(v)) mIns.run(id, k, v);
  return id;
}

export function latest(db) {
  const snap = db.prepare("SELECT * FROM snapshots ORDER BY ts DESC LIMIT 1").get();
  if (!snap) return null;
  const entities = {};
  for (const row of db.prepare("SELECT entity, json FROM entities WHERE snapshot_id=?").all(snap.id))
    entities[row.entity] = JSON.parse(row.json);
  const metrics = Object.fromEntries(db.prepare("SELECT key, value FROM metrics WHERE snapshot_id=?").all(snap.id).map((r) => [r.key, r.value]));
  return { id: snap.id, ts: snap.ts, source: snap.source, charNames: snap.char_names ? JSON.parse(snap.char_names) : null, entities, metrics };
}

export function rawOf(db, id) {
  const r = db.prepare("SELECT raw_gz FROM snapshots WHERE id=?").get(id);
  return r?.raw_gz ? JSON.parse(gunzipSync(r.raw_gz).toString()) : null;
}

export function history(db, keys = null, from = null) {
  let sql = `SELECT s.ts, m.key, m.value FROM metrics m JOIN snapshots s ON s.id=m.snapshot_id`;
  const where = [], args = [];
  if (keys) { where.push(`m.key IN (${keys.map(() => "?").join(",")})`); args.push(...keys); }
  if (from) { where.push("s.ts >= ?"); args.push(from); }
  if (where.length) sql += " WHERE " + where.join(" AND ");
  sql += " ORDER BY s.ts";
  const out = {};
  for (const r of db.prepare(sql).all(...args)) (out[r.key] ??= []).push({ ts: r.ts, v: r.value });
  return out;
}

/** re-derive metrics/entities for every stored raw (run after adding new metrics) */
export function rebuildDerived(db) {
  const rows = db.prepare("SELECT id, ts, char_names FROM snapshots WHERE raw_gz IS NOT NULL").all();
  for (const row of rows) {
    const raw = rawOf(db, row.id);
    const e = extractEntities(raw, row.char_names ? JSON.parse(row.char_names) : null);
    writeDerived(db, row.id, e, metricsFrom(e));
  }
  return rows.length;
}

export const getSetting = (db, k, dflt = null) => db.prepare("SELECT value FROM settings WHERE key=?").get(k)?.value ?? dflt;
export const setSetting = (db, k, v) => db.prepare("INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(k, String(v));
