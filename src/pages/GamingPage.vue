<script setup>
/**
 * GamingPage — the gaming.html port. Legacy gaming.html: a KPI tile, a "Bits & Garden" panel
 * (bits/snail/rat-king/sprout-capacity tiles, fertilizer/import level tables, the 72-slot Superbit
 * hex-grid checklist), then the `gamingBits` recipe module (docs/migration/survey-pages.md:
 * "entities.w5.gaming (superbits); stats.gamingBits... generic recipe-module renderer (extraHeader
 * variant)").
 *
 * FLAGGED page-local domain logic (survey-pages.md #4): the superbit hex-grid ADJACENCY purchase
 * gate (`sbState`) is real game-rule logic absent from domain.mjs/bonuses/gaming.mjs (they only
 * expose the raw owned flag) — ported to src/core/gaming-page.mjs with an N.js:17012 citation
 * confirmed this session, per PANELS.md's "flagged domain logic ported to src/core/ BEFORE the
 * page port" rule.
 */
import { computed } from "vue";
import { state, entities, stats, useHistory } from "../data/appState.js";
import { sbState } from "../core/gaming-page.mjs";
import StatModule from "../ui/StatModule.vue";
import SpriteIcon from "../ui/SpriteIcon.vue";
import { fmt } from "../ui/fmt.js";

const charNames = computed(() => state.value?.charNames ?? []);
const w5 = computed(() => entities.value?.w5 ?? null);
const gaming = computed(() => w5.value?.gaming ?? null);

const unknownList = computed(() => (gaming.value?.superbits.list ?? []).filter((b) => b.owned === null));

const gamingBitsStat = computed(() => stats.value?.gamingBits ?? null);

const historyKeys = computed(() => {
  const st = gamingBitsStat.value;
  if (!st) return [];
  const keys = [`stat.${st.name}`];
  for (const t of st.collapsed.terms) if (t.status !== "unknown") keys.push(`stat.${st.name}.${t.id}`);
  return keys;
});
// See MiningPage.vue's NOTE on useHistory(keys) not being reactive to `keys` changing later.
const { series } = useHistory(historyKeys.value);

/* 3 pages of a 6-wide x 4-row grid (24 slots/page). */
const superbitPages = computed(() => {
  const list = gaming.value?.superbits.list ?? [];
  return [0, 1, 2].map((page) => ({
    page,
    cells: Array.from({ length: 24 }, (_, f) => {
      const idx = page * 24 + f;
      return { idx, b: list[idx], state: sbState(list, idx) };
    }),
  }));
});

function cellLabel(state) {
  return state === "owned" ? "✓" : state === "unknown" ? "?" : "";
}
</script>

