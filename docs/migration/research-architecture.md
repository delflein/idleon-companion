# IdleOn Companion — Static SPA/PWA Migration: Architecture Trade-off Analysis

_Decision-ready. Grounded in the actual codebase (as of 2026-07) + verified current library state._

## 0. Code-grounded starting point (what actually exists)

Measured from the repo, not assumed:

- **Domain layer is already framework-agnostic pure ESM and ~fully browser-portable:**
  - `domain.mjs` (75KB) — `extractEntities(raw)`, `metricsFrom(e)`, REF tables, chest/artifact math.
  - `bonuses/` — **47** evaluator modules.
  - `stats/` — **44** recipe modules + `engine.mjs` + `index.mjs`.
  - `gamedata-*.mjs` — ~40 generated data modules, **~1MB** total JS.
  - `savemap.mjs` (39KB) — save-key mapping.
  - Zero Node dependencies in these; they run unchanged in a browser/worker.
- **Only two things are Node-bound and must be replaced:**
  - `db.mjs` — uses `node:sqlite` (`DatabaseSync`) + `node:zlib` (`gzipSync`/`gunzipSync`). Needs a browser storage engine + browser gzip (`CompressionStream`/`DecompressionStream`, or `fflate`/`pako`).
  - `companion.mjs` (HTTP server) + `fetch-idleon.mjs` (Firebase fetch) — replaced by client-side fetch + a sync worker.
- **Pages consume a Node HTTP API today** (`fetch('/api/*')`), NOT direct ESM imports. So the migration's real work is: move the domain compute from server to browser (main thread or Web Worker), and swap `/api/*` for in-browser store reads + on-demand domain compute.

### The storage query surface is genuinely modest (this drives the storage decision)

From `db.mjs`, the schema is: `snapshots` (raw_gz BLOB, one/day), `metrics` (long-format daily, rebuildable), `metrics_live` (append per sync, intra-day), `entities` (JSON blobs), `achievement_state`, `players`, `player_skills` (long-format), `settings`.

The **only nontrivial SQL** is `history()`:
```sql
SELECT ts, key, MAX(value) AS value FROM (
  SELECT s.ts, m.key, m.value FROM metrics m JOIN snapshots s ON s.id=m.snapshot_id
    WHERE key IN (?) AND ts >= ?
  UNION ALL
  SELECT ts, key, value FROM metrics_live WHERE key IN (?) AND ts >= ?
) GROUP BY ts, key ORDER BY ts
```
That is: **time-range + key-filter + GROUP-BY dedup across two tables.** Everything else is: insert rows, `SELECT ... ORDER BY ts DESC LIMIT 1` (latest), fetch one raw by id, delete-by-snapshot. `entities`/`players`/`achievement_state` are **server-side query conveniences** — in a browser rebuild they can be recomputed on demand from the current raw via `extractEntities()` (fast for a single snapshot), instead of persisted.

**Architectural consequence:** the browser store can shrink to **3 logical stores** — `snapshots` (raw blobs), `metrics` timeseries (daily + live), and `settings`. The `rebuildDerived` backbone (replay every stored raw through `extractEntities`+`metricsFrom`) stays pure JS regardless of engine. This means the storage engine only needs one real query pattern (range + key filter), which does NOT require SQL.

---

## 1. Framework

**Architecture verdict first (applies to all five): plain Vite + a client router, single SPA — NOT a meta-framework, NOT the current MPA.**
- Meta-frameworks' value is SSR/SSG/server loaders — exactly what a GH-Pages static app disables. SvelteKit's own docs warn SPA mode has "a large negative performance impact"; Next static-export drops many features. [svelte.dev/docs/kit/single-page-apps; nextjs.org static-exports]
- **The one-save-object requirement decides SPA over MPA.** Today each `.html` page is a cold start that re-parses the save. A client-routed SPA parses **once**, holds the object + all derived caches in memory, and routes become component swaps. Per-route lazy `import()` chunks keep 35 routes from shipping upfront (Vite/Rollup auto-splits). This is the biggest single win of the migration and is independent of framework choice.
- Use **hash routing** (see §3) — every framework below has a first-party or standard hash router, so the GH-Pages 404 hack is avoided entirely.

