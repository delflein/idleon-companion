/* bonuses/research.mjs — ResearchStuff(...): the W7 research grid.
 *
 * ResearchStuff("Grid_Bonus",b,e) — the `e` param is NOT a flag, it selects a whole different
 * return. `0==e` is the bonus; `1==e` returns `Math.round(Research[0][b])`, i.e. the raw NODE
 * LEVEL, not a bonus at all; `2==e` is a third, display-oriented set of special cases (the one
 * used here: Grid_Bonus(68,2) = Grid_Bonus(68,0) * Research[11].length — see farming.mjs).
 * Missing this is why DaveyJonesBonus was once stuck at "partial": its x3 gate calls with e=1.
 *
 * Grid_Bonus(b,0) = ResGridSquares[b][2] * Research[0][b]
 *   * (Research[1][b]==-1 ? 1 : 1+Research[5][Research[1][b]]/100) * max(1, Allmulti). */

import { sel } from "../savemap.mjs";
import { companion } from "./companions.mjs";
import { uniqueSushi, SUSHI_ROG } from "./sushi.mjs";

/** ResGridSquares[b][2], read from the client's own table — verified ids only:
 *   68  "Boony_Crowns"            coeff 1   (stickers give {% higher bonuses; used via e==2)
 *   105 "Revival_of_the_Undead_Battalion"   (gate node — used via e==1, coeff irrelevant)
 *   106 "The_Maw"                 coeff 25  (MULTIPLICATIVE %)
 *   109 "Transcendent_Artifacts"  coeff 25  (ADDITIVE %)
 *   125 "Better_Button"           coeff 5   (all button bonuses +{% bigger)
 *   173 "Divine_Design"           coeff 25  (ADDITIVE % Drop_Rate; also the Allmulti gate node) */
export const RES_GRID_COEFF = {
  68: 1, 106: 25, 109: 25, 125: 5, 173: 25,
  /* Farming/sticker nodes (ResGridSquares rows @N.js:24157, 2026-07-18):
   *   47  "Sticker-it_To_Em!"  coeff 1  (sticker DMG multi, x TotalStickers)
   *   67  "Sticky_Crowns"      coeff 25 (megacrop odds; used via e==2 -> x crowns reclaimed)
   *   88  "Sticker_Depot"      coeff 50 (unlocks stickers at >=1; also }x megacrop odds)
   *   171 "Day_'N'_Nite"       coeff 50 (+{ max LV day/night market, maxLV 4) */
  47: 1, 67: 25, 88: 50, 171: 50,
};

/** == CustomLists.Research[5]: occurrence-slot percent boosts. */
export const RES_OCCURRENCE_PCT = [25, 15, 50, 20, 20, 35, 25, 30, 35, 60];

/** Node display names for the ids whose identity IS known from N.js (the RES_GRID_COEFF set +
 *  the two gate nodes used via e==1). The full ~240-node grid table does NOT exist as static data
 *  — node identities are assigned into CustomLists.ResGridSquares at runtime (see
 *  gamedata-w7-research.mjs's HEADLINE FINDING); undecoded nodes are surfaced as "node #N". */
export const RES_GRID_NAMES = {
  47: "Sticker-it To Em!", 67: "Sticky Crowns", 68: "Boony Crowns", 88: "Sticker Depot",
  105: "Revival of the Undead Battalion", 106: "The Maw", 109: "Transcendent Artifacts",
  125: "Better Button", 171: "Day 'N' Nite", 173: "Divine Design",
};

/** Grid_Bonus(b,1): the raw node level. */
export const gridLevel = (ctx, node) => Math.round(Number((sel.research(ctx.s)[0] ?? [])[node] ?? 0));

/** ResearchStuff("Grid_Bonus_Allmulti",0,0), verbatim:
 *    1 + ( Companions(55)
 *        + 5*min(1, Research[0][173] * Companions(0))
 *        + Dreamstuff("CloudBonus",71) + CloudBonus(72) + CloudBonus(76)
 *        + SushiStuff("RoG_BonusQTY",53,0) ) / 100
 *  and every Grid_Bonus(b,0) is multiplied by `max(1, Allmulti)`. Fully derivable, and SMALL —
 *  decoding it ruled it out as the artifact-chance missing multiplier (~1.2x, not ~5x):
 *    Companions(55) = CompanionDB[55][2] = 15 (a flat 15, not 15x).
 *    Companions(0) is additionally gated on Lv0[14] >= 2 inside _customBlock_Companions.
 *    CloudBonus(b) = `WeeklyBoss["d_"+b] == -1 ? 1 : 0` — a 0/1 FLAG, worth at most 1 each. The
 *      "}x" in the shop text does not mean the block returns a multiplier.
 *    SushiStuff("RoG_BonusQTY",53,0) = UniqueSushi() > 53 ? Research[37][53] : 0. */
