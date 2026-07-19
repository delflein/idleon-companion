/* stats/w7-report.mjs — the /api/w7 payload: a small STATIC glossary for World 7 (Shimmerfin
 * Deep) that the W7 pages need but entities.w7 (domain.mjs) intentionally does not carry, because
 * it's account-independent gamedata rather than a parsed save value:
 *   - RESEARCH GRID TOOLS (shapes/lenses placed on the grid — flavor only, no save state)
 *   - OBSERVATION POOL (the 32 "...head" names/tiers players roll into slots — entities.w7.research
 *     only carries the OWNED COUNT, not the pool identities)
 *   - FARMING STICKERS (the 7 real Research-Grid-unlocked sticker bonuses — flavor only)
 *   - SPELUNKING SHOP descriptions (entities.w7.spelunking.shopLevels carries id/name/level/maxLv
 *     only, not the upgrade's effect sentence — the shop table's row tooltip needs it)
 *   - SPELUNKING LORE CHAPTERS (the chapter/page bonus names — entities.w7 has no page-read
 *     progress, Spelunk[8] is an undocumented savemap gap, so this is flavor-only reference, not
 *     live progress)
 *   - SUSHI SHOP (the full 45-row upgrade table — entities.w7.sushi has NO per-upgrade-level array
 *     at all, only the aggregate `shopBought` count, so this is reference-only, not owned levels)
 *   - MINEHEAD SHOP descriptions (entities.w7.minehead.shopLevels carries id/name/level/maxLv only)
 *   - GLIMBO trade cost-growth rate (entities.w7.minehead.glimboTrades has gridNode/item/trades;
 *     the geometric cost-growth constant is static flavor, not a save value)
 *   - THE BUTTON's 57-task pool (entities.w7.button carries presses + tasksTotal only — the
 *     currently active task needs a runtime shuffle table not embedded in N.js, honestly null)
 *   - ZENITH MARKET descriptions (entities.w7.zenith.levels carries the row's SLUG id, not its
 *     flavor sentence — Ya.ZenithMarket's own row array has no separate save-derived text)
 *   - CORAL REEF / DANCING CORAL / CLAM WORK / ADVICE FISH descriptions — entities.w7 DOES carry
 *     these (domain.mjs's `dash()` helper), but `dash()` only replaces "_" with a space; it does
 *     NOT strip the "{"/"}"/"$"/"^"/"~" template placeholders these particular tables are full of
 *     (CORAL_KID, CORAL_REEF_BUILDINGS, DANCING_CORAL, CLAM_UPG all use them). Rather than have
 *     every page re-implement the same clean() regex, this glossary supplies the FULLY CLEANED
 *     text for those four tables too, keyed by id so pages can zip them onto the entity's
 *     level/bonus numbers without doing their own text munging (matches the "pages never regex
 *     N.js text themselves" convention from w1..w6Glossary).
 *
 * No save parsing here — this never changes between snapshots, so it takes no argument and does
 * no per-account computation. Pages must not import gamedata-*.mjs directly (see README "For a
 * new STAT specifically" / implementation guide §3) — this is the sanctioned server-side seam for
 * that data to reach the browser. Same pattern as stats/w1-report.mjs .. w6-report.mjs.
 */
import { RESEARCH_SHAPES, RESEARCH_LENSES, OBSERVATIONS, FARMING_STICKERS, GLIMBO_TRADES } from "../../gamedata/gamedata-w7-research.mjs";
import { SPELUNK_SHOP, SPELUNK_CHAPTERS } from "../../gamedata/gamedata-w7-spelunking.mjs";
import { SUSHI_SHOP } from "../../gamedata/gamedata-w7-sushi.mjs";
import { MINEHEAD_SHOP } from "../../gamedata/gamedata-w7-minehead.mjs";
import { BUTTON_TASKS } from "../../gamedata/gamedata-w7-button.mjs";
import { ZENITH_MARKET } from "../../gamedata/gamedata-w7-zenith.mjs";
import { CORAL_KID, CORAL_REEF_BUILDINGS, DANCING_CORAL } from "../../gamedata/gamedata-w7-coralreef.mjs";
import { CLAM_UPG } from "../../gamedata/gamedata-w7-clamwork.mjs";
import { BIG_FISH } from "../../gamedata/gamedata-w7-spelunking.mjs";

