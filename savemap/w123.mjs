/**
 * IdleOn savegame registry — World 1-3 systems.
 * Ground truth: N.js (decompiled client). Sample: savegame.json.
 *
 * SAVE KEY -> RUNTIME ATTRIBUTE NAME
 * ----------------------------------
 * Many save keys are NOT the runtime getGameAttribute() name. The authoritative
 * mapping lives in the save writer (_customBlock_CloudSAVE, u.addSaveEntry*)
 * and the loader (~N.js offset 19218038+, u.getLoad*). Confirmed renames:
 *   ForgeIntProg -> ForgeIntervalProgress   ForgeItemQty -> ForgeItemQuantity
 *   ForgeLV      -> FurnaceLevels           StampLv      -> StampLevel
 *   StampLvM     -> StampLevelMAX           Print        -> Printer
 *   Shrine       -> ShrineInfo              Tower        -> TowerInfo
 *   Guild        -> GuildTasks              CogM         -> CogMap
 *   CogO         -> CogOrder                CMm          -> ChestMap
 *   FlagP        -> FlagsPlaced             FlagU        -> FlagUnlock
 *   StuG         -> StatueG                 SSprog       -> StarSignProg
 *   CauldronJobs0/1 -> CauldronJobs[0] / CauldronJobs[1]
 *   CauldUpgXPs/CauldUpgLVs -> spliced back into CauldronInfo[8]
 * All other keys in this file save under their own attribute name.
 *
 * `parse`: "json" = JSON.parse the raw string. Note savegame.json in this repo is
 * already pre-parsed for several keys (values arrive as objects, not strings);
 * `parse` describes the RAW cloud-save encoding.
 *
 * NOTE on Haxe arrays: decoded arrays surface as objects with numeric keys plus a
 * "length" property. Treat `length` as metadata, not an element.
 */

