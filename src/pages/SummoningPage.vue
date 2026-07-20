<script setup>
/**
 * SummoningPage — the summoning.html port. Legacy summoning.html is a 5-tile KPI strip + a
 * Summoning Stones table (+ a deferred-per-upgrade-breakdown callout) ahead of THREE stacked
 * generic recipe modules: armyHealth, armyDamage, winBonus (docs/migration/survey-pages.md:
 * "entities.w6.summoning (armyHealth/Damage, winBonusIndex, endless*, stones[]);
 * stats.{armyHealth,armyDamage,winBonus}" — no page-local domain logic flagged: "tooltip
 * documents `essenceMultiplier` formula already computed in domain.mjs, doesn't compute it").
 *
 * DROPPED: legacy summoning.html fetched `/api/w6` into a `GLOSS` variable but never referenced
 * it anywhere in its render functions — a dead fetch (same class of bug the survey caught in
 * meals.html/research.html/slab.html, just not called out by name for this page). Not ported;
 * there's nothing to wire up.
 */
import { computed } from "vue";
import { state, entities, stats, useHistory } from "../data/appState.js";
import StatModule from "../ui/StatModule.vue";
import SpriteIcon from "../ui/SpriteIcon.vue";
import { fmt } from "../ui/fmt.js";

const charNames = computed(() => state.value?.charNames ?? []);
const w6 = computed(() => entities.value?.w6 ?? null);
const summoning = computed(() => w6.value?.summoning ?? null);

const armyHealthStat = computed(() => stats.value?.armyHealth ?? null);
const armyDamageStat = computed(() => stats.value?.armyDamage ?? null);
const winBonusStat = computed(() => stats.value?.winBonus ?? null);

function keysFor(st) {
  if (!st) return [];
  const keys = [`stat.${st.name}`];
  for (const t of st.collapsed.terms) if (t.status !== "unknown") keys.push(`stat.${st.name}.${t.id}`);
  return keys;
}
const historyKeys = computed(() => [
  ...keysFor(armyHealthStat.value),
  ...keysFor(armyDamageStat.value),
  ...keysFor(winBonusStat.value),
]);
// See MiningPage.vue's NOTE on useHistory(keys) not being reactive to `keys` changing later.
const { series } = useHistory(historyKeys.value);

function stoneName(name) {
  return name.charAt(0).toUpperCase() + name.slice(1);
}

const ESSENCE_TOOLTIP = "essenceMultiplier = max(2, 1 + kills on that stone's boss). Verbatim N.js formula, no cap.";
</script>

