/* stats/drop-rate.mjs — recipe for the client's Total Drop Rate (TotStatMAP["DropRarity"]).
 *
 * THE EXPRESSION, verbatim from N.js's TotStatMAP builder (~offset 4113125; extracted whole
 * 2026-07-17). Structure:
 *
 *   DropRateLUK = TotalStats("LUK")
 *   curve = LUK < 1000 ? ((LUK+1)^0.37 - 1)/40 : 0.5*((LUK-1000)/(LUK+2500)) + 0.297
 *
 *   pool =                                   // ONE additive percent pool (the client splits it
 *       1.4*curve                            // into DropRateLUK2 + the rest, but it all lands
 *     + GetTalentNumber(1,279)               // in the same (1 + pool/100); flattened here)
 *     + BoxRewards["DropRate"]               // post office
 *     + EtcBonuses("2") + EtcBonuses("102")
 *     + AlchBubbles["DropRate"]
 *     + CardBonusREAL(10)
 *     + GetTalentNumber(1,24)
 *     + StarSigns["Drop"]
 *     + GuildBonuses(10)
 *     + CardSetBonuses(0,"5") + CardSetBonuses(0,"6")
 *     + Shrine(4) + prayersReal(7,0) + Labb("SigilBonus","Blank",11,0)
 *     + Breeding("ShinyBonusS","Nah",0,-1)
 *     + ArcadeBonus(27)
 *     + Companions(3) + Companions(50)
 *     + StampBonusOfTypeX("DropRate")
 *     + GetTalentNumber(1,655)*OptLacc[189]
 *     + 5*Dream[10]
 *     + Summoning("WinBonus",9,0) + Summoning("TomeBonus",2,0)
 *     + ResearchStuff("Grid_Bonus",173,0) + Companions(132)
 *     + [DropRateLUK2:]
 *       min(1.5*CardLv("mini5a"),10) + min(4*CardLv("caveC")+6*CardLv("caveD"),100)
 *     + min(2*CardLv("anni4Event1"),20) + min(3*CardLv("luckEvent1"),25)
 *     + GoldFoodBonuses("DropRatez") + 6*AchieveStatus(377) + 4*AchieveStatus(381)
 *     + Summoning("OwlBonuses",4,0) + FarmingStuffs("LankRankUpgBonus",9,0)
 *     + Summoning("VotingBonusz",27,0) + Holes("B_UPG",46,0) + FarmingStuffs("CropSCbonus",7,0)
 *     + Summoning("GrimoireUpgBonus",44,0) + Summoning("VaultUpgBonus",18,0)
 *     + Holes("MeasurementBonusTOTAL",15,0) + Companions(22) + Companions(158)
 *     + Holes("B_UPG",82,20) + Holes("MonumentROGbonuses",2,6) + Thingies("EmperorBon",11,0)
 *     + GetSetBonus("EFAUNT_SET","Bonus",0,0) + FarmingStuffs("ExoticBonusQTY",59,0)
 *     + Thingies("FriendBonusStatz",3,0) + Thingies("LegendPTS_bonus",1,0)
 *     + Spelunk("ShopUpgBonus",50,0) + Companions(111)
 *
 *   e = 1 + pool/100
 *   if (e < 5) e = min(5, e + chipBonuses("dr")/100)     // lab chips, only under the 5x floor
 *   [in-dungeon override skipped — this recipe models the overworld value]
 *   if (BundlesReceived.bun_v == 1) e += 2
 *   e *= WorkbenchStuff("AdditionExtraEXPnDR",0,0)
 *   if (OptLacc[232] >= 1) e += 0.3
 *   if (BundlesReceived.bun_p == 1) e *= 1.2
 *   e *= (1 + ArcaneType("ArcaneMapMulti_bon",0,0)/100)
 *      * (1 + CardBonusREAL(101)/100)
 *      * (1 + 0.3*Companions(168)) * (1 + min(0.5, Companions(132)))
 *      * (1 + SushiStuff("RoG_BonusQTY",48,0)/100)
 *      * max(1, Minehead("GlimboDRmulti",0,0))
 *      * (1 + Summoning("TomeBonus",7,0)/100)
 *      * (1 + EtcBonuses("99")/100) * (1 + Minehead("BonusQTY",0,0)/100)
 *      * (1 + 5*Dreamstuff("CloudBonus",69)/100)
 *      * (1 + Ninja("PristineBon",3,0)/100) * (1 + EtcBonuses("91")/100)
 *      * (1 + AlchVials["7drMulto"]/100)
 *      * max(1, min(1.3, 1+Companions(26)) * min(1.5, 1+0.5*Companions(160)))
 *      * max(1, min(1.01, 1+Companions(50)/2500))
 *   [map-216 Glunko override skipped]
 *
 * COVERAGE STATUS (2026-07-17, second cut): account-wide subsystems computed, PLUS the
 * cards family (CardLv star levels, equipped CardBonusREAL 10/101, CardSetBonuses 5/6 from
 * CSetEq_N), the talents family (GetTalentNumber 24/279/655 with a near-complete AllTalentLV),
 * stamps (Golden Sixes incl. the exalted doubler floor), lab chips (Grounded Processor /
 * Omega card chips), and Codex friend bonuses. Per-character terms are unknown in the
 * account-collapsed view and computed in evaluatePerChar's byChar results.
 * STILL MISSING (honest unknowns): TotalStats("LUK") — the whole char-stat stack, the single
 * biggest gap — alchemy bubbles, star-sign aggregate, post office, guild, shrine, prayer,
 * sigil, gold food, EtcBonuses, and several W6/W7 formulas (Owl, TomeBonus, cavern B_UPG
 * 46/82, Measurement 15, Monument(2,6), Minehead pair, LankRank, CropSC, ShopUpg 50,
 * ArcaneType map multi, Workbench). The result is a LOWER BOUND until those land.
 */

