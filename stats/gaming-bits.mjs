/* stats/gaming-bits.mjs — recipe `gamingBits`, "Bits Multiplier".
 *
 * THE EXPRESSION, verbatim from GamingStatType("SproutValueNonPlantMulti",0,0), N.js:17783-17787
 * (fully transcribed in gamedata-w5-gaming.mjs section 8). This is the per-sprout-collection value
 * multiplier — the closest verified analogue to a "bits/hr multiplier" (there is no separately
 * named GamingBitsPerHr function). 28 MULTIPLICATIVE factors, in source order.
 *
 * All terms are kind "mul"; the additive pool stays empty so the engine's default combine yields
 * the plain product (like stats/crop-evo.mjs). Honesty: factors we cannot derive from the save
 * (runtime highscores, unverified dispatcher ids, artifact main-bonus recomputes) contribute their
 * neutral factor 1 and flag ctx.unknown -> the whole multiplier is reported as a LOWER BOUND.
 *
 * Wired evaluators (verified/generic): companion, vialBonusByKey, cardLv, achieveStatus, winBonus,
 * lampBonus, emperorBon, paletteBonus (extended to 37 slots), meritocBonusz, vaultUpgBonus,
 * mealBonus, snailBitMulti. Computed directly from save+gamedata: gem-shop toggle, best nugget,
 * elegant shell. Unknown (no verified evaluator / runtime-only): research grid 87, sushi 29,
 * Gummy_Orb/Weatherbook artifact main bonuses, monument(0,4), rift skill 14, MSA(3),
 * logbook×loggame×ratking, bitty-litty talent, POiNG, acorn shop, sticker(3). */

import { T } from "./engine.mjs";
import { sel } from "../savemap.mjs";
import { companion } from "../bonuses/companions.mjs";
import { vialBonusByKey } from "../bonuses/alchemy.mjs";
import { cardLv } from "../bonuses/cards.mjs";
import { achieveStatus } from "../bonuses/misc.mjs";
import { winBonus, vaultUpgBonus, meritocBonusz } from "../bonuses/summoning.mjs";
import { lampBonus } from "../bonuses/holes.mjs";
import { emperorBon } from "../bonuses/thingies.mjs";
import { paletteBonus, snailBitMulti } from "../bonuses/gaming.mjs";
import { mealBonus } from "../bonuses/meals.mjs";
import { importItemBonus } from "../gamedata-w5-gaming.mjs";

const num = (x) => Number(x) || 0;

export const DISPLAY = {
  gemToggle: { label: "Gem shop batch toggle", where: "W5 Gaming → gem shop", how: "OptionsListAccount[411]: ×(1+99·toggle) — batch-harvest mode (also 100× slower growth)." },
  researchGrid87: { label: "Research grid (bits)", where: "W7 Research Grid node 87", how: "coeff not verified in RES_GRID_COEFF -> unknown." },
  sushi29: { label: "Sushi bits bonus", where: "W7 Sushi Bar", how: "RoG_BonusQTY(29) not verified in SUSHI_ROG -> unknown." },
  gummyOrb: { label: "Gummy Orb artifact", where: "Sailing artifacts (idx 20)", how: "slab-scaled main bonus not modeled -> unknown." },
  companion53: { label: "Companion (bits)", where: "Companions", how: "×max(1,1+Companions(53))." },
  vial7bits: { label: "Vial '7bits'", where: "Alchemy vials", how: "level the 7bits vial." },
  weatherbook: { label: "Weatherbook artifact", where: "Sailing artifacts (idx 23)", how: "main bonus not modeled -> unknown." },
  monument04: { label: "Monument (bits)", where: "W5 Cavern → Monuments", how: "MonumentROGbonuses(0,4) not modeled -> unknown." },
  riftSkill14: { label: "Skill Mastery (Gaming)", where: "Rift skill mastery", how: "RiftSkillBonus,14 not modeled -> unknown." },
  msa3: { label: "MSA Big Bits", where: "W3 MSA totalizer", how: "MSA_Bonus(3) only id 6 verified -> unknown." },
  snail: { label: "Immortal Snail", where: "W5 Gaming → Snail import", how: "×2^min(25,Lv)·1.5^… by snail level." },
  cardW7b2: { label: "W7b2 bits card", where: "W7 card", how: "+20%/level." },
  acorn: { label: "Acorn Shop (bits)", where: "W5 Gaming → Squirrel", how: "AcornShopBonus(0) not modeled -> unknown." },
  bestNugget: { label: "Best gold nugget", where: "W5 Gaming → Dirty Shovel", how: "×max(1,Gaming[8]) — biggest nugget dug." },
  elegantShell: { label: "Elegant Seashell", where: "W5 Gaming → Seashell import", how: "×(1+rank·bits-per-rank)." },
  logbook: { label: "Logbook × Log game × Rat King", where: "W5 Gaming", how: "runtime highscores -> unknown." },
  mealsGameBits: { label: "Meals + vial (GameBits)", where: "W4 meals + alchemy vial", how: "GamingBits meal + GameBits vial." },
  bittyLitty: { label: "Bitty Litty talent", where: "W5 Gaming class talent", how: "getbonus2(1,177)·gaming lv -> unknown." },
  poing: { label: "POiNG highscore", where: "W5 Gaming → POiNG", how: "runtime highscore -> unknown." },
  ach296307: { label: "Achievements 296 & 307", where: "Achievements", how: "×(1+(A296+A307)/20)." },
  summWin16: { label: "Summoning winner bonus", where: "W6 Summoning", how: "WinBonus(16)." },
  lamp11: { label: "Cavern Lamp wish (bits)", where: "W5 Cavern → Lamp", how: "LampBonuses(1,1)." },
  emperor7: { label: "Emperor bonus (bits)", where: "W6 Emperor", how: "EmperorBon(7)." },
  palette7: { label: "Palette: DJ Musto", where: "W5 Gaming → Palette 7", how: "level colour 7." },
  palette18: { label: "Palette: Offwhite", where: "W5 Gaming → Palette 18", how: "level colour 18." },
  meritoc1: { label: "Meritocracy (bits)", where: "W2 Meritocracy ballot", how: "category 1 selected." },
  sticker3: { label: "Sticker (bits)", where: "Megacrop stickers", how: "StickerBonus(3) not modeled -> unknown." },
  vault68: { label: "Upgrade Vault (bits)", where: "W6 Summoning → Vault", how: "VaultUpgBonus(68)." },
};

