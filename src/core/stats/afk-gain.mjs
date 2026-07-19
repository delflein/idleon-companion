/* stats/afk-gain.mjs — recipe for the client's AFK Gain Rate: the shared AFKgainzzALL additive
 * block plus the AFKgainzzALLmulti multiplier that every skill/fighting AFK rate is built on.
 *
 * THE EXPRESSION, verbatim from N.js `_customBlock_AFKgainrates`, lines 6089-6093 (stitched):
 *
 *   AFKgainzzALL = (Tasks[2][1][2] > <activePlayerIndex> ? 2 : 0)            // "tasks" base
 *   if (d != "Fighting")  AFKgainzzALL +=
 *        FamBonusQTYs["50"]                                                   // Beast Master family
 *      + (2 + CardBonusREAL(46))                                             // flat base + AFK card
 *      + (GuildBonuses(7) + CardSetBonuses(0,"7")
 *      + (TalentEnh(79)                                                       // VW Sleepin' eclipse
 *      + (Labb("SigilBonus","Blank",16,0) + chipBonuses("safk"))             // Dream Catcher + chip
 *      + (EtcBonuses("24") + EtcBonuses("59")                                // gear skill-afk + afk
 *      + (prayersReal(4,0) - prayersReal(12,1)))))                           // Zerg - Ruck Sack
 *   AFKgainzzALL +=
 *        ArcadeBonus(6)
 *      + (Windwalker("CompassBonus",57,0) + GetSetBonus("VOID_SET","Bonus",0,0))
 *      + (FlurboShop(7)
 *      + (30*Divinity("Bonus_MAJOR",<activePlayerIndex>,0)
 *      + (Divinity("Bonus_Minor",-1,5)
 *      + (Companions(6) + Companions(25) + Shrine(8)
 *      + (TalentCalc(650)                                                     // Rando Event Looty
 *      + (Summoning("WinBonus",11,0)
 *      + (GoldFoodBonuses("AllAFK")
 *      + (1.5*CardLv("w6d3")
 *      + (Summoning("RooBonuses",5,0)
 *      + (Summoning("VotingBonusz",6,0)
 *      + (20*Summoning("EventShopOwned",5,0) + Summoning("VaultUpgBonus",23,0)))))))))))))
 *   AFKgainzzALLmulti = (1 + ArcaneType("ArcaneMapMulti_bon",2,0)/100)*(1 + EtcBonuses("92")/100)
 *   if (BundlesReceived.bun_u == 1) AFKgainzzALL += 30
 *
 * We model the displayed AFK Gain Rate as (1 + AFKgainzzALL/100) * AFKgainzzALLmulti — the shared
 * factor each skill's own base (0.4/0.5/…) is added to before the same /100 and ×multi. The
 * skill-specific and Fighting-only bases (idle-brawling, bribes, star signs, TrapMGbonus, …) are
 * OUT OF SCOPE — this recipe is the account-wide + per-character shared block only.
 *
 * COVERAGE (2026-07-19, first cut). Computed from the save: the flat +2 base, the Beast Master
 * family AFK bonus, the equipped AFK card and card-set, the Sleepy-Skiller guild bonus, the Dream
 * Catcher sigil, the Zerg Rushogen prayer minus the Ruck Sack curse, the AFK arcade row, Goharut
 * minor divinity, the two AFK pets, the Primordial shrine, the Summoning winner AFK bonus, the
 * w6d3 passive card, the event-shop AFK flag, the AFK vault row, and the bun_u bundle. Honest
 * UNKNOWNS (neutral element, lower bound): the tasks base (per-char), TalentEnh(79), the two
 * EtcBonuses gear stats (24/59), the safk lab chip is computed per-char, CompassBonus, VOID_SET,
 * FlurboShop, the 30× Divinity major (per-char deity link), TalentCalc(650), GoldFoodBonuses,
 * RooBonuses, the cash… err AFK weekly vote, and BOTH multiplier arms (ArcaneMapMulti, EtcBonuses
 * 92) — so the total is a LOWER BOUND.
 *
 * Per-character (activeCharSensitive = true): tasks, CardBonusREAL(46), CardSetBonuses(0,"7"),
 * chipBonuses("safk"), the prayers, and the 30× Divinity major all read the active character.
 */