import { sel } from "../savemap.mjs";
import { T, term, evaluate } from "./engine.mjs";
import { COMPANION_VAL } from "../../gamedata/gamedata.mjs";
import { shinyBonus } from "../bonuses/breeding.mjs";
import { arcadeBonus } from "../bonuses/arcade.mjs";
import { companion } from "../bonuses/companions.mjs";
import { gridBonus } from "../bonuses/research.mjs";
import { winBonus, votingBonus, vaultUpgBonus, grimoireUpgBonus } from "../bonuses/summoning.mjs";
import { sushiRoG } from "../bonuses/sushi.mjs";
import { emperorBon, legendPts } from "../bonuses/thingies.mjs";
import { setBonus } from "../bonuses/misc.mjs";
import { exoticBonus } from "../bonuses/farming.mjs";
import { pristineBon } from "../bonuses/ninja.mjs";
import { vialBonus } from "../bonuses/alchemy.mjs";
import { cardLv, cardBonusReal, cardSetBonus } from "../bonuses/cards.mjs";
import { getTalentNumber } from "../bonuses/talents.mjs";
import { stampBonusOfType } from "../bonuses/stamps.mjs";
import { chipBonuses } from "../bonuses/chips.mjs";
import { friendBonusStat } from "../bonuses/thingies.mjs";
import { alchBubble } from "../bonuses/bubbles.mjs";
import { boxReward } from "../bonuses/postoffice.mjs";
import { starSignDropKey } from "../bonuses/starsigns.mjs";
import { getTomePoints, tomeBonus } from "../bonuses/tome.mjs";
import { guildBonus } from "../bonuses/guild.mjs";
import { shrineBonus } from "../bonuses/shrines.mjs";
import { prayerBonus } from "../bonuses/prayers.mjs";
import { sigilBonus } from "../bonuses/alchemy.mjs";
import { obolBonus } from "../bonuses/obols.mjs";
import { goldFoodBonus } from "../bonuses/goldfood.mjs";

/** Player-facing display metadata (see artifact-find.mjs DISPLAY). Unlisted terms fall back
 *  to their key. */
