/* bonuses/library.mjs — Talent Library checkout mechanic (WorkbenchStuff "BookReqTime", N.js:12276-77,
 * transcribed verbatim in gamedata-w3-library.mjs).
 *
 * bonusMultiplier = (1 + MealBonus("Lib")/100)
 *   * (1 + AtomCollider("AtomBonuses",7,0)/100)                    // Oxygen atom
 *   * (1 + (5*TowerInfo[1] + AlchBubbles.booksSpeed + AlchVials.TalBookSpd
 *          + StampBonusOfTypeX("BookSpd") + min(30,max(0,30*AchieveStatus(145)))
 *          + GamingStatType("SuperBitType",12,0) * Lv0[15]) / 100)
 * seconds(bookN) = round( 4*(3600/bonusMultiplier) * (1 + 10*bookN^1.4/100) )   // per-book, cumulative
 *
 * NO-TIMERS: the recipe VALUE is bonusMultiplier (the checkout SPEED). booksPerDay/breakpointDays
 * turn it into count-based planning numbers (checkouts/day, days to reach N books) — never a
 * live countdown. */

import { sel, SKILL } from "../savemap.mjs";
import { atomBonus } from "./atoms.mjs";
import { alchBubble } from "./bubbles.mjs";
import { vialBonusByKey } from "./alchemy.mjs";
import { stampBonusOfType } from "./stamps.mjs";
import { achieveStatus } from "./misc.mjs";
import { superBitType } from "./gaming.mjs";
import { mealBonus } from "./meals.mjs";
import { LIBRARY_CHECKOUT_TIME_BASE_SECONDS, LIBRARY_CHECKOUT_TIME_HOURS_MULTIPLIER, LIBRARY_CHECKOUT_BOOKCOUNT_EXPONENT, LIBRARY_CHECKOUT_BOOKCOUNT_COEFFICIENT } from "../../gamedata/gamedata-w3-library.mjs";

const num = (x) => Number(x) || 0;
const safe = (ctx, fn) => { try { const r = fn(); return r == null ? null : r; } catch { return null; } };

/** The full library checkout-speed multiplier. Returns {value, status, parts:[{id,label,value,note}]}. */
export function libraryBonusMultiplier(ctx) {
  const parts = [];
  let partial = false;
  const push = (id, label, value, note, unknown) => { parts.push({ id, label, value, note }); if (unknown) partial = true; };

  // mul factor 1: meal
  const meal = safe(ctx, () => mealBonus(ctx, "Lib"));
  const mealV = meal ? num(meal.value) : 0;
  if (!meal) { ctx.unknown('Library: MealBonus("Lib") meal row unverified -> 0 (lower bound)'); partial = true; }
  push("meal", "Meal: library checkout", mealV, meal?.note ?? "MealBonus(Lib) unread -> 0", !meal);

  // mul factor 2: Oxygen atom
  const oxygen = atomBonus(ctx, 7);
  push("atom", "Oxygen atom (Library Booker)", oxygen, `AtomBonuses(7) = Atoms[7]*2 = ${oxygen}`);

  // add pool (factor 3 inner sum)
  const towerLv = num(sel.towerLevels(ctx.s)[1]);
  push("libraryTower", "Library tower level", 5 * towerLv, `5 × TowerInfo[1]=${towerLv}`);
  const books = safe(ctx, () => alchBubble(ctx, "booksSpeed"));
  push("bubble", "Bubble: booksSpeed", books ? num(books.value) : 0, books?.note ?? "AlchBubbles.booksSpeed");
  const vial = vialBonusByKey(ctx, "TalBookSpd");
  push("vial", "Vial: TalBookSpd", num(vial.value), vial.note ?? "");
  const stamp = safe(ctx, () => stampBonusOfType(ctx, "BookSpd"));
  push("stamp", "Stamp: BookSpd", stamp ? num(stamp.value) : 0, stamp?.note ?? "no BookSpd stamp", !stamp);
  const ach = Math.min(30, Math.max(0, 30 * achieveStatus(ctx, 145)));
  push("achievement", "Achievement (145)", ach, `min(30, 30×AchieveStatus(145))`);
  const sb = superBitType(ctx, 12);
  const gamingLv = num(ctx.s.agg("Lv0_N", (lv) => (lv ?? [])[SKILL.gaming + 1] ?? 0, "max"));
  let sbV = 0;
  if (sb === null) { ctx.unknown("Library: SuperBitType(12) unknown -> superbit term 0 (lower bound)"); partial = true; push("superbit", "Superbit (12) × Gaming LV", 0, "SuperBitType(12) unknown", true); }
  else { sbV = sb * gamingLv; push("superbit", "Superbit (12) × Gaming LV", sbV, `SuperBitType(12)=${sb} × Lv0[15]=${gamingLv}`); }

  const pool = 5 * towerLv + (books ? num(books.value) : 0) + num(vial.value) + (stamp ? num(stamp.value) : 0) + ach + sbV;
  const value = (1 + mealV / 100) * (1 + oxygen / 100) * (1 + pool / 100);
  return { value, status: partial ? "partial" : "computed", parts, pool };
}

/** seconds to check out the (bookN)-th book this cycle, given the speed multiplier. */
export function bookSeconds(bonusMultiplier, bookN) {
  const baseFactor = LIBRARY_CHECKOUT_TIME_HOURS_MULTIPLIER * (LIBRARY_CHECKOUT_TIME_BASE_SECONDS / bonusMultiplier);
  return Math.round(baseFactor * (1 + LIBRARY_CHECKOUT_BOOKCOUNT_COEFFICIENT * Math.pow(bookN, LIBRARY_CHECKOUT_BOOKCOUNT_EXPONENT) / 100));
}

/** Cumulative days to reach each of the `breakpoints` book counts (checkouts accumulate; each book
 *  gets slower). Returns [{books, days}] — count-based, not a countdown. */
export function checkoutBreakpoints(bonusMultiplier, breakpoints = [16, 18, 20]) {
  const out = [];
  let cumSeconds = 0, prev = 0;
  const maxB = Math.max(...breakpoints);
  for (let n = 0; n < maxB; n++) {
    cumSeconds += bookSeconds(bonusMultiplier, n);
    const books = n + 1;
    if (breakpoints.includes(books)) out.push({ books, days: Math.round(cumSeconds / 86400 * 100) / 100 });
  }
  void prev;
  return out;
}
