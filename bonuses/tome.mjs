/* bonuses/tome.mjs — THE TOME: score (GenInfo[84] = TomeQTYtot) computed natively.
 *
 * Verified verbatim in N.js (_customEvent_TomeQTY + the Summoning "TomePCT"/"TomePTS"/
 * "TomeLvReq"/"isTomeUnlocked"/"TomeBonus" branches; IdleonToolbox's tome.ts used as the
 * index and cross-check — formulas match):
 *   pts(row)  = ceil(pct * Tome[row][3])
 *   pct       = curve Tome[row][2] in {0..4} over qty and x1=Tome[row][1]  (see curvePct)
 *   gate      = totalAccountLevel >= TomeLvReq(TOME_ORDER position)
 *   score     = sum of pts over all 118 rows
 *
 * QTY[i] below mirrors the client's TomeQTY builder row by row (the builder maintains some
 * high-water marks in OptLacc at runtime — 198 money, 200 drop rate, 202 crystal, 224
 * greenstacks — so reading the saved OptLacc IS the client's own persisted quantity).
 * Rows we cannot derive yet return null and count 0 — the score is a FLOOR; the unresolved
 * list + their max points give the honest upper bound. */

import { sel, vals } from "../savemap.mjs";
import { TOME_ROWS, TOME_ORDER, QUEST_ORDER } from "../gamedata-tome.mjs";
import { cardLv } from "./cards.mjs";
import { shinyLevel } from "./breeding.mjs";
import { PET_SHINY_SLOT } from "../gamedata.mjs";
import { CARD_ROWS } from "../gamedata-cards.mjs";
import { vaultUpgBonus, grimoireUpgBonus } from "./summoning.mjs";
import { eventShopOwned, setBonus } from "./misc.mjs";
import { uniqueSushi } from "./sushi.mjs";

const N = (x) => Number(x) || 0;
const S = (a) => vals(a).reduce((t, x) => t + N(x), 0);
const g = (ctx, k) => ctx.s.get(k) ?? [];
const opt = (ctx, i) => N((ctx.s.get("OptLacc") ?? [])[i]);

/** Total account level = sum of every character's Lv0[0] (GenInfo[83] verbatim). */
export const accountLevel = (ctx) => ctx.s.charIdxs.reduce((t, i) => t + N((ctx.s.at("Lv0_N", i) ?? [])[0]), 0);

/** Per-character map families used below. */
const perCharMax = (ctx, fam, pick) => ctx.s.charIdxs.reduce((m, i) => Math.max(m, pick(ctx.s.at(fam, i))), 0);

/* --- the 118 quantity getters (null = not derivable yet) ------------------ */
const QTY = [];
QTY[0] = (ctx) => [0, 1, 2].reduce((t, i) => t + S((ctx.s.get("StampLv") ?? [])[i]), 0);   // stamp total LV
/** Statue levels are per-char (StatueLevels_N rows [level, exp]) but account-synced once
 *  gilded (OptLacc[69] >= 1) — the client reads the active char's runtime array. Max across
 *  chars is exact for a synced account (they're all equal). */
