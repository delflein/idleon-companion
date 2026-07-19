/* bonuses/farming.mjs — the FULL _customBlock_FarmingStuffs mirror (N.js:17920-17969, read
 * whole and transcribed sub-command by sub-command, 2026-07-18). One export per sub-command,
 * same math, same clamps. Tables live in gamedata-farming.mjs (extracted verbatim).
 *
 * Save layout (savemap/w67.mjs, all confirmed): FarmPlot[i] = [seedTier, growthProgress,
 * evoProgress, evoLock, cropsOnVine, ogLevel, ogAccumulator]; FarmUpg (0 seed, 1 beans,
 * 2-9 day market, 10-17 night market, 19 instagrow, 20+e exotics); FarmRank = [plotRanks[36],
 * plotRankExp[36], rankDbLevels[20]]; FarmCrop = {cropId: qty}; Research[9] sticker counts.
 *
 * RANDOMNESS: client formulas with c.randomFloat() (CropsOnVine, CropsBonusValue's doubler)
 * are exposed as their DISPLAY variant (the client's own e==69420 form) plus the chance line —
 * this app plans, it does not simulate ticks. */

import { sel } from "../savemap.mjs";
import { SEED_INFO, MARKET_INFO, MARKET_EXOTIC_INFO, LAND_RANK_DB, STICKERS } from "../../gamedata/gamedata-farming.mjs";
import { gridBonus, gridLevel } from "./research.mjs";
import { eventShopOwned, achieveStatus, killroyBonus } from "./misc.mjs";
import { superBitType, loreOwned, msaBonus } from "./gaming.mjs";
import { winBonus, vaultUpgBonus, grimoireUpgBonus, votingBonus } from "./summoning.mjs";
import { sushiRoG } from "./sushi.mjs";
import { lampBonus, monumentWisdomEvo } from "./holes.mjs";
import { alchBubble } from "./bubbles.mjs";
import { vialBonus } from "./alchemy.mjs";
import { cardLv } from "./cards.mjs";
import { mealBonus } from "./meals.mjs";
import { stampBonusOfType } from "./stamps.mjs";
import { starSignValue } from "./starsigns.mjs";
import { bestTalentAcrossChars } from "./talents.mjs";
import { buttonBonus, mineheadBonusQTY } from "./minehead.mjs";
import { pristineBon, jadeEmporiumOwned } from "./ninja.mjs";
import { mainframeBonus } from "./lab.mjs";
import { emperorBon, legendPts } from "./thingies.mjs";
import { arcadeBonus } from "./arcade.mjs";
import { shinyBonus } from "./breeding.mjs";

const N = (x) => Number(x) || 0;
const F = (v, note, status = "computed", parts) => ({ value: v, status, note, ...(parts ? { parts } : {}) });

/* ---------- basic state ---------- */

export const cropsFound = (ctx) => Object.keys(sel.farmCrop(ctx.s)).length;
export const magicBeans = (ctx) => N(sel.farmUpg(ctx.s)[1]);
export const instagrowCharges = (ctx) => N(sel.farmUpg(ctx.s)[19]);
export const farmingLevel = (ctx, charIdx = null) => {
  // Lv0[16] — farming is account-synced; read the max across chars to be safe.
  let best = 0;
  for (const i of ctx.s.charIdxs) best = Math.max(best, N((ctx.s.at("Lv0_N", i) ?? [])[16]));
  return best;
};
const w6Merit = (ctx) => N((((ctx.s.get("TaskZZ2") ?? [])[5] ?? [])[2]));

/** "PlotOwned": round(min(36, 1 + BU(0,0) + GemItemsPurchased[135] + min(3, Tasks[2][5][2]))). */
export function plotOwned(ctx) {
  const gem = N((ctx.s.get("GemItemsPurchased") ?? [])[135]);
  return Math.round(Math.min(36, 1 + basketUpgQTY(ctx, 0, 0).value + gem + Math.min(3, w6Merit(ctx))));
}

/** "MedalSeedsAvailable" = min(50, Spelunk("DoWeHaveLoreN1",3,0)). */
export const medalSeedsAvailable = (ctx) => Math.min(50, N(sel.loreOwned(ctx.s)[3]));

/** "CropType": absolute crop id of a plot. */
export const cropTypeOf = (plot) => Math.round(SEED_INFO[Math.max(0, N(plot[0]))].cropIdMin + N(plot[2]));

/* ---------- markets: BasketUpgQTY / costs / max levels ---------- */

/** GenINFO[71]: distinct crops with stock >= 200/1e3/2.5e3/1e4/1e5, each ONLY counted while its
 *  GMO is owned (FarmUpg[11]/[12]/[14]/[16]/[17] > 0) — verbatim from the "h" tick handler. */
export function qualifiedCropCounts(ctx) {
  const up = sel.farmUpg(ctx.s);
  const gates = [N(up[11]) > 0, N(up[12]) > 0, N(up[14]) > 0, N(up[16]) > 0, N(up[17]) > 0];
  const th = [200, 1e3, 2.5e3, 1e4, 1e5];
  const counts = [0, 0, 0, 0, 0];
  for (const q of Object.values(sel.farmCrop(ctx.s)))
    for (let i = 0; i < 5; i++) if (gates[i] && N(q) >= th[i]) counts[i]++;
  return counts;
}
/** The client's GenINFO[71] index for night-market slot e: floor(e/2)+floor(e/7). */
export const gmoCountIdx = (e) => Math.floor(e / 2) + Math.floor(e / 7);

/**
 * "BasketUpgQTY"(b,e), verbatim:
 *   b=0 (day):    FarmUpg[2+e] * MarketInfo[e][8]
 *   b=1 (night):  e in {1,3} -> 1 + lvl*coef/100 ; else lvl*coef
 *   b=99 (GMO-scaled night):
 *     e=7 SUPER_GMO   -> 1 + lvl*coef*N100k/100
 *     e=1 EVO_GMO     -> max(1,BU(99,7)) * (1 + lvl*coef/100)^N200      (COMPOUNDS per crop)
 *     e=5 LAND_RANK   -> owned ? 1 : 0
 *     e=2/4/6         -> max(1,BU(99,7)) * (1 + lvl*coef*N/100)
 */
