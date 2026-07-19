// IdleOn savegame registry -- per-character / combat / inventory keys.
// Generated from N.js (authoritative decompiled client) + savegame.json sample.
// _N suffix = per-character index 0..10 unless noted otherwise.

export default {
  "Lv0_N": {
    "name": "skillLevels",
    "family": true,
    "shape": "number[]",
    "parse": "json",
    "desc": "Per-character skill levels. [0] = character (class) level, [i+1] = skill id i. 25 entries; trailing -1 = not-yet-existing skills.",
    "idx": {
      "0": "character level",
      "1": "Mining (skill 0)",
      "2": "Smithing (1)",
      "3": "Chopping (2)",
      "4": "Fishing (3)",
      "5": "Alchemy (4)",
      "6": "Catching (5)",
      "7": "Trapping (6)",
      "8": "Construction (7)",
      "9": "Worship (8)",
      "10": "Cooking (9)",
      "11": "Breeding (10)",
      "12": "Laboratory (11)",
      "13": "Sailing (12)",
      "14": "Divinity (13)",
      "15": "Gaming (14)",
      "16": "Farming (15)",
      "17": "Sneaking (16)",
      "18": "Summoning (17)",
      "19": "Spelunking (18)",
      "20": "Research (19)"
    },
    "evidence": "N.js save writer (_customBlock_SaveTheGame region, the addSaveEntry* block): addSaveEntryList(\"Lv0\"+DummyText3, GA(\"Lv0\")). Skill id->name from ka.SkillNames() = \"Mining Smithing Chopping Fishing Alchemy Catching Trapping Construction Worship Cooking Breeding Laboratory Sailing Divinity Gaming Farming Sneaking Summoning Spelunking Research 21 22 23 24\".split(\" \"). Lv0[0] is used as CHARACTER LEVEL everywhere (e.g. box-drop rate Math.floor(Lv0[0]/25), and PersonalValuesMap.StatList[4]=Lv0[0]); Lv0[9] gates a Worship-mob quest drop at >=15 (Worship = skill 8 => offset +1 CONFIRMED).",
    "confidence": "confirmed"
  },
  "SL_N": {
    "name": "talentLevels",
    "family": true,
    "shape": "dict",
    "parse": "json",
    "desc": "ACTIVE talent preset: sparse map talentId(string) -> talent level. NOT skill levels.",
    "idx": {},
    "evidence": "N.js save writer (_customBlock_SaveTheGame region, the addSaveEntry* block): builds DummyMap from GA(\"SkillLevels\") (index g -> value where value>0) then addSaveEntryMap(\"SL\"+DummyText3, DummyMap). Runtime attr is SkillLevels, which is the TALENT array (see _customBlock_GetTalentNumber / SkillLevels[491] used as a talent bonus).",
    "confidence": "confirmed"
  },
  "SM_N": {
    "name": "talentLevelsMax",
    "family": true,
    "shape": "dict",
    "parse": "json",
    "desc": "High-water mark of each talent level (talentId -> max level ever reached). Used to refund/respec without losing progress.",
    "idx": {},
    "evidence": "N.js save writer (_customBlock_SaveTheGame region, the addSaveEntry* block): builds DummyMap from GA(\"SkillLevelsMAX\") where value>0, then addSaveEntryMap(\"SM\"+DummyText3, DummyMap).",
    "confidence": "confirmed"
  },
  "SLpre_N": {
    "name": "talentLevelsPreset2",
    "family": true,
    "shape": "dict",
    "parse": "json",
    "desc": "INACTIVE talent preset: sparse map talentId -> level for the preset not currently equipped. Swapped with SL_N on preset toggle.",
    "idx": {},
    "evidence": "N.js save writer (_customBlock_SaveTheGame region, the addSaveEntry* block): written via addSaveEntryMap(\"SLpre\"+DummyText3, DummyMap) built from TalPresetLISTS; loader does getLoadMap(\"SLpre_\"+pID) into PlayerDATABASE[..].TalPresetLISTS[1-PlayerStuff[1]]. The 1-PlayerStuff[1] index proves it is the OTHER preset.",
    "confidence": "confirmed"
  },
  "AttackLoadout_N": {
    "name": "attackLoadout",
    "family": true,
    "shape": "nested",
    "parse": "json",
    "desc": "Active attack/skill bar. Array of 6-slot rows (string talent ids or \"Null\").",
    "idx": {},
    "evidence": "N.js save writer (_customBlock_SaveTheGame region, the addSaveEntry* block): addSaveEntryJsonList(\"AttackLoadout\"+DummyText3, GA(\"AttackLoadout\")); also deep-copied into PlayerDATABASE as AttackLoadout by N.js _customBlock_add_player_to_database / PlayerDATABASE serializer.",
    "confidence": "confirmed"
  },
  "AttackLoadoutpre_N": {
    "name": "attackLoadoutPreset2",
    "family": true,
    "shape": "nested",
    "parse": "json",
    "desc": "Attack bar of the INACTIVE talent preset. Same 6-slot-row shape as AttackLoadout_N.",
    "idx": {},
    "evidence": "N.js save writer (_customBlock_SaveTheGame region, the addSaveEntry* block): DummyList2 = GA(\"TalPresetATTACKS\")[1 - PlayerStuff[1]] then addSaveEntryJsonList(\"AttackLoadoutpre\"+DummyText3, DummyList2). The 1-PlayerStuff[1] index proves it is the non-active preset.",
    "confidence": "confirmed"
  },
  "PlayerStuff_N": {
    "name": "playerStuff",
    "family": true,
    "shape": "number[]",
    "parse": "json",
    "desc": "Misc per-character scalars, 10 entries.",
    "idx": {
      "0": "Worship charge / 3D-printer-sample pool (drained into DNSM 3dSamplDN)",
      "1": "active talent preset index (0 or 1)"
    },
    "evidence": "idx0: N.js pushes Math.floor(PlayerStuff[0]) next to SkillStats(\"WorshipChargeMax\") in the Worship info panel, and a separate block does DNSM.3dSamplDN += PlayerDATABASE[p].PlayerStuff[0]; then zeroes it. idx1: used as TalPresetATTACKS[1-PlayerStuff[1]] and TalPresetLISTS[1-PlayerStuff[1]] in N.js save writer (_customBlock_SaveTheGame region, the addSaveEntry* block), and as Spelunk[20 + charIdx + 12*PlayerStuff[1]]. Indices 2..9 unknown.",
    "confidence": "confirmed"
  },
  "CharacterClass_N": {
    "name": "characterClass",
    "family": true,
    "shape": "number",
    "parse": "raw",
    "desc": "Class id. Indexes CustomLists.ClassNames. Negative/0 = Beginner-ish (client tests 0>CharacterClass for \"Beginners_get_free\" and skips insta-revive).",
    "idx": {},
    "evidence": "N.js save writer (_customBlock_SaveTheGame region, the addSaveEntry* block): addSaveEntry(\"CharacterClass\"+DummyText3, GA(\"CharacterClass\")). Rendered via CustomLists.h.ClassNames[_CharClass|0] in the character sheet draw code.",
    "confidence": "confirmed"
  },
  "CurrentMap_N": {
    "name": "currentMap",
    "family": true,
    "shape": "number",
    "parse": "raw",
    "desc": "Map/scene id the character is standing on. Client branches on ranges (e.g. <250 -> scene 95) and specific ids (216 = special HP-bar attach).",
    "idx": {},
    "evidence": "N.js save writer (_customBlock_SaveTheGame region, the addSaveEntry* block): addSaveEntry(\"CurrentMap\"+DummyText3, GA(\"CurrentMap\")); read ~2049 times, e.g. 20>CurrentMap||23<CurrentMap gates town-vs-tutorial logic.",
    "confidence": "confirmed"
  },
  "AFKtarget_N": {
    "name": "afkTarget",
    "family": true,
    "shape": "string",
    "parse": "raw",
    "desc": "What the character is AFKing on: a monster id (indexes MonsterDefinitionsGET) or a skill/monument name e.g. \"Wisdom_Monument\".",
    "idx": {},
    "evidence": "N.js save writer (_customBlock_SaveTheGame region, the addSaveEntry* block): addSaveEntryString(\"AFKtarget\"+DummyText3, GA(\"AFKtarget\")). Used as MonsterDefinitionsGET.h[AFKtarget].h.Defence in the Cooking efficiency panel.",
    "confidence": "confirmed"
  },
  "CharSAVED_N": {
    "name": "charSaveVersion",
    "family": true,
    "shape": "number",
    "parse": "raw",
    "desc": "Per-character save-format version. Written as the CONSTANT 5 and used as a load gate (e.g. >=5 to load SLpre, >=2 to load CSetEq). Not gameplay data.",
    "idx": {},
    "evidence": "N.js save writer (_customBlock_SaveTheGame region, the addSaveEntry* block): addSaveEntry(\"CharSAVED\"+DummyText3, 5) immediately before u.commitSave(). Loader: if(5<=u.getLoad(\"CharSAVED\"+DummyText3)) { ...SLpre... } and 2<=getLoad(\"CharSAVED_\"+pID) for CSetEq.",
    "confidence": "confirmed"
  },
  "PTimeAway_N": {
    "name": "timeAwaySeconds",
    "family": true,
    "shape": "number",
    "parse": "raw",
    "desc": "Timestamp/duration the character has been away, in SECONDS. Stored /1000 and re-multiplied by 1000 on load.",
    "idx": {},
    "evidence": "N.js save writer (_customBlock_SaveTheGame region, the addSaveEntry* block): addSaveEntry(\"PTimeAway\"+DummyText3, c.asNumber(GA(\"TimeAway\").h.Player)/1E3). Loader: PlayerDATABASE[p].PlayerAwayTime = 1E3*u.getLoad(\"PTimeAway_\"+pID).",
    "confidence": "confirmed"
  },
  "RespTime_N": {
    "name": "respawnTime",
    "family": true,
    "shape": "number",
    "parse": "raw",
    "desc": "Respawn countdown timer for the character.",
    "idx": {},
    "evidence": "N.js save writer (_customBlock_SaveTheGame region, the addSaveEntry* block): addSaveEntry(\"RespTime\"+DummyText3, GA(\"RespawnTime\")); runtime attr RespawnTime, mirrored into PlayerDATABASE as RespawnTime.",
    "confidence": "confirmed"
  },
  "Money_N": {
    "name": "money",
    "family": true,
    "shape": "number",
    "parse": "raw",
    "desc": "Coins held by this character (can exceed 2^53, stored as float).",
    "idx": {},
    "evidence": "N.js save writer (_customBlock_SaveTheGame region, the addSaveEntry* block): addSaveEntry(\"Money\"+DummyText3, GA(\"Money\")) and addSaveEntry(\"Money\"+DummyText, c.asNumber(PlayerDATABASE[g].Money)) for the other chars.",
    "confidence": "confirmed"
  },
  "MoneyBANK": {
    "name": "moneyBank",
    "family": false,
    "shape": "number",
    "parse": "raw",
    "desc": "Account-wide coins in the bank (Pigibank). Single value, not per-character.",
    "idx": {},
    "evidence": "N.js save writer (_customBlock_SaveTheGame region, the addSaveEntry* block): addSaveEntry(\"MoneyBANK\", GA(\"MoneyBANK\")). Read in the bank UI (GeneralINFO[29] cache + deposit/withdraw loop branching on 1E10<DummyNumber4).",
    "confidence": "confirmed"
  },
  "Exp0_N": {
    "name": "skillExp",
    "family": true,
    "shape": "number[]",
    "parse": "json",
    "desc": "Current EXP per track, same index layout as Lv0_N ([0]=class exp, [i+1]=skill i exp).",
    "idx": {
      "0": "class EXP"
    },
    "evidence": "N.js save writer (_customBlock_SaveTheGame region, the addSaveEntry* block): addSaveEntryList(\"Exp0\"+DummyText3, GA(\"Exp0\")). Parallel to Lv0; client tests 1<PlayerDATABASE[u].Exp0[0] to mean the char exists/has class exp. Index alignment with Lv0 is inferred from the parallel array usage, not individually verified per skill.",
    "confidence": "confirmed"
  },
  "ExpReq0_N": {
    "name": "skillExpReq",
    "family": true,
    "shape": "number[]",
    "parse": "json",
    "desc": "EXP required for next level, parallel to Exp0_N / Lv0_N.",
    "idx": {},
    "evidence": "N.js save writer (_customBlock_SaveTheGame region, the addSaveEntry* block): addSaveEntryList(\"ExpReq0\"+DummyText3, GA(\"ExpReq0\")). Same array length/order as Exp0.",
    "confidence": "confirmed"
  },
  "KLA_N": {
    "name": "killsLeftToAdvance",
    "family": true,
    "shape": "nested",
    "parse": "json",
    "desc": "Per-map kill counters (KillsLeft2Advance). Outer index = map id, inner = small number[] of remaining kills per tier/portal.",
    "idx": {},
    "evidence": "N.js save writer (_customBlock_SaveTheGame region, the addSaveEntry* block): addSaveEntryJsonList(\"KLA\"+DummyText3, GA(\"KillsLeft2Advance\")); loader getLoadJsonList(\"KLA_\"+pID) -> PlayerDATABASE[p].KillsLeft2Advance. Client seeds KillsLeft2Advance[151+b][0] from CustomLists.MapDetails[151+b][0][0], proving outer index = map id.",
    "confidence": "confirmed"
  },
  "AtkCD_N": {
    "name": "attackCooldowns",
    "family": true,
    "shape": "dict",
    "parse": "json",
    "desc": "Map talentId(string) -> remaining cooldown seconds.",
    "idx": {},
    "evidence": "N.js save writer (_customBlock_SaveTheGame region, the addSaveEntry* block): addSaveEntryMap(\"AtkCD\"+DummyText3, GA(\"AttackCooldowns\")). Loader gated on 3.5<=CSver: getLoadMap(\"AtkCD_\"+pID) -> PlayerDATABASE[p].AttackCooldowns.",
    "confidence": "confirmed"
  },
  "BuffsActive_N": {
    "name": "buffsActive",
    "family": true,
    "shape": "nested",
    "parse": "json",
    "desc": "Currently active buffs (from talents/potions). List entries; inner shape not verified.",
    "idx": {},
    "evidence": "N.js save writer (_customBlock_SaveTheGame region, the addSaveEntry* block): addSaveEntryList(\"BuffsActive\"+DummyText3, GA(\"BuffsActive\")); loader getLoadList(\"BuffsActive_\"+pID) -> PlayerDATABASE[p].BuffsActive. Runtime name confirmed; element layout NOT inspected.",
    "confidence": "confirmed"
  },
  "FoodCD_N": {
    "name": "foodCooldowns",
    "family": true,
    "shape": "number[]",
    "parse": "json",
    "desc": "Cooldown per food slot, parallel to the food bar (8 entries in sample).",
    "idx": {},
    "evidence": "N.js save writer (_customBlock_SaveTheGame region, the addSaveEntry* block): addSaveEntryList(\"FoodCD\"+DummyText3, GA(\"FoodCooldowns\")); mirrored to PlayerDATABASE as FoodCooldowns by N.js _customBlock_add_player_to_database / PlayerDATABASE serializer.",
    "confidence": "confirmed"
  },
  "FoodSlO_N": {
    "name": "foodSlotsOwned",
    "family": true,
    "shape": "number",
    "parse": "raw",
    "desc": "Number of unlocked food slots for this character.",
    "idx": {},
    "evidence": "N.js save writer (_customBlock_SaveTheGame region, the addSaveEntry* block): addSaveEntry(\"FoodSlO\"+DummyText3, GA(\"FoodSlotsOwned\")); runtime attr FoodSlotsOwned.",
    "confidence": "confirmed"
  },
  "InventoryOrder_N": {
    "name": "inventoryOrder",
    "family": true,
    "shape": "string[]",
    "parse": "json",
    "desc": "Item id in each inventory slot; \"Blank\" = empty. Parallel to ItemQTY_N.",
    "idx": {},
    "evidence": "N.js save writer (_customBlock_SaveTheGame region, the addSaveEntry* block): addSaveEntryList(\"InventoryOrder\"+DummyText3, GA(\"InventoryOrder\")) (and the PlayerDATABASE variant for other chars).",
    "confidence": "confirmed"
  },
  "ItemQTY_N": {
    "name": "itemQuantity",
    "family": true,
    "shape": "number[]",
    "parse": "json",
    "desc": "Stack size per inventory slot, index-parallel to InventoryOrder_N.",
    "idx": {},
    "evidence": "N.js save writer (_customBlock_SaveTheGame region, the addSaveEntry* block): addSaveEntryList(\"ItemQTY\"+DummyText3, GA(\"ItemQuantity\")); written adjacent to IMm_N/IMmLENGTH_N (the sparse per-slot ItemMap of item stats).",
    "confidence": "confirmed"
  },
  "LockedSlots_N": {
    "name": "lockedSlots",
    "family": true,
    "shape": "number[]",
    "parse": "json",
    "desc": "112-entry 0/1 flag per inventory slot marking it locked (protected from auto-loot/sort).",
    "idx": {},
    "evidence": "N.js save writer (_customBlock_SaveTheGame region, the addSaveEntry* block): addSaveEntryList(\"LockedSlots_\"+GetPlayersUsernames.indexOf(g), GA(\"LockedSlots\")). Init code: if(0==GA(\"LockedSlots\").length) for(d=0;112>d;)d++, GA(\"LockedSlots\").push(0) -> length 112, values 0. Mirrored to PlayerDATABASE as LockedSlots.",
    "confidence": "confirmed"
  },
  "InvBagsUsed_N": {
    "name": "invBagsUsed",
    "family": true,
    "shape": "dict",
    "parse": "json",
    "desc": "Map bagId(string) -> bag tier/size contributed. Which inventory bags this character has equipped. Values are sometimes numbers, sometimes numeric STRINGS in the same map.",
    "idx": {},
    "evidence": "N.js save writer (_customBlock_SaveTheGame region, the addSaveEntry* block): addSaveEntryMap(\"InvBagsUsed\"+DummyText3, GA(\"InvBagsUsed\")); runtime attr InvBagsUsed, mirrored to PlayerDATABASE.",
    "confidence": "confirmed"
  },
  "InvStorageUsed": {
    "name": "invStorageUsed",
    "family": false,
    "shape": "dict",
    "parse": "json",
    "desc": "ACCOUNT-WIDE (not per-character): map storage-chest slot index(string) -> unlocked row count for that chest tab.",
    "idx": {},
    "evidence": "N.js save writer (_customBlock_SaveTheGame region, the addSaveEntry* block): addSaveEntryMap(\"InvStorageUsed\", GA(\"InvStorageUsed\")) with NO character suffix. Migration code in the DoOnceREAL upgrade blocks does: for(d=0;12>d;) if hasOwnProperty(InvStorageUsed, String(30+b)) InvStorageUsed[String(30+b)]=9 -- keys are numeric strings, values small ints.",
    "confidence": "confirmed"
  },
  "MaxCarryCap_N": {
    "name": "maxCarryCap",
    "family": true,
    "shape": "dict",
    "parse": "json",
    "desc": "Map carry-category -> max stack size. Keys seen: Mining, Chopping, Foods, Quests, Statues, bCraft, Fishing, Bugs, Critters, Souls, fillerz.",
    "idx": {},
    "evidence": "N.js save writer (_customBlock_SaveTheGame region, the addSaveEntry* block): addSaveEntryMap(\"MaxCarryCap\"+DummyText3, GA(\"MaxCarryCap\")); deepCopyMap into PlayerDATABASE as MaxCarryCap.",
    "confidence": "confirmed"
  },
  "EquipOrder_N": {
    "name": "equipOrder",
    "family": true,
    "shape": "nested",
    "parse": "json",
    "desc": "Equipped item ids. Outer = 3 tabs: [0] equipment, [1] tools, [2] food. Inner = item id per slot, \"Blank\" = empty.",
    "idx": {
      "0": "equipment tab",
      "1": "tools tab",
      "2": "food tab"
    },
    "evidence": "N.js save writer (_customBlock_SaveTheGame region, the addSaveEntry* block): addSaveEntryList(\"EquipOrder\"+DummyText3, GA(\"EquipmentOrder\")). The 3-tab split is INFERRED from the sample (3 sub-arrays) plus the sibling EquipmentMap being saved as EMm0_N/EMm1_N (only tabs 0 and 1 carry per-item stat maps).",
    "confidence": "confirmed"
  },
  "EquipQTY_N": {
    "name": "equipQuantity",
    "family": true,
    "shape": "nested",
    "parse": "json",
    "desc": "Stack count per equip slot, index-parallel to EquipOrder_N (3 tabs).",
    "idx": {},
    "evidence": "N.js save writer (_customBlock_SaveTheGame region, the addSaveEntry* block): addSaveEntryList(\"EquipQTY\"+DummyText3, GA(\"EquipmentQuantity\")); mirrored to PlayerDATABASE as EquipmentQuantity.",
    "confidence": "confirmed"
  },
  "CardEquip_N": {
    "name": "cardEquip",
    "family": true,
    "shape": "string[]",
    "parse": "json",
    "desc": "12 equipped card ids; \"B\" = empty slot.",
    "idx": {},
    "evidence": "N.js save writer (_customBlock_SaveTheGame region, the addSaveEntry* block): addSaveEntryList(\"CardEquip\"+DummyText3, GA(\"Cards\")[2]). Loader: if CardEquip.length==0, for(d=0;12>d;) CardEquip.push(\"B\") -- proves 12 slots and \"B\" = blank.",
    "confidence": "confirmed"
  },
  "CardPreset_N": {
    "name": "cardPresets",
    "family": true,
    "shape": "nested",
    "parse": "json",
    "desc": "Saved card-loadout presets. Array of 12-slot card id rows, same \"B\"=empty convention as CardEquip_N.",
    "idx": {},
    "evidence": "N.js save writer (_customBlock_SaveTheGame region, the addSaveEntry* block): addSaveEntryJsonList(\"CardPreset_\"+GetPlayersUsernames.indexOf(g), ...); runtime attr CardPreset, deep-copied into PlayerDATABASE as CardPreset by N.js _customBlock_add_player_to_database / PlayerDATABASE serializer. Row shape matches CardEquip_N by inspection of the sample.",
    "confidence": "confirmed"
  },
  "CSetEq_N": {
    "name": "cardSetEquipped",
    "family": true,
    "shape": "dict",
    "parse": "json",
    "desc": "The single equipped card SET, as a map bonusText -> value, e.g. {\"{%_Skill_EXP_Gain\":30}.",
    "idx": {},
    "evidence": "N.js save writer (_customBlock_SaveTheGame region, the addSaveEntry* block): addSaveEntryMap(\"CSetEq\"+DummyText3, GA(\"Cards\")[3]). Loader gated on 2<=CharSAVED_N: getLoadMap(\"CSetEq_\"+pID). Migration code ensures Cards has 4 entries and gives each PlayerDATABASE entry an empty CSetEq map if missing.",
    "confidence": "confirmed"
  },
  "Cards0": {
    "name": "cardsCollected",
    "family": false,
    "shape": "dict",
    "parse": "json",
    "desc": "ACCOUNT-WIDE: map cardId -> lifetime kill/collect count for that card. Drives card star tier.",
    "idx": {},
    "evidence": "N.js save writer (_customBlock_SaveTheGame region, the addSaveEntry* block): addSaveEntryMap(\"Cards0\", GA(\"Cards\")[0]) with no char suffix; loader GA(\"Cards\")[0]=u.getLoadMap(\"Cards0\"). Semantics (kill count -> tier) is INFERRED from the huge counts in the sample; the tier formula was not traced.",
    "confidence": "inferred"
  },
  "Cards1": {
    "name": "itemsDiscovered",
    "family": false,
    "shape": "string[]",
    "parse": "json",
    "desc": "ACCOUNT-WIDE item-DISCOVERY LOG: every item id ever obtained, appended once, never removed. NOT card data despite living in the Cards[] container -- Cards[0] is the card collection, Cards[1] is this. Entries are ItemDefinitionsGET keys (\"MaxCapBagT1\", \"Grasslands1\", \"Trophy6\") plus a few synthetic tags the client pushes directly (\"Mega-Rare_Drop\", \"Rare_Drop\", \"ResetCompleted\"). This is what the Tome's \"unique items found\" counts.",
    "idx": {
      "membership": "Push-on-first-acquire, guarded by D.contains. Items in CustomLists.RANDOlist[103] are BLACKLISTED and never pushed; a migration also strips Quest47/Quest48/Trophy3 back out. So length is NOT 'every item in the game you own' -- it is the client's curated discovery set.",
      "length": "Tome stat: DNSM.TomeQTY[65] = Cards[1].length. ALSO a MULTIPLIER: floor(length/100) scales AlchBubbles W2/W4, A2/A4 and M2/M4 (see evidence -- it is a `*`, not an exponent).",
      "prefix counts": "TomeQTY[10] = count of entries starting \"Trophy\"; TomeQTY[21] = count starting \"Obol\"; TomeQTY[107] = count starting \"EquipmentNametag\". Prefix match is indexOf(...)==0, so \"TrophyX\" and \"Trophy\" both count.",
      "talent 650": "CalcTalentMAP[\"650\"] = how many of CustomLists.RANDOlist[82..86] (5 sets) are present in Cards[1]."
    },
    "evidence": "Writer/loader: addSaveEntryJsonList(\"Cards1\", GA(\"Cards\")[1]) / GA(\"Cards\")[1]=u.getLoadJsonList(\"Cards1\"). Push sites N.js ~17575-17579: quest-reward grants, then the InvBagsUsed and InvStorageUsed key loops do `D.contains(Cards[1],_DT)||(ItemDefinitionsGET has _DT && (D.contains(RANDOlist[103],_DT)||Cards[1].push(_DT)))`, then two 15-iteration loops push \"Weight\"+n / \"Line\"+n for each FamilyValuesMap.FishingToolkitOwned[0]/[1] entry. Tome read sites: N.js 8388-8389 (the Trophy/Obol/EquipmentNametag prefix scan -> TomeQTY[10]/[21]/[107]) and 8415 (TomeQTY[65]=length). Talent: 6157. Blacklist migration: 9637-9640.",
    "confidence": "confirmed"
  },
  "ObolEqMAP_N": {
    "name": "obolEquippedMapChar",
    "family": true,
    "shape": "dict",
    "parse": "json",
    "desc": "Sparse map slotIndex(string) -> obol stat object for this character’s equipped obols. Stat object keys: STR/AGI/WIS/LUK, UQ1txt/UQ1val (unique bonus), and a transient SuperFunItemDisplayType.",
    "idx": {},
    "evidence": "N.js save writer (_customBlock_SaveTheGame region, the addSaveEntry* block): addSaveEntrySparseList(\"ObolEqMAP\"+DummyText3, GA(\"ObolEquippedMap\")[0]) -- note index [0] = the character-level obol page.",
    "confidence": "confirmed"
  },
  "ObolEqMAPz1": {
    "name": "obolEquippedMapFamily",
    "family": false,
    "shape": "dict",
    "parse": "json",
    "desc": "ACCOUNT/FAMILY-wide obol page: sparse map slotIndex -> obol stat object. 24 slots.",
    "idx": {},
    "evidence": "N.js save writer (_customBlock_SaveTheGame region, the addSaveEntry* block): addSaveEntrySparseList(\"ObolEqMAPz1\", GA(\"ObolEquippedMap\")[1]); loader GA(\"ObolEquippedMap\")[1]=u.getLoadSparseList(\"ObolEqMAPz1\", 24) -- the literal 24 gives the slot count.",
    "confidence": "confirmed"
  },
  "ObolEqMAPz2": {
    "name": "obolEquippedMapz2",
    "family": false,
    "shape": "dict",
    "parse": "json",
    "desc": "Third obol page: sparse map slotIndex -> obol stat object. 3 slots. Empty in the sample save.",
    "idx": {},
    "evidence": "N.js save writer (_customBlock_SaveTheGame region, the addSaveEntry* block): addSaveEntrySparseList(\"ObolEqMAPz2\", GA(\"ObolEquippedMap\")[2]); loader GA(\"ObolEquippedMap\")[2]=u.getLoadSparseList(\"ObolEqMAPz2\", 3) -- literal 3 = slot count. Which page this is in the UI was not determined.",
    "confidence": "confirmed"
  },
  "ObolEqO0_N": {
    "name": "obolEquippedOrderChar",
    "family": true,
    "shape": "string[]",
    "parse": "json",
    "desc": "Obol item ids equipped on this character (21 slots in sample), e.g. ObolSilverPop / ObolGoldLuck / ObolPlatinumLuck. Index-parallel to ObolEqMAP_N.",
    "idx": {},
    "evidence": "N.js save writer (_customBlock_SaveTheGame region, the addSaveEntry* block): addSaveEntryList(\"ObolEqO0\"+DummyText3, GA(\"ObolEquippedOrder\")[0]); loader getLoadList(\"ObolEqO0_\"+pID) -> PlayerDATABASE[p].ObolEquippedOrder.",
    "confidence": "confirmed"
  },
  "ObolEqO1": {
    "name": "obolEquippedOrderFamily",
    "family": false,
    "shape": "string[]",
    "parse": "json",
    "desc": "Account/family obol page item ids (24 slots). \"ObolEmp\" = empty. Index-parallel to ObolEqMAPz1.",
    "idx": {},
    "evidence": "N.js save writer (_customBlock_SaveTheGame region, the addSaveEntry* block): addSaveEntryList(\"ObolEqO1\", GA(\"ObolEquippedOrder\")[1]) -- no char suffix. Pairs with ObolEqMAPz1 (also ObolEquippedMap[1]).",
    "confidence": "confirmed"
  },
  "ObolEqO2": {
    "name": "obolEquippedOrderz2",
    "family": false,
    "shape": "string[]",
    "parse": "json",
    "desc": "Third obol page item ids (3 slots, \"Blank\" in sample). Index-parallel to ObolEqMAPz2.",
    "idx": {},
    "evidence": "N.js save writer (_customBlock_SaveTheGame region, the addSaveEntry* block): addSaveEntryList(\"ObolEqO2\", GA(\"ObolEquippedOrder\")[2]). Pairs with ObolEqMAPz2 (ObolEquippedMap[2], length 3).",
    "confidence": "confirmed"
  },
  "ObolInvMAP_N": {
    "name": "obolInventoryMap",
    "family": false,
    "shape": "dict",
    "parse": "json",
    "desc": "NOT PER-CHARACTER. Suffix _0.._3 = the 4 obol INVENTORY tabs (rarity bins), not character index. Sparse map slotIndex -> obol stat object.",
    "idx": {},
    "evidence": "N.js save writer (_customBlock_SaveTheGame region, the addSaveEntry* block): four hardcoded calls addSaveEntrySparseList(\"ObolInvMAP_0\"..\"ObolInvMAP_3\", GA(\"ObolInventoryMap\")[0..3]) -- literal key names, no DummyText3 suffix. Loader: GA(\"ObolInventoryMap\")[i]=u.getLoadSparseList(\"ObolInvMAP_\"+i, GA(\"ObolInventoryOrder\")[i].length). The save also only contains _0.._3, never _4.._10.",
    "confidence": "confirmed"
  },
  "ObolInvOr": {
    "name": "obolInventoryOrder",
    "family": false,
    "shape": "nested",
    "parse": "json",
    "desc": "Account-wide obol inventory: 4 tabs, each a list of obol item ids. Index-parallel to ObolInvMAP_0.._3.",
    "idx": {},
    "evidence": "N.js save writer (_customBlock_SaveTheGame region, the addSaveEntry* block): addSaveEntryList(\"ObolInvOr\", GA(\"ObolInventoryOrder\")). Loader uses GA(\"ObolInventoryOrder\")[i].length as the length argument for getLoadSparseList(\"ObolInvMAP_\"+i,...), proving the 1:1 tab pairing.",
    "confidence": "confirmed"
  },
  "ObolInvOwn": {
    "name": "obolInventorySlotsOwned",
    "family": false,
    "shape": "number[]",
    "parse": "json",
    "desc": "Unlocked obol inventory slot count per tab. 4 entries, one per ObolInvMAP tab (sample [10,7,6,5]).",
    "idx": {},
    "evidence": "N.js save writer (_customBlock_SaveTheGame region, the addSaveEntry* block): addSaveEntryList(\"ObolInvOwn\", GA(\"ObolInventorySlotsOwned\")).",
    "confidence": "confirmed"
  },
  "POu_N": {
    "name": "postOfficeBoxUpgrades",
    "family": true,
    "shape": "number[]",
    "parse": "json",
    "desc": "Post office: points spent per box, one entry per PO box (36 in sample).",
    "idx": {},
    "evidence": "N.js save writer (_customBlock_SaveTheGame region, the addSaveEntry* block): builds DummyList by pushing GA(\"PostOfficeInfo\")[3][g][0] for each g, then addSaveEntryJsonList(\"POu\"+DummyText3, DNSM.CSdummyL6). Loader: for each B, PlayerDATABASE[p].PostOfficeInfo[B][0] = getLoadJsonList(\"POu_\"+pID)[B] -- confirms POu[i] maps to PostOfficeInfo[i][0].",
    "confidence": "confirmed"
  },
  "PVStatList_N": {
    "name": "statList",
    "family": true,
    "shape": "number[]",
    "parse": "json",
    "desc": "Cached total stats snapshot, 5 entries.",
    "idx": {
      "0": "total STR",
      "1": "total AGI",
      "2": "total WIS",
      "3": "total LUK",
      "4": "character level (= Lv0[0])"
    },
    "evidence": "N.js builds it verbatim: DummyList2.push(TotalStats(\"STR\")), push(TotalStats(\"AGI\")), push(TotalStats(\"WIS\")), push(TotalStats(\"LUK\")), push(GA(\"Lv0\")[0]); PersonalValuesMap.h.StatList = DummyList2. Saved by the PersonalValuesMap loop in N.js save writer (_customBlock_SaveTheGame region, the addSaveEntry* block) as addSaveEntryList(\"PV\"+key+DummyText3, ...). Anti-cheat also flags 1E9<StatList[0] and [1].",
    "confidence": "confirmed"
  },
  "PVtStarSign_N": {
    "name": "starSignsEquipped",
    "family": true,
    "shape": "string",
    "parse": "csv",
    "desc": "Comma-separated equipped star sign ids with a TRAILING comma, e.g. \"61,63,51,\". Ids index the ka.StarSigns() table.",
    "idx": {},
    "evidence": "PersonalValuesMap save loop in N.js save writer (_customBlock_SaveTheGame region, the addSaveEntry* block) special-cases key \"StarSign\": addSaveEntryString(\"PVt\"+key+DummyText3, \"\"+h.string(PersonalValuesMap.h[key])). Loader gated on 4<=CSver: getLoadString(\"PVt\"+key+\"_\"+pID). ANCHOR VERIFIED: ka.StarSigns()[61] === [\"Artifosho\",\"+15%_Artifact_Find\",\"Chance\",\"(Multiplicative)\"]; table has 94 entries. Also [63]=C._Shanti_Minor, [51]=The_Bulwark.",
    "confidence": "confirmed"
  },
  "PVGender_N": {
    "name": "gender",
    "family": true,
    "shape": "number",
    "parse": "raw",
    "desc": "Character gender flag (0/1). From PersonalValuesMap.Gender.",
    "idx": {},
    "evidence": "Saved by the generic branch of the PersonalValuesMap loop in N.js save writer (_customBlock_SaveTheGame region, the addSaveEntry* block): addSaveEntry(\"PV\"+key+DummyText3, c.asNumber(PersonalValuesMap.h[key])). Key name Gender -> PVGender_N is mechanical. The 0/1 meaning is INFERRED from the value domain, not traced to the sprite code.",
    "confidence": "inferred"
  },
  "PVInstaRevives_N": {
    "name": "instaRevives",
    "family": true,
    "shape": "number",
    "parse": "raw",
    "desc": "Count of instant-revive charges held. Consumed on death.",
    "idx": {},
    "evidence": "PersonalValuesMap loop in N.js save writer (_customBlock_SaveTheGame region, the addSaveEntry* block) (generic numeric branch). _event_DyingButtons reads .5>c.asNumber(PersonalValuesMap.h.InstaRevives) to decide whether to show the revive button, and on use does InstaRevives = Math.max(Math.round(InstaRevives-1),0).",
    "confidence": "confirmed"
  },
  "PVMinigamePlays_N": {
    "name": "minigamePlays",
    "family": true,
    "shape": "number",
    "parse": "raw",
    "desc": "Remaining (or used) minigame attempts for this character. From PersonalValuesMap.MinigamePlays.",
    "idx": {},
    "evidence": "Saved by the generic numeric branch of the PersonalValuesMap loop in N.js save writer (_customBlock_SaveTheGame region, the addSaveEntry* block); key name is MinigamePlays. Whether it counts remaining plays or plays used was NOT determined.",
    "confidence": "inferred"
  },
  "PVFishingSpotIndex_N": {
    "name": "fishingSpotIndex",
    "family": true,
    "shape": "number",
    "parse": "raw",
    "desc": "Which fishing spot on the current map the character is fishing. From PersonalValuesMap.FishingSpotIndex.",
    "idx": {},
    "evidence": "Saved by the generic numeric branch of the PersonalValuesMap loop in N.js save writer (_customBlock_SaveTheGame region, the addSaveEntry* block); key name FishingSpotIndex. Meaning INFERRED from the key name; the fishing spot lookup was not traced.",
    "confidence": "inferred"
  },
  "PVFishingToolkit_N": {
    "name": "fishingToolkit",
    "family": true,
    "shape": "number[]",
    "parse": "json",
    "desc": "Fishing toolkit state, 2 entries. From PersonalValuesMap.FishingToolkit.",
    "idx": {},
    "evidence": "PersonalValuesMap loop in N.js save writer (_customBlock_SaveTheGame region, the addSaveEntry* block) special-cases FishingToolkit/StatList/Fillerz to addSaveEntryList (i.e. it is a LIST, not a scalar); loader getLoadList(\"PV\"+key+\"_\"+pID). Element meanings UNKNOWN.",
    "confidence": "inferred"
  },
  "Prayers_N": {
    "name": "prayersActive",
    "family": true,
    "shape": "number[]",
    "parse": "json",
    "desc": "12 equipped prayer slots; -1 = empty, otherwise a prayer id indexing PrayOwned.",
    "idx": {},
    "evidence": "N.js save writer (_customBlock_SaveTheGame region, the addSaveEntry* block): addSaveEntryJsonList(\"Prayers\"+DummyText3, GA(\"PrayersActive\")). Sample is 12x -1. The 12-slot count and -1 sentinel are from the sample; the runtime attr name PrayersActive is confirmed (also mirrored into PlayerDATABASE as Prayers by N.js _customBlock_add_player_to_database / PlayerDATABASE serializer).",
    "confidence": "confirmed"
  },
  "PrayOwned": {
    "name": "prayersUnlocked",
    "family": false,
    "shape": "number[]",
    "parse": "json",
    "desc": "ACCOUNT-WIDE: prayer level per prayer id (25 entries, 0 = not unlocked).",
    "idx": {},
    "evidence": "N.js save writer (_customBlock_SaveTheGame region, the addSaveEntry* block): addSaveEntryJsonList(\"PrayOwned\", GA(\"PrayersUnlocked\")) with no char suffix; loader gated on 6<=CSver: GA(\"PrayersUnlocked\")=u.getLoadJsonList(\"PrayOwned\").",
    "confidence": "confirmed"
  },
  "PldTraps_N": {
    "name": "placedTraps",
    "family": true,
    "shape": "nested",
    "parse": "json",
    "desc": "Traps this character has placed. Array of 10-element rows.",
    "idx": {
      "0": "trap/map slot id",
      "3": "critter id being trapped (e.g. \"Critter9\")"
    },
    "evidence": "N.js save writer (_customBlock_SaveTheGame region, the addSaveEntry* block): addSaveEntryJsonList(\"PldTraps\"+DummyText3, GA(\"PlacedTraps\")); runtime attr PlacedTraps, mirrored into PlayerDATABASE as PldTraps by N.js _customBlock_add_player_to_database / PlayerDATABASE serializer. The row shape (10 cols) is from the sample; only the string column (index 3, a Critter id) is self-evidently identified. Other columns (timers/qty) NOT traced -- treat idx as tentative.",
    "confidence": "inferred"
  },
  "StatueLevels_N": {
    "name": "statueLevels",
    "family": true,
    "shape": "nested",
    "parse": "json",
    "desc": "Per-character statue progress. One row per statue: [level, progressExp].",
    "idx": {
      "0": "statue level",
      "1": "accumulated statue EXP toward next level"
    },
    "evidence": "N.js save writer (_customBlock_SaveTheGame region, the addSaveEntry* block): addSaveEntryJsonList(\"StatueLevels\"+DummyText3, GA(\"StatueLevels\")) plus the PlayerDATABASE variant for other chars. The [level, exp] pair split is INFERRED from the sample shape (small int + large float); the level-up formula was not traced. NOTE the account-wide statue TYPE/gold flag lives in a separate key StuG (GA(\"StatueG\")), which is outside this scope.",
    "confidence": "inferred"
  },
  "StarSg": {
    "name": "starSignsUnlocked",
    "family": false,
    "shape": "dict",
    "parse": "json",
    "desc": "ACCOUNT-WIDE: map star sign NAME -> \"1\"/1 when unlocked. Keyed by NAME (e.g. \"The_Buff_Guy\", \"Chronus_Cosmos\"), NOT by the numeric id used in PVtStarSign_N. Values are inconsistently strings or numbers.",
    "idx": {},
    "evidence": "N.js save writer (_customBlock_SaveTheGame region, the addSaveEntry* block): addSaveEntryMap(\"StarSg\", GA(\"StarSignsUnlocked\")); loader GA(\"StarSignsUnlocked\")=u.getLoadMap(\"StarSg\"). Names correspond to column 0 of ka.StarSigns(). Related account key SSprog (StarSignProg) is outside this scope.",
    "confidence": "confirmed"
  },
  "NPCdialogue_N": {
    "name": "npcDialogue",
    "family": true,
    "shape": "dict",
    "parse": "json",
    "desc": "Map NPC name -> dialogue progress index. 9999 = fully exhausted/done.",
    "idx": {},
    "evidence": "N.js save writer (_customBlock_SaveTheGame region, the addSaveEntry* block): addSaveEntryMap(\"NPCdialogue\"+DummyText3, GA(\"NPCdialogue\")); loader getLoadMap(\"NPCdialogue_\"+pID) -> PlayerDATABASE[p].NPCdialogue. The 9999 sentinel is from the sample, not traced in code.",
    "confidence": "confirmed"
  },
  "QuestComplete_N": {
    "name": "questComplete",
    "family": true,
    "shape": "dict",
    "parse": "json",
    "desc": "Map questId -> completion flag. 1 = complete, -1 = not complete/not started.",
    "idx": {},
    "evidence": "N.js save writer (_customBlock_SaveTheGame region, the addSaveEntry* block): addSaveEntryMap(\"QuestComplete\"+DummyText3, GA(\"QuestComplete\")); deepCopyMap into PlayerDATABASE as QuestComplete. The 1/-1 encoding is from the sample.",
    "confidence": "confirmed"
  },
  "QuestStatus_N": {
    "name": "questStatus",
    "family": true,
    "shape": "dict",
    "parse": "json",
    "desc": "Map questId -> array of per-objective counters, e.g. {\"TP_Pete1\":[\"0\",\"200\"]}. Values mix numbers and numeric strings.",
    "idx": {},
    "evidence": "N.js save writer (_customBlock_SaveTheGame region, the addSaveEntry* block): addSaveEntryMap(\"QuestStatus\"+DummyText3, GA(\"QuestStatus\")); deepCopyMap into PlayerDATABASE as QuestStatus.",
    "confidence": "confirmed"
  },
  "QuestHm_N": {
    "name": "questHelperMenu",
    "family": true,
    "shape": "nested",
    "parse": "json",
    "desc": "PINNED-QUEST TRACKER for this character: the quests shown in the on-screen helper overlay (drawn only when OptionsList[9]==1). One element per pinned quest. Per character -- each character pins their own; the sample has [] for char 0 and 3 pinned quests for char 1.",
    "idx": {
      "[q][0]": "Quest id, e.g. \"Djonnut2\". Resolved via CustomLists.SceneNPCquestOrder.indexOf(id) -> CustomLists.SceneNPCquestInfo[i], which yields [displayName, npcKey, ?, questIdx].",
      "[q][3j+1]": "Requirement j's LABEL. For item-collect quests (DialogueDefGET[npc][1][questIdx][0]==1) this is an ITEM ID and is rendered as ItemDefinitionsGET[id].displayName; otherwise a raw text label like \"Moonmen_Defeated:\".",
      "[q][3j+2]": "Requirement j's CURRENT progress. DERIVED, not authoritative: the draw loop OVERWRITES it every frame -- from _ItemsOwnedMap[itemId] for type-1 quests, or from QuestStatus[questId][j] for type-4. A stale save value is expected; do not trust it as state.",
      "[q][3j+3]": "Requirement j's GOAL. The label turns green when [3j+2] >= [3j+3].",
      "count": "Requirement count = Math.round((element.length - 1) / 3). Element length is therefore always 1 + 3*reqs (4, 7, 10, ...)."
    },
    "evidence": "Writer: addSaveEntryList(\"QuestHm\"+DummyText3, GA(\"QuestHelperMenu\")); deep-copied into PlayerDATABASE. Layout read from the helper-overlay draw block N.js 5876-5890: DummyList3 = SceneNPCquestInfo[SceneNPCquestOrder.indexOf(q[i][0])]; then `for j < Math.round((QHM[i].length-1)/3)` with an inner `for l<3` reading QHM[i][3*j+(l+1)] -- l==0 draws the label (item displayName for type-1), l==1 draws NotateNumber(cur)+\"_/_\" and compares against QHM[i][3*j+3], l==2 draws the goal. The same block writes QHM[i][3*j+2] from _ItemsOwnedMap / QuestStatus, which is what makes [3j+2] a derived cache. Add/remove: _customBlock_RemoveQuestFromHelper, called from the quest menu (N.js ~4481, ~4497).",
    "confidence": "confirmed"
  }
};
