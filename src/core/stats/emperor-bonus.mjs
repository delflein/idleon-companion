/* stats/emperor-bonus.mjs — recipe `emperorBonus`, the 12 accumulated Emperor bonus categories.
 * Thin report over bonuses/thingies.mjs::emperorBon(): each Emperor showdown win walks a 48-slot
 * cycle (EMPEROR_BON_CYCLE) accumulating per-category values (EMPEROR_BON_VAL), then the total is
 * scaled by (1 + (ArcaneUpgBonus(48)+ArcadeBonus(51))/100). 12 categories named from
 * EMPEROR_BON_NAMES (gamedata.mjs / gamedata-w6-emperor.mjs, RE-VERIFIED verbatim).
 *
 * Each category is a distinct downstream bonus (some ×-multipliers, some +%/flat — the client text
 * carries the marker); the headline is their SUM as a progress index. Metric keys
 * stat.emperorBonus.cat0 .. cat11 — STABLE. Fully save-derivable (OptLacc[369] wins). */

import { T } from "./engine.mjs";
import { emperorBon } from "../bonuses/thingies.mjs";
import { EMPEROR_BON_NAMES } from "../../gamedata/gamedata.mjs";

const num = (x) => Number(x) || 0;

export const DISPLAY = Object.fromEntries(EMPEROR_BON_NAMES.map((nm, i) => [
  `cat${i}`,
  { label: `Category ${i}: ${nm.replace(/[{}$]/g, "").replace(/_/g, " ").trim()}`,
    where: "W6 Emperor → win showdowns",
    how: `Accumulates ${nm.startsWith("}") ? "as a ×-multiplier" : "additively"} each showdown win (48-slot cycle).` },
]));

export const emperorBonus = {
  name: "emperorBonus",
  label: "Emperor Bonuses (12 categories)",
  format: "points",
  display: DISPLAY,
  combine: ({ pool }) => pool,
  terms(ctx) {
    return EMPEROR_BON_NAMES.map((nm, i) => {
      const v = num(emperorBon(ctx, i));
      return T(`cat${i}`, `Thingies("EmperorBon",${i},0)`, "add", v, "computed",
        `${nm.replace(/_/g, " ")} = ${v}`);
    });
  },
};
