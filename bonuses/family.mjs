/* bonuses/family.mjs — FamBonusQTYs: the account "Family Bonus" builder.
 *
 * Client (the DNSM builder, d==-3 branch, N.js:6186-6192), verbatim:
 *   FamBonusQTYs = {}
 *   for each character t in PlayerDATABASE:
 *     level = t.Lv0[0]
 *     for each classId in ReturnClasses(t.CharacterClass):        // the class's whole lineage
 *       for slot in 0..1:
 *         v = FamilyBonsuesREAL(classId, slot, level)
 *         key = "" + round(2*classId + slot)
 *         if v > FamBonusQTYs[key]:  FamBonusQTYs[key] = v         // keep the MAX across chars
 * (The talent-144 "Family Guy" amplifier the client layers onto keys "24"/"44" is NOT applied
 *  here — it does not touch the keys this module is asked for, e.g. "68"/"66".)
 *
 * FamilyBonsuesREAL(d, b, e) (_customBlock_FamilyBonsuesREAL, N.js:9858):
 *   row = ClassFamilyBonuses[d]; lv = max(0, round(e - ClassAccountBonus[d][1]))
 *   b==0: ArbitraryCode5Inputs(row[3], row[1], row[2], lv)
 *   b==1: ArbitraryCode5Inputs(row[6], row[4], row[5], lv)
 *
 * ReturnClasses(d) (_customBlock_ReturnClasses, N.js:5544) reconstructs a character's class
 * lineage (base subclass -> evolutions) so every character contributes to all its ancestor
 * classes. Both static tables are transcribed verbatim (space-split strings, exactly as the
 * client stores them). Key "68" = class 34 "+{_LV_FOR_ALL|TALENTS_ABOVE_LV_1" (used by AllTalentLV);
 * key "66" = class 33 golden-food amplifier (used by GoldFoodBonuses). */

import { sel } from "../savemap.mjs";
import { arbitraryCode5 } from "./util.mjs";

/** CustomLists.ClassFamilyBonuses — na.ClassFamilyBonuses() @N.js:23132, verbatim. Columns:
 *  [0]name [1]b [2]c [3]mode (slot 0) [4]b2 [5]c2 [6]mode2 (slot 1). "txt"/"_" -> curve returns 0. */
export const CLASS_FAMILY_BONUSES = [
  "NO_FAMILY_BONUS _ _ txt _ _ txt", "NO_FAMILY_BONUS 0 0 add _ _ txt",
  "+{_TOTAL_LUK 1 5 intervalAdd _ _ txt", "+{%_PRINTER|SAMPLE_SIZE 6 100 decay _ _ txt",
  "+{%_FIGHTING|AFK_GAINS 5 250 decay _ _ txt", "INFINILYTE 1 0 add _ _ txt",
  "NO_FAMILY_BONUS 5 250 decay _ _ txt", "+{_TOTAL_STR 1 5 intervalAdd _ _ txt",
  "+{_WEAPON_POWER 25 100 decay _ _ txt", "+{%_TOTAL_HP 40 100 decay _ _ txt",
  "+{%_TOTAL_DAMAGE 20 180 decay _ _ txt", "NOPE _ _ txt _ _ txt",
  "+{%_Refinery_Speed 50 150 decay _ _ txt", "NOPE _ _ txt _ _ txt",
  "+{%_KILL_PER_KILL 60 800 decay _ _ txt", "FILLER _ _ txt _ _ txt",
  "ROYAL_GUARDIAN _ _ txt _ _ txt", "FILLER _ _ txt _ _ txt",
  "NO_FAMILY_BONUS 0 0 add _ _ txt", "+{_TOTAL_AGI 1 5 intervalAdd _ _ txt",
  "+{%_EXP_WHEN_FIGHT|MONSTERS_ACTIVELY 38 100 decay _ _ txt", "+{%_EFFICIENCY|FOR_ALL_SKILLS 30 100 decay _ _ txt",
  "+{%_FASTER_MINIMUM|BOAT_TRAVEL_TIME 20 170 decay _ _ txt", "MAYHEIM 25 100 decay _ _ txt",
  "WIND_WALKER 25 100 decay _ _ txt", "+{%_ALL_SKILL|AFK_GAINS 5 180 decay _ _ txt",
  "FILLER _ _ txt _ _ txt", "FILLER _ _ txt _ _ txt", "FILLER _ _ txt _ _ txt",
  "{千_COINS|FROM_MOBS 1.4 800 decayMulti _ _ txt", "NO_FAMILY_BONUS 0 0 add _ _ txt",
  "+{_TOTAL_WIS 1 5 intervalAdd _ _ txt", "+{_STAR_TAB|TALENT_POINTS 1 6 intervalAdd _ _ txt",
  "{千@HIGHER_BONUSES|FROM_GOLDEN_FOODS 0.4 100 decayMulti _ _ txt", // 33 -> key "66"
  "+{_LV_FOR_ALL|TALENTS_ABOVE_LV_1 20 350 decay _ _ txt",              // 34 -> key "68"
  "SPIRITUAL_MONK 25 100 decay _ _ txt", "+{%_ALL_STAT.|STR,_AGI,_WIS,_LUK. 5 180 decay _ _ txt",
  "FILLER 25 100 decay _ _ txt", "FILLER _ _ txt _ _ txt", "FILLER _ _ txt _ _ txt",
  "+{%_TOTAL_DMG|MULTIPLIER 12 800 decay _ _ txt", "FILLER _ _ txt _ _ txt",
].map((r) => r.split(" "));