export const DISPLAY = {
  legendDropParty: { label: "Legend talent: Greatest Drop Party Ever", where: "W7 Spelunking → Legend Talents",
    how: "+500% per level (max 4) — additive, exactly as the tooltip admits." },
  summonWin9: { label: "Summoning winner bonus", where: "W6 Summoning → victories",
    how: "Grows with career wins; multiplied by Crystal Comb, gem shop and Winz Lantern." },
  grimoireSkull: { label: "Grimoire: Skull of Major Droprate", where: "Death Bringer Grimoire",
    how: "+1% per skull level, multiplied by Writhing Grimoire." },
  cardBonus10: { label: "Equipped drop-rate cards", where: "Cards → this character's 12 slots",
    how: "Sum of equipped '+% Total Drop Rate' cards; doubled in slots 1/8 with the Omega card chips; ×Flopping a Full House." },
  vaultDR: { label: "Upgrade Vault: Drop Rate", where: "Upgrade Vault (W1 town)", how: "+2% per level." },
  emperorDR: { label: "Emperor bonus", where: "W6 Emperor showdowns",
    how: "Wins cycling onto the drop-rate slot; ×arcane + arcade boosts." },
  cardCaves: { label: "Cave cards (passive)", where: "Cards → caveC / caveD (auto-passive)",
    how: "4×/6× card level, capped +100% together." },
  alchBubbles: { label: "Bubble: Droppin Loads", where: "Alchemy → Yellow cauldron",
    how: "Decay curve on bubble level — applies passively, no equip needed." },
  cardSet5: { flag: true, label: "Card set: Dmg/Drop/EXP", where: "Cards → equipped set", how: "The W4 card set bonus." },
  cardSet6: { flag: true, label: "Card set: Drop Rate", where: "Cards → equipped set", how: "The dedicated drop-rate card set." },
  postOffice: { label: "Post Office: Non Predatory Loot Box", where: "Post Office (per character)",
    how: "Decay curve on box points — first PO box worth maxing for drop." },
  gridDivineDesign: { label: "Research: Divine Design", where: "W7 Research grid",
    how: "+25% per node level; also grants Arctis to everyone." },
  efauntSet: { flag: true, label: "Efaunt armor set", where: "Armor sets (W2 Armor Smithy)",
    how: "Flat +25% once the set is perma-unlocked." },
  shinyPets: { label: "Shiny pets (Drop Rate)", where: "Breeding → shiny pets with 'Drop Rate'",
    how: "+1% per shiny level." },
  starSignsDrop: { flag: true, label: "Star signs: Pirate Booty + Druipi Major", where: "Telescope star signs",
    how: "+5% and +12% while active." },
  stampsDropRate: { label: "Stamp: Golden Sixes", where: "Stamps → tab 1",
    how: "Decay curve on stamp level; ×2+ when exalted." },
  achieves: { flag: true, label: "Achievements", where: "Achievements (W3/W4)", how: "+6% and +4% flat." },
  arcade27: { label: "Arcade upgrade", where: "W2 Arcade → Gold Ball Shop",
    how: "Decay row; ×2 with Spirit Reindeer companion." },
  cardMini5a: { label: "Mini boss card (passive)", where: "Cards → mini5a", how: "1.5×/level, cap +10%." },
  cardAnni4: { label: "Anniversary card (passive)", where: "Cards → event card", how: "2×/level, cap +20%." },
  cardLuck: { label: "Luck event card (passive)", where: "Cards → event card", how: "3×/level, cap +25%." },
  exoticPommelion: { label: "Exotic: Pommelion Seed", where: "W6 Farming → Exotic Market", how: "Saturating toward +25%." },
  friendBonus3: { label: "Codex friend bonus", where: "Codex → Friends",
    how: "Needs a friend slotted on the drop-rate bonus; scales with their weekly points; ×2 with Poppy." },
  talent279: { label: "Talent: Robbinghood", where: "Character talents (tab 1)", how: "Decay on talent level." },
  talent24: { label: "Talent: Curse of Mr Looty Booty", where: "Jman talents", how: "Decay on talent level (and -% damage)." },
  talent655: { label: "Talent: Weekly Battles", where: "Master class talents",
    how: "Per weekly-boss difficulty beaten this week." },
  tomeBonus2: { label: "Tome: drop-rate bonus", where: "The Tome (W4, needs its unlock)",
    how: "Scales with Tome score above 8,000 pts." },
  equinoxDream: { label: "Equinox: Faux Jewels", where: "Equinox upgrades", how: "+5% per level." },
  voting27: { flag: true, label: "Weekly ballot", where: "W2 Town Ballot", how: "+38% only in drop-rate vote weeks — nothing to push, just patience." },
  comp3: { label: "Pet: Crystal Custard", where: "Pets (followers)", flag: true, how: "+100% drop rate while owned." },
  comp50: { label: "Pet: Santa Snake", where: "Pets (followers)", flag: true, how: "+25% drop rate while owned." },
  comp132add: { label: "Pet: Mama Troll", where: "Pets (followers)", flag: true, how: "+100% drop rate while owned." },
  comp22: { label: "Pet: Quenchie", where: "Pets (followers)", flag: true, how: "+15% drop rate while owned." },
  comp158: { label: "Pet: Lucky Slug", where: "Pets (followers)", flag: true, how: "+15% drop rate while owned." },
  comp111: { label: "Pet: Clammie", where: "Pets (followers)", flag: true, how: "+100% drop rate while owned." },
  lukCurve: { label: "LUK (main stat)", where: "Character stats", how: "1.4× a curve of total LUK — the classic Jman scaling." },
  etc2: { label: "Obols: +% Drop Rate", where: "Obols (family + personal pages)", how: "Sum of obol drop-rate unique stats; worn-gear unique stats not counted (lower bound)." },
  etc102: { label: "Obols: +% Drop Chance", where: "Obols (family + personal pages)", how: "Sum of obol drop-chance unique stats; worn-gear unique stats not counted (lower bound)." },
  guild10: { label: "Guild bonus: Gold Charm", where: "Guild → bonuses", how: "+% Total Drop Rate; decay(40,50) on the bonus level." },
  shrine4: { label: "Clover Shrine (Drop Rate)", where: "W3 shrines", how: "Shrine level; only global with the Moai Head sailing artifact, else map-local." },
  prayer7: { label: "Prayer: Midas Minded", where: "W3 Worship prayers", how: "Equipped prayer (or superbit passive)." },
  sigil11: { label: "Sigil: Trove", where: "Alchemy → Sigils", how: "Sigil level tier." },
  goldFood: { label: "Golden food: Golden Cake", where: "Golden foods (equipped + beanstalk)", how: "GoldFoodBonuses(DropRatez) — per-character; lower bound (×GfoodMulti unread)." },
  owl4: { label: "Orion (owl) mega-feather", where: "W1 Owl", how: "Feather-restart bonuses." },
  lankRank9: { label: "Farming Land Rank", where: "W6 Farming → Land Rank database", how: "Not decoded yet." },
  bUpg46: { label: "Cavern blueprint (Engineer)", where: "The Cavern → Engineer → Blueprints", how: "Not decoded yet." },
  cropSC7: { label: "Farming: Crop Supercharge", where: "W6 Farming", how: "Not decoded yet." },
  measurement15: { label: "Cavern: Measurement", where: "The Cavern → Measurements", how: "Not decoded yet." },
  bUpg82: { label: "Cavern blueprint (Engineer, 2)", where: "The Cavern → Engineer → Blueprints", how: "Not decoded yet." },
  monument26: { label: "Cavern: Monument bonus", where: "The Cavern → Monuments", how: "Not decoded yet." },
  shopUpg50: { label: "Spelunking shop", where: "W7 Spelunking shop", how: "Not decoded yet." },
  chipDR: { flag: true, label: "Chip: Grounded Processor", where: "Lab → chips (per character)",
    how: "+60% — but only while total drop rate is under ×5, so dead for endgame." },
  bunV: { flag: true, label: "Gem bundle (+2×)", where: "Gem shop bundle", how: "Flat +2 while owned." },
  workbench: { label: "Construction bonus", where: "W3 Construction", how: "Not decoded yet." },
  opt232: { flag: true, label: "Endless Summoning perk", where: "W6 Endless Summoning", how: "Flat +0.3." },
  bunP: { flag: true, label: "Gem bundle (×1.2)", where: "Gem shop bundle", how: "Flat ×1.2 while owned." },
  sushiRoG48: { flag: true, label: "Sushi bar set bonus", where: "W7 Sushi Station", how: "×1.1 at 49+ unique sushi." },
  cloud69: { flag: true, label: "Equinox dream 70", where: "Equinox dreams", how: "Flat ×1.05 once cleared." },
  pristine3: { flag: true, label: "Pristine charm: Cotton Candy", where: "W6 Sneaking → Pristine charms", how: "Flat ×1.15 while owned." },
  vialShip: { label: "Vial: Ship in a Bottle", where: "Alchemy → Vials", how: "0.1%/level — a drop MULTIPLIER vial." },
  comp168: { label: "Pet: Crystal Glunko", where: "Pets (followers)", flag: true, how: "×1.3 drop rate while owned." },
  comp132mul: { label: "Pet: Mama Troll (multiplier)", where: "Pets (followers)", flag: true, how: "×1.5 while owned — same pet also gives the +100% above." },
  compPair: { label: "Pets: Mallay + Glunko The Massive", where: "Pets (followers)", flag: true, how: "×1.3 and ×1.5, multiplied together (capped)." },
  comp50mul: { label: "Pet: Santa Snake (multiplier)", where: "Pets (followers)", flag: true, how: "The same pet's tiny ×1.01 side bonus." },
  arcaneMapMulti: { label: "Arcane Cultist map bonus", where: "Arcane Cultist (Windwalker tree)", how: "Not decoded yet." },
  cardBonus101: { label: "Drop-multi cards", where: "Cards → '+% Drop Rate Multi' cards",
    how: "Golden pirate cards — a MULTIPLIER, the strongest card type." },
  glimboDR: { label: "Glimbo (Minehead)", where: "W7 Minehead → Glimbo", how: "Not decoded yet." },
  tomeBonus7: { label: "Tome: drop MULTI (event)", where: "The Tome (needs Singed Tome emporium + event item)",
    how: "×(1 + 3·(score/1000)^0.3 %) when unlocked." },
  etc99: { label: "Etc bonus (multi a)", where: "Misc", how: "Not decoded yet." },
  mineheadQty: { label: "Minehead bonus", where: "W7 Minehead", how: "Not decoded yet." },
  etc91: { label: "Etc bonus (multi b)", where: "Misc", how: "Not decoded yet." },
};

