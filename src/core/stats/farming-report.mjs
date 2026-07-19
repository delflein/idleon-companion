/* stats/farming-report.mjs — the /api/farming payload builder: everything the farming page
 * shows, computed fresh from the latest raw save. Four modules (interview 2026-07-18):
 * medal evo push, exotic weekly planner, OG & stickers, markets & spending.
 *
 * PLANNING TOOL, NOT A TIMER: no countdowns; rate-based numbers only (odds per cycle,
 * expected days). All math delegates to bonuses/farming.mjs (the verified FarmingStuffs
 * mirror) — nothing here re-implements a client formula, it only composes and ranks. */

import { sel } from "../savemap.mjs";
import { makeCtx } from "./engine.mjs";
import { votingBonus } from "../bonuses/summoning.mjs";
import { bestTalentAcrossChars } from "../bonuses/talents.mjs";
import { SEED_INFO, MARKET_INFO, MARKET_EXOTIC_INFO, LAND_RANK_DB, STICKERS } from "../../gamedata/gamedata-farming.mjs";
import * as fm from "../bonuses/farming.mjs";

const N = (x) => Number(x) || 0;

/* ---------- marginal-gain analysis for the evo stack ---------- */

/** Ratio helpers — analytic "what if" factors, matching the client formulas exactly. */
const satPct = (coeff, L) => coeff * L / (1000 + L);

/**
 * Candidate improvements to the evolution stack, each with the exact multiplier the whole
 * stack gains. `ctx2` trick not needed: every factor's closed form is known.
 */
