/* bonuses/ballot.mjs — Vote Ballot + Meritocracy (World 2) state and multiplier stacks.
 *
 * Two weekly-rotating systems from gamedata-w2-ballot.mjs:
 *   - Meritocracy: OptLacc[453] selects ONE of 28 categories; only it pays. The base value ×
 *     MeritocBonuszMulti is already computed by bonuses/summoning.mjs::meritocBonusz (verbatim,
 *     with ClamWorkBonus(3) now DECODED via bonuses/clamwork.mjs; only the map-250 gate unread ->
 *     still a floor). MeritocCanVote = OptLacc[472]==1.
 *   - Vote Ballot: the active category is runtime UI state (ctx.activeVote, from the __serverVars
 *     doc); its payout = baseValue × VotingBonuszMulti. VotingBonuszMulti (voteMulti) has ~12 arms,
 *     several of which have no evaluator here (Cosmo, Palette(32), Legend(22), Sushi(50)) — those
 *     contribute their neutral element and are listed in `unread` (lower bound).
 *
 * This module exposes which category is ACTIVE for each system and its computed bonus value, plus a
 * full category preview list for the W2 page. */

import { sel } from "../savemap.mjs";
import { VOTE_BALLOT_CATEGORIES, MERITOCRACY_CATEGORIES, voteMulti } from "../../gamedata/gamedata-w2-ballot.mjs";
import { meritocBonusz, winBonus, eventShopOwned } from "./summoning.mjs";
import { companion } from "./companions.mjs";
import { legendPts } from "./thingies.mjs";
import { paletteBonus } from "./gaming.mjs";
import { sushiRoG } from "./sushi.mjs";

const num = (x) => Number(x) || 0;
const safe = (fn) => { try { const r = fn(); if (r == null) return { value: 0, ok: false }; return { value: num(typeof r === "number" ? r : r.value), ok: true }; } catch { return { value: 0, ok: false }; } };

/** VotingBonuszMulti (voteMulti) as {value, parts, unread}. */
export function voteMultiplier(ctx) {
  const unread = [];
  const arm = (label, fn, note) => { const r = safe(fn); if (!r.ok) unread.push(note ?? label); return { label, value: r.value, ok: r.ok }; };
  const poppy = arm("Poppy companion (161)", () => companion(ctx, 161).value);
  const meritoc9 = arm("Meritocracy cat 9", () => meritocBonusz(ctx, 9).value);
  const comp41 = arm("Companion 41", () => companion(ctx, 41).value);
  const equinox = arm("Equinox (Dream[13])", () => num((sel.dream(ctx.s) ?? [])[13]));
  const cosmo = arm("Cosmo lab (CosmoBonusQTY 2,3)", () => { throw 0; }, "CosmoBonusQTY(2,3)");
  const winner = arm("Summoning winner (WinBonus 22)", () => winBonus(ctx, 22).value);
  const es7 = arm("Event shop (7)", () => eventShopOwned(ctx, 7) ?? 0);
  const es16 = arm("Event shop (16)", () => eventShopOwned(ctx, 16) ?? 0);
  const comp19 = arm("Companion 19", () => companion(ctx, 19).value);
  const palette = arm("Palette (32)", () => paletteBonus(ctx, 32), "PaletteBonus(32)");
  const legend22 = arm("Legend talent (22)", () => legendPts(ctx, 22), "LegendPTS_bonus(22)");
  const sushi50 = arm("Sushi (50)", () => sushiRoG(ctx, 50).value, "SushiStuff(50)");
  const value = voteMulti({
    poppyBonus: poppy.value, meritocracyBonus: meritoc9.value, companionBonus3: comp41.value,
    equinoxBonus: equinox.value, cosmoBonus: cosmo.value, winnerBonus: winner.value,
    eventShopBonus2: es7.value, eventShopBonus3: es16.value, companionBonus2: comp19.value,
    paletteBonus: palette.value, legendTalentBonus2: legend22.value, ballotSushiBonus: sushi50.value,
  });
  return { value, unread, parts: [poppy, meritoc9, comp41, equinox, cosmo, winner, es7, es16, comp19, palette, legend22, sushi50] };
}

/**
 * Full ballot state for the W2 entity. `activeVote` needs ctx.activeVote (runtime __serverVars);
 * `meritoc` is fully save-derived (OptLacc[453]/[472]).
 */
export function ballotState(ctx) {
  const merSel = sel.meritocSelected(ctx.s);
  const canVote = sel.meritocCanVote(ctx.s) === 1;
  const merActive = MERITOCRACY_CATEGORIES[merSel]
    ? (() => { const b = meritocBonusz(ctx, merSel); return { idx: merSel, description: MERITOCRACY_CATEGORIES[merSel].description, baseValue: MERITOCRACY_CATEGORIES[merSel].baseValue, bonusValue: num(b.value), status: b.status }; })()
    : null;

  const vm = voteMultiplier(ctx);
  const voteIdx = ctx.activeVote;
  const voteActive = (voteIdx != null && VOTE_BALLOT_CATEGORIES[voteIdx])
    ? { idx: voteIdx, description: VOTE_BALLOT_CATEGORIES[voteIdx].description, baseValue: VOTE_BALLOT_CATEGORIES[voteIdx].baseValue, multi: vm.value, bonusValue: VOTE_BALLOT_CATEGORIES[voteIdx].baseValue * vm.value, unread: vm.unread }
    : { idx: null, note: "active vote is runtime UI state (not in this snapshot)", multi: vm.value, unread: vm.unread };

  return {
    canVote,
    meritocracy: {
      selectedIdx: merSel,
      active: merActive,
      categories: MERITOCRACY_CATEGORIES.map((c) => ({ idx: c.idx, description: c.description, baseValue: c.baseValue })),
    },
    vote: {
      active: voteActive,
      categories: VOTE_BALLOT_CATEGORIES.map((c) => ({ idx: c.idx, description: c.description, baseValue: c.baseValue })),
    },
  };
}
