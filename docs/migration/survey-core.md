# IdleOn Companion — Core Layer Browser-Portability Audit

Scope: `savemap.mjs` + `savemap/`, `domain.mjs`, `gamedata.mjs` + all `gamedata-*.mjs`, `stats/` (whole dir), `bonuses/` (whole dir), `db.mjs`, `companion.mjs`, `fetch-idleon.mjs`.

Method: full-text import extraction across every file in scope (`grep -n "^import"`), a scripted
cycle-detector (Node DFS over the resolved import graph), and targeted greps for Node-only globals
(`node:*`, `Buffer`, `process`, `require`, `__dirname`) and wall-clock/storage usage (`Date.now()`,
`new Date()`, `localStorage`, settings reads).

---

## 1. Dependency graph shape

```
gamedata.mjs  <───────────────┐  (leaf: zero internal deps, pure data)
gamedata-*.mjs (49 files)  <──┤  (leaves: pure data, a few import gamedata.mjs;
                               |   gamedata-w6-emperor.mjs imports gamedata.mjs)
                               |
savemap/*.mjs (7 files)  <─────┤  (leaves: zero internal deps — pure key registries)
savemap.mjs  ──> savemap/*.mjs |
                               |
bonuses/*.mjs (46 files) ──────┤  import savemap.mjs (sel/vals/skillLv), gamedata*.mjs,
                               |  and EACH OTHER extensively (this is the densest subgraph)
                               |
stats/*.mjs (42 files, incl.  ─┤  import savemap.mjs, stats/engine.mjs, bonuses/*.mjs, gamedata*.mjs
  engine.mjs + index.mjs)      |
                               |
domain.mjs  ───────────────────┤  imports savemap.mjs, stats/index.mjs, stats/engine.mjs,
                               |  ~15 bonuses/*.mjs, ~35 gamedata-*.mjs directly
                               |  PLUS node:fs/node:path/node:url (see §2)
                               |
db.mjs  ────────────────────────  imports domain.mjs (extractEntities, metricsFrom), savemap.mjs (SKILL)
                               |  PLUS node:sqlite, node:zlib
                               |
companion.mjs  ─────────────────  imports db.mjs, stats/index.mjs, stats/*-report.mjs, savemap.mjs,
                                   domain.mjs, PLUS node:http/fs/path/url

fetch-idleon.mjs  ── standalone CLI, no internal-module imports at all (only node:fs/readline/path/url)
```

Layering is clean and acyclic **almost** everywhere:

`gamedata* → savemap → bonuses → stats → domain → db → companion`

**One cycle exists**, confirmed by the scripted DFS (only cycle found across all ~150 files in scope):

```
bonuses/farming.mjs → bonuses/stamps.mjs → bonuses/farming.mjs
```