function evoMarginals(ctx, parts) {
  const up = sel.farmUpg(ctx.s);
  const val = (id) => parts.find((p) => p.id === id)?.value ?? 1;
  const out = [];
  const push = (label, where, action, factor, note = "") => {
    if (factor > 1.0001) out.push({ label, where, action, factor, gainPct: (factor - 1) * 100, note });
  };

  // Exotic buys: Sproutluck I-IV + Geneology I-V — gain per ONE weekly purchase. Entries carry
  // exoticIdx so the report can annotate rotation availability (in rotation now / week +N).
  const flv = fm.farmingLevel(ctx);
  const pushExotic = (e, factor, note) => {
    if (factor > 1.0001) out.push({
      label: `${MARKET_EXOTIC_INFO[e].name} (+${fm.exoticLvQty(ctx, N(sel.farmCrop(ctx.s)[String(MARKET_EXOTIC_INFO[e].cropId)]))} lv)`,
      where: "Exotic Market", action: "1 weekly exotic buy", factor, gainPct: (factor - 1) * 100, note, exoticIdx: e,
    });
  };
  for (const e of [0, 1, 2, 3]) {
    const L = fm.exoticLevel(ctx, e);
    const stock = N(sel.farmCrop(ctx.s)[String(MARKET_EXOTIC_INFO[e].cropId)]);
    const dL = fm.exoticLvQty(ctx, stock);
    const now = 1 + satPct(MARKET_EXOTIC_INFO[e].coeff, L) / 100;
    const after = 1 + satPct(MARKET_EXOTIC_INFO[e].coeff, L + dL) / 100;
    pushExotic(e, after / now, `lv ${L} -> ${L + dL}; saturating toward ${MARKET_EXOTIC_INFO[e].coeff}%`);
  }
  {
    // Geneology: the summed term — recompute with one row bumped.
    const geneNow = val("geneology");
    for (let k = 0; k < 5; k++) {
      const e = 4 + k;
      const L = fm.exoticLevel(ctx, e);
      const lvTerm = Math.max(0, flv - 50 * (k + 1));
      if (!lvTerm) continue;
      const stock = N(sel.farmCrop(ctx.s)[String(MARKET_EXOTIC_INFO[e].cropId)]);
      const dL = fm.exoticLvQty(ctx, stock);
      const dPct = lvTerm * (satPct(MARKET_EXOTIC_INFO[e].coeff, L + dL) - satPct(MARKET_EXOTIC_INFO[e].coeff, L));
      pushExotic(e, (geneNow + dPct / 100) / geneNow, `x${lvTerm} farming LVs over ${50 * (k + 1)}`);
    }
  }
  // Day market: Biology Boost +10 levels.
  {
    const l = N(up[2 + 4]), c = MARKET_INFO[4].bonusPerLv;
    push("Biology Boost +10 lv", "Day Market (crops)", "10 day-market levels", (100 + c * (l + 10)) / (100 + c * l), `lv ${l} -> ${l + 10}`);
  }
  // Night market: Evolution GMO +1, Super GMO +1 (their compounding makes these huge).
  {
    const counts = fm.qualifiedCropCounts(ctx);
    const l1 = N(up[2 + 1 + 8]), c1 = MARKET_INFO[9].bonusPerLv;
    push("Evolution GMO +1 lv", "Night Market (beans)", `${Math.round(fm.marketCostQty(ctx, 1, 1) / 1e6)}M beans`,
      Math.pow((1 + (l1 + 1) * c1 / 100) / (1 + l1 * c1 / 100), counts[0]), `compounds over ${counts[0]} crops`);
    const l7 = N(up[2 + 7 + 8]), c7 = MARKET_INFO[15].bonusPerLv, n7 = counts[4];
    if (l7 < fm.marketMaxLv(ctx, 1, 7))
      push("Super GMO +1 lv", "Night Market (beans)", `${Math.round(fm.marketCostQty(ctx, 1, 7) / 1e6)}M beans`,
        (1 + (l7 + 1) * c7 * n7 / 100) / (1 + l7 * c7 * n7 / 100), `scales every GMO; ${n7} crops >= 100k`);
  }
  // Vault 78 +10.
  {
    const l = N(sel.upgVault(ctx.s)[78]);
    if (l < 250) push("Croppius Evolvius +10 lv", "Upgrade Vault", "vault coins", (100 + 8 * Math.min(250, l + 10)) / (100 + 8 * l), `lv ${l} -> ${Math.min(250, l + 10)}`);
  }
  // Grimoire 14 +10 (approx: same 36-multi on both sides cancels into linearity).
  {
    const l = N(sel.grimoire(ctx.s)[14]);
    const g36 = 1; // ratio is multi-invariant
    push("Sacrifice of Harvest +10 lv", "Death Bringer Grimoire (bones)", "grimoire bones", (100 + 5 * (l + 10) * g36) / (100 + 5 * l * g36), `lv ${l} -> ${l + 10}`);
  }
  // Land Rank Database: pour the unspent points into Evolution Ultraboost (idx 15).
  {
    const pts = fm.rankPtsLeft(ctx);
    if (pts > 0) {
      const L = N((sel.farmRanks(ctx.s)[2] ?? [])[15]);
      const before = fm.landRankUpg(ctx, 15).value;
      const raw = (Lx) => 1.7 * LAND_RANK_DB[15].base * Lx / (Lx + 80);
      const scale = before > 0 && raw(L) > 0 ? before / raw(L) : 1;   // DB207 x Plump, level-invariant
      const after = raw(L + pts) * scale;
      push(`Evolution Ultraboost +${pts} lv (unspent points)`, "Land Rank Database", "free (respec/allocate)",
        (1 + after / 100) / (1 + before / 100), `lv ${L} -> ${L + pts}`);
    }
  }
  // Meals +5 levels each.
  for (const [key, id, coeff] of [["zCropEvo", "mealEvo", 5], ["zCropEvoSumm", "mealSumm", 9]]) {
    const idx = key === "zCropEvo" ? 62 : 66;
    const l = N(sel.mealLevels(ctx.s)[idx]);
    const factorNow = val(id);
    if (factorNow > 1) {
      const pctNow = (factorNow - 1) * 100;
      const scale = pctNow / (l * coeff);   // summoning-scale etc., level-invariant
      push(`${key === "zCropEvo" ? "Bill Jack Pep" : "Nyanborgir"} +5 lv`, "W4 Dinner Table", "ladles",
        (100 + (l + 5) * coeff * scale) / (100 + l * coeff * scale), `meal lv ${l} -> ${l + 5}`);
    }
  }
  return out.sort((a, b) => b.factor - a.factor);
}

