/* bonuses/prayers.mjs — prayersReal(d,b): the W3 Worship prayer dispatcher.
 *
 * Client (_customBlock_prayersReal, N.js:12281), verbatim:
 *   PrayNonEq: scan PrayersActive from slot 0; on the first -1, set PrayNonEq=1 iff that -1 is the
 *              LAST slot (all earlier slots filled), else it stays 0.
 *   cond = (SuperBitType(9)!=1 && SuperBitType(39)!=1) || PrayNonEq!=1
 *   value = cond
 *     ? ( PrayersActive.indexOf(d) != -1                              // equipped
 *         ? round(PrayerInfo[d][3+b] * max(1, 1+(PrayersUnlocked[d]-1)/10)) : 0 )
 *     : ( d!=5 && b!=1 && 0.5 < PrayersUnlocked[d]                     // superbit passive
 *         ? round(PrayerInfo[d][3+b] * max(1, 1+(PrayersUnlocked[d]-1)/10)) : 0 )
 * b picks the arm: b=0 -> the prayer BONUS (PrayerInfo[d][3]); b=1 -> the CURSE (PrayerInfo[d][4]).
 * PrayersActive is per-character (save Prayers_N); PrayersUnlocked (PrayOwned) is account-wide.
 * So the value is PER ACTIVE CHARACTER — returns null when ctx.activeChar is null.
 *
 * PrayerInfo (na.PrayerInfo(), N.js:24070): each row is a space-split string; the columns read are
 * [3]=bonus magnitude, [4]=curse magnitude. Index = the prayersReal(d,...) argument. Row 7
 * "Midas_Minded" is +{%_Drop_Rate — prayersReal(7,0) in the drop-rate recipe. */

import { sel } from "../savemap.mjs";
import { superBitType } from "./gaming.mjs";

/** CustomLists.PrayerInfo[d] -> {name, bonus:[3], curse:[4]}, verbatim from na.PrayerInfo(). */
export const PRAYER_INFO = [
  { name: "Big_Brain_Time",       bonus: 30,  curse: 250 }, // 0
  { name: "Skilled_Dimwit",       bonus: 30,  curse: 20  }, // 1
  { name: "Unending_Energy",      bonus: 25,  curse: 10  }, // 2
  { name: "Shiny_Snitch",         bonus: 20,  curse: 15  }, // 3
  { name: "Zerg_Rushogen",        bonus: 5,   curse: 12  }, // 4
  { name: "Tachion_of_the_Titans", bonus: 10, curse: 10  }, // 5
  { name: "Balance_of_Precision", bonus: 30,  curse: 5   }, // 6
  { name: "Midas_Minded",         bonus: 20,  curse: 250 }, // 7  +{%_Drop_Rate
  { name: "Jawbreaker",           bonus: 40,  curse: 200 }, // 8
  { name: "The_Royal_Sampler",    bonus: 15,  curse: 30  }, // 9
  { name: "Antifun_Spirit",       bonus: 700, curse: 9   }, // 10
  { name: "Circular_Criticals",   bonus: 10,  curse: 15  }, // 11
  { name: "Ruck_Sack",            bonus: 30,  curse: 15  }, // 12
  { name: "Fibers_of_Absence",    bonus: 30,  curse: 15  }, // 13
  { name: "Vacuous_Tissue",       bonus: 10,  curse: 10  }, // 14
  { name: "Beefy_For_Real",       bonus: 20,  curse: 10  }, // 15
  { name: "Balance_of_Pain",      bonus: 8,   curse: 15  }, // 16
  { name: "Balance_of_Proficiency", bonus: 30, curse: 20 }, // 17  +{%_Skill_EXP / -{%_Skill_Efficiency
];

/** PrayNonEq: 1 iff the only empty prayer slot is the last one (the superbit passive gate). */
function prayNonEq(active) {
  for (let i = 0; i < active.length; i++) {
    if (Number(active[i]) === -1) return i === active.length - 1 ? 1 : 0;
  }
  return 0;
}

/**
 * prayersReal(d, b) for the ctx's active character. b=0 -> bonus arm, b=1 -> curse arm.
 * Returns { value, status, note } — or null when ctx.activeChar is null (per-character data).
 */
export function prayerBonus(ctx, d, b = 0) {
  const row = PRAYER_INFO[d];
  if (!row) throw new Error(`prayersReal(${d},${b}): CustomLists.PrayerInfo[${d}] not verified in N.js — add to PRAYER_INFO first`);
  if (ctx.activeChar == null) return null;
  const mag = b === 1 ? row.curse : row.bonus;
  const level = Number(sel.prayersUnlocked(ctx.s)[d] ?? 0);
  const mult = Math.max(1, 1 + (level - 1) / 10);
  const payout = Math.round(mag * mult);

  const active = sel.prayersActiveOf(ctx.s, ctx.activeChar).map(Number);
  const equipped = active.includes(d);
  const sb9 = superBitType(ctx, 9), sb39 = superBitType(ctx, 39);
  const cond = (sb9 !== 1 && sb39 !== 1) || prayNonEq(active) !== 1;

  if (cond) {
    return equipped
      ? { value: payout, status: "computed", note: `${row.name}: equipped on char ${ctx.activeChar}, level ${level} -> ${payout}` }
      : { value: 0, status: "computed", note: `${row.name}: not equipped on char ${ctx.activeChar}` };
  }
  // superbit passive: even unequipped prayers pay (except curse arm and prayer 5)
  if (d !== 5 && b !== 1 && level > 0.5) {
    return { value: payout, status: "computed", note: `${row.name}: superbit passive (last slot empty), level ${level} -> ${payout}` };
  }
  return { value: 0, status: "computed", note: `${row.name}: superbit passive not applicable` };
}
