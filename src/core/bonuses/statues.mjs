/* bonuses/statues.mjs — x._customBlock_ArbitraryCode("StatueBonusGiven"+index), the per-statue
 * bonus and its shared multiplier chain, transcribed verbatim from N.js:5334-5342 (see
 * gamedata-statues.mjs header for the full annotated formula). Reused by the W1 statue entity,
 * the statueMulti recipe, and the anvil-speed recipe's StatueBonusGiven11 term.
 *
 *   level = StatueLevels[index][0];  statuearbDN = level * bonusPerLevel;
 *   // per-cluster talent (mutually-exclusive if/else over index):
 *   {0,2,7,8}:  x(1+GetTalentNumber(1,112)/100) if idx!=7;  x(1+GetTalentNumber(1,127)/100) if idx!=8
 *   {1,9,11,14}:x(1+GetTalentNumber(1,292)/100) if idx!=14; x(1+GetTalentNumber(1,307)/100) if idx!=9
 *   {6,10,12,13}:x(1+GetTalentNumber(1,487)/100) if idx!=13; x(1+GetTalentNumber(1,472)/100) if idx!=12
 *   {3,5,17}:   x(1+GetTalentNumber(1,37)/100)
 *   if StatueG[idx]>=2: x max(1+(100+Sailing("ArtifactBonus",30,0))/100, 1)      // ONYX (Onyx Lantern)
 *   if StatueG[idx]>=3: x max(1+(50+Thingies("ZenithMarketBonus",0,0))/100, 1)   // ZENITH
 *   if idx in {0,1,2,6}: x max(1+Summoning("VaultUpgBonus",25,0)/100, 1)         // upgrade vault
 *   if idx!=29: x max(1+ArbitraryCode("StatueBonusGiven29")/100, 1)              // DRAGON statue
 *   return statuearbDN
 *     * (1 + 0.3*Summoning("EventShopOwned",19,0))       // event-shop statue boost (universal)
 *     * max(1 + getbonus2(1,56,-1)/100, 1)               // Voodoo Statufication talent (universal)
 *     * (1 + Summoning2("MeritocBonusz",26,0)/100);      // meritocracy vote (universal)
 *
 * Statue LEVEL is account-wide effective: the client reads the active character's StatueLevels,
 * but statues are shared at the best-of-account level once Statue Man is unlocked, so the entity
 * takes the max across characters (matches IdleonToolbox). getbonus2(1,56,-1) (Voodoo) sums a
 * talent across every character and is not modelled — it degrades to neutral (a lower bound). */

import { sel } from "../savemap.mjs";
import { STATUE_INFO } from "../../gamedata/gamedata-statues.mjs";
import { getTalentNumber } from "./talents.mjs";
import { artifactBonus } from "./sailing.mjs";
import { vaultUpgBonus, meritocBonusz } from "./summoning.mjs";
import { eventShopOwned } from "./misc.mjs";
import { zenithMarketBonus as zenithBonusFrag } from "./zenith.mjs";

const num = (x) => Number(x) || 0;
const safe = (ctx, fn, note) => {
  try { const r = fn(); if (r === null) return { value: 0, status: "unknown", note: `${note}: no active char` };
    return typeof r === "number" ? { value: r, status: "computed" } : { value: num(r.value), status: r.status ?? "computed", note: r.note }; }
  catch (e) { ctx.unknown(`statues: ${note} -> ${e.message}`); return { value: 0, status: "unknown", note: e.message }; }
};

/** Effective account-wide statue level for statue `idx` = max over characters of
 *  StatueLevels_N[idx][0]. */
export function statueLevel(s, idx) {
  let best = 0;
  for (const ci of s.charIdxs) {
    const rows = sel.statueLevelsOf(s, ci);
    best = Math.max(best, num((rows[idx] ?? [])[0]));
  }
  return best;
}
/** StatueG[idx] tier: 0 base, >=1 gold, >=2 onyx, >=3 zenith. */
export const statueTier = (s, idx) => num(sel.statueTiers(s)[idx]);

/** The per-cluster talent multipliers applied to statue `idx` (returns {factor, parts}). */
function clusterTalentFactor(ctx, idx) {
  const T = (id) => { const f = safe(ctx, () => getTalentNumber(ctx, id), `GetTalentNumber(1,${id})`); return f; };
  const parts = [];
  let factor = 1;
  const apply = (id) => { const f = T(id); const m = Math.max(1 + f.value / 100, 1); factor *= m; parts.push({ label: `Talent ${id}`, value: m, note: f.note }); };
  if ([0, 2, 7, 8].includes(idx)) { if (idx !== 7) apply(112); if (idx !== 8) apply(127); }
  else if ([1, 9, 11, 14].includes(idx)) { if (idx !== 14) apply(292); if (idx !== 9) apply(307); }
  else if ([6, 10, 12, 13].includes(idx)) { if (idx !== 13) apply(487); if (idx !== 12) apply(472); }
  else if ([3, 5, 17].includes(idx)) { apply(37); }
  return { factor, parts };
}

