/* bonuses/bubbles.mjs — AlchBubbles[key]: alchemy bubble bonuses, now a fully generic
 * table-driven path over gamedata-w2-bubbles.mjs BUBBLE_TABLE (140 verified rows, 0 mismatches
 * vs N.js). This is the same evolution stamps.mjs went through once its full table existed.
 *
 * ── Client, AlchBubbles BUILDER LOOP (N.js:6160-6169) + CauldronStats("BubbleBonus") (N.js:7333) ──
 * For every cauldron 0..3 and bubble B (=idx) with CauldronInfo[cauldron][B] > 0, key = row[15]:
 *   1) base   = ArbitraryCode5Inputs(func, x1, x2, level)                         // growth curve
 *   2) prisma = isSuper ? max(1, ArcaneType("PrismaBonusMult")) : 1               // CauldronStats
 *        isSuper = OptLacc[384] contains Number2Letter[cauldron]+idx+","
 *   AlchBubbles[key] = base * prisma, then the builder multiplies on:
 *   3) MinEff *= getLOG(PlayerHPmax()); ChopEff *= getLOG(PlayerMPmax())          // 2 special keys
 *   4) CLASS ARM (cauldron 0/1/2 only; key has none of passz/ACTIVE/AllCharz; class>6; B!=16; B<30):
 *        c0 class<18 (& key!="Construction") *= max(1, Opassz);  c1 18<=class<30 *= max(1, Gpassz);
 *        c2 30<=class<42 *= max(1, Ppassz).   Cauldron 3 (yellow): no class arm ever.
 *   5) SECONDARY MULTI (cauldron 0/1/2 only): c0 B in {0,2,4,7,14} *= max(1,MultiOr);
 *        c1 B in {0,6,9,12,14} *= max(1,MultiGr);  c2 B in {0,2,6,12,14} *= max(1,MultiPu).
 *   6) TOME STACKS: keys W8/A9/M9/W10AllCharz/A10AllCharz/M10AllCharz *= floor(max(0,(tome-5000)/2000)).
 *      Y6 (Cropius Mapper) *= Σ over all characters of cleared W6 map portals (a DIFFERENT stack).
 *   equip: non-ACTIVE keys apply passively (always "equipped"); ACTIVE keys need Companions(4)==1
 *      OR CauldronBubbles[activeChar] contains Number2Letter[cauldron]+idx.
 *
 * HONESTY: ArcaneType("PrismaBonusMult") has no evaluator in this repo (arcane.mjs is verified-ids
 * only), so a PRISMA-flagged bubble omits that >=1x multiplier and reports `partial` (lower bound).
 * The MinEff/ChopEff getLOG factors need PlayerHPmax/MPmax (a runtime stat stack not in the save) —
 * also omitted (lower bound). The class arm needs the ACTIVE character's class; with no active char
 * it is omitted (lower bound). Everything else (base, secondary multi, both stack counts, prisma
 * detection, ACTIVE-equip when derivable) is computed from the save.
 *
 * REGRESSION-SAFE: DropRate (cauldron3 idx1, yellow), Y6 (cauldron3 idx25, yellow, w6-map stacks),
 * W10AllCharz (cauldron0 idx29 — "AllCharz" key, so EXCLUDED from the class arm; idx29 not in the
 * secondary-multi set) each land on exactly `base * stacks` as before — none is subject to the
 * class/secondary arms, so the generic path reproduces their prior values identically. */

import { sel } from "../savemap.mjs";
import { NUMBER_2_LETTER } from "../gamedata.mjs";
import { BUBBLE_TABLE, CAULDRON_NAMES } from "../gamedata-w2-bubbles.mjs";
import { arbitraryCode5, getLOG } from "./util.mjs";
import { getTomePoints } from "./tome.mjs";

/** KEY -> {cauldron, idx, row}. First occurrence wins (cauldron 2's two filler rows share key
 *  "M14" verbatim in N.js — the filler bubbles carry no real bonus, so the first is fine). */
const KEY_INDEX = {};
BUBBLE_TABLE.forEach((cauldron, ci) =>
  cauldron.forEach((row) => { if (!(row.key in KEY_INDEX)) KEY_INDEX[row.key] = { cauldron: ci, idx: row.idx, row }; }));