`bonuses/stamps.mjs` imports `exoticBonus` from `farming.mjs`; `bonuses/farming.mjs` imports
`stampBonusOfType` from `stamps.mjs`. This is a function-level circular import (each module calls
the other's exported function at call time, not at module-evaluation time), which ESM tolerates
fine — Node and every browser bundler (esbuild/Rollup/webpack) resolve this without error since
neither side touches the other's export during its own top-level evaluation. Not a blocker, but
worth knowing before introducing a strict module boundary or a dependency-cruiser lint rule.

No other cycles were found — not within `bonuses/`, not between `bonuses/`↔`stats/`, not
`stats/`↔`domain.mjs`, not in `gamedata-*.mjs`.

`companion.mjs` is the sink: nothing else in the core imports it. `fetch-idleon.mjs` is an
isolated leaf — it duplicates a metrics extractor (`extractMetrics`) and the Firebase auth flow
that `companion.mjs` also re-implements independently; the two are not wired together via imports.

`stats/index.mjs` is the recipe registry (`RECIPES` array, `evaluateAll`, `allMetricRows`) that
`domain.mjs` and `companion.mjs` both consume; `stats/engine.mjs` is the shared evaluator
(`makeCtx`, `evaluate`, `evaluatePerChar`, `metricRows`) every `stats/*.mjs` recipe and `domain.mjs`
itself import.

---

## 2. Browser-portability by module/group

| Group | Node-only APIs found | Verdict |
|---|---|---|
| `gamedata.mjs` + all 49 `gamedata-*.mjs` (9,440 LOC) | none | **Portable as-is.** Pure constant tables/arrays/objects. |
| `savemap.mjs` + `savemap/*.mjs` (7 files, 3,455 LOC) | none | **Portable as-is.** `openSave(raw, charNames)` takes an already-parsed JS object; zero I/O anywhere in the module. |
| `bonuses/*.mjs` (46 files, 5,121 LOC) | none | **Portable as-is.** Pure functions over `ctx`/`sel`. |
| `stats/*.mjs` (42 files incl. `engine.mjs`, `index.mjs`; 5,456 LOC) | none | **Portable as-is.** Wall-clock defaults are injected, not hard-coded (see §5). |
| `domain.mjs` (1,398 LOC) | `node:fs` (`readFileSync`, `existsSync`), `node:path`, `node:url` — **one spot only** | **Portable with a 3-line shim.** See detail below. |
| `db.mjs` (202 LOC) | `node:sqlite` (`DatabaseSync`), `node:zlib` (`gzipSync`/`gunzipSync`), `Buffer.from(...)` | **Not portable — by design, this is the server persistence layer.** Needs a from-scratch browser replacement (§3). |
| `companion.mjs` (371 LOC) | `node:http` (`createServer`), `node:fs`×4, `node:path`, `node:url`, `process.env`/`process.versions`/`process.exit`, `Buffer.from` | **Not portable — it's the HTTP server + static file host.** Its *logic* (routes, auth flow, settings shape) ports; the *transport* (Node's `http` module, filesystem static serving) does not exist in a browser and must become client-side routing + fetch calls to external APIs (§4). |
| `fetch-idleon.mjs` (213 LOC) | `node:fs`×3, `node:readline`, `node:path`, `node:url`, `process.argv`/`process.stdin`/`process.exit` | **Not portable as a module — it's a CLI tool.** Its Firebase/Steam-OpenID auth logic (the `login()`/`refresh()`/`fetchSave()` functions, `fromFs()` typed-value decoder) is plain `fetch()`-based and re-usable almost verbatim in-browser; only the readline prompt and file writes need replacing with a browser redirect flow + IndexedDB/localStorage writes. |

### domain.mjs — the one seam
```js
domain.mjs:5   import { readFileSync, existsSync } from "node:fs";
domain.mjs:6   import { dirname, join } from "node:path";
domain.mjs:7   import { fileURLToPath } from "node:url";
domain.mjs:99  const DIR = dirname(fileURLToPath(import.meta.url));
domain.mjs:264 export function achData() {
domain.mjs:266   const p = join(DIR, "achievements-data.json");
domain.mjs:267   ACH = existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : { achievements: [] };
```
This is a single lazy, memoized read of one static JSON file (`achievements-data.json`, shipped
alongside the module, never written to). Trivial to port: either (a) `import ACH from
"./achievements-data.json" with { type: "json" }` (or a bundler JSON import) and drop the
fs/path/url imports entirely, or (b) `fetch("./achievements-data.json").then(r => r.json())` if
async loading is acceptable at the call site. Everything else in `domain.mjs` — `extractEntities`,
`metricsFrom`, `chestDist`, `transcendentChances`, `chestArtifactChance`, `artifactSourceChar`,
`REF` — is pure data transformation over an already-parsed `raw` object and needs no changes.

---

## 3. db.mjs — public API surface to design a browser storage layer against

**Imports:** `DatabaseSync` (node:sqlite), `gzipSync`/`gunzipSync` (node:zlib), `extractEntities`/`metricsFrom` from `domain.mjs`, `SKILL` from `savemap.mjs`.

