/* gamedata-w2-ballot.mjs — Vote Ballot + Meritocracy (World 2, Yum-Yum Desert), category tables
 * and multiplier formulas, extracted verbatim from N.js.
 *
 * TABLE SOURCE — na.NinjaInfo() at N.js:23643, a single minified line returning a 42-element
 * array (index by index a grab-bag of unrelated Ninja-Twins/W2 tables; only [38] and [41] are
 * ours). Assigned into CustomLists.h.NinjaInfo at engine init. idleon-toolbox's parser
 * (parsers/world-2/voteBallot.ts) imports this as `ninjaExtraInfo` from its own pre-processed
 * website-data.json — that name is a TOOLBOX invention; the real N.js function is `na.NinjaInfo`,
 * confirmed by tracing the dispatcher literal `CustomLists.h.NinjaInfo[41][...]` back to its
 * source (see below). Each element of NinjaInfo() is built via `"space joined string".split(" ")`
 * — description fragments use `_` for spaces (survives the split), so a category's description
 * is always exactly ONE token, never split across the space-delimiter.
 *
 * VOTE_BALLOT_CATEGORIES = NinjaInfo[38], flat as fixed-width [description, baseValue, extra]
 * triplets (35 categories, 105 elements) — toolbox reads this with `.toChunks(3)`, matches.
 * Note row 0 and row 1 are BYTE-IDENTICAL in N.js (same description, same value 25) — a genuine
 * client-data duplicate, not an extraction artifact.
 *
 * MERITOCRACY_CATEGORIES = NinjaInfo[41], ALSO flat fixed-width triplets (28 categories, 84
 * elements) — confirmed via the dispatcher's own indexing math (see VotingBonusz/MeritocBonusz
 * below): `NinjaInfo[41][round(1+3*b)]` picks the value for category b, i.e. offset 3*b+1 within
 * uniform 3-tuples. Toolbox's TS parser instead uses a variable-width scan (`while
 * (isNaN(Number(parts[i]))) desc.push(parts[i])`) that happens to produce an IDENTICAL 28-category
 * result on this data, because every description is a single underscore-joined token (never two
 * tokens in a row) — so their scan's while-loop only ever iterates once per category. Toolbox's
 * own code comment "always 0" (for the trailing `extra` field) is correct: extra is 0 for all 28
 * meritocracy rows in the current data (unlike vote-ballot's `extra`, which varies 0-6 and is
 * consumed elsewhere as a category-group tag).
 *
 * Cross-check vs idleon-toolbox website-data.json `ninjaExtraInfo[38]`/`ninjaExtraInfo[41]`:
 * BYTE-IDENTICAL, 0 mismatches, both directly re-derived from N.js (not trusted from toolbox).
 *
 * DISPATCHER — m._customBlock_Summoning2(d,b,e), the function whose switch-arms toolbox's source
 * comments call out as "VotingBonusz == e" / "MeritocBonusz == e". Confirmed exact N.js text:
 *
 *   "MeritocBonusz"==d: returns 0 in GemShop/Tutorial/PlayerSelect scenes; else, only if
 *     b == OptLacc[453] (the currently SELECTED meritocracy category) does it pay out:
 *       NinjaInfo[41][round(1+3*b)] * MeritocBonuszMulti     (else 0 — unselected categories pay nothing)
 *   "MeritocCanVote"==d: OptLacc[472]==1 ? 1 : 0                       (voting-unlocked flag)
 *   "MeritocBonuszMulti"==d (the meritocracyMult multiplier):
 *     0 >= KillsLeft2Advance[250][0] ?   // an unrelated readiness/unlock gate on the term below
 *       (1 + Companions(161)/100)                                      // Poppy companion
 *       * ( min(1, max(.25, .25 + MeritocCanVote))                     // <- NOT modeled by toolbox
 *           + (5*ClamWorkBonus(3) + (Companions(39) + (LegendPTS_bonus(24)
 *               + (ArcadeBonus(59) + (20*EventShopOwned(23) + SushiStuff(51)))))) / 100 )
 *       : 0
 *   Note the `min(1,max(.25,.25+MeritocCanVote))` term: MeritocCanVote is 0/1, so this evaluates
 *   to exactly 1 when voting is unlocked (OptLacc[472]==1, the normal case) or 0.25 when it's
 *   locked. idleon-toolbox's TS transcription hardcodes this term as `1`, silently assuming
 *   voting is always unlocked — correct for any account past the early unlock, but not a complete
 *   transcription of the client formula. Kept faithfully below.
 *
 *   "VotingBonusz"==d (reading a single category b's payout) has extra GenINFO-based selection
 *   gating for b==1 specifically (comparing against ActorEvents_670/_201's _GenINFO[36]/[58],
 *   likely related to categories 0 and 1 being identical duplicates) that was NOT fully reverse
 *   engineered here — not required for the category TABLE deliverable; the simple case (b !=
 *   selected category -> 0; b == selected -> NinjaInfo[38][round(1+3*b)] * VotingBonuszMulti)
 *   covers normal play.
 *   "VotingBonuszMulti"==d (the voteMulti multiplier), CONFIRMED verbatim:
 *     (1 + Companions(161)/100)                                        // Poppy companion
 *     * (1 + MeritocBonusz(9)/100)                                     // Meritocracy category 9
 *     * (1 + (Companions(41) + Dream[13] + (CosmoBonusQTY(2,3) + (WinBonus(22,0)
 *         + (17*EventShopOwned(7) + 13*EventShopOwned(16) + (Companions(19)
 *             + (PaletteBonus(32) + (LegendPTS_bonus(22) + SushiStuff(50)))))))) / 100)
 *   This matches idleon-toolbox's `voteMulti` transcription EXACTLY, term for term (poppyBonus,
 *   meritocracyBonus=MeritocBonusz(9), companionBonus3=Companions(41), equinoxBonus=Dream[13],
 *   cosmoBonus, winnerBonus, eventShopBonus2/3, companionBonus2=Companions(19), paletteBonus,
 *   legendTalentBonus2, ballotSushiBonus=SushiStuff(50)) — 0 discrepancies found.
 *
 * Selected-category account options (OptLacc): [453] = selected Meritocracy category index,
 * [472] = MeritocCanVote flag. The Vote Ballot's own selected-category OptLacc slot was not
 * independently pinned down (the dispatcher reads it off an Actor's _GenINFO, not directly off
 * OptLacc, for the b==1 special case) — flagged as unconfirmed rather than guessed.
 *
 * Refresh note: re-run against a fresh N.js by searching for `na.NinjaInfo=function(){return[` —
 * single-line minified, do not trust prior line numbers across patches. */

