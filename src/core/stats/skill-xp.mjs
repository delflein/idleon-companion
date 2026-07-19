/* stats/skill-xp.mjs — recipe for the client's SHARED all-skills EXP pool
 * (x._customBlock_SkillStats("AllSkillxpz")), the block every skill's own EXP multi adds before
 * layering its per-skill arm. Toolbox indexes it as getAllSkillsExp().
 *
 * THE EXPRESSION, verbatim from N.js `x._customBlock_SkillStats`, the `"AllSkillxpz"==d` return
 * (line 5622 block, stitched across the wrapped lines):
 *
 *   return  StarSigns.SkillEXP
 *     + ( 2*CardLv("springEvent2")
 *       + ( CardBonusREAL(50) + ArcadeBonus(18) + GoldFoodBonuses("SkillExp") )
 *       + Labb("BubonicGreen","0",<activeIdx>,0) * min(1, TalentEnh(536))       // Bubonic green tube
 *       + ( CardSetBonuses(0,"3")
 *         + 5*CardLv("w5a4")
 *         + ( min(150, 100*TalentEnh(35)) + Shrine(5) )                          // Maestro lucky charm
 *         + ArbitraryCode("StatueBonusGiven17")
 *         + ( prayersReal(2,0) + prayersReal(17,0) - prayersReal(1,1) - prayersReal(9,1)
 *           + ( EtcBonuses("27")
 *             + ( GetBuffBonuses(40,1)                                           // Maestro Transfusion
 *               + ( SaltLick(3)
 *                 + ( FlurboShop(2)
 *                   + ( BoxRewards["20c"]                                        // Myriad Crate PO box
 *                     + ( Divinity("Bonus_Minor",<activeIdx>,1)                  // Flutterbis minor
 *                       + ( 10*AchieveStatus(283) + ( 25*AchieveStatus(284)
 *                         + ( 10*AchieveStatus(294) + 15*AchieveStatus(359)
 *                           + ( RiftStuff("RiftSkillETC",1) + ( RiftStuff("RiftSkillETC",4)
 *                             + ( Breeding("ShinyBonusS","Nah",2,-1)
 *                               + ( GamingStatType("MSA_Bonus",5,0)
 *                                 + ( Companions(9)
 *                                   + ( Summoning("WinBonus",12,0)
 *                                     + ( GuildBonuses(14)
 *                                       + ( Summoning("OwlBonuses",3,0)
 *                                         + ( Holes("B_UPG",49,10)
 *                                           + ( GetSetBonus("CHIZOAR_SET","Bonus",0,0)
 *                                             + Thingies("FriendBonusStatz",4,0) )))))))))))))))))))))
 *
 * BOUNDARY DECISION. The client HAS a clean shared/per-skill split: `AllSkillxpz` is the shared
 * additive percent pool, and each skill's multi is `1 + SkillStats("AllSkillxpz")/100 + <per-skill
 * arm>/100` (e.g. the Alchemy branch of ExpMulti at line 5743 adds cauldron p2w, AlchExp stamps,
 * talents 75/492, AlchEXP box, statue-12, Etc98, TalentCalc 493, rift 4, chop/alchemy bubbles and
 * VaultUpg 28 — all Alchemy-only). This recipe models EXACTLY the shared `AllSkillxpz` pool and
 * NOTHING per-skill; a later per-skill build layers its own arm on top. The pool is returned as a
 * PERCENT, so the displayed multiplier is the default (1 + pool/100).
 *
 * COVERAGE (2026-07-19, first cut). Computed from the save: the Skill-EXP star signs (Sir Savvy
 * +3, Sir Savvy Major +6 at Lv>69, per-char), the springEvent2 + w5a4 passive cards, the equipped
 * Skill-EXP card (CardBonusREAL 50) and card set 3 (per-char), the Skill-EXP arcade row, Shrine 5
 * (All Exp), the Unending Energy + Balance of Proficiency prayers minus the Skilled Dimwit and
 * Royal Sampler curses (per-char), the Flutterbis minor divinity (per-char), all four skill-EXP
 * achievements, the Skill-EXP shiny pet, Companion 9, the Summoning winner skill-EXP bonus, the
 * guild skill-EXP bonus, the CHIZOAR set, and the Codex skill-EXP friend.
 *
 * Honest UNKNOWNS (neutral element 0, lower bound): GoldFoodBonuses("SkillExp"); the Bubonic-green-
 * tube × Voidwalker-enhancement arm; the Maestro lucky-charm (TalentEnh 35); StatueBonusGiven17;
 * EtcBonuses("27") worn gear; GetBuffBonuses(40,1) Maestro Transfusion; SaltLick(3); FlurboShop(2);
 * the "20c" Myriad Crate post-office box; MSA_Bonus(5); the two RiftSkillETC skill-mastery rows;
 * OwlBonuses(3); the B_UPG(49) cavern schematic. Total is a LOWER BOUND.
 *
 * Per-character (activeCharSensitive = true): the level-gated Skill-EXP star signs, the equipped
 * card + card set, the four prayers, EtcBonuses("27") gear, the "20c" post-office box, and the
 * Flutterbis minor divinity all read the active character.
 */