export default {
  // ==========================================================================
  // ANVIL / SMITHING
  // ==========================================================================
  "AnvilCraftStatus": {
    name: "anvil_craft_status",
    family: false,
    shape: "nested",
    parse: "json",
    desc: "Per-tab unlock/craft status for every smithing recipe. Account-wide.",
    idx: {
      0: "tab 0 recipes (84 slots in sample). 0=not unlocked, 1=unlocked/craftable, 2=?",
      1: "tab 1 recipes",
      2: "tab 2 recipes",
    },
    evidence: 'N.js _customBlock_DropSomething gates recipe drops on getGameAttribute("AnvilCraftStatus")[0][38], [0][40], [0][50], [0][Math.round(56+f+Math.floor(f/3))] and [1][Math.round(72+f+Math.floor(f/3))], each guarding a _customBlock_DropSomething("SmithingRecipes1", tab, slot, ...) call. So [tab][recipeSlot] -> unlocked flag. The distinction between values 1 and 2 was NOT determined.',
    confidence: "confirmed",
  },
  "AnvilPA_N": {
    name: "anvil_production",
    family: true, // AnvilPA_0 .. AnvilPA_10
    shape: "nested",
    parse: "json",
    desc: "Per-character anvil production queue: 14 producible item slots, each [xp, points?, progress, produced].",
    idx: {
      "*": "14 slots (one per anvil-producible item), each a 4-element array",
      "[slot][0]": 'consumed by _customBlock_TaskProgress: AnvilPA[i][0] = AnvilPA[i][0] - QtyNum. Decremented when the player collects. Sample has non-zero only on actively-producing slots.',
      "[slot][1]": '_customBlock_TaskProgress: AnvilPA[i][1] = AnvilPA[i][1] - QtyNum * _customBlock_AnvilProduceStats("ProdExpBonus") * ... — an XP-weighted counterpart of [0].',
      "[slot][2]": '_customBlock_AFKcode writes AnvilPA[sel][2] during AFK accumulation — production progress/timer.',
      "[slot][3]": "4th field; not identified.",
    },
    evidence: 'N.js _customBlock_AFKcode loops AnvilPAselect, and for each selected slot compares AnvilPA[AnvilPAselect[f]][0] < _customBlock_AnvilProduceStats("Cap") before advancing AnvilPA[...][2]. _customBlock_TaskProgress mutates [0] and [1] on collect. Per-character: _customBlock_add_new_player_to_database deep-copies "AnvilPA" into PlayerDATABASE, so the _N suffix is the character index.',
    confidence: "confirmed",
  },
  "AnvilPAselect_N": {
    name: "anvil_production_selected",
    family: true, // AnvilPAselect_0 .. _10
    shape: "number[]",
    parse: "csv",
    desc: "Per-character: which AnvilPA slots (3 of them) are currently selected for production. -1 = empty slot.",
    idx: {
      "*": "3 entries = the 3 anvil production slots; value = index into AnvilPA, or -1 if unused (see AnvilPAselect_0 = [10,8,-1]).",
    },
    evidence: 'N.js _customBlock_AFKcode: for f in AnvilPAselect.length { if (-1 != AnvilPAselect[f] && AnvilPA[AnvilPAselect[f]][0] < _customBlock_AnvilProduceStats("Cap")) ... } — the value is used directly as an index into AnvilPA, and -1 is the sentinel for unused.',
    confidence: "confirmed",
  },
  "AnvilPAstats_N": {
    name: "anvil_stats",
    family: true, // AnvilPAstats_0 .. _10
    shape: "number[]",
    parse: "csv",
    desc: "Per-character anvil meta stats: points available/spent and anvil upgrade levels. 6 entries.",
    idx: {
      2: 'Anvil "monster/XP" tier counter, used to pick the anvil-points farming map: _customBlock_Holes returns "Grasslands1"/"Grasslands2"/"Grasslands3"/"Jungle1"/"Jungle3"/"Forest1"/... from a threshold ladder on AnvilPAstats[2] (<15, <25, <40, <55, <70, <85 ...). CONFIRMED.',
      "0,1,3,4,5": 'Not identified. Sample values across all 11 chars are consistently [x, 600, 700, y, z, w] — the constant 600/700 at [1]/[2]... note [1]=600 and [2]=700 are constant in the sample, which is in tension with the [2] reading above; do not trust index numbering here without re-checking the caller.',
    },
    evidence: 'N.js _customBlock_Holes reads getGameAttribute("AnvilPAstats")[2] through a map-name threshold ladder. NOTE: sample data has AnvilPAstats[2]==700 for every character, which would always select the last map — so either the ladder is reached only for a different array, or index semantics differ. Flagging as inferred rather than confirmed for that reason.',
    confidence: "inferred",
  },

  // ==========================================================================
  // FORGE
  // ==========================================================================
  "ForgeIntProg": {
    name: "forge_interval_progress",
    family: false,
    shape: "number[]",
    parse: "csv",
    desc: "Per-forge-slot smelting interval progress (16 slots).",
    idx: { "*": "16 forge slots; value = progress toward the current smelt tick." },
    evidence: 'Save key renamed: u.addSaveEntryList("ForgeIntProg", getGameAttribute("ForgeIntervalProgress")). _customBlock_ForgeSpeeed / _customBlock_FoodBonuses write ForgeIntervalProgress[DNSM.forgeAFK.i]; _customBlock_removeitems resets it to 0 when a smelt completes. Cadence comes from _customBlock_ForgeInterval, which reads ItemDefinitionsGET[ForgeItemOrder[3*d]].Cooldown / _customBlock_FoodBonuses("OreSmithTime...").',
    confidence: "confirmed",
  },
  "ForgeItemOrder": {
    name: "forge_item_order",
    family: false,
    shape: "string[]",
    parse: "csv",
    desc: 'Forge slot contents, 3 stride per slot (48 entries = 16 slots x 3). "Blank" = empty.',
    idx: {
      "3*slot+0": 'Ore/input item id. _customBlock_ForgeInterval: ItemDefinitionsGET[ForgeItemOrder[3*d]].Cooldown -> smelt interval.',
      "3*slot+1": 'Secondary item id (fuel/booster). _customBlock_ForgeStats reads ForgeItemOrder[3*d+1] and branches on ItemDefinitionsGET[...].Effect, e.g. "SpeedForge", multiplying by (1 + Amount * _customBlock_FoodBonuses(Effect+"EffectBonus")).',
      "3*slot+2": "Third stride field; not identified.",
    },
    evidence: 'N.js _customBlock_ForgeInterval and _customBlock_ForgeStats both index getGameAttribute("ForgeItemOrder") with stride 3 (3*d, 3*d+1) and resolve the value through ItemDefinitionsGET.',
    confidence: "confirmed",
  },
  "ForgeItemQty": {
    name: "forge_item_quantity",
    family: false,
    shape: "number[]",
    parse: "csv",
    desc: "Quantities paired with ForgeItemOrder, same 3-stride layout (48 entries).",
    idx: {
      "3*slot+0": 'Input ore count. _customBlock_AnvilProduceStats reads ForgeItemQuantity[3*forgeAFK.i].',
      "3*slot+1": 'Secondary item count; _customBlock_ForgeSpeeed checks ForgeItemQuantity[3*i+1] together with a "Blank" test on the matching ForgeItemOrder entry.',
      "3*slot+2": 'Output/produced bar count; _customBlock_ForgeEtcDetails assigns ForgeItemQuantity[3*i+2] = Math.(...).',
    },
    evidence: 'Save key renamed: u.addSaveEntryList("ForgeItemQty", getGameAttribute("ForgeItemQuantity")). All three stride offsets are read/written in _customBlock_AnvilProduceStats, _customBlock_ForgeSpeeed, _customBlock_ForgeEtcDetails, _customBlock_FoodBonuses, indexed by DNSM.forgeAFK.i (the forge slot).',
    confidence: "confirmed",
  },
  "ForgeLV": {
    name: "furnace_levels",
    family: false,
    shape: "number[]",
    parse: "csv",
    desc: "Forge upgrade levels (6 entries): one per purchasable forge upgrade.",
    idx: {
      "*": '6 upgrade tracks. _customBlock_ForgeStats switches on an index d and returns FurnaceLevels[d] for d=0..5, each feeding a different forge bonus (slot count, capacity, speed, ...). Index 5 is returned as 2*FurnaceLevels[5].',
    },
    evidence: 'Save key renamed: u.addSaveEntryList("ForgeLV", getGameAttribute("FurnaceLevels")). _customBlock_ForgeStats: 0==d?FurnaceLevels[0] : 1==d? ... : 2==d? ...FurnaceLevels[2]... : 3==d?FurnaceLevels[3] : 4==d?FurnaceLevels[4] : 5==d?2*FurnaceLevels[5]. The specific bonus per index was not resolved.',
    confidence: "confirmed",
  },

  // ==========================================================================
  // STAMPS
  // ==========================================================================
  "StampLv": {
    name: "stamp_levels",
    family: false,
    shape: "nested",
    parse: "json",
    desc: "Current stamp levels, paged by stamp category.",
    idx: {
      0: "Combat stamps (45 in sample)",
      1: "Skills stamps (58 in sample)",
      2: "Misc stamps (28 in sample)",
      "addressing": 'The client addresses a stamp by a flat id N: page = Math.floor(N/1000), slot = N - 1000*Math.floor(N/1000). So id 2014 = page 2, slot 14.',
    },
    evidence: 'Save key renamed: u.addSaveEntryList("StampLv", getGameAttribute("StampLevel")). _customBlock_StampCostss and _customBlock_StampDetails both read StampLevel[Math.floor(id/1E3)][id - 1E3*Math.floor(id/1E3)] — confirming the page/slot 1000-stride addressing and 3 pages.',
    confidence: "confirmed",
  },
  "StampLvM": {
    name: "stamp_levels_max",
    family: false,
    shape: "nested",
    parse: "json",
    desc: "Highest stamp level ever reached per stamp (same paging as StampLv). Used as the cap/reference when stamps are reduced.",
    idx: {
      0: "Combat stamps (45)",
      1: "Skills stamps (58)",
      2: "Misc stamps (28)",
      "addressing": "Same page = floor(id/1000), slot = id % 1000 scheme as StampLv.",
    },
    evidence: 'Save key renamed: u.addSaveEntryList("StampLvM", getGameAttribute("StampLevelMAX")). _customBlock_StampCostss and _customBlock_StampDetails index StampLevelMAX with the identical floor(id/1E3) / id-1E3*floor(id/1E3) scheme, alongside StampLevel. In the sample StampLvM >= StampLv elementwise (e.g. page1 slot2: StampLv 123 vs StampLvM 125), consistent with a high-water mark.',
    confidence: "confirmed",
  },

  // ==========================================================================
  // ALCHEMY
  // ==========================================================================
  "CauldronInfo": {
    name: "alchemy",
    family: false,
    shape: "nested",
    parse: "json",
    desc: "Alchemy: 4 cauldrons of bubble levels, vial levels, liquids, cauldron upgrades, sigils.",
    idx: {
      0: "cauldron 0 (Power / orange) bubble levels — 35 bubbles, indexes line up with CustomLists.AlchemyDescription[0]",
      1: "cauldron 1 (Quicc / green) bubble levels — AlchemyDescription[1]",
      2: "cauldron 2 (High-IQ / yellow) bubble levels — AlchemyDescription[2]",
      3: "cauldron 3 (Kazam / purple) bubble levels — AlchemyDescription[3]",
      4: "VIAL levels, 88 slots (AlchemyDescription[4] defines 86 vials). Max level 13. Index 74 = TURTLE_TISANE. See turtleVial export below.",
      5: "4 large numbers (sample ~3.4e8..7.4e8) — liquid amounts per liquid type. INFERRED from arity 4 + Liquid1..Liquid4 in the vial table; not traced in N.js.",
      6: "4 numbers (~1.3e5..2.2e5) — second per-liquid quantity (cap or regen accumulator). NOT confirmed.",
      7: "5 numbers ([3,3,3,4,0] in sample) — small per-cauldron/per-liquid tier values. NOT confirmed.",
      8: 'CAULDRON UPGRADES: [8][group][upgrade] = [xp, level], 8 groups x 4 upgrades = 32 pairs. EMPTY in the save file by design — see CauldUpgLVs / CauldUpgXPs.',
      9: "4 zeros in sample. Unknown.",
      10: 'SIGIL levels, 18 slots (AlchemyDescription[5] defines 16 sigils). INFERRED: used as the exponent in the sigil cost curve.',
    },
    evidence: 'N.js _customBlock_CauldronStats("BubbleBonus", b, e) sets DNSM.CauldStatDL1 = CustomLists.AlchemyDescription[b][e] and evaluates it against CauldronInfo[b][e] as the level — so CauldronInfo[b][e] is the level of the entry described by AlchemyDescription[b][e], for b=0..3 (bubbles) and b=4 (vials). _customBlock_CauldronStats("CauldronLvsBrewBonus", b, e) reads CauldronInfo[8][b][e][1] as a level (and [0] as xp). Sigils: the cost branch computes AlchemyDescription[b][e][11+f] * Math.pow(AlchemyDescription[b][e][4], CauldronInfo[10][e]).',
    confidence: "confirmed", // for [0..4] and [8]; [5],[6],[7],[9],[10] are inferred/unknown as annotated
  },
  "CauldUpgLVs": {
    name: "cauldron_upgrade_levels",
    family: false,
    shape: "number[]",
    parse: "csv",
    desc: "Flattened cauldron upgrade LEVELS, 32 entries. Spliced back into CauldronInfo[8] on load.",
    idx: {
      "*": 'Entry B (0..31) -> CauldronInfo[8][Math.floor(B/4)][B%4][1]. Group = floor(B/4) (0..7), upgrade = B%4 (0..3). Groups 0..3 are the 4 cauldrons; groups 4..7 are the other 4 tracks (liquids).',
      "upgrade B%4 == 0": 'Brew speed-ish: _customBlock_CauldronStats("CauldronLvsBrewBonus", b, 0) = Math.round(5 * CauldronInfo[8][b][0][1]) for b<4.',
      "upgrade B%4 == 1": '= Math.round(10*(1 + .05*CauldronInfo[8][b][1][1]))/10 for b<4.',
      "upgrade B%4 == 2": '= Math.round(10 * ArbitraryCode5Inputs("decay", 90, 100, CauldronInfo[8][b][2][1], 0, 0))/10 for b<4 — a decaying cost-reduction, i.e. 90*lv/(lv+100).',
      "upgrade B%4 == 3": '= Math.round(2 * CauldronInfo[8][b][3][1]) for b<4.',
    },
    evidence: 'N.js save writer (~offset 6298052) pushes CauldronInfo[8][g][b][1] into DummyList2 then u.addSaveEntryList("CauldUpgLVs", DummyList2), and blanks CauldronInfo[8] = [] before saving CauldronInfo. Loader (~19222905): for B in 0..31 { CauldronInfo[8][floor(B/4)][B-4*floor(B/4)][1] = getLoadList("CauldUpgLVs")[B] }. Bonus formulas from _customBlock_CauldronStats("CauldronLvsBrewBonus", ...).',
    confidence: "confirmed",
  },
  "CauldUpgXPs": {
    name: "cauldron_upgrade_xp",
    family: false,
    shape: "number[]",
    parse: "csv",
    desc: "Flattened cauldron upgrade XP, 32 entries. The [0] twin of CauldUpgLVs.",
    idx: {
      "*": "Entry B (0..31) -> CauldronInfo[8][Math.floor(B/4)][B%4][0]. Same group/upgrade decomposition as CauldUpgLVs.",
    },
    evidence: 'Same save/load pair as CauldUpgLVs: writer pushes CauldronInfo[8][g][b][0] into DummyList/DNSM.CSdummyL7 then u.addSaveEntryList("CauldUpgXPs", DNSM.CSdummyL7); loader sets CauldronInfo[8][floor(B/4)][B%4][0] = getLoadList("CauldUpgXPs")[B] for B in 0..31.',
    confidence: "confirmed",
  },
  "CauldronBubbles": {
    name: "cauldron_bubbles_selected",
    family: false,
    shape: "nested",
    parse: "json",
    desc: 'Per-player "bubbles left on" selections (the 3 bubbles each character keeps active). Encoded as cauldron-letter + bubble number strings, e.g. "b3", "a7", "c15", "_6"; 0 = empty slot.',
    idx: {
      "[playerIdx]": 'Indexed by GetPlayersUsernames.indexOf(UserInfo[0]) — i.e. by character. Each entry is a 3-element array of bubble tags.',
      "tag format": 'Letter = cauldron (via CustomLists.Number2Letter), digits = bubble index within that cauldron. "_" appears as a cauldron letter for one of the cauldrons.',
    },
    evidence: 'N.js _customBlock_Companions reads CauldronBubbles[GetPlayersUsernames.indexOf(UserInfo[0])] and does D.contains(CauldronBubbles[e], "" + h.string(CustomLists.Number2Letter[...GenINFO...])) — matching the stored tag against a Number2Letter-derived cauldron letter. _customBlock_IsXYmouseWithinBounds indexes CauldronBubbles[b + 6*GenINFO[46]] for the UI grid.',
    confidence: "confirmed",
  },
  "CauldronJobs0": {
    name: "cauldron_jobs_assignments",
    family: false,
    shape: "nested",
    parse: "json",
    /* The forward index of CauldronJobs1: [0] is cauldron -> characters, [1] is character ->
     * cauldron. The client keeps both in sync on every assign/unassign, so they are redundant;
     * read [0] when you want a cauldron's roster, [1] when you want a character's posting. */
    desc: 'ALCHEMY BREWING ASSIGNMENTS: which characters are brewing at which cauldron. [cauldronIdx][slot] = character index (into GetPlayersUsernames), or -1 for an empty slot. 8 cauldrons x 8 slots; all -1 in the sample (nobody assigned).',
    idx: {
      "[0..3]": "The four BUBBLE cauldrons (Power/Quicc/High-IQ/Kazam). 8 slots each. Each assigned character adds CauldronStats(\"ResearchSpeed\", charIdx) * CauldronStats(\"SpecificSpdBonuses\", cauldron) / 3600 per tick to CauldronInfo[5][cauldron] (brew progress).",
      "[4..7]": "The four LIQUID cauldrons, in the same array. Only the FIRST 4 SLOTS are usable -- the client's slot bound is Math.round(8 - 4*cauldronType), so type 1 (liquid) gets 4. Liquid row for liquid b is [b+4]; each non--1 entry adds CauldronStats(\"ResearchSpeed\", charIdx) to the LiquidHRrate.",
      "slot bound": "Slots are gated by unlock count: a character may only be placed where GenINFO[48][cauldron] > slot. So trailing -1s can be locked slots, not merely empty ones -- do not infer capacity from this array alone.",
      "values": "Character index computed as DummyNumber2 + 6*GenINFO[46] (the roster UI pages 6 characters at a time). -1 = empty.",
    },
    evidence: 'Loader (~19218038): getGameAttribute("CauldronJobs")[0] = u.getLoadJsonList("CauldronJobs0"). Bubble-brew consumer N.js 8592-8594: `for DummyRepeatIndex<4: for b<8: -1 != CauldronJobs[0][DummyRepeatIndex][b] && (CauldronInfo[5][DummyRepeatIndex] += GenINFO[50] * CauldronStats("ResearchSpeed", CauldronJobs[0][DummyRepeatIndex][b], 0,0) * CauldronStats("SpecificSpdBonuses", DummyRepeatIndex,0,0)/3600)` -- proving the stored value is a CHARACTER index, not a bubble id. Liquid consumer N.js 7368-7369 (inside _customBlock_CauldronStats("LiquidHRrate")): `for e<4: f=e++, -1 != CauldronJobs[0][b+4][f] && (CauldStatDN2 += CauldronStats("ResearchSpeed", CauldronJobs[0][b+4][f],0,0))` -- proving rows 4..7 are the liquids and only 4 slots are scanned. Assign/unassign UI N.js ~8610-8611 (_event_released): _DN4 = cauldronType==0 ? GenINFO[20]-20 : GenINFO[20]-33+4 (hence rows 0..3 vs 4..7); slot loop bound Math.round(8-4*CauldronType); writes CauldronJobs[0][_DN4][b] = DummyNumber2+6*GenINFO[46] and mirrors CauldronJobs[1][char] = _DN4, guarded by GenINFO[48][_DN4] > b.',
    confidence: "confirmed",
  },
  "CauldronJobs1": {
    name: "cauldron_jobs_1",
    family: false,
    shape: "number[]",
    parse: "json",
    desc: "Per-character alchemy job assignment (30 entries; -1 = unassigned). Values are fractional, e.g. 111.4, 112.1, 113.3.",
    idx: {
      "[playerIdx]": 'Indexed by character. -1 = not assigned to alchemy. Values >= ~90 are treated as SIGIL assignments: the client renders "SIGIL_" + Math.round(v - 99).',
    },
    evidence: 'N.js (~offset 3581814): v = CauldronJobs[1][GetPlayersUsernames.indexOf(UserInfo[0])]; if (90 <= Math.max(0, v+1)) push("SIGIL_" + Math.round(v - 99)) else push(GenINFO[73][Math.max(0, v+1)]). Loader: getGameAttribute("CauldronJobs")[1] = u.getLoadJsonList("CauldronJobs1"). The meaning of the fractional part (e.g. .4 in 111.4) was NOT determined — likely encodes the sub-slot. Marked inferred because of that.',
    confidence: "inferred",
  },
  "CauldronP2W": {
    name: "cauldron_pay_to_win",
    family: false,
    shape: "nested",
    parse: "json",
    desc: "Alchemy P2W / gem-shop upgrade levels + sigil progress.",
    idx: {
      0: '12 entries = 4 cauldrons x 3 upgrade types. Addressed as CauldronP2W[0][f + 3*e] where e = cauldron and f = upgrade type (0,1,2). Costs use curves like Math.round(3200 * Math.pow(1.18 - .145*lvl, ...)) and Math.round(3750*Math.pow(1.2 - .14*lvl, ...)). CONFIRMED.',
      1: "8 entries — a second P2W track (2 types x 4 liquids?). Not traced.",
      2: "2 entries. Not traced.",
      3: "2 entries. Not traced.",
      4: 'SIGILS: stride-2 pairs. CauldronP2W[4][1 + 2*d] for d in 0..23 is the sigil LEVEL; the client counts a sigil as purple/maxed when that value >= 3. CauldronP2W[4][2*d] is the paired XP/progress (large floats in the sample). CONFIRMED.',
    },
    evidence: 'N.js _customBlock_cauldronp2wbonuses: CauldronP2W[0][asNumber(f) + 3*e] / (100 + CauldronP2W[0][...]) and cost curves keyed on the same index — so [0] is [cauldron][upgradeType] with stride 3. Sigils: _customBlock_ArbitraryCode "TotalPurpleSigils" branch loops f in 0..23 and tests 3 <= asNumber(CauldronP2W[4][1 + 2*f]), incrementing DNSM.SigTotPup.',
    confidence: "confirmed",
  },

  // ==========================================================================
  // W1 MISC
  // ==========================================================================
  "Bubba": {
    name: "bubba",
    family: false,
    shape: "nested",
    parse: "json",
    desc: "Bubba (W1 pet/companion-like system): resources, happiness, timers and per-slot upgrade levels.",
    idx: {
      "[0][0]": '"Meatslice" resource — _customBlock_Bubbastuff does Bubba[0][0] += _customBlock_Bubbastuff("MeatsliceRate",0,0) * dt.',
      "[0][1]": 'HAPPINESS — _customBlock_Bubbastuff does Bubba[0][1] = Math.max(0, Bubba[0][1] - _customBlock_Bubbastuff("HappinessLoss",0,0) * dt).',
      "[0][4]": "Second meatslice-rate accumulator (same MeatsliceRate term added).",
      1: "28 integers — per-something levels/counters (sample: 686,173,663,...).",
      2: "28 integers, mostly 0.",
      "bonuses": '_customBlock_Bubbastuff("BubbaRoG_Bonuses", i, 0) exposes Bubba-derived bonuses to other systems (e.g. construction speed).',
    },
    evidence: 'N.js _customBlock_Bubbastuff mutates Bubba[0][0], [0][1] and [0][4] each tick via the named sub-blocks "MeatsliceRate" and "HappinessLoss". Other sub-arrays were not traced. 272 read sites overall.',
    confidence: "inferred",
  },
  "Jars": {
    name: "jars",
    family: false,
    shape: "nested",
    parse: "json",
    desc: "Jar/bottle collection entries; each row [?, size, x, y, rngSeed]-ish and rendered on a shelf.",
    idx: {
      "[i][1]": 'Size/scale — used in hitbox math: y - 17*Jars[i][1] and y + (67 + 17*Jars[i][1]).',
      "[i][2]": "Y (or X) draw coordinate; the hitbox is built around it.",
      "[i][4]": "Float in [0,1) — looks like a per-jar RNG roll. Not confirmed.",
    },
    evidence: 'N.js _customBlock_IsXYmouseWithinBounds builds the jar hitbox from Jars[DRI][2] and Jars[DRI][1]: (Jars[DRI][2] - 17*Jars[DRI][1]) .. (Jars[DRI][2] + 67 + 17*Jars[DRI][1]). _customBlock_Holes iterates Jars.length against UIinventory15On[64][e]. Saved via u.addSaveEntryJsonList("Jars", getGameAttribute("Jars")). Only the geometry fields were pinned down.',
    confidence: "inferred",
  },

  // ==========================================================================
  // 3D PRINTER
  // ==========================================================================
  "Print": {
    name: "printer",
    family: false,
    shape: "nested",
    parse: "json",
    desc: 'Flat 3D-printer sample list: alternating [itemId, quantity] pairs after a 5-number header. "Blank"/0 = empty slot.',
    idx: {
      "0..4": "5-number header (5 leading zeros in the sample). Not identified.",
      "5 + 2*s + 14*playerIdx": 'Item id of printer slot s for character playerIdx. _customBlock_WorkbenchStuff reads Printer[5 + 2*v + 14*GetPlayersUsernames.indexOf(...)] — so stride 2 per slot, 14 per character => 7 slots/character (5 printing + 2 pending).',
      "6 + 2*s + 14*playerIdx": "Quantity for that slot.",
    },
    evidence: 'Save key renamed: u.addSaveEntryJsonList("Print", getGameAttribute("Printer")). _customBlock_WorkbenchStuff indexes Printer[5 + 2*v + 14*playerIdx]; _customBlock_getLOG clears a slot with Printer[Math.round(5+2*p)] = "Blank"; Printer[Math.round(6+2*p)] = 0 — confirming the (id, qty) stride-2 pairing with a 5-element header.',
    confidence: "confirmed",
  },
  "PrinterXtra": {
    name: "printer_extra",
    family: false,
    shape: "string[]",
    parse: "csv",
    desc: 'Extra 3D-printer sample slots (from the "Printer Sampling" lab / extra-slot upgrades). Same alternating [itemId, quantity] encoding as Print.',
    idx: {
      "2*(slot-5) + 10*playerIdx": 'Item id. _customBlock_WorkbenchStuff: PrinterXtra[2*(v-5) + 10*GetPlayersUsernames.indexOf(UserInfo[0])] — the (v-5) offset shows these are the slots BEYOND the 5 base printer slots; 10 per character => 5 extra slots/character.',
      "1 + 2*(slot-5) + 10*playerIdx": "Quantity for that slot.",
      "120 + d": '_customBlock_Thingies reads PrinterXtra[120+d] and splices DNSM.MonsterDropDL — a tail region past the per-character block. Purpose not determined.',
    },
    evidence: 'N.js _customBlock_WorkbenchStuff reads both PrinterXtra[2*(v-5) + 10*playerIdx] and PrinterXtra[1 + 2*(v-5) + 10*playerIdx], establishing the id/qty stride-2 layout with a 10-element per-character block starting at printer slot 5.',
    confidence: "confirmed",
  },

  // ==========================================================================
  // REFINERY / SALT LICK
  // ==========================================================================
  "Refinery": {
    name: "refinery",
    family: false,
    shape: "nested",
    parse: "json",
    desc: "Refinery: cycle timers, salt selections, stored materials, and per-salt [rank, level, ...] rows.",
    idx: {
      0: '8 numbers: [0][0] = a cycle counter/rank; [0][f+1] = the cycle timer for salt f. _customBlock_DropSomething advances Refinery[0][f+1] += _customBlock_Refinery("CycleInitialTime", f) * ... for f < Math.floor(Refinery[0][0]/3)-ish.',
      1: '8 item ids ("Refinery2".."Refinery8", "Blank") — which salt/redox is in each slot.',
      2: "8 numbers — stored quantity per slot.",
      "3+g": '_customBlock_PlayerAccTot reads Refinery[3+g][1] — per-salt rows; index [1] is the salt LEVEL. Sample rows look like [rank, level, ?, ?, ?].',
    },
    evidence: 'N.js _customBlock_DropSomething / _customBlock_AddBuffType: e = ...Math.floor(Refinery[0][0]/3)...; for f < e: Refinery[0][f+1] = Refinery[0][f+1] + _customBlock_Refinery("CycleInitialTime", f) * dt — so [0][0] gates how many cycle timers run and [0][1..] are those timers. _customBlock_PlayerAccTot: DNSM.CalcTalentDN1 = asNumber(Refinery[3+g][1]).',
    confidence: "confirmed",
  },
  "SaltLick": {
    name: "salt_lick",
    family: false,
    shape: "number[]",
    parse: "json",
    desc: "Salt Lick upgrade levels, 25 entries (one per Salt Lick bonus).",
    idx: {
      "*": 'Entry m = level of Salt Lick bonus m, capped at CustomLists.SaltLicks[m][4]. The SaltLicks table rows are: [refineryTier, description, cost?, bonusPerLevel, MAX_LEVEL, costGrowth]. E.g. row 0 = "Refinery1 Samples_taken_for_the_3D_printer_are_+{%_bigger! 5 0.5 20 1.5" -> +0.5% per level, max level 20.',
    },
    evidence: 'N.js _customBlock_StampDetails clamps it: if (SaltLick[m] > CustomLists.SaltLicks[m][4]) SaltLick[m] = Math.round(CustomLists.SaltLicks[m][4]) — so SaltLick[m] is the level and SaltLicks[m][4] is that bonus\'s max level. _customBlock_TaskProgress initializes the array by pushing 25 zeros. Table defined at na.SaltLicks = function(){return[...]} (~N.js 13945844).',
    confidence: "confirmed",
  },

  // ==========================================================================
  // SHRINES / TOWER / TOTEMS
  // ==========================================================================
  "Shrine": {
    name: "shrines",
    family: false,
    shape: "nested",
    parse: "json",
    desc: "Per-shrine state: [?, ?, mapId, level, xp, ?]. Sample rows like [300, 2, 120, 29, 37071771, 0].",
    idx: {
      "[i][0]": "300 across all rows in the sample — likely a constant/max marker.",
      "[i][2]": 'Map id the shrine is placed on. _customBlock_Dungon writes ShrineInfo[PersonalList1[3]][0] = CurrentMap — NOTE this writes index [0], not [2]; do not trust the [2] label without re-checking.',
      "[i][3]": "Shrine LEVEL (29, 28... in the sample; monotonically non-increasing across later shrines, consistent with levels).",
      "[i][4]": "Accumulated shrine XP/charge (large float).",
      "[i][5]": "Reset to 0 by _customBlock_Ninja: ShrineInfo[PersonalList1[3]][4] = 0 nearby. Not identified.",
    },
    evidence: 'Save key renamed: u.addSaveEntryJsonList("Shrine", getGameAttribute("ShrineInfo")). _customBlock_Dungon sets ShrineInfo[i][0] = CurrentMap; _customBlock_addImgInst compares ShrineInfo[f][2] against (actor.getX() + getScreenX() - 45) — so [2] is an X coordinate, not a map id. _customBlock_DropSomething tests .7 < ShrineInfo[f][3]. Index meanings are only partially resolved; consumed via _customBlock_Shrine(n) elsewhere (e.g. GiantMob uses _customBlock_Shrine(6)).',
    confidence: "inferred",
  },
  "Tower": {
    name: "worship_tower",
    family: false,
    shape: "number[]",
    parse: "json",
    desc: "Worship / Tower Defence: tower levels, placements, charge and totals. Flat list (~54+ entries).",
    idx: {
      "0..26": "27 entries pushed as zeros on init (_customBlock_TaskProgress: for d in 0..26 TowerInfo.push(0)) — tower levels / upgrade levels.",
      "27..53": "The sample repeats the first 27 values verbatim at offset 27 — strongly suggests a second parallel block (e.g. placed-level vs owned-level). NOT confirmed.",
      2: '_customBlock_DamageDealed branches on TowerInfo[2].',
      0: '_customBlock_WorkbenchStuff reads TowerInfo[0] and matches DNSM["3dSamplDT"] against it.',
    },
    evidence: 'Save key renamed: u.addSaveEntryJsonList("Tower", getGameAttribute("TowerInfo")). _customBlock_TaskProgress: if (!TowerInfo.length) { for d in 0..26 TowerInfo.push(0); ... } — establishes a 27-wide base block. 201 read sites; individual index semantics were not resolved.',
    confidence: "inferred",
  },
  "TotemInfo": {
    name: "totems",
    family: false,
    shape: "nested",
    parse: "json",
    desc: "Worship totem state: 3 parallel rows of 9.",
    idx: {
      0: 'Row of 9 levels/points — _customBlock_TotalTalentPoints sums TotemInfo[0][g] over TotemInfo[0].length into DNSM.TomeQTY[37]. _customBlock_Holes clamps: if (239 < TotemInfo[0][p]) ... — so values are capped near 240.',
      1: "Row of 9 — a second parallel track (sample values are consistently <= row 0).",
      2: "Row of 9 large floats — accumulated charge/XP per totem.",
    },
    evidence: 'N.js _customBlock_TotalTalentPoints: for g in TotemInfo[0].length { DummyNumber += asNumber(TotemInfo[0][g]) } then DNSM.TomeQTY[37] = DummyNumber — TotemInfo[0] is the summed-into-Tome track. _customBlock_Holes tests 239 < asNumber(TotemInfo[0][p]) and clamps. Rows 1 and 2 not traced.',
    confidence: "inferred",
  },

  // ==========================================================================
  // GUILD / MAPS / BOSSES / DUNGEONS
  // ==========================================================================
  "Guild": {
    name: "guild_tasks",
    family: false,
    shape: "nested",
    parse: "json",
    desc: "Guild: bonus levels + task rows.",
    idx: {
      0: '18 numbers = GUILD BONUS levels (consumed via _customBlock_GuildBonuses(n): e.g. GuildBonuses(1)=AllStat, (3)=Weapon Power, (8)=cash, (12)=card drop chance).',
      "1..n": 'Task rows [taskId, tier, progress]. _customBlock_StampDetails normalizes the id: GuildTasks[m+1][0] = m + 3*Math.floor(m/3) (or Math.(...)) — so rows are offset by 1 from the bonus block and grouped in 3s (daily/weekly tiers).',
    },
    evidence: 'Save key renamed: u.addSaveEntryJsonList("Guild", getGameAttribute("GuildTasks")); loader gates on 4 <= CSver. _customBlock_StampDetails writes GuildTasks[m+1][0] = m + 3*Math.floor(m/3), confirming the +1 row offset and 3-grouping. The GuildBonuses(n) index mapping to specific bonuses is inferred from the call sites (CritChance/AllStat/WeaponPower/CardChanceMulti blocks), not from a table read.',
    confidence: "inferred",
  },
  "MapBon": {
    name: "map_bonuses",
    family: false,
    shape: "nested",
    parse: "json",
    desc: "Per-map AFK/objective counters. One row per map, parallel to CustomLists.MapAFKtarget.",
    idx: {
      "[mapId]": 'Row for map `mapId`. Rows are length 1 or length 3 depending on the map. Rows of length >= 3 are the "Arcade/objective" maps: _customBlock_ArcaneType increments MapBon[CurrentMap][e] for e in 0..2 when the player has StatusArc{e}.',
      "[mapId][0..2]": "Three per-map objective counters (only present when the row has length >= 3).",
    },
    evidence: 'N.js _customBlock_initialize3 grows MapBon until MapBon.length >= CustomLists.MapAFKtarget.length — so the outer index is the map id. _customBlock_ArcaneType: if (D.contains(_StatusList, "StatusArc"+e) && 3 <= MapBon[CurrentMap].length) MapBon[CurrentMap][e] = MapBon[CurrentMap][e] + 1. _customBlock_TimerDisplay also gates on 3 <= MapBon[CurrentMap].length before reading MonsterDefinitionsGET[MapAFKtarget[CurrentMap]].',
    confidence: "confirmed",
  },
  "BossInfo": {
    name: "boss_info",
    family: false,
    shape: "nested",
    parse: "json",
    desc: "Per-boss records, 6 rows of [difficultyTier, bestDamage, bestTime/score].",
    idx: {
      "[b][0]": 'Difficulty tier reached. _customBlock_RiftStuff / _customBlock_TalentCalc branch on BossInfo[4][0]: ==0 -> multiplier 1.5 and 100*BossInfo[4][1]; ==1 -> ... ; else -> multiplier 2 and 1e6*BossInfo[4][1]. So [0] selects the scale applied to [1].',
      "[b][1]": "Best damage / score (scaled by 100 or 1e6 depending on [0]).",
      "[b][2]": "Third field (kill count or best time). Not identified.",
      4: "Row 4 is the one read by _customBlock_RiftStuff and _customBlock_TalentCalc (which boss this is was not resolved).",
    },
    evidence: 'N.js _customBlock_RiftStuff: 0 == BossInfo[4][0] ? (DummyNumber = 1.5, DummyNumber2 = 100*asNumber(BossInfo[4][1])) : 1 == BossInfo[4][0] ? (...) : (DummyNumber = 2, DummyNumber2 = 1e6*asNumber(BossInfo[4][1])). _customBlock_TalentCalc mirrors the same branch. Only row 4 / cols 0-1 were traced.',
    confidence: "inferred",
  },
  "DungUpg": {
    name: "dungeon_upgrades",
    family: false,
    shape: "nested",
    parse: "json",
    desc: "Dungeon upgrade levels across several tracks.",
    idx: {
      0: '48 entries — the main dungeon upgrade levels. _customBlock_TaskProgress builds it with for d in 0..47, with special-cased ranges (10>e, 20<=e&&23>e, ...). Trailing -1 is a terminator.',
      1: "8 entries (all 100 in sample).",
      2: "9 entries — a list of unlocked ids, -1 terminated.",
      3: '10 entries — per-slot values clamped to 3: _customBlock_Breeding does DungUpg[3][4] = Math.min(3, DungUpg[3][4]) and DungUpg[3][5] = Math.min(3, DungUpg[3][5]).',
      4: "4 entries.",
      5: "8 entries (all 50 in sample).",
      6: "10 entries (all 1 in sample).",
    },
    evidence: 'Save key renamed only in ordering: u.addSaveEntryJsonList("DungUpg", getGameAttribute("DungUpg")); loader gates on 6.51 <= CSver. _customBlock_TaskProgress initializes row 0 with a 48-iteration loop containing the index ranges above. _customBlock_Breeding clamps DungUpg[3][4] and DungUpg[3][5] to a max of 3. Row-to-feature mapping was NOT resolved.',
    confidence: "inferred",
  },

  // ==========================================================================
  // STORAGE
  // ==========================================================================
  "ChestOrder": {
    name: "chest_order",
    family: false,
    shape: "string[]",
    parse: "csv",
    desc: 'Storage chest slot -> item id. "Blank" = empty, "LockedInvSpace" = locked slot. Parallel to ChestQuantity and ChestMap (CMm).',
    idx: {
      "[slot]": 'Item id at storage slot `slot`. UI pages by 24: _customBlock_AdjustImgInst reads ChestOrder[e + 24*OptionsList[3]].',
      "green stacks": '_customBlock_ActionBlock: for f in ChestOrder.length { if (1e7 <= ChestQuantity[f] && !contains(GreenStacks, ChestOrder[f])) GreenStacks.push(ChestOrder[f]) } — a slot with >= 10,000,000 items is a "green stack".',
    },
    evidence: 'N.js _customBlock_AdjustImgInst indexes ChestOrder[e + 24*asNumber(OptionsList[3])] and tests != "LockedInvSpace" / != "Blank". _customBlock_ActionBlock pairs ChestOrder[f] with ChestQuantity[f] at the same index f and applies the 1e7 green-stack threshold. Loader: getGameAttribute("ChestOrder") = u.getLoadList("ChestOrder").',
    confidence: "confirmed",
  },
  "ChestQuantity": {
    name: "chest_quantity",
    family: false,
    shape: "number[]",
    parse: "csv",
    desc: "Storage chest slot -> item count. Index-parallel to ChestOrder.",
    idx: {
      "[slot]": "Count of the item in ChestOrder[slot]. >= 1e7 renders green (a 'green stack').",
    },
    evidence: 'N.js _customBlock_ActionBlock reads ChestQuantity[f] alongside ChestOrder[f] with the shared index f; _customBlock_TaskProgress resets a slot with ChestQuantity[f] = 0 together with ChestMap[f] = new l — confirming ChestOrder / ChestQuantity / ChestMap are index-parallel.',
    confidence: "confirmed",
  },
  "CMm": {
    name: "chest_map",
    family: false,
    shape: "dict",
    parse: "json",
    desc: "Sparse map: storage slot index -> item stats/attributes map (upgrade slots, Weapon_Power, STR/AGI/WIS/LUK, Defence, UQ1val/UQ2val ...). Only slots with per-item stats appear.",
    idx: {
      "[slotIndex]": 'Keyed by the same slot index used by ChestOrder / ChestQuantity. Value is the item\'s rolled stat map, e.g. {"Upgrade_Slots_Left":0,"Weapon_Power":0,"Speed":0,"Reach":0,"Power":0,"Defence":0,"STR":0,...,"UQ1val":0,"UQ2val":0}.',
    },
    evidence: 'Save key renamed: u.addSaveEntry* writes "CMm" from getGameAttribute("ChestMap"). Loader (~19218038): DummyNumber = u.getLoad("CMmLENGTH"); gameAttributes.ChestMap = u.getLoadSparseList("CMm", Math.round(DummyNumber)) — a SPARSE list of length CMmLENGTH. _customBlock_TaskProgress does ChestQuantity[f] = 0, ChestMap[f] = new l (same index f). _customBlock_MaxCapacity reads ChestMap[g] and derives Speed from a character of the id string.',
    confidence: "confirmed",
  },
  "CMmLENGTH": {
    name: "chest_map_length",
    family: false,
    shape: "number",
    parse: "raw",
    desc: "Declared length of the sparse CMm list (624 in the sample). Required to decode CMm.",
    idx: {},
    evidence: 'N.js loader: this._DummyNumber = u.getLoad("CMmLENGTH"); gameAttributes.h.ChestMap = u.getLoadSparseList("CMm", Math.round(this._DummyNumber)) — it is passed directly as the sparse-list length. Writer derives it from getGameAttribute("ChestMap").',
    confidence: "confirmed",
  },

  // ==========================================================================
  // W3 CONSTRUCTION
  // ==========================================================================
  "ShopStock": {
    name: "shop_stock",
    family: false,
    shape: "nested",
    parse: "json",
    desc: "Remaining purchasable stock per shop, one row per shop (9 rows), one entry per shop slot.",
    idx: {
      "[shopId][slot]": "Remaining stock for that slot. Row lengths vary by shop (27, 14, 21, 13, 23, 17, 9, 13, 13 in the sample).",
    },
    evidence: 'N.js _customBlock_OnPlayStart2 and _customBlock_Breeding both lazily build it: if (!ShopStock.length) { DummyList = []; for e in <shop item count> ...; ShopStock.push(DummyList) } — an array-of-rows built per shop. _customBlock_RunCodeOfTypeXforThingY pushes DummyList3 and then loops for b in 0..23. Per-shop identity of each row index was NOT resolved.',
    confidence: "inferred",
  },
  "Territory": {
    name: "territory",
    family: false,
    shape: "nested",
    parse: "json",
    desc: "Breeding/pet Territory progress: 26 rows of [progress, ?, ?, trophyItem, trophyQty, item2, qty2, item3, qty3].",
    idx: {
      "[territoryId][0]": 'Accumulated progress/points. _customBlock_Breeding reads Territory[_customBlock_Breeding("TerritoryID","0",e,42)][1] in a Math.pow(...) — so rows are addressed via a TerritoryID lookup.',
      "[territoryId][1]": "Second field, used as a Math.pow base/exponent term in _customBlock_Breeding.",
      "[territoryId][3,5,7]": 'Reward item ids ("CookingSpice0", "Blank", ...).',
      "[territoryId][4,6,8]": "Matching reward quantities.",
    },
    evidence: 'N.js _customBlock_TaskProgress initializes: if (!Territory.length) for d in 0..23 { ... Territory.push(DummyList2) } then grows to 26. _customBlock_Breeding: Math.pow(asNumber(Territory[_customBlock_Breeding("TerritoryID","0",e,42)|0][1]), ...). The (item, qty) alternation from index 3 onward is read off the sample data, not from N.js — hence inferred.',
    confidence: "inferred",
  },
  "PostOfficeInfo0": {
    name: "post_office",
    family: false, // PostOfficeInfo0, PostOfficeInfo1, PostOfficeInfo2 (NOT per-character: 3 fixed pages)
    shape: "nested",
    parse: "json",
    desc: "Post Office. 3 fixed save keys (0,1,2) that load into PostOfficeInfo[0..2]; PostOfficeInfo[3] is the per-character box-upgrade block held in PlayerDATABASE.",
    idx: {
      0: "6 rows of [itemId, quantity, 0] — the current order requirements.",
      1: "6 rows of [itemId, quantity, 0] — a second parallel order block.",
      2: '6 rows of [streak, complete, ?, moneyReward]. _customBlock_OfficeboxOrders reads PostOfficeInfo[2][b][0] -> DNSM.DeliveryBoxStreak, PostOfficeInfo[2][b][1] -> DNSM.DeliveryBoxComplete, and PostOfficeInfo[2][b][3] -> added to Money. CONFIRMED.',
      3: 'NOT a save key — PostOfficeInfo[3] = DummyMap.PostOfficeInfo, the per-character post office box upgrade allocation, restored by _customBlock_LoadPlayerInfo from PlayerDATABASE.',
    },
    evidence: 'N.js _customBlock_OfficeboxOrders: DNSM.DeliveryBoxComplete = asNumber(PostOfficeInfo[2][b][1]); DNSM.DeliveryBoxStreak = asNumber(PostOfficeInfo[2][b][0]); Money = Money + asNumber(PostOfficeInfo[2][b][3]). _customBlock_LoadPlayerInfo: PostOfficeInfo[3] = DummyMap.PostOfficeInfo, and _customBlock_add_new_player_to_database deep-copies PostOfficeInfo[3] per character — so index 3 is per-character while 0..2 are account-wide. Indices 0 and 1 are inferred from the sample shape.',
    confidence: "confirmed",
  },
  "CogM": {
    name: "cog_map",
    family: false,
    shape: "dict",
    parse: "json",
    desc: 'Sparse map: construction board slot index -> cog stat map. Keys are single letters ("a".."h") for the cog\'s rolled bonuses.',
    idx: {
      "[slotIndex]": 'Keyed by board slot, index-parallel to CogO. Value e.g. {"a":7764,"c":962,"h":"corners","g":33}. Letter keys are the bonus types; "h" holds a string flavour ("corners", "down", "up", ...) describing the cog\'s AoE shape.',
    },
    evidence: 'Save key renamed: u.addSaveEntry* writes "CogM" from getGameAttribute("CogMap"). _customBlock_ResearchStuff and _customBlock_TaskProgress index CogMap[PersonalList1[0]] with the SAME PersonalList1[0] used to index CogOrder — confirming CogM and CogO are index-parallel. _customBlock_IsXYmouseWithinBounds reads CogMap[PersonalList1[0]].h.h. The letter->bonus mapping was NOT resolved.',
    confidence: "inferred",
  },
  "CogO": {
    name: "cog_order",
    family: false,
    shape: "string[]",
    parse: "json",
    desc: 'Construction board slot -> cog id. "Blank" = empty; "Player_NthHypo" = a character parked on the board; "Cog3cr"/"CogY"/"CogZA00"/"CogCry0" etc. are cog types.',
    idx: {
      "[slot]": 'Cog id at board slot `slot`. The client special-cases prefixes: indexOf("Player_") identifies a character-occupied slot (_customBlock_ResearchStuff, _customBlock_DistanceEqn), and indexOf("CogSm") identifies small cogs (_customBlock_IsXYmouseWithinBounds).',
    },
    evidence: 'Save key renamed: u.addSaveEntry* writes "CogO" from getGameAttribute("CogOrder"). N.js _customBlock_ResearchStuff: 0 == ("" + h.string(CogOrder[PersonalList1[0]])).indexOf("Player_") -> character branch; _customBlock_IsXYmouseWithinBounds tests .indexOf("CogSm"); _customBlock_TaskProgress assigns CogOrder[PersonalList1[0]].',
    confidence: "confirmed",
  },
  "FlagP": {
    name: "flags_placed",
    family: false,
    shape: "number[]",
    parse: "json",
    desc: "Construction flags currently planted: 24 entries, -1 = no flag in that slot, otherwise the FlagU tile index.",
    idx: {
      "*": '24 slots. _customBlock_TaskProgress initializes with 24 pushes of -1; -1 is the "empty" sentinel. Sample: [114,115,112,113,-1,-1,...] — the values are indices into the 96-tile FlagU grid.',
    },
    evidence: 'Save key renamed: u.addSaveEntryJsonList("FlagP", getGameAttribute("FlagsPlaced")). _customBlock_TaskProgress: if (!FlagsPlaced.length) for d in 0..23 FlagsPlaced.push(-1). _customBlock_WorkbenchStuff: for e in FlagsPlaced.length { if (-1 != FlagsPlaced[e]) ... }. _customBlock_NotateNumber does D.contains(FlagsPlaced, e) then reads FlagUnlock[...] — showing FlagP values are FlagU indices.',
    confidence: "confirmed",
  },
  "FlagU": {
    name: "flag_unlock",
    family: false,
    shape: "number[]",
    parse: "json",
    desc: "Construction flag grid unlock/progress state: 96 tiles. -11 = locked/unavailable, 0 = available.",
    idx: {
      "*": '96 tiles. _customBlock_TaskProgress initializes with a 96-iteration loop; _customBlock_StampDetails pushes -11 for certain indices and 0 otherwise. The excluded ranges in the init loop are e in [28..31], [40..43], [52..55], [64..67], ... (a 12-wide row pattern).',
      "grid layout": '_customBlock_ResearchStuff maps a mouse click to a tile with Math.round(96 + (12*Math.floor((getMouseX()-158)/400) + Math.floor((getMouseY()-...)/...))) — a 12-column grid.',
    },
    evidence: 'Save key renamed: u.addSaveEntryJsonList("FlagU", getGameAttribute("FlagUnlock")). _customBlock_TaskProgress: if (!FlagUnlock.length) for d in 0..95 { e = d; if (28<=e&&31>=e || 40<=e&&43>=e || 52<=e&&55>=e || 64<=e&&67>=e ...) }. _customBlock_StampDetails: FlagUnlock.push(-11) : FlagUnlock.push(0). The 12-column geometry comes from _customBlock_ResearchStuff.',
    confidence: "confirmed",
  },

  // ==========================================================================
  // STATUES / STAR SIGNS
  // ==========================================================================
  "StuG": {
    name: "statue_material_tier",
    family: false,
    shape: "number[]",
    parse: "json",
    desc: "Per-statue material/upgrade tier (60 entries). 0 = stone, 1 = gold, 2 = Onyx, 3 = Zenith. Higher tiers multiply the statue's bonus.",
    idx: {
      "*": 'Entry i = tier of statue i. >= 2 (Onyx) applies a multiplier of (1 + (100 + _customBlock_Sailing("ArtifactBonus",30,0))/100); >= 3 (Zenith) applies an additional (1 + (50 + _customBlock_Thingies("ZenithMarke...",...))/100).',
      "onyx count": '_customBlock_Sailing/_customBlock_Summoning2: DNSM.StatueOnyxOwned = count of entries with StatueG[e] >= 2.',
    },
    evidence: 'Save key renamed: u.addSaveEntryJsonList("StuG", getGameAttribute("StatueG")); loader gates on 6.44 <= CSver. N.js statue bonus block: 2 <= asNumber(StatueG[asNumber(d.substring(16, d.length))]) && (DNSM.statuearbDN = DNSM.statuearbDN * Math.max(1 + (100 + _customBlock_Sailing("ArtifactBonus",30,0))/100, 1)); then 3 <= asNumber(StatueG[...]) && (DNSM.statuearbDN = DNSM.statuearbDN * Math.max(1 + (50 + _customBlock_Thingies("ZenithMarke...))/100, 1)). Separately DNSM.StatueOnyxOwned counts e where 2 <= StatueG[e]. Sample values are 3/2/1/0 only, consistent with a 4-tier scale.',
    confidence: "confirmed",
  },
  "SSprog": {
    name: "star_sign_progress",
    family: false,
    shape: "nested",
    parse: "json",
    desc: 'Star sign unlock progress: one row per sign, [progressString, unlockedFlag]. e.g. ["d_ac", 1], ["", 0].',
    idx: {
      "[signId][0]": 'Progress string — letters mark which constellation stars/steps are done ("d_ac", "fg_abc", "_aebdcfgh"), "" = untouched.',
      "[signId][1]": '1 = sign UNLOCKED, 0 = locked. _customBlock_TotalTalentPoints counts signs with SSprog[g][1] == 1.',
      "54+d": '_customBlock_FarmingStuffs reads StarSignProg[d+54][1] — signs from index 54 onward are a distinct (later-world) block.',
    },
    evidence: 'Save key renamed: u.addSaveEntryJsonList("SSprog", getGameAttribute("StarSignProg")); loader gates on 4.1 <= CSver. N.js _customBlock_TotalTalentPoints: for g in StarSignProg.length { if (1 == StarSignProg[g][1]) this._... } — index [1] is the unlocked boolean. _customBlock_FarmingStuffs: if (StarSignProg[d+54][1]) { DNSM... = Math.round(...) }. The semantics of the letters in [0] were NOT decoded.',
    confidence: "confirmed",
  },
};