**Verified 2026 state + fit (min+gzip = real tree-shaken baseline, not bundlephobia barrel):**

| Framework | Version (Jul 2026, verified) | Runtime gzip | Reactivity fit for "one save → many derived panels" | Agent corpus |
|---|---|---|---|---|
| **Vue 3.5** | 3.5.x stable; **3.6 Vapor beta** (feature-complete Apr 2026) | ~18 KB | Very good — `computed()` lazy+cached; `shallowRef`/`markRaw` the big blob to skip deep proxying | #2, large |
| **Svelte 5** | **5.56.6** (verified current) | **~3–4 KB** | Excellent — runes: `$derived` lazy+memoized is exactly this pattern; `$state.raw()` for the blob | Weak-ish (runes new) |
| **Preact+signals** | 10.x | ~8–9 KB | Good — `@preact/signals` `computed()` fine-grained | rides React corpus, weak on signals API |
| **Solid** | 1.9.x stable; **2.0 beta** (Mar 2026, first-class async) | ~7–8 KB | Best on paper — `createStore` per-leaf tracking IS this architecture | Smallest; silent footguns |
| **React 19** | 19.2.x | **~50+ KB** | Worst structural fit — VDOM re-render; needs selector stores (Zustand) + memoization | Best-in-class |

[Verified via github releases + web search Jul 2026: Svelte 5.56.6 current; Vue 3.6 Vapor feature-complete (beta.6) Apr 2026; Solid 2.0.0-beta.0 landed Mar 2026. Sizes are tree-shaken baselines, not bundlephobia barrels.]

**Key trade-off axis:** reactivity fit (Solid/Svelte best) pulls opposite to agent corpus (React/Vue best). Since the domain layer is external framework-agnostic ESM, **most code agents write is plain ESM domain logic, not framework code** — which softens the agent-corpus penalty and rewards a small framework footprint.

**Winner: Vue 3.5 + Vite + Vue Router (hash mode).** It's the best *balance* of the two axes that actually matter here: reactivity that fits (cached `computed`, `shallowRef` for the ~parsed save), an 18 KB runtime, the #2 agent corpus with a **well-understood, mature fix** (pin `<script setup>` + Composition API in a rules file), a first-party `createWebHashHistory()` router, a mature ecosystem, and a **non-breaking, opt-in** future upgrade path (3.6 Vapor mode is feature-complete as of Apr 2026 and adopts component-by-component with no rewrite) — no forced migration hanging over it, unlike Solid's in-flight 2.0.

**Very close #2: Svelte 5** (plain Vite + `svelte-spa-router`). Wins on the two things this user's stated aesthetic prizes — smallest runtime (~3-4 KB) and the cleanest reactive syntax, with `$derived` mapping 1:1 onto "one save, many panels." The single deduction is the agent axis: **Svelte 4→5 syntax drift is the most-reported LLM failure mode of the group** (models emit `$:`, `export let`, `on:click`). It's largely fixed by feeding Svelte's `llms.txt` into agent context, but that's a mitigation you must actively maintain. [github.com/sveltejs/svelte discussions #14125; khromov.se llms.txt]

**Decision rule (honest near-tie):** choose **Vue** if you weight agent reliability + ecosystem maturity + zero migration risk (the safer default for an agent-heavy solo workflow). Choose **Svelte** if you weight bundle size + reactive-syntax elegance and will maintain the `llms.txt` agent-context file. Both keep the 15k-LOC ESM untouched.

**Why not the others:** Preact — smallest credible total (~8.5 KB) but agents are weakest exactly at its signals layer + compat's React-19 gaps create silent traps. Solid — best reactivity on paper but worst agent story (tiny corpus + reactivity-breaking footguns like prop destructuring) *and* a breaking 2.0 migration mid-flight; the review tax is wrong for agent-written code. React — best corpus but ~55 KB (10× the field) and the VDOM model is structurally the wrong shape here; you'd hand-rebuild fine-grained reactivity with selector stores. React Compiler helps memoization but doesn't change the architecture.

