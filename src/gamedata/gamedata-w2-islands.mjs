/* gamedata-w2-islands.mjs — W2 coastal Islands minigame (Trash, Rando, Crystal, Seasalt, Shimmer,
 * Fractal), Yum-Yum Desert. NOT the sailing-world "Sahara"-style island chain — see the
 * IslandInfo warning below, that's a real trap in this data.
 *
 * SOURCE — unlike most gamedata-*.mjs tables in this repo, this one is NOT a na.*() CustomLists
 * function. It's assembled INLINE, imperatively, via `this._GenINFO.push(...)` calls inside the
 * init of the Killroy/Islands actor class `scripts.ActorEvents_623` (N.js:19488 region — the
 * whole init body is one very long minified line; search for the literal fragment
 * "Trade_garbage_that_washs_up_each_day_for_items" to relocate it after a patch, don't trust line
 * numbers). `this._GenINFO` is the actor's own per-instance array (not CustomLists, not OptLacc)
 * — most of it is rebuilt from OptLacc on `_customEvent_IslandStuff()`, so it's a live cache, not
 * a canonical table users can read out-of-band; the constants extracted below (the LITERAL
 * strings/numbers pushed) are the actual game design data.
 *
 * *** IslandInfo WARNING (explicitly checked per task) *** `na.IslandInfo()` DOES exist in N.js
 * and IS loaded into CustomLists (`CustomLists.h.IslandInfo`), but it is the SAILING-world island
 * chain, NOT this system: confirmed by its load-order co-location, immediately next to
 * `na.SailingMapPaths()`, `na.BoatsInHarbor()`, and `na.CloudsMap()` at N.js:30244 and again at
 * N.js:34307 (`e=na.IslandInfo();b.h.IslandInfo=e` sandwiched between SailingMapPaths and
 * CloudsMap init calls) — all four are Sailing-system tables assigned in the same init block.
 * idleon-toolbox's own `islands` website-data.json key is ALSO the sailing chain (Safari_Island,
 * Beachy_Coast, Stormy_North, ... World's_End — verified by inspecting the JSON directly), so
 * that key is USELESS as a cross-check for this file; do not use it. The W2 six-island system
 * documented below has no dedicated na.*() function or website-data.json key at all — it only
 * exists as this actor's inline GenINFO construction, cross-checked instead against
 * idleon-toolbox's own re-derivation in parsers/world-2/islands.ts (which independently
 * transcribed the same actor code, not website-data.json).
 *
 * ISLAND UNLOCK / RE-BUY COST — OptLacc[169] is a letter-flag string (islands owned so far, via
 * Number2Letter, same convention as OptLacc[311] elsewhere in this repo). `_DN3` = count of
 * islands currently unlocked (0-5, computed by scanning OptLacc[169] for each of the 6
 * Number2Letter flags). Two DIFFERENT cost curves depending on whether ANY island is unlocked yet:
 *   if islandsUnlocked === 0 (nothing owned yet): cost = preUnlockCost[i] + PRE_UNLOCK_MULT[_DN3]
 *     PRE_UNLOCK_MULT = [0, 8, 32, 80, 200, 500]           (CONFIRMED verbatim, ternary chain)
 *     preUnlockCost = [4, 12, 20, 28, 40, 52]  (Trash..Fractal, CONFIRMED: `Math.round(4+DN2)` etc)
 *   else (>=1 island owned): cost = baseCost[i] + POST_UNLOCK_MULT[_DN3]
 *     POST_UNLOCK_MULT = [0, 15, 45, 100, 200, 500]        (CONFIRMED verbatim, ternary chain)
 *     baseCost = [10, 12, 15, 50, 25, 70]      (Trash..Fractal, CONFIRMED: `Math.round(10+DN2)` etc)
 * Both multiplier tables and both cost-const arrays are byte-for-byte confirmed against N.js and
 * match idleon-toolbox's `preUnlockMultipliers`/`multipliers`/`preUnlockCost`/`baseCost` exactly
 * — 0 mismatches. Currency for buying/re-rolling islands themselves not independently pinned
 * down here (out of scope: this file covers the per-island SHOPS, not the island-unlock cost
 * itself, which toolbox's `getIslands()` already computes from the constants above).
 *
 * Refresh note: search N.js for "Trade_garbage_that_washs_up_each_day_for_items" to relocate
 * this whole block after a patch (all six island descriptions, both cost tables, and all the
 * inline shop tables below live within ~2500 chars of that string). */

