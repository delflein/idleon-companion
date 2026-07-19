/* bonuses/summoning.mjs — _customBlock_Summoning: the upgrade vault, summoning winner
 * bonuses, event shop flags, voting. */

import { sel } from "../savemap.mjs";
import {
  VAULT_COEFF, VAULT_NO_MASTERY,
  SUMMON_ENEMY_NAMES, SUMMON_ENEMY_SLOT, SUMMON_ENEMY_VAL, SUMMON_ENDLESS_SLOT, SUMMON_ENDLESS_VAL,
} from "../../gamedata/gamedata.mjs";
import { artifactBonus } from "./sailing.mjs";
import { emperorBon, legendPts } from "./thingies.mjs";
import { setBonus, eventShopOwned } from "./misc.mjs";
import { pristineBon } from "./ninja.mjs";
import { companion } from "./companions.mjs";
import { arcadeBonusRaw } from "./arcade.mjs";
import { sushiRoG } from "./sushi.mjs";
import { VOTE_BALLOT_CATEGORIES, MERITOCRACY_CATEGORIES, meritocracyMult } from "../../gamedata/gamedata-w2-ballot.mjs";
import { clamWorkBonusNum } from "./clamwork.mjs";
import { SUMMON_UPGRADES, unitHpMultiplier, unitDmgMultiplier } from "../../gamedata/gamedata-w6-summoning.mjs";

/** Summoning("VaultUpgBonus",b,0) = UpgVault[b] * UpgradeVault[b][5], times the mastery of its
 *  band UNLESS b is in the client's exempt chain. Bands: <32 -> Mastery I(32), <61 -> II(61),
 *  <89 -> III(89). The mastery ids are themselves exempt, so this bottoms out. Tables complete
 *  in gamedata -> generic over every vault id. */
export function vaultUpgBonus(ctx, b) {
  const v = sel.upgVault(ctx.s);
  const raw = Number(v[b] ?? 0) * (VAULT_COEFF[b] ?? 0);
  if (VAULT_NO_MASTERY.includes(b)) return raw;
  const m = b < 32 ? 32 : b < 61 ? 61 : 89;
  return raw * (1 + vaultUpgBonus(ctx, m) / 100);
}

/** Summoning("EventShopOwned",b,0) moved to misc.mjs (cycle-free for lower modules);
 *  re-exported here to keep the dispatcher-named home discoverable. */
export { eventShopOwned, achieveStatus } from "./misc.mjs";

/** Summoning("VotingBonusz",b,0) = <pct> * multi IFF vote b is the CURRENTLY ACTIVE vote.
 *  The active vote lives in runtime UI state (PixelHelperActor[25]._GenINFO[36]), NOT in the
 *  save — an explicit input (ctx.activeVote); absent, honestly unknown. Verified pcts only. */
/** NinjaInfo[38][1+3b] — the ballot triplet table [desc, value, category]. Extracted rows
 *  cross-checked: index 20 (artifact find) = 31 matches the earlier independent reading.
 *  27 = "Increases_Drop_Rate_for_all_your_characters_by_+{%" -> 38. */
/** VotingBonusz base pcts now come from the full VOTE_BALLOT_CATEGORIES table (gamedata-w2-ballot,
 *  NinjaInfo[38]). The VoteMulti stack is NOT applied here (kept as before, a lower bound / raw
 *  base %) — the multiplied stack lives in bonuses/ballot.mjs::ballotState for the entity/preview. */
const votePct = (b) => Number(VOTE_BALLOT_CATEGORIES[b]?.baseValue);
export function votingBonus(ctx, b) {
  if (!Number.isFinite(votePct(b))) throw new Error(`VotingBonusz(${b}): no VOTE_BALLOT_CATEGORIES[${b}]`);
  if (ctx.activeVote == null) {
    ctx.unknown(`Summoning("VotingBonusz",${b},0) — active vote is runtime UI state, not in the save`);
    return { value: 0, status: "unknown", note: `active vote unknown; 0 unless vote ${b} is live (then +${votePct(b)}% x multi)` };
  }
  const v = ctx.activeVote === b ? votePct(b) : 0;
  return { value: v, note: ctx.activeVote === b ? `vote ${b} active -> +${votePct(b)}% (multi not applied)` : `active vote is ${ctx.activeVote}, not ${b}` };
}

