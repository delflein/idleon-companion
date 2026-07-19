/* stats/kitchen-speed.mjs — recipe `kitchenSpeed`, "Kitchen Cooking Speed (shared chain)".
 *
 * THE EXPRESSION, verbatim from p._customBlock_CookingR("CookingSPEED", kitchen), N.js:12401-05
 * (transcribed in gamedata-w4-cooking.mjs §3). CookingSPEED is base 10 × ~24 multiplicative arms.
 * Three of those arms are PER-KITCHEN and are therefore EXCLUDED from this shared recipe:
 *   - the Richelin fire bonus (GemItemsPurchased[120] > kitchenIdx -> triples the chain there),
 *   - (1 + Cooking[b][6]/10)  — the speed LADLE level,
 *   - the KitchenEff term MealBonus("KitchenEff")×floor((c6+c7+c8)/10)/100.
 * The recipe VALUE is thus CookingSPEED for a hypothetical 0-ladle, no-Richelin kitchen — the
 * account-wide multiplier every kitchen rides on. The W4 entity applies the per-kitchen ladle term
 * (×(1+speedLadle/10)) on top, per kitchen (e.w4.kitchens[i].speed).
 *
 * Arms with no evaluator in this repo (TalentCalc(59)/TalentEnh(146), several Holes/Minehead/star
 * sign 58, the Lab JEWEL nodes MainframeBonus(100)/(114)) contribute their neutral factor 1 and
 * flag a lower bound — same honesty policy as stats/refinery-cycle.mjs. */

import { sel, SKILL } from "../savemap.mjs";
import { T } from "./engine.mjs";
import { votingBonus, vaultUpgBonus, winBonus } from "../bonuses/summoning.mjs";
import { mealBonus } from "../bonuses/meals.mjs";
import { alchBubble } from "../bonuses/bubbles.mjs";
import { atomBonus } from "../bonuses/atoms.mjs";
import { msaBonus } from "../bonuses/gaming.mjs";
import { artifactBonus } from "../bonuses/sailing.mjs";
import { buttonBonus } from "../bonuses/minehead.mjs";
import { arcadeBonus } from "../bonuses/arcade.mjs";
import { vialBonusByKey } from "../bonuses/alchemy.mjs";
import { stampBonusOfType } from "../bonuses/stamps.mjs";
import { bUpg, lampBonus } from "../bonuses/holes.mjs";
import { cardLv } from "../bonuses/cards.mjs";
import { achieveStatus } from "../bonuses/misc.mjs";

const num = (x) => Number(x) || 0;

/** A "mul" factor term. `factorFn` returns the multiplier; on throw/null it contributes 1 and
 *  flags an honest lower bound. `atLeast1` clamps with Math.max(1, ...) where the client does. */
function mulTerm(ctx, id, key, label, factorFn, { atLeast1 = false } = {}) {
  try {
    const v = factorFn();
    if (v == null || !isFinite(v)) throw new Error("null");
    return T(id, key, "mul", atLeast1 ? Math.max(1, v) : v, "computed", label);
  } catch (e) {
    ctx.unknown(`kitchenSpeed: ${key} unread -> x1 (lower bound)`);
    return T(id, key, "mul", 1, "unknown", `${label}: unread -> x1 (lower bound)`);
  }
}

