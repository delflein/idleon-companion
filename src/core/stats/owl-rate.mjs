/* stats/owl-rate.mjs — recipe `owlRate`: Orion the Owl's feather generation rate (feathers/sec),
 * m._customBlock_Summoning("OwlFeatherRate",0,0), N.js:18163-18164. Account-wide (everything reads
 * OptionsListAccount). Verbatim:
 *
 *   rate = (1 + 9*OwlMegafeather(0))                       // mega-tier 1: 10x multiplicative
 *        * (1 + Holes2("Fountain_BonTOT",0,18)/100)        // Well (Cavern) fountain
 *        * (1 + Summoning("VaultUpgBonus",21,0)/100)       // upgrade vault
 *        * (1 + Summoning2("MeritocBonusz",12,0)/100)      // meritocracy vote
 *        * (1 + Holes("GambitBonuses",8,0)/100)            // gambit
 *        * ( opt[254] + (5*opt[259] + (2*OwlMegafeather(4)*opt[257] + 4*OwlMegafeather(4)*opt[261])) )
 *        * (1 + 5*opt[256]/100)                            // Feather Restart LV
 *        * pow(3 + 2*OwlMegafeather(6), opt[258])          // Shiny Feathers LV exponent
 *        * (1 + opt[264]*opt[260]/100);                    // shiny feather count arm
 *   OwlMegafeather(i) = opt[262] > i ? (i===9 ? opt[262]-9 : 1) : 0.
 *
 * The feather-generation factor (opt[254] + ...) is a raw MULTIPLIER, not a 1+%/100 arm; the shiny
 * exponent likewise. Fountain / meritocracy(12) / gambit have no verified evaluator yet and degrade
 * to their neutral (x1) — an honest lower bound. Owl's DERIVED global bonuses (Class XP/DMG/Skill
 * XP/Drop/All Stats) feed the Account page, not this rate. */

import { sel } from "../savemap.mjs";
import { T, term, evaluate } from "./engine.mjs";
import { vaultUpgBonus, meritocBonusz } from "../bonuses/summoning.mjs";

const num = (x) => Number(x) || 0;
function safe(ctx, fn, note) {
  try { const r = fn(); if (r === null) return null; return typeof r === "number" ? { value: r } : r; }
  catch (e) { ctx.unknown(`owlRate: ${note} -> ${e.message}`); return { value: 0, status: "unknown", note: e.message }; }
}
/** OwlMegafeather(i) from the save. */
function mega(s, i) { const t = sel.owlMegaTier(s); return t > i ? (i === 9 ? t - 9 : 1) : 0; }

export const DISPLAY = {
  megaTier1: { label: "Mega-feather tier 1 (10x)", where: "Owl → mega feathers", how: "x(1 + 9*OwlMegafeather(0)); the first mega tier multiplies feathers 10x." },
  fountain: { label: "Cavern: Well fountain", where: "The Cavern → Well", how: "Holes2(Fountain_BonTOT,0,18) — not decoded (neutral)." },
  vault: { label: "Upgrade vault: feather rate", where: "W6 Summoning → Upgrade Vault", how: "VaultUpgBonus(21)." },
  meritoc: { label: "Meritocracy vote", where: "W6 Ninja → Meritocracy", how: "MeritocBonusz(12) — value not verified (neutral)." },
  gambit: { label: "Gambit: feather rate", where: "Gambit", how: "Holes(GambitBonuses,8) — not decoded (neutral)." },
  featherGen: { label: "Feather generation (upgrades)", where: "Owl → upgrades", how: "Feather Generation + Super Feather Production + mega-5 arms (opt[254/259/257/261])." },
  restart: { label: "Feather Multiplier (opt[256])", where: "Owl → upgrades", how: "x(1 + 5*opt[256]/100)." },
  shinyExp: { label: "Feather Restart exponent (opt[258])", where: "Owl → upgrades", how: "pow(3 + 2*mega6, opt[258])." },
  shinyCount: { label: "Shiny feather count arm", where: "Owl → shiny feathers", how: "x(1 + shinyCount*opt[260]/100)." },
};

export const owlRate = {
  name: "owlRate",
  label: "Owl Feather Rate",
  display: DISPLAY,
  // pure multiplicative chain -> default combine (1 + 0/100)*mul is exactly the product.

  terms(ctx) {
    const s = ctx.s;
    const o = sel.optionsAccount(s);
    const g = (i) => num(o[i]);
    const m4 = mega(s, 4), m6 = mega(s, 6);

    const megaTier1 = 1 + 9 * mega(s, 0);
    const featherGen = g(254) + (5 * g(259) + (2 * m4 * g(257) + 4 * m4 * g(261)));
    const restart = 1 + 5 * g(256) / 100;
    const shinyExp = Math.pow(3 + 2 * m6, g(258));
    const shinyCount = 1 + g(264) * g(260) / 100;

    const vault = safe(ctx, () => vaultUpgBonus(ctx, 21), "VaultUpgBonus(21)");
    const merit = safe(ctx, () => meritocBonusz(ctx, 12), "MeritocBonusz(12)");
    const fountain = (() => { ctx.unknown('owlRate: Holes2("Fountain_BonTOT",0,18) Well fountain not decoded -> neutral'); return { value: 0, status: "unknown", note: "Well fountain not decoded" }; })();
    const gambit = (() => { ctx.unknown('owlRate: Holes("GambitBonuses",8,0) not decoded -> neutral'); return { value: 0, status: "unknown", note: "gambit not decoded" }; })();

    return [
      T("megaTier1", "1+9*OwlMegafeather(0)", "mul", megaTier1, "computed", `mega tier count ${sel.owlMegaTier(s)} -> x${megaTier1}`),
      term("fountain", 'Holes2("Fountain_BonTOT",0,18)', "mul", { value: 1 + fountain.value / 100, status: fountain.status, note: fountain.note }),
      term("vault", 'Summoning("VaultUpgBonus",21,0)', "mul", { value: 1 + num(vault?.value) / 100, status: vault?.status ?? "computed", note: `vault ${num(vault?.value).toFixed(1)}%` }),
      term("meritoc", 'Summoning2("MeritocBonusz",12,0)', "mul", { value: 1 + num(merit?.value) / 100, status: merit?.status ?? "computed", note: merit?.note ?? "" }),
      term("gambit", 'Holes("GambitBonuses",8,0)', "mul", { value: 1 + gambit.value / 100, status: gambit.status, note: gambit.note }),
      T("featherGen", "opt[254]+5*opt[259]+2*mega4*opt[257]+4*mega4*opt[261]", "mul", featherGen, "computed", `feather-gen factor ${featherGen} (FeatherGen ${g(254)}, SuperProd ${g(259)})`),
      T("restart", "1+5*opt[256]/100", "mul", restart, "computed", `Feather Restart ${g(256)} -> x${restart.toFixed(3)}`),
      T("shinyExp", "pow(3+2*mega6,opt[258])", "mul", shinyExp, "computed", `pow(${3 + 2 * m6}, ${g(258)}) = ${shinyExp.toExponential(2)}`),
      T("shinyCount", "1+opt[264]*opt[260]/100", "mul", shinyCount, "computed", `shiny ${g(264)} x opt260 ${g(260)} -> x${shinyCount.toFixed(3)}`),
    ];
  },
};

export const totalOwlRate = (s, opts = {}) => evaluate(owlRate, s, opts);