/** Summoning2("MeritocBonusz",b,0) — the W2 Meritocracy weekly bonus. Verbatim:
 *    scene checks (GemShop/Tutorial/PlayerSelect -> 0), then
 *    b == OptLacc[453] ? NinjaInfo[41][1+3b] * MeritocBonuszMulti : 0
 *  THE SELECTION IS IN THE SAVE (OptLacc[453]; OptLacc[472] = voted-this-week flag) — this
 *  term is fully gated from the save, no runtime state needed. Values verified per-id in
 *  MERITOC_VAL (NinjaInfo[41] triplets, cross-checked against IdleonToolbox's parse).
 *  MeritocBonuszMulti = [map-250 unlock gate] * (1 + Companions(161)/100)
 *    * (min(1, max(.25, .25 + (OptLacc[472]==1))) + (5*ClamWorkBonus(3) + Companions(39)
 *       + LegendPTS_bonus(24) + ArcadeBonus(59) + 20*EventShopOwned(23) + RoG(51))/100)
 *  ClamWorkBonus and the map gate are not read -> when the category IS selected the value is
 *  partial (floor); when it is not selected the 0 is exact. */
/** Meritocracy base values now come from the full MERITOCRACY_CATEGORIES table (gamedata-w2-ballot,
 *  NinjaInfo[41]) — generic over all 28 categories. Only the SELECTED category (OptLacc[453]) pays;
 *  every other category returns an exact 0. The multiplier is the verbatim meritocracyMult with
 *  ClamWorkBonus(3) and the KillsLeft2Advance[250] map gate unread (floor / lower bound). */
export const meritocVal = (b) => Number(MERITOCRACY_CATEGORIES[b]?.baseValue);
export function meritocBonusz(ctx, b) {
  if (!Number.isFinite(meritocVal(b))) throw new Error(`MeritocBonusz(${b}): no MERITOCRACY_CATEGORIES[${b}]`);
  const sel453 = Number((ctx.s.get("OptLacc") ?? [])[453] ?? -1);
  if (sel453 !== b)
    return { value: 0, note: `Meritocracy selection OptLacc[453]=${sel453} != ${b} -> 0 (exact)` };
  const voted = Number((ctx.s.get("OptLacc") ?? [])[472] ?? 0) === 1;
  const clamWork3 = clamWorkBonusNum(ctx, 3);              // ClamWorkBonus(3) — now DECODED (0/1 gate)
  const multi = meritocracyMult({
    poppyBonus: companion(ctx, 161).value,
    canVote: voted ? 1 : 0,
    clamWorkBonus: clamWork3,                               // 5*ClamWorkBonus(3) applied inside meritocracyMult
    companionBonus: companion(ctx, 39).value,
    legendTalentBonus: legendPts(ctx, 24),
    arcadeBonus: arcadeBonusRaw(ctx.s, 59, ctx.companions?.has(27) ?? false),
    meritocracyEventShopBonus: eventShopOwned(ctx, 23) ?? 0,
    meritocracySushiBonus: sushiRoG(ctx, 51).value,
  });
  ctx.unknown(`MeritocBonusz(${b}) is the SELECTED category — the KillsLeft2Advance[250] map-unlock gate is unread; multi is a floor (ClamWorkBonus(3)=${clamWork3} is now decoded)`);
  return {
    value: meritocVal(b) * multi, status: "partial",
    note: `selected (OptLacc[453]=${b}); base ${meritocVal(b)} x multi floor ${multi.toFixed(3)} (voted=${voted}, clamWork3=${clamWork3})`,
  };
}