/** getbonus2(1,56,-1) — Voodoo Statufication, summed across all characters. Not modelled;
 *  neutral (lower bound). Exposed so the recipe can name it. */
export function voodooStatufication(ctx) {
  ctx.unknown('statues: getbonus2(1,56,-1) Voodoo Statufication sums talent 56 across every character — not modelled; neutral (lower bound)');
  return { value: 0, status: "unknown", note: "Voodoo Statufication (getbonus2 1,56,-1) not modelled" };
}
/** Thingies("ZenithMarketBonus",b,0) — now DECODED via bonuses/zenith.mjs (gamedata-w7-zenith.mjs).
 *  Statue zenith tier uses b=0 (TRUE_ZEN, "}x higher bonuses from Zenith Statues"). */
export function zenithMarketBonus(ctx, b = 0) {
  return zenithBonusFrag(ctx, b);
}

/**
 * StatueBonusGiven(idx) — the full statue bonus (level x bonusPerLevel x chain). Returns a
 * fragment {value, status, note, parts}. `_depth` guards the DRAGON (29) self-reference.
 */
export function statueBonusGiven(ctx, idx, _depth = 0) {
  const info = STATUE_INFO[idx];
  if (!info) throw new Error(`StatueBonusGiven${idx}: no STATUE_INFO row`);
  const level = statueLevel(ctx.s, idx);
  let v = level * num(info.bonusPerLevel);
  const parts = [{ label: "level x bonusPerLevel", value: v, note: `${level} x ${info.bonusPerLevel}` }];
  let anyUnknown = false;

  const cluster = clusterTalentFactor(ctx, idx);
  v *= cluster.factor;
  if (cluster.parts.length) parts.push({ label: "cluster talent", value: cluster.factor, sub: cluster.parts });

  const tier = statueTier(ctx.s, idx);
  if (tier >= 2) {
    const art = safe(ctx, () => artifactBonus(ctx, 30), 'Sailing("ArtifactBonus",30,0)');
    if (art.status !== "computed") anyUnknown = true;
    const m = Math.max(1 + (100 + art.value) / 100, 1);
    v *= m; parts.push({ label: "onyx (Onyx Lantern)", value: m, note: art.note });
  }
  if (tier >= 3) {
    const zm = zenithMarketBonus(ctx);
    if (zm.status !== "computed") anyUnknown = true;
    const m = Math.max(1 + (50 + zm.value) / 100, 1);
    v *= m; parts.push({ label: "zenith", value: m, note: zm.note });
  }
  if ([0, 1, 2, 6].includes(idx)) {
    const vault = safe(ctx, () => vaultUpgBonus(ctx, 25), 'Summoning("VaultUpgBonus",25,0)');
    if (vault.status !== "computed") anyUnknown = true;
    const m = Math.max(1 + vault.value / 100, 1);
    v *= m; parts.push({ label: "upgrade vault", value: m, note: vault.note });
  }
  if (idx !== 29) {
    const dragon = _depth > 0 ? { value: 0, status: "computed" } : safe(ctx, () => statueBonusGiven(ctx, 29, _depth + 1), "StatueBonusGiven29 (Dragon)");
    const m = Math.max(1 + dragon.value / 100, 1);
    v *= m; parts.push({ label: "Dragon statue", value: m, note: `StatueBonusGiven29 = ${dragon.value.toFixed(2)}` });
  }
  // universal tail
  const shop = safe(ctx, () => eventShopOwned(ctx, 19), 'Summoning("EventShopOwned",19,0)');
  const voodoo = voodooStatufication(ctx); anyUnknown = true;
  const merit = safe(ctx, () => meritocBonusz(ctx, 26), 'Summoning2("MeritocBonusz",26,0)');
  if (shop.status !== "computed" || merit.status !== "computed") anyUnknown = true;
  const tailShop = 1 + 0.3 * shop.value;
  const tailVoodoo = Math.max(1 + voodoo.value / 100, 1);
  const tailMerit = 1 + merit.value / 100;
  v *= tailShop * tailVoodoo * tailMerit;
  parts.push({ label: "event shop", value: tailShop, note: shop.note });
  parts.push({ label: "Voodoo Statufication", value: tailVoodoo, note: voodoo.note });
  parts.push({ label: "meritocracy", value: tailMerit, note: merit.note });

  return {
    value: v,
    status: anyUnknown ? "partial" : "computed",
    note: `${info.name}: ${v.toFixed(2)} (lv ${level})`,
    parts,
  };
}
