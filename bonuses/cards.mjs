/* bonuses/cards.mjs — the card system: star levels, equipped-card bonus sums, set bonuses.
 *
 * CardLv(cardId) — RunCodeOfTypeXforThingY("CardLv", b), verbatim:
 *   lv = Cards0[b] > 0 ? 1 : 0
 *   maxStars = round(4 + RiftStuff("5starCards",0) + Spelunk("6starCards",0,0))
 *     where 5starCards = Rift[0] >= 45, 6starCards = Spelunk[0][2] >= 1
 *   for f in 0..maxStars-1:
 *     threshold = b=="Boss3B" ? 1.5*(f+1+floor(f/3))^2
 *               : baseQty(b) * (f+1 + floor(f/3) + 16*floor(f/4) + 100*floor(f/5))^2
 *     if Cards0[b] > threshold: lv = f+2
 *   then: b in OptLacc[603] and lv<7 -> 7;  b in OptLacc[155] and lv<6 -> 6
 *   (Account-wide — Cards0 has no char dimension.)
 *
 * CardBonusREAL(id) = DNSM.CardBonusS[IDforCardBonus[id]]. The CardBonusS builder
 * (-4 branch of the card ActionBlock) walks the ACTIVE character's 12 equip slots Cards[2]:
 *   per card: (1 + LegendPTS_bonus(21)/100) * CardLv(card) * row.value  summed under row.text,
 *   DOUBLED when (slot==0 && chipBonuses("card1")==1) or (slot==7 && chipBonuses("card2")==1).
 * Rift "Ruby Cards" passive arms re-add SKILL cards (Mining/Choppin/Fishing/Catching/Trapping/
 * Worship/Spelunking/Shiny/Charge texts) and VaultUpgBonus(44) re-adds Card_Drop_Chance cards
 * without equipping — those arms are NOT implemented; cardBonusSum throws for such texts so a
 * future stat cannot silently under-count them. Drop-rate texts are unaffected.
 *
 * CardSetBonuses(0,setId) = Cards[3][IDforCardSETbonus[setId]] — and Cards[3] is saved
 * per character as CSetEq_N (map bonusText -> value), so this reads straight from the save.
 */

import { sel } from "../savemap.mjs";
import { CARD_ROWS, ID_FOR_CARD_BONUS, ID_FOR_CARD_SET_BONUS } from "../gamedata-cards.mjs";
import { legendPts } from "./thingies.mjs";
import { chipBonuses } from "./chips.mjs";

/** Texts whose CardBonusS entries have unimplemented passive re-add arms (rift Ruby Cards /
 *  vault 44). cardBonusSum refuses these rather than under-counting. */
const PASSIVE_ARM_MARKERS = ["Mining", "Choppin", "Fishing", "Catching", "Trapping", "Spelunking"];
const PASSIVE_ARM_EXACT = ["+{%_Shiny_Critter_Chance", "+{%_Charge_Rate", "+{_Starting_Pts_in_Worship", "+{%_Max_Charge", "+{%_Card_Drop_Chance"];
const hasPassiveArm = (text) => PASSIVE_ARM_EXACT.includes(text) || PASSIVE_ARM_MARKERS.some((m) => text.includes(m));

/** Card star level, account-wide. Unknown card id -> 0 (matches the client: no row, no stars). */
export function cardLv(ctx, cardId) {
  const count = Number(sel.cardsCollected(ctx.s)[cardId] ?? 0);
  let lv = count > 0 ? 1 : 0;
  if (!lv) return applyStarOverrides(ctx, cardId, lv);
  const rift5 = Number((sel.rift(ctx.s) ?? [])[0] ?? 0) >= 45 ? 1 : 0;
  const spel6 = Number(((ctx.s.get("Spelunk") ?? [])[0] ?? [])[2] ?? 0) >= 1 ? 1 : 0;
  const maxStars = Math.round(4 + rift5 + spel6);
  const baseQty = CARD_ROWS[cardId]?.baseQty;
  for (let f = 0; f < maxStars; f++) {
    const threshold = cardId === "Boss3B"
      ? 1.5 * Math.pow(f + 1 + Math.floor(f / 3), 2)
      : (baseQty ?? Infinity) * Math.pow(f + 1 + Math.floor(f / 3) + 16 * Math.floor(f / 4) + 100 * Math.floor(f / 5), 2);
    if (count > threshold) lv = f + 2;
  }
  return applyStarOverrides(ctx, cardId, lv);
}
function applyStarOverrides(ctx, cardId, lv) {
  if (sel.sevenStarCards(ctx.s).includes(cardId) && lv < 7) return 7;
  if (sel.sixStarCards(ctx.s).includes(cardId) && lv < 6) return 6;
  return lv;
}

/** Sum of the active character's equipped-card bonuses for one bonus TEXT.
 *  Returns { value, parts } or null when ctx.activeChar is null (per-char data). */
export function cardBonusSum(ctx, text) {
  if (hasPassiveArm(text))
    throw new Error(`cardBonusSum("${text}"): this text has a rift/vault passive re-add arm that is not implemented — read the CardBonusS builder's passive tail first`);
  if (ctx.activeChar == null) return null;
  const legend = legendPts(ctx, 21);
  const parts = [];
  let total = 0;
  const equip = sel.cardEquip(ctx.s, ctx.activeChar);
  for (let g = 0; g < 12; g++) {
    const id = equip[g];
    const row = id && id !== "B" ? CARD_ROWS[id] : null;
    if (!row || row.text !== text) continue;
    const doubled = (g === 0 && chipBonuses(ctx, "card1") === 1) || (g === 7 && chipBonuses(ctx, "card2") === 1);
    const v = (doubled ? 2 : 1) * (1 + legend / 100) * cardLv(ctx, id) * row.value;
    total += v;
    parts.push({ label: `slot ${g}: ${id}`, value: v, note: `lv ${cardLv(ctx, id)} x ${row.value}${doubled ? " x2 chip" : ""}` });
  }
  return { value: total, parts };
}

/** CardBonusREAL(id) — the numeric-id wrapper the stat expressions use. */
export function cardBonusReal(ctx, id) {
  const text = ID_FOR_CARD_BONUS[String(id)];
  if (!text) throw new Error(`CardBonusREAL(${id}): id not in IDforCardBonus`);
  return cardBonusSum(ctx, text);
}

/** CardSetBonuses(0, setId) for the active character; null when no active char. */
export function cardSetBonus(ctx, setId) {
  const key = ID_FOR_CARD_SET_BONUS[String(setId)];
  if (!key) throw new Error(`CardSetBonuses(${setId}): id not in IDforCardSETbonus`);
  if (ctx.activeChar == null) return null;
  return Number(sel.cardSetEquipped(ctx.s, ctx.activeChar)[key] ?? 0);
}
