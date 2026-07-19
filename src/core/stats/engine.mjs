/* stats/engine.mjs — the generic stat-breakdown engine.
 *
 * A STAT RECIPE is the client's expression for one displayed stat, transcribed verbatim as an
 * ordered list of TERMS. Each term's value comes from a shared evaluator in bonuses/ (one module
 * per client dispatcher: Summoning, ResearchStuff, Thingies, ...), so a new stat is a short
 * recipe file, not a re-implementation. The recipe shape:
 *
 *   {
 *     name:  "artifactFind",            // stable slug -> metric keys `stat.<name>[.<termId>]`
 *     label: "Artifact Find Chance",
 *     terms(ctx) -> Term[],             // the client expression, one Term per factor/addend
 *     combine({pool, mul, terms, ctx}) -> number,   // optional; default (1+pool/100)*mul
 *     activeCharSensitive(s) -> bool,   // optional; true when the result depends on WHO is active
 *   }
 *
 * TERMS: { id, key, kind, value, status, note, parts }
 *   id     short stable slug. Metric-key material (`stat.<recipe>.<id>`) — NEVER rename one that
 *          has shipped; stored history is keyed on it.
 *   key    the verbatim client expression, e.g. 'Summoning("WinBonus",3,0)'
 *   kind   "add" -> summed into the additive percent pool; "mul" -> multiplied into the chain
 *   status "computed" | "partial" | "unknown" | "user-supplied" | "per-char"
 *          ("per-char" = derivable but character-dependent; neutral in the account-collapsed
 *           view, computed in evaluatePerChar's byChar results — distinct from "unknown",
 *           which means the save genuinely cannot answer)
 *   note   human-readable derivation trace
 *   parts  optional [{label, value, note}] — the term's own inputs, for drill-down UIs
 *          (e.g. the arcade term's two upgrade rows, each shiny pet). Display-only; the engine
 *          never computes from parts.
 *
 * BONUS EVALUATORS return FRAGMENTS — { value, status?, note?, parts? } — not terms, so the same
 * evaluator serves any stat: the recipe names the term (id/key/kind), the evaluator prices it.
 * Wrap with term(id, key, kind, fragment).
 *
 * HONESTY CONTRACT (engine-enforced, inherited from artifactchance.mjs): a value that cannot be
 * derived from the save is status "unknown" and contributes its NEUTRAL element (0 for add,
 * 1 for mul) — never a plausible guess. ctx.unknown(reason) collects why; callers must surface
 * `lowerBound: true` rather than present the value as exact.
 *
 * ACTIVE CHARACTER. Some account-wide stats read values from whichever character is ACTIVE
 * (star signs are the known case — bonuses/starsigns.mjs). The save only records who was active
 * at sync time. evaluatePerChar() computes the stat for EACH character as-if-active so pages can
 * say "be on char X for the best value"; when all characters agree (the usual endgame case) it
 * collapses to a single character-independent result.
 */

import { sel } from "../savemap.mjs";
import { solveLab } from "../bonuses/labboard.mjs";

export const T = (id, key, kind, value, status, note, parts) =>
  ({ id, key, kind, value, status, note, ...(parts ? { parts } : {}) });

/** Wrap a bonuses/ fragment into a named term. Fragment: {value, status?, note?, parts?}. */
export const term = (id, key, kind, frag) =>
  T(id, key, kind, frag.value, frag.status ?? "computed", frag.note ?? "", frag.parts);

/**
 * The evaluation context handed to every bonuses/ evaluator. One object instead of five
 * threaded parameters; `unknowns` accumulates honesty flags across the whole recipe.
 *
 * companions: Set of owned companion ids, or null = genuinely unknown (never "owns none").
 *             Defaults to sel.companionsOwned(s): the `_comp` RTDB doc ∪ OptLacc[606] tokens.
 * labConnected(id): connectivity now comes from the FLOOR SOLVER (bonuses/labboard.mjs), which
 *             simulates the lab board from the save and only ever answers `true` for PROVEN
 *             connections — everything else stays null (unknown), never false. When
 *             opts.labConnectedIds is supplied it is treated as the user's authoritative
 *             observation and wins outright (true AND false).
 * tomePoints / activeVote: runtime values the save does not hold; null = unknown.
 * activeChar: which character to treat as active for active-char-dependent terms; null means
 *             the sync-time active char is NOT assumed — terms that need one go unknown.
 * args:      recipe-specific parameters (e.g. {boatIdx} for sailing stats).
 */