/* ---------- exotic rows ---------- */

/** Which account goals each exotic row serves — the PAGE weighs these by the selected focus. */
const EXOTIC_GOAL = (e) => {
  if (e <= 8) return "evo";                        // Sproutluck / Geneology
  if (e === 14 || e === 15) return "ranks";        // Plump Database / Datadigging
  if ([9, 10, 11, 12, 13].includes(e)) return "ranks";
  if ([16, 17, 18, 19, 20].includes(e)) return "beans";
  if ([21, 22].includes(e)) return "exp";
  if ([23, 24, 25].includes(e)) return "value";    // Stalk Value (raises value cap)
  if ([26, 27].includes(e)) return "og";
  if ([28, 29].includes(e)) return "value";
  if (e === 30) return "growth";
  if ([31, 32, 33].includes(e)) return "value";
  if ([34, 35, 36, 37].includes(e)) return "costs";
  if (e === 38 || e === 39) return "meta";         // Better Exotic / Freexotic
  if (e === 40) return "depot";
  if (e === 45) return "artifact";                 // 5_LEAF_CLOVER
  if (e === 59) return "droprate";                 // POMMELION_SEED
  return "other";
};
/** One exotic row's full planning info (the page scores it by the user's focus).
 *  stockForNextLv = extra cost-crop stock needed before a buy grants ONE more level than now
 *  (ExoticLVQTY is log-ish in stock — this is the "when is farming more fruit pointless"
 *  number Dominik asked for; softCapped once that ratio explodes). */
function exoticRowInfo(ctx, e) {
  const row = MARKET_EXOTIC_INFO[e];
  const L = fm.exoticLevel(ctx, e);
  const stock = N(sel.farmCrop(ctx.s)[String(row.cropId)]);
  const dL = fm.exoticLvQty(ctx, stock);
  const goal = EXOTIC_GOAL(e);
  const now = row.saturating ? satPct(row.coeff, L) : row.coeff * L;
  const after = row.saturating ? satPct(row.coeff, L + dL) : row.coeff * (L + dL);
  const satRatio = row.saturating ? L / (1000 + L) : null;
  // smallest stock granting dL+1 levels per buy (binary search; ExoticLVQTY is monotonic)
  let stockForNextLv = null;
  { let lo = Math.max(1, stock), hi = Math.max(2, stock) * 1e6;
    if (fm.exoticLvQty(ctx, hi) > dL) {
      while (hi - lo > Math.max(1, lo * 1e-6)) { const mid = (lo + hi) / 2; (fm.exoticLvQty(ctx, mid) > dL) ? hi = mid : lo = mid; }
      stockForNextLv = Math.ceil(hi - stock);
    } }
  const softCapped = stockForNextLv != null && stock > 0 && stockForNextLv > 10 * stock;
  return {
    idx: e, name: row.name, desc: row.desc, level: L, bonus: now, coeff: row.coeff, saturating: row.saturating,
    satRatio, cropId: row.cropId, stock, levelsPerBuy: dL, marginalPct: after - now, goal,
    stockForNextLv, softCapped,
  };
}

/* ---------- the report ---------- */

