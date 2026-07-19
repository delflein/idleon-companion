/* stats/anvil-speed.mjs — recipe `anvilSpeed`: the anvil's ProductionSpeed multiplier, per
 * character. r._customBlock_AnvilProduceStats("ProductionSpeed"/"ProdSpdBonus"), N.js:7076-7077,
 * and x._customBlock_SkillStats("TownProdSpeedPCT"), N.js:5629. Verbatim:
 *
 *   ProductionSpeed = ProdSpdBonus * (1 + SkillStats("TownProdSpeedPCT")/100)
 *   ProdSpdBonus =
 *       (1 + (StampBonusOfTypeX("AnvilPAspd") + 2*AnvilPAstats[4]) / 100)          // stamp + speed points
 *     * (1 + (BoxRewards.ProdSpd + StatueBonusGiven11 + Summoning("VaultUpgBonus",24,0)) / 100)
 *     * (1 + AlchBubbles.AnvilACTIVE / 100)                                        // hammer-hammer ACTIVE bubble
 *     * ProdSpdBonusFromAGI                                                        // agility curve (mul)
 *   ProdSpdBonusFromAGI = 1 + 2*agiCurve, where
 *       AGI<1000:  agiCurve = (pow(AGI+1,0.37)-1)/40
 *       AGI>=1000: agiCurve = 0.5*((AGI-1000)/(AGI+2500)) + 0.297
 *   TownProdSpeedPCT = GetTalentNumber(1,269)          // Broken Time talent
 *                    + StarSigns.TownSkillSpd           // "Speed in Town" star sign (Bob Build Guy, +10)
 *
 * PER-CHARACTER: AnvilPAstats[4] (speed points), AGI, BoxRewards (post office), the Broken Time
 * talent and the Speed-in-Town sign all read the active character. AGI is not in the save (the
 * char stat stack, same gap as mining-eff), so the agility factor is an honest neutral 1 — the
 * result is a LOWER BOUND. The AnvilACTIVE bubble is an active-only bubble (runtime state), also
 * neutral. */

import { sel } from "../savemap.mjs";
import { T, term, evaluate } from "./engine.mjs";
import { stampBonusOfType } from "../bonuses/stamps.mjs";
import { boxReward } from "../bonuses/postoffice.mjs";
import { vaultUpgBonus } from "../bonuses/summoning.mjs";
import { alchBubble } from "../bonuses/bubbles.mjs";
import { getTalentNumber } from "../bonuses/talents.mjs";
import { starSignValue } from "../bonuses/starsigns.mjs";
import { statueBonusGiven } from "../bonuses/statues.mjs";

const num = (x) => Number(x) || 0;
function safe(ctx, fn, note) {
  try { const r = fn(); if (r === null) return null; return typeof r === "number" ? { value: r } : r; }
  catch (e) { ctx.unknown(`anvilSpeed: ${note} -> ${e.message}`); return { value: 0, status: "unknown", note: e.message }; }
}
/** A per-active-character term: neutral in the collapsed view, real in evaluatePerChar. */
function pc(ctx, id, key, kind, frag) {
  const neutral = kind === "mul" ? 1 : 0;
  if (frag === null) {
    if (!ctx._pcFlag) { ctx._pcFlag = true; ctx.unknown("account view only: anvil speed is per-character (speed points, AGI, post office, Broken Time, Speed-in-Town) — pick a character"); }
    return T(id, key, kind, neutral, "per-char", "resolved per character");
  }
  return T(id, key, kind, num(frag.value), frag.status ?? "computed", frag.note ?? "");
}

export const DISPLAY = {
  speedPoints: { label: "Anvil speed points", where: "Anvil → point allocation (per char)", how: "2 x AnvilPAstats[4]; +2% speed per point." },
  stamp: { label: "Stamp: Anvil Zoomer", where: "Stamps", how: 'StampBonusOfTypeX("AnvilPAspd").' },
  postOffice: { label: "Post office: production speed", where: "Post Office (per char)", how: "BoxRewards.ProdSpd — box row not verified." },
  anvilStatue: { label: "Anvil statue (Kachow)", where: "Statues → statue 11", how: "StatueBonusGiven11, incl. the shared statue multiplier." },
  vault: { label: "Upgrade vault: anvil speed", where: "W6 Summoning → Upgrade Vault", how: "VaultUpgBonus(24)." },
  hammerBubble: { label: "Bubble: Hammer Hammer (ACTIVE)", where: "Alchemy → cauldrons (active)", how: "AlchBubbles.AnvilACTIVE — active-only, runtime state (neutral)." },
  agiCurve: { label: "Agility curve", where: "Character AGI", how: "1 + 2*agiCurve(AGI); AGI stat stack not in the save (neutral x1)." },
  brokenTime: { label: "Talent: Broken Time", where: "Character talents", how: "GetTalentNumber(1,269) — +% town skill speed." },
  speedInTown: { label: "Star sign: Speed in Town", where: "Telescope star signs", how: "StarSigns.TownSkillSpd (+10 from Bob Build Guy)." },
};

