/* stats/liquid-cap.mjs — recipe `liquidCap`, "Liquid Capacity": the client's max-liquid expression
 * ("LiquidCap"==d, N.js:7359-7365), transcribed in bonuses/cauldron.mjs::liquidCapacity.
 *
 *   maxLiquid(b) = (1 + bleach + (meal + rift)/100) * MainframeBonus(6)
 *                * (10 + brewCap + vialCap + p2wCap + tank + stamp + arcade)
 *
 * There are 4 liquids (Water Droplets / Liquid Nitrogen / Trench Seawater / Toxic Mercury). The
 * headline VALUE is liquid 0 (Water Droplets — always unlocked); the three per-liquid-varying terms
 * (free brew track, vial cap, cauldron-P2W cap) carry a `parts[]` array with each liquid's value so
 * the breakdown shows all four. e.w2.liquids holds every liquid's full capacity. Terms that need
 * runtime state absent from the save (SaltLick, MealBonus, RiftSkillBonus, MainframeBonus(6),
 * GenINFO[87] tank scaling) contribute their neutral element and flag a lower bound. */

import { T } from "./engine.mjs";
import { liquidCapacity } from "../bonuses/cauldron.mjs";
import { LIQUID_NAMES } from "../../gamedata/gamedata-w2-cauldron.mjs";

export const DISPLAY = {
  bleach: { label: "Bleach Liquid (gem shop)", where: "Gem shop → Bleach Liquid", how: "unlocks +0.5/+1/+2 base per liquid (× SaltLick)." },
  meal: { label: "Meal: liquid capacity", where: "W4 Dinner Table", how: "MealBonus(Liquid12/Liquid34) — meal row unverified (neutral)." },
  rift: { label: "Skill Mastery: liquid (Rift)", where: "Rift — RiftSkillBonus", how: "5×RiftStuff(RiftSkillBonus,4) — unread (neutral)." },
  mf6: { label: "Lab: liquid-cap node", where: "W4 Lab → Mainframe", how: "MainframeBonus(6) — node unverified (×1)." },
  base10: { label: "Base capacity", where: "—", how: "flat 10." },
  brewCap: { label: "Free brew track (capacity)", where: "Alchemy → liquid brew progression", how: "round(CauldronInfo[8][b+4][2][1])." },
  vialCap: { label: "Vial: LiquidXCap", where: "Alchemy → Vials", how: "AlchVials.Liquid{b+1}Cap (Barium/Tea/40-40 purity vials)." },
  p2wCap: { label: "Cauldron P2W: capacity axis", where: "Alchemy → cauldron P2W", how: "cauldronp2wbonuses(liquid, b, capacity)." },
  tank: { label: "Viaduct of the Gods (tank)", where: "W4 Lab node + Da Daily Drip bubble", how: "AlchBubbles.LqdCap × pow(GenINFO[87]/25,.3) — runtime, omitted." },
  stamp: { label: "Stamp: liquid capacity", where: "Stamps", how: 'StampBonusOfTypeX("LiquidCap").' },
  arcade: { label: "Arcade: liquid capacity", where: "Alchemy → Gold Ball Shop", how: "ceil(ArcadeBonus(7))." },
};

const MUL_TERMS = new Set(["mf6"]);
const VARYING = new Set(["brewCap", "vialCap", "p2wCap"]);

export const liquidCap = {
  name: "liquidCap",
  label: "Liquid Capacity (Water Droplets)",
  display: DISPLAY,
  combine: ({ terms }) => {
    const v = (id) => { const t = terms.find((x) => x.id === id); return t ? Number(t.value) || 0 : 0; };
    const factor1 = 1 + v("bleach") + (v("meal") + v("rift")) / 100;
    const factor3 = v("base10") + v("brewCap") + v("vialCap") + v("p2wCap") + v("tank") + v("stamp") + v("arcade");
    return factor1 * (v("mf6") || 1) * factor3;
  },
  terms(ctx) {
    const perLiquid = [0, 1, 2, 3].map((b) => liquidCapacity(ctx, b));
    const cap0 = perLiquid[0];
    const byId = Object.fromEntries(cap0.parts.map((p) => [p.id, p]));
    // per-liquid parts for the varying terms
    const partsFor = (id) => perLiquid.map((cap, b) => {
      const p = cap.parts.find((x) => x.id === id);
      return { label: LIQUID_NAMES[b], value: p ? p.value : 0, note: p?.note ?? "" };
    });
    const ids = ["bleach", "meal", "rift", "mf6", "base10", "brewCap", "vialCap", "p2wCap", "tank", "stamp", "arcade"];
    return ids.map((id) => {
      const p = byId[id] ?? { value: 0, note: "" };
      const kind = MUL_TERMS.has(id) ? "mul" : "add";
      const status = cap0.status === "partial" && ["bleach", "meal", "rift", "mf6", "tank", "stamp"].includes(id) ? "partial" : "computed";
      const t = T(id, `LiquidCap.${id}`, kind, Number(p.value) || 0, status, `${DISPLAY[id]?.label ?? id}: ${p.note ?? ""}`);
      if (VARYING.has(id)) t.parts = partsFor(id);
      return t;
    });
  },
};
