/* stats/mining-eff.mjs — recipe for the client's Mining Efficiency
 * (x._customBlock_SkillStats("MiningEfficiency")). Fundamentally PER-CHARACTER: the pickaxe, the
 * mining talents and STR all read the active character, exactly like stats/afk-gain.mjs.
 *
 * THE EXPRESSION, verbatim from N.js `x._customBlock_SkillStats`, the `"MiningEfficiency"==d`
 * return (line 5634, stitched across the wrapped lines). `SkillStatsDN` is a DNSM scratch value
 * the client fills just before this branch (the "if(0==d.indexOf('Mining'))" block @line 5630):
 *
 *   SkillStatsDN = ( ItemDefinitionsGET[pickaxe].Weapon_Power + EquipmentMap[1][0].Weapon_Power ) // TOOL POWER
 *                  * (1 + GetTalentNumber(1,103)*(Lv0[1]/10)/100)     // Tool Proficiency × mining lvl/10
 *                  * (1 + AlchBubbles.ToolW/100)                      // STRONK_TOOLS bubble
 *                  + 4
 *                  + TotalStats("Mining_Power")                       // the Mining_Power stat stack (statue, SLABI bubble, looted copper…)
 *
 *   return 12 + ( pow(SkillStatsDN,1.3)
 *               + ( pow(TotalStats("STR")+1,.6)*(1+GetTalentNumber(1,142)/100)   // STR arm × Skill Strengthen
 *                 + ( StampBonusOfTypeX("BaseMinEff") + SkillStats("AllBaseSkillEff") ) ) )  // base stamp + shared base chain
 *          * (1 + Lv0[1]/200)                                          // mining level
 *          * (1 + (BoxRewards.MinEffPct + CalcTalentMAP["43"][0])/100) // Dwarven Supplies PO + Right Hand of Action
 *          * (1 + pow(TotalStats("STR")/100,.35)*(1+GetTalentNumber(1,142)/100)) // STR^.35 arm × Skill Strengthen
 *          * GoldFoodBonuses("MiningEff")                             // Golden Peanut
 *          * (1 + (GetTalentNumber(1,85) + (EtcBonuses("10") + (10*RiftStuff("RiftSkillBonus,0",1)  // Brute Eff + gear + mastery
 *              + (Summoning("VotingBonusz",7,0) + GetSetBonus("COPPER_SET","Bonus",0,0)))))/100)    // vote + Copper set
 *          * (1 + (CardBonusREAL(24) + (StarSigns.MiningEff + (AlchVials.MinEff + Holes("MonumentROGbonuses",0,0))))/100)
 *          * (1 + SkillStatsDN/100)                                   // + base again
 *          * ExtraMinEff                                              // "BIG PICK" DNSM factor (=1 default)
 *          * (1 + AlchBubbles.MinEff/100)                             // Hearty Diggy (mining-eff) bubble
 *          * (1 + GetTalentNumber(1,101)*(AtomCollider("AtomBonuses",1,0) + getLOG(Copper_owned))/100) // Copper Collector
 *          * SkillStats("AllEfficiencies")                            // shared multiplier chain
 *
 * The two shared chains (AllBaseSkillEff, AllEfficiencies) are bonuses/skilleff.mjs — reused
 * verbatim by choppin/fishing/catching/trapping/worship. combine() reconstructs the client's exact
 * nesting from the named leaves; missing leaves carry their neutral element so the result is an
 * honest LOWER BOUND.
 *
 * COVERAGE (2026-07-19, first cut). Computed from the save: mining level, Tool Proficiency (103),
 * Skill Strengthen (142, in the notes — the STR it scales is not modelled), Brute Efficiency (85),
 * Copper Collector (101, ×0 until copper-owned is modelled), the Copper armour set, and the two
 * shared chains (family, Frost Relic, chips, Crystal Capybara, Codex friend, summoning winner,
 * guild, card set 2, Skilled Dimwit, Supersource, shiny pets, base-eff chip — all live).
 *
 * Honest UNKNOWNS (neutral element, lower bound): TOOL POWER (worn pickaxe not in the save — the
 * single biggest gap, mirrors class-xp's LUK stack), TotalStats("Mining_Power") and TotalStats
 * ("STR") (the char stat stacks), the ToolW/Hearty-Diggy bubbles, StampBonusOfTypeX("BaseMinEff"),
 * Dwarven Supplies PO box, Right Hand of Action (Maestro), GoldFoodBonuses (→ neutral 1), gear
 * EtcBonuses(10), the mining mastery, the mining-eff vote, CardBonusREAL(24) (rift passive re-add
 * arm), StarSigns.MiningEff, AlchVials.MinEff, the mining monument, ExtraMinEff BIG PICK (→ 1), the
 * Copper-Collector atom+log-copper inner, plus the unknown sub-terms inside the two shared chains.
 */

