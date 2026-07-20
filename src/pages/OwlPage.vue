<script setup>
/**
 * OwlPage — the owl.html port. Legacy owl.html is a 3-tile detail panel + upgrade-level table
 * (entities.w1.owl) ahead of the generic `owlRate` recipe module (docs/migration/survey-pages.md:
 * "entities.w1.owl (featherRate, tiers, upgrades[]); GLOSS.{megaFeatherTiers,owlEffects};
 * stats.owlRate"). w1Glossary() supplies the static tier/upgrade flavor text (no save parsing,
 * same payload every call, src/data/derived.js).
 */
import { computed } from "vue";
import { state, entities, stats, useHistory } from "../data/appState.js";
import { w1Glossary } from "../data/derived.js";
import StatModule from "../ui/StatModule.vue";
import SpriteIcon from "../ui/SpriteIcon.vue";
import { fmt, niceItem } from "../ui/fmt.js";

const charNames = computed(() => state.value?.charNames ?? []);
const w1 = computed(() => entities.value?.w1 ?? null);
const owl = computed(() => w1.value?.owl ?? null);

const GLOSS = w1Glossary();
const owlEffByIdx = new Map(GLOSS.owlEffects.map((e) => [e.index, e]));
const curTier = computed(() => GLOSS.megaFeatherTiers.find((t) => t.tier === owl.value?.megafeatherTier));
const nextTier = computed(() => GLOSS.megaFeatherTiers.find((t) => t.tier === (owl.value?.megafeatherTier ?? 0) + 1));

const rateText = computed(() => (owl.value
  ? (owl.value.featherRateLowerBound ? "≥ " : "") + fmt(owl.value.featherRate) + "/sec"
  : "—"));

const owlStat = computed(() => stats.value?.owlRate ?? null);

const historyKeys = computed(() => {
  const st = owlStat.value;
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
    <h1>Owl</h1>
  </header>
  <div
    id="err"
    class="err"
  />

  <template v-if="owl">
    <div class="cards">
      <div class="tile">
        <SpriteIcon
          file="Owl"
          dir="etc"
          :size="28"
        />
        <div class="label">
          Feather rate
        </div>
        <div class="value">
          {{ rateText }}
        </div>
        <div class="sub">
          megafeather tier {{ owl.megafeatherTier }}/10
        </div>
      </div>
    </div>

    <section class="panel">
      <h2>
        <SpriteIcon
          file="Owl"
          dir="etc"
          :size="20"
        />
        Owl
        <span class="hint">Orion's feather generation and upgrade levels — cross-check Account for what feathers buy account-wide.</span>
        <span style="flex:1" />
        <a href="#mod_owlRate">full breakdown ↓</a>
      </h2>
      <div
        class="cards"
        style="margin-bottom:10px"
      >
        <div class="tile">
          <div class="label">
            Feather rate
          </div>
          <div class="value">
            {{ rateText }}
          </div>
          <div class="sub">
            feathers generated per second
          </div>
        </div>
        <div class="tile">
          <div class="label">
            Feathers held
          </div>
          <div class="value">
            {{ fmt(owl.feathers) }}
          </div>
          <div class="sub">
            {{ owl.shinyFeathers ? fmt(owl.shinyFeathers) + " shiny" : "no shiny feathers yet" }}
          </div>
        </div>
        <div class="tile">
          <div class="label">
            Megafeather tier
          </div>
          <div class="value">
            {{ owl.megafeatherTier }}<span class="of">/10</span>
          </div>
          <div class="sub">
            {{ curTier ? curTier.desc : "no permanent tier reached yet" }}
          </div>
        </div>
      </div>
      <div
        v-if="nextTier"
        class="rec"
      >
        <b>Next tier ({{ nextTier.tier }}):</b> {{ nextTier.desc }}
      </div>
      <div class="scroll">
        <table>
          <tr>
            <th>Upgrade</th><th class="num">
              Level
            </th>
          </tr>
          <tr
            v-for="u in owl.upgrades"
            :key="u.index"
          >
            <td>
              <b>{{ niceItem(u.name) }}</b>
              <div
                v-if="owlEffByIdx.get(u.index)?.desc"
                class="note"
              >
                {{ owlEffByIdx.get(u.index).desc }}
              </div>
            </td>
            <td class="num">
              Lv {{ u.level }}
            </td>
          </tr>
        </table>
      </div>
    </section>
  </template>
  <p
    v-else
    class="note"
  >
    No <code>w1</code> entity on this snapshot yet.
  </p>

  <StatModule
    id="mod_owlRate"
    :stat="owlStat"
    title="Owl Feather Rate"
    :icon="{ file: 'Owl', dir: 'etc' }"
    blurb="Feathers per second — megafeather tiers, upgrades, and account bonuses."
    :char-names="charNames"
    :series="series"
  />
</template>

<style scoped>
/* .rec isn't in src/styles/base.css yet (no other ported page has needed the "next tier"
 * callout banner) — ported verbatim from companion.css. */
.rec { border-left: 3px solid var(--accent); padding: 3px 0 3px 11px; margin: 2px 0 10px; font-size: 13px; }
.rec b { color: var(--ink-1); }
</style>