**Schema (6 tables + 1 index-bearing table, all created via one `openDb()` DDL block):**

| Table | Columns | Purpose |
|---|---|---|
| `snapshots` | `id` (PK autoincrement), `ts` (ISO string), `source` (`'sync'\|'import'\|'file'`), `raw_gz` (BLOB, gzipped raw save JSON, nullable for legacy imports), `char_names` (JSON array string) | One row per "sync" (deduped to one per calendar day unless `perDay:false`); the raw save is stored gzipped so history can be replayed. |
| `metrics` | `snapshot_id` (FK), `key`, `value` (REAL), PK `(snapshot_id, key)` | Daily-resolution derived numeric metrics, one row per key per snapshot; fully rebuildable from `raw_gz`. |
| `metrics_live` | `ts`, `key`, `value`, PK `(ts, key)` | Intra-day append-only metric points (every sync, not just the daily anchor); never rewritten by `rebuildDerived`. |
| `entities` | `snapshot_id` (FK), `entity` (`'characters'\|'achievements'\|'artifacts'\|...`), `json` (TEXT), PK `(snapshot_id, entity)` | Structured, non-numeric derived state per snapshot (everything `extractEntities` returns except the `stats` key, which is deliberately never persisted — recomputed fresh on read). |
| `achievement_state` | `snapshot_id` (FK), `ach_i`, `done` (0/1), `progress` (REAL), PK `(snapshot_id, ach_i)` | Per-achievement state, denormalized out of `entities.achievements` for query convenience. |
| `players` | `snapshot_id` (FK), `char_idx`, `name`, `class_id`, `class_name`, `level`, `skills_total`, PK `(snapshot_id, char_idx)` | One row per character per snapshot, denormalized out of `entities.characters`. |
| `player_skills` | `snapshot_id` (FK), `char_idx`, `skill` (TEXT), `level`, PK `(snapshot_id, char_idx, skill)` | Long-format skill levels (chosen over a column-per-skill schema because the skill set grows with game patches). |
| `settings` | `key` (PK), `value` (TEXT) | Generic k/v store: `autoRefreshMin`, `migrated` flag, and the three manual stat-evaluation inputs (`statTomePoints`, `statLabConnected`, `statActiveVote`). |

All of `metrics`, `entities`, `achievement_state`, `players`, `player_skills` are **fully
derivable** from `snapshots.raw_gz` via `extractEntities()` + `metricsFrom()` — that's the whole
point of `rebuildDerived()`. Only `snapshots` and `settings` hold non-recomputable source-of-truth
data.

**Exported functions (the exact contract a browser storage layer must replicate):**

```js
openDb(path) -> db                          // create/open, run DDL, return handle
ingest(db, raw, {ts, source, charNames, perDay}) -> {id, ts, metrics, entities}
                                             // extract, dedupe-per-day, write snapshot + all derived tables + a metrics_live point
ingestMetricsOnly(db, ts, metrics) -> id    // legacy path: metrics with no raw save behind them
latest(db) -> {id, ts, source, charNames, entities, metrics} | null
rawOf(db, id) -> raw | null                 // gunzip + JSON.parse a stored snapshot's raw save
history(db, keys=null, from=null) -> {key: [{ts, v}]}   // union of metrics ⊎ metrics_live, deduped by (ts,key)
rebuildDerived(db) -> rowCount              // replay extractEntities+metricsFrom over every stored raw_gz
getSetting(db, k, dflt=null) -> value
setSetting(db, k, v) -> void
```

`db` in every signature is a `node:sqlite` `DatabaseSync` instance — none of these functions are
otherwise Node-specific; the SQL is plain SQLite dialect (`AUTOINCREMENT`, `REFERENCES ... ON
DELETE CASCADE`, `INSERT OR REPLACE`, `ON CONFLICT ... DO UPDATE`). A browser port has two realistic
paths:
1. **sql.js / wa-sqlite (WASM SQLite) + IndexedDB/OPFS for persistence** — reuse the exact schema
   and SQL strings verbatim, only swap `DatabaseSync` for the WASM binding and add an explicit
   "flush to storage" step (WASM SQLite is in-memory unless paired with OPFS VFS).
