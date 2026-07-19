/* bonuses/labboard.mjs — lab mainframe CONNECTIVITY SOLVER (floor semantics).
 *
 * The client computes connectivity at runtime (_GenINFO[92]) from player positions on the lab
 * board; it is fully derivable from the save. Algorithm verified verbatim in N.js (and
 * cross-checked against Morta1/IdleonToolbox's independent implementation):
 *   distance   _customBlock_DistanceEqn: .9604339*max(|dx|,|dy|) + .397824735*min(|dx|,|dy|)
 *   prism      players chain from (43,229); a player connects when dist < their OWN line width
 *   in a tube  Bonus_MAJOR(char,2) — Arctis. Global grants: Companions(0), Grid_Bonus(173,0)>=1
 *              (Divine Design!), W7divChosen, PocketDiv; per-char: AFKtarget=="Laboratory",
 *              blessing slot Divinity[12+i] with GodsInfo[g][13]==2, ES Polytheism.
 *   line width floor((50 + 2*labLv [*1.25 if jewel 5 owned & within 150px] + min(50, passive
 *              line-width cards) ) * (1 + (chip6 + souped30 + shiny19 + ...)/100))
 *   node range Labb("Dist"): node 8/13 and jewel 9/19 fixed 80; jewels 21..23 fixed 100; else
 *              floor(80*(1 + (MainframeBonus(109)=jewel9 + MainframeBonus(13)=ViralConnection)
 *              /100) + meritRange + Dream[8] + Summoning("WinBonus",4,0))
 *
 * FLOOR SEMANTICS — the honesty contract for a partial simulation: every input we cannot
 * derive is taken at its MINIMUM (missing width/range boosts -> smaller reach; unknown tube
 * grants -> fewer players). Therefore "connected" results are PROVEN connections; anything
 * not reached stays UNKNOWN (null), never "disconnected". Skipped boosts so far: task-merit
 * connection range, meal line-width bonuses, Bubo Purple Tube, pet-arena 13, ES Polytheism,
 * W7divChosen/PocketDiv tube grants, jewel-19 spelunker addend. Each one added later can only
 * flip unknowns to connected. */

import { sel, skillLv } from "../savemap.mjs";
import { LAB_NODES, LAB_JEWELS } from "../../gamedata/gamedata-lab.mjs";
import { CHIP_KEY, CHIP_VALUE, CARD_ROWS } from "../../gamedata/gamedata-cards.mjs";
import { jadeEmporiumOwned } from "./ninja.mjs";
import { gridBonus } from "./research.mjs";
import { winBonus } from "./summoning.mjs";
import { shinyBonus } from "./breeding.mjs";
import { cardLv } from "./cards.mjs";

const dist = (x1, y1, x2, y2) =>
  0.9604339 * Math.max(Math.abs(x1 - x2), Math.abs(y1 - y2)) + 0.397824735 * Math.min(Math.abs(x1 - x2), Math.abs(y1 - y2));

/** GodsInfo[row][13] — maps a Divinity god row to the id Bonus_MAJOR compares against (Arctis=2). */
const GODS13 = [0, 2, 7, 3, 5, 4, 6, 1, 8, 9];

/** Chip ids whose key marks the Conductive Motherboard line-width bonus. Chip 6 per ChipDesc. */
const LINE_WIDTH_CHIP = 6;

function lineWidthFloor(ctx, charIdx, coords, jewelsOwned) {
  const s = ctx.s;
  let base = 50 + 2 * skillLv(s, charIdx, "lab");
  const j5 = LAB_JEWELS[5];
  if (jewelsOwned[5] === 1 && dist(coords.x, coords.y, j5.x, j5.y) < 150) base *= 1.25;
  let cardsLW = 0;
  for (const [id, row] of Object.entries(CARD_ROWS))
    if (row.text.includes("Line_Width")) cardsLW += cardLv(ctx, id) * row.value;
  cardsLW = Math.min(50, cardsLW);
  const chips = sel.labChips(s, charIdx);
  const chip6 = chips.includes(LINE_WIDTH_CHIP) ? CHIP_VALUE[String(LINE_WIDTH_CHIP)] : 0;
  const souped = charIdx < 2 * Number((s.get("GemItemsPurchased") ?? [])[123] ?? 0) ? 30 : 0;
  const shiny = shinyBonus(ctx, 19).value;   // "+{%_Line_Width_in_Lab"
  return Math.floor((base + cardsLW) * (1 + (chip6 + souped + shiny) / 100));
}

