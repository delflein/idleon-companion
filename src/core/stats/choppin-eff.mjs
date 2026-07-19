/* stats/choppin-eff.mjs — recipe for the client's Choppin Efficiency
 * (x._customBlock_SkillStats("ChoppinEfficiency")). Per-character, like mining.
 *
 * THE EXPRESSION, verbatim from N.js `x._customBlock_SkillStats`, the `"ChoppinEfficiency"==d`
 * return (line 5648, stitched). `SkillStatsDN` is the choppin base filled just before, in the
 * "if(0==d.indexOf('Choppin'))" block: NOTE it has NO Tool-Proficiency talent (unlike mining):
 *
 *   SkillStatsDN = ( ItemDefinitionsGET[hatchet].Weapon_Power + EquipmentMap[1][1].Weapon_Power )  // TOOL POWER
 *                  * (1 + AlchBubbles.ToolM/100)                      // choppin tool bubble
 *                  + 4
 *                  + TotalStats("Choppin_Power")                      // the Choppin_Power stat stack
 *
 *   return 8 + ( pow(SkillStatsDN,1.3)
 *              + ( pow((TotalStats("WIS")+2)*(1+GetTalentNumber(1,462)/100)*(1+GetTalentNumber(1,532)/100),.6)  // WIS arm × Woodsman × Skill Strengthen
 *                + ( StampBonusOfTypeX("BaseChopEff") + SkillStats("AllBaseSkillEff") ) ) )
 *          * (1 + Lv0[3]/200)                                          // choppin level
 *          * (1 + (BoxRewards.ChopEffPct + CalcTalentMAP["43"][2] + StarSigns.ChopEff)/100)  // Woodcutter PO + Right Hand + star sign
 *          * (1 + (AlchBubbles.ChopEff + Holes("MonumentROGbonuses",2,0))/100)               // bubble + monument
 *          * (1 + pow(TotalStats("WIS")*(1+GetTalentNumber(1,462)/100)/100,.35)*(1+GetTalentNumber(1,532)/100)) // WIS^.35 arm
 *          * (1 + (GetTalentNumber(1,445) + (EtcBonuses("11") + (10*RiftStuff("RiftSkillBonus,2",1)     // Brute Eff + gear + mastery
 *              + (Summoning("VotingBonusz",9,0) + GetSetBonus("COPPER_SET","Bonus",0,0)))))/100)        // vote + Copper set
 *          * (1 + (CardBonusREAL(27) + (AlchVials.ChopEff + 10*AchieveStatus(352)))/100)    // cards + vial + achievement
 *          * (1 + SkillStatsDN/100)
 *          * (1 + GetTalentNumber(1,461)*getLOG(Leaf1_owned)/100)      // Leaf Collector × log10(leaves owned)
 *          * SkillStats("AllEfficiencies")
 *
 * Choppin has NO golden food, NO Big Pick, NO Hearty-Diggy factor and NO Copper Collector — it
 * folds the star sign into the post-office factor and swaps Copper Collector for Leaf Collector.
 * Shares AllBaseSkillEff + AllEfficiencies (bonuses/skilleff.mjs) with mining verbatim.
 *
 * COVERAGE: computed from the save — choppin level, Woodsman (462) / Skill Strengthen (532) (in
 * the notes; the WIS they scale is not modelled), Brute Efficiency (445), Leaf Collector (461, ×0
 * until leaves-owned is modelled), the Copper armour set, achievement 352, and the two shared
 * chains. Honest UNKNOWNS (neutral element, lower bound): tool power, TotalStats("Choppin_Power")
 * and ("WIS"), the ToolM/ChopEff bubbles, StampBonusOfTypeX("BaseChopEff"), the Woodcutter PO box,
 * Right Hand of Action, gear EtcBonuses(11), the choppin mastery, the choppin-eff vote,
 * CardBonusREAL(27) (rift passive re-add arm), StarSigns.ChopEff, AlchVials.ChopEff, the choppin
 * monument, the leaves-owned log, plus the unknown sub-terms inside the shared chains.
 */