export const ISLANDS = [
  { idx: 0, name: "Trash", description: "Trade_garbage_that_washs_up_each_day_for_items", preUnlockCost: 4, baseCost: 10 },
  { idx: 1, name: "Rando", description: "Guaranteed_Random_Event_once_a_week", preUnlockCost: 12, baseCost: 12 },
  { idx: 2, name: "Crystal", description: "Fight_daily_giant_crystal_mobs_that_drop_candy", preUnlockCost: 20, baseCost: 15 },
  { idx: 3, name: "Seasalt", description: "Catch_legendary_fish_for_crafting_World_6_equips", preUnlockCost: 28, baseCost: 50 },
  { idx: 4, name: "Shimmer", description: "Do_Weekly_Challenges_for_Shimmer_Upgrades", preUnlockCost: 40, baseCost: 25 },
  { idx: 5, name: "Fractal", description: "Dump_your_time_candy_here_for..._nothing...?", preUnlockCost: 52, baseCost: 70 },
];

export const PRE_UNLOCK_MULT = [0, 8, 32, 80, 200, 500];
export const POST_UNLOCK_MULT = [0, 15, 45, 100, 200, 500];

/* ---------------------------------------------------------------------------------------------
 * TRASH (island 0). Currency: OptLacc[161] (garbage). Consumer: purchase-click dispatch in the
 * same actor, CONFIRMED — `OptLacc[161] -= GenINFO[2][b]`, then a b-indexed switch:
 *   b=0 StampB47 drop, b=1 StampB32 drop, b=2 StampA38 drop, b=3 StampA39 drop (all 4 stamps,
 *   guaranteed pickup via DropSomething), b=4 OptLacc[163]+=1 (feeds this row's own re-cost,
 *   7*1.4^OptLacc[163]), b=5 OptLacc[165]=1 (one-time flag, unlocks a new Bribe set), b=6
 *   OptLacc[164]+=1 (feeds this row's own re-cost, 25*1.5^OptLacc[164]), b=7 TalentBook1 drop
 *   (Filthy Damage), b=8 EquipmentNametag6b drop (Trash Tuna Nametag). Cost array refreshes live:
 *   GenINFO[2][4] = 7*1.4^OptLacc[163], GenINFO[2][6] = 25*1.5^OptLacc[164] (both confirmed at two
 *   separate source locations, no discrepancy between the initial literal and the live refresh —
 *   unlike Rando below, where they DO disagree). */
export const TRASH_SHOP = [
  { idx: 0, cost: 20, effect: "StampB47 (Skelefish Stamp) — guaranteed drop" },
  { idx: 1, cost: 40, effect: "StampB32 (Amplestample Stamp) — guaranteed drop" },
  { idx: 2, cost: 80, effect: "StampA38 (Golden Sixes Stamp) — guaranteed drop" },
  { idx: 3, cost: 300, effect: "StampA39 (Stat Wallstreet Stamp) — guaranteed drop" },
  { idx: 4, cost: "7 * 1.4^OptLacc[163]", effect: "OptLacc[163] += 1 — +20% Garbage Gain (repeatable, cost scales with own counter)" },
  { idx: 5, cost: 135, effect: "OptLacc[165] = 1 (one-time) — Unlock New Bribe Set (The Art of the Bail)" },
  { idx: 6, cost: "25 * 1.5^OptLacc[164]", effect: "OptLacc[164] += 1 — +10% Message Bottle Gain (repeatable, cost scales with own counter)" },
  { idx: 7, cost: 450, effect: "TalentBook1 drop — Filthy Damage Special Talent Book" },
  { idx: 8, cost: 1500, effect: "EquipmentNametag6b drop — Trash Tuna Nametag" },
];

