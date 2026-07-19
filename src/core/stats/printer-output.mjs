/* stats/printer-output.mjs — recipe `printerOutput`, "Printer Output Multi".
 *
 * THE EXPRESSION, verbatim from WorkbenchStuff("AdditionExtraPrinting",0,0), N.js:12271-72
 * (gamedata-w3-printer.mjs §3) — a straight PRODUCT of 7 factors:
 *   ( 1 + OptionsListAccount[125] * (2 + Sailing.ArtifactBonus(4,1)) / 100 )        // Gold Relic × days
 *   * ( 1 + getbonus2(1,178,-1) * getLOG(OptionsListAccount[138]) / 100 )            // Divine Knight × orb kills
 *   * ( 1 + ( RiftStuff.RiftSkillETC(3) + Ninja.PristineBon(15,0) ) / 100 )          // Skill Mastery + Emporium
 *   * ( 1 + Summoning.VotingBonusz(11,0) / 100 )                                     // Bonus Ballot
 *   * ( 1 + 2 * OptionsListAccount[323] * Summoning.EventShopOwned(4,0) / 100 )      // Winter event shop
 *   * ( 1 + OptionsListAccount[354] * Companions(17) / 100 )                         // Companion
 *   * ( 1 + OptionsListAccount[364] * Windwalker.CompassBonus(43,0) / 100 )          // Compass
 *
 * DRIFT vs toolbox (gamedata-w3-printer.mjs §3): toolbox's getPrinterMulti multiplies in a Lolly
 * Flower charm + the "Yet Another Printer Multi" Legend Talent (idx 17). NEITHER appears in this
 * local N.js copy's AdditionExtraPrinting product, so — per the repo's "transcribe N.js, don't
 * guess" rule — they are OMITTED here. Documented, not silently merged.
 *
 * WRAPPER (ExtraPrinting, N.js:12273-74): Output = AdditionExtraPrinting × {1,2,3,6}, selected by
 * the Lab chip "Wired In" (MainframeBonus(1)==2) AND (AFK target == Laboratory OR the Harriep-type
 * Divinity major link Divinity("Bonus_MAJOR",b,2)==1), with Divinity("Bonus_MAJOR",b,3) escalating
 * to ×3/×6. This is PER-CHARACTER + runtime AFK state + a Divinity major-god read this repo does
 * not yet model — represented as one `labDivinityMulti` term held at its neutral ×1 (lower bound). */

import { sel } from "../savemap.mjs";
import { T } from "./engine.mjs";
import { artifactBonus } from "../bonuses/sailing.mjs";
import { pristineBon } from "../bonuses/ninja.mjs";
import { votingBonus } from "../bonuses/summoning.mjs";
import { eventShopOwned } from "../bonuses/misc.mjs";
import { companion } from "../bonuses/companions.mjs";

const num = (x) => Number(x) || 0;

export const DISPLAY = {
  goldRelic: { label: "Gold Relic artifact × days-since-sample", where: "Sailing → Gold Relic", how: "+2%/day (×40) × the artifact tier — samples reset it." },
  divineKnight: { label: "Divine Knight × orb kills", where: "W3 talent × Death Note", how: "getbonus2(1,178) × log(kills) — unread." },
  skillMastery: { label: "Skill Mastery + Jade Emporium", where: "Rift + W6 Emporium", how: "RiftSkillETC(3) + PristineBon(15) — unread." },
  vote: { label: "Bonus Ballot (vote 11)", where: "W2 Ballot", how: "VotingBonusz(11) — active vote only." },
  event: { label: "Winter event shop", where: "Event shop", how: "2 × OptLacc[323] × EventShopOwned(4)." },
  companion: { label: "Companion (17)", where: "Companions", how: "OptLacc[354] × Companions(17)." },
  compass: { label: "Windwalker compass (43)", where: "W5 Compass", how: "OptLacc[364] × CompassBonus(43) — unread." },
  labDivinityMulti: { label: "Wired In × Harriep divinity (×2/×3/×6)", where: "W4 Lab + W3 Divinity", how: "per-char + AFK-in-lab + Harriep major link — unread, held at ×1 (lower bound)." },
};

/** Build a `1 + coeff*bonus/100` multiplicative factor term, tolerant of a missing evaluator. */
function factor(ctx, id, key, label, compute) {
  try {
    const { value, status, note } = compute();
    return T(id, key, "mul", value, status ?? "computed", `${label}: ${note ?? ""}`);
  } catch (e) {
    ctx.unknown(`${key} — ${String(e.message || e).slice(0, 40)}; factor held at 1 (lower bound)`);
    return T(id, key, "mul", 1, "unknown", `${label}: unread -> ×1 (lower bound)`);
  }
}

