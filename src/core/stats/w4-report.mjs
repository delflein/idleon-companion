/* stats/w4-report.mjs — the /api/w4 payload: a small STATIC glossary for World 4 (Hyperion
 * Nebula) that w4.html needs but the entities.w4 shape (domain.mjs) intentionally does not
 * carry, because it's account-independent gamedata rather than a parsed save value:
 *   - BREEDING UPGRADE effect text (entities.w4.breeding.upgrades carries level/maxLevel/bonus,
 *     not what the upgrade's bonus number actually DOES — PET_UPGRADES' `boostEffect` has that)
 *   - COOKING MASTERY category unlock rank + source description (entities.w4.cooking.mastery.
 *     categories carries level/feedsExpRate, not the rank gate or what feeds the category)
 *   - RIFT reward milestones (entities.w4.rift carries the CURRENT tier/task only; the reward
 *     ladder — "what unlocks at Rift N" — is a static table the entity has no reason to repeat
 *     on every snapshot)
 *   - SKILL MASTERY rank thresholds (entities.w4.skillMastery.skills carries total/rank per
 *     skill, not the threshold ladder that explains WHY a skill sits at a given rank)
 *   - MEAL LEVEL CAP sources (entities.w4.mealCap carries the computed {value,lowerBound} only;
 *     the 5 named sources that can raise it are static flavor for the "why is my cap not 30"
 *     tooltip, not a value the save alone determines)
 *
 * No save parsing here — this never changes between snapshots, so it takes no argument and does
 * no per-account computation. Pages must not import gamedata-*.mjs directly (see README "For a
 * new STAT specifically" / implementation guide §3) — this is the sanctioned server-side seam
 * for that data to reach the browser. Same pattern as stats/w1-report.mjs / w2-report.mjs /
 * w3-report.mjs.
 */
import { PET_UPGRADES, PET_SPECIES } from "../../gamedata/gamedata-w4-breeding.mjs";
import { COOKING_MASTERY_CATEGORIES } from "../../gamedata/gamedata-w4-cooking.mjs";
import { RIFT_REWARDS, RIFT_REWARD_UNLOCK_AT, SKILL_MASTERY_RANK_THRESHOLDS, SKILL_MASTERY_UNLOCK_RIFT } from "../../gamedata/gamedata-w4-rift.mjs";
import { MEAL_LEVEL_CAP_SOURCES, RIBBON_MAX_LV } from "../../gamedata/gamedata-w4-meals.mjs";

/* N.js text tables encode spaces as "_" and leave "{"/"}"/"<"/">"/"$" as unfilled value
 * placeholders (the live number they'd substitute is shown separately, from the entity's own
 * computed fields) — strip all five rather than show raw punctuation in the UI. Same convention
 * as stats/w1-report.mjs / w2-report.mjs / w3-report.mjs's clean(). "_@_" (a section break)
 * becomes ". " so multi-clause descriptions still read as sentences. */
const clean = (s) => String(s ?? "")
  .replace(/_@_/g, ". ")
  .replace(/[{}<>$@]/g, "")
  .replace(/_/g, " ")
  .replace(/\s+/g, " ")
  .trim();

export function w4Glossary() {
  return {
    breedingUpgradeEffects: PET_UPGRADES.filter((u) => u.idx > 0).map((u) => ({
      idx: u.idx, name: clean(u.name.replace(/_\}.*/, "")), effect: clean(u.boostEffect), maxLevel: u.maxLevel,
    })),
    cookingMasteryCategories: COOKING_MASTERY_CATEGORIES.map((c) => ({
      idx: c.idx, name: c.name, rankReq: c.rankReq, source: clean(c.source), feedsExpRate: c.feedsExpRate,
    })),
    riftRewards: RIFT_REWARDS.map((r, i) => ({ idx: r.idx, name: clean(r.name), unlockAt: RIFT_REWARD_UNLOCK_AT[i] })),
    skillMasteryThresholds: SKILL_MASTERY_RANK_THRESHOLDS,
    skillMasteryUnlockRift: SKILL_MASTERY_UNLOCK_RIFT,
    mealCapSources: [
      { name: "Base", note: "always on", cap: MEAL_LEVEL_CAP_SOURCES.base },
      { name: "Causticolumn artifact", note: MEAL_LEVEL_CAP_SOURCES.causticolumnArtifact.note, cap: null },
      { name: "Jade Emporium #20", note: MEAL_LEVEL_CAP_SOURCES.jadeEmporium20.note, cap: MEAL_LEVEL_CAP_SOURCES.jadeEmporium20.cap },
      { name: "Jade Emporium #21", note: MEAL_LEVEL_CAP_SOURCES.jadeEmporium21.note, cap: MEAL_LEVEL_CAP_SOURCES.jadeEmporium21.cap },
      { name: "Lore boss #5", note: MEAL_LEVEL_CAP_SOURCES.loreBoss5.note, cap: MEAL_LEVEL_CAP_SOURCES.loreBoss5.cap },
      { name: "Grimoire upgrade #26", note: MEAL_LEVEL_CAP_SOURCES.grimoire26.note, cap: MEAL_LEVEL_CAP_SOURCES.grimoire26.cap },
    ],
    ribbonMaxLv: RIBBON_MAX_LV,
    /* PET_SPECIES groups 0-3 (68 rows) are the real breedable World-4 roster — see that file's
     * header for why groups 4-7 (filler) and 8 (crystal/mimic aux list) are excluded. Used as the
     * denominator for a "species discovered X/68" tile; entities.w4.breeding.speciesUnlocked is
     * the save-derived numerator. */
    breedingSpeciesTotal: PET_SPECIES.filter((p) => p.group <= 3).length,
  };
}
