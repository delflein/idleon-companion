/* stats/w1-report.mjs — the /api/w1 payload: a small STATIC glossary for World 1 (Blunder
 * Hills) that w1.html needs but the entities.w1 shape (domain.mjs) intentionally does not
 * carry, because it's account-independent gamedata rather than a parsed save value:
 *   - anvil product NAMES (entities.w1.anvil[i].selections is just raw indices into the
 *     14-row ANVIL_PRODUCTION table — the page needs the table to label them as item names)
 *   - short, human-readable EFFECT/DESC text for forge tracks, owl upgrades, megafeather
 *     tiers, and bribes — entities.w1 carries the numbers (level/price/etc.) but not the
 *     flavor text explaining what each row actually does in-game
 *   - whether a statue's `bonus` number is a PERCENT or a FLAT stat add, and what stat it
 *     names — entities.w1.statues carries the computed bonus value but not its unit (both
 *     kinds share the same field; STATUE_INFO's `effect` template string is the only place
 *     that says which)
 *
 * No save parsing here — this never changes between snapshots, so it takes no argument and
 * does no per-account computation. Pages must not import gamedata-*.mjs directly (see
 * README "For a new STAT specifically" / implementation guide §3) — this is the sanctioned
 * server-side seam for that data to reach the browser.
 */
import { ANVIL_PRODUCTION } from "../gamedata-anvil.mjs";
import { FURNACE_UPGRADES } from "../gamedata-forge.mjs";
import { OWL_UPGRADES, MEGA_FEATHER_TIERS } from "../gamedata-owl.mjs";
import { BRIBES } from "../gamedata-bribes.mjs";
import { STATUE_INFO } from "../gamedata-statues.mjs";

/* N.js text tables encode spaces as "_" and leave "{"/"}" as unfilled value placeholders
 * (the live numeric value they'd substitute isn't reliably derivable from the save for every
 * row) — strip both rather than show raw braces or underscores in the UI. */
const clean = (s) => String(s ?? "").replace(/[{}]/g, "").replace(/_/g, " ").replace(/\s+/g, " ").trim();

export function w1Glossary() {
  return {
    anvilProducts: ANVIL_PRODUCTION.map((p) => ({
      index: p.index,
      name: clean(p.rawName),
      requiredAmount: p.requiredAmount,
      levelReq: p.levelReq,
    })),
    forgeEffects: FURNACE_UPGRADES.map((u) => ({ index: u.index, effect: clean(u.effect) })),
    owlEffects: OWL_UPGRADES.map((u) => ({ index: u.index, bonus: clean(u.bonus), desc: clean(u.desc) })),
    megaFeatherTiers: MEGA_FEATHER_TIERS.map((t) => ({ tier: t.tier, desc: clean(t.desc) })),
    bribeEffects: BRIBES.map((b) => ({ index: b.index, desc: clean(b.desc) })),
    /* effect template e.g. "%@MOVE_SPEED" (percent) or "@BASE_DAMAGE" (flat) — leading "%"
     * is the only unit marker; "@" + the rest names the stat. */
    statueEffects: STATUE_INFO.map((s) => ({
      index: s.index,
      pct: s.effect.startsWith("%"),
      statName: clean(s.effect.replace(/^%?@/, "")),
    })),
  };
}
