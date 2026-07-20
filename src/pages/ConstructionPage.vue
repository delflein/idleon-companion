<script setup>
/**
 * ConstructionPage — the construction.html port. Legacy construction.html is a KPI tile + one
 * bespoke tower table (level vs. base cap, effect text from the static w3 glossary) + a Library
 * sub-panel (checkout rate cards, time-to-books breakpoint table) ahead of the generic
 * `libraryRate` recipe module (docs/migration/survey-pages.md: "entities.w3 towers;
 * GLOSS.towerEffects; stats.libraryRate"). `w3Glossary()` is pure/static (src/data/derived.js
 * re-exports it verbatim) — no save parsing, same payload every call.
 */
import { computed } from "vue";
import { state, entities, stats, useHistory } from "../data/appState.js";
import { w3Glossary } from "../data/derived.js";
import StatModule from "../ui/StatModule.vue";
import LevelBar from "../ui/LevelBar.vue";
import SpriteIcon from "../ui/SpriteIcon.vue";
import { fmt } from "../ui/fmt.js";

const charNames = computed(() => state.value?.charNames ?? []);
const w3 = computed(() => entities.value?.w3 ?? null);
const towers = computed(() => w3.value?.towers ?? []);
const library = computed(() => w3.value?.library ?? null);

const GLOSS = w3Glossary();
function effectOf(t) {
  const g = GLOSS.towerEffects.find((e) => e.id === t.id);
  return g ? g.desc : "";
}

const libraryRateStat = computed(() => stats.value?.libraryRate ?? null);

const historyKeys = computed(() => {
  const st = libraryRateStat.value;
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
    <h1>Construction</h1>
  </header>
  <div
    id="err"
    class="err"
  />

  <template v-if="w3">
    <div class="cards">
      <div class="tile">
        <SpriteIcon
          file="ConTower1"
          dir="data"
          :size="28"
        />
        <div class="label">
          Library checkout rate
        </div>
        <div class="value">
          {{ (library.checkoutRateLowerBound ? "≥ " : "") + "×" + fmt(library.checkoutRate) }}
        </div>
        <div class="sub">
          {{ fmt(library.booksCheckedOut) }} books checked out
        </div>
      </div>
    </div>

    <section class="panel">
      <h2>
        <SpriteIcon
          file="ConTower0"
          dir="data"
          :size="20"
        />
        Construction Towers &amp; Library
        <span class="hint">
          The 9 Construction towers built on the W3 board, and the Talent Library's book-checkout
          rate — a planning number, not a live countdown.
          <span
            class="tip"
            title="The level cap shown per tower is TowerInfo's BASE cap only — several towers can be extended further (Atom bonuses, Construction Mastery rift thresholds, event bonuses) which aren't folded in here, so a level past the shown cap is expected on a pushed account, not a bug."
          >ⓘ</span>
        </span>
      </h2>
      <div class="scroll">
        <table>
          <tr>
            <th>Tower</th><th>Level</th><th>Effect</th>
          </tr>
          <tr
            v-for="t in towers"
            :key="t.id"
          >
            <td>
              <SpriteIcon
                :file="'ConTower' + t.id"
                dir="data"
                :size="22"
              /> <b>{{ t.name }}</b>
            </td>
            <td>
              <LevelBar
                :level="t.level"
                :max-level="t.maxLevel"
                extended-note="Above the base cap on record — extension sources (Atom/Construction Mastery/event bonuses for towers, Compass/event shop for atoms) aren't fully modeled here, so the base cap undercounts your real max."
              />
            </td>
            <td class="note">
              {{ effectOf(t) }}
            </td>
          </tr>
        </table>
      </div>

      <h2
        class="subhead"
        style="margin-top:14px"
      >
        Library
        <span
          class="tip"
          title="Checking out a Talent Book raises a random talent's max level; the next checkout only becomes available after a wait that shrinks with the checkout-rate multiplier below."
        >ⓘ</span>
      </h2>
      <div
        class="cards"
        style="margin-bottom:10px"
      >
        <div class="tile">
          <SpriteIcon
            file="ConTower1"
            dir="data"
            :size="28"
          />
          <div class="label">
            Books checked out
          </div>
          <div class="value">
            {{ fmt(library.booksCheckedOut) }}
          </div>
        </div>
        <div class="tile">
          <div class="label">
            Checkout rate
          </div>
          <div class="value">
            {{ (library.checkoutRateLowerBound ? "≥ " : "") + "×" + fmt(library.checkoutRate) }}
          </div>
          <div class="sub">
            <a href="#mod_libraryRate">full breakdown ↓</a>
          </div>
        </div>
      </div>

      <h2 class="subhead">
        Time-to-books breakpoints <span class="of">at current checkout rate</span>
      </h2>
      <div class="scroll">
        <table>
          <tr>
            <th>Books checked out</th><th>Elapsed time</th>
          </tr>
          <tr
            v-for="b in library.breakpoints"
            :key="b.books"
          >
            <td>{{ b.books }} books</td>
            <td>{{ fmt(b.days) }} day{{ b.days === 1 ? "" : "s" }} of checkouts</td>
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
    id="mod_libraryRate"
    :stat="libraryRateStat"
    title="Library Checkout Rate"
    :icon="{ file: 'ConTower1', dir: 'data' }"
    blurb="Meal, Oxygen atom, library tower level, bubble, vial, stamp, achievement, and Superbit × Gaming level."
    :char-names="charNames"
    :series="series"
  />
</template>

<style scoped>
/* construction.html-specific (companion.css inline block) — page-unique, not promoted to
 * src/styles/base.css since no other src/ui/** component needs it yet. */
.subhead { font-size: 13px; margin: 4px 0 8px; }
.tip { cursor: help; color: var(--accent); font-weight: 700; border-bottom: 1px dotted var(--accent); }
</style>
