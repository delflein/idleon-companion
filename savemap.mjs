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

  /* --- W5 Gaming Garden (Gaming / GamingSprout / Spelunk) ------------------ */
  /** Gaming[] — flat W5 gaming array (savemap/w45 "Gaming", confirmed). [0]=bits, [1..3]=fertilizer
   *  levels, [4]=mutant count, [5]=DNA, [7]=mutate-upg count, [8]=best-nugget (bits multi input),
   *  [9]=acorns, [12]=superbit letter string, [14]=king tokens. */
  gaming: (s) => s.get("Gaming") ?? [],
  /** GamingSprout[] — rows 0..24 plots, 25..33 state rows (savemap/w45 "GamingSprout", inferred).
   *  Import row b lives at GamingSprout[25+b]; [32]=Immortal Snail ([1]=level), [33]=King Rat
   *  ([1..3]=shop levels). [28][2]=Elegant Seashell rank. */
  gamingSprout: (s) => s.get("GamingSprout") ?? [],
  /** Spelunk[] — W5 lore/palette/gaming state (savemap/w67 "spelunking", confirmed). [9]=palette
   *  levels (see paletteLevels), [18]=legend talents (see legendTalentLevels), [0]=lore flags. */
  spelunk: (s) => s.get("Spelunk") ?? [],
  /** GamingSprout[32][1] = Immortal Snail level (import row 25+7). Feeds SnailStuff(2)=bits multi
   *  and PaletteLuck's "Lucky Snail" superbit term. N.js:17773-17776. confidence: inferred
   *  (row 32 confirmed as a non-plot state row; the [1]=level mapping is cross-checked against
   *  IdleonToolbox's snailBonus/snailLevel and the "2^min(25,Lv)*1.5^..." bits curve). */
  snailLevel: (s) => Number((sel.gamingSprout(s)[32] ?? [])[1] ?? 0),
  /** GamingSprout[33][b+1] = Rat King shop upgrade level b (0..2). RatShopBonuses(b), N.js:17773. */
  ratShopLevel: (s, b) => Number((sel.gamingSprout(s)[33] ?? [])[b + 1] ?? 0),

  /* --- W5 The Cavern / Slab (Holes / Cards1 / GreenStacks) ----------------- */
  /** Holes[] — W5 caverns (savemap/w67 "caverns", confirmed). [1]=villager levels, [3]=opals
   *  invested per villager (the multiplicative base in VillagerExpPerHour), [23]=per-villager
   *  additive term (raw, not %). */
  holes: (s) => s.get("Holes") ?? [],
  /** Holes[3][b] = opals invested in villager b. Confirmed as the villager EXP/hr multiplicative
   *  base via LeastOpalsInVillager (N.js:18321 scans this same array). Holes[3] is not in
   *  savemap/w67's documented idx list — evidence: sample [5,5,5,5,382,0,...] aligns with the 5
   *  active villagers. confidence: inferred. */
  villagerOpals: (s) => sel.holes(s)[3] ?? [],
  /** Holes[23][b] = per-villager additive EXP/hr term (RAW, used as `1 + Holes[23][b]`, NOT /100).
   *  N.js:18227-18229. Sample [0,0,1,0,...] -> villager 2 doubled. confidence: inferred/anomaly
   *  (the only other Holes[23] refs treat it as a 0/1 UI flag; transcribed verbatim). */
  villagerRawTerm: (s) => sel.holes(s)[23] ?? [],
  /** Cards1 = ACCOUNT-WIDE item-discovery log; its LENGTH is the Slab "items ever found" counter
   *  (client's Cards[1].length). savemap/character.mjs "Cards1" (confirmed). Slab bonuses floor()
   *  over this length. */
  slabItems: (s) => s.get("Cards1") ?? [],
  slabItemCount: (s) => (sel.slabItems(s) ?? []).length,
  /** GreenStacks = items green-checkmarked on the Slab (picked up from a chest at least once).
   *  savemap/account.mjs "greenStacks" (confirmed). Its length feeds a Lab Mainframe bonus. */
  greenStacks: (s) => s.get("GreenStacks") ?? [],
  /** Jars = jar-container collection (savemap/w123 "jars"). Length = jars owned; geometry-only
   *  fields are documented, contents unmapped. Exposed for the entity count. */
  jars: (s) => s.get("Jars") ?? [],
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

  /** StampLv[tab] = dict slot -> level (3 tabs; dict carries a literal "length" key — use vals()
   *  for iteration, direct [slot] for lookups). Account-wide. */
  stampTab: (s, tab) => (s.get("StampLv") ?? [])[tab] ?? {},

  /* --- cards & chips ------------------------------------------------------ */
  /** Cards0 = ACCOUNT-WIDE map cardId -> lifetime collect count (drives star tier). */
  cardsCollected: (s) => s.get("Cards0") ?? {},
  /** CardEquip_N = the character's 12 equipped card ids; "B" = empty slot. */
  cardEquip: (s, charIdx) => s.at("CardEquip_N", charIdx) ?? [],
  /** CSetEq_N = the character's equipped card SET, saved as map bonusText -> value
   *  (this IS the client's Cards[3]; CardSetBonuses reads it via IDforCardSETbonus). */
  cardSetEquipped: (s, charIdx) => s.at("CSetEq_N", charIdx) ?? {},
  /** Lab[1+charIdx] = that character's 7 lab chip slots (ChipDesc id, -1 = empty).
   *  Client: RecalcChipBonuses reads Lab[1 + GetPlayersUsernames.indexOf(name)][0..6]. */
  labChips: (s, charIdx) => ((s.get("Lab") ?? [])[1 + charIdx] ?? []),
  /** OptLacc[155] / OptLacc[603] = CSV card-id lists force-lifted to 6 / 7 stars
   *  (the CardLv overrides at the end of RunCodeOfTypeXforThingY("CardLv")). */
  sixStarCards: (s) => String((s.get("OptLacc") ?? [])[155] ?? "").split(","),
  sevenStarCards: (s) => String((s.get("OptLacc") ?? [])[603] ?? "").split(","),

  /** __serverVars = the Firestore `_vars/_vars` remote-config doc, merged into raw at sync time
   *  (companion.mjs). NOT part of the game save; null on snapshots synced before 2026-07-17.
   *  Known keys: voteCategories ([selected, ...candidates] — the weekly ballot),
   *  votePercent, voteCat2/votePercent2 (Meritocracy), AncientOddPerIsland, AncientArtiPCT. */
  serverVars: (s) => s.get("__serverVars"),
  /** The currently ACTIVE weekly vote bonus id, or null when unknowable (old snapshot). */
  activeVoteId: (s) => {
    const v = sel.serverVars(s)?.voteCategories;
    return Array.isArray(v) && v.length ? Number(v[0]) : null;
  },

  /* --- misc already consumed by domain.mjs ------------------------------- */
  achieveReg: (s) => s.get("AchieveReg") ?? [],
  emperorShowdown: (s) => (s.get("OptLacc") ?? [])[369] ?? 0,
  emperorAttempts: (s) => Math.max(0, -(((s.get("OptLacc") ?? [])[370] ?? 0) - 1)),
  atoms: (s) => s.get("Atoms") ?? [],
  /* --- W3 (Frostbite Tundra) ---------------------------------------------- */
  /** Refinery (renamed from save key "Print"? no — "Refinery"): [0]=cycle timers, [1]=salt-in-slot
   *  item ids, [2]=stored qty, [3+g]=[rank,level,...] per salt. savemap/w123.mjs "Refinery". */
  refinery: (s) => s.get("Refinery") ?? [],
  /** SaltLick[m] = level of Salt Lick bonus m (25 slots, capped at SaltLicks[m][4]). w123 "SaltLick". */
  saltLickLevels: (s) => s.get("SaltLick") ?? [],
  /** Printer (save key "Print" -> "Printer"): 5-num header then [id,qty] stride-2, 14/char. w123 "Print". */
  printer: (s) => s.get("Print") ?? [],
  /** PrinterXtra: extra printer sample slots, [id,qty] stride-2, 10/char. w123 "PrinterXtra". */
  printerXtra: (s) => s.get("PrinterXtra") ?? [],
  /** TowerInfo save (key "Tower"): flat levels — [0..8]=Construction towers, [9..17]=Worship
   *  pillars, [18..26]=Worship shrines. gamedata-w3-towers.mjs + w123 "Tower". */
  towerLevels: (s) => s.get("Tower") ?? [],
  /** TotemInfo: 3 rows of 9 — [0]=best waves per totem, [1]=parallel track, [2]=charge/xp. w123 "TotemInfo". */
  totems: (s) => s.get("TotemInfo") ?? [],
  /** Rift[0] = current Rift level (gates Construction Mastery @40, etc.). */
  riftLevel: (s) => Number((s.get("Rift") ?? [])[0] ?? 0),
  /** Worship skill level for a character = Lv0[9] (SKILL.worship = 8 -> index 9). */
  worshipLevelOf: (s, ci) => Number((s.at("Lv0_N", ci) ?? [])[SKILL.worship + 1] ?? 0),
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
  /** Divinity CSV: [0..11] per-char linked god, [12..23] per-char blessing/second god (-1 none),
   *  [24] points, [25] divinity level. Values map through GodsInfo[g][13] for Bonus_MAJOR. */
  divinity: (s) => {
    const d = s.get("Divinity");
    return Array.isArray(d) ? d : String(d ?? "").split(",").map(Number);
  },
  /** Divinity[28+g] = MAJOR blessing level for god g (0..9). savemap/w45 "Divinity" idx 28..37
   *  (inferred; sample [312,240,240,306,200,213,263,166,167,135] matches the 10 gods). Cost curve
   *  GodsInfo[g][4]*GodsInfo[g][5]^level, N.js:17099/17137. */
  blessingLevel: (s, g) => Number(sel.divinity(s)[28 + g] ?? 0),
  /** Divinity[24] = DIVINITY POINTS (offering currency). savemap/w45 idx 24 (confirmed). */
  divinityPoints: (s) => Number(sel.divinity(s)[24] ?? 0),
  /** Divinity[25] = god rank / divinity level counter (gates god unlocks; max(0,x-10) feeds the
   *  emporium jade blessing scaler). savemap/w45 idx 25 (confirmed as level). */
  godRank: (s) => Number(sel.divinity(s)[25] ?? 0),
  /** Divinity[39] = PARTICLES (Atom Collider currency; also pays gods 5/7/9's blessings).
   *  savemap/w45 idx 39 (confirmed-as-currency). */
  divinityParticles: (s) => Number(sel.divinity(s)[39] ?? 0),
  /** OptionsListAccount[427+b] = Coral Reef "CoralKidUpgBonus" upgrade level b (0..5). This save
   *  stores the account-options array under the key "OptLacc". gamedata-w7-coralreef.mjs:
   *  CoralKidUpgBonus reads OLA[427+b]. Sample OLA[427..432]=[139,53,94,71,82,45]. confidence:
   *  inferred (index cross-checked against the toolbox Coral Reef parser). */
  coralKidLevel: (s, b) => Number((s.get("OptLacc") ?? [])[427 + b] ?? 0),
  breeding: (s) => s.get("Breeding") ?? [],
  /** Cooking[k] = kitchen k row. [k][0]=unlock/status flag (0=locked); [k][6]=speed ladle lv,
   *  [k][7]=fire ladle lv, [k][8]=luck ladle lv; [k][1..5]=meal slots. 10 kitchens.
   *  savemap/w45 "Cooking" (confirmed: TalentCalc(-7) sums Cooking[k][6..8] gated on [k][0]). */
  cooking: (s) => s.get("Cooking") ?? [],
  /** CookMaster: [0]=per-meal cooking-mastery ("yellow") points -> BonusMultiCook (N.js:18136);
   *  [1][0]=mastery RANK, [1][1]=rank XP; [2]=6 purple-category levels. savemap/w45 "CookMaster". */
  cookMaster: (s) => s.get("CookMaster") ?? [],
  /** Ribbon[28+mealIdx] = per-meal ribbon rank -> Summoning("RibbonBonus") (N.js:6214, padded so
   *  slots 28..28+73 map to meals 0..73 at N.js:9438). Saved via addSaveEntryList("Ribbon"). */
  ribbons: (s) => s.get("Ribbon") ?? [],
  /** Pets[i] = [species, ?, power, ?] — Fenceyard (unassigned) pool. savemap/w45 "Pets". */
  pets: (s) => s.get("Pets") ?? [],
  /** PetsStored[i] = [species|"none", territoryIdxStr, power, ?] — assigned/stored pets. savemap/w45 "PetsStored". */
  petsStored: (s) => s.get("PetsStored") ?? [],
  /** Territory[zone] = [progress, roundCount, ...reward tuples]. savemap/w123 "Territory". */
  territory: (s) => s.get("Territory") ?? [],
  farmUpg: (s) => s.get("FarmUpg") ?? [],
  farmCrop: (s) => s.get("FarmCrop") ?? {},
  /** FarmPlot[i] = 7-tuple [seedTier, growthProgress, evoProgress, evoLock, cropsOnVine,
   *  ogLevel, ogAccumulator] — full decode in savemap/w67.mjs (confirmed vs the N.js tick). */
  farmPlots: (s) => s.get("FarmPlot") ?? [],
  /** FarmRank = [perPlotRank[36], perPlotRankExp[36], rankDbUpgradeLevels[20]]. */
  farmRanks: (s) => s.get("FarmRank") ?? [],
  /** OptLacc[416] = exotic-market purchases used this week (reset on week change ~N.js:19535). */
  exoticBuysUsed: (s) => Number((s.get("OptLacc") ?? [])[416] ?? 0),
  /** OptLacc[481] = last seen exotic week index floor(GlobalTime/604800) — from the SAVE, may
   *  lag the real current week; compute the live week from wall clock, never from this. */
  exoticWeekIdx: (s) => Number((s.get("OptLacc") ?? [])[481] ?? 0),
  /** OptLacc[607] = consecutive days without a megacrop sticker (Doggie: odds x2^min(12,days)
   *  then +1500/day past 11; reset to 0 on find — N.js StickerOddsMulti ~17923). */
  stickerDryDays: (s) => Number((s.get("OptLacc") ?? [])[607] ?? 0),
  /** Research[10][plot] = 1 when this plot already produced its megacrop sticker this cycle. */
  plotStickerGiven: (s) => (s.get("Research") ?? [])[10] ?? [],

  /* --- account-wide bonus infrastructure (guild/shrine/prayer/sigil/family/obols/divinity) --- */
  /** Guild[0][d] = level of guild bonus d (18 numbers). _customBlock_GuildBonuses(d) reads
   *  GuildTasks[0][d] as the curve level. Save key "Guild" (w123.mjs). */
  guildBonusLevels: (s) => (s.get("Guild") ?? [])[0] ?? [],
  /** Total guild bonus points spent (sum of the 18 levels) — a rough "guild activity" proxy. */
  guildBonusPointsSpent: (s) => ((s.get("Guild") ?? [])[0] ?? []).reduce((a, x) => a + Number(x || 0), 0),
  /** Shrine[b] = a shrine's save row; [b][3] is its LEVEL (w123.mjs: `.5 < ShrineInfo[b][3]`
   *  gates _customBlock_Shrine; [b][0] is the map it is placed on). */
  shrineLevels: (s) => s.get("Shrine") ?? [],
  /** Prayers_N (per character): 12 equipped prayer slots, -1 = empty, else prayer id. */
  prayersActiveOf: (s, charIdx) => s.at("Prayers_N", charIdx) ?? [],
  /** PrayOwned (account-wide): prayer LEVEL per prayer id (0 = not unlocked). */
  prayersUnlocked: (s) => s.get("PrayOwned") ?? [],
  /** CauldronP2W[4] = sigil stride-2 pairs; [1 + 2*d] is sigil d's TIER (w123.mjs). */
  sigilTiers: (s) => (s.get("CauldronP2W") ?? [])[4] ?? [],
  /** ObolEqMAPz1 = the family/account obol page: sparse map slotIndex -> stat object. */
  obolMapFamily: (s) => s.get("ObolEqMAPz1") ?? {},
  /** ObolEqMAP_N = this character's obol page: sparse map slotIndex -> stat object. */
  obolMapChar: (s, charIdx) => s.at("ObolEqMAP_N", charIdx) ?? {},
  /** CharacterClass_N (per character): class id indexing CustomLists.ClassNames. */
  characterClass: (s, charIdx) => Number(s.at("CharacterClass_N", charIdx) ?? 0),
  /** Lv0_N[0] = character LEVEL; Lv0_N[14] = Divinity skill level (skill 13 -> offset +1). */
  charLevel: (s, charIdx) => Number((s.at("Lv0_N", charIdx) ?? [])[0] ?? 0),
  charDivinityLevel: (s, charIdx) => Number((s.at("Lv0_N", charIdx) ?? [])[14] ?? 0),
  /** GemItemsPurchased[9] gates one Divinity minor bonus (Bonus_Minor e==0). */
  gemItemsPurchased: (s) => s.get("GemItemsPurchased") ?? [],

  /* --- W1: statues / anvil / forge / owl / bribes ------------------------- */
  /** OptionsListAccount — the save renames it "OptLacc"; some snapshots keep the full name. */
  optionsAccount: (s) => s.get("OptionsListAccount") ?? s.get("OptLacc") ?? [],
  /** StatueLevels_N[idx] = [level, exp] for character ci (per-char; statues effective at the
   *  account best). */
  statueLevelsOf: (s, ci) => s.at("StatueLevels_N", ci) ?? [],
  /** StuG[idx] = statue tier (0 base, >=1 gold, >=2 onyx, >=3 zenith). Account-wide. */
  statueTiers: (s) => s.get("StuG") ?? [],
  /** AnvilPAstats_N = per-char [availPoints, coinsPts, matsPts, xpPts, speedPts, capPts]. */
  anvilStatsOf: (s, ci) => s.at("AnvilPAstats_N", ci) ?? [],
  /** AnvilPA_N[slot] = per-char [amount, xp, progress, produced] for the 14 producible items. */
  anvilProductionOf: (s, ci) => s.at("AnvilPA_N", ci) ?? [],
  /** AnvilPAselect_N = per-char 3 selected production slots (index into AnvilPA, -1 = empty). */
  anvilSelectedOf: (s, ci) => s.at("AnvilPAselect_N", ci) ?? [],
  /** ForgeLV = 6 forge/furnace upgrade levels. Account-wide. */
  forgeLevels: (s) => s.get("ForgeLV") ?? [],
  /** ForgeItemOrder = 48-entry (16 slots x 3 stride) forge slot contents ("Blank" = empty). */
  forgeItemOrder: (s) => s.get("ForgeItemOrder") ?? [],
  /** Owl lives in OptionsListAccount: [253] feathers held, [254+i] upgrade i level,
   *  [262] mega-feather tier count, [263] spend progress, [264] shiny-feather count. */
  owlUpgradeLevel: (s, i) => Number((sel.optionsAccount(s))[254 + i] ?? 0),
  owlFeathers: (s) => Number((sel.optionsAccount(s))[253] ?? 0),
  owlMegaTier: (s) => Number((sel.optionsAccount(s))[262] ?? 0),
  owlProgress: (s) => Number((sel.optionsAccount(s))[263] ?? 0),
  owlShinyCount: (s) => Number((sel.optionsAccount(s))[264] ?? 0),

  /* --- W2: alchemy cauldron/liquid P2W, brew track, fishing, ballot ------- */
  /** CauldronP2W = 6-element array: [0] cauldron ladder (3 axes/cauldron), [1] liquid ladder
   *  (2 axes/liquid), [2] vial ladder [attempts,rng], [3] player ladder [speed,extraExp],
   *  [4] sigil pairs, [5] [dailyAttemptsRemaining]. Evidence: gamedata-w2-cauldron.mjs header,
   *  N.js:7372-7379 dispatcher + toolbox getPay2Win destructure. confidence: confirmed. */
  cauldronP2W: (s) => s.get("CauldronP2W") ?? [],
  /** CauldronP2W[5][0] = brew attempts currently remaining (N.js:8774-8776, "DAILY_ATTEMPTS"). */
  vialAttemptsRemaining: (s) => Number(((s.get("CauldronP2W") ?? [])[5] ?? [])[0] ?? 0),
  /** CauldronInfo = per-cauldron/vial/liquid state. [0..3] bubble levels, [4] vial levels,
   *  [8] free "brew progression" track: [8][row][statIdx][1] = level (row 0-3 cauldrons, 4-7
   *  liquids). Evidence: gamedata-w2-liquids.mjs header, N.js:7333/7354-7368. confidence: confirmed. */
  cauldronInfo: (s) => s.get("CauldronInfo") ?? [],
  /** Free brew-track level for a row (0-3 cauldrons, 4-7 liquids) and stat index. */
  brewLevel: (s, row, statIdx) => Number((((((s.get("CauldronInfo") ?? [])[8] ?? [])[row] ?? [])[statIdx] ?? [])[1]) ?? 0),
  /** OptLacc[453] = currently SELECTED Meritocracy category index; OptLacc[472] = MeritocCanVote
   *  flag (1 once voting unlocked). Evidence: gamedata-w2-ballot.mjs, N.js Summoning2 dispatcher. */
  meritocSelected: (s) => Number((s.get("OptLacc") ?? [])[453] ?? -1),
  meritocCanVote: (s) => Number((s.get("OptLacc") ?? [])[472] ?? 0),
  /** OptLacc[123] = per-liquid "bleach liquid" gem-shop unlock counter; GemItemsPurchased[106] =
   *  bleach-liquid purchases. Both feed the LiquidCap bleach term (N.js:7360-7365). */
  bleachLiquidGem: (s) => Number((s.get("GemItemsPurchased") ?? [])[106] ?? 0),
  bleachLiquidOpt: (s) => Number((s.get("OptLacc") ?? [])[123] ?? 0),
  /** Poppy / Fishing Town account options — verbatim index map in gamedata-w2-fishing.mjs
   *  (N.js:18071-18162 Roo* dispatcher). [267] fish currency, [268..278] Poppy upgrade levels,
   *  [279] mega-fish tier count, [281..286] shiny-multi tier levels, [290] reset points,
   *  [291..295] reset-spiral levels, [296] tar currency, [297..304] tar-pit upgrade levels.
   *  All read from OptLacc directly. confidence: confirmed (per-index citations in gamedata). */
  poppyOpt: (s, i) => Number((s.get("OptLacc") ?? [])[i] ?? 0),

  /* --- W6/W7 endgame (Summoning / Sneaking / Emperor / Beanstalk / Zenith / Clam) --------- */
  /** Spelunk[45][b] = OWNED LEVEL of Zenith Market row b (0..9). Feeds
   *  Thingies("ZenithMarketBonus",b,0) = floor(ZENITH_MARKET[b].coeff * level).
   *  gamedata-w7-zenith.mjs. confidence: confirmed (N.js ZenithMarketBonus @byte 10701968 reads
   *  Spelunk[45][b]); savemap/w67.mjs Spelunk.idx does not itemize idx 45 (documented gap). */
  zenithMarketLevel: (s, b) => Number(((s.get("Spelunk") ?? [])[45] ?? [])[b] ?? 0),
  /** OptLacc[464] = Clam Work JOB LEVEL (0..9). ClamWorkBonus(b) = OptLacc[464] > b ? 1 : 0
   *  (a THRESHOLD GATE, not a percent). gamedata-w7-clamwork.mjs, N.js @byte 10709318. */
  clamJobLevel: (s) => Number((s.get("OptLacc") ?? [])[464] ?? 0),
  /** OptLacc[455+b] = Clam Work UPGRADE level b (0..8). ClamBonuses(b) = CLAM_UPG[b].coeff *
   *  OptLacc[455+b]. gamedata-w7-clamwork.mjs, N.js @byte ~10706800. */
  clamUpgLevels: (s) => Array.from({ length: 9 }, (_, b) => Number((s.get("OptLacc") ?? [])[455 + b] ?? 0)),
  /** Spelunk[11][b] = ADVICE FISH ("BigFish") upgrade level b (0..5). BigFishBon(b) =
   *  level/(100+level) * BIG_FISH[b].coeff. gamedata-w7-spelunking.mjs, N.js @byte 10861944. */
  adviceFishLevels: (s) => ((s.get("Spelunk") ?? [])[11] ?? []),
  /** Spelunk[13][b] = CORAL REEF BUILDING level b (0..5). ReefCost(b) reads it.
   *  gamedata-w7-coralreef.mjs, N.js @byte 10713182. */
  reefBuildingLevels: (s) => ((s.get("Spelunk") ?? [])[13] ?? []),

  /** Summon[0][b] = Summoning Upgrade (Ya.SummonUPG, 82 rows) LEVEL b. gamedata-w6-summoning.mjs
   *  SummUpgBonus reads Summon[0][b]. confidence: confirmed. */
  summonUpgLevels: (s) => (sel.summon(s)[0]) ?? [],
  /** Summon[0][b] convenience: level of a single summon upgrade. */
  summonUpgLevel: (s, b) => Number((sel.summon(s)[0] ?? [])[b] ?? 0),
  /** OptLacc[319] = highest Endless Summoning win count (drives endless-scaled army terms &
   *  the endless difficulty walk). confidence: confirmed (N.js GenINFO[174]=OptLacc[319]). */
  endlessSummonWins: (s) => Number((s.get("OptLacc") ?? [])[319] ?? 0),
  /** floor(sum(Summon[0])/100) = GenINFO[170], the "per-100 total summon upgrade levels" counter
   *  read by several army HP/DMG and cost terms. confidence: confirmed (N.js this._DN5=sum(Summon[0])). */
  summonTotalUpgLevels: (s) => (sel.summon(s)[0] ?? []).reduce((a, x) => a + (Number(x) || 0), 0),
  /** KRbest["SummzTrz"+colour] = kills on summoning stone `colour` (0..6). SumStoneTrialz(colour,0).
   *  gamedata-w6-summoning.mjs; save key KRbest documented in savemap/w45.mjs. */
  summonStoneKills: (s, colour) => Number((s.get("KRbest") ?? {})["SummzTrz" + colour] ?? 0),

  /** Ninja[103][b] = Ninja Knowledge UPGRADE level b (0..28). NLbonuses(b) = level*modifier.
   *  gamedata-w6-sneaking.mjs. confidence: confirmed (N.js "NLbonuses" reads Ninja[103][b]). */
  ninjaUpgLevels: (s) => sel.ninja(s)[103] ?? [],
  ninjaUpgLevel: (s, b) => Number((sel.ninja(s)[103] ?? [])[b] ?? 0),
  /** Ninja[104][e] = Beanstalk rank for beanstalk-slot e (0 = not planted, 1 = 10k, 2 = 100k...).
   *  gamedata-w6-beanstalk.mjs; N.js _customBlock_GoldFoodBonuses reads Ninja[104][e]. */
  beanstalkRanks: (s) => sel.ninja(s)[104] ?? [],
  /** Ninja[107][b] = pristine charm b unlock flag (0/1), 23 charms. */
  pristineCharmFlags: (s) => sel.ninja(s)[107] ?? [],
  /** Ninja[102][9] = jade-emporium unlock bitstring (letters). jadeEmporiumOwned reads it. */
  jadeUnlockString: (s) => (sel.ninja(s)[102] ?? [])[9],
  /** Ninja[b][0] = character/twin b's CURRENT FLOOR (0..11). Used to resolve per-floor detection.
   *  (Twins are stored as Ninja[0..] rows.) confidence: confirmed (N.js GenerateItem NinjaInfo[12+Ninja[b][0]]). */
  ninjaTwinFloor: (s, b) => Number((sel.ninja(s)[b] ?? [])[0] ?? 0),
  /** OptLacc[233+b] = gemstone b's base value (GemstoneBonus gate: > 0.5). gamedata-w6-sneaking.mjs. */
  gemstoneBase: (s, b) => Number((s.get("OptLacc") ?? [])[233 + b] ?? 0),
  /** OptLacc[402] = pristine-charm gacha roll counter (drives the daily-decaying roll chance). */
  charmRollCounter: (s) => Number((s.get("OptLacc") ?? [])[402] ?? 0),
  /** OptLacc[231] = selected Ninja Mastery cycle; OptLacc[232] = Ninja Mastery reached. */
  ninjaMasterySelected: (s) => Number((s.get("OptLacc") ?? [])[231] ?? 0),
  ninjaMastery: (s) => Number((s.get("OptLacc") ?? [])[232] ?? 0),

  /** OptLacc[382] = feeds DailyEmperorTries (round(1+[382])) and MaxEmperorAttemptStack
   *  (round(5 + 5*emporium39 + 6*[382])). gamedata-w6-emperor.mjs. confidence: read-only formula
   *  input (its own setter was not located; treat the value as save-derived). */
  emperorTries382: (s) => Number((s.get("OptLacc") ?? [])[382] ?? 0),
  /** OptLacc[370] = Emperor signed attempt-debt counter; attemptsLeft = max(0, round(1-[370])). */
  emperorDebt370: (s) => Number((s.get("OptLacc") ?? [])[370] ?? 0),

  /** EquipOrder_N[2] = this character's equipped FOOD item ids ("Blank" = empty). Tab 2 = food. */
  equippedFoodOrder: (s, ci) => ((s.at("EquipOrder_N", ci) ?? [])[2]) ?? [],
  /** EquipQTY_N[2] = stack count per equipped food slot, parallel to equippedFoodOrder. */
  equippedFoodQty: (s, ci) => ((s.at("EquipQTY_N", ci) ?? [])[2]) ?? [],
  /** FoodSlO_N = number of unlocked food slots for this character. */
  foodSlotsOwned: (s, ci) => Number(s.at("FoodSlO_N", ci) ?? 0),
};

/** Registry coverage, for the report / a future UI panel. */
export function coverage() {
  const by = { confirmed: 0, inferred: 0, unknown: 0 };
  for (const k of Object.keys(MAP)) by[MAP[k].confidence] = (by[MAP[k].confidence] ?? 0) + 1;
  return { entries: Object.keys(MAP).length, ...by };
}