QTY[1] = (ctx) => {
  let best = 0;
  for (const i of ctx.s.charIdxs)
    best = Math.max(best, vals(ctx.s.at("StatueLevels_N", i)).reduce((t, r) => t + N(r?.[0]), 0));
  return best;
};
QTY[2] = (ctx) => Object.keys(ctx.s.get("Cards0") ?? {}).reduce((t, id) => t + (CARD_ROWS[id] ? cardLv(ctx, id) : 0), 0);
QTY[3] = (ctx) => {   // per-talent MAX of SkillLevelsMAX (SM_N) across characters, summed
  const best = {};
  for (const i of ctx.s.charIdxs)
    for (const [id, lv] of Object.entries(ctx.s.at("SM_N", i) ?? {}))
      if (id !== "length" && N(lv) > (best[id] ?? 0)) best[id] = N(lv);
  return Object.values(best).reduce((a, b) => a + b, 0);
};
QTY[4] = (ctx) => QUEST_ORDER.reduce((t, q) => t + (ctx.s.charIdxs.some((i) => (ctx.s.at("QuestComplete_N", i) ?? {})[q] === 1) ? 1 : 0), 0);
QTY[5] = (ctx) => accountLevel(ctx);
QTY[6] = (ctx) => vals(g(ctx, "TaskZZ1")).reduce((t, row) => t + S(row), 0);                   // tasks completed
QTY[7] = (ctx) => vals(g(ctx, "AchieveReg")).filter((x) => x === -1).length;
QTY[8] = (ctx) => opt(ctx, 198);       // most money held (high-water, client-maintained)
QTY[9] = (ctx) => opt(ctx, 208);       // most spores held (high-water)
QTY[10] = (ctx) => vals(g(ctx, "Cards1")).filter((x) => String(x).startsWith("Trophy")).length;
QTY[11] = (ctx) => ctx.s.charIdxs.reduce((t, i) => {
  const lv = ctx.s.at("Lv0_N", i) ?? [];
  let c = 0; for (let b = 0; b < 21; b++) c += Math.max(0, N(lv[b + 1]));
  return t + c;
}, 0);                                  // total skill levels (21 skills x chars, verbatim loop)
QTY[12] = (ctx) => opt(ctx, 201);      // best spike trap round
QTY[13] = (ctx) => N((g(ctx, "TaskZZ0")[0] ?? [])[2]);
QTY[14] = (ctx) => opt(ctx, 172);      // shimmer island DPS
QTY[15] = null;                        // total star talent LVs (CB_TotalTalentPoints — unread)
QTY[16] = (ctx) => opt(ctx, 202) > 0 ? 1 / opt(ctx, 202) : 0;   // best crystal spawn chance
QTY[17] = null;                        // dungeon rank (runtime GenINFO — unread)
QTY[18] = (ctx) => opt(ctx, 200);      // highest drop rate (high-water)
QTY[19] = (ctx) => vals(g(ctx, "SSprog")).filter((r) => N(r?.[1]) === 1).length;   // constellations
QTY[20] = (ctx) => opt(ctx, 203);      // gravestone damage
QTY[21] = (ctx) => vals(g(ctx, "Cards1")).filter((x) => String(x).startsWith("Obol")).length;
QTY[22] = (ctx) => [0, 1, 2, 3].reduce((t, c) => t + S(g(ctx, "CauldronInfo")[c]), 0);   // bubble LVs
QTY[23] = (ctx) => S(g(ctx, "CauldronInfo")[4]);                                          // vial LVs
QTY[24] = (ctx) => {                    // sigil LVs: CauldronP2W[4][1+2g] + 1 each
  const p = vals(g(ctx, "CauldronP2W")[4]);
  let t = 0; for (let i = 0; i < Math.ceil(p.length / 2); i++) t += N(p[1 + 2 * i]) + 1;
  return t;
};
QTY[25] = (ctx) => opt(ctx, 199);      // arcade jackpots
QTY[26] = (ctx) => Math.round(N(ctx.s.get("CYDeliveryBoxComplete"))) + Math.round(N(ctx.s.get("CYDeliveryBoxStreak"))) + Math.round(N(ctx.s.get("CYDeliveryBoxMisc")));
QTY[27] = (ctx) => opt(ctx, 204); QTY[28] = (ctx) => opt(ctx, 205); QTY[29] = (ctx) => opt(ctx, 206);   // killroy
QTY[30] = (ctx) => 1e3 - opt(ctx, 207);   // fastest chaotic kill
QTY[31] = (ctx) => opt(ctx, 211); QTY[32] = (ctx) => opt(ctx, 212); QTY[33] = (ctx) => opt(ctx, 213);
QTY[34] = (ctx) => opt(ctx, 214); QTY[35] = (ctx) => opt(ctx, 215);   // printer samples
QTY[36] = (ctx) => opt(ctx, 209);      // best gorefest wave
QTY[37] = (ctx) => S(g(ctx, "TotemInfo")[0]);   // worship totem waves
QTY[38] = null;                        // death note kill digits (per-map kill scan — unread)
QTY[39] = (ctx) => Object.entries(ctx.s.get("WeeklyBoss") ?? {}).filter(([k, v]) => k.startsWith("d_") && v === -1).length;
QTY[40] = (ctx) => [3, 4, 5, 6, 7, 8].reduce((t, i) => t + N((g(ctx, "Refinery")[i] ?? [])[1]), 0);
QTY[41] = (ctx) => S(g(ctx, "Atoms"));
QTY[42] = null;                        // tower total levels (runtime GenINFO[111] — unread)
QTY[43] = (ctx) => {                   // Critter11A in storage
  const i = (ctx.s.get("ChestOrder") ?? []).indexOf("Critter11A");
  return i >= 0 ? N((ctx.s.get("ChestQuantity") ?? [])[i]) : 0;
};
QTY[44] = (ctx) => opt(ctx, 224);      // most greenstacks
QTY[45] = (ctx) => N((g(ctx, "Rift") ?? [])[0]);
QTY[46] = (ctx) => Math.max(0, ...vals(g(ctx, "Pets")).map((p) => N(p?.[2])), ...vals(g(ctx, "PetsStored")).map((p) => N(p?.[2])));
QTY[47] = (ctx) => 1e3 - opt(ctx, 220);   // fastest arena round-100
QTY[48] = (ctx) => { let t = 0; for (let k = 0; k < 10; k++) { const r = g(ctx, "Cooking")[k] ?? []; t += N(r[6]) + N(r[7]) + N(r[8]); } return t; };
QTY[49] = (ctx) => {                   // total shiny pet levels
  const br = g(ctx, "Breeding");
  let t = 0;
  for (let w = 0; w < PET_SHINY_SLOT.length; w++)
    for (let m = 0; m < PET_SHINY_SLOT[w].length; m++) {
      const xp = N((br[22 + w] ?? [])[m]);
      if (xp > 0) t += shinyLevel(xp);
    }
  return t;
};
QTY[50] = (ctx) => S((g(ctx, "Meals") ?? [])[0]);                                        // meal LVs
QTY[51] = null;                        // total breedability LVs (Breeding "2ndMulti" curve — unread)
QTY[52] = (ctx) => vals(g(ctx, "Lab")[15]).reduce((t, x) => t + Math.max(0, N(x)), 0);   // chips claimed
QTY[53] = (ctx) => S(ctx.s.get("FamValColosseumHighscores"));                            // colosseum score
QTY[54] = (ctx) => opt(ctx, 217);      // most giants in a week
/** ArbitraryCode("StatueOnyxOwned") verbatim: OptLacc[69] < 2 -> 0; else count StuG >= 2. */
QTY[55] = (ctx) => opt(ctx, 69) < 2 ? 0 : vals(g(ctx, "StuG")).filter((x) => N(x) >= 2).length;
QTY[56] = (ctx) => 1e3 - opt(ctx, 218);   // fastest 200 wurms
QTY[57] = (ctx) => vals(g(ctx, "Boats")).reduce((t, b) => t + N(b?.[3]) + N(b?.[5]), 0);
QTY[58] = (ctx) => Math.max(0, N(sel.divinity(ctx.s)[25]) - 10);   // divinity level - 10
QTY[59] = (ctx) => N((g(ctx, "GamingSprout")[28] ?? [])[1]);   // plants picked
QTY[60] = (ctx) => S((g(ctx, "Sailing") ?? [])[3]);            // artifact score (sum of tiers)
QTY[61] = (ctx) => N(((g(ctx, "Sailing") ?? [])[1] ?? [])[0]); // loot pile 0
QTY[62] = (ctx) => Math.max(0, ...vals(g(ctx, "Captains")).slice(0, 20).map((c) => N(c?.[3])));
QTY[63] = (ctx) => Math.max(N((g(ctx, "GamingSprout")[32] ?? [])[1]), opt(ctx, 210));   // snail
QTY[64] = (ctx) => N((g(ctx, "Gaming") ?? [])[8]);             // best nugget
QTY[65] = (ctx) => (ctx.s.get("Cards1") ?? []).length;         // items found
QTY[66] = (ctx) => N((g(ctx, "Gaming") ?? [])[0]);             // bits
QTY[67] = (ctx) => Math.pow(2, opt(ctx, 219));                 // highest crop OG
QTY[68] = (ctx) => Object.keys(ctx.s.get("FarmCrop") ?? {}).filter((k) => k !== "length").length;
QTY[69] = (ctx) => S((g(ctx, "Ninja") ?? [])[104]);            // beanstalk
QTY[70] = (ctx) => S((g(ctx, "Summon") ?? [])[0]);             // summoning upgrade LVs
QTY[71] = null;                        // summoning wins (runtime GenINFO[143][9] — unread)
QTY[72] = (ctx) => opt(ctx, 232) > 0 ? 12 * opt(ctx, 232) : null;   // endless round (else runtime floors)
QTY[73] = (ctx) => {                   // familiars owned, weighted (1,3,12,60,...)
  const s4 = (g(ctx, "Summon") ?? [])[4] ?? [];
  let t = 0, w = 1;
  for (let k = 0; k < 9; k++) { t += w * N(s4[k]); w *= k + 3; }
  return t;
};
QTY[74] = (ctx) => String(((g(ctx, "Ninja") ?? [])[102] ?? [])[9] ?? "").length;   // jade emporium
QTY[75] = (ctx) => [0, 1, 2, 3].reduce((t, i) => t + N((ctx.s.get("FamValMinigameHiscores") ?? [])[i]), 0) + opt(ctx, 99);
QTY[76] = (ctx) => S(g(ctx, "PrayersUnlocked"));               // total prayer LVs
QTY[77] = (ctx) => S((g(ctx, "FarmRank") ?? [])[0]);           // land ranks
QTY[78] = (ctx) => opt(ctx, 221);      // largest magic bean trade
QTY[79] = (ctx) => opt(ctx, 222);      // most balls from LBoFaF
QTY[80] = (ctx) => S(g(ctx, "ArcadeUpg"));
QTY[81] = (ctx) => Math.min(1500, vaultUpgBonus(ctx, 57));
QTY[82] = (ctx) => [65, 66, 67, 68, 69, 70].reduce((t, i) => t + N((g(ctx, "Holes")[11] ?? [])[i]), 0);   // gambit time
QTY[83] = (ctx) => vals(g(ctx, "Holes")[9]).reduce((t, x) => t + Math.ceil(Math.log10(Math.max(1, N(x)))), 0);
QTY[84] = (ctx) => vals(g(ctx, "Holes")[1]).reduce((t, x) => t + Math.round(Math.max(0, N(x))), 0);   // villagers
QTY[85] = (ctx) => opt(ctx, 262);
QTY[86] = (ctx) => opt(ctx, 279);
QTY[87] = (ctx) => N((g(ctx, "Holes")[11] ?? [])[73]);
QTY[88] = (ctx) => N((g(ctx, "Holes")[11] ?? [])[74]);
QTY[89] = (ctx) => N((g(ctx, "Holes")[11] ?? [])[75]);
QTY[90] = (ctx) => opt(ctx, 356);
QTY[91] = (ctx) => N((g(ctx, "Holes")[11] ?? [])[8]);
QTY[92] = (ctx) => [1, 3, 5, 7].reduce((t, i) => t + Math.round(Math.max(0, N((g(ctx, "Holes")[11] ?? [])[i]))), 0);
QTY[93] = (ctx) => vals(g(ctx, "Holes")[7]).reduce((t, x) => t + Math.round(Math.max(0, N(x))), 0);   // opals
QTY[94] = (ctx) => Math.round(Math.min(12, opt(ctx, 353))) + 1;
QTY[95] = (ctx) => Math.round(opt(ctx, 369));                  // emperor showdown
QTY[96] = null;                        // summoning stone trial kills (CB SumStoneTrialz — unread)
QTY[97] = (ctx) => [0, 1, 2, 3, 4, 5].reduce((t, i) => t + N((g(ctx, "Spelunk")[13] ?? [])[i]), 0);
QTY[98] = (ctx) => Math.max(0, ...vals(g(ctx, "Spelunk")[1]).map(N));
QTY[99] = (ctx) => S((g(ctx, "Ninja") ?? [])[103]);            // ninja upgrade LVs
QTY[100] = (ctx) => opt(ctx, 445);
QTY[101] = (ctx) => opt(ctx, 446);
QTY[102] = (ctx) => Math.max(0, ...vals(g(ctx, "Spelunk")[2]).map(N));
QTY[103] = (ctx) => vals(g(ctx, "Spelunk")[5]).reduce((t, x) => t + Math.max(0, N(x)), 0);
QTY[104] = (ctx) => ((g(ctx, "Spelunk") ?? [])[6] ?? []).length;
QTY[105] = (ctx) => perCharMax(ctx, "Lv0_N", (lv) => N((lv ?? [])[19]));
QTY[106] = (ctx) => opt(ctx, 443);
QTY[107] = (ctx) => vals(g(ctx, "Cards1")).filter((x) => String(x).startsWith("EquipmentNametag")).length;
QTY[108] = (ctx) => N(((g(ctx, "Bubba") ?? [])[1] ?? [])[8]);
QTY[109] = (ctx) => ((g(ctx, "Spelunk") ?? [])[46] ?? []).length;
QTY[110] = (ctx) => N((g(ctx, "Research")[7] ?? [])[4]);
QTY[111] = (ctx) => ((g(ctx, "Research") ?? [])[11] ?? []).length;
QTY[112] = (ctx) => vals(g(ctx, "Research")[9]).reduce((t, x) => t + Math.round(N(x)), 0);   // stickers
QTY[113] = (ctx) => opt(ctx, 498);
QTY[114] = (ctx) => vals(g(ctx, "Research")[0]).reduce((t, x) => t + Math.round(N(x)), 0);   // grid pts spent
QTY[115] = (ctx) => vals(g(ctx, "Research")[12]).reduce((t, x) => t + Math.round(Math.max(0, N(x))), 0);
QTY[116] = (ctx) => uniqueSushi(ctx);
QTY[117] = (ctx) => opt(ctx, 594);

