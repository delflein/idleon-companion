/* stats/class-xp.mjs — recipe for the client's Class EXP Multiplier (x._customBlock_ExpMulti(0)).
 *
 * THE EXPRESSION, verbatim from N.js `x._customBlock_ExpMulti`, the `0==d` branch (line 5743,
 * stitched across the wrapped lines). The client builds five scratch accumulators on DNSM
 * (ExpGainLUK / LUK2 / LUK3 / LUK4 / LUK5 / LUK6) and returns:
 *
 *   ExpGainLUK  = TotalStats("LUK");                                   // the LUK stat stack
 *   ExpGainLUK  = LUK<1000 ? (pow(LUK+1,.37)-1)/30 : .8*((LUK-1000)/(LUK+2500))+.3963
 *
 *   // ExpGainLUK2 — the "level-bracket / lowest-char" additive block
 *   if (Tasks[2][0][2] > 0 && <active char is STRICTLY the lowest-level char>)
 *        ExpGainLUK2  = 3*Tasks[2][0][2] + Summoning("VaultUpgBonus",12,0)   // tasks/merit + vault
 *        if (SuperBitType(19)) ExpGainLUK3 = 50                              // superbit (LUK3)
 *   if (Lv0[0] < 50)  ExpGainLUK2 += CardSetBonuses(0,"0")
 *   if (Lv0[0] < 120) ExpGainLUK2 += MealBonus("Clexp")
 *   if (WeeklyBoss.c) ExpGainLUK2 += min(150, WeeklyBoss.c)
 *   ExpGainLUK2 += Lv0[0]<10 ? 150 : Lv0[0]<30 ? 100 : Lv0[0]<50 ? 50 : 0   // level bracket
 *   ExpGainLUK2 += Divinity("Bonus_Minor", <activeIdx>, 4)                   // Omniphau minor
 *   ExpGainLUK2 += CardSetBonuses(0,"5")
 *   if (BundlesReceived.bun_q == 1) ExpGainLUK3 += 20                        // gem bundle
 *
 *   // ExpGainLUK4 — cavern/summoning additive (nested inside LUK6 below)
 *   ExpGainLUK4 = Windwalker("CompassBonus",51,0) + (Holes("B_UPG",47,0)
 *     + (ExpMulti(999)=Summoning("WinBonus",23,0) + (Summoning("GrimoireUpgBonus",24,0)
 *     + (Summoning("VaultUpgBonus",3,0) + (Summoning("VaultUpgBonus",35,0)*getLOG(OptLacc[345])
 *     + Holes("B_UPG",83,40))))))
 *
 *   // ExpGainLUK5 — the multiplicative chain
 *   ExpGainLUK5 = 1
 *   if (GenINFO[17] shiny medallion for afkTarget) ExpGainLUK5 *= max(1, getbonus2(1,429,-1))
 *   ExpGainLUK5 *= max(1,
 *        (1+9*Companions(37))*(1+Companions(33))*(1+4*Companions(160))*(1+Companions(32))
 *      * (1+.4*Companions(168))*(1+Companions(34))*(1+Companions(145))*(1+min(.5,Companions(128)))
 *      * (1+(ResearchStuff Grid 130+131+132+152)/100)*(1+FarmingStuffs("StickerBonus",0,0)/100)
 *      * (1+.1*SuperBitType(63))*(1+Thingies("ZenithMarketBonus",9,0)/100)
 *      * max(1,min(1.01,1+Companions(50)/2500)))
 *     * (1+EtcBonuses("84")/100)*(1+CardBonusREAL(100)/100)*(1+ArcadeBonus(60)/100)
 *     * (1+AlchVials["7classexp"]/100)*pow(max(1,getbonus2(1,434,-1)),Windwalker("TotalTitanKills",0,0))
 *   ExpGainLUK5 *= (1+ArcaneType("ArcaneMapMulti_bon",1,0)/100)*(1+Spelunk("BigFishBonuses",4,0)/100)
 *      * (1+Thingies("DancingCoralBonus",3,0)/100)*pow(1+Thingies("CoralKidUpgBonus",2,0)/100, max(0,Divinity[25]-10))
 *      * (1+CardSetBonuses(0,"12")/100)*(1+Bubbastuff("BubbaRoG_Bonuses",6,0)/100)
 *      * (1+SushiStuff("RoG_BonusQTY",15,0)/100)*(1+5*Dreamstuff("CloudBonus",70)/100)
 *      * (1+Holes2("Fountain_BonTOT",0,16)/100)
 *   ExpGainLUK5 *= max(1, pow(1.03, Spelunk[6].length)*SuperBitType(24)*(1+Meritoc(27)/100)
 *      * (1+max(0,5*(OptLacc[464]-8))/100))
 *
 *   // ExpGainLUK6 — big additive block (contains ExpGainLUK4)
 *   ExpGainLUK6 = 2*CardLv("springEvent1") + (Companions(3)+Companions(50)
 *     + (OptLacc[179]*Dreamstuff("AllShimmerBonuses",0) + (GoldFoodBonuses("ClassEXPz")
 *     + (Summoning("OwlBonuses",0,0) + (Summoning("VotingBonusz",15,0)
 *     + (Holes("MonumentROGbonuses",1,6) + (ExpGainLUK4 + (GetSetBonus("IRON_SET")
 *     + (FarmingStuffs("ExoticBonusQTY",50,0) + (OptLacc[421] + (StampBonusOfTypeX("classxp")
 *     + (Thingies("FriendBonusStatz",1,0) + (Companions(47) + (Companions(111)
 *     + (Minehead("Button_Bonuses",8,0) + Companions(128)))))))))))))))
 *
 *   return  WorkbenchStuff("AdditionExtraEXPnDR",0,0)
 *         * (1 + ExpGainLUK3/100)
 *         * ExpGainLUK5
 *         * (1 + EtcBonuses("78")/100)
 *         * (1 + ( ExpGainLUK*(1+GetTalentNumber(1,35)/100)/1.8       // LUCKY_CHARMS talent
 *               + (EtcBonuses("4") + (BoxRewards.monsterExp + (TotalFoodBonuses("ClassEXP")
 *               + StarSigns.MainXP + (AlchVials.MonsterEXP + (AlchBubbles.expACTIVE
 *               + (CardBonusREAL(44) + (ExpGainLUK2 + (ArbitraryCode("StatueBonusGiven10")
 *               + (GetTalentNumber(1,632) + (Shrine(5) + (SaltLick(3) + (prayersReal(0,0)
 *               + (prayersReal(2,0) - prayersReal(9,1) + FlurboShop(2) + (AchieveStatus(57)
 *               + 20*AchieveStatus(357) + (3*AchieveStatus(61) + (2*AchieveStatus(124)
 *               + (5*AchieveStatus(188) + (ArcadeBonus(12) + (Labb("SigilBonus","Blank",8,0)
 *               + (25*AchieveStatus(286) + (Breeding("ShinyBonusS","Nah",1,-1)
 *               + (GamingStatType("MSA_Bonus",4,0) + (getbonus2(1,55,-1)               // JUST_EXP star talent
 *               + ExpGainLUK6 )))))...)))))/100 )
 *
 * The big final bracket is ONE additive percent pool (all `+`, with the two prayer-curse `-`),
 * wrapped as (1 + pool/100); the LUK term, ExpGainLUK2, ExpGainLUK4 and ExpGainLUK6 all fold into
 * it. combine() reconstructs the verbatim nesting from the named leaves — missing leaves carry
 * their neutral element (0 add / 1 mul) so the result is an honest LOWER BOUND.
 *
 * COVERAGE (2026-07-19, first cut). Computed from the save: the whole companion multiplier block
 * (37/33/160/32/168/34/145/128/50 via CompanionDB + ownership), research grid 130-152, sticker 0,
 * SuperBit 19/24/63, arcade 12/60, Shrine 5 (All Exp), sigil 8, all class-exp achievements, the
 * ClassEXP shiny pet, equipped/passive/set cards (44/100/springEvent1/set-0/5/12, per-char), the
 * LUCKY_CHARMS + talent-632 talents (per-char), vaults 3/12/35, grimoire 24, WinBonus 23, exotic
 * 50, Codex friend 1, Minehead button 8, Sushi RoG 15, Cloud 70, Div25 CoralKid power exponent,
 * the level bracket + lowest-char merit/vault + weekly boss + Omniphau minor (per-char), and the
 * two star-sign class-EXP arms (Book Worm / Big Brain / Big Brain Major, per-char + level-gated).
 *
 * Honest UNKNOWNS (neutral element, lower bound): TotalStats("LUK") — the whole char-stat stack,
 * the single biggest gap; every EtcBonuses gear stat (4/78/84 — worn gear not in the save); the
 * AlchVials MonsterEXP / 7classexp vials; AlchBubbles.expACTIVE; TotalFoodBonuses/GoldFoodBonuses;
 * StatueBonusGiven10; SaltLick(3); FlurboShop(2); ZenithMarketBonus(9); the getbonus2 star/void
 * talents (55 JUST_EXP, 429 medallion, 434 slayer, 433 workbench archlord); Meritoc(27); Voting15;
 * classxp stamps; Compass 51; the two B_UPG schematics (47/83); MonumentROGbonuses(1,6); the
 * shimmer/owl/arcane/big-fish/dancing-coral/bubba-RoG/fountain arms. Total is a LOWER BOUND.
 *
 * Per-character (activeCharSensitive = true): the LUK curve, isLowest merit/vault + superbit50,
 * card set 0, meals (Lv<120 gate), the level bracket, Omniphau minor, equipped cards (44/100/12/5),
 * the LUCKY_CHARMS + 632 talents, prayers (0/2/9), and the level-gated Big Brain Major star sign
 * all read the active character.
 */