/** A per-ACTIVE-CHARACTER term. In the collapsed account view (no active character set) it
 *  reports status "per-char" — NOT "unknown": the value is fully derivable, just character-
 *  dependent, and the byChar evaluations carry it. It still contributes its neutral element
 *  there, so the account view stays a floor, but pages can label it honestly.
 *  frag: {value,status?,note?,parts?} or a plain number, or null (= needs activeChar). */
function perChar(ctx, id, key, kind, frag, wrap = (v) => v, neutral = kind === "mul" ? 1 : 0) {
  if (frag === null) {
    if (!ctx._perCharFlagged) {
      ctx._perCharFlagged = true;
      ctx.unknown("account view only: per-character terms (talents, equipped cards, card set, chips, post office) sit at their neutral element here — pick a character to resolve them");
    }
    return T(id, key, kind, neutral, "per-char", "resolved in the per-character view");
  }
  const f = typeof frag === "number" ? { value: frag } : frag;
  return T(id, key, kind, wrap(f.value), f.status ?? "computed", f.note ?? "", f.parts);
}

/** An additive companion term (the pool takes the raw CompanionDB value as a percent). */
function compAdd(ctx, id, termId) {
  const c = companion(ctx, id);
  if (c.owned === null)
    return T(termId, `Companions(${id})`, "add", 0, "unknown", `ownership unknown -> would be +${COMPANION_VAL[id]}% if owned`);
  return T(termId, `Companions(${id})`, "add", c.value, "computed", c.owned ? `owned -> +${c.value}%` : "not owned");
}

