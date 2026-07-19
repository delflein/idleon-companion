/* stats/legend-talents.mjs — recipe `legendTalents`, the W7 Legend Talent tree (account-wide).
 *
 * Surfaces every REAL Legend Talent (ids 0-39; the client's Ya.LegendTalents() rows 40-49 are
 * literal "filler" and are OMITTED — see gamedata-w7-legend.mjs). Each term is one talent's
 * accumulated bonus, Thingies("LegendPTS_bonus",b,0) = round(Spelunk[18][b] * LegendTalents[b][2])
 * — verbatim from N.js. Every talent's bonus is a DIFFERENT downstream unit (drop rate %, statue
 * drops, refinery speed, ...), so there is no single meaningful total: the headline is the plain
 * SUM of the per-talent values as a monotonic progress index (same pattern as winBonus /
 * emperorBonus), and the useful data is the per-term breakdown (metric keys
 * stat.legendTalents.t0 .. t39 — STABLE ids, never rename).
 *
 * Uses the FULL 40-row coefficient table (gamedata-w7-legend.mjs::legendPtsBonus) rather than
 * bonuses/thingies.mjs::legendPts, which table-guards to only the ~10 ids other recipes consume.
 * Those ~10 consumer talents are flagged `knownConsumer` in DISPLAY (they feed drop-rate, class-XP,
 * kruk-bubbles, refinery, cards, meritocracy, land-rank, etc. — high-value to keep leveled).
 *
 * POINTS ECONOMY — the recipe does NOT sum talent bonuses with the points economy (different
 * unit); earned/spent/available come from bonuses/thingies.mjs::legendPtsOwned()/legendPtsSpent()
 * (LegendPTS_owned / LegendPTS_spent, verbatim) and are surfaced on e.w7.legendTalents.points
 * (domain.mjs), not as recipe terms. legendPoints() below is the shared helper for that. */

import { T } from "./engine.mjs";
import { sel } from "../savemap.mjs";
import { LEGEND_TALENTS, legendPtsBonus } from "../gamedata-w7-legend.mjs";
import { LEGEND_TALENT_COEFF } from "../gamedata.mjs";
import { legendPtsOwned, legendPtsSpent } from "../bonuses/thingies.mjs";

const clean = (s) => String(s ?? "").replace(/[{}$}^~#]/g, "").replace(/_/g, " ").replace(/\s+/g, " ").trim();
const CONSUMERS = new Set(Object.keys(LEGEND_TALENT_COEFF).map(Number));

export const DISPLAY = Object.fromEntries(LEGEND_TALENTS.map((r) => [
  `t${r.id}`,
  { label: `${clean(r.name)}${CONSUMERS.has(r.id) ? " ★" : ""}: ${clean(r.short)}`,
    where: "W7 Legend Talents (spend Legend Talent PTS)",
    how: `round(level × ${r.coeff}); max base LV ${r.maxLvBase}.` +
      (CONSUMERS.has(r.id) ? " ★ Known input to another stat recipe — high value." : ""),
    flag: CONSUMERS.has(r.id) ? "consumer" : undefined },
]));

/** Shared points-economy helper: {earned, spent, available, lowerBound, note}. */
export function legendPoints(ctx) {
  const owned = legendPtsOwned(ctx);
  const spent = legendPtsSpent(ctx);
  return {
    earned: owned.value, spent, available: owned.value - spent,
    lowerBound: owned.status !== "computed", note: owned.note, parts: owned.parts,
  };
}

export const legendTalents = {
  name: "legendTalents",
  label: "Legend Talents",
  format: "points",
  display: DISPLAY,
  activeCharSensitive: () => false,
  combine: ({ pool }) => pool,   // headline = progress-index sum; per-term values carry the meaning
  terms(ctx) {
    const levels = sel.legendTalentLevels(ctx.s);
    return LEGEND_TALENTS.map((r) => {
      const lv = Number(levels[r.id] ?? 0);
      const v = legendPtsBonus(r.id, lv);
      return T(`t${r.id}`, `Thingies("LegendPTS_bonus",${r.id},0)`, "add", v, "computed",
        `${clean(r.name)} lv ${lv} × ${r.coeff} = ${v}${CONSUMERS.has(r.id) ? " (known consumer)" : ""}`);
    });
  },
};