import { sel, skillLv } from "../savemap.mjs";
import { T, term, evaluate } from "./engine.mjs";
import { getLOG } from "../bonuses/util.mjs";
import { allEfficiencies, allBaseSkillEff } from "../bonuses/skilleff.mjs";
import { getTalentNumber } from "../bonuses/talents.mjs";
import { stampBonusOfType } from "../bonuses/stamps.mjs";
import { setBonus } from "../bonuses/misc.mjs";
import { cardBonusReal } from "../bonuses/cards.mjs";
import { goldFoodBonus } from "../bonuses/goldfood.mjs";

/** A per-ACTIVE-CHARACTER term. frag=null -> needs an active char (neutral in the collapsed view,
 *  real value in evaluatePerChar's byChar results). */
function perChar(ctx, id, key, kind, frag) {
  const neutral = kind === "mul" ? 1 : 0;
  if (frag === null) {
    if (!ctx._perCharFlagged) {
      ctx._perCharFlagged = true;
      ctx.unknown("account view only: per-character terms (mining level, tool power, the mining talents, prayers/cards inside the shared chains) sit at their neutral element here — pick a character to resolve them");
    }
    return T(id, key, kind, neutral, "per-char", "resolved in the per-character view");
  }
  const f = typeof frag === "number" ? { value: frag } : frag;
  return T(id, key, kind, f.value, f.status ?? "computed", f.note ?? "", f.parts);
}

/** An unimplemented additive/mul leaf: neutral element, honest status. */
const todo = (id, key, kind, why) => T(id, key, kind, kind === "mul" ? 1 : 0, "unknown", why);
function safe(ctx, fn, note) {
  try { const f = fn(); if (f === null) return null; return typeof f === "number" ? { value: f } : f; }
  catch (e) { ctx.unknown(`${note} -> ${e.message}`); return { value: 0, status: "unknown", note }; }
}