import { sel } from "../savemap.mjs";
import { T, term, evaluate } from "./engine.mjs";
import { COMPANION_VAL } from "../../gamedata/gamedata.mjs";
import { famBonus } from "../bonuses/family.mjs";
import { cardBonusReal, cardSetBonus, cardLv } from "../bonuses/cards.mjs";
import { guildBonus } from "../bonuses/guild.mjs";
import { sigilBonus } from "../bonuses/alchemy.mjs";
import { chipBonuses } from "../bonuses/chips.mjs";
import { prayerBonus } from "../bonuses/prayers.mjs";
import { arcadeBonus } from "../bonuses/arcade.mjs";
import { divinityMinorBonus } from "../bonuses/divinity.mjs";
import { companion } from "../bonuses/companions.mjs";
import { shrineBonus } from "../bonuses/shrines.mjs";
import { winBonus, vaultUpgBonus, votingBonus } from "../bonuses/summoning.mjs";
import { eventShopOwned, setBonus } from "../bonuses/misc.mjs";
import { goldFoodBonus } from "../bonuses/goldfood.mjs";

/** A per-ACTIVE-CHARACTER term (see stats/drop-rate.mjs). */
function perChar(ctx, id, key, kind, frag, wrap = (v) => v, neutral = kind === "mul" ? 1 : 0) {
  if (frag === null) {
    if (!ctx._perCharFlagged) {
      ctx._perCharFlagged = true;
      ctx.unknown("account view only: per-character terms (tasks, AFK card + card-set, safk chip, prayers, divinity major) sit at their neutral element here — pick a character to resolve them");
    }
    return T(id, key, kind, neutral, "per-char", "resolved in the per-character view");
  }
  const f = typeof frag === "number" ? { value: frag } : frag;
  return T(id, key, kind, wrap(f.value), f.status ?? "computed", f.note ?? "", f.parts);
}

/** An additive companion term (raw CompanionDB percent). */
function compAdd(ctx, id, termId, key) {
  const c = companion(ctx, id);
  if (c.owned === null)
    return T(termId, key, "add", 0, "unknown", `ownership unknown -> would be +${COMPANION_VAL[id]}% if owned`);
  return T(termId, key, "add", c.value, "computed", c.owned ? `owned -> +${c.value}%` : "not owned");
}

const todo = (id, key, kind, why) => T(id, key, kind, kind === "mul" ? 1 : 0, "unknown", why);
function safe(ctx, fn, note) {
  try { const f = fn(); if (f === null) return null; return typeof f === "number" ? { value: f } : f; }
  catch (e) { ctx.unknown(`${note} -> ${e.message}`); return { value: 0, status: "unknown", note }; }
}

