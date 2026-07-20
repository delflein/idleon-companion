/* src/core/farming-advice.mjs — the client-only weighted recommendation heuristic that the
 * farming page layers on top of the neutral facts in report (stats/farming-report.mjs). Ported
 * verbatim (in behaviour) from farming.html's FOCUS_PRESETS / scoreRow / exotic buy-vs-hold /
 * night-market "fit" logic. Framework-free (CLAUDE.md layering D2) so it is unit-testable and
 * reusable.
 *
 * IMPORTANT: this module invents NO game rates. Every number it consumes (per-row bonus, levels
 * per buy, saturation ratio, budget-gain, rotation slots) is computed by the verified core
 * (bonuses/farming.mjs → farming-report.mjs). All this layer does is RANK those facts by the
 * user's chosen focus — a genuine, non-trivial recommendation engine (docs/migration/survey-pages.md
 * flagged item #7), preserved rather than silently dropped, but kept out of the presentation layer.
 * It returns structured data (scores, kinds, arrays); the page renders text/markup from it. */

/** Focus presets: a 0–10 weight per exotic/night-market goal tag. Nothing is universally "skip" —
 *  the weights decide (matches farming.html FOCUS_PRESETS byte-for-byte). */
export const FOCUS_PRESETS = {
  evo: { label: "Evolution", w: { evo: 10, meta: 9, og: 6, depot: 6, ranks: 5, artifact: 5, droprate: 4, beans: 3, value: 3, exp: 2, costs: 2, growth: 0, other: 1 } },
  og: { label: "OG & stickers", w: { og: 10, meta: 8, ranks: 6, evo: 5, value: 5, depot: 4, beans: 3, exp: 3, artifact: 3, droprate: 3, costs: 2, growth: 1, other: 2 } },
  ranks: { label: "Ranks & EXP", w: { ranks: 10, exp: 8, meta: 8, evo: 4, og: 4, depot: 4, beans: 4, value: 3, artifact: 2, droprate: 2, costs: 3, growth: 1, other: 2 } },
  cross: { label: "Cross-skill", w: { artifact: 8, droprate: 8, depot: 8, other: 7, meta: 7, evo: 3, og: 3, ranks: 3, beans: 2, value: 2, exp: 2, costs: 1, growth: 1 } },
  all: { label: "Balanced", w: { evo: 5, meta: 7, og: 5, depot: 5, ranks: 5, artifact: 5, droprate: 5, beans: 4, value: 4, exp: 4, costs: 3, growth: 2, other: 4 } },
};

/** Weights for a focus key (falls back to the Evolution preset if an unknown key is passed). */
const weightsFor = (focus) => (FOCUS_PRESETS[focus] ?? FOCUS_PRESETS.evo).w;

/** Score one exotic row under a focus: goal weight × a saturation penalty (a nearly-capped
 *  saturating row is worth less than its raw weight suggests). Verbatim from scoreRow(). */
export function scoreRow(focus, row) {
  const w = weightsFor(focus);
  return (w[row.goal] ?? 1) * (row.saturating ? Math.max(0.05, 1 - (row.satRatio ?? 0)) : 1);
}

/** Look up an exotic row by its idx in report.exotic.rows (rows are indexed 0..59). */
export const rowByIdx = (report, idx) => report.exotic.rows.find((r) => r.idx === idx);

/**
 * Rank this week's 8 exotic rotation slots for a focus, and decide buy / hold / ok / low for each.
 * "hold" fires when the SAME goal shows up notably stronger (score > 1.25×) within the next 4 weeks.
 *
 * @returns {{ maxScore: number, current: Array<{
 *   slot:number, idx:number, score:number,
 *   betterSoon: Array<{week:number, name:string}>,
 *   advice: { kind: "hold"|"buy"|"ok"|"low", holds: Array<{week:number, name:string}> },
 *   ...exoticRowFields }> }}
 */
export function exoticWeekAdvice(report, focus) {
  const ex = report.exotic;
  const current = ex.currentSlots
    .map((idx, slot) => ({ slot, ...rowByIdx(report, idx) }))
    .map((c) => ({ ...c, score: scoreRow(focus, c) }))
    .sort((a, b) => b.score - a.score);
  const maxScore = Math.max(0, ...current.map((c) => c.score));
  const horizon = ex.weeksAhead.slice(0, 4);
  for (const c of current) {
    c.betterSoon = [];
    for (const wk of horizon)
      for (const idx of wk.slots) {
        const r = rowByIdx(report, idx);
        if (r && r.goal === c.goal && scoreRow(focus, r) > c.score * 1.25) c.betterSoon.push({ week: wk.week - ex.week, name: r.name });
      }
    c.advice = c.betterSoon.length
      ? { kind: "hold", holds: c.betterSoon.slice(0, 2) }
      : { kind: c.score >= maxScore * 0.6 ? "buy" : c.score >= maxScore * 0.3 ? "ok" : "low", holds: [] };
  }
  return { maxScore, current };
}

/**
 * Rank the night-market advisor rows for a focus. Fit = goal weight × (budget-gain − 1), i.e. how
 * much the whole banked-beans budget poured into that one upgrade moves the user's goal. Maxed
 * rows are dropped. Verbatim from renderNightAdvisor()'s scoring.
 *
 * @returns {{ maxFit: number, rows: Array<{fit:number, ...nightRowFields}> }|null}
 */
export function nightAdvisorRanked(report, focus) {
  const adv = report.markets.nightAdvisor;
  if (!adv) return null;
  const w = weightsFor(focus);
  const rows = adv.rows
    .filter((r) => !r.maxed)
    .map((r) => ({ ...r, fit: (w[r.goal] ?? 1) * (r.budgetGain - 1) }))
    .sort((a, b) => b.fit - a.fit);
  const maxFit = Math.max(1e-9, ...rows.map((r) => r.fit));
  return { maxFit, rows, budget: adv.budget };
}
