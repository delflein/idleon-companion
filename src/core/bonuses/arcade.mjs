/* bonuses/arcade.mjs — ArcadeBonus(i), the Gold Ball Shop.
 *
 * Client: `mult=1; if(ArcadeUpg[i]==101) mult*=2; if(Companions(27)==1) mult*=2;
 *          return mult * ArbitraryCode5Inputs(row[3], row[1], row[2], ArcadeUpg[i])`
 * Level 101 means MAXED (hence the x2). Companion 27 is the Spirit Reindeer, "2.00x_Gold_Ball_
 * Shop_Bonuses" — the Gold Ball Shop IS the arcade — so it doubles every row. Companion
 * ownership is server-side (_comp RTDB doc); when it is unknown we take the LOWER bound
 * (no reindeer) and flag via ctx.unknown. ARCADE_ROWS is the complete 70-row table, so this
 * is generic over every arcade upgrade id. */

import { sel } from "../savemap.mjs";
import { ARCADE_ROWS } from "../../gamedata/gamedata.mjs";
import { arbitraryCode5 } from "./util.mjs";

export const REINDEER_COMPANION = 27;

/** Raw ArcadeBonus(i) value. `reindeer` must be resolved by the caller (see arcadeBonus). */
export function arcadeBonusRaw(s, i, reindeer) {
  const level = Number(sel.arcadeUpg(s)[i] ?? 0);
  if (!level) return 0;
  const r = ARCADE_ROWS[i];
  let mult = 1;
  if (level === 101) mult *= 2;
  if (reindeer) mult *= 2;
  return mult * arbitraryCode5(r.mode, r.b, r.c, level);
}

/** ArcadeBonus(i) as a fragment. Flags unknown reindeer ownership once per ctx. */
export function arcadeBonus(ctx, i) {
  const reindeer = ctx.companions ? ctx.companions.has(REINDEER_COMPANION) : false;
  if (!ctx.companions && !ctx._reindeerFlagged) {
    ctx._reindeerFlagged = true;
    ctx.unknown(`Companions(${REINDEER_COMPANION}) Spirit Reindeer — doubles EVERY arcade bonus; needs the _comp RTDB doc`);
  }
  const L = Number(sel.arcadeUpg(ctx.s)[i] ?? 0);
  const value = arcadeBonusRaw(ctx.s, i, reindeer);
  return {
    value,
    status: ctx.companions ? "computed" : "partial",
    note: `ArcadeUpg[${i}]=${L}${L === 101 ? " maxed(x2)" : ""}${reindeer ? " x2 reindeer" : ""}` +
      (ctx.companions ? "" : "; reindeer ownership UNKNOWN -> lower bound"),
  };
}
