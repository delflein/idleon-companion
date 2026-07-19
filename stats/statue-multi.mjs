/* stats/statue-multi.mjs — recipe `statueMulti`: the shared multiplier chain that scales EVERY
 * statue's base bonus (level x bonusPerLevel), from x._customBlock_ArbitraryCode("StatueBonusGiven"
 * +idx), N.js:5334-5342 (see bonuses/statues.mjs / gamedata-statues.mjs for the verbatim formula).
 *
 * The client's chain has 8 multiplier SOURCES. Four are UNIVERSAL — applied identically to every
 * statue — and form the headline multiplier this recipe reports:
 *   - event shop   1 + 0.3*Summoning("EventShopOwned",19,0)
 *   - Voodoo Statufication  max(1 + getbonus2(1,56,-1)/100, 1)     (not modelled -> neutral)
 *   - Dragon statue  max(1 + ArbitraryCode("StatueBonusGiven29")/100, 1)   (all statues but #29)
 *   - meritocracy   1 + Summoning2("MeritocBonusz",26,0)/100
 * Four are CONDITIONAL — they apply only to qualifying statues (a talent cluster, onyx/zenith tier,
 * or the vault-eligible statues {0,1,2,6}) — so they are shown for the drill-down but EXCLUDED from
 * the headline (a statue only gets the ones it qualifies for):
 *   - per-cluster talent, onyx (Onyx Lantern artifact), zenith (+market), upgrade vault.
 *
 * The headline value is therefore the multiplier that lands on ANY statue; per-statue totals
 * (base x this x the conditional factors it qualifies for) live in the W1 statue entity. */

import { T, term, evaluate } from "./engine.mjs";
import { getTalentNumber } from "../bonuses/talents.mjs";
import { artifactBonus } from "../bonuses/sailing.mjs";
import { vaultUpgBonus, meritocBonusz } from "../bonuses/summoning.mjs";
import { eventShopOwned } from "../bonuses/misc.mjs";
import { statueBonusGiven, voodooStatufication, zenithMarketBonus, statueTier } from "../bonuses/statues.mjs";

const num = (x) => Number(x) || 0;
function safe(ctx, fn, note) {
  try { const r = fn(); if (r === null) return null; return typeof r === "number" ? { value: r } : r; }
  catch (e) { ctx.unknown(`statueMulti: ${note} -> ${e.message}`); return { value: 0, status: "unknown", note: e.message }; }
}

export const DISPLAY = {
  clusterTalent: { label: "Talent: per-statue cluster boost", where: "Character talents (per statue cluster)", flag: true, how: "Best-case cluster talent (112/127/292/307/487/472/37); per-statue & per-character — NOT in the headline." },
  voodoo: { label: "Talent: Voodoo Statufication", where: "Character talents (account-summed)", how: "getbonus2(1,56,-1) across all characters — not modelled (neutral)." },
  onyx: { label: "Onyx: Onyx Lantern artifact", where: "Sailing artifact + Onyx tier", flag: true, how: "x(1+(100+ArtifactBonus(30))/100) — only onyx+ statues; not in the headline." },
  zenith: { label: "Zenith: market bonus", where: "Zenith tier + Zenith Market", flag: true, how: "x(1+(50+ZenithMarketBonus)/100) — only zenith statues; not in the headline." },
  dragon: { label: "Dragon statue", where: "Dragon (statue 29)", how: "x(1+StatueBonusGiven29/100) on every statue but the Dragon itself." },
  vault: { label: "Upgrade vault (statues 0/1/2/6)", where: "W6 Summoning → Upgrade Vault", flag: true, how: "VaultUpgBonus(25) — only the four vault-eligible statues; not in the headline." },
  eventShop: { label: "Event shop: statue boost", where: "Limited-time event shop", how: "x(1+0.3*EventShopOwned(19)) — universal." },
  meritoc: { label: "Meritocracy vote", where: "W6 Ninja → Meritocracy", how: "x(1+MeritocBonusz(26)/100) — universal." },
};

