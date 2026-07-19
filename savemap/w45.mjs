// map_w45.mjs — World 4/5 savegame key registry.
// GROUND TRUTH: /Users/doe/Projects/Games/IdleOn/N.js (decompiled client).
// Verified against /Users/doe/Projects/Games/IdleOn/savegame.json.
// confidence: "confirmed" = read in N.js, cite fn. "inferred" = plausible, not proven. "unknown" = honest no-idea.

export default {
  // ─────────────────────────────────────────── COOKING ───────────────────────────────────────────
  "Cooking": {
    name: "cooking",
    family: false,
    shape: "array2d",           // 10 rows (kitchens) x 10-11 cols
    parse: "json",
    desc: "Cooking kitchens. One row per kitchen (10). Fields hold the kitchen's current cooking/upgrade state.",
    idx: {
      "[k][0]": "kitchen unlocked/status flag. CONFIRMED-as-gate: `0 != Cooking[k][0]` is the 'kitchen exists' test in TalentCalc(-7). Exact semantics of the value (2 in sample) not established.",
      "[k][6]": "one of three per-kitchen values summed into the Lab jewel-114 'Cooking' tally (TalentCalc(-7): CalcTalentDN2 += Cooking[k][6] + Cooking[k][7] + ...). inferred: fire/ladle/spice upgrade LEVEL.",
      "[k][7]": "second of the three summed values. inferred: second kitchen upgrade level.",
      "[k][8]": "third summed value (TalentCalc(-7) second loop reads Cooking[k][8] alone). inferred: third kitchen upgrade level.",
      "[k][1..5]": "unknown. Sample: [1]=43 constant across kitchens; [2..5] are meal indices or -1 (=idle). inferred: currently-cooking meal id per speed/luck slot.",
    },
    evidence: "N.js _customBlock_ActionBlock/TalentCalc(-7) at flat~4425479: `if(0<LabMFbonuses['114']){for(g=0;10>g;) if(0!=getGameAttribute('Cooking')[g][0]) CalcTalentDN2 += Cooking[g][6]+Cooking[g][7]+...` — proves 10 kitchens and that [0] gates existence.",
    confidence: "inferred",
  },

  "CookMaster": {
    name: "cookMaster",
    family: false,
    shape: "nested",            // [ [100 ints], [30 nums], [6 ints], [10 ints] ]
    parse: "json",
    desc: "Cooking Mastery / Ribbon shelf + rank progress.",
    idx: {
      "[0]": "CONFIRMED: per-meal RIBBON tier, indexed by the same meal index as Meals[0]. Drawn as `钥_<CookMaster[0][mealIdx]>` when Summoning('RibbonShelfUnlocked')==1 and Meals[0][mealIdx]>0. Length 100 (74 meals used).",
      "[1][0]": "CONFIRMED: cooking-mastery RANK. Compared against Summoning2('RankREQcook', d, 0) in the DoOnceREAL=370.1 migration, which resets it to 2 on failure.",
      "[1][1]": "CONFIRMED (as co-reset): rank progress/XP. Migration sets CookMaster[1][1]=0 alongside the rank reset. Sample 296353093.47 = an accumulator.",
      "[1][2..29]": "unknown.",
      "[2]": "CONFIRMED: 6 per-rank claim flags. Same migration zeroes CookMaster[2][d] for d in 0..5 when the rank check fails; drawn per-row next to RandoListo2[9][e].",
      "[3]": "unknown. All zeros in sample.",
    },
    evidence: "N.js DoOnceREAL=370.1 migration (flat~ 'RankREQcook') writes CookMaster[1][0], [1][1], [2][d]; ActorEvents draw loop reads CookMaster[0][mealIdx] gated on RibbonShelfUnlocked.",
    confidence: "confirmed",
  },

  "Meals": {
    name: "meals",
    family: false,
    shape: "array2d",           // 4 rows x 100 (74 meals in use)
    parse: "json",
    desc: "Cooking meals: levels, progress, meal stock, spice stock.",
    idx: {
      "[0]": "CONFIRMED: MEAL LEVEL per meal. `_customBlock_TalentCalc(-6)` loops `for(f=0;74>f;)` building MealBonusesS from Meals[0][g] * MealINFO[g][2]. 74 meals.",
      "[1]": "CONFIRMED-as-numeric: per-meal accumulator, clamped to >=0 by the DoOnceREAL=85.5 migration (`0<Meals[1][b] || Meals[1][b]=0`). inferred: progress toward next meal level.",
      "[2]": "CONFIRMED: meal ITEM QUANTITY owned. Cost-deduct path: `if('Meal'==d.substring(0,4)) Meals[2][Number(d.substring(4))] -= b`.",
      "[3]": "CONFIRMED: SPICE quantity owned. Cost-deduct path: `if('Spice'==d.substring(0,5)) Meals[3][Number(d.substring(5))] -= b`.",
    },
    evidence: "N.js _customBlock_TalentCalc(-6) (MealBonusesS builder) + the generic cost-deduct block that pattern-matches 'MealN'/'SpiceN' strings.",
    confidence: "confirmed",
  },

  "Ribbon": {
    name: "ribbon",
    family: false,
    shape: "array",             // flat list, padded so [28+mealIdx] maps to meal mealIdx (0..73)
    parse: "json",
    desc: "Cooking meal RIBBON ranks. Padded to MealINFO.length+28 so index [28+mealIdx] is the ribbon rank of meal mealIdx.",
    idx: {
      "[28+mealIdx]": "CONFIRMED: ribbon rank of meal `mealIdx`. Read as `Summoning('RibbonBonus', Ribbon[Math.round(28+g)], 0)` inside the MealBonusesS builder (N.js:6214). The padding loop `for(;Ribbon.length-28<MealINFO.length;)Ribbon.push(0)` (N.js:9438) guarantees the 1:1 offset. Slots [0..27] are earlier ribbon systems.",
    },
    evidence: "N.js MealBonusesS builder at flat~6214 multiplies each meal bonus by Summoning('RibbonBonus', Ribbon[28+g]); pad loop at ~9438. Saved via addSaveEntryList('Ribbon').",
    confidence: "confirmed",
  },

  // ─────────────────────────────────────────── PETS / BREEDING ───────────────────────────────────────────
  "Pets": {
    name: "pets",
    family: false,
    shape: "array2d",           // rows of [petName, n, power, n]
    parse: "json",
    desc: "Pets currently in the Fenceyard (unassigned pool).",
    idx: {
      "[i][0]": "CONFIRMED-as-key: pet species name string (e.g. 'ram','w4b2'), matching PetStats[w][m][0].",
      "[i][2]": "CONFIRMED: pet POWER. `for(g<Pets.length) if(Pets[g][2] > DummyNumber) DummyNumber = Pets[g][2]` -> DNSM.TomeQTY[46] = strongest pet power (max over Pets and PetsStored).",
      "[i][1]": "unknown. Always 4 in sample. inferred: genes/rarity tier or species-slot count.",
      "[i][3]": "unknown. Always 0 in sample.",
    },
    evidence: "N.js TomeQTY[46] builder iterates Pets and PetsStored taking max of [2].",
    confidence: "inferred",
  },

  "PetsStored": {
    name: "petsStored",
    family: false,
    shape: "array2d",           // rows of [petName, territoryIdxString, power, n]
    parse: "json",
    desc: "Pets assigned out of the Fenceyard (territories / storage). 'none' rows are empty slots.",
    idx: {
      "[i][0]": "CONFIRMED-as-key: pet species name, or 'none' for an empty slot.",
      "[i][1]": "inferred: territory index, stored as a STRING (e.g. \"14\"). Rests on: it is a string only on occupied rows (0 on 'none' rows) and its range matches territory count. NOT proven in N.js.",
      "[i][2]": "CONFIRMED: pet POWER — same max-scan as Pets ([g][2] -> TomeQTY[46]). Also PetsStored[0][2] feeds GetTalentNumber(1,365)*getLOG(PetsStored[0][2]).",
      "[i][3]": "unknown.",
    },
    evidence: "N.js TomeQTY[46] builder; talent 365 bonus reads getLOG(PetsStored[0][2]).",
    confidence: "inferred",
  },

  "Breeding": {
    name: "breeding",
    family: false,
    shape: "nested",            // 31 rows, mixed lengths. Rows sized 17/17/18/16 == PetStats world sizes.
    parse: "json",
    desc: "Breeding: eggs, species discovered, pet upgrades, genetics, per-world pet gene levels and SHINY xp.",
    idx: {
      "0": "CONFIRMED-as-eggs: egg nest, 20 slots. `0==Breeding[0][b]` = empty slot; nest capacity = round(3 + PetUpgBONUS(2) + GemItemsPurchased[119] + Tasks[2][3][2]). Values are egg rarity. Breeding[0][0] also drives GiveBreedEXP (`pow(1.85, Breeding[0][0])`) and 3rdMulti.",
      "1": "CONFIRMED: species DISCOVERED count per world, 4 entries. DoOnceREAL<97 migration clamps `Breeding[1][w] > PetStats[w].length -> = PetStats[w].length`. Sample [17,17,18,16] == PetStats world sizes (all found). [1][4..7] unknown.",
      "2": "CONFIRMED: PET UPGRADE levels, 13 entries. `_customBlock_Breeding('PetUpgBONUS','0',e,0)` returns per-upgrade functions of Breeding[2][e]; 'PetUpgMaxLV' clamps them to PetUpgradeINFO[e][8]; 'PetUpgCostREAL' uses PetUpgradeINFO[e][4+2f] * (1+Breeding[2][e]) * PetUpgradeINFO[e][2f+5]^Breeding[2][e].",
      "3": "CONFIRMED: GENETICS currency, 9 entries indexed by type. Drop handler: `if(0==DropType.indexOf('Genetic')) Breeding[3][Number(DropType.charAt(7))] += qty`. Breeding[3][8] is the one AutoUseAllEggies adds GeneticsPerTrashPet to.",
      "4..7": "CONFIRMED: per-world (w=0..3) PET GENE level per species. `_customBlock_Breeding('1stMulti','0',w,pet)` = 1 + ceil(100*pow(Breeding[4+w][pet]/10, 1.9))/100. Also 'GeneticCost' reads Breeding[w+4][pet].",
      "8..12": "unknown / unused. Each is [0] in the sample.",
      "13..16": "CONFIRMED: per-world (w=0..3) SECOND pet multiplier progress per species. `'2ndMulti'` = GenINFO[53][0]==1 ? 1 + ln(max(1, pow(Breeding[w+13][pet]+1, 0.725))) : 1. (GenINFO[53][0] is a Lab/Arena gate on ActorEvents_548.)",
      "17..21": "unknown / unused. Each is [0] in the sample.",
      "22..25": "CONFIRMED: per-world (w=0..3) SHINY XP (days) per species. Drives `SpecialPassives('Lv',w,pet)`: lv=1; for b in 0..18 if Breeding[w+22][pet] > floor((1+(b+1)^1.6)*1.7^(b+1)) then lv=b+2. ShinyBonusS only counts a pet when Breeding[22+w][pet] > 0.",
      "26..30": "unknown / unused. Each is [0] in the sample.",
    },
    evidence: "N.js _customBlock_Breeding: 'PetUpgBONUS'/'PetUpgMaxLV'/'PetUpgCostREAL' (row 2), 'SpecialPassives' (rows 22-25), '1stMulti'/'GeneticCost' (rows 4-7), '2ndMulti' (rows 13-16), 'ShinyBonusS' (rows 22-25); DoOnceREAL<97 migration (row 1); Genetic drop handler (row 3). See FORMULAS.breedingShinyBonusS.",
    confidence: "confirmed",
  },

  // ─────────────────────────────────────────── LAB ───────────────────────────────────────────
  "Lab": {
    name: "lab",
    family: false,
    shape: "nested",            // 17 rows
    parse: "json",
    desc: "Laboratory: player console positions, per-player chip loadouts, jewels owned/placed, purchases.",
    idx: {
      "0": "CONFIRMED: FLAT [x,y] pairs of each player's console position. `_customBlock_Labb('Player','X',e,0)` = Lab[0][2*e]; `('Player','Y',e,0)` = Lab[0][1+2*e]. 24 entries = 12 player slots.",
      "1..12": "CONFIRMED: per-player CHIP loadout, 7 slots each. Lab[1+e] is player e's chips; -1 = empty. `D.contains(Lab[1+e], 6)` counts chip 6 for the line-width bonus (`count * ChipDesc[6][11]`).",
      "13": "CONFIRMED-as-chip-repo-state: 3 entries, compared against GenINFO[102][i] in the chip/jewel repo purchase UI (`Lab[13][i] == GenINFO[102][i]` disables the buy). inferred: current chip-repo shop stock/offer ids.",
      "14": "CONFIRMED: JEWEL OWNED flags, 30 entries (1 = owned). `1 == Lab[14][jewelIdx]` gates the jewel node in the connection graph; `Lab[14][5]` gates the Spelunker-Obol 1.25x line-width proximity bonus; `Lab[14][1]` gates a storage behaviour. Padded to 25+ by DoOnceREAL=203.3.",
      "15": "CONFIRMED-as-summed: 25 entries, summed with `max(v,0)` into DNSM.TomeQTY (jewel counter). Values -1..7. inferred: jewel -> player-slot assignment (-1 = unplaced).",
      "16": "CONFIRMED-as-flag: 4 entries. `1 == Lab[16][1]` gates a storage-chest behaviour in ActorEvents_232. inferred: lab QoL toggles/purchases.",
    },
    evidence: "N.js _customBlock_Labb ('Player','Dist'), _customBlock_MainframeBonus, ActorEvents_548 connection-graph builder. See FORMULAS.mainframeBonus14 for the full derivation.",
    confidence: "confirmed",
  },

  "Atoms": {
    name: "atoms",
    family: false,
    shape: "array",             // flat, 20 slots allocated
    parse: "raw",               // already an array in savegame.json (NOT a JSON string)
    desc: "Atom Collider: level of each atom.",
    idx: {
      "[i]": "CONFIRMED: LEVEL of atom i. Summed across Atoms.length into DNSM.TomeQTY[41]; clamped >=0 by DoOnceREAL=135.5; migration clamps `i>4 && Atoms[i]>13 -> 13`. Atoms[0] and Atoms[4] are also read as unlock gates (`.5 < Atoms[0]`, `.5 < Atoms[4]`).",
    },
    evidence: "N.js _customBlock_AtomCollider + TomeQTY[41] builder + DoOnceREAL migrations.",
    confidence: "confirmed",
    notes: "REFINES the brief: atom COUNT is not a hard 15 — `AtomCollider('AtomsAvailableAtAll') = round(11 + min(1,Windwalker.CompassBonus(47)) + min(1,CompassBonus(58)) + min(1,Minehead.BonusQTY(7)) + min(1,SushiStuff.RoG_BonusQTY(22)))` -> 11..15. The array itself is 20 long (padded). Level CAP is likewise not hardcoded 50: `AtomCollider('AtomMaxLv') = round(20 + 10*GamingStatType('SuperBitType',23,0) + Windwalker.CompassBonus(53) + 20*Summoning('EventShopOwned',28,0))`. The sample account's 50s are consistent with a *derived* cap of 50, not a constant.",
  },

  // ─────────────────────────────────────────── GAMING ───────────────────────────────────────────
  "Gaming": {
    name: "gaming",
    family: false,
    shape: "array",             // flat, mixed number|string, 20 slots
    parse: "raw",               // already an array in savegame.json
    desc: "Gaming (W5): bits, shop upgrade levels, DNA, acorns, sprout/letter state strings.",
    idx: {
      "0": "CONFIRMED: BITS currency. Cost-deduct: `if('Bits'==d) Gaming[0] -= b`. Also decremented directly when buying MutateUpgCosts.",
      "1": "CONFIRMED: gaming shop upgrade level, slot 0. `GamingStatType('FertilizerUpgCosts', 0, 0) = (1 + 3*Gaming[1] + Gaming[1]^2) * pow(min(1.25, max(1.13, 1+serverVar('GamingFertCostExpA')/1000)) + max(0, min(.15, .18*(Gaming[1]-50)/(Gaming[1]+100))), Gaming[1])`. inferred: this is the Fertilizer upgrade (name from the block's own label).",
      "2": "CONFIRMED: gaming shop upgrade level, slot 1. Cost = `(2 + 5*Gaming[2] + Gaming[2]^2) * 1.22^Gaming[2]`.",
      "3": "CONFIRMED: gaming shop upgrade level, slot 2. Cost = `Gaming[3]<11 ? (25*(Gaming[3]+1) + (Gaming[3]+1)^3) * pow(5+3.7*Gaming[3], Gaming[3]) : 9999 * 10^(39+2*Gaming[3])`.",
      "4": "CONFIRMED-as-count: number of drop rolls per sprout harvest (`for(n=0; n < Gaming[4];)` rolling `.32 * .61^n`). Also `Gaming[4] < 8` gates buying a new mutant. inferred: number of unlocked mutants/evolutions.",
      "5": "CONFIRMED-as-gate: `.5 < Gaming[5]` required to roll NewMutantChanceDEC. Sample 425070. inferred: DNA currency.",
      "6": "CONFIRMED: sprout/letter unlock STRING. Tested with `Gaming[6].indexOf(Number2Letter[n])` (n=0 gates a GemItemsPurchased[131] effect; n=8 gates rat-currency gain). Sample '0_abcdefgh'.",
      "7": "CONFIRMED: mutate-upgrade purchase COUNT. `Gaming[0] -= MutateUpgCosts; Gaming[7] += 1`.",
      "8": "CONFIRMED-as-passthrough: `DNSM.TomeQTY[64] = Gaming[8]` (a tracked lifetime stat). Exact meaning unknown.",
      "9": "CONFIRMED: ACORNS currency. `Gaming[9] >= GamingStatType('AcornShopCost', f, 0)` then `Gaming[9] = max(.1, Gaming[9] - cost)`.",
      "10": "unknown. Sample 5690.",
      "11": "CONFIRMED-as-10-char-string: right-padded with '_' to length 10 (`10 > Gaming[11].length && Gaming[11] += '_'`). Sample 'iiiijjiiii'. inferred: per-sprout-plot state, one char per plot.",
      "12": "CONFIRMED-as-string: reset to '' by the DoOnceREAL=152.5 migration (alongside Rift[2]). Content is a large packed unicode string in the sample. Meaning unknown.",
      "13": "CONFIRMED-as-numeric: DoOnceREAL=310.3 migration does `1E4 < Gaming[13] && Gaming[13] = 0`. Sample 47.05. Meaning unknown.",
      "14": "CONFIRMED: RAT currency. `Gaming[14] += GamingStatType('RatCurrencyGain',0,0) * (GenINFO[37]/3600)`, gated on Gaming[6] containing Number2Letter[8].",
      "15..19": "unknown. Zeros in sample.",
    },
    evidence: "N.js _customBlock_GamingStatType ('FertilizerUpgCosts','AcornShopCost','RatCurrencyGain','MutateUpgCosts'), the generic 'Bits' cost-deduct block, ActorEvents W5stuffzz handlers, DoOnceREAL 152.5/310.3 migrations.",
    confidence: "confirmed",
  },

  "GamingSprout": {
    name: "gamingSprout",
    family: false,
    shape: "array2d",           // ~34 rows; rows 0..24 = plots, rows 25+ = other state
    parse: "json",
    desc: "Gaming sprout plots plus trailing rows of non-plot gaming state.",
    idx: {
      "[p][0..5] for p<25": "CONFIRMED-as-plot: `[1]` is the watered/ready flag — the harvest path checks `1 != GamingSprout[f][1] && -.5 < GamingSprout[f][3]` then sets `GamingSprout[DRI][1] = 1`. `[4],[5]` are plot x,y screen coords (values 83..652 / 92..341). `[0]`, `[2]`, `[3]` semantics not established; `[3]` is -1 on live plots.",
      "25..33": "CONFIRMED-as-state-rows, NOT plots. e.g. `GamingSprout[25][0] = max(1, GamingSprout[25][0])` gated on GemItemsPurchased[131]; `GamingSprout[32][1]` is compared with OptionsListAccount[210]; `GamingSprout[33][1..3]` are zeroed together. Individual meanings unknown.",
    },
    evidence: "N.js ActorEvents W5stuffzz harvest/drop loop reads GamingSprout[f][1] and [3]; several direct writes to rows 25/32/33.",
    confidence: "inferred",
  },

  // ─────────────────────────────────────────── DIVINITY ───────────────────────────────────────────
  "Divinity": {
    name: "divinity",
    family: false,
    shape: "array",             // flat, 40 slots, mixed
    parse: "raw",               // already an array in savegame.json
    desc: "Divinity: per-character god links, divinity points, offering RNG, god ranks, particles.",
    idx: {
      "0..11": "CONFIRMED: per-character LINKED GOD id, indexed by player slot. `DivStyle[Divinity[GetPlayersUsernames.indexOf(UserInfo[0])]][0]` renders the player's god; `3 == Divinity[playerIdx]` and `5 == Divinity[playerIdx]` gate god-specific effects.",
      "12..23": "CONFIRMED-as-second-slot: set to -1 by the 'unlink' UI (`for(e=0;12>e;) if(GenINFO[83][e]==1) Divinity[12+e] = -1`), gated on `0 < Divinity[38]`. inferred: each character's SECOND (blessing/Godly Link) god id; -1 = none.",
      "24": "CONFIRMED: DIVINITY POINTS. `'Divinity_PTS' == GainsDisplayList[f][0] && (Divinity[24] += GainsDisplayList[f][1])`.",
      "25": "CONFIRMED-as-level: `max(0, Divinity[25]-10) * getbonus2(1,507,-1)` feeds a %-damage term. inferred: Divinity skill LEVEL (sample 22). NOT proven to be the skill level rather than a rank total.",
      "26": "CONFIRMED: offering RNG result A. Rolled each offering: `Divinity[26]=0; .24>rand() && Divinity[26]=1; .06>rand() && Divinity[26]=2`.",
      "27": "CONFIRMED: offering RNG result B. `Divinity[27]=3; .17>rand() && Divinity[27]=4; .035>rand() && Divinity[27]=5`.",
      "28..37": "unknown as a group. Sample [312,240,240,306,200,213,263,166,167,135] — 10 values matching the 10 gods. inferred: per-god RANK/blessing level. NOT confirmed in N.js.",
      "38": "CONFIRMED-as-gate: `0 < Divinity[38]` is required to perform the unlink action on Divinity[12+e]. inferred: unlink tokens/currency (sample 2).",
      "39": "CONFIRMED-as-currency: zeroed by the same migration that clamps Atoms; read as `DN4 = Divinity[39]` immediately alongside AtomCollider('AtomBubbleUpgCost', ...). inferred: PARTICLES (the Atom Collider currency).",
    },
    evidence: "N.js Divinity draw/click handlers, the Divinity_PTS gain hook, the offering roll block, and the Atoms-clamp migration.",
    confidence: "inferred",
  },

  // ─────────────────────────────────────────── ARCADE ───────────────────────────────────────────
  "ArcadeUpg": {
    name: "arcadeUpg",
    family: false,
    shape: "array",             // flat, one entry per ArcadeShopInfo row (70 in this build)
    parse: "json",
    desc: "Arcade (Gold Ball Shop) upgrade LEVELS, index-aligned to CustomLists.ArcadeShopInfo.",
    idx: {
      "[i]": "CONFIRMED: level of arcade upgrade i. Fed as the level argument to ArbitraryCode5Inputs. 101 == MAXED and additionally DOUBLES that upgrade's bonus. Array is padded to ArcadeShopInfo.length on load.",
      "32": "CONFIRMED: '+{%_Artifact_Find 50 100 decay % +{%_Chance -1' -> 50*L/(L+100) percent.",
      "66": "CONFIRMED: '+{%_Artifact_Find 60 100 decay % +{%_Chance 31' -> 60*L/(L+100) percent.",
      "49": "CONFIRMED: '+{%_Breedability_Rate 100 100 decay' — consumed by Breeding('BreedabilitySpdMulti') as `*(1 + ArcadeBonus(49)/100)`.",
      "13": "CONFIRMED: '+{%_Shiny_Chance 100 100 decay'.",
      "28": "CONFIRMED: '+{%_Cook_SPD_multi 40 100 decay'.",
      "29": "CONFIRMED: '+{%_Lab_EXP_gain 30 100 decay'.",
      "30": "CONFIRMED: '+{%_Breed_Mob_DMG 40 100 decay'.",
      "69": "CONFIRMED: '+{%_Cook_Mastery_EXP 100 100 decay'.",
    },
    evidence: "N.js _customBlock_ArcadeBonus reads getGameAttribute('ArcadeUpg')[d] as the level and CustomLists.ArcadeShopInfo[d] as the formula row; the loader pads ArcadeUpg to ArcadeShopInfo.length. See FORMULAS.arcadeBonus.",
    confidence: "confirmed",
  },

  "ArcUnclaim": {
    name: "arcUnclaim",
    family: false,
    shape: "map",               // itemName -> quantity
    parse: "json",
    desc: "Arcade rewards won but not yet claimed (inventory was full). Empty {} in the sample.",
    idx: {
      "<itemName>": "CONFIRMED: pending quantity of that item. In `_customBlock_givReward(d,b,'arcade')`, if the inventory has no 'Blank' slot the reward falls through to `ArcUnclaim[d] = round(ArcUnclaim[d] + b)` (or is set to b if absent).",
    },
    evidence: "N.js _customBlock_givReward: the 'arcade' branch writes to getGameAttribute('ArcUnclaim') when InventoryOrder contains no 'Blank'.",
    confidence: "confirmed",
  },

  // ─────────────────────────────────────────── MISC ───────────────────────────────────────────
  "KRbest": {
    name: "krBest",
    family: false,
    shape: "map",               // mobKey -> best kill count
    parse: "json",
    desc: "Killroy: best-ever kill count per monster, keyed by MapAFKtarget name.",
    idx: {
      "<mobKey>": "CONFIRMED: personal best Killroy kills for that mob. Written as `d=this._KillroyKills; e=MapAFKtarget[CurrentMap]; if(d > KRbest[e]) KRbest[e] = d`. Saved via `u.addSaveEntryMap('KRbest', ...)` — it is a MAP, not a list.",
    },
    evidence: "N.js Killroy end-of-wave handler + addSaveEntryMap('KRbest', ...). Read back in the quest/UI draw via KRbest[MapAFKtarget[MapName.indexOf(...)]].",
    confidence: "confirmed",
  },

  "Tess": {
    name: "tess",
    family: false,
    shape: "nested",            // [ [ "<n>_<m>", ... ], ... ]
    parse: "json",
    desc: "Tesseract (Arcane Cultivation). Tess[0] is a set-like list of unlocked '<id>_<tier>' tokens. NOTE: this is a World 7 system, included only because it was listed in scope.",
    idx: {
      "[0]": "CONFIRMED: list of unlocked token strings. Unlock path is `D.contains(Tess[0], '0_0') || Tess[0].push('0_0')` (and likewise '50_0'), gated on `1 == ArcaneType('TesseractArcanist',0,0)`. Membership-tested, never index-addressed.",
      "[1..]": "unknown. Not read by any getGameAttribute('Tess')[n] site other than [0].",
    },
    evidence: "N.js: only getGameAttribute('Tess')[0] is ever referenced (17 sites); all are D.contains/push on token strings.",
    confidence: "inferred",
  },
};

