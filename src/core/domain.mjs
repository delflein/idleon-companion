/* domain.mjs — parses a raw IdleOn save into structured domain entities.
 * Single source of truth for save-parsing on the server side.
 * Reference constants verified against Morta1/IdleonToolbox data (v1.19, 2026-07).
 */
import { openSave, sel, SKILL } from "./savemap.mjs";
import ACHIEVEMENTS_DATA from "../gamedata/achievements-data.mjs";
import { evaluateAll, allMetricRows } from "./stats/index.mjs";
import { makeCtx } from "./stats/engine.mjs";
import { famBonusQTYs, CLASS_FAMILY_BONUSES } from "./bonuses/family.mjs";
import { obolSlots } from "./bonuses/obols.mjs";
import { evaluate } from "./stats/engine.mjs";
import { STAMP_INFO } from "../gamedata/gamedata-stamps.mjs";
import { STATUE_INFO } from "../gamedata/gamedata-statues.mjs";
import { FURNACE_UPGRADES } from "../gamedata/gamedata-forge.mjs";
import { OWL_UPGRADES } from "../gamedata/gamedata-owl.mjs";
import { BRIBES } from "../gamedata/gamedata-bribes.mjs";
import { statueBonusGiven, statueLevel, statueTier } from "./bonuses/statues.mjs";
import { anvilSpeed } from "./stats/anvil-speed.mjs";
import { owlRate } from "./stats/owl-rate.mjs";
import { bubbleEntry } from "./bonuses/bubbles.mjs";
import { vialBonus, sigilBonus, SIGIL_DESC } from "./bonuses/alchemy.mjs";
import { cauldronP2wBonus, liquidCapacity } from "./bonuses/cauldron.mjs";
import { ballotState } from "./bonuses/ballot.mjs";
import { fishPerMinute, shinyFishRate, rooMegafeather } from "./bonuses/fishing.mjs";
import { killroyBonus } from "./bonuses/misc.mjs";
import { BUBBLE_TABLE } from "../gamedata/gamedata-w2-bubbles.mjs";
import { VIAL_INFO } from "../gamedata/gamedata-w2-vials.mjs";
import { CAULDRON_NAMES as CAULD_NAMES, LIQUID_NAMES, CAULDRON_P2W_MAX_LEVELS } from "../gamedata/gamedata-w2-cauldron.mjs";
import { POPPY_UPGRADES, TAR_PIT_UPGRADES, SHINY_MULTI_TIERS, RESET_SPIRAL } from "../gamedata/gamedata-w2-fishing.mjs";
import { KILLROY_SHOP } from "../gamedata/gamedata-w2-killroy.mjs";
import { ISLANDS } from "../gamedata/gamedata-w2-islands.mjs";
import { NUMBER_2_LETTER } from "../gamedata/gamedata.mjs";
import { TOWER_INFO } from "../gamedata/gamedata-w3-towers.mjs";
import { REFINERY_SALTS, REFINERY_BAY_BASE_CYCLE_SECONDS, REFINERY_POWER_CAP_BY_RANK, SALT_LICK_UPGRADES } from "../gamedata/gamedata-w3-refinery.mjs";
import { WORSHIP_TOTEMS } from "../gamedata/gamedata-w3-worship.mjs";
import { ATOM_INFO } from "../gamedata/gamedata-w3-atoms.mjs";
import { PRINTER_SLOT_UNLOCKS } from "../gamedata/gamedata-w3-printer.mjs";
import { SHRINE_INFO } from "./bonuses/shrines.mjs";
import { atomCost, atomMaxLevel, atomBonus } from "./bonuses/atoms.mjs";
import { libraryBonusMultiplier, checkoutBreakpoints } from "./bonuses/library.mjs";
import { worshipCharge } from "./stats/worship-charge.mjs";
import { MEAL_INFO } from "../gamedata/gamedata-w4-meals.mjs";
import { PET_UPGRADES } from "../gamedata/gamedata-w4-breeding.mjs";
import { TERRITORY_PLAYABLE } from "../gamedata/gamedata-w4-territory.mjs";
import { RIFT_TIERS, RIFT_TASK_TYPES, SKILL_MASTERY_RANK_THRESHOLDS, SKILL_MASTERY_UNLOCK_RIFT } from "../gamedata/gamedata-w4-rift.mjs";
import { COOKING_MASTERY_CATEGORIES } from "../gamedata/gamedata-w4-cooking.mjs";
import { mealBonus, bonusMultiCook, ribbonBonus, cookingMealBonusMulti } from "./bonuses/meals.mjs";
import { kitchenLadles, mealLevelCap, mealCostToNext } from "./bonuses/cooking.mjs";
import { petUpgBonus, shinyLevel } from "./bonuses/breeding.mjs";
import { SUPERBITS, superbitCost, FERTILIZER_UPGRADES, IMPORT_TOOLS, MUTANT_SPROUT_NAMES_INFERRED, maxSnailLV } from "../gamedata/gamedata-w5-gaming.mjs";
import { GAMING_PALETTE } from "../gamedata/gamedata-w5-palette.mjs";
import { GODS_INFO_FULL, DIV_STYLES } from "../gamedata/gamedata-w5-divinity.mjs";
import { VILLAGERS, CAVERNS, cavernsOwned } from "../gamedata/gamedata-w5-hole.mjs";
import { SLAB_ITEM_SORT_COUNT, SLAB_OF_LEGEND_THRESHOLDS, SLAB_ARTIFACT_BONUSES, SLAB_BONUSES } from "../gamedata/gamedata-w5-slab.mjs";
import { superBitType, snailBitMulti, paletteBonus } from "./bonuses/gaming.mjs";
import { blessingMaxLv, blessingMajorValue, blessingCostToNext, blessingCurrencyOnHand } from "./bonuses/divinity.mjs";
import { villagerExp, villagerExpTerms } from "./stats/villager-exp.mjs";
import { SUMMON_UPGRADES, SUMMONING_STONES, summoningStoneEssenceMultiplier, SUMMON_ENDLESS_DIFFICULTY, SUMMON_ENDLESS_DIFFICULTY_TEXT } from "../gamedata/gamedata-w6-summoning.mjs";
import { NINJA_UPGRADES, GEMSTONES, PRISTINE_CHARMS, JADE_EMPORIUM, gachaPristineRollsRemaining, gachaSymbolRollsRemaining } from "../gamedata/gamedata-w6-sneaking.mjs";
import { EMPEROR_BON_WIRING, emperorBossHp, dailyEmperorTries, maxEmperorAttemptStackDisplayed, emperorAttemptsLeft } from "../gamedata/gamedata-w6-emperor.mjs";
import { BEANSTALK_SLOTS, GOLDEN_FOODS, BEANSTALK_RANK_THRESHOLDS } from "../gamedata/gamedata-w6-beanstalk.mjs";
import { emperorBon } from "./bonuses/thingies.mjs";
import { jadeEmporiumOwned, pristineBonAll, gemstoneBonus } from "./bonuses/ninja.mjs";
import { stealth as stealthRecipe } from "./stats/stealth.mjs";
/* --- World 7 (the final world): 12 multiplier-tap systems --------------------------------- */
import { gridNodes, gridOccurrences, gridLevel } from "./bonuses/research.mjs";
import { legendPoints } from "./stats/legend-talents.mjs";
import { LEGEND_TALENTS, legendPtsBonus, legendTalentMaxLv } from "../gamedata/gamedata-w7-legend.mjs";
import { LEGEND_TALENT_COEFF } from "../gamedata/gamedata.mjs";
import { ZENITH_MARKET, zenithMarketBonusValue } from "../gamedata/gamedata-w7-zenith.mjs";
import { CORAL_KID, CORAL_REEF_BUILDINGS, DANCING_CORAL, coralKidUpgBonus } from "../gamedata/gamedata-w7-coralreef.mjs";
import { CLAM_UPG, CLAM_JOB_REWARDS } from "../gamedata/gamedata-w7-clamwork.mjs";
import { SPELUNK_CAVES, SPELUNK_SHOP, BIG_FISH, bigFishBon } from "../gamedata/gamedata-w7-spelunking.mjs";
import { SUSHI_TYPES, SUSHI_ROG_FULL } from "../gamedata/gamedata-w7-sushi.mjs";
import { MINEHEAD_SHOP } from "../gamedata/gamedata-w7-minehead.mjs";
import { BUTTON_TASKS } from "../gamedata/gamedata-w7-button.mjs";
import { GLIMBO_TRADES } from "../gamedata/gamedata-w7-research.mjs";
import { uniqueSushi } from "./bonuses/sushi.mjs";

/* Which character's star signs govern BoatArtiMulti's Artifosho term.
 * The client reads the ACTIVE character (DNSM.StarSigns is built from
 * PersonalValuesMap.StarSign), and which character is active is NOT in the save.
 * We pick the highest-level character that actually has Artifosho equipped: that is a
 * heuristic, not a fact, but it is a far better one than IdleonToolbox's hardcoded
 * characters[0] — which is simply wrong for any account whose sailing character isn't
 * index 0 (this repo's own reference account sails on character 2).
 * Returns null when nobody has it, which makes the term honestly "computed as absent"
 * rather than silently assumed. */
const ARTIFOSHO_SIGN = 61;
export function artifactSourceChar(save) {
  const cands = sel.charsWithStarSign(save, ARTIFOSHO_SIGN);
  if (!cands.length) return save.charIdxs[0] ?? null;
  return cands.reduce((best, i) =>
    (save.at("Lv0_N", i)?.[0] ?? 0) > (save.at("Lv0_N", best)?.[0] ?? 0) ? i : best, cands[0]);
}


