/* stats/atom-cost.mjs — recipe `atomCost`, "Atom Cost Reduction".
 *
 * The client's atom upgrade cost (m._customBlock_AtomCollider "AtomCost", N.js:17843-44,
 * gamedata-w3-atoms.mjs) applies discount = 1 / (1 + reductionPool/100) to the base curve. This
 * recipe surfaces the REDUCTION POOL (a percent) — the 8-10 additive sources in
 * bonuses/atoms.mjs::atomCostReductionPool. The recipe value IS that pool percent (custom combine);
 * per-atom cost-to-next is computed by bonuses/atoms.mjs::atomCost for the e.w3.atoms entity.
 *
 * Several arms have no evaluator (Palette 35, Grimoire 51, Compass 50, task shop, Bubba) — they
 * contribute 0 and flag a lower bound, so the reduction is UNDER-stated (=> cost over-stated). */

import { T } from "./engine.mjs";
import { atomCostReductionPool } from "../bonuses/atoms.mjs";

export const DISPLAY = {
  palette: { label: "Sculpting palette (35)", where: "W5 Gaming → palette", how: "PaletteBonus(35) — unread." },
  stamp: { label: "Stamp: Atom Cost", where: "Stamps", how: 'StampBonusOfTypeX("AtomCost").' },
  neon: { label: "Neon atom (self-discount)", where: "W3 Atom Collider", how: "AtomBonuses(9) — cheaper atoms." },
  superbit: { label: "Superbit Redux (21)", where: "W5 Gaming → Superbits", how: "10 × SuperBitType(21)." },
  grimoire: { label: "Grimoire (51)", where: "W6 Grimoire", how: "GrimoireUpgBonus(51) — unread." },
  compass: { label: "Windwalker compass (50)", where: "W5 Compass", how: "CompassBonus(50) — unread." },
  bubble: { label: "Alchemy bubble Y5", where: "Alchemy", how: "AlchBubbles.Y5." },
  tower: { label: "Atom Collider tower (level/10)", where: "W3 Construction → Atom Collider", how: "TowerInfo[8]/10 as a flat %." },
  task: { label: "Task shop", where: "Tasks", how: "7 × Tasks[2][4][6] — unread." },
  bubba: { label: "Bubba (BubbaRoG 7)", where: "W1 Bubba", how: "Bubbastuff(BubbaRoG_Bonuses,7) — unread." },
};

export const atomCost = {
  name: "atomCost",
  label: "Atom Cost Reduction",
  display: DISPLAY,
  format: "points",
  combine: ({ pool }) => pool,   // the recipe value is the total reduction %
  terms(ctx) {
    const p = atomCostReductionPool(ctx);
    return p.parts.map((part) => {
      const unread = String(part.note).includes("unread") || String(part.note).includes("unknown");
      return T(part.id, `AtomCost.${part.id}`, "add", Number(part.value) || 0,
        unread ? "unknown" : "computed", `${DISPLAY[part.id]?.label ?? part.id}: ${part.note ?? ""}`);
    });
  },
};
