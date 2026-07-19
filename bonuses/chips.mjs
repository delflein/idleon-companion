/* bonuses/chips.mjs — chipBonuses(key): lab console chips, per ACTIVE character.
 *
 * Client (_customBlock_ActionBlock "RecalcChipBonuses"): for the active character's 7 chip
 * slots Lab[1+charIdx][0..6], sum ChipDesc[chipId][11] into ChipBbonusz[ChipDesc[chipId][10]].
 * chipBonuses(key) then reads that map. Keys relevant so far:
 *   "dr"    Grounded_Processor, 60 — the +60% Drop Rate chip (only applies under the 5x floor)
 *   "card1" Omega_Nanochip,     1 — doubles the card in equip slot 0
 *   "card2" Omega_Motherboard,  1 — doubles the card in equip slot 7
 * Per-character by construction; ctx.activeChar == null returns null (unknown, not 0). */

import { sel } from "../savemap.mjs";
import { CHIP_KEY, CHIP_VALUE } from "../gamedata-cards.mjs";

/** Sum of equipped-chip values for `key` on character `charIdx`. */
export function chipBonusesOf(s, charIdx, key) {
  let v = 0;
  for (const id of sel.labChips(s, charIdx)) {
    if (id === -1 || id == null) continue;
    if (CHIP_KEY[String(id)] === key) v += CHIP_VALUE[String(id)];
  }
  return v;
}

/** chipBonuses(key) for the ctx's active character; null when no active char is set. */
export function chipBonuses(ctx, key) {
  if (ctx.activeChar == null) return null;
  return chipBonusesOf(ctx.s, ctx.activeChar, key);
}