/* ---------------------------------------------------------------------------------------------
 * RANDO (island 1). Currency: OptLacc[162] (message bottles — same currency toolbox's
 * bottlesPerDay/bottles fields track). Consumer CONFIRMED: `OptLacc[162] -= GenINFO[3][b]`, then
 * b=0 OptLacc[166]+=1, b=1 OptLacc[167]+=1, b=2 TalentBook1 drop (Rando Event Looty).
 *
 * GOTCHA — two DIFFERENT cost formulas exist in the source for slots 0/1, and they disagree:
 *   - the INITIAL array-literal seed (built once at GenINFO construction time) uses
 *     25*1.8^OptLacc[166] and 10*1.6^OptLacc[167];
 *   - the LIVE REFRESH path (fires when `_TRIGGEREDtext` contains "f", i.e. whenever the UI
 *     re-renders this panel) overwrites GenINFO[3][0]/[1] with 10*1.5^OptLacc[166] and
 *     6*1.4^OptLacc[167] instead.
 *   Since the refresh fires on every render of the panel, the SEED values are only ever visible
 *   for a single frame before being overwritten — the AUTHORITATIVE, player-visible formula is
 *   the refreshed one (10*1.5^ / 6*1.4^), which also matches idleon-toolbox's independent
 *   transcription exactly. Recorded here as the canonical cost; the stale seed constants are
 *   noted for completeness only, in case a future patch removes the refresh and reverts to them. */
export const RANDO_SHOP = [
  { idx: 0, cost: "10 * 1.5^OptLacc[166]", staleSeedCost: "25 * 1.8^OptLacc[166] (overwritten every render, not player-visible)",
    effect: "OptLacc[166] += 1 — +5% Loot from the weekly guaranteed Random Event" },
  { idx: 1, cost: "6 * 1.4^OptLacc[167]", staleSeedCost: "10 * 1.6^OptLacc[167] (overwritten every render, not player-visible)",
    effect: "OptLacc[167] += 1 — +3% chance for Double Boss on the weekly guaranteed Random Event" },
  { idx: 2, cost: 200, effect: "TalentBook1 drop — Rando Event Looty Special Talent Book" },
];
/* OptLacc[168]: gates the weekly guaranteed Random Event itself (0 = event can still trigger this
 * week, non-zero = already claimed) — found via a `0==OptLacc[168]` guard on the
 * RandomEvent("MapOfEvent",...) trigger elsewhere in the same actor; not part of the shop table
 * but directly relevant to what Rando island DOES. */

/* ---------------------------------------------------------------------------------------------
 * CRYSTAL (island 2) and SEASALT (island 3) — GENUINE GAP, confirmed independently (not just
 * "toolbox didn't parse it"): the click-dispatch region of ActorEvents_623 has explicit branches
 * for `0==GenINFO[1]` (Trash), `1==GenINFO[1]` (Rando), and `4==GenINFO[1]` (Shimmer, two
 * separate branches) but NO branch at all for `2==GenINFO[1]` or `3==GenINFO[1]` — these two
 * islands have no purchasable upgrade shop in this actor. Per their one-line descriptions
 * ("Fight daily giant crystal mobs that drop candy" / "Catch legendary fish for crafting World 6
 * equips") they appear to be pure passive unlocks — owning the island enables a daily/ongoing
 * mechanic elsewhere (Crystal Mob spawns, legendary-fish catches) with no further in-island
 * currency shop. Not modeled in idleon-toolbox's parser either. If a shop DOES exist for these,
 * it lives in a different actor not yet located — flagged honestly rather than guessed. */
export const CRYSTAL_SHOP = null; // no shop found — see gap note above
export const SEASALT_SHOP = null; // no shop found — see gap note above