/** CustomLists.ClassAccountBonus — na.ClassAccountBonus() @N.js:23137. [d][1] = the class's START
 *  LEVEL (the level below which the family bonus is 0). Verbatim. */
export const CLASS_ACCOUNT_BONUS = [
  ["Z", "0"], ["_Base_Damage", "0"], ["%_Rare_Drop_Chance", "9"],
  ["%_Exp_Gained|Instantly_After_Leveling_Up_a_skill", "29"], ["%_bonus_exp|gain_for_all_skills", "69"],
  ["%_bonus_exp|gain_for_Class_level", "129"], ["RAGE_BASICS", "0"], ["WARRIOR", "9"],
  ["BARBARIAN", "29"], ["SQUIRE", "29"], ["BLOOD_BERSERKER", "69"], ["DEATH_BRINGER", "69"],
  ["DIVINE_KNIGHT", "69"], ["ROYAL_GUARDIAN", "69"], ["FILLER", "129"], ["FILLER", "129"],
  ["FILLER", "129"], ["FILLER", "129"], ["CALM_BASICS", "0"], ["ARCHER", "9"], ["BOWMAN", "29"],
  ["HUNTER", "29"], ["SIEGE_BREAKER", "69"], ["MAYHEIM", "69"], ["WIND_WALKER", "69"],
  ["BEAST_MASTER", "69"], ["FILLER", "129"], ["FILLER", "129"], ["FILLER", "129"], ["FILLER", "129"],
  ["SAVVY_BASICS", "0"], ["WIZARD", "9"], ["FILLER", "29"], ["FILLER", "29"], ["FILLER", "69"],
  ["FILLER", "69"], ["FILLER", "69"], ["FILLER", "69"], ["FILLER", "129"], ["FILLER", "129"],
  ["FILLER", "129"], ["FILLER", "129"],
];

/** ReturnClasses(d) — the class lineage list, verbatim from N.js:5544. */
export function returnClasses(d) {
  const list = [];
  if (d < 6) {
    for (let e = 0; e < d; e++) list.push(e + 1);
  } else {
    const N = (d - 6) - 12 * Math.floor((d - 6) / 12);
    const base = 6 + 12 * Math.floor((d - 6) / 12);
    if (N > 7) {
      list.push(base);
      list.push(base + Math.ceil(N / 12));
      list.push(base + Math.ceil((N - 5) / 2));
      list.push(base + (N - 4));
    } else if (N > 3) {
      list.push(base);
      list.push(base + Math.ceil(N / 12));
      list.push(base + Math.ceil((N - 1) / 2));
    } else if (N > 1) {
      list.push(base);
      list.push(base + Math.ceil(N / 12));
    } else if (N > 0) {
      list.push(base);
    }
  }
  list.push(d);
  return list;
}

/** FamilyBonsuesREAL(d, slot, level). Returns a number (0 for txt/filler rows). */
export function familyBonusReal(classId, slot, level) {
  const row = CLASS_FAMILY_BONUSES[classId];
  if (!row) return 0;
  const startLv = Number(CLASS_ACCOUNT_BONUS[classId]?.[1] ?? 0);
  const lv = Math.max(0, Math.round(level - startLv));
  const mode = slot === 0 ? row[3] : row[6];
  const b = Number(slot === 0 ? row[1] : row[4]);
  const c = Number(slot === 0 ? row[2] : row[5]);
  const v = arbitraryCode5(mode, b, c, lv);
  return Number.isFinite(v) ? v : 0;
}

/** Build the whole FamBonusQTYs map (max across every character's class lineage). Cached on ctx. */
export function famBonusQTYs(ctx) {
  if (ctx._famBonusQTYs) return ctx._famBonusQTYs;
  const map = {};
  for (const i of ctx.s.charIdxs) {
    const level = sel.charLevel(ctx.s, i);
    const cls = sel.characterClass(ctx.s, i);
    for (const classId of returnClasses(cls)) {
      for (let slot = 0; slot < 2; slot++) {
        const v = familyBonusReal(classId, slot, level);
        const key = String(Math.round(2 * classId + slot));
        if (v > (map[key] ?? 0)) map[key] = v;
      }
    }
  }
  ctx._famBonusQTYs = map;
  return map;
}

/** FamBonusQTYs[key] as a fragment. key is the string id the client uses, e.g. "68". */
export function famBonus(ctx, key) {
  const map = famBonusQTYs(ctx);
  const value = map[String(key)] ?? 0;
  const classId = Math.floor(Number(key) / 2), slot = Number(key) % 2;
  const name = CLASS_FAMILY_BONUSES[classId]?.[0] ?? "?";
  return { value, status: "computed", note: `FamBonusQTYs["${key}"] = class ${classId} slot ${slot} (${name}) -> ${value.toFixed(2)} (max across characters)` };
}
