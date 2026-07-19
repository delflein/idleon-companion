/* bonuses/divinity.mjs — Divinity("Bonus_Minor", charIdx, e): the god minor-link bonus.
 *
 * Client (_customBlock_Divinity, N.js:17806/17821), verbatim for the single-character arm (b>=0):
 *   BminorDivQdl[g] = GodsInfo[g][13]          for g in 0..9       // each god's "type" id
 *   if ( Companions(0)==1 || Holes("PocketDivOwned",e,0)==1
 *        || (ResearchStuff("Grid_Bonus",173,0)>=1 && e==2)          // Divine Design -> Arctis(=2) to all
 *        || (GemItemsPurchased[9]==1 && e==0) )
 *      return DivMinorBonus(b, BminorDivQdl.indexOf(e))              // the "type god" for e
 *   if Divinity[b+12] == -1 return 0                                 // no blessing god linked
 *   if GodsInfo[Divinity[b+12]][13] == e
 *      return DivMinorBonus(b, Divinity[b+12])                       // linked blessing god gives type e
 *   else: SkillLevels[505] god-rank fallback (extra linked gods) -> NOT read; lower bound 0.
 *
 * DivMinorBonus(b, godId) (N.js:17821):
 *   divLv = <char b>.Lv0[14]                                          // that char's Divinity skill lv
 *   base  = GodsInfo[ GodsInfo[godId][13] ][3]                        // resolves to GodsInfo[e][3]
 *   value = max(1, AlchBubbles.Y2ACTIVE) * (1 + Thingies("CoralKidUpgBonus",3,0)/100)
 *         * divLv/(60+divLv) * base
 * The Y2ACTIVE bubble and CoralKid upgrade (both >= their neutral 1x) are NOT read here, so the
 * value is a LOWER BOUND -> status "partial". Holes("PocketDivOwned") is treated as not-owned
 * (also a floor). e==2 is the AllTalentLV type (Nobisect "+Talent LV", GodsInfo[2][3]=15). */

import { sel } from "../savemap.mjs";
import { companion } from "./companions.mjs";
import { gridBonus } from "./research.mjs";
import { alchBubble } from "./bubbles.mjs";
import { coralKidUpgradeBonus } from "./coralreef.mjs";
import {
  GODS_INFO_FULL, BLESSING_CURRENCY_BY_GOD, BLESSING_MAX_LV_BASE,
} from "../gamedata-w5-divinity.mjs";

/** CustomLists.GodsInfo — na.GodsInfo() @N.js:23830. {name, base:[3], type:[13]} per god. */
export const GODS_INFO = [
  { name: "Snehebatu",  base: 70,  type: 0 }, // 0
  { name: "Arctis",     base: 150, type: 2 }, // 1
  { name: "Nobisect",   base: 15,  type: 7 }, // 2  +Talent LV (the e=2 payout base)
  { name: "Harriep",    base: 100, type: 3 }, // 3
  { name: "Goharut",    base: 100, type: 5 }, // 4
  { name: "Omniphau",   base: 5,   type: 4 }, // 5
  { name: "Purrmep",    base: 50,  type: 6 }, // 6
  { name: "Flutterbis", base: 200, type: 1 }, // 7
  { name: "Kattlekruk", base: 10,  type: 8 }, // 8
  { name: "Bagur",      base: 1,   type: 9 }, // 9
];

/** BminorDivQdl.indexOf(e): the god index whose type == e. */
const godForType = (e) => GODS_INFO.findIndex((g) => g.type === e);

/** DivMinorBonus(charIdx, godId) — the per-character minor payout. Now reads BOTH multipliers the
 *  client applies (N.js:17821, verbatim):
 *    max(1, AlchBubbles.Y2ACTIVE) * (1 + CoralKidUpgBonus(3)/100) * divLv/(60+divLv) * base
 *  BIG_P (Y2ACTIVE) is an ACTIVE alchemy bubble: when its equip state is not derivable the bubble
 *  reads 0 and max(1,0)=1 keeps the historical floor (status stays partial). CoralKidUpgBonus(3) is
 *  fully computed from OptLacc[430] (gamedata-w7-coralreef.mjs) — no unknowns there. */