export const statueMulti = {
  name: "statueMulti",
  label: "Statue Bonus Multiplier",
  display: DISPLAY,
  activeCharSensitive: () => true,   // cluster talents read the active character

  // Headline = the UNIVERSAL multiplier every statue receives. Conditional terms are present in
  // the list (tracked as metrics) but excluded here.
  combine: ({ terms }) => {
    const v = (id) => { const t = terms.find((x) => x.id === id); return t ? num(t.value) : 1; };
    return v("eventShop") * v("voodoo") * v("dragon") * v("meritoc");
  },

  terms(ctx) {
    const ci = ctx.activeChar;
    // per-cluster talent: best-case factor across the cluster talents for the active char
    let clusterVal = 1, clusterNote = "no active character";
    if (ci != null) {
      let best = 1;
      for (const id of [112, 127, 292, 307, 487, 472, 37]) {
        const f = safe(ctx, () => getTalentNumber(ctx, id), `talent ${id}`);
        best = Math.max(best, Math.max(1 + num(f?.value) / 100, 1));
      }
      clusterVal = best; clusterNote = `best-case cluster talent x${best.toFixed(3)} (varies per statue cluster)`;
    }
    // onyx / zenith potential factors (best-case, from the account's tiers)
    const anyOnyx = STATUE_TIERS(ctx).some((t) => t >= 2);
    const anyZenith = STATUE_TIERS(ctx).some((t) => t >= 3);
    const art = safe(ctx, () => artifactBonus(ctx, 30), "ArtifactBonus(30)");
    const onyxVal = anyOnyx ? Math.max(1 + (100 + num(art?.value)) / 100, 1) : 1;
    const zm = zenithMarketBonus(ctx);
    const zenithVal = anyZenith ? Math.max(1 + (50 + num(zm.value)) / 100, 1) : 1;
    const vault = safe(ctx, () => vaultUpgBonus(ctx, 25), "VaultUpgBonus(25)");
    const vaultVal = Math.max(1 + num(vault?.value) / 100, 1);

    const dragon = safe(ctx, () => statueBonusGiven(ctx, 29), "StatueBonusGiven29");
    const dragonVal = Math.max(1 + num(dragon?.value) / 100, 1);
    const shop = safe(ctx, () => eventShopOwned(ctx, 19), "EventShopOwned(19)");
    const shopVal = 1 + 0.3 * num(shop?.value);
    const voodoo = voodooStatufication(ctx);
    const voodooVal = Math.max(1 + num(voodoo.value) / 100, 1);
    const merit = safe(ctx, () => meritocBonusz(ctx, 26), "MeritocBonusz(26)");
    const meritVal = 1 + num(merit?.value) / 100;

    return [
      // conditional (not in headline)
      ci == null
        ? T("clusterTalent", "GetTalentNumber(cluster)", "mul", 1, "per-char", "resolved per character")
        : T("clusterTalent", "GetTalentNumber(cluster)", "mul", clusterVal, "partial", clusterNote),
      T("onyx", 'max(1+(100+Sailing("ArtifactBonus",30,0))/100,1)', "mul", onyxVal, art?.status === "computed" || !anyOnyx ? "computed" : "partial", anyOnyx ? `onyx factor ${onyxVal.toFixed(3)} (${art?.note ?? ""})` : "no onyx-tier statue -> neutral"),
      T("zenith", 'max(1+(50+ZenithMarketBonus(0))/100,1)', "mul", zenithVal, (anyZenith && zm.status !== "computed") ? "partial" : "computed", anyZenith ? `zenith factor ${zenithVal.toFixed(3)} (${zm.note})` : "no zenith-tier statue -> neutral"),
      T("vault", 'max(1+VaultUpgBonus(25)/100,1)', "mul", vaultVal, vault?.status ?? "computed", `vault factor ${vaultVal.toFixed(3)} (statues 0/1/2/6 only)`),
      // universal (headline)
      term("eventShop", "1+0.3*EventShopOwned(19)", "mul", { value: shopVal, status: shop?.status ?? "computed", note: `event shop x${shopVal.toFixed(3)}` }),
      term("voodoo", "max(1+getbonus2(1,56,-1)/100,1)", "mul", { value: voodooVal, status: voodoo.status, note: voodoo.note }),
      term("dragon", "max(1+StatueBonusGiven29/100,1)", "mul", { value: dragonVal, status: dragon?.status ?? "computed", note: `Dragon x${dragonVal.toFixed(3)} (StatueBonusGiven29=${num(dragon?.value).toFixed(1)})` }),
      term("meritoc", "1+MeritocBonusz(26)/100", "mul", { value: meritVal, status: merit?.status ?? "computed", note: `meritocracy x${meritVal.toFixed(3)}` }),
    ];
  },
};

/** All statue tiers (StatueG), read once. */
function STATUE_TIERS(ctx) {
  const arr = [];
  for (let i = 0; i < 32; i++) arr.push(statueTier(ctx.s, i));
  return arr;
}

export const totalStatueMulti = (s, opts = {}) => evaluate(statueMulti, s, opts);
