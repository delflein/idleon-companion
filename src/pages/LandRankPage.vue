<script setup>
/**
 * LandRankPage — the landrank.html port: a client-side greedy point-allocation optimizer for the
 * Land Rank Database. The genuine domain logic (bonusOf / groupValue / refRankOf / objective /
 * optimize — a weighted-log-scored, no-hand-tuned-ratios, caps-modeled hill-climb) is ported into
 * src/core/landrank-optimizer.mjs (framework-free, testable, N.js-cited provenance); this component
 * is only the bespoke "board" UI, weight sliders, goal presets, respec modes and before/after tiles.
 *
 * Data source: `farming.value.markets` (appState.js computed over the same /api/farming report the
 * legacy page fetched) — no fetch(). Null before a save loads → a loading state. The per-rank
 * "own-rank" rule and the two documented properties of the optimizer are preserved in the core
 * module; see its header.
 */
import { computed, ref, watch } from "vue";
import { state, farming } from "../data/appState.js";
import { fmt } from "../ui/fmt.js";
import { GROUPS, SEED_IDS, PRESETS, bonusOf, groupValue, refRankOf, optimize } from "../core/landrank-optimizer.mjs";
import SpriteIcon from "../ui/SpriteIcon.vue";

/* ---- persisted UI state (localStorage-safe) ---- */
const LS = {
  get(k, d) { try { return localStorage.getItem(k) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* no-op */ } },
};
const preset = ref(LS.get("lrPreset", "evo"));
const mode = ref(LS.get("lrMode", "respec")); // "respec" | "addonly"
const maxSeeds = ref(LS.get("lrSeeds", "1") !== "0");
const selected = ref(null); // selected upgrade idx for the detail bar
/** Live weight vector — seeded from the preset, mutated by the sliders (which flip preset→custom). */
const weights = ref({ ...(PRESETS[preset.value]?.w ?? PRESETS.evo.w) });

watch(preset, (v) => LS.set("lrPreset", v));
watch(mode, (v) => LS.set("lrMode", v));
watch(maxSeeds, (v) => LS.set("lrSeeds", v ? "1" : "0"));

function onPreset(v) {
  preset.value = v;
  if (PRESETS[v]?.w) weights.value = { ...PRESETS[v].w };
}
function onWeight(g, val) {
  weights.value = { ...weights.value, [g]: Number(val) };
  preset.value = "custom"; // hand-tuning drops out of any named preset
}

/* ---- model (everything the optimizer needs, straight off report.markets) ---- */
const model = computed(() => {
  const mk = farming.value?.markets;
  if (!mk?.rankDb) return null;
  return { rankDb: mk.rankDb, calc: mk.rankCalcCtx, plotRanks: mk.plotRanks ?? [], rankPtsTotal: mk.rankPtsTotal };
});
const syncedLabel = computed(() => (state.value?.ts ? new Date(state.value.ts).toLocaleString() : ""));
const nice = (s) => String(s ?? "").replaceAll("_", " ");

/* ---- optimizer result (recomputes on weights/mode/seed change) ---- */
const result = computed(() => (model.value ? optimize(model.value, { weights: weights.value, mode: mode.value, maxSeeds: maxSeeds.value }) : null));

const unspentCurrent = computed(() => {
  const m = model.value;
  return m ? m.rankPtsTotal - m.rankDb.reduce((t, u) => t + u.level, 0) : 0;
});

/* ---- before/after per group ---- */
const groupsView = computed(() => {
  const m = model.value;
  const res = result.value;
  if (!m || !res) return [];
  const curLevels = m.rankDb.map((u) => u.level);
  return Object.keys(GROUPS).map((g) => {
    const before = groupValue(m, g, curLevels, refRankOf(m, g));
    const after = groupValue(m, g, res.levels, refRankOf(m, g));
    return { g, label: GROUPS[g].label, before, after, ratio: after / before };
  });
});
const pointsUsed = computed(() => (model.value && result.value ? model.value.rankPtsTotal - result.value.unspent : 0));