/* --- curves + score -------------------------------------------------------- */
export const tomeLvReq = (pos) => 350 + 40 * pos + 5 * Math.max(0, pos - 35) + 10 * Math.max(0, pos - 60) + 10 * Math.max(0, pos - 80) + 15 * Math.max(0, pos - 100);

const log10 = (x) => Math.log(Math.max(1e-10, x)) / Math.LN10;
export function curvePct(row, qty) {
  const { x1, curve } = row;
  if (curve === 0) return qty < 0 ? 0 : Math.pow(1.7 * qty / (qty + x1), 0.7);
  if (curve === 1) return 2.4 * log10(qty) / (2 * log10(qty) + x1);
  if (curve === 2) return Math.min(1, qty / x1);
  if (curve === 3) return qty > 5 * x1 ? 0 : Math.pow(1.2 * (6 * x1 - qty) / (7 * x1 - qty), 5);
  if (curve === 4) { const m = Math.min(x1, qty); return Math.pow(2 * m / (m + x1), 0.7); }
  return 0;
}

/** Full per-row evaluation. Memoized per ctx. */
export function tomeRows(ctx) {
  if (ctx._tomeRows) return ctx._tomeRows;
  const acctLv = accountLevel(ctx);
  const rows = TOME_ROWS.map((row, i) => {
    const pos = TOME_ORDER.indexOf(i);
    const unlocked = acctLv >= tomeLvReq(pos);
    const qty = QTY[i] ? QTY[i](ctx) : null;
    const pts = unlocked && qty != null ? Math.ceil(curvePct(row, qty) * row.max) : 0;
    return { i, pos, name: row.name, max: row.max, unlocked, qty, pts, known: qty != null };
  });
  ctx._tomeRows = rows;
  return rows;
}

