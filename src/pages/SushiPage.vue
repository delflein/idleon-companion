<script setup>
/**
 * SushiPage — the sushi.html port. Legacy sushi.html is a 3-tile KPI strip + a dish-progress
 * ladder + a shop reference table ahead of the `sushiRoG` recipe module
 * (docs/migration/survey-pages.md: "entities.w7.sushi (dishesUnlocked/Total, rog[], shopBought);
 * stats.sushiRoG" — "lighter recipe-module variant (account-wide 'points' shape, same pattern as
 * legends.html)"). StatModule replaces legacy's bespoke renderModule() term table wholesale — same
 * bucketing (locked = not-yet-unlocked RoG slots sit at their neutral element 0), same progress-
 * index headline, same per-slot history/sparklines.
 *
 * HONESTY NOTE preserved verbatim: `entities.w7.sushi` only carries an aggregate "shop upgrades
 * bought" COUNT (Sushi[2] has no per-upgrade level array read yet), so the shop table below is a
 * names/max-level REFERENCE only, not owned levels — same caveat legacy states inline.
 */
import { computed } from "vue";
import { entities, stats, useHistory } from "../data/appState.js";
import { w7Glossary } from "../data/derived.js";
import StatModule from "../ui/StatModule.vue";
import SpriteIcon from "../ui/SpriteIcon.vue";

const w7 = computed(() => entities.value?.w7 ?? null);
const sushi = computed(() => w7.value?.sushi ?? null);
const sushiStat = computed(() => stats.value?.sushiRoG ?? null);

const GLOSS = w7Glossary();

const dishLadder = computed(() => {
  const su = sushi.value;
  if (!su) return [];
  return Array.from({ length: su.dishesTotal }, (_, i) => ({ tier: i + 1, got: i < su.dishesUnlocked }));
});

const historyKeys = computed(() => {
  const st = sushiStat.value;
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
    <h1>Sushi Station</h1>
  </header>
  <div
    id="err"
    class="err"
  />

  <template v-if="sushi">
    <div class="cards">
      <div class="tile">
        <SpriteIcon
          file="Sushi1"
          dir="data"
          :size="28"
        />
        <div class="label">
          Dishes unlocked
        </div>
        <div class="value">
          {{ sushi.dishesUnlocked }}<span class="of">/{{ sushi.dishesTotal }}</span>
        </div>
        <div class="sub">
          {{ sushi.highestDish ?? "no dishes yet" }}
        </div>
      </div>
      <div class="tile">
        <div class="label">
          Rift of Gods bonuses active
        </div>
        <div class="value">
          {{ sushi.rogActive }}<span class="of">/{{ sushi.rog.length }}</span>
        </div>
        <div class="sub">
          unlock 1 more RoG slot per new dish tier
        </div>
      </div>
      <div class="tile">
        <div class="label">
          Shop upgrades bought
        </div>
        <div class="value">
          {{ sushi.shopBought }}
        </div>
        <div class="sub">
          aggregate count only — see gap note below
        </div>
      </div>
    </div>

    <section class="panel">
      <h2>
        <SpriteIcon
          file="Sushi1"
          dir="data"
          :size="20"
        />
        Dishes
        <span class="hint">
          UniqueSushi = the number of dish tiers unlocked IN A LEADING CONSECUTIVE RUN from tier 1
          — every Rift-of-Gods slot and knowledge/dish mechanic keys off this count.
        </span>
      </h2>
      <div class="dishladder">
        <span
          v-for="d in dishLadder"
          :key="d.tier"
          :class="{ got: d.got }"
          :title="`dish tier ${d.tier}`"
        >{{ d.tier }}</span>
      </div>
      <div class="caveat">
        Fuel, Shaker charges, and Knowledge queue state are runtime UI values the client keeps in
        memory, not written to the save — this page honestly shows them as "not in save" rather
        than a stale or guessed number. Check the in-game Sushi Station directly for those.
      </div>
      <details
        class="fold"
        style="margin-top:10px"
      >
        <summary>Shop upgrades — {{ GLOSS.sushiShop.length }}-row reference (names/max levels only, no owned levels)</summary>
        <p
          class="note"
          style="margin:6px 0"
        >
          entities.w7.sushi currently exposes an aggregate "shop upgrades bought" COUNT only, not a
          per-upgrade level array — so this table lists what's BUYABLE, not what YOU own. Adding a
          per-upgrade level list to the Sushi entity (reading Sushi[2]) is a clean follow-up pass.
        </p>
        <div class="scroll">
          <table>
            <tr>
              <th>Upgrade</th><th class="num">
                Max level
              </th>
            </tr>
            <tr
              v-for="r in GLOSS.sushiShop"
              :key="r.id"
            >
              <td>
                <b>{{ r.name }}</b>
                <div class="where">
                  {{ r.desc }}
                </div>
              </td>
              <td class="num">
                {{ r.maxLv >= 9999 ? "∞" : r.maxLv }}
              </td>
            </tr>
          </table>
        </div>
      </details>
    </section>
  </template>
  <p
    v-else
    class="note"
  >
    No <code>w7</code> entity on this snapshot yet.
  </p>

  <StatModule
    :stat="sushiStat"
    title="Sushi Rift of Gods — Full Breakdown"
    :icon="{ file: 'Sushi1', dir: 'data' }"
    blurb="Each of the 59 RoG slots unlocks in order as UniqueSushi rises — every unlocked slot is an independent account-wide bonus feeding a different system."
    :char-names="[]"
    :series="series"
  />
</template>

<style scoped>
.dishladder { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 8px; }
.dishladder span { font-size: 10.5px; padding: 2px 7px; border-radius: 999px; border: 1px solid var(--border); color: var(--ink-muted); }
.dishladder span.got { border-color: rgba(12, 163, 12, .5); color: var(--good); }
.caveat { border-left: 3px solid var(--warning); background: rgba(250, 178, 25, .06); padding: 8px 11px; border-radius: 0 10px 10px 0; margin-bottom: var(--gap); font-size: 12.5px; color: var(--ink-2); }
</style>