export const REF = {
  artifacts: ["Moai Head","Maneki Kat","Ruble Cuble","Fauxory Tusk","Gold Relic","Genie Lamp","Silver Ankh","Emerald Relic","Fun Hippoete","Arrowhead","10 AD Tablet","Ashen Urn","Amberite","Triagulon","Billcye Tri","Frost Relic","Chilled Yarn","Causticolumn","Jade Rock","Dreamcatcher","Gummy Orb","Fury Relic","Cloud Urn","Weatherbook","Giants Eye","Crystal Steak","Trilobite Rock","Opera Mask","Socrates","The True Lantern","The Onyx Lantern","The Shim Lantern","The Winz Lantern","Deathskull","Obsidian","Pointagon","Ender Pearl","Fang of the Gods","Nomenclature","Me First Dollar","Enigma Fragment"],
  artifactTiers: ["—","Base","Ancient","Eldritch","Sovereign","Omnipotent","Transcendent"],
  atoms: ["Hydrogen","Helium","Lithium","Beryllium","Boron","Carbon","Nitrogen","Oxygen","Fluoride","Neon","Sodium","Magnesium","Aluminium","Silicon","Phosphorus"],
  atomCap: 50,

  /* --- sailing ---------------------------------------------------------
   * Captain save shape: [tier, statA, statB, level, xp, valA, valB]
   * Effect = level * value, computed at read time. The stored roll does NOT
   * scale with level (verified: lv1 shop captains roll the same magnitudes as
   * lv20 fleet captains of equal tier).
   * Roll generation: floor(0.15 * randInt(min, maxRoll * (0.5 + 0.8*tier)))
   */
  /* perChest = moves the artifact odds of a single chest.
   * throughput = moves chests-per-hour instead, which is worth just as much for
   *   artifacts/hour — but ONLY while the boat is under the min-travel-time clamp.
   *   Once clamped (Dominik: 51min to every island incl. the furthest), the game
   *   discards the excess via Math.min and the stat is worth exactly zero.
   *   Do not mark Boat Speed universally dead; that is true for him, not for a
   *   newer account that is still distance-bound.
   * Neither flag => no artifact value to anyone at any stage. */
  captainStats: [
    { id: 0, name: "Boat Speed",     maxRoll: 60,  perChest: false, throughput: true,  note: "more trips/hour => more chests/hour, until the min-travel-time clamp binds. Worthless once clamped." },
    { id: 1, name: "Loot Value",     maxRoll: 100, perChest: false, throughput: false, note: "treasure income only — contributes nothing to artifact odds at any stage" },
    { id: 2, name: "Cloud Discover", maxRoll: 100, perChest: false, throughput: false, note: "island reveal only. Dead once all islands unlocked, and guides say ignore it even before that — islands unlock fast, then the slot is wasted forever. Shares maxRoll 100 with Loot Value, so it's the most common high-magnitude junk roll." },
    { id: 3, name: "Artifact Find",  maxRoll: 50,  perChest: true,  throughput: false, note: "feeds the additive pool: BoatArtiMulti = max(1, 1 + (fauxoryTusk + captainArtifact)/100). Worth ~+20% at Dominik's best roll — NOT worthless, contrary to the decompile research (which computed it under the disproved 1.7 exponent)." },
    { id: 4, name: "Rare Chest",     maxRoll: 40,  perChest: true,  throughput: false, note: "the only captain stat that moves chest rarity, i.e. the 1.4^r exponent. Worth ~+33% at Dominik's best roll — the strongest artifact stat." },
  ],

  /* Chest rarity is rolled per trip. VERIFIED in N.js `_customBlock_AddChest` (~line 17748):
   *   roll = randomFloat() / (1 + (CaptBonusCalc(4, Boats[d][0]) + Sailing("ArtifactBonus",9,1)) / 200)
   *   roll < 1e-8   -> 5 (Miracle)
   *   roll < 2.3e-4 -> 4 (Occult)
   *   roll < 0.006  -> 3 (Noble)
   *   roll < 0.04   -> 2 (Gilded)
   *   roll < 0.2    -> 1 (Iron)
   *   else          -> 0 (Basic)
   * then: `5 > rarity ? (chest[0] *= 1.85^rarity, chest[2] *= Math.pow(1.4, rarity))
   *                   : (chest[0] = 20*chest[0],  chest[2] = 30*chest[2])`
   *
   * 1.4 CONFIRMED — `Math.pow(1.4, ...)` is literal in the client. The 1.70^r from the
   * community decompile research is simply wrong.
   * Miracle's flat 30 is ALSO CONFIRMED (the else-branch overrides rather than continuing the
   * curve), so it is no longer suspect despite having reached us via the 1.7-based source.
   *
   * THRESHOLDS CORRECTED 2026-07-17: the previous values (0.25 / 0.05 / 0.007 / 3e-4 / 1e-6)
   * were every one of them wrong — they came from the same unreliable source. The real ladder
   * is above. Iron is 0.2 not 0.25, Occult is 2.3e-4 not 3e-4, and Miracle is 1e-8, a hundred
   * times rarer than we had it.
   */
  chestTiers: [
    { r: 0, name: "Basic",   threshold: 1.0,     artiMulti: 1.0 },
    { r: 1, name: "Iron",    threshold: 0.2,     artiMulti: 1.4 },
    { r: 2, name: "Gilded",  threshold: 0.04,    artiMulti: 1.96 },
    { r: 3, name: "Noble",   threshold: 0.006,   artiMulti: 2.744 },
    { r: 4, name: "Occult",  threshold: 2.3e-4,  artiMulti: 3.8416 },
    { r: 5, name: "Miracle", threshold: 1e-8,    artiMulti: 30 },
  ],
  /* Arrowhead: the rare-chest divisor term is `Sailing("ArtifactBonus",9,1)`, which is NOT a
   * flat 25 — with e==1 the client returns ArtifactInfo[9][6/8/10/12/14] selected by the
   * artifact's TIER (2..6). arrowheadBonus below is the legacy flat value, kept only so the
   * old call sites keep working; artifactChanceFor() reads the real tiered table instead. */
  arrowheadIdx: 9,
  arrowheadBonus: 25,   // legacy/unverified — superseded by the tiered ArtifactInfo lookup
  fauxoryTuskIdx: 3,    // Fauxory Tusk: the bulk of the additive artifact-find pool
  maxArtifactTier: 6,   // Transcendent

  /* Captain bonus roll bounds, verbatim from the client's CaptainBonuses table:
   *   [["10","60",..,"+{%_Boat_Speed"], ["30","100",..,"+{%_Loot_Value"],
   *    ["30","100",..,"+{%_Cloud_Discover_Rate"], ["10","50",..,"+{%_Artifact_Find_Chance"],
   *    ["10","40",..,"+{%_Rare_Chest_Chance"]]
   * Roll = floor(0.15 * randInt(min, max * (0.5 + 0.8*tier))). Tier lifts the CEILING only —
   * the floor is tier-independent, so a T6 can roll min and lose to a T1. */
  captainRolls: [{min:10,max:60},{min:30,max:100},{min:30,max:100},{min:10,max:50},{min:10,max:40}],

  /* Islands, from the client's IslandInfo (f1 = distance) and IslandInfobox (f2 = artifact count).
   * Artifacts occupy CONTIGUOUS index ranges: island i owns Sailing[3][offset .. offset+count-1],
   * where offset = sum of counts of all islands before i (the client's SailzDN loop).
   * Island 14's count is 1 in the raw table and is raised to 4 by the Ninja EmporiumBonus 34
   * upgrade; it is encoded as 4 here because without it the counts sum to 38, not 41. */
  islands: [
    { i:0,  dist:25,            count:4 }, { i:1,  dist:100,           count:3 },
    { i:2,  dist:250,           count:2 }, { i:3,  dist:1000,          count:3 },
    { i:4,  dist:3000,          count:3 }, { i:5,  dist:10000,         count:2 },
    { i:6,  dist:25000,         count:2 }, { i:7,  dist:100000,        count:2 },
    { i:8,  dist:300000,        count:1 }, { i:9,  dist:1000000,       count:2 },
    { i:10, dist:2000000,       count:1 }, { i:11, dist:5000000,       count:1 },
    { i:12, dist:15000000,      count:1 }, { i:13, dist:40000000,      count:2 },
    { i:14, dist:100000000,     count:4 }, { i:15, dist:5000000000,    count:4 },
    { i:16, dist:200000000000,  count:4 },
  ],

  /* Server vars feeding the chance divisors. NOT IN THE CLIENT and NOT IN THE SAVE.
   *
   * Searched N.js exhaustively: "AncientOddPerIsland" and "AncientArtiPCT" appear at exactly
   * three sites — the two divisor formulas (~line 17726) and one easter egg — and always as
   * `u.getServerVarLoad(name)`, which is a pure native bridge:
   *   u.getServerVarLoad = function(a){ return window.React.createElement("getServerVarLoad",[a]) }
   * There is no default, no fallback table, and no literal anywhere in the client. They are
   * Firebase remote config, fetched at runtime, and Lava can change them without a patch.
   * So these CANNOT be derived. They are CALIBRATED against one account's observation.
   *
   * How they were pinned: an island-13 basic chest reads 1-in-14,933 at a computed
   * BoatArtiMulti of ~2.18e7 (see stats/artifact-find.mjs), which fixes TranscendentChances(13) at
   * ~3.26e11. AncientOddPerIsland=960 is assumed (960 is the formula's own neutral divisor);
   * ancientArtiPct=9900 then falls out. That is ONE equation and TWO unknowns, so the split
   * between them is arbitrary — only their combination is evidenced.
   *
   * Consequences, which the UI must surface rather than hide:
   *  - absolute "1 in X" numbers inherit this calibration and may be wrong for everyone;
   *  - RATIOS between islands / boats / captains do NOT depend on it and are trustworthy;
   *  - a live event that changes AncientArtiPCT silently invalidates every absolute number.
   * The honest fix is to read the real values from remote config at runtime. Until then,
   * treat absolutes as indicative and rank on ratios. */
  /* CORRECTED 2026-07-17: ancientArtiPct was 9900. It is 0.
   *
   * 9900 was not evidence, it was an artifact of a units error. The in-game "Artifact Find
   * Chance" panel renders `NotateNumber(Sailing("BoatArtiMulti",0,0)/1, "MultiplierInfo")`, and
   * that formatter prints `round(d/1e6*100)/100 + "M#"` for d > 1e6 — it does NOT divide by 100.
   * So a display of "2182.12M" means BoatArtiMulti = 2.18212e9, NOT 2.18212e7. Reading it as a
   * percent introduced a spurious 100x, and solving ancientArtiPct against that reading
   * produced exactly 9900 — i.e. (1 + 9900/100) = 100, precisely the factor needed to cancel
   * the error. A constant whose only job is to undo a mistake elsewhere.
   *
   * The chest observation alone cannot settle it: it is one equation in two unknowns and both
   * (2.182e7, pct=9900) and (2.182e9, pct=0) reproduce the observed island-13 1-in-14,933
   * exactly. What settles it is the INDEPENDENT term-by-term computation in stats/artifact-find.mjs:
   * evaluating only the terms confirmed against in-game readings already lands 1.8x ABOVE
   * 2.182e7, and every remaining undecoded term can only push it higher. 2.182e7 is therefore
   * unreachable without contradicting readings the game itself displays.
   *
   * With the target at 2.182e9, the natural pair falls out with no fudge: 960 is the formula's
   * own neutral divisor (it appears literally as `AncientOddPerIsland/960`), and 0 is the
   * obvious default for an event knob — AncientArtiPCT reads like a remote lever Lava raises
   * during artifact events and leaves at 0 otherwise. (The client's one non-formula use of it
   * compares against 3, consistent with a dev/test toggle.)
   *
   * STILL CALIBRATED, NOT READ. These are Firebase remote config with no default in the client,
   * so Lava can change AncientArtiPCT for an event and silently invalidate every absolute
   * number here. It remains one equation in two unknowns: the SPLIT between the two is
   * inferred, only their combination is evidenced.
   * Absolute "1 in X" inherits all of this. RATIOS between islands/boats/captains do not —
   * both server vars and any undecoded global multiplier cancel out of a ratio. Rank on ratios. */
  serverVars: {
    ancientOddPerIsland: 960,
    ancientArtiPct: 0,
    calibrated: true,          // fallback for OLD snapshots only — see below
    /* 2026-07-17: the Firestore doc `_vars/_vars` (readable with the normal save token;
     * found via IdleonToolbox) carries AncientOddPerIsland=960 and AncientArtiPCT=0 — the
     * calibration was EXACTLY right. Live syncs now merge the doc into raw.__serverVars and
     * extractSailing READS it (calibrated:false); these constants remain only as the
     * fallback for snapshots that predate the fetch. */
    note: "Firebase remote config. Now READ from __serverVars on live snapshots; this calibrated copy is the fallback for old snapshots. The 2026-07-17 read confirmed the calibration exactly (960/0).",
  },
  equinoxUpgrades: ["Equinox Dreams","Equinox Resources","Shades of K","Liquidvestment","Matching Scims","Slow Roast Wiz","Laboratory Fuse","Metal Detector","Faux Jewels","Food Lust","Equinox Symbols","Voter Rights","Nonstop Studies","Hmm..."],
  dreamTotal: 77, mealCount: 74, mealCapMax: 160,
  grimoireCount: 55, compassCount: 173, tessCount: 63, vaultCount: 90,
  cavernCount: 18, achieveTotal: 268,
  classes: {1:"Beginner",2:"Journeyman",3:"Maestro",4:"Voidwalker",5:"Infinilyte",7:"Warrior",8:"Barbarian",9:"Squire",10:"Blood Berserker",12:"Divine Knight",13:"Royal Guardian",14:"Death Bringer",19:"Archer",20:"Bowman",21:"Hunter",22:"Siege Breaker",23:"Mayheim",25:"Beast Master",29:"Wind Walker",31:"Mage",32:"Wizard",33:"Shaman",34:"Elemental Sorcerer",35:"Spiritual Monk",36:"Bubonic Conjuror",40:"Arcane Cultist"},
};