/** Per-curve maximum pct — the curves OVERCAP their x3 (type 0 asymptotes at 1.7^0.7≈1.4508,
 *  type 1 at 1.2, type 3 peaks at ~1.1513; 2 and 4 cap at 1). VALIDATED 2026-07-17: with
 *  the raw-x3 bound the in-game reading (44,931) exceeded our ceiling; with these it sits
 *  inside [floor 41,768, ceiling 45,956]. */
const CURVE_MAX = [Math.pow(1.7, 0.7), 1.2, 1, 1.1512569953, 1];

/** The Tome score as an honest FLOOR: unknown rows count 0; `maxExtra` bounds what they
 *  could add (curve-aware). Memoized per ctx. */
export function tomeScore(ctx) {
  if (ctx._tomeScore) return ctx._tomeScore;
  const rows = tomeRows(ctx);
  const value = rows.reduce((t, r) => t + r.pts, 0);
  const unknown = rows.filter((r) => !r.known && r.unlocked);
  const maxExtra = unknown.reduce((t, r) => t + Math.ceil((CURVE_MAX[TOME_ROWS[r.i].curve] ?? 1) * r.max), 0);
  ctx._tomeScore = { value, unknownRows: unknown.map((r) => r.name), maxExtra, floor: unknown.length > 0 };
  return ctx._tomeScore;
}