import { sel } from "../savemap.mjs";
import { T, term, evaluate } from "./engine.mjs";
import { getLOG } from "../bonuses/util.mjs";
import { COMPANION_VAL } from "../gamedata.mjs";
import { companion } from "../bonuses/companions.mjs";
import { gridBonus } from "../bonuses/research.mjs";
import { stickerBonus, exoticBonus } from "../bonuses/farming.mjs";
import { superBitType } from "../bonuses/gaming.mjs";
import { arcadeBonus } from "../bonuses/arcade.mjs";
import { shrineBonus } from "../bonuses/shrines.mjs";
import { sigilBonus } from "../bonuses/alchemy.mjs";
import { achieveStatus, setBonus } from "../bonuses/misc.mjs";
import { shinyBonus } from "../bonuses/breeding.mjs";
import { cardLv, cardBonusReal, cardSetBonus } from "../bonuses/cards.mjs";
import { getTalentNumber } from "../bonuses/talents.mjs";
import { vaultUpgBonus, grimoireUpgBonus, winBonus, votingBonus, meritocBonusz } from "../bonuses/summoning.mjs";
import { friendBonusStat } from "../bonuses/thingies.mjs";
import { buttonBonus } from "../bonuses/minehead.mjs";
import { divinityMinorBonus } from "../bonuses/divinity.mjs";
import { mealBonus } from "../bonuses/meals.mjs";
import { prayerBonus } from "../bonuses/prayers.mjs";
import { sushiRoG } from "../bonuses/sushi.mjs";
import { starSignClassXp } from "../bonuses/starsigns.mjs";
import { zenithMarketBonus } from "../bonuses/zenith.mjs";
import { goldFoodBonus } from "../bonuses/goldfood.mjs";

/** A per-ACTIVE-CHARACTER term. frag=null -> needs an active char (neutral in the collapsed
 *  view, real value in evaluatePerChar's byChar results). */
function perChar(ctx, id, key, kind, frag, wrap = (v) => v, neutral = kind === "mul" ? 1 : 0) {
  if (frag === null) {
    if (!ctx._perCharFlagged) {
      ctx._perCharFlagged = true;
      ctx.unknown("account view only: per-character terms (LUK curve, lowest-char merit, level bracket, equipped cards, talents, prayers, Omniphau minor, level-gated star signs) sit at their neutral element here — pick a character to resolve them");
    }
    return T(id, key, kind, neutral, "per-char", "resolved in the per-character view");
  }
  const f = typeof frag === "number" ? { value: frag } : frag;
  return T(id, key, kind, wrap(f.value), f.status ?? "computed", f.note ?? "", f.parts);
}

/** A companion term storing the RAW CompanionDB value (combine applies the client's coefficient).
 *  Ownership unknown -> neutral element + unknown status; the "would-be" value is in the note. */