export const DISPLAY = {
  tasksAfk: { label: "Task board: AFK gains", where: "Tasks (account merit)", how: "+2% once the merit task is beaten past this character." },
  familyBM: { label: "Family: Beast Master AFK", where: "Family bonuses (Beast Master)", how: "+% all-skill AFK from the highest Beast Master's level." },
  base2: { label: "Base AFK gains", where: "Always on", how: "The flat +2% every character has." },
  card46: { label: "Equipped +% Skill AFK cards", where: "Cards → this character's slots", how: "Sum of equipped '+% Skill AFK gain rate' cards." },
  guild7: { label: "Guild: Sleepy Skiller", where: "Guild → bonuses", how: "+% Skill AFK gain rate; decay on the bonus level." },
  cardSet7: { label: "Card set: AFK", where: "Cards → equipped set", how: "The Skill-AFK card set bonus." },
  talentEnh79: { label: "Voidwalker: Sleepin' On The Job (Eclipse)", where: "Voidwalker talents", how: "Enhancement Eclipse gate — not modelled yet." },
  sigil16: { label: "Sigil: Dream Catcher", where: "Alchemy → Sigils", how: "Sigil tier; ×artifact & meritocracy multis (unread → lower bound)." },
  chipSafk: { label: "Lab chip: Skill AFK", where: "Lab → chips (per character)", how: "The safk lab chip on this character." },
  etc24: { label: "Gear: +% Skill AFK", where: "Worn equipment", how: "Worn-gear stat — not in the save (lower bound)." },
  etc59: { label: "Gear: +% AFK Gains", where: "Worn equipment", how: "Worn-gear stat — not in the save (lower bound)." },
  prayer4: { label: "Prayer: Zerg Rushogen", where: "W3 Worship prayers", how: "Equipped prayer bonus arm." },
  prayerCurse12: { label: "Prayer curse: Ruck Sack", where: "W3 Worship prayers", how: "Subtracted while Ruck Sack is equipped." },
  arcade6: { label: "Arcade: AFK gains", where: "W2 Arcade → Gold Ball Shop", how: "Decay row; ×2 with the Spirit Reindeer pet." },
  compass57: { label: "Compass: AFK gains", where: "W5 Wind Walker → Compass", how: "CompassBonus(57) — not decoded yet." },
  voidSet: { label: "Void armor set", where: "Armor sets", how: "Flat +% once perma-unlocked; set value not verified yet." },
  flurbo7: { label: "Dungeon: AFK gains", where: "Dungeons → Flurbo shop", how: "FlurboShop(7) not decoded yet." },
  divMajor: { label: "Divinity: Goharut major (×30)", where: "W5 Divinity", how: "+30% when the major god link (or Companion 0) is active." },
  divMinor5: { label: "Divinity: Goharut minor", where: "W5 Divinity", how: "Minor god link on Goharut (type 5); scales with Divinity level." },
  comp6: { label: "Pet: AFK gains (a)", where: "Pets (followers)", flag: true, how: "+% AFK gains while owned." },
  comp25: { label: "Pet: AFK gains (b)", where: "Pets (followers)", flag: true, how: "+% AFK gains while owned." },
  shrine8: { label: "Primordial Shrine", where: "W3 shrines", how: "Shrine level; global only with the Moai Head sailing artifact." },
  talentCalc650: { label: "Star talent: Rando Event Looty", where: "Star talents", how: "× random-event items found — not modelled yet." },
  win11: { label: "Summoning winner: AFK gains", where: "W6 Summoning → victories", how: "Grows with career wins; ×Crystal Comb, gem shop, Winz Lantern." },
  goldFoodAllAFK: { label: "Golden food: Golden Dumpling", where: "Golden foods (equipped + beanstalk)", how: "GoldFoodBonuses(AllAFK) — per-character; lower bound (×GfoodMulti unread)." },
  cardW6d3: { label: "Passive card: w6d3", where: "Cards → w6d3 (auto-passive)", how: "1.5% per card star level." },
  roo5: { label: "Kangaroo: AFK gains", where: "W6 Kangaroo", how: "RooBonuses accumulator — not decoded yet." },
  vote6: { label: "Weekly ballot: AFK gains", where: "W2 Town Ballot", flag: true, how: "Only in AFK-vote weeks; active vote is runtime state." },
  eventShop5: { label: "Event shop: AFK gains", where: "Limited-time event shop", flag: true, how: "+20% once owned." },
  vault23: { label: "Vault: AFK gains", where: "Upgrade Vault", how: "+% per level." },
  bunU: { label: "Gem bundle (+30%)", where: "Gem shop bundle", flag: true, how: "Flat +30% while owned." },
  arcaneMapMulti: { label: "Arcane Cultist map multi", where: "Arcane Cultist (Wind Walker)", how: "ArcaneType map bonus — not decoded yet." },
  etc92: { label: "Gear: AFK gains multi", where: "Worn equipment", how: "Worn-gear multiplier — not in the save (lower bound)." },
};

