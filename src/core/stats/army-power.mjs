/* stats/army-power.mjs — recipes `armyHealth` and `armyDamage`, the total-army HP/DMG multipliers
 * applied to every summoned unit in a Summoning competition, Summoning("UnitHP",-1,0) /
 * ("UnitDMG",-1,0). Verbatim formulas + the idleon-toolbox divergences in gamedata-w6-summoning.mjs
 * (section 5).
 *
 * Both are pure products of (1 + SummUpgBonus(id)/100)-style brackets; SummUpgBonus feeds them via
 * bonuses/summoning.mjs::armyHpMultiplier / armyDmgMultiplier. Each bracket is one "mul" term so
 * the per-factor time series is preserved (metric keys stat.armyHealth.<id> etc — STABLE).
 *
 * HONESTY: armyHealth is fully save-derivable (no unknowns). armyDamage has two LIVE-BATTLE-only
 * terms (SummUpgBonus(76)×GenINFO[185] spike counter, SummUpgBonus(47)×(GenINFO[124]-[123]) line-
 * cross counter) that reset each match and are NOT in the save -> taken as neutral (×1), so
 * armyDamage is a LOWER BOUND (flagged). Divergences vs idleon-toolbox (missing +2 HP constant,
 * dropped ids 81/74/76, etc.) are documented in the gamedata header — this repo follows N.js. */

import { T } from "./engine.mjs";
import { sel } from "../savemap.mjs";
import { summUpgBonus } from "../bonuses/summoning.mjs";

const num = (x) => Number(x) || 0;
const sub = (ctx, b) => num(summUpgBonus(ctx, b).value);

export const HEALTH_DISPLAY = {
  base: { label: "Base + flat HP upgrades", where: "W6 Summoning upgrades", how: "2 + (1 + SummUpgBonus(1)+(10)+(35)+(37)) — Unit Health/Wellness/Ache Pea/Hitpoints." },
  pctA: { label: "Constitution + Glombolic", where: "W6 Summoning upgrades", how: "×(1 + (SummUpgBonus(20)+(81))/100)." },
  pctB: { label: "Blood + Undying + Infinite Health", where: "W6 Summoning upgrades", how: "×(1 + (SummUpgBonus(50)+(59)+(63)×endlessWins)/100)." },
  laundering: { label: "HP Laundering (per 100 upg)", where: "W6 Summoning upgrades", how: "×(1 + SummUpgBonus(61)×floor(totalUpgLv/100)/100)." },
};

export const armyHealth = {
  name: "armyHealth",
  label: "Summoning Army HP Multiplier",
  display: HEALTH_DISPLAY,
  combine: ({ mul }) => mul,
  terms(ctx) {
    const endless = sel.endlessSummonWins(ctx.s);
    const totalUpg = sel.summonTotalUpgLevels(ctx.s);
    const additive = sub(ctx, 1) + sub(ctx, 10) + sub(ctx, 35) + sub(ctx, 37);
    const base = 2 + (1 + additive);
    const pctA = 1 + (sub(ctx, 20) + sub(ctx, 81)) / 100;
    const pctB = 1 + (sub(ctx, 50) + (sub(ctx, 59) + sub(ctx, 63) * endless)) / 100;
    const laundering = 1 + sub(ctx, 61) * Math.max(0, Math.floor(totalUpg / 100)) / 100;
    return [
      T("base", "2+(1+SummUpgBonus(1)+(10)+(35)+(37))", "mul", base, "computed", `2 + (1 + additive ${additive.toFixed(1)}) = ${base.toFixed(2)}`),
      T("pctA", "1+(SummUpgBonus(20)+(81))/100", "mul", pctA, "computed", `×${pctA.toFixed(3)}`),
      T("pctB", "1+(SummUpgBonus(50)+(59)+(63)*endless)/100", "mul", pctB, "computed", `×${pctB.toFixed(3)} (endless ${endless})`),
      T("laundering", "1+SummUpgBonus(61)*floor(totalUpg/100)/100", "mul", laundering, "computed", `×${laundering.toFixed(3)} (totalUpg ${totalUpg})`),
    ];
  },
};

export const DAMAGE_DISPLAY = {
  base: { label: "Base + flat DMG upgrades", where: "W6 Summoning upgrades", how: "1 + (SummUpgBonus(3)+(12)+(21)+(31)) — Unit/Powerful/Stronger/Beefier Units." },
  pctA: { label: "Brutal + Obliteration", where: "W6 Summoning upgrades", how: "×(1 + (SummUpgBonus(43)+(74))/100)." },
  pctB: { label: "Merciless + Destruction + Infinite DMG", where: "W6 Summoning upgrades", how: "×(1 + (SummUpgBonus(51)+(56)+(64)×endlessWins)/100)." },
  spike76: { label: "Serrated Spikes (live battle)", where: "W6 Summoning upgrades", how: "SummUpgBonus(76)×GenINFO[185] — per-match spike counter, not in the save (×1, lower bound)." },
  cross47: { label: "Seeing Red (live battle)", where: "W6 Summoning upgrades", how: "SummUpgBonus(47)×line-crosses — per-match counter, not in the save (×1, lower bound)." },
  laundering: { label: "DMG Laundering (per 100 upg)", where: "W6 Summoning upgrades", how: "×(1 + SummUpgBonus(60)×floor(totalUpgLv/100)/100)." },
};

export const armyDamage = {
  name: "armyDamage",
  label: "Summoning Army DMG Multiplier",
  display: DAMAGE_DISPLAY,
  combine: ({ mul }) => mul,
  terms(ctx) {
    const endless = sel.endlessSummonWins(ctx.s);
    const totalUpg = sel.summonTotalUpgLevels(ctx.s);
    const additive = sub(ctx, 3) + sub(ctx, 12) + sub(ctx, 21) + sub(ctx, 31);
    const base = 1 + additive;
    const pctA = 1 + (sub(ctx, 43) + sub(ctx, 74)) / 100;
    const pctB = 1 + (sub(ctx, 51) + (sub(ctx, 56) + sub(ctx, 64) * endless)) / 100;
    const laundering = 1 + sub(ctx, 60) * Math.max(0, Math.floor(totalUpg / 100)) / 100;
    ctx.unknown('armyDamage — SummUpgBonus(76)×GenINFO[185] and SummUpgBonus(47)×line-crosses are live-battle-only (reset each match); taken ×1 -> lower bound');
    return [
      T("base", "1+(SummUpgBonus(3)+(12)+(21)+(31))", "mul", base, "computed", `1 + additive ${additive.toFixed(1)} = ${base.toFixed(2)}`),
      T("pctA", "1+(SummUpgBonus(43)+(74))/100", "mul", pctA, "computed", `×${pctA.toFixed(3)}`),
      T("pctB", "1+(SummUpgBonus(51)+(56)+(64)*endless)/100", "mul", pctB, "computed", `×${pctB.toFixed(3)} (endless ${endless})`),
      T("spike76", "1+SummUpgBonus(76)*GenINFO[185]/100", "mul", 1, "unknown", "live-battle spike counter not in save -> ×1 (lower bound)"),
      T("cross47", "1+SummUpgBonus(47)*(GenINFO[124]-[123])/100", "mul", 1, "unknown", "live-battle line-cross counter not in save -> ×1 (lower bound)"),
      T("laundering", "1+SummUpgBonus(60)*floor(totalUpg/100)/100", "mul", laundering, "computed", `×${laundering.toFixed(3)} (totalUpg ${totalUpg})`),
    ];
  },
};