export const anvilSpeed = {
  name: "anvilSpeed",
  label: "Anvil Production Speed",
  display: DISPLAY,
  activeCharSensitive: () => true,

  // Reconstruct ProdSpdBonus * (1 + TownProdSpeedPCT/100) from the named leaves.
  combine: ({ terms }) => {
    const v = (id) => { const t = terms.find((x) => x.id === id); return t ? num(t.value) : 0; };
    const g1 = 1 + (v("stamp") + v("speedPoints")) / 100;
    const g2 = 1 + (v("postOffice") + v("anvilStatue") + v("vault")) / 100;
    const g3 = 1 + v("hammerBubble") / 100;
    const agi = (() => { const t = terms.find((x) => x.id === "agiCurve"); return t ? num(t.value) : 1; }) () || 1;
    const town = 1 + (v("brokenTime") + v("speedInTown")) / 100;
    return g1 * g2 * g3 * agi * town;
  },

  terms(ctx) {
    const ci = ctx.activeChar;
    const spdPts = ci == null ? null : { value: 2 * num(sel.anvilStatsOf(ctx.s, ci)[4]), note: `${num(sel.anvilStatsOf(ctx.s, ci)[4])} speed points x2` };
    const stamp = safe(ctx, () => stampBonusOfType(ctx, "AnvilPAspd"), 'StampBonusOfTypeX("AnvilPAspd")');
    const po = ci == null ? null : safe(ctx, () => { ctx.unknown("BoxRewards.ProdSpd anvil-speed post-office box not verified in PO_ROWS"); return { value: 0, status: "unknown", note: "ProdSpd PO box not verified" }; }, "BoxRewards.ProdSpd");
    const statue = safe(ctx, () => statueBonusGiven(ctx, 11), "StatueBonusGiven11");
    const vault = safe(ctx, () => vaultUpgBonus(ctx, 24), "VaultUpgBonus(24)");
    const bubble = safe(ctx, () => alchBubble(ctx, "AnvilACTIVE"), 'AlchBubbles["AnvilACTIVE"]');
    const broken = ci == null ? null : safe(ctx, () => getTalentNumber(ctx, 269), "GetTalentNumber(1,269)");
    const sign = safe(ctx, () => starSignValue(ctx, 23), "StarSigns.TownSkillSpd (sign 23)");

    return [
      pc(ctx, "speedPoints", "2*AnvilPAstats[4]", "add", spdPts),
      term("stamp", 'StampBonusOfTypeX("AnvilPAspd")', "add", stamp ?? { value: 0, status: "unknown" }),
      pc(ctx, "postOffice", "BoxRewards.ProdSpd", "add", po),
      term("anvilStatue", 'ArbitraryCode("StatueBonusGiven11")', "add", statue ?? { value: 0, status: "unknown" }),
      term("vault", 'Summoning("VaultUpgBonus",24,0)', "add", vault ?? { value: 0, status: "unknown" }),
      term("hammerBubble", 'AlchBubbles.AnvilACTIVE', "add", bubble ?? { value: 0, status: "unknown", note: "AnvilACTIVE bubble not modelled" }),
      // AGI stat stack not modelled -> agility factor neutral x1
      ci == null
        ? T("agiCurve", "ProdSpdBonusFromAGI", "mul", 1, "per-char", "resolved per character")
        : (() => { ctx.unknown("anvilSpeed: TotalStats(AGI) stat stack not in the save -> agility factor neutral x1 (lower bound)"); return T("agiCurve", "ProdSpdBonusFromAGI(AGI)", "mul", 1, "unknown", "AGI stat stack not modelled -> x1"); })(),
      pc(ctx, "brokenTime", "GetTalentNumber(1,269)", "add", broken),
      term("speedInTown", "StarSigns.TownSkillSpd", "add", sign ?? { value: 0, status: "unknown" }),
    ];
  },
};

export const totalAnvilSpeed = (s, opts = {}) => evaluate(anvilSpeed, s, opts);