/** SummWinBonus slot accumulator: built from Summon[1] (defeated enemies, names starting
 *  "rift" EXCLUDED) plus OptLacc[319] endless wins cycling a 40-long table. Generic — this is
 *  the raw per-slot array the client keeps; WinBonus branches consume it. */
export function summWinSlots(ctx) {
  const W = new Array(32).fill(0);
  for (const nm of (sel.summon(ctx.s)[1] ?? [])) {
    if (String(nm).indexOf("rift") === 0) continue;
    const i = SUMMON_ENEMY_NAMES.indexOf(nm);
    if (i < 0) continue;
    const slot = Math.round((SUMMON_ENEMY_SLOT[i] ?? 0) - 1);
    if (slot >= 0 && slot < 32) W[slot] += SUMMON_ENEMY_VAL[i] ?? 0;
  }
  const endless = Number((ctx.s.get("OptLacc") ?? [])[319] ?? 0);
  for (let g = 0; g < endless; g++) {
    const k = g % 40;
    const slot = Math.round(SUMMON_ENDLESS_SLOT[k] - 1);
    if (slot >= 0 && slot < 32) W[slot] += SUMMON_ENDLESS_VAL[k];
  }
  return W;
}

import { achieveStatus as achieveVal } from "./misc.mjs";

/** Summoning("WinBonus",b,0). All four branches, verbatim from the client (extracted whole,
 *  2026-07-17 — the previous "only b=3 verified" guard is obsolete):
 *    b in {20,22,24,31}   -> raw SummWinBonus[b]  (consumed inside other branches' brackets)
 *    b == 19              -> 3.5*W[b] * pristine * gem * (1 + (Winz + tasks + ach379 + ach373
 *                            + GODSHARD)/100)          // NO WinBonus(31)/EmperorBon(8)
 *    20 <= b <= 33        -> W[b] * pristine * gem * (1 + full bracket)/100)   // NO 3.5
 *    default (3, 9, ...)  -> 3.5*W[b] * pristine * gem * (1 + full bracket/100)
 *  where pristine = (1 + Ninja("PristineBon",8,0)/100)  // Crystal Comb, NjTrP8[3]=30
 *        gem      = (1 + 10*GemItemsPurchased[11]/100)
 *        full bracket = Sailing("ArtifactBonus",32,0) + min(10,Tasks[2][5][4])
 *              + AchieveStatus(379) + AchieveStatus(373) + Summoning("WinBonus",31,0)
 *              + Thingies("EmperorBon",8,0) + GetSetBonus("GODSHARD_SET","Bonus",0,0)
 *  Returns a PERCENT fragment; recipes wrap it (1 + v/100). */