export function basketUpgQTY(ctx, b, e) {
  const up = sel.farmUpg(ctx.s);
  if (b === 0) {
    const lvl = N(up[2 + e]), coef = MARKET_INFO[e].bonusPerLv;
    return F(lvl * coef, `${MARKET_INFO[e].name} lv ${lvl} x ${coef}`);
  }
  const row = MARKET_INFO[e + 8], lvl = N(up[2 + e + 8]), coef = row.bonusPerLv;
  if (b === 1) {
    const v = (e === 1 || e === 3) ? 1 + lvl * coef / 100 : lvl * coef;
    return F(v, `${row.name} lv ${lvl}${e === 1 || e === 3 ? ` -> x${(1 + lvl * coef / 100).toFixed(3)}` : ` x ${coef}`}`);
  }
  // b === 99
  const counts = qualifiedCropCounts(ctx);
  if (e === 7) {
    const v = 1 + lvl * coef * counts[4] / 100;
    return F(v, `SUPER_GMO lv ${lvl} x ${counts[4]} crops>=100k -> x${v.toFixed(3)}`);
  }
  if (e === 5) return F(N(up[2 + 5 + 8]) >= 1 ? 1 : 0, `LAND_RANK ${N(up[15]) >= 1 ? "unlocked" : "locked"}`);
  const superG = Math.max(1, basketUpgQTY(ctx, 99, 7).value);
  if (e === 1) {
    const v = superG * Math.pow(1 + lvl * coef / 100, counts[0]);
    return F(v, `EVOLUTION_GMO lv ${lvl}: (1+${(lvl * coef / 100).toFixed(3)})^${counts[0]} crops>=200 x super ${superG.toFixed(3)} -> x${v.toFixed(2)}`);
  }
  const n = counts[gmoCountIdx(e)];
  const v = superG * (1 + lvl * coef * n / 100);
  return F(v, `${row.name} lv ${lvl} x ${n} qualified crops x super ${superG.toFixed(3)} -> x${v.toFixed(3)}`);
}

/** "MarketMaxLV": base maxLv, +Grid_Bonus(171) EXCEPT e==0 (both tabs: LAND_PLOTS/OVERGROWTH)
 *  and night LAND_RANK (b==1,e==5). */
export function marketMaxLv(ctx, tab, e) {
  const base = MARKET_INFO[e + 8 * tab].maxLv;
  if (e === 0 || (tab === 1 && e === 5)) return base;
  return Math.floor(gridBonus(ctx, 171).value + base);
}

/** "MarketCostType": which crop id the next level of day upgrade e costs (LAND_PLOTS uses the
 *  accelerated level index lvl + 2*floor(lvl/3) + floor(lvl/4)). */
export function marketCostCrop(ctx, e, lvlOverride = null) {
  const row = MARKET_INFO[e];
  const lvl = lvlOverride ?? N(sel.farmUpg(ctx.s)[2 + e]);
  const li = e === 0 ? lvl + 2 * Math.floor(lvl / 3) + Math.floor(lvl / 4) : lvl;
  return Math.floor(row.cropId + row.cropIdInc * li);
}

/** "MarketCostQTY": emperor-reduced base*exp^lvl, then BETTER_DAY (E34/E35) or BETTER_NIGHT
 *  (E36/E37), each max(0.1, 1-x/100). Floored below 1e8. */
export function marketCostQty(ctx, tab, e, lvlOverride = null) {
  const row = MARKET_INFO[e + 8 * tab];
  const lvl = lvlOverride ?? N(sel.farmUpg(ctx.s)[2 + e + 8 * tab]);
  const emp = emperorBon(ctx, 2);
  let v = Math.max(0.001, 1 - emp / (emp + 100)) * row.baseCost * Math.pow(row.costExp, lvl);
  const [rA, rB] = tab === 0 ? [34, 35] : [36, 37];
  v *= Math.max(0.1, 1 - exoticBonus(ctx, rA).value / 100) * Math.max(0.1, 1 - exoticBonus(ctx, rB).value / 100);
  return v < 1e8 ? Math.floor(v) : v;
}

/** "MarketUpgUnlocked": first still-locked index of the tab (8 = all 8 visible). */
export function marketUnlockedCount(ctx, tab) {
  const found = cropsFound(ctx);
  for (let e = 0; e < 8; e++) if (found < MARKET_INFO[e + 8 * tab].unlockReq) return e;
  return 8;
}

/* ---------- exotic market ---------- */

/** "ExoticBonusQTY"(e): saturating rows coeff*L/(1000+L), linear rows coeff*L. Table complete
 *  (all 80 rows extracted verbatim) — generic, no guard needed. Returns a PERCENT (or raw
 *  coefficient units for the odd rows; consumers wrap it exactly like the client). */
export function exoticBonus(ctx, e) {
  const row = MARKET_EXOTIC_INFO[e];
  if (!row) throw new Error(`ExoticBonusQTY(${e}): no MarketExoticInfo row`);
  const L = N(sel.farmUpg(ctx.s)[20 + e]);
  const v = row.saturating ? row.coeff * (L / (1000 + L)) : row.coeff * L;
  return { value: v, note: `${row.name} lv ${L} -> ${row.saturating ? `${row.coeff}*(${L}/${1000 + L})` : `${row.coeff}*${L}`} = ${v.toFixed(3)}` };
}
export const exoticLevel = (ctx, e) => N(sel.farmUpg(ctx.s)[20 + e]);
export const exoticTotalLevels = (ctx) => { let t = 0; for (let e = 0; e < 80; e++) t += Math.ceil(exoticLevel(ctx, e)); return t; };

/** "ExoticLVQTY"(cropQty): levels gained per purchase = ceil((log2(q)/2 + log10(q))
 *  * (1+E(38)/100) * (1+LegendPTS(8)/100)). */
export function exoticLvQty(ctx, cropQty) {
  const q = Math.max(1, cropQty);
  const raw = Math.log2(q) / 2 + Math.log10(q);
  return Math.ceil(raw * (1 + exoticBonus(ctx, 38).value / 100) * (1 + legendPts(ctx, 8) / 100));
}

/** "ExoticPurchasesAllowed" = round(4 + Minehead BonusQTY(8) + 8*EventShop(43) + Sushi RoG(33)
 *  + 3*Dreamstuff CloudBonus(66)). EventShop 43 >= 53 -> unknowable; floored at 0 (flagged). */
