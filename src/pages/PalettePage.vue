<script setup>
/**
 * PalettePage — the palette.html port. Legacy palette.html: a KPI tile, a 37-colour-slot table
 * (level + what it feeds), then the `paletteLuck` recipe module (docs/migration/survey-pages.md:
 * "entities.w5.palette (luck, slots[]); stats.paletteLuck... generic recipe-module renderer
 * (byte-identical hash-verified w/ printer/refinery/shrines/sneaking)").
 */
import { computed } from "vue";
import { state, entities, stats, useHistory } from "../data/appState.js";
import StatModule from "../ui/StatModule.vue";
import ShowMore from "../ui/ShowMore.vue";
import SpriteIcon from "../ui/SpriteIcon.vue";
import { fmt } from "../ui/fmt.js";

const charNames = computed(() => state.value?.charNames ?? []);
const w5 = computed(() => entities.value?.w5 ?? null);
const palette = computed(() => w5.value?.palette ?? null);

/* Entity text already has "_" -> " " (domain.mjs); this strips the N.js value-placeholder
 * punctuation ("{", "}", "#", etc.) that domain.mjs leaves untouched. Ports legacy `stripPh()`
 * (divinity.html/palette.html/slab.html) — a small display-text cleaner, not domain logic, so it
 * stays local rather than growing a new src/core/ module or touching the shared fmt.js. */
function stripPh(s) {
  return String(s ?? "").replace(/[{}<>$@#]/g, "").replace(/\s+/g, " ").trim();
}

const unlockedCount = computed(() => (palette.value?.slots ?? []).filter((x) => x.unlocked).length);
const sortedSlots = computed(() =>
  [...(palette.value?.slots ?? [])].sort((a, b) => (Number(b.unlocked) - Number(a.unlocked)) || (b.level - a.level)));

const paletteLuckStat = computed(() => stats.value?.paletteLuck ?? null);

const historyKeys = computed(() => {
  const st = paletteLuckStat.value;
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
    <h1>Palette</h1>
  </header>
  <div
    id="err"
    class="err"
  />

  <template v-if="palette">
    <div class="cards">
      <div class="tile">
        <SpriteIcon
          file="GamingPal"
          dir="data"
          :size="28"
        />
        <div class="label">
          Palette luck
        </div>
        <div class="value">
          {{ (palette.luckLowerBound ? "≥ " : "") + "×" + fmt(palette.luck) }}
        </div>
        <div class="sub">
          {{ unlockedCount }}/{{ palette.slots.length }} colours unlocked
        </div>
      </div>
    </div>

    <section class="panel">
      <h2>
        <SpriteIcon
          file="GamingPal"
          dir="data"
          :size="20"
        />
        Palette
        <span class="hint">
          37 colours, each leveled independently from Spelunk lore discoveries — every colour
          feeds a different game-wide bonus (or "nothing yet").
          <span
            class="tip"
            title="A few notable colours: #5 Bright Cyan boosts Sailing Artifact Find chance. #28 Violet boosts the W2 Alchemy 'Prisma' bubble's bonus. #3 Neon Tree and several others directly feed the Palette Luck stat itself (below) — leveling those is self-reinforcing."
          >ⓘ</span>
        </span>
      </h2>
      <div
        class="cards"
        style="margin-bottom:10px"
      >
        <div class="tile">
          <SpriteIcon
            file="GamingPal"
            dir="data"
            :size="28"
          />
          <div class="label">
            Palette Luck
          </div>
          <div class="value">
            {{ (palette.luckLowerBound ? "≥ " : "") + "×" + fmt(palette.luck) }}
          </div>
          <div class="sub">
            <a href="#mod_paletteLuck">full breakdown ↓</a>
          </div>
        </div>
        <div class="tile">
          <div class="label">
            Colours unlocked
          </div>
          <div class="value">
            {{ unlockedCount }}<span class="of">/{{ palette.slots.length }}</span>
          </div>
          <div class="sub">
            at least level 1
          </div>
        </div>
      </div>

      <ShowMore
        v-slot="{ items }"
        :items="sortedSlots"
        :cap="10"
      >
        <div class="scroll">
          <table>
            <tr>
              <th>Colour</th><th class="num">
                Level
              </th><th>Feeds</th>
            </tr>
            <tr
              v-for="p in items"
              :key="p.idx"
              :class="{ dim: !p.unlocked }"
            >
              <td>
                <b>{{ p.name }}</b>
                <span
                  v-if="!p.unlocked"
                  class="chip dead"
                >not unlocked</span>
              </td>
              <td class="num">
                {{ fmt(p.level) }}
              </td>
              <td class="note">
                {{ stripPh(p.stat) }}
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
    No <code>w5</code> entity on this snapshot yet.
  </p>

  <div id="mod_paletteLuck">
    <StatModule
      :stat="paletteLuckStat"
      title="Palette Luck"
      :icon="{ file: 'GamingPal', dir: 'data' }"
      blurb="The chance multiplier behind every colour's level-up and unlock rolls."
      :char-names="charNames"
      :series="series"
    />
  </div>
</template>
