<script setup>
/**
 * WorshipPage — the worship.html port. Legacy worship.html is a KPI tile + two bespoke tables
 * (per-char max Worship Charge, totem best-waves) ahead of the generic `worshipCharge` recipe
 * module (docs/migration/survey-pages.md: "entities.w3.worship (byChar[], totems[]); stats.worshipCharge").
 * `entities.w3.worship` is the raw-save-derived table data (src/core/domain.mjs); `stats.worshipCharge`
 * is the same recipe evaluated per-char that domain.mjs already used to build `byChar[].maxCharge` —
 * no page-local recalculation here, just picking which of the two shapes each widget wants.
 */
import { computed } from "vue";
import { state, entities, stats, useHistory } from "../data/appState.js";
import StatModule from "../ui/StatModule.vue";
import ShowMore from "../ui/ShowMore.vue";
import Chip from "../ui/Chip.vue";
import SpriteIcon from "../ui/SpriteIcon.vue";
import { fmt, niceItem } from "../ui/fmt.js";

const charNames = computed(() => state.value?.charNames ?? []);
const w3 = computed(() => entities.value?.w3 ?? null);
const worship = computed(() => w3.value?.worship ?? null);

const bestCharge = computed(() => {
  const byChar = worship.value?.byChar ?? [];
  return byChar.length ? [...byChar].sort((a, b) => b.maxCharge - a.maxCharge)[0] : null;
});

const worshipStat = computed(() => stats.value?.worshipCharge ?? null);

const historyKeys = computed(() => {
  const st = worshipStat.value;
  if (!st) return [];
  const keys = [`stat.${st.name}`];
  for (const t of st.collapsed.terms) if (t.status !== "unknown") keys.push(`stat.${st.name}.${t.id}`);
  return keys;
});
// See MiningPage.vue's NOTE on useHistory(keys) not being reactive to `keys` changing later.
const { series } = useHistory(historyKeys.value);

const totemsAttempted = computed(() => (worship.value?.totems ?? []).filter((t) => t.bestWaves > 0).length);
</script>

<template>
  <header class="app">
    <h1>Worship</h1>
  </header>
  <div
    id="err"
    class="err"
  />

  <template v-if="worship">
    <div class="cards">
      <div class="tile">
        <SpriteIcon
          file="WorshipSkull1"
          dir="data"
          :size="28"
        />
        <div class="label">
          Worship max charge (best char)
        </div>
        <div class="value">
          {{ bestCharge ? (bestCharge.maxChargeLowerBound ? "≥ " : "") + fmt(bestCharge.maxCharge) : "—" }}
        </div>
        <div class="sub">
          {{ bestCharge ? (bestCharge.name || ("char " + bestCharge.charIdx)) : "no characters" }}
        </div>
      </div>
    </div>

    <section class="panel">
      <h2>
        <SpriteIcon
          file="WorshipSkull1"
          dir="data"
          :size="20"
        />
        Worship
        <span class="hint">
          Defend totems with banked Worship Charge for permanent rewards — max charge per
          character, and how far each totem's waves have been cleared.
        </span>
      </h2>
      <div class="caveat">
        Current banked charge is not in the save data — only max charge capacity (a save-derived
        stat) and best totem-wave results are shown here.
      </div>

      <h2 class="subhead">
        Max charge per character
      </h2>
      <ShowMore
        v-slot="{ items }"
        :items="worship.byChar"
        :cap="12"
      >
        <div class="scroll">
          <table>
            <tr>
              <th>Character</th><th>Worship level</th><th>Max charge</th>
            </tr>
            <tr
              v-for="c in items"
              :key="c.charIdx"
            >
              <td><b>{{ c.name || "char " + c.charIdx }}</b></td>
              <td>Lv {{ c.worshipLevel }}</td>
              <td>
                {{ (c.maxChargeLowerBound ? "≥ " : "") + fmt(c.maxCharge) }}
                <Chip
                  v-if="c.maxChargeLowerBound"
                  variant="soon"
                  force
                >
                  lower bound
                </Chip>
              </td>
            </tr>
          </table>
        </div>
      </ShowMore>

      <h2
        class="subhead"
        style="margin-top:14px"
      >
        Totems <span class="of">{{ totemsAttempted }}/{{ worship.totems.length }} attempted</span>
      </h2>
      <div class="scroll">
        <table>
          <tr>
            <th>Totem</th><th>Level req.</th><th>Charge cost</th><th>Best wave</th>
          </tr>
          <tr
            v-for="t in worship.totems"
            :key="t.trialType"
          >
            <td><b>{{ niceItem(t.critter) }}</b> <span class="note">(trial {{ t.trialType + 1 }})</span></td>
            <td>Lv {{ t.reqLevel }}+</td>
            <td>{{ fmt(t.chargeReq) }} charge</td>
            <td>
              <span v-if="t.bestWaves > 0">{{ fmt(t.bestWaves) }}</span>
              <span
                v-else
                class="note"
              >not cleared</span>
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
    No <code>w3</code> entity on this snapshot yet.
  </p>

  <StatModule
    :stat="worshipStat"
    title="Worship Max Charge"
    :icon="{ file: 'WorshipSkull1', dir: 'data' }"
    blurb="Per-character max Worship Charge capacity — card, post office box, buff, stamp, bubble × Worship level, equipped tool."
    :char-names="charNames"
    :series="series"
  />
</template>
