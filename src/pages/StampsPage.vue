<script setup>
/**
 * StampsPage — the stamps.html port. Legacy stamps.html has no recipe module or stats/history
 * fetch at all (docs/migration/survey-pages.md: "/api/state only (no stats/history)") — a flat
 * per-tab stamp table (entities.w1.stamps[]) with a goal-driven sort. Both sort modes are
 * documented UX heuristics, not calculations (survey: "sort mode is a documented UX
 * heuristic/proxy, not a calculation") — "growth" ranks by current level ascending as a
 * level-only proxy for "biggest proportional bonus jump," since the per-level bonus magnitude
 * itself isn't in the parsed save.
 */
import { ref, computed } from "vue";
import { entities } from "../data/appState.js";
import ShowMore from "../ui/ShowMore.vue";
import Chip from "../ui/Chip.vue";
import SpriteIcon from "../ui/SpriteIcon.vue";
import { fmt, niceItem } from "../ui/fmt.js";

const w1 = computed(() => entities.value?.w1 ?? null);
const stamps = computed(() => w1.value?.stamps ?? []);
const stampsLeveled = computed(() => stamps.value.filter((s) => s.level > 0).length);
const gilded = computed(() => stamps.value.some((s) => s.gilded));

const TABS = [["Combat", 0], ["Skills", 1], ["Misc", 2]];
const activeTab = ref(0);
const goal = ref("cheap"); // "cheap" | "growth"

function stampEffectText(s) {
  return String(s.effect ?? "").replace(/\{\}/g, "").replace(/_/g, " ").replace(/\s+/g, " ").trim();
}

function levelPct(r) {
  return r.maxLevel > 0 ? Math.max(0, Math.min(100, (r.level / r.maxLevel) * 100)) : 100;
}

const tabRows = computed(() => stamps.value.filter((s) => s.tab === activeTab.value));
const sortedRows = computed(() => {
  const rows = [...tabRows.value];
  if (goal.value === "cheap") {
    rows.sort((a, b) => (a.nextGoldCost ?? a.nextMatCost ?? Infinity) - (b.nextGoldCost ?? b.nextMatCost ?? Infinity));
  } else {
    rows.sort((a, b) => a.level - b.level);
  }
  return rows;
});

const goalNote = computed(() => (goal.value === "cheap"
  ? "Sorted by the coin or material amount your next level costs — cheapest first."
  : "Sorted by current level, ascending — lower-level stamps get the biggest proportional bonus jump from their next level."));
</script>

<template>
  <header class="app">
    <h1>Stamps</h1>
  </header>
  <div
    id="err"
    class="err"
  />

  <template v-if="w1">
    <div class="cards">
      <div class="tile">
        <SpriteIcon
          file="UIstampB"
          dir="data"
          :size="28"
        />
        <div class="label">
          Stamps leveled
        </div>
        <div class="value">
          {{ stampsLeveled }}<span class="of">/{{ stamps.length || 125 }}</span>
        </div>
        <div class="sub">
          {{ gilded ? "gilded — upgrade costs cut" : "levels are account-wide" }}
        </div>
      </div>
    </div>

    <section class="panel">
      <h2>
        <SpriteIcon
          file="UIstampB"
          dir="data"
          :size="20"
        />
        Stamps
        <span class="hint">Level, next-upgrade cost, and effect for every stamp you've collected.</span>
        <span style="flex:1" />
        <select
          v-model="goal"
          class="inlinesel"
        >
          <option value="cheap">
            Cheapest next levels
          </option>
          <option value="growth">
            Biggest bonus growth
          </option>
        </select>
      </h2>
      <div
        v-if="gilded"
        class="chips"
      >
        <Chip
          variant="live"
          force
        >
          Gilded stamps active — upgrade costs cut across the board
        </Chip>
      </div>
      <div class="tabs">
        <button
          v-for="[label, i] in TABS"
          :key="i"
          class="f"
          :class="{ active: activeTab === i }"
          @click="activeTab = i"
        >
          {{ label }}
        </button>
      </div>
      <div class="caveat">
        Coins and materials on hand aren't in the parsed save yet, so these are costs to plan around — not "can afford right now" checks.
      </div>
      <p class="note">
        {{ goalNote }}
      </p>
      <ShowMore
        v-slot="{ items }"
        :items="sortedRows"
        :cap="12"
      >
        <div class="scroll">
          <table>
            <tr>
              <th>Stamp</th><th>Level</th><th>Effect</th><th class="num">
                Next cost
              </th>
            </tr>
            <tr
              v-for="r in items"
              :key="r.id"
            >
              <td>
                <b>{{ niceItem(r.name) }}</b>
              </td>
              <td>
                Lv {{ r.level }}
                <div
                  v-if="r.nextGoldCost == null"
                  class="note"
                >
                  buying with materials now
                </div>
                <div
                  v-else
                  class="bar-bg"
                  style="margin-top:3px"
                >
                  <div
                    class="bar-fill"
                    :style="{ width: levelPct(r) + '%' }"
                  />
                </div>
              </td>
              <td class="note">
                {{ stampEffectText(r) }}
              </td>
              <td class="num">
                <template v-if="r.nextGoldCost == null">
                  {{ fmt(r.nextMatCost) }}× {{ niceItem(r.matItem) }}
                </template>
                <template v-else>
                  {{ fmt(r.nextGoldCost) }} gold
                </template>
              </td>
            </tr>
          </table>
        </div>
      </ShowMore>
    </section>
  </template>
  <p
    v-else
    class="note"
  >
    No <code>w1</code> entity on this snapshot yet.
  </p>
</template>

<style scoped>
/* .tabs/.caveat aren't in src/styles/base.css yet (no other ported page has needed a filter-tab
 * bar or a non-lowerbound honesty caveat box) — ported verbatim from companion.css. */
.tabs { display: flex; gap: 6px; margin-bottom: 10px; }
.tabs button { background: var(--well); border: 1.5px solid var(--border); border-radius: 999px; color: var(--ink-2); padding: 3px 12px; font: inherit; font-size: 12.5px; font-weight: 650; cursor: pointer; }
.tabs button.active { border-color: var(--accent); color: var(--accent); }
.caveat { border-left: 3px solid var(--warning); background: rgba(250, 178, 25, .06); padding: 8px 11px; border-radius: 0 10px 10px 0; margin-bottom: var(--gap); font-size: 12.5px; color: var(--ink-2); }
</style>