/** ctx.tomePoints resolution: explicit user value wins (exact); else the computed floor. */
export function getTomePoints(ctx) {
  if (ctx.tomePoints != null) return { value: ctx.tomePoints, exact: true };
  const s = tomeScore(ctx);
  return { value: s.value, exact: !s.floor, maxExtra: s.maxExtra };
}

/** Summoning("TomeBonus",b,0), verbatim. extra = 1 + (GrimoireUpgBonus(17) + TROLL_SET)/100.
 *  b: 0 = }x DMG (always), 1 = OptLacc[196]-gated, 2 = Drop Rate (OptLacc[197]-gated),
 *  6/7 = event-shop 0/27 gated multis; 3..5 read the W8/A9/M9 tome-bubbles (bubble family
 *  rows unread -> throws). Returns {value, status, note}. */
export function tomeBonus(ctx, b) {
  if (b >= 3 && b <= 5) throw new Error("TomeBonus(3..5): reads the W8/A9/M9 tome bubbles — bubble rows not implemented");
  const tp = getTomePoints(ctx);
  const pts = tp.value;
  const extra = 1 + (grimoireUpgBonus(ctx, 17) + setBonus(ctx, "TROLL_SET").value) / 100;
  const status = tp.exact ? "computed" : "partial";
  const note = `Tome score ${pts}${tp.exact ? "" : ` (floor; unknown rows could add up to ${tp.maxExtra} pts)`}`;
  let v = 0;
  if (b === 0) v = 10 * Math.pow(Math.floor(pts / 100), 0.7) * extra;
  else if (b === 1) v = opt(ctx, 196) === 1 ? 4 * Math.pow(Math.floor(Math.max(0, pts - 4e3) / 100), 0.7) * extra : 0;
  else if (b === 2) v = opt(ctx, 197) === 1 ? 2 * Math.pow(Math.floor(Math.max(0, pts - 8e3) / 100), 0.7) * extra : 0;
  else if (b === 6) v = eventShopOwned(ctx, 0) === 1 ? 4 * Math.pow(Math.floor(pts / 1e3), 0.4) * extra : 0;
  else if (b === 7) v = eventShopOwned(ctx, 27) === 1 ? 3 * Math.pow(Math.floor(pts / 1e3), 0.3) * extra : 0;
  return { value: v, status, note };
}
