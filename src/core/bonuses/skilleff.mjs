/* bonuses/skilleff.mjs — the client's two SHARED skill-efficiency chains, mirroring the client's
 * own SkillStats("AllEfficiencies") and SkillStats("AllBaseSkillEff") dispatcher boundaries
 * (NOT IdleonToolbox's getAllEff/getAllBaseSkillEff, which fold the base into the mining formula).
 * Every gathering/skilling efficiency (Mining, Choppin, Fishing, Catching, Trapping, Worship)
 * layers its own skill-specific arm on top of these two, so both evaluators take ONLY ctx — they
 * are skill-independent and reused verbatim by every later skill-efficiency recipe.
 *
 * ── AllEfficiencies (x._customBlock_SkillStats("AllEfficiencies"), N.js:5622, stitched) ──
 *   (1 + ( FamBonusQTYs["42"]                                       // family EFFICIENCY_FOR_ALL_SKILLS
 *        + ( EtcBonuses("48")                                       // worn gear/obol etc-stat 48
 *          + AlchVials["6SkillEff"]                                 // DABAR_SPECIAL vial
 *          + ( Sailing("ArtifactBonus",15,0)                        // Frost Relic
 *            + min(.1*ArbitraryCode("TotalQuestsComplete"), GetTalentNumber(1,617)) ) ) )/100)  // Studious Quester
 * * (1 + ( MealBonus("Seff") + GetTalentNumber(1,646)
 *        + ( Summoning("TomeBonus",1,0) + GamingStatType("PaletteBonus",10,0) )
 *        + ( chipBonuses("toteff") + ( 3*CardLv("Crystal4") + Thingies("FriendBonusStatz",2,0) ) )
 *        + ( RiftStuff("RiftSkillETC",2) + ( Holes("B_UPG",49,15) + OptionsListAccount[422] )
 *          + OptionsListAccount[180]*Dreamstuff("AllShimmerBonuses",0) ) )/100)
 * * (1 + ( CardBonusREAL(84) + Companions(5) )/100)                 // All-Skill-Eff cards (incl. chaotic troll Boss4B) + companion
 * * (1 + Summoning("WinBonus",14,0)/100)                            // summoning winner
 * * (1 + ( GuildBonuses(6) + ( CardSetBonuses(0,"2") + prayersReal(1,0) ) )/100)  // guild + card set 2 + Skilled Dimwit
 * * max(1 - ( GetBuffBonuses(40,2) + prayersReal(17,1) )/100, .01)  // Maestro Transfusion curse + Balance of Proficiency curse
 *
 * ── AllBaseSkillEff (SkillStats("AllBaseSkillEff"), N.js:5625, stitched) ── an additive PERCENT
 *   Breeding("ShinyBonusS","Nah",22,-1)      // shiny pet Base_Efficiency_for_All_Skills
 * + StampBonusOfTypeX("BaseAllEff")          // base all-skill-eff stamp
 * + Divinity("BlesssBonus",2,0)              // Nobisect blessing (deity 2) — see note
 * + BoxRewards["20b"]                        // Myriad Crate post-office box (bonus 1)
 * + chipBonuses("eff")                       // lab base-eff chip (index 13)
 * + ( GetTalentNumber(1,636)                 // Supersource flat star talent
 *   + MainframeBonus(112) )                  // lab jewel 112
 *
 * HONESTY: sub-terms the save cannot answer (worn-gear EtcBonuses, the DABAR vial, TomeBonus,
 * PaletteBonus(10), RiftSkillETC, B_UPG(49), shimmer, GetBuffBonuses, the base-eff stamp, the
 * Nobisect blessing — which itself recurses through AllEff + STR/WIS/AGI + max HP/MP, none in the
 * save — the Myriad Crate box, and MainframeBonus(112)) contribute their NEUTRAL element and mark
 * the aggregate "partial": both chains are honest LOWER BOUNDS. */

import { sel } from "../savemap.mjs";
import { famBonus } from "./family.mjs";
import { artifactBonus } from "./sailing.mjs";
import { getTalentNumber } from "./talents.mjs";
import { mealBonus } from "./meals.mjs";
import { paletteBonus } from "./gaming.mjs";
import { chipBonuses } from "./chips.mjs";
import { cardLv, cardBonusReal, cardSetBonus } from "./cards.mjs";
import { friendBonusStat } from "./thingies.mjs";
import { winBonus } from "./summoning.mjs";
import { guildBonus } from "./guild.mjs";
import { prayerBonus } from "./prayers.mjs";
import { shinyBonus } from "./breeding.mjs";
import { stampBonusOfType } from "./stamps.mjs";
import { boxReward } from "./postoffice.mjs";
import { mainframeBonus } from "./lab.mjs";
import { companion } from "./companions.mjs";

