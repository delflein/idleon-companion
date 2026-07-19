/* stats/worship-charge.mjs — recipe `worshipCharge`, "Worship Max Charge" (PER-CHARACTER).
 *
 * x._customBlock_SkillStats("WorshipChargeMax"), N.js:5712-13, VERBATIM (gamedata-w3-worship.mjs):
 *   base    = CardBonusREAL(52) + BoxRewards["18b"]
 *   bonus   = GetBuffBonuses(475,2) + StampBonusOfTypeX("WorshipMax")
 *           + AlchBubbles.maxCharge * floor(Lv0[9]/10)                 // Lv0[9] = Worship level
 *   toolReq = round(ItemDefinitionsGET[EquipmentOrder[1][5]].lvReqToCraft) * max(AlchBubbles.worshipACTIVE, 1)
 *   return floor(max(50, base + bonus + toolReq))
 *
 * A flat SUM floored at 50 (custom combine). PER-CHARACTER: the Worship level and equipped-tool
 * requirement differ per character; evaluatePerChar computes each and collapses when they agree.
 * Terms with no evaluator (card 52 unless verified, box 18b, GetBuffBonuses(475,2), the equipped
 * Worship-tool lvReqToCraft) contribute 0 and flag a lower bound — so this is a documented floor
 * (it will often bottom out at 50 until those are wired). */

import { sel } from "../savemap.mjs";
import { T } from "./engine.mjs";
import { cardBonusReal } from "../bonuses/cards.mjs";
import { boxReward } from "../bonuses/postoffice.mjs";
import { stampBonusOfType } from "../bonuses/stamps.mjs";
import { alchBubble } from "../bonuses/bubbles.mjs";

const num = (x) => Number(x) || 0;
const safe = (fn) => { try { const r = fn(); return r == null ? null : r; } catch { return null; } };

export const DISPLAY = {
  card52: { label: "Card (52): worship charge", where: "Cards", how: "CardBonusREAL(52)." },
  box18b: { label: "Post office box (18b)", where: "W3 Post Office", how: 'BoxRewards["18b"] — per-char, unread.' },
  buff475: { label: "Buff (475): charge syphon", where: "W3 Worship talent", how: "GetBuffBonuses(475,2) — unread." },
  stamp: { label: "Stamp: Worship Max", where: "Stamps", how: 'StampBonusOfTypeX("WorshipMax").' },
  bubble: { label: "Bubble maxCharge × Worship LV", where: "Alchemy bubbles", how: "AlchBubbles.maxCharge × floor(Worship LV/10)." },
  tool: { label: "Equipped Worship tool", where: "W3 Worship tool", how: "round(lvReqToCraft) × max(worshipACTIVE,1) — unread." },
  base: { label: "Base minimum", where: "—", how: "floored at 50." },
};

export const worshipCharge = {
  name: "worshipCharge",
  label: "Worship Max Charge",
  display: DISPLAY,
  format: "points",
  combine: ({ pool }) => Math.floor(Math.max(50, pool)),
  activeCharSensitive: () => true,
  terms(ctx) {
    const ci = ctx.activeChar;
    const mk = (id, key, value, status, note) => T(id, key, "add", value, status, `${DISPLAY[id]?.label ?? id}: ${note}`);

    const card = safe(() => cardBonusReal(ctx, 52));
    const cardT = card ? mk("card52", "CardBonusREAL(52)", num(card.value), card.status ?? "computed", card.note ?? "")
      : (ctx.unknown("WorshipCharge: CardBonusREAL(52) unverified -> 0 (lower bound)"), mk("card52", "CardBonusREAL(52)", 0, "unknown", "card 52 unread -> 0"));

    const box = ci == null ? null : safe(() => boxReward(ctx, "18b"));
    const boxT = box ? mk("box18b", 'BoxRewards["18b"]', num(box.value), "computed", box.note ?? "")
      : (ctx.unknown('WorshipCharge: BoxRewards["18b"] unread/per-char -> 0 (lower bound)'), mk("box18b", 'BoxRewards["18b"]', 0, "unknown", "box 18b unread -> 0"));

    ctx.unknown("WorshipCharge: GetBuffBonuses(475,2) unread -> 0 (lower bound)");
    const buffT = mk("buff475", "GetBuffBonuses(475,2)", 0, "unknown", "buff 475 unread -> 0");

    const stamp = safe(() => stampBonusOfType(ctx, "WorshipMax"));
    const stampT = stamp ? mk("stamp", 'StampBonusOfTypeX("WorshipMax")', num(stamp.value), stamp.status ?? "computed", stamp.note ?? "")
      : mk("stamp", 'StampBonusOfTypeX("WorshipMax")', 0, "computed", "no WorshipMax stamp -> 0");

    const worshipLv = ci == null ? 0 : sel.worshipLevelOf(ctx.s, ci);
    const maxChargeBubble = safe(() => alchBubble(ctx, "maxCharge"));
    const bubbleV = maxChargeBubble ? num(maxChargeBubble.value) * Math.floor(worshipLv / 10) : 0;
    const bubbleT = maxChargeBubble
      ? mk("bubble", "AlchBubbles.maxCharge × floor(Lv0[9]/10)", bubbleV, maxChargeBubble.status ?? "computed", `bubble ${num(maxChargeBubble.value).toFixed(2)} × floor(${worshipLv}/10)`)
      : (ctx.unknown("WorshipCharge: AlchBubbles.maxCharge bubble unread -> 0 (lower bound)"), mk("bubble", "AlchBubbles.maxCharge × floor(Lv0[9]/10)", 0, "unknown", "maxCharge bubble unread -> 0"));

    ctx.unknown("WorshipCharge: equipped Worship-tool lvReqToCraft (EquipmentOrder[1][5]) not derivable -> 0 (lower bound; usually the biggest term)");
    const toolT = mk("tool", "round(tool.lvReqToCraft) × max(worshipACTIVE,1)", 0, "unknown", "equipped tool unread -> 0");

    return [cardT, boxT, buffT, stampT, bubbleT, toolT];
  },
};
