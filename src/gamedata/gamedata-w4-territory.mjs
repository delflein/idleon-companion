/* gamedata-w4-territory.mjs — World 4 Breeding "Territory" (forage zones) static table + the
 * forage-speed / reqProgress formula chain. Extracted verbatim from N.js (v1.19-era). GENERATED
 * by a one-off extraction script (scratchpad, not committed); refresh after a major patch.
 *
 * SOURCE TABLE: na.TerritoryInfo=function(){return[...]} — N.js:23984, closing `]};` on
 * N.js:23992, immediately before the UNRELATED na.TerritoryINF (no trailing "o") pet-battle
 * table at N.js:23993. DO NOT CONFUSE THE TWO — TerritoryINF (singular) is a different, combat
 * data structure, not consumed here.
 *
 * ROW COUNT GOTCHA: the research brief assumed 24 zones. The real table has **29 rows**, of
 * which **26 are real usable territories**. The 3 excluded rows:
 *   - idx 14 "BRuh": a joke/debug zone (fightPowerReq=77000, only reachable via a special
 *     `GenINFO[10]==14.5` debug path, N.js:12477) — not a normal player-facing zone.
 *   - idx 27, 28 "Filler_Filler": verbatim-duplicate unused placeholder rows (identical mob
 *     groups), reserved for future content.
 * The `26` figure is independently confirmed by TWO pieces of code:
 *   - `"maxTerritoryScroll"==d` (N.js:12477): cap = `min(20+Summon[3][2], TerritoryInfo.length-3)`
 *     = `TerritoryInfo.length - 3` once uncapped = 29-3 = 26.
 *   - The save-state initializer (N.js:9337-9339) pads the `Territory` game-attribute array to
 *     length 26.
 * Cross-checked against idleon-toolbox/data/website-data.json's `territory` array: also 29
 * entries exactly, and breeding.ts:81 independently excludes index 14 the same way
 * (`territory.filter((_, index) => index !== 14)`) — 0 row-count mismatch.
 *
 * ROW SHAPE (space-split): [0]=bg image, [1]=reqProgress BASE, [2]=fightPowerReq, [3]=enemyAttack,
 * [4]=zone name, [5-7]=Filler×3 (dropped), [8+]=mob groups of 4 fields each (name, hp, color,
 * size) — up to 5 groups per zone; filler mob slots use literal names "Mob2".."Mob5" with
 * non-numeric placeholder fields ("HP2","A","B") and are marked `{filler:true}` below instead of
 * parsed as numbers.
 *
 * NO PER-ZONE "SPICE REWARD" MAGNITUDE FIELD EXISTS. Spice TYPE = zone index (N.js:15985-15986:
 * `Territory[e][3] = "CookingSpice"+e`); the reward is a flat +1 spice per completed foraging
 * round (with a chance for a "type 17" pet in the team to add +1 more) — there is no stored
 * per-zone magnitude to extract.
 * -------------------------------------------------------------------------------------------- */