/* ---- board slots ---- */
const boardSlots = computed(() => {
  const m = model.value;
  const res = result.value;
  if (!m || !res) return [];
  return m.rankDb.map((u, i) => ({ i, name: u.name, level: u.level, rec: res.levels[i], d: res.levels[i] - u.level, seedcol: i % 5 === 4 }));
});

/* ---- detail bar for the selected orb ---- */
const detail = computed(() => {
  const m = model.value;
  const res = result.value;
  if (selected.value == null || !m || !res) return null;
  const i = selected.value;
  const u = m.rankDb[i];
  const rec = res.levels[i];
  const isSeed = SEED_IDS.includes(i);
  return {
    i, name: u.name, desc: u.desc, level: u.level, rec, delta: rec - u.level, isSeed,
    bonusNow: bonusOf(m, i, u.level), bonusRec: bonusOf(m, i, rec),
    seedMax: isSeed ? m.calc.fifthColMax : null, pctSuffix: isSeed ? "" : "%",
  };
});

/* ---- crop-value cap warning ---- */
const valueCapped = computed(() => {
  const gv = groupsView.value.find((x) => x.g === "value");
  return gv && model.value && gv.after >= model.value.calc.value.cap;
});

/* ---- full before/after table rows ---- */
const tableRows = computed(() => {
  const m = model.value;
  const res = result.value;
  if (!m || !res) return [];
  return m.rankDb.map((u, i) => ({
    i, name: u.name, desc: u.desc, level: u.level, rec: res.levels[i], d: res.levels[i] - u.level,
    bonusRec: bonusOf(m, i, res.levels[i]), pctSuffix: i % 5 === 4 ? "" : "%",
  }));
});

const PRESET_OPTIONS = Object.entries(PRESETS).map(([k, p]) => ({ k, label: p.label }));
const GROUP_ENTRIES = Object.entries(GROUPS).map(([g, def]) => ({ g, label: def.label }));
</script>