export const VOTE_BALLOT_CATEGORIES = [
  { idx: 0, description: "All_your_characters_deal_}x_more_damage_to_enemies", baseValue: 25, extra: 0 },
  { idx: 1, description: "All_your_characters_deal_}x_more_damage_to_enemies", baseValue: 25, extra: 0 },
  { idx: 2, description: "Increases_STR_AGI_WIS_and_LUK_for_all_characters_by_+{%", baseValue: 15, extra: 0 },
  { idx: 3, description: "Increases_Defence_and_Accuracy_by_+{%_for_all_characters", baseValue: 30, extra: 0 },
  { idx: 4, description: "Logging_in_each_day_gives_+{_more_GP_to_your_guild_than_you_normally_do", baseValue: 30, extra: 0 },
  { idx: 5, description: "}x_Kill_per_Kill,_making_monster_kills_worth_more_for_portals_and_Deathnote", baseValue: 20, extra: 0 },
  { idx: 6, description: "+{%_AFK_gain_for_both_fighting_and_skills_for_all_characters", baseValue: 15, extra: 0 },
  { idx: 7, description: "Boosts_all_Mining_EXP_gain_and_Mining_Efficiency_by_+{%", baseValue: 42, extra: 0 },
  { idx: 8, description: "Boosts_all_Fishing_EXP_gain_and_Fishing_Efficiency_by_+{%", baseValue: 50, extra: 0 },
  { idx: 9, description: "Boosts_all_Choppin'_EXP_gain_and_Choppin'_Efficiency_by_+{%", baseValue: 38, extra: 0 },
  { idx: 10, description: "Boosts_all_Catching_EXP_gain_and_Catching_Efficiency_by_+{%", baseValue: 46, extra: 0 },
  { idx: 11, description: "Increases_the_amount_of_resources_produced_by_the_3D_Printer_by_}x", baseValue: 20, extra: 3 },
  { idx: 12, description: "Boosts_liquid_generation_rate_for_all_Alchemy_liquids_by_+{%", baseValue: 25, extra: 0 },
  { idx: 13, description: "Boosts_all_Cooking_EXP_gain_and_Cooking_Speed_by_+{%", baseValue: 63, extra: 4 },
  { idx: 14, description: "Boosts_Dungeon_Credit_and_Dungeon_Flurbo_gain_by_}x", baseValue: 50, extra: 0 },
  { idx: 15, description: "All_your_characters_gain_+{%_more_Class_EXP_from_monsters", baseValue: 60, extra: 0 },
  { idx: 16, description: "Speeds_up_Egg_Incubation_time_and_Breeding_EXP_gain_by_+{%", baseValue: 50, extra: 4 },
  { idx: 17, description: "Boosts_Sigil_EXP_gain_by_}x,_still_requires_Sigils_active_in_Lab", baseValue: 80, extra: 4 },
  { idx: 18, description: "Boosts_Construction_Build_Rate_and_Construction_EXP_gain_by_+{%", baseValue: 40, extra: 3 },
  { idx: 19, description: "Boosts_Shrine_EXP_gain_by_a_staggering_}x", baseValue: 53, extra: 3 },
  { idx: 20, description: "Boosts_Artifact_Find_chance_in_Sailing_by_}x", baseValue: 31, extra: 5 },
  { idx: 21, description: "Boosts_New_Species_chance_when_using_DNA_in_Gaming_by_}x", baseValue: 80, extra: 5 },
  { idx: 22, description: "Find_+{%_more_Gold_Nuggets_when_digging_with_the_Shovel_in_Gaming", baseValue: 75, extra: 5 },
  { idx: 23, description: "Boosts_Divinity_PTS_gain_by_}x_and_Divinity_EXP_Gain_by_+{%", baseValue: 60, extra: 5 },
  { idx: 24, description: "Boosts_Sailing_Captain_EXP_gain_and_Sailing_Speed_by_}x", baseValue: 50, extra: 5 },
  { idx: 25, description: "Boosts_Sneaking_Stealth_by_}x_and_EXP_Gain_by_+{%_for_all_your_Ninja_Twins", baseValue: 65, extra: 6 },
  { idx: 26, description: "Boosts_bonuses_from_all_Golden_Food_by_+{%", baseValue: 30, extra: 0 },
  { idx: 27, description: "Increases_Drop_Rate_for_all_your_characters_by_+{%", baseValue: 38, extra: 0 },
  { idx: 28, description: "Boosts_Summoning_EXP_gain_by_+{%_and_all_Essence_gained_by_}x", baseValue: 40, extra: 6 },
  { idx: 29, description: "Boosts_Crop_Value,_and_Farming_EXP_gain,_AND_Next_Crop_Chance_by_+{%", baseValue: 40, extra: 6 },
  { idx: 30, description: "Increases_Trapping_EXP_gain_and_Worship_EXP_gain_by_+{%", baseValue: 54, extra: 3 },
  { idx: 31, description: "Increases_Lab_EXP_gain_by_+{%", baseValue: 90, extra: 4 },
  { idx: 32, description: "Boosts_Equinox_Bar_Fill_rate_by_}x", baseValue: 40, extra: 3 },
  { idx: 33, description: "Boosts_Refinery_Cycle_Speed_by_+{%", baseValue: 50, extra: 3 },
  { idx: 34, description: "Increases_cash_earned_from_monsters_by_+{%", baseValue: 52, extra: 0 },
];

