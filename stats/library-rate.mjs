/* stats/library-rate.mjs — recipe `libraryRate`, "Library Checkout Rate".
 *
 * The client's BookReqTime speed multiplier (WorkbenchStuff "BookReqTime", N.js:12276-77) —
 * transcribed in bonuses/library.mjs::libraryBonusMultiplier. 8 terms:
 *   2 multiplicative factors  (meal MealBonus("Lib"), Oxygen atom AtomBonuses(7))
 *   6 additive-pool sources   (library tower 5×Tower[1], booksSpeed bubble, TalBookSpd vial,
 *                              BookSpd stamp, achievement 145, superbit 12 × Gaming LV)
 * The default combine ((1+pool/100)*mul) reproduces bonusMultiplier exactly. NO-TIMERS: this value
 * is the checkout SPEED; the page/entity turn it into checkouts/day + book-count breakpoints
 * ([16,18,20]) via bonuses/library.mjs::checkoutBreakpoints — never a live countdown. */

import { T } from "./engine.mjs";
import { libraryBonusMultiplier } from "../bonuses/library.mjs";

export const DISPLAY = {
  meal: { label: "Meal: library checkout", where: "W4 Dinner Table", how: 'MealBonus("Lib") — meal row unverified (neutral).' },
  atom: { label: "Oxygen atom (Library Booker)", where: "W3 Atom Collider", how: "AtomBonuses(7) — +2%/level checkout speed." },
  libraryTower: { label: "Library tower level", where: "W3 Construction → Talent Book Library", how: "5% per tower level." },
  bubble: { label: "Bubble: booksSpeed", where: "Alchemy bubbles", how: "AlchBubbles.booksSpeed." },
  vial: { label: "Vial: TalBookSpd", where: "Alchemy → Vials", how: "AlchVials.TalBookSpd." },
  stamp: { label: "Stamp: BookSpd", where: "Stamps", how: 'StampBonusOfTypeX("BookSpd").' },
  achievement: { label: "Achievement (145)", where: "Achievements", how: "up to +30%." },
  superbit: { label: "Superbit (12) × Gaming LV", where: "W5 Gaming → Superbits", how: "SuperBitType(12) × Gaming level." },
};

const MUL = new Set(["meal", "atom"]);

export const libraryRate = {
  name: "libraryRate",
  label: "Library Checkout Rate",
  display: DISPLAY,
  terms(ctx) {
    const m = libraryBonusMultiplier(ctx);
    const byId = Object.fromEntries(m.parts.map((p) => [p.id, p]));
    const ids = ["meal", "atom", "libraryTower", "bubble", "vial", "stamp", "achievement", "superbit"];
    return ids.map((id) => {
      const p = byId[id] ?? { value: 0, note: "" };
      const kind = MUL.has(id) ? "mul" : "add";
      const value = kind === "mul" ? 1 + (Number(p.value) || 0) / 100 : Number(p.value) || 0;
      // status: unread meal/stamp/superbit -> unknown; else computed
      const unread = (id === "meal" && !(Number(p.value))) || String(p.note).includes("unread") || String(p.note).includes("unknown");
      return T(id, `BookReqTime.${id}`, kind, value, unread && (id === "meal" || id === "stamp" || id === "superbit") ? "partial" : "computed", `${DISPLAY[id]?.label ?? id}: ${p.note ?? ""}`);
    });
  },
};
