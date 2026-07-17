/* savemap.mjs — the ONE place where raw IdleOn save keys and magic indices are named.
 *
 * WHY THIS EXISTS
 * The save is 817 flat keys of JSON-in-strings with undocumented numeric indices
 * (`OptLacc[124]`, `Holes[15][12]`, `Boats[i][0]`). Every new feature used to start with
 * archaeology. This module is the registry: raw key -> named, documented, evidenced entry.
 *
 * GROUND TRUTH is the decompiled client (N.js, gitignored, never committed). Community
 * sources have been wrong repeatedly, so every entry carries `evidence` (where in N.js it
 * was confirmed) and `confidence`. Read the confidence before you trust the label:
 *   confirmed — read in N.js; we know what the client does with it. `evidence` cites it.
 *   inferred  — shape/name look obvious from the data or a nearby label, NOT confirmed.
 *   unknown   — we genuinely do not know. This is an honest answer; do not "improve" it
 *               into a guess. A wrong label is worse than none: it gets trusted later.
 *
 * SAVE KEY != RUNTIME ATTRIBUTE NAME. The client saves under different names than it reads
 * (`ForgeLV` -> getGameAttribute("FurnaceLevels"), `Print` -> "Printer", `Holes` -> "Holes"
 * but `OptLacc` -> "OptionsListAccount"). Grepping N.js for the SAVE key silently returns
 * nothing for ~16 of these. `attr` records the runtime name; that is what to grep.
 * Source of truth for this mapping: the save writer's run of `addSaveEntry*(...)` calls and
 * the matching `getLoad*` loader (N.js ~offset 19218038).
 *
 * SCOPE — the subtle part, and the one most likely to produce a plausible-but-wrong number.
 * A value stored per character does NOT necessarily only affect that character:
 *   character           — affects only that character (their equipment, their talents).
 *   account             — one copy, account-wide.
 *   account-via-aggregate — stored per character, account effect is an aggregate over all of
 *                         them (max/sum/count). `agg` records which. Both the per-character
 *                         rows AND the derived account value are real; keep both.
 *   account-via-active  — stored per character, but only ONE character's copy is live at a
 *                         time (the active/acting one). `governs` records which character
 *                         decides. NEVER assume character 0 — IdleonToolbox hardcodes
 *                         `characters[0]` for star signs and is simply wrong for anyone whose
 *                         active character isn't index 0. Copying that bug would be a real
 *                         defect for accounts other than the author's.
 */

import CHARACTER from "./savemap/character.mjs";
import W123 from "./savemap/w123.mjs";
import W45 from "./savemap/w45.mjs";
import W67 from "./savemap/w67.mjs";
import ACCOUNT from "./savemap/account.mjs";
import SAILING from "./savemap/sailing.mjs";
import COMPANIONS from "./savemap/companions.mjs";

/** The registry: save key (or `Foo_N` family pattern) -> entry. */
export const MAP = { ...CHARACTER, ...W123, ...W45, ...W67, ...ACCOUNT, ...SAILING, ...COMPANIONS };

/* PostOfficeInfo0/1/2 are three fixed save keys sharing one shape (NOT a per-character
 * family — the writer emits three hardcoded calls with no character suffix). Mirror the
 * documented entry rather than repeating it. */
if (MAP.PostOfficeInfo0) for (const n of [1, 2]) MAP["PostOfficeInfo" + n] = { ...MAP.PostOfficeInfo0, desc: MAP.PostOfficeInfo0.desc + ` (page ${n})` };

export const CHAR_SLOTS = 11;   // 11 character slots; `Foo_N` families run _0.._10

/** Families are stored as `Foo_0`..`Foo_10`; the registry keys them as `Foo_N`. */
export const famKey = (key) => key.replace(/_\d+$/, "_N");

/** Registry lookup that understands family suffixes. */
export const entryFor = (key) => MAP[key] ?? MAP[famKey(key)] ?? null;

