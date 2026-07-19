/* bonuses/holes.mjs — _customBlock_Holes: cavern buildings, monuments, fountain. */

import { sel } from "../savemap.mjs";
import { zenithMarketBonusNum } from "./zenith.mjs";

/** Holes("B_UPG",b,0) — cavern ENGINEER BLUEPRINT bonuses (in-game: The Cavern -> Engineer -> Blueprints). Formulas are bespoke per building; only the
 *  ones read in N.js are implemented. 55 = "Tune of Artifaction": +10% per power of 10 Natural
 *  Notes. Client: `Holes[13][55]===0 ? 0 : 10 * floor(log10(Holes[9][11]))` (getLOG is log10). */
export function bUpg(ctx, b) {
  if (b !== 55) throw new Error(`B_UPG(${b}): formula not verified in N.js — only 55 (Tune of Artifaction) is`);
  const holes = ctx.s.get("Holes") ?? [];
  if (((holes[13] ?? [])[55] ?? 0) === 0) return { value: 0, note: "building not unlocked" };
  const notes = (holes[9] ?? [])[11] ?? 0;
  const v = 10 * Math.floor(Math.log(Math.max(notes, 1)) / 2.30259);
  return { value: v, note: `Natural Notes ${Number(notes).toExponential(3)} -> 10*floor(log10) = ${v}%` };
}

/** Holes("LampBonuses",b,e) — W5 cavern Lamp wishes (N.js:18293):
 *    HoleozDT = "25,10,8;15,40,10;20,35,12;5,1,1;2,2,2"
 *    value = DT[b][e] * Holes[21][min(11, 4+2*b)] * (1 + ZenithMarketBonus(2)/100)
 *  b=2,e=0 = "+20% Next Crop chance" per "World_6_Majigers" wish (Holes[21][8] = wish count).
 *  KNOWN OMISSION: ZenithMarketBonus(2) (its coeff row is unread) — value is a lower bound
 *  whenever Spelunk[45][2] > 0. */
const LAMP_DT = [[25, 10, 8], [15, 40, 10], [20, 35, 12], [5, 1, 1], [2, 2, 2]];
export function lampBonus(ctx, b, e) {
  const holes = ctx.s.get("Holes") ?? [];
  const wishes = Number((holes[21] ?? [])[Math.min(11, 4 + 2 * b)] ?? 0);
  // ZenithMarketBonus(2) = floor(ZENITH_MARKET[2].coeff(=1) * Spelunk[45][2]) — now DECODED
  // (gamedata-w7-zenith.mjs / bonuses/zenith.mjs), so the multiplier is applied, no longer omitted.
  const zenith2 = zenithMarketBonusNum(ctx, 2);
  const v = LAMP_DT[b][e] * wishes * (1 + zenith2 / 100);
  return {
    value: v, status: "computed",
    note: `${LAMP_DT[b][e]}% x ${wishes} wishes (Holes[21][${Math.min(11, 4 + 2 * b)}]) x (1+ZenithMarketBonus(2)=${zenith2}%)`,
  };
}

/** Holes("MonumentROGbonuses",2,4) — Wisdom monument "}x Farming_Crop Evo_Chance"
 *  (HolesInfo[32][24]; coeff HolesInfo[37][24] = 4 < 30 -> the LINEAR arm, N.js:18268):
 *    Holes[15][24] * 4 * max(1, dn)
 *  dn = (1 + MonROG(2,9)/100 + CosmoBonusQTY/100) * (1 + fountainBon(2,13)/100)
 *  self-multi (2,9): idx 29, coeff HolesInfo[37][29] = 250, SATURATING arm (>= 30):
 *    0.1*ceil(10 * L/(250+L) * 250); fountain (2,13): HoleFountUPG[2][13][6] = 1. */
