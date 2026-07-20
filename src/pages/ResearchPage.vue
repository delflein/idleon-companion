<script setup>
/**
 * ResearchPage — the research.html port. Legacy research.html is a 4-tile KPI strip + an
 * occurrence-slot bar chart + a sortable node table + a tools reference grid, no recipe module
 * (docs/migration/survey-pages.md: "entities.w7.research (nodesPlaced, decodedNodes,
 * observations, occurrences[10], nodes[]); GLOSS.farmingStickers/researchTools").
 *
 * TWO SURVEY FLAGS RESOLVED for this page:
 *
 * 1. DEAD FETCH — legacy `boot()` fetches `/api/stats` into `DATA` but never reads it anywhere in
 *    the file (confirmed by inspection: no `DATA.` reference outside the assignment). Dropped
 *    here; this page has no registered recipe module to feed from `stats` anyway.
 *
 * 2. DATA-HYGIENE (not a formula gap) — legacy hardcoded its own `OCC_PCT = [25,15,50,...]` array,
 *    a byte-identical duplicate of `src/core/bonuses/research.mjs`'s exported
 *    `RES_OCCURRENCE_PCT` (which the save-derived `entities.w7.research.nodes[].occurrencePct`
 *    field is already computed FROM). Fixed by importing the real export instead of
 *    re-declaring it — one source of truth, no drift risk if the coefficient table ever changes.
 *
 * MODERNIZATION (stated deviation, no functionality dropped): legacy's node table used a 3-way
 * `<select>` goal-selector (level / impact / occurrence) with a cap-10-show-more. Per
 * docs/PANELS.md, this is now one DataTable with click-to-sort on Level/Bonus/Occurrence
 * (impact = the Bonus column), fully scrollable, no arbitrary cap.
 */
import { computed } from "vue";
import { entities } from "../data/appState.js";
import { w7Glossary } from "../data/derived.js";
import { RES_OCCURRENCE_PCT } from "../core/bonuses/research.mjs";
import DataTable from "../ui/DataTable.vue";
import SpriteIcon from "../ui/SpriteIcon.vue";
import { fmt } from "../ui/fmt.js";

const w7 = computed(() => entities.value?.w7 ?? null);
const research = computed(() => w7.value?.research ?? null);

const GLOSS = w7Glossary();

const decodedPct = computed(() => {
  const r = research.value;
  return r?.nodesPlaced ? Math.round((100 * r.decodedNodes) / r.nodesPlaced) : 0;
});
const occActive = computed(() => (research.value?.occurrences ?? []).filter((x) => x > 0).length);
const occMax = computed(() => Math.max(1, ...(research.value?.occurrences ?? [0])));

const nodeColumns = [
  { key: "node", label: "Node", get: (n) => (n.decoded ? 1 : 0) },
  { key: "level", label: "Level", get: (n) => n.level, numeric: true },
  { key: "bonus", label: "Bonus", get: (n) => (n.bonus != null ? n.bonus : -1), numeric: true },
  { key: "occurrence", label: "Occurrence", get: (n) => n.occurrencePct ?? 0, numeric: true },
];

const UNDECODED_TOOLTIP = "This grid square's identity is assigned at runtime by the game client, not stored as a static table in N.js — the companion honestly can't name it without a confirmed reference.";
const NODE_TABLE_TOOLTIP = "Confirmed via N.js: Ya.ResGridSquares() is a 240-row PLACEHOLDER literal (every row byte-identical). Real per-node names/effects are assigned into CustomLists.h.ResGridSquares at runtime — not resolvable by reading the client file. Only nodes independently cross-checked against real save/UI text are decoded.";
const OCC_TOOLTIP = "Occurrence tag is assigned per-node at runtime, same as node identity — this counts what's on the grid right now, it isn't a shopping list.";
</script>