/**
 * ==========================================================================
 * TURTLE TISANE / "6turtle" VIAL — full bonus chain (the one formula in scope)
 * ==========================================================================
 *
 * WHERE THE LEVEL LIVES
 *   level = CauldronInfo[4][74]         // max 13; sample save = 13
 *   Index 74 confirmed by walking CustomLists.AlchemyDescription[4] (86 vial rows):
 *     row 74 = "TURTLE_TISANE 4 0 add 0 Critter11 Liquid4 Blank Blank
 *               +{%_Artifact_find_chance,_Sigil_SPD,_Cooking_SPD,_and_Construction_Build_rate.
 *               _All_MULTIPLICATIVE!_A_very_special_vial_indeed... 0 6turtle"
 *   Row layout: [0]=name [1]=base [2]=curveArg [3]=curveType [4]=costGrowth
 *               [5..8]=ingredient item ids  [9]=description  [10]=?  [11]=DNSM key
 *
 * HOW THE RUNTIME DICT IS BUILT  (N.js ~offset 4415277)
 *   DNSM.AlchVials = new Map();
 *   for (g = 0; g < CustomLists.AlchemyDescription[4].length; g++) {
 *     key = AlchemyDescription[4][g][11];                     // e.g. "6turtle"
 *     val = _customBlock_CauldronStats("VialBonus", 4, g, 0);
 *     AlchVials[key] = val + asNumber(AlchVials[key]);        // SUMS on collision
 *   }
 *   -> the dict is keyed by the [11] tag, NOT by index. Only TURTLE_TISANE carries
 *      the "6turtle" tag, so AlchVials["6turtle"] is that single vial's bonus.
 *
 * VialBonus  (_customBlock_CauldronStats, N.js ~offset 5021643)
 *   row  = AlchemyDescription[4][g]                            // -> DNSM.CauldStatDL1
 *   DNzz = (Rift[0] > 34 ? 2 * PixelHelperActor[8].ActorEvents_481._GenINFO[108] : 0)
 *          + _customBlock_Summoning("VaultUpgBonus", 42, 0)
 *   core = _customBlock_ArbitraryCode5Inputs(row[3], row[1], row[2], CauldronInfo[4][g], 0, 0)
 *   out  = (MainframeBonus(10) == 2 ? 2 : 1)
 *          * (1 + DNzz/100)
 *          * (1 + _customBlock_Summoning2("MeritocBonusz", 20, 0)/100)
 *          * core
 *
 * ArbitraryCode5Inputs  (N.js @4025953) — the "add" branch:
 *   "add" == a ? (0 != c ? ((b+c)/c + .5*(f-1))/(b/c) * f * b
 *                        : b * f)
 *   For turtle: a="add", b=4, c=0, f=level. c is ZERO, so it takes the `b * f` leg.
 *
 *   ==> BASE BONUS = 4 * level.   At max level 13 => 52 (%).
 *
 * THE x2:  MainframeBonus(10) == 2 is the lab jewel. Confirmed from CustomLists.LabMainBonus
 *   row 10: "10 1177 163 90 1 2 My_1st_Chemistry_Set
 *            All_Vials_in_Alchemy_give_DOUBLE_the_bonus._The_bonus_description_will_reflect_this_doubling."
 *   (row[5] == 2 is the returned value, hence the `== 2` test.)
 *
 * HOW IT IS CONSUMED — always MULTIPLICATIVE, as (1 + AlchVials["6turtle"]/100).
 *   Exactly 4 call sites in N.js, matching the description text:
 *     @7602103   Construction build rate
 *     @7679914   Cooking speed (meal cook spd)
 *     @7767984   Sigil charge speed  ("...Speed" == d branch)
 *     @10452773  Artifact find chance
 *
 * ON THE "+379% AT LV13" CLAIM
 *   NOT the base value. Base at lv13 is 4*13 = 52. 379 is only reachable as the
 *   fully-multiplied output: 52 * 2 (My 1st Chemistry Set) * (1 + DNzz/100)
 *   * (1 + Meritoc/100), where DNzz is dominated by the Rift bonus 2*GenINFO[108]
 *   (GenINFO[108] is INFERRED to be the count of maxed vials; with ~80-88 maxed
 *   vials DNzz ~ 160-176). e.g. 52 * 2 * 2.76 * 1.32 ~= 379.
 *   => Downstream code must apply the multiplier chain; do NOT hardcode 379, and
 *      do NOT treat 4*level as the final value.
 */
