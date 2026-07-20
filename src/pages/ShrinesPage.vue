<script setup>
/**
 * ShrinesPage — the shrines.html port. Legacy shrines.html is a KPI tile + one bespoke table
 * (level + description per shrine, description text looked up from the static w3 glossary) ahead
 * of the generic `shrineExp` recipe module (docs/migration/survey-pages.md:
 * "entities.w3.shrines[]; GLOSS.shrineEffects; stats.shrineExp"). `w3Glossary()` is pure/static
 * (src/data/derived.js re-exports it verbatim) — no save parsing, same payload every call.
 */
import { computed } from "vue";
import { state, entities, stats, useHistory } from "../data/appState.js";
import { w3Glossary } from "../data/derived.js";
import StatModule from "../ui/StatModule.vue";
import SpriteIcon from "../ui/SpriteIcon.vue";
import { fmt } from "../ui/fmt.js";

const charNames = computed(() => state.value?.charNames ?? []);
const w3 = computed(() => entities.value?.w3 ?? null);
const shrines = computed(() => w3.value?.shrines ?? []);
const shrinesLeveled = computed(() => shrines.value.filter((s) => s.level > 0).length);

const GLOSS = w3Glossary();
function effectOf(s) {
  const g = GLOSS.shrineEffects.find((e) => e.id === s.id);
  return g ? `Boosts ${g.statName}: base +${fmt(g.base)}%, +${fmt(g.perLevel)}%/level thereafter` : "";
}

const shrineStat = computed(() => stats.value?.shrineExp ?? null);

const historyKeys = computed(() => {
  const st = shrineStat.value;
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
    <h1>Shrines</h1>
  </header>
  <div
    id="err"
    class="err"
  />

  <template v-if="w3">
    <div class="cards">
      <div class="tile">
        <SpriteIcon
          file="ShrineBG"
          dir="data"
          :size="28"
        />
        <div class="label">
          Shrines leveled
        </div>
        <div class="value">
          {{ shrinesLeveled }}<span class="of">/{{ shrines.length }}</span>
        </div>
        <div class="sub">
          at least level 1
        </div>
      </div>
    </div>

    <section class="panel">
      <h2>
        <SpriteIcon
          file="ShrineBG"
          dir="data"
          :size="20"
        />
        Shrines
        <span class="hint">
          Passive stat boosts that apply account-wide once the Moai Head sailing artifact is
          owned (otherwise only on their own map).
        </span>
      </h2>
      <div
        class="cards"
        style="margin:10px 0"
      >
        <div class="tile">
          <div class="label">
            Shrine EXP-gain rate
          </div>
          <div class="value">
            <a
              href="#mod_shrineExp"
              style="font-size:15px"
            >full breakdown ↓</a>
          </div>
        </div>
      </div>
      <div class="scroll">
        <table>
          <tr>
            <th>Shrine</th><th>Level</th><th>Effect</th>
          </tr>
          <tr
            v-for="s in shrines"
            :key="s.id"
          >
            <td><b>{{ s.name }}</b></td>
            <td>Lv {{ s.level }}</td>
            <td class="note">
              {{ effectOf(s) }}
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
    id="mod_shrineExp"
    :stat="shrineStat"
    title="Shrine EXP-gain rate"
    :icon="{ file: 'ShrineBG', dir: 'data' }"
    blurb="Superbit, Moai artifact + Skill Mastery, Ballot, shrine's own tower level, Crystal Shrine, post office box, golden food, star talent, vial. Shown for shrine 0 (Woodular)."
    :char-names="charNames"
    :series="series"
  />
</template>
