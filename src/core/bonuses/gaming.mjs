/* bonuses/gaming.mjs — GamingStatType(...) and Spelunk lore flags. */

import { sel } from "../savemap.mjs";
import { legendPts } from "./thingies.mjs";
import { letterFlag } from "./util.mjs";
import {
  GAMING_PALETTE, PALETTE_SUPERBIT_DOUBLE, PALETTE_SUPERBIT_DOUBLE_PLUS,
} from "../../gamedata/gamedata-w5-palette.mjs";
import { snailStuff } from "../../gamedata/gamedata-w5-gaming.mjs";

/** GamingStatType("SuperBitType",b,0) = Gaming[12].indexOf(Number2Letter[b]) != -1 ? 1 : 0.
 *  Returns null for ids >= 53 (Number2Letter unrecoverable) — "we cannot tell", NOT "not owned". */
export function superBitType(ctx, b) {
  return letterFlag(sel.superBits(ctx.s), b);
}

/** Spelunk("DoWeHaveLoreN1",b,0) = Spelunk[0][b] >= 1 ? 1 : 0. */
export const loreOwned = (ctx, b) => (Number(sel.loreOwned(ctx.s)[b] ?? 0) >= 1 ? 1 : 0);

/** GamingStatType("MSA_Bonus",6,0) (N.js:17790): 1==Ninja("EmporiumBonus",12,0) ?
 *  1.75 * floor(totalWaves/10) : 0 — +1.75% Farming EXP per 10 MSA waves.
 *  totalWaves is runtime GenINFO[114]; the save-side source is the sum of TotemInfo[0]
 *  (per-totem best waves) — INFERRED from IdleonToolbox parity, and the same sum the Tome's
 *  own "worship totem waves" row (verified in N.js) uses. */
export function msaBonus(ctx, b) {
  if (b !== 6) throw new Error(`MSA_Bonus(${b}): only id 6 (farming EXP) verified in N.js`);
  const owned = letterFlag((sel.ninja(ctx.s)[102] ?? [])[9], 12);
  if (!owned) return { value: 0, note: "Jade Emporium 12 (MSA expander) not owned" };
  const totem = (ctx.s.get("TotemInfo") ?? [])[0] ?? [];
  const waves = (Array.isArray(totem) ? totem : Object.keys(totem).filter((k) => k !== "length").map((k) => totem[k]))
    .reduce((a, x) => a + (Number(x) || 0), 0);
  return { value: 1.75 * Math.floor(waves / 10), note: `MSA waves ${waves} (Σ TotemInfo[0], inferred source) -> +${(1.75 * Math.floor(waves / 10)).toFixed(1)}%` };
}

/** GamingStatType("PaletteBonus",g,0). Per-colour rows from the GamingPalette table
 *  (field[4] = cap, field[5] = 1 selects the L/(L+25) curve) — verified rows only.
 *  The builder's per-colour tail applies TWO more factors to every colour:
 *    PaletteBonz[g] *= (1 + Thingies("LegendPTS_bonus",10,0)/100)      // Picasso_Gaming, coeff 25
 *    PaletteBonz[g] *= (1 + 0.5*Spelunk("DoWeHaveLoreN1",8,0))         // lore book 8 -> x1.5
 *  plus a `*(2 + 0.5*SuperBitType(59,0))` arm — PER-COLOUR superbit gates, verbatim:
 *  colour 25 needs bit 49, 13 needs 51, 31 needs 52, 18 needs 54, 3 needs 58, 12 needs 61
 *  (bit 59 is the shared +0.5 upgrade). Colour 5 (artifact find) has NO such arm — confirmed
 *  against the full builder 2026-07-17 while hunting the artifact residual. */
/** PALETTE_ROWS — the full 37-slot GamingPalette table (gamedata-w5-palette.mjs, N.js:24242).
 *  curve===1 -> soft-cap L/(L+25)*cap; curve===0 -> linear L*cap. All 37 verified. */
export const PALETTE_ROWS = Object.fromEntries(GAMING_PALETTE.map((r) => [r.idx, {
  cap: r.cap, curve: r.curve, soft: 25, label: r.stat, name: r.name,
}]));
const PALETTE_LEGEND_TALENT = 10, PALETTE_LORE_BOOK = 8;
const PALETTE_SUPERBIT_GATE = PALETTE_SUPERBIT_DOUBLE;   // {colour: gateBit}
const PALETTE_SUPERBIT = PALETTE_SUPERBIT_DOUBLE_PLUS;   // 59, the shared +0.5 upgrade

/** PaletteBonus(g) as a fragment (a PERCENT). Generic over all 37 colours + the "total colour
 *  levels" pseudo-entry PaletteBonus(37) = round(sum Spelunk[9][0..36]). N.js:17766-17770. */
export function paletteBonus(ctx, g) {
  const levels = sel.paletteLevels(ctx.s);
  if (g === 37) {   // PaletteBonz[37] = round(total colour LEVELS)
    const total = GAMING_PALETTE.reduce((a, r) => a + Number(levels[r.idx] ?? 0), 0);
    return { value: Math.round(total), status: "computed", note: `total colour levels = ${Math.round(total)}` };
  }
  const row = PALETTE_ROWS[g];
  if (!row) throw new Error(`PaletteBonus(${g}): GamingPalette[${g}] not in table (0..36 or 37)`);
  const L = Number(levels[g] ?? 0);
  const base = row.curve === 1 ? (L / (L + row.soft)) * row.cap : L * row.cap;
  const picasso = legendPts(ctx, PALETTE_LEGEND_TALENT);
  const lore = loreOwned(ctx, PALETTE_LORE_BOOK);
  let v = base * (1 + picasso / 100) * (1 + 0.5 * lore);
  let status = "computed";
  if (g in PALETTE_SUPERBIT_GATE) {
    const gateBit = superBitType(ctx, PALETTE_SUPERBIT_GATE[g]);
    const plusBit = superBitType(ctx, PALETTE_SUPERBIT);
    if (gateBit === null || (gateBit === 1 && plusBit === null)) {
      status = "partial";
      ctx.unknown(`PaletteBonus(${g}) x(2 + 0.5*SBT(59)) arm — gate bit ${PALETTE_SUPERBIT_GATE[g]}/59 unrecoverable (ids >= 53); factor floored, term is a lower bound`);
      if (gateBit === 1) v *= 2;   // gate proven, +0.5 upgrade unknown -> floor at x2
    } else if (gateBit === 1) v *= 2 + 0.5 * plusBit;
  }
  const form = row.curve === 1 ? `${L}/(${L}+${row.soft})*${row.cap}` : `${L}*${row.cap}`;
  return {
    value: v, status,
    note: `Spelunk[9][${g}]=${L} -> ${form} = ${base.toFixed(2)}; x(1+Picasso ${picasso}/100); x(1+0.5*lore8=${lore})`,
  };
}

/** SnailStuff(2,0) = the Immortal Snail bits multiplier from raw snail level, N.js:17773-17776:
 *  2^min(25,max(0,Lv)) * 1.5^min(25,max(0,Lv-25)). Fully computed from GamingSprout[32][1]. */
export function snailBitMulti(ctx) {
  const lv = sel.snailLevel(ctx.s);
  return { value: snailStuff(2, lv, 0, 0), status: "computed", note: `snail lv ${lv} -> SnailStuff(2)` };
}