2. **A hand-rolled IndexedDB layer replicating the same *contract*** (same function names/shapes)
   — more work, but avoids a ~1-2MB WASM payload. Given the schema is relational (FKs, GROUP BY in
   `history()`), sql.js/wa-sqlite is the lower-risk path; `gzipSync`/`gunzipSync` map directly to
   `CompressionStream`/`DecompressionStream("gzip")` (both are standard browser APIs, Baseline-
   available), so the only real substitution is the SQLite engine itself, not the gzip step.

---

## 4. companion.mjs — endpoint inventory and what moves client-side

Local-only server on port 8317 (`127.0.0.1`), zero npm deps, Node 22.5+ required for `node:sqlite`.

| Endpoint | Method | What it does today | Client-side equivalent needed |
|---|---|---|---|
| `/api/state` | GET | `latest(db)` + `getAuth()` + `autoRefreshMin` setting | Read from browser storage layer directly; "connected" becomes a stored-token check. |
| `/api/sync` | POST | `syncNow("manual")`: refresh Firebase token → fetch Firestore save doc → fetch char names (Realtime DB) → fetch `_comp` companions doc → fetch `_vars` server vars doc → `ingest()` | All four `fetch()` calls are plain HTTPS REST to Google APIs — portable verbatim *if* CORS allows browser origin (needs verification, see §6). Ingest logic moves to the browser storage layer. |
| `/api/stats` | GET | Loads latest raw, `openSave()`, runs every `RECIPES` entry through `evaluatePerChar`, merges manual `statOpts()` from `settings` table | Pure client computation once raw + settings are local — no server needed at all. |
| `/api/farming` | GET | `farmingReport(s, {activeChar, ...statOpts()})` | Same — pure client computation. |
| `/api/w1`..`/api/w7` | GET | Static glossary text from `stats/wN-report.mjs` (`wNGlossary()`), no save parsing | These are pure functions returning static objects — literally just call them directly in the browser, no fetch needed at all. |
| `/api/history` | GET | `history(db, keys, from)` | Storage-layer query, no server. |
| `/api/snapshots` | GET | List of `{id, ts, source, hasRaw}` | Storage-layer query. |
| `/api/snapshot/:id/raw` | GET | `rawOf(db, id)` | Storage-layer query. |
| `/api/settings` | GET/POST | `getSetting`/`setSetting` for `autoRefreshMin` + 3 stat inputs | `localStorage` or the same IndexedDB `settings` table. |
| `/api/connect` | POST | `connectSteam(url)`: parses Steam OpenID redirect → exchanges via `idlemmo` cloud function → Firebase custom-token sign-in → decode uid from JWT → **writes `.idleon-auth.json` to disk** | Auth flow itself is fetch-based and portable; the **credential storage** (currently a plaintext file with a long-lived refresh token) needs to become IndexedDB/localStorage in the browser, which is a materially different trust boundary (see §6 security note below the table). |
| `/api/auth` | GET | `{connected: !!getAuth(), uid}` | Same, backed by browser-stored credential. |
| `/api/rebuild` | POST | `rebuildDerived(db)` | Storage-layer operation. |
| static file serving (`GET /`, `GET /*`) | GET | `readFileSync`/`statSync` off disk, path-traversal guard (`normalize` + `startsWith(DIR)`), MIME table | **Eliminated entirely** — GitHub Pages / the browser's own static hosting replaces this; there is no server left to write. |

**Net effect:** every endpoint except the raw HTTP transport and file serving is "take the same
function call I'm already making, run it in the browser against local storage instead of over
`fetch('/api/...')`." The actual porting work is concentrated in two places: (1) building the
storage layer that replaces `db.mjs` (§3), and (2) deciding how the Firebase/Steam auth flow
re-authenticates from a page with no server-held secret and no filesystem to cache a refresh token
in (this is a real design question, not just a mechanical port — see §6).