/** Call fn(); normalise to {value, status, note}. A thrown table-guard or a null (per-char with no
 *  active char) degrades to an honest unknown/neutral, and records ctx.unknown. */
function part(ctx, label, fn, { where, mul = false } = {}) {
  const neutral = mul ? 1 : 0;
  try {
    const r = fn();
    if (r === null) {
      return { label, value: neutral, status: "per-char", note: "needs an active character", where };
    }
    const f = typeof r === "number" ? { value: r } : r;
    return { label, value: f.value, status: f.status ?? "computed", note: f.note ?? "", where };
  } catch (e) {
    ctx.unknown(`skilleff: ${label} -> ${e.message}`);
    return { label, value: neutral, status: "unknown", note: e.message, where };
  }
}

const worstStatus = (parts) =>
  parts.some((p) => p.status === "unknown") ? "partial"
  : parts.some((p) => p.status === "partial" || p.status === "per-char") ? "partial"
  : "computed";

/**
 * SkillStats("AllBaseSkillEff") — a PERCENT added into every skill's base-efficiency group
 * (before the ^1.3). Returns a fragment {value, status, note, parts}. Skill-independent.
 */
export function allBaseSkillEff(ctx) {
  const v = (n) => Number(n) || 0;
  const parts = [
    part(ctx, "Shiny pets: Base Efficiency (all skills)", () => shinyBonus(ctx, 22), { where: "Breeding → shiny pets" }),
    part(ctx, "Stamp: base All-Skill Efficiency", () => stampBonusOfType(ctx, "BaseAllEff"), { where: "Stamps" }),
    part(ctx, "Divinity: Nobisect blessing", () => {
      ctx.unknown('skilleff: Divinity("BlesssBonus",2,0) Nobisect blessing recurses through AllEff + STR/WIS/AGI + max HP/MP — none in the save; neutral 0 (lower bound)');
      return { value: 0, status: "unknown", note: "Nobisect blessing not modelled (needs the char stat stack)" };
    }, { where: "W5 Divinity → Nobisect" }),
    part(ctx, "Post office: Myriad Crate (base eff)", () => boxReward(ctx, "20b"), { where: "Post Office" }),
    part(ctx, "Lab chip: base efficiency", () => chipBonuses(ctx, "eff"), { where: "Lab → chips (per character)" }),
    part(ctx, "Talent: Supersource", () => getTalentNumber(ctx, 636), { where: "Star talents (flat)" }),
    part(ctx, "Lab jewel 112", () => mainframeBonus(ctx, 112), { where: "Lab → jewels" }),
  ];
  const value = parts.reduce((a, p) => a + v(p.value), 0);
  return {
    value,
    status: worstStatus(parts),
    note: `AllBaseSkillEff = ${value.toFixed(2)}% (shiny + stamp + blessing + PO box + chip + Supersource + jewel112)`,
    parts,
  };
}

/**
 * SkillStats("AllEfficiencies") — the account/character-wide skill-efficiency MULTIPLIER (a
 * factor, e.g. 1.6). Returns a fragment {value, status, note, parts}. Skill-independent — the
 * final ×AllEfficiencies factor every skill-efficiency recipe shares. Reconstructs the client's
 * exact 6-group grouping from the sub-terms.
 */