export function exoticPurchasesAllowed(ctx) {
  const shop43 = eventShopOwned(ctx, 43);
  if (shop43 === null) ctx.unknown('Summoning("EventShopOwned",43) [exotic purchases] — Number2Letter[43+] unrecoverable? id 43 < 53 so this should resolve; investigate if null');
  const v = Math.round(4 + mineheadBonusQTY(ctx, 8).value + 8 * (shop43 ?? 0) + sushiRoG(ctx, 33).value + 3 * sel.cloudBonus(ctx.s, 66));
  return F(v, `4 + minehead ${mineheadBonusQTY(ctx, 8).value} + 8*eventShop43(${shop43 ?? "?"}) + sushi33 ${sushiRoG(ctx, 33).value} + 3*cloud66 ${sel.cloudBonus(ctx.s, 66)}`, shop43 === null ? "partial" : "computed");
}
/** "PCTofExoticPurchasesFREE" = min(80, 30*EventShop(43)) + min(25, 25*Minehead(8)). */
export function pctExoticFree(ctx) {
  const shop43 = eventShopOwned(ctx, 43) ?? 0;
  const mh = mineheadBonusQTY(ctx, 8).value > 0 ? 1 : 0;
  return Math.min(80, 30 * shop43) + Math.min(25, 25 * mh);
}

/* --- the weekly rotation: exact client PRNG (Haxe Rand port, N.js:40/68) --- */

function lavaHash(a, b = 5381) {
  a = Math.imul(a, -862048943);
  a = Math.imul(a << 15 | a >>> 17, 461845907);
  b ^= a;
  b = (Math.imul(b << 13 | b >>> 19, 5) + -430675100) | 0;
  b = Math.imul(b ^ b >>> 16, -2048144789);
  b = Math.imul(b ^ b >>> 13, -1028477387);
  return b ^ b >>> 16;
}
export class LavaRand {
  constructor(seed) {
    this.seed = seed;
    this.seed2 = lavaHash(seed);
    if (this.seed === 0) this.seed = 1;
    if (this.seed2 === 0) this.seed2 = 1;
  }
  rand() {   // NOTE: can return a NEGATIVE value (%10007 of a signed 32-bit int) — clamp at use.
    this.seed = 36969 * (this.seed & 65535) + (this.seed >> 16);
    this.seed2 = 18000 * (this.seed2 & 65535) + (this.seed2 >> 16);
    return ((this.seed << 16) + this.seed2 | 0) % 10007 / 10007;
  }
}

/** The current exotic week index — from WALL CLOCK, not the save (the save's OptLacc[481] can
 *  lag a boundary; Toolbox's stale-week bug). GlobalTime is seconds since epoch. */
export const exoticWeekNow = (nowMs = Date.now()) => Math.floor(nowMs / 1000 / 604800);
export const exoticWeekEndsMs = (week) => (week + 1) * 604800 * 1000;

/** The 8 rotation slots of a week — exact client algorithm (N.js:19534-19536):
 *  seed round(100*week + slot), value floor(clamp(60*rand(),0,59)); on collision +1000, reroll. */
export function exoticRotation(week) {
  const slots = [];
  const draw = (seed) => Math.floor(Math.max(0, Math.min(59, 60 * new LavaRand(Math.round(seed)).rand())));
  for (let slot = 0; slot < 8; slot++) {
    let bump = 0, v = draw(100 * week + slot);
    while (slots.includes(v)) { bump += 1000; v = draw(100 * week + slot + bump); }
    slots.push(v);
  }
  return slots;
}

/* ---------- growth ---------- */

/** "GrowthRate" = max(1, Speed GMO) * (1 + (NUTRITIOUS_SOIL + vial 6FarmSpd + E(30))/100)
 *  * (1 + WinBonus(2)/100). */
export function growthRate(ctx) {
  const gmo = Math.max(1, basketUpgQTY(ctx, 99, 2).value);
  const soil = basketUpgQTY(ctx, 0, 2).value;
  const vial = vialBonus(ctx, 64).value;
  const gogo = exoticBonus(ctx, 30).value;
  const win = winBonus(ctx, 2).value;
  const v = gmo * (1 + (soil + vial + gogo) / 100) * (1 + win / 100);
  return F(v, `SpeedGMO x${gmo.toFixed(3)} x (1+(soil ${soil.toFixed(0)} + vial ${vial.toFixed(1)} + Gogogrow ${gogo.toFixed(1)})/100) x (1+win2 ${win.toFixed(1)}/100)`, "computed", [
    { label: "Speed GMO", value: gmo }, { label: "Nutritious Soil %", value: soil },
    { label: "Ricecakorade vial %", value: vial }, { label: "Gogogrow exotic %", value: gogo },
    { label: "Summoning win 2 %", value: win },
  ]);
}

/** "GrowthReq" in growth units; Medal (tier 6) is 25200 * GrowthRate => a FLAT 7h real time. */
export const growthReq = (ctx, tier) => tier === 6 ? 25200 * growthRate(ctx).value : 14400 * Math.pow(1.5, tier);
/** Real seconds for a full cycle of a tier (rate cancels for Medal). */
export const growthTimeSeconds = (ctx, tier) => tier === 6 ? 25200 : 14400 * Math.pow(1.5, tier) / growthRate(ctx).value;

/* ---------- overgrowth ---------- */

export const ogMulti = (plot) => Math.min(1e9, Math.max(1, Math.pow(2, N(plot[5]))));

/** "NextOGchance" for a plot with OG level `og`:
 *  0.4^(og+1) * max(1, OG_FERTILIZER) * (1+Pristine(11)/100) * (1+sign67/100)
 *  * (1+2*merit/100) * (1+15*Ach(365)/100) * (1+LRT(3)/100) * (1+E(26)/100)*(1+E(27)/100). */
export function nextOGchance(ctx, og) {
  const fert = Math.max(1, basketUpgQTY(ctx, 1, 3).value);
  const taffy = pristineBon(ctx, 11).value;
  const sign = starSignValue(ctx, 67);
  const merit = w6Merit(ctx);
  const ach = 15 * achieveStatus(ctx, 365);
  const lrt = landRankTotal(ctx, 3).value;
  const e26 = exoticBonus(ctx, 26).value, e27 = exoticBonus(ctx, 27).value;
  const v = Math.pow(0.4, og + 1) * fert * (1 + taffy / 100) * (1 + sign.value / 100)
    * (1 + 2 * merit / 100) * (1 + ach / 100) * (1 + lrt / 100) * (1 + e26 / 100) * (1 + e27 / 100);
  return F(v, `0.4^${og + 1} x fert ${fert.toFixed(2)} x taffy +${taffy}% x sign67 +${sign.value}% x merit +${2 * merit}% x ach +${ach}% x ranks +${lrt.toFixed(1)}% x Evergrow +${e26.toFixed(1)}%/+${e27.toFixed(1)}%`, sign.status === "unknown" ? "partial" : "computed");
}

