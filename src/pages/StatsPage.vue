<script setup>
/**
 * StatsPage — the stats.html port (the Stat Explorer). `stats.value` (appState) is the full
 * evaluated recipe map — the exact shape the legacy /api/stats returned, one entry per registered
 * recipe. The Explorer is a recipe picker driving StatModule.vue (THE shared recipe-breakdown
 * renderer, which already carries the per-character selector, per-term drill-down, sparkline
 * history, and the honesty-contract "lower bound" caveat). Manual override inputs were removed
 * 2026-07-20 — Tome/lab/vote are all auto-derived now (see appState.js's note).
 *
 * DELIBERATE SCOPE (stated, per the migration brief): the legacy page's dev-only "internals"
 * toggle, its additive-pool / multiplier-chain split tiles, and its per-character comparison bar
 * chart are folded into StatModule's single unified view (player-facing eqMult sort, per-char
 * select, coverage tile). The recipe deep-link (`?recipe=…`, used by SailingPage's "full
 * breakdown →" links) is preserved via the route query.
 */
import { computed, ref } from "vue";
import { useRoute } from "vue-router";
import { state, stats, useHistory } from "../data/appState.js";
import StatModule from "../ui/StatModule.vue";
import SpriteIcon from "../ui/SpriteIcon.vue";

const route = useRoute();
const charNames = computed(() => state.value?.charNames ?? []);

const recipeList = computed(() => (stats.value ? Object.values(stats.value) : []));
/* User selection wins; otherwise the ?recipe= deep-link; otherwise the first registered recipe. */
const picked = ref(null);
const recipe = computed(() => {
  if (!stats.value) return null;
  if (picked.value && stats.value[picked.value]) return picked.value;
  const q = route.query.recipe;
  if (q && stats.value[q]) return q;
  const names = Object.keys(stats.value);
  return names.length ? names[0] : null;
});
const currentStat = computed(() => (recipe.value ? stats.value[recipe.value] : null));

/* History for the selected recipe: total + every non-unknown term (legacy loadHistory). */
const historyKeys = computed(() => {
  const st = currentStat.value;
  if (!st) return [];
  const keys = [`stat.${st.name}`];
  for (const t of st.collapsed.terms) if (t.status !== "unknown") keys.push(`stat.${st.name}.${t.id}`);
  return keys;
});
const { series } = useHistory(() => historyKeys.value);
</script>

<template>
  <header class="app">
    <h1>
      <SpriteIcon
        file="Tome_0"
        dir="etc"
        :size="26"
      />
      Stat Explorer
    </h1>
  </header>
  <div
    id="err"
    class="err"
  />

  <template v-if="currentStat">
    <section class="panel picker">
      <h2>
        Recipe
        <span class="hint">every account/skill stat, broken down per source — pick one</span>
      </h2>
      <select
        :value="recipe"
        @change="picked = $event.target.value"
      >
        <option
          v-for="r in recipeList"
          :key="r.name"
          :value="r.name"
        >
          {{ r.label }}
        </option>
      </select>
    </section>

    <StatModule
      :key="recipe"
      :stat="currentStat"
      :title="currentStat.label"
      :icon="{ file: 'Tome_0', dir: 'etc' }"
      :blurb="currentStat.format === 'points' ? 'Point sources — flat sum.' : 'Every source feeding this stat — additive sources share one pool, multipliers stack on top; per-character where the stat is active-char sensitive.'"
      :char-names="charNames"
      :series="series"
    />
  </template>

  <p
    v-else
    class="note"
  >
    No snapshot with a stored raw save yet — sync a save to unlock the stat breakdowns.
  </p>
</template>

<style scoped>
.picker select { max-width: 320px; }
section.panel { margin-bottom: var(--gap); }
.inputs { display: flex; gap: 14px; flex-wrap: wrap; align-items: flex-start; }
.inputs .field { display: flex; flex-direction: column; gap: 3px; }
.inputs label { color: var(--ink-muted); font-size: 11.5px; font-weight: 650; }
.inputs input { width: 180px; }
.inputs .why { color: var(--ink-muted); font-size: 11px; max-width: 230px; }
</style>