export const TERRITORY_INFO = [{"idx":0,"bg":"PetFightBG0.png","reqProgBase":5,"fightPowerReq":0,"enemyAttack":1,"name":"The_Grass_Gang","mobs":[{"name":"mushG","hp":10,"color":0,"size":200},{"name":"frogG","hp":30,"color":0,"size":300},{"name":"beanG","hp":50,"color":0,"size":300},{"name":"Mob4","filler":true},{"name":"Mob5","filler":true}]},{"idx":1,"bg":"5bg.png","reqProgBase":20,"fightPowerReq":0,"enemyAttack":3,"name":"The_Carrot_Crew","mobs":[{"name":"carrotO","hp":20,"color":0,"size":300},{"name":"carrotO","hp":50,"color":0,"size":300},{"name":"carrotO","hp":70,"color":0,"size":300},{"name":"carrotO","hp":150,"color":0,"size":300},{"name":"Mob5","filler":true}]},{"idx":2,"bg":"10bg.png","reqProgBase":100,"fightPowerReq":0,"enemyAttack":12,"name":"Big_Boy_Plank_and_the_Gs","mobs":[{"name":"goblinG","hp":200,"color":0,"size":200},{"name":"goblinG","hp":200,"color":0,"size":200},{"name":"plank","hp":500,"color":0,"size":400},{"name":"Mob4","filler":true},{"name":"Mob5","filler":true}]},{"idx":3,"bg":"4bg.png","reqProgBase":250,"fightPowerReq":0,"enemyAttack":20,"name":"Branchial_Heirarchy","mobs":[{"name":"branch","hp":100,"color":0,"size":100},{"name":"branch","hp":300,"color":348,"size":200},{"name":"branch","hp":600,"color":336,"size":300},{"name":"branch","hp":1200,"color":324,"size":400},{"name":"Mob5","filler":true}]},{"idx":4,"bg":"1bg.png","reqProgBase":1000,"fightPowerReq":0,"enemyAttack":35,"name":"Dr._Def,_phD_MD","mobs":[{"name":"poopBig","hp":5000,"color":0,"size":300},{"name":"poopBig","hp":10,"color":0,"size":100},{"name":"Mob3","filler":true},{"name":"Mob4","filler":true},{"name":"Mob5","filler":true}]},{"idx":5,"bg":"9bg.png","reqProgBase":2000,"fightPowerReq":0,"enemyAttack":70,"name":"Confetti_Cake_Brigade","mobs":[{"name":"crabcake","hp":200,"color":0,"size":300},{"name":"crabcake","hp":800,"color":70,"size":300},{"name":"crabcake","hp":2000,"color":140,"size":300},{"name":"crabcake","hp":3000,"color":210,"size":300},{"name":"crabcake","hp":6000,"color":280,"size":300}]},{"idx":6,"bg":"PetFightBG4.png","reqProgBase":5000,"fightPowerReq":0,"enemyAttack":150,"name":"The_Giant_Grumblo","mobs":[{"name":"rocky","hp":40000,"color":15,"size":600},{"name":"Mob2","filler":true},{"name":"Mob3","filler":true},{"name":"Mob4","filler":true},{"name":"Mob5","filler":true}]},{"idx":7,"bg":"14bg.png","reqProgBase":10000,"fightPowerReq":0,"enemyAttack":300,"name":"The_Beach_Boys","mobs":[{"name":"coconut","hp":10000,"color":200,"size":200},{"name":"coconut","hp":50000,"color":300,"size":300},{"name":"potato","hp":10000,"color":200,"size":200},{"name":"potato","hp":50000,"color":300,"size":300},{"name":"Mob5","filler":true}]},{"idx":8,"bg":"PetFightBG1.png","reqProgBase":20000,"fightPowerReq":0,"enemyAttack":600,"name":"The_Sands_of_Time","mobs":[{"name":"babaHour","hp":140000,"color":0,"size":300},{"name":"sandgiant","hp":10000,"color":0,"size":100},{"name":"sandgiant","hp":10000,"color":0,"size":100},{"name":"Mob4","filler":true},{"name":"Mob5","filler":true}]},{"idx":9,"bg":"20bg.png","reqProgBase":30000,"fightPowerReq":0,"enemyAttack":1500,"name":"The_Dungeoneering_Duo","mobs":[{"name":"babaMummy","hp":200000,"color":0,"size":200},{"name":"snakeZ","hp":500000,"color":0,"size":200},{"name":"Mob3","filler":true},{"name":"Mob4","filler":true},{"name":"Mob5","filler":true}]},{"idx":10,"bg":"PetFightBG2.png","reqProgBase":50000,"fightPowerReq":0,"enemyAttack":5000,"name":"The_Stray_Flock","mobs":[{"name":"sheep","hp":200000,"color":0,"size":100},{"name":"sheep","hp":600000,"color":0,"size":200},{"name":"sheep","hp":200000,"color":0,"size":100},{"name":"sheep","hp":600000,"color":0,"size":200},{"name":"sheep","hp":200000,"color":0,"size":100}]},{"idx":11,"bg":"PetFightBG3.png","reqProgBase":100000,"fightPowerReq":0,"enemyAttack":15000,"name":"The_Permafrost_Brothers","mobs":[{"name":"bloque","hp":1200000,"color":30,"size":400},{"name":"snowball","hp":1200000,"color":50,"size":400},{"name":"Mob3","filler":true},{"name":"Mob4","filler":true},{"name":"Mob5","filler":true}]},{"idx":12,"bg":"18bg.png","reqProgBase":250000,"fightPowerReq":0,"enemyAttack":25000,"name":"The_Coolest_Beats","mobs":[{"name":"speaker","hp":1500000,"color":0,"size":200},{"name":"speaker","hp":1500000,"color":0,"size":200},{"name":"iceknight","hp":5000000,"color":0,"size":200},{"name":"Mob4","filler":true},{"name":"Mob5","filler":true}]},{"idx":13,"bg":"17bg.png","reqProgBase":500000,"fightPowerReq":0,"enemyAttack":40000,"name":"The_Cursed_Shepherd_Boy","mobs":[{"name":"ram","hp":2000000,"color":0,"size":100},{"name":"ram","hp":5000000,"color":0,"size":200},{"name":"skele2","hp":12000000,"color":0,"size":300},{"name":"ram","hp":5000000,"color":0,"size":200},{"name":"ram","hp":3000000,"color":0,"size":100}]},{"idx":14,"bg":"PetFightBGz.png","reqProgBase":800000,"fightPowerReq":77000,"enemyAttack":1,"name":"BRuh","mobs":[{"name":"shovelR","hp":50,"color":0,"size":200},{"name":"shovelR","hp":50,"color":0,"size":200},{"name":"shovelR","hp":125,"color":0,"size":300},{"name":"Mob4","filler":true},{"name":"Mob5","filler":true}],"excluded":true,"excludedReason":"joke/debug zone, only reachable via GenINFO[10]==14.5"},{"idx":15,"bg":"8bg.png","reqProgBase":1250000,"fightPowerReq":0,"enemyAttack":75000,"name":"The_Blue_Jeans_Group","mobs":[{"name":"demonP","hp":5000000,"color":330,"size":200},{"name":"demonP","hp":10000000,"color":300,"size":200},{"name":"demonP","hp":15000000,"color":270,"size":200},{"name":"demonP","hp":20000000,"color":250,"size":200},{"name":"Mob5","filler":true}]},{"idx":16,"bg":"21bg.png","reqProgBase":1500000,"fightPowerReq":0,"enemyAttack":110000,"name":"The_Big_Fissure_Wurm","mobs":[{"name":"w4b5","hp":10000000,"color":0,"size":500},{"name":"Mob2","filler":true},{"name":"Mob3","filler":true},{"name":"Mob4","filler":true},{"name":"Mob5","filler":true}]},{"idx":17,"bg":"22bg.png","reqProgBase":3000000,"fightPowerReq":0,"enemyAttack":150000,"name":"Calamity_Clammies","mobs":[{"name":"w4c1","hp":25000000,"color":120,"size":400},{"name":"w4c1","hp":25000000,"color":240,"size":500},{"name":"Mob3","filler":true},{"name":"Mob4","filler":true},{"name":"Mob5","filler":true}]},{"idx":18,"bg":"24bg.png","reqProgBase":5000000,"fightPowerReq":0,"enemyAttack":200000,"name":"The_Suggma_Ballers","mobs":[{"name":"w5a1","hp":40000000,"color":0,"size":400},{"name":"w5a1","hp":40000000,"color":0,"size":300},{"name":"w5a1","hp":40000000,"color":0,"size":200},{"name":"w5a1","hp":40000000,"color":0,"size":300},{"name":"Mob5","filler":true}]},{"idx":19,"bg":"25bg.png","reqProgBase":10000000,"fightPowerReq":0,"enemyAttack":250000,"name":"The_Juicer_Gang","mobs":[{"name":"w5b3","hp":60000000,"color":80,"size":200},{"name":"w5b3","hp":60000000,"color":160,"size":200},{"name":"w5b3","hp":60000000,"color":220,"size":200},{"name":"w5b3","hp":60000000,"color":300,"size":200},{"name":"Mob5","filler":true}]},{"idx":20,"bg":"3bg.png","reqProgBase":15000000,"fightPowerReq":0,"enemyAttack":300000,"name":"The_Ultrawurm_et_All","mobs":[{"name":"w5c2","hp":90000000,"color":180,"size":400},{"name":"w5c1","hp":90000000,"color":0,"size":200},{"name":"w5c1","hp":90000000,"color":330,"size":200},{"name":"w5c1","hp":90000000,"color":30,"size":200},{"name":"w5c1","hp":90000000,"color":300,"size":300}]},{"idx":21,"bg":"27bg.png","reqProgBase":50000000,"fightPowerReq":0,"enemyAttack":500000,"name":"The_Dihydrogen_Monoxiders","mobs":[{"name":"w6a1","hp":200000000,"color":0,"size":200},{"name":"w6a1","hp":200000000,"color":0,"size":200},{"name":"w6a3","hp":200000000,"color":0,"size":300},{"name":"Mob4","filler":true},{"name":"Mob5","filler":true}]},{"idx":22,"bg":"28bg.png","reqProgBase":100000000,"fightPowerReq":0,"enemyAttack":700000,"name":"Mama_Mia_and_the_Babbies","mobs":[{"name":"w6b3","hp":700000000,"color":0,"size":400},{"name":"w6a4","hp":700000000,"color":0,"size":300},{"name":"w6a4","hp":200000000,"color":0,"size":200},{"name":"w6a4","hp":100000000,"color":0,"size":200},{"name":"w6a4","hp":1000,"color":0,"size":200}]},{"idx":23,"bg":"29bg.png","reqProgBase":300000000,"fightPowerReq":0,"enemyAttack":1000000,"name":"Mr_Johnson's_Pottery_Class","mobs":[{"name":"w6c1","hp":1500000000,"color":0,"size":500},{"name":"w6c1","hp":700000000,"color":40,"size":200},{"name":"w6c1","hp":500000000,"color":230,"size":200},{"name":"w6c1","hp":300000000,"color":110,"size":300},{"name":"w6c1","hp":200000000,"color":290,"size":200}]},{"idx":24,"bg":"29bg.png","reqProgBase":500000000,"fightPowerReq":0,"enemyAttack":1500000,"name":"Green_Eggs_and_BLAM","mobs":[{"name":"w6d1","hp":4000000000,"color":65,"size":600},{"name":"w6d1","hp":1000000000,"color":85,"size":200},{"name":"Mob3","filler":true},{"name":"Mob4","filler":true},{"name":"Mob5","filler":true}]},{"idx":25,"bg":"32bg.png","reqProgBase":1000000000,"fightPowerReq":0,"enemyAttack":2100000,"name":"The_Doodling_School","mobs":[{"name":"w7a2","hp":25000000000,"color":0,"size":200},{"name":"w7a2","hp":25000000000,"color":340,"size":200},{"name":"w7a2","hp":25000000000,"color":330,"size":200},{"name":"w7a2","hp":25000000000,"color":320,"size":200},{"name":"w7a2","hp":25000000000,"color":310,"size":200}]},{"idx":26,"bg":"33bg.png","reqProgBase":1500000000,"fightPowerReq":0,"enemyAttack":3000000,"name":"The_Koi_Gee_Biv_Crew","mobs":[{"name":"w7b1","hp":50000000000,"color":0,"size":200},{"name":"w7b1","hp":60000000000,"color":90,"size":200},{"name":"w7b1","hp":120000000000,"color":150,"size":200},{"name":"w7b1","hp":170000000000,"color":210,"size":200},{"name":"Mob5","filler":true}]},{"idx":27,"bg":"3bg.png","reqProgBase":1300000000,"fightPowerReq":0,"enemyAttack":2500000,"name":"Filler_Filler","mobs":[{"name":"w5c1","hp":1000000000,"color":0,"size":200},{"name":"w5c1","hp":2500000000,"color":330,"size":200},{"name":"w5c1","hp":4000000000,"color":30,"size":200},{"name":"w5c1","hp":6000000000,"color":300,"size":300},{"name":"w5c2","hp":50000000000,"color":180,"size":400}],"excluded":true,"excludedReason":"unused placeholder row (verbatim duplicate of idx 28)"},{"idx":28,"bg":"3bg.png","reqProgBase":1300000000,"fightPowerReq":0,"enemyAttack":2500000,"name":"Filler_Filler","mobs":[{"name":"w5c1","hp":1000000000,"color":0,"size":200},{"name":"w5c1","hp":2500000000,"color":330,"size":200},{"name":"w5c1","hp":4000000000,"color":30,"size":200},{"name":"w5c1","hp":6000000000,"color":300,"size":300},{"name":"w5c2","hp":50000000000,"color":180,"size":400}],"excluded":true,"excludedReason":"unused placeholder row (verbatim duplicate of idx 27)"}];