**Regardless of framework:** add a framework-specific agent rules file (`llms.txt` for Svelte / `<script setup>`-pinning for Vue / anti-React guardrails for Solid). That one artifact is the difference-maker on the agent axis.

## 2. Client storage

**Reframing finding that dominates everything else — iOS durability is not a backend choice.** On iOS, OPFS and IndexedDB are *both* "script-writable storage," both subject to WebKit's still-in-force **7-day eviction** (no interaction for 7 days → data deleted), and `navigator.storage.persist()` in a Safari tab does **not** reliably prevent it (WebKit bug 209563, open since 2023). The only exemption WebKit honors is **home-screen / installed-PWA** state. So the durability lever is "prompt Add to Home Screen" + making export/import a first-class recovery path — *not* SQLite-vs-IndexedDB. [webkit.org/blog/14403; bugs.webkit.org/209563; MDN storage-quotas-and-eviction]

**GH-Pages no-header constraint — resolved, non-issue.** The COOP/COEP-requiring path (SQLite async `opfs` VFS via SharedArrayBuffer) is out, but SQLite's **`opfs-sahpool` VFS is explicitly header-free** and needs only HTTPS + a dedicated Web Worker. [sqlite.org/wasm persistence doc; MDN createSyncAccessHandle]

**Verified 2026 options:**

| Option | Version | Weight | Query fit | Verdict |
|---|---|---|---|---|
| **Dexie 4 (IndexedDB)** | 4.4.4 (Jun 2026) | ~27 KB | compound `[key+ts]` + `.between()` range scan; GROUP BY = JS `reduce` | **Winner** |
| SQLite-WASM + `opfs-sahpool` | 3.53 (Apr 2026) | ~1 MB wasm | schema/SQL ports 1:1, real GROUP BY | Strong fallback |
| wa-sqlite | 1.1.1 (Apr 2026) | ~1 MB | like above + real multi-tab (`OPFSCoopSyncVFS`) | Only if multi-tab critical |
| DuckDB-WASM | — | ~1.8 MB gz | analytics overkill | **Skip** — Safari/FF persistence memory-only |
| raw IndexedDB / `idb` | — | ~1.2 KB | native but rebuilds Dexie | Skip unless bundle is sacred |

**Winner: Dexie 4 on IndexedDB.** The decisive point is that **the data layer is being redesigned anyway** (the brief says so), and §0 showed the browser schema *should* shrink to **3 stores** — `snapshots` (raw blobs), `metrics` timeseries (daily + live), `settings` — recomputing `entities`/`players`/`achievement_state` on demand from the current raw. That collapses the "keep my SQL 1:1" advantage of SQLite-WASM, because you aren't keeping the schema regardless. What's left is one real query pattern (time-range + key filter), which is IndexedDB's sweet spot via a compound `[key+ts]` index and `.between()`. The `history()` `GROUP BY ts,key MAX` dedup becomes two indexed range scans merged in JS — a few dozen lines, not architecture.

Dexie then wins on operational risk for this exact profile (single-user, no-server, must survive iOS):
- **Free multi-tab** (transactional across tabs) and **Safari Private-mode support** — SQLite `opfs-sahpool` is single-connection (needs Web-Locks leader election) and unavailable in Private mode (needs an IndexedDB fallback anyway).
- No Web Worker / SyncAccessHandle / reopen-on-backgrounding machinery.
- **`dexie-export-import`** gives streaming, low-RAM, type-preserving (Blobs/Dates survive) backup export/import out of the box — which *is* both your backup feature and your iOS-eviction recovery path. It also composes with the `rebuildDerived` backbone (replay raw blobs → `extractEntities`+`metricsFrom` → `bulkPut` metrics), which stays pure JS.
- Stores ~130KB gzipped saves natively; `bulkPut` for fast metric batches; ~50–100MB is ~0.1% of device quota (iOS 17+ dropped the old 1GB cap — capacity is a non-issue, eviction is the only risk). [dexie.org compound-index / export-import; webkit.org/blog/14403]

