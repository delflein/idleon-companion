<script setup>
/**
 * FarmingPage — the farming.html port. Legacy farming.html renders the entire /api/farming report
 * (its ONLY data source) as eight bespoke panels — the richest UI in the app. In the SPA that same
 * report is `farming.value` (appState.js's computed over deriveFarming → stats/farming-report.mjs),
 * so there is no fetch(): the four modules (medal evo push, exotic weekly planner, OG & stickers,
 * markets & spending) plus the overview KPIs, plot grid, and depot all read off one computed.
 *
 * The only page-local logic — the weighted recommendation heuristic (focus presets, exotic
 * buy-vs-hold, night-market fit) — lives in src/core/farming-advice.mjs (framework-free, testable);
 * this component only formats and lays it out. NO TIMERS (product rule): the exotic week is planning
 * data (reset date, rotation forecast), never a live countdown. `farming.value` is null before a
 * save loads, so every panel is guarded behind `v-if="report"`.
 */
import { computed, ref, watch } from "vue";
import { state, farming } from "../data/appState.js";
import { fmt } from "../ui/fmt.js";
import { FOCUS_PRESETS, scoreRow, exoticWeekAdvice, nightAdvisorRanked } from "../core/farming-advice.mjs";
import SpriteIcon from "../ui/SpriteIcon.vue";

/* ---- persisted UI state (localStorage-safe; happy-dom/test envs may lack it) ---- */
const LS = {
  get(k, d) { try { return localStorage.getItem(k) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* no-op */ } },
};
const cadence = ref(Number(LS.get("farmCadence", "1")) || 1); // medal check-ins per day
const focus = ref(LS.get("farmFocus", "evo"));
const showAllMedal = ref(false);
watch(cadence, (v) => LS.set("farmCadence", String(v)));
watch(focus, (v) => LS.set("farmFocus", v));

/* ---- the report + its slices ---- */
const report = computed(() => farming.value);
const overview = computed(() => report.value?.overview ?? null);
const ex = computed(() => report.value?.exotic ?? null);
const mk = computed(() => report.value?.markets ?? null);
const evo = computed(() => report.value?.evo ?? null);
const og = computed(() => report.value?.og ?? null);
const syncedLabel = computed(() => (state.value?.ts ? new Date(state.value.ts).toLocaleString() : ""));

/* ---- formatters (page-local display; the number ladder is the shared fmt) ---- */
const oneIn = (p) => (p > 0 ? (p >= 0.001 ? (100 * p).toFixed(2) + "%" : "1 in " + fmt(1 / p)) : "—");
const daysFmt = (d) => (!isFinite(d) ? "∞" : d >= 365 ? (d / 365).toFixed(1) + " yr" : d >= 1 ? d.toFixed(1) + " d" : (d * 24).toFixed(1) + " h");
const durFmt = (sec) => (!isFinite(sec) ? "∞" : sec >= 86400 ? (sec / 86400).toFixed(1) + " d" : sec >= 3600 ? (sec / 3600).toFixed(1) + " h" : sec >= 60 ? (sec / 60).toFixed(0) + " min" : sec.toFixed(0) + " s");
const nice = (s) => String(s ?? "").replaceAll("_", " ");
const pow2 = (n) => Math.pow(2, n || 0);

/* ---- caveat (honesty contract: unknown sources → lower bound) ---- */
const unknownCount = computed(() => report.value?.unknowns?.length ?? 0);

/* ---- overview tiles ---- */
const weekEnds = computed(() => (ex.value ? new Date(ex.value.endsMs) : null));

/* ---- module 1: medal evolution push ---- */
const medalView = computed(() => {
  const m = evo.value?.medal;
  if (!m) return null;
  const rollsPerDay = m.plots.length * Math.min(cadence.value, 24 / m.cycleHours);
  const rows = showAllMedal.value ? m.remaining : m.remaining.slice(0, 10);
  return { ...m, rollsPerDay, rows, firstOdds: m.remaining[0]?.chancePerCycle };
});

/* ---- "what to buy for evolution" marginals: in-rotation exotics float above unavailable ones ---- */
const marginalsSorted = computed(() => {
  const ms = evo.value?.marginals ?? [];
  const k = (x) => x.factor * (x.exoticIdx != null && x.nextInWeeks !== 0 ? 0.7 : 1);
  return [...ms].sort((a, b) => k(b) - k(a));
});