import { sel } from "../savemap.mjs";
import { T, term, evaluate } from "./engine.mjs";
import { COMPANION_VAL } from "../../gamedata/gamedata.mjs";
import { cardLv, cardBonusReal, cardSetBonus } from "../bonuses/cards.mjs";
import { arcadeBonus } from "../bonuses/arcade.mjs";
import { shrineBonus } from "../bonuses/shrines.mjs";
import { prayerBonus } from "../bonuses/prayers.mjs";
import { achieveStatus, setBonus } from "../bonuses/misc.mjs";
import { shinyBonus } from "../bonuses/breeding.mjs";
import { companion } from "../bonuses/companions.mjs";
import { winBonus } from "../bonuses/summoning.mjs";
import { guildBonus } from "../bonuses/guild.mjs";
import { friendBonusStat } from "../bonuses/thingies.mjs";
import { divinityMinorBonus } from "../bonuses/divinity.mjs";
import { boxReward } from "../bonuses/postoffice.mjs";
import { starSignSkillXp } from "../bonuses/starsigns.mjs";
import { goldFoodBonus } from "../bonuses/goldfood.mjs";

/** A per-ACTIVE-CHARACTER term. frag=null -> needs an active char. */
function perChar(ctx, id, key, kind, frag, wrap = (v) => v, neutral = kind === "mul" ? 1 : 0) {
  if (frag === null) {
    if (!ctx._perCharFlagged) {
      ctx._perCharFlagged = true;
      ctx.unknown("account view only: per-character terms (level-gated star signs, equipped card + set, prayers, gear, post-office box, Flutterbis minor) sit at their neutral element here — pick a character to resolve them");
    }
    return T(id, key, kind, neutral, "per-char", "resolved in the per-character view");
  }
  const f = typeof frag === "number" ? { value: frag } : frag;
  return T(id, key, kind, wrap(f.value), f.status ?? "computed", f.note ?? "", f.parts);
}

/** An additive companion term (raw CompanionDB percent). */
function compAdd(ctx, id, termId) {
  const c = companion(ctx, id);
  if (c.owned === null)
    return T(termId, `Companions(${id})`, "add", 0, "unknown", `ownership unknown -> +${COMPANION_VAL[id]}% if owned`);
  return T(termId, `Companions(${id})`, "add", c.value, "computed", c.owned ? `owned -> +${c.value}%` : "not owned");
}

const todo = (id, key, why) => T(id, key, "add", 0, "unknown", why);
function safe(ctx, fn, note) {
  try { const f = fn(); if (f === null) return null; return typeof f === "number" ? { value: f } : f; }
  catch (e) { ctx.unknown(`${note} -> ${e.message}`); return { value: 0, status: "unknown", note }; }
}

