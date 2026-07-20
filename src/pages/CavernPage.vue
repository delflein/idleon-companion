<script setup>
/**
 * CavernPage — the cavern.html port. Legacy cavern.html: a top KPI tile, a bespoke "The Cavern"
 * panel (cavern-unlock reward ladder + a 5-row villager table with level/EXP-hr/opals and a
 * per-villager "view breakdown" button), then the `villagerExp` recipe module rendered for
 * whichever villager is selected (docs/migration/survey-pages.md: "entities.w5.caverns,
 * entities.w5.villagers[]; GLOSS.villagers; stats.villagerExp per villager... generic
 * recipe-module renderer extended with `extraHeader` slot (per-villager, evolved pattern)").
 *
 * `stats.villagerExp` (appState's default `stats` computed) only ever evaluates villager 0 (the
 * Explorer) — companion.mjs's old `/api/stats?villager=N` re-evaluation is replaced here by calling
 * `deriveStats(save, { villager, ...statOpts() })` directly per the migration brief's Cavern
 * villager-breakdown rule, instead of the appState `stats` computed.
 */
import { computed, ref } from "vue";
import { state, entities, statOpts, useHistory } from "../data/appState.js";
import { deriveStats, w5Glossary } from "../data/derived.js";
import StatModule from "../ui/StatModule.vue";
import SpriteIcon from "../ui/SpriteIcon.vue";
import { fmt } from "../ui/fmt.js";

const GLOSS = w5Glossary(); // static text, no save parsing (derived.js's re-export contract)

const charNames = computed(() => state.value?.charNames ?? []);
const w5 = computed(() => entities.value?.w5 ?? null);

const totalOpals = computed(() => (w5.value?.villagers ?? []).reduce((a, v) => a + v.opalsInvested, 0));

function villagerFlavor(idx) {
  return GLOSS?.villagers?.find((x) => x.idx === idx)?.flavor ?? "";
}

/* ---------- per-villager EXP/hr breakdown (villagerExp is NOT active-char-sensitive — the
 * selector picks a VILLAGER, not a character; see stats/villager-exp.mjs). ---------- */
const villagerSel = ref(0); // 0 = Explorer, matching legacy VILLAGER_SEL default

const villagerStat = computed(() => {
  if (!state.value) return null;
  return deriveStats(state.value.save, { villager: villagerSel.value, ...statOpts() })?.villagerExp ?? null;
});

const selectedVillagerName = computed(
  () => (w5.value?.villagers ?? []).find((v) => v.idx === villagerSel.value)?.name ?? "Explorer",
);

const historyKeys = computed(() => {
  const st = villagerStat.value;
  if (!st) return [];
  const keys = ["stat.villagerExp"];
  for (const t of st.collapsed.terms) if (t.status !== "unknown") keys.push(`stat.villagerExp.${t.id}`);
  return keys;
});
// See MiningPage.vue's NOTE on useHistory(keys) not being reactive to `keys` changing later.
const { series } = useHistory(historyKeys.value);
</script>

