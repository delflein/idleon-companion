/* domain.mjs — parses a raw IdleOn save into structured domain entities.
 * Single source of truth for save-parsing on the server side.
 * Reference constants verified against Morta1/IdleonToolbox data (v1.19, 2026-07).
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { openSave, sel } from "./savemap.mjs";
import { boatArtiMulti } from "./artifactchance.mjs";

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

const DIR = dirname(fileURLToPath(import.meta.url));

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
   * BoatArtiMulti of ~2.18e7 (see artifactchance.mjs), which fixes TranscendentChances(13) at
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
   * exactly. What settles it is the INDEPENDENT term-by-term computation in artifactchance.mjs:
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
    calibrated: true,          // <- set false only if these are ever read from remote config
    note: "Firebase remote config; no default exists in the client. Inferred from the in-game display + one chest reading + the independent term computation. Absolute odds inherit the uncertainty; ratios do not.",
  },
  equinoxUpgrades: ["Equinox Dreams","Equinox Resources","Shades of K","Liquidvestment","Matching Scims","Slow Roast Wiz","Laboratory Fuse","Metal Detector","Faux Jewels","Food Lust","Equinox Symbols","Voter Rights","Nonstop Studies","Hmm..."],
  dreamTotal: 77, mealCount: 74, mealCapMax: 160,
  grimoireCount: 55, compassCount: 173, tessCount: 63, vaultCount: 90,
  cavernCount: 18, achieveTotal: 268,
  classes: {1:"Beginner",2:"Journeyman",3:"Maestro",4:"Voidwalker",5:"Infinilyte",7:"Warrior",8:"Barbarian",9:"Squire",10:"Blood Berserker",12:"Divine Knight",13:"Royal Guardian",14:"Death Bringer",19:"Archer",20:"Bowman",21:"Hunter",22:"Siege Breaker",23:"Mayheim",25:"Beast Master",29:"Wind Walker",31:"Mage",32:"Wizard",33:"Shaman",34:"Elemental Sorcerer",35:"Spiritual Monk",36:"Bubonic Conjuror",40:"Arcane Cultist"},
};

/* achievement dataset (names, categories, tips) lives in achievements-data.json */
let ACH = null;
export function achData() {
  if (ACH) return ACH;
  const p = join(DIR, "achievements-data.json");
  ACH = existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : { achievements: [] };
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
function extractSailing(P, sail, art, save) {
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
  const islands = REF.islands.map((isl) => {
    const off = islandOffset(isl.i);
    const arts = Array.from({ length: isl.count }, (_, k) => ({
      i: off + k, name: REF.artifacts[off + k] ?? "?", tier: art[off + k] || 0,
    }));
    const unmaxed = arts.filter((a) => a.tier < REF.maxArtifactTier).length;
    return { ...isl, offset: off, artifacts: arts, unmaxed, divisor: transcendentChances(isl.i) };
  });

  const banked = opt[124] || 0;
  const maxed = art.filter((t) => t >= REF.maxArtifactTier).length;
  const remaining = REF.artifacts.length - maxed;

  /* The multiplier the game shows as "Artifact Find Chance", COMPUTED from the save rather
   * than pasted from one account's screen. Boat 0, because that is the boat the client's own
   * info panel displays (`NotateNumber(Sailing("BoatArtiMulti",0,0)/1, "MultiplierInfo")`).
   * activeChar governs Artifosho and is not in the save — see `artifactSourceChar` above.
   * companions default to sel.companionsOwned() (the `_comp` RTDB doc unioned with the
   * OptLacc[606] token buys); absent on pre-`_comp` snapshots -> those terms stay unknown.
   * labConnectedIds is left null: lab-board connectivity is not simulated, so MainframeBonus
   * (10)/(14) stay unknown rather than being assumed either way. That is deliberate — guessing
   * "connected" would inflate every friend's number by 3x. */
  const activeChar = artifactSourceChar(save);
  const arti = boatArtiMulti(save, 0, { activeChar });

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
    artiActiveChar: activeChar,
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

  // sailing
  e.sailing = extractSailing(P, sail, art, save);

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
  e.w7 = {
    spelunkZones: (((P("Spelunk") || [])[0]) || []).filter((x) => x > 0).length,
    researchNodes: (((P("Research") || [])[0]) || []).filter((x) => x > 0).length,
  };
  e.caverns = { villagerLevels: ((holes[1]) || []).filter((x) => x > 0) };

  return e;
}

/** flat metric map for time-series charts (superset of the old history metrics) */
export function metricsFrom(e) {
  return {
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
  };
}
