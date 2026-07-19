/* bonuses/cauldron.mjs — Alchemy cauldron/liquid Pay2Win bonuses and the Liquid Capacity chain.
 *
 * cauldronp2wbonuses("CauldronBonus", category, index, axis) — N.js:7372-7379, verbatim:
 *   level = CauldronP2W[category][axis + axisCount(category)*index]
 *   value = Math.max(0, ArbitraryCode5Inputs(curve.func, curve.x1, curve.x2, level))
 *   curve = CustomLists.CauldronP2Wbonuses[category][axis]   (gamedata-w2-cauldron.mjs)
 * category 0=cauldron(3 axes), 1=liquid(2 axes), 2=vial(2 axes), 3=player(2 axes).
 *
 * CauldronLvsBrewBonus(row, statIdx, 0) — the free brew-progression track (N.js:7355-7368):
 *   liquid rows (row>=4): statIdx 2 -> round(level)  [LIQUID CAPACITY], else round(2*level) [regen]
 *   level = CauldronInfo[8][row][statIdx][1]
 *
 * LIQUID CAPACITY ("LiquidCap"==d, N.js:7359-7365) — full chain per liquid b (0-3), see
 * gamedata-w2-liquids.mjs header. Terms that need runtime state absent from the save are omitted
 * (honest lower bound): SaltLick(5), MealBonus(Liquid12/34), RiftStuff(RiftSkillBonus,4),
 * MainframeBonus(6) (lab node 6 not verified -> treated as x1), the GenINFO[87] "Viaduct" tank
 * scaling, and the GenINFO[56] unlock gate (assumed unlocked). */

import { sel } from "../savemap.mjs";
import { CAULDRON_P2W_BONUS_CURVES, LIQUID_NAMES } from "../../gamedata/gamedata-w2-cauldron.mjs";
import { arbitraryCode5 } from "./util.mjs";
import { alchBubble } from "./bubbles.mjs";
import { vialBonusByKey } from "./alchemy.mjs";
import { mainframeBonus } from "./lab.mjs";
import { arcadeBonus } from "./arcade.mjs";
import { stampBonusOfType } from "./stamps.mjs";
import { mealBonus } from "./meals.mjs";

const num = (x) => Number(x) || 0;
const CAT = { cauldron: 0, liquid: 1, vial: 2, player: 3 };
const CAT_NAME = ["cauldron", "liquid", "vial", "player"];
const AXIS_COUNT = { 0: 3, 1: 2, 2: 2, 3: 2 };

/** cauldronp2wbonuses("CauldronBonus", category, index, axis) as a number (floored at 0). */
export function cauldronP2wBonus(ctx, category, index, axis) {
  const curves = CAULDRON_P2W_BONUS_CURVES[CAT_NAME[category]];
  const curve = curves?.[axis];
  if (!curve) return 0;
  const level = num((sel.cauldronP2W(ctx.s)[category] ?? [])[axis + AXIS_COUNT[category] * index]);
  return Math.max(0, arbitraryCode5(curve.func, curve.x1, curve.x2, level));
}

/** CauldronLvsBrewBonus(row, statIdx) for a LIQUID row (row = liquidIdx+4). statIdx 2 = capacity. */
export function liquidBrewBonus(ctx, liquidIdx, statIdx) {
  const level = sel.brewLevel(ctx.s, liquidIdx + 4, statIdx);
  return statIdx === 2 ? Math.round(level) : Math.round(2 * level);
}

const safe = (ctx, fn) => { try { const r = fn(); return r == null ? null : (typeof r === "number" ? { value: r } : r); } catch { return null; } };

/**
 * Liquid Capacity for one liquid b — the full "LiquidCap" chain. Returns
 *   { value, status, parts:[{id,label,value,note}] }.
 * value = (1 + bleach + (meal + rift)/100) * mf6 * (10 + brewCap + vialCap + p2wCap + tank + stamp + arcade).
 */