/* ---------- harvest: quantity / value / EXP ---------- */

/** "CropsOnVine" = floor(1 + rand + pct/100), pct = STRONGER_VINES + 20*gem139 + E(31..33).
 *  Returned as {min, max, expected, pct}. */
export function cropsOnVinePct(ctx) {
  const vines = basketUpgQTY(ctx, 0, 1).value;
  const gem = 20 * N((ctx.s.get("GemItemsPurchased") ?? [])[139]);
  const ex = exoticBonus(ctx, 31).value + exoticBonus(ctx, 32).value + exoticBonus(ctx, 33).value;
  const pct = vines + gem + ex;
  const p = pct / 100;
  // E[floor(1 + rand + p)] = 1 + p exactly (the fractional part IS the +1 chance).
  return { pct, min: Math.floor(1 + p), max: Math.floor(1 + p) + (p % 1 > 0 ? 1 : 0), expected: 1 + p, note: `vines ${vines} + gem139 ${gem} + Bountiful ${ex.toFixed(1)} = ${pct.toFixed(1)}%` };
}

/** Value-multi cap: 1e4 * (1 + (E23+E24+E25)/100) — STALK_VALUE raises the 10,000x cap. */
export function cropValueCap(ctx) {
  const s = exoticBonus(ctx, 23).value + exoticBonus(ctx, 24).value + exoticBonus(ctx, 25).value;
  return { value: 1e4 * (1 + s / 100), note: `10000 x (1 + ${s.toFixed(1)}%)` };
}

/** "CropsBonusValue" DISPLAY variant (the client's own e==69420 form — no random doubler):
 *  min(cap, round((1+LRT(1)/100) * max(1,VALUE_GMO) * (1+(LRU(1)*plotRank + Vote29)/100))). */
export function cropValueDisplay(ctx, plotRank) {
  const lrt = landRankTotal(ctx, 1).value;
  const gmo = Math.max(1, basketUpgQTY(ctx, 99, 6).value);
  const vote = votingBonus(ctx, 29);
  const perRank = landRankUpg(ctx, 1).value;
  const raw = Math.round((1 + lrt / 100) * gmo * (1 + (perRank * plotRank + vote.value) / 100));
  const cap = cropValueCap(ctx);
  return F(Math.min(cap.value, raw), `(1+ranks ${lrt.toFixed(1)}%) x ValueGMO ${gmo.toFixed(2)} x (1+(prod ${perRank.toFixed(2)}x${plotRank} + vote ${vote.value})/100) = ${raw} vs cap ${Math.round(cap.value)}`, vote.status === "unknown" ? "partial" : "computed");
}

/** The product-doubler chance line: PRODUCT_DOUBLER + DOUBLE_PETAL exotics (percent; 100 = a
 *  guaranteed extra double). */
export function productDoublerPct(ctx) {
  return basketUpgQTY(ctx, 0, 5).value + exoticBonus(ctx, 28).value + exoticBonus(ctx, 29).value;
}

/** "FarmingEXP" multiplier — the whole verbatim stack (minus SkillStats("AllSkillxpMULTI"),
 *  which is the generic all-skill term; exposed separately as `missing` so callers can flag). */
export function farmingExpMulti(ctx) {
  const gmo = Math.max(1, basketUpgQTY(ctx, 99, 4).value);
  const seeds = basketUpgQTY(ctx, 0, 3).value;
  const msa = msaBonus(ctx, 6).value;
  const rift = 25 * riftSkillRank(ctx, 15, 0);
  const meal = mealBonus(ctx, "zFarmExp");
  const arcade = arcadeBonus(ctx, 36).value;
  const e21 = exoticBonus(ctx, 21).value, e22 = exoticBonus(ctx, 22).value;
  const vault77 = vaultUpgBonus(ctx, 77);
  const win8 = winBonus(ctx, 8).value;
  const vial = vialBonus(ctx, 72).value;
  const card = 2 * cardLv(ctx, "w6b2");
  const pristine = pristineBon(ctx, 9).value;
  const mf16 = mainframeBonus(ctx, 16);
  const sign66 = starSignValue(ctx, 66);
  const ach = 10 * achieveStatus(ctx, 360) + 15 * achieveStatus(ctx, 356);
  const vote = votingBonus(ctx, 29);
  const shiny = shinyBonus(ctx, 24).value;
  const merit = 2 * w6Merit(ctx);
  const lrt4 = landRankTotal(ctx, 4).value;
  const talent206 = bestTalentAcrossChars(ctx, 206);
  if (mf16.value === null) ctx.unknown('MainframeBonus(16) "Spiritual_Growth" [farming EXP] — lab connectivity unproven; counted 0');
  const v = gmo
    * (1 + (seeds + msa + rift + meal.value + arcade + e21 + vault77) / 100)
    * (1 + e22 / 100) * (1 + win8 / 100)
    * (1 + (vial + 0 /* statue 25 unread */ + card + pristine + (mf16.value ?? 0) + sign66.value + 0 /* guild 14 */ + ach + vote.value) / 100)
    * (1 + (shiny + merit) / 100) * (1 + lrt4 / 100) * (1 + talent206.value / 100);
  ctx.unknown('FarmingEXP: SkillStats("AllSkillxpMULTI"), Compost statue 25 and Guild bonus 14 are unread — multiplier is a lower bound');
  return F(v, `EXP_GMO ${gmo.toFixed(2)} x brackets (seeds ${seeds}, MSA ${msa.toFixed(0)}, rift ${rift}, meal ${meal.value}, arcade ${arcade.toFixed(1)}, exotics ${e21.toFixed(0)}/${e22.toFixed(0)}, vault ${vault77}, win8 ${win8.toFixed(1)}, vial ${vial}, card ${card}, pristine ${pristine}, lab16 ${mf16.value ?? "?"}, sign66 ${sign66.value}, ach ${ach}, vote ${vote.value}, shiny ${shiny}, merit ${merit}, ranks ${lrt4.toFixed(1)}, DB206 ${talent206.value.toFixed(1)})`, "partial");
}

