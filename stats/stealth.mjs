/* stats/stealth.mjs — recipe `stealth`, the per-character Ninja-twin Stealth stat ("what lowers
 * detection rate", NINJA_UPGRADES[13] flavor). Verbatim formula in gamedata-w6-sneaking.mjs §6
 * (Ninja("Stealth",b,e), N.js:17977-17983):
 *
 *   stealth = (10 + NLbonuses(13,0)·ownSneakLv) · twinMulti
 *           · (1 + FuneralStealthz/100) · (1 + 2·FractalIslandBonus(6)·sneakLv/100)
 *           · (1 + EmperorBon(0)/100) · (1 + RoG_BonusQTY(32)/100) · (1 + NLbonuses(23)/100)
 *           · (1 + 39·Companions(163))
 *   twinMulti = [1 + Σ other twins' NinjaBonus(8)+(16)] · Π(1 + Xi/100) over ~15 sources.
 *
 * PER-CHARACTER (activeCharSensitive): ownSneakLv = Lv0[17] is per character. Detection uses the
 * character's own current floor, but Stealth itself is floor-independent (the floor only enters the
 * downstream DetectionDEC curve, not Stealth), so this recipe is a clean per-character stat.
 *
 * HONESTY — this is the heaviest-archaeology W6 stat; most twinMulti factors are equipped-ninja-item
 * effects (NinjaBonus ids 4/7/8/16/17/20) and cross-system talents/cards/bubbles/star-signs/land-rank
 * NOT modelled in this repo. Those degrade to their neutral factor (×1) and flag ctx.unknown -> the
 * result is a LOWER BOUND. The readable sources (Way_of_Stealth level, Aquamarine gemstone, Stealth
 * statue, Crystal5 card, achievement 368, Emperor(0), Sushi RoG(32), Shhhhhhhhhhh upgrade, companion
 * 163, Lamp wish, meritocracy/voting) ARE computed. */

import { T } from "./engine.mjs";
import { sel, skillLv } from "../savemap.mjs";
import { nlBonus, gemstoneBonus } from "../bonuses/ninja.mjs";
import { statueBonusGiven } from "../bonuses/statues.mjs";
import { cardLv } from "../bonuses/cards.mjs";
import { achieveStatus } from "../bonuses/misc.mjs";
import { votingBonus } from "../bonuses/summoning.mjs";
import { emperorBon } from "../bonuses/thingies.mjs";
import { lampBonus } from "../bonuses/holes.mjs";
import { sushiRoG } from "../bonuses/sushi.mjs";
import { companion } from "../bonuses/companions.mjs";

const num = (x) => Number(x) || 0;
const safe = (ctx, fn) => { try { const r = fn(); return typeof r === "number" ? { value: r } : r; } catch (e) { ctx.unknown(`stealth: ${e.message}`); return { value: 0, status: "unknown", note: e.message }; } };
const unreadable = (ctx, id, key, note) => { ctx.unknown(`stealth: ${key} — ${note} -> ×1 (lower bound)`); return T(id, key, "mul", 1, "unknown", `${note} -> ×1`); };

export const DISPLAY = {
  base: { label: "Base + Way of Stealth", where: "W6 Sneaking → Ninja Knowledge", how: "10 + NLbonuses(13)·Sneaking level (Way of Stealth, +1 Stealth/LV)." },
  statue26: { label: "Stealth Statue", where: "Statues", how: "×(1 + StatueBonusGiven26/100)." },
  aquamarine: { label: "Aquamarine gemstone", where: "W6 Sneaking → Ninja Knowledge", how: "×(1 + GemstoneBonus(0)/100)." },
  cardCrystal5: { label: "Crystal 5 card", where: "Cards", how: "×(1 + 4·CardLv(Crystal5)/100)." },
  ach368: { label: "Achievement 368", where: "Achievements", how: "×(1 + 5·AchieveStatus(368)/100)." },
  vote25: { label: "Ballot vote 25", where: "W2 Ninja → Ballot", how: "×(1 + VotingBonusz(25)/100) — only when vote 25 is live." },
  lamp: { label: "Cavern Lamp wish", where: "W5 Cavern → Lamp", how: "×(1 + LampBonuses(2,1)/100)." },
  emperor0: { label: "Emperor: Ninja Stealth", where: "W6 Emperor", how: "×(1 + EmperorBon(0)/100)." },
  sushi32: { label: "Sushi RoG 32", where: "W7 Sushi Bar", how: "×(1 + RoG_BonusQTY(32)/100)." },
  shhhh: { label: "Shhhhhhhhhhh upgrade", where: "W6 Sneaking → special upgrades", how: "×(1 + NLbonuses(23)/100)." },
  companion163: { label: "Companion 163", where: "Companions", how: "×(1 + 39·Companions(163))." },
  twinItems: { label: "Equipped ninja items (twins)", where: "W6 Sneaking → equipment", how: "NinjaBonus(4/7/8/16/17/20) worn-item effects — not in the save (×1, lower bound)." },
  crossSystem: { label: "Talents / land-rank / bubbles / star signs", where: "Various", how: "CompassBonus(45), GambitBonuses(11), land rank, A10, StarSign 73 — not modelled (×1, lower bound)." },
  funeral: { label: "Funeral Flowers / Fractal Island", where: "W6 Sneaking / Fractal", how: "FuneralStealthz + FractalIslandBonus(6) — not modelled (×1, lower bound)." },
};