function divMinorBonus(ctx, charIdx, godId) {
  const g = GODS_INFO[godId];
  if (!g) return { value: 0, note: `god ${godId} not verified`, partial: false };
  const base = GODS_INFO[g.type]?.base ?? 0;    // GodsInfo[GodsInfo[godId][13]][3]
  const divLv = sel.charDivinityLevel(ctx.s, charIdx);
  const bigP = alchBubble(ctx, "Y2ACTIVE");                 // BIG_P "bigger god passive"
  const bigPFactor = Math.max(1, Number(bigP.value) || 0);  // client floors at 1x
  const coral = coralKidUpgradeBonus(ctx, 3);               // (1 + CoralKidUpgBonus(3)/100)
  const coralFactor = 1 + coral.value / 100;
  const value = bigPFactor * coralFactor * (divLv / (60 + divLv)) * base;
  const bigPFloored = bigPFactor === 1 && bigP.status !== "computed";
  return {
    value,
    partial: bigPFloored,   // only the (still-floored) BIG_P bubble keeps it a lower bound
    note: `char ${charIdx} divLv ${divLv} -> ${divLv}/(60+${divLv}) x base ${base}; ` +
      `BIG_P x${bigPFactor.toFixed(2)}${bigPFloored ? " (equip unknown -> floored 1x)" : ""}; ` +
      `CoralKid(3) +${coral.value.toFixed(0)}% -> ${value.toFixed(2)}`,
  };
}

/**
 * Divinity("Bonus_Minor", charIdx, e) for a specific character. Returns {value, status, note}.
 * status "partial" because DivMinorBonus omits two >=1 multipliers (lower bound). e=2 is the
 * AllTalentLV minor bonus talents.mjs needs.
 */
export function divinityMinorBonus(ctx, charIdx, e) {
  const div = sel.divinity(ctx.s);
  const comp0 = companion(ctx, 0);
  const compAll = comp0.owned === true;          // Companions(0)==1 -> every char gets minor bonuses
  const divineDesign = e === 2 && gridBonus(ctx, 173).value >= 1;   // Divine Design -> Arctis(type 2) to all
  const gemGate = e === 0 && Number(sel.gemItemsPurchased(ctx.s)[9] ?? 0) === 1;
  // Holes("PocketDivOwned",e) treated as not-owned (unread) -> floor.

  if (compAll || divineDesign || gemGate) {
    const godId = godForType(e);
    if (godId < 0) return { value: 0, status: "computed", note: `no god provides minor type ${e}` };
    const r = divMinorBonus(ctx, charIdx, godId);
    if (r.partial) ctx.unknown(`Divinity minor(char ${charIdx}, type ${e}): BIG_P (Y2ACTIVE) bubble equip state unknown -> floored 1x (lower bound)`);
    const why = compAll ? "Companions(0) grants all minor bonuses" : divineDesign ? "Divine Design research -> Arctis to everyone" : "gem purchase";
    return { value: r.value, status: r.partial ? "partial" : "computed", note: `${why}: ${r.note}` };
  }

  const linked = Number(div[charIdx + 12] ?? -1);   // this char's blessing/second god
  if (linked === -1) return { value: 0, status: "computed", note: `char ${charIdx}: no blessing god linked` };
  if (GODS_INFO[linked]?.type === e) {
    const r = divMinorBonus(ctx, charIdx, linked);
    if (r.partial) ctx.unknown(`Divinity minor(char ${charIdx}, type ${e}): BIG_P (Y2ACTIVE) bubble equip state unknown -> floored 1x (lower bound)`);
    return { value: r.value, status: r.partial ? "partial" : "computed", note: `char ${charIdx} linked ${GODS_INFO[linked].name} (type ${e}): ${r.note}` };
  }
  // The SkillLevels[505] "god rank" fallback (extra gods applying) is not read -> lower bound 0.
  return { value: 0, status: "partial", note: `char ${charIdx}: blessing god ${GODS_INFO[linked]?.name ?? linked} is not type ${e}; God-Rank (SL 505) fallback unread -> 0 floor` };
}

/* ============================================================================================
 * BLESSING ECONOMICS — per-god major-blessing level/cost/value for the Divinity entity.
 * All formulas verbatim from gamedata-w5-divinity.mjs (N.js:17099-17137, 17809-17811).
 * ============================================================================================ */