/* ---------------------------------------------------------------------------------------------
 * SHIMMER (island 4). Currency: OptLacc[173] ("shimmerCurrency" per toolbox). Cost formula
 * CONFIRMED verbatim: `cost = 1 + floor(OptLacc[174+i] / divider[i])`, dividers below. Buying
 * slot b<7 does `OptLacc[173] -= cost; OptLacc[174+b] += 1`.
 * GOTCHA — an UNDOCUMENTED 8th shop slot exists that idleon-toolbox's `shimmerIslandShop` array
 * (7 entries) does NOT include: slot 7, flat cost 2, on purchase there's an 0.011 (1.1%) chance
 * of a TalentBook1 drop (Shimmer weekly-trial-adjacent talent book) and otherwise nothing —
 * confirmed directly in the same purchase-click 8-iteration loop (`for(d=0;8>d;)...`) as the
 * other 7 slots, just never surfaced by toolbox. */
export const SHIMMER_SHOP = [
  { idx: 0, effect: "+{,Base_STR", divider: 12, optLaccIdx: 174 },
  { idx: 1, effect: "+{,Base_AGI", divider: 12, optLaccIdx: 175 },
  { idx: 2, effect: "+{,Base_WIS", divider: 12, optLaccIdx: 176 },
  { idx: 3, effect: "+{,Base_LUK", divider: 10, optLaccIdx: 177 },
  { idx: 4, effect: "+{%,Total_DMG", divider: 3, optLaccIdx: 178 },
  { idx: 5, effect: "+{%,Class_EXP", divider: 4, optLaccIdx: 179 },
  { idx: 6, effect: "+{%,Skill_Eff", divider: 5, optLaccIdx: 180 },
  { idx: 7, cost: 2, effect: "1.1% chance per purchase: TalentBook1 drop (Shimmer Island Trials Special Talent Book); otherwise no effect. NOT in idleon-toolbox's shimmerIslandShop array — found only by reading the purchase-click loop directly." },
];

/* 22 weekly-trial descriptions (GenINFO[16] in the source, `_DL1.push("...")` x22, immediately
 * following the 7-entry effect-template array (GenINFO[15]) at the same source location).
 * OptLacc[183] = current trial index (confirmed). Verbatim, byte-identical to toolbox's
 * `shimmerIslandTrials` (one N.js typo carried over faithfully: "beginner" trial's description
 * has no closing period, matching the client's own text; N.js uses a comma before "but" where
 * toolbox's transcription uses a period — kept as N.js has it, comma). */
export const SHIMMER_TRIALS = [
  "Get_as_much_total_stats_as_possible,_STR_AGI_WIS_and_LUK_combined.",
  "Get_as_much_STR_stat_as_you_can.",
  "Get_as_much_AGI_stat_as_you_can.",
  "Get_as_much_WIS_stat_as_you_can.",
  "Get_as_much_LUK_stat_as_you_can.",
  "Get_the_highest_DPS_(number_of_digits)_you_can,_but_on_a_beginner",
  "Get_the_highest_DPS_(number_of_digits)_you_can,_but_on_a_warrior.",
  "Get_the_highest_DPS_(number_of_digits)_you_can,_but_on_a_archer.",
  "Get_the_highest_DPS_(number_of_digits)_you_can,_but_on_a_mage.",
  "Get_the_highest_Accuracy_stat_you_can.",
  "Get_the_highest_Defence_stat._Tank_mains,_it's_your_moment!",
  "Get_the_highest_Movement_Speed_you_can.",
  "Get_the_highest_Critical_Chance_%_you_can.",
  "Spawn_as_many_Giant_Mobs_this_week_as_you_can.",
  "Get_the_highest_Max_HP_as_possible.",
  "Get_the_highest_Max_MP_as_possible.",
  "Get_as_many_individual_hits_on_the_DPS_Dummy_as_you_can_within_the_timer.",
  "Get_as_much_Mining_Efficiency_(number_of_digits)_as_you_can.",
  "Get_as_much_Choppin_Efficiency_(number_of_digits)_as_you_can.",
  "Get_as_much_Fishing_Efficiency_(number_of_digits)_as_you_can.",
  "Get_as_much_Catching_Efficiency_(number_of_digits)_as_you_can.",
  "Claim_as_much_Guild_GP_this_week_as_you_can.",
];
/* Trial-completion reward path (separate from the currency shop above, worth noting): claiming
 * the weekly trial reward (gated on OptLacc[182]==0, one-shot per week) grants
 *   OptLacc[173] += ceil(10 * min(4, (OptLacc[181] / GenINFO[20][GenINFO[21]]) ^ 0.5))
 * — GenINFO[20] is a per-trial target-score table and GenINFO[21] the current trial index
 * (mirrors OptLacc[183]); OptLacc[181] is presumably the player's best score for the active
 * trial. Not fully re-derived (GenINFO[20]'s literal contents weren't located within budget) —
 * flagged as "formula shape confirmed, source table not yet pinned down" rather than guessed. */