<template>
  <header class="app">
    <h1>Research Grid</h1>
  </header>
  <div
    id="err"
    class="err"
  />

  <template v-if="research">
    <div class="cards">
      <div class="tile">
        <SpriteIcon
          file="ResearchBG"
          dir="data"
          :size="28"
        />
        <div class="label">
          Nodes with a level placed
        </div>
        <div class="value">
          {{ fmt(research.nodesPlaced) }}
        </div>
        <div class="sub">
          out of ~240 grid squares
        </div>
      </div>
      <div class="tile">
        <div class="label">
          Decoded identity
        </div>
        <div class="value">
          {{ research.decodedNodes }}<span class="of">/{{ research.nodesPlaced }}</span>
        </div>
        <div class="sub">
          {{ decodedPct }}% of placed nodes have a confirmed effect
        </div>
      </div>
      <div class="tile">
        <div class="label">
          Observations collected
        </div>
        <div class="value">
          {{ fmt(research.observations) }}
        </div>
        <div class="sub">
          count of instances owned, not "of 32" — the 32-name pool allows duplicates; see
          reference below
        </div>
      </div>
      <div class="tile">
        <div class="label">
          Occurrence slots active
        </div>
        <div class="value">
          {{ occActive }}<span class="of">/10</span>
        </div>
        <div class="sub">
          tag types present on placed nodes
        </div>
      </div>
    </div>

    <section class="panel">
      <h2>
        Occurrence Slots
        <span class="hint">
          Every grid node can carry one of 10 "occurrence" tags — how many PLACED nodes carry each
          tag, and the % bonus that tag grants those nodes.
          <span
            class="tip"
            :title="OCC_TOOLTIP"
          >ⓘ</span>
        </span>
      </h2>
      <div
        v-for="(n, i) in research.occurrences"
        :key="i"
        class="occrow"
      >
        <span class="pct">+{{ RES_OCCURRENCE_PCT[i] }}%</span>
        <div class="bar">
          <i :style="{ width: Math.round((100 * n) / occMax) + '%' }" />
        </div>
        <span class="n">{{ n }} node{{ n === 1 ? "" : "s" }}</span>
      </div>
    </section>

    <section class="panel">
      <h2>
        <SpriteIcon
          file="ResearchBG"
          dir="data"
          :size="20"
        />
        Grid Nodes
        <span class="hint">
          Every node you've put a level into. Node identity is assigned by the game client at
          runtime — there's no static "node → effect" table in N.js to read, so most nodes are
          honestly labeled "undecoded" rather than guessed.
          <span
            class="tip"
            :title="NODE_TABLE_TOOLTIP"
          >ⓘ</span>
        </span>
      </h2>
      <p class="note">
        Click a column header to sort — display order only, not a recommendation of what to level
        next.
      </p>
      <DataTable
        :columns="nodeColumns"
        :rows="research.nodes"
        row-key="slot"
        :initial-sort="{ col: 'level', dir: -1 }"
      >
        <template #cell-node="{ row }">
          <b>{{ row.decoded ? row.effectName : `node #${row.slot}` }}</b>
          <span
            v-if="!row.decoded"
            class="tip"
            :title="UNDECODED_TOOLTIP"
          > <span class="chip">undecoded</span></span>
        </template>
        <template #cell-level="{ row }">
          Lv {{ fmt(row.level) }}
        </template>
        <template #cell-bonus="{ row }">
          {{ row.bonus != null ? "+" + fmt(row.bonus) + "%" : "—" }}
        </template>
        <template #cell-occurrence="{ row }">
          {{ row.occurrence != null ? "+" + row.occurrencePct + "%" : "—" }}
        </template>
      </DataTable>
      <div
        class="gapbox"
        style="margin-top:12px"
      >
        <h3>Farming stickers unlocked via this grid</h3>
        <p>
          <template
            v-for="(s, i) in GLOSS.farmingStickers"
            :key="i"
          >
            <b>{{ s.name }}</b> ({{ s.kind === "mul" ? "×" + s.coeff : "+" + s.coeff + "%" }}) — {{ s.desc }}<br v-if="i < GLOSS.farmingStickers.length - 1">
          </template>
          <template v-if="!GLOSS.farmingStickers.length">
            no glossary data
          </template>
        </p>
      </div>
    </section>

    <section
      v-if="GLOSS.researchTools"
      class="panel"
    >
      <h2 class="subhead">
        Grid tools
        <span class="hint">Shapes (placed on the grid to boost highlighted nodes) and Lenses (placed on Observations) — reference only, no owned/equipped state in the save.</span>
      </h2>
      <div
        class="toolgrid"
        style="margin-bottom:10px"
      >
        <div
          v-for="(s, i) in GLOSS.researchTools.shapes"
          :key="i"
          class="toolcard"
        >
          <b>{{ s.name }}</b>{{ s.effect }}
        </div>
      </div>
      <div class="toolgrid">
        <div
          v-for="(l, i) in GLOSS.researchTools.lenses"
          :key="i"
          class="toolcard"
        >
          <b>{{ l.name }}</b>{{ l.desc }}
        </div>
      </div>
    </section>
  </template>
  <p
    v-else
    class="note"
  >
    No <code>w7</code> entity on this snapshot yet.
  </p>
</template>

<style scoped>
.tip { cursor: help; color: var(--accent); font-weight: 700; border-bottom: 1px dotted var(--accent); }
.subhead { font-size: 13px; margin: 4px 0 8px; }
.gapbox { border: 1px dashed var(--border); border-radius: 10px; padding: 12px 14px; color: var(--ink-2); font-size: 12.5px; }
.gapbox h3 { font-size: 13px; color: var(--ink-1); margin-bottom: 6px; }
.occrow { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
.occrow .bar { flex: 1; height: 8px; border-radius: 4px; background: var(--well); overflow: hidden; }
.occrow .bar > i { display: block; height: 100%; background: var(--accent); }
.occrow .n { width: 90px; font-size: 11.5px; color: var(--ink-2); text-align: right; }
.occrow .pct { width: 40px; font-size: 11.5px; color: var(--ink-muted); text-align: right; }
.toolgrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 8px; }
.toolcard { border: 1px solid var(--border); border-radius: 8px; padding: 8px 10px; font-size: 11.5px; color: var(--ink-2); }
.toolcard b { display: block; color: var(--ink-1); font-size: 12px; margin-bottom: 2px; }
</style>