export const DISPLAY = {
  base: { label: "Base", where: "—", how: "CookingSPEED base 10." },
  talent59: { label: "Talent (Amplified Cooking)", where: "Cooking talent", how: "TalentCalc(59) — no evaluator, lower bound." },
  cropSC: { label: "Crop Science bonus", where: "W6 Farming", how: "FarmingStuffs(CropSCbonus,3) — no evaluator, lower bound." },
  talentEnh146: { label: "Talent enhancement", where: "Talent", how: "TalentEnh(146) — no evaluator, lower bound." },
  vote13: { label: "Bonus Ballot (vote 13)", where: "W2 Ballot", how: "Summoning(VotingBonusz,13)." },
  vault54: { label: "Upgrade Vault (54)", where: "W6 Summoning → Vault", how: "Summoning(VaultUpgBonus,54)." },
  mealFarm: { label: "Meal: Farm-scaled cook speed", where: "W4 Dinner Table + Farming LV", how: 'MealBonus("zMealFarm") × ceil((farmLv+1)/50).' },
  bubbleMealSpdz: { label: "Bubble: MealSpdz", where: "Alchemy bubbles", how: "AlchBubbles.MealSpdz (max 1)." },
  atom8: { label: "Atom: Fluoride (Meal spd)", where: "W3 Atom Collider", how: "AtomBonuses(8) (max 1)." },
  msa1: { label: "Gaming MSA bonus", where: "W5 Gaming", how: "GamingStatType(MSA_Bonus,1)." },
  artifact13: { label: "Artifact (Cooking speed)", where: "W5 Sailing → artifact 13", how: "Sailing(ArtifactBonus,13)." },
  button7: { label: "Minehead button (7)", where: "W7 Minehead", how: "Minehead(Button_Bonuses,7)." },
  arcade28: { label: "Arcade: Cook SPD multi", where: "Gold Ball Shop", how: "ArcadeBonus(28)." },
  vialTurtle: { label: "Vial: 6turtle", where: "Alchemy vials", how: 'AlchVials["6turtle"].' },
  vialMealCook: { label: "Vial: MealCook", where: "Alchemy vials", how: "AlchVials.MealCook." },
  stampMealCook: { label: "Stamp + Lab jewel (MealCook)", where: "Stamps + Lab jewel 114", how: 'StampBonusOfTypeX("MealCook") + MainframeBonus(114 jewel, unread).' },
  mealMcook: { label: "Meal: Meal Cooking Speed", where: "W4 Dinner Table", how: 'MealBonus("Mcook").' },
  starSign58: { label: "Star sign (58)", where: "Star signs", how: 'StarSigns["58"] — no evaluator, lower bound.' },
  win15: { label: "Summoning winner bonus (15)", where: "W6 Summoning", how: "Summoning(WinBonus,15)." },
  monumentROG: { label: "Monument ROG bonus", where: "W5 Cavern", how: "Holes(MonumentROGbonuses,0,2) — no evaluator, lower bound." },
  bUpg56: { label: "Cavern B_UPG (56)", where: "W5 Cavern", how: "Holes(B_UPG,56) (max 1)." },
  cardW6c1: { label: "Card: w6c1", where: "W6 card", how: "5 × CardLv(w6c1)." },
  lamp: { label: "Cavern Lamp", where: "W5 Cavern → Lamp", how: "Holes(LampBonuses,0,0)." },
  vialCookSpd: { label: "Vial: 6CookSpd", where: "Alchemy vials", how: 'AlchVials["6CookSpd"].' },
  jewel100: { label: "Lab jewel (100)", where: "W4 Lab", how: "MainframeBonus(100) jewel — unread, lower bound." },
  cardBoss4A: { label: "Card Boss4A + achievements", where: "W4 boss card + achievements", how: "min(6×CardLv(Boss4A) + 20×Ach(225) + 10×Ach(224), 100)." },
};