/** Farming EXP granted on collecting a plot: (5 + 25*tier*2^tier*1.25^evoProgress)
 *  * FarmingEXP * OGmulti (the "j" handler, N.js:19284). */
export const collectExpBase = (tier, evoProgress) => 5 + 25 * tier * Math.pow(2, tier) * Math.pow(1.25, evoProgress);

/* ---------- rift skill mastery (RiftStuff "skillLvRanks"/"RiftSkillBonus") ---------- */

/** Tier of total skill levels across chars: <150:0 <200:1 <300:2 <400:3 <500:4 <750:5 <1000:6 else 7.
 *  RiftSkillBonus(skill, b) = Rift[0] >= 15 && tier > b ? 1 : 0. skillIdx 15 = farming (Lv0[16]). */
export function riftSkillRank(ctx, skillIdx, b) {
  if (N((sel.rift(ctx.s) ?? [])[0]) < 15) return 0;
  let total = 0;
  for (const i of ctx.s.charIdxs) total += Math.max(0, N((ctx.s.at("Lv0_N", i) ?? [])[skillIdx + 1]));
  const tier = total < 150 ? 0 : total < 200 ? 1 : total < 300 ? 2 : total < 400 ? 3 : total < 500 ? 4 : total < 750 ? 5 : total < 1000 ? 6 : 7;
  return tier > b ? 1 : 0;
}

/* ---------- land ranks ---------- */

export const lankRankExpReq = (rank) => (10 + (7 * rank + 25 * Math.floor(rank / 5))) * Math.pow(1.11, rank);

/** "LankRankUpgBonus"(n): rows 4/9/14/19 ("Seed of ...") LINEAR base*level; others hyperbolic
 *  1.7*base*L/(L+80). Both x max(1, DB talent 207) x (1+E(14) PLUMP_DATABASE/100). */
export function landRankUpg(ctx, n) {
  const L = N((sel.farmRanks(ctx.s)[2] ?? [])[n]);
  const t207 = Math.max(1, bestTalentAcrossChars(ctx, 207).value);
  const plump = 1 + exoticBonus(ctx, 14).value / 100;
  const base = LAND_RANK_DB[n].base;
  const raw = (n % 5 === 4) ? base * L : 1.7 * base * L / (L + 80);
  return F(t207 * plump * raw, `${LAND_RANK_DB[n].name} lv ${L} -> ${(n % 5 === 4) ? "linear" : "hyperbolic"} ${raw.toFixed(2)} x DB207 ${t207.toFixed(3)} x Plump ${plump.toFixed(3)}`);
}

/** "LandRankUpgBonusTOTAL"(b): 0 evo (PRODUCT of Mega/Super/Ultra), 1 value, 2 soil exp,
 *  3 OG, 4 farm exp (sums). */
export function landRankTotal(ctx, b) {
  const U = (n) => landRankUpg(ctx, n).value;
  if (b === 0) return F((1 + U(3) / 100) * (1 + U(10) / 100) * (1 + U(15) / 100), "evo: (1+U3)(1+U10)(1+U15)");
  const sets = { 1: [8, 17], 2: [6, 13], 3: [7, 11, 18], 4: [5, 12, 16] };
  if (!(b in sets)) return F(1, "n/a");
  const v = sets[b].reduce((a, n) => a + U(n), 0);
  return F(v, `sum of upgrades ${sets[b].join("/")}`);
}

export function rankPtsLeft(ctx) {
  const fr = sel.farmRanks(ctx.s);
  let t = 0;
  for (let i = 0; i < 36; i++) t += Math.round(N((fr[0] ?? [])[i]));
  for (let i = 0; i < 20; i++) t -= Math.round(N((fr[2] ?? [])[i]));
  return t;
}

/** "LandRank5thColumnMaxLV" = round(1 + Grimoire(9) + ceil(E(15 DATADIGGING)) + LegendPTS(3)). */
export function fifthColMaxLv(ctx) {
  return Math.round(1 + (grimoireUpgBonus(ctx, 9) + Math.ceil(exoticBonus(ctx, 15).value)) + legendPts(ctx, 3));
}

/** "PlotRankGain" — the DISPLAY multiplier (N.js:17965). ⚠ DISCREPANCY (client-side truth,
 *  verified 2026-07-18): the ACTUAL XP award in the collect handler (19285) applies ONLY
 *  RANK_BOOST, Soil-Exp-Boost x prev plot rank, (tier+1), OGmulti and LRT(2) — none of the
 *  Stableroot/Vigouroot exotics nor DB talent 206 that this display includes. Both are exposed;
 *  the game UI OVERSTATES real rank XP gain. */
export function plotRankGainDisplay(ctx) {
  const t206 = bestTalentAcrossChars(ctx, 206).value;
  const boost = basketUpgQTY(ctx, 0, 7).value;
  const e9 = exoticBonus(ctx, 9).value, e10 = exoticBonus(ctx, 10).value, e11 = exoticBonus(ctx, 11).value;
  const e12 = exoticBonus(ctx, 12).value, e13 = exoticBonus(ctx, 13).value;
  const v = (1 + t206 / 100) * (1 + (boost + e9 + e10 + e11) / 100) * (1 + e12 / 100) * (1 + e13 / 100);
  return F(v, `DISPLAY ONLY: (1+DB206 ${t206.toFixed(1)}%)(1+(RANK_BOOST ${boost}+Stableroot ${(e9 + e10 + e11).toFixed(1)})%)(Vigouroot x${(1 + e12 / 100).toFixed(3)} x${(1 + e13 / 100).toFixed(3)}) — the actual award code applies NONE of these except RANK_BOOST`);
}
/** ACTUAL rank XP on collecting plot i (needs the PREVIOUS plot's rank; plot 0 or prevRank>=1
 *  required at all): (1+RANK_BOOST/100) * (1+SoilExpBoost*prevRank/100) * (tier+1) * OGmulti
 *  * (1+LRT(2)/100). */
export function plotRankXpActual(ctx, { tier, ogLevel, prevRank, isFirst }) {
  if (!isFirst && !(prevRank >= 1)) return F(0, "previous plot has no rank — sequential gate");
  const boost = basketUpgQTY(ctx, 0, 7).value;
  const soil = landRankUpg(ctx, 2).value;
  const lrt2 = landRankTotal(ctx, 2).value;
  const og = Math.min(1e9, Math.max(1, Math.pow(2, ogLevel)));
  const v = (1 + boost / 100) * (1 + soil * (isFirst ? 0 : prevRank) / 100) * (tier + 1) * og * (1 + lrt2 / 100);
  return F(v, `(1+${boost}%)(1+soil ${soil.toFixed(2)}x${isFirst ? 0 : prevRank}%)(tier+1=${tier + 1})(OG x${og})(1+ranks ${lrt2.toFixed(1)}%)`);
}