export function liquidCapacity(ctx, b) {
  const parts = [];
  let partial = false;
  const push = (id, label, value, note, unknown) => { parts.push({ id, label, value, note }); if (unknown) partial = true; };

  // --- factor 1: (1 + bleach + (meal + rift)/100) ---
  const gem106 = sel.bleachLiquidGem(ctx.s);
  const opt123 = sel.bleachLiquidOpt(ctx.s);
  const saltLick5 = 0;  // SaltLick(5) has no evaluator -> 0 (lower bound)
  ctx.unknown("LiquidCap: SaltLick(5) unread -> bleach term is a lower bound");
  let bleach = gem106 > b ? (0.5 + saltLick5 / 100) : 0;
  if (opt123 > b) bleach = bleach === 0 ? 1 : saltLick5 / 100 + 2;
  push("bleach", "Bleach Liquid (gem shop)", bleach, `gem106=${gem106}, opt123=${opt123} (SaltLick omitted)`, true);

  const meal = safe(ctx, () => mealBonus(ctx, b < 2 ? "Liquid12" : "Liquid34"));
  const mealV = meal ? num(meal.value) : 0;
  if (!meal) { ctx.unknown(`LiquidCap: MealBonus("${b < 2 ? "Liquid12" : "Liquid34"}") unread -> 0 (lower bound)`); partial = true; }
  push("meal", "Meal (liquid capacity)", mealV, meal?.note ?? "meal row not verified -> 0");

  const rift = 0; // 5*RiftStuff("RiftSkillBonus,4",1) unread
  ctx.unknown("LiquidCap: RiftStuff(RiftSkillBonus,4) unread -> 0 (lower bound)");
  push("rift", "Rift skill mastery (liquid)", rift, "RiftSkillBonus,4 unread -> 0", true);

  const factor1 = 1 + bleach + (mealV + rift) / 100;

  // --- factor 2: MainframeBonus(6) ---
  const mf = safe(ctx, () => mainframeBonus(ctx, 6));
  const mf6 = mf && mf.value != null ? num(mf.value) : 1;
  if (!mf || mf.value == null) { ctx.unknown("LiquidCap: MainframeBonus(6) lab node not verified/connected -> x1 (lower bound)"); partial = true; }
  push("mf6", "Lab: liquid-cap node (MainframeBonus 6)", mf6, mf?.note ?? "node 6 unverified -> x1");

  // --- factor 3: (10 + brewCap + vialCap + p2wCap + tank + stamp + arcade) ---
  push("base10", "Base capacity", 10, "flat base");
  const brewCap = liquidBrewBonus(ctx, b, 2);
  push("brewCap", "Free brew track (capacity)", brewCap, `CauldronInfo[8][${b + 4}][2][1]`);
  const vialCap = num(vialBonusByKey(ctx, `Liquid${b + 1}Cap`).value);
  push("vialCap", `Vial: Liquid${b + 1}Cap`, vialCap, vialCap ? "" : "no/zero vial");
  const p2wCap = cauldronP2wBonus(ctx, CAT.liquid, b, 1);
  push("p2wCap", "Cauldron P2W (liquid capacity axis)", p2wCap, "cauldronp2wbonuses(1,b,1)");
  const lqdCap = alchBubble(ctx, "LqdCap");   // Da Daily Drip bubble
  // tank = LqdCap * max(pow(GenINFO[87]/25,.3),0) — GenINFO[87] runtime; omit the scaling -> tank 0
  ctx.unknown("LiquidCap: GenINFO[87] (Viaduct tank scaling) is runtime -> tank term omitted (lower bound)");
  push("tank", "Viaduct of the Gods (tank)", 0, `AlchBubbles.LqdCap=${num(lqdCap.value).toFixed(1)} x pow(GenINFO[87]/25,.3) omitted`, true);
  const stampCap = safe(ctx, () => stampBonusOfType(ctx, "LiquidCap"));
  const stampV = stampCap ? num(stampCap.value) : 0;
  if (!stampCap) { ctx.unknown('LiquidCap: StampBonusOfTypeX("LiquidCap") no stamp row -> 0'); }
  push("stamp", "Stamp (liquid capacity)", stampV, stampCap?.note ?? "no LiquidCap stamp -> 0");
  const arcade7 = Math.ceil(num(arcadeBonus(ctx, 7).value));
  push("arcade", "Arcade (liquid capacity)", arcade7, "ceil(ArcadeBonus(7))");

  const factor3 = 10 + brewCap + vialCap + p2wCap + 0 /*tank*/ + stampV + arcade7;
  const value = factor1 * mf6 * factor3;
  return { value, status: partial ? "partial" : "computed", parts, liquidName: LIQUID_NAMES[b] };
}
