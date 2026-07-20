<script setup>
/**
 * FishingPage — the fishing.html port. Legacy fishing.html is a KPI tile + Poppy/Tar Pit upgrade
 * tables + a Mega Fish/Shiny/Reset Spiral fold (docs/migration/survey-pages.md: "entities.w2.fishing;
 * GLOSS (poppy/tarpit/megafish/reset-spiral); stats.fishRate + stats.shinyRate") ahead of two
 * generic recipe modules. No page-local domain logic — `w2.fishing` and both recipes are already
 * computed by src/core/domain.mjs / src/core/stats/fishing-rate.mjs.
 */
import { computed } from "vue";
import { state, entities, stats, useHistory } from "../data/appState.js";
import { w2Glossary } from "../data/derived.js";
import StatModule from "../ui/StatModule.vue";
import Chip from "../ui/Chip.vue";
import SpriteIcon from "../ui/SpriteIcon.vue";
import { fmt, niceItem } from "../ui/fmt.js";

const GLOSS = w2Glossary();

const charNames = computed(() => state.value?.charNames ?? []);
const w2 = computed(() => entities.value?.w2 ?? null);
const fish = computed(() => w2.value?.fishing ?? null);

const poppyGloss = new Map((GLOSS.poppyEffects || []).map((u) => [u.idx, u]));
const tarGloss = new Map((GLOSS.tarPitEffects || []).map((u) => [u.idx, u]));
const megaGloss = new Map((GLOSS.megaFishMilestones || []).map((m) => [m.idx, m]));
const spiralGloss = new Map((GLOSS.resetSpiralEffects || []).map((r) => [r.idx, r]));

const megaRows = computed(() => Array.from({ length: 12 }, (_, i) => ({
  i,
  unlocked: fish.value ? i < fish.value.megaFishUnlocked : false,
  gloss: megaGloss.get(i),
})));

const fishRateStat = computed(() => stats.value?.fishRate ?? null);
const shinyRateStat = computed(() => stats.value?.shinyRate ?? null);

function historyKeysFor(st) {
  if (!st) return [];
  const keys = [`stat.${st.name}`];
  for (const t of st.collapsed.terms) if (t.status !== "unknown") keys.push(`stat.${st.name}.${t.id}`);
  return keys;
}
const historyKeys = computed(() => [...historyKeysFor(fishRateStat.value), ...historyKeysFor(shinyRateStat.value)]);
// See MiningPage.vue's NOTE on useHistory(keys) not being reactive to `keys` changing later.
const { series } = useHistory(historyKeys.value);
</script>