import { vaultUpgBonus } from "./summoning.mjs";
import { mineheadBonusQTY } from "./minehead.mjs";
import { jadeEmporiumOwned } from "./ninja.mjs";

/** BlessingMaxLV() — shared cap for every god's MAJOR blessing, N.js:17809:
 *   round(100 + CoralKidUpgBonus(1,0) + Minehead("BonusQTY",9,0) + Summoning("VaultUpgBonus",76,0))
 *  CoralKid(1) and Vault(76) are computed; Minehead(9) is NOT verified in MINEHEAD_QTY -> floored
 *  to 0 and flagged (lower bound on the cap). */
export function blessingMaxLv(ctx) {
  const coral = coralKidUpgradeBonus(ctx, 1).value;
  const vault = vaultUpgBonus(ctx, 76);
  let minehead = 0, partial = false;
  try { minehead = mineheadBonusQTY(ctx, 9).value; }
  catch { partial = true; ctx.unknown('BlessingMaxLV: Minehead("BonusQTY",9,0) coeff not verified -> floored 0 (cap is a lower bound)'); }
  const value = Math.round(BLESSING_MAX_LV_BASE + coral + minehead + vault);
  return { value, status: partial ? "partial" : "computed",
    note: `100 + CoralKid(1)=${coral.toFixed(0)} + Minehead(9)=${minehead}${partial ? "(unread)" : ""} + Vault(76)=${vault.toFixed(0)}` };
}

/** BlessBonus(g) — the MAJOR blessing PERCENT for god g, N.js:17809-17811.
 *  g != 2: Divinity[28+g] * blessingMulti[g] * (1 + 0.05*EmporiumBonus(33)*max(0, godRank-10))
 *  g == 2 (Nobisect): a bespoke [0.1x,1.8x] curve driven by AllEfficiencies/alchemy/stats — NOT
 *    the generic shape; returned as unknown (would need those account-wide stats). */
export function blessingMajorValue(ctx, g) {
  const row = GODS_INFO_FULL[g];
  if (!row) return { value: 0, status: "computed", note: `god ${g} not in table` };
  const level = sel.blessingLevel(ctx.s, g);
  if (g === 2) {
    ctx.unknown("Nobisect (god 2) major blessing uses a bespoke AllEfficiencies/alchemy curve, not the generic level*multi*emporium form — not modeled");
    return { value: 0, status: "unknown", note: `Nobisect capped curve unmodeled (level ${level})` };
  }
  const godRank = sel.godRank(ctx.s);
  const emp = jadeEmporiumOwned(ctx, 33);   // 0/1/null (>=53 unrecoverable — here id 33, resolvable)
  let scaler = 1, status = "computed";
  if (emp === null) { status = "partial"; ctx.unknown("Blessing emporium scaler EmporiumBonus(33) unrecoverable -> x1 (lower bound)"); }
  else scaler = 1 + 0.05 * emp * Math.max(0, godRank - 10);
  const value = level * row.blessingMulti * scaler;
  return { value, status,
    note: `level ${level} x mult ${row.blessingMulti} x emporium scaler ${scaler.toFixed(2)} (godRank ${godRank})` };
}

/** Cost to buy the NEXT major-blessing level for god g, in that god's currency, N.js:17099/17137:
 *   GodsInfo[g][4] * GodsInfo[g][5]^Divinity[28+g]. */
export function blessingCostToNext(ctx, g) {
  const row = GODS_INFO_FULL[g];
  if (!row) return { value: 0, currency: "unknown", note: `god ${g} not in table` };
  const level = sel.blessingLevel(ctx.s, g);
  const cost = row.blessCostBase * Math.pow(row.blessCostGrowth, level);
  return { value: cost, currency: BLESSING_CURRENCY_BY_GOD[g], level,
    note: `${row.blessCostBase} * ${row.blessCostGrowth}^${level}` };
}

/** Currency balance on hand for a blessing currency name. */
export function blessingCurrencyOnHand(ctx, currency) {
  switch (currency) {
    case "bits": return Number(sel.gaming(ctx.s)[0] ?? 0);
    case "sailingGold": return Number((sel.treasures(ctx.s) ?? [])[0] ?? 0);
    case "coins": return Number(ctx.s.get("Money") ?? 0);
    case "particles": return sel.divinityParticles(ctx.s);
    default: return null;
  }
}
