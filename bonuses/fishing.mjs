/* bonuses/fishing.mjs — Poppy / Fishing Town (World 2) Roo* helpers, transcribed verbatim from the
 * _customBlock_Summoning dispatcher (N.js:18071-18162) per gamedata-w2-fishing.mjs FORMULAS. All
 * levels live in OptLacc (accountOptions); read via sel.poppyOpt. Account-wide.
 *
 * Unread multipliers (no evaluator in this repo) contribute their neutral element and are flagged by
 * the recipe: VaultUpgBonus(45), GambitBonuses(8), Fountain_BonTOT(1,18). */

import { sel } from "../savemap.mjs";
import { SHINY_MULTI_TIERS, RESET_SPIRAL } from "../gamedata-w2-fishing.mjs";

const O = (ctx, i) => sel.poppyOpt(ctx.s, i);

/** RooMegafeather(i): OptLacc[279] > i ? (i===11 ? OptLacc[279]-11 : 1) : 0. */
export function rooMegafeather(ctx, i) {
  const t = O(ctx, 279);
  return t > i ? (i === 11 ? t - 11 : 1) : 0;
}

/** RooRESETbon(cat), cat 0..4 (Reset Spiral). base[cat] * secondary(cat). */
export function rooResetBon(ctx, cat) {
  const lvl = O(ctx, 291 + cat);
  const base = 1 + RESET_SPIRAL[cat].coeff * lvl;
  const secondary = (cat !== 3 && lvl > 0) ? 1 + 0.04 * O(ctx, 294) : 1;
  return base * secondary;
}

/** RooShinyMulti(-1): product over 6 tiers of 1 + base[t]*ln(max(1, OptLacc[281+t]))/100. */
export function rooShinyMulti(ctx) {
  let prod = 1;
  for (const { i, base } of SHINY_MULTI_TIERS) prod *= 1 + base * Math.log(Math.max(1, O(ctx, 281 + i))) / 100;
  return prod;
}

/** Bluefin fish PER MINUTE = RooCatchFishQTY * (60 / RooCatchREQ), with the 3 unread multipliers
 *  (vault45/gambit8/fountain) held at 1. Returns {value, parts:[{id,label,value,note}], unread}. */
export function fishPerMinute(ctx) {
  const catchREQ = 30 / (1 + 5 * O(ctx, 269) / 100);                 // seconds/catch, "Quick Reeling"
  const resetQty = 1 + Math.min(5, O(ctx, 275));                      // "Fisheroo Reset" (capped)
  const megaOverflow = Math.max(1, 1 + 0.5 * (O(ctx, 275) - 5) * rooMegafeather(ctx, 5));
  const spiral0 = rooResetBon(ctx, 0);
  const upgradeSum = 10 * O(ctx, 268) + 100 * O(ctx, 297) + 1000 * O(ctx, 304) + 50 * O(ctx, 273) + 200 * O(ctx, 278);
  const shiny = rooShinyMulti(ctx);
  const bluefinFrenzy = 1 + 8 * O(ctx, 299) / 100;
  const perMin = 60 / catchREQ;
  const catchQTY = resetQty * megaOverflow * spiral0 * upgradeSum * shiny * bluefinFrenzy;   // vault/gambit/fountain = 1
  const value = catchQTY * perMin;
  return {
    value,
    unread: ["VaultUpgBonus(45)", "GambitBonuses(8)", "Fountain_BonTOT(1,18)"],
    parts: [
      { id: "resetQty", label: "Fisheroo Reset (1+min(5,lv))", value: resetQty },
      { id: "megaOverflow", label: "Mega-Fish 5 overflow", value: megaOverflow },
      { id: "spiral0", label: "Reset Spiral: Bluefin", value: spiral0 },
      { id: "upgradeSum", label: "Upgrade sum (Fishbait/Yummy/Worm/…)", value: upgradeSum },
      { id: "shiny", label: "Shiny multi (all 6 tiers)", value: shiny },
      { id: "bluefinFrenzy", label: "Bluefin Frenzy (tar)", value: bluefinFrenzy },
      { id: "perMin", label: "60 / catch interval", value: perMin, note: `catchREQ=${catchREQ.toFixed(2)}s` },
    ],
  };
}

/** Shiny fishing rate = RooCatchRate_S / RooCatchREQ_S (client units per tick). */
export function shinyFishRate(ctx) {
  const spiral1 = rooResetBon(ctx, 1);
  const shinyLure = O(ctx, 270);                                     // "Shiny Lure" level
  const mega9 = 1 + rooMegafeather(ctx, 9) * O(ctx, 268) / 100;
  const megaOverflow = Math.max(1, 1 + 0.5 * (O(ctx, 275) - 5) * rooMegafeather(ctx, 5));
  const shinyREQ = 7200 / (1 + 4 * O(ctx, 276) / 100);               // "Lightning Quickness"
  const raw = spiral1 * shinyLure * mega9 * megaOverflow;
  const value = raw / shinyREQ;
  return {
    value, shinyREQ,
    parts: [
      { id: "spiral1", label: "Reset Spiral: shiny speed/luck", value: spiral1 },
      { id: "shinyLure", label: "Shiny Lure (lv)", value: shinyLure },
      { id: "mega9", label: "Mega-Fish 9 × Tasty Fishbait", value: mega9 },
      { id: "megaOverflow", label: "Mega-Fish 5 overflow", value: megaOverflow },
      { id: "req", label: "1 / shiny interval", value: 1 / shinyREQ, note: `shinyREQ=${shinyREQ.toFixed(0)}` },
    ],
  };
}