<template>
  <header class="app">
    <h1>Fishing (Poppy)</h1>
  </header>
  <div
    id="err"
    class="err"
  />

  <template v-if="fish">
    <div class="cards">
      <div class="tile">
        <SpriteIcon
          file="Poppy"
          dir="afk_targets"
          :size="28"
        />
        <div class="label">
          Bluefin fish / min
        </div>
        <div class="value">
          {{ fmt(fish.fishPerMinute) }}
        </div>
        <div class="sub">
          shiny rate {{ fmt(fish.shinyRate) }}/tick (lower bound)
        </div>
      </div>
    </div>

    <section class="panel">
      <h2>
        Fishing (Poppy)
        <span class="hint">Poppy's fishing-town upgrades, Tar Pit, and the rate they add up to — planning numbers, not a live counter.</span>
      </h2>
      <div
        class="cards"
        style="margin-bottom:10px"
      >
        <div class="tile">
          <SpriteIcon
            file="Poppy"
            dir="afk_targets"
            :size="28"
          />
          <div class="label">
            Bluefin / min
          </div>
          <div class="value">
            {{ fmt(fish.fishPerMinute) }}
          </div>
          <div class="sub">
            <a href="#mod_fishRate">full breakdown ↓</a>
          </div>
        </div>
        <div class="tile">
          <div class="label">
            Shiny rate
          </div>
          <div class="value">
            {{ fmt(fish.shinyRate) }}<span class="of">/tick</span>
          </div>
          <div class="sub">
            <a href="#mod_shinyRate">full breakdown ↓</a>
          </div>
        </div>
        <div class="tile">
          <div class="label">
            Mega Fish milestones
          </div>
          <div class="value">
            {{ fish.megaFishUnlocked }}<span class="of">/12</span>
          </div>
          <div class="sub">
            permanent multipliers, see below
          </div>
        </div>
        <div class="tile">
          <div class="label">
            Currency banked
          </div>
          <div class="value">
            {{ fmt(fish.fishCurrency) }}
          </div>
          <div class="sub">
            {{ fmt(fish.tarCurrency) }} tar-pit currency
          </div>
        </div>
      </div>

      <div class="grid2">
        <section
          class="panel"
          style="margin:0"
        >
          <h2 style="font-size:13px">
            Poppy upgrades
          </h2>
          <div class="scroll">
            <table>
              <tr>
                <th>Upgrade</th><th class="num">
                  Level
                </th>
              </tr>
              <tr
                v-for="u in fish.poppy"
                :key="u.i"
              >
                <td>
                  <b>{{ niceItem(u.name) }}</b>
                  <div
                    v-if="poppyGloss.get(u.i)"
                    class="note"
                  >
                    {{ poppyGloss.get(u.i).desc }}{{ poppyGloss.get(u.i).bonus ? " — " + poppyGloss.get(u.i).bonus : "" }}
                  </div>
                </td>
                <td class="num">
                  Lv {{ u.level }}
                </td>
              </tr>
            </table>
          </div>
        </section>
        <section
          class="panel"
          style="margin:0"
        >
          <h2 style="font-size:13px">
            Tar Pit upgrades
          </h2>
          <div class="scroll">
            <table>
              <tr>
                <th>Upgrade</th><th class="num">
                  Level
                </th>
              </tr>
              <tr
                v-for="u in fish.tarPit"
                :key="u.i"
              >
                <td>
                  <b>{{ niceItem(u.name) }}</b>
                  <div
                    v-if="tarGloss.get(u.i)"
                    class="note"
                  >
                    {{ tarGloss.get(u.i).desc }}{{ tarGloss.get(u.i).bonus ? " — " + tarGloss.get(u.i).bonus : "" }}
                  </div>
                </td>
                <td class="num">
                  Lv {{ u.level }}
                </td>
              </tr>
            </table>
          </div>
        </section>
      </div>

      <details
        class="fold"
        style="margin-top:10px"
      >
        <summary>Mega Fish milestones, Shiny tiers &amp; Reset Spiral</summary>
        <p class="note">
          Mega Fish milestones unlock permanently as your fish-currency counter climbs; Reset
          Spiral levels are earned by resetting Poppy's upgrades ("Fisheroo Reset") for permanent
          multipliers instead.
        </p>
        <div class="scroll">
          <table>
            <tr>
              <th>Mega Fish milestone</th><th>Effect</th>
            </tr>
            <tr
              v-for="m in megaRows"
              :key="m.i"
              :class="{ dim: !m.unlocked }"
            >
              <td>
                <Chip
                  :variant="m.unlocked ? 'live' : 'dead'"
                  force
                >
                  {{ m.unlocked ? "unlocked" : "locked" }}
                </Chip>
              </td>
              <td class="note">
                {{ m.gloss ? m.gloss.desc : "" }}
              </td>
            </tr>
          </table>
        </div>
        <h2
          style="font-size:13px;margin-top:10px"
        >
          Shiny multiplier tiers
        </h2>
        <div class="levers">
          <div
            v-for="t in fish.shinyTiers"
            :key="t.i"
            class="lever"
          >
            <span class="lname">Shiny tier {{ t.i + 1 }}</span>
            <div class="lbar">
              <div
                class="lfill"
                :style="{ width: Math.min(100, t.level) + '%' }"
              />
            </div>
            <span class="lval">Lv {{ t.level }}</span>
          </div>
        </div>
        <h2
          style="font-size:13px;margin-top:10px"
        >
          Reset Spiral
        </h2>
        <div class="levers">
          <div
            v-for="r in fish.resetSpiral"
            :key="r.i"
            class="lever"
          >
            <span class="lname">{{ spiralGloss.get(r.i) ? spiralGloss.get(r.i).desc : "Reset Spiral " + r.i }}</span>
            <div class="lbar">
              <div
                class="lfill"
                :style="{ width: Math.min(100, r.level * 4) + '%' }"
              />
            </div>
            <span class="lval">Lv {{ r.level }}</span>
          </div>
        </div>
      </details>
    </section>
  </template>
  <p
    v-else
    class="note"
  >
    No <code>w2</code> entity on this snapshot yet.
  </p>

  <StatModule
    id="mod_fishRate"
    :stat="fishRateStat"
    title="Bluefin Fish / min"
    :icon="{ file: 'Poppy', dir: 'afk_targets' }"
    blurb="Poppy upgrades, Tar Pit, resets, and Mega Fish multiplying into a fish-per-minute rate."
    :char-names="charNames"
    :series="series"
  />
  <StatModule
    id="mod_shinyRate"
    :stat="shinyRateStat"
    title="Shiny Fishing Rate"
    :icon="{ file: 'Poppy', dir: 'afk_targets' }"
    blurb="Shiny Lure level, Mega Fish 9, Reset Spiral, and the shiny catch interval."
    :char-names="charNames"
    :series="series"
  />
</template>

<style scoped>
/* Ported verbatim from companion.css — lever/progress-bar widgets (not yet in src/styles/base.css;
 * .grid2/.fold/.dim/.note/.tile/.cards are already there and reused as-is). */
.levers { display: grid; grid-template-columns: minmax(130px, auto) 1fr auto; gap: 8px 12px; align-items: center; }
.lever { display: contents; }
.lname { font-size: 13px; color: var(--ink-2); font-weight: 650; }
.lbar { height: 12px; border-radius: 6px; overflow: hidden; background: var(--track); border: 1px solid rgba(0, 0, 0, .4); min-width: 60px; }
.lfill { height: 100%; background: var(--series-1); border-radius: 0 5px 5px 0; }
.lval { text-align: right; font-variant-numeric: tabular-nums; font-size: 13px; font-weight: 800; }
</style>
