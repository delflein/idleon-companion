<script setup>
/**
 * CauldronsPage — the cauldrons.html port. Legacy cauldrons.html is a KPI tile + cauldron P2W
 * ladders + liquid capacity cards ahead of a DELIBERATELY BESPOKE `liquidCap` breakdown
 * (docs/migration/survey-pages.md: "entities.w2.cauldronP2W[], entities.w2.liquids[]; stats.liquidCap
 * ... deliberately bespoke renderer — comment explains why generic module doesn't fit heterogeneous
 * units"). liquidCap's terms mix flat capacity UNITS (base/P2W/vial/arcade) with two real percents
 * (meal/rift) and one small flat fraction (bleach) — not a homogeneous 100-baseline percent pool
 * StatModule's bucketTerms() assumes — so this page renders liquidCap's terms directly via
 * StatTermRow (same expander/parts/drilldown row shape, just no eqMult "% of pool" framing), same
 * as the legacy hand-rolled table. No page-local formula math — all values come straight from
 * entities.w2.{cauldronP2W,liquids} and stats.liquidCap (src/core/domain.mjs / stats/liquid-cap.mjs).
 */
import { computed } from "vue";
import { entities, stats, useHistory } from "../data/appState.js";
import StatTermRow from "../ui/StatTermRow.vue";
import SpriteIcon from "../ui/SpriteIcon.vue";
import { fmt } from "../ui/fmt.js";

const w2 = computed(() => entities.value?.w2 ?? null);
const cauldronP2W = computed(() => w2.value?.cauldronP2W ?? []);
const liquids = computed(() => w2.value?.liquids ?? []);
const cap0 = computed(() => liquids.value[0] ?? null);

const liquidCapStat = computed(() => stats.value?.liquidCap ?? null);
const liquidCapResult = computed(() => liquidCapStat.value?.collapsed ?? null);
const unknownCount = computed(() => liquidCapResult.value?.terms.filter((t) => t.status === "unknown").length ?? 0);

function shownValue(t) {
  const isMul = t.kind === "mul";
  return isMul ? "×" + fmt(t.value) : (t.value >= 0 ? "+" : "") + fmt(t.value);
}
function displayOf(t) {
  return liquidCapStat.value?.display?.[t.id] ?? {};
}

