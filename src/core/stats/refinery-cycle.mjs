/* stats/refinery-cycle.mjs — recipe `refineryCycle`, "Refinery Cycle Speed".
 *
 * THE EXPRESSION, verbatim from p._customBlock_Refinery("CycleInitialTime", bay), N.js:12192-12196
 * (transcribed in gamedata-w3-refinery.mjs header). A refinery bay's cycle TIME is
 *   ceil( baseTime(bay) / SPEED ),  SPEED = the multiplier this recipe computes:
 *
 *   SPEED = (1 + pool/100)                       // additive speed %, 10 sources below
 *         * Math.max(1, MainframeBonus(2))        // Lab chip "Gilded_Cyclical_Tubing" -> x3 connected
 *         * (1 + Thingies("LegendPTS_bonus",19,0)/100)     // Legend Talent "More_Soot_More_Salt"
 *         * (1 + DNSM.RefineSpdPCTdn/100)         // POLYMERIZE-bay ONLY: meal PolyRefSpd + Grid_Bonus(48)
 *   pool = AlchVials.RefSpd + SaltLick(2) + FamBonusQTYs["24"] + Labb("SigilBonus",10)
 *        + StampBonusOfTypeX("RefinerySpd") + Breeding("ShinyBonusS",15) + ConstMasteryBonus(0)
 *        + ArcadeBonus(25) + Summoning("VotingBonusz",33) + ResearchStuff("Grid_Bonus",49)
 *
 * The default combine ((1+pool/100)*mul) reproduces SPEED exactly. The two Polymerize-only terms
 * apply only to the slowest bay (100h base); they carry their real value but are noted bay-specific
 * — both are currently unread (Grid_Bonus 48 uses a decay curve, PolyRefSpd meal row unverified),
 * so they contribute their neutral 1 and flag a lower bound. This recipe's VALUE is thus the
 * Polymerize-bay speed multiplier (= Combustion/Synthesis when the two poly terms are neutral). */

import { sel } from "../savemap.mjs";
import { T } from "./engine.mjs";
import { saltLick, constMasteryBonus } from "../bonuses/refinery.mjs";
import { famBonus } from "../bonuses/family.mjs";
import { sigilBonus, vialBonusByKey } from "../bonuses/alchemy.mjs";
import { stampBonusOfType } from "../bonuses/stamps.mjs";
import { shinyBonus } from "../bonuses/breeding.mjs";
import { arcadeBonus } from "../bonuses/arcade.mjs";
import { votingBonus } from "../bonuses/summoning.mjs";
import { gridBonus } from "../bonuses/research.mjs";
import { mainframeBonus } from "../bonuses/lab.mjs";
import { legendPts } from "../bonuses/thingies.mjs";
import { mealBonus } from "../bonuses/meals.mjs";

const num = (x) => Number(x) || 0;

/** Attempt an additive-% evaluator; on throw/null contribute 0 and flag unknown. */
function addTerm(ctx, id, key, label, fn) {
  try {
    const f = fn();
    if (f == null) throw new Error("null");
    return T(id, key, "add", num(f.value), f.status ?? "computed", `${label}: ${f.note ?? ""}`, f.parts);
  } catch (e) {
    ctx.unknown(`${key} — ${String(e.message || e).slice(0, 40)}; no evaluator, 0 (lower bound)`);
    return T(id, key, "add", 0, "unknown", `${label}: unread -> 0 (lower bound)`);
  }
}

export const DISPLAY = {
  vials: { label: "Vial: Refinery Speed", where: "Alchemy → Vials", how: "AlchVials.RefSpd." },
  saltLick: { label: "Salt Lick: Refinery Speed", where: "W3 Salt Lick (row 2)", how: "SaltLick(2) — +2%/level." },
  family: { label: "Family bonus (Barbarian)", where: "Family / class", how: 'FamBonusQTYs["24"].' },
  sigil: { label: "Sigil: Refinery Speed", where: "Alchemy → Sigils", how: "Labb(SigilBonus,10)." },
  stamp: { label: "Stamp: Refinery Speed", where: "Stamps", how: 'StampBonusOfTypeX("RefinerySpd").' },
  shiny: { label: "Shiny pet: Refinery Speed", where: "W4 Breeding → shiny pets", how: "Breeding(ShinyBonusS,15)." },
  constMastery: { label: "Construction Mastery (Rift 40)", where: "Rift 40+", how: "runtime — 0 below the gate." },
  arcade: { label: "Arcade: Refinery Speed", where: "Gold Ball Shop", how: "ArcadeBonus(25)." },
  vote: { label: "Bonus Ballot (vote 33)", where: "W2 Ballot", how: "Summoning(VotingBonusz,33) — active vote only." },
  grid49: { label: "Research grid (49)", where: "W7 Research grid", how: "Grid_Bonus(49) — decay curve, unread." },
  mainframe2: { label: "Lab: Gilded Cyclical Tubing", where: "W4 Lab → Mainframe", how: "MainframeBonus(2) -> x3 connected." },
  legend19: { label: "Legend Talent: More Soot More Salt", where: "W7 Spelunking → Legend Talents", how: "+75%/level." },
  polyMeal: { label: "Meal: Polymerize speed", where: "W4 Dinner Table", how: "PolyRefSpd — POLYMERIZE bay only, unread." },
  polyGrid48: { label: "Research grid (48): Polymerize", where: "W7 Research grid", how: "Grid_Bonus(48) — POLYMERIZE bay only, decay, unread." },
};