/** Build a multiplicative term; unknown/throw -> factor 1 (neutral) + ctx.unknown. */
function mul(ctx, id, key, fn) {
  try {
    const r = fn();
    return T(id, key, "mul", num(r.value), r.status ?? "computed", r.note ?? "");
  } catch (e) {
    ctx.unknown(`${id} (${key}): ${e.message} -> x1 (lower bound)`);
    return T(id, key, "mul", 1, "unknown", `${e.message} -> x1`);
  }
}
/** A "1 + eval/100" factor from a fragment-returning evaluator. */
function pctMul(ctx, id, key, fn) {
  return mul(ctx, id, key, () => {
    const f = fn();
    return { value: 1 + num(f.value) / 100, status: f.status ?? "computed", note: f.note ?? "" };
  });
}
/** An unknown factor (no verified evaluator). */
function unk(ctx, id, key) {
  ctx.unknown(`${id} (${key}): not derivable from save -> x1 (lower bound)`);
  return T(id, key, "mul", 1, "unknown", `${key} -> x1`);
}

export const gamingBits = {
  name: "gamingBits",
  label: "Bits Multiplier",
  display: DISPLAY,
  terms(ctx) {
    const G = sel.gaming(ctx.s);
    const out = [];

    // 1. gem-shop batch toggle: (1 + 99*OptionsListAccount[411])
    const t411 = num((ctx.s.get("OptLacc") ?? [])[411]);
    out.push(T("gemToggle", "1+99*OptionsListAccount[411]", "mul", 1 + 99 * t411, "computed", `OLA[411]=${t411} -> x${1 + 99 * t411}`));

    // 2-4, 7-10, 13, 16, 18-19: unverified/runtime -> unknown
    out.push(unk(ctx, "researchGrid87", 'ResearchStuff("Grid_Bonus",87,0)'));
    out.push(unk(ctx, "sushi29", 'SushiStuff("RoG_BonusQTY",29,0)'));
    out.push(unk(ctx, "gummyOrb", 'Sailing("ArtifactBonus",20,0)'));

    // 5. companion 53: max(1, 1 + Companions(53))
    out.push(mul(ctx, "companion53", "max(1,1+Companions(53))", () => {
      const c = companion(ctx, 53);
      if (c.owned === null) { ctx.unknown("Companions(53) ownership unknown -> x1"); return { value: 1, status: "unknown", note: "ownership unknown" }; }
      return { value: Math.max(1, 1 + num(c.value)), note: c.owned ? `owned +${c.value}` : "not owned" };
    }));

    // 6. vial "7bits"
    out.push(pctMul(ctx, "vial7bits", 'AlchVials["7bits"]', () => vialBonusByKey(ctx, "7bits")));

    out.push(unk(ctx, "weatherbook", 'Sailing("ArtifactBonus",23,0)'));
    out.push(unk(ctx, "monument04", 'Holes("MonumentROGbonuses",0,4)'));
    out.push(unk(ctx, "riftSkill14", 'RiftStuff("RiftSkillBonus,14",1)'));
    out.push(unk(ctx, "msa3", "MSA_Bonus(3,0)"));

    // 11. snail bits multiplier
    out.push(mul(ctx, "snail", "max(1,SnailStuff(2,0))", () => {
      const s = snailBitMulti(ctx);
      return { value: Math.max(1, num(s.value)), status: s.status, note: s.note };
    }));

    // 12. card w7b2: (1 + 20*CardLv/100)
    out.push(mul(ctx, "cardW7b2", '20*CardLv("w7b2")', () => {
      const lv = cardLv(ctx, "w7b2");
      return { value: 1 + 20 * num(lv) / 100, note: `CardLv(w7b2)=${lv} -> +${20 * num(lv)}%` };
    }));

    out.push(unk(ctx, "acorn", "AcornShopBonus(0,0)"));

    // 14. best nugget: max(1, Gaming[8])
    const nugget = num(G[8]);
    out.push(T("bestNugget", "max(1,Gaming[8])", "mul", Math.max(1, nugget), "computed", `Gaming[8]=${nugget.toExponential(3)}`));

    // 15. elegant shell: (1 + GamingSprout[28][2]*ImportItemBonus(3)/100)
    out.push(mul(ctx, "elegantShell", "1+GamingSprout[28][2]*ImportItemBonus(3)/100", () => {
      const gs = sel.gamingSprout(ctx.s);
      const rank = num((gs[28] ?? [])[2]);
      const bonus = importItemBonus(3, gs);   // round(GamingSprout[28][0])
      return { value: 1 + rank * bonus / 100, note: `rank ${rank} x per-rank ${bonus} -> +${(rank * bonus).toFixed(0)}%` };
    }));

    out.push(unk(ctx, "logbook", "GenINFO[73]*LogGameMulti*RatBitMulti"));

    // 17. meals + vial(GameBits): (1 + (MealBonus("GamingBits") + AlchVials.GameBits)/100)
    out.push(mul(ctx, "mealsGameBits", '1+(MealBonus("GamingBits")+AlchVials.GameBits)/100', () => {
      const m = mealBonus(ctx, "GamingBits");
      const v = vialBonusByKey(ctx, "GameBits");
      const status = m.status === "partial" || v.status === "partial" ? "partial" : "computed";
      return { value: 1 + (num(m.value) + num(v.value)) / 100, status, note: `meal +${num(m.value).toFixed(1)}% + vial +${num(v.value).toFixed(1)}%` };
    }));

    out.push(unk(ctx, "bittyLitty", "getbonus2(1,177,-1)*Lv0[15]"));
    out.push(unk(ctx, "poing", "min(25,GamingPOINGmulti(0,0))"));

    // 20. achievements 296 & 307: (1 + (A296 + A307)/20)
    out.push(mul(ctx, "ach296307", "1+(AchieveStatus(296)+AchieveStatus(307))/20", () => {
      const a = achieveStatus(ctx, 296) + achieveStatus(ctx, 307);
      return { value: 1 + a / 20, note: `A296+A307=${a}` };
    }));

    // 21. summoning win bonus 16
    out.push(pctMul(ctx, "summWin16", 'Summoning("WinBonus",16,0)', () => winBonus(ctx, 16)));
    // 22. lamp(1,1)
    out.push(pctMul(ctx, "lamp11", 'Holes("LampBonuses",1,1)', () => lampBonus(ctx, 1, 1)));
    // 23. emperor(7)
    out.push(mul(ctx, "emperor7", 'Thingies("EmperorBon",7,0)', () => ({ value: 1 + num(emperorBon(ctx, 7)) / 100 })));
    // 24-25. palette 7 & 18
    out.push(pctMul(ctx, "palette7", "PaletteBonus(7,0)", () => paletteBonus(ctx, 7)));
    out.push(pctMul(ctx, "palette18", "PaletteBonus(18,0)", () => paletteBonus(ctx, 18)));
    // 26. meritocracy 1
    out.push(pctMul(ctx, "meritoc1", 'Summoning2("MeritocBonusz",1,0)', () => meritocBonusz(ctx, 1)));
    // 27. sticker 3 (no evaluator)
    out.push(unk(ctx, "sticker3", 'FarmingStuffs("StickerBonus",3,0)'));
    // 28. vault 68
    out.push(pctMul(ctx, "vault68", 'Summoning("VaultUpgBonus",68,0)', () => ({ value: vaultUpgBonus(ctx, 68) })));

    return out;
  },
};