export const DISPLAY = {
  /* base (SkillStatsDN) */
  toolPower: { label: "Pickaxe power", where: "Equipped pickaxe (+ its upgrades)", how: "Base tool Weapon_Power — worn gear is not in the save (biggest gap; lower bound)." },
  toolProf103: { label: "Talent: Tool Proficiency", where: "Character talents", how: "×(1 + talent × mining-lvl/10); scales the pickaxe power." },
  toolWBubble: { label: "Bubble: Stronk Tools", where: "Alchemy → cauldrons", how: "ToolW bubble — not modelled (lower bound)." },
  baseFlat4: { label: "Base +4", where: "Always on", how: "The flat +4 every miner's base carries." },
  miningPower: { label: "Mining Power stat", where: "Character stat stack", how: "TotalStats(Mining_Power) — statue, SLABI bubble, looted copper; not modelled." },
  /* additive base group */
  strArm60: { label: "STR arm (^0.6)", where: "Character STR", how: "pow(STR+1,0.6)×(1+Skill Strengthen); STR stat stack not modelled." },
  stampBaseMin: { label: "Stamp: base Mining Eff", where: "Stamps", how: "StampBonusOfTypeX(BaseMinEff) — rows not verified." },
  allBaseSkillEff: { label: "Base efficiency (all skills)", where: "Shared base-eff chain", how: "Shiny pets + base-eff stamp + Nobisect + Myriad Crate + base-eff chip + Supersource + jewel." },
  /* multipliers */
  miningLvl: { label: "Mining level", where: "Mining skill", how: "×(1 + level/200)." },
  postOfficeMinEff: { label: "Post office: Dwarven Supplies", where: "Post Office (per char)", how: "BoxRewards.MinEffPct — row not verified." },
  rightHand43: { label: "Maestro: Right Hand of Action", where: "Maestro talents", how: "CalcTalentMAP[43][0] — Maestro cross-char arm, not modelled." },
  strArm35: { label: "STR arm (^0.35)", where: "Character STR", how: "pow(STR/100,0.35)×(1+Skill Strengthen); STR not modelled -> ×1." },
  goldFood: { label: "Golden food: Golden Peanut", where: "Golden foods (equipped + beanstalk)", how: "×(1+GoldFoodBonuses(MiningEff)/100) — per-character; lower bound (×GfoodMulti unread)." },
  brute85: { label: "Talent: Brute Efficiency", where: "Character talents", how: "+% efficiency for all specialized skills." },
  etcGear10: { label: "Gear/obol: +% Mining Eff", where: "Worn equipment / obols", how: "EtcBonuses(10) — worn gear not in the save." },
  mastery: { label: "Rift: Mining Skill Mastery", where: "W4 Rift → Skill Mastery", how: "10 × RiftSkillBonus — not decoded." },
  vote7: { label: "Weekly ballot: Mining Eff", where: "W2 Town Ballot", flag: true, how: "Only in mining-eff vote weeks; active vote is runtime state." },
  copperSet: { label: "Copper armour set", where: "Armor sets", how: "+% Mining & Choppin Eff once perma-unlocked." },
  cardMining24: { label: "Equipped +% Mining Eff cards", where: "Cards → this character's slots", how: "CardBonusREAL(24) — rift Ruby-Cards passive re-add arm not modelled." },
  starMiningEff: { label: "Star signs: Mining Eff", where: "Telescope star signs", how: "StarSigns.MiningEff — signs not decoded." },
  vialMinEff: { label: "Vial: Mining Eff", where: "Alchemy → Vials", how: "AlchVials.MinEff — vial row not verified." },
  monument0: { label: "Cavern monument: Mining Eff", where: "The Cavern → Monuments", how: "MonumentROGbonuses(0,0) — not decoded." },
  extraMinEff: { label: "Big Pick", where: "Mining", how: "DNSM.ExtraMinEff — the BIG PICK factor (=1 default; not modelled)." },
  heartyDiggyMinEff: { label: "Bubble: Hearty Diggy (mining eff)", where: "Alchemy → cauldrons", how: "AlchBubbles.MinEff — not modelled." },
  copperCollector101: { label: "Talent: Copper Collector", where: "Character talents", how: "×(1 + talent×(atom + log10(copper owned))/100); atom & copper owned not modelled -> ×1." },
  allEfficiencies: { label: "All Skill Efficiency (shared multiplier)", where: "Shared eff chain", how: "Family, Frost Relic, cards, summoning winner, guild, prayers — the ×AllEfficiencies factor." },
};