/* ---- Land Rank Database summary tiles ---- */
const RANK_GROUPS = { Evolution: [0, 3, 10, 15], Production: [1, 8, 17], "Soil EXP": [2, 6, 13], Overgrowth: [7, 11, 18], "Farm EXP": [5, 12, 16] };
const rankSummary = computed(() => {
  const rk = mk.value?.rankDb;
  if (!rk) return null;
  const total = (evo.value?.plots ?? []).reduce((t, p) => t + p.rank, 0);
  const groups = Object.entries(RANK_GROUPS).map(([g, ids]) => ({
    g,
    lv: ids.reduce((t, i) => t + rk[i].level, 0),
    sub: ids.map((i) => nice(rk[i].name).split(" ")[1] ?? "").join(" / "),
  }));
  return { total, unspent: overview.value?.rankPtsLeft ?? 0, groups };
});

/* ---- module 2: exotic weekly planner (focus-scored) ---- */
const exoticAdvice = computed(() => (report.value ? exoticWeekAdvice(report.value, focus.value) : null));
const forecastHot = (idx) => {
  const r = report.value && ex.value ? report.value.exotic.rows.find((x) => x.idx === idx) : null;
  const max = exoticAdvice.value?.maxScore ?? 0;
  return r ? scoreRow(focus.value, r) >= max * 0.6 : false;
};
const forecastRows = (slots) => slots.map((idx) => {
  const r = report.value.exotic.rows.find((x) => x.idx === idx);
  return { hot: forecastHot(idx), name: r ? r.name : "#" + idx };
});
const forecastHotCount = (slots) => slots.filter((idx) => forecastHot(idx)).length;

/* ---- module 3: plot grid — in-game floors stack BOTTOM-UP (plots 0-8 are the bottom row) ---- */
const plotsOrdered = computed(() => {
  const plots = evo.value?.plots ?? [];
  const rows = [];
  for (let r = 0; r * 9 < plots.length; r++) rows.push(plots.slice(r * 9, r * 9 + 9));
  return rows.reverse().flat();
});

/* ---- module 3: sticker dry-day curve (display re-derivation of the odds sub-label) ---- */
const dryOddsMulti = computed(() => {
  const d = og.value?.dryDays ?? 0;
  return Math.max(1, Math.pow(2, Math.min(12, d)) + 1500 * Math.max(0, d - 11));
});

/* ---- module 4: markets + glassy (tier 5) OG sweet spot ---- */
const glassy = computed(() => (og.value?.sweetSpots ?? []).find((s) => s.tier === 5) ?? null);
const nightAdv = computed(() => (report.value ? nightAdvisorRanked(report.value, focus.value) : null));
const nightAdvSorted = computed(() => nightAdv.value?.rows ?? []);

/* ---- focus picker options ---- */
const FOCUS_OPTIONS = Object.entries(FOCUS_PRESETS).map(([k, p]) => ({ k, label: p.label }));
</script>