const historyKeys = computed(() => {
  const st = liquidCapStat.value;
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
    <h1>Cauldron &amp; Liquids</h1>
  </header>
  <div
    id="err"
    class="err"
  />

  <template v-if="w2">
    <div class="cards">
      <div class="tile">
        <SpriteIcon
          file="Liquid1_x1"
          dir="data"
          :size="28"
        />
        <div class="label">
          Liquid cap (Water Droplets)
        </div>
        <div class="value">
          {{ cap0 ? (cap0.capacityLowerBound ? "≥ " : "") + fmt(cap0.capacity) : "—" }}
        </div>
        <div class="sub">
          see all 4 liquids below
        </div>
      </div>
    </div>

    <section class="panel">
      <h2>
        Cauldron &amp; Liquids
        <span class="hint">Pay-to-win upgrade ladders (gem-bought) for each cauldron and liquid, plus current liquid storage caps.</span>
      </h2>
      <h2 class="subhead">
        Cauldron P2W
      </h2>
      <div class="cardgrid4">
        <div
          v-for="c in cauldronP2W"
          :key="c.idx"
          class="p2wcard"
        >
          <h3>{{ c.name }} Cauldron</h3>
          <div class="levers">
            <div class="lever">
              <span class="lname">Brew speed</span>
              <div class="lbar">
                <div
                  class="lfill"
                  :style="{ width: (c.speed.max ? Math.max(0, Math.min(100, (c.speed.level / c.speed.max) * 100)) : 0) + '%' }"
                />
              </div>
              <span class="lval">Lv {{ c.speed.level }}<span
                v-if="c.speed.max"
                class="of"
              >/{{ c.speed.max }}</span> · +{{ fmt(c.speed.bonus) }}</span>
            </div>
            <div class="lever">
              <span class="lname">New-bubble odds</span>
              <div class="lbar">
                <div
                  class="lfill"
                  :style="{ width: (c.newBubble.max ? Math.max(0, Math.min(100, (c.newBubble.level / c.newBubble.max) * 100)) : 0) + '%' }"
                />
              </div>
              <span class="lval">Lv {{ c.newBubble.level }}<span
                v-if="c.newBubble.max"
                class="of"
              >/{{ c.newBubble.max }}</span> · +{{ fmt(c.newBubble.bonus) }}</span>
            </div>
            <div class="lever">
              <span class="lname">Lower brew-pt req</span>
              <div class="lbar">
                <div
                  class="lfill"
                  :style="{ width: (c.boostReq.max ? Math.max(0, Math.min(100, (c.boostReq.level / c.boostReq.max) * 100)) : 0) + '%' }"
                />
              </div>
              <span class="lval">Lv {{ c.boostReq.level }}<span
                v-if="c.boostReq.max"
                class="of"
              >/{{ c.boostReq.max }}</span> · +{{ fmt(c.boostReq.bonus) }}</span>
            </div>
          </div>
        </div>
      </div>

      <h2
        class="subhead"
        style="margin-top:6px"
      >
        Liquids <span
          class="tip"
          title="Liquids are the secondary currency spent (alongside materials) to level bubbles and vials. Running a liquid dry stalls upgrades in that tier band until it regenerates."
        >ⓘ</span>
      </h2>
      <div class="cards">
        <div
          v-for="l in liquids"
          :key="l.idx"
          class="tile"
        >
          <SpriteIcon
            :file="'Liquid' + (l.idx + 1) + '_x1'"
            dir="data"
            :size="28"
          />
          <div class="label">
            {{ l.name }}
          </div>
          <div class="value">
            {{ (l.capacityLowerBound ? "≥ " : "") + fmt(l.capacity) }}
          </div>
          <div class="sub">
            P2W: cap Lv {{ l.capP2wLevel }}/80 · regen Lv {{ l.regenP2wLevel }}/100
          </div>
        </div>
      </div>
      <p
        class="note"
        style="margin-top:8px"
      >
        Full capacity breakdown (Water Droplets — the other 3 liquids share the same chain with
        their own varying terms): <a href="#mod_liquidCap">see below ↓</a>
      </p>
    </section>
  </template>
  <p
    v-else
    class="note"
  >
    No <code>w2</code> entity on this snapshot yet.
  </p>

  <section
    v-if="liquidCapResult"
    id="mod_liquidCap"
    class="panel"
  >
    <h2>
      Liquid Capacity breakdown
      <span class="hint">Every source that raises max liquid storage, shown for Water Droplets — the "per-liquid" rows differ slightly for the other 3 liquids (click to expand).</span>
    </h2>
    <div
      v-if="liquidCapResult.lowerBound"
      class="lowerbound"
    >
      <b>Lower bound.</b> {{ unknownCount }} of {{ liquidCapResult.terms.length }} sources could not
      be derived from the save (runtime-only state) and sit at their neutral value — the real
      capacity is higher.
    </div>
    <div
      class="cards"
      style="margin-bottom:10px"
    >
      <div class="tile">
        <div class="label">
          Computed total
        </div>
        <div class="value">
          {{ (liquidCapResult.lowerBound ? "≥ " : "") + fmt(liquidCapResult.value) }}
        </div>
        <div class="sub">
          Water Droplets
        </div>
      </div>
    </div>
    <div class="scroll">
      <table>
        <tr>
          <th>Source</th><th class="num">
            Value
          </th><th>Status</th><th>History</th><th>How it works</th>
        </tr>
        <StatTermRow
          v-for="t in liquidCapResult.terms"
          :key="t.id"
          :label="displayOf(t).label || t.id"
          :where="displayOf(t).where || ''"
          :value="shownValue(t)"
          :status="t.status"
          :note="displayOf(t).how || t.note || ''"
          :parts="t.parts || []"
          :points="series[`stat.liquidCap.${t.id}`] || []"
        />
      </table>
    </div>
    <details
      v-if="unknownCount"
      class="fold"
      style="margin-top:6px"
    >
      <summary>{{ unknownCount }} source{{ unknownCount > 1 ? "s" : "" }} not derivable yet</summary>
      <ul class="unknowns">
        <li
          v-for="(u, i) in liquidCapResult.unknown"
          :key="i"
        >
          {{ u }}
        </li>
      </ul>
    </details>
  </section>
</template>

<style scoped>
/* Ported verbatim from cauldrons.html's own <style> block + companion.css's shared .levers rules —
 * not yet in src/styles/base.css (no other migrated page needed the 4-card P2W lever grid before
 * this one). */
.subhead { font-size: 13px; margin: 4px 0 8px; }
.cardgrid4 { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: var(--gap); margin-bottom: 12px; }
.p2wcard { border: 1px solid var(--border); border-radius: 10px; padding: 10px 12px; }
.p2wcard h3 { font-size: 12.5px; font-weight: 800; color: var(--accent); margin-bottom: 6px; }
.levers { display: grid; grid-template-columns: minmax(130px, auto) 1fr auto; gap: 8px 12px; align-items: center; }
.lever { display: contents; }
.lname { font-size: 13px; color: var(--ink-2); font-weight: 650; }
.lbar { height: 12px; border-radius: 6px; overflow: hidden; background: var(--track); border: 1px solid rgba(0, 0, 0, .4); min-width: 60px; }
.lfill { height: 100%; background: var(--series-1); border-radius: 0 5px 5px 0; }
.lval { text-align: right; font-variant-numeric: tabular-nums; font-size: 13px; font-weight: 800; }
.tip { cursor: help; color: var(--accent); font-weight: 700; border-bottom: 1px dotted var(--accent); }
</style>