export const DISPLAY = {
  starSkillEXP: { label: "Star signs: Skill EXP", where: "Telescope star signs", how: "Sir Savvy (+3) and Sir Savvy Major (+6 at Lv>69) when active." },
  cardSpring2: { label: "Passive card: springEvent2", where: "Cards → springEvent2", how: "2% per card star level." },
  cardReal50: { label: "Equipped +% Skill EXP card", where: "Cards → this character's slots", how: "The C.Efaunt (Z7) skill-EXP card." },
  arcade18: { label: "Arcade: Skill EXP", where: "W2 Arcade → Gold Ball Shop", how: "Decay row; ×2 with the Spirit Reindeer pet." },
  goldFoodSkillExp: { label: "Golden food: Golden Ham", where: "Golden foods (equipped + beanstalk)", how: "GoldFoodBonuses(SkillExp) — per-character; lower bound (×GfoodMulti unread)." },
  bubonicGreen: { label: "Bubonic green tube", where: "Voidwalker / Bubonic Conjuror", how: "Green-tube tab × Voidwalker enhancement gate — not modelled yet." },
  cardSet3: { label: "Card set: Skill EXP", where: "Cards → equipped set", how: "The CardSet3 skill-EXP bonus." },
  cardW5a4: { label: "Passive card: w5a4", where: "Cards → w5a4", how: "5% per card star level." },
  maestroCharm: { label: "Maestro: Lucky Charm (enhancement)", where: "Maestro talents", how: "min(150, 100 × enhancement) — enhancement gate not modelled yet." },
  shrine5: { label: "Summereading Shrine (All EXP)", where: "W3 shrines", how: "Shrine level; global only with the Moai Head sailing artifact." },
  statue17: { label: "Statue: Skill EXP", where: "W1 Statues", how: "StatueBonusGiven17 — not decoded yet." },
  prayer2: { label: "Prayer: Unending Energy", where: "W3 Worship prayers", how: "Equipped prayer bonus arm." },
  prayer17: { label: "Prayer: Balance of Proficiency", where: "W3 Worship prayers", how: "Equipped prayer bonus arm." },
  prayerCurse1: { label: "Prayer curse: Skilled Dimwit", where: "W3 Worship prayers", how: "Subtracted while Skilled Dimwit is equipped." },
  prayerCurse9: { label: "Prayer curse: The Royal Sampler", where: "W3 Worship prayers", how: "Subtracted while The Royal Sampler is equipped." },
  etc27: { label: "Gear: +% Skill EXP", where: "Worn equipment", how: "Worn-gear stat — not in the save (lower bound)." },
  buff40: { label: "Maestro Transfusion", where: "Maestro talents (active buff)", how: "GetBuffBonuses(40,1) — active-buff state, not modelled." },
  saltLick3: { label: "Salt Lick: Skill EXP", where: "W3 Salt Lick", how: "SaltLick(3) — not decoded yet." },
  flurbo2: { label: "Dungeon: Skill EXP", where: "Dungeons → Flurbo shop", how: "FlurboShop(2) — not decoded yet." },
  box20c: { label: "Post office: Myriad Crate", where: "Post Office (per character)", how: "BoxRewards['20c'] — row not verified yet." },
  divMinor1: { label: "Divinity: Flutterbis minor", where: "W5 Divinity", how: "Minor god link on Flutterbis (type 1); scales with Divinity level." },
  ach283: { label: "Achievement (skill EXP a)", where: "Achievements", how: "+10% flat when done." },
  ach284: { label: "Achievement (skill EXP b)", where: "Achievements", how: "+25% flat when done." },
  ach294: { label: "Achievement (skill EXP c)", where: "Achievements", how: "+10% flat when done." },
  ach359: { label: "Achievement (skill EXP d)", where: "Achievements", how: "+15% flat when done." },
  riftSkill1: { label: "Rift: Skill Mastery (Smithing)", where: "W4 Rift → Skill Mastery", how: "RiftSkillETC(1) — not decoded yet." },
  riftSkill4: { label: "Rift: Skill Mastery (All)", where: "W4 Rift → Skill Mastery", how: "RiftSkillETC(4) — not decoded yet." },
  shiny2: { label: "Shiny pets (Skill EXP)", where: "Breeding → shiny pets", how: "+1% per shiny level." },
  msa5: { label: "Rift: MSA Skill EXP", where: "W4 Rift → MSA", how: "GamingStatType MSA_Bonus 5 — not decoded yet." },
  comp9: { label: "Pet: Skill EXP", where: "Pets (followers)", flag: true, how: "+20% Skill EXP while owned." },
  win12: { label: "Summoning winner: Skill EXP", where: "W6 Summoning → victories", how: "Grows with career wins." },
  guild14: { label: "Guild: Skill EXP", where: "Guild → bonuses", how: "+% Skill EXP; decay on the bonus level." },
  owl3: { label: "Orion (owl): Skill EXP", where: "W1 Owl", how: "OwlBonuses(3) — not decoded yet." },
  bUpg49: { label: "Cavern schematic (Skill EXP)", where: "The Cavern → Engineer", how: "B_UPG(49) — not decoded yet." },
  chizoarSet: { label: "Chizoar armor set", where: "Armor sets", how: "Flat +% once perma-unlocked; set value not verified yet." },
  friend4: { label: "Codex friend: Skill EXP", where: "Codex → Friends", how: "Needs a friend slotted; scales with their weekly points." },
};

