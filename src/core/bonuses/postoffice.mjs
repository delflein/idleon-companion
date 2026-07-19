/* bonuses/postoffice.mjs — BoxRewards[key]: post office box bonuses, per character.
 *
 * Builder: for every box f and bonus B in 0..2:
 *   BoxRewards[PostOffUpgradeInfo[f][16+B]] += PostOfficeINFO("BonusAmount", f, B)
 * BonusAmount(f, B): pts = PostOfficeInfo[3][f][0] (the character's points in box f, saved as
 * POu_N[f]); for B==1 subtract row[13], for B==2 subtract row[14] (the unlock thresholds);
 * round; if > 0: ArbitraryCode5(row[3+4B], row[1+4B], row[2+4B], pts).
 *
 * PO_ROWS carries verified rows only. DropRate = box 11 "Non_Predatory_Loot_Box" bonus 0:
 * decay(50, 200) on the raw points (row fields "50 200 decay %_Drop_Rate ..."). */

import { arbitraryCode5 } from "./util.mjs";

export const PO_ROWS = {
  DropRate: { box: 11, bonus: 0, name: "Non_Predatory_Loot_Box", mode: "decay", b: 50, c: 200, sub: 0 },
};

/** BoxRewards[key] for the ctx's active character; null when no active char (per-char data). */
export function boxReward(ctx, key) {
  const row = PO_ROWS[key];
  if (!row) throw new Error(`BoxRewards["${key}"]: PostOffUpgradeInfo row not verified in N.js — add to PO_ROWS first`);
  if (ctx.activeChar == null) return null;
  const pts = Math.round(Number((ctx.s.at("POu_N", ctx.activeChar) ?? [])[row.box] ?? 0) - row.sub);
  if (!(pts > 0)) return { value: 0, note: `${row.name}: no points` };
  return {
    value: arbitraryCode5(row.mode, row.b, row.c, pts),
    note: `${row.name}: ${pts} pts -> ${row.mode}(${row.b},${row.c})`,
  };
}