/* ---------------------------------------------------------------------------------------------
 * FRACTAL (island 5). Currency: none — pure passive AFK-hours threshold flags read from
 * OptLacc[184] ("hours of Nothing AFK", confirmed). ALREADY IMPLEMENTED as
 * `fractalIslandBonus(ctx,idx)` / `FRACTAL_THRESHOLDS` in bonuses/misc.mjs — do not duplicate
 * that function. This block adds the human-readable bonus DESCRIPTIONS that misc.mjs
 * deliberately omits (it only has the bare threshold numbers). Both the descriptions (GenINFO[24])
 * and thresholds (GenINFO[25]) were re-confirmed directly against N.js here, independent of
 * misc.mjs and of idleon-toolbox: byte-for-byte identical to bonuses/misc.mjs's
 * FRACTAL_THRESHOLDS = [24, 200, 750, 2500, 1e4, 2e4, 4e4, 6e4] — 0 mismatches. */
export const FRACTAL_BONUSES = [
  { idx: 0, threshold: 24, description: "1_in_100000_chance_for_Trophy_per_hr_of_Nothing_AFK" },
  { idx: 1, threshold: 200, description: "1.25x_Dungeon_Credits_and_Flurbos_gained" },
  { idx: 2, threshold: 750, description: "-30%_Kitchen_Upgrade_Costs" },
  { idx: 3, threshold: 2500, description: "1.20x_Chance_to_find_Sailing_Artifacts" },
  { idx: 4, threshold: 1e4, description: "Dirty_Shovel_digs_up_+25%_more_Gold_Nuggets" },
  { idx: 5, threshold: 2e4, description: "+100_Star_Talent_Pts" },
  { idx: 6, threshold: 4e4, description: "All_Ninja_Twins_get_+2%_Stealth_per_Sneaking_LV" },
  { idx: 7, threshold: 6e4, description: "World_7_Bonus..._I_wonder_what_it_will_be..." },
];

/* Account-option index citations gathered while extracting this file (grepped directly, not
 * transcribed from toolbox), 160-185 range as requested:
 *   161 garbage (Trash currency)           162 message bottles (Rando/Trash-adjacent currency)
 *   163 Trash "+20% Garbage Gain" counter  164 Trash "+10% Message Bottle Gain" counter
 *   165 Trash "new Bribe set" one-time flag
 *   166 Rando "5% Loot" counter            167 Rando "3% Double Boss" counter
 *   168 weekly Rando-event-claimed flag (0 = event can still trigger this week)
 *   169 islands-unlocked letter-flag string (Number2Letter convention, drives _DN3)
 *   172 Shimmer bestDpsEver (read via getLOG(...) elsewhere, e.g. a Sailing talent-number calc —
 *       confirms the value is shared/read outside the Islands actor too)
 *   173 Shimmer currency                   174-180 Shimmer 7-stat purchase counters (STR/AGI/WIS/LUK/DMG/ClassEXP/SkillEff)
 *   181 Shimmer trial current best score (consumed by the reward-claim formula above)
 *   182 Shimmer weekly-trial-reward-claimed flag (one-shot per week, gates the OptLacc[173] reward)
 *   183 Shimmer current trial index (into SHIMMER_TRIALS)
 *   184 Fractal hours-of-Nothing-AFK (already in bonuses/misc.mjs as fractalIslandPts)
 *   185 NOT island-specific — reused elsewhere as a generic "currently selected character index"
 *       (GetPlayersUsernames[OptLacc[185]]); its appearance in this actor's GenINFO build is
 *       incidental, not a dedicated Islands slot — noted so it isn't mistaken for one. */
