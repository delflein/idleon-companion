/* stats/villager-exp.mjs — recipe `villagerExp`, "Villager EXP/hr".
 *
 * THE EXPRESSION, verbatim from Holes("VillagerExpPerHour",b,0), N.js:18227-18229 (fully
 * transcribed in gamedata-w5-hole.mjs section 2 — 29 individual bonus-contributing calls). `b` is
 * the villager index (0=Explorer … 4=Librarian); the recipe evaluates one villager, chosen via
 * ctx.args.villager (default 0, the Explorer that unlocks caverns). The entity reuses the same
 * function to fill all 5.
 *
 * All terms are kind "mul"; empty additive pool -> the engine's product is the EXP/hr. Honesty:
 * The Hole is a second-Sailing-sized system whose deep sub-systems (compass, monuments, cosmo
 * majiks, measurements, fountain, bell, studies, engineer blueprints) are NOT modeled — those
 * factors contribute their neutral 1 and flag ctx.unknown, so the value is a LOWER BOUND.
 *
 * Wired/computed: Opal-Dividends base, opals invested (Holes[3][b]), the Holes[23][b] raw anomaly,
 * Companions(13), StatueBonus(28)?no, JarCollectible×6 (from save+gamedata weights), EventShop(6),
 * bundle bun_u, ArcadeBonus(38), CardLv("caveB"), WinBonus(21), VaultUpgBonus(73). */

import { T } from "./engine.mjs";
import { sel } from "../savemap.mjs";
import { companion } from "../bonuses/companions.mjs";
import { eventShopOwned } from "../bonuses/misc.mjs";
import { arcadeBonus } from "../bonuses/arcade.mjs";
import { cardLv } from "../bonuses/cards.mjs";
import { winBonus, vaultUpgBonus } from "../bonuses/summoning.mjs";
import { JAR_COLLECTIBLES } from "../gamedata-w5-hole.mjs";

const num = (x) => Number(x) || 0;
const JAR_EXP_INDICES = [4, 10, 12, 22, 29, 35];   // the 6 "All villagers gain +% EXP" collectibles

export const DISPLAY = {
  base: { label: "EXP/hr base (Opal Dividends)", where: "W5 Cavern → Engineer blueprint 0", how: "100/opal, +25 once Opal Dividends is built." },
  opals: { label: "Opals invested", where: "W5 Cavern → villager", how: "the multiplicative base — invest opals via the blue button." },
  rawTerm: { label: "Per-villager bonus (Holes[23])", where: "W5 Cavern", how: "RAW additive term (×(1+Holes[23][b]), NOT /100 — verbatim anomaly)." },
  companion13: { label: "Companion (villager EXP)", where: "Companions", how: "×(1+2·Companions(13))." },
  jars: { label: "Jar collectibles (×6)", where: "W5 Cavern → Jars", how: "6 'All villagers +% EXP' collectibles." },
  eventShop6: { label: "Event shop (villager EXP)", where: "W6 Summoning event shop", how: "EventShopOwned(6)." },
  bundle: { label: "Bundle bun_u", where: "Gem shop bundle", how: "+50% if received." },
  arcade38: { label: "Arcade (villager EXP)", where: "Arcade Gold Ball shop", how: "ArcadeBonus(38)." },
  cardCaveB: { label: "caveB EXP card", where: "W5 card", how: "+4%/level, cap +50%." },
  summWin21: { label: "Summoning winner (villager EXP)", where: "W6 Summoning", how: "WinBonus(21)." },
  vault73: { label: "Upgrade Vault (villager EXP)", where: "W6 Summoning → Vault", how: "VaultUpgBonus(73)." },
  deep: { label: "Unmodeled Cavern systems", where: "compass, monuments, cosmo, measurements, fountain, bell, blueprints…", how: "deep Hole sub-systems not modeled -> lower bound." },
};

