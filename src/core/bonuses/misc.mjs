/* bonuses/misc.mjs — small account-wide dispatchers: bribes, Killroy, equipment sets,
 * Fractal Island flags, Purple Chest Slug. */

import { sel } from "../savemap.mjs";
import { SET_BONUS_VAL, NUMBER_2_LETTER } from "../../gamedata/gamedata.mjs";
import { letterFlag } from "./util.mjs";

/** GetBribeBonus(id) = BribeStatus[id]==1 ? BribeDescriptions[id][5] : 0.
 *  Verified ids only: 34 "Artifact_Pilfering" field[5] = 20. */
export const BRIBE_PCT = { 34: 20 };
export function bribeBonus(ctx, id) {
  if (!(id in BRIBE_PCT)) throw new Error(`GetBribeBonus(${id}): BribeDescriptions[${id}][5] not verified in N.js — add to BRIBE_PCT first`);
  const owned = sel.bribeStatus(ctx.s)[id] === 1;
  return { value: owned ? BRIBE_PCT[id] : 0, note: owned ? "bribe owned" : "bribe not bought" };
}

/** Summoning("EventShopOwned",b,0) = OptLacc[311].indexOf(Number2Letter[b]) != -1 ? 1 : 0.
 *  null for ids >= 53 (Number2Letter unrecoverable) — unknown, not "not owned".
 *  (Lives here rather than summoning.mjs so lower-level modules can use it cycle-free.) */
export function eventShopOwned(ctx, b) {
  return letterFlag((ctx.s.get("OptLacc") ?? [])[311], b);
}

/** _customBlock_AchieveStatus(c): achievement done (AchieveReg[c] === -1) pays a value —
 *  1 for most, with verbatim special cases paying 5/10/20. Not done pays 0. */
export const achieveStatus = (ctx, c) => (sel.achieveReg(ctx.s)[c] === -1
  ? ([4, 27, 37, 44, 107, 109, 117].includes(c) ? 5 : c === 108 ? 10 : [99, 104, 112].includes(c) ? 20 : 1) : 0);

/** RandomEvent("KillroyBonuses",b,0), verbatim (N.js ~17851):
 *    b==0 -> 1 + OptLacc[228]/(300+OptLacc[228])         (artifact find)
 *    b==1 -> 1 + 9*OptLacc[229]/(300+OptLacc[229])       (crop evolution multi, caps at x10)
 *  The OptLacc slots are Killroy-shop purchase counters. */
export function killroyBonus(ctx, b = 0) {
  if (b === 0) {
    const x = sel.killroyStat(ctx.s);
    return { value: 1 + x / (300 + x), note: `OptLacc[228]=${x}` };
  }
  if (b === 1) {
    const x = Number((ctx.s.get("OptLacc") ?? [])[229] ?? 0);
    return { value: 1 + 9 * (x / (300 + x)), note: `OptLacc[229]=${x} -> x${(1 + 9 * (x / (300 + x))).toFixed(3)} (caps at x10)` };
  }
  throw new Error(`KillroyBonuses(${b}): formula not verified in N.js — only 0 and 1 are`);
}

/** GetSetBonus(name,"Bonus",0,0). N.js _customBlock_GetSetBonus, "Bonus"==b branch:
 *    if (OptLacc[379].split(",") contains name)        -> EquipmentSets[name][3][2]
 *    else if (PartsOn(name) >= PartsReq(name))         -> EquipmentSets[name][3][2]
 *    else                                              -> 0
 *  The FIRST arm is the important one: OptLacc[379] is the list of PERMANENTLY unlocked sets,
 *  and a set in it pays out with nothing equipped — no active-character gear needed. Only if
 *  the set is not perma-unlocked do we need EquipOrder_N, and then we say so rather than guess. */
export function setBonus(ctx, name) {
  if (!(name in SET_BONUS_VAL)) throw new Error(`GetSetBonus(${name}): EquipmentSets[${name}][3][2] not verified in N.js — add to SET_BONUS_VAL first`);
  if (sel.setsPermaUnlocked(ctx.s).has(name))
    return { value: SET_BONUS_VAL[name], known: true, why: `${name} is perma-unlocked in OptLacc[379] -> bonus applies with no pieces equipped` };
  return { value: 0, known: false, why: `${name} not in OptLacc[379]; would need the active character's EquipOrder_N to count pieces` };
}

/** RandomEvent("FractalIslandBonus",b) reads DNSM.FracIsBn[b], built as
 *    for (f in 0..GenINFO[25].length) FracIsBn.push(OptLacc[184] >= GenINFO[25][f] ? 1 : 0)
 *  so it is a 0/1 FLAG, not a magnitude. Thresholds pushed literally right above it; the sibling
 *  GenINFO[24] descriptions confirm indices (e.g. [3] = "1.20x_Chance_to_find_Sailing_Artifacts"). */
export const FRACTAL_THRESHOLDS = [24, 200, 750, 2500, 1e4, 2e4, 4e4, 6e4];
export function fractalIslandBonus(ctx, idx) {
  const pts = sel.fractalIslandPts(ctx.s);
  const need = FRACTAL_THRESHOLDS[idx];
  const on = pts >= need ? 1 : 0;
  return { value: on, note: `OptLacc[184]=${pts} vs threshold ${need} -> flag ${on}` };
}

/** Stuff2("PurpleChestSlugsOwned") = round(Summoning("EventShopOwned",48,0)) — a FLAG, not a
 *  count: the exponent in max(1, 1.5^n) can only ever be 0 or 1, capping the term at 1.5x.
 *  (The community claim that it stacks / is uncapped is wrong: the client cannot express > 1.) */
const PURPLE_SLUG_SHOP_IDX = 48;
export function purpleChestSlugsOwned(ctx) {
  const owned = letterFlag((ctx.s.get("OptLacc") ?? [])[311], PURPLE_SLUG_SHOP_IDX);
  return { value: owned ?? 0, note: `OptLacc[311] ${owned ? "contains" : "lacks"} "${NUMBER_2_LETTER[PURPLE_SLUG_SHOP_IDX]}"` };
}
