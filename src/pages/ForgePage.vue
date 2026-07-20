<script setup>
/**
 * ForgePage — the forge.html port. Legacy forge.html has no recipe module or stats/history fetch
 * at all (docs/migration/survey-pages.md: "/api/state, /api/w1 (no stats/history)") — just two
 * flat lists, the forge upgrade-track levels (entities.w1.forge.upgrades[]) and the one-time
 * bribe checklist (entities.w1.bribes), each paired with static flavor text from w1Glossary()
 * (forgeEffects/bribeEffects — no save parsing, same payload every call, src/data/derived.js).
 */
import { computed } from "vue";
import { entities } from "../data/appState.js";
import { w1Glossary } from "../data/derived.js";
import ShowMore from "../ui/ShowMore.vue";
import SpriteIcon from "../ui/SpriteIcon.vue";
import { fmt, niceItem } from "../ui/fmt.js";

const w1 = computed(() => entities.value?.w1 ?? null);
const forgeUpgrades = computed(() => w1.value?.forge?.upgrades ?? []);
const bribes = computed(() => w1.value?.bribes ?? { owned: 0, total: 0, missing: [] });
const forgeMaxed = computed(() => forgeUpgrades.value.filter((u) => u.level >= u.maxLevel).length);

const GLOSS = w1Glossary();
const forgeEffByIdx = new Map(GLOSS.forgeEffects.map((e) => [e.index, e]));
const bribeEffByIdx = new Map(GLOSS.bribeEffects.map((e) => [e.index, e]));

const missingSorted = computed(() => [...bribes.value.missing].sort((a, b) => a.price - b.price));
</script>

<template>
  <header class="app">
    <h1>Forge &amp; Bribes</h1>
  </header>
  <div
    id="err"
    class="err"
  />

  <template v-if="w1">
    <div class="cards">
      <div class="tile">
        <SpriteIcon
          file="Bribe"
          dir="etc"
          :size="28"
        />
        <div class="label">
          Bribes owned
        </div>
        <div class="value">
          {{ bribes.owned }}<span class="of">/{{ bribes.total || 41 }}</span>
        </div>
        <div class="sub">
          {{ (bribes.total || 41) - bribes.owned }} left
        </div>
      </div>
      <div class="tile">
        <SpriteIcon
          file="ForgeA"
          dir="data"
          :size="28"
        />
        <div class="label">
          Forge tracks maxed
        </div>
        <div class="value">
          {{ forgeMaxed }}<span class="of">/{{ forgeUpgrades.length || 6 }}</span>
        </div>
        <div class="sub">
          level equals the track's cap
        </div>
      </div>
    </div>

    <section class="panel">
      <h2>
        <SpriteIcon
          file="ForgeA"
          dir="data"
          :size="20"
        />
        Forge
        <span class="hint">Six upgrade tracks, gold cost only.</span>
      </h2>
      <div class="scroll">
        <table>
          <tr>
            <th>Track</th><th class="num">
              Level
            </th>
          </tr>
          <tr
            v-for="u in forgeUpgrades"
            :key="u.index"
          >
            <td>
              <b>{{ niceItem(u.name) }}</b>
              <div
                v-if="forgeEffByIdx.get(u.index)"
                class="note"
              >
                {{ forgeEffByIdx.get(u.index).effect }}
              </div>
            </td>
            <td class="num">
              Lv {{ u.level }}<span class="of">/{{ u.maxLevel }}</span>
            </td>
          </tr>
        </table>
      </div>
    </section>

    <section class="panel">
      <h2>
        <SpriteIcon
          file="Bribe"
          dir="etc"
          :size="20"
        />
        Bribes
        <span class="hint">One-time account unlocks from Mr. Pigibank, cheapest missing first.</span>
      </h2>
      <div
        class="cards"
        style="margin-bottom:10px"
      >
        <div class="tile">
          <div class="label">
            Owned
          </div>
          <div class="value">
            {{ bribes.owned }}<span class="of">/{{ bribes.total }}</span>
          </div>
          <div class="sub">
            {{ bribes.total - bribes.owned }} left to buy
          </div>
        </div>
      </div>
      <ShowMore
        v-slot="{ items }"
        :items="missingSorted"
        :cap="12"
      >
        <div class="scroll">
          <table>
            <tr>
              <th>Bribe</th><th class="num">
                Price
              </th>
            </tr>
            <tr
              v-for="b in items"
              :key="b.index"
            >
              <td>
                <b>{{ niceItem(b.name) }}</b>
                <div
                  v-if="bribeEffByIdx.get(b.index)?.desc"
                  class="note"
                >
                  {{ bribeEffByIdx.get(b.index).desc }}
                </div>
              </td>
              <td class="num">
                {{ fmt(b.price) }}
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
    No <code>w1</code> entity on this snapshot yet.
  </p>
</template>