/* ---------- crop depot (Crop Scientist) ---------- */

/** "CropSCbonMulti" = (1+MainframeBonus(17)/100) * (1+(Grimoire(22)+E(40)+Vault(79))/100). */
export function cropSciMulti(ctx) {
  const mf = mainframeBonus(ctx, 17);
  if (mf.value === null) ctx.unknown('MainframeBonus(17) "Depot_Studies_PhD" [crop depot multi] — lab connectivity unproven; counted 0');
  const g = grimoireUpgBonus(ctx, 22), e = exoticBonus(ctx, 40).value, vb = vaultUpgBonus(ctx, 79);
  const v = (1 + (mf.value ?? 0) / 100) * (1 + (g + e + vb) / 100);
  return F(v, `(1+lab17 ${mf.value ?? "?"}%)(1+(grimoire22 ${g} + Scienterrific ${e.toFixed(1)} + vault79 ${vb})%)`, mf.value === null ? "partial" : "computed");
}

/** The 10 depot bonuses: [emporiumId, formula(C)]. Gated per-bonus on the Jade Emporium
 *  purchase; C = CropsFound. Multiplied by cropSciMulti — EXCEPT the two exponential ones
 *  (b=1 gaming evo, b=3 cooking speed) whose exponent the client also multiplies (verbatim:
 *  the WHOLE pow(...) is multiplied by the multi, same as the rest — kept uniform). */
export const DEPOT_DEFS = [
  { b: 0, emporium: 27, label: "Total Damage", fmt: "+{%", calc: (C) => 20 * C },
  { b: 1, emporium: 24, label: "Gaming plant evo", fmt: "x{", calc: (C) => Math.pow(1.02, C) },
  { b: 2, emporium: 25, label: "Jade gain", fmt: "+{%", calc: (C) => 8 * C },
  { b: 3, emporium: 26, label: "Cooking speed", fmt: "x{", calc: (C) => Math.pow(1.1, C) },
  { b: 4, emporium: 23, label: "Cash", fmt: "+{%", calc: (C) => 15 * C },
  { b: 5, emporium: 28, label: "Shiny pet rate", fmt: "+{%", calc: (C) => 7 * C },
  { b: 6, emporium: 29, label: "Base critters", fmt: "+{", calc: (C) => 0.1 * C },
  { b: 7, emporium: 38, label: "Drop rate (crops past 100)", fmt: "+{%", calc: (C) => Math.max(0, C - 100) },
  { b: 8, emporium: 40, label: "Spelunk POW/Amber (past 200)", fmt: "+{%", calc: (C) => 5 * Math.max(0, C - 200) },
  { b: 9, emporium: 44, label: "Research EXP (per 10 past 200)", fmt: "+{%", calc: (C) => Math.floor(Math.max(0, (C - 200) / 10)) },
];
export function cropSciBonus(ctx, b) {
  const def = DEPOT_DEFS[b];
  const owned = jadeEmporiumOwned(ctx, def.emporium);
  if (owned === null) {
    ctx.unknown(`Ninja EmporiumBonus(${def.emporium}) [depot ${def.label}] — Number2Letter unrecoverable for id >= 53; treated as not owned`);
    return F(0, `emporium ${def.emporium} ownership UNKNOWN`, "unknown");
  }
  if (!owned) return F(0, `emporium ${def.emporium} not owned`);
  const C = cropsFound(ctx);
  const multi = cropSciMulti(ctx);
  const raw = def.calc(Math.round(C));
  return F(raw * multi.value, `${def.label}: f(${C} crops) = ${raw.toFixed(2)} x multi ${multi.value.toFixed(3)}`, multi.status);
}

/* ---------- beans ---------- */

/** "BeanTradeQTY" = sqrt(Σ qty*2.5^tier*1.08^(id-cropIdMin)) x (1+MORE_BEENZ/100)
 *  x (1+(25*Emporium15 + 5*Ach363 + E16+E17+E18 + Vault85)/100) x (1+E19/100)(1+E20/100). */
export function beanTradeQty(ctx) {
  let raw = 0;
  for (const [id, qty] of Object.entries(sel.farmCrop(ctx.s))) {
    const cid = N(id);
    const seed = SEED_INFO.find((r) => cid <= r.cropIdMax && cid >= r.cropIdMin);
    if (!seed) continue;
    raw += N(qty) * Math.pow(2.5, seed.tier) * Math.pow(1.08, cid - seed.cropIdMin);
  }
  const beenz = basketUpgQTY(ctx, 0, 6).value;
  const emp15 = jadeEmporiumOwned(ctx, 15);
  if (emp15 === null) ctx.unknown("Ninja EmporiumBonus(15) Deal Sweetening [beans] — unrecoverable; treated as not owned");
  const adds = 25 * (emp15 ?? 0) + 5 * achieveStatus(ctx, 363)
    + exoticBonus(ctx, 16).value + exoticBonus(ctx, 17).value + exoticBonus(ctx, 18).value + vaultUpgBonus(ctx, 85);
  const v = Math.pow(raw, 0.5) * (1 + beenz / 100) * (1 + adds / 100)
    * (1 + exoticBonus(ctx, 19).value / 100) * (1 + exoticBonus(ctx, 20).value / 100);
  return F(v, `sqrt(depot value ${raw.toExponential(2)}) x (1+beenz ${beenz}%)(1+adds ${adds.toFixed(1)}%)(Largumes x${(1 + exoticBonus(ctx, 19).value / 100).toFixed(3)} x${(1 + exoticBonus(ctx, 20).value / 100).toFixed(3)})`, emp15 === null ? "partial" : "computed");
}

/* ---------- crop evolution ---------- */

/**
 * The shared NextCropChance multiplier stack (N.js:17946-17951, both the b==99 display variant
 * and the per-plot variant use exactly this; they differ only in which plot's land rank feeds
 * term `plotRank` — the display uses PLOT 0 — and in the per-plot base x decay tail).
 * Returns ordered parts: [{id, key, frag}] — each frag.value is the FACTOR (already 1+x/100).
 */
