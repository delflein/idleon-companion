/* stats/w6-report.mjs — the /api/w6 payload: a small STATIC glossary for World 6 (Spirited
 * Valley) that w6.html needs but the entities.w6 shape (domain.mjs) intentionally does not
 * carry, because it's account-independent gamedata rather than a parsed save value:
 *   - JADE EMPORIUM item descriptions (entities.w6.sneaking.emporium.list carries idx/name/
 *     owned only, not what the unlock actually DOES — the checklist's (i) tooltip needs it)
 *   - GOLDEN FOOD flavor text (entities.w6.beanstalk.foods carries effect id/amount/rank, not
 *     the human sentence describing the bonus — the "[" placeholder is filled client-side from
 *     the food's own `amount` field, already on the entity)
 *   - SUMMONING UPGRADE bonus text (entities.w6.summoning has aggregate counts only — upgrade
 *     names/costs/bonus text live in gamedata-w6-summoning.mjs, static flavor for the upgrades
 *     table's row tooltip)
 *   - NINJA (Sneaking) UPGRADE description text, same reasoning for the sneaking upgrades table
 *
 * No save parsing here — this never changes between snapshots, so it takes no argument and does
 * no per-account computation. Pages must not import gamedata-*.mjs directly (see README "For a
 * new STAT specifically" / implementation guide §3) — this is the sanctioned server-side seam
 * for that data to reach the browser. Same pattern as stats/w1-report.mjs .. w5-report.mjs.
 */
import { JADE_EMPORIUM, NINJA_UPGRADES, GEMSTONES } from "../../gamedata/gamedata-w6-sneaking.mjs";
import { SUMMON_UPGRADES } from "../../gamedata/gamedata-w6-summoning.mjs";
import { GOLDEN_FOODS, BEANSTALK_SLOTS } from "../../gamedata/gamedata-w6-beanstalk.mjs";

/* N.js text tables encode spaces as "_" and leave "{"/"}"/"<"/">"/"$"/"@"/"#" as unfilled value
 * placeholders (the live number they'd substitute is shown separately, from the entity's own
 * computed fields) — strip those rather than show raw punctuation in the UI. "_@_" (a section
 * break) becomes ". " so multi-clause descriptions still read as sentences. Same convention as
 * stats/w1-report.mjs..w5-report.mjs's clean(). "[" is NOT stripped here — it's the Golden Food
 * amount placeholder (gamedata-w6-beanstalk.mjs's own convention), left for the page to fill in
 * from the entity's `amount` field. */
const clean = (s) => String(s ?? "")
  .replace(/_*@_*/g, ". ")
  .replace(/[{}<>$@#]/g, "")
  .replace(/_/g, " ")
  .replace(/\s+/g, " ")
  .replace(/(\. )+/g, ". ")
  .replace(/^\. |\. $/g, "")
  .trim();

const UNCAPTURED = /not captured|not verified|unverified/i;

export function w6Glossary() {
  return {
    jadeEmporium: JADE_EMPORIUM.map((r) => ({
      idx: r.idx,
      desc: UNCAPTURED.test(r.description ?? "") ? null : clean(r.description),
    })),
    goldenFoods: BEANSTALK_SLOTS.map((slot) => {
      const food = GOLDEN_FOODS.find((f) => f.key === slot.key);
      return { index: slot.index, desc: food ? clean(food.desc.join(" ")) : null };
    }),
    summonUpgrades: SUMMON_UPGRADES.map((u) => ({ idx: u.idx, desc: clean(u.bonus) })),
    ninjaUpgrades: NINJA_UPGRADES.map((u) => ({
      idx: u.idx,
      desc: UNCAPTURED.test(u.description ?? "") ? null : clean(u.description),
    })),
    gemstones: GEMSTONES.map((g) => ({ idx: g.idx, desc: clean(g.description) })),
  };
}
