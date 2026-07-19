/* bonuses/thingies.mjs — _customBlock_Thingies: Legend Talents, the Tome (LoreEpiBon),
 * Emperor bonuses. */

import { sel } from "../savemap.mjs";
import { LEGEND_TALENT_COEFF, EMPEROR_BON_VAL, EMPEROR_BON_CYCLE } from "../gamedata.mjs";
import { arcadeBonusRaw, REINDEER_COMPANION } from "./arcade.mjs";
import { arcaneUpgBonus } from "./arcane.mjs";
import { setBonus, eventShopOwned } from "./misc.mjs";
import { companion } from "./companions.mjs";
import { clamWorkBonusNum } from "./clamwork.mjs";
import { uniqueSushi } from "./sushi.mjs";
import { SUSHI_ROG_FULL } from "../gamedata-w7-sushi.mjs";

/** Thingies("LegendPTS_bonus",b,0) = round(Spelunk[18][b] * CustomLists.LegendTalents[b][2]).
 *  Verbatim from N.js _customBlock_Thingies. Coeffs verified per-id in LEGEND_TALENT_COEFF. */
export function legendPts(ctx, id) {
  if (!(id in LEGEND_TALENT_COEFF)) throw new Error(`LegendPTS_bonus(${id}): LegendTalents[${id}][2] not verified in N.js — add to LEGEND_TALENT_COEFF first`);
  return Math.round(Number(sel.legendTalentLevels(ctx.s)[id] ?? 0) * LEGEND_TALENT_COEFF[id]);
}

/** Thingies("LegendPTS_spent",0,0), N.js byte 10709527, verbatim:
 *    round( sum(Spelunk[18][e] for e in 0..49) )
 *  = total Legend Talent points spent across all 50 slots (filler slots 40-49 are always 0). */
export function legendPtsSpent(ctx) {
  const lv = sel.legendTalentLevels(ctx.s);
  let sum = 0;
  for (let e = 0; e < 50; e++) sum += Number(lv[e] ?? 0);
  return Math.round(sum);
}

/** Thingies("LegendPTS_owned",0,0), N.js byte 10709854, verbatim (per-player StuffingDN loop +
 *  a fixed set of account bonuses):
 *    StuffingDN = sum over every character of max(0, floor((Lv0[0]-400)/100))   // class LV 500,600,.. give +1
 *    return round( StuffingDN
 *      + ClamWorkBonus(1) + ClamWorkBonus(4)                     // OptLacc[464] > b ? 1 : 0
 *      + SushiStuff("RoG_BonusQTY",19,0)                         // UniqueSushi>19 ? Research[37][19]=1 : 0
 *      + 10*Companions(37)
 *      + GemItemsPurchased[42]
 *      + min(6, round(Sailing[3][34]))
 *      + 2*Summoning("EventShopOwned",32,0) )
 *  Every input is save-derivable except Companions(37) (needs the _comp RTDB doc) -> "partial"
 *  when that companion's ownership is unknown. Returns a fragment {value,status,note,parts}. */
export function legendPtsOwned(ctx) {
  const stuffing = ctx.s.charIdxs.reduce(
    (a, ci) => a + Math.max(0, Math.floor((sel.charLevel(ctx.s, ci) - 400) / 100)), 0);
  const clam1 = clamWorkBonusNum(ctx, 1);
  const clam4 = clamWorkBonusNum(ctx, 4);
  const rog19 = uniqueSushi(ctx) > 19 ? (SUSHI_ROG_FULL[19]?.coeff ?? 0) : 0;
  const c37 = companion(ctx, 37);
  const gem42 = Number(sel.gemItemsPurchased(ctx.s)[42] ?? 0);
  const sail34 = Math.min(6, Math.round(Number(sel.artifactTiers(ctx.s)[34] ?? 0)));
  const evt32 = 2 * eventShopOwned(ctx, 32);
  const value = Math.round(stuffing + clam1 + clam4 + rog19 + 10 * c37.value + gem42 + sail34 + evt32);
  const known = c37.owned !== null;
  if (!known) ctx.unknown("Thingies LegendPTS_owned: Companions(37) needs the _comp RTDB doc; counted as 0");
  return {
    value, status: known ? "computed" : "partial",
    note: `class-LV pts ${stuffing} + clam(1,4) ${clam1 + clam4} + sushi19 ${rog19} + 10×Companions37 ${known ? 10 * c37.value : "?"} + gem42 ${gem42} + sail34 ${sail34} + 2×event32 ${evt32}`,
    parts: [
      { label: "class levels (500+)", value: stuffing, note: "Σ max(0, floor((classLv-400)/100))" },
      { label: "Clam Work job", value: clam1 + clam4, note: "ClamWorkBonus(1)+ClamWorkBonus(4)" },
      { label: "Sushi RoG #19", value: rog19, note: "UniqueSushi > 19" },
      { label: "Companions(37)", value: known ? 10 * c37.value : 0, note: known ? "" : "unknown (0)" },
      { label: "GemItemsPurchased[42]", value: gem42, note: "" },
      { label: "Sailing artifact #34", value: sail34, note: "min(6, round(Sailing[3][34]))" },
      { label: "EventShopOwned(32)", value: evt32, note: "2× owned" },
    ],
  };
}