export function evoStackParts(ctx, plotRank) {
  const P = [];
  const add = (id, key, frag, toFactor = null) => P.push({ id, key, frag, value: toFactor ? toFactor(frag.value) : frag.value });
  const pct = (f) => 1 + f.value / 100;
  add("bio", 'BasketUpgQTY(0,4) BIOLOGY_BOOST', basketUpgQTY(ctx, 0, 4), (v) => 1 + v / 100);
  add("win10", 'Summoning("WinBonus",10)', winBonus(ctx, 10), (v) => 1 + v / 100);
  add("lamp", 'Holes("LampBonuses",2,0)', lampBonus(ctx, 2, 0), (v) => 1 + v / 100);
  add("sushi35", 'SushiStuff("RoG_BonusQTY",35)', sushiRoG(ctx, 35), (v) => 1 + v / 100);
  add("bubW10", 'AlchBubbles["W10AllCharz"] Crop Chapter', alchBubble(ctx, "W10AllCharz"), (v) => 1 + v / 100);
  add("bubY6", 'AlchBubbles["Y6"] Cropius Mapper', alchBubble(ctx, "Y6"), (v) => 1 + v / 100);
  add("vial66", 'AlchVials["6FarmEvo"] Flavorgil', vialBonus(ctx, 66), (v) => 1 + v / 100);
  const card = 50 * cardLv(ctx, "w7b5");
  add("cardW7b5", '50*CardLv("w7b5")', F(card, `card lv ${cardLv(ctx, "w7b5")} x 50%`), (v) => 1 + v / 100);
  add("mealEvo", 'MealBonus("zCropEvo")', mealBonus(ctx, "zCropEvo"), (v) => 1 + v / 100);
  add("vault78", 'VaultUpgBonus(78)', F(vaultUpgBonus(ctx, 78), "Croppius Evolvius"), (v) => 1 + v / 100);
  add("monument", 'Holes("MonumentROGbonuses",2,4)', monumentWisdomEvo(ctx), (v) => 1 + v / 100);
  add("stamp", 'StampBonusOfTypeX("CropEvo")', stampBonusOfType(ctx, "CropEvo"), (v) => 1 + v / 100);
  add("grim14", 'GrimoireUpgBonus(14)', F(grimoireUpgBonus(ctx, 14), "Sacrifice of Harvest"), (v) => 1 + v / 100);
  const summLv = Math.max(...ctx.s.charIdxs.map((i) => N((ctx.s.at("Lv0_N", i) ?? [])[18])));
  const mealSumm = mealBonus(ctx, "zCropEvoSumm");
  const summScale = Math.ceil((summLv + 1) / 50);
  add("mealSumm", 'MealBonus("zCropEvoSumm") x ceil((SummLv+1)/50)',
    F(mealSumm.value * summScale, `${mealSumm.note}; x${summScale} (Summoning LV ${summLv})`, mealSumm.status), (v) => 1 + v / 100);
  add("ach355", '5*AchieveStatus(355)', F(5 * achieveStatus(ctx, 355), "Lil' Overgrowth"), (v) => 1 + v / 100);
  add("killroy", 'max(1, KillroyBonuses(1))', killroyBonus(ctx, 1), (v) => Math.max(1, v));
  add("evoGmo", 'max(1, BasketUpgQTY(99,1) EVOLUTION_GMO)', basketUpgQTY(ctx, 99, 1), (v) => Math.max(1, v));
  add("rift", '1+15*RiftSkillBonus(15,1)/100', F(15 * riftSkillRank(ctx, 15, 1), "farming skill mastery tier > 1"), (v) => 1 + v / 100);
  const sign = starSignValue(ctx, 65);
  const flv = farmingLevel(ctx);
  add("sign65", 'StarSigns["65"] Cropiovo x Farming LV', F(sign.value * flv, `${sign.note}; x${flv} farming LV`, sign.status), (v) => 1 + v / 100);
  add("lrt0", 'max(1, LandRankUpgBonusTOTAL(0))', landRankTotal(ctx, 0), (v) => Math.max(1, v));
  add("talent205", 'max(1, getbonus2(1,205,-1)) Mass Irrigation', bestTalentAcrossChars(ctx, 205), (v) => Math.max(1, v));
  const vote = votingBonus(ctx, 29);
  const perRank = landRankUpg(ctx, 0);
  add("plotRank", 'LankRankUpgBonus(0) x plotRank + VotingBonusz(29)',
    F(perRank.value * plotRank + vote.value, `Evolution Boost ${perRank.value.toFixed(2)} x rank ${plotRank} + vote ${vote.value}`, vote.status === "unknown" ? "partial" : "computed"), (v) => 1 + v / 100);
  add("sprout0", 'ExoticBonusQTY(0)', exoticBonus(ctx, 0), (v) => 1 + v / 100);
  add("button5", 'Minehead("Button_Bonuses",5)', buttonBonus(ctx, 5), (v) => 1 + v / 100);
  add("sprout1", 'ExoticBonusQTY(1)', exoticBonus(ctx, 1), (v) => 1 + v / 100);
  add("sticker4", 'StickerBonus(4) Sporrious Stalk', stickerBonus(ctx, 4), (v) => 1 + v / 100);
  add("sprout2", 'ExoticBonusQTY(2)', exoticBonus(ctx, 2), (v) => 1 + v / 100);
  add("sprout3", 'ExoticBonusQTY(3)', exoticBonus(ctx, 3), (v) => 1 + v / 100);
  const gene = [4, 5, 6, 7, 8].reduce((a, e, k) => a + Math.max(0, flv - 50 * (k + 1)) * exoticBonus(ctx, e).value, 0);
  add("geneology", 'Σ max(0, FarmLV - 50k) x ExoticBonusQTY(4..8)', F(gene, `Geneology I-V at farming LV ${flv}`), (v) => 1 + v / 100);
  return P;
}

/** "NextCropChance" b==99 display variant: the stack with PLOT 0's rank, no base/decay. */
export function nextCropChanceDisplay(ctx) {
  const rank0 = N((sel.farmRanks(ctx.s)[0] ?? [])[0]);
  const parts = evoStackParts(ctx, rank0);
  return { value: parts.reduce((a, p) => a * p.value, 1), parts };
}

/** "NextCropChanceDENOM": identity except the dormant 6.942e-5 -> 1e-110 arm. */
export const nextCropChanceDenom = (d) => d === 6.942e-5 ? 1 / Math.pow(10, 110) : d;