/**
 * Solve the board. Returns { nodes: Set<nodeId>, jewels: Set<jewelIdx>, playersConnected,
 * playersInTubes, note } — FLOOR results (see header). Memoized per ctx.
 */
export function solveLab(ctx) {
  if (ctx._labSolve) return ctx._labSolve;
  const s = ctx.s;
  const lab = sel.lab(s);
  const coordsFlat = lab[0] ?? [];
  const jewelsOwned = lab[14] ?? [];
  const allInTubes = gridBonus(ctx, 173).value >= 1 || (ctx.companions?.has(0) ?? false);
  const divinity = sel.divinity(s);

  const players = [];
  for (const i of s.charIdxs) {
    const x = Math.round(Number(coordsFlat[2 * i] ?? 0)), y = Math.round(Number(coordsFlat[2 * i + 1] ?? 0));
    if (!x && !y) continue;   // never placed on the board
    const inTube = allInTubes
      || s.raw["AFKtarget_" + i] === "Laboratory"
      || GODS13[Number(divinity[12 + i] ?? -1)] === 2;
    if (!inTube) continue;
    players.push({ i, x, y, w: lineWidthFloor(ctx, i, { x, y }, jewelsOwned) });
  }

  const nodes = new Set(), jewels = new Set();
  const rangeExtras = Number((s.get("Dream") ?? [])[8] ?? 0) + winBonus(ctx, 4).value;
  const spelunkMulti = () => (nodes.has(8) ? LAB_NODES[8].on : 1);
  const range = (isJewel, idx) => {
    if (!isJewel && (idx === 8 || idx === 13)) return 80;
    if (isJewel && (idx === 9 || idx === 19)) return 80;
    if (isJewel && idx >= 21 && idx <= 23) return 100;
    const j9 = jewels.has(9) ? LAB_JEWELS[9].value * spelunkMulti() : 0;
    const n13 = nodes.has(13) ? LAB_NODES[13].on : 0;
    return Math.floor(80 * (1 + (j9 + n13) / 100) + rangeExtras);
  };

  const connected = [];
  let changed = true;
  while (changed) {
    changed = false;
    // player chain from the prism
    for (const p of players) {
      if (connected.includes(p)) continue;
      const reachable = dist(43, 229, p.x, p.y) < p.w
        || connected.some((c) => dist(c.x, c.y, p.x, p.y) < p.w);
      if (reachable) { connected.push(p); changed = true; }
    }
    // node / jewel activation from every connected player
    for (const c of connected) {
      for (const n of LAB_NODES) {
        if (nodes.has(n.id)) continue;
        if (n.emporium !== undefined && !jadeEmporiumOwned(ctx, n.emporium)) continue;
        if (dist(c.x, c.y, n.x, n.y) < range(false, n.id)) { nodes.add(n.id); changed = true; }
      }
      for (const j of LAB_JEWELS) {
        if (jewels.has(j.i) || jewelsOwned[j.i] !== 1) continue;
        if (dist(c.x, c.y, j.x, j.y) < range(true, j.i)) { jewels.add(j.i); changed = true; }
      }
    }
  }

  ctx._labSolve = {
    nodes, jewels, playersConnected: connected.length, playersInTubes: players.length,
    note: `${connected.length}/${players.length} tube players chained, ${nodes.size} nodes + ${jewels.size} jewels PROVEN connected (floor solver${allInTubes ? "; Divine Design/companion grants Arctis to all" : ""})`,
  };
  return ctx._labSolve;
}
