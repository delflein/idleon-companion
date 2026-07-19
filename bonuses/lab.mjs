/* bonuses/lab.mjs — MainframeBonus(id): lab mainframe nodes.
 *
 * MainframeBonus(d) returns row[5] when the node is CONNECTED on the lab board, else row[4].
 * Connectivity is the client's runtime _GenINFO[92][d]; we do NOT simulate it (it needs the
 * node graph, per-node ranges that depend on other lab bonuses, and player positions), so it is
 * an explicit input: ctx.labConnected(id) -> true/false/null(unknown).
 *
 * EXISTENCE GATE for Jade-Emporium nodes: the client appends NinjaInfo[25+e] onto LabMainBonus
 * for e in 0..3 when Ninja EmporiumBonus(8+e)==1, and MainframeBonus returns 0 outright when
 * `d >= LabMainBonus.length && 99 > d`. So an appended id (14 = "Artifact Attraction",
 * emporium 8) does not EXIST until the emporium upgrade is bought — buying only UNCOVERS the
 * node; it does not connect it. Gate 1 is fully derivable; gate 2 is the connectivity input. */

import { jadeEmporiumOwned } from "./ninja.mjs";
import { sel } from "../savemap.mjs";

const num = (x) => Number(x) || 0;

/** LabMainBonus rows verified in N.js (na.LabMainBonus @N.js:24005-13874042; ids 0..13, then Jade-
 *  Emporium-appended 14..17). Each row's [4] = disconnected value, [5] = connected value.
 *
 *  Two shapes live here:
 *   - FIXED nodes: MainframeBonus(id) = connected ? [5] : [4]. Exact, fully verified.
 *   - PER-UNIT COEFFICIENT nodes (0/9/11): MainframeBonus(id) is a coefficient the CONSUMER scales
 *     (× species-count / × kills / × greenstacks). Node 0 additionally multiplies by the species
 *     count in THIS function (see below); 9/11 return the raw coefficient. Several of these carry a
 *     `jewelAddend` (a `+ MainframeBonus(1xx)` jewel term in the client's special-case branch,
 *     N.js MainframeBonus ternary at flat~9838978) which is NOT modeled -> the `on` value is then a
 *     documented LOWER BOUND (status "partial"). */
export const LAB_ROWS = {
  /* FIXED, no jewel, no emporium — exact. */
  1: { off: 1, on: 2 },                          // Wired_In
  2: { off: 1, on: 3 },                          // Gilded_Cyclical_Tubing (refinery x3) — refinery-cycle
  4: { off: 1, on: 2 },                          // Killer's_Brightside (kills count x2 for portals/Death Note)
  5: { off: 0, on: 1 },                          // Shrine_World_Tour
  6: { off: 1, on: 5 },                          // Viaduct_of_the_Gods
  7: { off: 1, on: 2 },                          // Certified_Stamp_Book
  10: { off: 1, on: 2 },                         // My_1st_Chemistry_Set (vial doubler; `2==MainframeBonus(10)`)
  12: { off: 0, on: 1 },                         // Sigils_of_Olden_Alchemy
  13: { off: 0, on: 50 },                        // Viral_Connection (connection-range boost; special d==13 = [5] flat)

  /* PER-UNIT coefficient nodes with a jewel addend (jewel value omitted -> lower bound). */
  3: { off: 0, on: 1, jewelAddend: 107 },        // No_Bubble_Left_Behind (special d==3 = [5]+MF(107))
  9: { off: 0, on: 2, jewelAddend: 113, note: "coefficient: +2% cash per 1,000,000 Green Mushroom kills (consumer scales by kills)" },  // Fungi_Finger_Pocketer
  11: { off: 0, on: 2, jewelAddend: 117, note: "coefficient: +2% Total Damage per greenstack (consumer scales by greenstack count; see gamedata-w5-slab.mjs GreenStacks semantics)" },  // Unadulterated_Banking_Fury

  /* SPECIES-SCALED node (special d==0 = ([5]+MF(101)) * Breeding('TotPetsFound')). TotPetsFound is
   * the runtime _GenINFO[110] = distinct species bred; approximated by Σ Breeding[1][0..3]
   * (species DISCOVERED per world — discovering a species IS breeding it once). jewel 101 omitted. */
  0: { off: 0, on: 1, speciesScaled: true, jewelAddend: 101 },  // Animal_Farm (+1% Total Damage per species bred)

  /* Jade-Emporium-appended nodes (NinjaInfo[25+e], appended when EmporiumBonus(8+e)==1 @N.js:16561);
   * do not EXIST until the emporium upgrade is bought. */
  14: { off: 0, on: 50, emporium: 8 },           // Artifact_Attraction (+50% artifact find)
  /* KNOWN OMISSION: id 17 client-adds MainframeBonus(120) jewel; id 16 is plain. */
  16: { off: 0, on: 50, emporium: 10 },          // Spiritual_Growth (+50% W6-skill EXP)
  17: { off: 0, on: 30, emporium: 11, jewelAddend: 120 },  // Depot_Studies_PhD (Crop Depot x1.30)
};

/** MainframeBonus(id) -> { value: number|null, status, note }. null value = connectivity unknown;
 *  callers must go unknown, not guess. `partial` = a jewel addend / species proxy is a lower bound. */
export function mainframeBonus(ctx, id) {
  const row = LAB_ROWS[id];
  if (!row) throw new Error(`MainframeBonus(${id}): LabMainBonus[${id}] not verified in N.js — add to LAB_ROWS first`);
  if (row.emporium !== undefined && !jadeEmporiumOwned(ctx, row.emporium))
    return { value: 0, status: "computed", note: `Jade Emporium upgrade ${row.emporium} not bought -> lab id ${id} does not exist -> 0` };
  const conn = ctx.labConnected(id);
  if (conn === null)
    return { value: null, status: "unknown", note: `node ${id} connectivity not simulated; pass labConnectedIds (${row.off} vs ${row.on})` };
  let value = conn ? row.on : row.off;
  let extra = "";
  if (conn && row.speciesScaled) {
    const species = (sel.breeding(ctx.s)[1] ?? []).slice(0, 4).reduce((a, x) => a + num(x), 0);
    value = value * species;
    extra = `; ×${species} species bred (jewel ${row.jewelAddend} omitted -> lower bound)`;
  } else if (conn && row.jewelAddend) {
    extra = `; jewel ${row.jewelAddend} addend omitted -> lower bound`;
  }
  const partial = conn && !!row.jewelAddend;
  return {
    value, status: partial ? "partial" : "computed",
    note: `node ${id} ${conn ? "connected" : "NOT connected"}${row.note ? ` (${row.note})` : ""}${extra}`,
  };
}
