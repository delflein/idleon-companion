/* src/data/derived.js — THE DERIVATION LAYER (M5-prep).
 *
 * Pure, framework-free functions that mirror every companion.mjs REST endpoint's payload shape,
 * so a ported page replaces `fetch('/api/X')` with a `computed()` over these. Everything here
 * takes (raw | save, opts) as ARGUMENTS — no Dexie, no Vue, no appState import — which is the
 * whole point: the same code runs in a page's computed(), in a Web Worker, in a Node smoke test,
 * or a future CLI, and is trivially unit-testable against the live server (scripts/smoke-derived.mjs).
 *
 * The reactive wiring (a save-and-statOpts-driven `computed()` per function) lives in appState.js,
 * the one file allowed to import Vue. Keep this file Vue-free.
 *
 * Endpoint → function map (see companion.mjs for the originals these mirror byte-for-byte):
 *   /api/state  snapshot.entities  →  deriveEntities(raw, charNames)   (extractEntities)
 *   /api/state  snapshot.metrics   →  deriveMetrics(entities)          (metricsFrom)
 *   /api/stats  .stats             →  deriveStats(save, opts)          (RECIPES × evaluatePerChar)
 *   /api/farming .report           →  deriveFarming(save, opts)        (farmingReport)
 *   /api/w1..w7                    →  w1Glossary()..w7Glossary()       (re-exported; pure/static)
 */
import { extractEntities, metricsFrom, artifactSourceChar } from "../core/domain.mjs";
import { RECIPES, evaluatePerChar } from "../core/stats/index.mjs";
import { farmingReport } from "../core/stats/farming-report.mjs";

/* Static per-world glossary text (no save parsing — same payload on every call, exactly what the
 * legacy /api/w1../api/w7 endpoints returned). Re-exported verbatim so a page imports them from
 * here rather than reaching into src/core directly — one derivation surface for the whole app. */
export { w1Glossary } from "../core/stats/w1-report.mjs";
export { w2Glossary } from "../core/stats/w2-report.mjs";
export { w3Glossary } from "../core/stats/w3-report.mjs";
export { w4Glossary } from "../core/stats/w4-report.mjs";
export { w5Glossary } from "../core/stats/w5-report.mjs";
export { w6Glossary } from "../core/stats/w6-report.mjs";
export { w7Glossary } from "../core/stats/w7-report.mjs";

/**
 * `/api/state`'s `snapshot.entities`: the raw-save → per-system entity tree (numbers the pages
 * render). Identical to db.mjs/latest()'s stored `entities` — in the SPA it's recomputed in memory
 * rather than persisted (docs/ARCHITECTURE.md D3). `charNames` null = fall back to save-embedded.
 *
 * @param {object} raw parsed save blob
 * @param {string[]|null} [charNames]
 */
export function deriveEntities(raw, charNames = null) {
  if (!raw) return null;
  return extractEntities(raw, charNames);
}

/**
 * `/api/state`'s `snapshot.metrics`: the flat {key: number} map fed to the time-series store.
 * Mirror of db.mjs's `metricsFrom(extractEntities(raw))`.
 *
 * @param {object} entities the output of deriveEntities()
 */
export function deriveMetrics(entities) {
  if (!entities) return null;
  return metricsFrom(entities);
}

/**
 * `/api/stats`'s `stats` map: every registered recipe evaluated fresh from the save, per-character
 * where the recipe is active-char-sensitive. Mirrors companion.mjs's GET /api/stats handler EXACTLY
 * — same activeChar (artifactSourceChar), same `?villager=N` arg passthrough (only villager-exp.mjs
 * reads ctx.args.villager; every other recipe ignores it), same opts spread.
 *
 * @param {object} save openSave(raw, charNames)
 * @param {object} [opts] { villager?, tomePoints?, labConnectedIds?, activeVote? } —
 *   the optional villager Explorer index plus the engine's pin-able evaluate() opts (no UI feeds
 *   the latter since the manual-inputs removal — the seam stays for tests/tools).
 *   `villager` is stripped out and turned into ctx.args (companion's url.searchParams "villager");
 *   everything else is spread into evaluate opts verbatim.
 * @returns {object|null} { [recipeName]: { name, label, format, display, byChar, collapsed, sensitive } }
 */
export function deriveStats(save, { villager = null, ...statOpts } = {}) {
  if (!save) return null;
  /* ?villager=N — default absent (the Explorer, villager 0). Non-finite is ignored, matching
   * companion's `villagerArg !== null && isFinite(Number(...))` guard. */
  const args = villager !== null && isFinite(Number(villager)) ? { villager: Number(villager) } : {};
  const opts = { activeChar: artifactSourceChar(save), args, ...statOpts };
  const stats = {};
  for (const r of RECIPES)
    stats[r.name] = { name: r.name, label: r.label, format: r.format ?? "multiplier", display: r.display ?? {}, ...evaluatePerChar(r, save, opts) };
  return stats;
}

/**
 * `/api/farming`'s `report`: the full four-module farming report (medal evo push, exotic planner,
 * OG & stickers, markets), computed fresh from the save. Mirrors companion.mjs's GET /api/farming:
 * `farmingReport(s, { activeChar: artifactSourceChar(s), ...statOpts() })`. Exotic week comes from
 * the wall clock (farmingReport's default `nowMs = Date.now()`), never from the save's age.
 *
 * @param {object} save openSave(raw, charNames)
 * @param {object} [opts] extra evaluate() opts (unused by the app since the manual-inputs removal)
 * @param {number} [nowMs] wall clock for the exotic-week calc; defaults inside farmingReport
 */
export function deriveFarming(save, opts = {}, nowMs = Date.now()) {
  if (!save) return null;
  return farmingReport(save, { activeChar: artifactSourceChar(save), ...opts }, nowMs);
}