export const refineryCycle = {
  name: "refineryCycle",
  label: "Refinery Cycle Speed",
  display: DISPLAY,
  terms(ctx) {
    const add = [
      addTerm(ctx, "vials", "AlchVials.RefSpd", DISPLAY.vials.label, () => vialBonusByKey(ctx, "RefSpd")),
      addTerm(ctx, "saltLick", "SaltLick(2)", DISPLAY.saltLick.label, () => saltLick(ctx, 2)),
      addTerm(ctx, "family", 'FamBonusQTYs["24"]', DISPLAY.family.label, () => famBonus(ctx, "24")),
      addTerm(ctx, "sigil", 'Labb("SigilBonus",10,0)', DISPLAY.sigil.label, () => sigilBonus(ctx, 10)),
      addTerm(ctx, "stamp", 'StampBonusOfTypeX("RefinerySpd")', DISPLAY.stamp.label, () => stampBonusOfType(ctx, "RefinerySpd")),
      addTerm(ctx, "shiny", 'Breeding("ShinyBonusS",15,-1)', DISPLAY.shiny.label, () => shinyBonus(ctx, 15)),
      addTerm(ctx, "constMastery", 'WorkbenchStuff("ConstMasteryBonus",0,0)', DISPLAY.constMastery.label, () => constMasteryBonus(ctx, 0)),
      addTerm(ctx, "arcade", "ArcadeBonus(25)", DISPLAY.arcade.label, () => arcadeBonus(ctx, 25)),
      addTerm(ctx, "vote", 'Summoning("VotingBonusz",33,0)', DISPLAY.vote.label, () => votingBonus(ctx, 33)),
      addTerm(ctx, "grid49", 'ResearchStuff("Grid_Bonus",49,0)', DISPLAY.grid49.label, () => gridBonus(ctx, 49)),
    ];

    // mul: MainframeBonus(2) -> factor is max(1, value)
    let mf2 = 1, mf2Status = "computed", mf2Note = "MainframeBonus(2)";
    try { const f = mainframeBonus(ctx, 2); if (f.value == null) { mf2Status = "unknown"; mf2Note = f.note; } else { mf2 = Math.max(1, num(f.value)); mf2Note = f.note; } }
    catch (e) { mf2Status = "unknown"; mf2Note = String(e.message || e); ctx.unknown("MainframeBonus(2) unread"); }
    const mainframe2 = T("mainframe2", "Math.max(1,MainframeBonus(2))", "mul", mf2, mf2Status, `${DISPLAY.mainframe2.label}: ${mf2Note}`);

    let legend = 0, legendStatus = "computed";
    try { legend = legendPts(ctx, 19); } catch { legendStatus = "unknown"; ctx.unknown("LegendPTS_bonus(19) unread"); }
    const legend19 = T("legend19", "1+Thingies(LegendPTS_bonus,19)/100", "mul", 1 + legend / 100, legendStatus, `${DISPLAY.legend19.label}: +${legend}%`);

    // Polymerize-bay-only terms (bay 2). Both unread -> neutral 1, lower bound.
    let polyMealV = 0;
    const polyMeal = (() => { try { const f = mealBonus(ctx, "PolyRefSpd"); polyMealV = num(f.value); return T("polyMeal", 'MealBonus("PolyRefSpd")', "mul", 1 + polyMealV / 100, f.status ?? "computed", `${DISPLAY.polyMeal.label}: +${polyMealV}% (Polymerize bay only)`); }
      catch { ctx.unknown('MealBonus("PolyRefSpd") unread -> Polymerize speed lower bound'); return T("polyMeal", 'MealBonus("PolyRefSpd")', "mul", 1, "unknown", `${DISPLAY.polyMeal.label}: unread (Polymerize bay only) -> x1`); } })();
    let polyGridV = 0;
    const polyGrid48 = (() => { try { const f = gridBonus(ctx, 48); polyGridV = num(f.value); return T("polyGrid48", 'ResearchStuff("Grid_Bonus",48,0)', "mul", 1 + polyGridV / 100, f.status ?? "computed", `${DISPLAY.polyGrid48.label}: +${polyGridV}% (Polymerize bay only)`); }
      catch { ctx.unknown('Grid_Bonus(48) unread (decay curve) -> Polymerize speed lower bound'); return T("polyGrid48", 'ResearchStuff("Grid_Bonus",48,0)', "mul", 1, "unknown", `${DISPLAY.polyGrid48.label}: unread (Polymerize bay only) -> x1`); } })();

    return [...add, mainframe2, legend19, polyMeal, polyGrid48];
  },
};