/** Per-plot "NextCropChance": 0 if farming LV < 2 or the plot sits on its tier's LAST crop;
 *  else stack(plotRank) x base(GenINFO[68] = 0.30 for EVERY tier) x decay^evoProgress. */
export function nextCropChancePlot(ctx, plotIdx) {
  const plot = sel.farmPlots(ctx.s)[plotIdx];
  if (!plot || N(plot[0]) < 0) return { value: 0, note: "empty plot" };
  const tier = N(plot[0]);
  if (farmingLevel(ctx) < 2) return { value: 0, note: "farming LV < 2" };
  if (cropTypeOf(plot) === SEED_INFO[tier].cropIdMax) return { value: 0, note: "final crop of the tier — cannot evolve", terminal: true };
  const rank = N((sel.farmRanks(ctx.s)[0] ?? [])[plotIdx]);
  const parts = evoStackParts(ctx, rank);
  const stack = parts.reduce((a, p) => a * p.value, 1);
  const base = 0.30;   // GenINFO[68][tier] is initialized to SeedInfo[0][5] for EVERY tier (N.js ~19513)
  const decay = Math.pow(nextCropChanceDenom(SEED_INFO[tier].decay), N(plot[2]));
  return { value: stack * base * decay, stack, base, decay, evoProgress: N(plot[2]), parts };
}

/* ---------- megacrop stickers ---------- */

export const totalStickers = (ctx) => (sel.stickerLevels(ctx.s) ?? []).reduce((a, x) => a + Math.round(N(x)), 0);

/** "StickerBonus"(seed) — API-compatible with the original module (artifact-find imports it).
 *  (1 + (Grid_Bonus(68,2) + 30*EventShop(37))/100) * (1 + 20*SuperBit(62)/100)
 *  * Research[9][seed] * STICKERS[seed].coeff. Coeff table now complete (all 12 rows). */
export function stickerBonus(ctx, b) {
  const row = STICKERS[b];
  if (!row) throw new Error(`StickerBonus(${b}): no Research[25] row`);
  const lv = Math.round(N(sel.stickerLevels(ctx.s)[b]));
  const crowns = ((ctx.s.get("Research") ?? [])[11] ?? []).length;
  const crown = gridBonus(ctx, 68).value * crowns;
  const shop = eventShopOwned(ctx, 37) ? 30 : 0;
  const bit = superBitType(ctx, 62);
  if (bit === null && lv > 0) ctx.unknown(`GamingStatType("SuperBitType",62,0) [inside StickerBonus] — Number2Letter[62] unrecoverable (ids >= 53); treated as not owned, costs at most x1.2 on this term`);
  const v = (1 + (crown + shop) / 100) * (1 + 20 * (bit ?? 0) / 100) * lv * row.coeff;
  return {
    value: v,
    status: bit === null && lv > 0 ? "partial" : "computed",
    note: `${row.name} x${lv} x coeff ${row.coeff}; crowns +${crown.toFixed(1)}% (x${crowns}) + eventShop37 ${shop} ; superbit62 ${bit === null ? "UNKNOWN" : bit}`,
  };
}

/** "StickerOddsMulti": daily-doubling counter (OptLacc[607]) x grid 67(x crowns)/88 x
 *  StickerBonus(5) x Arcade(64) x farming-LV superbit 55 x Sushi(55). */
export function stickerOddsMulti(ctx) {
  const days = sel.stickerDryDays(ctx.s);
  const doggie = Math.max(1, Math.pow(2, Math.min(12, days)) + 1500 * Math.max(0, days - 11));
  const crowns = ((ctx.s.get("Research") ?? [])[11] ?? []).length;
  const g67 = gridBonus(ctx, 67).value * crowns;   // e==2 arm: x crowns reclaimed
  const g88 = gridBonus(ctx, 88).value;
  const glassical = stickerBonus(ctx, 5).value;
  const arcade = arcadeBonus(ctx, 64).value;
  const bit55 = superBitType(ctx, 55);
  if (bit55 === null) ctx.unknown('SuperBitType(55) "Mo Stickers Mo Bonusers" [sticker odds] — unrecoverable (>= 53); treated as not owned');
  const lvTerm = 1 + 0.02 * (bit55 ?? 0) * Math.max(0, farmingLevel(ctx) - 300);
  const sushi = sushiRoG(ctx, 55).value;
  const v = doggie * (1 + g67 / 100) * (1 + g88 / 100) * (1 + glassical / 100) * (1 + arcade / 100) * lvTerm * (1 + sushi / 100);
  return F(v, `doggie x${doggie.toFixed(0)} (${days} dry days) x crowns67 +${g67.toFixed(0)}% x depot88 +${g88}% x Glassical +${glassical.toFixed(0)}% x arcade +${arcade.toFixed(1)}% x bit55 ${bit55 ?? "?"} x sushi +${sushi}%`, bit55 === null ? "partial" : "computed");
}

/** "StickerOdds"(seedTier): multi / (5000 * 7^tier * max(10-n,5)^n), n = stickers found. */
export function stickerOdds(ctx, seedTier) {
  const n = Math.round(N(sel.stickerLevels(ctx.s)[seedTier]));
  const multi = stickerOddsMulti(ctx);
  const denom = 5e3 * Math.pow(7, seedTier) * Math.pow(Math.max(10 - n, 5), n);
  return F(multi.value / denom, `multi ${multi.value.toExponential(2)} / (5000 x 7^${seedTier} x ${Math.max(10 - n, 5)}^${n})`, multi.status);
}

/** "StickerDMGmulti" = grid 47 researched ? 1 + Grid_Bonus(47)*TotalStickers/100 : 1. */
export function stickerDmgMulti(ctx) {
  if (gridLevel(ctx, 88) < 1) return F(1, "stickers not unlocked (grid 88)");
  if (gridLevel(ctx, 47) < 1) return F(1, "grid 47 not researched");
  const v = 1 + gridBonus(ctx, 47).value * totalStickers(ctx) / 100;
  return F(v, `1 + grid47 ${gridBonus(ctx, 47).value.toFixed(2)} x ${totalStickers(ctx)} stickers / 100`);
}

/** Sticker unlock gate: Grid_Bonus(88) >= 1 — used by AttemptMegacropGrowth. */
export const stickersUnlocked = (ctx) => gridLevel(ctx, 88) >= 1;