**Choose the fallback (SQLite-WASM + `opfs-sahpool`) only if** you decide to preserve the full existing SQL schema and want literal `GROUP BY`/joins rather than porting to a document model — accepting the Web Worker + single-tab-leader + Private-mode-fallback + reopen-on-resume costs. Given the redesign is already on the table, that cost isn't worth it here.

**Gzip note:** replace `node:zlib` with the browser-native `CompressionStream('gzip')` / `DecompressionStream` (baseline in all 2026 targets) — no dependency needed; `fflate` only if you want sync in a hot loop.

**Mandatory regardless of backend:** (1) drive an Add-to-Home-Screen prompt on iOS (the only real durability guarantee); (2) make export/import a one-click, obvious action.

## 3. PWA tooling

**Verified 2026 state:** `vite-plugin-pwa` **1.3.0** (2026-05-05), wrapping Workbox / `workbox-window` **7.4.1** — actively maintained by the vite-pwa org. [registry.npmjs.org/vite-plugin-pwa; github.com/vite-pwa/vite-plugin-pwa]

**Subpath (`username.github.io/reponame/`) config — winner: set it explicitly, don't trust defaults.**
- Set Vite top-level `base: '/reponame/'`; the plugin emits `sw.js`, `registerSW.js`, and manifest under that path.
- **Critical GH-Pages constraint:** you cannot set the `Service-Worker-Allowed` header on GitHub Pages, so the SW's max scope is the directory it is served from. `sw.js` must live at `/reponame/`, and manifest `scope` + `start_url` must **both** be set explicitly to `/reponame/`. Wrong enclosure → "No matching service worker detected", install/offline breaks. [vite-pwa-org.netlify.app/guide; christianheilmann.com PWA-on-gh-pages]

**Precache vs runtime — the 1MB gamedata / 24MB rawdata split is handled for you.**
- Workbox `generateSW` default `maximumFileSizeToCacheInBytes` = **2 MiB**; anything larger is auto-excluded from precache with a build warning. Our ~1MB gamedata precaches fine; any large blob is excluded by default.
- Precache the app shell (`globPatterns: ['**/*.{js,css,html,svg,woff2}']`); serve large/rarely-changing data via a **runtime `runtimeCaching` route** (`StaleWhileRevalidate`), which is also what delivers "offline for last-synced data." Do **not** raise the size limit — that forces a full re-download on every SW update. [developer.chrome.com/docs/workbox; vite-pwa-org FAQ]
- Note: in our design the "last-synced data" lives in the client store (IndexedDB/OPFS), not a fetched file, so the runtime-cache concern mostly applies to the ~1MB gamedata chunks — precache-safe.

**SPA routing on GH Pages — winner: HASH ROUTING (not the 404.html trick), specifically because this is a PWA.**
- The 404.html redirect trick (rafgraph/spa-github-pages) needs a **live network round-trip to GitHub's 404 handler** to fire. When the PWA is offline, a deep-link nav never reaches GitHub, so the trick can't run — you'd fall back to the SW `navigateFallback`, leaving you maintaining **two different routing mechanisms that differ online vs offline.** It also returns a real HTTP 404 first (browser warnings, broken link previews).
- Hash routing (`/reponame/#/dashboard`) never sends the path to the server: GitHub always serves `index.html` (200), and the SW only ever caches the single real URL. `navigateFallback` is trivial and identical online/offline. For an installable offline-first app where deep-link SEO is irrelevant, hash routing is strictly simpler and more robust. [github.com/rafgraph/spa-github-pages; community discussion 64096]

