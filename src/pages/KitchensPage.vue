<script setup>
/**
 * KitchensPage — the kitchens.html port. Legacy kitchens.html is a KPI tile + one bespoke panel
 * (per-kitchen ladle levels/speed, Cooking Mastery rank + purple categories) ahead of the generic
 * `kitchenSpeed` recipe module (docs/migration/survey-pages.md: "entities.w4.kitchens[],
 * entities.w4 cooking.mastery; GLOSS.cookingMasteryCategories; stats.kitchenSpeed").
 * `w4Glossary()` is pure/static (src/data/derived.js re-exports it verbatim) — the category
 * unlock-rank gate + "feeds from" source text isn't on the entity, only in the glossary.
 */
import { computed } from "vue";
import { state, entities, stats, useHistory } from "../data/appState.js";
import { w4Glossary } from "../data/derived.js";
import StatModule from "../ui/StatModule.vue";
import Chip from "../ui/Chip.vue";
import SpriteIcon from "../ui/SpriteIcon.vue";
import { fmt } from "../ui/fmt.js";

const GLOSS = w4Glossary();

const charNames = computed(() => state.value?.charNames ?? []);
const w4 = computed(() => entities.value?.w4 ?? null);
const kitchensUnlocked = computed(() => (w4.value?.kitchens ?? []).filter((x) => x.status > 0).length);
const categoriesActive = computed(() => (w4.value?.cooking.mastery.categories ?? []).filter((c) => c.level > 0).length);

function categoryGloss(c) {
  return (GLOSS.cookingMasteryCategories || []).find((x) => x.idx === c.idx);
}
function categoryUnlocked(c) {
  const g = categoryGloss(c);
  return w4.value.cooking.mastery.rank >= (g?.rankReq ?? 0);
}

const kitchenStat = computed(() => stats.value?.kitchenSpeed ?? null);

const historyKeys = computed(() => {
  const st = kitchenStat.value;
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
    <h1>Kitchens</h1>
  </header>
  <div
    id="err"
    class="err"
  />

  <template v-if="w4">
    <div class="cards">
      <div class="tile">
        <SpriteIcon
          file="Ladle"
          dir="data"
          :size="28"
        />
        <div class="label">
          Kitchens unlocked
        </div>
        <div class="value">
          {{ kitchensUnlocked }}<span class="of">/{{ w4.kitchens.length }}</span>
        </div>
        <div class="sub">
          Cooking Mastery rank {{ w4.cooking.mastery.rank }}
        </div>
      </div>
    </div>

    <section class="panel">
      <h2>
        <SpriteIcon
          file="Ladle"
          dir="data"
          :size="20"
        />
        Kitchens &amp; Cooking Mastery
        <span class="hint">
          Per-kitchen ladle levels (Speed/Fire/Luck) driving cook speed, recipe-cook speed and
          new-recipe luck, plus the meta Cooking Mastery point trees.
          <span
            class="tip"
            title="Speed ladle raises cooking (bonus accrual) speed. Fire ladle raises recipe-cook speed AND feeds new-recipe-discovery odds. Luck ladle raises the chance to discover a brand-new recipe. Kitchens must be purchased in order — an unpurchased kitchen also cuts off the shared TOTALKITCHEN sum that feeds Breeding chance."
          >ⓘ</span>
        </span>
      </h2>
      <div
        class="cards"
        style="margin-bottom:10px"
      >
        <div class="tile">
          <SpriteIcon
            file="Ladle"
            dir="data"
            :size="28"
          />
          <div class="label">
            Shared cook-speed chain
          </div>
          <div class="value">
            {{ (w4.kitchenSpeedLowerBound ? "≥ " : "") + "×" + fmt(w4.kitchenSpeedShared) }}
          </div>
          <div class="sub">
            <a href="#mod_kitchenSpeed">full breakdown ↓</a>
          </div>
        </div>
        <div class="tile">
          <div class="label">
            Cooking Mastery rank
          </div>
          <div class="value">
            {{ w4.cooking.mastery.rank }}
          </div>
          <div class="sub">
            {{ fmt(w4.cooking.mastery.rankXp) }} rank XP
          </div>
        </div>
        <div class="tile">
          <div class="label">
            Yellow points spent
          </div>
          <div class="value">
            {{ fmt(w4.cooking.mastery.yellowPointsSpent) }}
          </div>
          <div class="sub">
            per-meal mastery (BonusMultiCook)
          </div>
        </div>
        <div class="tile">
          <div class="label">
            Purple categories active
          </div>
          <div class="value">
            {{ categoriesActive }}<span class="of">/{{ w4.cooking.mastery.categories.length }}</span>
          </div>
          <div class="sub">
            at least 1 point spent
          </div>
        </div>
      </div>

      <h2 class="subhead">
        Kitchens
      </h2>
      <div class="scroll">
        <table>
          <tr>
            <th>Kitchen</th><th class="num">
              Speed ladle
            </th><th class="num">
              Fire ladle
            </th><th class="num">
              Luck ladle
            </th><th class="num">
              Effective speed
            </th>
          </tr>
          <tr
            v-for="k in w4.kitchens"
            :key="k.idx"
            :class="{ dim: k.status <= 0 }"
          >
            <td>
              <b>Kitchen {{ k.idx + 1 }}</b>
              <Chip
                v-if="k.status <= 0"
                variant="dead"
                force
              >
                not purchased
              </Chip>
            </td>
            <td class="num">
              {{ k.ladles.speed }}
            </td>
            <td class="num">
              {{ k.ladles.fire }}
            </td>
            <td class="num">
              {{ k.ladles.luck }}
            </td>
            <td class="num">
              {{ k.status > 0 ? fmt(k.speed) : "—" }}
            </td>
          </tr>
        </table>
      </div>

      <h2
        class="subhead"
        style="margin-top:14px"
      >
        Cooking Mastery categories
        <span
          class="tip"
          title="Purple points (CookMaster[2]) are spent per category once your overall Mastery Rank clears that category's gate. Each category converts its own source stat into a %-boost to the Mastery EXP rate — except SMOKY, which the client's own EXP-rate formula skips."
        >ⓘ</span>
      </h2>
      <div class="scroll">
        <table>
          <tr>
            <th>Category</th><th class="num">
              Points
            </th><th /><th>Feeds from</th>
          </tr>
          <tr
            v-for="c in w4.cooking.mastery.categories"
            :key="c.idx"
            :class="{ dim: !categoryUnlocked(c) }"
          >
            <td>
              <b>{{ c.name }}</b>
              <Chip
                v-if="categoryGloss(c) && !categoryUnlocked(c)"
                variant="dead"
                force
              >
                needs rank {{ categoryGloss(c).rankReq }}
              </Chip>
            </td>
            <td class="num">
              {{ c.level }}
            </td>
            <td>
              <Chip
                v-if="!c.feedsExpRate"
                variant="soon"
                force
                title="Excluded from the EXP-rate formula — the client's own product skips this one category."
              >
                no EXP-rate effect
              </Chip>
            </td>
            <td class="note">
              {{ categoryGloss(c)?.source ?? "" }}
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
    No <code>w4</code> entity on this snapshot yet.
  </p>

  <StatModule
    id="mod_kitchenSpeed"
    :stat="kitchenStat"
    title="Kitchen Cooking Speed (shared chain)"
    :icon="{ file: 'Ladle', dir: 'data' }"
    blurb="The ~24-arm multiplier chain every kitchen's speed ladle stacks on top of — talents, vials, stamps, meals, artifacts, cards, Lab jewels, and more."
    :char-names="charNames"
    :series="series"
  />
</template>
