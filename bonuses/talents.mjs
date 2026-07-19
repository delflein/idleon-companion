/* bonuses/talents.mjs — GetTalentNumber(1,id): per-character talent bonuses.
 *
 * Client (_customBlock_GetTalentNumber, overworld d==1 branch):
 *   SkillLevels[id] <= 0 ? 0
 *   : ArbitraryCode5Inputs(TalentDescriptions[id][1][2],   // mode   (curve 1)
 *                          TalentDescriptions[id][1][0],   // b
 *                          TalentDescriptions[id][1][1],   // c
 *                          AllTalentLV(id) + SkillLevels[id])
 * SkillLevels is the ACTIVE character's talent map, saved per char as SL_N (sparse
 * talentId -> level). Curve rows verified per-id in TALENT_CURVES.
 *
 * AllTalentLV(id) — bonus levels added to every non-banned leveled talent. Banned:
 * 49<=id<=59, {149,374,539,505}, id>614 (verbatim TalentBannedforAllLV). The stack:
 *   super:    is id in Spelunk[20 + charIdx + 12*PlayerStuff[1]] (that char's ACTIVE super
 *             talent list)? -> SuperTalentPTS_LVgiven = round(50 + LegendPTS_bonus(7)
 *             + ZenithMarketBonus(5)), ZenithMarketBonus(5) = floor(1 * Spelunk[45][5])
 *   symbols:  GetTalentNumber(1,149)+(1,374)+(1,539) — Symbols of Beyond, intervalAdd(1,20);
 *             all three are banned from AllTalentLV so their own level is raw SL (no cycle)
 *   + AchieveStatus(291) + floor(FamBonusQTYs["68"]) + Companions(1)
 *   + ceil(Divinity("Bonus_Minor",charIdx,2)) + Dream[12] + 5*floor((97+OptLacc[232])/100)
 *   + GrimoireUpgBonus(39) + GetSetBonus("KATTLEKRUK_SET") + min(5, ArcaneUpgBonus(57))
 *   + max(0, floor((Lv0[0]-500)/100 * SuperBitType(47)))
 * FamBonusQTYs["68"] (bonuses/family.mjs) and the Divinity minor link (bonuses/divinity.mjs,
 * Bonus_Minor type 2) are now computed. The divinity minor bonus omits two >=1 multipliers
 * (Y2ACTIVE bubble + CoralKid upgrade), so it is a LOWER BOUND and keeps allTalentLv "partial";
 * everything else is live. */

import { sel } from "../savemap.mjs";
import { arbitraryCode5 } from "./util.mjs";
import { legendPts } from "./thingies.mjs";
import { zenithMarketBonusNum } from "./zenith.mjs";
import { companion } from "./companions.mjs";
import { grimoireUpgBonus } from "./summoning.mjs";
import { arcaneUpgBonus } from "./arcane.mjs";
import { setBonus, achieveStatus } from "./misc.mjs";
import { superBitType } from "./gaming.mjs";
import { famBonus } from "./family.mjs";
import { divinityMinorBonus } from "./divinity.mjs";