const parseValue = (v, how) => {
  if (how === "raw") return v;
  if (how === "csv") return typeof v === "string" ? v.split(",").filter((x) => x !== "") : v;
  if (typeof v !== "string") return v;
  try { return JSON.parse(v); } catch { return v; }
};

/** A parsed, cached view over one raw save. The only thing that should touch `raw` directly. */
export class Save {
  constructor(raw, charNames = null) {
    this.raw = raw;
    this.charNames = charNames;
    this._cache = new Map();
  }

  /** Parsed value for a save key, per its registry `parse` rule. Cached. Null if absent. */
  get(key) {
    if (this._cache.has(key)) return this._cache.get(key);
    const e = entryFor(key);
    const v = key in this.raw ? parseValue(this.raw[key], e?.parse ?? "json") : null;
    this._cache.set(key, v);
    return v;
  }

  /** Per-character value: `at("Lv0_N", 2)` -> parsed `Lv0_2`. */
  at(famPattern, charIdx) { return this.get(famPattern.replace(/_N$/, "_" + charIdx)); }

  /** Character slots actually present in this save. */
  get charIdxs() {
    const out = [];
    for (let i = 0; i < CHAR_SLOTS; i++) if (("Lv0_" + i) in this.raw) out.push(i);
    return out;
  }

  /** Aggregate a per-character family across all present characters. */
  agg(famPattern, fn, how = "max") {
    const vals = this.charIdxs.map((i) => fn(this.at(famPattern, i), i)).filter((x) => x != null);
    if (!vals.length) return null;
    if (how === "max") return Math.max(...vals);
    if (how === "min") return Math.min(...vals);
    if (how === "sum") return vals.reduce((a, b) => a + b, 0);
    if (how === "count") return vals.filter(Boolean).length;
    return vals;
  }
}

export const openSave = (raw, charNames = null) => new Save(raw, charNames);

/** Values of a save container as a plain array.
 * TRAP: some nested containers deserialize as OBJECTS carrying a literal `length` KEY
 * (e.g. CauldronInfo[4], the 88 vials, has keys "0".."87" plus "length": 88). A bare
 * Object.values() therefore yields 89 entries with the count itself smuggled in as data —
 * which silently miscounts anything that filters on value (it made 88 look like a maxed vial).
 * Always go through this. */
export const vals = (v) => {
  if (v == null) return [];
  if (Array.isArray(v)) return v;
  if (typeof v !== "object") return [v];
  return Object.keys(v).filter((k) => k !== "length").map((k) => v[k]);
};

/* ------------------------------------------------------------------------ *
 * Named selectors — the magic indices, resolved exactly once, here.
 * Each cites the registry entry that documents it. domain.mjs consumes THESE,
 * never `raw[...]` and never a bare number.
 * ------------------------------------------------------------------------ */

export const SKILL = {   // Lv0_N index = skill id + 1 ([0] is character level)
  mining: 0, smithing: 1, choppin: 2, fishing: 3, alchemy: 4, catching: 5, trapping: 6,
  construction: 7, worship: 8, cooking: 9, breeding: 10, lab: 11, sailing: 12, divinity: 13,
  gaming: 14, farming: 15, sneaking: 16, summoning: 17, coloseum: 18,
};
export const skillLv = (s, charIdx, skill) => (s.at("Lv0_N", charIdx) ?? [])[SKILL[skill] + 1] ?? 0;

