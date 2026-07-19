/* bonuses/clamwork.mjs — Thingies("ClamWorkBonus",b,0), the W7 Clam Work (Mr. Musselini) job
 * gate. Fully resolved: it is NOT a percent — it is a THRESHOLD GATE returning 1 iff the account's
 * Clam Work JOB LEVEL (OptLacc[464]) is STRICTLY GREATER than b, else 0 (gamedata-w7-clamwork.mjs,
 * N.js byte 10709318: `"ClamWorkBonus"==d) return OptLacc[464] > b ? 1 : 0`).
 *
 * Callers multiply the 0/1 gate by their own fixed weight (e.g. meritocracy's `5*ClamWorkBonus(3)`,
 * class-EXP's `5*(OptLacc[464]-8)` reads the job level directly). This un-stubs the
 * `clamWorkBonus: 0` floor in bonuses/summoning.mjs::meritocBonusz and the gap noted in
 * bonuses/ballot.mjs. No unread inputs. */

import { sel } from "../savemap.mjs";
import { clamWorkBonusGate } from "../gamedata-w7-clamwork.mjs";

/** ClamWorkBonus(b) = OptLacc[464] > b ? 1 : 0 as a fragment (0/1, always computed). */
export function clamWorkBonus(ctx, b) {
  const jobLevel = sel.clamJobLevel(ctx.s);
  const value = clamWorkBonusGate(jobLevel, b);
  return { value, status: "computed", note: `Clam Work job level ${jobLevel} ${value ? ">" : "<="} ${b} -> ${value}` };
}

/** Raw 0/1 numeric ClamWorkBonus(b). */
export const clamWorkBonusNum = (ctx, b) => clamWorkBonusGate(sel.clamJobLevel(ctx.s), b);