export function allEfficiencies(ctx) {
  const v = (n) => Number(n) || 0;
  const opt = ctx.s.get("OptionsListAccount") ?? ctx.s.get("OptLacc") ?? [];

  // Group 1 — the family/gear/vial/artifact/quest-talent bracket
  const fam42 = part(ctx, "Family: Efficiency for All Skills", () => famBonus(ctx, "42"), { where: "Family bonuses" });
  const etc48 = part(ctx, "Gear/obol: +% All-Skill Efficiency", () => { ctx.unknown('skilleff: EtcBonuses("48") worn-gear/obol etc-stat not in the save (lower bound)'); return { value: 0, status: "unknown", note: "worn-equipment etc-stat not in the save" }; }, { where: "Worn equipment / obols" });
  const vial6 = part(ctx, "Vial: All-Skill Efficiency (DABAR Special)", () => { ctx.unknown('skilleff: AlchVials["6SkillEff"] (DABAR_SPECIAL "4 0 add", @N.js:23491) — vial-index arithmetic unverified; neutral 0'); return { value: 0, status: "unknown", note: "6SkillEff vial row not index-verified" }; }, { where: "Alchemy → Vials" });
  const artifact15 = part(ctx, "Sailing artifact: Frost Relic", () => artifactBonus(ctx, 15), { where: "Sailing → artifacts" });
  const questT = part(ctx, "Talent: Studious Quester (quest-capped)", () => {
    const t = getTalentNumber(ctx, 617);
    if (t === null) return null;
    ctx.unknown('skilleff: min(0.1*TotalQuestsComplete, Studious Quester) — TotalQuestsComplete not modelled; capped at 0 (lower bound)');
    return { value: 0, status: "unknown", note: `Studious Quester ceiling ${t.value.toFixed(2)}% but capped by 0.1×(quests completed), unknown` };
  }, { where: "Character talents (quest-gated)" });
  const g1parts = [fam42, etc48, vial6, artifact15, questT];
  const g1 = 1 + (v(fam42.value) + v(etc48.value) + v(vial6.value) + (v(artifact15.value) + v(questT.value))) / 100;

  // Group 2 — the big additive middle bracket
  const mealSeff = part(ctx, "Meal: +% Skill Efficiency", () => mealBonus(ctx, "Seff"), { where: "W4 Cooking → meals" });
  const t646 = part(ctx, "Talent: Efficiency for all Skills (646)", () => getTalentNumber(ctx, 646), { where: "Character talents" });
  const tome1 = part(ctx, "Tome: Skill Efficiency", () => { ctx.unknown('skilleff: Summoning("TomeBonus",1,0) not decoded'); return { value: 0, status: "unknown", note: "TomeBonus(1) not decoded" }; }, { where: "W6 Summoning → Tome" });
  const palette10 = part(ctx, "Gaming palette: Skill Efficiency", () => paletteBonus(ctx, 10), { where: "W5 Gaming → Sculpting palettes" });
  const chipTot = part(ctx, "Lab chip: total efficiency", () => chipBonuses(ctx, "toteff"), { where: "Lab → chips (per character)" });
  const crystal4 = part(ctx, "Passive card: Crystal Capybara (Crystal4)", () => cardLv(ctx, "Crystal4"), { where: "Cards → Crystal4 (3% per star)" });
  const friend2 = part(ctx, "Codex friend: Skill Efficiency", () => friendBonusStat(ctx, 2), { where: "Codex → Friends" });
  const riftETC2 = part(ctx, "Rift: Skill Mastery (efficiency)", () => { ctx.unknown('skilleff: RiftStuff("RiftSkillETC",2) not decoded'); return { value: 0, status: "unknown", note: "RiftSkillETC(2) not decoded" }; }, { where: "W4 Rift → Skill Mastery" });
  const bUpg49 = part(ctx, "Cavern schematic (Skill Eff)", () => { ctx.unknown('skilleff: Holes("B_UPG",49,15) not decoded'); return { value: 0, status: "unknown", note: "B_UPG(49) not decoded" }; }, { where: "The Cavern → Engineer" });
  const opt422 = { label: "Ninja: extra Skill Efficiency", value: Number(opt[422] ?? 0), status: "computed", note: `OptionsListAccount[422]=${Number(opt[422] ?? 0)}`, where: "W6 Ninja" };
  const shimmer = part(ctx, "Sailing: Shimmer Island", () => { const o180 = Number(opt[180] ?? 0); if (o180) ctx.unknown('skilleff: OptionsListAccount[180]×Dreamstuff("AllShimmerBonuses",0) not modelled'); return { value: 0, status: o180 ? "unknown" : "computed", note: o180 ? "shimmer island bonus not modelled" : "OptLacc[180]=0" }; }, { where: "Sailing → islands" });
  const crystal4Contrib = 3 * v(crystal4.value);
  const g2parts = [mealSeff, t646, tome1, palette10, chipTot, { ...crystal4, label: crystal4.label + " ×3", value: crystal4Contrib }, friend2, riftETC2, bUpg49, opt422, shimmer];
  const g2 = 1 + (v(mealSeff.value) + v(t646.value) + (v(tome1.value) + v(palette10.value))
    + (v(chipTot.value) + (crystal4Contrib + v(friend2.value)))
    + (v(riftETC2.value) + (v(bUpg49.value) + v(opt422.value)) + v(shimmer.value))) / 100;

  // Group 3 — All-Skill-Eff cards (incl. chaotic troll Boss4B) + companion 5
  const card84 = part(ctx, "Equipped +% All-Skill Eff cards (incl. Chaotic Troll)", () => cardBonusReal(ctx, 84), { where: "Cards → this character's slots" });
  const comp5 = part(ctx, "Pet: Skill Efficiency (companion 5)", () => { const c = companion(ctx, 5); return c.owned === null ? { value: 0, status: "unknown", note: "ownership unknown" } : { value: c.value, note: c.owned ? `owned -> +${c.value}%` : "not owned" }; }, { where: "Pets (followers)" });
  const g3parts = [card84, comp5];
  const g3 = 1 + (v(card84.value) + v(comp5.value)) / 100;

  // Group 4 — summoning winner
  const win14 = part(ctx, "Summoning winner: Skill Efficiency", () => winBonus(ctx, 14), { where: "W6 Summoning → victories" });
  const g4 = 1 + v(win14.value) / 100;

  // Group 5 — guild + card set 2 + Skilled Dimwit prayer bonus
  const guild6 = part(ctx, "Guild: Multi Tool (Skill Efficiency)", () => guildBonus(ctx, 6), { where: "Guild → bonuses" });
  const cardSet2 = part(ctx, "Card set: Skill Efficiency", () => cardSetBonus(ctx, 2), { where: "Cards → equipped set" });
  const prayer1 = part(ctx, "Prayer: Skilled Dimwit (bonus)", () => prayerBonus(ctx, 1, 0), { where: "W3 Worship prayers" });
  const g5parts = [guild6, cardSet2, prayer1];
  const g5 = 1 + (v(guild6.value) + (v(cardSet2.value) + v(prayer1.value))) / 100;

  // Group 6 — the curse floor (Maestro Transfusion + Balance of Proficiency curse)
  const buff40 = part(ctx, "Maestro Transfusion (curse arm)", () => { ctx.unknown("skilleff: GetBuffBonuses(40,2) Maestro Transfusion active-buff curse arm not modelled"); return { value: 0, status: "unknown", note: "active-buff state not modelled" }; }, { where: "Maestro talents (active buff)" });
  const prayer17c = part(ctx, "Prayer curse: Balance of Proficiency", () => prayerBonus(ctx, 17, 1), { where: "W3 Worship prayers" });
  const g6parts = [buff40, prayer17c];
  const g6 = Math.max(1 - (v(buff40.value) + v(prayer17c.value)) / 100, 0.01);

  const value = g1 * g2 * g3 * g4 * g5 * g6;
  const parts = [
    { label: "Group 1: family + gear/vial + Frost Relic + Studious Quester", value: g1, valueText: `×${g1.toFixed(3)}`, sub: g1parts },
    { label: "Group 2: meals/talent/tome/palette/chip/cards/friend/rift/cavern/ninja/shimmer", value: g2, valueText: `×${g2.toFixed(3)}`, sub: g2parts },
    { label: "Group 3: All-Skill-Eff cards + companion", value: g3, valueText: `×${g3.toFixed(3)}`, sub: g3parts },
    { label: "Group 4: summoning winner", value: g4, valueText: `×${g4.toFixed(3)}`, sub: [win14] },
    { label: "Group 5: guild + card set + Skilled Dimwit", value: g5, valueText: `×${g5.toFixed(3)}`, sub: g5parts },
    { label: "Group 6: curse floor (Maestro Transfusion + Balance of Proficiency)", value: g6, valueText: `×${g6.toFixed(3)}`, sub: g6parts },
  ];
  const flat = [...g1parts, ...g2parts, ...g3parts, win14, ...g5parts, ...g6parts];
  return {
    value,
    status: worstStatus(flat),
    note: `AllEfficiencies = ${value.toFixed(4)}× (${parts.map((p) => p.valueText).join(" ")})`,
    parts,
  };
}
