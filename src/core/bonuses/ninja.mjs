/* bonuses/ninja.mjs — Ninja(...): sneaking charms, upgrades, gemstones and the Jade Emporium. */

import { sel } from "../savemap.mjs";
import { letterFlag } from "./util.mjs";
import {
  NINJA_UPGRADES, GEMSTONES, PRISTINE_CHARMS,
  ninjaUpgradeBonus as nlBonusRaw, gemstoneBonus as gemBonusRaw,
} from "../../gamedata/gamedata-w6-sneaking.mjs";

/** Ninja("PristineBon",b,0) = Ninja[107][b]===1 ? <charm value> : 0.
 *  Values from the NjEQ.NjTrP tables (CustomMaps NjEQ["NjTrP"+b][3]) — verified ids only:
 *    2 "Glowing Veil"  = 40   (}x_Artifact_Find_Chance)
 *    3 "Cotton Candy"  = 15   (}x_Drop_Rate)
 *    8 "Crystal Comb"  = 30   (feeds Summoning WinBonus) */
export const PRISTINE_PCT = {
  2: 40, 3: 15, 8: 30,
  /* Farming (NjTrP rows @N.js:24580-24581): 9 "Rock_Candy" +50% Farming EXP,
   * 11 "Taffy_Disc" 50 -> }x1.5 Overgrowth chance. */
  9: 50, 11: 50,
};
export function pristineBon(ctx, b) {
  if (!(b in PRISTINE_PCT)) throw new Error(`PristineBon(${b}): NjTrP table value not verified in N.js — add to PRISTINE_PCT first`);
  const owned = ((sel.ninja(ctx.s)[107] ?? [])[b] ?? 0) === 1;
  return { value: owned ? PRISTINE_PCT[b] : 0, note: owned ? `charm owned -> +${PRISTINE_PCT[b]}%` : `Ninja[107][${b}]=0, charm NOT owned` };
}

/** Ninja EmporiumBonus(b) = Ninja[102][9].indexOf(Number2Letter[b]) != -1.
 *  Returns null for ids >= 53 (Number2Letter unrecoverable) — unknown, not "not owned". */
export function jadeEmporiumOwned(ctx, b) {
  return letterFlag((sel.ninja(ctx.s)[102] ?? [])[9], b);
}

/** Ninja("PristineBon",b,0) over the FULL 23-charm table (gamedata-w6-sneaking.mjs). Supersedes
 *  the 5-id PRISTINE_PCT subset above; both return the same value on their shared ids. */
export function pristineBonAll(ctx, b) {
  const row = PRISTINE_CHARMS[b];
  if (!row) throw new Error(`pristineBonAll(${b}): no PRISTINE_CHARMS row (0..22)`);
  const owned = (sel.pristineCharmFlags(ctx.s)[b] ?? 0) === 1;
  return { value: owned ? row.x3 : 0, status: "computed",
    note: owned ? `${row.name} owned -> +${row.x3}` : `${row.name} not owned (Ninja[107][${b}]=0)` };
}

/** Ninja("NLbonuses",b,0) = Ninja[103][b] × NinjaUpg[b].modifier for the DEFAULT / mastery-loot
 *  branches (the only ones whose inputs are all save-derivable). The b==11 "Charm_Collector"
 *  branch pulls in gemstone/palette/vault/cloud sources and is only a FLOOR here (those extra
 *  addends default 0). Way_of_Stealth (13, +1/lv) and Shhhhhhhhhhh (23, ×5/lv) — the stealth
 *  inputs — are plain default-branch upgrades. */
export function nlBonus(ctx, b) {
  const row = NINJA_UPGRADES[b];
  if (!row) throw new Error(`NLbonuses(${b}): no NINJA_UPGRADES row (0..28)`);
  const level = sel.ninjaUpgLevel(ctx.s, b);
  const masteryLootLevel = sel.ninjaUpgLevel(ctx.s, 3);            // Mastery_Loot's own level
  const selectedMasteryLevel = sel.ninjaMasterySelected(ctx.s);    // OptLacc[231]
  const value = nlBonusRaw(b, { level, modifier: row.modifier, masteryLootLevel, selectedMasteryLevel });
  const partial = b === 11;   // extra gemstone/palette/vault/cloud addends unread -> floor
  if (partial) ctx.unknown(`NLbonuses(11) Charm_Collector — gemstone/palette/vault/cloud addends unread -> floor`);
  return { value, status: partial ? "partial" : "computed",
    note: `NinjaUpg[${b}] "${row.name}" lv ${level} × mod ${row.modifier} -> ${value}` };
}

/** Ninja("GemstoneBonus",b,0) — gate OptLacc[233+b] > 0.5, then row.x3 + row.x5·(base/(1000+base)),
 *  ×(1+GemstoneBonus(5)/100) ×max(1, talent432) for non-self ids. Talent 432 (Wind Walker) is
 *  out of scope -> taken as 1 (lower bound for non-idx-5 rows). gamedata-w6-sneaking.mjs. */
export function gemstoneBonus(ctx, idx) {
  const row = GEMSTONES[idx];
  if (!row) throw new Error(`GemstoneBonus(${idx}): no GEMSTONES row (0..7)`);
  const base = sel.gemstoneBase(ctx.s, idx);
  if (!(base > 0.5)) return { value: 0, status: "computed", note: `${row.name}: OptLacc[${233 + idx}]=${base} <= 0.5 -> not collected` };
  const fifth = idx === 5 ? 0 : sel.gemstoneBase(ctx.s, 5) > 0.5
    ? gemBonusRaw(5, sel.gemstoneBase(ctx.s, 5)) : 0;
  const value = gemBonusRaw(idx, base, { fifthGemstoneBonus: fifth, talentBonus: 0 });
  const partial = idx !== 5;   // talent 432 unread
  if (partial) ctx.unknown(`GemstoneBonus(${idx}) — Wind Walker talent 432 unread (×max(1,·)); lower bound`);
  return { value, status: partial ? "partial" : "computed",
    note: `${row.name} base ${base} -> ${value.toFixed(2)}${partial ? " (talent 432 ×1 floor)" : ""}` };
}
