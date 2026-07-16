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
