/* stats/cash-multi.mjs — recipe for the client's total coin-gain multiplier
 * (ArbitraryCode("MonsterCash")).
 *
 * THE EXPRESSION, verbatim from N.js `_customBlock_ArbitraryCode`, the `if("MonsterCash"==d)`
 * branch, lines 5348-5354 (stitched across the wrapped lines; STR/AGI/WIS bubble arm on 5348-9):
 *
 *   (1 + ( AlchBubbles.CashSTR*floor(TotalStats("STR")/250)
 *        + AlchBubbles.CashAGI*floor(TotalStats("AGI")/250)
 *        + AlchBubbles.CashWIS*floor(TotalStats("WIS")/250) )/100)
 *   * (1 + min(4, Companions(24)))
 *   * Stuff2("CoinDropMulti",0,0)                       // a BARE multiplier, not a percent
 *   * (1 + min(4, Companions(45)))
 *   * (1 + min(4, Companions(159)))
 *   * (1 + 0.5*Summoning("EventShopOwned",9,0))
 *   * (1 + 0.6*Summoning("EventShopOwned",20,0))
 *   * (1 + EtcBonuses("77")/100)                        // gear "money from monsters" stat
 *   * (1 + SushiStuff("RoG_BonusQTY",18,0)/100)
 *   * (1 + SushiStuff("RoG_BonusQTY",37,0)/100)
 *   * (1 + (ResearchStuff("Grid_Bonus",149,0)+ResearchStuff("Grid_Bonus",169,0))/100)
 *   * (1 + EtcBonuses("100")/100)                       // gear "class exp multi" arm reused for cash
 *   * (1 + GetSetBonus("GOLD_SET","Bonus",0,0)/100)
 *   * (1 + Holes("GambitBonuses",7,0)/100)
 *   * (1 + 250*BundlesReceived.bun_y/100)
 *   * (1 + max(1, getbonus2(1,433,-1))*getLOG(OptionsListAccount[362])/100)   // Dustwalker (WW)
 *   * (1 + (MealBonus("Cash") + Sailing("ArtifactBonus",1,0)
 *          + (Summoning("RooBonuses",6,0) + Summoning("VotingBonusz",34,0)))/100)
 *   * (1 + (0.5*Breeding("PetArenaBonus","0",5,0) + Thingies("FriendBonusStatz",5,0)
 *          + (Breeding("PetArenaBonus","0",14,0) + ArbitraryCode("StatueBonusGiven19")/100)))
 *   * (1 + (MainframeBonus(9)
 *          + (Summoning("VaultUpgBonus",34,0)*Summoning("VaultKillzTotal",8,0)
 *          +  Summoning("VaultUpgBonus",37,0)*Summoning("VaultKillzTotal",9,0)))/100)
 *   * (1 + Ninja("PristineBon",16,0)/100)
 *   * (1 + prayersReal(8,0)/100)                        // Jawbreaker
 *   * (1 + (Divinity("Bonus_Minor",-1,3) + FarmingStuffs("CropSCbonus",4,0))/100)
 *   * (1 + ( GetTalentNumber(1,657) + AlchVials.MonsterCash
 *          + (EtcBonuses("3")                            // gear+obol "cash from gear" stat
 *          + (CardBonusREAL(11) + 7*CardLv("w5b1")
 *          + (GetTalentNumber(1,22)
 *          + (FlurboShop(4)
 *          + (ArcadeBonus(10)+ArcadeBonus(11))
 *          + (BoxRewards["13c"]
 *          + (GuildBonuses(8)*(1+floor(CurrentMap/50))
 *          + (TalentCalc(643) + (TalentCalc(644)
 *          + (GoldFoodBonuses("MonsterCash")
 *          + Summoning("VaultUpgBonus",17,0)*getLOG(OptionsListAccount[340])
 *          + (5*AchieveStatus(235) + (10*AchieveStatus(350) + (20*AchieveStatus(376)
 *          + (Summoning("VaultUpgBonus",2,0)
 *          + (Summoning("VaultUpgBonus",14,0)*Summoning("VaultKillzTotal",4,0)
 *          + (Summoning("VaultUpgBonus",31,0)*Summoning("VaultKillzTotal",7,0)
 *          + (OptionsListAccount[420]
 *          + Summoning("VaultUpgBonus",70,0)*Stuff2("CardsCollected",0,0)))))))))))))))))))/100)
 *
 * COVERAGE (2026-07-19, first cut). Computed from the save via the shared bonuses/ evaluators:
 * companions 24/45/159, event shops 9/20, both Sushi RoG arms, the Gold-per-world guild bonus,
 * the two flat vault cash rows (2, 17×log) and vault70×CardsCollected, Jawbreaker prayer,
 * Harriep minor divinity, the equipped +%Money card (CardBonusREAL 11), the passive w5b1 card,
 * the two arcade money rows, the three cash achievements, the Codex money friend, opt420 ninja
 * cash, and the cash-bundle flat. Honest UNKNOWNS (neutral element, lower bound): the STR/AGI/WIS
 * bubble arm (needs the per-character TotalStats stack, the biggest gap), Stuff2("CoinDropMulti"),
 * every EtcBonuses gear stat (77/100/3 — worn equipment is not in the save), the Gambit and
 * VaultKillzTotal accumulators, MealBonus("Cash"), the AlchVials MonsterCash vial, the Dustwalker
 * WW talent, GoldFoodBonuses, the two per-character cash talents (657/22), the two TalentCalc
 * arms (643/644), FlurboShop, the "13c" post-office box, PetArena/Statue, GOLD_SET, the research
 * grid 149/169 nodes, CropSCbonus, and MainframeBonus(9). The total is therefore a LOWER BOUND.
 *
 * Per-character: TotalStats, GetTalentNumber, equipped cards, prayers, minor divinity, and the
 * Guild-per-world map multiplier all read the active character -> activeCharSensitive = true;
 * the account-collapsed view leaves those at their neutral element (status "per-char").
 */

