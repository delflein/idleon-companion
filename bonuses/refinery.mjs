/* bonuses/refinery.mjs — Refinery + Salt Lick dispatchers (World 3).
 *
 * SaltLick(d) — p._customBlock_SaltLick(d), N.js:12281, verbatim:
 *   SaltLick[d] > 0 ? SaltLick[d] * SaltLicks[d][3] : 0
 * where SaltLick[d] is the player's LEVEL of Salt Lick bonus d (save array, sel.saltLickLevels)
 * and SaltLicks[d][3] is the per-level bonus coefficient (SALT_LICK_UPGRADES[d].perLevelBonus,
 * gamedata-w3-refinery.mjs). Fully derivable from the save — a plain PERCENT (or flat, per row).
 *
 * ConstMasteryBonus(0,0) — WorkbenchStuff("ConstMasteryBonus",...), N.js:12230+: gated on
 *   40 > Rift[0]  ->  0  (the Construction Mastery feature unlocks at Rift 40). Past the gate the
 * payout also needs a runtime PixelHelperActor read (`113 > ...behaviors...`), so beyond the gate
 * it is NOT derivable from the save -> unknown. We give the exact 0 below the gate and an honest
 * unknown above it (never a guess). */

import { sel } from "../savemap.mjs";
import { SALT_LICK_UPGRADES } from "../gamedata-w3-refinery.mjs";

/** SaltLick(d) as a fragment (PERCENT or flat, per the row's effect text). */
export function saltLick(ctx, d) {
  const row = SALT_LICK_UPGRADES[d];
  if (!row) throw new Error(`SaltLick(${d}): SALT_LICK_UPGRADES[${d}] not in gamedata-w3-refinery.mjs`);
  const lv = Number(sel.saltLickLevels(ctx.s)[d] ?? 0);
  if (!(lv > 0)) return { value: 0, status: "computed", note: `Salt Lick ${d} (${row.displayNameToolbox}): level 0` };
  return {
    value: lv * row.perLevelBonus, status: "computed",
    note: `Salt Lick ${d} (${row.displayNameToolbox}): lv ${lv} x ${row.perLevelBonus} = ${(lv * row.perLevelBonus).toFixed(2)}`,
  };
}

/** WorkbenchStuff("ConstMasteryBonus", b, 0) — the Construction Mastery (Rift-40) bonus.
 *  Below Rift 40 the exact value is 0; at/above 40 it needs runtime state (unknown). */
export function constMasteryBonus(ctx, b) {
  const rift = sel.riftLevel(ctx.s);
  if (rift < 40) return { value: 0, status: "computed", note: `Construction Mastery: Rift ${rift} < 40 -> not unlocked -> 0 (exact)` };
  ctx.unknown(`WorkbenchStuff("ConstMasteryBonus",${b},0) — unlocked (Rift ${rift} >= 40) but the payout needs runtime PixelHelperActor state; not derivable from the save -> 0 (lower bound)`);
  return { value: 0, status: "unknown", note: `Construction Mastery unlocked (Rift ${rift}) but runtime-only -> lower bound` };
}