function compTerm(ctx, id, termId, kind) {
  const c = companion(ctx, id);
  const neutral = kind === "mul" ? 0 : 0;   // raw value; combine wraps it (1+coeff*value)
  if (c.owned === null)
    return T(termId, `Companions(${id})`, kind, neutral, "unknown", `ownership unknown -> raw ${COMPANION_VAL[id]} if owned`);
  return T(termId, `Companions(${id})`, kind, c.value, "computed", c.owned ? `owned -> ${c.value}` : "not owned");
}

/** An unimplemented leaf. Neutral element, honest status. */
const todo = (id, key, kind, why) => T(id, key, kind, kind === "mul" ? 1 : 0, "unknown", why);
/** A BARE multiplicative leaf (combine multiplies the raw value): neutral element 1. */
const todoBare = (id, key, why) => T(id, key, "mul", 1, "unknown", why);
/** Call a table-guarded evaluator; degrade a thrown unverified-id to an honest unknown fragment. */
function safe(ctx, fn, note) {
  try { const f = fn(); if (f === null) return null; return typeof f === "number" ? { value: f } : f; }
  catch (e) { ctx.unknown(`${note} -> ${e.message}`); return { value: 0, status: "unknown", note }; }
}

export const DISPLAY = {
  /* --- the big additive pool --- */
  luckCurve: { label: "LUK (main stat)", where: "Character stats", how: "A curve of total LUK ÷1.8 — the classic class-EXP scaling; needs the LUK stat stack (not modelled)." },
  talent35: { label: "Talent: Lucky Charms", where: "Character talents", how: "Multiplies the LUK arm; per-character talent 35." },
  etc4: { label: "Gear: +% Class EXP", where: "Worn equipment", how: "Worn-gear stat — not in the save (lower bound)." },
  boxMonsterExp: { label: "Post office: monster EXP box", where: "Post Office", how: "BoxRewards.monsterExp — row not verified yet." },
  foodClassEXP: { label: "Food: +% Class EXP", where: "Consumed food", how: "TotalFoodBonuses — not modelled yet." },
  starMainXP: { label: "Star signs: Class EXP", where: "Telescope star signs", how: "Book Worm (+1), Big Brain (+3), Big Brain Major (+6 at Lv>79) when active." },
  vialMonsterEXP: { label: "Vial: Monster EXP", where: "Alchemy → Vials", how: "The MonsterEXP vial — row not verified yet." },
  bubbleExpActive: { label: "Bubble: Grind Time", where: "Alchemy → cauldrons", how: "AlchBubbles.expACTIVE — row not verified yet." },
  card44: { label: "Equipped +% Class EXP cards", where: "Cards → this character's slots", how: "Sum of equipped '+% Class EXP' cards." },
  statue10: { label: "Statue: EXP Statue", where: "W1 Statues", how: "StatueBonusGiven10 — not decoded yet." },
  talent632: { label: "Talent: class EXP (632)", where: "Character talents", how: "Per-char talent 632." },
  shrine5: { label: "Summereading Shrine (All EXP)", where: "W3 shrines", how: "Shrine level; global only with the Moai Head sailing artifact." },
  saltLick3: { label: "Salt Lick: Class EXP", where: "W3 Salt Lick", how: "SaltLick(3) — not decoded yet." },
  prayer0: { label: "Prayer: Big Brain Time", where: "W3 Worship prayers", how: "Equipped prayer bonus arm." },
  prayer2: { label: "Prayer: Unending Energy", where: "W3 Worship prayers", how: "Equipped prayer bonus arm." },
  prayerCurse9: { label: "Prayer curse: The Royal Sampler", where: "W3 Worship prayers", how: "Subtracted while The Royal Sampler is equipped." },
  flurbo2: { label: "Dungeon: Class EXP", where: "Dungeons → Flurbo shop", how: "FlurboShop(2) — not decoded yet." },
  ach57: { label: "Achievement (class EXP a)", where: "Achievements", how: "+1% flat when done." },
  ach357: { label: "Achievement (class EXP b)", where: "Achievements", how: "+20% flat when done." },
  ach61: { label: "Achievement (class EXP c)", where: "Achievements", how: "+3% flat when done." },
  ach124: { label: "Achievement (class EXP d)", where: "Achievements", how: "+2% flat when done." },
  ach188: { label: "Achievement (class EXP e)", where: "Achievements", how: "+5% flat when done." },
  arcade12: { label: "Arcade: Class EXP", where: "W2 Arcade → Gold Ball Shop", how: "Decay row; ×2 with the Spirit Reindeer pet." },
  sigil8: { label: "Sigil: Metal Exterior", where: "Alchemy → Sigils", how: "Sigil tier." },
  ach286: { label: "Achievement (class EXP f)", where: "Achievements", how: "+25% flat when done." },
  shiny1: { label: "Shiny pets (Class EXP)", where: "Breeding → shiny pets", how: "+1% per shiny level." },
  msa4: { label: "Rift: MSA Class EXP", where: "W4 Rift → MSA", how: "GamingStatType MSA_Bonus 4 — not decoded yet." },
  starTalent55: { label: "Star talent: Just Exp", where: "Star talents", how: "getbonus2 star talent 55 — not modelled yet." },
  /* ExpGainLUK2 sub-terms */
  meritVault: { label: "Task merit + vault (lowest char)", where: "Tasks + Upgrade Vault", how: "Only the STRICTLY lowest-level character: 3× merit task + vault row 12." },
  cardSet0: { label: "Card set: low-level EXP", where: "Cards → equipped set", how: "Only under level 50." },
  mealsClexp: { label: "Meal: +% Class EXP", where: "W4 Cooking → meals", how: "Only under level 120; meal level × coeff." },
  weeklyBoss: { label: "Weekly boss: Class EXP", where: "Weekly boss kills", how: "+% per kill, capped +150%." },
  levelBracket: { label: "Low-level EXP bracket", where: "Always on (early levels)", how: "+150/+100/+50 under level 10/30/50; 0 past 50." },
  divMinor4: { label: "Divinity: Omniphau minor", where: "W5 Divinity", how: "Minor god link on Omniphau (type 4); scales with Divinity level." },
  cardSet5: { label: "Card set: Dmg/Drop/EXP", where: "Cards → equipped set", how: "The W4 card set bonus (EXP arm)." },
  /* ExpGainLUK3 */
  superbit50: { label: "Superbit: Noobie Gains", where: "W5 Gaming → Superbits", how: "+50% but only for the strictly lowest-level character." },
  bundleQ: { label: "Gem bundle (+20%)", where: "Gem shop bundle", flag: true, how: "Flat +20% while owned." },
  /* ExpGainLUK4 (folded into LUK6) */
  compass51: { label: "Compass: Class EXP", where: "W5 Wind Walker → Compass", how: "CompassBonus(51) — not decoded yet." },
  bUpg47: { label: "Cavern schematic (Class EXP a)", where: "The Cavern → Engineer", how: "B_UPG(47) — not decoded yet." },
  win23: { label: "Summoning winner: Class EXP", where: "W6 Summoning → victories", how: "Grows with career wins." },
  grimoire24: { label: "Grimoire: Class EXP", where: "Death Bringer Grimoire", how: "Grimoire upgrade 24." },
  vault3: { label: "Upgrade Vault: Class EXP", where: "Upgrade Vault", how: "+% per level." },
  vault35Log: { label: "Upgrade Vault: Class EXP × log", where: "Upgrade Vault", how: "Vault row 35 × log10(OptLacc[345])." },
  bUpg83: { label: "Cavern schematic (Class EXP b)", where: "The Cavern → Engineer", how: "B_UPG(83) — not decoded yet." },
  /* ExpGainLUK6 */
  cardSpring1: { label: "Passive card: springEvent1", where: "Cards → springEvent1", how: "2% per card star level." },
  comp3add: { label: "Pet: Crystal Custard", where: "Pets (followers)", flag: true, how: "+% Class EXP while owned." },
  comp50add: { label: "Pet: Santa Snake", where: "Pets (followers)", flag: true, how: "+% Class EXP while owned." },
  shimmer: { label: "Sailing: Shimmer Island", where: "Sailing → islands", how: "OptLacc[179] × AllShimmerBonuses — not modelled yet." },
  goldFoodClassEXPz: { label: "Golden food: Class EXP", where: "Golden foods (equipped + beanstalk)", how: "Golden Nigiri equipped/planted; lower bound (×GfoodMulti unread). Per-character." },
  owl0: { label: "Orion (owl): Class EXP", where: "W1 Owl", how: "OwlBonuses(0) — not decoded yet." },
  vote15: { label: "Weekly ballot: Class EXP", where: "W2 Town Ballot", flag: true, how: "Only in class-EXP vote weeks; active vote is runtime state." },
  monument16: { label: "Cavern: Monument (Class EXP)", where: "The Cavern → Monuments", how: "MonumentROGbonuses(1,6) — not decoded yet." },
  ironSet: { label: "Iron armor set", where: "Armor sets", how: "Flat +% once perma-unlocked; set value not verified yet." },
  exotic50: { label: "Exotic: Class EXP seed", where: "W6 Farming → Exotic Market", how: "Saturating market bonus." },
  opt421: { label: "Ninja: extra Class EXP", where: "W6 Ninja", how: "Flat +% from OptLacc[421]." },
  stampClassxp: { label: "Stamp: Class EXP", where: "Stamps", how: "Decay on stamp level; rows not verified yet." },
  friend1: { label: "Codex friend: Class EXP", where: "Codex → Friends", how: "Needs a friend slotted; scales with their weekly points." },
  comp47add: { label: "Pet: Class EXP (47)", where: "Pets (followers)", flag: true, how: "+% Class EXP while owned." },
  comp111add: { label: "Pet: Clammie", where: "Pets (followers)", flag: true, how: "+% Class EXP while owned." },
  button8: { label: "Minehead button: Class EXP", where: "W7 Minehead → buttons", how: "Button-press bucket 8 bonus." },
  comp128add: { label: "Pet: Class EXP (128)", where: "Pets (followers)", flag: true, how: "+% Class EXP while owned." },
  /* --- multiplicative chain (ExpGainLUK5) --- */
  medallion: { label: "Shiny medallion (afk target)", where: "W5 Wind Walker → Medallions", how: "×best SHINY_MEDALLIONS talent when the afk-target medallion is owned — not modelled." },
  c37: { label: "Pet: Class EXP multi (37)", where: "Pets (followers)", flag: true, how: "×(1+9×bonus) while owned." },
  c33: { label: "Pet: Class EXP multi (33)", where: "Pets (followers)", flag: true, how: "×(1+bonus) while owned." },
  c160: { label: "Pet: Class EXP multi (160)", where: "Pets (followers)", flag: true, how: "×(1+4×bonus) while owned." },
  c32: { label: "Pet: Class EXP multi (32)", where: "Pets (followers)", flag: true, how: "×(1+bonus) while owned." },
  c168: { label: "Pet: Class EXP multi (168)", where: "Pets (followers)", flag: true, how: "×(1+0.4×bonus) while owned." },
  c34: { label: "Pet: Class EXP multi (34)", where: "Pets (followers)", flag: true, how: "×(1+bonus) while owned." },
  c145: { label: "Pet: Class EXP multi (145)", where: "Pets (followers)", flag: true, how: "×(1+bonus) while owned." },
  c128: { label: "Pet: Class EXP multi (128)", where: "Pets (followers)", flag: true, how: "×(1+min(0.5,bonus)) while owned." },
  gridClassXp: { label: "Research grid: Class EXP", where: "W7 Research grid", how: "Nodes 130/131/132/152 summed." },
  sticker0: { label: "Sticker: Class EXP", where: "W7 Sticker board", how: "Sticker 0 level." },
  superbit63: { label: "Superbit: Experienced Gamer", where: "W5 Gaming → Superbits", how: "×1.1 once unlocked." },
  zenith9: { label: "Zenith market: Class EXP", where: "W7 Zenith Market", how: "ZenithMarketBonus(9) = floor(Spelunk[45][9]) — CLASSY_GOGO row." },
  c50mul: { label: "Pet: Santa Snake (multi)", where: "Pets (followers)", flag: true, how: "Tiny ×1.01 side bonus." },
  etc84: { label: "Gear: Class EXP multi (84)", where: "Worn equipment", how: "Worn-gear multiplier — not in the save (lower bound)." },
  cardReal100: { label: "Cards: Class EXP multi", where: "Cards → this character's slots", how: "'+% Class EXP Multi' cards." },
  arcade60: { label: "Arcade: Class EXP multi", where: "W2 Arcade → Gold Ball Shop", how: "Decay row." },
  vial7classexp: { label: "Vial: Class EXP multi", where: "Alchemy → Vials", how: "The 7classexp vial — row not verified yet." },
  slayerPow: { label: "Slayer: Abominator", where: "Wind Walker talents", how: "×best SLAYER_ABOMINATOR ^ total titan kills — not modelled." },
  arcane1: { label: "Arcane Cultist map multi", where: "Arcane Cultist (Wind Walker)", how: "ArcaneMapMulti(1) — not decoded yet." },
  bigFish4: { label: "Spelunking: Big Fish", where: "W7 Spelunking", how: "BigFishBonuses(4) — not decoded yet." },
  coral3: { label: "Dancing Coral: Class EXP", where: "W7 Reef", how: "DancingCoralBonus(3) — not decoded yet." },
  coralKidPow: { label: "Coral Kid × god rank", where: "W7 Reef", how: "×(1+CoralKidUpg/100)^max(0,unlockedDeities-10) — coeff not decoded." },
  cardSet12: { label: "Card set: Class EXP", where: "Cards → equipped set", how: "CardSet12 bonus." },
  bubbaRoG6: { label: "Bubba: Class EXP", where: "W7 Sushi → Bubba", how: "BubbaRoG(6) — not decoded yet." },
  sushi15: { label: "Sushi bar: Class EXP", where: "W7 Sushi Station", how: "RoG threshold set bonus." },
  cloud70: { label: "Equinox dream 71", where: "Equinox dreams", how: "×1.05 per cleared cloud 70." },
  fountain16: { label: "Cavern: Fountain (Class EXP)", where: "The Cavern → Fountain", how: "Fountain_BonTOT(0,16) — not decoded yet." },
  spelunkRocks: { label: "Spelunking: rocks found", where: "W7 Spelunking", how: "×1.03 per discovery." },
  superbit24: { label: "Superbit: Classy Discoveries", where: "W5 Gaming → Superbits", how: "Gates the discoveries multiplier once unlocked." },
  meritoc27: { label: "Meritocracy: Class EXP", where: "W2 Meritocracy", how: "Meritoc(27) — value not verified yet." },
  opt464: { label: "Sailing captains: Class EXP", where: "Sailing", how: "×(1+5×(captains-8)%) via OptLacc[464]." },
  /* --- structural multipliers --- */
  workbench: { label: "Construction: Extra EXP", where: "W3 Construction", how: "1 + ARCHLORD talent × log(builds) — not modelled." },
  etc78: { label: "Gear: Class EXP multi (78)", where: "Worn equipment", how: "Worn-gear multiplier — not in the save (lower bound)." },
};

