/* bonuses/goldfood.mjs — _customBlock_GoldFoodBonuses(d): the Golden Food family. For a requested
 * stat-effect id `d`, sums (a) the BASE bonus of each equipped golden food whose Effect matches d,
 * scaled by that slot's owned stack size, and (b) the BEANSTALK bonus of each planted golden food
 * whose Effect matches d (gated on Jade Emporium row 1 "Gold_Food_Beanstalk"). Verbatim formulas +
 * tables in gamedata-w6-beanstalk.mjs (N.js byte offset 4969552).
 *
 * LOWER BOUND: the shared GfoodBonusMULTI ("Golden Food multi", ~20 out-of-scope additive sources —
 * armor sets, family, obols, talents, stamps, bubbles, sigils, meals, star signs, votes, companions,
 * legend talents, cards, vault 86) is NOT decoded. It is `1 + sum(bonuses)/100 * (multiplicative
 * arms >= 1)`, so its floor is 1; we substitute 1 and flag ctx.unknown -> every golden-food term is
 * an honest LOWER BOUND (the true bonus is GfoodBonusMULTI× larger). This is the only unread input.
 *
 * PER-CHARACTER: equipped-food slots (EquipOrder_N[2]/EquipQTY_N[2]) are per-character, so this
 * reads ctx.activeChar. The beanstalk portion is account-wide (Ninja[104]) but is only added when a
 * character is resolved, matching the client (GoldFoodBonuses always runs for the active char). */

import { sel } from "../savemap.mjs";
import { GOLDEN_FOODS, BEANSTALK_SLOTS, goldenFoodBaseBonus, beanstalkBonusTerm } from "../../gamedata/gamedata-w6-beanstalk.mjs";
import { jadeEmporiumOwned } from "./ninja.mjs";

const byKey = new Map(GOLDEN_FOODS.map((f) => [f.key, f]));

/** GoldFoodBonuses(effect) for character `charIdx`, as a raw ADDITIVE percent fragment (the value
 *  the client's "raw" return mode hands back; MiningEff/etc callers wrap it 1+v/100 themselves).
 *  GfoodBonusMULTI is taken as 1 -> lower bound (ctx.unknown flagged). */
export function goldFoodBonus(ctx, effect, charIdx) {
  if (charIdx == null) throw new Error("goldFoodBonus: needs an active character (equipped food is per-character)");
  const s = ctx.s;
  const multi = 1;   // GfoodBonusMULTI floor (undecoded -> lower bound)
  const parts = [];
  let value = 0;

  // (b) BASE — equipped golden foods whose Effect matches, scaled by their equipped stack size.
  const order = sel.equippedFoodOrder(s, charIdx);
  const qty = sel.equippedFoodQty(s, charIdx);
  const slots = sel.foodSlotsOwned(s, charIdx) || order.length;
  for (let i = 0; i < slots; i++) {
    const key = order[i];
    if (!key || key === "Blank") continue;
    const food = byKey.get(String(key));
    if (!food || food.effect !== effect) continue;
    const q = Number(qty[i]) || 0;
    const add = goldenFoodBaseBonus(food.amount, multi, q);
    value += add;
    parts.push({ label: `${food.displayName.replace(/[|_]/g, " ")} (equipped, ×${q})`, value: add,
      where: "Equipped golden food", note: `amount ${food.amount}, stack ${q} -> +${add.toFixed(2)}% (×GfoodMulti unread)` });
  }

  // (c) BEANSTALK — planted golden foods (Ninja[104][e] rank>0), gated on Jade Emporium row 1.
  const beanstalkUnlocked = jadeEmporiumOwned(ctx, 1);   // 0/1/null
  if (beanstalkUnlocked === 1) {
    const ranks = sel.beanstalkRanks(s);
    for (const slot of BEANSTALK_SLOTS) {
      const food = byKey.get(slot.key);
      if (!food || food.effect !== effect) continue;   // break-on-first-effect-match semantics
      const rank = Number(ranks[slot.index]) || 0;
      if (rank > 0) {
        const add = beanstalkBonusTerm(food.amount, multi, rank);
        value += add;
        parts.push({ label: `${food.displayName.replace(/[|_]/g, " ")} (beanstalk rank ${rank})`, value: add,
          where: "W6 Sneaking → Beanstalk", note: `planted rank ${rank} -> +${add.toFixed(2)}% (×GfoodMulti unread)` });
      }
      break;   // client breaks once the Effect match is found, planted or not
    }
  }

  ctx.unknown(`GoldFoodBonuses("${effect}") — GfoodBonusMULTI (Golden Food multi, ~20 sources) undecoded; taken as ×1 -> lower bound`);
  return {
    value, status: "partial",
    note: `char ${charIdx}: +${value.toFixed(2)}% golden food (${parts.length} source${parts.length === 1 ? "" : "s"}; ×GfoodMulti≥1 unread)`,
    parts,
  };
}
