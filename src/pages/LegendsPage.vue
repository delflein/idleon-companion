<script setup>
/**
 * LegendsPage — the legends.html port. Legacy legends.html is a 3-tile KPI strip + a sortable
 * 40-row talent table ahead of the `legendTalents` recipe module (docs/migration/survey-pages.md:
 * "entities.w7.legendTalents (points, talents[]); stats.legendTalents" — "simplified recipe-module
 * variant (no per-char/eqMult, account-wide 'points' shape)").
 *
 * TWO DISTINCT NUMBERS, kept distinct exactly as legacy did:
 *  - `entities.w7.legendTalents.points` (earned/spent/available) is the real spendable Legend
 *    Talent PTS economy (src/core/bonuses/thingies.mjs's LegendPTS_owned/_spent) — the top KPI tile.
 *  - `stats.legendTalents` is a DIFFERENT recipe: the sum of all 40 talents' current bonuses as a
 *    monotonic "progress index" (each talent is a different downstream unit — drop rate, refinery
 *    speed, ...) — that's what the StatModule "Full Breakdown & History" section below shows, with
 *    per-talent terms/history/locked-fold for free (replacing legacy's bespoke renderModule()).
 *
 * MODERNIZATION (stated deviation, no functionality dropped): legacy's talent table used a 3-way
 * `<select>` goal-selector (★ known-consumer first / level / coeff) with a fixed cap-10-show-more.
 * Per docs/PANELS.md ("prefer DataTable's real click-to-sort now that it's free"), this is now one
 * DataTable with click-to-sort headers for all three axes (Talent = ★ priority, Level, Coeff,
 * Bonus), fully scrollable with no arbitrary cap — same 40 rows, same 3 sort axes, better UX. The
 * one micro-behavior not preserved: legacy's "star" sort broke ties by level descending; a single
 * column click-sort has no secondary key, so within the same ★ status rows keep the table's
 * natural (id) order until Level is clicked. Not worth a 4th synthetic column for.
 */
import { computed } from "vue";
import { state, entities, stats, useHistory } from "../data/appState.js";
import StatModule from "../ui/StatModule.vue";
import DataTable from "../ui/DataTable.vue";
import SpriteIcon from "../ui/SpriteIcon.vue";
import { fmt } from "../ui/fmt.js";

const charNames = computed(() => state.value?.charNames ?? []);
const w7 = computed(() => entities.value?.w7 ?? null);
const legend = computed(() => w7.value?.legendTalents ?? null); // { points, talents[] }

const maxedCount = computed(() => (legend.value?.talents ?? []).filter((t) => t.level >= t.maxLv).length);
const consumersTotal = computed(() => (legend.value?.talents ?? []).filter((t) => t.knownConsumer).length);
const consumersMaxed = computed(() => (legend.value?.talents ?? []).filter((t) => t.knownConsumer && t.level >= t.maxLv).length);

const talentColumns = [
  { key: "star", label: "Talent", get: (t) => (t.knownConsumer ? 1 : 0) },
  { key: "level", label: "Level", get: (t) => t.level, numeric: true },
  { key: "coeff", label: "Coeff", get: (t) => t.coeff, numeric: true },
  { key: "bonus", label: "Bonus", get: (t) => t.bonus, numeric: true },
];

const STAR_TOOLTIP = "★ marks a talent that is a confirmed input to another registered stat recipe on this site (e.g. talent 1 -> Drop Rate, talent 19 -> Refinery Cycle Speed) — high value to keep leveled if you already care about that recipe. Not a universal priority ranking.";

const legendStat = computed(() => stats.value?.legendTalents ?? null);
const historyKeys = computed(() => {
  const st = legendStat.value;
  if (!st) return [];
  const keys = [`stat.${st.name}`];
  for (const t of st.collapsed.terms) if (t.status !== "unknown") keys.push(`stat.${st.name}.${t.id}`);
  return keys;
});
// See MiningPage.vue's NOTE on useHistory(keys) not being reactive to `keys` changing later.
const { series } = useHistory(historyKeys.value);
</script>

<template>
  <header class="app">
    <h1>Legend Talents</h1>
  </header>
  <div
    id="err"
    class="err"
  />

  <template v-if="legend">
    <div class="cards">
      <div class="tile">
        <SpriteIcon
          file="LegendTalentBG"
          dir="data"
          :size="28"
        />
        <div class="label">
          Points available
        </div>
        <div class="value">
          {{ (legend.points.lowerBound ? "≥ " : "") + fmt(legend.points.available) }}
        </div>
        <div class="sub">
          {{ fmt(legend.points.earned) }} earned, {{ fmt(legend.points.spent) }} spent
        </div>
      </div>
      <div class="tile">
        <div class="label">
          Talents maxed
        </div>
        <div class="value">
          {{ maxedCount }}<span class="of">/{{ legend.talents.length }}</span>
        </div>
        <div class="sub">
          real talents only (ids 40-49 are unimplemented filler)
        </div>
      </div>
      <div class="tile">
        <div class="label">
          ★ known-consumer talents maxed
        </div>
        <div class="value">
          {{ consumersMaxed }}<span class="of">/{{ consumersTotal }}</span>
        </div>
        <div class="sub">
          feed another stat recipe directly
        </div>
      </div>
    </div>

    <section class="panel">
      <h2>
        <SpriteIcon
          file="LegendTalentBG"
          dir="data"
          :size="20"
        />
        Talents
        <span class="hint">
          40 real talents (ids 40-49 are unimplemented "filler" rows in the client, omitted). Each
          is a DIFFERENT downstream unit — drop rate, statue drops, refinery speed, Villager EXP,
          etc.
          <span
            class="tip"
            :title="STAR_TOOLTIP"
          >ⓘ</span>
        </span>
      </h2>
      <p class="note">
        Click a column header to sort — display order only, spend where YOUR goals need it, not by
        this list.
      </p>
      <DataTable
        :columns="talentColumns"
        :rows="legend.talents"
        row-key="id"
        :initial-sort="{ col: 'star', dir: -1 }"
      >
        <template #cell-star="{ row }">
          <b><span
            v-if="row.knownConsumer"
            class="star"
          >★</span> {{ row.name }}</b>
          <div class="where">
            {{ row.short }}
          </div>
        </template>
        <template #cell-level="{ row }">
          {{ row.level }}<span class="of">/{{ row.maxLv }}</span>
        </template>
        <template #cell-coeff="{ row }">
          {{ fmt(row.coeff) }}
        </template>
        <template #cell-bonus="{ row }">
          +{{ fmt(row.bonus) }}
        </template>
      </DataTable>
    </section>
  </template>
  <p
    v-else
    class="note"
  >
    No <code>w7</code> entity on this snapshot yet.
  </p>

  <StatModule
    :stat="legendStat"
    title="Legend Talents — Full Breakdown"
    :icon="{ file: 'LegendTalentBG', dir: 'data' }"
    blurb="Every talent's current bonus as a stat-recipe term — progress-index total, per-term history, and which talents have 0 points spent so far."
    :char-names="charNames"
    :series="series"
  />
</template>

<style scoped>
.tip { cursor: help; color: var(--accent); font-weight: 700; border-bottom: 1px dotted var(--accent); }
.star { color: var(--warning); font-weight: 800; }
</style>
