/* stats/kruk-bubbles.mjs — recipe `krukBubbles`, "Bubble Levels / Day": the daily auto-levels
 * Kattlekruk grants, Thingies("KrukBubblesDaily",0,0), verbatim from N.js:~10706601:
 *
 *   floor( Minehead("BonusQTY",15,0)
 *     + (20 + StampBonusOfTypeX("krukd") + Thingies("LegendPTS_bonus",5,0) + Thingies("ZenithMarketBonus",4,0))
 *       * (1 + Summoning2("MeritocBonusz",3,0)/100)
 *       * (1 + .5*Summoning("EventShopOwned",31,0))
 *       * (1 + (AlchBubbles.Y12 + ArcadeBonus(61) + Spelunk("ShopUpgBonus",47,0))/100) )
 *
 * ~9 sources. Verified from the save: base 20, stamp "krukd", LegendPTS_bonus(5) (Kruk_be_Bubblin',
 * coeff 10), MeritocBonusz(3) (Kattlekruk category, base 200 when selected), EventShopOwned(31),
 * AlchBubbles.Y12 (Kattle Da Goat bubble), ArcadeBonus(61). Not modelled (neutral/lower bound):
 * Minehead BonusQTY(15) (Research[20][15] unverified), ZenithMarketBonus(4) (undecoded),
 * Spelunk("ShopUpgBonus",47) (no evaluator). Account-wide daily-accruing count -> format "points". */

import { T, term } from "./engine.mjs";
import { mineheadBonusQTY } from "../bonuses/minehead.mjs";
import { stampBonusOfType } from "../bonuses/stamps.mjs";
import { legendPts } from "../bonuses/thingies.mjs";
import { zenithMarketBonus } from "../bonuses/zenith.mjs";
import { meritocBonusz, eventShopOwned } from "../bonuses/summoning.mjs";
import { alchBubble } from "../bonuses/bubbles.mjs";
import { arcadeBonus } from "../bonuses/arcade.mjs";

const num = (x) => Number(x) || 0;
function safe(ctx, fn, note) {
  try { const r = fn(); if (r == null) return null; return typeof r === "number" ? { value: r } : r; }
  catch (e) { ctx.unknown(`krukBubbles: ${note} -> ${e.message}`); return { value: 0, status: "unknown", note: e.message }; }
}

export const DISPLAY = {
  minehead: { label: "Minehead: Kruk bonus", where: "W7 Minehead", how: 'Minehead("BonusQTY",15) — Research[20][15] unverified (neutral).' },
  base20: { label: "Base", where: "—", how: "flat 20 bubble LVs/day." },
  stampKrukd: { label: "Stamp: Kattle Kruk", where: "Stamps", how: 'StampBonusOfTypeX("krukd").' },
  legend5: { label: "Legend Talent: Kruk be Bubblin'", where: "W7 Spelunking → Legend Talents", how: "LegendPTS_bonus(5), +10/LV." },
  zenith4: { label: "Zenith market: bubble boost", where: "W7 Zenith Market", how: "ZenithMarketBonus(4) — +2 daily Kruk bubble LVs per level." },
  meritoc3: { label: "Meritocracy: Kattlekruk", where: "W2 Ninja → Meritocracy", how: "×(1+MeritocBonusz(3)/100) — only when category 3 is selected." },
  eventShop31: { label: "Event shop", where: "Limited-time event shop", how: "×(1+0.5×EventShopOwned(31))." },
  bubbleY12: { label: "Bubble: Kattle Da Goat", where: "Alchemy → Kazam (Y12)", how: "AlchBubbles.Y12 (+% Bubble LVs/day)." },
  arcade61: { label: "Arcade: Kruk", where: "Alchemy → Gold Ball Shop", how: "ArcadeBonus(61)." },
  spelunk47: { label: "Spelunking shop", where: "W7 Spelunking → shop", how: 'Spelunk("ShopUpgBonus",47) — no evaluator (neutral).' },
};

export const krukBubbles = {
  name: "krukBubbles",
  label: "Bubble Levels / Day (Kattlekruk)",
  format: "points",
  display: DISPLAY,
  combine: ({ terms }) => {
    const v = (id) => { const t = terms.find((x) => x.id === id); return t ? num(t.value) : 0; };
    const inner = (20 + v("stampKrukd") + v("legend5") + v("zenith4"))
      * (1 + v("meritoc3") / 100)
      * (1 + 0.5 * v("eventShop31"))
      * (1 + (v("bubbleY12") + v("arcade61") + v("spelunk47")) / 100);
    return Math.floor(v("minehead") + inner);
  },
  terms(ctx) {
    const minehead = safe(ctx, () => mineheadBonusQTY(ctx, 15), 'Minehead("BonusQTY",15)');
    const stamp = safe(ctx, () => stampBonusOfType(ctx, "krukd"), 'StampBonusOfTypeX("krukd")');
    const legend = safe(ctx, () => legendPts(ctx, 5), "LegendPTS_bonus(5)");
    const zenith = zenithMarketBonus(ctx, 4);   // BUBBLE_BOOST: +N daily LVs for all Kattlekruk bubbles
    const meritoc = safe(ctx, () => meritocBonusz(ctx, 3), "MeritocBonusz(3)");
    const event = safe(ctx, () => eventShopOwned(ctx, 31), "EventShopOwned(31)");
    const y12 = safe(ctx, () => alchBubble(ctx, "Y12"), 'AlchBubbles["Y12"]');
    const arc = safe(ctx, () => arcadeBonus(ctx, 61), "ArcadeBonus(61)");
    ctx.unknown('krukBubbles: Spelunk("ShopUpgBonus",47) has no evaluator -> 0 (lower bound)');
    return [
      term("minehead", 'Minehead("BonusQTY",15,0)', "add", minehead ?? { value: 0, status: "unknown" }),
      T("base20", "20", "add", 20, "computed", "flat base"),
      term("stampKrukd", 'StampBonusOfTypeX("krukd")', "add", stamp ?? { value: 0, status: "unknown" }),
      term("legend5", 'Thingies("LegendPTS_bonus",5,0)', "add", legend ?? { value: 0, status: "unknown" }),
      term("zenith4", 'Thingies("ZenithMarketBonus",4,0)', "add", zenith),
      term("meritoc3", 'Summoning2("MeritocBonusz",3,0)', "mul", meritoc ?? { value: 0, status: "unknown" }),
      term("eventShop31", 'Summoning("EventShopOwned",31,0)', "mul", { value: num(event?.value), status: event?.status ?? "computed", note: `flag ${num(event?.value)}` }),
      term("bubbleY12", 'AlchBubbles["Y12"]', "mul", y12 ?? { value: 0, status: "unknown" }),
      term("arcade61", "ArcadeBonus(61)", "mul", arc ?? { value: 0, status: "unknown" }),
      T("spelunk47", 'Spelunk("ShopUpgBonus",47,0)', "mul", 0, "unknown", "no evaluator -> 0 (lower bound)"),
    ];
  },
};