export function winBonus(ctx, b) {
  const W = summWinSlots(ctx);
  if ([20, 22, 24, 31].includes(b)) return { value: W[b], note: `raw SummWinBonus[${b}]=${W[b]}` };
  const winz = artifactBonus(ctx, 32);
  const tasksTerm = Math.min(10, Number(((ctx.s.get("TaskZZ2") ?? [])[5] ?? [])[4] ?? 0));
  // GODSHARD_SET is "}x_Higher_Winners_Bonuses_from_Summoning" (EquipmentSets[..][3][2] = 15).
  // It does NOT need the active character's gear when perma-unlocked in OptLacc[379] —
  // GetSetBonus's first arm pays out on that alone.
  const godshard = setBonus(ctx, "GODSHARD_SET");
  if (!godshard.known) ctx.unknown('GetSetBonus("GODSHARD_SET") [inside WinBonus] — ' + godshard.why);
  const ach = achieveVal(ctx, 379) + achieveVal(ctx, 373);
  const inner = b === 19 ? 0 : W[31] + emperorBon(ctx, 8);
  const bracket = winz.value + tasksTerm + ach + godshard.value + inner;
  const scale = (b >= 20 && b <= 33) ? 1 : 3.5;
  const pristine = pristineBon(ctx, 8).value;
  const gem11 = Number((ctx.s.get("GemItemsPurchased") ?? [])[11] ?? 0);
  const v = scale * W[b] * (1 + pristine / 100) * (1 + 10 * gem11 / 100) * (1 + bracket / 100);
  return {
    value: v,
    status: godshard.known ? "computed" : "partial",
    note: `SummWinBonus[${b}]=${W[b]} x${scale}; CrystalComb +${pristine}%; gem11=${gem11} -> +${10 * gem11}%; bracket=${bracket.toFixed(1)}`,
    parts: [
      { label: "Summoning victories (base)", value: scale * W[b], valueText: `+${(scale * W[b]).toFixed(0)}%`,
        where: "W6 Summoning → win battles & endless", note: `career wins + endless rounds feed the base` },
      { label: "Crystal Comb (pristine charm)", value: 1 + pristine / 100, valueText: `×${(1 + pristine / 100).toFixed(2)}`,
        where: "W6 Sneaking → Pristine charms", note: pristine ? "owned" : "not owned" },
      { label: "Gem shop: Brilliant Winners", value: 1 + 10 * gem11 / 100, valueText: `×${(1 + 10 * gem11 / 100).toFixed(1)}`,
        where: "Gem shop", note: `${gem11} purchases, +10% each` },
      { label: "Winner-bonus multi bracket", value: 1 + bracket / 100, valueText: `×${(1 + bracket / 100).toFixed(2)}`,
        where: "Winz Lantern artifact + tasks + achievements + Emperor + Godshard set",
        note: `Winz ${winz.value} + tasks ${tasksTerm} + ach ${ach} + inner(W31+Emperor8) ${inner} + GODSHARD ${godshard.value}` },
    ],
  };
}

/** Summoning("GrimoireUpgBonus",b,0), verbatim:
 *    b in {9,11,26,36,39,17,32,45} (exempt) -> Grimoire[b] * GrimoireUpg[b][5]
 *    else -> Grimoire[b] * GrimoireUpg[b][5] * (1 + GrimoireUpgBonus(36)/100)
 *  36 = "Writhing_Grimoire" (the everything-multiplier), itself exempt so this bottoms out.
 *  GrimoireUpg[b][5] coeffs verified per-id in GRIMOIRE_COEFF:
 *    17 Grey_Tome_Book 1 · 36 Writhing_Grimoire 1 · 44 Skull_of_Major_Droprate 1. */
export const GRIMOIRE_COEFF = {
  17: 1, 36: 1, 39: 1, 44: 1,   // 39 Skull_of_Major_Talent (exempt)
  /* Farming (GrimoireUpg rows @N.js:23671-23675, 2026-07-18):
   *   9  "Land_Rank_Database_Maxim" +1 max LV 5th-column land ranks/lv, maxLV 10 (EXEMPT)
   *   14 "Sacrifice_of_Harvest" }x Crop Evo, 5/lv, uncapped (not exempt)
   *   22 "Superior_Crop_Research" }x Crop Scientist, 1/lv, maxLV 200 (not exempt) */
  9: 1, 14: 5, 22: 1,
};
const GRIMOIRE_EXEMPT = [9, 11, 26, 36, 39, 17, 32, 45];
export function grimoireUpgBonus(ctx, b) {
  if (!(b in GRIMOIRE_COEFF)) throw new Error(`GrimoireUpgBonus(${b}): GrimoireUpg[${b}][5] not verified in N.js — add to GRIMOIRE_COEFF first`);
  const raw = Number(sel.grimoire(ctx.s)[b] ?? 0) * GRIMOIRE_COEFF[b];
  if (GRIMOIRE_EXEMPT.includes(b)) return raw;
  return raw * (1 + grimoireUpgBonus(ctx, 36) / 100);
}