**Update flow — winner: `registerType: 'prompt'` with a "new version — reload" toast.**
- `autoUpdate` forces `skipWaiting`+`clientsClaim` and auto-reloads all tabs — can lose in-progress state, and the real hazard for a data app is `skipWaiting` activating new code while old chunks are still running (chunk-load mismatch, stale UI reading fresh data).
- `prompt` installs-and-waits; user click triggers a controlled full reload so code+SW move in lockstep. Safest when stale rendering code must never interpret new data. **Pick one strategy up front** — switching modes on a deployed app can strand clients in a stuck skip-waiting state. [vite-pwa-org auto-update/prompt guides; vite-pwa issues #228, #721]

**Other GH-Pages gotchas:** add empty `.nojekyll` at publish root (Jekyll strips `_`-prefixed dirs; Vite emits them) or assets 404; no control over `Cache-Control`/headers → rely on Vite content-hashed filenames + SW freshness; serve manifest as `.webmanifest`.

## 4. Charts

**Verified 2026 sizes/versions (bundlephobia + npm):**

| Library | Version | min+gzip | Fit |
|---|---|---|---|
| **uPlot** | 1.6.32 | **~22 KB** | purpose-built time series, zero deps |
| Chart.js | 4.5.1 | ~68 KB (+ date adapter) | friendliest API, largest agent corpus |
| ECharts | 6.1.0 | ~368 KB full (~100–170 tree-shaken) | overkill for line/timeseries |

**Winner: adopt uPlot (replace hand-rolled).** Perf is not close — uPlot renders 166k points in ~25ms; at our scale (hundreds–low-thousands of daily points) all three work, but uPlot has the smallest footprint and vast headroom, and it keeps the tiny-bundle property that made hand-rolling attractive while removing the maintenance burden of hand-writing axis ticks, time scaling, hit-testing, DPR. [leeoniya.github.io/uPlot; scichart bench]
- **Cost:** lower-level API — tooltips/legends are built from primitives. Mitigation: uPlot ships example tooltip plugins; write one in-repo tooltip/stat-breakdown helper once, and agents copy that stable pattern. Cheaper long-term than Chart.js weight or ECharts config sprawl.
- **Don't keep hand-rolled:** no upside over a maintained 22KB lib that solves the same primitives.
- **Chart.js only if** agent-authored declarative charts + rich built-in tooltips outweigh bundle size.
- **Avoid ECharts:** 15×+ the weight; agents often emit non-tree-shaken option trees.

## 5. Repo layout

**Options:** (a) npm-workspaces monorepo (`packages/core`, `packages/data`, `packages/app`); (b) single package with `src/` subfolders.

**Context that decides it:** solo dev + AI agents writing small reviewable increments; no publishing of packages; the "core/data" split is conceptual, not a distribution boundary. The current repo is already a flat single package (`domain.mjs`, `bonuses/`, `stats/`, `gamedata-*.mjs` all at root) and works.

**Trade-offs:**
- Workspaces buy you _enforced_ boundaries (can't import app code from core) and independent `package.json`s. Cost: `npm workspaces` config, cross-package path resolution, Vite `resolve`/`optimizeDeps` for linked packages, and agents must reason about which package owns a file. For a solo dev with no external consumers, the boundary enforcement is mostly ceremony.
- Single package with folders (`src/core/`, `src/data/`, `src/gamedata/`, `src/pages/`, `src/lib/`) gives the same mental model with zero workspace tooling. Boundaries are enforced by convention + lint rules (e.g. `eslint-plugin-import` `no-restricted-paths`) if you want teeth. Agents handle a flat/foldered `src/` far more reliably than multi-package resolution — fewer "where does this import resolve" failures.

**Recommendation — single package, `src/` subfolders.** Concretely:
```
src/
  gamedata/     # the ~40 gamedata-*.mjs (generated; ~1MB) — lazy-import per page
  core/         # domain.mjs, savemap.mjs, bonuses/, stats/  (pure ESM, framework-agnostic)
  data/         # store.ts (browser storage), sync.ts (Firebase fetch), rebuild.ts
  pages/        # one module per game system (~35), each a route component
  lib/          # charts, shared UI, formatting
  app.ts        # router + shell
```
Keep `core/` import-clean (a lint rule blocking `core/ -> data|pages` preserves the "domain is framework-agnostic" property that makes the whole migration cheap). Revisit workspaces only if `core/` ever becomes a package you publish or share — not before. This matches the repo's existing flat-ESM ergonomics and the memory-noted preference for "small readable modules, minimal magic."

## 6. Comparable OSS IdleOn tools

_(Premise correction: IdleonToolbox is by **Morta1** (github.com/Morta1/IdleonToolbox), not Zugrian. **Both** tools are Next.js + React 19.)_

**IdleonToolbox (Morta1)** — Next.js + React + MUI, hostable as a static export. Represents the "keep Next-style DX, host statically" pattern — at the cost of a heavier build/toolchain. Save extraction is out-of-band (data-extractor tool). **Asset approach = thousands of loose game PNGs** named to the game's convention — simplest to reference, but the heaviest possible deploy (repo bloat + high request count). [github.com/Morta1/IdleonToolbox — verify exact deps in its `package.json`]

**Idleon Efficiency (Sludging)** — **verified stack: Next.js 16.1.0 + React 19.2.3 + Grommet + styled-components + Firebase**, server-hosted (heavier ops model). Architecture is domain-oriented: a `data/domain/` layer where **each game system is its own class/module**, composed by a central coordinator, following a `save → per-domain parse → ordered post-parse for cross-system effects → display` pipeline — **this two-phase parse is the single best idea to steal** and is language/framework-agnostic. Game data is **codegen'd from the game client (N.js), not hand-curated**, into generated data/enum/model dirs, with human logic kept in separate editable modules. **Asset approach = a Python sprite pipeline (`sprite_maker.py`, verified present) that repacks game sprite sheets + CSS `background-position`** — far fewer files/requests than loose PNGs. [github.com/Sludging/idleon-efficiency; /blob/main/package.json; /blob/main/sprite_maker.py — all verified via web search]

**Emulate:**
- Per-system domain modules + **two-phase parse** (per-domain parse, then an *ordered* cross-system post-parse). This is the single best idea and language-agnostic — our `domain.mjs extractEntities` + `bonuses/` + `stats/` already lean this way; formalize the ordered cross-system phase.
- **Codegen game data from N.js**, never hand-curate — matches our MEMORY note ("N.js is ground truth"). Our `gamedata-*.mjs` should be treated as generated artifacts in their own dir, regenerated by a scripted N.js extractor as the recurring maintenance surface.
- **Sprite sheets + CSS `background-position`** for game icons — essential for a static PWA (fewer requests, smaller offline cache).

**Avoid:**
- Toolbox's **15k loose PNGs** (repo/deploy bloat, request count).
- Efficiency's **server + Firebase + Vercel** runtime (we want none of it — read the save client-side from Firebase REST or file upload).
- The **Next.js/MUI/Grommet weight** itself: on GitHub Pages you get no SSR benefit while paying the full toolchain cost. Lift their *data/parser organization*, not their *framework*.

**Recurring-cost caveat to budget for:** both tools' real maintenance burden is the **out-of-band extractor keeping pace with N.js patches**, not the UI. Same will be true here.

## 7. Recommended stack + top risks

### Recommended stack (one paragraph)

Build it as a **single-package Vite SPA** (`src/` subfolders: `gamedata/`, `core/`, `data/`, `pages/`, `lib/`) — no meta-framework, since GH-Pages disables the SSR/SSG that justifies one — using **Vue 3.5 + Vue Router in `createWebHashHistory()` (hash) mode** (near-tie with Svelte 5; pick Vue for the mature agent corpus + zero migration risk, or Svelte 5 + `svelte-spa-router` if you weight the ~3-4KB runtime and `$derived` elegance and will maintain an `llms.txt` agent-context file). The 15k-LOC pure-ESM domain layer (`domain.mjs`, `bonuses/`, `stats/`, `gamedata-*.mjs`, `savemap.mjs`) is imported **unchanged**; parse the save **once** at app start into a `shallowRef`/`markRaw` blob and expose per-page panels as cached `computed()` — this "parse-once, derive-many" is the migration's biggest win over today's per-HTML-page cold starts. Persist in the browser with **Dexie 4 (IndexedDB)** using a slimmed 3-store schema (`snapshots` raw gzip blobs via native `CompressionStream`, `metrics` timeseries on a compound `[key+ts]` index, `settings`), recomputing per-page entities on demand and keeping the `rebuildDerived` replay backbone as pure JS; ship export/import via `dexie-export-import`. Wrap with **vite-plugin-pwa 1.3 (`registerType:'prompt'`)** configured for the `/reponame/` subpath (explicit manifest `scope`+`start_url`, `.nojekyll`, 2 MiB precache default keeping large blobs on runtime-cache routes), and replace the hand-rolled charts with **uPlot** (~22KB) plus one in-repo tooltip helper. Steal Idleon-Efficiency's per-domain two-phase parse and codegen-from-N.js data discipline, and its sprite-sheet + CSS `background-position` asset approach; avoid the Next.js/MUI weight and loose-PNG deploys of both reference tools.

### Top 3 risks + mitigations

1. **iOS silently evicts all data after 7 days of non-use** (WebKit 7-day rule; `persist()` doesn't reliably help in a Safari tab; hits IndexedDB *and* OPFS equally). For a "years of daily snapshots" tracker this is the single biggest threat — a user who skips a week can lose everything.
   - *Mitigation:* Make **Add-to-Home-Screen the durability story** (only installed-PWA state is exempt) — actively prompt for it on iOS. Make **export a one-click, nagging action** and support auto-export to a file/Drive on a cadence. Treat the local store as a cache, the exported backup as the source of truth. Because every metric is rebuildable from stored raws, a re-import fully reconstitutes history.

2. **Agent-authored framework drift** — whichever framework, AI agents are the primary authors and will emit off-idiom code (Svelte 4 `$:`/`export let`; Vue Options-API mixed into Composition; Solid prop-destructure that silently breaks reactivity). This accrues as subtle reactivity bugs, not loud errors.
   - *Mitigation:* Commit a framework **`llms.txt`/rules file** to the repo and load it into agent context on every task (this alone flips Svelte from risky to viable). Add a lint gate (`eslint-plugin-vue` recommended, or svelte-check) in CI. Keep framework code thin — most logic lives in the framework-agnostic `core/`, which agents handle far more reliably than reactive-framework code.

3. **Game-data / parser rot against N.js patches** — the real recurring maintenance surface (confirmed by both reference tools) is keeping `gamedata-*.mjs` and the save-key map in sync as IdleOn patches; a silent save-format change corrupts derived metrics for *every* new snapshot, and because rebuild replays raws, a bad parser can also mis-derive history on rebuild.
   - *Mitigation:* Treat `gamedata/` as **generated artifacts** with a scripted extractor from N.js (as Idleon Efficiency does), never hand-edited, regenerated per patch. Keep the raw gzip snapshot as the immutable ground truth so any parser fix can re-derive correct metrics retroactively (the existing `rebuildDerived` property — preserve it). Add a lightweight parse-sanity assertion on sync (expected char count, known keys present) that flags format drift loudly instead of silently writing garbage.

---

### Appendix — migration mechanics (concrete)
- **Delete/replace:** `db.mjs` → `src/data/store.ts` (Dexie); `companion.mjs` HTTP server → gone (pages read the store directly); `fetch-idleon.mjs` → `src/data/sync.ts` (client Firebase REST fetch + timer). `node:zlib` → `CompressionStream`.
- **Keep verbatim:** `domain.mjs`, `bonuses/`, `stats/`, `savemap.mjs`, `gamedata-*.mjs`. N.js stays a gitignored dev-only reference (already is).
- **Per-page pattern:** route component imports its `gamedata-*` chunk lazily + reads cached `computed` panels off the shared parsed-save store — no per-page re-parse.

