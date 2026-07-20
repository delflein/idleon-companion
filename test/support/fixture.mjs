/* test/support/fixture.mjs — loads the latest raw save straight from the personal ./idleon.db
 * (the legacy companion's SQLite store — docs/ARCHITECTURE.md D8), the same file the standalone
 * companion.mjs server reads. Used ONLY by test/pages.test.js to seed appState with real data so
 * migrated pages render actual numbers instead of an empty/null save.
 *
 * idleon.db holds personal save data and must NEVER be committed (see .gitignore) — CI and any
 * clone without it simply has no fixture. Callers MUST treat a null return as "skip the suite
 * cleanly", never as a failure.
 */
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { gunzipJson } from "../../src/data/db.js";

const DB_PATH = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "idleon.db");

/**
 * @returns {Promise<{raw: object, charNames: string[]|null, ts: string}|null>} null if idleon.db
 *   isn't present (CI, or a fresh clone before any sync has ever happened).
 */
export async function loadLatestFixture() {
  if (!existsSync(DB_PATH)) return null;

  // node:sqlite (built into Node 22+) — read-only, no new dependency needed.
  const { DatabaseSync } = await import("node:sqlite");
  const db = new DatabaseSync(DB_PATH, { readOnly: true });
  try {
    const row = db.prepare(
      "SELECT ts, char_names, raw_gz FROM snapshots WHERE raw_gz IS NOT NULL ORDER BY ts DESC LIMIT 1",
    ).get();
    if (!row) return null;
    const raw = await gunzipJson(row.raw_gz);
    const charNames = row.char_names ? JSON.parse(row.char_names) : null;
    return { raw, charNames, ts: row.ts };
  } finally {
    db.close();
  }
}
