<script setup>
/**
 * EmperorPage — the emperor.html port. Legacy emperor.html is a 4-tile KPI strip + a static
 * "next 6 showdowns" HP ladder + a 12-category bonus table ahead of the generic `emperorBonus`
 * recipe module (docs/migration/survey-pages.md: "entities.w6.emperor; stats.emperorBonus" — no
 * page-local domain logic flagged: "tooltip text documents formula, not computed").
 * `entities.w6.emperor` (src/core/domain.mjs) already carries `attempts.left` (the
 * debt-counter-to-plain-count conversion), `nextShowdowns` (the ×1.52 HP curve), and `bonuses[]`
 * (the 12-category wiring table) precomputed — this page just picks which shape each widget wants.
 */
import { computed } from "vue";
import { state, entities, stats, useHistory } from "../data/appState.js";
import StatModule from "../ui/StatModule.vue";
import SpriteIcon from "../ui/SpriteIcon.vue";
import { fmt } from "../ui/fmt.js";

const charNames = computed(() => state.value?.charNames ?? []);
const w6 = computed(() => entities.value?.w6 ?? null);
const emperor = computed(() => w6.value?.emperor ?? null);

const emperorStat = computed(() => stats.value?.emperorBonus ?? null);

const historyKeys = computed(() => {
  const st = emperorStat.value;
  if (!st) return [];
  const keys = [`stat.${st.name}`];
  for (const t of st.collapsed.terms) if (t.status !== "unknown") keys.push(`stat.${st.name}.${t.id}`);
  return keys;
});
// See MiningPage.vue's NOTE on useHistory(keys) not being reactive to `keys` changing later.
const { series } = useHistory(historyKeys.value);

// legacy OptionsListAccount[370] "signed debt counter" explainer — see domain.mjs's
// emperorAttemptsLeft()/emperorDebt370() for the actual conversion this tile displays.
const ATTEMPTS_TOOLTIP = "OptionsListAccount[370] is a signed DEBT counter, not a plain remaining-count: every attempt (win or lose) adds +1 to it; each day it's decreased by your Daily Tries (floor-clamped at -MaxAttemptStack so unused attempts don't bank forever), plus a 50% chance of +1 extra from the Emperor Season Pass. Attempts left today = max(0, round(1 - [370])). Shown here as the plain 'attempts left' number — no raw debt value, no timer.";
const BONUS_STATUS_TOOLTIP = "'Modeled elsewhere' = this companion's own recipes already fold that category into another stat (e.g. Ninja Stealth, Summoning Winner Bonuses, Drop Rate). 'Value only' categories are real in-game bonuses this page can't yet trace into a downstream recipe.";
</script>

<template>
  <header class="app">
    <h1>The Emperor</h1>
  </header>
  <div
    id="err"
    class="err"
  />

  <template v-if="emperor">
    <div class="cards">
      <div class="tile">
        <SpriteIcon
          file="Boss6"
          dir="data"
          :size="28"
        />
        <div class="label">
          Showdown wins
        </div>
        <div class="value">
          {{ fmt(emperor.showdownWins) }}
        </div>
        <div class="sub">
          current boss HP {{ fmt(emperor.currentShowdownHp) }}
        </div>
      </div>
      <div class="tile">
        <div class="label">
          Attempts left today
        </div>
        <div class="value">
          {{ fmt(emperor.attempts.left) }}
        </div>
        <div class="sub">
          of up to {{ fmt(emperor.attempts.maxDisplayed) }} banked
          <span
            class="tip"
            :title="ATTEMPTS_TOOLTIP"
          >ⓘ</span>
        </div>
      </div>
      <div class="tile">
        <div class="label">
          Daily tries
        </div>
        <div class="value">
          {{ fmt(emperor.attempts.dailyTries) }}
        </div>
        <div class="sub">
          base replenish per day
        </div>
      </div>
      <div class="tile">
        <SpriteIcon
          file="jade_coin"
          dir="etc"
          :size="28"
        />
        <div class="label">
          Emperor Season Pass
        </div>
        <div class="value">
          {{ emperor.attempts.seasonPass ? "owned" : "not owned" }}
        </div>
        <div class="sub">
          50% chance of +1 extra daily attempt
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
        Next Showdowns
        <span class="hint">
          Boss HP scales ×1.52 per win — this previews the next 6, the same curve the game itself
          shows.
        </span>
      </h2>
      <div class="rewardladder">
        <span
          v-for="(s, i) in emperor.nextShowdowns"
          :key="s.n"
          :class="{ next: i === 0 }"
        >#{{ s.n }}: {{ fmt(s.hp) }} HP</span>
      </div>
    </section>

    <section class="panel">
      <h2>
        <SpriteIcon
          file="Boss6"
          dir="data"
          :size="20"
        />
        Emperor Bonuses
        <span class="hint">
          12 categories, each accumulated across a 48-slot cycle as you win more showdowns.
          <span
            class="tip"
            :title="BONUS_STATUS_TOOLTIP"
          >ⓘ</span>
        </span>
      </h2>
      <div class="scroll">
        <table>
          <tr>
            <th>Category</th><th class="num">
              Value
            </th><th>Status</th><th>Feeds</th>
          </tr>
          <tr
            v-for="b in emperor.bonuses"
            :key="b.idx"
          >
            <td><b>{{ b.name }}</b></td>
            <td class="num">
              {{ fmt(b.value) }}
            </td>
            <td>
              <span :class="['chip', b.wired ? 'live' : 'soon']">
                {{ b.wired ? "modeled elsewhere" : "value only" }}
              </span>
            </td>
            <td class="note">
              {{ b.feeds }}
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
    :stat="emperorStat"
    title="Emperor Bonuses (12 categories)"
    :icon="{ file: 'Boss6', dir: 'data' }"
    blurb="Same 12 categories as the table above, shown as a term-by-term recipe with history."
    :char-names="charNames"
    :series="series"
  />
</template>

<style scoped>
.tip { cursor: help; color: var(--accent); font-weight: 700; border-bottom: 1px dotted var(--accent); }
.rewardladder { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
.rewardladder span { font-size: 11px; padding: 2px 8px; border-radius: 999px; border: 1px solid var(--border); color: var(--ink-2); }
.rewardladder span.next { border-color: var(--accent); color: var(--accent); font-weight: 700; }
</style>