export const MERITOCRACY_CATEGORIES = [
  { idx: 0, description: "Multiplies_everything_in_the_game_by_1.00x", baseValue: 0, extra: 0 },
  { idx: 1, description: "Multiplies_all_Gaming_Bits_gained_by_}x", baseValue: 700, extra: 0 },
  { idx: 2, description: "Multiplies_your_chance_to_get_Double_Snail_Mail_each_day_by_}x", baseValue: 150, extra: 0 },
  { idx: 3, description: "Kattlekruk_gives_}x_more_Bubble_LVs_than_normal_each_day", baseValue: 200, extra: 0 },
  { idx: 4, description: "Multiplies_how_many_Shiny_Critters_you_get_from_Trapping_by_}x", baseValue: 400, extra: 0 },
  { idx: 5, description: "Multiplies_your_Total_Damage_dealt_to_monsters_by_}x", baseValue: 200, extra: 0 },
  { idx: 6, description: "Multiplies_all_the_Jade_your_ninja_twins_find_by_}x", baseValue: 900, extra: 0 },
  { idx: 7, description: "Multiplies_your_Monument_Reward_Multi_by_}x", baseValue: 200, extra: 0 },
  { idx: 8, description: "Multiplies_your_total_Palette_Luck_in_Gaming_by_}x", baseValue: 200, extra: 0 },
  { idx: 9, description: "The_Bonus_Ballo..._ugh,_THAT_guy..._the_Bonus_Ballot's_stuff_is_like_}x_more_or_whatever...", baseValue: 100, extra: 0 },
  { idx: 10, description: "Multiplies_Skill_EXP_gain_by_}x", baseValue: 125, extra: 0 },
  { idx: 11, description: "You_get_}x_more_Ribbons_added_to_your_Ribbon_Shelf_every_day", baseValue: 100, extra: 0 },
  { idx: 12, description: "Multiplies_Feather_and_Fish_production_Rate_by_}x_for_your_friends_Orion_and_Poppy", baseValue: 9900, extra: 0 },
  { idx: 13, description: "Your_Beryllium_atom_creates_}x_more_PO_Boxes_each_day_while_still_using_up_just_1_Silver_Pen", baseValue: 200, extra: 0 },
  { idx: 14, description: "All_material_costs_for_upgrading_Stamp_Max_LV_are_}x_lower", baseValue: 100, extra: 0 },
  { idx: 15, description: "You're_guaranteed_}x_more_Crystal_Mobs_than_normal_to_start_each_day", baseValue: 900, extra: 0 },
  { idx: 16, description: "Get_}x_more_Worship_PTS_while_playing_Tower_Defence", baseValue: 100, extra: 0 },
  { idx: 17, description: "Stamina_Regeneration_Rate_in_Spelunking_is_}x_faster", baseValue: 200, extra: 0 },
  { idx: 18, description: "Multiplies_the_chance_for_Killroy_Skulls_to_drop_by_}x", baseValue: 200, extra: 0 },
  { idx: 19, description: "When_you_claim_48hrs_or_less_of_AFK_gains_on_a_Masterclass,_you_get_}x_more_AFK_items", baseValue: 200, extra: 0 },
  { idx: 20, description: "All_of_your_Vials_give_}x_higher_bonuses_than_normal", baseValue: 50, extra: 0 },
  { idx: 21, description: "All_of_your_Sigils_give_}x_higher_bonuses_than_normal", baseValue: 40, extra: 0 },
  { idx: 22, description: "All_of_your_Starsigns_give_}x_higher_bonuses_than_normal", baseValue: 60, extra: 0 },
  { idx: 23, description: "All_of_your_Slab_give_}x_higher_bonuses_than_normal", baseValue: 30, extra: 0 },
  { idx: 24, description: "Your_Brain_Coral_gives_}x_more_daily_LVs_for_your_Grind_Time_bubble", baseValue: 200, extra: 0 },
  { idx: 25, description: "All_masterclasses_find_}x_more_Bones,_Dust,_and_Tachyons", baseValue: 200, extra: 0 },
  { idx: 26, description: "All_of_your_Statues_give_}x_higher_bonuses_than_normal", baseValue: 50, extra: 0 },
  { idx: 27, description: "Multiplies_Class_EXP_gain_by_}x", baseValue: 150, extra: 0 },
];

