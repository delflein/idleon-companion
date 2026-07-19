/* bonuses/atoms.mjs — Atom Collider dispatchers (m._customBlock_AtomCollider, N.js:17838-17845).
 * Static table + formula text: gamedata-w3-atoms.mjs. All formulas transcribed verbatim there.
 *
 * AtomBonuses(idx) — the general case is level * baseBonusPerLevel; three atoms special-case
 * (Hydrogen days-login cap 90, Carbon = 2 * Σ max(0, worshipTowerLv-50), Fluoride power curve
 * over Lv30+ meals). We implement the GENERAL case exactly and the two save-derivable special
 * cases (Carbon via TowerInfo[9..17], Fluoride via Meals) as best-effort; Hydrogen needs the
 * runtime days-since-login counter (OptLacc[134]) which the save does carry.
 *
 * AtomCost(idx) / AtomMaxLv() — the per-level upgrade cost (in Divinity Particles) and the shared
 * max level. The cost discount factor sums ~10 account terms; several have no evaluator here, so
 * the discount is a documented LOWER BOUND (=> cost is an UPPER bound) and the fragment is flagged. */

import { sel } from "../savemap.mjs";
import { ATOM_INFO, ATOM_MAX_LEVEL_BASE } from "../gamedata-w3-atoms.mjs";
import { stampBonusOfType } from "./stamps.mjs";
import { superBitType } from "./gaming.mjs";
import { alchBubble } from "./bubbles.mjs";

const num = (x) => Number(x) || 0;
const safe = (ctx, fn, onFail) => { try { const r = fn(); return r; } catch { return onFail; } };

/** AtomBonuses(idx) as a number (the atom's own bonus value). */
export function atomBonus(ctx, idx) {
  const row = ATOM_INFO[idx];
  if (!row) return 0;
  const lv = num(sel.atoms(ctx.s)[idx]);
  const general = lv * row.baseBonusPerLevel;
  if (idx === 0) {
    // Hydrogen: min(90, general * OptLacc[134] days-since-login)
    const days = num(sel.optionsAccount(ctx.s)[134]);
    return Math.min(90, general * days);
  }
  if (idx === 5) {
    // Carbon: 2 * Σ over 9 worship pillars of max(0, TowerInfo[9+f] - 50)
    const tw = sel.towerLevels(ctx.s);
    let sum = 0;
    for (let f = 0; f < 9; f++) sum += Math.max(0, num(tw[9 + f]) - 50);
    return 2 * sum;
  }
  if (idx === 8) {
    // Fluoride: (1 + general/100) ^ (# meals at Lv30+)
    const meals = sel.mealLevels(ctx.s);
    const n = (Array.isArray(meals) ? meals : []).filter((m) => num(m) >= 30).length;
    return Math.pow(1 + general / 100, n);
  }
  return general;
}

/** The atom-cost DISCOUNT reduction pool (percent), as {value, status, parts}. Lower bound —
 *  several arms have no evaluator (Palette 35, Grimoire 51, Compass 50, TaskShop, Bubba). */
export function atomCostReductionPool(ctx) {
  const parts = [];
  let partial = false;
  const push = (id, label, value, note, unknown) => { parts.push({ id, label, value, note }); if (unknown) partial = true; };

  // GamingStatType("PaletteBonus",35,0) — no verified PALETTE_ROWS entry
  push("palette", "Sculpting palette (35)", 0, "PaletteBonus(35) unread", true);
  ctx.unknown('AtomCost: GamingStatType("PaletteBonus",35,0) unread -> 0 (lower bound)');

  const stamp = safe(ctx, () => stampBonusOfType(ctx, "AtomCost"), null);
  push("stamp", "Stamp: Atom Cost", stamp ? num(stamp.value) : 0, stamp?.note ?? "no AtomCost stamp", !stamp);

  push("neon", "Neon atom (self-discount, id 9)", atomBonus(ctx, 9), "AtomBonuses(9) = Atoms[9] * 1");

  const sb21 = superBitType(ctx, 21);
  if (sb21 === null) { push("superbit", "Superbit Redux (21)", 0, "SuperBitType(21) unrecoverable (id>=53? no) -> unknown", true); ctx.unknown("AtomCost: SuperBitType(21) unknown"); }
  else push("superbit", "Superbit Redux (21)", 10 * sb21, `10 * SuperBitType(21)=${sb21}`);

  push("grimoire", "Grimoire (51)", 0, "GrimoireUpgBonus(51) unread", true);
  ctx.unknown('AtomCost: Summoning("GrimoireUpgBonus",51,0) unread -> 0 (lower bound)');
  push("compass", "Windwalker compass (50)", 0, "CompassBonus(50) unread", true);
  ctx.unknown('AtomCost: Windwalker("CompassBonus",50,0) unread -> 0 (lower bound)');

  const y5 = safe(ctx, () => alchBubble(ctx, "Y5"), null);
  push("bubble", "Alchemy bubble Y5", y5 ? num(y5.value) : 0, y5?.note ?? "AlchBubbles.Y5", false);

  const towerLv = num(sel.towerLevels(ctx.s)[8]);
  push("tower", "Atom Collider tower (level/10)", towerLv / 10, `TowerInfo[8]=${towerLv} -> ${(towerLv / 10).toFixed(1)}%`);

  push("task", "Task shop (Tasks[2][4][6])", 0, "7*Tasks[2][4][6] unread", true);
  ctx.unknown("AtomCost: 7*Tasks[2][4][6] task-shop bonus unread -> 0 (lower bound)");
  push("bubba", "Bubba (BubbaRoG 7)", 0, "Bubbastuff(BubbaRoG_Bonuses,7) unread", true);
  ctx.unknown("AtomCost: Bubbastuff(BubbaRoG_Bonuses,7,0) unread -> 0 (lower bound)");

  const value = parts.reduce((a, p) => a + num(p.value), 0);
  return { value, status: partial ? "partial" : "computed", parts };
}

/** AtomMaxLv() — shared max level. Base 20 + superbit(23) + compass(53) + eventShop(28) extensions.
 *  Extensions unread -> lower bound (still fine for cost-to-next which only needs current level). */
export function atomMaxLevel(ctx) {
  const sb23 = superBitType(ctx, 23);
  const ext = sb23 && sb23 > 0 ? 10 * sb23 : 0;   // compass(53)+eventShop(28) unread
  return ATOM_MAX_LEVEL_BASE + ext;
}

/** AtomCost(idx) — cost to raise atom `idx` one level, in Divinity Particles. Uses the derivable
 *  discount pool (lower bound => cost is an upper bound). Returns {value, status, note, discount}. */
export function atomCost(ctx, idx) {
  const row = ATOM_INFO[idx];
  if (!row) return { value: null, status: "unknown", note: `atom ${idx} not in ATOM_INFO` };
  const pool = atomCostReductionPool(ctx);
  const discount = 1 / (1 + pool.value / 100);
  const level = num(sel.atoms(ctx.s)[idx]);
  const raw = discount * (row.x3BaseCost + row.x1 * level) * Math.pow(row.x2GrowthRate, level);
  const cost = raw < 1e6 ? Math.floor(raw) : raw;
  return {
    value: cost, status: pool.status === "partial" ? "partial" : "computed",
    discount,
    note: `atom ${idx} (${row.name.split("_")[0]}) lv ${level}: cost ${Math.round(cost)} particles (discount ${discount.toFixed(3)} from ${pool.value.toFixed(1)}% reduction${pool.status === "partial" ? ", lower bound -> cost is upper bound" : ""})`,
  };
}
