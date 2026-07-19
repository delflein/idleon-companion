/* bonuses/breeding.mjs — Breeding("ShinyBonusS","Nah",<bonusId>,-1): shiny-pet bonuses.
 *
 * Client walks worlds 0..3; for each pet with shiny xp > 0 it adds
 * round(shinyLevel * RANDOlist[92][bonusId]) to that bonus id.
 * shinyLevel: lv=1; for b in 0..18: if xp > floor((1+(b+1)^1.6)*1.7^(b+1)) lv=b+2.
 * All tables (slot->bonus map, per-level values, per-world slot layout) are complete in
 * gamedata.mjs, so this is generic over every shiny bonus id (0..25 — see SHINY_BONUS_NAMES). */

import { sel } from "../savemap.mjs";
import { SHINY_SLOT_TO_BONUS, SHINY_BONUS_PER_LV, PET_SHINY_SLOT } from "../gamedata.mjs";

const num = (x) => Number(x) || 0;

/** PetUpgBONUS(idx) — the live bonus value of pet-upgrade idx from its level Breeding[2][idx].
 *  Verbatim from N.js:12489-92 (`_customBlock_Breeding("PetUpgBONUS",...)`); index-aligned with
 *  PET_UPGRADES in gamedata-w4-breeding.mjs. Only the save-derivable rows are expanded; row 5's
 *  AchieveStatus(221) factor is included as a min(2,max(1,1+.1*ach)) — pass ach via ctx if wired,
 *  else defaults to the neutral 1 (a mild lower bound on row 5 only). */
export function petUpgBonus(ctx, idx) {
  const lv = num(sel.breeding(ctx.s)[2]?.[idx]);
  switch (idx) {
    case 0: return lv;
    case 1: return 4 * lv;
    case 2: return lv;
    case 3: return 25 * lv;
    case 4: return lv;
    case 5: return (1 + 0.25 * lv) * 1;      // *min(2,max(1,1+.1*AchieveStatus(221))) omitted -> 1
    case 6: return 6 * lv;
    case 7: return 1 + 0.15 * lv;
    case 8: return 1 + 2 * lv;
    case 9: return 1 + 0.02 * lv;
    case 10: return 10 * lv;
    case 11: return Math.ceil(12 * Math.pow(lv, 0.698));
    case 12: return 5 * lv;
    default: return 0;
  }
}

export const shinyLevel = (xp) => {
  let lv = 1;
  for (let b = 0; b < 19; b++) if (xp > Math.floor((1 + Math.pow(b + 1, 1.6)) * Math.pow(1.7, b + 1))) lv = b + 2;
  return lv;
};

/** Breeding("ShinyBonusS","Nah",bonusId,-1) as a fragment; parts = each contributing pet. */
export function shinyBonus(ctx, bonusId) {
  const br = sel.breeding(ctx.s);
  let total = 0;
  const parts = [];
  for (let w = 0; w < PET_SHINY_SLOT.length; w++) {
    const row = br[22 + w] ?? [];
    for (let m = 0; m < PET_SHINY_SLOT[w].length; m++) {
      const xp = Number(row[m] ?? 0);
      if (!(xp > 0)) continue;
      const slot = PET_SHINY_SLOT[w][m];
      if (SHINY_SLOT_TO_BONUS[slot] !== bonusId) continue;
      const lv = shinyLevel(xp);
      const v = Math.round(lv * SHINY_BONUS_PER_LV[bonusId]);
      total += v;
      parts.push({ label: `world ${w} pet ${m}`, value: v, note: `shiny lv ${lv}` });
    }
  }
  return { value: total, note: parts.length ? `${parts.length} shiny pets` : "no shiny pets carry this bonus", parts };
}