/* voteMulti (N.js "VotingBonuszMulti"==d, _customBlock_Summoning2) — CONFIRMED verbatim, matches
 * idleon-toolbox's transcription term for term. category(b).bonus = VOTE_BALLOT_CATEGORIES[b]
 * .baseValue * voteMulti, but ONLY while b is the currently-selected category (else 0). */
export function voteMulti({ poppyBonus, meritocracyBonus, companionBonus3, equinoxBonus, cosmoBonus,
  winnerBonus, eventShopBonus2, eventShopBonus3, companionBonus2, paletteBonus, legendTalentBonus2,
  ballotSushiBonus }) {
  return (1 + poppyBonus / 100)
    * (1 + meritocracyBonus / 100)
    * (1 + (companionBonus3 + equinoxBonus + (cosmoBonus + (winnerBonus +
      (17 * eventShopBonus2 + 13 * eventShopBonus3 + (companionBonus2 + (paletteBonus +
        (legendTalentBonus2 + ballotSushiBonus))))))) / 100);
}

/* meritocracyMult (N.js "MeritocBonuszMulti"==d) — CONFIRMED verbatim, INCLUDING the
 * voting-unlock gate term `min(1,max(.25,.25+canVote))` that idleon-toolbox's TS silently drops
 * (they hardcode it to 1). Pass canVote=1 (OptLacc[472]==1) to reproduce toolbox's simplified
 * formula exactly; canVote=0 models the pre-unlock 0.25-base state. category(b).bonus =
 * MERITOCRACY_CATEGORIES[b].baseValue * meritocracyMult, but ONLY while b == OptLacc[453] (else 0). */
export function meritocracyMult({ poppyBonus, canVote, clamWorkBonus, companionBonus, legendTalentBonus,
  arcadeBonus, meritocracyEventShopBonus, meritocracySushiBonus }) {
  const gate = Math.min(1, Math.max(0.25, 0.25 + canVote));
  return (1 + poppyBonus / 100) * (gate + (5 * clamWorkBonus
    + (companionBonus + (legendTalentBonus + (arcadeBonus
      + (20 * meritocracyEventShopBonus + meritocracySushiBonus))))) / 100);
}