import { sel } from "../savemap.mjs";
import { T, term, evaluate } from "./engine.mjs";
import { getLOG } from "../bonuses/util.mjs";
import { COMPANION_VAL } from "../../gamedata/gamedata.mjs";
import { companion } from "../bonuses/companions.mjs";
import { eventShopOwned, achieveStatus, setBonus } from "../bonuses/misc.mjs";
import { sushiRoG } from "../bonuses/sushi.mjs";
import { gridBonus } from "../bonuses/research.mjs";
import { vaultUpgBonus, votingBonus } from "../bonuses/summoning.mjs";
import { guildBonus } from "../bonuses/guild.mjs";
import { prayerBonus } from "../bonuses/prayers.mjs";
import { divinityMinorBonus } from "../bonuses/divinity.mjs";
import { cardBonusReal, cardLv } from "../bonuses/cards.mjs";
import { arcadeBonus } from "../bonuses/arcade.mjs";
import { friendBonusStat } from "../bonuses/thingies.mjs";
import { artifactBonus } from "../bonuses/sailing.mjs";
import { mainframeBonus } from "../bonuses/lab.mjs";
import { goldFoodBonus } from "../bonuses/goldfood.mjs";

/** A per-ACTIVE-CHARACTER term (see stats/drop-rate.mjs). frag=null -> needs an active char;
 *  neutral element in the collapsed view, real value in evaluatePerChar's byChar results. */
function perChar(ctx, id, key, kind, frag, wrap = (v) => v, neutral = kind === "mul" ? 1 : 0) {
  if (frag === null) {
    if (!ctx._perCharFlagged) {
      ctx._perCharFlagged = true;
      ctx.unknown("account view only: per-character terms (stat bubbles, talents, equipped cards, prayers, minor divinity, guild-per-world) sit at their neutral element here — pick a character to resolve them");
    }
    return T(id, key, kind, neutral, "per-char", "resolved in the per-character view");
  }
  const f = typeof frag === "number" ? { value: frag } : frag;
  return T(id, key, kind, wrap(f.value), f.status ?? "computed", f.note ?? "", f.parts);
}

/** An additive companion term (the client takes Companions(id), capped by min(4,·) in combine). */
function compAdd(ctx, id, termId) {
  const c = companion(ctx, id);
  if (c.owned === null)
    return T(termId, `Companions(${id})`, "mul", 0, "unknown", `ownership unknown -> would be +min(4,${COMPANION_VAL[id]}) if owned`);
  return T(termId, `Companions(${id})`, "mul", c.value, "computed", c.owned ? `owned -> Companions(${id})=${c.value}` : "not owned");
}