/** Secondary multi-arm index sets + the driving bubble key, per cauldron (N.js:6168-6169). */
const SECONDARY = {
  0: { set: new Set([0, 2, 4, 7, 14]), key: "MultiOr" },
  1: { set: new Set([0, 6, 9, 12, 14]), key: "MultiGr" },
  2: { set: new Set([0, 2, 6, 12, 14]), key: "MultiPu" },
};
/** Class-arm ranges + passz bubble key, per cauldron (N.js:6164). Cauldron 3 has none. */
const CLASS_ARM = {
  0: { lo: 7, hi: 18, passz: "Opassz" },
  1: { lo: 18, hi: 30, passz: "Gpassz" },
  2: { lo: 30, hi: 42, passz: "Ppassz" },
};
const TOME_STACK_KEYS = new Set(["W8", "A9", "M9", "W10AllCharz", "A10AllCharz", "M10AllCharz"]);
const isActiveKey = (key) => key.indexOf("ACTIVE") !== -1;
const num = (x) => Number(x) || 0;

/** Bubble level = CauldronInfo[cauldron][idx] (array or dict). */
export function bubbleLevel(ctx, cauldron, idx) {
  const c = (ctx.s.get("CauldronInfo") ?? [])[cauldron];
  return num(Array.isArray(c) ? c[idx] : c?.[String(idx)]);
}

/** OptLacc[384] prisma flag for cauldron/idx: contains Number2Letter[cauldron]+idx+",". */
function isPrisma(ctx, cauldron, idx) {
  return String((ctx.s.get("OptLacc") ?? [])[384] ?? "").indexOf(NUMBER_2_LETTER[cauldron] + String(idx) + ",") !== -1;
}

/** CauldronStats("BubbleBonus") = base growth curve (prisma multiplier omitted, flagged). */
function bubbleBase(ctx, cauldron, idx, row, level) {
  let v = arbitraryCode5(row.func, row.x1, row.x2, level);
  let prismaOmitted = false;
  if (isPrisma(ctx, cauldron, idx)) prismaOmitted = true;   // multiplier >=1x unread -> lower bound
  return { v, prismaOmitted };
}

/** The Y6 stack count: Σ over characters of cleared W6 map portals (maps 251..263). */
export function w6MapStacks(ctx) {
  let n = 0;
  for (const i of ctx.s.charIdxs) {
    const kla = ctx.s.at("KLA_N", i) ?? [];
    for (let g = 0; g < 13; g++) if (num((kla[251 + g] ?? [])[0] ?? 1) < 1) n++;
  }
  return n;
}

/** tome-derived stack count, shared by W8/A9/M9/*10AllCharz. Returns {stacks, exact}. */
function tomeStacks(ctx) {
  const tp = getTomePoints(ctx);
  return { stacks: Math.floor(Math.max(0, (tp.value - 5000) / 2000)), exact: tp.exact, pts: tp.value };
}

/** Whether an ACTIVE bubble is equipped: {equipped: true|false|null, note}. */
function equipState(ctx, cauldron, idx, key) {
  if (!isActiveKey(key)) return { equipped: true, note: "passive (always applies)" };
  const comp4 = ctx.companions ? ctx.companions.has(4) : null;
  if (comp4 === true) return { equipped: true, note: "Companions(4) universal unlock" };
  const ci = ctx.activeChar;
  if (ci == null) return { equipped: null, note: "ACTIVE bubble; no active character to check equip" };
  const cb = (ctx.s.get("CauldronBubbles") ?? [])[ci];
  const token = NUMBER_2_LETTER[cauldron] + String(idx);
  let eq;
  if (Array.isArray(cb)) eq = cb.map(String).includes(token);
  else eq = String(cb ?? "").indexOf(token) !== -1;
  return { equipped: eq, note: eq ? "equipped on active char" : "not equipped on active char" };
}

/**
 * The AlchBubbles builder value for one cauldron/idx (before the equip gate). Applies prisma
 * (omitted/flagged), getLOG special-cases, the class arm, secondary multi, and stack counts.
 * opts.ignoreClassArm skips the per-character class arm (for account-wide entity display).
 * Returns { value, status, note, prismaOmitted }.
 */
