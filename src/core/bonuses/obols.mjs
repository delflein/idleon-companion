/* bonuses/obols.mjs — obol stat aggregation (family + personal pages).
 *
 * The save stores each equipped obol's COMPUTED stat object directly (savemap character.mjs):
 *   ObolEqMAPz1  = the family/account obol page  (24 slots) — save key, sparse slotIndex->stats
 *   ObolEqMAP_N  = a character's personal obol page — per-character, sparse slotIndex->stats
 * A stat object holds direct keys (STR/AGI/WIS/LUK/Defence/Weapon_Power) and up to two UNIQUE
 * bonuses as {UQ1txt: statName, UQ1val: amount} / {UQ2txt, UQ2val}. This is the same shape the
 * IdleonToolbox obols parser reads (parsers/obols.ts, obolStats + UQ handling).
 *
 * The client folds obol unique stats into DNSM.TotalStatsETCmap during its "calcEtcBonuses" pass
 * (N.js:5556+), keyed by the unique stat's text; EtcBonuses(c) then looks that map up via
 * CustomMaps.IDforETCbonus[c] (N.js:9970 / 24604). For example IDforETCbonus["2"]="%_DROP_RATE".
 * That map ALSO folds in worn equipment unique stats, which the save does not expose as computed
 * objects — so an obol-only aggregate here is a LOWER BOUND on EtcBonuses (reported "partial").
 *
 * Direct STR/AGI/WIS/LUK etc. obol totals ARE complete from the save. */

import { sel } from "../savemap.mjs";

const DIRECT_STATS = new Set(["STR", "AGI", "WIS", "LUK", "Defence", "Weapon_Power"]);

/** Sum one obol page (a sparse slotIndex->statObj dict) for `statKey`, both direct and UNIQUE. */
function sumPage(page, statKey) {
  let v = 0;
  for (const slot of Object.keys(page ?? {})) {
    const o = page[slot];
    if (!o || typeof o !== "object") continue;
    if (DIRECT_STATS.has(statKey)) {
      v += Number(o[statKey] ?? 0);
    } else {
      if (o.UQ1txt === statKey) v += Number(o.UQ1val ?? 0);
      if (o.UQ2txt === statKey) v += Number(o.UQ2val ?? 0);
    }
  }
  return v;
}

/**
 * Total obol bonus for `statKey`. Family page always; the active character's personal page when
 * ctx.activeChar is set. Returns a fragment {value, status, note, parts}. Direct stats are
 * "computed"; unique/etc stats are "partial" (worn-equipment unique stats are not in the save).
 */
export function obolBonus(ctx, statKey) {
  const family = sel.obolMapFamily(ctx.s);
  const famVal = sumPage(family, statKey);
  let persVal = 0, persNote = "personal page not counted (no active character)";
  if (ctx.activeChar != null) {
    persVal = sumPage(sel.obolMapChar(ctx.s, ctx.activeChar), statKey);
    persNote = `personal page (char ${ctx.activeChar}) +${persVal}`;
  }
  const direct = DIRECT_STATS.has(statKey);
  return {
    value: famVal + persVal,
    status: direct ? "computed" : "partial",
    note: `obols "${statKey}": family +${famVal}, ${persNote}` + (direct ? "" : "; worn-equipment unique stats not in save -> lower bound"),
    parts: [
      { label: "Family obols", value: famVal },
      { label: "Personal obols", value: persVal, note: persNote },
    ],
  };
}

/** Family obol slots filled vs total (24), for a UI entity. */
export function obolSlots(ctx) {
  const family = sel.obolMapFamily(ctx.s);
  const filled = Object.keys(family ?? {}).length;
  return { filled, total: 24 };
}
