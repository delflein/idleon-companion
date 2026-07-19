/* bonuses/coralreef.mjs — Thingies("CoralKidUpgBonus",b,0), the W7 Coral Reef upgrade track that
 * boosts several Divinity arms. Fully resolved: CoralKidUpgBonus is a pure function of its own
 * upgrade level (OptionsListAccount[427+b]) with NO unread inputs — see gamedata-w7-coralreef.mjs.
 *
 * This closes the lower-bound omissions in bonuses/divinity.mjs (arm 3, minor-link bonus) and
 * bonuses/talents.mjs::allTalentLv (which inherits it), plus divinity blessing-max/PTS arms. */

import { sel } from "../savemap.mjs";
import { CORAL_KID, coralKidUpgBonus } from "../../gamedata/gamedata-w7-coralreef.mjs";

/** Thingies("CoralKidUpgBonus",b,0) as a fragment (a PERCENT for b in {0,1,3,4}; a multiplier-%
 *  for the saturating rows b in {2,5}). Level = OptLacc[427+b]. No unknowns — fully computed. */
export function coralKidUpgradeBonus(ctx, b) {
  if (!CORAL_KID[b]) throw new Error(`CoralKidUpgBonus(${b}): no CORAL_KID row (0..5)`);
  const level = sel.coralKidLevel(ctx.s, b);
  const value = coralKidUpgBonus(b, level);
  return { value, status: "computed", note: `CoralReef upgrade ${b} lv ${level} -> ${value.toFixed(2)}` };
}