/* ------------------------------------------------------------------------------------------
 * Ya.SummonUPG army-build tree — Summoning("SummUpgBonus",b,0) and the army HP/DMG multipliers.
 * gamedata-w6-summoning.mjs. SummUpgBonus(b) = (1 + SumStoneTrialz(colour))·level·bonusQty for
 * the COMMON case (stone-trial stacking when stoneTrialFlag==1 && kills>0); the Holes[28]-doubling
 * branch (a rare "doubled upgrades" flag list) and its recursive getbonus2(1,597)/SummUpgBonus(78)
 * term are NOT modelled — degrade to the common-case value (a floor when that branch is active).
 * ------------------------------------------------------------------------------------------ */
export function summUpgBonus(ctx, b) {
  const row = SUMMON_UPGRADES[b];
  if (!row) throw new Error(`SummUpgBonus(${b}): no SUMMON_UPGRADES row (0..81)`);
  const level = sel.summonUpgLevel(ctx.s, b);
  const kills = row.stoneTrialFlag === 1 ? sel.summonStoneKills(ctx.s, row.colour) : 0;
  const value = (1 + Math.max(0, kills)) * level * row.bonusQty;
  return {
    value, status: "computed",
    note: `SummUpg[${b}] "${row.name}" lv ${level} × qty ${row.bonusQty}${kills > 0 ? ` × stone-trial(1+${kills})` : ""} -> ${value}`,
  };
}
const sub = (ctx, b) => summUpgBonus(ctx, b).value;

/** Summoning("UnitHP",-1,0) — total-army HP multiplier. All inputs save-derivable
 *  (highestEndlessLevel = OptLacc[319], totalUpgradeLevels = sum(Summon[0])). No unknowns. */
export function armyHpMultiplier(ctx) {
  const highestEndlessLevel = sel.endlessSummonWins(ctx.s);
  const totalUpgradeLevels = sel.summonTotalUpgLevels(ctx.s);
  const value = unitHpMultiplier({
    b1: sub(ctx, 1), b10: sub(ctx, 10), b35: sub(ctx, 35), b37: sub(ctx, 37),
    b20: sub(ctx, 20), b81: sub(ctx, 81),
    b50: sub(ctx, 50), b59: sub(ctx, 59), b63: sub(ctx, 63),
    b61: sub(ctx, 61), highestEndlessLevel, totalUpgradeLevels,
  });
  return { value, status: "computed", note: `army HP multi ×${value.toFixed(3)} (endless ${highestEndlessLevel}, totalUpg ${totalUpgradeLevels})` };
}

/** Summoning("UnitDMG",-1,0) — total-army DMG multiplier. Two live-battle terms (SummUpgBonus(76)
 *  × GenINFO[185], SummUpgBonus(47) × (GenINFO[124]-GenINFO[123])) are per-match transient state,
 *  NOT save-derivable -> taken as 0 (neutral factor 1), flagged -> LOWER BOUND. */
export function armyDmgMultiplier(ctx) {
  const highestEndlessLevel = sel.endlessSummonWins(ctx.s);
  const totalUpgradeLevels = sel.summonTotalUpgLevels(ctx.s);
  ctx.unknown('Summoning("UnitDMG") — SummUpgBonus(76)×GenINFO[185] and SummUpgBonus(47)×(GenINFO[124]-[123]) are live-battle-only (reset each match); taken as 0 -> lower bound');
  const value = unitDmgMultiplier({
    b3: sub(ctx, 3), b12: sub(ctx, 12), b21: sub(ctx, 21), b31: sub(ctx, 31),
    b43: sub(ctx, 43), b74: sub(ctx, 74),
    b51: sub(ctx, 51), b56: sub(ctx, 56), b64: sub(ctx, 64),
    b76: sub(ctx, 76), b47: sub(ctx, 47), b60: sub(ctx, 60),
    highestEndlessLevel, totalUpgradeLevels, liveBattleTerm76: 0, liveBattleTerm47: 0,
  });
  return { value, status: "partial", note: `army DMG multi ×${value.toFixed(3)} (live-battle spike terms omitted -> lower bound)` };
}