/** TalentDescriptions[id][1] curve-1 rows, verified per-id (bracket-scanned, not regexed). */
export const TALENT_CURVES = {
  24:  { mode: "decay", b: 70, c: 100, name: "Curse of Mr Looty Booty" },
  149: { mode: "intervalAdd", b: 1, c: 20, name: "Symbols of Beyond (W3)" },
  279: { mode: "decay", b: 40, c: 65, name: "Robbinghood" },
  374: { mode: "intervalAdd", b: 1, c: 20, name: "Symbols of Beyond (W4)" },
  539: { mode: "intervalAdd", b: 1, c: 20, name: "Symbols of Beyond (W5)" },
  655: { mode: "decay", b: 25, c: 100, name: "Weekly Battles Drop Rate" },
  /* Death Bringer farming talents (TalentDescriptions rows @N.js:23188, names @23144): */
  205: { mode: "decayMulti", b: 50, c: 300, name: "Mass Irrigation" },
  206: { mode: "add", b: 2, c: 0, name: "Agricultural 'Preciation" },
  207: { mode: "decayMulti", b: 2, c: 200, name: "Dank Ranks" },
  /* W1 skill-efficiency talents (TalentDescriptions[id][1] curve strings extracted verbatim from
   * the na.TalentDescriptions() literal @N.js:23145, cross-checked by each row's stat text):
   *   85  "Brute Efficiency"   "+{%_Efficiency" (all specialized skills)          -> "1 .02 add"
   *   101 "Copper Collector"   "+{%_efficiency" (Mining, per power of 10 copper)  -> "20 70 decay"
   *   103 "Tool Proficiency"   "+{%_POW_per_10_Mining_Lv" (pickaxe Mining Power)  -> "16 40 decay"
   *   142 "Skill Strengthen"   "+{%_impact_&_}_STR" (STR impact on Skill Eff)     -> "60 80 decay"
   *   445 "Brute Efficiency"   Choppin equivalent of 85                           -> "1 .02 add"
   *   461 "Leaf Collector"     "+{%_efficiency" (Choppin, per power of 10 leaves) -> "25 70 decay"
   *   462 "Woodsman"           "+{%_Effect" (WIS impact on Choppin Eff)           -> "0.75 0 add"
   *   532 "Skill Strengthen"   WIS twin of 142                                    -> "60 80 decay"
   *   617 "Studious Quester"   "+0.10%_All_Skill_Eff per completed quest"         -> "0.40 0 add"
   *   636 "Supersource"        "+{_Base_Efficiency for Mining/Choppin/Fish/Catch" -> "250 100 decay"
   *   646 (Wind Walker)        "+{%_Efficiency_for_all_Skills"                    -> "50 100 decay" */
  85:  { mode: "add",   b: 1,  c: 0.02, name: "Brute Efficiency" },
  101: { mode: "decay", b: 20, c: 70,   name: "Copper Collector" },
  103: { mode: "decay", b: 16, c: 40,   name: "Tool Proficiency" },
  142: { mode: "decay", b: 60, c: 80,   name: "Skill Strengthen (STR)" },
  445: { mode: "add",   b: 1,  c: 0.02, name: "Brute Efficiency (Choppin)" },
  461: { mode: "decay", b: 25, c: 70,   name: "Leaf Collector" },
  462: { mode: "add",   b: 0.75, c: 0,  name: "Woodsman (WIS effect)" },
  532: { mode: "decay", b: 60, c: 80,   name: "Skill Strengthen (WIS)" },
  617: { mode: "add",   b: 0.40, c: 0,  name: "Studious Quester" },
  636: { mode: "decay", b: 250, c: 100, name: "Supersource" },
  646: { mode: "decay", b: 50, c: 100,  name: "Efficiency for all Skills" },
};

export const talentBanned = (id) => (id >= 49 && id <= 59) || [149, 374, 539, 505].includes(id) || id > 614;

/** Raw saved level of a talent for one character (SL_N sparse map). */
export const rawTalentLv = (s, charIdx, id) => Number((s.at("SL_N", charIdx) ?? {})[id] ?? 0);

/** SuperTalentPTS_LVgiven = round(50 + LegendPTS_bonus(7) + ZenithMarketBonus(5)). */
function superTalentLvGiven(ctx) {
  // ZenithMarketBonus(5) = floor(coeff(SUPER_DUPERS=1) * Spelunk[45][5]) — routed through the
  // decoded evaluator (bonuses/zenith.mjs); numerically identical to the prior inline floor read.
  const zenith5 = zenithMarketBonusNum(ctx, 5);
  return Math.round(50 + legendPts(ctx, 7) + zenith5);
}

/** AllTalentLV(id) for the ctx's active character. Returns { value, missing } where
 *  `missing` lists the unread sources (family bonus, divinity) — callers report partial. */