`connectSteam`'s JWT-uid decode (`JSON.parse(Buffer.from(auth.idToken.split(".")[1],
"base64url").toString())`) is the one line using `Buffer`; trivially replaceable with
`atob()`/`Uint8Array` + `TextDecoder`, or a base64url polyfill — no functional change.

---

## 5. Wall-clock / settings-storage / filesystem seams inside stats/, bonuses/, domain.mjs

**Filesystem:** none inside `stats/` or `bonuses/`. `domain.mjs` has exactly the one
`achData()`/`achievements-data.json` read documented in §2 — already isolated behind a single
exported function, already lazy+memoized, trivial to swap for a static import or `fetch`.

**Wall-clock:** two call sites, and both are **already injected via a default parameter**, not
hard-coded — this is the pattern you want, not a seam that needs fixing:
```js
stats/farming-report.mjs:172  export function farmingReport(s, opts = {}, nowMs = Date.now()) { ... }
bonuses/farming.mjs:219       export const exoticWeekNow = (nowMs = Date.now()) => Math.floor(nowMs / 1000 / 604800);
```
`Date.now()` itself is a standard browser API (not Node-only), so even the *default* works
unmodified client-side; the injection point exists for testability, and callers (`companion.mjs`'s
`/api/farming` handler) don't currently override it, meaning "the server's wall clock" and "the
browser's wall clock" are the same kind of value — no behavior change on port, just note in
`companion.mjs`'s doc-comment ("Exotic week comes from the server's wall clock, never from the
save's age") that this becomes "the browser's wall clock" post-port, which is the *more* correct
semantic (the user's local time, not an arbitrary server's).

**Settings storage:** the real seam, and it's already cleanly factored. Three manual inputs that
the save cannot itself supply — `tomePoints`, `labConnectedIds`, `activeVote` — are threaded
through `stats/engine.mjs`'s `makeCtx(s, opts)` as plain `opts` fields with `null` defaults
(honest-unknown if absent), e.g.:
```js
stats/engine.mjs:74   activeChar = null, tomePoints = null,
stats/engine.mjs:75   labConnectedIds = null, override = {}, args = {},
stats/engine.mjs:80   const activeVote = opts.activeVote ?? sel.activeVoteId(s);
```
Nothing in `stats/` or `bonuses/` reads a settings store directly — `bonuses/thingies.mjs`,
`bonuses/tome.mjs`, `bonuses/summoning.mjs`, `bonuses/ballot.mjs`, `bonuses/lab.mjs`, and
`stats/artifact-find.mjs`/`drop-rate.mjs` all consult `ctx.tomePoints`/`ctx.activeVote`/
`ctx.labConnected(id)` — never `getSetting()` directly. The *only* place that touches
`node:sqlite`-backed settings is `companion.mjs`'s `statInputs()`/`statOpts()` (lines 200-215),
which reads the three values out of the `settings` table and folds them into the `opts` object
passed to `evaluatePerChar`. **This is exactly the shape a browser port wants**: replace
`getSetting(db, "statTomePoints", "")` with `localStorage.getItem("statTomePoints") ?? ""` (or the
IndexedDB `settings` table from the sql.js port) and nothing in `stats/`/`bonuses/`/`domain.mjs`
needs to change at all — the injection boundary is already at the server layer, not smeared through
the core.

One more args-style injection point worth flagging alongside these: `ctx.args` (recipe-specific
extra parameters — `stats/artifact-find.mjs`'s `boatIdx`, `stats/shrine-exp.mjs`'s `shrineIdx`,
`stats/villager-exp.mjs`'s `villager`) is populated in `companion.mjs`'s `/api/stats` handler from
a URL query parameter (`?villager=N`). Same story: trivially becomes a UI-state value passed
straight into `evaluatePerChar(recipe, s, {args: {villager: n}})` with no core change.

---

## 6. Non-mechanical decisions the audit surfaced (not just "port the code")

- **Auth/credential storage.** `.idleon-auth.json` (plaintext refresh token, file-based) has no
  browser equivalent that preserves the same trust model — a static GitHub Pages site has no
  server-side secret store. The refresh token would live in the browser (localStorage/IndexedDB),
  which is a materially weaker boundary (XSS-exposed) than a local dotfile only the user's own OS
  account can read. Worth a deliberate call: accept the reduced boundary (it's still local-only,
  no different in kind from every other browser-based save-import tool), or require the user to
  paste a fresh Steam redirect URL each session instead of persisting a long-lived refresh token.
- **CORS.** `companion.mjs`/`fetch-idleon.mjs` call `identitytoolkit.googleapis.com`,
  `securetoken.googleapis.com`, `firestore.googleapis.com`, `idlemmo.firebaseio.com`, and
  `us-central1-idlemmo.cloudfunctions.net` directly from Node, where CORS doesn't apply. Whether
  a page hosted on `*.github.io` can call these same endpoints from `fetch()` needs to be verified
  empirically (Firebase's REST APIs generally do allow browser CORS since they're designed for web
  SDKs, but the `idlemmo` custom cloud function's CORS policy is unknown and untested here) — flag
  as a spike, not an assumption.
- **`bonuses/farming.mjs` ↔ `bonuses/stamps.mjs` cycle** (§1) — harmless today, but if the port
  introduces a stricter build (e.g. splitting `bonuses/` into a separate published package, or a
  bundler configured to fail on cycles) this pair needs literally zero code change, just an
  acknowledged exception in the lint config.

---

## 7. LOC summary

| Group | LOC | Portable? |
|---|---:|---|
| `savemap.mjs` + `savemap/*.mjs` (7 files) | 3,455 | Yes, as-is |
| `domain.mjs` | 1,398 | Yes, with 3-line JSON-load shim |
| `gamedata.mjs` + 49 `gamedata-*.mjs` | 9,440 | Yes, as-is |
| `stats/*.mjs` (42 files) | 5,456 | Yes, as-is |
| `bonuses/*.mjs` (46 files) | 5,121 | Yes, as-is |
| **Portable core subtotal** | **24,870** | |
| `db.mjs` | 202 | No — server-only, needs a browser storage layer built to its documented contract (§3) |
| `companion.mjs` | 371 | No — server-only, needs client-side routing/IndexedDB (§4) |
| `fetch-idleon.mjs` | 213 | No as a module (CLI) — its auth logic (~120 of the 213 lines) is reusable almost verbatim |
| **Non-portable subtotal** | **786** | |
| **Grand total across all files in scope** | **25,656** | **~97% of LOC is already browser-portable** |

---

## 8. Overall assessment

The core ports cleanly. The architecture already did the hard part: `stats/` and `bonuses/`
are pure functions over an explicit `ctx`/`opts` object with no ambient Node access anywhere, the
one wall-clock read is an injectable default that's a standard browser API anyway, and the one
settings-store dependency is already isolated at the `companion.mjs` boundary rather than smeared
through the recipe/bonus layer — so the browser port doesn't need to *refactor* the core, it needs
to *replace what sits outside it*. `domain.mjs` has a single, trivial fs read to swap for a JSON
import. The one import cycle (`farming.mjs`↔`stamps.mjs`) is a non-issue for any bundler in
practice.

The real work is concentrated entirely in the ~786 LOC that were never meant to run in a browser:
`db.mjs`'s SQLite persistence (replace with sql.js/wa-sqlite + OPFS or IndexedDB against the exact
documented schema/API in §3), and `companion.mjs`'s HTTP-server shell (replace with direct
in-page function calls per §4's endpoint table — most handlers are one-liners once storage is
local). The auth/credential-storage question (§6) is the one piece that isn't a mechanical port at
all — it changes the security model — and should get a deliberate design decision before writing
any code, not be papered over by "just localStorage it."