/** Build the term list for one villager b. */
export function villagerExpTerms(ctx, b) {
  const out = [];
  const holes = sel.holes(ctx.s);

  // HoleozDxp (b==0: pow(1.5,OLA[355]) while CavernsOwned<13; b==2: 1+Fountain/100; else 1)
  const villager0Lv = num((sel.villagerLevels(ctx.s))[0]);
  const cavernsOwned = Math.min(18, villager0Lv);
  if (b === 0 && cavernsOwned < 13) {
    const ola355 = num((ctx.s.get("OptLacc") ?? [])[355]);
    out.push(T("holeozDxp", "pow(1.5,OptionsListAccount[355])", "mul", Math.max(1, Math.pow(1.5, ola355)), "computed", `OLA[355]=${ola355}, cavernsOwned ${cavernsOwned}<13`));
  } else if (b === 2) {
    ctx.unknown("VillagerExp(2): Fountain_BonTOT(0,14) not modeled -> HoleozDxp floored 1");
    out.push(T("holeozDxp", "1+Holes2(Fountain_BonTOT,0,14)/100", "mul", 1, "unknown", "fountain not modeled -> x1"));
  }

  // (100 + B_UPG(0,25)) — Opal Dividends blueprint (Holes[13][0]) adds +25 (HolesBuildings[0], N.js:23616)
  const opalDividends = num((holes[13] ?? [])[0]) > 0 ? 25 : 0;
  out.push(T("base", "100+Holes(B_UPG,0,25)", "mul", 100 + opalDividends, "computed", `base 100${opalDividends ? " +25 Opal Dividends built" : ""}`));

  // middle bracket, max(1, product of 9 factors) — most are deep systems -> unknown
  unkMul(ctx, out, "compass59", 'Windwalker("CompassBonus",59,0)');
  unkMul(ctx, out, "legend12", 'Thingies("LegendPTS_bonus",12,0)');
  unkMul(ctx, out, "pristine21", 'Ninja("PristineBon",21,0)');
  // (1 + 2*Companions(13))
  mulTerm(ctx, out, "companion13", "1+2*Companions(13)", () => {
    const c = companion(ctx, 13);
    if (c.owned === null) { ctx.unknown("Companions(13) ownership unknown -> x1"); return { value: 1, status: "unknown", note: "ownership unknown" }; }
    return { value: 1 + 2 * num(c.value), note: c.owned ? "owned" : "not owned" };
  });
  unkMul(ctx, out, "statue28", 'ArbitraryCode("StatueBonusGiven28")');
  // jar collectibles ×6: (1 + sum(Holes[24][idx]*weight)/100) — legend29 multiplier floored
  mulTerm(ctx, out, "jars", "1+ΣJarCollectibleBonus(4,10,12,22,29,35)/100", () => {
    const lv = holes[24] ?? [];
    let sum = 0;
    for (const idx of JAR_EXP_INDICES) sum += num(lv[idx]) * num(JAR_COLLECTIBLES[idx]?.weight);
    ctx.unknown("Jar collectibles: LegendPTS_bonus(29) multiplier unread -> floored (lower bound)");
    return { value: 1 + sum / 100, status: "partial", note: `Σ level×weight = ${sum} (excl. legend29 multi)` };
  });
  // (1 + 25*EventShopOwned(6)/100)
  mulTerm(ctx, out, "eventShop6", 'Summoning("EventShopOwned",6,0)', () => {
    const v = eventShopOwned(ctx, 6);
    if (v == null) { ctx.unknown("EventShopOwned(6) unknown -> x1"); return { value: 1, status: "unknown", note: "unknown" }; }
    return { value: 1 + 25 * num(v) / 100, note: `owned ${v}` };
  });
  unkMul(ctx, out, "tome1", 'Thingies("LoreEpiBon",1,0)');
  // (1 + 50*BundlesReceived.bun_u/100)
  mulTerm(ctx, out, "bundle", "1+50*BundlesReceived.bun_u/100", () => {
    const bun = num((ctx.s.get("BundlesReceived") ?? {}).bun_u);
    return { value: 1 + 50 * bun / 100, note: `bun_u=${bun}` };
  });

  // Holes[3][b] — opals invested (multiplicative base)
  const opals = num((sel.villagerOpals(ctx.s))[b]);
  out.push(T("opals", "Holes[3][b]", "mul", Math.max(1, opals), "computed", `villager ${b} opals invested = ${opals}${opals === 0 ? " (floored to 1)" : ""}`));

  // (1 + Holes[23][b]) — RAW anomaly (not /100)
  const raw23 = num((sel.villagerRawTerm(ctx.s))[b]);
  out.push(T("rawTerm", "1+Holes[23][b]", "mul", 1 + raw23, "computed", `Holes[23][${b}]=${raw23} -> ×${1 + raw23} (RAW, not %, verbatim anomaly)`));

  unkMul(ctx, out, "exotic51", 'FarmingStuffs("ExoticBonusQTY",51,0)');
  // (1 + ArcadeBonus(38)/100)
  pctMulTerm(ctx, out, "arcade38", "ArcadeBonus(38)", () => arcadeBonus(ctx, 38));
  unkMul(ctx, out, "grimoire29", 'Summoning("GrimoireUpgBonus",29,0)');
  unkMul(ctx, out, "arcane32", 'ArcaneType("ArcaneUpgBonus",32,0)');
  unkMul(ctx, out, "cosmo15", "CosmoBonusQTY(1,5)*floor(LeastOpalsInVillager/5)");

  // the big nested SUM/100 — mostly deep systems; caveB card + WinBonus(21) + VaultUpgBonus(73) known
  mulTerm(ctx, out, "nestedSum", "1+ΣnestedSum/100", () => {
    const parts = [];
    let sum = 0, partial = true;   // most addends unmodeled -> lower bound
    const addUnk = (label, key) => { ctx.unknown(`VillagerExp nested sum: ${key} not modeled -> +0`); parts.push({ label, value: 0, note: `${key} unknown` }); };
    addUnk("Monuments (Bravery+Justice+Wisdom)", "MonumentROGbonuses(0/1/2,3)");
    addUnk("Measurements (7,0)", "MeasurementBonusTOTAL(7,0)");
    addUnk("Cosmo majik ×opals/10", "floor(Holes[3][b]/10)*CosmoBonusQTY(1,0)");
    addUnk("Cosmo majik ×blueprints", "CosmoBonusQTY(1,1)*CosSchBlt(0,0)");
    addUnk("Cosmo majik (1,2)", "CosmoBonusQTY(1,2)");
    addUnk("Engineer blueprint 48", "B_UPG(48,0)");
    // min(4*CardLv("caveB"), 50)
    const card = Math.min(4 * num(cardLv(ctx, "caveB")), 50);
    sum += card; parts.push({ label: "caveB EXP card", value: card, note: `min(4×CardLv,50)` });
    addUnk("Bell", "BellBonuss(1,0)");
    addUnk("Measurements (0,0)", "MeasurementBonusTOTAL(0,0)");
    // Summoning WinBonus(21) + VaultUpgBonus(73)
    try { const w = winBonus(ctx, 21); sum += num(w.value); parts.push({ label: "Summoning winner (21)", value: num(w.value), note: w.note }); } catch { addUnk("Summoning winner (21)", "WinBonus(21)"); }
    try { const v = vaultUpgBonus(ctx, 73); sum += num(v); parts.push({ label: "Upgrade Vault (73)", value: num(v), note: "VaultUpgBonus(73)" }); } catch { addUnk("Upgrade Vault (73)", "VaultUpgBonus(73)"); }
    return { value: 1 + sum / 100, status: partial ? "partial" : "computed", note: `Σ=${sum.toFixed(1)}% (deep systems unmodeled)`, parts };
  });

  return out;
}

/* helpers */
function mulTerm(ctx, out, id, key, fn) {
  try { const r = fn(); out.push(T(id, key, "mul", num(r.value), r.status ?? "computed", r.note ?? "", r.parts)); }
  catch (e) { ctx.unknown(`${id} (${key}): ${e.message} -> x1`); out.push(T(id, key, "mul", 1, "unknown", `${e.message} -> x1`)); }
}
function pctMulTerm(ctx, out, id, key, fn) {
  mulTerm(ctx, out, id, key, () => { const f = fn(); return { value: 1 + num(f.value) / 100, status: f.status ?? "computed", note: f.note ?? "" }; });
}
function unkMul(ctx, out, id, key) { ctx.unknown(`${id} (${key}): deep Cavern system not modeled -> x1 (lower bound)`); out.push(T(id, key, "mul", 1, "unknown", `${key} -> x1`)); }

export const villagerExp = {
  name: "villagerExp",
  label: "Villager EXP/hr",
  display: DISPLAY,
  terms(ctx) { return villagerExpTerms(ctx, num(ctx.args?.villager) || 0); },
};