export function allTalentLv(ctx, id) {
  if (talentBanned(id)) return { value: 0, missing: [] };
  const s = ctx.s, ch = ctx.activeChar;
  const superList = (s.get("Spelunk") ?? [])[20 + ch + 12 * Number((s.at("PlayerStuff_N", ch) ?? [])[1] ?? 0)] ?? [];
  const superLv = superList.includes(id) ? superTalentLvGiven(ctx) : 0;
  const symbols = [149, 374, 539].reduce((a, sid) => a + getTalentNumber(ctx, sid).value, 0);
  const dream12 = Number((s.get("Dream") ?? [])[12] ?? 0);
  const opt232 = 5 * Math.floor((97 + Number((s.get("OptLacc") ?? [])[232] ?? 0)) / 100);
  const kruk = setBonus(ctx, "KATTLEKRUK_SET").value;
  const arcane = Math.min(5, arcaneUpgBonus(ctx, 57));
  const bit47 = superBitType(ctx, 47) ?? 0;
  const levelBit = Math.max(0, Math.floor((Number((s.at("Lv0_N", ch) ?? [])[0] ?? 0) - 500) / 100 * bit47));
  /* floor(FamBonusQTYs["68"]) + ceil(Divinity("Bonus_Minor",charIdx,2)) — now computed. The
   * divinity minor bonus omits two >=1 multipliers (Y2ACTIVE bubble + CoralKid), so it is a lower
   * bound and keeps allTalentLv "partial". FamBonusQTYs["68"] is exact. */
  const fam68 = Math.floor(famBonus(ctx, "68").value);
  const divMinor = divinityMinorBonus(ctx, ch, 2);
  const divTalent = Math.ceil(divMinor.value);
  const value = superLv + symbols + achieveStatus(ctx, 291) + companion(ctx, 1).value + dream12 + opt232
    + grimoireUpgBonus(ctx, 39) + kruk + arcane + levelBit + fam68 + divTalent;
  const missing = divMinor.status === "partial"
    ? ["Divinity Bonus_Minor is a LOWER BOUND (Y2ACTIVE bubble + CoralKid upgrade multipliers not read)"]
    : [];
  return { value, missing };
}

/** getbonus2(1,id,-1) — the e==-1 arm (N.js:12575): evaluates the talent for EVERY character
 *  and returns the MAXIMUM. Account-wide by construction (no activeChar needed). */
export function bestTalentAcrossChars(ctx, id) {
  let best = null;
  for (const i of ctx.s.charIdxs) {
    const r = getTalentNumber({ ...ctx, activeChar: i }, id);
    if (r && (best === null || r.value > best.value)) best = { ...r, charIdx: i };
  }
  if (!best) return { value: 0, status: "computed", note: "no characters" };
  return { ...best, note: `best across chars (char ${best.charIdx}): ${best.note}` };
}

/** GetTalentNumber(1,id) for the ctx's active character.
 *  Returns { value, status, note } — or null when ctx.activeChar is null (per-char data). */
export function getTalentNumber(ctx, id) {
  const row = TALENT_CURVES[id];
  if (!row) throw new Error(`GetTalentNumber(1,${id}): TalentDescriptions[${id}][1] not verified in N.js — add to TALENT_CURVES first`);
  if (ctx.activeChar == null) return null;
  const raw = rawTalentLv(ctx.s, ctx.activeChar, id);
  if (raw <= 0) return { value: 0, status: "computed", note: `${row.name}: not leveled on character ${ctx.activeChar}` };
  const bonus = allTalentLv(ctx, id);
  const lv = raw + bonus.value;
  return {
    value: arbitraryCode5(row.mode, row.b, row.c, lv),
    status: bonus.missing.length ? "partial" : "computed",
    note: `${row.name}: SL=${raw} + AllTalentLV ${bonus.value} -> lv ${lv}, ${row.mode}(${row.b},${row.c})` +
      (bonus.missing.length ? `; missing: ${bonus.missing.join("; ")}` : ""),
  };
}
