/* bonuses/cooking.mjs — CookingR dispatcher helpers (kitchens/ladles). Static tables + verbatim
 * formula transcriptions live in gamedata-w4-cooking.mjs.
 *
 * TOTALKITCHEN (N.js:12478, consumed by Breeding TotalBreedChance) and the per-kitchen ladle
 * levels are the save-derivable pieces the breeding-chance + kitchen-speed recipes and the W4
 * entity share. The full CookingSPEED multiplier chain is transcribed as terms in
 * stats/kitchen-speed.mjs (one term per client factor). */

import { sel } from "../savemap.mjs";
import { jadeEmporiumOwned } from "./ninja.mjs";
import { grimoireUpgBonus } from "./summoning.mjs";
import { artifactBonus } from "./sailing.mjs";

const num = (x) => Number(x) || 0;
const safe = (fn, d = 0) => { try { const r = fn(); return r == null ? d : r; } catch { return d; } };

/** TOTALKITCHEN — Σ over kitchens (STOPPING at the first with state 0, i.e. the first unpurchased
 *  kitchen breaks the loop) of Cooking[k][6]+[7]+[8] (speed+fire+luck ladle levels). N.js:12478.
 *  Returns {value, kitchensCounted}. */
export function totalKitchenLadles(ctx) {
  const cooking = sel.cooking(ctx.s);
  let total = 0, counted = 0;
  for (let k = 0; k < cooking.length; k++) {
    const row = cooking[k] ?? [];
    if (num(row[0]) === 0) break;                 // first unpurchased kitchen ends the sum
    total += num(row[6]) + num(row[7]) + num(row[8]);
    counted++;
  }
  return { value: total, kitchensCounted: counted };
}

/** Per-kitchen ladle levels + status for kitchen k. */
export function kitchenLadles(ctx, k) {
  const row = sel.cooking(ctx.s)[k] ?? [];
  return { status: num(row[0]), speed: num(row[6]), fire: num(row[7]), luck: num(row[8]) };
}

/** CookingMealMaxLVlol — the meal LEVEL CAP (N.js:12415, transcribed in gamedata-w4-meals.mjs).
 *   round(30 + Sailing("ArtifactBonus",17,0) + 10*Emporium(20) + 10*Emporium(21)
 *            + 30*loreBoss5 + min(20, GrimoireUpgBonus(26)))
 *  loreBoss5 (Spelunk lore #5) has no evaluator -> omitted (cap is then a LOWER bound, +partial). */
export function mealLevelCap(ctx) {
  let cap = 30;
  cap += num(safe(() => artifactBonus(ctx, 17).value));       // Causticolumn artifact (may be unverified -> 0)
  if (safe(() => jadeEmporiumOwned(ctx, 20), null)) cap += 10;
  if (safe(() => jadeEmporiumOwned(ctx, 21), null)) cap += 10;
  cap += Math.min(20, num(safe(() => grimoireUpgBonus(ctx, 26).value)));
  // Several sources are unread here (loreBoss5 +30, and ArtifactBonus(17)/GrimoireUpgBonus(26) are
  // not in this repo's tables), so `cap` is a LOWER bound. A meal already ABOVE it proves the true
  // cap is at least the highest existing meal level -> clamp to that (still an honest lower bound).
  const maxMeal = Math.max(0, ...(sel.mealLevels(ctx.s) || []).map(num));
  return { value: Math.round(Math.max(cap, maxMeal)), partial: true };
}

/** CookingMenuMealCosts(idx) — cost to raise meal `idx` one level (in its spice), N.js:12412-15.
 *  Only the LEVEL-driven core is modeled (the account-wide discount arms — Companions/Achieve/
 *  Dreamstuff/Equinox — are omitted, so this is an UPPER bound, like the stamp/atom cost estimates).
 *  Returns null when the value overflows a double (high-level meals genuinely exceed 1.8e308). */
export function mealCostToNext(ctx, idx) {
  const L = num(sel.mealLevels(ctx.s)[idx]);
  const softReset = Math.floor((L + 1000) / 1111);
  const cost = (10 + (L + Math.pow(L, 2)))
    * Math.pow(1.2 + 0.05 * L, L)
    * Math.pow(10, 22 * softReset)
    * Math.pow(1 + 0.4 * softReset, L);
  return isFinite(cost) ? cost : null;
}
