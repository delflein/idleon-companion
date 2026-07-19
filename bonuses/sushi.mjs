/* bonuses/sushi.mjs — SushiStuff(...): the W7 sushi bar.
 *
 * SushiStuff("RoG_BonusQTY",b,0) = UniqueSushi() > b ? CustomLists.Research[37][b] : 0.
 * UniqueSushi counts LEADING consecutive Sushi[5][f] >= 0; the first negative stops it.
 * SUSHI_ROG holds Research[37] values — only the ids verified in N.js so far; extend as read. */

import { sel } from "../savemap.mjs";

/** CustomLists.Research[37], verified ids only: [7]=30 (artifact find),
 *  [48]=10 (drop-rate MULTIPLIER percent), [53]=1 (feeds Grid_Bonus_Allmulti).
 *  List alignment cross-checked by [7] and [53] matching independent earlier reads. */
export const SUSHI_ROG = {
  7: 30, 48: 10, 51: 10, 53: 1,   // 51 feeds MeritocBonuszMulti
  /* Farming (Research[36]/[37] rows @N.js:24108, 2026-07-18):
   *   33 "+{_more_Exotic_Market_purchases" = 3 · 35 "}x_farming_Evo_chance" = 100
   *   55 "}x_Megacrop_Growth_Chance" = 25 */
  33: 3, 35: 100, 55: 25,
};

export function uniqueSushi(ctx) {
  const row = (sel.sushi(ctx.s)[5] ?? []);
  let u = 0;
  for (let f = 0; f < row.length; f++) { if (Number(row[f]) >= 0) u = f + 1; else break; }
  return u;
}

/** SushiStuff("RoG_BonusQTY",b,0) as a fragment. */
export function sushiRoG(ctx, b) {
  if (!(b in SUSHI_ROG)) throw new Error(`RoG_BonusQTY(${b}): Research[37][${b}] not verified in N.js — add to SUSHI_ROG first`);
  const u = uniqueSushi(ctx);
  const v = u > b ? SUSHI_ROG[b] : 0;
  return { value: v, note: `UniqueSushi=${u} ${u > b ? ">" : "<="} ${b} -> ${v}%` };
}
