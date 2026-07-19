/* stats/tome.mjs — recipe for THE TOME SCORE (GenInfo[84], the "<N> PTS" on the Tome page).
 *
 * Not a bonus expression like the other recipes — the score is a flat SUM of ceil(curve(qty)
 * * maxPts) over 118 account-wide metrics, each gated on total account level (see
 * bonuses/tome.mjs for the verbatim formulas). Registered as a recipe so the Stat Explorer
 * doubles as the Tome overview: every row is a term with its quantity, points, cap and gate,
 * and the per-row history lands in the metrics table like any other stat.
 *
 * The total is a FLOOR while any unlocked row is unknown (they count 0); the recipe reports
 * how many points the unknown rows could add at most. */

import { T, evaluate } from "./engine.mjs";
import { tomeRows, tomeScore, accountLevel, tomeLvReq } from "../bonuses/tome.mjs";

const cleanName = (n) => n.replace(/\\u[0-9a-fA-F]{4}/g, "").replace(/_/g, " ").replace(/\s+/g, " ").trim();

export const tomeScoreRecipe = {
  name: "tomeScore",
  label: "Tome Score",
  format: "points",              // the total is a POINT SUM, not a multiplier
  activeCharSensitive: () => false,
  combine: ({ pool }) => pool,   // the score IS the sum — no /100, no multipliers

  terms(ctx) {
    const rows = tomeRows(ctx);
    const score = tomeScore(ctx);
    if (score.floor)
      ctx.unknown(`${score.unknownRows.length} Tome rows not derivable yet (count 0 -> the score is a FLOOR; together they could add up to ${score.maxExtra} pts): ${score.unknownRows.join(", ")}`);
    const acctLv = accountLevel(ctx);
    return rows.map((r) => T(
      `r${r.i}`,
      cleanName(r.name),
      "add",
      r.pts,
      !r.unlocked ? "computed" : r.known ? "computed" : "unknown",
      !r.unlocked
        ? `locked: needs account level ${tomeLvReq(r.pos)} (you have ${acctLv})`
        : r.known
          ? `qty ${Number.isInteger(r.qty) ? r.qty.toLocaleString() : r.qty?.toExponential?.(3) ?? r.qty} -> ${r.pts}/${r.max} pts`
          : `quantity not derivable yet (0/${r.max} pts counted)`,
    ));
  },
};

/** Convenience: the plain score result. */
export const computeTomeScore = (s, opts = {}) => evaluate(tomeScoreRecipe, s, opts);