export const sel = {
  /* --- sailing ------------------------------------------------------------ */
  /** Sailing[3]: artifact tier per artifact (0=unfound .. 6=Transcendent). Account-wide. */
  artifactTiers: (s) => (s.get("Sailing") ?? [])[3] ?? [],
  /** Sailing[2] = [captainsUnlocked, boatsUnlocked]. */
  captainsUnlocked: (s) => ((s.get("Sailing") ?? [])[2] ?? [])[0] ?? null,
  boatsUnlocked: (s) => ((s.get("Sailing") ?? [])[2] ?? [])[1] ?? null,
  /** Sailing[1] = sailing treasure currency (NOT the chest pile). */
  treasures: (s) => (s.get("Sailing") ?? [])[1] ?? [],
  /** Sailing[0] = per-boat island assignment / -1 when unowned (see registry). */
  boatIslands: (s) => (s.get("Sailing") ?? [])[0] ?? [],
  /** Captains[i] = [tier, statIdA, statIdB, level, xp, rollA, rollB]. */
  captains: (s) => s.get("Captains") ?? [],
  /** Boats[i] = [captainIdx, island, ...]. [3] and [5] feed DaveyJonesBonus. */
  boats: (s) => s.get("Boats") ?? [],
  chests: (s) => s.get("SailChests") ?? [],
  /** Sailing skill level. Shared across ALL characters (every Lv0_N[13] is identical),
   *  so this is account-wide despite per-character storage. Verified in this save: all 11
   *  characters read 171. The client reads the ACTIVE character's Lv0[13]; taking the max is
   *  equivalent while the game keeps them in sync, and is robust if it ever doesn't. */
  sailingLv: (s) => s.agg("Lv0_N", (lv) => lv?.[SKILL.sailing + 1] ?? 0, "max") ?? 0,
  /** OptLacc[124] = banked sailing seconds, account-wide.
   *  Scope note: Sailor At Heart / Big P fire on whichever character does the claim, but the
   *  banked time itself lands here, account-wide. */
  bankedSailingSeconds: (s) => (s.get("OptLacc") ?? [])[124] ?? 0,

  /* --- artifact-find inputs ---------------------------------------------- */
  /** Count of tier-6 captains, capped at 30 by the client's own loop bound.
   *  N.js: `NONdummies[60]=0; for g in 0..min(30,Captains.length): if Captains[g][0]==6: ++`. */
  tier6CaptainCount: (s) => sel.captains(s).slice(0, 30).filter((c) => c?.[0] === 6).length,
  /** ArcadeUpg[i] = arcade upgrade level. 32 and 66 both feed artifact find. */
  arcadeUpg: (s) => s.get("ArcadeUpg") ?? [],
  /** BribeStatus[i] = 1 when bought. Bribe 34 = "Artifact Pilfering" (+20%). */
  bribeStatus: (s) => s.get("BribeStatus") ?? [],
  /** CauldronInfo[4] = 88 vial levels. Turtle Tisane ("6turtle") is index 74. */
  vialLevels: (s) => (s.get("CauldronInfo") ?? [])[4] ?? [],
  /** Holes[15][12] = Monument of Justice level. */
  monumentJusticeLv: (s) => ((s.get("Holes") ?? [])[15] ?? [])[12] ?? 0,
  /** Holes[1] = villager levels. */
  villagerLevels: (s) => ((s.get("Holes") ?? [])[1] ?? []),
  /** OptLacc[228] = Killroy artifact-find stat; bonus = 1 + X/(300+X). */
  killroyStat: (s) => (s.get("OptLacc") ?? [])[228] ?? 0,
  /** GemItemsPurchased[8] = Davey Jones Training purchases (+50% each, ADDITIVE in code). */
  daveyJonesPurchases: (s) => (s.get("GemItemsPurchased") ?? [])[8] ?? 0,
  /** Spelunk[6] = list of discovered spelunking material names; its LENGTH feeds 1.02^n. */
  spelunkMaterials: (s) => (s.get("Spelunk") ?? [])[6] ?? [],
  /** Spelunk[9][i] = gaming palette level i. */
  paletteLevels: (s) => (s.get("Spelunk") ?? [])[9] ?? [],
  /** Gaming[12] = string of purchased super-bit letters; membership test via Number2Letter. */
  superBits: (s) => (s.get("Gaming") ?? [])[12] ?? "",
  /** OptLacc[594] = Minehead button presses; drives Button_Bonuses buckets. */
  mineheadButtonPresses: (s) => (s.get("OptLacc") ?? [])[594] ?? 0,
  /** Spelunk[18][i] = Legend Talent level i. Thingies("LegendPTS_bonus",i,0) =
   *  round(level * LegendTalents[i][2]). */
  legendTalentLevels: (s) => (s.get("Spelunk") ?? [])[18] ?? [],
  /** Spelunk[0][i] = 1 when lore book i is owned. Spelunk("DoWeHaveLoreN1",i,0) = level>=1. */
  loreOwned: (s) => (s.get("Spelunk") ?? [])[0] ?? [],
  /** Spelunk[13][2] = how many Spelunky lore-epic bonuses are unlocked; LoreEpiBon only builds
   *  entries with index < this. */
  loreEpicUnlocked: (s) => ((s.get("Spelunk") ?? [])[13] ?? [])[2] ?? 0,
  /** Grimoire[i] = grimoire upgrade level i. 17 = "Grey_Tome_Book", coeff 1 -> the level IS
   *  the % ("}x_higher_bonuses_from_the_Tome"). */
  grimoireLv: (s, i) => Number((s.get("Grimoire") ?? [])[i] ?? 0),
  /** Research[9][i] = farming sticker level i. Sticker 2 = artifact find (CustomLists.Research
   *  [24][2] "Increases_Artifact_Find_Chance..."), coeff Research[25][2] = 15. */
  stickerLevels: (s) => (s.get("Research") ?? [])[9] ?? [],
  /** OptLacc[184] = Fractal Island progress points; compared against a fixed threshold ladder to
   *  produce the RandomEvent("FractalIslandBonus") flags. */
  fractalIslandPts: (s) => Number((s.get("OptLacc") ?? [])[184] ?? 0),
  /** OptLacc[379] = CSV of PERMANENTLY UNLOCKED equipment set names. A set listed here grants its
   *  bonus with NO pieces equipped, which is what makes GetSetBonus derivable from the save
   *  without knowing the active character's gear. Leading element is a literal "0". */
  setsPermaUnlocked: (s) => new Set(String((s.get("OptLacc") ?? [])[379] ?? "").split(",").map((x) => x.trim()).filter(Boolean)),
  /** WeeklyBoss["d_"+i] === -1 means dream cloud i is done. Dreamstuff("CloudBonus",i) is that
   *  0/1 flag — NOT a magnitude. */
  cloudBonus: (s, i) => (((s.get("WeeklyBoss") ?? {})["d_" + i]) === -1 ? 1 : 0),
  /** OptLacc[606] = CSV STRING of companion ids acquired with a Pet Bonus Token.
   *  These have no `_comp` entry, so they are a genuinely separate ownership source — the
   *  client's own getCompanions reads both. Note it is a string ("57"), not an array. */
  companionsFromTokens: (s) => String((s.get("OptLacc") ?? [])[606] ?? "").split(",").map((x) => Number(x.trim())).filter((n) => Number.isFinite(n)),

  /** Companion ids from the RTDB `_comp/{uid}` doc. `l` is one CSV entry per owned COPY;
   *  field 0 is the companion id. Returns null when the doc is ABSENT (old snapshot or a
   *  failed fetch) — null means "we don't know", which is NOT the same as "owns nothing",
   *  and callers must keep that distinction or they will silently under-report bonuses. */
  companionsFromRtdb: (s) => {
    const c = s.get("__companions");
    if (!c || !Array.isArray(c.l)) return null;
    return c.l.map((row) => Number(String(row).split(",")[0])).filter((n) => Number.isFinite(n));
  },

  /** OWNED companions = RTDB `l` UNION Pet-Bonus-Token ids (OptLacc[606]). Null when the RTDB doc
   *  is absent — that means "we don't know", and it is the ONLY honest answer.
   *  TRAP (this was a live bug): the token list is a SUPPLEMENT to the RTDB doc, not a substitute.
   *  Falling back to `new Set(tokens)` when the doc is missing returns a set that LOOKS
   *  authoritative, so callers report "companion 43 not owned" as *computed* when the truth is
   *  "we never fetched the doc". On this account that silently dropped ~2.5x of artifact find
   *  (companions 43, 154 and the arcade-doubling 27) while claiming certainty. Never do that:
   *  a null here is what makes the caller flag a lower bound. */
  companionsOwned: (s) => {
    const rtdb = sel.companionsFromRtdb(s);
    if (rtdb === null) return null;
    return new Set([...rtdb, ...sel.companionsFromTokens(s)]);
  },

  /** Equipped companions (`_comp.e`), same CSV form. Not needed for artifact find — the
   *  client's Companions() reads OWNERSHIP, not equipped — but recorded for completeness. */
  companionsEquipped: (s) => {
    const c = s.get("__companions");
    if (!c || !c.e) return null;
    return String(c.e).split(",").map(Number).filter(Number.isFinite);
  },
  /** UpgVault[i] = vault upgrade levels (90 real entries). */
  upgVault: (s) => s.get("UpgVault") ?? [],

  /* --- star signs: account-via-active ------------------------------------ */
  /** PVtStarSign_N = CSV of equipped star sign ids for character N (trailing comma!).
   *  The client builds DNSM.StarSigns from PersonalValuesMap.StarSign — i.e. the ACTIVE
   *  character's list. So "do I have Artifosho?" is a question about ONE character, not the
   *  account. Callers MUST pass which character is acting. */
  starSignsOf: (s, charIdx) => String(s.raw["PVtStarSign_" + charIdx] ?? "").split(",").filter((x) => x && x !== "_").map(Number),
  hasStarSign: (s, charIdx, id) => sel.starSignsOf(s, charIdx).includes(id),
  /** Which characters have a given star sign equipped — lets the UI ask instead of guessing. */
  charsWithStarSign: (s, id) => s.charIdxs.filter((i) => sel.hasStarSign(s, i, id)),

  /* --- misc already consumed by domain.mjs ------------------------------- */
  achieveReg: (s) => s.get("AchieveReg") ?? [],
  emperorShowdown: (s) => (s.get("OptLacc") ?? [])[369] ?? 0,
  emperorAttempts: (s) => Math.max(0, -(((s.get("OptLacc") ?? [])[370] ?? 0) - 1)),
  atoms: (s) => s.get("Atoms") ?? [],
  mealLevels: (s) => (s.get("Meals") ?? [])[0] ?? [],
  dream: (s) => s.get("Dream") ?? [],
  weeklyBoss: (s) => s.get("WeeklyBoss") ?? {},
  grimoire: (s) => s.get("Grimoire") ?? [],
  compass: (s) => (s.get("Compass") ?? [])[0] ?? [],
  tesseract: (s) => s.get("Arcane") ?? [],
  research: (s) => s.get("Research") ?? [],
  ninja: (s) => s.get("Ninja") ?? [],
  summon: (s) => s.get("Summon") ?? [],
  sushi: (s) => s.get("Sushi") ?? [],
  rift: (s) => s.get("Rift") ?? [],
  lab: (s) => s.get("Lab") ?? [],
  breeding: (s) => s.get("Breeding") ?? [],
  farmUpg: (s) => s.get("FarmUpg") ?? [],
  farmCrop: (s) => s.get("FarmCrop") ?? {},
};

/** Registry coverage, for the report / a future UI panel. */
export function coverage() {
  const by = { confirmed: 0, inferred: 0, unknown: 0 };
  for (const k of Object.keys(MAP)) by[MAP[k].confidence] = (by[MAP[k].confidence] ?? 0) + 1;
  return { entries: Object.keys(MAP).length, ...by };
}