/** Player-facing territory indices — TERRITORY_INFO filtered to the 26 real zones (excludes 14/27/28).
 *  Use THIS for any UI iteration; the raw array above is kept intact for citation/audit purposes. */
export const TERRITORY_PLAYABLE = TERRITORY_INFO.filter((t) => !t.excluded);

/* --------------------------------------------------------------------------------------------
 * INDEX REMAP — TerritoryID(zoneUIindex e), N.js:12477 (`p._customBlock_Breeding`):
 *   TerritoryID(e) = 42==f ? e
 *     : (14.5==GenINFO[10] && 14.5==e ? 14 : Math.round(e + Math.floor((e+86.1)/100)));
 *   // Effectively identity for e<14, then e+1 for e>=14 — skips the excluded "BRuh" row 14 when
 *   // addressing TerritoryInfo[]/Territory[] from a player-facing zone index. (The `42==f` arm
 *   // is a passthrough used by other Breeding("...", "0", e, 42) callers that already pass a
 *   // raw array index and don't want the remap applied.)
 *
 * FORAGE SPEED — TotalTrekkingHR(zoneUIindex e), N.js:12441-12447 (`p._customBlock_PetStuff`).
 * Team = the 4 pets in `Pets[k + (27 + 4*TerritoryID(e))]` for k=0..3:
 *
 *   TotalTrekkingHR(e) = sum over k=0..3 of, for each non-"none" team pet:
 *       PetStuff("Trekking", "0", k, TerritoryID(e))              // per-pet base forage value —
 *                                                                    further dispatcher, keyed by
 *                                                                    the pet's gene type; NOT
 *                                                                    expanded here
 *     * (1 + Summoning("VaultUpgBonus",56,0)/100)                  // Upgrade Vault bonus 56, not expanded
 *   ... then, sequentially, CONDITIONAL multipliers applied to the running total:
 *     * 1.3   if any team pet has gene abilityType-adjacent "type 3" in this zone's team
 *     * 1.2   if a "type 18" pet is present in the PREVIOUS zone's (e-1) team
 *     * 1.5   (type 14 pet) — gated on all 4 team slots having PetGenes[...][1]==0 (a specific
 *              precondition on the whole team's gene ability-type column)
 *     * 1.5   (type 13 pet) — same gate as above
 *     * 4x on the 4th unique species — "type 26" pet, no-duplicate-species-in-team check
 *   // "type N" above refers to the pet's PetGenes row index, NOT the PET_GENES export's `idx`
 *   // being literally 3/13/14/18/26 in every case verified — cross-check against
 *   // idleon-toolbox's getForageSpeed() (breeding.ts:335-356) before wiring a recipe; it
 *   // resolves these by GENE NAME (Forager/Targeter/Opticular/Borger etc.) which is easier to
 *   // read than the raw type numbers transcribed here.
 *
 * REQPROGRESS (exponential growth per completed round) — TotalTrekkingREQ(zoneUIindex e),
 * N.js:12447-12449:
 *   type16Count = count of PetGenes-type-16 pets in this zone's current team
 *   bonus       = 1 + .02 / (type16Count/5 + 1)          // default 1.02 with 0 type-16 pets;
 *                                                          // MORE type-16 pets SLOW growth toward 1.0
 *   reqProgress(e) = ( TerritoryInfo[TerritoryID(e)].reqProgBase + Territory[TerritoryID(e)][1] )
 *                    * Math.pow(bonus, Territory[TerritoryID(e)][1]);
 *   // Territory[zone][1] = the FORAGING ROUND COUNT (increments every time reqProgress is met —
 *   // this is the recursive "pow(bonus, foragingRounds)" pattern from the research brief).
 *
 * PROGRESS ACCUMULATION LOOP, N.js:15984-15985:
 *   Territory[e][0] += GenINFO[35] * (TotalTrekkingHR(e) / 3600);    // GenINFO[35] = elapsed seconds
 *   while (Territory[e][0] >= TotalTrekkingREQ(e)) {
 *     Territory[e][0] -= TotalTrekkingREQ(e);
 *     Territory[e][1] += 1;                                          // round++, feeds back into
 *   }                                                                 // TotalTrekkingREQ's exponent
 *   // Gated by the fight-power check below — no progress accrues at all if team fight power is
 *   // under the zone's requirement.
 *
 * FIGHT-POWER GATE (a companion mechanism found alongside, not asked for but needed to model
 * "can this zone forage at all"):
 *   TotalTrekkingFightPowREQ(e) = TerritoryInfo[TerritoryID(e)].fightPowerReq   // raw col2, mostly 0
 *   TotalTrekkingFightPOW(e)    = sum of PetStuff("Trekking",...) over COMBAT-type team pets, with
 *                                  a conditional 1.5x multiplier gated on Breeding[2][6]>0 (the
 *                                  "Blooming_Axe" upgrade, PET_UPGRADES idx 6 in
 *                                  gamedata-w4-breeding.mjs) — not expanded further here.
 *   Gate (N.js:15984): forage progress only accrues if
 *     TotalTrekkingFightPOW(e) >= TotalTrekkingFightPowREQ(e).
 * -------------------------------------------------------------------------------------------- */
export const TREKKING_BONUS_BASE = 1.02;   // 1 + .02/(type16PetCount/5+1) with 0 type-16 pets

/* Cross-check: idleon-toolbox/data/website-data.json's `territory` array (29 entries) and
 * parsers/world-4/breeding.ts (lines 74-116, 335-362) reproduce every field and formula above
 * exactly — same reqProgress formula/constants, same index-14 exclusion, same fight-power gate.
 * One non-conflict: website-data.json additionally carries a friendly "territoryName" overlay
 * (e.g. "Grasslands", "Jungle") for indices 0-24 only — NOT present in N.js's na.TerritoryInfo at
 * all; it's a toolbox/wiki display-name convenience, not raw game data. Use TERRITORY_INFO[i].name
 * (the underscored raw name, e.g. "The_Grass_Gang") as the primary-source label instead. */