export const miningEff = {
  name: "miningEff",
  label: "Mining Efficiency",
  display: DISPLAY,
  activeCharSensitive: () => true,

  /** Reconstructs the verbatim MiningEfficiency return from the named leaves. */
  combine: ({ terms }) => {
    const v = (id) => { const t = terms.find((x) => x.id === id); return t ? Number(t.value) || 0 : 0; };
    // base (SkillStatsDN)
    const base = v("toolPower") * (1 + v("toolProf103") / 100) * (1 + v("toolWBubble") / 100)
      + v("baseFlat4") + v("miningPower");
    const addGroup = Math.pow(base, 1.3) + (v("strArm60") + (v("stampBaseMin") + v("allBaseSkillEff")));
    return 12 + addGroup
      * (1 + v("miningLvl") / 200)
      * (1 + (v("postOfficeMinEff") + v("rightHand43")) / 100)
      * (1 + v("strArm35"))
      * (v("goldFood") || 1)
      * (1 + (v("brute85") + (v("etcGear10") + (10 * v("mastery") + (v("vote7") + v("copperSet"))))) / 100)
      * (1 + (v("cardMining24") + (v("starMiningEff") + (v("vialMinEff") + v("monument0")))) / 100)
      * (1 + base / 100)
      * (v("extraMinEff") || 1)
      * (1 + v("heartyDiggyMinEff") / 100)
      * (1 + v("copperCollector101") / 100)
      * (v("allEfficiencies") || 1);
  },

  terms(ctx) {
    const ci = ctx.activeChar;
    const mLv = ci == null ? null : skillLv(ctx.s, ci, "mining");
    // Tool Proficiency is the multiplier `t103 * (miningLvl/10)`; store that PRODUCT as toolProf103.
    const t103frag = ci == null ? null : safe(ctx, () => getTalentNumber(ctx, 103), "GetTalentNumber(1,103)");
    const t103Prod = t103frag == null ? null : { value: (t103frag.value ?? 0) * (Number(mLv) / 10), status: t103frag.status, note: `Tool Proficiency ${(t103frag.value ?? 0).toFixed(2)} × mining lvl/10 (${mLv}/10)` };
    // Copper Collector: t101 × (atom + log copper). atom+copper unknown -> inner 0 -> the whole term 0.
    const t101frag = ci == null ? null : safe(ctx, () => getTalentNumber(ctx, 101), "GetTalentNumber(1,101)");

    const chainBase = allBaseSkillEff(ctx);
    const chainMul = allEfficiencies(ctx);

    return [
      /* ---- base (SkillStatsDN) ---- */
      todo("toolPower", "ItemDef[pickaxe].Weapon_Power + EquipmentMap[1][0].Weapon_Power", "add", "worn pickaxe power not in the save (biggest gap; lower bound)"),
      perChar(ctx, "toolProf103", "GetTalentNumber(1,103)*(Lv0[1]/10)", "add", t103Prod),
      todo("toolWBubble", "AlchBubbles.ToolW (Stronk Tools)", "add", "ToolW bubble not modelled"),
      T("baseFlat4", "flat +4", "add", 4, "computed", "always-on mining base"),
      todo("miningPower", 'TotalStats("Mining_Power")', "add", "Mining_Power stat stack (statue/SLABI/looted) not modelled"),

      /* ---- additive base group (× 1.3 power on `base`, then + these) ---- */
      perChar(ctx, "strArm60", 'pow(TotalStats("STR")+1,.6)*(1+GetTalentNumber(1,142)/100)', "add",
        ci == null ? null : (() => { ctx.unknown('TotalStats("STR") stat stack drives the mining STR arm (^0.6) — not modelled'); const t = safe(ctx, () => getTalentNumber(ctx, 142), "t142"); return { value: 0, status: "unknown", note: `STR stack not modelled; Skill Strengthen(142)=${(t?.value ?? 0).toFixed(2)}%` }; })()),
      term("stampBaseMin", 'StampBonusOfTypeX("BaseMinEff")', "add", safe(ctx, () => stampBonusOfType(ctx, "BaseMinEff"), 'StampBonusOfTypeX("BaseMinEff")')),
      T("allBaseSkillEff", 'SkillStats("AllBaseSkillEff")', "add", chainBase.value, chainBase.status, chainBase.note, chainBase.parts),

      /* ---- multipliers ---- */
      perChar(ctx, "miningLvl", "Lv0[1] mining level", "add", mLv == null ? null : { value: mLv, note: `mining level ${mLv} (×(1+lvl/200) in combine)` }),
      perChar(ctx, "postOfficeMinEff", "BoxRewards.MinEffPct (Dwarven Supplies)", "add",
        ci == null ? null : safe(ctx, () => { ctx.unknown("BoxRewards.MinEffPct Dwarven Supplies post-office box not decoded"); return { value: 0, status: "unknown", note: "Dwarven Supplies box not decoded" }; }, "MinEffPct")),
      todo("rightHand43", 'CalcTalentMAP["43"][0] Right Hand of Action', "add", "Maestro Right Hand of Action cross-char arm not modelled"),
      perChar(ctx, "strArm35", 'pow(TotalStats("STR")/100,.35)*(1+GetTalentNumber(1,142)/100)', "add",
        ci == null ? null : { value: 0, status: "unknown", note: "STR stat stack not modelled -> ×1" }),
      perChar(ctx, "goldFood", 'GoldFoodBonuses("MiningEff")', "mul",
        ci == null ? null : (() => { const g = goldFoodBonus(ctx, "MiningEff", ci); return { value: 1 + g.value / 100, status: g.status, note: `×(1+${g.value.toFixed(2)}%): ${g.note}`, parts: g.parts }; })()),
      perChar(ctx, "brute85", "GetTalentNumber(1,85) Brute Efficiency", "add",
        ci == null ? null : safe(ctx, () => getTalentNumber(ctx, 85), "GetTalentNumber(1,85)")),
      todo("etcGear10", 'EtcBonuses("10") (gear/obol)', "add", "worn-equipment etc-stat not in the save (lower bound)"),
      todo("mastery", '10*RiftStuff("RiftSkillBonus,0",1)', "add", "mining skill mastery not decoded"),
      term("vote7", 'Summoning("VotingBonusz",7,0)', "add", safe(ctx, () => { ctx.unknown('Summoning("VotingBonusz",7,0) mining-eff vote — runtime state + pct unverified'); return { value: 0, status: "unknown", note: "mining-eff vote not modelled" }; }, "vote 7")),
      term("copperSet", 'GetSetBonus("COPPER_SET","Bonus",0,0)', "add", safe(ctx, () => setBonus(ctx, "COPPER_SET"), 'GetSetBonus("COPPER_SET")')),
      perChar(ctx, "cardMining24", "CardBonusREAL(24) +%_Total_Mining_Efficiency cards", "add",
        ci == null ? null : safe(ctx, () => cardBonusReal(ctx, 24), "CardBonusREAL(24)")),
      todo("starMiningEff", "StarSigns.MiningEff", "add", "mining-eff star signs not decoded"),
      todo("vialMinEff", "AlchVials.MinEff", "add", "MinEff vial row not verified"),
      todo("monument0", 'Holes("MonumentROGbonuses",0,0)', "add", "mining monument not decoded"),
      todo("extraMinEff", "DNSM.ExtraMinEff (BIG PICK)", "mul", "Big Pick factor not modelled (neutral ×1)"),
      todo("heartyDiggyMinEff", "AlchBubbles.MinEff (Hearty Diggy)", "add", "mining-eff bubble not modelled"),
      perChar(ctx, "copperCollector101", "GetTalentNumber(1,101)*(atom + log10(copper))", "add",
        t101frag == null ? null : (() => { ctx.unknown("Copper Collector inner (AtomBonuses(1) + log10 copper owned) not modelled -> talent contributes 0"); return { value: 0, status: "unknown", note: `Copper Collector(101)=${(t101frag.value ?? 0).toFixed(2)}% but ×(atom+log copper), both unknown -> 0` }; })()),
      T("allEfficiencies", 'SkillStats("AllEfficiencies")', "mul", chainMul.value, chainMul.status, chainMul.note, chainMul.parts),
    ];
  },
};

/** Convenience with the classic shape. */
export const totalMiningEff = (s, opts = {}) => evaluate(miningEff, s, opts);
