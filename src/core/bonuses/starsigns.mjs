/* bonuses/starsigns.mjs — star sign activity, the canonical ACTIVE-CHARACTER dependency.
 *
 * `_customBlock_StarSigns` (N.js ~9861) builds StarSignsDL as a UNION:
 *     StarSignsDL = PersonalValuesMap.StarSign.split(",")          // active char's equipped
 *     for (f=0, g=RiftStuff("enabledStarSigns",0)|0; f<g;) {       // ...THEN append
 *       var k=f++;
 *       if (k < CustomLists.StarSigns.length && StarSignsUnlocked.hasOwnProperty(StarSigns[k][0]))
 *         StarSignsDL.push(""+k);
 *     }
 * So a sign is ACTIVE iff (the active character has it equipped) OR (its LIST INDEX is inside
 * the Infinite Star Signs window AND it is unlocked). The window covers the FIRST N signs BY
 * INDEX, permanently, regardless of who is playing — the normal endgame state.
 * N = RiftStuff("enabledStarSigns",0) = `Rift[0] < 10 ? 0 : 5 + Breeding("ShinyBonusS","Nah",3,-1)`
 * (verified in _customBlock_RiftStuff) — Rift-gated, then driven by shiny pets (bonus 3, 2/lv).
 * `StarSignsUnlocked` is save key `StarSg` (verified: `addSaveEntryMap("StarSg", ...)`), an
 * 80-entry dict keyed by star sign NAME.
 *
 * Per-sign VALUES are hardcoded in the client's StarSigns builder (e.g.
 * `StarSigns["61"] = 15 + StarSigns["61"]` — a flat addend, no multiplier chain). Only the signs
 * listed in SIGN_NAME/SIGN_FLAT below are verified; add entries as they are read in N.js. */

import { sel } from "../savemap.mjs";
import { shinyBonus } from "./breeding.mjs";
import { chipBonusesOf } from "./chips.mjs";

/** RiftStuff("enabledStarSigns",0). */
const INFINITE_SIGNS_RIFT_LV = 10, INFINITE_SIGNS_BASE = 5, SHINY_STARSIGN_BONUS = 3;
export function enabledStarSigns(ctx) {
  if (Number((sel.rift(ctx.s) ?? [])[0] ?? 0) < INFINITE_SIGNS_RIFT_LV) return 0;
  return INFINITE_SIGNS_BASE + shinyBonus(ctx, SHINY_STARSIGN_BONUS).value;
}

/** CustomLists.StarSigns[idx][0] for verified signs — StarSg is keyed by NAME. */
export const SIGN_NAME = {
  14: "Pirate_Booty", 61: "Artifosho", 76: "Druipi_Major",
  /* Farming signs (ka.StarSigns rows @N.js:23072-23073; builder arms @9899 write DNSM keys
   * "65"/"66"/"67" — the DNSM key IS the list index): */
  65: "Cropiovo_Minor", 66: "Fabarmi", 67: "O.G._Signalais",
  /* Class-EXP (StarSigns.MainXP) and Skill-EXP (StarSigns.SkillEXP) signs — the builder writes
   * those aggregate keys from these guarded arms (verified by scanning _customBlock_StarSigns,
   * names cross-checked against website-data.json star-sign list indices):
   *   MainXP:   2 The_Book_Worm (+1), 24 The_Big_Brain (+3), 52 Big_Brain_Major (+6, if Lv>79)
   *   SkillEXP: 30 Sir_Savvy (+3),      50 Sir_Savvy_Major (+6, if Lv>69) */
  2: "The_Book_Worm", 24: "The_Big_Brain", 52: "Big_Brain_Major",
  30: "Sir_Savvy", 50: "Sir_Savvy_Major",
  /* Town-skill-speed sign — builder arm `if(D.contains(StarSignsDL,"23")) TownSkillSpd += 10`
   * (N.js:9876); "+10%_Speed_in_Town" in the ka.StarSigns table (index 23, adjacent to 24
   * The_Big_Brain above). Feeds SkillStats("TownProdSpeedPCT") -> anvil production speed. */
  23: "Bob_Build_Guy",
};
/** The flat addend the builder hardcodes for the sign (checked: no multiplier chain). */
export const SIGN_FLAT = {
  14: 5, 61: 15, 76: 12,
  65: 3,    // +3% Crop Evo PER FARMING LV (the xLv0[16] lives at the consumer, FarmingStuffs)
  66: 20,   // +20% Farming EXP
  67: 15,   // +15% OG Chance
  2: 1, 24: 3, 52: 6,   // Class EXP (MainXP)
  30: 3, 50: 6,          // Skill EXP (SkillEXP)
  23: 10,                // Speed in Town (TownSkillSpd += 10)
};

/**
 * DNSM.StarSigns[idx] VALUE for the ctx (the flat addend, doubled by the Silkrode Nanochip
 * second pass when the ACTIVE character both has the sign equipped and carries a "star" chip).
 * The nanochip pass re-adds equipped signs only — Infinite-window signs are not re-doubled
 * unless also equipped. Returns a fragment; status "unknown" when activity can't be resolved.
 */
export function starSignValue(ctx, idx) {
  const a = starSignActive(ctx, idx);
  if (a.active === null) return { value: 0, status: "unknown", note: a.why };
  if (!a.active) return { value: 0, status: "computed", note: a.why };
  let v = SIGN_FLAT[idx];
  let chipNote = "";
  if (ctx.activeChar != null) {
    const equipped = sel.hasStarSign(ctx.s, ctx.activeChar, idx);
    const chip = chipBonusesOf(ctx.s, ctx.activeChar, "star");
    if (equipped && chip > 0) { v *= 2; chipNote = "; x2 Silkrode Nanochip (equipped sign + star chip)"; }
  }
  return { value: v, status: "computed", note: a.why + chipNote };
}

