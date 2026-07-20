<script setup>
/**
 * PrinterPage — the printer.html port. Legacy printer.html is a KPI tile + one bespoke panel
 * (per-character printing/queued-samples show-more table, gem-shop slot-unlock reference table)
 * ahead of the generic `printerOutput` recipe module (docs/migration/survey-pages.md:
 * "entities.w3.printer (outputMulti, byChar[], slotUnlocks); GLOSS.printerSlotEffects (joined by
 * name string); stats.printerOutput"). `w3Glossary()` is pure/static (src/data/derived.js
 * re-exports it verbatim) — no save parsing, same payload every call.
 */
import { computed } from "vue";
import { state, entities, stats, useHistory } from "../data/appState.js";
import { w3Glossary } from "../data/derived.js";
import StatModule from "../ui/StatModule.vue";
import ShowMore from "../ui/ShowMore.vue";
import SpriteIcon from "../ui/SpriteIcon.vue";
import { fmt, niceItem } from "../ui/fmt.js";

const charNames = computed(() => state.value?.charNames ?? []);
const w3 = computed(() => entities.value?.w3 ?? null);
const printer = computed(() => w3.value?.printer ?? null);

const GLOSS = w3Glossary();
/* Both entities.w3.printer.slotUnlocks[].name (domain.mjs) and GLOSS.printerSlotEffects[].name
 * (stats/w3-report.mjs) are the same PRINTER_SLOT_UNLOCKS[].name with underscores/placeholder
 * chars cleaned to spaces — plain string equality is enough to join them, no id in common
 * (legacy printer.html's exact join strategy). */
function slotEffectOf(u) {
  const g = GLOSS.printerSlotEffects.find((e) => e.name === u.name);
  return g ? g.desc : "";
}

const printerOutputStat = computed(() => stats.value?.printerOutput ?? null);

const historyKeys = computed(() => {
  const st = printerOutputStat.value;
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
    <h1>Printer</h1>
  </header>
  <div
    id="err"
    class="err"
  />

  <template v-if="w3">
    <div class="cards">
      <div class="tile">
        <SpriteIcon
          file="ConTower0"
          dir="data"
          :size="28"
        />
        <div class="label">
          Printer output multi
        </div>
        <div class="value">
          {{ (printer.outputMultiLowerBound ? "≥ " : "") + "×" + fmt(printer.outputMulti) }}
        </div>
        <div class="sub">
          full breakdown below
        </div>
      </div>
    </div>

    <section class="panel">
      <h2>
        <SpriteIcon
          file="ConTower0"
          dir="data"
          :size="20"
        />
        Sample Printer
        <span class="hint">
          What each character is printing right now, and the account-wide output multiplier that
          scales every print.
          <span
            class="tip"
            title="The 3D Printer turns AFK samples of any resource into a slow trickle of that same resource, forever, on every character at once — the output multi below scales the trickle rate."
          >ⓘ</span>
        </span>
      </h2>
      <div
        v-if="printer.outputMultiLowerBound"
        class="lowerbound"
      >
        <b>Lower bound.</b> Some output-multi sources aren't derivable from the save yet — see the
        breakdown below. Real output is higher.
      </div>
      <!-- /10 and /2 are the gem-shop purchase caps (gamedata-w3-printer.mjs PRINTER_SLOT_UNLOCKS:
           base 4 + up to 6 MORE_SAMPLE_SPACES purchases = 10; base 1 + 1 CRYSTAL_3D_PRINTER = 2). -->
      <div
        class="cards"
        style="margin-bottom:10px"
      >
        <div class="tile">
          <SpriteIcon
            file="ConTower0"
            dir="data"
            :size="28"
          />
          <div class="label">
            Output multi
          </div>
          <div class="value">
            {{ (printer.outputMultiLowerBound ? "≥ " : "") + "×" + fmt(printer.outputMulti) }}
          </div>
          <div class="sub">
            <a href="#mod_printerOutput">full breakdown ↓</a>
          </div>
        </div>
        <div class="tile">
          <SpriteIcon
            file="PrintSlot"
            dir="data"
            :size="28"
          />
          <div class="label">
            Sample slots unlocked
          </div>
          <div class="value">
            {{ printer.sampleSlotsUnlocked }}<span class="of">/10</span>
          </div>
          <div class="sub">
            per character
          </div>
        </div>
        <div class="tile">
          <SpriteIcon
            file="PrintBG"
            dir="data"
            :size="28"
          />
          <div class="label">
            Chambers unlocked
          </div>
          <div class="value">
            {{ printer.chambersUnlocked }}<span class="of">/2</span>
          </div>
          <div class="sub">
            simultaneous prints per character
          </div>
        </div>
      </div>

      <h2 class="subhead">
        Per character
      </h2>
      <ShowMore
        v-slot="{ items }"
        :items="printer.byChar"
        :cap="12"
      >
        <div class="scroll">
          <table>
            <tr>
              <th>Character</th><th>Printing (chambers)</th><th>Extra samples (queued)</th>
            </tr>
            <tr
              v-for="c in items"
              :key="c.charIdx"
            >
              <td><b>{{ c.name || "char " + c.charIdx }}</b></td>
              <td>
                <div
                  v-if="c.printing.length"
                  class="itemlist"
                >
                  <span
                    v-for="(s, i) in c.printing"
                    :key="i"
                  ><b>{{ niceItem(s.item) }}</b> ×{{ fmt(s.qty) }}</span>
                </div>
                <span
                  v-else
                  class="note"
                >empty</span>
              </td>
              <td>
                <div
                  v-if="c.extraSamples.length"
                  class="itemlist"
                >
                  <span
                    v-for="(s, i) in c.extraSamples"
                    :key="i"
                  ><b>{{ niceItem(s.item) }}</b> ×{{ fmt(s.qty) }}</span>
                </div>
                <span
                  v-else
                  class="note"
                >none</span>
              </td>
            </tr>
          </table>
        </div>
      </ShowMore>

      <template v-if="printer.slotUnlocks.length">
        <h2
          class="subhead"
          style="margin-top:14px"
        >
          Gem-shop slot unlocks
        </h2>
        <div class="scroll">
          <table>
            <tr>
              <th>Unlock</th><th>Effect</th><th>Grants</th>
            </tr>
            <tr
              v-for="u in printer.slotUnlocks"
              :key="u.name"
            >
              <td><b>{{ u.name }}</b></td>
              <td class="note">
                {{ slotEffectOf(u) }}
              </td>
              <td class="note">
                grants {{ niceItem(u.grants) }}
              </td>
            </tr>
          </table>
        </div>
      </template>
    </section>
  </template>
  <p
    v-else
    class="note"
  >
    No <code>w3</code> entity on this snapshot yet.
  </p>

  <StatModule
    id="mod_printerOutput"
    :stat="printerOutputStat"
    title="Printer Output Multi"
    :icon="{ file: 'ConTower0', dir: 'data' }"
    blurb="Every multiplier on top of the base printing rate — Gold Relic days, Divine Knight, Skill Mastery, Ballot, event shop, Companion, Compass."
    :char-names="charNames"
    :series="series"
  />
</template>

<style scoped>
/* printer.html-specific (companion.css inline block) — page-unique, not promoted to
 * src/styles/base.css since no other src/ui/** component needs it yet. */
.subhead { font-size: 13px; margin: 4px 0 8px; }
.tip { cursor: help; color: var(--accent); font-weight: 700; border-bottom: 1px dotted var(--accent); }
.itemlist { display: flex; flex-direction: column; gap: 2px; }
.itemlist span { font-size: 12.5px; }
</style>
