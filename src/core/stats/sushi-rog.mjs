/* stats/sushi-rog.mjs — recipe `sushiRoG`, the W7 Sushi Station "Rift of Gods" bonus track.
 *
 * One term per RoG reward slot (0..58): SushiStuff("RoG_BonusQTY",b,0) = UniqueSushi() > b ?
 * CustomLists.Research[37][b] : 0 — verbatim (bonuses/sushi.mjs owns the formula + UniqueSushi
 * counter; this recipe reuses that MECHANISM but reads coefficients from the COMPLETE 59-row
 * SUSHI_ROG_FULL table in gamedata-w7-sushi.mjs, not bonuses/sushi.mjs's partial 7-id SUSHI_ROG
 * — the 7 shared ids were cross-checked identical, see the gamedata header). This is why it is a
 * recipe, not entity-only: each slot is an independent account-wide multiplier tap that feeds a
 * different system (research EXP, drop rate, spelunking POW, class EXP, a Legend Talent point, ...),
 * exactly the winBonus / emperorBonus shape, so registering it as a recipe gives the per-slot
 * time-series + Stat Explorer surfacing for free.
 *
 * Every slot is a different downstream unit (}x multipliers, +% adds, flat grants), so there is no
 * meaningful total — the headline is the SUM of slot values as a monotonic progress index. Metric
 * keys stat.sushiRoG.rog0 .. rog58 — STABLE, never rename. Fully save-derivable (UniqueSushi from
 * Sushi[5]); no unknowns. */

import { T } from "./engine.mjs";
import { uniqueSushi } from "../bonuses/sushi.mjs";
import { SUSHI_ROG_FULL } from "../../gamedata/gamedata-w7-sushi.mjs";

const clean = (s) => String(s ?? "").replace(/[{}$}^~#]/g, "").replace(/_/g, " ").replace(/\s+/g, " ").trim();

export const DISPLAY = Object.fromEntries(SUSHI_ROG_FULL.map((r) => [
  `rog${r.id}`,
  { label: `RoG ${r.id}: ${clean(r.desc)}`,
    where: "W7 Sushi Station → unlock new sushi tiers (Rift of Gods)",
    how: `Unlocks once ${r.id + 1} sushi tiers are made (UniqueSushi > ${r.id}); then a flat ${r.coeff}.` },
]));

export const sushiRoG = {
  name: "sushiRoG",
  label: "Sushi Rift-of-Gods Bonuses",
  format: "points",
  display: DISPLAY,
  activeCharSensitive: () => false,
  combine: ({ pool }) => pool,   // headline = progress-index sum; per-slot values carry the meaning
  terms(ctx) {
    const u = uniqueSushi(ctx);
    return SUSHI_ROG_FULL.map((r) => {
      const v = u > r.id ? r.coeff : 0;
      return T(`rog${r.id}`, `SushiStuff("RoG_BonusQTY",${r.id},0)`, "add", v, "computed",
        `UniqueSushi=${u} ${u > r.id ? ">" : "<="} ${r.id} -> ${v}`);
    });
  },
};
