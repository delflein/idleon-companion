/* stats/fishing-rate.mjs — two recipes for the Poppy / Fishing Town system (World 2):
 *   `fishRate`  — Bluefin fish / minute (RooCatchFishQTY * 60/RooCatchREQ, N.js:18076-18080)
 *   `shinyRate` — shiny fishing rate (RooCatchRate_S / RooCatchREQ_S, N.js:18080-18082)
 * Both account-wide; all levels read from OptLacc. The three unread multipliers (VaultUpgBonus(45),
 * GambitBonuses(8), Fountain_BonTOT(1,18)) are held at 1 and flagged -> lower bound. See
 * bonuses/fishing.mjs for the verbatim chains and gamedata-w2-fishing.mjs for the index map. */

import { T } from "./engine.mjs";
import { fishPerMinute, shinyFishRate } from "../bonuses/fishing.mjs";

const num = (x) => Number(x) || 0;

export const fishRate = {
  name: "fishRate",
  label: "Bluefin Fish / min",
  format: "points",
  combine: ({ terms }) => terms.reduce((a, t) => a * (num(t.value) || 1), 1),
  terms(ctx) {
    const r = fishPerMinute(ctx);
    ctx.unknown(`fishRate: ${r.unread.join(", ")} unread (no evaluator) -> held at ×1 (lower bound)`);
    return r.parts.map((p) => T(p.id, `RooCatchFishQTY.${p.id}`, "mul", num(p.value), "partial", p.note ?? p.label));
  },
};

export const shinyRate = {
  name: "shinyRate",
  label: "Shiny Fishing Rate (client units)",
  format: "points",
  combine: ({ terms }) => terms.reduce((a, t) => a * (num(t.value) || 1), 1),
  terms(ctx) {
    const r = shinyFishRate(ctx);
    return r.parts.map((p) => T(p.id, `RooCatchRate_S.${p.id}`, "mul", num(p.value), "computed", p.note ?? p.label));
  },
};