/* achievement dataset (names, categories, tips): statically imported from
 * gamedata/achievements-data.mjs, a GENERATED verbatim wrapper of the repo-root
 * achievements-data.json (see that file's header). Static import works unchanged under both
 * plain Node and Vite; a runtime readFileSync would not. */
let ACH = null;
export function achData() {
  if (ACH) return ACH;
  ACH = { ...ACHIEVEMENTS_DATA };
  ACH.real = ACH.achievements.filter((a) => a.name !== "UNUSED_SLOT");
  return ACH;
}

const J = (v) => { if (typeof v === "string") { try { return JSON.parse(v); } catch { return v; } } return v; };
const dictVals = (o) => Object.keys(o).filter((k) => k !== "length").map((k) => o[k]);
const sumPos = (a) => a.reduce((s, x) => s + (typeof x === "number" && x > 0 ? x : 0), 0);

/* Captain bonus for one stat id. Both slots are summed: a captain may legally
 * roll the same stat id twice (e.g. captain 17 carries Loot Value at +41 twice). */
const capStat = (c, id) => (c[1] === id ? c[3] * c[5] : 0) + (c[2] === id ? c[3] * c[6] : 0);

/** Chest-rarity probabilities for one boat.
 * roll = U(0,1) / divisor, so P(roll < threshold) = min(1, threshold * divisor).
 * Thresholds are nested, hence P(tier r) = P(<t_r) - P(<t_r+1). */
export function chestDist(rareChestBonus, arrowheadBonus = 0) {
  const divisor = 1 + (rareChestBonus + arrowheadBonus) / 200;
  const cum = REF.chestTiers.map((t) => Math.min(1, t.threshold * divisor));
  return cum.map((c, r) => c - (cum[r + 1] ?? 0));
}

/** Expected artifact multiplier (the 1.4^r term) for a chest-rarity distribution. */
export const eArtiMulti = (dist) => dist.reduce((s, p, r) => s + p * REF.chestTiers[r].artiMulti, 0);

/** Index of the first artifact belonging to island i (the client's SailzDN accumulator). */
export const islandOffset = (i) => REF.islands.slice(0, i).reduce((s, x) => s + x.count, 0);

/** Divisor for a tier-5 -> 6 (Transcendent) find on island b. Verbatim from the client:
 *   6>b ? 4E7+6E7*b
 *       : 1E6*(1+100*(b-5)/100)*max(1,1.7^max(0,b-7))*(1+50*max(0,b-9)/100)
 *         * ((1E4+5E3*(b-5)*(AncientOddPerIsland/960)) / (1+AncientArtiPCT/100))
 * Lower is better. The 1.7^(b-7) term is why far islands are worse despite holding more
 * artifacts: rolls grow linearly with artifact count, the divisor grows exponentially.
 * TODO: Ancient/Eldritch/Sovereign/Omnipotent divisors exist in the client too — needed
 * before this serves an account that is not already at tier 5 everywhere. */
export function transcendentChances(b, sv = REF.serverVars) {
  if (b < 6) return 4e7 + 6e7 * b;
  return 1e6 * (1 + 100 * (b - 5) / 100)
       * Math.max(1, Math.pow(1.7, Math.max(0, b - 7)))
       * (1 + 50 * Math.max(0, b - 9) / 100)
       * ((1e4 + 5e3 * (b - 5) * (sv.ancientOddPerIsland / 960)) / (1 + sv.ancientArtiPct / 100));
}

/** Chance that ONE chest yields at least one artifact on island `isl`.
 * The client rolls every un-maxed artifact on the island independently:
 *   SailzDN2 = prod(1 - chest[2]/TierChances(island));  shown = 100*(1 - SailzDN2)
 * so `artiMulti` (the chest's frozen BoatArtiMulti * 1.4^rarity) is shared across rolls
 * and only the COUNT of un-maxed artifacts varies. */
export function chestArtifactChance(artiMulti, isl, unmaxedCount) {
  if (!unmaxedCount) return 0;
  const p = artiMulti / transcendentChances(isl);
  return Math.min(1, 1 - Math.pow(1 - p, unmaxedCount));
}

/** Sailing: captains, boats, banked time, per-boat chest quality.
 * NOT parsed, because it is not in the save: the Minimum Chest filter. The
 * IdleonToolbox parser never reads it either, which is decent evidence it lives
 * outside Sailing/Boats/Captains/SailChests. Best unverified lead is OptLacc
 * near 124 (where banked sailing time lives). Until found, the UI must ask. */
function extractSailing(P, sail, art, save, artiStat) {
  const opt = P("OptLacc") || [];
  const rawCaps = P("Captains") || [];
  const rawBoats = P("Boats") || [];
  const chests = P("SailChests") || [];

  // Arrowhead at Ancient+ adds a flat +25 to the rare-chest divisor and unlocks the Minimum Chest filter.
  const arrowhead = (art[REF.arrowheadIdx] || 0) >= 2 ? REF.arrowheadBonus : 0;

  const mkCaptain = (c, i) => {
    if (!c || c[0] === -1) return null;
    const stats = [[c[1], c[5]], [c[2], c[6]]]
      .filter(([id]) => REF.captainStats[id])
      .map(([id, raw]) => ({ id, name: REF.captainStats[id].name, raw, effect: c[3] * raw, perChest: REF.captainStats[id].perChest, throughput: REF.captainStats[id].throughput }));
    return {
      i, tier: c[0], level: c[3], xp: c[4], stats,
      rareChest: capStat(c, 4),
      artifactFind: capStat(c, 3),
      isShop: c[4] === 0 && c[3] === 1,   // today's 4 rerolling offers: level 1, zero xp
    };
  };

  const captains = rawCaps.map(mkCaptain);
  const boats = rawBoats.map((b, i) => {
    const c = captains[b[0]] || null;
    const dist = chestDist(c?.rareChest || 0, arrowhead);
    return {
      i, captainIdx: b[0], island: b[1],
      rareChest: c?.rareChest || 0,
      artifactFind: c?.artifactFind || 0,
      chestDist: dist,
      eArtiMulti: eArtiMulti(dist),
    };
  });

  // per-island rollup: which islands still hold un-maxed artifacts, and how many rolls each chest gets there
  /* Server vars: READ from the synced __serverVars doc when present (2026-07-17: the live doc
   * carries AncientOddPerIsland=960 and AncientArtiPCT=0 — matching the earlier calibration
   * EXACTLY, which retroactively confirms it); calibrated REF values only as fallback for old
   * snapshots. */
  const svDoc = save.get("__serverVars");
  const sv = svDoc && "AncientOddPerIsland" in svDoc
    ? { ancientOddPerIsland: Number(svDoc.AncientOddPerIsland), ancientArtiPct: Number(svDoc.AncientArtiPCT ?? 0), calibrated: false }
    : REF.serverVars;

  const islands = REF.islands.map((isl) => {
    const off = islandOffset(isl.i);
    const arts = Array.from({ length: isl.count }, (_, k) => ({
      i: off + k, name: REF.artifacts[off + k] ?? "?", tier: art[off + k] || 0,
    }));
    const unmaxed = arts.filter((a) => a.tier < REF.maxArtifactTier).length;
    return { ...isl, offset: off, artifacts: arts, unmaxed, divisor: transcendentChances(isl.i, sv) };
  });

  const banked = opt[124] || 0;
  const maxed = art.filter((t) => t >= REF.maxArtifactTier).length;
  const remaining = REF.artifacts.length - maxed;

  /* The multiplier the game shows as "Artifact Find Chance" — the artifactFind recipe result,
   * evaluated once in extractEntities and passed in (stats/artifact-find.mjs computes it;
   * boat 0, because that is the boat the client's own info panel displays:
   * `NotateNumber(Sailing("BoatArtiMulti",0,0)/1, "MultiplierInfo")`). */
  const arti = artiStat.collapsed;

  /* Which captain stats are worth anything depends on the account's phase, not on constants:
   *   speed    — still distance-bound, so Boat Speed buys real trips/hour
   *   artifact — clamped at min travel time, artifacts still outstanding: Artifact Find + Rare Chest
   *   loot     — every artifact maxed, so artifact-find is dead and Loot Value is all that's left
   *              (levels the ships, which is the only thing still moving)
   * Cloud Discover is never worth a slot: islands unlock quickly and then the captain is dead
   * weight forever — community guides say skip it even before that.
   * `clamped` is supplied by the caller until min-travel-time is computed from the client formula. */
  const phase = remaining === 0 ? "loot" : "artifact";

  return {
    bankedSeconds: banked,
    bankedHours: banked / 3600,
    arrowheadBonus: arrowhead,
    islands,
    phase,
    /* which server vars fed the divisors: calibrated=false means READ from _vars/_vars */
    serverVars: sv,
    /* COMPUTED BoatArtiMulti (was: a hardcoded reading off one account's screen).
     *  baseMulti          — the multiplier for boat 0, as the game displays it.
     *  additivePoolPct    — the additive bracket EXCLUDING the boat's own captain, so a boat's
     *                       multiplier relative to a captain-less boat is
     *                       (100 + pool + capArtifactFind) / (100 + pool).
     *  artiTerms/artiUnknown/artiLowerBound — the honest part. Unknown terms contribute their
     *                       neutral element, so baseMulti is a LOWER BOUND when artiLowerBound
     *                       is true. The UI must say so rather than present it as exact. */
    baseMulti: arti.value,
    additivePoolPct: arti.additivePoolPct - (boats[0]?.artifactFind || 0),
    artiTerms: arti.terms,
    artiUnknown: arti.unknown,
    artiLowerBound: arti.lowerBound,
    artiActiveChar: artifactSourceChar(save),
    captains: captains.filter((c) => c && !c.isShop),
    shop: captains.filter((c) => c && c.isShop),
    boats,
    chests: chests.length,
    captainsUnlocked: (sail[2] || [])[0] ?? null,
    boatsUnlocked: (sail[2] || [])[1] ?? null,
    treasures: sail[1] || [],           // Sailing[1] is Sailing Treasure currency, NOT the chest pile
    artifactsMaxed: maxed,
    artifactsRemaining: REF.artifacts.length - maxed,
    boatsWithRareChest: boats.filter((b) => b.rareChest > 0).length,
    boatsWithArtifactFind: boats.filter((b) => b.artifactFind > 0).length,
    boatsDeadForArtifacts: boats.filter((b) => !b.rareChest && !b.artifactFind).length,
    fleetArtiMulti: boats.reduce((s, b) => s + b.eArtiMulti, 0),
  };
}

