/* stats/palette-luck.mjs — recipe `paletteLuck`, "Palette Luck".
 *
 * THE EXPRESSION, verbatim from GamingStatType("PaletteLuck",0,0), N.js:17764-17766 (fully
 * transcribed in gamedata-w5-palette.mjs). 5 top-level multiplicative factors; the 5th is
 * (1 + SUM/100) where SUM has 9 additive components (one is itself a 3-term bracket gated by a
 * superbit) -> ~13 terms once unpacked.
 *
 * Factors are kind "mul"; the additive SUM lives inside the last factor (its addends surfaced as
 * `parts`). Honesty: unrecoverable superbits (ids >= 53: SBT(65)), unverified dispatcher ids
 * (sushi 42, grid 107, LoreEpiBon 5) and unmodeled sources (acorn shop, exotic 44) contribute
 * their neutral element and flag ctx.unknown -> the value is a LOWER BOUND.
 *
 * ACTIVE-CHAR: the SUM reads Lv0[15] (the acting character's Gaming level). Gaming level is
 * per-character, so this is active-char-sensitive; we use the highest-Gaming character (best case)
 * and note it. */

import { T } from "./engine.mjs";
import { sel, skillLv } from "../savemap.mjs";
import { paletteBonus } from "../bonuses/gaming.mjs";
import { superBitType, loreOwned } from "../bonuses/gaming.mjs";
import { meritocBonusz } from "../bonuses/summoning.mjs";
import { arcadeBonus } from "../bonuses/arcade.mjs";
import { jadeEmporiumOwned } from "../bonuses/ninja.mjs";
import { ratShopBonus } from "../../gamedata/gamedata-w5-gaming.mjs";

const num = (x) => Number(x) || 0;

export const DISPLAY = {
  superbit42: { label: "Bigger Palette superbit (×2)", where: "W5 Gaming → Superbit 42", how: "doubles total palette luck." },
  sushi42: { label: "Sushi (palette luck)", where: "W7 Sushi Bar", how: "RoG_BonusQTY(42) not verified -> unknown." },
  meritoc8: { label: "Meritocracy (palette luck)", where: "W2 Meritocracy ballot", how: "category 8 selected." },
  ratShop1: { label: "Rat King shop (palette luck)", where: "W5 Gaming → Rat King", how: "RatShopBonuses(1)=3×level." },
  superbit65: { label: "Artistic Gamer superbit (×1.3)", where: "W5 Gaming → Superbit 65", how: "id≥53 unrecoverable -> floored." },
  sum: { label: "Additive luck bracket", where: "colours, superbits, snail, arcade, emporium…", how: "sum of 9 sources / 100." },
};

/** Highest Gaming level across characters + which char (best-case active). */
function bestGaming(s) {
  let best = 0, idx = null;
  for (const i of s.charIdxs) { const lv = num(skillLv(s, i, "gaming")); if (lv > best) { best = lv; idx = i; } }
  return { level: best, idx };
}

export const paletteLuck = {
  name: "paletteLuck",
  label: "Palette Luck",
  display: DISPLAY,
  activeCharSensitive(s) {
    const lvls = s.charIdxs.map((i) => num(skillLv(s, i, "gaming")));
    return new Set(lvls).size > 1;
  },
  terms(ctx) {
    const out = [];
    const gamingLv = ctx.activeChar != null ? num(skillLv(ctx.s, ctx.activeChar, "gaming")) : bestGaming(ctx.s).level;

    // F1. (1 + SuperBitType(42)) — Bigger Palette, x2 flat when owned
    out.push(mulBit(ctx, "superbit42", "1+SuperBitType(42,0)", 42, 1));
    // F2. sushi 42 (unverified id)
    out.push(unk(ctx, "sushi42", 'SushiStuff("RoG_BonusQTY",42,0)'));
    // F3. meritocracy 8
    out.push(pctMul(ctx, "meritoc8", 'Summoning2("MeritocBonusz",8,0)', () => meritocBonusz(ctx, 8)));
    // F4. RatShopBonuses(1) = 3 * GamingSprout[33][2]
    out.push(mul(ctx, "ratShop1", 'GamingStatType("RatShopBonuses",1,0)', () => {
      const lv = sel.ratShopLevel(ctx.s, 1);
      const v = ratShopBonus(1, lv);
      return { value: 1 + v / 100, note: `RatShop slot1 lv ${lv} -> +${v}%` };
    }));
    // F5. (1 + 0.3*SuperBitType(65)) — id>=53 unrecoverable
    out.push(mul(ctx, "superbit65", "1+0.3*SuperBitType(65,0)", () => {
      const b = superBitType(ctx, 65);
      if (b === null) { ctx.unknown("SuperBitType(65) id>=53 unrecoverable -> x1 (lower bound)"); return { value: 1, status: "partial", note: "unrecoverable -> floored" }; }
      return { value: 1 + 0.3 * b, note: b ? "owned x1.3" : "not owned" };
    }));

    // F6. (1 + SUM/100)
    out.push(sumFactor(ctx, gamingLv));
    return out;
  },
};