/** Thingies("EmperorBon",b,0) = floor(acc[b] * (1 + (ArcaneUpgBonus(48) + ArcadeBonus(51))/100))
 *  acc built by cycling OptLacc[369] emperor wins through a 48-long slot table.
 *  (Slot 8 = "}x_Summoning_Winner_Bonuses", 11 = "+{%_Drop_Rate" — see EMPEROR_BON_NAMES.)
 *  NOTE a deliberate divergence from the old artifactchance.mjs: ArcadeBonus(51) here now
 *  resolves the Spirit Reindeer doubling from ctx.companions like every other arcade call —
 *  the old code hardcoded "no reindeer" inside this term, which was client-unfaithful. */
export function emperorBon(ctx, slot) {
  const wins = Number((ctx.s.get("OptLacc") ?? [])[369] ?? 0);
  const acc = new Array(12).fill(0);
  for (let g = 0; g < wins; g++) {
    const sl = EMPEROR_BON_CYCLE[g % 48];
    acc[sl] += EMPEROR_BON_VAL[sl] ?? 0;
  }
  const reindeer = ctx.companions ? ctx.companions.has(REINDEER_COMPANION) : false;
  const arcade51 = arcadeBonusRaw(ctx.s, 51, reindeer);
  return Math.floor(acc[slot] * (1 + (arcaneUpgBonus(ctx, 48) + arcade51) / 100));
}

/** Thingies("FriendBonusStatz",b,0) — the Codex friend bonuses. Verbatim:
 *   OptLacc[476] = "bonusId,points;bonusId,points;..." — one entry per friend slot.
 *   For the first min(FriendBonusSlots, entries) entries with bonusId < 18:
 *     FrendBonzStatz[bonusId] = FriendBonusQTY(bonusId, points)
 *   FriendBonusQTY(b, e) = COEFF[b] * min(1.5, 0.25 + min(3e4,max(0,e)) / (min(3e4,max(0,e)) + 12e3) * 1.5)
 *     with COEFF = [100, 30, 50, 25, 30, 40, 10] for b = 0..6 (b=3 is the Drop Rate one).
 *   FriendBonusSlots = round(min(20, 2 + Companions(44) + 2*Companions(30) + EventShopOwned(22)))
 *   Result is multiplied by FriendBonusXtraMulti = 1 + Companions(30)  (Poppy doubles it). */
const FRIEND_COEFF = [100, 30, 50, 25, 30, 40, 10];
export function friendBonusStat(ctx, b) {
  const entries = String((ctx.s.get("OptLacc") ?? [])[476] ?? "").split(";").filter(Boolean);
  if (!entries.length) return { value: 0, note: "no Codex friends (OptLacc[476] empty)" };
  const c44 = companion(ctx, 44), c30 = companion(ctx, 30);
  const partial = c44.owned === null;
  const shop22 = eventShopOwned(ctx, 22) ?? 0;
  const slots = Math.round(Math.min(20, 2 + c44.value + 2 * c30.value + shop22));
  let v = 0;
  for (const ent of entries.slice(0, slots)) {
    const [id, pts] = ent.split(",").map(Number);
    if (id !== b || id >= 18) continue;
    const e = Math.min(3e4, Math.max(0, pts || 0));
    v = (FRIEND_COEFF[b] ?? 0) * Math.min(1.5, 0.25 + e / (e + 12e3) * 1.5);
  }
  const mult = 1 + c30.value;
  return {
    value: v * mult,
    status: partial ? "partial" : "computed",
    note: `${entries.length} friends, ${slots} slots${partial ? " (companions unknown -> slot floor)" : ""}; ` +
      `slot value ${v.toFixed(2)} x XtraMulti ${mult} (Companions(30)=${c30.value})`,
  };
}