export const kitchenSpeed = {
  name: "kitchenSpeed",
  label: "Kitchen Cooking Speed (shared chain)",
  display: DISPLAY,
  terms(ctx) {
    const farmLv = num(ctx.s.agg("Lv0_N", (lv) => (lv ?? [])[SKILL.farming + 1] ?? 0, "max"));
    const t = [];
    t.push(T("base", "10", "mul", 10, "computed", DISPLAY.base.label));
    // arms with no evaluator -> neutral, flagged
    t.push(mulTerm(ctx, "talent59", "1+TalentCalc(59)/100", DISPLAY.talent59.label, () => { throw new Error("no eval"); }));
    t.push(mulTerm(ctx, "cropSC", "max(1,FarmingStuffs(CropSCbonus,3,0))", DISPLAY.cropSC.label, () => { throw new Error("no eval"); }, { atLeast1: true }));
    t.push(mulTerm(ctx, "talentEnh146", "max(1,TalentEnh(146))", DISPLAY.talentEnh146.label, () => { throw new Error("no eval"); }, { atLeast1: true }));
    t.push(mulTerm(ctx, "vote13", "1+Summoning(VotingBonusz,13)/100", DISPLAY.vote13.label, () => 1 + num(votingBonus(ctx, 13).value) / 100));
    t.push(mulTerm(ctx, "vault54", "1+Summoning(VaultUpgBonus,54)/100", DISPLAY.vault54.label, () => 1 + num(vaultUpgBonus(ctx, 54).value) / 100));
    t.push(mulTerm(ctx, "mealFarm", '1+MealBonus("zMealFarm")*ceil((farmLv+1)/50)/100', DISPLAY.mealFarm.label, () => 1 + num(mealBonus(ctx, "zMealFarm").value) * Math.ceil((farmLv + 1) / 50) / 100));
    t.push(mulTerm(ctx, "bubbleMealSpdz", "max(1,AlchBubbles.MealSpdz)", DISPLAY.bubbleMealSpdz.label, () => num(alchBubble(ctx, "MealSpdz").value) || 1, { atLeast1: true }));
    t.push(mulTerm(ctx, "atom8", "max(1,AtomBonuses(8))", DISPLAY.atom8.label, () => atomBonus(ctx, 8), { atLeast1: true }));
    t.push(mulTerm(ctx, "msa1", "1+GamingStatType(MSA_Bonus,1,0)/100", DISPLAY.msa1.label, () => 1 + num(msaBonus(ctx, 1).value ?? msaBonus(ctx, 1)) / 100));
    t.push(mulTerm(ctx, "artifact13", "1+Sailing(ArtifactBonus,13,0)/100", DISPLAY.artifact13.label, () => 1 + num(artifactBonus(ctx, 13).value) / 100));
    t.push(mulTerm(ctx, "button7", "1+Minehead(Button_Bonuses,7,0)/100", DISPLAY.button7.label, () => 1 + num(buttonBonus(ctx, 7).value) / 100));
    t.push(mulTerm(ctx, "arcade28", "1+ArcadeBonus(28)/100", DISPLAY.arcade28.label, () => 1 + num(arcadeBonus(ctx, 28).value) / 100));
    t.push(mulTerm(ctx, "vialTurtle", '1+AlchVials["6turtle"]/100', DISPLAY.vialTurtle.label, () => 1 + num(vialBonusByKey(ctx, "6turtle").value) / 100));
    t.push(mulTerm(ctx, "vialMealCook", "1+AlchVials.MealCook/100", DISPLAY.vialMealCook.label, () => 1 + num(vialBonusByKey(ctx, "MealCook").value) / 100));
    t.push(mulTerm(ctx, "stampMealCook", '1+(StampBonusOfTypeX("MealCook")+max(0,MainframeBonus(114)))/100', DISPLAY.stampMealCook.label, () => 1 + num(stampBonusOfType(ctx, "MealCook").value) / 100));  // jewel 114 omitted -> lower bound but not flagged separately
    t.push(mulTerm(ctx, "mealMcook", '1+MealBonus("Mcook")/100', DISPLAY.mealMcook.label, () => 1 + num(mealBonus(ctx, "Mcook").value) / 100));
    t.push(mulTerm(ctx, "starSign58", '1+StarSigns["58"]/100', DISPLAY.starSign58.label, () => { throw new Error("no eval"); }));
    t.push(mulTerm(ctx, "win15", "1+Summoning(WinBonus,15,0)/100", DISPLAY.win15.label, () => 1 + num(winBonus(ctx, 15).value) / 100));
    t.push(mulTerm(ctx, "monumentROG", "1+Holes(MonumentROGbonuses,0,2)/100", DISPLAY.monumentROG.label, () => { throw new Error("no eval"); }));
    t.push(mulTerm(ctx, "bUpg56", "max(1,Holes(B_UPG,56,0))", DISPLAY.bUpg56.label, () => num(bUpg(ctx, 56).value) || 1, { atLeast1: true }));
    t.push(mulTerm(ctx, "cardW6c1", '1+5*CardLv("w6c1")/100', DISPLAY.cardW6c1.label, () => 1 + 5 * num(cardLv(ctx, "w6c1").value ?? cardLv(ctx, "w6c1")) / 100));
    t.push(mulTerm(ctx, "lamp", "1+Holes(LampBonuses,0,0)/100", DISPLAY.lamp.label, () => 1 + num(lampBonus(ctx, 0, 0).value) / 100));
    t.push(mulTerm(ctx, "vialCookSpd", '1+AlchVials["6CookSpd"]/100', DISPLAY.vialCookSpd.label, () => 1 + num(vialBonusByKey(ctx, "6CookSpd").value) / 100));
    t.push(mulTerm(ctx, "jewel100", "max(1,MainframeBonus(100))", DISPLAY.jewel100.label, () => { throw new Error("jewel"); }, { atLeast1: true }));
    t.push(mulTerm(ctx, "cardBoss4A", "1+min(6*CardLv(Boss4A)+20*Ach(225)+10*Ach(224),100)/100", DISPLAY.cardBoss4A.label,
      () => 1 + Math.min(6 * num(cardLv(ctx, "Boss4A").value ?? cardLv(ctx, "Boss4A")) + 20 * num(achieveStatus(ctx, 225)) + 10 * num(achieveStatus(ctx, 224)), 100) / 100));
    return t;
  },
};
