/* savemap/account.mjs — account / meta / currency / event save keys.
 * Ground truth: N.js loader run (~offset 19180000-19206000): u.getLoad*("SaveKey") -> gameAttributes.h.RuntimeAttr.
 *
 * Serializer -> parse mapping (verified against a real save):
 *   getLoad         -> scalar                     => "raw"
 *   getLoadList     -> already a JSON array       => "raw"
 *   getLoadJsonList -> JSON *string*, needs parse  => "json"
 *   getLoadMap      -> JSON *string* object        => "json"
 *   getLoadSparseList(key, N) -> dict keyed by index, logical length N
 *
 * Many loads are version-gated by `CSver` — it decides which save keys exist at all.
 */
const bundle = (code, desc, evidence) => ({
  name: "bundle_" + code, attr: null, family: false, scope: "account", agg: null, governs: null,
  shape: "number", parse: "raw", desc, idx: null, evidence, confidence: "confirmed",
});

export default {
  OptLacc: {
    name: "optionsAccount", attr: "OptionsListAccount", family: false, scope: "account", agg: null, governs: null,
    shape: "number[]", parse: "raw",
    desc: "701 unlabelled account-wide scalars. PARTIALLY MAPPED — only the `idx` entries below were read in N.js. `idxDomainHints` is a WEAKER signal: the enclosing _customBlock_ of a read site, i.e. a domain hint only, NOT a meaning. Do not promote a hint to a label.",
    idx: {
      29: "kill counter; at 50 triggers 'KillDialogueEarly', grants +1 to [325], resets to 0",
      44: "+4 by the bun_c bundle (clamped up from negative first); read in _customBlock_AwayTimers",
      45: "set to 259201 (3 days + 1s) by the bun_c bundle; read in _customBlock_AwayTimers",
      117: "set via max(4,[117]) on Emperor kill — monotonic progress gate",
      124: "banked sailing seconds. Displayed as days when >259200.",
      200: "set to 1 by the DoOnceREAL=378.1 migration; purpose not determined",
      228: "Killroy artifact-find stat; bonus = 1 + X/(300+X)",
      311: "string of Number2Letter glyphs for EVENT SHOP items owned. EventShopOwned(b) = [311].indexOf(Number2Letter[b]) != -1. Index 48 ('V') = Purple Chest Slug.",
      319: "endless summoning wins; drives the Summoning WinBonus table cycle",
      325: "token spent 1 per Event Minigame reward claim; granted by migrations and ban_/bon_ bundles",
      369: "Emperor showdown wins; mirrored into QuestStatus.Potti7[0]",
      370: "Emperor showdown attempts",
      383: "Alchemy currency to make a bubble 'Super' (needs >=10, subtracts 10)",
      384: "string: name of the bubble most recently made 'Super' via [383]",
      518: "one-time flag: companion 88 detected, grants +50 to [383]",
      594: "Minehead button presses. Bucketed by floor(f/5)%9 in Minehead(\"Button_Bonuses\").",
      606: "CSV string of companion ids currently ON LOAN. Owned companions are NOT here — they come from the native getCompanionInfoMe() bridge.",
    },
    idxDomainHints: {
      10: "MiningChance", 11: "MiningChance", 12: "MiningChance", 46: "AwayTimers", 62: "CauldronStats",
      76: "dungeonKill", 89: "TalentCalc", 126: "Breeding", 131: "PostOffice", 133: "AtomCollider",
      153: "Language", 154: "StampCostss", 164: "RandomEvent", 180: "SkillStats", 185: "WeeklyBoss",
      229: "RandomEvent", 230: "RandomEvent", 267: "Bubbastuff", 320: "Dreamstuff", 333: "Summoning",
      345: "ExpMulti", 351: "PetSetInfo", 355: "Holes", 359: "Windwalker", 363: "TrappingStuffs",
      367: "AFKgains", 379: "GetSetBonus", 392: "ArcaneType", 425: "Divinity", 466: "RiftStuff",
      476: "Thingies", 478: "Spelunk", 514: "ResearchStuff", 605: "Stuff2", 607: "FarmingStuffs",
    },
    evidence: "Loader: `p=u.getLoadList('OptLacc'); gameAttributes.h.OptionsListAccount=p`. Every listed idx was read at an actual call site.",
    confidence: "confirmed",
  },
  OptL_N: {
    name: "optionsCharacter", attr: "OptionsList", family: true, scope: "character", agg: null, governs: null,
    shape: "number[]", parse: "raw",
    desc: "Per-character options list (34 entries). Contents unmapped. OptionsList[14] is the roster page offset in the player-select UI.",
    idx: null,
    evidence: "Loader: `Ba=u.getLoadList('OptL_'+pID); PlayerDATABASE.h[name].h.OptionsList=Ba`.",
    confidence: "confirmed",
  },
  OptL2_N: {
    name: "optionsCharacterExt", attr: "OptionsList", family: true, scope: "character", agg: null, governs: null,
    shape: "nested", parse: "raw",
    desc: "Overflow slots for OptL_N. Exactly 2 sub-lists, spliced INTO OptionsList — not a standalone attribute.",
    idx: { 0: "-> OptionsList[11]", 1: "-> OptionsList[13]" },
    evidence: "Loader: `...OptionsList[11]=u.getLoadList('OptL2_'+pID)[0]`, `...OptionsList[13]=...[1]`.",
    confidence: "confirmed",
  },
  GemsOwned: {
    name: "gemsOwned", attr: "GemsOwned", family: false, scope: "account", agg: null, governs: null,
    shape: "number", parse: "raw",
    desc: "Spendable gem balance. On load: GemsOwned += max(ServerGems - ServerGemsReceived, 0).",
    idx: null,
    evidence: "Loader: `p=GemsOwned + Math.max(_DummyGEMS - ServerGemsReceived, 0)` where _DummyGEMS = max(u.getLoad('ServerGems'),0).",
    confidence: "confirmed",
  },
  ServerGems: {
    name: "serverGems", attr: null, family: false, scope: "account", agg: null, governs: null,
    shape: "number", parse: "raw",
    desc: "Server-authoritative CUMULATIVE lifetime gem grant. Load-time only; never a runtime attribute.",
    idx: null,
    evidence: "`_DummyGEMS=Math.max(u.getLoad('ServerGems'),0)`; zero getGameAttribute('ServerGems') sites in N.js.",
    confidence: "confirmed",
  },
  ServerGemsReceived: {
    name: "serverGemsReceived", attr: "ServerGemsReceived", family: false, scope: "account", agg: null, governs: null,
    shape: "number", parse: "raw",
    desc: "High-water mark of ServerGems already credited to GemsOwned — makes the grant idempotent.",
    idx: null,
    evidence: "Loader: `p=Math.max(ServerGemsReceived, _DummyGEMS)`.",
    confidence: "confirmed",
  },
  GemItemsPurchased: {
    name: "gemItemsPurchased", attr: "GemItemsPurchased", family: false, scope: "account", agg: null, governs: null,
    shape: "number[]", parse: "json",
    desc: "Per-gem-shop-item purchase counts, indexed by gem shop item id.",
    idx: {
      8: "Davey Jones Training purchases. Feeds Sailing(\"DaveyJonesBonus\") as +50% each, ADDITIVE in code — despite the shop text claiming '1.50x per purchase'.",
      11: "feeds the Summoning WinBonus multiplier as (1 + 10*[11]/100)",
      87: "reset to 0 by the DoOnceREAL=378.1 migration",
      88: "reset to 0 by the DoOnceREAL=378.1 migration",
    },
    evidence: "Loader: `p=u.getLoadJsonList('GemItemsPurchased')`. idx 8 read in _customBlock_Sailing(\"DaveyJonesBonus\").",
    confidence: "confirmed",
  },
  /* Deliberately still `unknown`. The client is EXHAUSTIVELY searched here: the runtime attr
   * GemsPacksPurchased occurs exactly 3 times in N.js and every one is plumbing --
   * init, save, load. Nothing in the client ever reads an element. So the meaning is not
   * merely undiscovered, it is not DERIVABLE from the client at all; whatever consumes this
   * lives server-side (purchase/receipt bookkeeping is the obvious guess, and it stays a guess).
   * Note also the init pushes nothing, yet the sample holds [0] -- another hint it is written
   * from outside the client. Do not upgrade this without a non-client source. */
  GemsPacksPurchased: {
    name: "gemsPacksPurchased", attr: "GemsPacksPurchased", family: false, scope: "account", agg: null, governs: null,
    shape: "number[]", parse: "raw",
    desc: "Length-1 list ([0] in the sample). WRITE-ONLY as far as the client is concerned; no code reads it. Semantics not determined and not determinable from N.js.",
    idx: null,
    evidence: "Exhaustive grep of the runtime attr in N.js -> 3 hits, ALL plumbing: init `gameAttributes.h.GemsPacksPurchased=[]` (~9926), writer `u.addSaveEntryList(\"GemsPacksPurchased\", GA(\"GemsPacksPurchased\"))` (~9747), loader `p=u.getLoadList('GemsPacksPurchased')` (~30119). ZERO read sites -- no element is ever consumed, compared or rendered.",
    confidence: "unknown",
  },
  BundlesReceived: {
    name: "bundlesReceived", attr: "BundlesReceived", family: false, scope: "account", agg: null, governs: null,
    shape: "dict", parse: "json",
    desc: "REDEMPTION LEDGER for purchasable bundles. Keys are bundle codes (ban_*/bin_*/bon_*/bun_*), value 1 = contents already granted. Client half of a two-key protocol: the server sets a top-level save key (e.g. `bun_p:1`) meaning OWNED; on load the client checks `BundlesReceived.h.X != 1 && u.getLoad('X') == 1`, grants the contents, then sets BundlesReceived.h.X = 1. Most item grants need 1-2 free inventory slots and silently no-op otherwise.",
    idx: null,
    evidence: "Loader: `p=u.getLoadMap('BundlesReceived')`; the queue-on-load run and the `\"<code>\"==r[2]` dispatch chain are both in N.js.",
    confidence: "confirmed",
  },
  ban_a: bundle("ban_a", "Bundle ownership flag (1=owned). Grants OptLacc[325] += 15.", "`\"ban_a\"==r[2]` dispatch: `[325]+=15; BundlesReceived.h.ban_a=1`."),
  ban_b: bundle("ban_b", "Bundle ownership flag (1=owned). Grants EquipmentGown7 + EquipmentHats132 and OptLacc[325] += 20. Needs >=2 free inventory slots.", "`\"ban_b\"==r[2]` dispatch."),
  ban_f: bundle("ban_f", "Bundle ownership flag (1=owned). Grants OptLacc[325] += 20.", "`\"ban_f\"==r[2]` dispatch."),
  bin_a: bundle("bin_a", "Evolving Bundle flag (1=owned): JELLY_JOY_PACK (row id 52).", "CustomLists.EvolvingBundles row `\"52 2500 800 7 bin_a JELLY_JOY_PACK:\"`."),
  bin_b: bundle("bin_b", "Evolving Bundle flag (1=owned): KOISOME_PACK (row id 53).", "CustomLists.EvolvingBundles row `\"53 3400 1350 13 bin_b KOISOME_PACK:\"`."),
  bin_c: bundle("bin_c", "Evolving Bundle flag (1=owned): NEONSCALE_PACK (row id 54).", "CustomLists.EvolvingBundles row `\"54 4200 2100 20 bin_c NEONSCALE_PACK\"`."),
  bin_d: bundle("bin_d", "Evolving Bundle flag (1=owned): PIRATE_PACK (row id 55).", "CustomLists.EvolvingBundles row `\"55 5500 3100 30 bin_d PIRATE_PACK\"`."),
  bin_i: bundle("bin_i", "Evolving Bundle flag (1=owned): HIVEMIND_PACK (row id 88).", "CustomLists.EvolvingBundles row `\"88 4700 2500 23 bin_i HIVEMIND_PACK\"`."),
  bin_j: bundle("bin_j", "Evolving Bundle flag (1=owned): CRYOLOGY_PACK (row id 99).", "CustomLists.EvolvingBundles row `\"99 1000 500 4 bin_j CRYOLOGY_PACK\"`."),
  bin_k: bundle("bin_k", "Evolving Bundle flag (1=owned): MECHANIC_PACK (row id 157).", "CustomLists.EvolvingBundles row `\"157 1450 700 6 bin_k MECHANIC_PACK\"`."),
  bin_m: bundle("bin_m", "Evolving Bundle flag (1=owned): BABY_TROLL_PACK (row id 128).", "CustomLists.EvolvingBundles row `\"128 2600 1100 10 bin_m BABY_TROLL_PACK\"`."),
  bin_n: bundle("bin_n", "Evolving Bundle flag (1=owned): KING_DOOT_PACK (row id 0).", "CustomLists.EvolvingBundles row `\"0 2500 1000 10 bin_n KING_DOOT_PACK\"`."),
  bin_o: bundle("bin_o", "Evolving Bundle flag (1=owned): CLAMMIE_PACK (row id 111).", "CustomLists.EvolvingBundles row `\"111 1250 750 5 bin_o CLAMMIE_PACK\"`."),
  bon_a: bundle("bon_a", "Bundle ownership flag (1=owned). Dispatch grants NOTHING — flag only.", "`\"bon_a\"==r[2]` body is `1!=BundlesReceived.h.bon_a&&(BundlesReceived.h.bon_a=1)`."),
  bon_f: bundle("bon_f", "Bundle ownership flag (1=owned). Dispatch grants nothing; flag-only.", "`\"bon_f\"==r[2]` body is flag-set only."),
  bon_g: bundle("bon_g", "Bundle ownership flag (1=owned). Grants EquipmentCape18, OptLacc[325] += 15 and [383] += 10. Needs >=1 free slot.", "`\"bon_g\"==r[2]` dispatch."),
  bon_i: bundle("bon_i", "Bundle ownership flag (1=owned). Grants EquipmentGown5. Needs >=1 free slot.", "`\"bon_i\"==r[2]` dispatch."),
  bon_l: bundle("bon_l", "Bundle ownership flag (1=owned). Grants EquipmentHats127 and OptLacc[325] += 25. Needs >=1 free slot.", "`\"bon_l\"==r[2]` dispatch."),
  bon_p: bundle("bon_p", "Bundle ownership flag (1=owned). Grants OptLacc[325] += 20.", "`\"bon_p\"==r[2]` dispatch."),
  bon_r: bundle("bon_r", "Bundle ownership flag (1=owned). Dispatch grants nothing; flag-only.", "`\"bon_r\"==r[2]` body is flag-set only."),
  bon_s: bundle("bon_s", "Bundle ownership flag (1=owned). Grants EquipmentGown6. Needs >=1 free slot.", "`\"bon_s\"==r[2]` dispatch."),
  bon_u: bundle("bon_u", "Bundle ownership flag (1=owned). Grants OptLacc[325] += 10.", "`\"bon_u\"==r[2]` dispatch."),
  bon_v: bundle("bon_v", "Bundle ownership flag (1=owned). Grants EquipmentCape19. Needs >=1 free slot.", "`\"bon_v\"==r[2]` dispatch."),
  bun_c: bundle("bun_c", "Bundle ownership flag (1=owned). Grants 4x CardPack1, sets OptLacc[45]=259201 and OptLacc[44]+=4. Needs >=1 free slot.", "`\"bun_c\"==r[2]` dispatch."),
  bun_i: bundle("bun_i", "Bundle ownership flag (1=owned). Dispatch grants nothing; flag-only.", "`\"bun_i\"==r[2]` body is flag-set only."),
  bun_p: bundle("bun_p", "Bundle ownership flag (1=owned). Grants EquipmentNametag7 (needs >=1 free slot). NOTE: also read LIVE by _customBlock_RandomEvent(\"BottleIslandBonus\") — owning it has an ongoing effect, not just a one-time grant.", "`\"bun_p\"==r[2]` dispatch + a separate read in RandomEvent(\"BottleIslandBonus\")."),
  bun_u: bundle("bun_u", "Bundle ownership flag (1=owned). Grants EquipmentGown1. Needs >=1 free slot.", "`\"bun_u\"==r[2]` dispatch."),
  bun_v: bundle("bun_v", "Bundle ownership flag (1=owned). Grants EquipmentGown2. Needs >=1 free slot.", "`\"bun_v\"==r[2]` dispatch."),
  bun_z: bundle("bun_z", "Bundle ownership flag (1=owned). Grants EquipmentHats114. Needs >=1 free slot.", "`\"bun_z\"==r[2]` dispatch."),
  BribeStatus: {
    name: "bribeStatus", attr: "BribeStatus", family: false, scope: "account", agg: null, governs: null,
    shape: "number[]", parse: "raw",
    desc: "Per-bribe purchase flags: 1 = bought. Parallel to CustomLists.BribeDescriptions; field [5] of that table is the bonus value.",
    idx: { 34: "Artifact Pilfering — BribeDescriptions[34][5] = 20 (+20% artifact find)" },
    evidence: "N.js _customBlock_GetBribeBonus(d) = `1==BribeStatus[round(d)] ? BribeDescriptions[round(d)][5] : 0`.",
    confidence: "confirmed",
  },
  AchieveReg: {
    name: "achievementRegister", attr: "AchieveReg", family: false, scope: "account", agg: null, governs: null,
    shape: "number[]", parse: "json",
    desc: "Achievement register, indexed by achievement id. -1 = completed. Load gated on CSver >= 6.61.",
    idx: null,
    evidence: "Loader: `6.61<=u.getLoad('CSver')&&(p=u.getLoadJsonList('AchieveReg'))`. 76 read sites.",
    confidence: "confirmed",
  },
  SteamAchieve: {
    name: "steamAchievements", attr: "SteamAchieve", family: false, scope: "account", agg: null, governs: null,
    shape: "number[]", parse: "json",
    desc: "Steam achievement progress/unlock state. -1 = unlocked/complete. Load gated on CSver >= 5.5.",
    idx: null,
    evidence: "Loader: `5.5<=u.getLoad('CSver')&&(p=u.getLoadJsonList('SteamAchieve'))`. 63 read sites.",
    confidence: "confirmed",
  },
  TimeAway: {
    name: "timeAway", attr: "TimeAway", family: false, scope: "account", agg: null, governs: null,
    shape: "dict", parse: "json",
    desc: "Map of last-activity unix timestamps (fractional seconds) per subsystem — Forge, Cauldron, Construction, Cooking, Pets, GlobalTime. GlobalTime is the account-wide reference for per-character 'time away'.",
    idx: null,
    evidence: "Loader: `p=u.getLoadMap('TimeAway')`. 432 read sites; player-select reads `asNumber(TimeAway.h.GlobalTime)`.",
    confidence: "confirmed",
  },
  CloudsaveTimer: {
    name: "cloudsaveTimer", attr: "CloudsaveTimer", family: false, scope: "account", agg: null, governs: null,
    shape: "number", parse: "raw", desc: "Cloud-save timer counter. Unit/epoch not determined.",
    idx: null, evidence: "Loader: `p=u.getLoad('CloudsaveTimer')`. Name + scalar loader only; no read site inspected.",
    confidence: "inferred",
  },
  CSver: {
    name: "contentSaveVersion", attr: null, family: false, scope: "account", agg: null, governs: null,
    shape: "number", parse: "raw",
    desc: "Save/content schema version. Purely a LOADER GATE — it decides which save keys exist. Known gates: 5.5 SteamAchieve, 6.4 CYNPC, 6.44 StuG, 6.51 DungUpg, 6.61 AchieveReg, 6.7 ArcadeUpg/ArcUnclaim, 18 FarmRank, 19 Holes, 20 Grimoire, 21 Ribbon, 22 UpgVault, 23 Jars, 28 Bubba, 29 Research, 30 Sushi, 31 GreenStacks, 32 CookMaster. Never read via getGameAttribute.",
    idx: null,
    evidence: "Dozens of `N<=u.getLoad('CSver')&&(...)` guards across the loader; 0 getGameAttribute('CSver') sites.",
    confidence: "confirmed",
  },
  DoOnceREAL: {
    name: "doOnceReal", attr: "DoOnceREAL", family: false, scope: "account", agg: null, governs: null,
    shape: "number", parse: "raw",
    desc: "One-shot MIGRATION WATERMARK. A ladder of `N > DoOnceREAL && (DoOnceREAL = N.x, ...fixups...)` guards, so each migration fires at most once. Migrations mutate other account state (the 378 step sets OptLacc[200]=1, clears OptLacc[606], zeroes GemItemsPurchased[87]/[88]).",
    idx: null,
    evidence: "`-1!=u.getLoad('DoOnceREAL')&&(gameAttributes.h.DoOnceREAL=p)`; 176 read sites forming the ladder.",
    confidence: "confirmed",
  },
  HintStatus: {
    name: "hintStatus", attr: "HintStatus", family: false, scope: "account", agg: null, governs: null,
    shape: "nested", parse: "json", desc: "Nested per-category tutorial/hint seen-flags (1 / -1). Category indices not mapped.",
    idx: null, evidence: "Loader: `p=u.getLoadJsonList('HintStatus')`. 35 read sites.", confidence: "confirmed",
  },
  /* The name is literal after all: BUGS, as in catching/nests. Not crash telemetry. */
  BugInfo: {
    name: "bugNestState", attr: "BugInfo", family: false, scope: "account", agg: null, governs: null,
    shape: "nested", parse: "json",
    desc: "CATCHING BUG-NEST state, account-wide. 3 parallel rows, each indexed by NEST index; nest -> map via CustomLists.BugNestCurrentMap[nestIdx]. The client grows all three rows with (-10, 0, 0) whenever BugNestCurrentMap outgrows them, so length tracks the nest list.",
    idx: {
      "[0][nest]": "Nest TIMER. -10 = dormant/ready. First hit on the nest sets it to SkillStats(\"CatchingNestTime\") (and zeroes [1][nest]); it then ticks down by .05 per frame. Once it falls to <=0 (and > -5) while the player is on BugNestCurrentMap[nest], the bug swarm spawns. Reset to -10 when the nest respawns. Small negatives (the sample's -0.0499) mean 'timer just elapsed', not 'unused'.",
      "[1][nest]": "Damage accumulated against the nest this cycle: `+= dummyDamageDealt` per hit, compared against the nest's MonsterDefinitionsGET HP for the progress bar. Reset to 0 at cycle start and on respawn. Sample values reach 1e30 — an accumulator, not a flag.",
      "[2][nest]": "UNDETERMINED, and vestigial in this client build: all 3 occurrences of BugInfo[2] are WRITES OF 0 (init push, plus the two nest-respawn blocks); nothing reads it. The sample's -10s are therefore stale data from an older build. Do not attach meaning to it.",
      "nest index": "NOT a monster id: resolved as MonsterDefinitionsGET[<BugNest monster type>].DeathFrame (DNSM.DmgPxNestz) — the client repurposes the DeathFrame field as the nest id.",
    },
    evidence: "Loader: `p=u.getLoadJsonList('BugInfo')`. Hit handler N.js 5939-5940: MonsterType.indexOf(\"BugNest\")!=-1 -> DmgPxNestz = MonsterDefinitionsGET[type].DeathFrame; `-10==BugInfo[0][DmgPxNestz] && (BugInfo[0][DmgPxNestz]=SkillStats(\"CatchingNestTime\"), BugInfo[1][DmgPxNestz]=0)`, then `BugInfo[1][DmgPxNestz] += dummyDamageDealt` (same block at 21075-21076). Tick N.js 25071: `0<BugInfo[0][g] ? BugInfo[0][g] -= .05 : -5<BugInfo[0][g] && 0==_CreateBugSwarm && BugNestCurrentMap[g]==CurrentMap && (spawn swarm)`. Progress bar N.js 8232 reads BugInfo[1] against MonsterDefinitionsGET. Respawn reset N.js 35148 / 35952: `BugInfo[0][BugNestCurrentMap.indexOf(CurrentMap)]=-10, [1][...]=0, [2][...]=0`. Growth/init N.js 30291-30295: rows seeded 16-long then `while BugNestCurrentMap.length > BugInfo[0].length: [0].push(-10), [1].push(0), [2].push(0)`.",
    confidence: "confirmed", // [0] and [1] read in the client; [2] annotated as undetermined above
  },
  BGsel: {
    name: "backgroundSelected", attr: "BGselected", family: false, scope: "account", agg: null, governs: null,
    shape: "number", parse: "raw",
    desc: "Index of the selected UI background; drives 'BGselectIcon<N>.png'. Only settable where BGunlocked[N]==1.",
    idx: null,
    evidence: "Loader: `p=u.getLoad('BGsel'); gameAttributes.h.BGselected=p`. UI: `1==BGunlocked[_DN]&&(BGselected=_DN)`.",
    confidence: "confirmed",
  },
  BGunlocked: {
    name: "backgroundsUnlocked", attr: "BGunlocked", family: false, scope: "account", agg: null, governs: null,
    shape: "number[]", parse: "raw", desc: "Per-background unlock flags (1=unlocked). The selector UI iterates the first 48.",
    idx: null, evidence: "Loader: `p=u.getLoadList('BGunlocked')`. UI loops `for(d=0;48>d;)` testing `1==BGunlocked[b]`.",
    confidence: "confirmed",
  },
  GreenStacks: {
    name: "greenStacks", attr: "GreenStacks", family: false, scope: "account", agg: null, governs: null,
    shape: "string[]", parse: "raw",
    desc: "Append-only list of item names that have EVER reached a green stack (>= 1e7) in account storage. De-duplicated, never removed — a LIFETIME record, not current state. Its .length feeds the achievement/task. Load gated on CSver >= 31.",
    idx: null,
    evidence: "`1E7<=asNumber(ChestQuantity[f]) && (D.contains(GreenStacks, ChestOrder[f]) || GreenStacks.push(ChestOrder[f]))`, then `_GeneralINFO[90]=GreenStacks.length`.",
    confidence: "confirmed",
  },
  Ribbon: {
    name: "ribbon", attr: "Ribbon", family: false, scope: "account", agg: null, governs: null,
    shape: "number[]", parse: "raw",
    desc: "Two-region array. Entries 28+g are the ribbon tier for meal g. Entries 0..27 are a separate fixed region whose meaning was NOT determined. Load gated on CSver >= 21.",
    idx: { "0-27": "unknown fixed region (initialised as 28 zeros)", "28+g": "ribbon tier for meal g (indexes CustomLists.MealINFO)" },
    evidence: "`if(0==Ribbon.length) for(e=0;28>e;) Ribbon.push(0); for(; round(Ribbon.length-28) < MealINFO.length ;) Ribbon.push(...)`; bonus site `Summoning('RibbonBonus', Ribbon[28+g], 0) * Meals[0][g] * MealINFO[g][2]`.",
    confidence: "confirmed",
  },
  TaskZZ0: { name: "tasksProgress", attr: "Tasks", family: false, scope: "account", agg: null, governs: null, shape: "nested", parse: "json", desc: "Tasks[0]: per-world arrays of raw task progress counters. Load gated on CSver >= 3.", idx: null, evidence: "Loader: `Tasks[0]=u.getLoadJsonList('TaskZZ0')`.", confidence: "confirmed" },
  TaskZZ1: { name: "tasksLevels", attr: "Tasks", family: false, scope: "account", agg: null, governs: null, shape: "nested", parse: "json", desc: "Tasks[1]: per-world arrays, values 0..10 — task tier/level per slot. Semantics beyond the slot not verified.", idx: null, evidence: "Loader: `Tasks[1]=u.getLoadJsonList('TaskZZ1')`.", confidence: "inferred" },
  TaskZZ2: { name: "tasksUnknown2", attr: "Tasks", family: false, scope: "account", agg: null, governs: null, shape: "nested", parse: "json", desc: "Tasks[2]: per-world numeric arrays. Purpose not determined.", idx: { "[5][4]": "min(10, x) feeds the Summoning WinBonus additive bracket" }, evidence: "Loader: `Tasks[2]=u.getLoadJsonList('TaskZZ2')`; [2][5][4] read in _customBlock_Summoning(\"WinBonus\").", confidence: "inferred" },
  /* Tasks[3]/[4]/[5] are the three halves of the Tasks/Merits/Unlocks menu economy:
   * [4] holds the two CURRENCIES, [3] is what one of them bought, [5] is the daily reroll. */
  TaskZZ3: {
    name: "recipeUnlockFlags", attr: "Tasks", family: false, scope: "account", agg: null, governs: null,
    shape: "nested", parse: "json",
    desc: "ANVIL RECIPE UNLOCKS bought with task unlock points. Tasks[3][world][recipe] = 1 when unlocked, 0 otherwise. 7 worlds (the client's loops are hard-bounded at `7>d`), row lengths vary by world (16/28/28/32/8/8/8 in the sample — all 1s, i.e. fully unlocked).",
    idx: {
      "count": "The COUNT of 1s across all 7 rows is the meaningful aggregate, not any single flag: TaskStuff(\"RecipesUnlockedNUM\") returns that count, and TaskStuff(\"AvailableUnlocks\") returns GenINFO[18] - count (unlocks affordable but not yet spent).",
      "paid with": "Tasks[4][0] (unlock points). TaskStuff(\"UnlockPtsOwned\") solves the cost curve UnlockPtsFORMULA(n) = 1 + 9n + 2*max(0,n-5) + 7*max(0,n-12) + 11*max(0,n-20) against Tasks[4][0] to get how many unlocks are affordable.",
      "[world][recipe]": "Grid position in the UI is Tasks[3][floor(b/4)][b - 4*floor(b/4) + 4*GenINFO[10][floor(b/4)]] — GenINFO[10][world] is a horizontal scroll offset, so the on-screen column is NOT the recipe index.",
    },
    evidence: "Loader: `Tasks[3]=u.getLoadJsonList('TaskZZ3')`. N.js ~9980 _customBlock_TaskStuff: \"AvailableUnlocks\" and \"RecipesUnlockedNUM\" both do `for d<7: for f < Tasks[3][d].length: 1==Tasks[3][d][f] && taskppNum2++`, returning `GenINFO[18]-taskppNum2` and `taskppNum2` respectively. \"UnlockPtsOwned\" compares UnlockPtsFORMULA against Tasks[4][0] (~9984-9986). Checkmark render N.js 11550: `1==Tasks[3][floor(b/4)][...] ? addImgInst(\"TaskChe...\")`. Anvil coupling N.js 9500-9501 (AnvilCraftStatus seeded from RANDOlist[2] gated on Tasks[4][0]).",
    confidence: "confirmed",
  },
  TaskZZ4: {
    name: "taskPoints", attr: "Tasks", family: false, scope: "account", agg: null, governs: null,
    shape: "number[]", parse: "json",
    desc: "The two TASK CURRENCIES, account-wide. Length 9 = 1 unlock-point pool + 8 per-world merit-point pools. Sample [11334, 3,19,32,14,15,2,0,0].",
    idx: {
      0: "UNLOCK POINTS, one account-wide pool, spent on anvil recipe unlocks (Tasks[3]). Earned on task claim: `Tasks[4][0] += floor(TaskDesc[3] + (world+1) * Tasks[1][world][taskIdx])` — note it scales with BOTH the world number and the task's current tier. This is a CUMULATIVE TOTAL that is never decremented; 'how many unlocks it buys' is derived by inverting UnlockPtsFORMULA (see TaskZZ3), NOT by subtracting.",
      "1..8": "MERIT POINTS for world (idx-1), i.e. [1]=W1 .. [8]=W8. Earned on task claim as `Tasks[4][world+1] += TaskStuff(\"MeritsGiven\", tier)` where MeritsGiven = 1 + floor(tier/5). SPENT in the merit shop: `Tasks[4][world+1] -= CustomLists.TaskShopDesc[world][b][6]`, with Tasks[2][world][b] incremented as the purchase count. Unlike [0] this one is a live balance.",
      "task 8 exception": "The daily task (taskIdx 8) grants unlock points but NO merit points — the merit line is guarded by `8 != DummyNumber`.",
    },
    evidence: "Loader: `Tasks[4]=u.getLoadJsonList('TaskZZ4')`. Claim handler N.js 11223-11224: `Tasks[4][0] = Math.round(Tasks[4][0] + Math.floor(DummyList[3] + (GenINFO[2]+1)*Tasks[1][GenINFO[2]][DummyNumber]))`, then `8 != DummyNumber && (Tasks[4][GenINFO[2]+1] = Math.round(Tasks[4][GenINFO[2]+1] + TaskStuff(\"MeritsGiven\", Tasks[1][GenINFO[2]][DummyNumber], \"0\")))`. Merit shop spend N.js 11226-11227: gated on `Tasks[4][GenINFO[2]+1] >= DummyList[6] && Tasks[2][GenINFO[2]][b] < DummyList[5]`, then `Tasks[4][GenINFO[2]+1] -= TaskShopDesc[GenINFO[2]][b][6]`. MeritsGiven and UnlockPtsFORMULA defined in _customBlock_TaskStuff ~9984-9986.",
    confidence: "confirmed",
  },
  TaskZZ5: {
    name: "dailyTaskVariant", attr: "Tasks", family: false, scope: "account", agg: null, governs: null,
    shape: "number[]", parse: "json",
    desc: "Which DAILY TASK is currently rolled for each world. Tasks[5][world] = a variant id indexing CustomLists.TaskDescriptions[world] (the daily occupies task slot 8). Length 8, but only worlds 0..3 are ever rolled — the reroll loop is `4>d`, so [4..7] stay 0 (matches the sample [24,7,12,1,0,0,0,0]).",
    idx: {
      "[world]": "Active variant id for that world's slot-8 daily. It is a GATE, not a counter: the mob-kill hooks read it and only credit progress when it matches, e.g. `\"glass\"==d ? 16==Tasks[5][2] && TaskProgress(2,8,\"add\",1)`. Progress itself lands in Tasks[0][world][8]; tier in Tasks[1][world][8].",
      "reroll": "On daily reset: Tasks[1][w][8]=0 and Tasks[0][w][8]=0 (tier and progress wiped), then up to 4 attempts at `randomInt(0, round(TaskDescriptions[w].length - 9))`, breaking on the first draw that differs from the current Tasks[5][w]. So a repeat IS possible (if all 4 draws collide) — it is a bias against repeats, not a guarantee.",
      "range": "0 .. TaskDescriptions[world].length-9. The -9 offset is because slots 0..8 are the fixed tasks; variants start after them.",
    },
    evidence: "Loader: `Tasks[5]=u.getLoadJsonList('TaskZZ5')`. Reroll N.js ~25032 (in the daily-reset block, immediately before the `TimeAway.ShopRestock` loop): `for d<4: q=d++, Tasks[1][q][8]=0, Tasks[0][q][8]=0; for g<4: DummyNumber = randomInt(0, Math.round(CustomLists.TaskDescriptions[q].length-9)); if (DummyNumber != Tasks[5][q]) { Tasks[5][q] = DummyNumber; break }`. Gate read sites N.js 6344-6386, e.g. `\"goblinGTD\"==d ? 4==Tasks[5][2] ? TaskProgress(2,8,\"add\",1) : 11==Tasks[5][2] && TaskProgress(2,8,\"add\",1)`. _customBlock_TaskProgress (~9986) writes Tasks[0][world][taskIdx], confirming Tasks[5] is only ever a selector.",
    confidence: "confirmed",
  },
  FamValColosseumHighscores: {
    name: "colosseumHighscores", attr: "FamilyValuesMap", family: false, scope: "account-via-aggregate", agg: "max", governs: null,
    shape: "number[]", parse: "raw",
    desc: "FamilyValuesMap.ColosseumHighscores — best colosseum score per colosseum, account-wide.",
    idx: null,
    evidence: "Loader FamilyValuesMap key loop: `'ColosseumHighscores'==e && (f.h[e]=u.getLoadList('FamVal'+e))`. The max-across-roster aggregation is INFERRED from the 'FamilyValues'+'Highscores' naming; the aggregation site was not read.",
    confidence: "inferred",
  },
  FamValFishingToolkitOwned: {
    name: "fishingToolkitOwned", attr: "FamilyValuesMap", family: false, scope: "account", agg: null, governs: null,
    shape: "nested", parse: "raw",
    desc: "FamilyValuesMap.FishingToolkitOwned — the ACCOUNT-WIDE registry of fishing toolkit pieces ever obtained. 2 sub-lists: [0] = Weights owned, [1] = Lines owned. Entries are item ids (ItemDefinitionsGET[...].ID), stored in acquisition order, so the list is unordered and may contain a seeded 0. Distinct from PersonalValuesMap.FishingToolkit, which is the PER-CHARACTER *equipped* pair — do not confuse the two.",
    idx: {
      "[0]": "Weight ids owned. Populated by dragging an item whose InventoryOrder name contains \"Weight\" onto the toolkit slot. Membership is tested against ids 1..15 as STRINGS (`D.contains([0], \"\"+(g+1))`) to award the \"Weight\"+n entry in Cards1.",
      "[1]": "Line ids owned. Same mechanism for names containing \"Line\", tested over ids 1..15 to award \"Line\"+n.",
      "seeded": "Init pushes [[0],[0]] when the key is absent, so a literal 0 is a placeholder, not a real toolkit id — the real ids checked by the client are 1..15.",
      "scope note": "FamilyValuesMap = account-wide by construction (the whole map is one copy). Ownership is shared; only the equipped choice is per-character.",
    },
    evidence: "Loader FamilyValuesMap key loop, getLoadList branch (N.js ~30118: `\"FishingToolkitOwned\"==e || ... ? f.h[e]=u.getLoadList(\"FamVal\"+e)`). Acquire N.js 12983-12984: InventoryOrder name indexOf(\"Weight\")!=-1 -> `D.contains(FishingToolkitOwned[0], ItemDefinitionsGET[name].ID) || FishingToolkitOwned[0].push(ItemDefinitionsGET[name].ID)`; the indexOf(\"Line\") branch does the same into [1]. Cards1 coupling N.js 17578-17579: `for g<15: D.contains(FishingToolkitOwned[0], \"\"+(g+1)) && (_DT=\"Weight\"+(g+1), ...Cards[1].push(_DT))`, and the matching Line loop. Equipped-vs-owned split N.js 8243: `PersonalValuesMap.FishingToolkit[GenInfo[23]-1]` (equipped) tested alongside `D.contains(FamilyValuesMap.FishingToolkitOwned[GenInfo[23]-1], ...)` (owned), with GenInfo[23] in {1,2} — which is what fixes [0]=Weight, [1]=Line. Init N.js 30201-30202.",
    confidence: "confirmed",
  },
  FamValMinigameHiscores: {
    name: "minigameHiscores", attr: "FamilyValuesMap", family: false, scope: "account-via-aggregate", agg: "max", governs: null,
    shape: "number[]", parse: "raw", desc: "FamilyValuesMap.MinigameHiscores — best minigame score per minigame, account-wide.",
    idx: null, evidence: "Loader FamilyValuesMap key loop, getLoadList branch. Aggregation inferred from naming, not read.",
    confidence: "inferred",
  },
  FamValWorldSelected: {
    name: "serverSelected", attr: "FamilyValuesMap", family: false, scope: "account", agg: null, governs: null,
    shape: "number", parse: "raw",
    /* The old TRAP note was right that "world 1..6" is wrong, and the reason is now known:
     * "World" here means a MULTIPLAYER SERVER/SHARD, IdleOn's word for its instances. */
    desc: "FamilyValuesMap.WorldSelected — the multiplayer SERVER (shard) this account is on. NOT the in-game world 1..6; \"World\" is IdleOn's UI word for a server. Servers are numbered in blocks of 20: block = floor(v/20) names the group via CustomLists.WorldServerNames, and (v % 20)+1 is the server number shown inside that group. The sample's 153 = group 7, server 14 — which is exactly why it exceeds 6.",
    idx: {
      "encoding": "v = 20*groupIdx + serverWithinGroup. Rich presence renders it as WorldServerNames[floor(v/20)] + (v - 20*floor(v/20) + 1).",
      "selection": "Picked in the server-select grid (5 cols x 4 rows = 20 per page): v = floor((mouseX-227)/113) + 5*floor((mouseY-145)/68) + 20*GeneralINFO[18], where GeneralINFO[18] is the page. Changing it reloads/switches the scene.",
      "on login": "If OptLacc[61] > 0.5 the pinned server wins: v = OptLacc[61]-1. Otherwise v = randomInt(0, ServerVar \"WorldSelRNG\"), re-rolled up to 30 times while ServerVarList \"worldCounts\"[v] > 50 — i.e. the client avoids servers over ~50 players. So an unpinned value is EPHEMERAL and reassigned every login; do not treat it as a stable account attribute.",
      "OptLacc[61]": "The PINNED/preferred server, stored as v+1 (0 = none/auto). Toggled in the same menu, and gated on character 0 being above Lv0[0] 12.",
      "ranges": "80 <= v < 100 gates the Twitch-drops check (ServerVar \"0TwitchLive\"/\"0TwitchLiveDrops\"). Other subsystems TRANSIENTLY overwrite this attribute for their own purposes (random events set it to randomInt(0, \"RandEvntWorld\"); the dungeon lobby compares it against Math.round(100*getRandom()+20)) — another reason the saved number is not reliably a server id at rest.",
    },
    evidence: "Loader FamilyValuesMap key loop, scalar branch. Rich presence N.js 25302-25303: `u.setRich(CustomLists.WorldServerNames[Math.floor(WorldSelected/20)], Math.round(WorldSelected - 20*Math.floor(WorldSelected/20) + 1), DummyText2)` — this is what proves the /20 blocking and the server (not game-world) meaning. Server-select grid N.js 5005: `_dummynumber = Math.floor((mouseX-227)/113) + (5*Math.floor((mouseY-145)/68) + 20*GeneralINFO[18])` then `FamilyValuesMap.h.WorldSelected = _dummynumber`; the OptLacc[61] pin toggle is at 5008. Login pick N.js 30043: `0.5 < OptLacc[61] ? WorldSelected = OptLacc[61]-1 : (WorldSelected = randomInt(0, ServerVar(\"WorldSelRNG\")), for g<30: 50 < worldCounts[min(WorldSelected, len)] ? re-roll : break)`. Twitch gate N.js 22797. Transient overwrites: N.js 14109 (random events), 14821/15319 (dungeon).",
    confidence: "confirmed",
  },
  IMm_N: {
    name: "itemMap", attr: "ItemMap", family: true, scope: "character", agg: null, governs: null,
    shape: "dict", parse: "json",
    desc: "Per-character inventory ItemMap: sparse map of slot index -> item stat object. Logical length from IMmLENGTH_N.",
    idx: null,
    evidence: "Loader: `ia=u.getLoadSparseList('IMm_'+pID, round(_DummyNumber)); PlayerDATABASE.h[name].h.ItemMap=ia`.",
    confidence: "confirmed",
  },
  IMmLENGTH_N: {
    name: "itemMapLength", attr: null, family: true, scope: "character", agg: null, governs: null,
    shape: "number", parse: "raw", desc: "Logical length passed to getLoadSparseList for IMm_N. Load-time only.",
    idx: null, evidence: "`_DummyNumber=u.getLoad('IMmLENGTH_'+pID)` immediately before the IMm_ sparse load.",
    confidence: "confirmed",
  },
  EMm0_N: {
    name: "equipmentMap0", attr: "EquipmentMap", family: true, scope: "character", agg: null, governs: null,
    shape: "dict", parse: "json", desc: "Per-character EquipmentMap[0] (equipped gear stat objects). Logical length from EMmLENGTH0_N.",
    idx: null, evidence: "Loader: `PlayerDATABASE.h[name].h.EquipmentMap[0]=u.getLoadSparseList('EMm0_'+pID, round(_DummyNumber))`.",
    confidence: "confirmed",
  },
  EMm1_N: {
    name: "equipmentMap1", attr: "EquipmentMap", family: true, scope: "character", agg: null, governs: null,
    shape: "dict", parse: "json", desc: "Per-character EquipmentMap[1] (second equipment page — tools). Logical length from EMmLENGTH1_N.",
    idx: null, evidence: "Loader: `PlayerDATABASE.h[name].h.EquipmentMap[1]=u.getLoadSparseList('EMm1_'+pID, round(_DummyNumber))`.",
    confidence: "confirmed",
  },
  EMmLENGTH0_N: { name: "equipmentMap0Length", attr: null, family: true, scope: "character", agg: null, governs: null, shape: "number", parse: "raw", desc: "Logical length for the EMm0_N sparse load. Load-time only.", idx: null, evidence: "`_DummyNumber=u.getLoad('EMmLENGTH0_'+pID)` before the EMm0_ load.", confidence: "confirmed" },
  EMmLENGTH1_N: { name: "equipmentMap1Length", attr: null, family: true, scope: "character", agg: null, governs: null, shape: "number", parse: "raw", desc: "Logical length for the EMm1_N sparse load. Load-time only.", idx: null, evidence: "`_DummyNumber=u.getLoad('EMmLENGTH1_'+pID)` before the EMm1_ load.", confidence: "confirmed" },

  /* CY* — the loader iterates the KEYS of CurrenciesOwned and loads "CY"+key into
   * CurrenciesOwned.h[key]. "NPC" (gated CSver>=6.4), "KeysAll" and "TalentPoints" load as Lists;
   * every other key loads as a scalar. All account-wide by construction.
   * Most are `inferred`: the loader mechanism is confirmed, but the MEANING rests on the key
   * name alone — no spend site was read. */
  CYAnvilTabsOwned: { name: "anvilTabsOwned", attr: "CurrenciesOwned", family: false, scope: "account", agg: null, governs: null, shape: "number", parse: "raw", desc: "CurrenciesOwned.AnvilTabsOwned — anvil production tabs owned.", idx: null, evidence: "Loader CurrenciesOwned key loop, scalar branch. Meaning from the key name only.", confidence: "inferred" },
  CYAFKdoubles: { name: "afkDoubles", attr: "CurrenciesOwned", family: false, scope: "account", agg: null, governs: null, shape: "number", parse: "raw", desc: "CurrenciesOwned.AFKdoubles — AFK-doubling charges.", idx: null, evidence: "Loader CurrenciesOwned key loop, scalar branch. Name-only.", confidence: "inferred" },
  CYObolFragments: { name: "obolFragments", attr: "CurrenciesOwned", family: false, scope: "account", agg: null, governs: null, shape: "number", parse: "raw", desc: "CurrenciesOwned.ObolFragments — obol fragment balance.", idx: null, evidence: "Loader CurrenciesOwned key loop, scalar branch. Name-only.", confidence: "inferred" },
  /* Resolves the old GemsOwned-vs-CurrenciesOwned.Gems puzzle: this is an INBOX, not a balance.
   * The sample's 0-while-GemsOwned-is-144 is the normal resting state, not a contradiction. */
  CYGems: {
    name: "gemsPending", attr: "CurrenciesOwned", family: false, scope: "account", agg: null, governs: null,
    shape: "number", parse: "raw",
    desc: "CurrenciesOwned.Gems — a PENDING-GEM INBOX, not a balance. Gems granted from outside the normal flow land here; the client drains the whole amount into GemsOwned on the next player tick and zeroes it. The real balance is always the top-level GemsOwned key. At rest this is 0 (as in the sample), so a non-zero value only means 'a grant has not been collected yet'. Never sum it with GemsOwned, and never render it as the gem count.",
    idx: null,
    evidence: "Loader CurrenciesOwned key loop, scalar branch. Drain site N.js 24960-24961 (player update block): `if (0 < CurrenciesOwned.h.Gems) { GemsOwned = Math.round(GemsOwned + CurrenciesOwned.h.Gems); PixelHelperActor[8]...ActorEvents_481._GenINFO[26] = GemsOwned; CurrenciesOwned.h.Gems = 0 }`. Init N.js 30280 seeds it to 0 when absent.",
    confidence: "confirmed",
  },
  CYWorldTeleports: { name: "worldTeleports", attr: "CurrenciesOwned", family: false, scope: "account", agg: null, governs: null, shape: "number", parse: "raw", desc: "CurrenciesOwned.WorldTeleports — teleport charges.", idx: null, evidence: "Loader CurrenciesOwned key loop, scalar branch. Name-only.", confidence: "inferred" },
  /* Saved, but NOT state: the client recomputes it from other keys before every read.
   * It sits in CurrenciesOwned next to real balances, which is exactly why it misleads. */
  CYDeliveryBoxMisc: {
    name: "deliveryBoxMisc", attr: "CurrenciesOwned", family: false, scope: "account", agg: null, governs: null,
    shape: "number", parse: "raw",
    desc: "CurrenciesOwned.DeliveryBoxMisc — the 'misc' component of post-office box points: vial BoxPoints bonus + OptLacc[131]. DERIVED CACHE, not authoritative: _customBlock_PostOfficeINFO(\"AvailablePoints\") OVERWRITES it from those two inputs on every call, before using it. The saved number is just whatever the last call left behind, so recompute it rather than trusting it. Fractional (44122.28 in the sample) because the vial bonus is.",
    idx: {
      "formula": "DeliveryBoxMisc = DNSM.AlchVials.BoxPoints + OptLacc[131].",
      "consumer": "AvailablePoints = round(DeliveryBoxComplete + DeliveryBoxStreak + OptLacc[347] + DeliveryBoxMisc) - sum(PostOfficeInfo[3][i][0]), where that sum is the points already spent on upgrades.",
    },
    evidence: "Loader CurrenciesOwned key loop, scalar branch. N.js ~7320 _customBlock_PostOfficeINFO(\"AvailablePoints\"): first `for i < PostOfficeInfo[3].length: DNSM.PostOffInfoDN1 += PostOfficeInfo[3][i][0]`, then `CurrenciesOwned.h.DeliveryBoxMisc = DNSM.AlchVials.h.BoxPoints + OptLacc[131]` (the overwrite), then `return Math.round(CurrenciesOwned.h.DeliveryBoxComplete + CurrenciesOwned.h.DeliveryBoxStreak + (OptLacc[347] + CurrenciesOwned.h.DeliveryBoxMisc)) - DNSM.PostOffInfoDN1`. UI string N.js 27077 confirms the box-points framing (\"Hold_down_to_add_these_Delivery_Boxes_to_your_Post-Office_Upgrade_amount!\"). Init N.js 30282 seeds 0 when absent.",
    confidence: "confirmed",
  },
  CYDeliveryBoxStreak: { name: "deliveryBoxStreak", attr: "CurrenciesOwned", family: false, scope: "account", agg: null, governs: null, shape: "number", parse: "raw", desc: "CurrenciesOwned.DeliveryBoxStreak — post office delivery streak.", idx: null, evidence: "Loader CurrenciesOwned key loop, scalar branch. Name-only.", confidence: "inferred" },
  CYDeliveryBoxComplete: { name: "deliveryBoxComplete", attr: "CurrenciesOwned", family: false, scope: "account", agg: null, governs: null, shape: "number", parse: "raw", desc: "CurrenciesOwned.DeliveryBoxComplete — total deliveries completed.", idx: null, evidence: "Loader CurrenciesOwned key loop, scalar branch. Name-only.", confidence: "inferred" },
  CYTalentPoints: { name: "talentPoints", attr: "CurrenciesOwned", family: false, scope: "account", agg: null, governs: null, shape: "number[]", parse: "raw", desc: "CurrenciesOwned.TalentPoints — account-wide talent point pool, one entry per tree. Loaded as a List.", idx: null, evidence: "Loader: `'KeysAll'==e||'TalentPoints'==e ? (g.h[e]=u.getLoadList('CY'+e)) : ...`.", confidence: "confirmed" },
  CYNPC: { name: "npcCurrency", attr: "CurrenciesOwned", family: false, scope: "account", agg: null, governs: null, shape: "number[]", parse: "raw", desc: "CurrenciesOwned.NPC — per-NPC values with an x.01-style fractional encoding. Encoding NOT determined. Gated on CSver >= 6.4.", idx: null, evidence: "Loader: `'NPC'==e && 6.4<=u.getLoad('CSver') && (f.h[e]=u.getLoadList('CY'+e))`.", confidence: "inferred" },
  CYCharSlotsMTX: { name: "charSlotsMTX", attr: "CurrenciesOwned", family: false, scope: "account", agg: null, governs: null, shape: "number", parse: "raw", desc: "CurrenciesOwned.CharSlotsMTX — extra character slots bought with gems/money.", idx: null, evidence: "Loader CurrenciesOwned key loop, scalar branch. Name-only.", confidence: "inferred" },
  CYKeysAll: { name: "keysAll", attr: "CurrenciesOwned", family: false, scope: "account", agg: null, governs: null, shape: "number[]", parse: "raw", desc: "CurrenciesOwned.KeysAll — boss key counts per key type. Loaded as a List.", idx: null, evidence: "Loader: `'KeysAll'==e||'TalentPoints'==e ? (g.h[e]=u.getLoadList('CY'+e)) : ...`.", confidence: "confirmed" },
  CYSilverPens: { name: "silverPens", attr: "CurrenciesOwned", family: false, scope: "account", agg: null, governs: null, shape: "number", parse: "raw", desc: "CurrenciesOwned.SilverPens — silver pen balance.", idx: null, evidence: "Loader CurrenciesOwned key loop, scalar branch. Name-only.", confidence: "inferred" },
  CYGoldPens: { name: "goldPens", attr: "CurrenciesOwned", family: false, scope: "account", agg: null, governs: null, shape: "number", parse: "raw", desc: "CurrenciesOwned.GoldPens — gold pen balance.", idx: null, evidence: "Loader CurrenciesOwned key loop, scalar branch. Name-only.", confidence: "inferred" },
  CYColosseumTickets: { name: "colosseumTickets", attr: "CurrenciesOwned", family: false, scope: "account", agg: null, governs: null, shape: "number", parse: "raw", desc: "CurrenciesOwned.ColosseumTickets — colosseum ticket balance.", idx: null, evidence: "Loader CurrenciesOwned key loop, scalar branch. Name-only.", confidence: "inferred" },
};