/** Thingies("LoreEpiBon",b,0), verbatim from the DNSM.LoreEpiBon builder:
 *    for g in 0..CustomLists.Spelunky[20].length:
 *      Spelunk[13][2] > g
 *        ? push( (1 + (GrimoireUpgBonus(17) + GetSetBonus("TROLL_SET","Bonus",0,0))/100)
 *                * Number(Spelunky[21][g].split("|")[0])
 *                * max(0, X^0.7 / (25 + X^0.7)) )      // X = floor(max(0, GenInfo[84]-thr)/100)
 *        : push(0)
 *  Spelunky[20]/[21] rows verified per-id in LOREEPI (e.g. [3] = "}x|Artifact_Find", "100|3000").
 *  GrimoireUpg[17] = "Grey_Tome_Book" coeff 1 ("}x_higher_bonuses_from_the_Tome"), and
 *  TROLL_SET's bonus is "}x_Higher_Bonuses_from_Tome" — both flavour texts agree this is the
 *  Tome-bonus multiplier, a good independent check that we are reading the right knobs.
 *
 *  X is driven by GenInfo[84] = the TOME SCORE (`GenInfo[84] = TomeQTYtot`, the sum of
 *  Summoning("TomePTS",g,0) over all 118 Tome rows). We do NOT reimplement that: it is 118
 *  bespoke per-row stat lookups across the whole account, a lot of surface to get subtly wrong
 *  for a term that is hard-bounded anyway. The score is an explicit input (ctx.tomePoints — the
 *  game prints it as "<N>_PTS" on the Tome page); without it the term is unknown WITH its real
 *  bounds: the ratio is monotonic in the score and sum(Tome[b][3]) = 49695 is the maximum any
 *  account can score. That bound is what ruled LoreEpiBon out as artifact-chance's missing
 *  factor. */
export const LOREEPI = { 3: { base: 100, threshold: 3000, label: "Artifact_Find" } };
const LOREEPI_EXP = 0.7, LOREEPI_SOFT = 25, TOME_GRIMOIRE_UPG = 17;
export const TOME_MAX_SCORE = 49695;
export const loreEpiRatio = (tomePts, threshold) => {
  const x = Math.pow(Math.floor(Math.max(0, tomePts - threshold) / 100), LOREEPI_EXP);
  return Math.max(0, x / (LOREEPI_SOFT + x));
};

/** Thingies("LoreEpiBon",b,0) as a fragment (a PERCENT; recipes wrap it 1+v/100). */
export function loreEpiBon(ctx, b) {
  const row = LOREEPI[b];
  if (!row) throw new Error(`LoreEpiBon(${b}): Spelunky[20/21][${b}] not verified in N.js — add to LOREEPI first`);
  if (sel.loreEpicUnlocked(ctx.s) <= b)
    return { value: 0, note: `Spelunk[13][2]=${sel.loreEpicUnlocked(ctx.s)} <= ${b} -> entry not unlocked, pushes 0` };
  const grim = sel.grimoireLv(ctx.s, TOME_GRIMOIRE_UPG);
  const troll = setBonus(ctx, "TROLL_SET");
  const scale = (1 + (grim + troll.value) / 100) * row.base;
  if (ctx.tomePoints == null) {
    const cap = scale * loreEpiRatio(TOME_MAX_SCORE, row.threshold);
    ctx.unknown(`Thingies("LoreEpiBon",${b},0) — needs the Tome score (GenInfo[84]); pass tomePoints ` +
      `(the game prints it as "<N>_PTS" on the Tome page). BOUNDED: 0 .. ${cap.toFixed(1)}% ` +
      `(upper bound uses the maximum score any account can reach, ${TOME_MAX_SCORE})`);
    return {
      value: 0, status: "unknown",
      note: `Tome score unknown -> in [0%, ${cap.toFixed(1)}%]; scale = (1 + (Grimoire[17]=${grim} + TROLL_SET=${troll.value})/100) x ${row.base} = ${scale.toFixed(1)}`,
    };
  }
  const v = scale * loreEpiRatio(ctx.tomePoints, row.threshold);
  return {
    value: v, status: troll.known && !ctx.tomePointsFloor ? "computed" : "partial",
    note: `Tome score ${ctx.tomePoints}${ctx.tomePointsFloor ? " (computed FLOOR — unknown Tome rows would raise this)" : ""} -> ratio ${loreEpiRatio(ctx.tomePoints, row.threshold).toFixed(4)}; scale ${scale.toFixed(1)} (Grimoire[17]=${grim}, ${troll.why})`,
  };
}