<template>
  <div class="page">
    <header class="app">
      <h1>
        <SpriteIcon
          file="FarmCrop46"
          dir="data"
          :size="26"
        />
        Land Rank Calculator
      </h1>
      <span class="meta">{{ syncedLabel ? "synced " + syncedLabel : "" }}</span>
    </header>

    <div
      id="err"
      class="err"
    />

    <template v-if="model">
      <!-- ===== goal / weights setup ===== -->
      <section class="panel">
        <h2>
          Goal <span class="hint">no hidden ratios — every point goes where it buys the most weighted gain; caps are modeled, so dead points show up as dead</span>
        </h2>
        <div class="controls">
          <label>preset
            <select
              class="inlinesel"
              :value="preset"
              @change="onPreset($event.target.value)"
            >
              <option
                v-for="o in PRESET_OPTIONS"
                :key="o.k"
                :value="o.k"
              >{{ o.label }}</option>
            </select></label>
          <label><input
            v-model="mode"
            type="radio"
            value="respec"
          > full respec ({{ model.rankPtsTotal }} pts)</label>
          <label><input
            v-model="mode"
            type="radio"
            value="addonly"
          > only place unspent ({{ unspentCurrent }} pts)</label>
          <label><input
            v-model="maxSeeds"
            type="checkbox"
          > max "Seed of …" stat rows first</label>
        </div>
        <div class="weights">
          <label
            v-for="ge in GROUP_ENTRIES"
            :key="ge.g"
          >{{ ge.label }}<output>{{ weights[ge.g] }}</output>
            <input
              type="range"
              min="0"
              max="10"
              step="1"
              :value="weights[ge.g]"
              @input="onWeight(ge.g, $event.target.value)"
            ></label>
        </div>
      </section>

      <!-- ===== before/after group tiles ===== -->
      <div class="cards">
        <div
          v-for="x in groupsView"
          :key="x.g"
          class="tile"
        >
          <div class="label">
            {{ x.label }}
          </div>
          <div class="value">
            <span
              v-if="x.ratio > 1.0005"
              class="delta-up"
            >×{{ x.ratio.toFixed(2) }}</span>
            <span
              v-else-if="x.ratio < 0.9995"
              class="delta-dn"
            >×{{ x.ratio.toFixed(2) }}</span>
            <span v-else>=</span>
          </div>
          <div class="sub">
            {{ fmt(x.before) }}{{ x.g === "value" ? "" : "×" }} → {{ fmt(x.after) }}{{ x.g === "value" ? "" : "×" }}
          </div>
        </div>
        <div class="tile">
          <div class="label">
            Points
          </div>
          <div class="value">
            {{ pointsUsed }}<span class="of">/{{ model.rankPtsTotal }}</span>
          </div>
          <div class="sub">
            {{ result.unspent ? result.unspent + " unplaceable (caps)" : mode === "respec" ? "full respec" : "unspent placed" }}
          </div>
        </div>
      </div>

      <!-- ===== the board ===== -->
      <section class="panel">
        <div class="lrboard">
          <h3>Land Rank Database</h3>
          <div class="lrgrid">
            <div
              v-for="s in boardSlots"
              :key="s.i"
              class="lrslot"
              :class="{ seedcol: s.seedcol, sel: selected === s.i }"
              :title="nice(s.name)"
              @click="selected = s.i"
            >
              <span
                v-if="s.d !== 0"
                class="badge"
                :class="s.d > 0 ? 'delta-up' : 'delta-dn'"
              >{{ s.d > 0 ? "+" : "" }}{{ s.d }}</span>
              <div class="orb">
                {{ s.rec }}<span class="now"><template v-if="s.d !== 0">now {{ s.level }}</template><template v-else>&nbsp;</template></span>
              </div>
              <div class="lv">
                lv {{ s.rec }}
              </div>
            </div>
          </div>
          <div class="lrdetail">
            <template v-if="detail">
              <b>{{ nice(detail.name) }}</b> — lv {{ detail.level }} → <b>{{ detail.rec }}</b>
              <template v-if="detail.rec !== detail.level">
                (<span :class="detail.rec > detail.level ? 'delta-up' : 'delta-dn'">{{ detail.rec > detail.level ? "+" : "" }}{{ detail.rec - detail.level }}</span>)
              </template>
              · bonus {{ fmt(detail.bonusNow) }}{{ detail.pctSuffix }} → <b>{{ fmt(detail.bonusRec) }}{{ detail.pctSuffix }}</b>
              <div class="why">
                {{ nice(detail.desc) }}<template v-if="detail.isSeed">
                  · max lv {{ detail.seedMax }}
                </template>
              </div>
            </template>
            <template v-else>
              — select a bonus —
            </template>
          </div>
        </div>

        <div v-if="valueCapped">
          <div class="capnote">
            Crop value sits at its {{ fmt(model.calc.value.cap) }}× cap — further Production points are DEAD
            (raise the cap with Stalk Value exotics first).
          </div>
        </div>

        <details class="fold">
          <summary>full table (before / after)</summary>
          <div class="scroll">
            <table>
              <tr>
                <th>Upgrade</th><th class="num">
                  Now
                </th><th class="num">
                  Recommended
                </th><th class="num">
                  Δ
                </th><th class="num">
                  Bonus at rec.
                </th><th class="note">
                  Effect
                </th>
              </tr>
              <tr
                v-for="u in tableRows"
                :key="u.i"
                :class="{ dim: u.rec === 0 && u.level === 0 }"
              >
                <td><b>{{ nice(u.name) }}</b></td>
                <td class="num">
                  {{ u.level }}
                </td>
                <td class="num">
                  <b>{{ u.rec }}</b>
                </td>
                <td class="num">
                  <span
                    v-if="u.d > 0"
                    class="delta-up"
                  >+{{ u.d }}</span>
                  <span
                    v-else-if="u.d < 0"
                    class="delta-dn"
                  >{{ u.d }}</span>
                  <span v-else>·</span>
                </td>
                <td class="num">
                  {{ fmt(u.bonusRec) }}{{ u.pctSuffix }}
                </td>
                <td class="note">
                  {{ nice(u.desc) }}
                </td>
              </tr>
            </table>
          </div>
        </details>

        <div class="legend">
          Client formulas (hyperbolic 1.7·base·L/(L+80); Seed rows linear; all ×{{ model.calc.multi.toFixed(2) }} Dank
          Ranks + Plump Database). Per-rank rows use each plot's OWN rank (evolution uses your medal plot's rank
          {{ model.calc.medalPlotRank ?? "—" }}). Rank XP chains off the PREVIOUS plot — rank plots in order. A
          Rank-Exp-heavy build grows points faster; respec into the payoff build when needed (one respec banks
          per weekly reset).
        </div>
      </section>
    </template>

    <section
      v-else
      class="panel"
    >
      <h2>Goal</h2>
      <div class="why">
        No farming report — sync a save first.
      </div>
    </section>
  </div>