/** A leaf we have not implemented yet. Neutral additive element (combine wraps it in 1+…/…). */
const todo = (id, key, kind, why) => T(id, key, kind, 0, "unknown", why);
/** A BARE multiplicative leaf (client multiplies the raw value, no 1+): neutral element is 1. */
const todoBare = (id, key, why) => T(id, key, "mul", 1, "unknown", why);
/** Call a table-guarded evaluator; on an unverified-id throw, degrade to an honest unknown. */
function safe(ctx, fn, note) {
  try {
    const f = fn();
    if (f === null) return null;
    return typeof f === "number" ? { value: f } : f;
  } catch (e) {
    ctx.unknown(`${note} -> ${e.message}`);
    return { value: 0, status: "unknown", note };
  }
}

export const DISPLAY = {
  bubbles: { label: "Cash bubbles (STR/AGI/WIS)", where: "Alchemy → Penny/Dollar/Nickel bubbles",
    how: "+1 tier of cash per 250 of each main stat — needs the per-character stat stack (not modelled yet)." },
  comp24: { label: "Pet: cash multiplier", where: "Pets (followers)", flag: true, how: "×(1+min(4, bonus)) while owned." },
  coinDropMulti: { label: "Coin Drop Multi", where: "Stuff2 accumulator", how: "Not decoded yet." },
  comp45: { label: "Pet: Equinox Broadbass", where: "Pets (followers)", flag: true, how: "×(1+min(4, bonus)) while owned." },
  comp159: { label: "Pet: Potluck", where: "Pets (followers)", flag: true, how: "×(1+min(4, bonus)) while owned." },
  eventShop9: { label: "Event shop cash (a)", where: "Limited-time event shop", flag: true, how: "×1.5 once owned." },
  eventShop20: { label: "Event shop cash (b)", where: "Limited-time event shop", flag: true, how: "×1.6 once owned." },
  etc77: { label: "Gear: +% Money from Monsters", where: "Worn equipment", how: "Worn-gear stat — not in the save (lower bound)." },
  sushi18: { label: "Sushi bar cash (a)", where: "W7 Sushi Station", how: "Threshold set bonus." },
  sushi37: { label: "Sushi bar cash (b)", where: "W7 Sushi Station", how: "Threshold set bonus." },
  grid149: { label: "Research grid: cash (a)", where: "W7 Research grid", how: "Node level; coeff not verified yet." },
  grid169: { label: "Research grid: cash (b)", where: "W7 Research grid", how: "Node level; coeff not verified yet." },
  etc100: { label: "Gear: +% cash (extra)", where: "Worn equipment", how: "Worn-gear stat — not in the save (lower bound)." },
  goldSet: { label: "Gold armor set", where: "Armor sets", how: "Flat multiplier once perma-unlocked; set value not verified yet." },
  gambit7: { label: "Gambit bonus (cash)", where: "The Cavern → Gambit", how: "Gambit-points accumulator — not decoded yet." },
  bunY: { label: "Gem bundle (+250%)", where: "Gem shop bundle", flag: true, how: "Flat ×3.5 while owned." },
  dustwalker: { label: "Dustwalker (Wind Walker)", where: "Wind Walker talents", how: "Best-across-account talent × log10(kills) — not modelled yet." },
  mealCash: { label: "Meal: +% cash", where: "W4 Cooking → meals", how: "Meal level × coeff — MealINFO row not verified yet." },
  sailArti1: { label: "Sailing artifact: Maneki Kat", where: "Sailing → Artifacts", how: "+% cash per tier; artifact row not verified yet." },
  roo6: { label: "Kangaroo: cash", where: "W6 Kangaroo", how: "RooBonuses accumulator — not decoded yet." },
  vote34: { label: "Weekly ballot: cash", where: "W2 Town Ballot", flag: true, how: "Only in cash-vote weeks; active vote is runtime state." },
  petArena5: { label: "Pet arena: cash (a)", where: "Breeding → Pet Arena", how: "Arena wave milestone — not decoded yet." },
  friend5: { label: "Codex friend: cash", where: "Codex → Friends", how: "Needs a friend slotted on the cash bonus; scales with their weekly points." },
  petArena14: { label: "Pet arena: cash (b)", where: "Breeding → Pet Arena", how: "Arena wave milestone — not decoded yet." },
  statue19: { label: "Statue: Cash Statue", where: "W1 Statues", how: "StatueBonusGiven19 — not decoded yet." },
  mainframe9: { label: "Lab: cash node", where: "Lab mainframe", how: "Node bonus; LabMainBonus(9) not verified yet." },
  vault34Kills: { label: "Vault: cash per kill (a)", where: "Upgrade Vault", how: "Vault row × total kills — kill accumulator not decoded." },
  vault37Kills: { label: "Vault: cash per bubble level", where: "Upgrade Vault", how: "Vault row × total bubble levels — accumulator not decoded." },
  pristine16: { label: "Pristine charm: cash", where: "W6 Sneaking → Pristine charms", how: "Charm value not verified yet." },
  prayer8: { label: "Prayer: Jawbreaker", where: "W3 Worship prayers", how: "Equipped prayer (or superbit passive), minus its curse." },
  divMinor3: { label: "Divinity: Harriep minor", where: "W5 Divinity", how: "Minor god link on Harriep (type 3); scales with Divinity level." },
  cropSC4: { label: "Farming: Crop Supercharge (cash)", where: "W6 Farming", how: "Not decoded yet." },
  talent657: { label: "Talent: cash (a)", where: "Character talents", how: "Per-char talent 657 — curve not verified yet." },
  vialCash: { label: "Vial: cash", where: "Alchemy → Vials", how: "The MonsterCash vial — row not verified yet." },
  etc3: { label: "Gear+obol: cash from gear", where: "Worn equipment + obols", how: "Worn-gear portion not in the save (lower bound)." },
  card11: { label: "Equipped +% Money cards", where: "Cards → this character's slots", how: "Sum of equipped '+% Money from Monsters' cards." },
  cardW5b1: { label: "Passive card: w5b1", where: "Cards → w5b1 (auto-passive)", how: "7% per card star level." },
  talent22: { label: "Talent: cash (b)", where: "Character talents", how: "Per-char talent 22 — curve not verified yet." },
  flurbo4: { label: "Dungeon: cash", where: "Dungeons → Flurbo shop", how: "FlurboShop(4) not decoded yet." },
  arcade10: { label: "Arcade: cash", where: "W2 Arcade → Gold Ball Shop", how: "Decay row; ×2 with the Spirit Reindeer pet." },
  arcade11: { label: "Arcade: drop→cash", where: "W2 Arcade → Gold Ball Shop", how: "Decay row; ×2 with the Spirit Reindeer pet." },
  box13c: { label: "Post office: cash box", where: "Post Office", how: "BoxRewards[\"13c\"] — row not verified yet." },
  guild8Map: { label: "Guild: Cash per world", where: "Guild → bonuses", how: "×(1+floor(map/50)) per world; map multiplier unread (lower bound)." },
  talentCalc643: { label: "Star talent: Coins for Charon", where: "Star talents", how: "× multikill tiers — not modelled yet." },
  talentCalc644: { label: "Star talent: American Tipper", where: "Star talents", how: "× cooking level/10 — not modelled yet." },
  goldFoodCash: { label: "Golden food: Golden Bread", where: "Golden foods (equipped + beanstalk)", how: "GoldFoodBonuses(MonsterCash) — per-character; lower bound (×GfoodMulti unread)." },
  vault17Log: { label: "Vault: cash per kill total", where: "Upgrade Vault", how: "Vault row × log10(total kills)." },
  ach235: { label: "Achievement (cash a)", where: "Achievements", how: "+5% flat when done." },
  ach350: { label: "Achievement (cash b)", where: "Achievements", how: "+10% flat when done." },
  ach376: { label: "Achievement (cash c)", where: "Achievements", how: "+20% flat when done." },
  vault2: { label: "Vault: flat cash", where: "Upgrade Vault", how: "+% per level." },
  vault14Kills: { label: "Vault: cash per kill (b)", where: "Upgrade Vault", how: "Vault row × total kills — accumulator not decoded." },
  vault31Kills: { label: "Vault: cash per kill (c)", where: "Upgrade Vault", how: "Vault row × total kills — accumulator not decoded." },
  opt420: { label: "Ninja extra cash", where: "W6 Ninja", how: "Flat +% from the ninja KO counter." },
  vault70Cards: { label: "Vault: cash per card collected", where: "Upgrade Vault", how: "Vault row × number of cards collected." },
};

