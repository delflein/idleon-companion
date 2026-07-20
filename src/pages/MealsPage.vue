<script setup>
/**
 * MealsPage — the meals.html port. Legacy meals.html's flagship panel is "Meal Maxing": rank all
 * 74 dinner-table meals under a goal selector (cheapest next level / biggest % jump / by effect
 * type) ahead of the generic `mealBonuses` recipe module (docs/migration/survey-pages.md:
 * "entities.w4.meals[], mealCap, mealGlobalMulti; stats.mealBonuses").
 *
 * DROPPED: legacy meals.html also fetched `/api/w4` into a `GLOSS` variable that is never read
 * anywhere in the page (confirmed by the survey: "dead fetch, never read" — no `GLOSS.*` access
 * exists in mealEffectOptions/rankedMeals/renderMealMaxing, only the entity's own `m.effect`
 * string). Dropped silently here — no `w4Glossary()` import in this file.
 *
 * PRESERVED page-local heuristic: `pctJump` ("biggest % jump" goal). A meal's bonus is linear in
 * its own level (bonus = level × coeff × mastery arm × global multi × ribbon arm — see
 * domain.mjs's w4.meals build), so the marginal gain from the NEXT level-up, as a % of the meal's
 * CURRENT bonus, is exactly 100/level for an already-started meal — derivable straight from the
 * entity's level+bonus fields, no gamedata needed. A never-started meal (level 0) has no current
 * bonus to compare against, so its first level is definitionally the biggest possible relative
 * jump and sorts first (Infinity, rendered as "not started" rather than a %). Flagged in
 * docs/migration/survey-pages.md #6 as page-local (no equivalent in bonuses/cooking.mjs or
 * stats/meal-bonus.mjs) — kept here rather than promoted to src/core, per the survey's own
 * assessment that it's a display-ranking heuristic, not a new game-math derivation.
 */
import { ref, computed, watch } from "vue";
import { state, entities, stats, useHistory } from "../data/appState.js";
import StatModule from "../ui/StatModule.vue";
import ShowMore from "../ui/ShowMore.vue";
import SpriteIcon from "../ui/SpriteIcon.vue";
import { fmt } from "../ui/fmt.js";

const charNames = computed(() => state.value?.charNames ?? []);
const w4 = computed(() => entities.value?.w4 ?? null);
const startedCount = computed(() => (w4.value?.meals ?? []).filter((m) => m.level > 0).length);
const bestMeal = computed(() => {
  const meals = w4.value?.meals ?? [];
  return meals.length ? [...meals].sort((a, b) => b.level - a.level)[0] : null;
});

const mealGoal = ref(localStorage.getItem("w4MealGoal") || "cheap"); // "cheap" | "jump" | "effect"
const mealEffectKey = ref(localStorage.getItem("w4MealEffectKey") || "");
watch(mealGoal, (v) => localStorage.setItem("w4MealGoal", v));
watch(mealEffectKey, (v) => localStorage.setItem("w4MealEffectKey", v));

const mealEffectOptions = computed(() => {
  const seen = new Map();
  for (const m of w4.value?.meals ?? []) if (!seen.has(m.key)) seen.set(m.key, m.effect);
  return [...seen.entries()].sort((a, b) => a[1].localeCompare(b[1]));
});

const rankedMeals = computed(() => {
  const pool = (w4.value?.meals ?? []).filter((m) => !m.capped);
  if (mealGoal.value === "cheap") {
    return pool.filter((m) => m.costToNext != null).sort((a, b) => a.costToNext - b.costToNext);
  }
  if (mealGoal.value === "jump") {
    // See the module-level comment: bonus is linear in level, so the next level's relative jump
    // is exactly 100/level for a started meal.
    return pool.filter((m) => m.costToNext != null)
      .map((m) => ({ ...m, pctJump: m.level > 0 ? 100 / m.level : Infinity }))
      .sort((a, b) => b.pctJump - a.pctJump);
  }
  // "effect" — filter to one MealBonusesS key, cheapest lever for that effect first.
  const filtered = mealEffectKey.value ? pool.filter((m) => m.key === mealEffectKey.value) : pool;
  return filtered.filter((m) => m.costToNext != null).sort((a, b) => a.costToNext - b.costToNext);
});

const mealStat = computed(() => stats.value?.mealBonuses ?? null);

