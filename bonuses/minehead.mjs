/* bonuses/minehead.mjs — _customBlock_Minehead: W7 minehead buttons.
 *
 * Minehead("Button_Bonuses",bucket,0): buckets OptLacc[594] presses into 9 buckets of 5 by
 * `floor(f/5) mod 9`, accumulating Button_BonusPerTime[bucket] * Button_BonusMULTI.
 * Button_BonusMULTI = (1+Companions(147)/100)*(1+Grid_Bonus(125,0)/100).
 * BUTTON_PER_TIME is the complete client table, so this is generic over every bucket. */

import { sel } from "../savemap.mjs";
import { companion } from "./companions.mjs";
import { gridBonus } from "./research.mjs";

/** Minehead Button_BonusPerTime table, verbatim: "2 3 2 2 4 5 4 25 5". */
export const BUTTON_PER_TIME = [2, 3, 2, 2, 4, 5, 4, 25, 5];
const MINEHEAD_COMPANION = 147, MINEHEAD_GRID_NODE = 125;

/** Minehead("BonusQTY",b,0) = Research[7][4] > b ? CustomLists.Research[20][b] : 0
 *  (N.js:18590). Values verified per-id: 8 = "+{_more_weekly_Exotic_Market_purchases..." = 2. */
export const MINEHEAD_QTY = { 8: 2 };
export function mineheadBonusQTY(ctx, b) {
  if (!(b in MINEHEAD_QTY)) throw new Error(`Minehead BonusQTY(${b}): Research[20][${b}] not verified in N.js — add to MINEHEAD_QTY first`);
  const tier = Number(((ctx.s.get("Research") ?? [])[7] ?? [])[4] ?? 0);
  const v = tier > b ? MINEHEAD_QTY[b] : 0;
  return { value: v, note: `Research[7][4]=${tier} ${tier > b ? ">" : "<="} ${b} -> ${v}` };
}

/** Button_Bonuses(bucket) as a fragment (a PERCENT). */
export function buttonBonus(ctx, bucket) {
  const presses = sel.mineheadButtonPresses(ctx.s);
  let hits = 0;
  for (let f = 0; f < presses; f++) if (Math.floor(f / 5) % 9 === bucket) hits++;
  const c147 = companion(ctx, MINEHEAD_COMPANION);
  if (c147.owned === null) ctx.unknown(`Companions(${MINEHEAD_COMPANION}) [inside Minehead Button_BonusMULTI] — needs the _comp RTDB doc`);
  // ResGridSquares[125] = "Better_Button", coeff 5 -> "All button bonuses are +{%_bigger".
  const grid = gridBonus(ctx, MINEHEAD_GRID_NODE).value;
  const multi = (1 + c147.value / 100) * (1 + grid / 100);
  return {
    value: hits * BUTTON_PER_TIME[bucket] * multi,
    status: c147.owned === null ? "partial" : "computed",
    note: `OptLacc[594]=${presses} presses -> ${hits} in bucket ${bucket} x ${BUTTON_PER_TIME[bucket]} x MULTI ${multi.toFixed(3)} ` +
      `(companion 147 = ${c147.owned === null ? "UNKNOWN" : c147.value}, Grid_Bonus(125,0)=${grid.toFixed(1)} Better_Button)`,
  };
}
