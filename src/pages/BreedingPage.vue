<script setup>
/**
 * BreedingPage — the breeding.html port. Legacy breeding.html is a KPI tile + one bespoke panel
 * (Fence Yard species/shiny/egg progress, the 12 permanent upgrade tracks, the 26 Territory
 * forage zones) ahead of the generic `breedingChance` recipe module
 * (docs/migration/survey-pages.md: "entities.w4.breeding (species/shiny/eggs/upgrades),
 * entities.w4.territory.list; stats.breedingChance"). `w4Glossary()` is pure/static (src/data/
 * derived.js re-exports it verbatim) — no save parsing, same payload every call. Per-upgrade
 * effect TEXT comes from the glossary (`breedingUpgradeEffects`); level/bonus numbers come from
 * the entity (domain.mjs already computed the live `petUpgBonus()` value per upgrade).
 */
import { computed } from "vue";
import { state, entities, stats, useHistory } from "../data/appState.js";
import { w4Glossary } from "../data/derived.js";
import StatModule from "../ui/StatModule.vue";
import ShowMore from "../ui/ShowMore.vue";
import LevelBar from "../ui/LevelBar.vue";
import Chip from "../ui/Chip.vue";
import SpriteIcon from "../ui/SpriteIcon.vue";
import { fmt } from "../ui/fmt.js";

const GLOSS = w4Glossary();

const charNames = computed(() => state.value?.charNames ?? []);
const w4 = computed(() => entities.value?.w4 ?? null);
const breeding = computed(() => w4.value?.breeding ?? null);
const territorySorted = computed(() => {
  const list = w4.value?.territory.list ?? [];
  return [...list].sort((a, b) => b.rounds - a.rounds || b.progress - a.progress);
});
const territoryWorked = computed(() => territorySorted.value.filter((t) => t.claimed).length);

function upgradeEffect(u) {
  const g = (GLOSS.breedingUpgradeEffects || []).find((x) => x.idx === u.idx);
  return g ? g.effect : "";
}

const breedingStat = computed(() => stats.value?.breedingChance ?? null);

const historyKeys = computed(() => {
  const st = breedingStat.value;
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
    <h1>Breeding</h1>
  </header>
  <div
    id="err"
    class="err"
  />

  <template v-if="w4">
    <div class="cards">
      <div class="tile">
        <SpriteIcon
          file="PetEgg1"
          dir="data"
          :size="28"
        />
        <div class="label">
          Species discovered
        </div>
        <div class="value">
          {{ breeding.speciesUnlocked }}<span class="of">/{{ GLOSS.breedingSpeciesTotal ?? "?" }}</span>
        </div>
        <div class="sub">
          {{ breeding.shiny.count }} shiny pets
        </div>
      </div>
    </div>

    <section class="panel">
      <h2>
        <SpriteIcon
          file="PetEgg1"
          dir="data"
          :size="20"
        />
        Breeding &amp; Territory
        <span class="hint">
          Fence Yard pet breeding — species/shiny progress, the 12 permanent upgrade tracks, and
          the 26 Territory forage zones that feed spice back into Cooking.
          <span
            class="tip"
            title="Territory zones are worked passively by whichever 4 pets are assigned to that zone's foraging team; completing a round grants +1 spice of that zone's type and the zone's own requirement grows each round. Team/gene optimization isn't modeled on this page yet."
          >ⓘ</span>
        </span>
      </h2>
      <div
        class="cards"
        style="margin-bottom:10px"
      >
        <div class="tile">
          <SpriteIcon
            file="PetEgg1"
            dir="data"
            :size="28"
          />
          <div class="label">
            Species discovered
          </div>
          <div class="value">
            {{ breeding.speciesUnlocked }}<span class="of">/{{ GLOSS.breedingSpeciesTotal ?? "?" }}</span>
          </div>
          <div class="sub">
            <a href="#mod_breedingChance">chance breakdown ↓</a>
          </div>
        </div>
        <div class="tile">
          <div class="label">
            Shiny pets
          </div>
          <div class="value">
            {{ breeding.shiny.count }}
          </div>
          <div class="sub">
            best Lv {{ breeding.shiny.maxLevel || "—" }}
          </div>
        </div>
        <div class="tile">
          <div class="label">
            Egg nest
          </div>
          <div class="value">
            {{ breeding.eggs.filled }}<span class="of">/{{ breeding.eggs.slots }}</span>
          </div>
          <div class="sub">
            filled slots
          </div>
        </div>
        <div class="tile">
          <div class="label">
            Territory worked
          </div>
          <div class="value">
            {{ territoryWorked }}<span class="of">/{{ territorySorted.length }}</span>
          </div>
          <div class="sub">
            at least 1 round or progress
          </div>
        </div>
      </div>

      <h2 class="subhead">
        Breeding upgrades
        <span
          class="tip"
          title="Spent from PetDeadCell + a per-upgrade food item. Bonus column is the LIVE effect at the current level (PetUpgBONUS formula)."
        >ⓘ</span>
      </h2>
      <ShowMore
        v-slot="{ items }"
        :items="breeding.upgrades"
        :cap="12"
      >
        <div class="scroll">
          <table>
            <tr>
              <th>Upgrade</th><th>Level</th><th class="num">
                Live bonus
              </th><th>Effect</th>
            </tr>
            <tr
              v-for="u in items"
              :key="u.idx"
            >
              <td><b>{{ u.name }}</b></td>
              <td>
                <LevelBar
                  :level="u.level"
                  :max-level="u.maxLevel"
                />
              </td>
              <td class="num">
                {{ fmt(u.bonus) }}
              </td>
              <td class="note">
                {{ upgradeEffect(u) }}
              </td>
            </tr>
          </table>
        </div>
      </ShowMore>

      <h2
        class="subhead"
        style="margin-top:14px"
      >
        Territory <span class="of">sorted by rounds completed</span>
      </h2>
      <ShowMore
        v-slot="{ items }"
        :items="territorySorted"
        :cap="12"
      >
        <div class="scroll">
          <table>
            <tr>
              <th>Zone</th><th class="num">
                Rounds
              </th><th class="num">
                Progress
              </th><th class="num">
                Base requirement
              </th><th>Status</th>
            </tr>
            <tr
              v-for="t in items"
              :key="t.idx"
            >
              <td><b>{{ t.name }}</b></td>
              <td class="num">
                {{ fmt(t.rounds) }}
              </td>
              <td class="num">
                {{ fmt(t.progress) }}
              </td>
              <td class="num">
                {{ fmt(t.reqBase) }}
              </td>
              <td>
                <Chip
                  :variant="t.claimed ? 'live' : 'dead'"
                  force
                >
                  {{ t.claimed ? "worked" : "untouched" }}
                </Chip>
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
    No <code>w4</code> entity on this snapshot yet.
  </p>

  <StatModule
    id="mod_breedingChance"
    :stat="breedingStat"
    title="Breeding New-Species Chance (account multi)"
    :icon="{ file: 'PetEgg1', dir: 'data' }"
    blurb="The account-wide multiplier every pet's discovery odds ride on — gem shop, vials/bubbles×Rift, stamps, meals, kitchen ladles."
    :char-names="charNames"
    :series="series"
  />
</template>