export function farmingReport(s, opts = {}, nowMs = Date.now()) {
  const ctx = makeCtx(s, opts);
  const plots = sel.farmPlots(s);
  const ranks = sel.farmRanks(s);
  const gRate = fm.growthRate(ctx);

  /* per-plot rows (shared by the evo + OG modules) */
  const evoDisplay = fm.nextCropChanceDisplay(ctx);
  const plotRows = plots.map((p, i) => {
    const tier = N(p[0]);
    const evo = fm.nextCropChancePlot(ctx, i);
    const og = N(p[5]);
    const rank = Math.round(N((ranks[0] ?? [])[i]));
    const rankExp = N((ranks[1] ?? [])[i]);
    return {
      idx: i, tier, tierName: tier >= 0 ? SEED_INFO[tier].name : "EMPTY",
      cropId: tier >= 0 ? fm.cropTypeOf(p) : null,
      evoProgress: N(p[2]), evoLocked: N(p[3]) === 1,
      terminal: evo.terminal === true,
      evoChance: evo.value,
      grown: N(p[4]) !== 0, cropsOnVine: N(p[4]),
      og, ogMulti: fm.ogMulti(p), nextOGchance: tier >= 0 ? fm.nextOGchance(ctx, og).value : 0,
      ogBacklogCycles: tier >= 0 ? N(p[6]) / fm.growthReq(ctx, tier) : 0,
      rank, rankExpPct: rank > 0 || rankExp > 0 ? 100 * rankExp / fm.lankRankExpReq(rank) : 0,
      valueMulti: fm.cropValueDisplay(ctx, rank).value,
      cycleHours: tier >= 0 ? fm.growthTimeSeconds(ctx, tier) / 3600 : null,
      // average real time to the NEXT OG level: one roll per GrowthReq cycle while grown;
      // a "chance" above 1 is just certainty — one level per cycle, never faster
      nextOgAvgDays: tier >= 0 ? (fm.growthTimeSeconds(ctx, tier) / 86400) / Math.min(1, Math.max(1e-300, fm.nextOGchance(ctx, N(p[5])).value)) : null,
    };
  });

  /* OG sweet spot per tier: harvesting at OG k yields x2^k but costs the cumulative wait
   * Σ cycleTime/chance(j) — the best k maximizes value/time. chance(j) = 0.4^(j+1) x multis. */
  const ogSweetSpot = (tier) => {
    const cyc = fm.growthTimeSeconds(ctx, tier);
    let tSum = cyc, best = { og: 0, valuePerDay: Math.pow(2, 0) / (cyc / 86400), days: cyc / 86400 };
    for (let k = 1; k <= 30; k++) {
      // roll probability caps at 1 (one roll per GrowthReq cycle — "chance 900" is certainty)
      tSum += cyc / Math.min(1, Math.max(1e-300, fm.nextOGchance(ctx, k - 1).value));
      const vpd = Math.pow(2, k) / (tSum / 86400);
      if (vpd > best.valuePerDay) best = { og: k, valuePerDay: vpd, days: tSum / 86400 };
    }
    return best;
  };
  /** OG level a fresh plot reaches after `hours` of growth (expected; rolls capped at 1/cycle). */
  const ogReachedIn = (tier, hours) => {
    const cyc = fm.growthTimeSeconds(ctx, tier);
    let t = cyc, k = 0;
    while (k < 40) {
      const step = cyc / Math.min(1, Math.max(1e-300, fm.nextOGchance(ctx, k).value));
      if (t + step > hours * 3600) break;
      t += step; k++;
    }
    return k;
  };

  /* medal push: expected days per remaining crop, at a given collect cadence */
  const medalRows = plotRows.filter((r) => r.tier === 6);
  const medal = (() => {
    if (!medalRows.length) return null;
    const front = medalRows.reduce((a, b) => b.evoProgress > a.evoProgress ? b : a);
    const frontEvo = fm.nextCropChancePlot(ctx, front.idx);
    const stack = frontEvo.stack ?? 0;   // the shared multiplier stack with THIS plot's rank
    const decay = SEED_INFO[6].decay;
    const remaining = [];
    for (let k = 0; k + front.evoProgress < SEED_INFO[6].cropIdMax - SEED_INFO[6].cropIdMin; k++) {
      if (k >= 16) break;
      const prog = front.evoProgress + k;
      const chance = stack * 0.30 * Math.pow(fm.nextCropChanceDenom(decay), prog);
      remaining.push({
        cropId: SEED_INFO[6].cropIdMin + prog + 1, evoProgress: prog,
        chancePerCycle: chance, expectedCycles: chance > 0 ? 1 / chance : Infinity,
      });
    }
    return {
      plots: medalRows.map((r) => r.idx), frontier: front.cropId, cycleHours: 7,
      // an evolution roll needs a fresh growth cycle => one roll per COLLECT (verified: growth
      // stops feeding evolution once the plot is grown; OG stacking competes with evo attempts).
      // The page turns chancePerCycle into days at a user-chosen check-in cadence.
      remaining,
    };
  })();

  /* exotic planner — the page scores rows by the user's selected FOCUS; the report ships the
   * neutral facts: every row's info once, plus the deterministic slot lists per week. */
  const week = fm.exoticWeekNow(nowMs);
  const allowed = fm.exoticPurchasesAllowed(ctx);
  const rows = [];
  for (let e = 0; e < 60; e++) rows.push(exoticRowInfo(ctx, e));
  const currentSlots = fm.exoticRotation(week);
  const weeksAhead = [];
  for (let w = 1; w <= (opts.forecastWeeks ?? 20); w++)
    weeksAhead.push({ week: week + w, startMs: (week + w) * 604800 * 1000, slots: fm.exoticRotation(week + w) });
  /** first upcoming appearance of an exotic idx: 0 = in rotation NOW, n = in n weeks, null = not
   *  within the forecast horizon. */
  const nextInWeeks = (idx) => {
    if (currentSlots.includes(idx)) return 0;
    const wk = weeksAhead.find((w) => w.slots.includes(idx));
    return wk ? wk.week - week : null;
  };

  /* markets — day rows additionally estimate HARVESTS of a locked plot needed for the next
   * level, priced at that crop tier's OG sweet spot (vine qty x 2^k x value multi). */
  const avgRank = Math.round((ranks[0] ?? []).reduce((t, x) => t + N(x), 0) / Math.max(1, plots.length));
  const vine = fm.cropsOnVinePct(ctx);
  const valueAvg = fm.cropValueDisplay(ctx, avgRank).value;
  const sweetByTier = SEED_INFO.map((sd) => ogSweetSpot(sd.tier));
  const mkRow = (tab, e) => {
    const row = MARKET_INFO[e + 8 * tab];
    const lvl = N(sel.farmUpg(s)[2 + e + 8 * tab]);
    const maxLv = fm.marketMaxLv(ctx, tab, e);
    const costQty = lvl < maxLv ? fm.marketCostQty(ctx, tab, e) : null;
    const costCrop = tab === 0 && lvl < maxLv ? fm.marketCostCrop(ctx, e) : null;
    const stock = costCrop != null ? N(sel.farmCrop(s)[String(costCrop)]) : null;
    let harvests = null;
    if (costCrop != null && costQty != null && (stock ?? 0) < costQty) {
      const tier = SEED_INFO.find((sd) => costCrop >= sd.cropIdMin && costCrop <= sd.cropIdMax)?.tier ?? 0;
      const missing = costQty - (stock ?? 0);
      const plotsN = Math.max(1, plots.length);
      // PASSIVE: all plots locked, one collect per day, each banks 2^(OG reached in 24h)
      const og24 = ogReachedIn(tier, 24);
      const perDay = plotsN * vine.expected * Math.pow(2, og24) * valueAvg;
      // ACTIVE: harvest-all on repeat. Optimal interval = the OG sweet spot, floored at a
      // humane 10s — when forced to wait longer than optimal, you bank whatever OG the wait
      // gives, which beats harvesting "more often than possible".
      const sw = sweetByTier[tier];
      const intervalSec = Math.max(10, sw.days * 86400);
      const ogActive = ogReachedIn(tier, intervalSec / 3600);
      const perHarvestActive = vine.expected * Math.pow(2, ogActive) * valueAvg;
      const activeSec = missing / (plotsN * perHarvestActive) * intervalSec;
      harvests = {
        passiveDays: missing / perDay, atOgPassive: og24,
        activeSec, atOgActive: ogActive, intervalSec,
        plotsN,
      };
    }
    return {
      i: e, tab: tab === 0 ? "day" : "night", name: row.name, desc: row.desc,
      level: lvl, maxLv, bonus: fm.basketUpgQTY(ctx, tab === 0 ? 0 : 1, e).value,
      gmoScaled: tab === 1 && [1, 2, 4, 6, 7].includes(e) ? fm.basketUpgQTY(ctx, 99, e).value : null,
      costQty, costCrop, stock, affordable: costQty != null && (tab === 1 ? fm.magicBeans(ctx) >= costQty : (stock ?? 0) >= costQty),
      unlocked: e < fm.marketUnlockedCount(ctx, tab),
      harvests,
    };
  };

  /* night-market advisor: what beans (banked + trade quote) buy best, ranked by the page's
   * focus. Gain ratios per level use the client formulas with the CURRENT qualified-crop
   * counts (a bean trade zeroes stock, but his GMOs re-qualify as stock regrows — the counts
   * are the steady state). */
  const beanTrade = fm.beanTradeQty(ctx).value;
  const nightAdvisor = (() => {
    const NIGHT_GOAL = { 1: "evo", 2: "growth", 3: "og", 4: "exp", 6: "value", 7: "meta" };
    const counts = fm.qualifiedCropCounts(ctx);
    const budget = fm.magicBeans(ctx) + beanTrade;
    const ratio = (e, L) => {
      const c = MARKET_INFO[e + 8].bonusPerLv;
      if (e === 1) return Math.pow((1 + (L + 1) * c / 100) / (1 + L * c / 100), counts[0]);
      if (e === 3) return (1 + (L + 1) * c / 100) / (1 + L * c / 100);
      const n = counts[fm.gmoCountIdx(e)];
      return (1 + (L + 1) * c * n / 100) / (1 + L * c * n / 100);
    };
    const rows2 = [];
    for (const e of [1, 2, 3, 4, 6, 7]) {
      const lvl = N(sel.farmUpg(s)[2 + e + 8]);
      const maxLv = fm.marketMaxLv(ctx, 1, e);
      if (lvl >= maxLv) { rows2.push({ e, name: MARKET_INFO[e + 8].name, goal: NIGHT_GOAL[e], level: lvl, maxLv, maxed: true }); continue; }
      const nextCost = fm.marketCostQty(ctx, 1, e, lvl);
      // greedy: pour the WHOLE budget into this one upgrade
      let L = lvl, spend = 0, gainAll = 1;
      while (L < maxLv) {
        const cst = fm.marketCostQty(ctx, 1, e, L);
        if (spend + cst > budget) break;
        spend += cst; gainAll *= ratio(e, L); L++;
      }
      rows2.push({
        e, name: MARKET_INFO[e + 8].name, goal: NIGHT_GOAL[e], level: lvl, maxLv,
        nextCost, nextGain: ratio(e, lvl),
        budgetLevels: L - lvl, budgetGain: gainAll, budgetSpend: spend,
      });
    }
    return { budget, rows: rows2 };
  })();

  const report = {
    ts: nowMs,
    overview: {
      farmingLv: fm.farmingLevel(ctx), cropsFound: fm.cropsFound(ctx), totalCrops: 330,
      beans: fm.magicBeans(ctx), instagrow: fm.instagrowCharges(ctx),
      plots: fm.plotOwned(ctx), rankPtsLeft: fm.rankPtsLeft(ctx),
      growthRate: gRate.value, growthNote: gRate.note,
      stickerDmgMulti: fm.stickerDmgMulti(ctx).value,
      medalSeedsAvailable: fm.medalSeedsAvailable(ctx),
    },
    evo: {
      displayStack: evoDisplay.value,
      parts: evoDisplay.parts.map((p) => ({ id: p.id, key: p.key, factor: p.value, status: p.frag.status ?? "computed", note: p.frag.note ?? "" })),
      plots: plotRows,
      medal,
      marginals: evoMarginals(ctx, evoDisplay.parts).map((m) =>
        m.exoticIdx != null ? { ...m, nextInWeeks: nextInWeeks(m.exoticIdx) } : m),
    },
    exotic: {
      week, endsMs: fm.exoticWeekEndsMs(week),
      buysUsed: sel.exoticBuysUsed(s), allowed: allowed.value, freePct: fm.pctExoticFree(ctx),
      totalLevels: fm.exoticTotalLevels(ctx),
      rows,                 // all 60 rows' neutral facts — the page scores by the chosen focus
      currentSlots,
      weeksAhead,
    },
    og: {
      stickerCounts: STICKERS.map((st, i) => ({ i, name: st.name, desc: st.desc, count: Math.round(N(sel.stickerLevels(s)[i])), bonus: i < 7 ? fm.stickerBonus(ctx, i).value : 0 })).filter((x) => x.i < 7),
      stickerOdds: SEED_INFO.map((sd) => ({ tier: sd.tier, name: sd.name, odds: fm.stickerOdds(ctx, sd.tier).value })),
      oddsMulti: fm.stickerOddsMulti(ctx).value,
      dryDays: sel.stickerDryDays(s),
      unlocked: fm.stickersUnlocked(ctx),
      sweetSpots: SEED_INFO.map((sd) => ({ tier: sd.tier, name: sd.name, ...sweetByTier[sd.tier], reached24: ogReachedIn(sd.tier, 24) })),
    },
    markets: {
      day: [0, 1, 2, 3, 4, 5, 6, 7].map((e) => mkRow(0, e)),
      night: [0, 1, 2, 3, 4, 5, 6, 7].map((e) => mkRow(1, e)),
      nightAdvisor,
      beanTrade,
      valueCap: fm.cropValueCap(ctx).value,
      doublerPct: fm.productDoublerPct(ctx),
      cropsOnVine: fm.cropsOnVinePct(ctx),
      depot: fm.DEPOT_DEFS.map((d) => { const r = fm.cropSciBonus(ctx, d.b); return { b: d.b, label: d.label, fmt: d.fmt, value: r.value, status: r.status, note: r.note }; }),
      rankDb: LAND_RANK_DB.map((u, i) => {
        const L = Math.round(N((ranks[2] ?? [])[i]));
        const now = fm.landRankUpg(ctx, i).value;
        // per-point marginal: hyperbolic rows flatten (1.7*base*80/(L+80)^2), Seed rows are flat
        const scale = L > 0 ? now / (i % 5 === 4 ? u.base * L : 1.7 * u.base * L / (L + 80)) : 1;
        const next = (i % 5 === 4 ? u.base * (L + 1) : 1.7 * u.base * (L + 1) / (L + 81)) * scale;
        return {
          i, name: u.name, desc: u.desc, level: L, unlockReq: u.unlockReq,
          maxLv: i % 5 === 4 ? fm.fifthColMaxLv(ctx) : null,
          bonus: now, perPoint: next - now,
          // raw curve data for the client-side Land Rank calculator:
          base: u.base, linear: i % 5 === 4,
          multi: L > 0 ? now / (i % 5 === 4 ? u.base * L : 1.7 * u.base * L / (L + 80)) : null,
        };
      }),
      rankPtsTotal: (ranks[0] ?? []).reduce((t, x) => t + Math.round(N(x)), 0),
      plotRanks: (ranks[0] ?? []).map((x) => Math.round(N(x))),
      /* everything the client-side Land Rank calculator needs beside the rankDb rows: the
       * non-rank factors of each group's chain, so caps and absolute effects compute exactly. */
      rankCalcCtx: {
        multi: Math.max(1, bestTalentAcrossChars(ctx, 207).value) * (1 + fm.exoticBonus(ctx, 14).value / 100),
        fifthColMax: fm.fifthColMaxLv(ctx),
        value: {
          gmo: Math.max(1, fm.basketUpgQTY(ctx, 99, 6).value),
          vote: votingBonus(ctx, 29).value,
          cap: fm.cropValueCap(ctx).value,
          doubler: Math.max(1, Math.floor(1 + fm.productDoublerPct(ctx) / 100)),
        },
        soil: { rankBoostPct: fm.basketUpgQTY(ctx, 0, 7).value },
        medalPlotRank: (() => { const m = plots.findIndex((p) => Number(p?.[0]) === 6); return m >= 0 ? Math.round(N((ranks[0] ?? [])[m])) : null; })(),
      },
      rankGainDisplay: fm.plotRankGainDisplay(ctx).value,
      farmingExpMulti: fm.farmingExpMulti(ctx).value,
    },
    unknowns: [...new Set(ctx.unknowns)],
    exoticNames: Object.fromEntries(MARKET_EXOTIC_INFO.slice(0, 60).map((r) => [r.i, r.name])),
  };
  return report;
}
