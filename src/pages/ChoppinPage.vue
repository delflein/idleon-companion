<script setup>
/**
 * ChoppinPage — the choppin.html port. Same shape as MiningPage.vue: legacy choppin.html is
 * `stats.choppinEff` only, "no unique entity fields" (docs/migration/survey-pages.md) — the
 * generic recipe module, byte-identical wiring to mining/kitchens/meals/owl, just a different
 * recipe name/icon/blurb.
 */
import { computed } from "vue";
import { state, stats, useHistory } from "../data/appState.js";
import StatModule from "../ui/StatModule.vue";

const choppinStat = computed(() => stats.value?.choppinEff ?? null);
const charNames = computed(() => state.value?.charNames ?? []);

const historyKeys = computed(() => {
  const st = choppinStat.value;
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
    <h1>Choppin</h1>
  </header>
  <div
    id="err"
    class="err"
  />
  <StatModule
    :stat="choppinStat"
    title="Choppin Efficiency"
    :icon="{ file: 'Oak_Tree', dir: 'afk_targets' }"
    blurb="Same shared efficiency chain as mining, applied to Choppin — no W1-unique terms of its own."
    :char-names="charNames"
    :series="series"
  />
</template>
