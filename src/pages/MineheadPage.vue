<script setup>
/**
 * MineheadPage — the minehead.html port. Legacy minehead.html is a 3-tile KPI strip + two
 * show-more tables, no recipe/history (docs/migration/survey-pages.md: "entities.w7.minehead
 * (shop, glimbo trades); GLOSS mineheadShop/glimboCostGrowth" — "own comment notes per-upgrade
 * formula 'lives in the minigame's own scene code,' not modeled anywhere" — no page-local domain
 * logic to port).
 */
import { computed } from "vue";
import { entities } from "../data/appState.js";
import { w7Glossary } from "../data/derived.js";
import ShowMore from "../ui/ShowMore.vue";
import SpriteIcon from "../ui/SpriteIcon.vue";
import { fmt } from "../ui/fmt.js";

const w7 = computed(() => entities.value?.w7 ?? null);
const minehead = computed(() => w7.value?.minehead ?? null);

const GLOSS = w7Glossary();
const shopDescOf = computed(() => Object.fromEntries((GLOSS.mineheadShop ?? []).map((s) => [s.id, s.desc])));
const growthOf = computed(() => Object.fromEntries((GLOSS.glimboCostGrowth ?? []).map((g) => [g.idx, g.costGrowth])));

// Legacy `renderShop()`: bought rows (level > 0) first (highest level first), untouched after.
const shopRows = computed(() => {
  const m = minehead.value;
  if (!m) return [];
  const bought = m.shopLevels.filter((r) => r.level > 0).sort((a, b) => b.level - a.level);
  const untouched = m.shopLevels.filter((r) => r.level === 0);
  return bought.concat(untouched);
});

// Legacy `renderGlimbo()`: sorted by trades made, descending.
const glimboRows = computed(() => {
  const m = minehead.value;
  if (!m) return [];
  return m.glimboTrades.map((t, i) => ({ ...t, costGrowth: growthOf.value[i] })).sort((a, b) => b.trades - a.trades);
});
</script>

<template>
  <header class="app">
    <h1>Minehead &amp; Glimbo</h1>
  </header>
  <div
    id="err"
    class="err"
  />

  <template v-if="minehead">
    <div class="cards">
      <div class="tile">
        <SpriteIcon
          file="MineHead0"
          dir="data"
          :size="28"
        />
        <div class="label">
          Button presses
        </div>
        <div class="value">
          {{ fmt(minehead.buttonPresses) }}
        </div>
        <div class="sub">
          buckets of 5 feed the Button Bonuses track
        </div>
      </div>
      <div class="tile">
        <div class="label">
          Depth Charge shop bought
        </div>
        <div class="value">
          {{ minehead.shopBought }}<span class="of">/{{ minehead.shopLevels.length }}</span>
        </div>
        <div class="sub">
          at least 1 level in
        </div>
      </div>
      <div class="tile">
        <div class="label">
          Glimbo total trades
        </div>
        <div class="value">
          {{ fmt(minehead.glimboTotalTrades) }}
        </div>
        <div class="sub">
          across {{ minehead.glimboTrades.length }} tradeable grid-node unlocks
        </div>
      </div>
    </div>

    <section class="panel">
      <h2>
        <SpriteIcon
          file="MineHead0"
          dir="data"
          :size="20"
        />
        Depth Charge shop
        <span class="hint">
          Minehead's Minesweeper-style minigame — 30 upgrades, no per-upgrade dispatcher formula
          was found in N.js (the effect wiring lives in the minigame's own scene code), so levels
          are shown as-is.
        </span>
      </h2>
      <ShowMore
        v-slot="{ items }"
        :items="shopRows"
        :cap="10"
      >
        <div class="scroll">
          <table>
            <tr>
              <th>Upgrade</th><th class="num">
                Level
              </th>
            </tr>
            <tr
              v-for="r in items"
              :key="r.id"
            >
              <td>
                <b>{{ r.name }}</b>
                <div
                  v-if="shopDescOf[r.id]"
                  class="where"
                >
                  {{ shopDescOf[r.id] }}
                </div>
              </td>
              <td class="num">
                {{ r.level }}<span class="of">/{{ r.maxLv >= 9999 ? "∞" : r.maxLv }}</span>
              </td>
            </tr>
          </table>
        </div>
      </ShowMore>
    </section>

    <section class="panel">
      <h2 class="subhead">
        Glimbo trades
        <span class="hint">
          Trading with Glimbo is the ONLY way to unlock these 22 specific Research Grid nodes —
          points alone won't do it. Cost grows geometrically per trade (Companions(57) and the
          weekly Event Shop both discount it).
        </span>
      </h2>
      <ShowMore
        v-slot="{ items }"
        :items="glimboRows"
        :cap="10"
      >
        <div class="scroll">
          <table>
            <tr>
              <th>Trade item</th><th class="num">
                Trades made
              </th><th class="num">
                Cost growth
              </th>
            </tr>
            <tr
              v-for="(t, i) in items"
              :key="i"
            >
              <td>
                <b>{{ t.item }}</b>
                <div class="where">
                  unlocks Research Grid node #{{ t.gridNode }}
                </div>
              </td>
              <td class="num">
                {{ fmt(t.trades) }}
              </td>
              <td class="num">
                {{ t.costGrowth != null ? "×" + t.costGrowth + "/trade" : "—" }}
              </td>
            </tr>
          </table>
        </div>
      </ShowMore>
    </section>
  </template>
  <p
    v-else
    class="note"
  >
    No <code>w7</code> entity on this snapshot yet.
  </p>
</template>

<style scoped>
.subhead { font-size: 13px; margin: 4px 0 8px; }
</style>