import { skillLv } from "../savemap.mjs";
import { T, term, evaluate } from "./engine.mjs";
import { allEfficiencies, allBaseSkillEff } from "../bonuses/skilleff.mjs";
import { getTalentNumber } from "../bonuses/talents.mjs";
import { stampBonusOfType } from "../bonuses/stamps.mjs";
import { setBonus, achieveStatus } from "../bonuses/misc.mjs";
import { cardBonusReal } from "../bonuses/cards.mjs";

function perChar(ctx, id, key, kind, frag) {
  const neutral = kind === "mul" ? 1 : 0;
  if (frag === null) {
    if (!ctx._perCharFlagged) {
      ctx._perCharFlagged = true;
      ctx.unknown("account view only: per-character terms (choppin level, tool power, the choppin talents, WIS, prayers/cards inside the shared chains) sit at their neutral element here — pick a character to resolve them");
    }
    return T(id, key, kind, neutral, "per-char", "resolved in the per-character view");
  }
  const f = typeof frag === "number" ? { value: frag } : frag;
  return T(id, key, kind, f.value, f.status ?? "computed", f.note ?? "", f.parts);
}

const todo = (id, key, kind, why) => T(id, key, kind, kind === "mul" ? 1 : 0, "unknown", why);
function safe(ctx, fn, note) {
  try { const f = fn(); if (f === null) return null; return typeof f === "number" ? { value: f } : f; }
  catch (e) { ctx.unknown(`${note} -> ${e.message}`); return { value: 0, status: "unknown", note }; }
}

export const DISPLAY = {
  toolPower: { label: "Hatchet power", where: "Equipped hatchet (+ upgrades)", how: "Base tool Weapon_Power — worn gear is not in the save (biggest gap; lower bound)." },
  toolMBubble: { label: "Bubble: choppin tool", where: "Alchemy → cauldrons", how: "ToolM bubble — not modelled (lower bound)." },
  baseFlat4: { label: "Base +4", where: "Always on", how: "The flat +4 every chopper's base carries." },
  choppinPower: { label: "Choppin Power stat", where: "Character stat stack", how: "TotalStats(Choppin_Power) — statue, bubbles, looted; not modelled." },
  wisArm60: { label: "WIS arm (^0.6)", where: "Character WIS", how: "pow((WIS+2)×Woodsman×Skill Strengthen, 0.6); WIS stat stack not modelled." },
  stampBaseChop: { label: "Stamp: base Choppin Eff", where: "Stamps", how: "StampBonusOfTypeX(BaseChopEff) — rows not verified." },
  allBaseSkillEff: { label: "Base efficiency (all skills)", where: "Shared base-eff chain", how: "Shiny pets + base-eff stamp + Nobisect + Myriad Crate + base-eff chip + Supersource + jewel." },
  choppinLvl: { label: "Choppin level", where: "Choppin skill", how: "×(1 + level/200)." },
  postOfficeChop: { label: "Post office + Right Hand + star sign", where: "Post Office / Maestro / Telescope", how: "BoxRewards.ChopEffPct + CalcTalentMAP[43][2] + StarSigns.ChopEff — none decoded." },
  bubbleMonument: { label: "Bubble + Cavern monument (Choppin Eff)", where: "Alchemy / The Cavern", how: "AlchBubbles.ChopEff + MonumentROGbonuses(2,0) — not decoded." },
  wisArm35: { label: "WIS arm (^0.35)", where: "Character WIS", how: "pow(WIS×Woodsman/100, 0.35)×(1+Skill Strengthen); WIS not modelled -> ×1." },
  brute445: { label: "Talent: Brute Efficiency (Choppin)", where: "Character talents", how: "+% efficiency for all specialized skills." },
  etcGear11: { label: "Gear/obol: +% Choppin Eff", where: "Worn equipment / obols", how: "EtcBonuses(11) — worn gear not in the save." },
  mastery: { label: "Rift: Choppin Skill Mastery", where: "W4 Rift → Skill Mastery", how: "10 × RiftSkillBonus — not decoded." },
  vote9: { label: "Weekly ballot: Choppin Eff", where: "W2 Town Ballot", flag: true, how: "Only in choppin-eff vote weeks; active vote is runtime state." },
  copperSet: { label: "Copper armour set", where: "Armor sets", how: "+% Mining & Choppin Eff once perma-unlocked." },
  cardChop27: { label: "Equipped +% Choppin Eff cards", where: "Cards → this character's slots", how: "CardBonusREAL(27) — rift Ruby-Cards passive re-add arm not modelled." },
  vialChopEff: { label: "Vial: Choppin Eff", where: "Alchemy → Vials", how: "AlchVials.ChopEff — vial row not verified." },
  ach352: { label: "Achievement: Choppin Eff", where: "Achievements", how: "+10% flat when done." },
  leafCollector461: { label: "Talent: Leaf Collector", where: "Character talents", how: "×(1 + talent×log10(leaves owned)/100); leaves owned not modelled -> ×1." },
  allEfficiencies: { label: "All Skill Efficiency (shared multiplier)", where: "Shared eff chain", how: "Family, Frost Relic, cards, summoning winner, guild, prayers — the ×AllEfficiencies factor." },
};