export function makeCtx(s, opts = {}) {
  const {
    activeChar = null, tomePoints = null,
    labConnectedIds = null, override = {}, args = {},
    companions = sel.companionsOwned(s),
  } = opts;
  /* the weekly vote: explicit opt wins (?? so a null/absent opt falls through); else the
   * __serverVars doc captured at sync time; else honestly unknown */
  const activeVote = opts.activeVote ?? sel.activeVoteId(s);
  const ctx = {
    s, activeChar, activeVote, tomePoints, companions, override, args,
    unknowns: [],
    unknown(msg) { this.unknowns.push(msg); },
  };
  ctx.labConnected = (id) => {
    if (labConnectedIds !== null) return labConnectedIds.includes(id);
    try {
      return solveLab(ctx).nodes.has(id) ? true : null;   // floor: proven or unknown, never false
    } catch { return null; }
  };
  return ctx;
}

const defaultCombine = ({ pool, mul }) => (1 + pool / 100) * mul;

/**
 * Evaluate one recipe against a save.
 * opts: activeChar, activeVote, tomePoints, labConnectedIds, companions, args,
 *       override — {termId: value} (term `key` also accepted) for numbers the user read off
 *       their own screen; marked "user-supplied" in the breakdown.
 * @returns {{value, additivePoolPct, multiplicative, terms, unknown, lowerBound}}
 */
export function evaluate(recipe, s, opts = {}) {
  const ctx = makeCtx(s, opts);
  const terms = recipe.terms(ctx).map((t) =>
    (t.id in ctx.override || t.key in ctx.override)
      ? T(t.id, t.key, t.kind, ctx.override[t.id] ?? ctx.override[t.key], "user-supplied",
          "supplied by caller, not derived from the save")
      : t);
  const pool = terms.filter((t) => t.kind === "add").reduce((a, t) => a + t.value, 0);
  const mul = terms.filter((t) => t.kind === "mul").reduce((a, t) => a * t.value, 1);
  const value = (recipe.combine ?? defaultCombine)({ pool, mul, terms, ctx });
  return {
    value, additivePoolPct: pool, multiplicative: mul, terms,
    unknown: ctx.unknowns, lowerBound: ctx.unknowns.length > 0,
  };
}

/**
 * Evaluate as-if-active for every character present in the save. Returns
 *   { byChar: [{charIdx, result}] | null, collapsed: result, sensitive: bool }
 * `collapsed` is the char-independent result when all characters agree (or the recipe is
 * insensitive); when they differ it is the evaluation with activeChar = null (honest unknowns),
 * and byChar carries the per-character truth.
 */
export function evaluatePerChar(recipe, s, opts = {}) {
  const sensitive = recipe.activeCharSensitive ? recipe.activeCharSensitive(s) : false;
  if (!sensitive) return { byChar: null, collapsed: evaluate(recipe, s, opts), sensitive: false };
  const byChar = s.charIdxs.map((i) =>
    ({ charIdx: i, result: evaluate(recipe, s, { ...opts, activeChar: i }) }));
  const allEqual = byChar.every((c) => c.result.value === byChar[0].result.value);
  if (allEqual) return { byChar: null, collapsed: byChar[0].result, sensitive: true };
  return { byChar, collapsed: evaluate(recipe, s, { ...opts, activeChar: null }), sensitive: true };
}

/**
 * Flatten a result into long-format metric rows for the time-series DB:
 *   stat.<name>            the total
 *   stat.<name>.<termId>   each term's own value (add: percent; mul: factor)
 *   stat.<name>.unknowns   how many terms were unknown — lets history tell "the stat rose"
 *                          from "a term became knowable"
 * Unknown terms are OMITTED (their neutral element would chart as a real datapoint).
 */
export function metricRows(name, result) {
  const rows = { [`stat.${name}`]: result.value, [`stat.${name}.unknowns`]: result.unknown.length };
  for (const t of result.terms) {
    if (t.status === "unknown" || t.status === "per-char") continue;
    rows[`stat.${name}.${t.id}`] = t.value;
  }
  return rows;
}