export const afkGain = {
  name: "afkGain",
  label: "AFK Gain Rate",
  display: DISPLAY,
  activeCharSensitive: () => true,
  // default combine: (1 + pool/100) * mul

  terms(ctx) {
    const bundles = ctx.s.get("BundlesReceived") ?? {};
    const tasks = ctx.s.get("Tasks") ?? [];
    const tasksAfkVal = Number(((tasks[2] ?? [])[1] ?? [])[2] ?? 0);
    const voidSet = safe(ctx, () => setBonus(ctx, "VOID_SET"), 'GetSetBonus("VOID_SET") value not verified');
    const vote6 = safe(ctx, () => votingBonus(ctx, 6), 'Summoning("VotingBonusz",6,0) pct not verified');
    const win11 = winBonus(ctx, 11);
    const comp0 = companion(ctx, 0);
    const sig16 = sigilBonus(ctx, 16);
    const arc6 = arcadeBonus(ctx, 6);

    return [
      /* --- additive pool (AFKgainzzALL) ------------------------------------ */
      perChar(ctx, "tasksAfk", "Tasks[2][1][2] > activePlayerIndex ? 2 : 0", "add",
        ctx.activeChar == null ? null : (tasksAfkVal > ctx.activeChar ? { value: 2, note: `Tasks[2][1][2]=${tasksAfkVal} > char ${ctx.activeChar}` } : { value: 0, note: `Tasks[2][1][2]=${tasksAfkVal} <= char ${ctx.activeChar}` })),
      T("familyBM", 'FamBonusQTYs["50"] Beast Master ALL_SKILL_AFK_GAINS', "add", famBonus(ctx, "50").value,
        famBonus(ctx, "50").status ?? "computed", famBonus(ctx, "50").note),
      T("base2", "flat +2", "add", 2, "computed", "the always-on AFK base"),
      perChar(ctx, "card46", "CardBonusREAL(46) +%_Skill_AFK cards", "add", cardBonusReal(ctx, 46)),
      T("guild7", "GuildBonuses(7) Sleepy Skiller", "add", guildBonus(ctx, 7).value, "computed", guildBonus(ctx, 7).note),
      perChar(ctx, "cardSet7", 'CardSetBonuses(0,"7") AFK set', "add", cardSetBonus(ctx, 7)),
      todo("talentEnh79", "TalentEnh(79) VW Sleepin' Eclipse", "add", "voidwalker enhancement gate not modelled"),
      T("sigil16", 'Labb("SigilBonus","Blank",16,0) Dream Catcher', "add", sig16.value, sig16.status ?? "computed", sig16.note),
      perChar(ctx, "chipSafk", 'chipBonuses("safk")', "add", chipBonuses(ctx, "safk")),
      todo("etc24", 'EtcBonuses("24") +%_Skill_AFK (gear)', "add", "worn-equipment stat not in the save (lower bound)"),
      todo("etc59", 'EtcBonuses("59") +%_AFK_Gains (gear)', "add", "worn-equipment stat not in the save (lower bound)"),
      perChar(ctx, "prayer4", "prayersReal(4,0) Zerg Rushogen", "add", prayerBonus(ctx, 4, 0)),
      perChar(ctx, "prayerCurse12", "-prayersReal(12,1) Ruck Sack curse", "add", prayerBonus(ctx, 12, 1), (v) => -v),
      T("arcade6", "ArcadeBonus(6)", "add", arc6.value, arc6.status, arc6.note),
      todo("compass57", 'Windwalker("CompassBonus",57,0)', "add", "compass AFK bonus not decoded"),
      term("voidSet", 'GetSetBonus("VOID_SET","Bonus",0,0)', "add", voidSet),
      todo("flurbo7", "FlurboShop(7)", "add", "dungeon flurbo AFK shop not decoded"),
      T("divMajor", '30*Divinity("Bonus_MAJOR",activePlayerIndex,0)', "add",
        comp0.owned === true ? 30 : 0, comp0.owned === true ? "partial" : "unknown",
        comp0.owned === true ? "Companion 0 owned -> major bonus active for all -> +30%" : "per-character major-deity link unread -> 0 floor"),
      perChar(ctx, "divMinor5", 'Divinity("Bonus_Minor",-1,5) Goharut', "add",
        ctx.activeChar == null ? null : divinityMinorBonus(ctx, ctx.activeChar, 5)),
      compAdd(ctx, 6, "comp6", "Companions(6)"),
      compAdd(ctx, 25, "comp25", "Companions(25)"),
      T("shrine8", "Shrine(8) Primordial", "add", shrineBonus(ctx, 8).value, shrineBonus(ctx, 8).status ?? "computed", shrineBonus(ctx, 8).note),
      todo("talentCalc650", "TalentCalc(650) Rando Event Looty×items", "add", "random-event-items scaling not modelled"),
      T("win11", 'Summoning("WinBonus",11,0)', "add", win11.value, win11.status, win11.note, win11.parts),
      perChar(ctx, "goldFoodAllAFK", 'GoldFoodBonuses("AllAFK")', "add",
        ctx.activeChar == null ? null : goldFoodBonus(ctx, "AllAFK", ctx.activeChar)),
      T("cardW6d3", '1.5*CardLv("w6d3")', "add", 1.5 * cardLv(ctx, "w6d3"), "computed", `CardLv("w6d3")=${cardLv(ctx, "w6d3")}`),
      todo("roo5", 'Summoning("RooBonuses",5,0)', "add", "kangaroo RooBonuses accumulator not decoded"),
      term("vote6", 'Summoning("VotingBonusz",6,0)', "add", vote6),
      T("eventShop5", '20*Summoning("EventShopOwned",5,0)', "add", 20 * (eventShopOwned(ctx, 5) ?? 0), "computed", `EventShopOwned(5)=${eventShopOwned(ctx, 5) ?? 0}`),
      T("vault23", 'Summoning("VaultUpgBonus",23,0)', "add", vaultUpgBonus(ctx, 23), "computed", `UpgVault(23)=${vaultUpgBonus(ctx, 23).toFixed(2)}`),
      T("bunU", "BundlesReceived.bun_u == 1 -> +30", "add", bundles.bun_u === 1 ? 30 : 0, "computed", `bun_u=${bundles.bun_u ?? 0}`),

      /* --- multiplier chain (AFKgainzzALLmulti) ---------------------------- */
      todo("arcaneMapMulti", '(1 + ArcaneType("ArcaneMapMulti_bon",2,0)/100)', "mul", "arcane cultist map multi not decoded"),
      todo("etc92", '(1 + EtcBonuses("92")/100) AFK gains multi (gear)', "mul", "worn-equipment multiplier not in the save (lower bound)"),
    ];
  },
};

/** Convenience with the classic shape. */
export const totalAfkGain = (s, opts = {}) => evaluate(afkGain, s, opts);
