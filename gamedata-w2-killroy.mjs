/* gamedata-w2-killroy.mjs — Killroy's permanent-upgrade SHOP (World 2, Yum-Yum Desert),
 * extracted verbatim from N.js. This is the SKULL-currency purchase table — a DIFFERENT thing
 * from `killroyBonus(ctx,b)` in bonuses/misc.mjs, which only implements the RandomEvent(
 * "KillroyBonuses",b) *consumption* formulas for b=0 and b=1. Do not duplicate that function
 * here; this file documents the shop ROWS (what you spend skulls on) and, for completeness,
 * transcribes the FULL b=0..7 KillroyBonuses dispatch (misc.mjs only has b=0/1) as a reference
 * comment block so a future PR can extend killroyBonus without re-deriving it.
 *
 * TABLE — na.SkullShopDesc() (N.js:24034), assigned into CustomLists.h.SkullShopDesc at engine
 * init (two call sites doing the same assignment: N.js:30244 and N.js:34307 — apparently two
 * redundant init paths, both `e=na.SkullShopDesc();X.h.SkullShopDesc=e`). Row shape, CSV-less
 * (each row is already a JS array literal, not a comma-string like stamps):
 *   [0] description   — pipe `|` is the game's manual 2-line tooltip break (kept verbatim, not
 *                        normalized to `_`, matching the STAMP_INFO convention in gamedata-stamps.mjs)
 *   [1] skullCost      — SKULLS spent per purchase; OptLacc[105] is the skull-currency balance
 *   [2] dropFlag       — "1" if this row hands you a physical/pickup item via DropSomething
 *                        (rows 0,1,2,4,8,9); "0" if it's a counter/formula effect (all other rows)
 *   [3] itemRawName    — raw item name for dropFlag=1 rows; "#" is replaced with a random 1-3
 *                        range number at drop time (Timecandy# -> Timecandy1/2/3). Vestigial/
 *                        unused for dropFlag=0 rows (still present in the literal but never read).
 *   [4] qty            — item quantity for dropFlag=1 rows; effect magnitude for several
 *                        dropFlag=0 rows (see per-row notes below); UNUSED (dead data) for a few
 *                        rows whose consumer hardcodes its own magnitude instead (see row 5).
 *
 * CONSUMER — the big idx-dispatch on `this._Qinfo[7]` (the clicked shop-slot index) inside the
 * Killroy actor's click handler, N.js:5842-5847 (buy-effect branch) continuing to the tooltip
 * text builder at N.js:5869-5875. Purchase gate (all rows):
 *   Qinfo[7] != -1 && OptLacc[105] >= SkullShopDesc[idx][1]
 *     && !( (OptLacc[227]==1 && idx==10) || (OptLacc[417]>=50 && idx==5) )
 *   -> OptLacc[105] -= SkullShopDesc[idx][1]                              // always, on any buy
 * The two extra lockouts above are ROW-SPECIFIC caps, not part of the generic gate:
 *   idx==10 (3rd Weekly Fight roll) locks out once already won (OptLacc[227]==1) — one-time.
 *   idx==5  (Arcade Balls) locks out once bought 50 times (OptLacc[417]>=50) — a purchase cap.
 * 0 mismatches vs idleon-toolbox website-data.json `killRoySkullShop` (20/20 rows; toolbox's
 * x1/x2/x3/bonusName fields map 1:1 to columns [1]/[2]/[4]/[3] respectively — note the field
 * ORDER differs from N.js's own column order, toolbox re-keys it).
 *
 * Refresh note: re-run the extraction script against a fresh N.js after any patch that touches
 * Killroy (watch for `na.SkullShopDesc=function(){return[` — the array is single-line minified,
 * search for it directly rather than trusting line numbers, which drift patch to patch). */