</template>

<style scoped>
.meta { color: var(--ink-muted); font-size: 12px; margin-left: auto; }
header.app { display: flex; align-items: baseline; gap: 10px; }
header.app h1 { display: flex; align-items: center; gap: 8px; }

.why { color: var(--ink-muted); font-size: 11px; }
.legend { color: var(--ink-muted); font-size: 11.5px; margin-top: 6px; }
.capnote { color: var(--warning); font-size: 11.5px; font-weight: 650; margin: 6px 0; }
.delta-up { color: #6fdd6f; font-weight: 800; }
.delta-dn { color: #f0a63f; font-weight: 800; }

.controls { display: flex; gap: 16px; align-items: center; flex-wrap: wrap; margin-bottom: 6px; }
.controls label { font-size: 12.5px; color: var(--ink-2); display: flex; gap: 6px; align-items: center; }
.weights { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 10px 18px; margin: 8px 0; }
.weights label { display: block; font-size: 12px; font-weight: 650; color: var(--ink-muted); }
.weights output { color: var(--accent); font-weight: 800; margin-left: 6px; }
.weights input[type=range] { width: 100%; }

/* ---- the in-game-styled board ---- */
.lrboard {
  background: linear-gradient(180deg, #4a2e1b, #38220f);
  border: 3px solid #6b4a2f; border-radius: 18px;
  box-shadow: inset 0 2px 0 rgba(255,255,255,.08), inset 0 -3px 8px rgba(0,0,0,.4);
  padding: 18px 16px 12px; max-width: 620px; margin: 10px auto;
}
.lrboard h3 {
  text-align: center; color: #f4d789; font-weight: 800; letter-spacing: .5px;
  text-shadow: 0 2px 0 rgba(0,0,0,.5); margin: 0 0 12px; font-size: 17px;
}
.lrgrid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px 8px; }
.lrslot { text-align: center; cursor: pointer; position: relative; }
.lrslot .orb {
  width: 72px; height: 72px; border-radius: 50%; margin: 0 auto;
  background: radial-gradient(circle at 35% 30%, #5d3d24, #241203 70%);
  border: 3px solid #1c0e02; box-shadow: inset 0 3px 6px rgba(0,0,0,.6), 0 1px 0 rgba(255,255,255,.12);
  display: grid; place-items: center; color: #ffe9b0; font-weight: 800; font-size: 17px;
}
.lrslot.sel .orb { outline: 3px solid #f0b649; outline-offset: 1px; }
.lrslot.seedcol .orb { background: radial-gradient(circle at 35% 30%, #4c4426, #1e1a06 70%); }
.lrslot .lv { color: #f0b649; font-weight: 800; font-size: 11.5px; margin-top: 3px; text-transform: uppercase; }
.lrslot .badge {
  position: absolute; top: -4px; right: 4px; font-size: 11px; font-weight: 800;
  text-shadow: 0 1px 0 rgba(0,0,0,.6);
}
.lrslot .orb .now { display: block; font-size: 10px; color: #b99b6d; font-weight: 650; }
.lrdetail {
  margin-top: 14px; background: rgba(0,0,0,.35); border: 2px solid #6b4a2f; border-radius: 12px;
  padding: 10px 14px; color: #f4e3c0; font-size: 12.5px; min-height: 40px;
}
.lrdetail b { color: #ffe9b0; letter-spacing: .3px; }
.lrdetail .why { color: #c9ae85; }
.panel { margin-top: 14px; }
</style>
