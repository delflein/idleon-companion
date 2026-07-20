<script setup>
/**
 * SneakingPage — the sneaking.html port. Legacy sneaking.html is a 4-tile KPI strip + a per-twin
 * Stealth table + 3 checklist tables (Jade Emporium, Pristine Charms, Gemstones) ahead of the
 * generic `stealth` recipe module (docs/migration/survey-pages.md: "entities.w6.sneaking
 * (ninjaMastery, stealthPerChar[], emporium, charms, gacha, gemstones[]); GLOSS.jadeEmporium/
 * gemstones; stats.stealth" — no page-local domain logic flagged). `entities.w6.sneaking`
 * (src/core/domain.mjs) already carries the per-twin stealth-as-if-active table, the emporium/
 * charms owned-vs-total counts, and the gacha roll-remaining math precomputed; `w6Glossary()`
 * supplies the two static description lookups (jade emporium unlock text, gemstone flavor text).
 */
import { computed } from "vue";
import { state, entities, stats, useHistory } from "../data/appState.js";
import { w6Glossary } from "../data/derived.js";
import StatModule from "../ui/StatModule.vue";
import ShowMore from "../ui/ShowMore.vue";
import Chip from "../ui/Chip.vue";
import SpriteIcon from "../ui/SpriteIcon.vue";
import { fmt } from "../ui/fmt.js";

const charNames = computed(() => state.value?.charNames ?? []);
const w6 = computed(() => entities.value?.w6 ?? null);
const sneaking = computed(() => w6.value?.sneaking ?? null);

const GLOSS = w6Glossary();

function charName(i) {
  return charNames.value[i] ?? "char " + i;
}

const stealthStat = computed(() => stats.value?.stealth ?? null);

const historyKeys = computed(() => {
  const st = stealthStat.value;
  if (!st) return [];
  const keys = [`stat.${st.name}`];
  for (const t of st.collapsed.terms) if (t.status !== "unknown") keys.push(`stat.${st.name}.${t.id}`);
  return keys;
});
// See MiningPage.vue's NOTE on useHistory(keys) not being reactive to `keys` changing later.
const { series } = useHistory(historyKeys.value);

/** legacy renderEmporium()'s missing-first sort: owned (1) sorts after everything else — this
 *  also puts `owned === null` ("unreadable") ahead of owned, matching the original comparator. */
const emporiumSorted = computed(() => {
  const list = sneaking.value?.emporium?.list ?? [];
  return [...list].sort((a, b) => (a.owned === 1 ? 1 : 0) - (b.owned === 1 ? 1 : 0));
});
function emporiumDesc(e) {
  return GLOSS.jadeEmporium.find((x) => x.idx === e.idx)?.desc ?? null;
}

/** legacy renderCharms()'s same missing-first sort. */
const charmsSorted = computed(() => {
  const list = sneaking.value?.charms?.list ?? [];
  return [...list].sort((a, b) => (a.owned ? 1 : 0) - (b.owned ? 1 : 0));
});

function gemstoneDesc(g) {
  return GLOSS.gemstones.find((x) => x.idx === g.idx)?.desc ?? null;
}

const GACHA_TOOLTIP = "Pristine charm rolls come from a gacha with a decaying chance (starts ~0.1%, drops toward ~0.001% as more are owned) — no timer here, just current rolls remaining and what you'd unlock next.";
const STEALTH_TOOLTIP = "Stealth itself is floor-independent — only the downstream detection curve reads the twin's current floor. Values below are per-character, computed as-if-active.";
</script>