export const choppinEff = {
  name: "choppinEff",
  label: "Choppin Efficiency",
  display: DISPLAY,
  activeCharSensitive: () => true,

  combine: ({ terms }) => {
    const v = (id) => { const t = terms.find((x) => x.id === id); return t ? Number(t.value) || 0 : 0; };
    const base = v("toolPower") * (1 + v("toolMBubble") / 100) + v("baseFlat4") + v("choppinPower");
    const addGroup = Math.pow(base, 1.3) + (v("wisArm60") + (v("stampBaseChop") + v("allBaseSkillEff")));
    return 8 + addGroup
      * (1 + v("choppinLvl") / 200)
      * (1 + v("postOfficeChop") / 100)
      * (1 + v("bubbleMonument") / 100)
      * (1 + v("wisArm35"))
      * (1 + (v("brute445") + (v("etcGear11") + (10 * v("mastery") + (v("vote9") + v("copperSet"))))) / 100)
      * (1 + (v("cardChop27") + (v("vialChopEff") + 10 * v("ach352"))) / 100)
      * (1 + base / 100)
      * (1 + v("leafCollector461") / 100)
      * (v("allEfficiencies") || 1);
  },

  terms(ctx) {
    const ci = ctx.activeChar;
    const cLv = ci == null ? null : skillLv(ctx.s, ci, "choppin");
    const chainBase = allBaseSkillEff(ctx);
    const chainMul = allEfficiencies(ctx);

    return [
      /* ---- base (SkillStatsDN) ---- */
      todo("toolPower", "ItemDef[hatchet].Weapon_Power + EquipmentMap[1][1].Weapon_Power", "add", "worn hatchet power not in the save (biggest gap; lower bound)"),
      todo("toolMBubble", "AlchBubbles.ToolM", "add", "choppin tool bubble not modelled"),
      T("baseFlat4", "flat +4", "add", 4, "computed", "always-on choppin base"),
      todo("choppinPower", 'TotalStats("Choppin_Power")', "add", "Choppin_Power stat stack not modelled"),

      /* ---- additive base group ---- */
      perChar(ctx, "wisArm60", 'pow((TotalStats("WIS")+2)*(1+t462/100)*(1+t532/100),.6)', "add",
        ci == null ? null : (() => { ctx.unknown('TotalStats("WIS") stat stack drives the choppin WIS arm (^0.6) — not modelled'); const t462 = safe(ctx, () => getTalentNumber(ctx, 462), "t462"); const t532 = safe(ctx, () => getTalentNumber(ctx, 532), "t532"); return { value: 0, status: "unknown", note: `WIS stack not modelled; Woodsman(462)=${(t462?.value ?? 0).toFixed(2)}%, Skill Strengthen(532)=${(t532?.value ?? 0).toFixed(2)}%` }; })()),
      term("stampBaseChop", 'StampBonusOfTypeX("BaseChopEff")', "add", safe(ctx, () => stampBonusOfType(ctx, "BaseChopEff"), 'StampBonusOfTypeX("BaseChopEff")')),
      T("allBaseSkillEff", 'SkillStats("AllBaseSkillEff")', "add", chainBase.value, chainBase.status, chainBase.note, chainBase.parts),

      /* ---- multipliers ---- */
      perChar(ctx, "choppinLvl", "Lv0[3] choppin level", "add", cLv == null ? null : { value: cLv, note: `choppin level ${cLv} (×(1+lvl/200) in combine)` }),
      perChar(ctx, "postOfficeChop", "BoxRewards.ChopEffPct + CalcTalentMAP[43][2] + StarSigns.ChopEff", "add",
        ci == null ? null : (() => { ctx.unknown("Choppin post-office (Woodcutter Supplies) + Right Hand of Action + ChopEff star sign not decoded"); return { value: 0, status: "unknown", note: "PO box + Right Hand + star sign not decoded" }; })()),
      todo("bubbleMonument", 'AlchBubbles.ChopEff + Holes("MonumentROGbonuses",2,0)', "add", "choppin-eff bubble + monument not decoded"),
      perChar(ctx, "wisArm35", 'pow(TotalStats("WIS")*(1+t462/100)/100,.35)*(1+t532/100)', "add",
        ci == null ? null : { value: 0, status: "unknown", note: "WIS stat stack not modelled -> ×1" }),
      perChar(ctx, "brute445", "GetTalentNumber(1,445) Brute Efficiency", "add",
        ci == null ? null : safe(ctx, () => getTalentNumber(ctx, 445), "GetTalentNumber(1,445)")),
      todo("etcGear11", 'EtcBonuses("11") (gear/obol)', "add", "worn-equipment etc-stat not in the save (lower bound)"),
      todo("mastery", '10*RiftStuff("RiftSkillBonus,2",1)', "add", "choppin skill mastery not decoded"),
      term("vote9", 'Summoning("VotingBonusz",9,0)', "add", safe(ctx, () => { ctx.unknown('Summoning("VotingBonusz",9,0) choppin-eff vote — runtime state + pct unverified'); return { value: 0, status: "unknown", note: "choppin-eff vote not modelled" }; }, "vote 9")),
      term("copperSet", 'GetSetBonus("COPPER_SET","Bonus",0,0)', "add", safe(ctx, () => setBonus(ctx, "COPPER_SET"), 'GetSetBonus("COPPER_SET")')),
      perChar(ctx, "cardChop27", "CardBonusREAL(27) +%_Total_Choppin_Efficiency cards", "add",
        ci == null ? null : safe(ctx, () => cardBonusReal(ctx, 27), "CardBonusREAL(27)")),
      todo("vialChopEff", "AlchVials.ChopEff", "add", "ChopEff vial row not verified"),
      T("ach352", "10*AchieveStatus(352)", "add", achieveStatus(ctx, 352) ? 1 : 0, "computed", `ach352=${achieveStatus(ctx, 352)} (×10 in combine)`),
      todo("leafCollector461", "GetTalentNumber(1,461)*log10(leaves owned)", "add", "Leaf Collector inner (leaves owned) not modelled -> ×1"),
      T("allEfficiencies", 'SkillStats("AllEfficiencies")', "mul", chainMul.value, chainMul.status, chainMul.note, chainMul.parts),
    ];
  },
};

/** Convenience with the classic shape. */
export const totalChoppinEff = (s, opts = {}) => evaluate(choppinEff, s, opts);