/** DNSM.StarSigns["Drop"] — scanned the ENTIRE hardcoded builder (all 69 sign arms):
 *  exactly two signs write the "Drop" key: 14 Pirate_Booty (+5) and 76 Druipi_Major (+12). */
export const DROP_KEY_SIGNS = [14, 76];
export function starSignDropKey(ctx) {
  let v = 0;
  const parts = [];
  let anyUnknown = false;
  for (const idx of DROP_KEY_SIGNS) {
    const a = starSignActive(ctx, idx);
    if (a.active === null) { anyUnknown = true; parts.push({ label: SIGN_NAME[idx], value: 0, note: a.why }); continue; }
    const add = a.active ? SIGN_FLAT[idx] : 0;
    v += add;
    parts.push({ label: SIGN_NAME[idx], value: add, note: a.why });
  }
  return { value: v, status: anyUnknown ? "partial" : "computed", note: parts.map((p) => `${p.label}: +${p.value}`).join(", "), parts };
}

/**
 * Sum the flat addends of the given star signs into one aggregate DNSM key (the client's
 * StarSigns.MainXP / StarSigns.SkillEXP builders). `signs` = [{idx, gateLv?}]; a sign with a
 * `gateLv` only contributes when the ACTIVE character's level exceeds it (Big Brain Major /
 * Sir Savvy Major). Returns a fragment {value, status, note, parts}. Mirrors starSignDropKey.
 */
function starSignSumKey(ctx, signs) {
  let v = 0, anyUnknown = false;
  const parts = [];
  for (const { idx, gateLv } of signs) {
    const a = starSignActive(ctx, idx);
    if (a.active === null) { anyUnknown = true; parts.push({ label: SIGN_NAME[idx], value: 0, note: a.why }); continue; }
    let add = a.active ? SIGN_FLAT[idx] : 0;
    let why = a.why;
    if (add > 0 && gateLv != null) {
      const lv = ctx.activeChar == null ? 0 : Number((ctx.s.at("Lv0_N", ctx.activeChar) ?? [])[0] ?? 0);
      if (!(lv > gateLv)) { add = 0; why += `; but active char level ${lv} <= ${gateLv} gate`; }
      else why += `; level ${lv} > ${gateLv} gate`;
    }
    v += add;
    parts.push({ label: SIGN_NAME[idx], value: add, note: why });
  }
  return { value: v, status: anyUnknown ? "partial" : "computed", note: parts.map((p) => `${p.label}: +${p.value}`).join(", "), parts };
}

/** StarSigns.MainXP — the Class-EXP star signs (Book Worm +1, Big Brain +3, Big Brain Major +6 if Lv>79). */
export function starSignClassXp(ctx) {
  return starSignSumKey(ctx, [{ idx: 2 }, { idx: 24 }, { idx: 52, gateLv: 79 }]);
}

/** StarSigns.SkillEXP — the Skill-EXP star signs (Sir Savvy +3, Sir Savvy Major +6 if Lv>69). */
export function starSignSkillXp(ctx) {
  return starSignSumKey(ctx, [{ idx: 30 }, { idx: 50, gateLv: 69 }]);
}

/**
 * Is star sign `idx` active? -> { active: true|false|null, why }
 * null = depends on the active character and ctx.activeChar was not supplied; the caller must
 * report unknown, never guess. Flags ctx.unknown itself in that case.
 */
export function starSignActive(ctx, idx) {
  const name = SIGN_NAME[idx];
  if (!name) throw new Error(`star sign ${idx}: name not verified in N.js — add to SIGN_NAME first`);
  const unlocked = new Set(Object.keys(ctx.s.get("StarSg") ?? {})).has(name);
  const n = enabledStarSigns(ctx);
  if (idx < n) {
    return {
      active: unlocked,
      why: `Infinite Star Signs: enabledStarSigns=${n} > ${idx}, StarSg${unlocked ? " has" : " LACKS"} "${name}"` +
        ` -> sign ${idx} ${unlocked ? "permanently active (character-independent)" : "not unlocked"}`,
    };
  }
  // Not covered by the infinite window -> back to "whoever is active".
  if (ctx.activeChar == null) {
    const cands = sel.charsWithStarSign(ctx.s, idx);
    ctx.unknown(`StarSigns[${idx}] ${name} — enabledStarSigns=${n} does not reach index ${idx}, so this ` +
      `depends on the ACTIVE character, which is not in the save; pass activeChar` +
      ` (equipped on character(s) [${cands.join(",")}])`);
    return { active: null, why: `enabledStarSigns=${n} <= ${idx}; equipped on character(s) [${cands.join(",")}]` };
  }
  const has = sel.hasStarSign(ctx.s, ctx.activeChar, idx);
  return {
    active: has,
    why: `enabledStarSigns=${n} <= ${idx}; character ${ctx.activeChar} ${has ? "has" : "does not have"} ${name} equipped`,
  };
}

/** Does this save even NEED an active character to resolve sign `idx`? (For recipes'
 *  activeCharSensitive: false once the Infinite window covers the sign.) */
export function signIsCharDependent(s, idx) {
  const ctx = { s, unknown() {}, companions: null };   // shinyBonus needs no companions
  return !(idx < enabledStarSigns(ctx));
}