const ALLMULTI_COMPANION = 55, ALLMULTI_COMPANION_GATE = 0, ALLMULTI_GATE_NODE = 173;
const ALLMULTI_CLOUDS = [71, 72, 76], ALLMULTI_SUSHI = 53;
export function gridAllmulti(ctx) {
  const c55 = companion(ctx, ALLMULTI_COMPANION);
  const c0 = companion(ctx, ALLMULTI_COMPANION_GATE);
  const gateNode = Number((sel.research(ctx.s)[0] ?? [])[ALLMULTI_GATE_NODE] ?? 0);
  const gate = 5 * Math.min(1, gateNode * c0.value);
  const clouds = ALLMULTI_CLOUDS.reduce((a, i) => a + sel.cloudBonus(ctx.s, i), 0);
  const sushi = uniqueSushi(ctx) > ALLMULTI_SUSHI ? SUSHI_ROG[ALLMULTI_SUSHI] ?? 0 : 0;
  const sum = c55.value + gate + clouds + sushi;
  return {
    value: Math.max(1, 1 + sum / 100), known: c55.owned !== null,
    note: `Companions(55)=${c55.owned === null ? "?" : c55.value} + gate ${gate} + clouds ${clouds} + sushi53 ${sushi} -> x${(1 + sum / 100).toFixed(3)}`,
  };
}

/** Per-node surfacing for the Research Grid entity: one row per node the account has PLACED a
 *  level into (Research[0][slot] > 0). Node identities are RUNTIME-assigned (no static table),
 *  so `decoded` marks the handful whose identity is confirmed in N.js (RES_GRID_NAMES); the rest
 *  are honestly "node #<slot> (undecoded)". `coeff`/`bonus` are only reported for RES_GRID_COEFF
 *  ids (the ids whose e==0 percent bonus is consumed somewhere). Occurrence slot is the node's
 *  CustomLists.Research[5] tag (-1 = none). No fabricated data for undecoded nodes. */
export function gridNodes(ctx) {
  const r = sel.research(ctx.s);
  const levels = r[0] ?? [];
  const occ = r[1] ?? [];
  const out = [];
  for (let slot = 0; slot < levels.length; slot++) {
    const level = Number(levels[slot] ?? 0);
    if (level <= 0) continue;
    const decoded = slot in RES_GRID_NAMES;
    const hasCoeff = slot in RES_GRID_COEFF;
    const o = Number(occ[slot] ?? -1);
    out.push({
      slot, level, decoded,
      effectName: decoded ? RES_GRID_NAMES[slot] : `node #${slot} (undecoded)`,
      coeff: hasCoeff ? RES_GRID_COEFF[slot] : null,
      bonus: hasCoeff ? gridBonus(ctx, slot).value : null,
      occurrence: o === -1 ? null : o,
      occurrencePct: o === -1 ? 0 : RES_OCCURRENCE_PCT[o] ?? 0,
    });
  }
  return out;
}

/** Count of nodes with each occurrence-slot tag present in the save (index = slot 0..9). */
export function gridOccurrences(ctx) {
  const occ = (sel.research(ctx.s)[1] ?? []);
  const levels = (sel.research(ctx.s)[0] ?? []);
  const counts = RES_OCCURRENCE_PCT.map(() => 0);
  for (let slot = 0; slot < occ.length; slot++) {
    if (Number(levels[slot] ?? 0) <= 0) continue;
    const o = Number(occ[slot] ?? -1);
    if (o >= 0 && o < counts.length) counts[o]++;
  }
  return counts;
}

/** Grid_Bonus(b,0) as a fragment. Flags the Allmulti companion gap once per ctx. */
export function gridBonus(ctx, node) {
  if (!(node in RES_GRID_COEFF)) throw new Error(`Grid_Bonus(${node},0): ResGridSquares[${node}][2] not verified in N.js — add to RES_GRID_COEFF first`);
  const r = sel.research(ctx.s);
  const lv = Number((r[0] ?? [])[node] ?? 0);
  const occ = Number((r[1] ?? [])[node] ?? -1);
  const occMult = occ === -1 ? 1 : 1 + RES_OCCURRENCE_PCT[occ] / 100;
  const all = gridAllmulti(ctx);
  if (!all.known && !ctx._allmultiFlagged) {
    ctx._allmultiFlagged = true;
    ctx.unknown("ResearchStuff Grid_Bonus_Allmulti (scales EVERY Grid_Bonus) — its Companions(55)/Companions(0) inputs need the _comp RTDB doc; computed without them");
  }
  return {
    value: RES_GRID_COEFF[node] * lv * occMult * all.value,
    status: all.known ? "computed" : "partial",
    note: `Research[0][${node}]=${lv}, occurrence ${occ} (x${occMult}), Allmulti ${all.note}`,
    parts: [
      { label: "node level", value: lv, note: `coeff ${RES_GRID_COEFF[node]}` },
      { label: "occurrence slot", value: occMult, note: `slot ${occ}` },
      { label: "Allmulti", value: all.value, note: all.note },
    ],
  };
}
