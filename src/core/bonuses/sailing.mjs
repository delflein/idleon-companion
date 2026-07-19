/* bonuses/sailing.mjs — _customBlock_Sailing: artifact main bonuses, captain stats,
 * Davey Jones. */

import { sel } from "../savemap.mjs";
import { gridLevel } from "./research.mjs";
import { legendPts } from "./thingies.mjs";

/** Sailing("ArtifactBonus",idx,0) — an artifact's main bonus at the account's tier.
 *  Client: base = (tier==0 ? 0 : ArtifactInfo[idx][3]); a per-artifact branch may scale it
 *  (`3==l` multiplies by Lv0[13], the sailing level); then the tier text ("doubled"/.../
 *  "sixtupled") multiplies by 2..6 at tiers 2..6.
 *  The tier multiplier is CONFIRMED general, not assumed — there are TWO chains in N.js:
 *    - inside the `-1==b` builder loop the chain is written against the LOOP VARIABLE `l`, e.g.
 *      `"The_artifact's_main_bonus_is_sixtupled!"==ArtifactInfo[l][13] && 6==Sailing[3][l] &&
 *       (SailzArtiBonusL[l] = 6*SailzArtiBonusL[l])` — general, runs for every artifact;
 *    - a SEPARATE `25==b && ...` block recomputes artifact 25 alone (it depends on the active
 *      character's class stats, so it cannot be cached like the rest).
 *  Per-artifact base/scaling verified in SAILING_ARTIFACT only; extend as read. */
export const SAILING_ARTIFACT = {
  3:  { name: "Fauxory Tusk", base: 1, scale: "sailingLv" },   // "+{%_artifact_find_chance_per_sailing_LV..."
  15: { name: "Frost Relic", base: 30, scale: null },          // ArtifactInfo[15][3]=30 @N.js:23869 "+{%_Efficiency_for_all_skills_in_World_1,2,3!"
  32: { name: "Winz Lantern", base: 25, scale: null },
};

/** ArtifactBonus(idx) as a fragment. */
export function artifactBonus(ctx, idx) {
  const row = SAILING_ARTIFACT[idx];
  if (!row) throw new Error(`ArtifactBonus(${idx}): ArtifactInfo[${idx}] base/scaling not verified in N.js — add to SAILING_ARTIFACT first`);
  const tier = sel.artifactTiers(ctx.s)[idx] ?? 0;
  if (!tier) return { value: 0, note: `${row.name} not found` };
  const scale = row.scale === "sailingLv" ? sel.sailingLv(ctx.s) : 1;
  const tierMult = tier >= 2 ? tier : 1;   // tier 6 -> "sixtupled" -> x6
  return {
    value: row.base * scale * tierMult,
    note: `${row.name}: base ${row.base}${row.scale === "sailingLv" ? ` x sailing lv ${scale}` : ""} x tier ${tier} (x${tierMult})`,
  };
}

/** CaptBonusCalc(statId, captainIdx) — one captain's total for one stat id. Both stat slots
 *  are summed; a captain may roll the same id twice. Effect = level * roll.
 *  Captains[i] = [tier, statIdA, statIdB, level, xp, rollA, rollB]. */
export function captainStat(ctx, captainIdx, statId) {
  if (captainIdx < 0) return { value: 0, note: "no captain" };
  const c = sel.captains(ctx.s)[captainIdx];
  if (!c) return { value: 0, note: "captain missing" };
  const v = (c[1] === statId ? c[3] * c[5] : 0) + (c[2] === statId ? c[3] * c[6] : 0);
  return { value: v, note: `captain ${captainIdx} tier ${c[0]} lv ${c[3]} stats [${c[1]},${c[2]}]` };
}

/** Sailing("DaveyJonesBonus", b, 0) — per-BOAT. Verbatim:
 *   (1 + (50*GemItemsPurchased[8] + Thingies("LegendPTS_bonus",11,0))/100)
 * * (1 + 2*max(0, min(1, floor((Boats[b][3]+Boats[b][5]+99600)/1e5) * ResearchStuff("Grid_Bonus",105,1))))
 *  Note the gem term is ADDITIVE +50% per purchase in code, even though the shop text says
 *  "boosts ... by 1.50x" per purchase. The code is authoritative.
 *  The second factor is a pure ON/OFF x3: `floor((sum+99600)/1e5)` is 1 exactly when the boat's
 *  two upgrade levels sum to >= 400, matching ResGridSquares[105] "Revival_of_the_Undead_
 *  Battalion ... at LV 400+" — arithmetic and flavour text agree. Grid_Bonus(105,1) is the NODE
 *  LEVEL (e==1), not a bonus; min(1,..) makes any level >= 1 fire.
 *  LegendTalents[11] = "Davey_Jones_Returns" (max LV 4, coeff 15) lands in the SAME additive
 *  bracket as the gem purchases, which is why it belongs here and not as an outer factor. */
const UNDEAD_BATTALION_NODE = 105, DAVEY_LEGEND_TALENT = 11;
export function daveyJonesBonus(ctx, boatIdx) {
  const buys = sel.daveyJonesPurchases(ctx.s);
  const boat = sel.boats(ctx.s)[boatIdx] ?? [];
  const boatLv = (Number(boat[3]) || 0) + (Number(boat[5]) || 0);
  const gate = Math.floor((boatLv + 99600) / 1e5);
  const node = gridLevel(ctx, UNDEAD_BATTALION_NODE);
  const legend = legendPts(ctx, DAVEY_LEGEND_TALENT);
  const first = 1 + (50 * buys + legend) / 100;
  const second = 1 + 2 * Math.max(0, Math.min(1, gate * node));
  return {
    value: first * second,
    note: `GemItemsPurchased[8]=${buys} (+${50 * buys}%) + LegendPTS_bonus(11)=${legend}% -> x${first.toFixed(2)}; ` +
      `boat[3]+boat[5]=${boatLv} -> gate ${gate}, Grid_Bonus(105,1)=node lv ${node} -> x${second} (Undead Battalion)`,
    /* Three separately-improvable sub-sources; the first two share ONE additive bracket
     * (they cannot be split into independent multipliers without misstating the math). */
    parts: [
      { label: "Davey Jones Training", value: 50 * buys, valueText: `+${50 * buys}%`,
        where: "Gem shop", note: `${buys} purchases — the "1.50x" shop text is +50% additive in code` },
      { label: "Davey Jones Returns (legend talent)", value: legend, valueText: `+${legend}%`,
        where: "W7 Spelunking → Legend Talents", note: "+15% per level, SAME additive bracket as the purchases" },
      { label: "Undead Battalion", value: second, valueText: `×${second}`,
        where: "W7 Research grid + this boat's levels", note: node >= 1
          ? (gate >= 1 ? `boat levels ${boatLv} ≥ 400 -> ×3 active` : `boat levels ${boatLv} < 400 -> inactive; level the boat`)
          : "research node not bought" },
    ],
  };
}