// ────────────────────────────────────────────────────────────────────────────────────────────────
// FORMULAS — the three high-value derivations, as portable JS.
// All three were traced end-to-end in N.js and (where possible) reproduced against savegame.json.
// ────────────────────────────────────────────────────────────────────────────────────────────────
export const FORMULAS = {

  // ══════════════════════════════════════════════════════════════════════════════════════════════
  // 1. ArcadeBonus(i)  — CONFIRMED, reproduces both known values exactly.
  //
  // N.js: p._customBlock_ArcadeBonus = function(d){
  //   var b = DNSM, e = CustomLists.ArcadeShopInfo[d|0];
  //   b.h.ArcadBonDL = e;
  //   DNSM.h.ArcadBonDNz = 1;
  //   101 == getGameAttribute("ArcadeUpg")[d|0] && (ArcadBonDNz = 2 * ArcadBonDNz);
  //   1   == m._customBlock_Companions(27)      && (ArcadBonDNz = 2 * ArcadBonDNz);
  //   return ArcadBonDNz * x._customBlock_ArbitraryCode5Inputs(
  //            String(ArcadBonDL[3]), Number(ArcadBonDL[1]), Number(ArcadBonDL[2]),
  //            Number(getGameAttribute("ArcadeUpg")[d|0]), 0, 0);
  // };
  //
  // Table (na.ArcadeShopInfo, a plain string-literal table) row layout, split on " ":
  //   [0] long label   [1] param A ("b")   [2] param B ("c")   [3] MODE
  //   [4] "%" or "_"   [5] short label     [6] icon sprite override index (-1 = use own index, capped 49). Cosmetic only.
  //
  // N.js: x._customBlock_ArbitraryCode5Inputs = function(a,b,c,f,g,h){
  //   return "add"      == a ? (0 != c ? ((b+c)/c + .5*(f-1)) / (b/c) * f * b : b*f)
  //        : "decay"    == a ? b*f/(f+c)
  //        : "bigBase"  == a ? b + c*f
  //        : "intervalAdd" == a ? b + Math.floor(f/c)
  //        : "reduce"   == a ? b - c*f
  //        : ... : 0;
  // };
  //
  // >>> The brief's "50*L/(100+L)*4" and "60*L/(100+L)*2" are CONFIRMED, but the *4 and *2 are NOT
  // >>> table constants. They are the two independent x2 multipliers:
  // >>>   x2 because ArcadeUpg[32] == 101 (maxed), and x2 because Companions(27) is owned.
  // >>>   ArcadeUpg[66] == 74 (not maxed) so it only gets the Companions x2.
  // >>> Companions(27) = CompanionDB[27][2] if owned else 0.
  // >>>   CompanionDB[27] = "reindeer 2.00x_Gold_Ball_Shop_Bonuses 1 -40 0 -33 500 150"
  // >>>   -> the Reindeer companion, field[2]==1. "Gold Ball Shop" IS the Arcade.
  //
  // VERIFIED: ArcadeUpg[32]=101 -> 50*101/(101+100) = 25.12437; *2(max) *2(reindeer) = 100.4975 %  ✓
  //           ArcadeUpg[66]= 74 -> 60* 74/( 74+100) = 25.51724;      *2(reindeer) =  51.0345  %  ✓
  //
  // Both are ADDITIVE-percent terms inside Sailing("BoatArtiMulti"):
  //   ... + (ArcadeBonus(32) + ArcadeBonus(66)) + ... all summed then /100.
  // ══════════════════════════════════════════════════════════════════════════════════════════════
  arcadeBonus: `
function arbitraryCode5Inputs(mode, b, c, f) {
  switch (mode) {
    case "add":             return c !== 0 ? ((b + c) / c + 0.5 * (f - 1)) / (b / c) * f * b : b * f;
    case "addLower":        return b + c * (f + 1);
    case "addDECAY":        return f <= 50000 ? b * f : b * Math.min(5e4, f) + (f - 5e4) / (15e4 + (f - 5e4)) * b * 5e4;
    case "decay":           return b * f / (f + c);
    case "decayLower":      return b * (f + 1) / (f + 1 + c) - b * f / (f + c);
    case "decayMulti":      return 1 + b * f / (f + c);
    case "decayMultiLower": return b * (f + 1) / (f + 1 + c) - b * f / (f + c);
    case "bigBase":         return b + c * f;
    case "bigBaseLower":    return c;
    case "intervalAdd":     return b + Math.floor(f / c);
    case "intervalAddLower":return Math.max(Math.floor((f + 1) / c), 0) - Math.max(Math.floor(f / c), 0);
    case "reduce":          return b - c * f;
    case "reduceLower":     return b - c * (f + 1);
    case "PtsSpentOnGuildBonus": return ((b + c) / c + 0.5 * (f - 1)) / (b / c) * f * b - c * f;
    default:                return 0;
  }
}

// ARCADE_SHOP_INFO[i] = row.split(" ") from na.ArcadeShopInfo() in N.js.
// row[1] = A, row[2] = B, row[3] = mode.
function arcadeBonus(i, ArcadeUpg, ARCADE_SHOP_INFO, hasReindeerCompanion) {
  const row   = ARCADE_SHOP_INFO[i];
  const level = Number(ArcadeUpg[i]);
  let mult = 1;
  if (level === 101) mult *= 2;            // 101 == maxed -> doubles this upgrade's bonus
  if (hasReindeerCompanion) mult *= 2;     // Companions(27) == 1 -> CompanionDB[27] "reindeer 2.00x_Gold_Ball_Shop_Bonuses"
  return mult * arbitraryCode5Inputs(String(row[3]), Number(row[1]), Number(row[2]), level);
}

// Artifact Find (both are additive % into Sailing("BoatArtiMulti")):
//   arcadeBonus(32) : row = "+{%_Artifact_Find 50 100 decay % +{%_Chance -1"  -> 50*L/(L+100)
//   arcadeBonus(66) : row = "+{%_Artifact_Find 60 100 decay % +{%_Chance 31"  -> 60*L/(L+100)
`,

  // ══════════════════════════════════════════════════════════════════════════════════════════════
  // 2. MainframeBonus(14) — "Artifact Attraction"
  //
  // >>> CORRECTION TO THE BRIEF, PART A: entry 14 is NOT in na.LabMainBonus().
  //     na.LabMainBonus() (N.js ~offset 13874042) returns only 14 rows, ids 0..13, ending at
  //     "13 1430 265 90 0 50 Viral_Connection ...". Row 13 ALSO has field[5]==50 — which is
  //     almost certainly where the brief's "entry 14 has field[5]=50" came from (off-by-one).
  //     Viral_Connection is a connection-RANGE bonus, not Artifact Find. Do not confuse them.
  //
  // >>> Where 14 actually lives (N.js, ActorEvents_548 constructor, flat ~9838978):
  //       for (var b=0; 4>b;) { var e=b++;
  //         CustomLists.LabMainBonus.length < 15+e
  //           && 1 == m._customBlock_Ninja("EmporiumBonus", Math.round(8+e), 0)
  //           && CustomLists.LabMainBonus.push(CustomLists.NinjaInfo[25+e]);
  //       }
  //     So ids 14,15,16,17 are APPENDED at runtime from NinjaInfo[25..28], each gated on the
  //     Jade Emporium (Ninja) EmporiumBonus 8..11 being purchased.
  //     EmporiumBonus 8 = "The_Artifact_Matrix 500 1 8 filler filler Extends_the_Laboratory_Event_
  //       Horizon,_adding_another_bonus_to_connect_to!_In_particular,_a_boost_to_Artifact_Find_Chance!"
  //     NinjaInfo[25] = "14 1530 105 90 0 50 Artifact_Attraction Artifact_find_chance_is_1.5x_higher!_
  //       If_you've_found_all_artifacts_at_max_rarity,_then_this_bonus_changes_to_1,000x_artifact_find_chance!"
  //
  //     Row layout (same as LabMainBonus): [0] id  [1] x  [2] y  [3] base connect range (90)
  //                                        [4] INACTIVE value (0)  [5] ACTIVE value (50)
  //                                        [6] name  [7] description
  //
  // >>> N.js: p._customBlock_MainframeBonus = function(d){
  //       if (d >= CustomLists.LabMainBonus.length && 99 > d) return 0;      // <-- 14 returns 0 flat
  //       var b = DNSM;                                                       //     if the Jade Emporium
  //       if (hasOwnProperty(b.h, "LabMFbonuses")) {                          //     upgrade isn't bought
  //         if (0 == D.mapCount(DNSM.h.LabMFbonuses))
  //           return 100 > d ? Number(LabMainBonus[d][4]) : 0;                // cache exists but empty -> inactive value
  //         if (hasOwnProperty(DNSM.h.LabMFbonuses.h, "YES"))
  //           return DNSM.h.LabMFbonuses.h[""+d];                             // cache warm -> return cached
  //         if (100 > d)
  //           return 1 == ActorEvents_548._GenINFO[92][d]                     // <-- THE GATE
  //                ? ( d==9  ? LabMainBonus[d][5] + MainframeBonus(113)
  //                  : d==0  ? (LabMainBonus[d][5] + MainframeBonus(101)) * Breeding("TotPetsFound","0",0,0)
  //                  : d==3  ? LabMainBonus[d][5] + MainframeBonus(107)
  //                  : d==11 ? LabMainBonus[d][5] + MainframeBonus(117)
  //                  : d==13 ? LabMainBonus[d][5]
  //                  : d==15 ? LabMainBonus[d][5] + MainframeBonus(118)
  //                  : d==17 ? LabMainBonus[d][5] + MainframeBonus(120)
  //                  : d==8  ? LabMainBonus[d][5] + MainframeBonus(119)/100
  //                  :         LabMainBonus[d][5] )                           // <-- 14 lands HERE
  //                : LabMainBonus[d][4];
  //         ... jewel branch for d >= 100 ...
  //       }
  //       return 100 > d ? Number(LabMainBonus[d][4]) : 0;
  //     };
  //
  //     d=14 matches none of {0,3,8,9,11,13,15,17}, so:
  //         MainframeBonus(14) = 50 if _GenINFO[92][14]==1 else 0.
  //     Consumed at exactly ONE site — Sailing("BoatArtiMulti") — as `* (1 + MainframeBonus(14)/100)`,
  //     i.e. 1.5x. Multiplicative, NOT part of the additive bracket that ArcadeBonus/ShinyBonusS join.
  //
  // >>> CORRECTION TO THE BRIEF, PART B — THE 1000x SWITCH IS NOT IMPLEMENTED.
  //     I searched exhaustively: LabMainBonus[14][5] is the literal string "50" and is never mutated;
  //     LabMFbonuses["14"] is never written by any override (unlike "8", "9", "11", "13", "114" which
  //     ARE overridden post-cache); MainframeBonus(14) has exactly one call site and it applies no
  //     conditional 1000x; and there is no "all artifacts at max rarity" predicate anywhere near it.
  //     The "1,000x" is DESCRIPTION TEXT ONLY in this build. Treat 1.5x as the real ceiling.
  //     (Consistent with it being moot: Sailing("ArtifactChance") returns 0 / "No_Artifacts_Left_"
  //      once everything is found, so a 1000x find bonus would have nothing to act on.)
  //
  // >>> THE GATE: _GenINFO[92][i] — "is mainframe bonus i connected?"
  //     Built by the connection-graph flood in ActorEvents_548 (N.js flat ~9822700-9826100).
  //     Node index space:  0..11                                   = the 12 player console slots
  //                        12 .. 12+LabMainBonus.length-1          = mainframe bonuses (bonus id = node-12)
  //                        12+LabMainBonus.length ..               = jewels (jewel id = node-12-len)
  //     The flood is seeded from the mainframe console at (43, 229) and walks player->player /
  //     player->bonus / player->jewel edges. An edge player p -> bonus j exists iff:
  //         DistanceEqn(Labb("Player","X",p), Labb("Player","Y",p),
  //                     LabMainBonus[j][1],   LabMainBonus[j][2])  <  Labb("Dist","Bonus", j)
  //     and for a jewel it additionally requires Lab[14][jewelId] == 1 (jewel owned).
  //     When a bonus node is first reached the flood sets _GenINFO[92][j] = 1.
  //
  //     Player position:  Labb("Player","X",p) = Lab[0][2*p] ;  Labb("Player","Y",p) = Lab[0][2*p+1]
  //
  //     Connection RANGE of bonus j — N.js _customBlock_Labb("Dist","Bonus", j):
  //         j==13 -> 80         // Viral_Connection: "always has a 80px connection range no matter what"
  //         j== 8 -> 80         // Spelunker_Obol:   same
  //         else  -> Math.floor( 80 * (1 + (MainframeBonus(109) + MainframeBonus(13)) / 100)
  //                              + ( TaskShopDesc[3][4][11] * Tasks[2][3][4]
  //                                + Dream[8]
  //                                + Summoning("WinBonus", 4, 0) ) )
  //     >>> So bonus 14's range IS boosted by Viral_Connection (MainframeBonus(13)) and jewel 109.
  //
  //     Player LINE WIDTH — Labb("Dist","Player", p)  (used for player->player edges):
  //         base = 50 + 2 * Lv0[12]                      // 12 == the Lab skill level
  //         if (Lab[14][5] == 1 && DistanceEqn(playerXY, JewelDesc[5][0..1]) < 150) base *= 1.25   // Pure Opal Rhinestone
  //         width = floor( (base + MealBonus("PxLine") + min(2*CardLv("Crystal3"), 50))
  //                        * (1 + ( Labb("BubonicPurple","0",p,0)
  //                               + MealBonus("LinePct")
  //                               + chipBonuses("linewidth")            // self only; others use chip-6 count * ChipDesc[6][11]
  //                               + 20 * Breeding("PetArenaBonus","0",13,0)
  //                               + Labb("BonusLineWidth","0",p,0)
  //                               + Breeding("ShinyBonusS","Nah",19,-1) // shiny bonus 19 == "+{%_Line_Width_in_Lab"
  //                               ) / 100) )
  // ══════════════════════════════════════════════════════════════════════════════════════════════
  mainframeBonus14: `
// Returns the ADDITIVE PERCENT for Lab bonus 14 "Artifact Attraction".
// Consumer (the only one) is Sailing("BoatArtiMulti"):  ... * (1 + mainframeBonus14(...)/100)
// -> 50 => 1.5x. 0 => 1.0x.
//
// LAB_MAIN_BONUS must be built the way the client builds it:
//   LAB_MAIN_BONUS = na.LabMainBonus()              // ids 0..13
//   for (let e = 0; e < 4; e++)
//     if (LAB_MAIN_BONUS.length < 15 + e && ninjaEmporiumBonus(8 + e) === 1)
//       LAB_MAIN_BONUS.push(NINJA_INFO[25 + e]);    // appends ids 14,15,16,17
//
// So: no "The Artifact Matrix" Jade Emporium purchase => length stays 14 => id 14 doesn't exist
//     => MainframeBonus(14) short-circuits to 0 via the 'd >= length && 99 > d' guard.
function mainframeBonus14(LAB_MAIN_BONUS, isBonusNodeConnected /* (id)=>bool, i.e. _GenINFO[92][id]==1 */) {
  const d = 14;
  if (d >= LAB_MAIN_BONUS.length) return 0;          // Jade Emporium "The Artifact Matrix" not bought
  const row = LAB_MAIN_BONUS[d];                     // "14 1530 105 90 0 50 Artifact_Attraction <desc>".split(" ")
  // d=14 is not in the special-cased set {0,3,8,9,11,13,15,17}, so it is the plain default branch:
  return isBonusNodeConnected(d) ? Number(row[5])    // 50  -> 1.5x
                                 : Number(row[4]);   // 0   -> 1.0x
  // NOTE: the "1,000x if all artifacts at max rarity" in the description is NOT implemented in N.js.
}

// The gate, reconstructed. Node ids: 0..11 players, 12..12+L-1 bonuses, 12+L.. jewels.
function labConnectedBonusIds(Lab, LAB_MAIN_BONUS, JEWEL_DESC, playerCount, ctx) {
  const L = LAB_MAIN_BONUS.length;
  const px = p => Number(Lab[0][2 * p]);             // Labb("Player","X",p)
  const py = p => Number(Lab[0][2 * p + 1]);         // Labb("Player","Y",p)
  const dist = (x1, y1, x2, y2) => Math.hypot(x1 - x2, y1 - y2);

  const bonusRange = j =>
      (j === 13 || j === 8)
        ? 80
        : Math.floor(80 * (1 + (ctx.mainframeBonus(109) + ctx.mainframeBonus(13)) / 100)
                     + (ctx.taskShopDesc_3_4_11 * ctx.tasks_2_3_4 + ctx.dream_8 + ctx.summoningWinBonus4));

  const playerRange = p => ctx.labbDistPlayer(p);   // see the line-width formula in the comment block above

  const CONSOLE = [43, 229];                        // flood seed
  const connectedBonuses = new Set();
  const seenPlayers = new Set();
  const queue = [{ kind: "console", xy: CONSOLE, range: playerRange(0) }];
  // NOTE: the real client walks _GenINFO[84] edge records (capped at 100 iterations) rather than a
  // clean BFS; edges are emitted player->{player,bonus,jewel} and the console acts as the origin.
  // Reproduce that ordering if you need bit-exact parity on pathological layouts.
  const frontier = [];
  for (let p = 0; p < playerCount; p++)
    if (dist(px(p), py(p), CONSOLE[0], CONSOLE[1]) < playerRange(p)) { frontier.push(p); seenPlayers.add(p); }
  while (frontier.length) {
    const p = frontier.pop();
    for (let q = 0; q < playerCount; q++)
      if (!seenPlayers.has(q) && dist(px(p), py(p), px(q), py(q)) < playerRange(p)) { seenPlayers.add(q); frontier.push(q); }
    for (let j = 0; j < L; j++)
      if (dist(px(p), py(p), Number(LAB_MAIN_BONUS[j][1]), Number(LAB_MAIN_BONUS[j][2])) < bonusRange(j))
        connectedBonuses.add(j);
    for (let g = 0; g < JEWEL_DESC.length; g++)
      if (Number(Lab[14][g]) === 1 &&
          dist(px(p), py(p), Number(JEWEL_DESC[g][0]), Number(JEWEL_DESC[g][1])) < ctx.labbDistGem(g))
        { /* jewel g active -> feeds MainframeBonus(100+g) */ }
  }
  return connectedBonuses;
}
`,

  // ══════════════════════════════════════════════════════════════════════════════════════════════
  // 3. Breeding("ShinyBonusS","Nah", bonusId, -1)
  //
  // N.js: p._customBlock_Breeding, branch `if ("ShinyBonusS" == d)`:
  //   if (getCurrentSceneName().indexOf("Tutorial") != -1) return 0;
  //   if (!hasOwnProperty(DNSM.h, "ShinyBonusS")) {            // build cache once
  //     DNSM.h.ShinyBonusS = new Map();
  //     for (var w = 0; w < 4; w++)
  //       for (var M = 0; M < CustomLists.PetStats[w].length; M++)
  //         if (0 < Number(getGameAttribute("Breeding")[22 + w][M])) {
  //           var id = Number(CustomLists.RANDOlist[90][ Number(CustomLists.PetStats[w][M][5]) ]);
  //           DNSM.h.ShinyBonusS[id] = Number(DNSM.h.ShinyBonusS[id])
  //                                  + Math.round( p._customBlock_Breeding("SpecialPassives","Lv",w,M)
  //                                              * Number(CustomLists.RANDOlist[92][id]) );
  //         }
  //   }
  //   return Number(DNSM.h.ShinyBonusS[e]);
  //
  // N.js: branch `if ("SpecialPassives" == d) { if ("Lv" == b) { ... } }`:
  //   PetszzBrDN1 = 1;
  //   for (var b = 0; b < 19; b++)
  //     if (Number(Breeding[e+22][f]) > Math.floor((1 + Math.pow(b+1, 1.6)) * Math.pow(1.7, b+1)))
  //       PetszzBrDN1 = b + 2;
  //   return PetszzBrDN1;                                       // 1..20
  //   ("REQ" returns floor((1+lv^1.6)*1.7^lv), the xp needed for the NEXT level.)
  //
  // Tables (both plain string literals in N.js):
  //   ka.RANDOlist()[90] : 70 entries. Maps a pet's shiny SLOT (PetStats[w][m][5]) -> shiny BONUS id.
  //     "0 16 3 5 15 20 0 1 3 4 10 22 2 3 11 19 16 6 5 22 21 20 7 12 15 3 8 0 23 9 22 4 21 5 1 13 3
  //      2 24 16 14 17 25 6 4 15 24 7 18 21 5 3 0 9 24 1 6 2 4 23 16 24 25 7 5 8 9 20 16 1"
  //     -> slots 20, 32 and 49 map to bonus id 21. Exactly 3 pets carry Artifact Find.
  //   ka.RANDOlist()[91] : the 26 shiny bonus LABELS. index 21 == "+{%_Higher_Artifact_Find_Chance". ✓
  //   ka.RANDOlist()[92] : the 26 per-SHINY-LEVEL values.
  //     "1 1 2 2 1 1 2 2 2 2 2 2 2 2 2 2 3 3 1 1 1 2 20 1 1 1"   -> [21] == 2   (2% per shiny level)
  //
  // VERIFIED against savegame.json — reproduces the brief's 14/16/16 = 46 EXACTLY:
  //   w=1 idx=8  "steak"  slot 20  xp  538.96  -> Lv 7  * 2 = 14
  //   w=2 idx=6  "mamoth" slot 32  xp 1007.82  -> Lv 8  * 2 = 16
  //   w=3 idx=6  "w4b2"   slot 49  xp 1861.31  -> Lv 8  * 2 = 16
  //   ShinyBonusS(21) = 46   ✓
  //
  // Consumed by Sailing("BoatArtiMulti") in the SAME additive bracket as ArcadeBonus(32)+ArcadeBonus(66):
  //   Math.max(1, (1 + ( Sailing("ArtifactBonus",3,0) + CaptBonusCalc(3, ...) 
  //                    + Breeding("ShinyBonusS","Nah",21,-1)
  //                    + 20*RandomEvent("FractalIslandBonus",3,999) + GetBribeBonus("34")
  //                    + 25*min(30, NONdummies[60])
  //                    + ArcadeBonus(32) + ArcadeBonus(66)
  //                    + Holes("B_UPG",55,0) + FarmingStuffs("StickerBonus",2,0)
  //                    + ResearchStuff("Grid_Bonus",109,0) + Summoning("VaultUpgBonus",63,0)
  //                    ) / 100)) * ... * (1 + MainframeBonus(14)/100) * ...
  //
  // Other shiny bonus ids worth knowing (RANDOlist[91]): 16 = "+{%_Faster_Shiny_Mob_Lv_Up_Rate"
  // (used by Breeding("ShinySpdMulti")), 19 = "+{%_Line_Width_in_Lab" (used by Labb("Dist","Player")),
  // 20 = "+{%_Bonuses_from_All_Meals", 22 = "+{_Base_Efficiency_for_All_Skills" (per-level value 20).
  // ══════════════════════════════════════════════════════════════════════════════════════════════
  breedingShinyBonusS: `
// Shiny pet level from accumulated shiny xp (days). Returns 1..20.
// N.js: _customBlock_Breeding("SpecialPassives","Lv", world, petIdx)
function shinyLevel(Breeding, world, petIdx) {
  let lv = 1;
  const xp = Number(Breeding[world + 22][petIdx]);
  for (let b = 0; b < 19; b++)
    if (xp > Math.floor((1 + Math.pow(b + 1, 1.6)) * Math.pow(1.7, b + 1))) lv = b + 2;
  return lv;
}
// xp required to reach level (lv+1) from lv:
//   shinyReq(lv) = Math.floor((1 + Math.pow(lv, 1.6)) * Math.pow(1.7, lv))

// Sums every shiny pet's contribution, grouped by shiny bonus id. Returns Map<bonusId, percent>.
// N.js: _customBlock_Breeding("ShinyBonusS", "Nah", bonusId, -1)
// PET_STATS  = na.PetStats()      -> PET_STATS[w][m] = "name gene a b c SLOT".split(" "), [5] == SLOT
// RANDO_90   = ka.RANDOlist()[90] -> SLOT -> bonusId
// RANDO_92   = ka.RANDOlist()[92] -> bonusId -> percent per shiny LEVEL
function shinyBonusAll(Breeding, PET_STATS, RANDO_90, RANDO_92) {
  const out = new Map();
  for (let w = 0; w < 4; w++) {
    for (let m = 0; m < PET_STATS[w].length; m++) {
      if (!(Number(Breeding[22 + w]?.[m] ?? 0) > 0)) continue;   // no shiny progress -> skipped entirely
      const id = Number(RANDO_90[Number(PET_STATS[w][m][5])]);
      const add = Math.round(shinyLevel(Breeding, w, m) * Number(RANDO_92[id]));
      out.set(id, (out.get(id) ?? 0) + add);
    }
  }
  return out;
}

function shinyBonusS(Breeding, PET_STATS, RANDO_90, RANDO_92, bonusId) {
  return shinyBonusAll(Breeding, PET_STATS, RANDO_90, RANDO_92).get(bonusId) ?? 0;
}

// bonusId 21 == "+{%_Higher_Artifact_Find_Chance" (RANDOlist[91][21]); RANDOlist[92][21] == 2 %/level.
// Sample savegame -> shinyBonusS(..., 21) === 46   (steak Lv7=14, mamoth Lv8=16, w4b2 Lv8=16)  ✓
`,
};