export const KILLROY_SHOP = [
  { idx: 0, description: "Get_a_random_time_candy!_Pick_it|up_off_the_floor.", skullCost: 5, dropFlag: 1, item: "Timecandy#", qty: 1,
    effect: "DropSomething(Timecandy1/2/3 at random, qty 1) — 10% roll picks from Timecandy2-3, else Timecandy1-2 (see N.js:5843 randomInt(2,3) vs randomInt(1,2) branch)." },
  { idx: 1, description: "Get_a_black_pearl,_gives_Skill|EXP!_Pick_it_up_off_the_floor.", skullCost: 9, dropFlag: 1, item: "Pearl4", qty: 1,
    effect: "DropSomething(Pearl4, qty 1) — Skill EXP pearl." },
  { idx: 2, description: "Get_a_white_pearl,_gives_Class|EXP!_Pick_it_up_off_the_floor.", skullCost: 10, dropFlag: 1, item: "Pearl5", qty: 1,
    effect: "DropSomething(Pearl5, qty 1) — Class EXP pearl." },
  { idx: 3, description: "Your_next_kill_spawns_1_Crystal|Mob!_Expires_at_end_of_day!", skullCost: 3, dropFlag: 0, item: "Timecandy1", qty: 1,
    effect: "OptLacc[101] -= col[4] (=1). OptLacc[101] semantics not independently re-derived here (likely a same-day Crystal-Mob-guarantee countdown/flag); one-shot, expires end of day per description." },
  { idx: 4, description: "Get_a_Dungeon_Loot_Dice!_Pick_it|up_off_the_floor.", skullCost: 6, dropFlag: 1, item: "LootDice", qty: 1,
    effect: "DropSomething(LootDice, qty 1)." },
  { idx: 5, description: "Get_10_Balls!_They're_put_right|into_the_arcade!", skullCost: 4, dropFlag: 0, item: "Timecandy1", qty: 6,
    effect: "OptLacc[74] += 10 (FIXED, NOT col[4] — the row's qty=6 is dead/unused data), OptLacc[417] += 1 (purchase counter; row locks out once this reaches 50, per the generic gate above). OptLacc[74] = Arcade Balls balance." },
  { idx: 6, description: "Get_2_Library_Checkouts!_It's_put|right_into_the_library!", skullCost: 8, dropFlag: 0, item: "Timecandy1", qty: 2,
    effect: "OptLacc[55] += col[4] (=2). OptLacc[55] = Library Checkouts count." },
  { idx: 7, description: "Complete_1_Refinery_Cycle_auto-|matically,_right_here_right_now!", skullCost: 1, dropFlag: 0, item: "Timecandy1", qty: 1,
    effect: "For up to min(2, 1+floor(Refinery[0][0]/3)) active refinery slots: Refinery[0][slot+1] += Refinery(\"CycleInitialTime\",slot) * col[4] (=1) — instantly completes 1 cycle's worth of progress per eligible slot." },
  { idx: 8, description: "Get_2_Mob_Eggs!_Pick_them_up_off|the_floor.", skullCost: 8, dropFlag: 1, item: "PetEgg", qty: 2,
    effect: "DropSomething(PetEgg, qty 2)." },
  { idx: 9, description: "Get_3_Kitchen_Ladles!_Pick_them|up_off_the_floor.", skullCost: 5, dropFlag: 1, item: "Ladle", qty: 3,
    effect: "DropSomething(Ladle, qty 3)." },
  { idx: 10, description: "1%_Chance_to_permanently_unlock|the_3rd_Killroy_Weekly_Fight!", skullCost: 4, dropFlag: 0, item: "Timecandy1", qty: 1,
    effect: "1% roll (randomInt(1,100)==1): success sets OptLacc[227]=1 (permanent, and the generic gate then blocks re-buying this row) + \"SF1\" success popup. Failure: \"SF2\" popup only, no other effect, currency still spent — infinitely re-rollable until it hits." },
  { idx: 11, description: "Permanently_boosts_Artifact_Find|Chance!_Current_bonus_is_{x", skullCost: 9, dropFlag: 0, item: "Timecandy1", qty: 2,
    effect: "OptLacc[228] += 1 (purchase counter). Consumed by RandomEvent(\"KillroyBonuses\",0) = 1 + OptLacc[228]/(300+OptLacc[228]) — ALREADY IMPLEMENTED as killroyBonus(ctx,0) in bonuses/misc.mjs. Tooltip's `{x` placeholder is filled with floor(100*that value)/100 (N.js:5869)." },
  { idx: 12, description: "Adds_1_nugget_to_your_Shovel|in_Gaming,_go_dig_it_up!", skullCost: 5, dropFlag: 0, item: "Timecandy1", qty: 1,
    effect: "Not a counter row — directly manipulates the Gaming shovel dig-timer: DummyNumber3 = floor((GamingSprout[26][1]/3600)^0.44); GamingSprout[26][1] = 3600*((DummyNumber3+1)^2.272727 - DummyNumber3^2.272727) + GamingSprout[26][1]. Net effect per the description: +1 diggable nugget. No KillroyBonuses tie-in." },
  { idx: 13, description: "Permanently_boosts_Crop_Evolution|Chance!_Current_bonus_is_{x", skullCost: 6, dropFlag: 0, item: "Timecandy1", qty: 2,
    effect: "OptLacc[229] += 1 (purchase counter). Consumed by RandomEvent(\"KillroyBonuses\",1) = 1 + 9*OptLacc[229]/(300+OptLacc[229]) — ALREADY IMPLEMENTED as killroyBonus(ctx,1) in bonuses/misc.mjs (caps at x10)." },
  { idx: 14, description: "Permanently_boosts_Jade_Gain!|Current_bonus_is_{x", skullCost: 7, dropFlag: 0, item: "Timecandy1", qty: 3,
    effect: "OptLacc[230] += 1 (purchase counter). Consumed by RandomEvent(\"KillroyBonuses\",2) = 1 + 2*OptLacc[230]/(300+OptLacc[230]) — NOT yet in bonuses/misc.mjs (gap; add as killroyBonus b=2 in a follow-up)." },
  { idx: 15, description: "5%_Chance_for_+1_Grade_for|your_Gallery_in_World_7!", skullCost: 15, dropFlag: 0, item: "Timecandy1", qty: 1,
    effect: "Gated/pity mechanic on OptLacc[467] (World 7 Gallery grade counter, cap semantics unclear beyond this): if OptLacc[467] < 2, a 6% roll (randomInt(1,100)<6) is required to increment it (else fail popup, no increment); if OptLacc[467] >= 2 already, the increment is UNCONDITIONAL (no roll). Consumed by RandomEvent(\"KillroyBonuses\",3) = 10*OptLacc[467]/(200+OptLacc[467]) — note this formula has NO leading `1+`, it's a bare additive percentage, unlike most other KillroyBonuses cases. NOT yet in bonuses/misc.mjs." },
  { idx: 16, description: "Permanently_boosts_the_drops|of_Masterclasses_by_{x", skullCost: 7, dropFlag: 0, item: "Timecandy1", qty: 2,
    effect: "OptLacc[468] += 1 (purchase counter, unconditional). Consumed by RandomEvent(\"KillroyBonuses\",4) = 1 + 1.3*OptLacc[468]/(200+OptLacc[468]). NOT yet in bonuses/misc.mjs." },
  { idx: 17, description: "Permanently_boosts_EXP_gain|for_all_World_7_skills_by_{x", skullCost: 6, dropFlag: 0, item: "Timecandy1", qty: 1,
    effect: "OptLacc[469] += 1 (purchase counter, unconditional). Consumed by RandomEvent(\"KillroyBonuses\",5) = 1 + 0.8*OptLacc[469]/(150+OptLacc[469]). NOT yet in bonuses/misc.mjs." },
  { idx: 18, description: "Permanently_boosts_daily_coral|gain_by_+{%", skullCost: 10, dropFlag: 0, item: "Timecandy1", qty: 2,
    effect: "OptLacc[470] += 1 (purchase counter, unconditional). Consumed by RandomEvent(\"KillroyBonuses\",6) = 25*OptLacc[470]/(250+OptLacc[470]) — again a bare additive percentage, no leading `1+` (consistent with the `+{%` description format vs the `{x` multiplier format used by most other rows). NOT yet in bonuses/misc.mjs." },
  { idx: 19, description: "Permanently_boosts_something...|Current_bonus_is_{x", skullCost: 12, dropFlag: 0, item: "Timecandy1", qty: 3,
    effect: "OptLacc[471] += 1 (purchase counter, unconditional). Consumed by RandomEvent(\"KillroyBonuses\",7) = 1 + 2*OptLacc[471]/(200+OptLacc[471]). The description is genuinely a joke/mystery placeholder in the client's own text (\"something...\") — not an extraction artifact. NOT yet in bonuses/misc.mjs." },
];

