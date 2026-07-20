<script setup>
/**
 * BubblesPage — the bubbles.html port. Legacy bubbles.html is a KPI tile + a 4-way cauldron-tab
 * bubble table (docs/migration/survey-pages.md: "entities.w2.bubbles[cauldron][]; entities.w2.nblb;
 * GLOSS.bubbleEffects; stats.krukBubbles") ahead of the generic `krukBubbles` recipe module (the
 * "No-Bubble-Left-Behind" daily auto-leveling rate). No page-local domain logic — `w2.bubbles`,
 * `w2.nblb`, and the `krukBubbles` recipe are all pre-computed by src/core/domain.mjs /
 * src/core/stats/kruk-bubbles.mjs; this page only tabs, sorts, and formats them.
 */
import { ref, reactive, computed } from "vue";
import { state, entities, stats, useHistory } from "../data/appState.js";
import { w2Glossary } from "../data/derived.js";
import StatModule from "../ui/StatModule.vue";
import Chip from "../ui/Chip.vue";
import SpriteIcon from "../ui/SpriteIcon.vue";
import { fmt, niceItem } from "../ui/fmt.js";

const CAULDRON_LABELS = ["Power", "Quicc", "High-IQ", "Kazam"];
const GLOSS = w2Glossary();

const charNames = computed(() => state.value?.charNames ?? []);
const w2 = computed(() => entities.value?.w2 ?? null);
const bubbles = computed(() => w2.value?.bubbles ?? null); // [cauldron][] , 4 arrays of 35 slots
const nblb = computed(() => w2.value?.nblb ?? null);

const bubblesReal = computed(() => (bubbles.value ? bubbles.value.flat().filter((b) => !b.filler) : []));
const bubblesLeveled = computed(() => bubblesReal.value.filter((b) => b.level > 0).length);

const leveledCounts = computed(() => CAULDRON_LABELS.map((_, ci) => (bubbles.value?.[ci] ?? []).filter((b) => !b.filler && b.level > 0).length));
const totalCounts = computed(() => CAULDRON_LABELS.map((_, ci) => (bubbles.value?.[ci] ?? []).filter((b) => !b.filler).length));

/* ---- per-cauldron tab + independent per-tab show-more state (legacy BUBBLE_TAB/BUBBLE_SHOWALL) ---- */
const bubbleTab = ref(0);
const bubbleShowAll = reactive({ 0: false, 1: false, 2: false, 3: false });

function bubbleGlossMap(cauldron) {
  const m = new Map();
  for (const e of GLOSS.bubbleEffects) if (e.cauldron === cauldron) m.set(e.idx, e);
  return m;
}

const rowsAllForTab = computed(() => (bubbles.value?.[bubbleTab.value] ?? [])
  .filter((b) => !b.filler)
  .slice()
  .sort((a, b) => b.level - a.level || a.idx - b.idx));
const glossForTab = computed(() => bubbleGlossMap(bubbleTab.value));
const rowsShown = computed(() => (bubbleShowAll[bubbleTab.value] ? rowsAllForTab.value : rowsAllForTab.value.slice(0, 12)));
const hiddenCount = computed(() => Math.max(0, rowsAllForTab.value.length - 12));