export const classXp = {
  name: "classXp",
  label: "Class EXP Multiplier",
  display: DISPLAY,
  activeCharSensitive: () => true,

  /** Reconstructs the verbatim nested ExpMulti(0) from the named leaves. */
  combine: ({ terms }) => {
    const v = (id) => { const t = terms.find((x) => x.id === id); return t ? Number(t.value) || 0 : 0; };

    // ExpGainLUK2
    const luk2 = v("meritVault") + v("cardSet0") + v("mealsClexp") + v("weeklyBoss") +
      v("levelBracket") + v("divMinor4") + v("cardSet5");
    // ExpGainLUK4
    const luk4 = v("compass51") + v("bUpg47") + v("win23") + v("grimoire24") +
      v("vault3") + v("vault35Log") + v("bUpg83");
    // ExpGainLUK6 (contains luk4)
    const luk6 = 2 * v("cardSpring1") + v("comp3add") + v("comp50add") + v("shimmer") +
      v("goldFoodClassEXPz") + v("owl0") + v("vote15") + v("monument16") + luk4 +
      v("ironSet") + v("exotic50") + v("opt421") + v("stampClassxp") + v("friend1") +
      v("comp47add") + v("comp111add") + v("button8") + v("comp128add");
    // The LUK curve arm (÷1.8), scaled by the LUCKY_CHARMS talent
    const lukArm = v("luckCurve") * (1 + v("talent35") / 100) / 1.8;
    // The whole final additive bracket (percent pool)
    const pool = lukArm + v("etc4") + v("boxMonsterExp") + v("foodClassEXP") + v("starMainXP") +
      v("vialMonsterEXP") + v("bubbleExpActive") + v("card44") + luk2 + v("statue10") +
      v("talent632") + v("shrine5") + v("saltLick3") + v("prayer0") + v("prayer2") - v("prayerCurse9") +
      v("flurbo2") + v("ach57") + 20 * v("ach357") + 3 * v("ach61") + 2 * v("ach124") +
      5 * v("ach188") + v("arcade12") + v("sigil8") + 25 * v("ach286") + v("shiny1") +
      v("msa4") + v("starTalent55") + luk6;

    // ExpGainLUK3
    const luk3 = v("superbit50") + v("bundleQ");

    // ExpGainLUK5 — the multiplicative chain, in the client's grouping (each max(1,...) intact)
    const medallion = v("medallion") || 1;
    const compBlock = (1 + 9 * v("c37")) * (1 + v("c33")) * (1 + 4 * v("c160")) * (1 + v("c32")) *
      (1 + 0.4 * v("c168")) * (1 + v("c34")) * (1 + v("c145")) * (1 + Math.min(0.5, v("c128"))) *
      (1 + v("gridClassXp") / 100) * (1 + v("sticker0") / 100) * (1 + 0.1 * v("superbit63")) *
      (1 + v("zenith9") / 100) * Math.max(1, Math.min(1.01, 1 + v("c50mul") / 2500));
    const block2 = (1 + v("etc84") / 100) * (1 + v("cardReal100") / 100) * (1 + v("arcade60") / 100) *
      (1 + v("vial7classexp") / 100) * (v("slayerPow") || 1);
    const block3 = (1 + v("arcane1") / 100) * (1 + v("bigFish4") / 100) * (1 + v("coral3") / 100) *
      (v("coralKidPow") || 1) * (1 + v("cardSet12") / 100) * (1 + v("bubbaRoG6") / 100) *
      (1 + v("sushi15") / 100) * (1 + 5 * v("cloud70") / 100) * (1 + v("fountain16") / 100);
    const block4 = Math.max(1, Math.pow(1.03, v("spelunkRocks")) * v("superbit24") *
      (1 + v("meritoc27") / 100) * (1 + Math.max(0, 5 * (v("opt464") - 8)) / 100));
    const luk5 = medallion * Math.max(1, compBlock) * block2 * block3 * block4;

    return (v("workbench") || 1) * (1 + luk3 / 100) * luk5 * (1 + v("etc78") / 100) * (1 + pool / 100);
  },

  terms(ctx) {
    const opt = ctx.s.get("OptionsListAccount") ?? ctx.s.get("OptLacc") ?? [];
    const bundles = ctx.s.get("BundlesReceived") ?? {};
    const tasks = ctx.s.get("Tasks") ?? [];
    const meritLv = Number(((tasks[2] ?? [])[0] ?? [])[2] ?? 0);
    const weekly = ctx.s.get("WeeklyBoss") ?? {};
    const weeklyC = Number((weekly && typeof weekly === "object" ? weekly.c : undefined) ?? 0);
    const divinity = sel.divinity(ctx.s) ?? [];
    const div25 = Number(divinity[25] ?? 0);
    const spelunk = ctx.s.get("Spelunk") ?? [];
    const spelunkRocks = Array.isArray(spelunk[6]) ? spelunk[6].length : 0;

    // Grid nodes 130/131/132/152 summed (the compBlock research arm)
    const gridClassXp = [130, 131, 132, 152].reduce((a, n) => a + (safe(ctx, () => gridBonus(ctx, n), `grid ${n}`)?.value ?? 0), 0);

    // Per-char level helpers for the "strictly lowest character" gate
    const lowestUnique = (ci) => {
      const others = ctx.s.charIdxs.filter((i) => i !== ci).map((i) => sel.charLevel(ctx.s, i));
      const my = sel.charLevel(ctx.s, ci);
      return others.every((o) => my < o);
    };

    return [
      /* ===== the big additive pool ===== */
      perChar(ctx, "luckCurve", 'TotalStats("LUK") curve /1.8', "add",
        // The stat stack is not modelled; this is the single biggest gap -> honest unknown 0.
        (() => { ctx.unknown('TotalStats("LUK") — the full character-stat stack drives the class-EXP LUK arm (biggest missing piece)'); return { value: 0, status: "unknown", note: "LUK stack not modelled" }; })()),
      perChar(ctx, "talent35", "GetTalentNumber(1,35) Lucky Charms", "add",
        ctx.activeChar == null ? null : safe(ctx, () => getTalentNumber(ctx, 35), "GetTalentNumber(1,35)")),
      todo("etc4", 'EtcBonuses("4") (gear)', "add", "worn-equipment stat not in the save (lower bound)"),
      perChar(ctx, "boxMonsterExp", "BoxRewards.monsterExp", "add",
        safe(ctx, () => { ctx.unknown('BoxRewards.monsterExp post-office box not decoded'); return 0; }, "box monsterExp")),
      todo("foodClassEXP", 'TotalFoodBonuses("ClassEXP")', "add", "food bonus family not modelled"),
      perChar(ctx, "starMainXP", "StarSigns.MainXP (class-EXP star signs)", "add",
        ctx.activeChar == null ? null : safe(ctx, () => starSignClassXp(ctx), "star signs class EXP")),
      todo("vialMonsterEXP", "AlchVials.MonsterEXP", "add", "MonsterEXP vial row not verified"),
      todo("bubbleExpActive", "AlchBubbles.expACTIVE Grind Time", "add", "expACTIVE bubble row not verified"),
      perChar(ctx, "card44", "CardBonusREAL(44) +%_Class_EXP cards", "add", cardBonusReal(ctx, 44)),
      todo("statue10", 'ArbitraryCode("StatueBonusGiven10")', "add", "EXP statue accumulator not decoded"),
      perChar(ctx, "talent632", "GetTalentNumber(1,632)", "add",
        ctx.activeChar == null ? null : safe(ctx, () => getTalentNumber(ctx, 632), "GetTalentNumber(1,632)")),
      T("shrine5", "Shrine(5) Summereading", "add", shrineBonus(ctx, 5).value, shrineBonus(ctx, 5).status ?? "computed", shrineBonus(ctx, 5).note),
      todo("saltLick3", "SaltLick(3)", "add", "salt lick class-EXP row not decoded"),
      perChar(ctx, "prayer0", "prayersReal(0,0) Big Brain Time", "add", prayerBonus(ctx, 0, 0)),
      perChar(ctx, "prayer2", "prayersReal(2,0) Unending Energy", "add", prayerBonus(ctx, 2, 0)),
      perChar(ctx, "prayerCurse9", "-prayersReal(9,1) The Royal Sampler curse", "add", prayerBonus(ctx, 9, 1)),
      todo("flurbo2", "FlurboShop(2)", "add", "dungeon flurbo class-EXP shop not decoded"),
      T("ach57", "AchieveStatus(57)", "add", achieveStatus(ctx, 57) ? 1 : 0, "computed", `ach57=${achieveStatus(ctx, 57)}`),
      T("ach357", "20*AchieveStatus(357)", "add", achieveStatus(ctx, 357) ? 1 : 0, "computed", `ach357=${achieveStatus(ctx, 357)} (×20 in combine)`),
      T("ach61", "3*AchieveStatus(61)", "add", achieveStatus(ctx, 61) ? 1 : 0, "computed", `ach61=${achieveStatus(ctx, 61)} (×3 in combine)`),
      T("ach124", "2*AchieveStatus(124)", "add", achieveStatus(ctx, 124) ? 1 : 0, "computed", `ach124=${achieveStatus(ctx, 124)} (×2 in combine)`),
      T("ach188", "5*AchieveStatus(188)", "add", achieveStatus(ctx, 188) ? 1 : 0, "computed", `ach188=${achieveStatus(ctx, 188)} (×5 in combine)`),
      T("arcade12", "ArcadeBonus(12)", "add", arcadeBonus(ctx, 12).value, arcadeBonus(ctx, 12).status, arcadeBonus(ctx, 12).note),
      term("sigil8", 'Labb("SigilBonus","Blank",8,0) Metal Exterior', "add", safe(ctx, () => sigilBonus(ctx, 8), "sigil 8")),
      T("ach286", "25*AchieveStatus(286)", "add", achieveStatus(ctx, 286) ? 1 : 0, "computed", `ach286=${achieveStatus(ctx, 286)} (×25 in combine)`),
      term("shiny1", 'Breeding("ShinyBonusS","Nah",1,-1) Class EXP', "add", shinyBonus(ctx, 1)),
      todo("msa4", 'GamingStatType("MSA_Bonus",4,0)', "add", "rift MSA class-EXP not decoded"),
      todo("starTalent55", "getbonus2(1,55,-1) Just Exp star talent", "add", "star talent 55 (banned id) not modelled"),

      /* ExpGainLUK2 sub-terms */
      perChar(ctx, "meritVault", "3*Tasks[2][0][2]+VaultUpgBonus(12) [lowest char]", "add",
        ctx.activeChar == null ? null : (meritLv > 0 && lowestUnique(ctx.activeChar)
          ? { value: 3 * meritLv + vaultUpgBonus(ctx, 12), note: `lowest char: 3×${meritLv} merit + vault12 ${vaultUpgBonus(ctx, 12).toFixed(2)}` }
          : { value: 0, note: meritLv > 0 ? `char ${ctx.activeChar} not strictly lowest-level` : "merit task not started" })),
      perChar(ctx, "cardSet0", 'CardSetBonuses(0,"0") [Lv<50]', "add",
        ctx.activeChar == null ? null : (sel.charLevel(ctx.s, ctx.activeChar) < 50
          ? cardSetBonus(ctx, 0) : { value: 0, note: `char level ${sel.charLevel(ctx.s, ctx.activeChar)} >= 50` })),
      perChar(ctx, "mealsClexp", 'MealBonus("Clexp") [Lv<120]', "add",
        ctx.activeChar == null ? null : (sel.charLevel(ctx.s, ctx.activeChar) < 120
          ? safe(ctx, () => mealBonus(ctx, "Clexp"), 'MealBonus("Clexp")') : { value: 0, note: `char level ${sel.charLevel(ctx.s, ctx.activeChar)} >= 120` })),
      T("weeklyBoss", "min(150, WeeklyBoss.c)", "add", Math.min(150, weeklyC), "computed", `WeeklyBoss.c=${weeklyC}`),
      perChar(ctx, "levelBracket", "Lv<10?150:Lv<30?100:Lv<50?50:0", "add",
        ctx.activeChar == null ? null : (() => {
          const lv = sel.charLevel(ctx.s, ctx.activeChar);
          const b = lv < 10 ? 150 : lv < 30 ? 100 : lv < 50 ? 50 : 0;
          return { value: b, note: `char level ${lv} -> +${b}` };
        })()),
      perChar(ctx, "divMinor4", 'Divinity("Bonus_Minor",idx,4) Omniphau', "add",
        ctx.activeChar == null ? null : divinityMinorBonus(ctx, ctx.activeChar, 4)),
      perChar(ctx, "cardSet5", 'CardSetBonuses(0,"5")', "add", cardSetBonus(ctx, 5)),

      /* ExpGainLUK3 */
      perChar(ctx, "superbit50", "50 if lowest char & SuperBitType(19)", "add",
        ctx.activeChar == null ? null : (lowestUnique(ctx.activeChar) && superBitType(ctx, 19)
          ? { value: 50, note: "lowest char + Noobie Gains superbit" }
          : { value: 0, note: lowestUnique(ctx.activeChar) ? "Noobie Gains superbit not unlocked" : "not strictly lowest char" })),
      T("bundleQ", "BundlesReceived.bun_q == 1 -> +20", "add", bundles.bun_q === 1 ? 20 : 0, "computed", `bun_q=${bundles.bun_q ?? 0}`),

      /* ExpGainLUK4 */
      todo("compass51", 'Windwalker("CompassBonus",51,0)', "add", "compass class-EXP not decoded"),
      todo("bUpg47", 'Holes("B_UPG",47,0)', "add", "cavern schematic 47 not decoded"),
      T("win23", 'Summoning("WinBonus",23,0)', "add", winBonus(ctx, 23).value, winBonus(ctx, 23).status, winBonus(ctx, 23).note, winBonus(ctx, 23).parts),
      T("grimoire24", 'Summoning("GrimoireUpgBonus",24,0)', "add", safe(ctx, () => grimoireUpgBonus(ctx, 24), "grimoire 24")?.value ?? 0, "computed", `Grimoire[24]`),
      T("vault3", 'Summoning("VaultUpgBonus",3,0)', "add", vaultUpgBonus(ctx, 3), "computed", `UpgVault(3)=${vaultUpgBonus(ctx, 3).toFixed(2)}`),
      T("vault35Log", "VaultUpgBonus(35)*getLOG(OptLacc[345])", "add",
        vaultUpgBonus(ctx, 35) * getLOG(opt[345]), "computed",
        `UpgVault(35)=${vaultUpgBonus(ctx, 35).toFixed(2)} × log10(max(1,${Number(opt[345] ?? 0)}))=${getLOG(opt[345]).toFixed(3)}`),
      todo("bUpg83", 'Holes("B_UPG",83,40)', "add", "cavern schematic 83 not decoded"),

      /* ExpGainLUK6 */
      T("cardSpring1", '2*CardLv("springEvent1")', "add", cardLv(ctx, "springEvent1"), "computed", `CardLv("springEvent1")=${cardLv(ctx, "springEvent1")} (×2 in combine)`),
      compTerm(ctx, 3, "comp3add", "add"),
      compTerm(ctx, 50, "comp50add", "add"),
      todo("shimmer", "OptLacc[179]*Dreamstuff(AllShimmerBonuses,0)", "add", "shimmer island bonus not modelled"),
      perChar(ctx, "goldFoodClassEXPz", 'GoldFoodBonuses("ClassEXPz")', "add",
        ctx.activeChar == null ? null : goldFoodBonus(ctx, "ClassEXPz", ctx.activeChar)),
      todo("owl0", 'Summoning("OwlBonuses",0,0)', "add", "owl class-EXP not decoded"),
      term("vote15", 'Summoning("VotingBonusz",15,0)', "add", safe(ctx, () => votingBonus(ctx, 15), "vote 15")),
      todo("monument16", 'Holes("MonumentROGbonuses",1,6)', "add", "monument (1,6) class-EXP not decoded"),
      term("ironSet", 'GetSetBonus("IRON_SET","Bonus",0,0)', "add", safe(ctx, () => setBonus(ctx, "IRON_SET"), 'GetSetBonus("IRON_SET")')),
      term("exotic50", 'FarmingStuffs("ExoticBonusQTY",50,0)', "add", safe(ctx, () => exoticBonus(ctx, 50), "exotic 50")),
      T("opt421", "OptLacc[421] ninja class EXP", "add", Number(opt[421] ?? 0), "computed", `OptLacc[421]=${Number(opt[421] ?? 0)}`),
      todo("stampClassxp", 'StampBonusOfTypeX("classxp")', "add", "classxp stamp rows not verified"),
      T("friend1", 'Thingies("FriendBonusStatz",1,0) Codex friend', "add", friendBonusStat(ctx, 1).value, friendBonusStat(ctx, 1).status ?? "computed", friendBonusStat(ctx, 1).note),
      compTerm(ctx, 47, "comp47add", "add"),
      compTerm(ctx, 111, "comp111add", "add"),
      T("button8", 'Minehead("Button_Bonuses",8,0)', "add", buttonBonus(ctx, 8).value, buttonBonus(ctx, 8).status ?? "computed", buttonBonus(ctx, 8).note),
      compTerm(ctx, 128, "comp128add", "add"),

      /* ===== multiplicative chain (ExpGainLUK5) ===== */
      todoBare("medallion", "max(1,getbonus2(1,429,-1)) if afk-target medallion owned", "shiny medallion talent not modelled"),
      compTerm(ctx, 37, "c37", "mul"),
      compTerm(ctx, 33, "c33", "mul"),
      compTerm(ctx, 160, "c160", "mul"),
      compTerm(ctx, 32, "c32", "mul"),
      compTerm(ctx, 168, "c168", "mul"),
      compTerm(ctx, 34, "c34", "mul"),
      compTerm(ctx, 145, "c145", "mul"),
      compTerm(ctx, 128, "c128", "mul"),
      T("gridClassXp", "ResearchStuff Grid 130+131+132+152", "add", gridClassXp, "computed", `grid 130/131/132/152 = ${gridClassXp.toFixed(2)}%`),
      term("sticker0", 'FarmingStuffs("StickerBonus",0,0)', "add", safe(ctx, () => stickerBonus(ctx, 0), "sticker 0")),
      (() => {
        // superBitType(63) is null for gaming ids >= 53 (Number2Letter unrecoverable): "cannot
        // tell if owned", NOT "not owned". Degrade to an honest unknown (neutral 0 in the combine's
        // `1+.1*x`) instead of emitting a null metric value.
        const sb = superBitType(ctx, 63);
        if (sb === null) {
          ctx.unknown("SuperBitType(63) Experienced Gamer — gaming id >= 53, Number2Letter table unrecoverable; ownership unknowable, contributes neutral (×1)");
          return T("superbit63", "SuperBitType(63) Experienced Gamer", "mul", 0, "unknown", "superbit 63 unknowable (id >= 53) -> neutral");
        }
        return T("superbit63", "SuperBitType(63) Experienced Gamer", "mul", sb, "computed", `superbit 63 = ${sb}`);
      })(),
      term("zenith9", 'Thingies("ZenithMarketBonus",9,0)', "add", zenithMarketBonus(ctx, 9)),
      compTerm(ctx, 50, "c50mul", "mul"),
      todo("etc84", 'EtcBonuses("84") (gear)', "add", "worn-equipment stat not in the save (lower bound)"),
      perChar(ctx, "cardReal100", "CardBonusREAL(100) +%_Class_EXP_Multi cards", "add", cardBonusReal(ctx, 100)),
      T("arcade60", "ArcadeBonus(60)", "add", arcadeBonus(ctx, 60).value, arcadeBonus(ctx, 60).status, arcadeBonus(ctx, 60).note),
      todo("vial7classexp", 'AlchVials["7classexp"]', "add", "7classexp vial row not verified"),
      todoBare("slayerPow", "pow(max(1,getbonus2(1,434,-1)), TotalTitanKills)", "slayer abominator talent not modelled"),
      todo("arcane1", 'ArcaneType("ArcaneMapMulti_bon",1,0)', "add", "arcane cultist map multi not decoded"),
      todo("bigFish4", 'Spelunk("BigFishBonuses",4,0)', "add", "big fish bonus not decoded"),
      todo("coral3", 'Thingies("DancingCoralBonus",3,0)', "add", "dancing coral bonus not decoded"),
      todoBare("coralKidPow", "pow(1+CoralKidUpg(2)/100, max(0,Divinity[25]-10))", `coral-kid coeff not decoded (exponent max(0,${div25}-10)=${Math.max(0, div25 - 10)})`),
      perChar(ctx, "cardSet12", 'CardSetBonuses(0,"12")', "add", cardSetBonus(ctx, 12)),
      todo("bubbaRoG6", 'Bubbastuff("BubbaRoG_Bonuses",6,0)', "add", "bubba RoG class-EXP not decoded"),
      term("sushi15", 'SushiStuff("RoG_BonusQTY",15,0)', "add", safe(ctx, () => sushiRoG(ctx, 15), "sushi RoG 15")),
      T("cloud70", "5*Dreamstuff(CloudBonus,70)", "add", sel.cloudBonus(ctx.s, 70), "computed", `cloud 70 flag=${sel.cloudBonus(ctx.s, 70)} (×5 in combine)`),
      todo("fountain16", 'Holes2("Fountain_BonTOT",0,16)', "add", "cavern fountain class-EXP not decoded"),
      T("spelunkRocks", "Spelunk[6].length rocks found", "add", spelunkRocks, "computed", `${spelunkRocks} discoveries (1.03^n in combine)`),
      T("superbit24", "SuperBitType(24) Classy Discoveries", "mul", superBitType(ctx, 24), "computed", `superbit 24 = ${superBitType(ctx, 24)}`),
      term("meritoc27", 'Summoning2("MeritocBonusz",27,0)', "add", safe(ctx, () => meritocBonusz(ctx, 27), "meritoc 27")),
      T("opt464", "OptLacc[464] sailing captains", "add", Number(opt[464] ?? 0), "computed", `OptLacc[464]=${Number(opt[464] ?? 0)} (×(1+5(n-8)%) in combine)`),

      /* ===== structural multipliers ===== */
      todoBare("workbench", 'WorkbenchStuff("AdditionExtraEXPnDR",0,0)', "construction extra-EXP (ARCHLORD talent × log builds) not modelled"),
      todo("etc78", 'EtcBonuses("78") (gear)', "add", "worn-equipment multiplier not in the save (lower bound)"),
    ];
  },
};

/** Convenience with the classic shape. */
export const totalClassXp = (s, opts = {}) => evaluate(classXp, s, opts);