<template>
  <header class="app">
    <h1>Sneaking</h1>
  </header>
  <div
    id="err"
    class="err"
  />

  <template v-if="sneaking">
    <div class="cards">
      <div class="tile">
        <SpriteIcon
          file="Sneaking_Ninja"
          dir="etc"
          :size="28"
        />
        <div class="label">
          Ninja Mastery
        </div>
        <div class="value">
          {{ fmt(sneaking.ninjaMastery) }}
        </div>
        <div class="sub">
          selected mastery: {{ fmt(sneaking.selectedMastery) }}
        </div>
      </div>
      <div class="tile">
        <div class="label">
          Stealth (best twin)
        </div>
        <div class="value">
          {{ (sneaking.stealthLowerBound ? "≥ " : "") + fmt(sneaking.stealthBest) }}
        </div>
        <div class="sub">
          <a href="#mod_stealth">full breakdown ↓</a>
        </div>
      </div>
      <div class="tile">
        <SpriteIcon
          file="jade_coin"
          dir="etc"
          :size="28"
        />
        <div class="label">
          Jade Emporium
        </div>
        <div class="value">
          {{ sneaking.emporium.owned }}<span class="of">/{{ sneaking.emporium.total }}</span>
        </div>
        <div class="sub">
          {{ sneaking.emporium.unknown ? `${sneaking.emporium.unknown} unreadable` : "unlocks bought" }}
        </div>
      </div>
      <div class="tile">
        <div class="label">
          Pristine charms
        </div>
        <div class="value">
          {{ sneaking.charms.owned }}<span class="of">/{{ sneaking.charms.total }}</span>
        </div>
        <div class="sub">
          {{ fmt(sneaking.gacha.pristineRollsRemaining) }} pristine rolls left
        </div>
      </div>
    </div>

    <section class="panel">
      <h2>
        <SpriteIcon
          file="Sneaking_Ninja"
          dir="etc"
          :size="20"
        />
        Ninja Twins
        <span class="hint">
          Stealth lowers detection rate on whichever floor a twin is currently working.
          <span
            class="tip"
            :title="STEALTH_TOOLTIP"
          >ⓘ</span>
        </span>
      </h2>
      <div class="scroll">
        <table>
          <tr>
            <th>Twin</th><th class="num">
              Floor
            </th><th class="num">
              Stealth
            </th>
          </tr>
          <tr
            v-for="c in sneaking.stealthPerChar"
            :key="c.charIdx"
          >
            <td><b>{{ charName(c.charIdx) }}</b></td>
            <td class="num">
              {{ fmt(c.floor + 1) }}<span class="of">/12</span>
            </td>
            <td class="num">
              {{ (c.lowerBound ? "≥ " : "") + fmt(c.stealth) }}
            </td>
          </tr>
        </table>
      </div>
    </section>

    <section class="panel">
      <h2>
        <SpriteIcon
          file="jade_coin"
          dir="etc"
          :size="20"
        />
        Jade Emporium
        <span class="hint">
          {{ sneaking.emporium.total }} account-wide unlocks, paid in Jade Coins — missing ones
          shown first.
          <span
            v-if="sneaking.emporium.unknown"
            class="tip"
            :title="`${sneaking.emporium.unknown} ids can't be read as owned/not-owned from the save at all (ownership-flag string gap) — shown as 'unreadable', never guessed.`"
          >ⓘ</span>
        </span>
      </h2>
      <ShowMore
        v-slot="{ items }"
        :items="emporiumSorted"
        :cap="10"
      >
        <div class="scroll">
          <table>
            <tr>
              <th>Unlock</th><th>Status</th>
            </tr>
            <tr
              v-for="e in items"
              :key="e.idx"
              :class="{ dim: e.owned === 1 }"
            >
              <td>
                <b>{{ e.name }}</b>
                <span
                  v-if="emporiumDesc(e)"
                  class="tip"
                  :title="emporiumDesc(e)"
                >ⓘ</span>
              </td>
              <td>
                <Chip
                  v-if="e.owned === 1"
                  variant="live"
                  force
                >
                  owned
                </Chip>
                <Chip
                  v-else-if="e.owned === null"
                  variant="soon"
                  force
                >
                  unreadable
                </Chip>
                <Chip
                  v-else
                  variant="dead"
                  force
                >
                  not bought
                </Chip>
              </td>
            </tr>
          </table>
        </div>
      </ShowMore>
    </section>

    <section class="panel">
      <h2>
        <SpriteIcon
          file="jade_coin"
          dir="etc"
          :size="20"
        />
        Pristine Charms
        <span class="hint">
          {{ sneaking.charms.total }} gacha-rolled charms, each a distinct account-wide bonus.
          <span
            class="tip"
            :title="GACHA_TOOLTIP"
          >ⓘ</span>
        </span>
      </h2>
      <div
        class="cards"
        style="margin-bottom:10px"
      >
        <div class="tile">
          <div class="label">
            Pristine rolls remaining
          </div>
          <div class="value">
            {{ fmt(sneaking.gacha.pristineRollsRemaining) }}
          </div>
          <div class="sub">
            charm roll counter: {{ fmt(sneaking.gacha.charmRollCounter) }}
          </div>
        </div>
        <div class="tile">
          <div class="label">
            Symbol rolls remaining
          </div>
          <div class="value">
            {{ fmt(sneaking.gacha.symbolRollsRemaining) }}
          </div>
          <div class="sub">
            Strange Symbols upgrade gate
          </div>
        </div>
      </div>
      <ShowMore
        v-slot="{ items }"
        :items="charmsSorted"
        :cap="10"
      >
        <div class="scroll">
          <table>
            <tr>
              <th>Charm</th><th>Status</th><th>Bonus</th><th class="num">
                Value
              </th>
            </tr>
            <tr
              v-for="c in items"
              :key="c.idx"
              :class="{ dim: c.owned }"
            >
              <td><b>{{ c.name }}</b></td>
              <td>
                <Chip
                  :variant="c.owned ? 'live' : 'dead'"
                  force
                >
                  {{ c.owned ? "owned" : "missing" }}
                </Chip>
              </td>
              <td class="note">
                {{ c.bonus }}
              </td>
              <td class="num">
                {{ c.owned ? fmt(c.value) : "—" }}
              </td>
            </tr>
          </table>
        </div>
      </ShowMore>
    </section>

    <section class="panel">
      <h2>
        <SpriteIcon
          file="jade_coin"
          dir="etc"
          :size="20"
        />
        Gemstones
        <span class="hint">
          8 collectible gemstones, each its own bonus formula (Aquamarine feeds Stealth, Emerald
          feeds upgrade cost, Firefrost feeds Charm Collector, etc).
        </span>
      </h2>
      <div class="scroll">
        <table>
          <tr>
            <th>Gemstone</th><th>Status</th><th class="num">
              Bonus value
            </th>
          </tr>
          <tr
            v-for="g in sneaking.gemstones"
            :key="g.idx"
            :class="{ dim: g.collected }"
          >
            <td>
              <b>{{ g.name }}</b>
              <span
                v-if="gemstoneDesc(g)"
                class="tip"
                :title="gemstoneDesc(g)"
              >ⓘ</span>
            </td>
            <td>
              <Chip
                :variant="g.collected ? 'live' : 'dead'"
                force
              >
                {{ g.collected ? "collected" : "missing" }}
              </Chip>
            </td>
            <td class="num">
              {{ (g.lowerBound ? "≥ " : "") + fmt(g.value) }}
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
    No <code>w6</code> entity on this snapshot yet.
  </p>

  <StatModule
    id="mod_stealth"
    :stat="stealthStat"
    title="Ninja Stealth"
    :icon="{ file: 'Sneaking_Ninja', dir: 'etc' }"
    blurb="What lowers detection rate — per-character (Sneaking level, statue, gemstone, cards, achievements, Emperor, sushi, and more)."
    :char-names="charNames"
    :series="series"
  />
</template>

<style scoped>
.tip { cursor: help; color: var(--accent); font-weight: 700; border-bottom: 1px dotted var(--accent); }
</style>
