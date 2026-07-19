/* stats/w5-report.mjs — the /api/w5 payload: a small STATIC glossary for World 5 (Smolderin'
 * Plateau) that w5.html needs but the entities.w5 shape (domain.mjs) intentionally does not
 * carry, because it's account-independent gamedata rather than a parsed save value:
 *   - SUPERBIT flavor text (entities.w5.gaming.superbits.list carries idx/name/owned only — not
 *     what buying the bit actually DOES, which the hex-grid checklist's (i) tooltip needs)
 *   - GOD major-blessing / "third" / gift-flavor text (entities.w5.divinity.gods carries the
 *     computed majorValue number and the cleaned minorDesc, not the MAJOR blessing's own effect
 *     sentence or the still-unresolved "thirdDesc" field — static flavor, not a save value)
 *   - VILLAGER flavor text (entities.w5.villagers carries level/expPerHr/opals, not what each
 *     villager role actually unlocks — static flavor for the Cavern module's tooltip)
 *
 * No save parsing here — this never changes between snapshots. Pages must not import
 * gamedata-*.mjs directly (see README "For a new STAT specifically" / implementation guide §3) —
 * this is the sanctioned server-side seam for that data to reach the browser. Same pattern as
 * stats/w1-report.mjs / w2-report.mjs / w3-report.mjs / w4-report.mjs.
 */
import { SUPERBITS } from "../../gamedata/gamedata-w5-gaming.mjs";
import { GODS_INFO_FULL, GOD_RANK_MAX } from "../../gamedata/gamedata-w5-divinity.mjs";
import { VILLAGERS } from "../../gamedata/gamedata-w5-hole.mjs";

/* N.js text tables encode spaces as "_" and leave "{"/"}"/"<"/">"/"$"/"#" as unfilled value
 * placeholders (the live number they'd substitute is shown separately, from the entity's own
 * computed fields) — strip all six rather than show raw punctuation in the UI. "_@_" (a section
 * break) becomes ". " so multi-clause descriptions still read as sentences. Same convention as
 * stats/w1-report.mjs..w4-report.mjs's clean(). */
const clean = (s) => String(s ?? "")
  .replace(/_*@_*/g, ". ")
  .replace(/[{}<>$@#]/g, "")
  .replace(/_/g, " ")
  .replace(/\s+/g, " ")
  .replace(/(\. )+/g, ". ")
  .replace(/^\. |\. $/g, "")
  .trim();

export function w5Glossary() {
  return {
    superbits: SUPERBITS.map((r) => ({ idx: r.idx, desc: clean(r.desc) })),
    gods: GODS_INFO_FULL.map((g) => ({
      idx: g.idx,
      majorDesc: clean(g.majorDesc),
      thirdDesc: clean(g.thirdDesc),   // still-unresolved consumer per gamedata-w5-divinity.mjs — shown as flavor only
      giftFlavor: clean(g.giftFlavor),
    })),
    godRankMax: GOD_RANK_MAX,
    villagers: VILLAGERS.filter((v) => v.active).map((v) => ({ idx: v.idx, flavor: clean(v.raw) })),
  };
}
