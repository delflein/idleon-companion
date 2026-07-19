# CLAUDE.md — IdleOn Companion (SPA/PWA)

Decision record: `docs/ARCHITECTURE.md`. Read it before touching `src/**`, `vite.config.mjs`,
or `.github/workflows/**` — it explains *why*, this file is just the *how*.

## Vue conventions

- `<script setup>` only. No Options API, no render functions unless there's no other way.
- `shallowRef` + `markRaw` for the parsed save blob (D1) — it's one big object replaced whole
  on each sync, not deep-reactive; every panel derives from it via `computed()`, never mutates it.
- `computed()` for every derived value shown in the UI. Parse once, derive many — don't
  re-run recipe logic in a method/watcher when a computed will do.
- Hash-router URLs (`createWebHashHistory`, D5) — zero-config on GitHub Pages. Don't switch to
  history mode; there is no server to rewrite 404s.

## Layering (D2) — do not violate

- `src/gamedata/` and `src/core/` (savemap, domain, stats, bonuses once ported in M2): pure JS,
  zero framework imports, zero DOM/browser-only APIs. Never import from `src/ui/` or
  `src/pages/`. This is what lets the same code run in a Web Worker (D3's rebuild path).
- `src/data/` (storage + sync): no Vue imports either. `src/data/sync.js` is plain
  fetch/localStorage so it's reusable from a worker or a future CLI import tool.
- `src/ui/` and `src/pages/` are the only layers allowed to import Vue.

## Language

- JS + JSDoc, not TypeScript — no TS conversion churn on 25k LOC of already-verified game logic
  (D2). Add JSDoc types where they pay for themselves (public function signatures, non-obvious
  shapes); don't chase 100% coverage.

## Ground rules for game logic (survive the migration verbatim — see README.md)

- **N.js is ground truth.** The decompiled client is authoritative; the wiki and community
  research have been wrong before. Confirm formulas in the client, cite the function in a
  comment.
- **Unknown beats guessed.** Record uncertainty honestly — a wrong label gets trusted. Two
  things are never knowable from the save and must never be silently faked: Firebase server
  vars (calibrated, not derived) and companion ownership (native bridge, not in the save).
- **Term ids never rename.** They're metric keys — a rename breaks history (Dexie `metrics`
  rows key on them, same as the old SQLite schema did).

## Other

- Every skill/system/feature gets its own page under `src/pages/`, never a per-world grouping
  (carried over from the pre-migration page-per-system rule).
- Don't add a dependency to solve something a few lines of reviewed code already solves; do
  reach for one (D6's uPlot, D3's Dexie) when the problem is genuinely complex (parsing, time
  series, storage) — see the top-level engineering philosophy this repo inherits.
