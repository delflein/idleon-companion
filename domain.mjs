/* domain.mjs — parses a raw IdleOn save into structured domain entities.
 * Single source of truth for save-parsing on the server side.
 * Reference constants verified against Morta1/IdleonToolbox data (v1.19, 2026-07).
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

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

  /* Chest rarity is rolled per trip:
   *   roll = RandomFloat(0,1) / (1 + (captainRareChest + arrowheadBonus) / 200)
   * then compared against the nested thresholds below (lower roll = rarer).
   *
   * artiMulti is 1.4^r, NOT the 1.70^r reported by the decompile research.
   * Verified 2026-07-16 against in-game readings on Isle of Note (one boat,
   * so BoatArtiMulti is held constant): basic 1-in-14,933 and iron 1-in-10,666
   * give a ratio of 1.4001. 1.7 additionally mispredicts golden (0.02% vs 0.01%
   * observed) and purple (0.03% vs 0.02% observed). Do not "fix" this back to 1.7.
   */
  chestTiers: [
    { r: 0, name: "Basic",   threshold: 1.0,      artiMulti: 1.0 },
    { r: 1, name: "Iron",    threshold: 0.25,     artiMulti: 1.4 },
    { r: 2, name: "Gilded",  threshold: 0.05,     artiMulti: 1.96 },
    { r: 3, name: "Noble",   threshold: 0.007,    artiMulti: 2.744 },
    { r: 4, name: "Occult",  threshold: 0.0003,   artiMulti: 3.8416 },
    { r: 5, name: "Miracle", threshold: 0.000001, artiMulti: 30 },  // UNVERIFIED: research says Miracle is a flat 30 override, sourced under the 1.7 model. Too rare to observe (~1e-6). Treat as suspect.
  ],
  arrowheadIdx: 9,      // Arrowhead artifact: +25 to the rare-chest divisor at Ancient+, and it unlocks the Minimum Chest filter
  arrowheadBonus: 25,
  fauxoryTuskIdx: 3,    // Fauxory Tusk: the bulk of the additive artifact-find pool
  maxArtifactTier: 6,   // Transcendent
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

/** Sailing: captains, boats, banked time, per-boat chest quality.
 * NOT parsed, because it is not in the save: the Minimum Chest filter. The
 * IdleonToolbox parser never reads it either, which is decent evidence it lives
 * outside Sailing/Boats/Captains/SailChests. Best unverified lead is OptLacc
 * near 124 (where banked sailing time lives). Until found, the UI must ask. */
function extractSailing(P, sail, art) {
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

  const banked = opt[124] || 0;
  const maxed = art.filter((t) => t >= REF.maxArtifactTier).length;
  return {
    bankedSeconds: banked,
    bankedHours: banked / 3600,
    arrowheadBonus: arrowhead,
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
  e.sailing = extractSailing(P, sail, art);

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
