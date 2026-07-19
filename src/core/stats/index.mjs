/* stats/index.mjs — the stat-recipe registry.
 *
 * Add a recipe here and it is automatically: evaluated into e.stats by domain.extractEntities,
 * flattened into `stat.<name>[.<termId>]` metric rows for the time-series DB (POST /api/rebuild
 * backfills every stored snapshot), and available to any UI page. See stats/engine.mjs for the
 * recipe contract and bonuses/ for the shared per-dispatcher evaluators. */

import { evaluatePerChar, metricRows } from "./engine.mjs";
import { artifactFind } from "./artifact-find.mjs";
import { dropRate } from "./drop-rate.mjs";
import { tomeScoreRecipe } from "./tome.mjs";
import { cropEvo } from "./crop-evo.mjs";
import { cashMulti } from "./cash-multi.mjs";
import { afkGain } from "./afk-gain.mjs";
import { classXp } from "./class-xp.mjs";
import { skillXp } from "./skill-xp.mjs";
import { miningEff } from "./mining-eff.mjs";
import { choppinEff } from "./choppin-eff.mjs";
import { statueMulti } from "./statue-multi.mjs";
import { anvilSpeed } from "./anvil-speed.mjs";
import { owlRate } from "./owl-rate.mjs";
import { liquidCap } from "./liquid-cap.mjs";
import { krukBubbles } from "./kruk-bubbles.mjs";
import { fishRate, shinyRate } from "./fishing-rate.mjs";
import { refineryCycle } from "./refinery-cycle.mjs";
import { printerOutput } from "./printer-output.mjs";
import { libraryRate } from "./library-rate.mjs";
import { atomCost } from "./atom-cost.mjs";
import { shrineExp } from "./shrine-exp.mjs";
import { worshipCharge } from "./worship-charge.mjs";
import { mealBonuses } from "./meal-bonus.mjs";
import { breedingChance } from "./breeding-chance.mjs";
import { kitchenSpeed } from "./kitchen-speed.mjs";
import { gamingBits } from "./gaming-bits.mjs";
import { villagerExp } from "./villager-exp.mjs";
import { paletteLuck } from "./palette-luck.mjs";
import { winBonus } from "./win-bonus.mjs";
import { armyHealth, armyDamage } from "./army-power.mjs";
import { stealth } from "./stealth.mjs";
import { emperorBonus } from "./emperor-bonus.mjs";
import { legendTalents } from "./legend-talents.mjs";
import { sushiRoG } from "./sushi-rog.mjs";

export { evaluate, evaluatePerChar, metricRows } from "./engine.mjs";
export const RECIPES = [artifactFind, dropRate, tomeScoreRecipe, cropEvo, cashMulti, afkGain, classXp, skillXp, miningEff, choppinEff, statueMulti, anvilSpeed, owlRate, liquidCap, krukBubbles, fishRate, shinyRate, refineryCycle, printerOutput, libraryRate, atomCost, shrineExp, worshipCharge, mealBonuses, breedingChance, kitchenSpeed, gamingBits, villagerExp, paletteLuck, winBonus, armyHealth, armyDamage, stealth, emperorBonus, legendTalents, sushiRoG];

/**
 * Evaluate every registered recipe. optsByName: per-recipe opts keyed by recipe name
 * ("*" = defaults for all). Each entry: { label, sensitive, byChar, collapsed } — see
 * evaluatePerChar. `collapsed` is the honest account-level result.
 */
export function evaluateAll(s, optsByName = {}) {
  const out = {};
  for (const r of RECIPES)
    out[r.name] = { label: r.label, ...evaluatePerChar(r, s, optsByName[r.name] ?? optsByName["*"] ?? {}) };
  return out;
}

/** Metric rows for everything evaluateAll produced (collapsed results only — per-char
 *  variants are recomputable from the stored raw snapshot when a page drills in). */
export function allMetricRows(stats) {
  const rows = {};
  for (const [name, st] of Object.entries(stats)) Object.assign(rows, metricRows(name, st.collapsed));
  return rows;
}