const historyKeys = computed(() => {
  const st = mealStat.value;
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
    <h1>Meals</h1>
  </header>
  <div
    id="err"
    class="err"
  />

  <template v-if="w4">
    <div class="cards">
      <div class="tile">
        <SpriteIcon
          file="Cooking"
          dir="afk_targets"
          :size="28"
        />
        <div class="label">
          Meals started
        </div>
        <div class="value">
          {{ startedCount }}<span class="of">/{{ w4.meals.length }}</span>
        </div>
        <div class="sub">
          level 1+
        </div>
      </div>
      <div class="tile">
        <SpriteIcon
          file="Ribbon0"
          dir="data"
          :size="28"
        />
        <div class="label">
          Meal level cap
        </div>
        <div class="value">
          {{ (w4.mealCap.lowerBound ? "≥ " : "") + fmt(w4.mealCap.value) }}
        </div>
        <div class="sub">
          some raise-sources unmodeled
        </div>
      </div>
    </div>

    <section class="panel">
      <h2>
        <SpriteIcon
          file="Cooking"
          dir="afk_targets"
          :size="20"
        />
        Meal Maxing
        <span class="hint">
          74 dinner-table meals, each leveled independently — what's the most efficient next
          level to buy right now?
          <span
            class="tip"
            title="Every meal's bonus = level × its own coefficient × a per-meal Cooking Mastery arm × one account-wide global multiplier (see the breakdown below) × a per-meal Ribbon rank arm. Leveling ANY single meal only moves that meal's own line in the MealBonusesS table — there is no single 'meal power' scalar."
          >ⓘ</span>
        </span>
      </h2>
      <div
        class="cards"
        style="margin-bottom:10px"
      >
        <div class="tile">
          <SpriteIcon
            file="Ribbon0"
            dir="data"
            :size="28"
          />
          <div class="label">
            Level cap
          </div>
          <div class="value">
            {{ (w4.mealCap.lowerBound ? "≥ " : "") + fmt(w4.mealCap.value) }}
          </div>
          <div
            class="sub"
            title="Base 30, +Causticolumn artifact, +10/+10 Jade Emporium, +30 lore boss, +≤20 Grimoire #26."
          >
            5 possible raise-sources
            <span
              class="tip"
              title="Causticolumn artifact, 2× Jade Emporium (+10 each), a lore-boss defeat (+30), and Grimoire upgrade #26 (capped +20) can all raise this further — not every source is derivable from the save yet."
            >ⓘ</span>
          </div>
        </div>
        <div class="tile">
          <SpriteIcon
            file="Cooking"
            dir="afk_targets"
            :size="28"
          />
          <div class="label">
            Global multiplier
          </div>
          <div class="value">
            {{ (w4.mealGlobalMultiLowerBound ? "≥ " : "") + "×" + fmt(w4.mealGlobalMulti) }}
          </div>
          <div class="sub">
            <a href="#mod_mealBonuses">full breakdown ↓</a>
          </div>
        </div>
        <div class="tile">
          <div class="label">
            Meals started
          </div>
          <div class="value">
            {{ startedCount }}<span class="of">/{{ w4.meals.length }}</span>
          </div>
        </div>
        <div class="tile">
          <div class="label">
            Highest level
          </div>
          <div class="value">
            {{ bestMeal ? fmt(bestMeal.level) : "—" }}
          </div>
          <div class="sub">
            {{ bestMeal ? bestMeal.name : "—" }}
          </div>
        </div>
      </div>

      <div class="caveat">
        Cost-to-next is an UPPER bound (Companion/Achievement/Equinox-cloud discount sources
        aren't derivable from the save yet — the real cost to level a meal may be lower than
        shown). Ribbon rank 4+ bonus is also a documented lower bound (Emperor Set / Dreamstuff
        cloud addends unmodeled) — shown bonus can undercount slightly for heavily-ribboned meals.
      </div>

      <div class="goalbar">
        <select
          v-model="mealGoal"
          class="inlinesel"
        >
          <option value="cheap">
            Cheapest next level
          </option>
          <option value="jump">
            Biggest % jump
          </option>
          <option value="effect">
            By effect type
          </option>
        </select>
        <select
          v-if="mealGoal === 'effect'"
          v-model="mealEffectKey"
          class="inlinesel"
        >
          <option value="">
            All effects
          </option>
          <option
            v-for="[key, effect] in mealEffectOptions"
            :key="key"
            :value="key"
          >
            {{ effect }}
          </option>
        </select>
        <span class="note">
          {{ mealGoal === "cheap" ? "lowest spice cost to the next level first"
            : mealGoal === "jump" ? "meals where the next level moves their own bonus the most, in %"
              : "meals feeding one specific bonus, cheapest first" }}
        </span>
      </div>

      <ShowMore
        v-slot="{ items }"
        :key="mealGoal + mealEffectKey"
        :items="rankedMeals"
        :cap="12"
      >
        <div class="scroll">
          <table>
            <tr>
              <th>Meal</th><th>Level</th><th class="num">
                Current bonus
              </th><th>Ribbon</th>
              <th
                v-if="mealGoal === 'jump'"
                class="num"
              >
                Next-level jump
              </th>
              <th class="num">
                Cost to next level
              </th>
            </tr>
            <tr
              v-for="m in items"
              :key="m.idx"
            >
              <td>
                <b>{{ m.name }}</b><span class="keybadge">{{ m.key }}</span>
                <div class="note">
                  {{ m.effect }}
                </div>
              </td>
              <td>Lv {{ fmt(m.level) }}</td>
              <td class="num">
                {{ fmt(m.bonus) }}
              </td>
              <td class="num">
                {{ m.ribbonRank }}<span class="of">/25</span>
              </td>
              <td
                v-if="mealGoal === 'jump'"
                class="num"
              >
                <span
                  v-if="m.level === 0"
                  class="chip user"
                >not started</span>
                <template v-else>
                  +{{ fmt(m.pctJump) }}%
                </template>
              </td>
              <td class="num">
                <span
                  v-if="m.costToNext == null"
                  class="note"
                >incalculable (overflow)</span>
                <template v-else>
                  ≤ {{ fmt(m.costToNext) }}
                </template>
              </td>
            </tr>
          </table>
        </div>
      </ShowMore>
      <p
        v-if="rankedMeals.length === 0"
        class="note"
      >
        No meals match this filter — every meal either has no cost data or is out of room to
        level.
      </p>
    </section>
  </template>
  <p
    v-else
    class="note"
  >
    No <code>w4</code> entity on this snapshot yet.
  </p>

  <StatModule
    id="mod_mealBonuses"
    :stat="mealStat"
    title="Meal Bonus Multiplier (global)"
    :icon="{ file: 'Cooking', dir: 'afk_targets' }"
    blurb="The one multiplier shared by every meal's bonus — Lab jewel, shiny pet, Summoning win bonus, Companion."
    :char-names="charNames"
    :series="series"
  />
</template>
