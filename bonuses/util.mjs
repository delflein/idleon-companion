/* bonuses/util.mjs — shared primitives used by several client dispatchers. */

import { NUMBER_2_LETTER } from "../gamedata.mjs";

/* --- ArbitraryCode5Inputs: the client's shared curve dispatcher -----------
 * x._customBlock_ArbitraryCode5Inputs(func, x1, x2, level, 0, 0) at N.js:5445 — the SAME
 * evaluator used by stamps, statues, cards, star signs, etc. All 14 func cases transcribed
 * verbatim (see gamedata-stamps.mjs header) so any effect-type curve resolves here without
 * per-type re-verification. Params: mode=func, b=x1, c=x2, f=level. */
export function arbitraryCode5(mode, b, c, f) {
  switch (mode) {
    case "add":              return c !== 0 ? ((b + c) / c + 0.5 * (f - 1)) / (b / c) * f * b : b * f;
    case "addLower":         return b + c * (f + 1);
    case "addDECAY":         return f < 50001
      ? b * f
      : b * Math.min(50000, f) + (f - 50000) / (150000 + (f - 50000)) * b * 50000;
    case "decay":            return b * f / (f + c);
    case "decayLower":       return b * (f + 1) / (f + 1 + c) - b * f / (f + c);
    case "decayMulti":       return 1 + b * f / (f + c);
    case "decayMultiLower":  return b * (f + 1) / (f + 1 + c) - b * f / (f + c);
    case "bigBase":          return b + c * f;
    case "bigBaseLower":     return c;
    case "intervalAdd":      return b + Math.floor(f / c);
    case "intervalAddLower": return Math.max(Math.floor((f + 1) / c), 0) - Math.max(Math.floor(f / c), 0);
    case "reduce":           return b - c * f;
    case "reduceLower":      return b - c * (f + 1);
    case "PtsSpentOnGuildBonus": return ((b + c) / c + 0.5 * (f - 1)) / (b / c) * f * b - c * f;
    default: return 0;
  }
}

/** getLOG(a) — the client's base-10 log clamp, verbatim from N.js:6121:
 *    getLOG = function(a){ return Math.log(Math.max(a,1)) / 2.30259 }
 *  i.e. log10(max(a,1)). Used as a "per power of 10" multiplier (e.g. Cash multi's dustwalker /
 *  Ninja-KO count arms scale by getLOG(OptionsListAccount[...])). */
export const getLOG = (a) => Math.log(Math.max(Number(a) || 0, 1)) / 2.30259;

/** Number2Letter membership test — the client's idiom for "is id b in flag-string `str`":
 *  `str.indexOf(Number2Letter[b]) != -1`. Used by SuperBitType, EventShopOwned, EmporiumBonus.
 *  Returns null when the id is past the end of the recoverable table (>= 53) — "we cannot
 *  tell", NOT "not owned". See gamedata NUMBER_2_LETTER for why the table stops there. */
export function letterFlag(str, b) {
  const ch = NUMBER_2_LETTER[b];
  if (ch === undefined) return null;
  return String(str ?? "").indexOf(ch) !== -1 ? 1 : 0;
}
