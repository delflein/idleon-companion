/* stats/meal-bonus.mjs — recipe `mealBonuses`, "Meal Bonus Multiplier (global)".
 *
 * THE EXPRESSION, verbatim from p._customBlock_CookingR("CookingMealBonusMultioo",0,0),
 * N.js:12400-01 (transcribed in gamedata-w4-meals.mjs, ARM 2):
 *
 *   CookingMealBonusMultioo = (1 + (MainframeBonus(116) + Breeding("ShinyBonusS","Nah",20,-1))/100)
 *                           * (1 + Summoning("WinBonus",26,0)/100)
 *                           * (1 + 25*Companions(162)/100)
 *
 * WHY THIS AND NOT A GRAND TOTAL: the client has no single "total meal power" scalar — MealBonusesS
 * is a dict keyed by bonus type (Mcook, Npet, zCropEvo, ...), and each meal's contribution is
 * per-meal (level × coeff × a per-meal mastery arm × a per-meal ribbon arm). The ONE number shared
 * by every meal is this global multiplier. So this recipe surfaces the global chain; the per-meal
 * armed values live on the entity (e.w4.meals[i].bonus). Boundary documented.
 *
 * The default combine ((1+pool/100)*mul) reproduces the client exactly: pool = MainframeBonus(116)
 * + ShinyBonusS(20) (the first bracket), mul = the win26 × comp162 factors. MainframeBonus(116) is
 * a JEWEL bonus we do not model -> it contributes 0 and flags a lower bound. */

import { T, term } from "./engine.mjs";
import { shinyBonus } from "../bonuses/breeding.mjs";
import { winBonus } from "../bonuses/summoning.mjs";
import { companion } from "../bonuses/companions.mjs";

const num = (x) => Number(x) || 0;

export const DISPLAY = {
  mainframe116: { label: "Lab jewel (Meal bonus)", where: "W4 Lab → Mainframe jewel 116", how: "MainframeBonus(116) — jewel, not modeled -> 0 (lower bound)." },
  shiny20: { label: "Shiny pet: Bonuses from All Meals", where: "W4 Breeding → shiny pets", how: 'Breeding("ShinyBonusS",20) — level up the right shiny pets.' },
  win26: { label: "Summoning winner bonus (Meals)", where: "W6 Summoning → win battles & endless", how: "Summoning(WinBonus,26) — career wins + endless rounds." },
  comp162: { label: "Companion: meal bonus (+25%)", where: "Companions", how: "25% flat if the companion is owned." },
};

export const mealBonuses = {
  name: "mealBonuses",
  label: "Meal Bonus Multiplier (global)",
  display: DISPLAY,
  terms(ctx) {
    // first bracket (additive pool): MainframeBonus(116) + ShinyBonusS(20)
    ctx.unknown("MealBonusMulti: MainframeBonus(116) jewel not modeled -> 0 (lower bound)");
    const mf116 = T("mainframe116", "MainframeBonus(116)", "add", 0, "unknown", `${DISPLAY.mainframe116.label}: jewel unread -> 0`);
    const shiny = term("shiny20", 'Breeding("ShinyBonusS","Nah",20,-1)', "add", shinyBonus(ctx, 20));

    // second/third brackets (mul factors)
    let win = 0, winStatus = "computed", winNote = "";
    try { const f = winBonus(ctx, 26); win = num(f.value); winStatus = f.status ?? "computed"; winNote = f.note ?? ""; }
    catch (e) { winStatus = "unknown"; ctx.unknown("MealBonusMulti: WinBonus(26) unread"); }
    const win26 = T("win26", 'Summoning("WinBonus",26,0)', "mul", 1 + win / 100, winStatus, `${DISPLAY.win26.label}: +${win.toFixed(1)}% ${winNote}`);

    const c162 = companion(ctx, 162);
    let compFactor = 1, compStatus = "computed";
    if (c162.owned === null) { compStatus = "unknown"; ctx.unknown("MealBonusMulti: Companions(162) ownership unknown -> x1 (lower bound)"); }
    else compFactor = 1 + 25 * num(c162.value) / 100;
    const comp162 = T("comp162", "Companions(162)", "mul", compFactor, compStatus, `${DISPLAY.comp162.label}: ${c162.owned ? "owned +25%" : (c162.owned === null ? "ownership unknown" : "not owned")}`);

    return [mf116, shiny, win26, comp162];
  },
};