const krukStat = computed(() => stats.value?.krukBubbles ?? null);
const historyKeys = computed(() => {
  const st = krukStat.value;
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
    <h1>Bubbles</h1>
  </header>
  <div
    id="err"
    class="err"
  />

  <template v-if="w2">
    <div class="cards">
      <div class="tile">
        <SpriteIcon
          file="AlchBarF1"
          dir="data"
          :size="28"
        />
        <div class="label">
          Bubbles leveled
        </div>
        <div class="value">
          {{ bubblesLeveled }}<span class="of">/{{ bubblesReal.length }}</span>
        </div>
        <div class="sub">
          NBLB: {{ (nblb?.lowerBound ? "≥ " : "") + fmt(nblb?.bubblesLeveledPerDay) }} LVs/day, auto
        </div>
      </div>
    </div>

    <section class="panel">
      <h2>
        Bubbles
        <span class="hint">
          Level and current bonus for every bubble you've grown, across all 4 cauldrons — highest
          level first.
          <span
            class="tip"
            title="ACTIVE bubbles (the 'big' ones) only give their bonus while equipped on your active character's Cauldron Bubbles loadout, or once you own the universal companion unlock. The bonus shown here is the value IF equipped."
          >ⓘ</span>
        </span>
      </h2>
      <div class="tabs">
        <button
          v-for="(label, i) in CAULDRON_LABELS"
          :key="i"
          class="f"
          :class="{ active: bubbleTab === i }"
          @click="bubbleTab = i"
        >
          {{ label }} ({{ leveledCounts[i] }}/{{ totalCounts[i] }})
        </button>
      </div>
      <div class="scroll">
        <table>
          <tr>
            <th>Bubble</th><th class="num">
              Level
            </th><th class="num">
              Bonus
            </th><th>Effect</th><th>Status</th>
          </tr>
          <tr
            v-for="b in rowsShown"
            :key="b.idx"
          >
            <td>
              <b>{{ niceItem(b.name) }}</b>
              <Chip
                v-if="b.active"
                variant="user"
                force
                title="Only applies while equipped on your active character (or with the universal companion unlock)."
              >
                ACTIVE
              </Chip>
            </td>
            <td class="num">
              Lv {{ b.level }}
            </td>
            <td class="num">
              {{ b.level > 0 ? "+" + fmt(b.bonus) : "—" }}
            </td>
            <td class="note">
              {{ glossForTab.get(b.idx)?.desc || "" }}
            </td>
            <td><Chip :status="b.status" /></td>
          </tr>
        </table>
      </div>
      <button
        v-if="hiddenCount > 0"
        class="showmore"
        @click="bubbleShowAll[bubbleTab] = !bubbleShowAll[bubbleTab]"
      >
        {{ bubbleShowAll[bubbleTab] ? "show fewer" : `show ${hiddenCount} more` }}
      </button>

      <div
        class="cards"
        style="margin-top:12px"
      >
        <div class="tile">
          <SpriteIcon
            file="KrukPart"
            dir="data"
            :size="28"
          />
          <div class="label">
            NBLB <span
              class="tip"
              title="No-Bubble-Left-Behind: Kattlekruk automatically levels up bubbles you haven't grown in a while, once per day, for free — no materials spent, no action needed."
            >ⓘ</span>
          </div>
          <div class="value">
            {{ (nblb?.lowerBound ? "≥ " : "") + fmt(nblb?.bubblesLeveledPerDay) }}<span class="of">LVs/day</span>
          </div>
          <div class="sub">
            <a href="#mod_krukBubbles">full breakdown ↓</a>
          </div>
        </div>
      </div>
    </section>
  </template>
  <p
    v-else
    class="note"
  >
    No <code>w2</code> entity on this snapshot yet.
  </p>

  <StatModule
    id="mod_krukBubbles"
    :stat="krukStat"
    title="Bubble Levels / Day (NBLB)"
    :icon="{ file: 'KrukPart', dir: 'data' }"
    blurb="Every source that adds to Kattlekruk's daily auto-leveling — base rate, stamps, talents, meritocracy, event shop, bubbles, arcade."
    :char-names="charNames"
    :series="series"
  />
</template>

<style scoped>
/* Ported verbatim from companion.css — cauldron-tab pills (not yet in src/styles/base.css, since
 * no other migrated page needed true tabs before this one). */
.tabs { display: flex; gap: 6px; margin-bottom: 10px; flex-wrap: wrap; }
.tabs button.f { background: var(--well); border: 1.5px solid var(--border); border-radius: 999px; color: var(--ink-2); padding: 3px 12px; font: inherit; font-size: 12.5px; font-weight: 650; cursor: pointer; }
.tabs button.f.active { border-color: var(--accent); color: var(--accent); }
.tip { cursor: help; color: var(--accent); font-weight: 700; border-bottom: 1px dotted var(--accent); }
</style>