<template>
  <header class="app">
    <h1>The Cavern</h1>
  </header>
  <div
    id="err"
    class="err"
  />

  <template v-if="w5">
    <div class="cards">
      <div class="tile">
        <SpriteIcon
          file="Cavern_0"
          dir="etc"
          :size="28"
        />
        <div class="label">
          Caverns unlocked
        </div>
        <div class="value">
          {{ w5.caverns.unlocked }}<span class="of">/{{ w5.caverns.total }}</span>
        </div>
        <div class="sub">
          Explorer Lv {{ fmt(w5.villagers.find((v) => v.idx === 0)?.level ?? 0) }}
        </div>
      </div>
    </div>

    <section class="panel">
      <h2>
        <SpriteIcon
          file="Cavern_0"
          dir="etc"
          :size="20"
        />
        The Cavern
        <span class="hint">
          The Hole — 5 workable villagers and 18 unlockable caverns (Explorer level = caverns
          unlocked, 1:1).
          <span
            class="tip"
            title="Each villager's own level (via opals invested) raises their EXP/hr AND, for the Explorer specifically, unlocks the next cavern outright."
          >ⓘ</span>
        </span>
      </h2>
      <div
        class="cards"
        style="margin-bottom:10px"
      >
        <div class="tile">
          <SpriteIcon
            file="Cavern_0"
            dir="etc"
            :size="28"
          />
          <div class="label">
            Caverns unlocked
          </div>
          <div class="value">
            {{ w5.caverns.unlocked }}<span class="of">/{{ w5.caverns.total }}</span>
          </div>
          <div class="sub">
            {{ w5.caverns.unlocked < w5.caverns.total ? `unlocks at Explorer Lv ${w5.caverns.unlocked + 1}` : "all unlocked" }}
          </div>
        </div>
        <div class="tile">
          <div class="label">
            Total opals invested
          </div>
          <div class="value">
            {{ fmt(totalOpals) }}
          </div>
          <div class="sub">
            across {{ w5.villagers.length }} villagers
          </div>
        </div>
      </div>
      <div class="rewardladder">
        <span
          v-for="i in w5.caverns.total"
          :key="i"
          :class="{ got: i - 1 < w5.caverns.unlocked }"
          :title="`Cavern ${i}`"
        >{{ i }}</span>
      </div>

      <h2
        class="subhead"
        style="margin-top:14px"
      >
        Villagers
      </h2>
      <div class="scroll">
        <table>
          <tr>
            <th>Villager</th><th class="num">
              Level
            </th><th class="num">
              EXP/hr
            </th><th class="num">
              Opals invested
            </th><th />
          </tr>
          <tr
            v-for="v in w5.villagers"
            :key="v.idx"
          >
            <td>
              <SpriteIcon
                :file="`HoleUIvillager${v.idx}`"
                dir="data"
                :size="22"
              />
              <b>{{ v.name }}</b>
              <span
                v-if="villagerFlavor(v.idx)"
                class="tip"
                :title="villagerFlavor(v.idx)"
              >ⓘ</span>
            </td>
            <td class="num">
              Lv {{ fmt(v.level) }}
            </td>
            <td class="num">
              {{ (v.expPerHrLowerBound ? "≥ " : "") + fmt(v.expPerHr) }}
            </td>
            <td class="num">
              {{ fmt(v.opalsInvested) }}
            </td>
            <td class="num">
              <button
                class="showmore"
                @click="villagerSel = v.idx"
              >
                {{ villagerSel === v.idx ? "viewing ↓" : "view breakdown" }}
              </button>
            </td>
          </tr>
        </table>
      </div>
      <div
        class="gapbox"
        style="margin-top:12px"
      >
        <h3>Deep Cavern systems — deferred</h3>
        <p>
          The Hole is a second-Sailing-sized system: ~90 Engineer blueprints, the Fountain (3
          waters x 20 upgrades), Cosmo Majiks, 11 cross-game Measurements, 20 Librarian Studies,
          and Monuments. The EXP/hr recipe below already reads what the save can answer for those
          (opals, jars, a few blueprints/cards) and floors everything else to its neutral value —
          the shown rate is a documented LOWER BOUND, not a guess. A dedicated Cavern page
          (matching Sailing's depth) is future scope, not this page.
        </p>
      </div>
    </section>
  </template>
  <p
    v-else
    class="note"
  >
    No <code>w5</code> entity on this snapshot yet.
  </p>

  <div style="margin:8px 0">
    <label class="note">
      Villager EXP/hr breakdown for:
      <select
        v-model.number="villagerSel"
        class="inlinesel"
      >
        <option
          v-for="v in w5?.villagers ?? []"
          :key="v.idx"
          :value="v.idx"
        >
          {{ v.name }}
        </option>
      </select>
    </label>
  </div>
  <StatModule
    :stat="villagerStat"
    :title="`Villager EXP/hr — ${selectedVillagerName}`"
    :icon="{ file: 'Cavern_0', dir: 'etc' }"
    blurb="The ~29-call multiplier chain behind each villager's opal-EXP/hr rate."
    :char-names="charNames"
    :series="series"
  />
</template>
