# IdleOn Companion

A save-synced companion PWA for Legends of Idleon: dashboard, per-system pages for
every world, stat-recipe breakdowns with honest lower bounds, and time-series history
of your account — all client-side, deployed from this repo to
**https://delflein.github.io/idleon-companion/**.

Architecture decision record: **`docs/ARCHITECTURE.md`** (D1–D8). Agent/contributor
rules: **`CLAUDE.md`**. How to add a page: **`docs/PANELS.md`**. Migration evidence:
`docs/migration/`.

## Run it

```
npm install
npm run dev        # Vite dev server
npm run build      # production build (dist/)
npm test           # data-layer tests (fake-indexeddb)
npm run test:pages # mounts every page against your local idleon.db (skips without it)
npm run test:ui    # formatter tests
npm run lint
```

Deploy = push to `main`; `.github/workflows/deploy.yml` builds and publishes to
GitHub Pages.

## Layout (docs/ARCHITECTURE.md D2)

```
src/core/       THE DOMAIN. Framework-free, browser/worker-safe:
                savemap.mjs + savemap/ (every save key named + evidenced, sel.* selectors)
                domain.mjs (raw save -> entities), stats/ (recipe engine + ~36 recipes),
                bonuses/ (one module per client dispatcher, table-guarded),
                sailing-page.mjs / landrank-optimizer.mjs / farming-advice.mjs /
                gaming-page.mjs / dashboard-advice.mjs (page-level domain logic,
                N.js-cited, extracted from the legacy pages during the M5 migration).
src/gamedata/   GENERATED tables lifted verbatim from the client (N.js). Refresh after
                major patches; never hand-edit.
src/data/       Storage + sync, no Vue except appState.js (the one seam):
                db.js (Dexie: snapshots one/day with gzipped raws, metrics on [key+ts],
                settings), ingest.js (ingest/history/rebuildDerived — REPLAYABLE: every
                metric re-derives from stored raws, in a worker), sync.js (Steam SSO +
                Firebase REST, no SDK), importExport.js, appState.js (shallowRef save,
                entities/metrics/stats/farming computeds, useHistory).
src/ui/         The kit: StatModule (the recipe-breakdown renderer), DataTable,
                TimeChart (uPlot), Sparkline, SpriteIcon, Chip, LevelBar, ShowMore,
                fmt.js (the one formatter).
src/pages/      One page per system (47 routes, hash router) — see docs/PANELS.md.
public/assets/  Self-served sprites (824 files, see ATTRIBUTION.md).
scripts/        copy-assets.mjs · export-sqlite.mjs (SQLite-era migration) ·
                smoke-core.mjs / smoke-derived.mjs (parity harnesses vs the legacy server).
```

## Data

- **Sync**: the Data page (`/data`) connects via Steam SSO and pulls your save from the
  game's Firestore, straight from the browser (CORS verified from the Pages origin).
  Companions (`_comp`) and server vars (`_vars`) merge into the raw with the honesty
  contract: absent on failure, never faked.
- **Storage**: IndexedDB (Dexie). One gzipped raw snapshot per day (immutable ground
  truth) + a long-format metric time-series (daily rebuildable anchors + intra-day live
  points). Any parser fix or new recipe backfills all history by replaying the raws —
  that property is the backbone and must not regress.
- **Backup**: export/import on the Data page. **iOS note**: Safari can evict site data
  after 7 days of non-use — install to home screen and keep an exported backup; a
  re-import fully reconstitutes history.
- **Migrating from the SQLite era**: `node scripts/export-sqlite.mjs` writes
  `idleon-export.json.gz` from `idleon.db` (raws + settings + intra-day rows; dailies
  rebuild) → import it on the Data page. The file contains save data — it is gitignored.

## Ground rules for game logic (unchanged)

The decompiled client (`N.js`, gitignored) is authoritative; the wiki and community
research have been caught wrong repeatedly. Confirm in the client, cite the function in
a comment, record uncertainty honestly — `unknown` beats a plausible guess. Server vars
and companion ownership are not knowable from the save and are never silently faked.
Term ids are metric keys — never rename a shipped one.

## Legacy (deprecated, pending deletion)

`companion.mjs` + `db.mjs` + `fetch-idleon.mjs` are the pre-migration localhost
server/SQLite pipeline. They are kept only until your SQLite history is imported into
the PWA (see above), then delete them along with the legacy root pages:

```
git rm -- '*.html' ':!index.html' ':!mockups/*' && git rm ui.js sync.js companion.css ach-data.js companion.mjs db.mjs fetch-idleon.mjs start-companion.command
```

(The 45 root `*.html` pages, `ui.js`, `sync.js`, `companion.css`, `ach-data.js` are
already fully replaced by `src/pages/` — nothing imports them.)

## Privacy

`.idleon-auth.json` (legacy) and the browser's stored refresh token grant full read of
your save — keep private. `idleon.db`, `idleon-export*.json.gz`, `N.js`, and the
`idleon-toolbox/` reference clone are gitignored and must stay that way.
