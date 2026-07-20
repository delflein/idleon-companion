<script setup>
/**
 * AtomsPage — the atoms.html port. Legacy atoms.html is a KPI tile + one bespoke show-more table
 * (level/bonus/cost-to-next/effect per Atom Collider atom, description text looked up from the
 * static w3 glossary) ahead of the generic `atomCost` recipe module (docs/migration/survey-pages.md:
 * "entities.w3.atoms[] (level/maxLevel/bonus/cost); GLOSS.atomEffects; stats.atomCost"). Split out
 * of the legacy combined w3.html — this page covers the atom-collider half only (shrines.html has
 * the shrine half). `w3Glossary()` is pure/static (src/data/derived.js re-exports it verbatim).
 */
import { computed } from "vue";
import { state, entities, stats, useHistory } from "../data/appState.js";
import { w3Glossary } from "../data/derived.js";
import StatModule from "../ui/StatModule.vue";
import ShowMore from "../ui/ShowMore.vue";
import LevelBar from "../ui/LevelBar.vue";
import SpriteIcon from "../ui/SpriteIcon.vue";
import { fmt } from "../ui/fmt.js";

const charNames = computed(() => state.value?.charNames ?? []);
const w3 = computed(() => entities.value?.w3 ?? null);
const atoms = computed(() => w3.value?.atoms ?? []);
const atomsLeveled = computed(() => atoms.value.filter((a) => a.level > 0).length);
const maxLv = computed(() => atoms.value[0]?.maxLevel ?? 20);

const GLOSS = w3Glossary();
function effectOf(a) {
  const g = GLOSS.atomEffects.find((e) => e.id === a.id);
  return g ? g.desc : "";
}

/* costToNext is null once level reaches maxLevel — but maxLevel (atomMaxLevel()) is itself a
 * documented lower bound (Compass(53)/EventShopOwned(28) unread), so a.level > a.maxLevel means
 * "past what we can compute", not necessarily "truly maxed" — say so rather than claim maxed
 * (same distinction legacy atomRowHtml() drew). */
function costText(a) {
  if (a.costToNext != null) return (a.costLowerBound ? "≤ " : "") + fmt(a.costToNext);
  if (a.level > a.maxLevel) return "unknown (cap extended)";
  return "maxed";
}
function costIsNote(a) {
  return a.costToNext == null;
}

const atomCostStat = computed(() => stats.value?.atomCost ?? null);

const historyKeys = computed(() => {
  const st = atomCostStat.value;
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
    <h1>Atoms</h1>
  </header>
  <div
    id="err"
    class="err"
  />

  <template v-if="w3">
    <div class="cards">
      <div class="tile">
        <SpriteIcon
          file="AtomBG"
          dir="data"
          :size="28"
        />
        <div class="label">
          Atoms leveled
        </div>
        <div class="value">
          {{ atomsLeveled }}<span class="of">/{{ atoms.length }}</span>
        </div>
        <div class="sub">
          at least level 1
        </div>
      </div>
    </div>

    <section class="panel">
      <h2>
        <SpriteIcon
          file="AtomBG"
          dir="data"
          :size="20"
        />
        Atom Collider
        <span class="hint">
          Permanent account-wide bonuses, each capped at the same max level (≥{{ maxLv }} — the
          shown cap is itself a lower bound, see below) and growing more expensive per level.
        </span>
      </h2>
      <div class="caveat">
        Cost-to-next is an UPPER bound — several cost-reduction sources aren't derivable from the
        save yet, so the real cost to level an atom may be lower than shown. The max-level cap
        shown per atom is also a LOWER bound (Compass and event-shop cap extensions aren't
        derivable) — a level past that cap just means the true cap is higher, not a display bug.
      </div>
      <ShowMore
        v-slot="{ items }"
        :items="atoms"
        :cap="12"
      >
        <div class="scroll">
          <table>
            <tr>
              <th>Atom</th><th>Level</th><th class="num">
                Bonus
              </th><th class="num">
                Cost to next
              </th><th>Effect</th>
            </tr>
            <tr
              v-for="a in items"
              :key="a.id"
            >
              <td>
                <SpriteIcon
                  :file="'Atom' + a.id"
                  dir="data"
                  :size="22"
                /> <b>{{ a.name }}</b>
              </td>
              <td>
                <LevelBar
                  :level="a.level"
                  :max-level="a.maxLevel"
                  extended-note="Above the base cap on record — extension sources (Atom/Construction Mastery/event bonuses for towers, Compass/event shop for atoms) aren't fully modeled here, so the base cap undercounts your real max."
                />
              </td>
              <td class="num">
                {{ fmt(a.bonus) }}
              </td>
              <td class="num">
                <span :class="{ note: costIsNote(a) }">{{ costText(a) }}</span>
              </td>
              <td class="note">
                {{ effectOf(a) }}
              </td>
            </tr>
          </table>
        </div>
      </ShowMore>
      <div
        class="cards"
        style="margin:10px 0"
      >
        <div class="tile">
          <div class="label">
            Atom cost reduction
          </div>
          <div class="value">
            <a
              href="#mod_atomCost"
              style="font-size:15px"
            >full breakdown ↓</a>
          </div>
        </div>
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
    id="mod_atomCost"
    :stat="atomCostStat"
    title="Atom Cost Reduction"
    :icon="{ file: 'AtomBG', dir: 'data' }"
    blurb="Every source that discounts atom upgrade costs — palette, stamp, Neon atom self-discount, Superbit Redux, Grimoire, Compass, bubble, Atom Collider tower level, task shop, Bubba."
    :char-names="charNames"
    :series="series"
  />
</template>