<template>
  <div class="page">
    <header class="app">
      <h1>
        <SpriteIcon
          file="FarmCrop23"
          dir="data"
          :size="26"
        />
        Farming
      </h1>
      <span class="meta">{{ syncedLabel ? "synced " + syncedLabel : "" }}</span>
    </header>

    <div
      id="err"
      class="err"
    />

    <template v-if="report">
      <div
        v-if="unknownCount"
        class="caveat"
      >
        <b>Lower bound.</b> {{ unknownCount }} source{{ unknownCount === 1 ? "" : "s" }} could not be fully derived
        (meal mastery multis, some lab/superbit gates) — evo &amp; EXP numbers can only be HIGHER.
      </div>

      <!-- ===== overview KPI tiles ===== -->
      <div class="cards">
        <div class="tile">
          <div class="label">
            Crops found
          </div>
          <div class="value">
            {{ overview.cropsFound }}<span class="of">/{{ overview.totalCrops }}</span>
          </div>
          <div class="sub">
            every find feeds the Crop Depot
          </div>
        </div>
        <div class="tile">
          <div class="label">
            Bean trade quote
          </div>
          <div class="value">
            +{{ fmt(mk.beanTrade) }}
          </div>
          <div class="sub">
            have {{ fmt(overview.beans) }} — trading wipes crop stock
          </div>
        </div>
        <div class="tile">
          <div class="label">
            Exotic buys
          </div>
          <div class="value">
            {{ ex.buysUsed }}<span class="of">/{{ ex.allowed }}</span>
          </div>
          <div class="sub">
            week {{ ex.week }} · resets {{ weekEnds.toLocaleDateString(undefined, { weekday: "short" }) }}
            {{ weekEnds.toLocaleDateString() }} · {{ ex.freePct }}% free
          </div>
        </div>
        <div class="tile">
          <div class="label">
            Instagrows
          </div>
          <div class="value">
            {{ overview.instagrow }}
          </div>
          <div class="sub">
            7h medal cycles on demand
          </div>
        </div>
        <div class="tile">
          <div class="label">
            Rank pts unspent
          </div>
          <div class="value">
            {{ overview.rankPtsLeft }}
          </div>
          <div class="sub">
            Land Rank Database
          </div>
        </div>
        <div class="tile">
          <div class="label">
            Farming LV
          </div>
          <div class="value">
            {{ overview.farmingLv }}
          </div>
          <div class="sub">
            Geneology scales past 50/100/…/250
          </div>
        </div>
        <div class="tile">
          <div class="label">
            Sticker DMG
          </div>
          <div class="value">
            ×{{ fmt(overview.stickerDmgMulti) }}
          </div>
          <div class="sub">
            true damage multiplier
          </div>
        </div>
      </div>

      <!-- ===== module 1: medal evolution push ===== -->
      <section
        v-if="medalView"
        class="panel"
      >
        <h2>
          Medal evolution push
          <span class="hint">each collect of a medal plot rolls evolution once — check-ins, not growth speed, set the pace</span>
          <span class="spacer" />
          <RouterLink
            class="statlink"
            to="/stats?recipe=cropEvo"
          >
            full Crop Evo Chance breakdown →
          </RouterLink>
          <label class="why">check-ins/day
            <select
              v-model.number="cadence"
              class="inlinesel"
            >
              <option
                v-for="c in [1, 2, 3]"
                :key="c"
                :value="c"
              >{{ c }}{{ c === 3 ? " (max ~3.4)" : "" }}</option>
            </select></label>
        </h2>
        <div
          class="cards"
          style="margin-bottom:10px"
        >
          <div class="tile">
            <SpriteIcon
              :file="'FarmCrop' + medalView.frontier"
              dir="data"
              :size="28"
            />
            <div class="label">
              Frontier crop
            </div>
            <div class="value">
              #{{ medalView.frontier }}
            </div>
            <div class="sub">
              {{ 329 - medalView.frontier }} crops left in the Medal chain
            </div>
          </div>
          <div class="tile">
            <div class="label">
              Next crop odds
            </div>
            <div class="value">
              {{ oneIn(medalView.firstOdds) }}
            </div>
            <div class="sub">
              per collect, per plot — the only lever is your Crop Evo Chance stat
            </div>
          </div>
          <div class="tile">
            <div class="label">
              Evo rolls/day
            </div>
            <div class="value">
              {{ medalView.rollsPerDay.toFixed(0) }}
            </div>
            <div class="sub">
              {{ medalView.plots.length }} medal plots × {{ cadence }} check-in{{ cadence > 1 ? "s" : "" }} (cycle {{ medalView.cycleHours }}h)
            </div>
          </div>
        </div>
        <div class="scroll">
          <table>
            <tr>
              <th>Crop</th><th class="num">
                Chance / roll
              </th><th class="num">
                Expected time
              </th>
            </tr>
            <tr
              v-for="r in medalView.rows"
              :key="r.cropId"
            >
              <td>
                <SpriteIcon
                  :file="'FarmCrop' + r.cropId"
                  dir="data"
                  :size="22"
                /> #{{ r.cropId }}
              </td>
              <td class="num">
                {{ oneIn(r.chancePerCycle) }}
              </td>
              <td class="num">
                <b>{{ daysFmt(r.expectedCycles / medalView.rollsPerDay) }}</b>
              </td>
            </tr>
          </table>
        </div>
        <button
          v-if="medalView.remaining.length > 10"
          class="showmore"
          @click="showAllMedal = !showAllMedal"
        >
          {{ showAllMedal ? "show fewer" : `show all ${medalView.remaining.length} crops` }}
        </button>
        <div class="legend">
          Expected value of the geometric wait at your cadence — every ×gain below shortens ALL rows at once.
          Instagrows finish a growing cycle but add no extra rolls on a grown plot.
        </div>
      </section>

      <!-- ===== "what to buy for evolution" marginals ===== -->
      <section
        v-if="marginalsSorted.length"
        class="panel"
      >
        <h2>
          What to buy for evolution
          <span class="hint">exact multiplier each action puts on every medal row above — the biggest levers you control</span>
        </h2>
        <div class="scroll">
          <table>
            <tr>
              <th>Upgrade</th><th class="num">
                Stat gain
              </th><th>Costs</th><th>Available</th>
            </tr>
            <tr
              v-for="(x, i) in marginalsSorted"
              :key="i"
            >
              <td>
                <b>{{ nice(x.label) }}</b>
                <div class="why">
                  {{ x.where }} · {{ x.note }}
                </div>
              </td>
              <td class="num gain">
                ×{{ x.factor.toFixed(3) }}
              </td>
              <td class="note">
                {{ x.action }}
              </td>
              <td>
                <span
                  v-if="x.exoticIdx == null"
                />
                <span
                  v-else-if="x.nextInWeeks === 0"
                  class="chip live"
                >in rotation NOW</span>
                <span
                  v-else-if="x.nextInWeeks != null"
                  class="chip soon"
                >week +{{ x.nextInWeeks }}</span>
                <span
                  v-else
                  class="chip dead"
                >not in next 20 wk</span>
              </td>
            </tr>
          </table>
        </div>
      </section>

      <!-- ===== Land Rank Database summary ===== -->
      <section
        v-if="rankSummary"
        class="panel"
      >
        <h2>
          Land Rank Database <span class="hint">{{ rankSummary.total }} points · <b>{{ rankSummary.unspent }} unspent</b></span>
          <span class="spacer" />
          <RouterLink
            class="statlink"
            to="/landrank"
          >
            open the Land Rank Calculator →
          </RouterLink>
        </h2>
        <div class="cards">
          <div
            v-for="grp in rankSummary.groups"
            :key="grp.g"
            class="tile"
          >
            <div class="label">
              {{ grp.g }}
            </div>
            <div class="value">
              {{ fmt(grp.lv) }}<span class="of"> lv</span>
            </div>
            <div class="sub">
              {{ grp.sub }}
            </div>
          </div>
        </div>
        <div class="legend">
          The calculator recommends a full allocation for a chosen goal — no hand-tuned ratios, caps modeled.
          ⚠ The in-game "rank XP gain" display overstates (client-verified); rank plots in order.
        </div>
      </section>

      <!-- ===== module 2: exotic market — this week ===== -->
      <section
        v-if="exoticAdvice"
        class="panel"
      >
        <h2>
          Exotic Market — this week
          <span class="hint">scored for your focus:</span>
          <select
            v-model="focus"
            class="inlinesel"
          >
            <option
              v-for="o in FOCUS_OPTIONS"
              :key="o.k"
              :value="o.k"
            >
              {{ o.label }}
            </option>
          </select>
        </h2>
        <div class="scroll">
          <table>
            <tr>
              <th>Row</th><th class="num">
                Bonus
              </th><th class="num">
                LV
              </th><th class="num">
                +lv / buy
              </th><th>For +1 more lv/buy</th><th>Fit</th><th>Advice</th>
            </tr>
            <tr
              v-for="c in exoticAdvice.current"
              :key="c.slot"
              :class="{ dim: c.score < exoticAdvice.maxScore * 0.3 }"
            >
              <td>
                <SpriteIcon
                  :file="'FarmCrop' + c.cropId"
                  dir="data"
                  :size="18"
                /> <b>{{ nice(c.name) }}</b>
                <div class="why">
                  {{ nice(c.desc).split("@")[0] }}
                </div>
              </td>
              <td
                class="num"
                :title="c.saturating ? `saturating: approaches ${c.coeff} and flattens — ${(100 * (c.satRatio ?? 0)).toFixed(0)}% of cap reached` : 'linear, no cap'"
              >
                <template v-if="c.saturating">
                  {{ c.bonus.toFixed(1) }} <span class="why">/ {{ fmt(c.coeff) }}</span>
                </template>
                <template v-else>
                  {{ fmt(c.bonus) }}
                </template>
              </td>
              <td class="num">
                {{ c.level }}
              </td>
              <td class="num">
                +{{ c.levelsPerBuy }}
              </td>
              <td class="note">
                <template v-if="c.softCapped">
                  <span class="chip dead">soft-capped</span> <span class="why">needs {{ fmt(c.stockForNextLv) }} more crop</span>
                </template>
                <template v-else-if="c.stockForNextLv != null">
                  farm {{ fmt(c.stockForNextLv) }} more <SpriteIcon
                    :file="'FarmCrop' + c.cropId"
                    dir="data"
                    :size="14"
                  />
                </template>
                <template v-else>
                  —
                </template>
              </td>
              <td>
                <span
                  class="goal"
                  :class="{ hot: c.score >= exoticAdvice.maxScore * 0.6 }"
                >{{ c.goal }}</span>
              </td>
              <td class="note">
                <template v-if="c.advice.kind === 'hold'">
                  hold — {{ c.advice.holds.map((b) => `${nice(b.name)} wk +${b.week}`).join(", ") }}
                </template>
                <b v-else-if="c.advice.kind === 'buy'">buy</b>
                <template v-else-if="c.advice.kind === 'ok'">
                  ok
                </template>
                <template v-else>
                  low fit
                </template>
              </td>
            </tr>
          </table>
        </div>
        <div class="legend">
          {{ ex.allowed - ex.buysUsed }} buys left this week (as of last sync) · first {{ ex.freePct }}% of buys are free ·
          a paid buy ZEROES the cost crop's stock. "+lv/buy" grows with the log of your stock — past the
          soft-cap, farming more of that fruit is not worth it.
        </div>
        <details
          class="fold"
          style="margin-top:8px"
        >
          <summary>Rotation forecast — next {{ ex.weeksAhead.length }} weeks</summary>
          <div class="scroll">
            <table>
              <tr>
                <th>Week</th><th>Starts</th><th class="note">
                  Rows (bold = strong under your focus)
                </th>
              </tr>
              <tr
                v-for="w in ex.weeksAhead"
                :key="w.week"
                class="wkrow"
                :class="{ hot: forecastHotCount(w.slots) >= 2 }"
              >
                <td>+{{ w.week - ex.week }}</td>
                <td class="why">
                  {{ new Date(w.startMs).toLocaleDateString() }}
                </td>
                <td class="note">
                  <template
                    v-for="(fr, i) in forecastRows(w.slots)"
                    :key="i"
                  >
                    <b v-if="fr.hot">{{ nice(fr.name) }}</b><span v-else>{{ nice(fr.name) }}</span><span v-if="i < w.slots.length - 1"> · </span>
                  </template>
                </td>
              </tr>
            </table>
          </div>
        </details>
      </section>

      <!-- ===== module 3: plots — OG & ranks ===== -->
      <section
        v-if="plotsOrdered.length"
        class="panel"
      >
        <h2>
          Plots — OG &amp; ranks
          <span class="hint">"next OG" = average real time to the next tier at your current multis; collecting resets OG</span>
        </h2>
        <div class="plotgrid">
          <div
            v-for="p in plotsOrdered"
            :key="p.idx"
            class="plot"
            :class="{ medal: p.tier === 6 }"
            :title="`plot ${p.idx} · rank ${p.rank} · OG chance ${oneIn(p.nextOGchance)}`"
          >
            <span v-if="p.cropId != null">
              <SpriteIcon
                :file="'FarmCrop' + p.cropId"
                dir="data"
                :size="20"
              /> </span><span class="og">OG {{ p.og }}</span>
            <div class="sub">
              ×{{ fmt(p.ogMulti) }} value
            </div>
            <div class="sub">
              next OG ≈ <b>{{ daysFmt(p.nextOgAvgDays) }}</b>
            </div>
            <div class="sub">
              rank {{ p.rank }} · {{ p.terminal ? "final crop" : p.tier === 6 ? "evo " + oneIn(p.evoChance) : "evolving" }}
            </div>
          </div>
        </div>
        <div class="legend">
          Medal plots outlined — remember: letting a medal plot ride for OG costs evolution rolls.
        </div>
      </section>

      <!-- ===== module 3: megacrop stickers ===== -->
      <section
        v-if="og"
        class="panel"
      >
        <h2>
          Megacrop stickers <span class="hint">odds per growth/OG tick — a plot's 2^OG multiplies them</span>
        </h2>
        <div
          class="cards"
          style="margin-bottom:10px"
        >
          <div class="tile">
            <div class="label">
              Dry days <span
                class="tip"
                title="Doggie Sticker mechanic: every day without finding a sticker DOUBLES the odds (up to 2^12), then +1500x per day past 11. Finding one resets the counter to 0."
              >ⓘ</span>
            </div>
            <div class="value">
              {{ og.dryDays }}
            </div>
            <div class="sub">
              odds ×{{ fmt(dryOddsMulti) }} and climbing daily
            </div>
          </div>
          <div class="tile">
            <div class="label">
              Odds multi
            </div>
            <div class="value">
              ×{{ fmt(og.oddsMulti) }}
            </div>
            <div class="sub">
              crowns · depot · arcade · sushi · dry days
            </div>
          </div>
        </div>
        <div class="scroll">
          <table>
            <tr>
              <th>Sticker</th><th class="num">
                Found
              </th><th class="num">
                Bonus
              </th><th class="num">
                Base odds / tick
              </th><th class="note">
                Effect
              </th>
            </tr>
            <tr
              v-for="(s, i) in og.stickerCounts"
              :key="s.i"
            >
              <td><b>{{ nice(s.name) }}</b></td>
              <td class="num">
                {{ s.count }}
              </td>
              <td class="num">
                {{ fmt(s.bonus) }}%
              </td>
              <td class="num">
                {{ oneIn(og.stickerOdds[i]?.odds) }}
              </td>
              <td class="note">
                {{ nice(s.desc) }}
              </td>
            </tr>
          </table>
        </div>
        <div class="legend">
          A 2^25 OG glassy plot multiplies its tick odds ×33M — the odds column is BEFORE that.
        </div>
      </section>

      <!-- ===== module 4: markets ===== -->
      <section
        v-if="mk"
        class="panel"
      >
        <h2>
          Markets <span class="hint">day pays crops (the crop shifts per level) · night pays beans · costs include Emperor + Better Day/Night reductions</span>
        </h2>
        <div
          class="cards"
          style="margin-bottom:10px"
        >
          <div class="tile">
            <div class="label">
              OG per day <span
                class="tip"
                :title="`A fresh glassy plot reaches this OG in 24h at your growth multis — what one daily collect banks. For ACTIVE play, value/time peaks at OG ${glassy?.og ?? '?'} (~${daysFmt(glassy?.days)} per harvest): past it, each level takes ~2.5× longer but only doubles the yield.`"
              >ⓘ</span>
            </div>
            <div class="value">
              OG {{ glassy?.reached24 ?? "—" }}
            </div>
            <div class="sub">
              glassy, daily collect → ×{{ fmt(pow2(glassy?.reached24 ?? 0)) }} per harvest
            </div>
          </div>
          <div class="tile">
            <div class="label">
              Crop value cap
            </div>
            <div class="value">
              {{ fmt(mk.valueCap) }}×
            </div>
            <div class="sub">
              10,000 base + Stalk Value exotics
            </div>
          </div>
          <div class="tile">
            <div class="label">
              Product doubler
            </div>
            <div class="value">
              {{ fmt(mk.doublerPct) }}%
            </div>
            <div class="sub">
              guaranteed ×{{ Math.floor(1 + mk.doublerPct / 100) }} + {{ (mk.doublerPct % 100).toFixed(0) }}% for one more
            </div>
          </div>
          <div class="tile">
            <div class="label">
              Crops on vine
            </div>
            <div class="value">
              {{ mk.cropsOnVine.expected.toFixed(2) }}
            </div>
            <div class="sub">
              per grow ({{ mk.cropsOnVine.pct.toFixed(0) }}% bonus)
            </div>
          </div>
          <div class="tile">
            <div class="label">
              Farming EXP
            </div>
            <div class="value">
              ×{{ fmt(mk.farmingExpMulti) }}
            </div>
            <div class="sub">
              lower bound (all-skill multi excluded)
            </div>
          </div>
        </div>
        <div class="scroll">
          <table>
            <tr>
              <th>Day Market</th><th class="num">
                LV
              </th><th class="num">
                Bonus
              </th><th>Next level costs</th><th class="note">
                How long to farm it (all {{ overview.plots }} plots locked)
              </th>
            </tr>
            <tr
              v-for="u in mk.day"
              :key="'d' + u.i"
              :class="{ dim: u.level >= u.maxLv }"
            >
              <td>
                <b>{{ nice(u.name) }}</b>
                <div class="why">
                  {{ nice(u.desc) }}
                </div>
              </td>
              <td class="num">
                {{ u.level }}<span class="of">/{{ u.maxLv }}</span>
              </td>
              <td class="num">
                {{ u.gmoScaled != null ? "×" + fmt(u.gmoScaled) : fmt(u.bonus) }}
              </td>
              <td>
                <template v-if="u.level >= u.maxLv">
                  <span class="chip live">maxed</span>
                </template>
                <template v-else>
                  <SpriteIcon
                    :file="'FarmCrop' + u.costCrop"
                    dir="data"
                    :size="18"
                  /> {{ fmt(u.costQty) }} <span class="why">(have {{ fmt(u.stock) }})</span>
                  <span
                    v-if="u.affordable"
                    class="chip live"
                  >✓</span>
                </template>
              </td>
              <td class="note">
                <template v-if="u.harvests">
                  active <b>{{ durFmt(u.harvests.activeSec) }}</b>
                  <span class="why">(harvest-all every ~{{ durFmt(u.harvests.intervalSec) }}, plots hit OG {{ u.harvests.atOgActive }})</span><br>
                  passive <b>{{ daysFmt(u.harvests.passiveDays) }}</b>
                  <span class="why">(daily collect @ OG {{ u.harvests.atOgPassive }})</span>
                </template>
              </td>
            </tr>
            <tr>
              <th>Night Market</th><th class="num">
                LV
              </th><th class="num">
                Bonus
              </th><th>Next level costs</th><th />
            </tr>
            <tr
              v-for="u in mk.night"
              :key="'n' + u.i"
              :class="{ dim: u.level >= u.maxLv }"
            >
              <td>
                <b>{{ nice(u.name) }}</b>
                <div class="why">
                  {{ nice(u.desc) }}
                </div>
              </td>
              <td class="num">
                {{ u.level }}<span class="of">/{{ u.maxLv }}</span>
              </td>
              <td class="num">
                {{ u.gmoScaled != null ? "×" + fmt(u.gmoScaled) : fmt(u.bonus) }}
              </td>
              <td>
                <template v-if="u.level >= u.maxLv">
                  <span class="chip live">maxed</span>
                </template>
                <template v-else>
                  {{ fmt(u.costQty) }} beans
                  <span
                    v-if="u.affordable"
                    class="chip live"
                  >✓</span>
                </template>
              </td>
              <td />
            </tr>
          </table>
        </div>

        <!-- night-market advisor -->
        <template v-if="nightAdv">
          <h2 style="margin-top:16px">
            Night Market — where to put the beans
            <span class="hint">budget = banked {{ fmt(overview.beans) }} + trade quote {{ fmt(mk.beanTrade) }} = <b>{{ fmt(nightAdv.budget) }}</b> · focus:</span>
            <select
              v-model="focus"
              class="inlinesel"
            >
              <option
                v-for="o in FOCUS_OPTIONS"
                :key="o.k"
                :value="o.k"
              >
                {{ o.label }}
              </option>
            </select>
          </h2>
          <div class="scroll">
            <table>
              <tr>
                <th>Upgrade</th><th class="num">
                  Next lv
                </th><th class="num">
                  Full budget buys
                </th><th class="num">
                  Total gain
                </th><th>Fit</th>
              </tr>
              <tr
                v-for="r in nightAdvSorted"
                :key="r.e"
                :class="{ dim: r.fit < nightAdv.maxFit * 0.2 }"
              >
                <td>
                  <b>{{ nice(r.name) }}</b> <span class="why">lv {{ r.level }}/{{ r.maxLv }}</span>
                </td>
                <td class="num">
                  {{ fmt(r.nextCost) }} <span class="why">×{{ r.nextGain.toFixed(3) }}</span>
                </td>
                <td class="num">
                  <template v-if="r.budgetLevels > 0">
                    +{{ r.budgetLevels }} lv <span class="why">({{ fmt(r.budgetSpend) }})</span>
                  </template>
                  <template v-else>
                    can't afford
                  </template>
                </td>
                <td class="num gain">
                  {{ r.budgetLevels > 0 ? "×" + fmt(r.budgetGain) : "—" }}
                </td>
                <td>
                  <span
                    class="goal"
                    :class="{ hot: r.fit >= nightAdv.maxFit * 0.6 }"
                  >{{ r.goal }}</span>
                </td>
              </tr>
            </table>
          </div>
          <div class="legend">
            "Full budget buys" pours everything into that ONE upgrade (costs compound per level). Super GMO
            multiplies every other GMO — its gain column already reflects that. A trade wipes crop stock;
            your GMO thresholds re-qualify as stock regrows.
          </div>
        </template>
      </section>

      <!-- ===== crop depot ===== -->
      <section
        v-if="mk"
        class="panel"
      >
        <h2>
          Crop Depot <span class="hint">every unique crop found scales all of these — the medal push feeds them directly</span>
        </h2>
        <div class="cards">
          <div
            v-for="d in mk.depot"
            :key="d.b"
            class="tile"
          >
            <div class="label">
              {{ d.label }}
            </div>
            <div class="value">
              {{ d.fmt.startsWith("x") ? "×" + fmt(d.value) : "+" + fmt(d.value) + (d.fmt.includes("%") ? "%" : "") }}
            </div>
            <div class="sub">
              {{ d.status !== "computed" ? d.status : "" }}
            </div>
          </div>
        </div>
      </section>
    </template>

    <p
      v-else
      class="note"
    >
      No farming report — sync a save first.
    </p>
  </div>