/** A term for a family we have not implemented yet. Neutral value, honest status. */
const todo = (id, key, kind, why) => T(id, key, kind, kind === "add" ? 0 : 1, "unknown", why);

export const dropRate = {
  name: "dropRate",
  label: "Total Drop Rate",
  display: DISPLAY,
  /** Genuinely per-character: talents (SL_N), equipped cards (CardEquip_N), card set
   *  (CSetEq_N), and lab chips (Lab[1+i]) all vary by character. */
  activeCharSensitive: () => true,

  combine: ({ pool, mul, terms }) => {
    const v = (id) => terms.find((x) => x.id === id)?.value ?? 0;
    let e = 1 + pool / 100;
    if (e < 5) e = Math.min(5, e + v("chipDR") / 100);
    e += v("bunV");
    e *= v("workbench") || 1;
    e += v("opt232");
    e *= v("bunP") || 1;
    return e * mul;
  },

  terms(ctx) {
    const famNotes = [
      'TotalStats("LUK") — the full character-stat stack; drives the 1.4*curve term, the single biggest missing piece',
      'EtcBonuses ("2","102") additive drop terms are now the OBOL portion only (worn-equipment unique drop stats are not in the save); the multiplier arms EtcBonuses("99"/"91") stay unread. GoldFoodBonuses("DropRatez") — the per-character equipped-golden-food family — not built.',
      "W6/W7 formulas not read yet: OwlBonuses(4), TomeBonus(2/7), B_UPG(46), B_UPG(82,e=20), MeasurementBonusTOTAL(15), MonumentROGbonuses(2,6), Minehead Glimbo/BonusQTY, LankRankUpgBonus(9), CropSCbonus(7), ShopUpgBonus(50), ArcaneType map multi, WorkbenchStuff AdditionExtraEXPnDR",
    ];
    if (ctx.companions === null)
      famNotes.push("Companions (3, 22, 50, 111, 132, 158 additive; 26, 50, 132, 160, 168 multiplicative) — no _comp RTDB doc on this snapshot");
    for (const n of famNotes) ctx.unknown(n);

    /* Tome score: user value wins (exact); else the natively computed floor. */
    if (ctx.tomePoints == null) {
      const tp = getTomePoints(ctx);
      ctx.tomePoints = tp.value;
      ctx.tomePointsFloor = !tp.exact;
    }
    const tb7 = tomeBonus(ctx, 7);
    const bundles = ctx.s.get("BundlesReceived") ?? {};
    const opt = ctx.s.get("OptLacc") ?? [];
    const ach = (c) => (sel.achieveReg(ctx.s)[c] === -1 ? 1 : 0);
    const win9 = winBonus(ctx, 9);
    const g173 = gridBonus(ctx, 173);
    const vote = votingBonus(ctx, 27);
    const sushi = sushiRoG(ctx, 48);
    const veil = pristineBon(ctx, 3);
    const ship = vialBonus(ctx, 84);
    const efaunt = setBonus(ctx, "EFAUNT_SET");
    const pommelion = exoticBonus(ctx, 59);
    const dream10 = Number((ctx.s.get("Dream") ?? [])[10] ?? 0);
    const c168 = companion(ctx, 168), c132m = companion(ctx, 132), c26 = companion(ctx, 26),
          c160 = companion(ctx, 160), c50m = companion(ctx, 50);
    const compsUnknown = ctx.companions === null;

    return [
      /* --- additive pool: computed ---------------------------------------- */
      term("shinyPets", 'Breeding("ShinyBonusS","Nah",0,-1) shiny pets', "add", shinyBonus(ctx, 0)),
      term("arcade27", "ArcadeBonus(27)", "add", arcadeBonus(ctx, 27)),
      compAdd(ctx, 3, "comp3"), compAdd(ctx, 50, "comp50"), compAdd(ctx, 132, "comp132add"),
      compAdd(ctx, 22, "comp22"), compAdd(ctx, 158, "comp158"), compAdd(ctx, 111, "comp111"),
      T("equinoxDream", "5*Dream[10] Equinox Faux Jewels", "add", 5 * dream10, "computed", `Dream[10]=${dream10}`),
      T("summonWin9", 'Summoning("WinBonus",9,0)', "add", win9.value, win9.status, win9.note, win9.parts),
      T("gridDivineDesign", 'ResearchStuff("Grid_Bonus",173,0) Divine Design', "add", g173.value, g173.status, g173.note, g173.parts),
      T("achieves", "6*AchieveStatus(377) + 4*AchieveStatus(381)", "add", 6 * ach(377) + 4 * ach(381), "computed",
        `ach377=${ach(377)}, ach381=${ach(381)}`),
      T("voting27", 'Summoning("VotingBonusz",27,0)', "add", vote.value, vote.status ?? "computed", vote.note),
      T("grimoireSkull", 'Summoning("GrimoireUpgBonus",44,0) Skull of Major Droprate', "add",
        grimoireUpgBonus(ctx, 44), "computed", `Grimoire[44]=${sel.grimoire(ctx.s)[44] ?? 0} x coeff 1 x (1+Writhing[36]/100)`),
      T("vaultDR", 'Summoning("VaultUpgBonus",18,0)', "add", vaultUpgBonus(ctx, 18), "computed",
        `UpgVault[18]=${sel.upgVault(ctx.s)[18] ?? 0}`),
      T("emperorDR", 'Thingies("EmperorBon",11,0)', "add", emperorBon(ctx, 11), "computed", "emperor slot 11 = +{%_Drop_Rate"),
      T("efauntSet", 'GetSetBonus("EFAUNT_SET","Bonus",0,0)', "add", efaunt.value, efaunt.known ? "computed" : "unknown", efaunt.why),
      T("exoticPommelion", 'FarmingStuffs("ExoticBonusQTY",59,0) Pommelion', "add", pommelion.value, "computed", pommelion.note),
      T("legendDropParty", 'Thingies("LegendPTS_bonus",1,0) Greatest Drop Party Ever', "add",
        legendPts(ctx, 1), "computed", `Spelunk[18][1]=${sel.legendTalentLevels(ctx.s)[1] ?? 0} x coeff 500`),

      /* --- additive pool: per-character families (computed in byChar) ------- */
      perChar(ctx, "talent279", "GetTalentNumber(1,279) Robbinghood", "add", getTalentNumber(ctx, 279)),
      perChar(ctx, "talent24", "GetTalentNumber(1,24) Curse of Mr Looty Booty", "add", getTalentNumber(ctx, 24)),
      perChar(ctx, "talent655", "GetTalentNumber(1,655)*OptLacc[189] Weekly Battles", "add",
        getTalentNumber(ctx, 655), (v) => v * Number(opt[189] ?? 0)),
      perChar(ctx, "cardBonus10", "CardBonusREAL(10) equipped +{%_Total_Drop_Rate cards", "add", cardBonusReal(ctx, 10)),
      perChar(ctx, "cardSet5", 'CardSetBonuses(0,"5") {%_Dmg,_Drop,_and_EXP set', "add", cardSetBonus(ctx, 5)),
      perChar(ctx, "cardSet6", 'CardSetBonuses(0,"6") {%_Drop_Rate set', "add", cardSetBonus(ctx, 6)),
      /* prayersReal(7,0) Midas Minded — equipped prayers are per-character (Prayers_N). */
      perChar(ctx, "prayer7", "prayersReal(7,0) Midas Minded", "add", prayerBonus(ctx, 7, 0)),

      /* --- additive pool: account-wide, now computed ------------------------ */
      term("tomeBonus2", 'Summoning("TomeBonus",2,0) Tome Drop Rate', "add", tomeBonus(ctx, 2)),
      term("stampsDropRate", 'StampBonusOfTypeX("DropRate") Golden Sixes', "add", stampBonusOfType(ctx, "DropRate")),
      T("cardMini5a", 'min(1.5*CardLv("mini5a"),10)', "add",
        Math.min(1.5 * cardLv(ctx, "mini5a"), 10), "computed", `CardLv=${cardLv(ctx, "mini5a")}`),
      T("cardCaves", 'min(4*CardLv("caveC")+6*CardLv("caveD"),100)', "add",
        Math.min(4 * cardLv(ctx, "caveC") + 6 * cardLv(ctx, "caveD"), 100), "computed",
        `caveC lv ${cardLv(ctx, "caveC")}, caveD lv ${cardLv(ctx, "caveD")}`),
      T("cardAnni4", 'min(2*CardLv("anni4Event1"),20)', "add",
        Math.min(2 * cardLv(ctx, "anni4Event1"), 20), "computed", `CardLv=${cardLv(ctx, "anni4Event1")}`),
      T("cardLuck", 'min(3*CardLv("luckEvent1"),25)', "add",
        Math.min(3 * cardLv(ctx, "luckEvent1"), 25), "computed", `CardLv=${cardLv(ctx, "luckEvent1")}`),
      term("friendBonus3", 'Thingies("FriendBonusStatz",3,0) Codex friends', "add", friendBonusStat(ctx, 3)),

      /* --- additive pool: known-unknown families --------------------------- */
      perChar(ctx, "postOffice", 'BoxRewards["DropRate"] Non Predatory Loot Box', "add", boxReward(ctx, "DropRate")),
      term("alchBubbles", 'AlchBubbles["DropRate"] Droppin Loads', "add", alchBubble(ctx, "DropRate")),
      term("starSignsDrop", 'StarSigns["Drop"] Pirate Booty + Druipi Major', "add", starSignDropKey(ctx)),

      todo("lukCurve", "1.4 * f(TotalStats(LUK))", "add", "needs the LUK stack; curve: LUK<1000 ? ((LUK+1)^0.37-1)/40 : 0.5*(LUK-1000)/(LUK+2500)+0.297"),
      /* EtcBonuses("2")=%_DROP_RATE, ("102")=%_DROP_CHANCE (IDforETCbonus @N.js:24604) — the
       * obol portion is computed; worn-equipment unique drop stats aren't in the save (partial). */
      term("etc2", 'EtcBonuses("2") %_DROP_RATE (obol portion)', "add", obolBonus(ctx, "%_DROP_RATE")),
      term("etc102", 'EtcBonuses("102") %_DROP_CHANCE (obol portion)', "add", obolBonus(ctx, "%_DROP_CHANCE")),
      term("guild10", "GuildBonuses(10) Gold Charm", "add", guildBonus(ctx, 10)),
      term("shrine4", "Shrine(4) Clover Shrine", "add", shrineBonus(ctx, 4)),
      term("sigil11", 'Labb("SigilBonus","Blank",11,0) Trove sigil', "add", sigilBonus(ctx, 11)),
      perChar(ctx, "goldFood", 'GoldFoodBonuses("DropRatez")', "add",
        ctx.activeChar == null ? null : goldFoodBonus(ctx, "DropRatez", ctx.activeChar)),
      todo("owl4", 'Summoning("OwlBonuses",4,0)', "add", "Owl formula not read"),
      todo("lankRank9", 'FarmingStuffs("LankRankUpgBonus",9,0)', "add", "not read"),
      todo("bUpg46", 'Holes("B_UPG",46,0)', "add", "cavern building formula not read"),
      todo("cropSC7", 'FarmingStuffs("CropSCbonus",7,0)', "add", "not read"),
      todo("measurement15", 'Holes("MeasurementBonusTOTAL",15,0)', "add", "not read"),
      todo("bUpg82", 'Holes("B_UPG",82,20)', "add", "not read (e=20 variant)"),
      todo("monument26", 'Holes("MonumentROGbonuses",2,6)', "add", "monument (2,6) formula not read"),
      todo("shopUpg50", 'Spelunk("ShopUpgBonus",50,0)', "add", "not read"),

      /* --- post-pool structural steps (consumed by combine, in client order) - */
      perChar(ctx, "chipDR", 'chipBonuses("dr") Grounded Processor [only while total < 5x]', "post",
        chipBonuses(ctx, "dr"), (v) => v, 0),
      T("bunV", "BundlesReceived.bun_v == 1 -> +2", "post", bundles.bun_v === 1 ? 2 : 0, "computed",
        `bun_v=${bundles.bun_v ?? 0}`),
      todo("workbench", 'WorkbenchStuff("AdditionExtraEXPnDR",0,0) [multiplies mid-chain]', "post", "not read"),
      T("opt232", "OptLacc[232] >= 1 -> +0.3", "post", Number(opt[232] ?? 0) >= 1 ? 0.3 : 0, "computed",
        `OptLacc[232]=${opt[232] ?? 0}`),
      T("bunP", "BundlesReceived.bun_p == 1 -> x1.2", "post", bundles.bun_p === 1 ? 1.2 : 1, "computed",
        `bun_p=${bundles.bun_p ?? 0}`),

      /* --- multiplier chain: computed -------------------------------------- */
      T("sushiRoG48", '(1 + SushiStuff("RoG_BonusQTY",48,0)/100)', "mul", 1 + sushi.value / 100, "computed", sushi.note),
      T("cloud69", "(1 + 5*Dreamstuff(CloudBonus,69)/100)", "mul", 1 + 5 * sel.cloudBonus(ctx.s, 69) / 100, "computed",
        `cloud 69 flag=${sel.cloudBonus(ctx.s, 69)}`),
      T("pristine3", '(1 + Ninja("PristineBon",3,0)/100) Cotton Candy', "mul", 1 + veil.value / 100, "computed", veil.note),
      T("vialShip", '(1 + AlchVials["7drMulto"]/100) Ship in a Bottle', "mul", 1 + ship.value / 100, ship.status ?? "computed", ship.note),
      T("comp168", "(1 + 0.3*Companions(168))", "mul", compsUnknown ? 1 : 1 + 0.3 * c168.value,
        compsUnknown ? "unknown" : "computed", compsUnknown ? "companions unknown" : `Companions(168)=${c168.value}`),
      T("comp132mul", "(1 + min(0.5, Companions(132)))", "mul", compsUnknown ? 1 : 1 + Math.min(0.5, c132m.value),
        compsUnknown ? "unknown" : "computed", compsUnknown ? "companions unknown" : `Companions(132)=${c132m.value}`),
      T("compPair", "max(1, min(1.3,1+Companions(26)) * min(1.5,1+0.5*Companions(160)))", "mul",
        compsUnknown ? 1 : Math.max(1, Math.min(1.3, 1 + c26.value) * Math.min(1.5, 1 + 0.5 * c160.value)),
        compsUnknown ? "unknown" : "computed",
        compsUnknown ? "companions unknown" : `Companions(26)=${c26.value}, Companions(160)=${c160.value}`),
      T("comp50mul", "max(1, min(1.01, 1+Companions(50)/2500))", "mul",
        compsUnknown ? 1 : Math.max(1, Math.min(1.01, 1 + c50m.value / 2500)),
        compsUnknown ? "unknown" : "computed", compsUnknown ? "companions unknown" : `Companions(50)=${c50m.value}`),

      /* --- multiplier chain: known-unknown ---------------------------------- */
      todo("arcaneMapMulti", '(1 + ArcaneType("ArcaneMapMulti_bon",0,0)/100)', "mul", "not read"),
      perChar(ctx, "cardBonus101", "(1 + CardBonusREAL(101)/100) +{%_Drop_Rate_Multi cards", "mul",
        cardBonusReal(ctx, 101), (v) => 1 + v / 100),
      todo("glimboDR", 'max(1, Minehead("GlimboDRmulti",0,0))', "mul", "not read"),
      T("tomeBonus7", '(1 + Summoning("TomeBonus",7,0)/100) Tome Drop Multi', "mul",
        1 + tb7.value / 100, tb7.status, tb7.note),
      todo("etc99", '(1 + EtcBonuses("99")/100)', "mul", "EtcBonuses builder"),
      todo("mineheadQty", '(1 + Minehead("BonusQTY",0,0)/100)', "mul", "not read"),
      todo("etc91", '(1 + EtcBonuses("91")/100)', "mul", "EtcBonuses builder"),
    ];
  },
};

/** Convenience with the classic shape. */
export const totalDropRate = (s, opts = {}) => evaluate(dropRate, s, opts);