export const skillXp = {
  name: "skillXp",
  label: "All Skill EXP",
  display: DISPLAY,
  activeCharSensitive: () => true,
  // default combine: (1 + pool/100) — AllSkillxpz is one additive percent pool.

  terms(ctx) {
    return [
      perChar(ctx, "starSkillEXP", "StarSigns.SkillEXP (skill-EXP star signs)", "add",
        ctx.activeChar == null ? null : safe(ctx, () => starSignSkillXp(ctx), "star signs skill EXP")),
      T("cardSpring2", '2*CardLv("springEvent2")', "add", 2 * cardLv(ctx, "springEvent2"), "computed", `CardLv("springEvent2")=${cardLv(ctx, "springEvent2")}`),
      perChar(ctx, "cardReal50", "CardBonusREAL(50) +%_Skill_EXP card", "add", cardBonusReal(ctx, 50)),
      T("arcade18", "ArcadeBonus(18)", "add", arcadeBonus(ctx, 18).value, arcadeBonus(ctx, 18).status, arcadeBonus(ctx, 18).note),
      perChar(ctx, "goldFoodSkillExp", 'GoldFoodBonuses("SkillExp")', "add",
        ctx.activeChar == null ? null : goldFoodBonus(ctx, "SkillExp", ctx.activeChar)),
      todo("bubonicGreen", 'Labb("BubonicGreen",0,idx,0)*min(1,TalentEnh(536))', "green-tube × voidwalker enhancement gate not modelled"),
      perChar(ctx, "cardSet3", 'CardSetBonuses(0,"3")', "add", cardSetBonus(ctx, 3)),
      T("cardW5a4", '5*CardLv("w5a4")', "add", 5 * cardLv(ctx, "w5a4"), "computed", `CardLv("w5a4")=${cardLv(ctx, "w5a4")}`),
      todo("maestroCharm", "min(150, 100*TalentEnh(35)) Lucky Charm", "maestro enhancement gate not modelled"),
      T("shrine5", "Shrine(5) Summereading", "add", shrineBonus(ctx, 5).value, shrineBonus(ctx, 5).status ?? "computed", shrineBonus(ctx, 5).note),
      todo("statue17", 'ArbitraryCode("StatueBonusGiven17")', "skill-EXP statue accumulator not decoded"),
      perChar(ctx, "prayer2", "prayersReal(2,0) Unending Energy", "add",
        ctx.activeChar == null ? null : safe(ctx, () => prayerBonus(ctx, 2, 0), "prayersReal(2,0)")),
      perChar(ctx, "prayer17", "prayersReal(17,0) Balance of Proficiency", "add",
        ctx.activeChar == null ? null : safe(ctx, () => prayerBonus(ctx, 17, 0), "prayersReal(17,0)")),
      perChar(ctx, "prayerCurse1", "-prayersReal(1,1) Skilled Dimwit curse", "add",
        ctx.activeChar == null ? null : safe(ctx, () => prayerBonus(ctx, 1, 1), "prayersReal(1,1)"), (v) => -v),
      perChar(ctx, "prayerCurse9", "-prayersReal(9,1) The Royal Sampler curse", "add",
        ctx.activeChar == null ? null : safe(ctx, () => prayerBonus(ctx, 9, 1), "prayersReal(9,1)"), (v) => -v),
      todo("etc27", 'EtcBonuses("27") (gear)', "worn-equipment stat not in the save (lower bound)"),
      todo("buff40", "GetBuffBonuses(40,1) Maestro Transfusion", "active-buff Maestro Transfusion not modelled"),
      todo("saltLick3", "SaltLick(3)", "salt lick skill-EXP row not decoded"),
      todo("flurbo2", "FlurboShop(2)", "dungeon flurbo skill-EXP shop not decoded"),
      perChar(ctx, "box20c", 'BoxRewards["20c"] Myriad Crate', "add",
        safe(ctx, () => boxReward(ctx, "20c"), 'BoxRewards["20c"]')),
      perChar(ctx, "divMinor1", 'Divinity("Bonus_Minor",idx,1) Flutterbis', "add",
        ctx.activeChar == null ? null : divinityMinorBonus(ctx, ctx.activeChar, 1)),
      T("ach283", "10*AchieveStatus(283)", "add", 10 * (achieveStatus(ctx, 283) ? 1 : 0), "computed", `ach283=${achieveStatus(ctx, 283)}`),
      T("ach284", "25*AchieveStatus(284)", "add", 25 * (achieveStatus(ctx, 284) ? 1 : 0), "computed", `ach284=${achieveStatus(ctx, 284)}`),
      T("ach294", "10*AchieveStatus(294)", "add", 10 * (achieveStatus(ctx, 294) ? 1 : 0), "computed", `ach294=${achieveStatus(ctx, 294)}`),
      T("ach359", "15*AchieveStatus(359)", "add", 15 * (achieveStatus(ctx, 359) ? 1 : 0), "computed", `ach359=${achieveStatus(ctx, 359)}`),
      todo("riftSkill1", 'RiftStuff("RiftSkillETC",1)', "rift skill-mastery (1) not decoded"),
      todo("riftSkill4", 'RiftStuff("RiftSkillETC",4)', "rift skill-mastery (4) not decoded"),
      term("shiny2", 'Breeding("ShinyBonusS","Nah",2,-1) Skill EXP', "add", shinyBonus(ctx, 2)),
      todo("msa5", 'GamingStatType("MSA_Bonus",5,0)', "rift MSA skill-EXP not decoded"),
      compAdd(ctx, 9, "comp9"),
      T("win12", 'Summoning("WinBonus",12,0)', "add", winBonus(ctx, 12).value, winBonus(ctx, 12).status, winBonus(ctx, 12).note, winBonus(ctx, 12).parts),
      term("guild14", "GuildBonuses(14)", "add", safe(ctx, () => guildBonus(ctx, 14), "guild 14")),
      todo("owl3", 'Summoning("OwlBonuses",3,0)', "owl skill-EXP not decoded"),
      todo("bUpg49", 'Holes("B_UPG",49,10)', "cavern schematic 49 not decoded"),
      term("chizoarSet", 'GetSetBonus("CHIZOAR_SET","Bonus",0,0)', "add", safe(ctx, () => setBonus(ctx, "CHIZOAR_SET"), 'GetSetBonus("CHIZOAR_SET")')),
      T("friend4", 'Thingies("FriendBonusStatz",4,0) Codex friend', "add", friendBonusStat(ctx, 4).value, friendBonusStat(ctx, 4).status ?? "computed", friendBonusStat(ctx, 4).note),
    ];
  },
};

/** Convenience with the classic shape. */
export const totalSkillXp = (s, opts = {}) => evaluate(skillXp, s, opts);