</template>

<style scoped>
.meta { color: var(--ink-muted); font-size: 12px; margin-left: auto; }
.caveat { border-left: 3px solid var(--warning); background: rgba(250, 178, 25, .06); padding: 8px 12px; border-radius: 0 8px 8px 0; margin-bottom: 12px; color: var(--ink-2); font-size: 12.5px; }
header.app { display: flex; align-items: baseline; gap: 10px; }
header.app h1 { display: flex; align-items: center; gap: 8px; }

.spacer { flex: 1; }
.why { color: var(--ink-muted); font-size: 11px; }
.gain { color: var(--good); font-weight: 700; }
.legend { color: var(--ink-muted); font-size: 11.5px; margin-top: 6px; }
.statlink { color: var(--accent); font-size: 12px; font-weight: 650; text-decoration: none; }
.tip { cursor: help; color: var(--accent); font-weight: 700; border-bottom: 1px dotted var(--accent); }

.goal { font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .4px;
  padding: 1px 6px; border-radius: 8px; background: var(--well); border: 1px solid var(--border); }
.goal.hot { color: var(--good); border-color: rgba(12, 163, 12, .5); }

.plotgrid { display: grid; grid-template-columns: repeat(9, minmax(88px, 1fr)); gap: 6px; }
@media (max-width: 940px) { .plotgrid { grid-template-columns: repeat(3, 1fr); } }
.plot { background: var(--well); border: 1px solid var(--border); border-radius: 8px; padding: 6px 7px; font-size: 11.5px; }
.plot .og { font-weight: 800; color: var(--accent); }
.plot.medal { border-color: var(--warning); box-shadow: 0 0 0 1px var(--warning) inset; }
.plot .sub { color: var(--ink-muted); font-size: 10.5px; }

.wkrow.hot td { background: var(--glow); }
.panel { margin-top: 14px; }
</style>