/* KillroyBonuses FULL dispatch (RandomEvent("KillroyBonuses",b), N.js ~17851, same function
 * bonuses/misc.mjs's killroyBonus() already implements for b=0/1). Transcribed here in full as a
 * REFERENCE ONLY — do not re-implement; extend bonuses/misc.mjs::killroyBonus if these are needed:
 *   b=0 -> 1 + OptLacc[228]/(300+OptLacc[228])          [row 11, Artifact Find]      -- in misc.mjs
 *   b=1 -> 1 + 9*OptLacc[229]/(300+OptLacc[229])         [row 13, Crop Evolution]     -- in misc.mjs
 *   b=2 -> 1 + 2*OptLacc[230]/(300+OptLacc[230])         [row 14, Jade Gain]
 *   b=3 -> 10*OptLacc[467]/(200+OptLacc[467])            [row 15, Gallery Grade]      -- bare %, no +1
 *   b=4 -> 1 + 1.3*OptLacc[468]/(200+OptLacc[468])       [row 16, Masterclass drops]
 *   b=5 -> 1 + 0.8*OptLacc[469]/(150+OptLacc[469])       [row 17, World 7 skill EXP]
 *   b=6 -> 25*OptLacc[470]/(250+OptLacc[470])            [row 18, daily coral gain]   -- bare %, no +1
 *   b=7 -> 1 + 2*OptLacc[471]/(200+OptLacc[471])         [row 19, "something..."]
 *   default -> 1
 */
export const KILLROY_BONUS_DISPATCH_NJS_REF =
  "N.js ~17851, _customBlock_RandomEvent, \"KillroyBonuses\"==d branch — see comment block above for the full b=0..7 transcription.";