<template>
  <header class="app">
    <h1>Gaming — Bits &amp; Garden</h1>
  </header>
  <div
    id="err"
    class="err"
  />

  <template v-if="gaming">
    <div class="cards">
      <div class="tile">
        <SpriteIcon
          file="Gaming"
          dir="afk_targets"
          :size="28"
        />
        <div class="label">
          Bits multiplier
        </div>
        <div class="value">
          {{ (gaming.bitsMultiLowerBound ? "≥ " : "") + "×" + fmt(gaming.bitsMulti) }}
        </div>
        <div class="sub">
          {{ gaming.superbits.owned }}/{{ gaming.superbits.total }} superbits
        </div>
      </div>
    </div>

    <section class="panel">
      <h2>
        <SpriteIcon
          file="Gaming"
          dir="afk_targets"
          :size="20"
        />
        Bits &amp; Garden
        <span class="hint">
          The Gaming skill's sprout garden — fertilizer/import upgrades, the 72-bit Superbit
          hex-tree, and the Immortal Snail.
          <span
            class="tip"
            title="Sprouts grow on a timer and are collected for Bits, spent on Superbits/Fertilizer/Imports. This page shows LEVELS and OWNERSHIP only — no grow timers."
          >ⓘ</span>
        </span>
      </h2>
      <div
        class="cards"
        style="margin-bottom:10px"
      >
        <div class="tile">
          <SpriteIcon
            file="Bits_x1"
            dir="data"
            :size="28"
          />
          <div class="label">
            Bits on hand
          </div>
          <div class="value">
            {{ fmt(gaming.bits) }}
          </div>
          <div class="sub">
            spent on Fertilizer/Imports/Superbits
          </div>
        </div>
        <div class="tile">
          <SpriteIcon
            file="Gaming"
            dir="afk_targets"
            :size="28"
          />
          <div class="label">
            Bits multiplier
          </div>
          <div class="value">
            {{ (gaming.bitsMultiLowerBound ? "≥ " : "") + "×" + fmt(gaming.bitsMulti) }}
          </div>
          <div class="sub">
            <a href="#mod_gamingBits">full breakdown ↓</a>
          </div>
        </div>
        <div class="tile">
          <SpriteIcon
            file="SnailMail"
            dir="data"
            :size="28"
          />
          <div class="label">
            Immortal Snail
          </div>
          <div class="value">
            Lv {{ fmt(gaming.snail.level) }}<span class="of">/{{ fmt(gaming.snail.maxLevel) }}</span>
          </div>
          <div class="sub">
            {{ fmt(gaming.snail.encouragement) }} encouragement
          </div>
        </div>
        <div class="tile">
          <SpriteIcon
            file="GamingRatCrown"
            dir="data"
            :size="28"
          />
          <div class="label">
            Rat King tokens
          </div>
          <div class="value">
            {{ fmt(gaming.ratKing.tokens) }}
          </div>
          <div class="sub">
            shop lv {{ gaming.ratKing.shopLevels.join("/") }}
          </div>
        </div>
        <div class="tile">
          <div class="label">
            Sprout capacity
          </div>
          <div class="value">
            {{ fmt(gaming.sprouts.capacity) }}
          </div>
          <div class="sub">
            {{ gaming.mutations.count }} mutant plots ({{ fmt(gaming.mutations.dna) }} DNA)
          </div>
        </div>
      </div>
      <div class="caveat">
        The snail's Encouragement value is a daily mail-spend choice with a real risk/reward
        curve — this page shows the current level and encouragement stat only. Use the in-game
        odds display before spending mail; this page gives no reset/respec advice.
      </div>

      <h2 class="subhead">
        Fertilizer
      </h2>
      <div class="scroll">
        <table>
          <tr>
            <th>Upgrade</th><th class="num">
              Level
            </th>
          </tr>
          <tr
            v-for="f in gaming.fertilizer"
            :key="f.idx"
          >
            <td><b>{{ f.name }}</b></td>
            <td class="num">
              Lv {{ fmt(f.level) }}
            </td>
          </tr>
        </table>
      </div>

      <h2
        class="subhead"
        style="margin-top:14px"
      >
        Imports
      </h2>
      <div class="scroll">
        <table>
          <tr>
            <th>Tool</th><th class="num">
              Level
            </th>
          </tr>
          <tr
            v-for="i in gaming.imports"
            :key="i.idx"
          >
            <td><b>{{ i.name }}</b></td>
            <td class="num">
              Lv {{ fmt(i.level) }}
            </td>
          </tr>
        </table>
      </div>

      <h2
        class="subhead"
        style="margin-top:14px"
      >
        Superbits <span class="of">{{ gaming.superbits.owned }}/{{ gaming.superbits.total }} owned</span>
        <span
          class="tip"
          :title="`72 upgrades across 3 pages of a 6x4 hex grid. A tile is buyable once an adjacent tile (directly above, or left/right in the same row) is already owned, or it's the page's root tile (top-left). Cost is paid in Bits. ${unknownList.length} ids (≥53) can't be read from the save at all — the game's ownership-flag string only encodes the first 53 ids.`"
        >ⓘ</span>
      </h2>
      <div class="sblegend">
        <span><i style="background:rgba(12,163,12,.4)" />owned</span>
        <span><i style="background:rgba(57,135,229,.4)" />available now (adjacent owned)</span>
        <span><i style="background:var(--well);opacity:.6" />locked (no adjacent owner yet)</span>
        <span><i style="background:var(--well);opacity:.3;border:1px dashed var(--ink-muted)" />unknown (id ≥ 53)</span>
      </div>
      <div class="sbpages">
        <div
          v-for="p in superbitPages"
          :key="p.page"
          class="sbpage"
        >
          <h4>
            Page {{ p.page + 1 }} <span class="note">(ids {{ p.page * 24 }}-{{ p.page * 24 + 23 }})</span>
          </h4>
          <div class="sbgrid">
            <div
              v-for="cell in p.cells"
              :key="cell.idx"
              class="sbcell"
              :class="cell.state"
              :title="`${cell.b?.name ?? 'idx ' + cell.idx} (#${cell.idx}) — ${cell.state === 'unknown' ? 'ownership unrecoverable (id ≥ 53)' : cell.state}`"
            >
              {{ cellLabel(cell.state) }}
            </div>
          </div>
        </div>
      </div>
      <details
        v-if="unknownList.length"
        class="fold"
        style="margin-top:6px"
      >
        <summary>{{ unknownList.length }} superbits with unrecoverable ownership (ids ≥ 53)</summary>
        <ul class="unknowns">
          <li
            v-for="b in unknownList"
            :key="b.idx"
          >
            <b>#{{ b.idx }} {{ b.name }}</b>
          </li>
        </ul>
      </details>
    </section>
  </template>
  <p
    v-else
    class="note"
  >
    No <code>w5</code> entity on this snapshot yet.
  </p>

  <div id="mod_gamingBits">
    <StatModule
      :stat="gamingBitsStat"
      title="Bits Multiplier (Sprout Value)"
      :icon="{ file: 'Gaming', dir: 'afk_targets' }"
      blurb="The per-sprout-collection value multiplier — snail, meals, palette, cards, achievements, and more."
      :char-names="charNames"
      :series="series"
    />
  </div>
</template>
