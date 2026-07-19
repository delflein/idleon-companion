/* bonuses/meals.mjs — MealBonus(key): W4 dinner-table meal bonuses, GENERIC over all 74 meals.
 *
 * Client (MealBonusesS builder, N.js:6212-6214; accessor _customBlock_MealBonus @7437):
 *   MealBonusesS[key] = Σ over meals g with MealINFO[g][5] == key of
 *       BonusMultiCook(g)                                  // ARM 1 — per-meal cooking mastery
 *     * CookingR("CookingMealBonusMultioo",0,0)            // ARM 2 — global meal multiplier
 *     * Summoning("RibbonBonus", Ribbon[28+g], 0)          // ARM 3 — per-meal ribbon rank
 *     * Meals[0][g]                                        // meal LEVEL
 *     * MealINFO[g][2]                                     // per-level coeff
 *
 * ALL THREE ARMS are now implemented from N.js (transcribed verbatim in gamedata-w4-meals.mjs):
 *   ARM 1  BonusMultiCook(g)  = 1 + 100*CookMaster[0][g]/(CookMaster[0][g]+5)/100      (N.js:18136-37)
 *          -> fully save-derivable (CookMaster[0][g] = yellow points on that meal); no unknowns.
 *   ARM 2  CookingMealBonusMultioo = (1+(MainframeBonus(116)+ShinyBonusS(20))/100)
 *                                   *(1+WinBonus(26)/100)*(1+25*Companions(162)/100)    (N.js:12400-01)
 *          -> ShinyBonusS(20)/WinBonus(26)/Companions(162) derivable; MainframeBonus(116) is a
 *             JEWEL bonus we do not model -> contributes 0 (LOWER BOUND, flagged once).
 *   ARM 3  RibbonBonus(b) = 1 + (floor(5b + floor(b/2)*(4+6.5*floor(b/5)))
 *                               + floor(b/4)*(EMPEROR_SET/4) + floor(b/10)*Dreamstuff(73))/100  (N.js:18037)
 *          -> the polynomial base is derivable; the EMPEROR_SET (b>=4) and Dreamstuff(73) (b>=10)
 *             addends are unread -> omitted (LOWER BOUND when a meal's ribbon rank >= 4, flagged).
 *
 * Each arm is >= 1 for a leveled meal, so the result remains a documented LOWER BOUND while
 * MainframeBonus(116) / the two RibbonBonus addends are unmodelled — but it is now much closer to
 * the client's true value than the previous `lv*coeff` transcription. */

import { sel } from "../savemap.mjs";
import { MEAL_INFO } from "../../gamedata/gamedata-w4-meals.mjs";
import { shinyBonus } from "./breeding.mjs";
import { winBonus } from "./summoning.mjs";
import { companion } from "./companions.mjs";

const num = (x) => Number(x) || 0;

/** key -> [rows] index over the full MealINFO table (a key can back several meals, e.g. "Npet"). */
const MEAL_BY_KEY = MEAL_INFO.reduce((m, r) => ((m[r.key] ??= []).push(r), m), {});

/** ARM 1 — BonusMultiCook(mealIdx): per-meal cooking-mastery multiplier (N.js:18136-37).
 *  = 1 + CookMaster[0][idx]/(CookMaster[0][idx]+5). Always >= 1, fully save-derivable. */
export function bonusMultiCook(ctx, idx) {
  const pts = num(sel.cookMaster(ctx.s)?.[0]?.[idx]);
  return 1 + pts / (pts + 5);
}

/** ARM 3 — RibbonBonus(Ribbon[28+idx]) for meal idx (N.js:18037). Returns {value, b, base, partial}.
 *  Emperor-set (b>=4) and Dreamstuff-73 (b>=10) addends are unread -> omitted (lower bound). */
export function ribbonBonus(ctx, idx) {
  const b = num(sel.ribbons(ctx.s)[28 + idx]);
  const base = Math.floor(5 * b + Math.floor(b / 2) * (4 + 6.5 * Math.floor(b / 5)));
  return { value: 1 + base / 100, b, base, partial: b >= 4 };
}

/** ARM 2 — CookingMealBonusMultioo (N.js:12400-01): the GLOBAL meal multiplier, identical for every
 *  meal. Memoized on ctx so it is computed (and its one honesty flag raised) exactly once per recipe
 *  evaluation. Returns {value, partial, note}. */
export function cookingMealBonusMulti(ctx) {
  if (ctx._mealMulti) return ctx._mealMulti;
  let partial = false;
  const shiny20 = num(shinyBonus(ctx, 20).value);          // "+% Bonuses from All Meals" shiny bonus
  const mf116 = 0;                                          // MainframeBonus(116) jewel — not modeled
  partial = true;                                           // -> lower bound
  let win26 = 0;
  try { win26 = num(winBonus(ctx, 26).value); } catch { partial = true; }
  const c162 = companion(ctx, 162);                         // +25% per point owned
  let compTerm = 0;
  if (c162.owned === null) partial = true;                  // ownership unknown -> 0 (lower bound)
  else compTerm = 25 * num(c162.value);
  const value = (1 + (mf116 + shiny20) / 100) * (1 + win26 / 100) * (1 + compTerm / 100);
  const res = {
    value, partial,
    note: `shiny20=${shiny20} win26=${win26.toFixed(1)} comp162=${compTerm ? "+25%" : (c162.owned === null ? "?" : "0")}; MainframeBonus(116) jewel omitted`,
  };
  ctx._mealMulti = res;
  return res;
}

/** MealBonus(key) — the accumulated MealBonusesS[key] as a PERCENT fragment, summed over every meal
 *  that carries `key`, each armed by ARM1×ARM2×ARM3. Lower bound while MainframeBonus(116) / high
 *  ribbon addends are unmodelled. Returns {value, status, note, parts}. */
export function mealBonus(ctx, key) {
  const rows = MEAL_BY_KEY[key] ?? [];
  const levels = sel.mealLevels(ctx.s);
  const arm2 = cookingMealBonusMulti(ctx);
  let total = 0, anyLeveled = false, ribbonPartial = false;
  const parts = [];
  for (const row of rows) {
    const lv = num(levels[row.idx]);
    if (!(lv > 0)) continue;
    anyLeveled = true;
    const a1 = bonusMultiCook(ctx, row.idx);
    const a3 = ribbonBonus(ctx, row.idx);
    if (a3.partial) ribbonPartial = true;
    const v = lv * row.coeff * a1 * arm2.value * a3.value;
    total += v;
    parts.push({
      label: row.name.replace(/_/g, " "), value: v,
      note: `lv ${lv} × ${row.coeff} × mastery ${a1.toFixed(3)} × ribbon ${a3.value.toFixed(2)}(rank ${a3.b})`,
    });
  }
  if (!anyLeveled) return { value: 0, note: rows.length ? `no leveled meal carries "${key}"` : `no meal carries "${key}"`, parts };
  const partial = arm2.partial || ribbonPartial;
  if (partial) {
    ctx.unknown(`MealBonus("${key}") lower bound: global multi MainframeBonus(116) jewel` +
      (ribbonPartial ? " + high-rank RibbonBonus (Emperor/Dreamstuff) addends" : "") + " unmodelled");
  }
  return {
    value: total,
    status: partial ? "partial" : "computed",
    note: `${parts.length} meal(s) × global ${arm2.value.toFixed(2)} -> +${total.toFixed(1)}%${partial ? " (lower bound)" : ""}`,
    parts,
  };
}
