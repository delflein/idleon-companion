/* stats/w2-report.mjs — the /api/w2 payload: a small STATIC glossary for World 2 (Yum-Yum
 * Desert) that w2.html needs but the entities.w2 shape (domain.mjs) intentionally does not
 * carry, because it's account-independent gamedata rather than a parsed save value:
 *   - bubble/vial TOOLTIP TEXT (entities.w2.bubbles[c][i]/vials[i] carry level+bonus, not the
 *     in-game description of what the bonus actually does)
 *   - sigil EFFECT TEXT + per-tier PROGRESS THRESHOLDS (entities.w2.sigils carries the current
 *     tier's bonus value, not what next tier costs or what the sigil does)
 *   - Poppy / Tar Pit upgrade DESCRIPTIONS, Mega Fish milestone text, Reset Spiral descriptions
 *     (entities.w2.fishing carries levels/rates, not the flavor text)
 *   - the Fractal Island point THRESHOLDS (entities.w2.islands.fractalAfkHours is a bare number;
 *     this supplies what it takes to reach each of the 8 known reward tiers)
 *
 * No save parsing here — this never changes between snapshots, so it takes no argument and does
 * no per-account computation. Pages must not import gamedata-*.mjs directly (see README "For a
 * new STAT specifically" / implementation guide §3) — this is the sanctioned server-side seam
 * for that data to reach the browser. Same pattern as stats/w1-report.mjs.
 */
import { BUBBLE_TABLE } from "../../gamedata/gamedata-w2-bubbles.mjs";
import { VIAL_INFO } from "../../gamedata/gamedata-w2-vials.mjs";
import { SIGIL_COSTS } from "../../gamedata/gamedata-w2-sigils.mjs";
import { POPPY_UPGRADES, TAR_PIT_UPGRADES, MEGA_FISH_MILESTONES, RESET_SPIRAL } from "../../gamedata/gamedata-w2-fishing.mjs";
import { FRACTAL_THRESHOLDS } from "../bonuses/misc.mjs";

/* N.js text tables encode spaces as "_" and leave "{"/"}" as unfilled value placeholders (the
 * live numeric value they'd substitute is shown separately, in the entity's own level/bonus
 * fields) — strip both rather than show raw braces or underscores in the UI. Same convention as
 * stats/w1-report.mjs's clean(). */
const clean = (s) => String(s ?? "").replace(/[{}]/g, "").replace(/_/g, " ").replace(/\s+/g, " ").trim();

export function w2Glossary() {
  return {
    bubbleEffects: BUBBLE_TABLE.flatMap((cauldron, ci) =>
      cauldron.map((row) => ({ cauldron: ci, idx: row.idx, key: row.key, desc: clean(row.desc), filler: !!row.filler }))),
    vialEffects: VIAL_INFO.map((v) => ({ idx: v.i, desc: clean(v.desc), unlockPct: v.unlockPct })),
    /* SIGIL_COSTS carries both the effect text AND the progress thresholds for all 5 tiers —
     * bonuses/alchemy.mjs's SIGIL_DESC (used by entities.w2.sigils) only has the bonus values. */
    sigilEffects: SIGIL_COSTS.map((s) => ({
      idx: s.i, effect: clean(s.effect),
      unlockCost: s.unlockCost, boostCost: s.boostCost, jadeCost: s.jadeCost,
      etherealCost: s.etherealCost, eclecticCost: s.eclecticCost,
    })),
    poppyEffects: POPPY_UPGRADES.map((u) => ({ idx: u.i, desc: clean(u.desc), bonus: clean(u.bonus) })),
    tarPitEffects: TAR_PIT_UPGRADES.map((u) => ({ idx: u.i, desc: clean(u.desc), bonus: clean(u.bonus) })),
    megaFishMilestones: MEGA_FISH_MILESTONES.map((m) => ({ idx: m.i, unlockAt: m.unlockAt, desc: clean(m.desc), stacksPastUnlock: !!m.stacksPastUnlock })),
    resetSpiralEffects: RESET_SPIRAL.map((r) => ({ idx: r.i, desc: clean(r.desc) })),
    fractalThresholds: FRACTAL_THRESHOLDS,
  };
}
