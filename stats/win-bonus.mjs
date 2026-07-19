/* stats/win-bonus.mjs — recipe `winBonus`, "Summoning Winner Bonuses".
 *
 * Promotes bonuses/summoning.mjs::winBonus() (which already returns each slot's value + a parts[]
 * drill-down) into a first-class recipe: one TERM per winner-bonus SLOT (0..31), named from
 * SUMMON_WINNER_BONUS_SLOTS (gamedata-w6-summoning.mjs, na.SummonEnemies[6]). Each slot is an
 * INDEPENDENT account-wide bonus (some display as ×-multipliers, some as +%, some flat — see the
 * slot table's `kind`), so there is no single meaningful "total": the headline value is the plain
 * SUM of slot values as a monotonic progress index, and the useful data is the per-term breakdown
 * (metric keys stat.winBonus.slot0 .. slot31 — STABLE ids, never rename).
 *
 * winBonus() itself is already verified against the client (4 branches, Crystal Comb pristine, gem
 * shop, Winz Lantern artifact, tasks, achievements, Emperor(8), Godshard set). Terms inherit its
 * status: "partial" when GODSHARD_SET membership can't be proven -> lower bound. */

import { T } from "./engine.mjs";
import { winBonus as winBonusEval } from "../bonuses/summoning.mjs";
import { SUMMON_WINNER_BONUS_SLOTS } from "../gamedata-w6-summoning.mjs";

const num = (x) => Number(x) || 0;
const kindLabel = { multiplier: "×-multi", percent: "+%", flat: "flat" };

export const DISPLAY = Object.fromEntries(SUMMON_WINNER_BONUS_SLOTS.map((r) => [
  `slot${r.slot}`,
  { label: `Winner bonus ${r.slot}: ${r.bonus.replace(/[{}<]/g, "").trim()}`,
    where: "W6 Summoning → win battles / Endless",
    how: `${kindLabel[r.kind]} — career wins + endless rounds feed slot ${r.slot}; ×Crystal Comb ×gem shop ×(Winz+tasks+ach+Emperor+Godshard).` },
]));

export const winBonus = {
  name: "winBonus",
  label: "Summoning Winner Bonuses",
  format: "points",
  display: DISPLAY,
  // headline: sum of all slot values (a progress index; individual slots carry the real meaning).
  combine: ({ pool }) => pool,
  terms(ctx) {
    return SUMMON_WINNER_BONUS_SLOTS.map((r) => {
      let f;
      try { f = winBonusEval(ctx, r.slot); }
      catch (e) { ctx.unknown(`winBonus slot ${r.slot}: ${e.message}`); f = { value: 0, status: "unknown", note: e.message }; }
      return T(`slot${r.slot}`, `Summoning("WinBonus",${r.slot},0)`, "add", num(f.value), f.status ?? "computed",
        `${r.bonus} (${kindLabel[r.kind]}): ${f.note ?? ""}`, f.parts);
    });
  },
};
