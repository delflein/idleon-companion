/* src/core/landrank-optimizer.mjs — the Land Rank Database point-allocation optimizer, ported
 * verbatim (in behaviour) from the legacy landrank.html client code
 * (bonusOf/groupValue/refRankOf/objective/optimize). Framework-free (CLAUDE.md layering D2): pure
 * functions over a plain `model` object, so the same code runs in the Vue page, a Node test, or a
 * worker — never importing Vue/DOM.
 *
 * PROVENANCE. The per-upgrade bonus curve (`bonusOf`) is the DISPLAY side of
 * bonuses/farming.mjs:landRankUpg (N.js "LankRankUpgBonus", read 2026-07-18): Seed rows
 * 4/9/14/19 are LINEAR base*L, every other row is hyperbolic 1.7*base*L/(L+80); both are then
 * multiplied by the account's Dank-Ranks talent 207 × Plump-Database exotic — that shared factor
 * is folded into `model.calc.multi` by farming-report.mjs's `rankCalcCtx`, so this module only
 * needs `rankDb[i].base` and `calc.multi`.
 *
 * The optimizer/scoring layer ON TOP (a weighted-log objective + a greedy multi-pass hill-climb)
 * has NO server equivalent — it is genuine page-local product logic (docs/migration/survey-pages.md
 * flagged item #3) and is preserved here 1:1, keeping its two documented properties:
 *   - NO hand-tuned allocation ratios: every point goes to wherever it buys the most weighted gain.
 *   - per-rank rows use each plot's OWN rank (evolution/soil scale by a reference plot rank — the
 *     medal plot's rank for evolution, the fleet average otherwise).
 *
 * model shape (all four come straight off report.markets — see farming-report.mjs):
 *   rankDb       report.markets.rankDb        [{ level, base, name, desc, ... }] (20 rows)
 *   calc         report.markets.rankCalcCtx   { multi, fifthColMax,
 *                                                value:{gmo,vote,cap,doubler}, medalPlotRank }
 *   plotRanks    report.markets.plotRanks      number[] (per-plot land ranks)
 *   rankPtsTotal report.markets.rankPtsTotal   total land-rank points available on a full respec
 */

/** The five weightable upgrade groups (row indices into the 20-slot Land Rank Database). */
export const GROUPS = {
  evo: { label: "Evolution", ids: [0, 3, 10, 15] },
  og: { label: "Overgrowth", ids: [7, 11, 18] },
  soil: { label: "Rank EXP", ids: [2, 6, 13] },
  value: { label: "Crop value", ids: [1, 8, 17] },
  exp: { label: "Farming EXP", ids: [5, 12, 16] },
};

/** The 5th-column "Seed of …" rows — capped at calc.fifthColMax, not part of any weighted group. */
export const SEED_IDS = [4, 9, 14, 19];

/** Goal presets: 0–10 weight per group. `custom` (w:null) means "keep the current slider values". */
export const PRESETS = {
  evo: { label: "Evolution", w: { evo: 10, soil: 3, og: 2, exp: 1, value: 1 } },
  balanced: { label: "Balanced", w: { og: 5, soil: 2, evo: 2, exp: 1, value: 2 } },
  endgame: { label: "Endgame (no evo)", w: { og: 5, soil: 3, exp: 2, evo: 0, value: 2 } },
  soilgrow: { label: "Rank Exp", w: { soil: 10, og: 2, evo: 1, exp: 1, value: 0 } },
  custom: { label: "Custom", w: null },
};

/** DISPLAY bonus of row `i` at level `L` — see PROVENANCE (landRankUpg mirror). */
export function bonusOf(model, i, L) {
  const u = model.rankDb[i];
  const raw = i % 5 === 4 ? u.base * L : (1.7 * u.base * L) / (L + 80);
  return model.calc.multi * raw;
}

/** The reference plot rank a per-rank group scales against: evolution uses the medal plot's rank
 *  (falling back to the average), every other group uses the fleet average. */
export function refRankOf(model, g) {
  const avg = Math.round(model.plotRanks.reduce((a, b) => a + b, 0) / Math.max(1, model.plotRanks.length));
  if (g === "evo") return model.calc.medalPlotRank ?? avg;
  return avg;
}

/** A group's combined multiplicative bonus at a given level vector (matches groupValue() verbatim). */
export function groupValue(model, g, levels, refRank) {
  const U = (i) => bonusOf(model, i, levels[i]);
  if (g === "evo") return (1 + (U(0) * refRank) / 100) * (1 + U(3) / 100) * (1 + U(10) / 100) * (1 + U(15) / 100);
  if (g === "og") return 1 + (U(7) + U(11) + U(18)) / 100;
  if (g === "soil") return (1 + (U(2) * refRank) / 100) * (1 + (U(6) + U(13)) / 100);
  if (g === "exp") return 1 + (U(5) + U(12) + U(16)) / 100;
  if (g === "value") {
    const v = model.calc.value;
    return Math.min(v.cap, Math.round(v.doubler * v.gmo * (1 + (U(8) + U(17)) / 100) * (1 + (U(1) * refRank + v.vote) / 100)));
  }
  return 1;
}

/** Log-weighted-sum objective across the five groups' current weights. */
export function objective(model, weights, levels) {
  let s = 0;
  for (const g of Object.keys(GROUPS)) {
    const w = weights[g] ?? 0;
    if (w > 0) s += w * Math.log(Math.max(1e-12, groupValue(model, g, levels, refRankOf(model, g))));
  }
  return s;
}

/**
 * Greedy multi-pass hill-climb: spend the account's land-rank points across the 20 upgrade slots
 * to maximize `objective`, respecting per-slot caps (Seed rows capped at fifthColMax; group rows
 * uncapped) and the two modes.
 *
 * @param {object} model see file header
 * @param {object} opts
 * @param {Record<string,number>} opts.weights per-group 0–10 weights
 * @param {"respec"|"addonly"} opts.mode full respec (all points free) vs. place-unspent-only
 *   (existing levels frozen, only leftover points allocated)
 * @param {boolean} opts.maxSeeds max out the "Seed of …" 5th-column rows first
 * @returns {{ levels: number[], unspent: number }} recommended level per slot + unplaceable points
 */
export function optimize(model, { weights, mode, maxSeeds }) {
  const n = model.rankDb.length;
  const levels = new Array(n).fill(0);
  let budget = model.rankPtsTotal;
  if (mode === "addonly") {
    for (let i = 0; i < n; i++) levels[i] = model.rankDb[i].level;
    budget = model.rankPtsTotal - model.rankDb.reduce((t, u) => t + u.level, 0);
  }
  const capOf = (i) => (SEED_IDS.includes(i) ? model.calc.fifthColMax : Infinity);
  if (maxSeeds) {
    for (const i of SEED_IDS) {
      const take = Math.min(Math.max(0, capOf(i) - levels[i]), budget);
      levels[i] += take;
      budget -= take;
    }
  }
  const groupIds = Object.values(GROUPS).flatMap((g) => g.ids);
  let cur = objective(model, weights, levels);
  for (const chunk of [64, 16, 4, 1]) {
    while (budget >= chunk) {
      let best = -1;
      let bestGain = 1e-12;
      for (const i of groupIds) {
        if (levels[i] + chunk > capOf(i)) continue;
        levels[i] += chunk;
        const gain = objective(model, weights, levels) - cur;
        levels[i] -= chunk;
        if (gain > bestGain) {
          bestGain = gain;
          best = i;
        }
      }
      if (best < 0) break;
      levels[best] += chunk;
      budget -= chunk;
      cur = objective(model, weights, levels);
    }
  }
  return { levels, unspent: budget };
}
