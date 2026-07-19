# Architecture — SPA/PWA migration (2026-07-19)

Decision record for restructuring the companion from ~45 root HTML pages + a
localhost Node server into a static, installable SPA/PWA on GitHub Pages.
Full evidence: `docs/migration/` (page inventory, core portability audit,
asset audit, browser-sync feasibility, framework/storage research — all
cite sources).

## What we learned before deciding

- **The core is already portable.** 24,870 of 25,656 LOC (`savemap`,
  `domain.mjs`, `gamedata-*`, `stats/`, `bonuses/`) use zero Node APIs and
  import unchanged in a browser. Non-portable code is exactly `db.mjs`,
  `companion.mjs`, `fetch-idleon.mjs` (786 LOC).
- **Sync needs no server.** All five network calls (Steam `asil` exchange,
  securetoken refresh, Firestore `_data`, RTDB `_uid`/`_comp`, Firestore
  `_vars`) run client-side — IdleonToolbox does the identical flow as a
  static GitHub Pages site. Our `sync.js` direct path is currently dead code
  behind a `SERVER` flag and misses `_comp`/`_vars`.
- **UI is one component in a trenchcoat.** The recipe-breakdown renderer is
  copy-pasted near-identically across 20+ pages; charts are hand-rolled SVG;
  five pages hide real domain logic client-side (dashboard's duplicate
  parser + advice engine, sailing's what-if math, landrank's optimizer,
  gaming's superbit gate, beanstalk's duplicated formula).
- **Assets:** only 824 files (~751 KB) of the 147 MB `idleon-toolbox/` clone
  are used; manifest in `docs/migration/survey-assets.md`.

## Decisions

**D1 — Framework: Vue 3.5, `<script setup>`, plain Vite (no meta-framework).**
Reactivity fit is the decider: one parsed save object (`shallowRef` +
`markRaw`), every panel a cached `computed()` — parse once, derive many.
Vue wins the 2026 research ranking on agent-written-code reliability
(mature corpus, no pre-release churn; Vapor Mode later is drop-in).
**Runner-up, genuinely close: Svelte 5** — smaller runtime, `$derived`
elegance, but agents drift to Svelte 4 syntax without constant llms.txt
discipline. The UI layer stays deliberately thin, so this choice is
swappable early — veto window is open until pages start migrating (M5).
Meta-frameworks rejected: GitHub Pages disables the SSR/SSG they exist for;
SvelteKit's docs themselves warn against SPA mode.

**D2 — One npm package, layered by folder.** `src/gamedata/`, `src/core/`
(savemap, domain, stats, bonuses — framework-free, no imports from ui/),
`src/data/` (storage + sync), `src/ui/` (components), `src/pages/`.
Workspaces monorepo rejected: solo dev + agents, one build target;
"small packages" is delivered as small reviewable commits, not npm plumbing.
Everything stays JS/ESM (+ JSDoc where it pays) — no TS conversion churn on
25k LOC of verified game logic.

**D3 — Storage: Dexie 4 (IndexedDB), three stores.**
- `snapshots` `{id, ts, source, rawGz (CompressionStream gzip), charNames}` —
  one per day, immutable ground truth, ~130 KB/day.
- `metrics` `{[key+ts] compound index, value, snapshotId?}` — unifies today's
  `metrics` + `metrics_live` (daily rebuildable rows just carry snapshotId).
- `settings` key/value.
Derived tables (`entities`, `players`, `player_skills`, `achievement_state`)
are dropped, not ported: they existed so HTTP endpoints could avoid
re-parsing; in-browser the parse result lives in memory. **The invariant
that must not regress:** every metric is re-derivable by replaying stored
raws through the parser (`rebuildDerived`), run in a Web Worker, so a parser
fix or new recipe backfills all history. Backup = `dexie-export-import` +
one-click file export. SQLite-WASM/OPFS rejected: worse Safari/iOS story,
multi-tab pain, and our queries (key+range scans) don't need SQL.

**D4 — Sync: keep the REST implementation, no Firebase SDK.** Port
`companion.mjs`'s fetch flow into `src/data/sync.js` (add `_comp` + `_vars`),
token in localStorage (same trust level as today's plaintext
`.idleon-auth.json`). Auto-refresh timer runs while the app is open; there is
deliberately no background sync when closed (accepted gap — intra-day
`metrics` density depends on the app being open; dailies are safe because a
sync on open updates the day's snapshot). Risk: Google-endpoint CORS from a
`github.io` origin is unproven in *our* code — settled by an M1 spike deploy;
fallback is the Firebase JS SDK (proven by IdleonToolbox).

**D5 — Deploy/PWA: GitHub Pages, hash routing, vite-plugin-pwa.**
Hash router (`createWebHashHistory`) — zero-config on Pages, saner than the
404.html trick for a PWA. `registerType: 'prompt'`, explicit manifest
`scope`/`start_url` under the repo subpath, `.nojekyll`. **iOS data-eviction
is the #1 product risk** (7-day WebKit rule nukes IndexedDB *and* OPFS):
countermeasures are install-to-home-screen prompting, a loud export nag, and
treating local data as cache with the export as source of truth (D3's
rebuild property makes re-import lossless).

**D6 — Charts: uPlot (~22 KB) for time series; keep the tiny hand-rolled
sparkline helper.** Chart.js/ECharts rejected on weight, hand-rolling
rejected on the years-of-points axis/zoom work we'd re-invent.

**D7 — Assets: copy the 824-file manifest to `public/assets/`, licensing
note included; drop `idleon-toolbox/` from runtime entirely.** Sprite-sheet
pipeline (Idleon Efficiency style) deferred as a later optimization — 751 KB
of loose PNGs behind a service worker is fine at our scale. Fixes the two
pre-existing `Cavern_0`/`Rift_0` 404s.

**D8 — The Node server retires; the domain rules stay.** `companion.mjs` +
`db.mjs` + `fetch-idleon.mjs` are replaced by D3/D4 (a one-time
SQLite→IndexedDB import tool carries existing history over). Unchanged
rules from the README that survive the migration verbatim: N.js is ground
truth; savemap confidence labels; the honesty contract (unknown terms →
lower bound, never guessed); table-guarded evaluators; term ids are metric
keys and never rename.

## Migration plan (reviewable packages)

- **M1** Scaffold: Vite + Vue + PWA + Pages workflow deploying a hello-shell;
  includes the CORS spike (a button that runs the real sync against prod
  endpoints from the Pages origin). *Proves D4/D5 before we build on them.*
- **M2** Core port: move the 97% into `src/core/` + `src/gamedata/`, fix the
  one `readFileSync` and the farming↔stamps cycle, smoke tests (parse a
  fixture save, evaluate every recipe, compare against current outputs).
- **M3** Data layer: Dexie schema, ingest/history/rebuild in a worker,
  SQLite import tool, export/import. Parity test against `idleon.db`.
- **M4** UI kit: the extracted recipe-module renderer, layout/nav, uPlot
  wrapper, formatting helpers (collapse the 3 competing `fmt()`s).
- **M5+** Pages in batches (by world/system), porting the five pages'
  hidden domain logic into `src/core/` with N.js citations as we go.
  Old HTML pages delete only when their replacement renders real data.
- **M-assets** (parallel) copy script + reference rewrite.

Each package = one commit (or small series), buildable, reviewable alone.
