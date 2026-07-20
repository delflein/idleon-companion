<script setup>
/**
 * BeanstalkPage — the beanstalk.html port. Legacy beanstalk.html is a 3-tile KPI strip + one
 * static 17-row Golden Foods table (docs/migration/survey-pages.md: "entities.w6.beanstalk
 * (foods[], unlocked flags); GLOSS.goldenFoods" — no /api/stats, no /api/history: this page has
 * no registered recipe, just raw entity + a page-local bonus formula).
 *
 * CORE-WIRING (survey-pages.md flag #5): legacy beanstalk.html's own
 * `beanstalkBonusLowerBound(amount, rank)` reimplemented the beanstalk bonus formula client-side
 * (hardcoding GfoodBonusMULTI=1) instead of calling the server. That formula already exists,
 * verified verbatim against N.js, as `beanstalkBonusTerm(amount, gfoodBonusMulti, rank)` in
 * src/gamedata/gamedata-w6-beanstalk.mjs (the same module domain.mjs's extractEntities() imports
 * GOLDEN_FOODS/BEANSTALK_SLOTS from to build `entities.w6.beanstalk` in the first place). This
 * page calls that CORE function directly — `beanstalkBonusTerm(f.amount, 1, f.rank)` — rather
 * than re-deriving the math, closing the "two independent implementations, drift risk" flag.
 *
 * RESOLUTION: no numeric discrepancy. Both the legacy page and the core function compute the
 * IDENTICAL expression (`amount * gfoodBonusMulti * .05 * getLOG(1+1000*10^rank) * (1 +
 * getLOG(...)/2.14)`) — the legacy page just hardcoded gfoodBonusMulti to 1 inline instead of
 * passing it as an argument. GfoodBonusMULTI itself (a 20+-system multiplier: armor sets, stamps,
 * achievements, talents, ...) is NOT modeled anywhere in this repo yet, so passing 1 (its neutral
 * element) is still the only honest choice — the value shown remains a LOWER BOUND, exactly as
 * legacy documented, just computed via the shared core path instead of a page-local copy.
 */
import { computed } from "vue";
import { entities } from "../data/appState.js";
import { w6Glossary } from "../data/derived.js";
import { beanstalkBonusTerm } from "../gamedata/gamedata-w6-beanstalk.mjs";
import { fmt } from "../ui/fmt.js";

const w6 = computed(() => entities.value?.w6 ?? null);
const beanstalk = computed(() => w6.value?.beanstalk ?? null);

const GLOSS = w6Glossary();

const planted = computed(() => (beanstalk.value?.foods ?? []).filter((f) => f.rank > 0).length);

function effectTextOf(f) {
  const gloss = GLOSS.goldenFoods.find((x) => x.index === f.index);
  return gloss?.desc ? gloss.desc.replace("[", fmt(f.amount)) : (f.effect ?? "—");
}

/** The CORE-wired bonus (see header comment) — null when the food isn't planted (rank 0), matching
 *  N.js's own `0 < Ninja[104][e]` gate (beanstalkBonusTerm is only ever additive on top of a planted
 *  food, never called for an unplanted one). */
function bonusOf(f) {
  return f.rank > 0 ? beanstalkBonusTerm(f.amount ?? 0, 1, f.rank) : null;
}

const BONUS_TIP = "Computed via the core beanstalkBonusTerm() formula (src/gamedata/gamedata-w6-beanstalk.mjs, verified verbatim against N.js) with GfoodBonusMULTI (armor sets, stamps, achievements, talents, and ~15 more sources) taken as ×1 — its neutral element. The real in-game bonus is higher. This is a lower bound, not a guess.";
</script>

<template>
  <header class="app">
    <h1>Beanstalk</h1>
  </header>
  <div
    id="err"
    class="err"
  />

  <template v-if="beanstalk">
    <div class="cards">
      <div class="tile">
        <div class="label">
          Beanstalk
        </div>
        <div class="value">
          {{ beanstalk.unlocked ? "unlocked" : "locked" }}
        </div>
        <div class="sub">
          Jade Emporium unlock #1
        </div>
      </div>
      <div class="tile">
        <div class="label">
          Supersizing
        </div>
        <div class="value">
          {{ beanstalk.supersizeUnlocked ? "unlocked" : "locked" }}
        </div>
        <div class="sub">
          Jade Emporium unlock #2 — allows 100,000-stack deposits
        </div>
      </div>
      <div class="tile">
        <div class="label">
          Foods planted
        </div>
        <div class="value">
          {{ planted }}<span class="of">/{{ beanstalk.foods.length }}</span>
        </div>
        <div class="sub">
          permanent bonus without needing the food equipped
        </div>
      </div>
    </div>

    <section class="panel">
      <h2>
        Golden Foods
        <span class="hint">
          17 golden foods can be permanently planted on the beanstalk instead of equipped —
          deposit a whole stack to raise a food's rank.
          <span
            class="tip"
            title="Deposit sizes are fixed stacks (10,000 for rank 1, 100,000 for rank 2 once Supersizing is unlocked, 1,000,000 for rank 3) — not incremental progress. No timers: this table shows current state and what the next stack size is, not how long it'll take."
          >ⓘ</span>
        </span>
      </h2>
      <div class="lowerbound">
        {{ BONUS_TIP }}
      </div>
      <div class="scroll">
        <table>
          <tr>
            <th>Food</th><th>Status</th><th class="num">
              Deposited stack
            </th><th>Next tier</th><th>Effect</th><th class="num">
              Current bonus
            </th>
          </tr>
          <tr
            v-for="f in beanstalk.foods"
            :key="f.index"
            :class="{ dim: !(f.rank > 0) }"
          >
            <td><b>{{ f.name }}</b></td>
            <td>
              <span :class="['chip', f.rank > 0 ? 'live' : 'dead']">
                {{ f.rank > 0 ? `Rank ${f.rank}` : "not planted" }}
              </span>
            </td>
            <td class="num">
              {{ f.depositedStack ? fmt(f.depositedStack) : "—" }}
            </td>
            <td>{{ f.nextTierStack != null ? `stack of ${fmt(f.nextTierStack)}` : "max rank reached" }}</td>
            <td class="note">
              {{ effectTextOf(f) }}
            </td>
            <td class="num">
              {{ f.rank > 0 ? "≥ " + fmt(bonusOf(f)) : "—" }}
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
</template>

<style scoped>
.tip { cursor: help; color: var(--accent); font-weight: 700; border-bottom: 1px dotted var(--accent); }
</style>