function builderValue(ctx, cauldron, idx, opts = {}) {
  const row = BUBBLE_TABLE[cauldron][idx];
  const key = row.key;
  const level = bubbleLevel(ctx, cauldron, idx);
  if (!(level > 0)) return { value: 0, status: "computed", note: `${row.internalName} not leveled` };

  const { v: base, prismaOmitted } = bubbleBase(ctx, cauldron, idx, row, level);
  let v = base;
  let partial = prismaOmitted;
  const notes = [`lv${level} -> ${row.func}(${row.x1},${row.x2})=${base.toFixed(2)}`];

  // getLOG special-cases (need PlayerHPmax/MPmax, not in the save) — omitted, lower bound.
  if (key === "MinEff" || key === "ChopEff") {
    partial = true;
    ctx.unknown(`AlchBubbles["${key}"] scales by getLOG(Player${key === "MinEff" ? "HP" : "MP"}max()) — stat stack not in the save; factor omitted (lower bound)`);
    notes.push("getLOG(HP/MP) omitted");
  }

  // CLASS ARM
  const arm = CLASS_ARM[cauldron];
  const armEligible = arm && idx !== 16 && idx < 30 && !/passz|ACTIVE|AllCharz/.test(key) && !(cauldron === 0 && key === "Construction");
  if (armEligible && !opts.ignoreClassArm) {
    const ci = ctx.activeChar;
    if (ci == null) {
      partial = true;
      ctx.unknown(`AlchBubbles["${key}"] can take the ${arm.passz} class-arm multiplier — needs the active character's class; omitted (lower bound)`);
      notes.push(`${arm.passz} class-arm omitted (no active char)`);
    } else {
      const cls = sel.characterClass(ctx.s, ci);
      if (cls > 6 && cls >= arm.lo && cls < arm.hi) {
        const passz = passzMult(ctx, arm.passz);
        v *= passz; notes.push(`x${passz.toFixed(3)} ${arm.passz}`);
      }
    }
  } else if (armEligible && opts.ignoreClassArm) {
    notes.push(`${arm.passz} class-arm (per-char) not in account view`);
  }

  // SECONDARY MULTI (account-wide)
  const sec = SECONDARY[cauldron];
  if (sec && sec.set.has(idx)) {
    const m = passzMult(ctx, sec.key);   // MultiOr/Gr/Pu bubbles, same builder, no arms
    v *= m; notes.push(`x${m.toFixed(3)} ${sec.key}`);
  }

  // STACK COUNTS
  if (TOME_STACK_KEYS.has(key)) {
    const t = tomeStacks(ctx);
    v *= t.stacks; notes.push(`x${t.stacks} tome stacks (${Math.round(t.pts)} pts${t.exact ? "" : ", est"})`);
    if (!t.exact) partial = true;
  } else if (key === "Y6") {
    const s = w6MapStacks(ctx);
    v *= s; notes.push(`x${s} W6-map stacks`);
  }

  return { value: v, status: partial ? "partial" : "computed", note: notes.join("; "), prismaOmitted };
}

/** max(1, AlchBubbles[passzKey]) — the passz/MultiX bubble's own value (no arms on those). */
function passzMult(ctx, passzKey) {
  const loc = KEY_INDEX[passzKey];
  if (!loc) return 1;
  const level = bubbleLevel(ctx, loc.cauldron, loc.idx);
  if (!(level > 0)) return 1;
  const { v } = bubbleBase(ctx, loc.cauldron, loc.idx, loc.row, level);
  return Math.max(1, v);
}

/**
 * AlchBubbles[key] as a fragment (a PERCENT for most keys). Generic over ALL 140 bubble rows.
 * Applies the equip gate for ACTIVE keys (0 when not equipped / equip-unknown).
 */
export function alchBubble(ctx, key) {
  const loc = KEY_INDEX[key];
  if (!loc) throw new Error(`AlchBubbles["${key}"]: no bubble row has key "${key}" in BUBBLE_TABLE`);
  const eq = equipState(ctx, loc.cauldron, loc.idx, key);
  if (eq.equipped === false) return { value: 0, status: "computed", note: `${key}: ${eq.note}` };
  const b = builderValue(ctx, loc.cauldron, loc.idx);
  if (eq.equipped === null) {
    ctx.unknown(`AlchBubbles["${key}"] is ACTIVE — equip state not derivable (no active char / CauldronBubbles); reported as 0 (lower bound)`);
    return { value: 0, status: "partial", note: `${key}: ${eq.note} -> 0 (would be ${b.value.toFixed(2)} if equipped)` };
  }
  return { value: b.value, status: b.status, note: `${key}: ${b.note}${isActiveKey(key) ? ` (${eq.note})` : ""}` };
}

/**
 * Per-bubble entity row for the W2 page: account-wide view (class arm omitted, since it is
 * per-character). ACTIVE bubbles show their "if equipped" value with an equip note.
 */
export function bubbleEntry(ctx, cauldron, idx) {
  const row = BUBBLE_TABLE[cauldron][idx];
  const level = bubbleLevel(ctx, cauldron, idx);
  const b = builderValue(ctx, cauldron, idx, { ignoreClassArm: true });
  return {
    idx, key: row.key, name: prettyName(row.internalName),
    cauldron, cauldronName: CAULDRON_NAMES[cauldron],
    level, active: isActiveKey(row.key), filler: !!row.filler,
    bonus: Math.round(b.value * 100) / 100, status: b.status,
  };
}

const prettyName = (internal) => String(internal).split("_").map((w) => w ? w[0] + w.slice(1).toLowerCase() : w).join(" ");
