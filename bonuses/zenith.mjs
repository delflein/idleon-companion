/* bonuses/zenith.mjs — Thingies("ZenithMarketBonus",b,0), the W7 Zenith Market (endgame statue
 * upgrades bought with Zenith Clusters). Fully resolved: ZenithMarketBonus is a pure function of
 * its own owned level (Spelunk[45][b]) times the row's coefficient — NO unread inputs. See
 * gamedata-w7-zenith.mjs (ZenithMarketBonus @N.js byte 10701968:
 *   floor(CustomLists.ZenithMarket[b][4] * Spelunk[45][b])).
 *
 * This un-stubs every "ZenithMarketBonus not decoded" lower bound in the repo:
 *   b=0 TRUE_ZEN     -> bonuses/statues.mjs::zenithMarketBonus (statue-multi "zenith" term)
 *   b=2 LAMP_BOOST    -> bonuses/holes.mjs::lampBonus (the "KNOWN OMISSION")
 *   b=4 BUBBLE_BOOST  -> stats/kruk-bubbles.mjs "zenith4" term
 *   b=5 SUPER_DUPERS  -> bonuses/talents.mjs::superTalentLvGiven zenith5 read
 *   b=9 CLASSY_GOGO   -> stats/class-xp.mjs "zenith9" term */

import { sel } from "../savemap.mjs";
import { ZENITH_MARKET, zenithMarketBonusValue } from "../gamedata-w7-zenith.mjs";

/** Thingies("ZenithMarketBonus",b,0) as a fragment. Value = floor(coeff * Spelunk[45][b]).
 *  Semantics per row: b in {0,2,6,7,9} display as a "}x higher" MULTIPLIER-percent, b in
 *  {3,4,5,8} as an additive percent/flat — but the DISPATCHER return is identical (the raw
 *  floor(coeff*level)); each caller wraps it however its own formula does. No unknowns. */
export function zenithMarketBonus(ctx, b = 0) {
  if (!ZENITH_MARKET[b]) throw new Error(`ZenithMarketBonus(${b}): no ZENITH_MARKET row (0..9)`);
  const level = sel.zenithMarketLevel(ctx.s, b);
  const value = zenithMarketBonusValue(b, level);
  return {
    value, status: "computed",
    note: `Zenith Market "${ZENITH_MARKET[b].id}" lv ${level} × coeff ${ZENITH_MARKET[b].coeff} -> ${value}`,
  };
}

/** Raw numeric ZenithMarketBonus(b) (for inline callers that want the number, not a fragment). */
export const zenithMarketBonusNum = (ctx, b) => zenithMarketBonusValue(b, sel.zenithMarketLevel(ctx.s, b));
