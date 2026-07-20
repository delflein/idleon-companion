<script setup>
/**
 * StatuesPage — the statues.html port. Legacy statues.html is a single sorted table
 * (entities.w1.statues[], already carrying the shared multiplier baked into `bonus` —
 * domain.mjs's statueBonusGiven()) ahead of the generic `statueMulti` recipe module
 * (docs/migration/survey-pages.md: "entities.w1.statues[] (tier/level/bonus);
 * GLOSS.statueEffects; stats.statueMulti"). w1Glossary().statueEffects resolves each statue's
 * bonus UNIT (percent vs flat stat add) — entities.w1.statues carries the computed number but
 * not which kind it is.
 */
import { computed } from "vue";
import { state, entities, stats, useHistory } from "../data/appState.js";
import { w1Glossary } from "../data/derived.js";
import StatModule from "../ui/StatModule.vue";
import Chip from "../ui/Chip.vue";
import SpriteIcon from "../ui/SpriteIcon.vue";
import { fmt } from "../ui/fmt.js";

const charNames = computed(() => state.value?.charNames ?? []);
const w1 = computed(() => entities.value?.w1 ?? null);
const statues = computed(() => w1.value?.statues ?? []);
const onyxCount = computed(() => statues.value.filter((s) => s.tier >= 2).length);

const GLOSS = w1Glossary();
const effByIdx = new Map(GLOSS.statueEffects.map((e) => [e.index, e]));

function titleCase(s) {
  return String(s ?? "").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}
function tierName(t) { return t >= 3 ? "Zenith" : t >= 2 ? "Onyx" : t >= 1 ? "Gold" : "Base"; }
function tierIcon(t) { return t >= 3 ? "StatueZ" : t >= 2 ? "StatueO" : t >= 1 ? "StatueG" : "Statue"; }
function tierChipVariant(t) { return t >= 2 ? "live" : t >= 1 ? "user" : "none"; }

function bonusText(s) {
  if (s.bonus == null) return "—";
  const eff = effByIdx.get(s.id);
  if (!eff) return `+${fmt(s.bonus)}`;
  return `+${fmt(s.bonus)}${eff.pct ? "%" : ""} ${titleCase(eff.statName)}`;
}

const sortedStatues = computed(() => [...statues.value].sort((a, b) => b.level - a.level));

const statueStat = computed(() => stats.value?.statueMulti ?? null);

const historyKeys = computed(() => {
  const st = statueStat.value;
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
    <h1>Statues</h1>
  </header>
  <div
    id="err"
    class="err"
  />

  <template v-if="w1">
    <div class="cards">
      <div class="tile">
        <SpriteIcon
          file="Statue1"
          dir="data"
          :size="28"
        />
        <div class="label">
          Onyx+ statues
        </div>
        <div class="value">
          {{ onyxCount }}<span class="of">/32</span>
        </div>
        <div class="sub">
          tier 2 (onyx) or higher
        </div>
      </div>
    </div>

    <section class="panel">
      <h2>
        <SpriteIcon
          file="Statue1"
          dir="data"
          :size="20"
        />
        Statues
        <span class="hint">Bonus already includes the shared multiplier below — talents, onyx, zenith, Dragon.</span>
        <span style="flex:1" />
        <a href="#mod_statueMulti">multiplier breakdown ↓</a>
      </h2>
      <div class="scroll">
        <table>
          <tr>
            <th>Statue</th><th>Tier</th><th>Level</th><th class="num">
              Effective bonus
            </th>
          </tr>
          <tr
            v-for="s in sortedStatues"
            :key="s.id"
          >
            <td>
              <SpriteIcon
                :file="tierIcon(s.tier) + (s.id + 1)"
                dir="data"
                :size="20"
              />
              <b>{{ titleCase(s.name) }}</b>
            </td>
            <td>
              <Chip
                :variant="tierChipVariant(s.tier)"
                force
              >
                {{ tierName(s.tier) }}
              </Chip>
            </td>
            <td>Lv {{ s.level }}</td>
            <td class="num">
              {{ bonusText(s) }}
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
    id="mod_statueMulti"
    :stat="statueStat"
    title="Statue Bonus Multiplier"
    :icon="{ file: 'Statue1', dir: 'data' }"
    blurb="The shared multiplier every statue's bonus is run through — talents, onyx, zenith, Dragon, vault."
    :char-names="charNames"
    :series="series"
  />
</template>