/* N.js text tables encode spaces as "_" and leave "{"/"}"/"<"/">"/"$"/"^"/"~"/"#" as unfilled
 * value placeholders (the live number they'd substitute is shown separately, from the entity's own
 * computed fields, when one exists) — strip those rather than show raw punctuation in the UI.
 * "_@_" (a section break) becomes ". " so multi-clause descriptions still read as sentences. "|"
 * (used inside SPELUNK_CHAPTERS names as a manual line-break marker) becomes a space. Same
 * convention as stats/w1-report.mjs..w6-report.mjs's clean() / stats/legend-talents.mjs's clean(),
 * merged to cover every placeholder character seen across the W7 tables. */
const clean = (s) => String(s ?? "")
  .replace(/_*@_*/g, ". ")
  .replace(/\|/g, " ")
  .replace(/[{}<>$^~#]/g, "")
  .replace(/_/g, " ")
  .replace(/\s+/g, " ")
  .replace(/(\. )+/g, ". ")
  .replace(/^\. |\. $/g, "")
  .trim();

const FILLER = /^(Filler|Nonexistent)/i;

export function w7Glossary() {
  return {
    researchTools: {
      shapes: RESEARCH_SHAPES.map((s) => ({ name: clean(s.name), effect: clean(s.effect) })),
      lenses: RESEARCH_LENSES.map((l) => ({ name: clean(l.name), desc: clean(l.desc) })),
    },
    observations: OBSERVATIONS.map((o, i) => ({ idx: i, name: o.name.replace(/_/g, " "), tier: o.tier })),
    /* `kind` is derived from the RAW (pre-clean) desc's placeholder: "}x" = multiplicative
     * ("Multiplies X by }x"), "{%"/"~%" = additive percent — the cleaned text strips both
     * markers, so this has to be decided here, not re-guessed from the cleaned string. */
    farmingStickers: FARMING_STICKERS
      .map((s, idx) => ({ idx, name: clean(s.name), desc: s.desc ? clean(s.desc) : null, coeff: s.coeff,
        kind: /\}x/.test(s.desc ?? "") ? "mul" : "add" }))
      .filter((s) => s.desc && !FILLER.test(s.name)),
    spelunkShop: SPELUNK_SHOP.map((r) => ({ id: r.id, desc: clean(r.desc) })),
    spelunkChapters: SPELUNK_CHAPTERS.map((rows, chapter) => ({
      chapter,
      rows: rows.filter((r) => !FILLER.test(r.name)).map((r, slot) => ({ slot, name: clean(r.name) })),
    })).filter((c) => c.rows.length),
    sushiShop: SUSHI_SHOP.map((r) => ({ id: r.id, name: clean(r.name), maxLv: r.maxLv, desc: clean(r.desc) })),
    mineheadShop: MINEHEAD_SHOP.map((r) => ({ id: r.id, desc: clean(r.desc) })),
    glimboCostGrowth: GLIMBO_TRADES.map((t, idx) => ({ idx, costGrowth: t.costGrowth })),
    buttonTasks: BUTTON_TASKS.map((t) => ({ id: t.id, desc: clean(t.desc), threshold: t.threshold, mode: t.mode, coeff: t.coeff })),
    zenithMarket: ZENITH_MARKET.map((r, b) => ({ id: b, slug: r.id, desc: clean(r.desc), maxLv: r.maxLv })),
    coralKid: CORAL_KID.map((r, b) => ({ id: b, desc: clean(r.desc) })),
    coralBuildings: CORAL_REEF_BUILDINGS.map((r, b) => ({ id: b, desc: clean(r.desc) })),
    dancingCoral: DANCING_CORAL.map((r, b) => ({ id: b, desc: clean(r.desc) })),
    clamUpgrades: CLAM_UPG.map((r, b) => ({ id: b, desc: clean(r.desc) })),
    adviceFish: BIG_FISH.map((r, b) => ({ id: b, desc: clean(r.text) })),
  };
}