export const cashMulti = {
  name: "cashMulti",
  label: "Cash Multiplier",
  display: DISPLAY,
  activeCharSensitive: () => true,

  /** Reconstructs the verbatim nested expression from the named leaves (kinds are descriptive;
   *  the total is built here, not from the engine's pool/mul). Missing/unknown leaves carry
   *  their neutral element, so the result is an honest lower bound. */
  combine: ({ terms }) => {
    const v = (id) => { const t = terms.find((x) => x.id === id); return t ? Number(t.value) || 0 : 0; };
    let e = 1 + v("bubbles") / 100;
    e *= 1 + Math.min(4, v("comp24"));
    e *= v("coinDropMulti") || 1;
    e *= 1 + Math.min(4, v("comp45"));
    e *= 1 + Math.min(4, v("comp159"));
    e *= 1 + 0.5 * v("eventShop9");
    e *= 1 + 0.6 * v("eventShop20");
    e *= 1 + v("etc77") / 100;
    e *= 1 + v("sushi18") / 100;
    e *= 1 + v("sushi37") / 100;
    e *= 1 + (v("grid149") + v("grid169")) / 100;
    e *= 1 + v("etc100") / 100;
    e *= 1 + v("goldSet") / 100;
    e *= 1 + v("gambit7") / 100;
    e *= 1 + 250 * v("bunY") / 100;
    e *= 1 + v("dustwalker") / 100;
    e *= 1 + (v("mealCash") + v("sailArti1") + (v("roo6") + v("vote34"))) / 100;
    e *= 1 + (0.5 * v("petArena5") + v("friend5") + (v("petArena14") + v("statue19") / 100));
    e *= 1 + (v("mainframe9") + (v("vault34Kills") + v("vault37Kills"))) / 100;
    e *= 1 + v("pristine16") / 100;
    e *= 1 + v("prayer8") / 100;
    e *= 1 + (v("divMinor3") + v("cropSC4")) / 100;
    const pool =
      v("talent657") + v("vialCash") + v("etc3") + v("card11") + v("cardW5b1") + v("talent22") +
      v("flurbo4") + v("arcade10") + v("arcade11") + v("box13c") + v("guild8Map") +
      v("talentCalc643") + v("talentCalc644") + v("goldFoodCash") + v("vault17Log") +
      v("ach235") + v("ach350") + v("ach376") + v("vault2") + v("vault14Kills") +
      v("vault31Kills") + v("opt420") + v("vault70Cards");
    e *= 1 + pool / 100;
    return e;
  },

  terms(ctx) {
    const opt = ctx.s.get("OptionsListAccount") ?? ctx.s.get("OptLacc") ?? [];
    const bundles = ctx.s.get("BundlesReceived") ?? {};
    const grid149 = safe(ctx, () => gridBonus(ctx, 149), 'ResearchStuff("Grid_Bonus",149,0) coeff not verified');
    const grid169 = safe(ctx, () => gridBonus(ctx, 169), 'ResearchStuff("Grid_Bonus",169,0) coeff not verified');
    const goldSet = safe(ctx, () => setBonus(ctx, "GOLD_SET"), 'GetSetBonus("GOLD_SET") value not verified');
    const sailArti1 = safe(ctx, () => artifactBonus(ctx, 1), 'Sailing("ArtifactBonus",1,0) Maneki Kat not verified');
    const vote34 = safe(ctx, () => votingBonus(ctx, 34), 'Summoning("VotingBonusz",34,0) pct not verified');
    const mainframe9 = safe(ctx, () => mainframeBonus(ctx, 9), "MainframeBonus(9) node not verified");
    const arcade10 = arcadeBonus(ctx, 10), arcade11 = arcadeBonus(ctx, 11);
    const friend5 = friendBonusStat(ctx, 5);
    const cardsCollected = Object.values(sel.cardsCollected(ctx.s) ?? {}).filter((n) => Number(n) > 0).length;
    const vault17 = vaultUpgBonus(ctx, 17), vault70 = vaultUpgBonus(ctx, 70);
    const log340 = getLOG(opt[340]);

    return [
      /* --- multiplicative factors (each its own client bracket) ------------- */
      todo("bubbles", 'AlchBubbles.Cash{STR,AGI,WIS}*floor(TotalStats/250)', "add",
        "needs the per-character STR/AGI/WIS total-stat stack (not modelled) — the biggest cash gap"),
      compAdd(ctx, 24, "comp24"),
      todoBare("coinDropMulti", 'Stuff2("CoinDropMulti",0,0) BARE', "Coin Drop Multi accumulator not decoded"),
      compAdd(ctx, 45, "comp45"),
      compAdd(ctx, 159, "comp159"),
      T("eventShop9", 'Summoning("EventShopOwned",9,0)', "add", eventShopOwned(ctx, 9) ?? 0, "computed", "event-shop cash flag a"),
      T("eventShop20", 'Summoning("EventShopOwned",20,0)', "add", eventShopOwned(ctx, 20) ?? 0, "computed", "event-shop cash flag b"),
      todo("etc77", 'EtcBonuses("77") +%_Money_from_Monsters (gear)', "add", "worn-equipment stat not in the save (lower bound)"),
      term("sushi18", 'SushiStuff("RoG_BonusQTY",18,0)', "add", safe(ctx, () => sushiRoG(ctx, 18), 'SushiStuff("RoG_BonusQTY",18,0) not verified')),
      term("sushi37", 'SushiStuff("RoG_BonusQTY",37,0)', "add", safe(ctx, () => sushiRoG(ctx, 37), 'SushiStuff("RoG_BonusQTY",37,0) not verified')),
      term("grid149", 'ResearchStuff("Grid_Bonus",149,0)', "add", grid149),
      term("grid169", 'ResearchStuff("Grid_Bonus",169,0)', "add", grid169),
      todo("etc100", 'EtcBonuses("100") (gear)', "add", "worn-equipment stat not in the save (lower bound)"),
      term("goldSet", 'GetSetBonus("GOLD_SET","Bonus",0,0)', "add", goldSet),
      todo("gambit7", 'Holes("GambitBonuses",7,0)', "add", "Gambit-points accumulator not decoded"),
      T("bunY", "BundlesReceived.bun_y", "add", Number(bundles.bun_y ?? 0), "computed", `bun_y=${bundles.bun_y ?? 0} -> +${250 * Number(bundles.bun_y ?? 0)}%`),
      todo("dustwalker", "max(1,getbonus2(1,433,-1))*getLOG(OptLacc[362])", "add", "Wind Walker Dustwalker talent (best across account) not modelled"),
      todo("mealCash", 'MealBonus("Cash")', "add", "MealINFO cash row not verified"),
      term("sailArti1", 'Sailing("ArtifactBonus",1,0) Maneki Kat', "add", sailArti1),
      todo("roo6", 'Summoning("RooBonuses",6,0)', "add", "kangaroo RooBonuses accumulator not decoded"),
      term("vote34", 'Summoning("VotingBonusz",34,0)', "add", vote34),
      todo("petArena5", 'Breeding("PetArenaBonus","0",5,0)', "add", "pet arena milestone not decoded"),
      T("friend5", 'Thingies("FriendBonusStatz",5,0) Codex cash friend', "add", friend5.value, friend5.status ?? "computed", friend5.note),
      todo("petArena14", 'Breeding("PetArenaBonus","0",14,0)', "add", "pet arena milestone not decoded"),
      todo("statue19", 'ArbitraryCode("StatueBonusGiven19")', "add", "cash statue accumulator not decoded"),
      term("mainframe9", "MainframeBonus(9)", "add", mainframe9),
      todo("vault34Kills", 'Summoning("VaultUpgBonus",34,0)*Summoning("VaultKillzTotal",8,0)', "add", "VaultKillzTotal accumulator not decoded"),
      todo("vault37Kills", 'Summoning("VaultUpgBonus",37,0)*Summoning("VaultKillzTotal",9,0)', "add", "vault×bubble-levels accumulator not decoded"),
      todo("pristine16", 'Ninja("PristineBon",16,0)', "add", "pristine charm 16 value not verified"),
      perChar(ctx, "prayer8", "prayersReal(8,0) Jawbreaker", "add", prayerBonus(ctx, 8, 0)),
      perChar(ctx, "divMinor3", 'Divinity("Bonus_Minor",-1,3) Harriep', "add",
        ctx.activeChar == null ? null : divinityMinorBonus(ctx, ctx.activeChar, 3)),
      todo("cropSC4", 'FarmingStuffs("CropSCbonus",4,0)', "add", "crop supercharge cash arm not decoded"),

      /* --- the final additive pool (one client bracket, /100) --------------- */
      todo("talent657", "GetTalentNumber(1,657)", "add", "per-char cash talent 657 curve not verified"),
      todo("vialCash", "AlchVials.MonsterCash", "add", "MonsterCash vial row not verified"),
      todo("etc3", 'EtcBonuses("3") cash from gear+obols', "add", "worn-gear portion not in the save (lower bound)"),
      perChar(ctx, "card11", "CardBonusREAL(11) +%_Money_from_Monsters cards", "add", cardBonusReal(ctx, 11)),
      T("cardW5b1", '7*CardLv("w5b1")', "add", 7 * cardLv(ctx, "w5b1"), "computed", `CardLv("w5b1")=${cardLv(ctx, "w5b1")}`),
      todo("talent22", "GetTalentNumber(1,22)", "add", "per-char cash talent 22 curve not verified"),
      todo("flurbo4", "FlurboShop(4)", "add", "dungeon flurbo cash shop not decoded"),
      T("arcade10", "ArcadeBonus(10)", "add", arcade10.value, arcade10.status, arcade10.note),
      T("arcade11", "ArcadeBonus(11)", "add", arcade11.value, arcade11.status, arcade11.note),
      todo("box13c", 'BoxRewards["13c"]', "add", "post-office cash box row not verified"),
      T("guild8Map", "GuildBonuses(8)*(1+floor(CurrentMap/50))", "add", guildBonus(ctx, 8).value, "partial",
        `${guildBonus(ctx, 8).note}; ×(1+floor(map/50)) world multiplier unread (≥1) -> lower bound`),
      todo("talentCalc643", "TalentCalc(643) Coins for Charon×multikill", "add", "multikill-tier scaling not modelled"),
      todo("talentCalc644", "TalentCalc(644) American Tipper×cookingLv/10", "add", "cooking-level scaling not modelled"),
      perChar(ctx, "goldFoodCash", 'GoldFoodBonuses("MonsterCash")', "add",
        ctx.activeChar == null ? null : goldFoodBonus(ctx, "MonsterCash", ctx.activeChar)),
      T("vault17Log", "VaultUpgBonus(17)*getLOG(OptLacc[340])", "add", vault17 * log340, "computed",
        `UpgVault(17)=${vault17.toFixed(2)} × log10(max(1,${Number(opt[340] ?? 0)}))=${log340.toFixed(3)}`),
      T("ach235", "5*AchieveStatus(235)", "add", 5 * (achieveStatus(ctx, 235) ? 1 : 0), "computed", `ach235=${achieveStatus(ctx, 235)}`),
      T("ach350", "10*AchieveStatus(350)", "add", 10 * (achieveStatus(ctx, 350) ? 1 : 0), "computed", `ach350=${achieveStatus(ctx, 350)}`),
      T("ach376", "20*AchieveStatus(376)", "add", 20 * (achieveStatus(ctx, 376) ? 1 : 0), "computed", `ach376=${achieveStatus(ctx, 376)}`),
      T("vault2", "Summoning(VaultUpgBonus,2,0)", "add", vaultUpgBonus(ctx, 2), "computed", `UpgVault(2)=${vaultUpgBonus(ctx, 2).toFixed(2)}`),
      todo("vault14Kills", "VaultUpgBonus(14)*VaultKillzTotal(4)", "add", "VaultKillzTotal accumulator not decoded"),
      todo("vault31Kills", "VaultUpgBonus(31)*VaultKillzTotal(7)", "add", "VaultKillzTotal accumulator not decoded"),
      T("opt420", "OptionsListAccount[420] ninja extra cash", "add", Number(opt[420] ?? 0), "computed", `OptLacc[420]=${Number(opt[420] ?? 0)}`),
      T("vault70Cards", "VaultUpgBonus(70)*Stuff2(CardsCollected)", "add", vault70 * cardsCollected, "computed",
        `UpgVault(70)=${vault70.toFixed(2)} × ${cardsCollected} cards collected`),
    ];
  },
};

/** Convenience with the classic shape. */
export const totalCashMulti = (s, opts = {}) => evaluate(cashMulti, s, opts);