/* ----- helpers ----- */
function mul(ctx, id, key, fn) {
  try { const r = fn(); return T(id, key, "mul", num(r.value), r.status ?? "computed", r.note ?? ""); }
  catch (e) { ctx.unknown(`${id} (${key}): ${e.message} -> x1`); return T(id, key, "mul", 1, "unknown", `${e.message} -> x1`); }
}
function pctMul(ctx, id, key, fn) {
  return mul(ctx, id, key, () => { const f = fn(); return { value: 1 + num(f.value) / 100, status: f.status ?? "computed", note: f.note ?? "" }; });
}
function mulBit(ctx, id, key, bit, coeff) {
  return mul(ctx, id, key, () => {
    const b = superBitType(ctx, bit);
    if (b === null) { ctx.unknown(`SuperBitType(${bit}) unrecoverable -> x1`); return { value: 1, status: "partial", note: "unrecoverable" }; }
    return { value: 1 + coeff * b, note: b ? `owned` : "not owned" };
  });
}
function unk(ctx, id, key) { ctx.unknown(`${id} (${key}): not derivable -> x1 (lower bound)`); return T(id, key, "mul", 1, "unknown", `${key} -> x1`); }

/** The (1 + SUM/100) factor; SUM = 9 addends, unknown ones -> 0 + flag, surfaced as parts. */
function sumFactor(ctx, gamingLv) {
  const parts = [];
  let sum = 0, partial = false;
  const add = (label, value, note) => { const v = num(value); sum += v; parts.push({ label, value: v, note }); };
  const addUnk = (label, key) => { partial = true; ctx.unknown(`PaletteLuck SUM: ${key} not derivable -> +0 (lower bound)`); parts.push({ label, value: 0, note: `${key} unknown -> 0` }); };

  // PaletteBonus(3) — Neon_Tree "+% Palette Luck"
  try { const p3 = paletteBonus(ctx, 3); add("Neon Tree colour (3)", p3.value, p3.note); if (p3.status === "partial") partial = true; }
  catch (e) { addUnk("Neon Tree colour (3)", "PaletteBonus(3)"); }

  // (4*gamingLv*lore8 + PaletteBonus(37) + LoreEpiBon(5)) * SuperBitType(38)
  {
    const bit38 = superBitType(ctx, 38);
    if (bit38 === null) { addUnk("Colourful Luck bracket (superbit 38)", "SuperBitType(38)"); }
    else if (bit38 === 0) { parts.push({ label: "Colourful Luck bracket (superbit 38)", value: 0, note: "superbit 38 not owned" }); }
    else {
      const lore8 = loreOwned(ctx, 8);
      let bracket = 4 * gamingLv * lore8;
      let note = `4×gamingLv ${gamingLv}×lore8 ${lore8}`;
      try { const p37 = paletteBonus(ctx, 37); bracket += num(p37.value); note += ` + totalColourLvs ${num(p37.value)}`; } catch { partial = true; }
      // LoreEpiBon(5) — Spelunky[20/21][5] not in LOREEPI table -> unknown addend
      partial = true; ctx.unknown("PaletteLuck SUM: Thingies(LoreEpiBon,5) coeff unverified -> +0 (lower bound)");
      note += " + LoreEpiBon(5) unknown(0)";
      add("Colourful Luck bracket (superbit 38)", bracket, note);
    }
  }

  // max(0, 3*(gamingLv-200)) * SuperBitType(45)
  addSuperbitScaled(ctx, parts, add, addUnk, "Gamer Luck (superbit 45)", 45, Math.max(0, 3 * (gamingLv - 200)), `3×max(0,gamingLv-200)=${Math.max(0, 3 * (gamingLv - 200))}`);
  // 20*max(0, snailLv-25) * SuperBitType(28)
  const snailLv = sel.snailLevel(ctx.s);
  addSuperbitScaled(ctx, parts, add, addUnk, "Lucky Snail (superbit 28)", 28, 20 * Math.max(0, snailLv - 25), `20×max(0,snailLv ${snailLv}-25)`);

  addUnk("Acorn Shop (palette luck)", "AcornShopBonus(2)");
  addUnk("Exotic Market (palette luck)", "FarmingStuffs(ExoticBonusQTY,44)");

  // 100 * Ninja("EmporiumBonus",41)
  const emp41 = jadeEmporiumOwned(ctx, 41);
  if (emp41 === null) { addUnk("Jade Emporium 41", "EmporiumBonus(41)"); }
  else add("Jade Emporium 41", 100 * emp41, emp41 ? "owned +100" : "not owned");

  // ArcadeBonus(58)
  try { const a = arcadeBonus(ctx, 58); add("Arcade (palette luck)", a.value, a.note); if (a.status === "partial") partial = true; }
  catch { addUnk("Arcade (palette luck)", "ArcadeBonus(58)"); }

  // ResearchStuff("Grid_Bonus",107,2) — id 107 unverified
  addUnk("Research grid 107", "Grid_Bonus(107,2)");

  return T("sum", "1+SUM/100", "mul", 1 + sum / 100, partial ? "partial" : "computed",
    `SUM=${sum.toFixed(1)}% -> x${(1 + sum / 100).toFixed(3)}`, parts);
}

function addSuperbitScaled(ctx, parts, add, addUnk, label, bit, factorIfOwned, note) {
  const b = superBitType(ctx, bit);
  if (b === null) { addUnk(label, `SuperBitType(${bit})`); return; }
  if (b === 0) { parts.push({ label, value: 0, note: `superbit ${bit} not owned` }); return; }
  add(label, factorIfOwned, note);
}
