<script setup>
/**
 * AnvilPage — the anvil.html port. Legacy anvil.html is a per-character point-allocation and
 * current-production-selection panel (entities.w1.anvil[]) ahead of the generic `anvilSpeed`
 * recipe module (docs/migration/survey-pages.md: "entities.w1.anvil[] (points, selections,
 * productionSpeed); GLOSS.anvilProducts; stats.anvilSpeed"). `w1Glossary().anvilProducts` names
 * the raw production-slot indices (entities.w1.anvil[].selections is just indices into a static
 * 14-row table) — no save parsing there, same payload every call (src/data/derived.js).
 */
import { ref, computed } from "vue";
import { state, entities, stats, useHistory } from "../data/appState.js";
import { w1Glossary } from "../data/derived.js";
import StatModule from "../ui/StatModule.vue";
import SpriteIcon from "../ui/SpriteIcon.vue";
import { fmt, niceItem } from "../ui/fmt.js";

const charNames = computed(() => state.value?.charNames ?? []);
const w1 = computed(() => entities.value?.w1 ?? null);
const anvilArr = computed(() => w1.value?.anvil ?? []);

const GLOSS = w1Glossary();
function productNameFor(idx) {
  if (idx == null || idx < 0) return null;
  return GLOSS.anvilProducts.find((p) => p.index === idx)?.name ?? `slot ${idx}`;
}

// Own char selector for the per-character detail panel — deliberately independent of
// StatModule's own char picker (legacy anvil.html: ANVIL_CHAR vs CHARSEL.anvilSpeed, unlinked).
const anvilChar = ref(null);
const anvilRow = computed(() => {
  const arr = anvilArr.value;
  if (!arr.length) return null;
  if (anvilChar.value == null || !arr.some((a) => a.charIdx === anvilChar.value)) return arr[0];
  return arr.find((a) => a.charIdx === anvilChar.value) ?? arr[0];
});

const POINT_BARS = [["Coins", "coins"], ["Materials", "mats"], ["XP", "xp"], ["Speed", "speed"], ["Cap", "cap"]];
const maxPoint = computed(() => Math.max(1, ...POINT_BARS.map(([, k]) => anvilRow.value?.points?.[k] ?? 0)));

function pointPct(k) {
  return Math.min(100, ((anvilRow.value?.points?.[k] ?? 0) / maxPoint.value) * 100);
}

const speedText = computed(() => (anvilRow.value
  ? (anvilRow.value.productionSpeedLowerBound ? "≥ " : "") + fmt(anvilRow.value.productionSpeed) + "×"
  : "—"));

function charName(i) {
  return charNames.value[i] ?? "char " + i;
}

const anvilStat = computed(() => stats.value?.anvilSpeed ?? null);

const historyKeys = computed(() => {
  const st = anvilStat.value;
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
    <h1>Anvil</h1>
  </header>
  <div
    id="err"
    class="err"
  />

  <template v-if="anvilRow">
    <div class="cards">
      <div class="tile">
        <SpriteIcon
          file="SmithingHammerChisel"
          dir="data"
          :size="28"
        />
        <div class="label">
          Production speed
        </div>
        <div class="value">
          {{ speedText }}
        </div>
        <div class="sub">
          {{ charName(anvilRow.charIdx) }} — <a href="#mod_anvilSpeed">full breakdown ↓</a>
        </div>
      </div>
    </div>

    <section class="panel">
      <h2>
        <SpriteIcon
          file="SmithingHammerChisel"
          dir="data"
          :size="20"
        />
        Anvil
        <span class="hint">Per-character point allocation and production speed.</span>
        <span style="flex:1" />
        <select
          class="inlinesel"
          :value="anvilRow.charIdx"
          @change="anvilChar = Number($event.target.value)"
        >
          <option
            v-for="a in anvilArr"
            :key="a.charIdx"
            :value="a.charIdx"
          >
            {{ charName(a.charIdx) }}
          </option>
        </select>
      </h2>

      <div
        v-if="anvilRow.points.available > 0"
        class="rec"
      >
        <b>{{ anvilRow.points.available }} unspent point{{ anvilRow.points.available > 1 ? "s" : "" }}</b>
        — assign them in-game to raise one of the pools below.
      </div>

      <div
        class="levers"
        style="margin-bottom:14px"
      >
        <div
          v-for="[label, k] in POINT_BARS"
          :key="k"
          class="lever"
        >
          <span class="lname">{{ label }}</span>
          <div class="lbar">
            <div
              class="lfill"
              :style="{ width: pointPct(k) + '%' }"
            />
          </div>
          <span class="lval">{{ anvilRow.points[k] ?? 0 }}</span>
        </div>
      </div>

      <h2 class="subhead">
        Current production selections
      </h2>
      <div
        v-if="anvilRow.selections.length"
        class="levers"
      >
        <div
          v-for="(idx, i) in anvilRow.selections"
          :key="i"
          class="lever"
        >
          <span class="lname">Hammer {{ i + 1 }}</span>
          <span />
          <span class="lval">
            <span
              v-if="idx < 0"
              class="note"
            >empty</span>
            <template v-else>{{ niceItem(productNameFor(idx)) }}</template>
          </span>
        </div>
      </div>
      <p
        v-else
        class="note"
      >
        No hammers assigned.
      </p>

      <p
        v-if="anvilRow.productionSpeedLowerBound"
        class="note"
      >
        Production speed is a lower bound — some inputs (the agility stat stack, the Hammer
        Hammer bubble) aren't decoded from the save yet.
      </p>
    </section>
  </template>
  <p
    v-else
    class="note"
  >
    No <code>w1</code> entity on this snapshot yet.
  </p>

  <StatModule
    id="mod_anvilSpeed"
    :stat="anvilStat"
    title="Anvil Production Speed"
    :icon="{ file: 'SmithingHammerChisel', dir: 'data' }"
    blurb="What multiplies how fast the anvil turns ores into bars, per character."
    :char-names="charNames"
    :series="series"
  />
</template>

<style scoped>
/* .lever/.lbar/.lfill/.rec aren't in src/styles/base.css yet (no other ported page has needed
 * a multi-bar point-allocation widget or the "unspent points" banner) — ported verbatim from
 * companion.css so the widget still has the height/track/fill it needs to be legible. */
.levers { display: grid; grid-template-columns: minmax(130px, auto) 1fr auto; gap: 8px 12px; align-items: center; }
.lever { display: contents; }
.lbar { height: 12px; border-radius: 6px; overflow: hidden; background: var(--track); border: 1px solid rgba(0, 0, 0, .4); min-width: 60px; }
.lfill { height: 100%; background: var(--series-1); border-radius: 0 5px 5px 0; }
.rec { border-left: 3px solid var(--accent); padding: 3px 0 3px 11px; margin: 2px 0 10px; font-size: 13px; }
.rec b { color: var(--ink-1); }
</style>