export const printerOutput = {
  name: "printerOutput",
  label: "Printer Output Multi",
  display: DISPLAY,
  terms(ctx) {
    const opt = sel.optionsAccount(ctx.s);
    const terms = [];

    // 1. Gold Relic × days. ArtifactBonus(4) not in SAILING_ARTIFACT -> tier scaling omitted (lower bound).
    terms.push(factor(ctx, "goldRelic", "1+OptLacc[125]*(2+ArtifactBonus(4))/100", DISPLAY.goldRelic.label, () => {
      const days = num(opt[125]);
      let arti = 0, note = `days=${days}, +2%/day`;
      try { arti = num(artifactBonus(ctx, 4).value); } catch { ctx.unknown("Printer: Sailing ArtifactBonus(4) [Gold Relic] not in SAILING_ARTIFACT -> tier scaling omitted (lower bound)"); note += " (artifact tier scaling unread)"; }
      return { value: 1 + days * (2 + arti) / 100, status: arti ? "computed" : "partial", note };
    }));

    // 2. Divine Knight × orb kills — no evaluator (getbonus2 / remembrance kills).
    terms.push(factor(ctx, "divineKnight", "1+getbonus2(1,178)*getLOG(OptLacc[138])/100", DISPLAY.divineKnight.label, () => { throw new Error("getbonus2(1,178) unread"); }));

    // 3. Skill Mastery (Rift) + Jade Emporium pristine — both unread here.
    terms.push(factor(ctx, "skillMastery", "1+(RiftSkillETC(3)+PristineBon(15))/100", DISPLAY.skillMastery.label, () => {
      let pristine = 0, ok = false;
      try { pristine = num(pristineBon(ctx, 15).value); ok = true; } catch { /* 15 not verified */ }
      ctx.unknown("Printer: RiftSkillETC(3) skill-mastery unread" + (ok ? "" : " + PristineBon(15) unverified") + " -> lower bound");
      return { value: 1 + pristine / 100, status: "partial", note: `RiftSkillETC(3) unread; PristineBon(15)=${pristine}` };
    }));

    // 4. Bonus Ballot vote 11.
    terms.push(factor(ctx, "vote", "1+VotingBonusz(11)/100", DISPLAY.vote.label, () => {
      const f = votingBonus(ctx, 11);
      return { value: 1 + num(f.value) / 100, status: f.status ?? "computed", note: f.note };
    }));

    // 5. Winter event shop.
    terms.push(factor(ctx, "event", "1+2*OptLacc[323]*EventShopOwned(4)/100", DISPLAY.event.label, () => {
      const o = num(opt[323]); const es = eventShopOwned(ctx, 4);
      if (es === null) { ctx.unknown("Printer: EventShopOwned(4) unrecoverable -> lower bound"); return { value: 1, status: "unknown", note: "event shop flag unknown" }; }
      return { value: 1 + 2 * o * es / 100, status: "computed", note: `OptLacc[323]=${o}, owned=${es}` };
    }));

    // 6. Companion 17.
    terms.push(factor(ctx, "companion", "1+OptLacc[354]*Companions(17)/100", DISPLAY.companion.label, () => {
      const o = num(opt[354]); const c = companion(ctx, 17);
      if (c.owned === null) { ctx.unknown("Printer: Companions(17) ownership unknown (_comp doc) -> lower bound"); return { value: 1, status: "unknown", note: "companion ownership unknown" }; }
      return { value: 1 + o * c.value / 100, status: "computed", note: `OptLacc[354]=${o}, Companions(17)=${c.value}` };
    }));

    // 7. Compass 43 — no evaluator.
    terms.push(factor(ctx, "compass", "1+OptLacc[364]*CompassBonus(43)/100", DISPLAY.compass.label, () => { throw new Error("CompassBonus(43) unread"); }));

    // Wrapper multiplier (×1/2/3/6) — per-char + runtime + Harriep divinity, held at ×1.
    ctx.unknown("Printer: ExtraPrinting ×{1,2,3,6} wrapper (Wired-In lab chip + AFK-in-lab + Harriep Divinity major link) is per-char/runtime — held at ×1 (lower bound; this is usually the biggest lever)");
    terms.push(T("labDivinityMulti", "ExtraPrinting ×{1,2,3,6}", "mul", 1, "unknown", `${DISPLAY.labDivinityMulti.label}: held at ×1 (lower bound)`));

    return terms;
  },
};
