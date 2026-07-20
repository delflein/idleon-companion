<script setup>
/**
 * MiningPage — the mining.html port (docs/PANELS.md's worked example). Legacy mining.html's whole
 * body is the generic recipe-breakdown module for `stats.miningEff` (no `entities.w1` fields, no
 * `/api/w1` glossary fetch — confirmed in docs/migration/survey-pages.md: "stats.miningEff only
 * (no entity fields)... purely the generic recipe module"). So this page is exactly one
 * `StatModule`, fed from appState's `stats` computed instead of `fetch('/api/stats')`.
 */
import { computed } from "vue";
import { state, stats, useHistory } from "../data/appState.js";
import StatModule from "../ui/StatModule.vue";

const miningStat = computed(() => stats.value?.miningEff ?? null);
const charNames = computed(() => state.value?.charNames ?? []);

// Legacy `loadHistory()`: one series key per non-unknown term, plus the recipe's own total.
const historyKeys = computed(() => {
  const st = miningStat.value;
  if (!st) return [];
  const keys = [`stat.${st.name}`];
  for (const t of st.collapsed.terms) if (t.status !== "unknown") keys.push(`stat.${st.name}.${t.id}`);
  return keys;
});
// NOTE (flagged for later batches): useHistory(keys) snapshots `keys` once at call time — it
// isn't reactive to `keys` changing afterward (appState.js has no watcher on its `keys` param).
// That's fine here because `stats` is already populated by the time a page mounts in practice
// (init() resolves before routing renders a page) and the pilot test harness seeds `state`
// before mount — but it means a page that mounts before the FIRST sync ever completes would
// keep an empty history forever for that visit. Worth a real decision (reactive keys, or a
// shared "reload on first non-empty keys" composable) before more pages copy this line.
const { series } = useHistory(historyKeys.value);
</script>

<template>
  <header class="app">
    <h1>Mining</h1>
  </header>
  <div
    id="err"
    class="err"
  />
  <StatModule
    :stat="miningStat"
    title="Mining Efficiency"
    :icon="{ file: 'Copper', dir: 'afk_targets' }"
    blurb="Every source that speeds up mining, per character — tool, talents, stats, statue, and stamps."
    :char-names="charNames"
    :series="series"
  />
</template>