export const turtleVial = {
  vialIndex: 74,                 // CauldronInfo[4][74]  — CONFIRMED
  dnsmKey: "6turtle",            // DNSM.AlchVials.h["6turtle"] — CONFIRMED
  name: "TURTLE_TISANE",
  descRow: ["TURTLE_TISANE", "4", "0", "add", "0", "Critter11", "Liquid4", "Blank", "Blank", "<desc>", "0", "6turtle"],
  maxLevel: 13,                  // CONFIRMED: max observed across all 88 slots in the sample save
  curve: "add",
  base: 4,
  curveArg: 0,
  /** Base bonus in percent, before any multipliers. = 4 * level (c==0 leg of "add"). CONFIRMED. */
  baseBonusPct(level) {
    return 4 * level;
  },
  /**
   * Full VialBonus, in percent. CONFIRMED structure; caller supplies the external terms.
   * @param {number} level                CauldronInfo[4][74]
   * @param {object} [o]
   * @param {boolean} [o.chemistrySet]    lab jewel "My 1st Chemistry Set" (MainframeBonus(10)==2) -> x2
   * @param {number}  [o.riftMaxedVials]  GenINFO[108]; contributes 2*that to DNzz, only if Rift[0] > 34
   * @param {boolean} [o.riftUnlocked]    Rift[0] > 34
   * @param {number}  [o.vaultUpgBonus42] Summoning("VaultUpgBonus", 42, 0), added to DNzz
   * @param {number}  [o.meritocBonus20]  Summoning2("MeritocBonusz", 20, 0), percent
   */
  bonusPct(level, o = {}) {
    const core = this.baseBonusPct(level);
    const dnzz = (o.riftUnlocked ? 2 * (o.riftMaxedVials ?? 0) : 0) + (o.vaultUpgBonus42 ?? 0);
    const doubling = o.chemistrySet ? 2 : 1;
    return doubling * (1 + dnzz / 100) * (1 + (o.meritocBonus20 ?? 0) / 100) * core;
  },
  /** All 4 consumers apply it as this multiplier. CONFIRMED. */
  asMultiplier(bonusPct) {
    return 1 + bonusPct / 100;
  },
  affects: [
    "Construction build rate (N.js @7602103)",
    "Cooking speed / meal cook spd (N.js @7679914)",
    "Sigil charge speed (N.js @7767984)",
    "Artifact find chance (N.js @10452773)",
  ],
  confidence: "confirmed",
  caveats: [
    "GenINFO[108] (the Rift term) is INFERRED to be the count of max-level vials; not traced to its writer.",
    "The commonly-cited +379% is the fully-multiplied value, not 4*level. Base at lv13 = 52.",
  ],
};