<template>
  <header class="app">
    <h1>Summoning</h1>
  </header>
  <div
    id="err"
    class="err"
  />

  <template v-if="summoning">
    <div class="cards">
      <div class="tile">
        <SpriteIcon
          file="Summoning"
          dir="afk_targets"
          :size="28"
        />
        <div class="label">
          Army Health
        </div>
        <div class="value">
          ×{{ fmt(summoning.armyHealth) }}
        </div>
        <div class="sub">
          <a href="#mod_armyHealth">full breakdown ↓</a>
        </div>
      </div>
      <div class="tile">
        <SpriteIcon
          file="Summoning"
          dir="afk_targets"
          :size="28"
        />
        <div class="label">
          Army Damage
        </div>
        <div class="value">
          {{ (summoning.armyDamageLowerBound ? "≥ " : "") + "×" + fmt(summoning.armyDamage) }}
        </div>
        <div class="sub">
          <a href="#mod_armyDamage">full breakdown ↓</a>
        </div>
      </div>
      <div class="tile">
        <SpriteIcon
          file="Endless_Summoning"
          dir="etc"
          :size="28"
        />
        <div class="label">
          Winner Bonus index
        </div>
        <div class="value">
          {{ fmt(summoning.winBonusIndex) }}
        </div>
        <div class="sub">
          <a href="#mod_winBonus">32 slots ↓</a>
        </div>
      </div>
      <div class="tile">
        <div class="label">
          Endless mode best
        </div>
        <div class="value">
          {{ summoning.endlessUnlocked ? fmt(summoning.endlessBest) : "locked" }}
        </div>
        <div class="sub">
          {{ summoning.endlessDifficulty ? summoning.endlessDifficulty.name.replace(/_/g, " ")
            : (summoning.endlessUnlocked ? "no wins yet" : "unlock via Summon Upgrade 70") }}
        </div>
      </div>
      <div class="tile">
        <div class="label">
          Matches won
        </div>
        <div class="value">
          {{ fmt(summoning.matchesWon) }}
        </div>
        <div class="sub">
          defeated Death Note roster
        </div>
      </div>
    </div>

    <section class="panel">
      <h2>
        <SpriteIcon
          file="Boss6"
          dir="data"
          :size="20"
        />
        Summoning Stones &amp; Upgrades
        <span class="hint">
          7 boss-territory stones — kills raise that colour's essence generation multiplier.
          <span
            class="tip"
            :title="ESSENCE_TOOLTIP"
          >ⓘ</span>
        </span>
      </h2>
      <div
        class="cards"
        style="margin-bottom:10px"
      >
        <div class="tile">
          <div class="label">
            Upgrades bought
          </div>
          <div class="value">
            {{ summoning.upgradesBought }}<span class="of">/{{ summoning.upgradesTotal }}</span>
          </div>
          <div class="sub">
            Summon Upgrade tree
          </div>
        </div>
        <div class="tile">
          <div class="label">
            Total upgrade levels
          </div>
          <div class="value">
            {{ fmt(summoning.totalUpgradeLevels) }}
          </div>
          <div class="sub">
            feeds HP/DMG Laundering (every 100 levels)
          </div>
        </div>
      </div>
      <div class="scroll">
        <table>
          <tr>
            <th>Stone</th><th>Territory</th><th class="num">
              Kills
            </th><th class="num">
              Essence multi
            </th>
          </tr>
          <tr
            v-for="st in summoning.stones"
            :key="st.idx"
          >
            <td><b>{{ stoneName(st.name) }}</b> <span class="note">({{ st.essenceColor }})</span></td>
            <td class="note">
              {{ st.territory }}
            </td>
            <td class="num">
              {{ fmt(st.kills) }}
            </td>
            <td class="num">
              ×{{ fmt(st.essenceMultiplier) }}
            </td>
          </tr>
        </table>
      </div>
      <div
        class="gapbox"
        style="margin-top:12px"
      >
        <h3>Per-upgrade breakdown — deferred</h3>
        <p>
          entities.w6.summoning currently exposes upgrade COUNTS only (bought/total, total
          levels) — not a per-upgrade level array, so a "which upgrades are behind" table isn't
          buildable yet. Adding a per-upgrade level list to domain.mjs's Summoning entity (82
          rows, name/level/cost-to-next from gamedata-w6-summoning.mjs's SUMMON_UPGRADES) is a
          clean follow-up pass.
        </p>
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
    id="mod_armyHealth"
    :stat="armyHealthStat"
    title="Army HP Multiplier"
    :icon="{ file: 'Summoning', dir: 'afk_targets' }"
    blurb="The total-army HP multiplier applied to every summoned unit in a competition."
    :char-names="charNames"
    :series="series"
  />
  <StatModule
    id="mod_armyDamage"
    :stat="armyDamageStat"
    title="Army DMG Multiplier"
    :icon="{ file: 'Summoning', dir: 'afk_targets' }"
    blurb="The total-army DMG multiplier applied to every summoned unit in a competition."
    :char-names="charNames"
    :series="series"
  />
  <StatModule
    id="mod_winBonus"
    :stat="winBonusStat"
    title="Summoning Winner Bonuses (32 slots)"
    :icon="{ file: 'Endless_Summoning', dir: 'etc' }"
    blurb="Each of the 32 winner-bonus slots is an independent account-wide bonus — career wins + Endless rounds feed all of them at once."
    :char-names="charNames"
    :series="series"
  />
</template>

<style scoped>
.tip { cursor: help; color: var(--accent); font-weight: 700; border-bottom: 1px dotted var(--accent); }
.gapbox { border: 1px dashed var(--border); border-radius: 10px; padding: 12px 14px; color: var(--ink-2); font-size: 12.5px; }
.gapbox h3 { font-size: 13px; color: var(--ink-1); margin-bottom: 6px; }
</style>