/** raw save -> structured entities */
export function extractEntities(raw, charNames = null) {
  const P = (k) => J(raw[k]);
  const save = openSave(raw, charNames);   // named, documented accessors — see savemap.mjs
  const e = {};

  // characters
  e.characters = [];
  for (let i = 0; i < 13; i++) {
    if (!(("Lv0_" + i) in raw)) continue;
    const lv = J(raw["Lv0_" + i]);
    e.characters.push({
      idx: i,
      name: charNames?.[i] ?? null,
      classId: raw["CharacterClass_" + i] ?? null,
      className: REF.classes[raw["CharacterClass_" + i]] || String(raw["CharacterClass_" + i]),
      level: lv[0],
      skillsTotal: sumPos(lv.slice(1)),
      skillLevels: lv.slice(1),
    });
  }

  // achievements (steam-exclusive read from SteamAchieve)
  const ar = P("AchieveReg") || [], sa = P("SteamAchieve") || [];
  e.achievements = achData().real.map((a) => {
    const prog = ("steam" in a) ? sa[a.steam] : ar[a.i];
    return { i: a.i, done: prog === -1, progress: prog === -1 ? null : prog };
  });

  // artifacts
  const sail = P("Sailing") || [];
  const art = (sail[3] || []).slice(0, REF.artifacts.length);
  e.artifacts = REF.artifacts.map((n, i) => ({ i, name: n, tier: art[i] || 0, tierName: REF.artifactTiers[art[i] || 0] }));

  /* stat recipes — every registered stat, evaluated with its honest breakdown.
   * activeChar (governs star-sign terms when the Infinite window doesn't cover them) uses the
   * artifactSourceChar heuristic; companions default to sel.companionsOwned() (the `_comp`
   * RTDB doc unioned with OptLacc[606] token buys) — absent on pre-`_comp` snapshots those
   * terms stay unknown. Lab connectivity comes from the bonuses/labboard.mjs FLOOR SOLVER
   * (proven-or-unknown, never assumed); pass labConnectedIds only to override it. */
  e.stats = evaluateAll(save, { "*": { activeChar: artifactSourceChar(save) } });

  // sailing
  e.sailing = extractSailing(P, sail, art, save, e.stats.artifactFind);

  // atoms
  const atoms = P("Atoms") || [];
  e.atoms = REF.atoms.map((n, i) => ({ i, name: n, level: atoms[i] || 0, cap: REF.atomCap }));

  // equinox
  const wb = P("WeeklyBoss") || {};
  const dream = P("Dream") || [];
  e.equinox = {
    bar: dream[0] || 0,
    dreamsDone: Object.keys(wb).filter((k) => k.startsWith("d_") && wb[k] === -1).length,
    dreamTotal: REF.dreamTotal,
    dreamProgress: Object.fromEntries(Object.entries(wb).filter(([k, v]) => k.startsWith("d_") && v !== -1)),
    upgrades: REF.equinoxUpgrades.map((n, i) => ({ i, name: n, level: dream[2 + i] || 0 })),
  };

  // engines
  const grim = (P("Grimoire") || []).slice(0, REF.grimoireCount);
  const compArr = (P("Compass") || [])[0] || [];
  const tess = (P("Arcane") || []).slice(0, REF.tessCount);
  const uv = (P("UpgVault") || []).slice(0, REF.vaultCount);
  e.engines = {
    grimoire: { levelSum: sumPos(grim), bought: grim.filter((x) => x > 0).length, total: REF.grimoireCount, levels: grim },
    compass: { levelSum: Math.round(sumPos(compArr)), bought: compArr.filter((x) => x > 0).length, total: REF.compassCount },
    tesseract: { levelSum: sumPos(tess), bought: tess.filter((x) => x > 0).length, total: REF.tessCount, levels: tess },
    vault: { levelSum: sumPos(uv), bought: uv.filter((x) => x > 0).length, total: REF.vaultCount, levels: uv },
  };

  // alchemy / stamps / meals / cards
  const ci = P("CauldronInfo") || [];
  let bubbleLv = 0;
  const cauldrons = [];
  for (let i = 0; i < 4 && i < ci.length; i++) {
    const arr = (Array.isArray(ci[i]) ? ci[i] : dictVals(ci[i] || {})).map(Number).filter((x) => !isNaN(x));
    cauldrons.push(sumPos(arr));
    bubbleLv += sumPos(arr);
  }
  const st = P("StampLv");
  const stampVals = (Array.isArray(st) ? st : [st]).flatMap((pg) => Array.isArray(pg) ? pg : (pg && typeof pg === "object" ? dictVals(pg) : [pg]));
  const meals = ((P("Meals") || [])[0] || []).filter((x) => typeof x === "number").slice(0, REF.mealCount);
  e.alchemy = { bubbleLvTotal: Math.round(bubbleLv), cauldrons };
  e.stamps = { levelTotal: Math.round(sumPos(stampVals.map(Number).filter((x) => !isNaN(x)))) };
  e.meals = { levels: meals, total: sumPos(meals), min: Math.min(...meals.filter((x) => x > 0)), count: meals.filter((x) => x > 0).length, cap: REF.mealCapMax };
  e.cards = { found: Object.keys(P("Cards0") || {}).length };

  // misc / W5-7
  const opt = P("OptLacc") || [];
  const holes = P("Holes") || [];
  e.emperor = { showdown: opt[369] || 0, attemptsBanked: Math.max(0, -((opt[370] || 0) - 1)) };
  e.misc = {
    rift: (P("Rift") || [0])[0],
    greenstacks: (P("GreenStacks") || []).length,
    gems: raw.GemsOwned ?? null,
  };
  e.w7 = (() => {
    const n = (x) => Number(x) || 0;
    const w7 = makeCtx(save, {});
    const dash = (s) => String(s ?? "").replace(/_/g, " ").trim();
    const spelunk = sel.spelunk(save);
    const research = sel.research(save);
    const sushiArr = sel.sushi(save);

    /* --- Research Grid: runtime-assigned node identities, decoded where N.js confirms them --- */
    const nodes = gridNodes(w7);
    const gridRawLevel = (node) => gridLevel(w7, node);
    const researchOut = {
      nodesPlaced: nodes.length,
      decodedNodes: nodes.filter((x) => x.decoded).length,
      nodes: nodes.map((x) => ({ slot: x.slot, level: x.level, effectName: dash(x.effectName),
        decoded: x.decoded, coeff: x.coeff, bonus: x.bonus, occurrence: x.occurrence, occurrencePct: x.occurrencePct })),
      occurrences: gridOccurrences(w7),
      observations: (research[11] || []).filter((x) => x != null).length,
      mineheadTierCounter: n((research[7] || [])[4]),
    };

    /* --- Legend Talents (40 real; 40-49 filler omitted) + points economy --- */
    const legLevels = sel.legendTalentLevels(save);
    const points = legendPoints(w7);
    const talents = LEGEND_TALENTS.map((r) => {
      const lv = n(legLevels[r.id]);
      let maxLv = r.maxLvBase;
      try { maxLv = legendTalentMaxLv(r.id, gridRawLevel); } catch { /* keep flat base */ }
      return { id: r.id, name: dash(r.name), short: dash(r.short), level: lv, maxLv,
        coeff: r.coeff, bonus: legendPtsBonus(r.id, lv), knownConsumer: r.id in LEGEND_TALENT_COEFF };
    });

    /* --- Spelunking (active minigame; NO timers surfaced) --- */
    const caveUnlock = spelunk[0] || [], depths = spelunk[1] || [], caverPow = spelunk[2] || [];
    const shopLv = spelunk[5] || [];
    const caves = SPELUNK_CAVES.filter((c) => c.name).map((c, i) => ({
      name: dash(c.name), maxDepth: c.maxDepth, unlocked: n(caveUnlock[i]) > 0,
      depth: n(depths[i]), pow: n(caverPow[i]) }));
    const spelunking = {
      caves,
      cavesUnlocked: caves.filter((c) => c.unlocked).length,
      discoveries: (sel.spelunkMaterials(save) || []).length,
      shopLevels: SPELUNK_SHOP.map((r) => ({ id: r.id, name: dash(r.name), level: n(shopLv[r.id]), maxLv: r.maxLv })),
      shopBought: SPELUNK_SHOP.filter((r) => n(shopLv[r.id]) > 0).length,
    };

    /* --- Sushi Station: dishes unlocked, shop levels, RoG bonus values --- */
    const u = uniqueSushi(w7);
    const sushiShopLv = sushiArr[2] || [];
    const sushi = {
      dishesUnlocked: u, dishesTotal: SUSHI_TYPES.length,
      highestDish: u > 0 ? dash(SUSHI_TYPES[u - 1]) : null,
      shopBought: sushiShopLv.filter((x) => n(x) > 0).length,
      rog: SUSHI_ROG_FULL.map((r) => ({ id: r.id, desc: dash(r.desc), coeff: r.coeff, active: u > r.id })),
      rogActive: SUSHI_ROG_FULL.filter((r) => u > r.id).length,
      // fuel / shaker / knowledge queue states are derived runtime UI values, not a clean save read
      fuel: null, shakers: null, knowledge: null,
    };

    /* --- Minehead (Depth Charge shop, button presses) + Glimbo trades --- */
    const mineheadLv = research[8] || [];
    const glimboCounts = research[12] || [];
    const minehead = {
      buttonPresses: n(sel.mineheadButtonPresses(save)),
      shopLevels: MINEHEAD_SHOP.map((r) => ({ id: r.id, name: dash(r.name), level: n(mineheadLv[r.id]), maxLv: r.maxLv })),
      shopBought: MINEHEAD_SHOP.filter((r) => n(mineheadLv[r.id]) > 0).length,
      glimboTrades: GLIMBO_TRADES.map((t, i) => ({ gridNode: t.gridNode, item: t.item, trades: n(glimboCounts[i]) })),
      glimboTotalTrades: GLIMBO_TRADES.reduce((a, _t, i) => a + n(glimboCounts[i]), 0),
    };

    /* --- Zenith Market (Spelunk[45]; feeds statue-multi / class-xp / kruk / lamp) --- */
    const zenith = {
      levels: ZENITH_MARKET.map((r, b) => {
        const lv = sel.zenithMarketLevel(save, b);
        return { id: dash(r.id), level: lv, maxLv: r.maxLv, coeff: r.coeff, bonus: zenithMarketBonusValue(b, lv) };
      }),
    };

    /* --- Coral Reef: CoralKid upgrades (6), reef buildings (6), dancing coral (9) --- */
    const reefLv = sel.reefBuildingLevels(save);
    const coralReef = {
      coralKid: CORAL_KID.map((r, b) => {
        const lv = sel.coralKidLevel(save, b);
        return { id: b, desc: dash(r.desc), level: lv, bonus: coralKidUpgBonus(b, lv) };
      }),
      buildings: CORAL_REEF_BUILDINGS.map((r, b) => ({ id: b, desc: dash(r.desc), level: n(reefLv[b]), maxLv: r.maxLv })),
      dancingCoral: DANCING_CORAL.map((r, b) => ({ id: b, desc: dash(r.desc), coeff: r.coeff })),
    };

    /* --- Clam Work (Mr. Musselini): job level, 9 upgrades, 9 job rewards --- */
    const jobLevel = sel.clamJobLevel(save);
    const clamUpg = sel.clamUpgLevels(save);
    const clamWork = {
      jobLevel,
      upgrades: CLAM_UPG.map((r, b) => ({ id: b, name: dash(r.name), level: n(clamUpg[b]), coeff: r.coeff })),
      jobs: CLAM_JOB_REWARDS.map((r, i) => ({ level: i + 1, reward: dash(r), reached: jobLevel > i })),
    };

    /* --- Advice Fish (BigFish): 6 upgrade levels --- */
    const adviceLv = sel.adviceFishLevels(save);
    const adviceFish = {
      levels: BIG_FISH.map((r, b) => {
        const lv = n(adviceLv[b]);
        return { id: b, name: dash(r.name), level: lv, bonus: bigFishBon(b, lv) };
      }),
    };

    /* --- The Button (rotating daily task). Current task needs CustomLists.Research[39], a
     *     runtime-assigned shuffle table not embedded in N.js — honestly unknown. --- */
    const button = {
      presses: n(sel.mineheadButtonPresses(save)),
      tasksTotal: BUTTON_TASKS.length,
      currentTask: null,   // needs the runtime shuffle permutation (CustomLists.Research[39])
    };

    return {
      // legacy fields kept for existing dashboard consumers (domain.mjs:~1243)
      spelunkZones: caves.filter((c) => c.unlocked).length,
      researchNodes: nodes.length,
      research: researchOut,
      legendTalents: { points, talents },
      spelunking, sushi, minehead, zenith, coralReef, clamWork, adviceFish, button,
    };
  })();
  e.caverns = { villagerLevels: ((holes[1]) || []).filter((x) => x > 0) };

  /* ---- World 5 (Smolderin' Plateau): Gaming, Palette, Divinity, Villagers, Slab ---- */
  {
    const n = (x) => Number(x) || 0;
    const w5 = makeCtx(save, {});
    const gamingArr = sel.gaming(save);
    const sprout = sel.gamingSprout(save);
    const gem = P("GemItemsPurchased") || [];
    const lb = (st) => !!st?.collapsed?.lowerBound;

    // --- gaming ---
    const superbits = SUPERBITS.map((r) => ({ idx: r.idx, name: r.name.replace(/_/g, " "), owned: superBitType(w5, r.idx) }));
    const snailLv = sel.snailLevel(save);
    const gaming = {
      bits: n(gamingArr[0]),
      bitsMulti: n(e.stats.gamingBits?.collapsed?.value),
      bitsMultiLowerBound: lb(e.stats.gamingBits),
      fertilizer: FERTILIZER_UPGRADES.map((f) => ({ idx: f.idx, name: f.name.replace(/_/g, " "), level: n(gamingArr[f.gamingSlot]) })),
      imports: IMPORT_TOOLS.filter((r) => r.name !== "idk").map((r) => ({ idx: r.idx, name: r.name.replace(/_/g, " "), level: n((sprout[25 + r.idx] ?? [])[0]) })),
      superbits: {
        owned: superbits.filter((b) => b.owned === 1).length,
        total: SUPERBITS.length,
        unknown: superbits.filter((b) => b.owned === null).length,   // ids >= 53: unrecoverable
        list: superbits,
      },
      snail: {
        level: snailLv,
        encouragement: n((sprout[32] ?? [])[2]),
        maxLevel: maxSnailLV(superBitType(w5, 29) ?? 0, superBitType(w5, 30) ?? 0, superBitType(w5, 40) ?? 0),
      },
      ratKing: { tokens: n(gamingArr[14]), shopLevels: [0, 1, 2].map((b) => sel.ratShopLevel(save, b)) },
      mutations: {
        count: n(gamingArr[4]),
        dna: n(gamingArr[5]),
        names: MUTANT_SPROUT_NAMES_INFERRED.slice(0, n(gamingArr[4])).filter(Boolean),
      },
      sprouts: { capacity: Math.round(Math.min(24, 3 + n(gamingArr[3]) + n(gem[133]))), mutantPlots: n(gamingArr[4]) },
    };

    // --- palette ---
    const palLevels = sel.paletteLevels(save);
    const palette = {
      slots: GAMING_PALETTE.map((r) => ({ idx: r.idx, name: r.name.replace(/_/g, " "), level: n(palLevels[r.idx]), stat: r.stat.replace(/_/g, " "), unlocked: n(palLevels[r.idx]) > 0 })),
      luck: n(e.stats.paletteLuck?.collapsed?.value),
      luckLowerBound: lb(e.stats.paletteLuck),
    };

    // --- divinity ---
    const divArr = sel.divinity(save);
    const maxLv = blessingMaxLv(w5);
    const gods = GODS_INFO_FULL.map((g) => {
      const cost = blessingCostToNext(w5, g.idx);
      const major = blessingMajorValue(w5, g.idx);
      const linkedChars = save.charIdxs.filter((ci) => n(divArr[12 + ci]) === g.idx);
      return {
        idx: g.idx, name: g.name,
        level: sel.blessingLevel(save, g.idx),
        maxLevel: maxLv.value, maxLevelLowerBound: maxLv.status !== "computed",
        currency: cost.currency,
        costToNext: cost.value,
        currencyOnHand: blessingCurrencyOnHand(w5, cost.currency),
        majorValue: major.value, majorValueKnown: major.status !== "unknown",
        minorDesc: g.minorDesc.replace(/_/g, " "),
        linkedChars,
      };
    });
    const divinity = {
      gods,
      godRank: sel.godRank(save),
      points: sel.divinityPoints(save),
      particles: sel.divinityParticles(save),
      styles: DIV_STYLES.map((s) => ({ idx: s.idx, name: s.name, divPerHr: s.divPerHr, expPerHr: s.expPerHr })),
    };

    // --- villagers ---
    const villLevels = sel.villagerLevels(save);
    const villOpals = sel.villagerOpals(save);
    const villagers = VILLAGERS.filter((v) => v.active).map((v) => {
      const res = evaluate(villagerExp, save, { args: { villager: v.idx } });
      return {
        idx: v.idx, name: v.name,
        level: n(villLevels[v.idx]),
        expPerHr: res.value, expPerHrLowerBound: res.lowerBound,
        opalsInvested: n(villOpals[v.idx]),
      };
    });

    // --- caverns ---
    const unlocked = cavernsOwned(n(villLevels[0]));
    const caverns = { unlocked, total: 18, names: CAVERNS.slice(0, unlocked).map((c) => c.name) };

    // --- slab ---
    const looted = sel.slabItemCount(save);
    const slabHook = (h, threshold, divisor, base) => {
      const steps = Math.floor(Math.max(0, looted - threshold) / divisor);
      const nextAt = threshold + (steps + 1) * divisor;
      return { name: (h.name || h.gateName).replace(/_/g, " "), stat: h.stat.replace(/_/g, " "), steps, perStep: base, nextThresholdItems: Math.max(0, nextAt - looted) };
    };
    const slab = {
      looted, total: SLAB_ITEM_SORT_COUNT, pct: SLAB_ITEM_SORT_COUNT ? Math.round(looted / SLAB_ITEM_SORT_COUNT * 1000) / 10 : 0,
      greenstacks: sel.greenStacks(save).length,
      jars: sel.jars(save).length,
      bonuses: [
        ...SLAB_ARTIFACT_BONUSES.map((h) => slabHook(h, h.threshold, h.divisor, h.base)),
        ...SLAB_BONUSES.map((h) => slabHook(h, h.threshold, h.divisor, h.mult)),
      ],
      legendTiers: SLAB_OF_LEGEND_THRESHOLDS.map((t, i) => ({ tier: i + 1, threshold: t, done: looted >= t })),
    };

    e.w5 = { gaming, palette, divinity, villagers, caverns, slab };
  }

  /* farming — compact save-only snapshot (the farming page computes the full report fresh
   * via /api/farming; this feeds the dashboard + metrics). Plot tuple decode: savemap/w67. */
  {
    const plots = sel.farmPlots(save);
    const ranks = sel.farmRanks(save);
    const crops = sel.farmCrop(save);
    const medalPlots = plots.filter((p) => Number(p?.[0]) === 6);
    e.farming = {
      cropsFound: Object.keys(crops).length,
      beans: Number(sel.farmUpg(save)[1] ?? 0),
      instagrow: Number(sel.farmUpg(save)[19] ?? 0),
      plots: plots.length,
      medalCropIdx: medalPlots.length ? 230 + Math.max(...medalPlots.map((p) => Number(p[2]) || 0)) : null,
      totalOG: plots.reduce((t, p) => t + (Number(p?.[5]) || 0), 0),
      maxOG: plots.length ? Math.max(...plots.map((p) => Number(p?.[5]) || 0)) : 0,
      plotRankTotal: (ranks[0] ?? []).reduce((t, x) => t + Math.round(Number(x) || 0), 0),
      stickersTotal: (sel.stickerLevels(save) ?? []).reduce((t, x) => t + Math.round(Number(x) || 0), 0),
      exoticLvTotal: sel.farmUpg(save).slice(20, 100).reduce((t, x) => t + Math.ceil(Number(x) || 0), 0),
      exoticBuysUsed: sel.exoticBuysUsed(save),
    };
  }

  /* ---- World 6 (Spirited Valley): Summoning, Sneaking, Emperor, Beanstalk ---------------- */
  {
    const n = (x) => Number(x) || 0;
    const w6 = makeCtx(save, { activeChar: artifactSourceChar(save) });
    const opt6 = P("OptLacc") || [];
    const lb = (st) => !!st?.collapsed?.lowerBound;

    // --- Summoning ---
    const summonLevels = sel.summonUpgLevels(save);
    const totalUpgLv = sel.summonTotalUpgLevels(save);
    const endlessWins = sel.endlessSummonWins(save);
    const stones = SUMMONING_STONES.map((st) => {
      const kills = sel.summonStoneKills(save, st.idx);
      return { idx: st.idx, name: st.stoneName, essenceColor: st.essenceColor, territory: st.territoryName,
        kills, essenceMultiplier: summoningStoneEssenceMultiplier(kills) };
    });
    const winBonusRes = e.stats.winBonus?.collapsed;
    const summoning = {
      upgradesBought: summonLevels.filter((x) => n(x) > 0).length,
      upgradesTotal: SUMMON_UPGRADES.length,
      totalUpgradeLevels: totalUpgLv,
      matchesWon: (sel.summon(save)[1] ?? []).length,   // defeated summon-enemy roster length
      endlessBest: endlessWins,
      endlessUnlocked: sel.summonUpgLevel(save, 70) >= 1,
      endlessDifficulty: endlessWins > 0
        ? (() => { const id = SUMMON_ENDLESS_DIFFICULTY[endlessWins % 40]; const d = SUMMON_ENDLESS_DIFFICULTY_TEXT[id]; return d ? { name: d.name, text: d.text } : null; })()
        : null,
      armyHealth: n(e.stats.armyHealth?.collapsed?.value),
      armyDamage: n(e.stats.armyDamage?.collapsed?.value),
      armyDamageLowerBound: lb(e.stats.armyDamage),
      winBonusIndex: n(winBonusRes?.value),
      stones,
    };

    // --- Sneaking ---
    const jadeUnlock = sel.jadeUnlockString(save);
    const emporium = JADE_EMPORIUM.map((r) => ({ idx: r.idx, name: r.name.replace(/_/g, " "), owned: jadeEmporiumOwned(w6, r.idx) }));
    const charms = PRISTINE_CHARMS.map((r) => {
      const f = pristineBonAll(w6, r.idx);
      return { idx: r.idx, name: r.name.replace(/_/g, " "), owned: f.value > 0, value: f.value, bonus: r.bonus.replace(/[{}]/g, "").replace(/_/g, " ") };
    });
    const gemstones = GEMSTONES.map((r) => {
      const g = gemstoneBonus(w6, r.idx);
      return { idx: r.idx, name: r.name.replace(/_/g, " "), collected: g.value > 0, value: Math.round(g.value * 100) / 100, lowerBound: g.status !== "computed" };
    });
    // per-character stealth (activeCharSensitive -> evaluate as-if-active for each character)
    const stealthPerChar = save.charIdxs.map((ci) => {
      const res = evaluate(stealthRecipe, save, { activeChar: ci });
      return { charIdx: ci, floor: sel.ninjaTwinFloor(save, ci), stealth: n(res.value), lowerBound: res.lowerBound };
    });
    const charmRolls = sel.charmRollCounter(save);
    const sneaking = {
      ninjaMastery: sel.ninjaMastery(save),
      selectedMastery: sel.ninjaMasterySelected(save),
      floorsPerCycle: 12,
      upgradesBought: sel.ninjaUpgLevels(save).filter((x) => n(x) > 0).length,
      upgradesTotal: NINJA_UPGRADES.length,
      stealthPerChar,
      stealthBest: stealthPerChar.length ? Math.max(...stealthPerChar.map((x) => x.stealth)) : 0,
      stealthLowerBound: stealthPerChar.some((x) => x.lowerBound),
      emporium: { owned: emporium.filter((x) => x.owned === 1).length, total: JADE_EMPORIUM.length, unknown: emporium.filter((x) => x.owned === null).length, list: emporium },
      charms: { owned: charms.filter((c) => c.owned).length, total: PRISTINE_CHARMS.length, list: charms },
      gemstones,
      gacha: { charmRollCounter: charmRolls, pristineRollsRemaining: gachaPristineRollsRemaining(charmRolls), symbolRollsRemaining: gachaSymbolRollsRemaining(charmRolls) },
    };

    // --- Emperor ---
    const wins = n(opt6[369]);
    const opt382 = sel.emperorTries382(save);
    const emporium39 = jadeEmporiumOwned(w6, 39) === 1 ? 1 : 0;
    const emperor = {
      showdownWins: wins,
      currentShowdownHp: emperorBossHp(wins),
      nextShowdowns: Array.from({ length: 6 }, (_, i) => ({ n: wins + i + 1, hp: emperorBossHp(wins + i) })),
      attempts: {
        left: emperorAttemptsLeft(sel.emperorDebt370(save)),
        maxDisplayed: maxEmperorAttemptStackDisplayed(opt382, emporium39),
        dailyTries: dailyEmperorTries(opt382),
        seasonPass: emporium39 === 1,
      },
      bonuses: EMPEROR_BON_WIRING.map((r) => ({ idx: r.idx, name: r.name.replace(/[{}$%]/g, "").replace(/_/g, " ").trim(), value: n(emperorBon(w6, r.idx)), wired: r.wired, feeds: r.feeds })),
    };

    // --- Beanstalk ---
    const beanstalkUnlocked = jadeEmporiumOwned(w6, 1) === 1;
    const beanRanks = sel.beanstalkRanks(save);
    const goldByKey = Object.fromEntries(GOLDEN_FOODS.map((f) => [f.key, f]));
    const beanstalk = {
      unlocked: beanstalkUnlocked,
      supersizeUnlocked: jadeEmporiumOwned(w6, 2) === 1,
      foods: BEANSTALK_SLOTS.map((slot) => {
        const food = goldByKey[slot.key];
        const rank = n(beanRanks[slot.index]);
        return {
          index: slot.index, name: slot.displayName.replace(/[|_]/g, " "),
          effect: food?.effect ?? null, amount: food?.amount ?? null,
          rank, deposited: rank > 0,
          depositedStack: rank > 0 ? 1000 * Math.pow(10, rank) : 0,
          nextTierStack: BEANSTALK_RANK_THRESHOLDS[rank] ?? null,
        };
      }),
    };

    e.w6 = { summoning, sneaking, emperor, beanstalk };
  }

  /* account-wide bonus infrastructure entities (guild / family / obols / star signs), each
   * independently consumed by the account page. Honest, save-derived; a field is omitted rather
   * than guessed when the save cannot answer it (guild account LEVEL needs server-side points). */
  {
    const ctx = makeCtx(save, { activeChar: artifactSourceChar(save) });
    // guild: bonus levels ARE in the save; the account "level" (from guild points) is not.
    e.guild = { level: null, bonusPoints: sel.guildBonusPointsSpent(save) };
    // family: how many family-bonuses are active on this account vs the game's real total.
    // A row is a real family bonus when its slot-0 curve mode is a known curve and it is not a
    // NO_FAMILY_BONUS / NOPE / FILLER placeholder (ROYAL_GUARDIAN etc. are txt -> excluded here).
    const CURVES = new Set(["add", "decay", "bigBase", "reduce", "intervalAdd", "decayMulti"]);
    const total = CLASS_FAMILY_BONUSES.filter((r) => CURVES.has(r[3]) && !["NO_FAMILY_BONUS", "NOPE", "FILLER"].includes(r[0])).length;
    e.family = { count: Object.keys(famBonusQTYs(ctx)).length, total };
    // obols: family-page slots filled vs total.
    e.obols = obolSlots(ctx);
    // star signs: unlocked (StarSg dict) / equipped on the active character / total.
    const activeChar = artifactSourceChar(save);
    e.starSigns = {
      unlocked: Object.keys(save.get("StarSg") ?? {}).length,
      equipped: activeChar == null ? null : sel.starSignsOf(save, activeChar).length,
      total: 80,
    };
  }

  /* ---- W1 (Blunder Hills): stamps / statues / anvil / forge / owl / bribes ---------------- */
  {
    const ctx = makeCtx(save, { activeChar: artifactSourceChar(save) });
    const TAB_OF = { combat: 0, skills: 1, misc: 2 };
    const gilded = Number(sel.optionsAccount(save)[154] ?? 0) > 0;

    // stamps: all leveled/known stamps. slot = STAMP_INFO.indexInTab - 1 (item key = slot+1;
    // verified vs N.js StampDetails). Next-cost is a base-curve estimate (reduction bonuses —
    // bribe/vial/atom/sigil/meritocracy — are omitted, so costs are an UPPER bound for planning).
    const stampCost = (r, lv, mat) => {
      if (mat) {
        const tiers = Math.max(0, Math.round(lv / r.reqItemMultiplicationLevel) - 1);
        return Math.max(1, Math.round(r.baseMatCost * Math.pow(r.powMatBase, Math.pow(tiers, 0.8))));
      }
      const ratio = lv / (lv + 5 * r.reqItemMultiplicationLevel);
      const powBase = Math.max(1.05, r.powCoinBase - ratio * 0.25);
      return Math.round(r.baseCoinCost * Math.pow(powBase, lv * (10 / r.reqItemMultiplicationLevel)));
    };
    e.w1 = { stamps: [] };
    for (const r of STAMP_INFO) {
      const slot = r.indexInTab - 1;
      if (slot < 0) continue;
      const tab = TAB_OF[r.category];
      const level = Number((sel.stampTab(save, tab))[slot] ?? 0);
      const maxLevel = Number(((save.get("StampLvM") ?? [])[tab] ?? {})[slot] ?? level);
      const atMatCap = level >= maxLevel - 0.1;   // material branch fires at the tier cap
      e.w1.stamps.push({
        id: tab * 1000 + slot, tab, name: r.displayName, level, maxLevel,
        effect: r.effect, stat: r.stat,
        nextGoldCost: atMatCap ? null : stampCost(r, level, false),
        nextMatCost: atMatCap ? stampCost(r, level, true) : null,
        matItem: r.itemReqRawName,
        ...(gilded ? { gilded: true } : {}),
      });
    }

    // statues: 32, effective account-best level + tier + full bonus (shared multiplier applied).
    e.w1.statues = STATUE_INFO.map((info, idx) => {
      let bonus = null;
      try { bonus = Math.round(statueBonusGiven(ctx, idx).value * 100) / 100; } catch { bonus = null; }
      return { id: idx, name: info.name, level: statueLevel(save, idx), tier: statueTier(save, idx), bonus };
    });

    // anvil: per-character point allocation, production-speed multiplier, cap points, selections.
    e.w1.anvil = save.charIdxs.map((ci) => {
      const st = sel.anvilStatsOf(save, ci);
      const speed = evaluate(anvilSpeed, save, { activeChar: ci });
      return {
        charIdx: ci,
        points: { available: Number(st[0] ?? 0), coins: Number(st[1] ?? 0), mats: Number(st[2] ?? 0), xp: Number(st[3] ?? 0), speed: Number(st[4] ?? 0), cap: Number(st[5] ?? 0) },
        productionSpeed: Math.round(speed.value * 1000) / 1000,
        productionSpeedLowerBound: speed.lowerBound,
        selections: (sel.anvilSelectedOf(save, ci) ?? []).map(Number),
      };
    });

    // forge: 6 upgrade tracks (level vs max).
    const forgeLv = sel.forgeLevels(save);
    e.w1.forge = { upgrades: FURNACE_UPGRADES.map((u, i) => ({ index: i, name: u.name, level: Number(forgeLv[i] ?? 0), maxLevel: u.maxLevel })) };

    // owl: 9 upgrade levels, feathers held, mega-feather tier, generation rate.
    const rate = evaluate(owlRate, save);
    e.w1.owl = {
      upgrades: OWL_UPGRADES.map((u, i) => ({ index: i, name: u.name, level: sel.owlUpgradeLevel(save, i) })),
      feathers: sel.owlFeathers(save),
      megafeatherTier: sel.owlMegaTier(save),
      shinyFeathers: sel.owlShinyCount(save),
      featherRate: rate.value,
      featherRateLowerBound: rate.lowerBound,
    };

    // bribes: binary checklist (BribeStatus[i] === 1 = bought).
    const bstat = sel.bribeStatus(save);
    const missing = BRIBES.filter((b) => Number(bstat[b.index] ?? 0) !== 1);
    e.w1.bribes = {
      owned: BRIBES.filter((b) => Number(bstat[b.index] ?? 0) === 1).length,
      total: BRIBES.length,
      missing: missing.map((b) => ({ index: b.index, name: b.name, price: b.price })),
    };
  }

  /* ---- W2 (Yum-Yum Desert): alchemy bubbles / vials / sigils / cauldron P2W / liquids /
   *      fishing (Poppy) / vote ballot + meritocracy / killroy / islands --------------------- */
  {
    const ctx = makeCtx(save, { activeChar: artifactSourceChar(save) });
    const num = (x) => Number(x) || 0;
    const w2 = {};

    // bubbles: per-cauldron arrays (35 slots each; account-view value, class arm omitted).
    w2.bubbles = BUBBLE_TABLE.map((rows, ci) => rows.map((_, idx) => bubbleEntry(ctx, ci, idx)));

    // No-Bubble-Left-Behind: daily bubble levels from Kattlekruk (the krukBubbles recipe).
    w2.nblb = { bubblesLeveledPerDay: num(e.stats.krukBubbles?.collapsed?.value), lowerBound: !!e.stats.krukBubbles?.collapsed?.lowerBound };

    // vials: leveled vials with their AlchVials bonus.
    const vialLv = sel.vialLevels(save);
    w2.vials = VIAL_INFO.map((v) => {
      const lv = num(vialLv[v.i]);
      const f = lv ? vialBonus(ctx, v.i) : { value: 0, status: "computed" };
      return { idx: v.i, name: v.name, key: v.key, level: lv, bonus: Math.round(num(f.value) * 100) / 100, status: f.status };
    }).filter((v) => v.level > 0);

    // sigils: tier + charge progress + bonus. CauldronP2W[4]: [2e]=progress, [1+2e]=tier.
    const sig = sel.sigilTiers(save);
    const TIER_NAMES = ["Unlocked", "Boost", "Jade", "Ethereal", "Eclectic"];
    w2.sigils = SIGIL_DESC.map((row, e2) => {
      const tier = num(sig[1 + 2 * e2] ?? -1);
      const f = sigilBonus(ctx, e2);
      return { idx: e2, name: row.name, tier, tierName: tier < 0 ? "Locked" : (TIER_NAMES[tier] ?? "?"), progress: num(sig[2 * e2]), bonus: num(f.value), status: f.status };
    });

    // cauldron P2W: per-cauldron speed/newBubble/boostReq bonus values + max levels.
    const p2w = sel.cauldronP2W(save);
    w2.cauldronP2W = CAULD_NAMES.map((nm, c) => ({
      idx: c, name: nm,
      speed: { level: num((p2w[0] ?? [])[0 + 3 * c]), bonus: Math.round(cauldronP2wBonus(ctx, 0, c, 0) * 100) / 100, max: CAULDRON_P2W_MAX_LEVELS.cauldron.speed },
      newBubble: { level: num((p2w[0] ?? [])[1 + 3 * c]), bonus: Math.round(cauldronP2wBonus(ctx, 0, c, 1) * 1000) / 1000, max: CAULDRON_P2W_MAX_LEVELS.cauldron.newBubble },
      boostReq: { level: num((p2w[0] ?? [])[2 + 3 * c]), bonus: Math.round(cauldronP2wBonus(ctx, 0, c, 2) * 100) / 100, max: CAULDRON_P2W_MAX_LEVELS.cauldron.boostReq },
    }));

    // liquids: full capacity per liquid (lower bound where flagged).
    w2.liquids = LIQUID_NAMES.map((nm, b) => {
      const cap = liquidCapacity(ctx, b);
      return { idx: b, name: nm, capacity: Math.round(num(cap.value)), capacityLowerBound: cap.status === "partial",
        regenP2wLevel: num((p2w[1] ?? [])[0 + 2 * b]), capP2wLevel: num((p2w[1] ?? [])[1 + 2 * b]) };
    });

    // fishing (Poppy): upgrade levels, tar pit, mega fish, shiny, reset spiral, rates.
    const O = (i) => sel.poppyOpt(save, i);
    const fpm = fishPerMinute(ctx), shy = shinyFishRate(ctx);
    w2.fishing = {
      fishCurrency: O(267), tarCurrency: O(296),
      poppy: POPPY_UPGRADES.map((u) => ({ i: u.i, name: u.name.replace("|", " "), level: O(268 + u.i) })),
      tarPit: TAR_PIT_UPGRADES.map((u) => ({ i: u.i, name: u.name.replace("|", " "), level: O(297 + u.i) })),
      megaFishTier: O(279),
      megaFishUnlocked: Array.from({ length: 12 }, (_, i) => rooMegafeather(ctx, i) > 0).filter(Boolean).length,
      shinyTiers: SHINY_MULTI_TIERS.map((t) => ({ i: t.i, base: t.base, level: O(281 + t.i) })),
      resetSpiral: RESET_SPIRAL.map((r) => ({ i: r.i, level: O(291 + r.i) })),
      resetPoints: O(290),
      fishPerMinute: Math.round(num(fpm.value) * 100) / 100,
      shinyRate: num(shy.value),
      ratesLowerBound: true,
    };

    // vote ballot + meritocracy (active category + multiplier stack + previews).
    w2.ballot = ballotState(ctx);

    // killroy: skull balance + the implemented permanent bonuses + shop rows (static).
    w2.killroy = {
      skulls: num(sel.optionsAccount(save)[105]),
      artifactFindBonus: num(killroyBonus(ctx, 0).value),
      cropEvoBonus: num(killroyBonus(ctx, 1).value),
      shop: KILLROY_SHOP.map((r) => ({ idx: r.idx, description: r.description.replace(/\|/g, " "), skullCost: r.skullCost })),
    };

    // islands: unlock flag (OptLacc[169] letter-flag) + Fractal AFK hours + Shimmer currency.
    const islFlag = String(sel.optionsAccount(save)[169] ?? "");
    /* islands: {list, fractalAfkHours}. NOTE: fractalAfkHours MUST live inside this object — a bare
     * property on the array is dropped by JSON.stringify (the entity is serialized to the DB), which
     * is why w2.html previously found it absent. */
    w2.islands = {
      list: ISLANDS.map((isl) => ({
        idx: isl.idx, name: isl.name, description: isl.description.replace(/_/g, " "),
        unlocked: NUMBER_2_LETTER[isl.idx] !== undefined && islFlag.indexOf(NUMBER_2_LETTER[isl.idx]) !== -1,
      })),
      fractalAfkHours: num(sel.fractalIslandPts(save)),
    };

    e.w2 = w2;
  }

  /* ---- W3 (Frostbite Tundra): printer / refinery / worship / towers / atoms / shrines /
   *      library / death note ------------------------------------------------------------------ */
  {
    const ctx = makeCtx(save, { activeChar: artifactSourceChar(save) });
    const num = (x) => Number(x) || 0;
    const w3 = {};

    // printer: per-char sample slots (7/char: 5 base + 2 pending, plus 5 extra via PrinterXtra) +
    // what's being printed. Output multi from the printerOutput recipe.
    const printer = sel.printer(save);        // [id,qty] stride-2, 14/char, after a 5-num header
    const printerX = sel.printerXtra(save);   // extra slots, [id,qty] stride-2, 10/char
    const sampleSlots = Math.round(4 + num(sel.gemItemsPurchased(save)[112]));   // PrinterSampleSlots
    const bigSlots = Math.round(1 + num(sel.gemItemsPurchased(save)[111]));      // PrinterBigSlots (chambers)
    w3.printer = {
      sampleSlotsUnlocked: sampleSlots,
      chambersUnlocked: bigSlots,
      slotUnlocks: PRINTER_SLOT_UNLOCKS.map((u) => ({ name: u.name.replace(/_/g, " "), grants: u.grants })),
      outputMulti: num(e.stats.printerOutput?.collapsed?.value),
      outputMultiLowerBound: !!e.stats.printerOutput?.collapsed?.lowerBound,
      byChar: save.charIdxs.map((ci) => {
        const base = [];
        for (let s = 0; s < 7; s++) {
          const id = printer[5 + 2 * s + 14 * ci];
          const qty = num(printer[6 + 2 * s + 14 * ci]);
          if (id && id !== "Blank" && id !== 0) base.push({ slot: s, item: String(id), qty });
        }
        const extra = [];
        for (let s = 0; s < 5; s++) {
          const id = printerX[2 * s + 10 * ci];
          const qty = num(printerX[1 + 2 * s + 10 * ci]);
          if (id && id !== "Blank" && id !== 0) extra.push({ slot: 5 + s, item: String(id), qty });
        }
        return { charIdx: ci, name: charNames?.[ci] ?? null, printing: base, extraSamples: extra };
      }),
    };

    // refinery: per-salt rank/power/cost-to-next-rank + per-bay cycle timers.
    const refi = sel.refinery(save);
    w3.refinery = {
      salts: REFINERY_SALTS.map((salt, g) => {
        const row = refi[3 + g] ?? [];
        const rank = Math.round(num(row[1]));       // Refinery[3+g][1] = rank/level
        const power = num(row[0]);                  // accumulated POW toward next rank
        const cap = REFINERY_POWER_CAP_BY_RANK[Math.min(rank, REFINERY_POWER_CAP_BY_RANK.length - 1)] ?? null;
        return {
          index: g, rawName: salt.rawName, name: salt.displayNameToolbox.replace(/_/g, " "),
          bay: Math.floor(g / 3), rank, power,
          powerToNextRank: cap, powerPct: cap ? Math.min(100, Math.round(power / cap * 1000) / 10) : null,
          unreleased: !!salt.UNRELEASED,
          fuel: salt.fuel.map((f) => ({ item: f.rawName, qty: f.qty })),
        };
      }),
      cycles: REFINERY_BAY_BASE_CYCLE_SECONDS.map((baseSec, bay) => ({
        bay, name: ["Combustion", "Synthesis", "Polymerize"][bay],
        baseCycleSeconds: baseSec,
        timer: num((refi[0] ?? [])[bay + 1]),
      })),
      cycleSpeed: num(e.stats.refineryCycle?.collapsed?.value),
      cycleSpeedLowerBound: !!e.stats.refineryCycle?.collapsed?.lowerBound,
      saltLickUpgrades: SALT_LICK_UPGRADES.map((u) => ({ i: u.i, name: u.displayNameToolbox.replace(/_/g, " "), level: num(sel.saltLickLevels(save)[u.i]), maxLevel: u.maxLevel })),
    };

    // worship: per-char max charge (worshipCharge recipe, as-if-active) + totems. currentCharge is
    // the runtime PlayerStuff[0] meter — ABSENT from the save, so it is omitted honestly.
    const totemBest = (sel.totems(save)[0] ?? []);
    w3.worship = {
      currentChargeAvailable: false,   // PlayerStuff[0] not in the save
      byChar: save.charIdxs.map((ci) => {
        const r = evaluate(worshipCharge, save, { activeChar: ci });
        return { charIdx: ci, name: charNames?.[ci] ?? null, worshipLevel: sel.worshipLevelOf(save, ci), maxCharge: num(r.value), maxChargeLowerBound: r.lowerBound };
      }),
      totems: WORSHIP_TOTEMS.map((t) => ({
        trialType: t.trialType, critter: t.critter, mapId: t.mapId,
        reqLevel: t.reqLevel, chargeReq: t.chargeReq,
        bestWaves: Math.round(num(totemBest[t.trialType])),
      })),
    };

    // towers: the 9 Construction towers (level vs base max; extensions not folded in).
    const towerLv = sel.towerLevels(save);
    w3.towers = TOWER_INFO.map((t) => ({
      id: t.id, name: t.name.replace(/_/g, " "), level: Math.round(num(towerLv[t.id])), maxLevel: t.maxLevel,
    }));

    // atoms: enrich the account-wide atom list with per-atom cost-to-next + max level.
    const maxAtomLv = atomMaxLevel(ctx);
    w3.atoms = ATOM_INFO.map((a) => {
      const level = Math.round(num(sel.atoms(save)[a.id]));
      const cost = atomCost(ctx, a.id);
      return {
        id: a.id, name: a.name.split("_-_")[0].replace(/_/g, " "), level, maxLevel: maxAtomLv,
        bonus: Math.round(atomBonus(ctx, a.id) * 100) / 100,
        costToNext: level >= maxAtomLv ? null : Math.round(num(cost.value)),
        costLowerBound: cost.status === "partial",
      };
    });

    // shrines: level + placement. Shrine[i][3] = level; [i][2] is an X coord (per w123), not a
    // reliable map id -> map placement omitted rather than guessed.
    const shrineRows = sel.shrineLevels(save);
    w3.shrines = SHRINE_INFO.map((s, i) => ({
      id: i, name: s.name.replace(/_/g, " "),
      level: Math.round(num((shrineRows[i] ?? [])[3])),
    }));

    // library: checkout speed multiplier + book count + count-based breakpoints (NO timers).
    const libMul = libraryBonusMultiplier(ctx);
    w3.library = {
      booksCheckedOut: num((save.get("OptLacc") ?? [])[55]),
      checkoutRate: Math.round(num(libMul.value) * 1000) / 1000,
      checkoutRateLowerBound: libMul.status === "partial",
      breakpoints: checkoutBreakpoints(num(libMul.value) || 1, [16, 18, 20]),
    };

    // death note: the raw per-mob kills array is NOT a save key (confirmed absent). We surface the
    // Death Note construction-tower level (the multikill lever) and flag kills as unavailable.
    w3.deathnote = {
      towerLevel: Math.round(num(towerLv[2])),
      killsAvailable: false,   // per-mob kill tiers need a raw kills array not present in the save
    };

    e.w3 = w3;
  }

  /* ---- W4 (Hyperion Nebula): meals / kitchens / cooking mastery / breeding / territory / rift /
   *      skill mastery ------------------------------------------------------------------------- */
  {
    const ctx = makeCtx(save, { activeChar: artifactSourceChar(save) });
    const num = (x) => Number(x) || 0;
    const w4 = {};

    // meals: per-meal armed bonus (level × coeff × mastery arm × global multi × ribbon arm) +
    // cost-to-next (upper bound) + cap state. All 74; the page trims to what it shows.
    const cap = mealLevelCap(ctx);
    const arm2 = cookingMealBonusMulti(ctx);
    const mealLevels = sel.mealLevels(save);
    w4.mealCap = { value: cap.value, lowerBound: cap.partial };
    w4.mealGlobalMulti = Math.round(arm2.value * 1000) / 1000;
    w4.mealGlobalMultiLowerBound = arm2.partial;
    w4.meals = MEAL_INFO.map((r) => {
      const level = num(mealLevels[r.idx]);
      const a1 = bonusMultiCook(ctx, r.idx);
      const a3 = ribbonBonus(ctx, r.idx);
      const bonus = level > 0 ? level * r.coeff * a1 * arm2.value * a3.value : 0;
      // cap is a documented LOWER bound (unread sources) -> we can't PROVE any meal is capped, so
      // capped stays false while cap.partial and costToNext is always surfaced (a valid resource #).
      const capped = !cap.partial && level >= cap.value;
      const cost = capped ? null : mealCostToNext(ctx, r.idx);
      return {
        idx: r.idx, name: r.name.replace(/_/g, " "), key: r.key, level,
        effect: r.bonusText.replace(/[{]/g, "").replace(/_/g, " ").trim(),
        bonus: Math.round(bonus * 100) / 100,
        ribbonRank: a3.b,
        costToNext: cost == null ? null : (cost < 1e9 ? Math.round(cost) : cost),
        capped,
      };
    });

    // kitchens: ladle levels + status; per-kitchen speed = shared chain × (1 + speedLadle/10).
    const cooking = sel.cooking(save);
    const kShared = num(e.stats.kitchenSpeed?.collapsed?.value);
    w4.kitchens = [];
    for (let k = 0; k < cooking.length; k++) {
      const l = kitchenLadles(ctx, k);
      if (l.status === 0 && l.speed === 0 && l.fire === 0 && l.luck === 0 && k > 0) continue;  // never-owned
      w4.kitchens.push({
        idx: k, status: l.status,
        ladles: { speed: l.speed, fire: l.fire, luck: l.luck },
        speed: Math.round(kShared * (1 + l.speed / 10)),
      });
    }
    w4.kitchenSpeedShared = Math.round(kShared);
    w4.kitchenSpeedLowerBound = !!e.stats.kitchenSpeed?.collapsed?.lowerBound;

    // cooking mastery: rank + purple categories + yellow points spent (per-meal mastery pool).
    const cm = sel.cookMaster(save);
    w4.cooking = {
      mastery: {
        rank: Math.round(num(cm[1]?.[0])),
        rankXp: num(cm[1]?.[1]),
        yellowPointsSpent: (cm[0] ?? []).reduce((a, x) => a + num(x), 0),
        categories: COOKING_MASTERY_CATEGORIES.map((c) => ({ idx: c.idx, name: c.name, level: num(cm[2]?.[c.idx]), feedsExpRate: c.feedsExpRate })),
      },
    };

    // breeding: species unlocked, shiny summary, upgrade levels+live bonus, egg nest.
    const br = sel.breeding(save);
    const shinyLvs = [];
    for (let w = 0; w < 4; w++) {
      const row = br[22 + w] ?? [];
      for (let m = 0; m < row.length; m++) { const xp = num(row[m]); if (xp > 0) shinyLvs.push(shinyLevel(xp)); }
    }
    shinyLvs.sort((a, b) => b - a);
    const eggs = br[0] ?? [];
    w4.breeding = {
      speciesUnlocked: (br[1] ?? []).slice(0, 4).reduce((a, x) => a + num(x), 0),
      shiny: { count: shinyLvs.length, maxLevel: shinyLvs[0] ?? 0, topLevels: shinyLvs.slice(0, 5) },
      upgrades: PET_UPGRADES.filter((u) => u.idx > 0).map((u) => ({
        idx: u.idx, name: u.name.replace(/_\}.*/, "").replace(/_/g, " "),
        level: Math.round(num(br[2]?.[u.idx])), maxLevel: u.maxLevel,
        bonus: Math.round(petUpgBonus(ctx, u.idx) * 1000) / 1000,
      })),
      eggs: { filled: eggs.filter((x) => num(x) > 0).length, slots: eggs.length },
    };

    // territory: the 26 playable forage zones (excludes debug/filler). Save Territory[e] aligns 1:1
    // with the playable list (the client's TerritoryID remap skips the excluded raw index 14).
    const terr = sel.territory(save);
    w4.territory = {
      list: TERRITORY_PLAYABLE.filter((_, e) => e < terr.length).map((t, e) => {
        const row = terr[e] ?? [];
        return {
          idx: e, name: t.name.replace(/_/g, " "), reqBase: t.reqProgBase,
          rounds: Math.round(num(row[1])), progress: num(row[0]),
          claimed: num(row[1]) > 0 || num(row[0]) > 0,
        };
      }),
    };

    // rift: current tier + next-task name (from gamedata-w4-rift). Rift[0]=level, Rift[1]=progress.
    const riftLv = num(sel.riftLevel(save));
    const riftProg = num((save.get("Rift") ?? [])[1]);
    const tier = RIFT_TIERS[riftLv % 70] ?? null;
    const taskType = tier ? tier.taskType : null;
    const task = taskType != null ? RIFT_TASK_TYPES[taskType] : null;
    const nextTask = task ? task.desc.replace(/_/g, " ").replace(/\{.*/, "").replace(/\.\s*@.*/, "").trim() : null;
    w4.rift = {
      level: riftLv, tier: riftLv, mob: tier?.mob ?? null,
      taskType, nextTask, taskReq: task?.req ?? null, progress: riftProg,
      completed: task ? riftProg >= task.req : null,
    };
    // enrich e.misc.rift (kept scalar for the `rift` metric) with tier + next-task alongside.
    e.misc.riftTier = riftLv;
    e.misc.riftNextTask = nextTask;

    // skill mastery: total level per skill across all characters vs the rank thresholds (Rift 15+).
    const skillNames = Object.entries(SKILL).sort((a, b) => a[1] - b[1]).map(([n]) => n);
    const rankOf = (total) => { let r = 0; for (const th of SKILL_MASTERY_RANK_THRESHOLDS) if (total >= th) r++; return r; };
    const masterySkills = [];
    for (let idx = 0; idx < 24; idx++) {
      const total = e.characters.reduce((a, c) => a + num((c.skillLevels ?? [])[idx]), 0);
      if (total <= 0 && idx >= 19) continue;    // skip unused high skill slots with no levels
      masterySkills.push({ idx, name: skillNames[idx] ?? `skill${idx}`, total, rank: rankOf(total) });
    }
    w4.skillMastery = { unlocked: riftLv >= SKILL_MASTERY_UNLOCK_RIFT, unlockRift: SKILL_MASTERY_UNLOCK_RIFT, skills: masterySkills };

    e.w4 = w4;
  }

  return e;
}

/** flat metric map for time-series charts (superset of the old history metrics).
 *  Includes `stat.<recipe>[.<termId>]` rows for every registered stat recipe, so growth
 *  charts can show not just that a stat moved but WHICH term moved it. */
export function metricsFrom(e) {
  return {
    ...(e.stats ? allMetricRows(e.stats) : {}),
    accountLv: e.characters.reduce((s, c) => s + c.level, 0),
    skillsLv: e.characters.reduce((s, c) => s + c.skillsTotal, 0),
    bubbleLv: e.alchemy.bubbleLvTotal,
    stampLv: e.stamps.levelTotal,
    vaultLv: e.engines.vault.levelSum,
    grimoireLv: e.engines.grimoire.levelSum,
    compassLv: e.engines.compass.levelSum,
    tesseractLv: e.engines.tesseract.levelSum,
    dreamsDone: e.equinox.dreamsDone,
    achievesDone: e.achievements.filter((a) => a.done).length,
    artifactScore: e.artifacts.reduce((s, a) => s + a.tier, 0),
    artifactsMaxed: e.sailing.artifactsMaxed,
    sailBankedHours: Math.round(e.sailing.bankedHours * 100) / 100,
    sailChests: e.sailing.chests,
    sailFleetArtiMulti: Math.round(e.sailing.fleetArtiMulti * 100) / 100,
    sailBoatsWithRareChest: e.sailing.boatsWithRareChest,
    sailBoatsWithArtifactFind: e.sailing.boatsWithArtifactFind,
    sailBoatsDead: e.sailing.boatsDeadForArtifacts,
    atomLvTotal: e.atoms.reduce((s, a) => s + a.level, 0),
    greenstacks: e.misc.greenstacks,
    mealLvTotal: e.meals.total,
    cardsFound: e.cards.found,
    researchNodes: e.w7.researchNodes,
    spelunkZones: e.w7.spelunkZones,
    emperorShowdown: e.emperor.showdown,
    rift: e.misc.rift,
    farmCropsFound: e.farming.cropsFound,
    ...(e.farming.medalCropIdx != null ? { farmMedalCropIdx: e.farming.medalCropIdx } : {}),
    farmTotalOG: e.farming.totalOG,
    farmMaxOG: e.farming.maxOG,
    farmPlotRankTotal: e.farming.plotRankTotal,
    farmBeans: e.farming.beans,
    farmStickers: e.farming.stickersTotal,
    farmExoticLv: e.farming.exoticLvTotal,
    ...(e.w2 ? {
      w2VialsUnlocked: e.w2.vials.length,
      w2SigilsUnlocked: e.w2.sigils.filter((s) => s.tier >= 0).length,
      w2BubblesPerDay: e.w2.nblb.bubblesLeveledPerDay,
      w2LiquidCap0: e.w2.liquids[0]?.capacity ?? 0,
      w2FishCurrency: e.w2.fishing.fishCurrency,
      w2IslandsUnlocked: (e.w2.islands.list ?? e.w2.islands).filter((i) => i.unlocked).length,
    } : {}),
  };
}