export const stealth = {
  name: "stealth",
  label: "Ninja Stealth",
  display: DISPLAY,
  combine: ({ mul }) => mul,
  activeCharSensitive: () => true,
  terms(ctx) {
    const ci = ctx.activeChar;
    if (ci == null) {
      ctx.unknown("account view only: Stealth is per-character (Sneaking level Lv0[17]) — pick a character to resolve it");
      return [T("base", "10 + NLbonuses(13)·Lv0[17]", "mul", 1, "per-char", "resolved in the per-character view")];
    }
    const sneakLv = num(skillLv(ctx.s, ci, "sneaking"));
    const nl13 = nlBonus(ctx, 13);
    const base = 10 + num(nl13.value) * sneakLv;

    const statue = safe(ctx, () => statueBonusGiven(ctx, 26));
    const aqua = safe(ctx, () => gemstoneBonus(ctx, 0));
    const vote = safe(ctx, () => votingBonus(ctx, 25));
    const lamp = safe(ctx, () => lampBonus(ctx, 2, 1));
    const emp = num(emperorBon(ctx, 0));
    const sushi = safe(ctx, () => sushiRoG(ctx, 32));
    const nl23 = nlBonus(ctx, 23);
    const c163 = companion(ctx, 163);
    const crystal5 = num(cardLv(ctx, "Crystal5"));
    const ach368 = num(achieveStatus(ctx, 368));

    const f = (v) => 1 + num(v) / 100;
    return [
      T("base", "10 + NLbonuses(13)·Lv0[17]", "mul", base, "computed", `10 + ${num(nl13.value)}·${sneakLv} = ${base.toFixed(0)}`),
      T("statue26", "1+StatueBonusGiven26/100", "mul", f(statue.value), statue.status ?? "computed", statue.note),
      T("aquamarine", "1+GemstoneBonus(0)/100", "mul", f(aqua.value), aqua.status ?? "computed", aqua.note),
      T("cardCrystal5", "1+4·CardLv(Crystal5)/100", "mul", 1 + 4 * crystal5 / 100, "computed", `CardLv(Crystal5)=${crystal5}`),
      T("ach368", "1+5·AchieveStatus(368)/100", "mul", 1 + 5 * ach368 / 100, "computed", `A368=${ach368}`),
      T("vote25", "1+VotingBonusz(25)/100", "mul", f(vote.value), vote.status ?? "computed", vote.note),
      T("lamp", "1+LampBonuses(2,1)/100", "mul", f(lamp.value), lamp.status ?? "computed", lamp.note),
      T("emperor0", "1+EmperorBon(0)/100", "mul", f(emp), "computed", `EmperorBon(0)=${emp}`),
      T("sushi32", "1+RoG_BonusQTY(32)/100", "mul", f(sushi.value), sushi.status ?? "computed", sushi.note),
      T("shhhh", "1+NLbonuses(23)/100", "mul", f(nl23.value), nl23.status ?? "computed", nl23.note),
      c163.owned === null
        ? unreadable(ctx, "companion163", "1+39·Companions(163)", "companion ownership unknown")
        : T("companion163", "1+39·Companions(163)", "mul", 1 + 39 * num(c163.value), "computed", c163.owned ? `owned +${c163.value}` : "not owned"),
      unreadable(ctx, "twinItems", "NinjaBonus(4/7/8/16/17/20) equipped-item twin multipliers", "worn ninja items not in the save"),
      unreadable(ctx, "crossSystem", "CompassBonus(45)·GambitBonuses(11)·landRank·A10·StarSign73", "cross-system sources not modelled"),
      unreadable(ctx, "funeral", "FuneralStealthz·FractalIslandBonus(6)", "funeral flowers / fractal island not modelled"),
    ];
  },
};