const WISDOM_EVO_IDX = 24, WISDOM_EVO_COEFF = 4, WISDOM_MULTI_IDX = 29, WISDOM_MULTI_COEFF = 250, WISDOM_FOUNT_COEFF = 1;
export function monumentWisdomEvo(ctx) {
  const holes = ctx.s.get("Holes") ?? [];
  const lvlAt = (i) => Number((holes[15] ?? [])[i] ?? 0);
  const mLv = lvlAt(WISDOM_MULTI_IDX);
  const selfMulti = 0.1 * Math.ceil(10 * (mLv / (250 + mLv)) * WISDOM_MULTI_COEFF * 1);
  const cosmo = Math.floor(25 * Number((holes[4] ?? [])[0] ?? 0));
  const fLvl = Number(((holes[31] ?? [])[2] ?? [])[13] ?? 0);
  const fMarble = Number(((holes[32] ?? [])[2] ?? [])[13] ?? 0);
  const fountain = Math.round((fMarble === 0 ? 1 : 1.5 + 0.5 * fMarble) * fLvl * WISDOM_FOUNT_COEFF);
  const dn = (1 + selfMulti / 100 + cosmo / 100) * (1 + fountain / 100);
  const v = lvlAt(WISDOM_EVO_IDX) * WISDOM_EVO_COEFF * Math.max(1, dn);
  return {
    value: v,
    note: `Holes[15][24]=${lvlAt(WISDOM_EVO_IDX)} x ${WISDOM_EVO_COEFF} x dn ${dn.toFixed(3)} (self ${selfMulti}, cosmo ${cosmo}, fountain ${fountain}) = ${v.toFixed(1)}%`,
  };
}

/** Holes("MonumentROGbonuses",1,2) — Monument of Justice artifact-find (the only monument
 *  bonus read in N.js so far; the (monument, bonus) space is bespoke per pair).
 *  coeff = HolesInfo[37][12] = 500 (>=30, so the SATURATING arm):
 *    0.1 * ceil(10 * (L/(250+L)) * coeff * max(1, dn))
 *  dn = (1 + MonumentROGbonuses(1,9)/100 + CosmoBonusQTY(0,0)/100) * (1 + fountainBon(1,13)/100)
 *  fountainBon(b,e) = round(marble * lvl * HoleFountUPG[b][e][6]), marble = Holes[32][b][e]===0
 *                     ? 1 : 1.5 + 0.5*Holes[32][b][e]. CosmoBonusQTY(0,0) = floor(25*Holes[4][0]). */
const MONUMENT_JUSTICE_COEFF = 500, JUSTICE_MULTI_COEFF = 250, COSMO_MONUMENTAL_VIBES = 25, JUDICIAL_BOOST_COEFF = 1;
export function monumentJusticeArtifact(ctx) {
  const holes = ctx.s.get("Holes") ?? [];
  const lvlAt = (i) => Number((holes[15] ?? [])[i] ?? 0);
  const selfMulti = 0.1 * Math.ceil(10 * (lvlAt(19) / (250 + lvlAt(19))) * JUSTICE_MULTI_COEFF * 1);
  const cosmo = Math.floor(COSMO_MONUMENTAL_VIBES * Number((holes[4] ?? [])[0] ?? 0));
  const fLvl = Number(((holes[31] ?? [])[1] ?? [])[13] ?? 0);
  const fMarble = Number(((holes[32] ?? [])[1] ?? [])[13] ?? 0);
  const fountain = Math.round((fMarble === 0 ? 1 : 1.5 + 0.5 * fMarble) * fLvl * JUDICIAL_BOOST_COEFF);
  const dn = (1 + selfMulti / 100 + cosmo / 100) * (1 + fountain / 100);
  const L = lvlAt(12);
  const pct = 0.1 * Math.ceil(10 * (L / (250 + L)) * MONUMENT_JUSTICE_COEFF * Math.max(1, dn));
  return {
    value: pct,
    note: `Holes[15][12]=${L}, selfMulti=${selfMulti}, cosmo=${cosmo}, fountain=${fountain}, dn=${dn.toFixed(3)} -> ${pct.toFixed(2)}%`,
    parts: [
      { label: "monument level", value: L, note: `coeff ${MONUMENT_JUSTICE_COEFF}` },
      { label: "self multi", value: selfMulti, note: "MonumentROGbonuses(1,9)" },
      { label: "cosmo", value: cosmo, note: "Monumental Vibes" },
      { label: "fountain", value: fountain, note: "Judicial Boost" },
    ],
  };
}
