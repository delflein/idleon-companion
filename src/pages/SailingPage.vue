<script setup>
/**
 * SailingPage — the sailing.html port. Legacy sailing.html is 100% bespoke (no shared recipe
 * module) and holds the app's largest concentration of page-local domain logic. All of that math
 * now lives framework-free in src/core/sailing-page.mjs (chest/artifact what-if, island ranking,
 * captain-shop scoring) built on domain.mjs's parsed `entities.sailing` + chestDist() and the
 * stats/artifact-find.mjs recipe — see that module's header. This component only wires those
 * pure functions to appState computeds and renders.
 *
 * HONESTY (README + domain.mjs serverVars note): the "1 in N" columns inherit the calibrated
 * Firebase server vars and any un-derived BoatArtiMulti term (baseMulti becomes a LOWER bound, so
 * odds read "≤ 1 in N"). Ratios/× comparisons cancel both and are trustworthy — the caveat line
 * says exactly this, matching the legacy page.
 */
import { computed, ref } from "vue";
import { entities, stats } from "../data/appState.js";
import SpriteIcon from "../ui/SpriteIcon.vue";
import DataTable from "../ui/DataTable.vue";
import {
  STAT_NAMES, TIER_ROMAN, CHEST_ARTI, CHEST_NAMES, LIVE_STATS, CAP_LV,
  capLabel, chanceFor, boatMulti, boatRate, fleetOn,
  computeSwaps, liveIslands, currentIsland, bestIsland, topSources,
} from "../core/sailing-page.mjs";

const s = computed(() => entities.value?.sailing ?? null);
const af = computed(() => stats.value?.artifactFind ?? null);
/* Older snapshots predate the computed baseMulti field — treat missing as "rebuild needed". */
const ready = computed(() => !!(s.value && s.value.baseMulti));
const lower = computed(() => !!s.value?.artiLowerBound);

const islandSel = ref(null); // null = follow the fleet's current island
const cur = computed(() => (ready.value ? currentIsland(s.value) : null));
const sel = computed(() => {
  if (!ready.value) return null;
  const id = islandSel.value ?? cur.value.i;
  return s.value.islands.find((i) => i.i === id) || cur.value;
});
const live = computed(() => (ready.value ? liveIslands(s.value) : []));
const best = computed(() => (ready.value ? bestIsland(s.value) : null));
const swaps = computed(() => (ready.value ? computeSwaps(s.value, sel.value) : []));
const top = computed(() => swaps.value[0] ?? null);
const fleetNow = computed(() => (ready.value ? fleetOn(s.value, sel.value) : 0));
const levers = computed(() => topSources(af.value));

/* ---- formatting helpers (verbatim from sailing.html) ---- */
const int = (n) => Math.round(n).toLocaleString();
function oneIn(p) {
  return p > 0 ? (lower.value ? "≤ 1 in " : "1 in ") + int(1 / p) : "—";
}
function fmtMulti(v) {
  return v >= 1e9 ? (v / 1e9).toFixed(2) + "B×" : v >= 1e6 ? (v / 1e6).toFixed(2) + "M×" : Math.round(v).toLocaleString() + "×";
}
function pct(x) {
  return (x >= 0 ? "+" : "") + (x / fleetNow.value * 100).toFixed(2) + "%";
}
function statLive(id, phase) {
  return LIVE_STATS[phase].includes(id);
}

/* ---- KPI tiles ---- */
const tiles = computed(() => {
  if (!ready.value) return [];
  const x = s.value;
  return [
    { file: "Sailing_Skill_0", dir: "etc", label: "Banked sailing", value: x.bankedHours.toFixed(1) + " h", sub: "advances every boat on claim" },
    { file: "SailChest0", dir: "data", label: "Chest pile", value: String(x.chests), sub: x.chests === 0 ? "empty — boats at sea" : "waiting" },
    { file: "Arti28", dir: "data", label: "Artifacts maxed", value: `${x.artifactsMaxed} / ${x.artifactsMaxed + x.artifactsRemaining}`, sub: x.artifactsRemaining + " to go" },
    { file: "SailChest4", dir: "data", label: "Rare Chest boats", value: `${x.boatsWithRareChest} / ${x.boats.length}`, sub: x.boatsDeadForArtifacts + " dead for artifacts" },
    { file: "Arti0", dir: "data", label: "Artifact find", value: (lower.value ? "≥ " : "") + fmtMulti(x.baseMulti), link: true },
  ];
});

/* ---- quick tips — the three decisions that matter this phase ----
 * `act` is a list of {text, cls?} segments so the coloured now/late deltas render without v-html. */
const tips = computed(() => {
  if (!ready.value) return [];
  const x = s.value, t = top.value, out = [];
  const liveList = live.value.map((i) => i.i).join(", ");

  out.push(t && t.late > 0
    ? {
      icon: { file: "Captain_3", dir: "etc" },
      title: `Buy the tier ${t.c.tier} shop roll`,
      why: `${t.c.stats.filter((st2) => statLive(st2.id, x.phase)).map((st2) => STAT_NAMES[st2.id] + " +" + st2.raw).join(", ") || "—"} — replaces captain ${capLabel(t.b.captainIdx)} on boat ${t.b.i}.`,
      act: [
        { text: pct(t.now), cls: t.now >= 0 ? "up" : "down" }, { text: " now → " },
        { text: pct(t.late), cls: "up" }, { text: ` at lv ${CAP_LV}. The roll never changes; the level does.` },
      ],
    }
    : {
      icon: { file: "Captain_3", dir: "etc" },
      title: "Captain shop: nothing worth buying",
      why: "No roll beats a captain you already have, even levelled to " + CAP_LV + ".",
      act: [{ text: "Check back after the shop rerolls." }],
    });

  if (best.value) {
    const moving = best.value.i !== cur.value.i;
    out.push(moving
      ? {
        icon: { file: `SailT${best.value.i * 2 + 1}`, dir: "data" },
        title: `Move the fleet to island ${best.value.i}`,
        why: `${(fleetOn(x, best.value) / fleetOn(x, cur.value)).toFixed(2)}× your current rate on island ${cur.value.i}.`,
        act: [{ text: `${live.value.length} islands still hold un-maxed artifacts (${liveList}).` }],
      }
      : {
        icon: { file: `SailT${cur.value.i * 2 + 1}`, dir: "data" },
        title: `Island ${cur.value.i} is already your best`,
        why: `Highest fleet rate of all ${live.value.length} live islands — nothing to change.`,
        act: [{ text: `${live.value.length} islands still hold un-maxed artifacts (${liveList}).` }],
      });
  }

  if (x.boatsDeadForArtifacts > 0) {
    out.push({
      icon: { file: "SailChest5", dir: "data" },
      title: `${x.boatsDeadForArtifacts} boats are dead for artifacts`,
      why: `Only ${x.boatsWithRareChest}/${x.boats.length} boats carry a Rare Chest captain — the live stat this phase.`,
      act: [{ text: "Re-roll or re-assign the speed/loot captains; Cloud Discover is never worth a slot." }],
    });
  }
  return out;
});

/* ---- islands panel rows ---- */
const islandRows = computed(() => {
  if (!ready.value) return [];
  const x = s.value, base = fleetOn(x, cur.value);
  return live.value.map((i) => ({
    i, rel: fleetOn(x, i) / base,
    basic: oneIn(chanceFor(x.baseMulti, i)),
    arts: i.artifacts.filter((a) => a.tier < 6),
  }));
});

/* ---- captain shop rows ---- */
const shopRows = computed(() => {
  if (!ready.value) return [];
  return s.value.shop.map((c) => {
    const bestFor = swaps.value.find((sw) => sw.c === c) || null;
    const good = !!(bestFor && bestFor.late > 0);
    return { c, bestFor, good };
  });
});
const shopRec = computed(() => {
  const t = top.value;
  if (!ready.value || !(t && t.late > 0)) return null;
  return {
    tier: t.c.tier,
    stats: t.c.stats.filter((st2) => statLive(st2.id, s.value.phase)).map((st2) => STAT_NAMES[st2.id] + " +" + st2.raw).join(", ") || "—",
    where: `captain ${capLabel(t.b.captainIdx)} on boat ${t.b.i}`,
    now: pct(t.now), nowUp: t.now >= 0,
    late: "+" + (t.late / fleetNow.value * 100).toFixed(2) + "%",
  };
});

/* ---- fleet table (DataTable, boat-order default, click-to-sort) ---- */
const fleetRows = computed(() => {
  if (!ready.value) return [];
  const x = s.value, isl = sel.value;
  return x.boats.map((b) => {
    const c = x.captains.find((cc) => cc.i === b.captainIdx) || { tier: 0, level: 0, stats: [] };
    const m = boatMulti(x, b);
    return { b, c, m, tiers: CHEST_ARTI.slice(0, 5).map((a) => chanceFor(m * a, isl)), rate: boatRate(x, b, isl) };
  });
});
const tierKeys = ["t0", "t1", "t2", "t3", "t4"];
const fleetColumns = computed(() => [
  { key: "boat", label: "boat", get: (r) => r.b.i },
  { key: "cap", label: "cap", get: (r) => r.b.captainIdx, format: (r) => capLabel(r.b.captainIdx) },
  { key: "tier", label: "tier", get: (r) => r.c.tier },
  { key: "lv", label: "lv", get: (r) => r.c.level },
  { key: "stats", label: "stats", sortable: false },
  ...CHEST_NAMES.slice(0, 5).map((name, idx) => ({
    key: tierKeys[idx], label: name, numeric: true,
    get: (r) => (r.tiers[idx] > 0 ? 1 / r.tiers[idx] : Infinity),
  })),
  { key: "rate", label: "per chest", numeric: true, get: (r) => (r.rate > 0 ? 1 / r.rate : Infinity) },
]);
</script>

<template>
  <div class="page">
    <header class="app">
      <h1>
        <SpriteIcon
          file="Sailing_Skill_0"
          dir="etc"
          :size="26"
        />
        Sailing
      </h1>
    </header>
    <div
      id="err"
      class="err"
    />

    <template v-if="ready">
      <!-- quick tips -->
      <section class="attention">
        <h2 class="bandtitle">
          Quick tips — {{ s.phase }} phase
        </h2>
        <div class="att-grid">
          <div
            v-for="(tip, i) in tips"
            :key="i"
            class="att-card"
          >
            <div class="rank">
              {{ i + 1 }}
            </div>
            <SpriteIcon
              :file="tip.icon.file"
              :dir="tip.icon.dir"
              :size="34"
              cls="att-sprite"
            />
            <div class="att-body">
              <h3>{{ tip.title }}</h3>
              <p class="why">
                {{ tip.why }}
              </p>
              <p class="act">
                <template
                  v-for="(seg, k) in tip.act"
                  :key="k"
                >
                  <b
                    v-if="seg.cls"
                    :class="seg.cls"
                  >{{ seg.text }}</b><span v-else>{{ seg.text }}</span>
                </template>
              </p>
            </div>
          </div>
        </div>
      </section>

      <!-- KPI tiles -->
      <div class="kpis five">
        <div
          v-for="(tile, i) in tiles"
          :key="i"
          class="tile"
        >
          <SpriteIcon
            :file="tile.file"
            :dir="tile.dir"
            :size="28"
          />
          <div class="label">
            {{ tile.label }}
          </div>
          <div class="value">
            {{ tile.value }}
          </div>
          <div class="sub">
            <RouterLink
              v-if="tile.link"
              to="/stats?recipe=artifactFind"
            >
              full breakdown →
            </RouterLink>
            <template v-else>
              {{ tile.sub }}
            </template>
          </div>
        </div>
      </div>

      <div class="grid2">
        <!-- levers -->
        <section
          v-if="levers"
          class="panel"
        >
          <h2>
            Your levers <span class="hint">top artifact-find sources · % added to the pool</span>
          </h2>
          <div class="levers">
            <div
              v-for="(t, i) in levers.terms"
              :key="i"
              class="lever"
            >
              <div class="lname">
                {{ t.label }}
              </div>
              <div class="lbar">
                <div
                  class="lfill"
                  :style="{ width: (t.v / levers.max * 100).toFixed(1) + '%' }"
                />
              </div>
              <div class="lval">
                +{{ int(t.v) }}%
              </div>
            </div>
          </div>
          <p class="lnote">
            Additive pool {{ int(levers.additivePoolPct) }}% · multiplicative stack {{ fmtMulti(levers.multiplicative) }} —
            full recipe in
            <RouterLink to="/stats?recipe=artifactFind">
              Stats → Artifact Find
            </RouterLink>.
          </p>
        </section>

        <!-- islands -->
        <section class="panel">
          <h2>
            Islands <span class="hint">chance per basic chest · fleet on island {{ cur.i }}</span>
          </h2>
          <div class="scroll">
            <table>
              <tr>
                <th>island</th><th>un-maxed</th><th>basic chest</th><th class="num">
                  vs current
                </th><th>artifacts</th>
              </tr>
              <tr
                v-for="row in islandRows"
                :key="row.i.i"
                :class="row.i.i === cur.i ? 'pick' : (row.rel < 1 ? 'dim' : '')"
              >
                <td class="isl">
                  <SpriteIcon
                    :file="'SailT' + (row.i.i * 2 + 1)"
                    :size="22"
                  /> {{ row.i.i }}{{ row.i.i === cur.i ? " · fleet" : "" }}
                </td>
                <td>{{ row.i.unmaxed }} / {{ row.i.count }}</td>
                <td>{{ row.basic }}</td>
                <td
                  class="num"
                  :class="row.rel >= 1 ? 'up' : 'down'"
                >
                  {{ row.rel.toFixed(2) }}×
                </td>
                <td>
                  <span
                    v-for="a in row.arts"
                    :key="a.i"
                    class="artchip"
                    :title="`${a.name} (tier ${a.tier})`"
                  >
                    <SpriteIcon
                      :file="'Arti' + a.i"
                      :size="20"
                    /><span class="tb">{{ TIER_ROMAN[a.tier] ?? a.tier }}</span>
                  </span>
                </td>
              </tr>
            </table>
          </div>
        </section>
      </div>

      <!-- captain shop -->
      <section class="panel">
        <h2>Captain shop</h2>
        <div
          v-if="shopRec"
          class="rec"
        >
          Buy the <b>tier {{ shopRec.tier }}</b> roll ({{ shopRec.stats }}) and replace
          <b>{{ shopRec.where }}</b> —
          <b :class="shopRec.nowUp ? 'up' : 'down'">{{ shopRec.now }}</b> now,
          <b class="up">{{ shopRec.late }}</b> at lv{{ CAP_LV }}.
        </div>
        <div
          v-else
          class="rec none"
        >
          Nothing worth buying — no roll beats a captain you already have, even levelled.
        </div>
        <div class="scroll">
          <table>
            <tr>
              <th>tier</th><th>lv</th><th>stats</th><th>replaces</th><th>now</th><th>at lv{{ CAP_LV }}</th>
            </tr>
            <tr
              v-for="(row, i) in shopRows"
              :key="i"
              :class="row.good ? '' : 'dim'"
            >
              <td>{{ row.c.tier }}</td>
              <td>{{ row.c.level }}</td>
              <td>
                <span
                  v-for="(st2, k) in row.c.stats"
                  :key="k"
                  class="chip"
                  :class="statLive(st2.id, s.phase) ? 'live' : 'dead'"
                >{{ STAT_NAMES[st2.id] }} +{{ st2.raw }}</span>
              </td>
              <td>{{ row.good ? `cap ${capLabel(row.bestFor.b.captainIdx)} · boat ${row.bestFor.b.i}` : "—" }}</td>
              <td :class="row.good && row.bestFor.now >= 0 ? 'up' : 'down'">
                {{ row.good ? pct(row.bestFor.now) : "—" }}
              </td>
              <td :class="row.good ? 'up' : ''">
                {{ row.good ? "+" + (row.bestFor.late / fleetNow * 100).toFixed(2) + "%" : "—" }}
              </td>
            </tr>
          </table>
        </div>
      </section>

      <!-- fleet -->
      <section class="panel">
        <h2>
          Fleet <span class="hint">chance per chest on</span>
          <select
            :value="sel.i"
            @change="islandSel = Number($event.target.value)"
          >
            <option
              v-for="i in s.islands"
              :key="i.i"
              :value="i.i"
            >
              island {{ i.i }}{{ i.unmaxed ? ` · ${i.unmaxed} un-maxed` : " · nothing left" }}
            </option>
          </select>
        </h2>
        <DataTable
          :columns="fleetColumns"
          :rows="fleetRows"
          :initial-sort="{ col: 'boat', dir: 1 }"
          :row-key="(r) => r.b.i"
        >
          <template #cell-cap="{ row }">
            {{ capLabel(row.b.captainIdx) }}
          </template>
          <template #cell-stats="{ row }">
            <span
              v-for="(st2, k) in (row.c.stats || [])"
              :key="k"
              class="chip"
              :class="statLive(st2.id, s.phase) ? 'live' : 'dead'"
            >{{ STAT_NAMES[st2.id] }} +{{ st2.raw }}</span>
          </template>
          <template #cell-t0="{ row }">
            {{ oneIn(row.tiers[0]) }}
          </template>
          <template #cell-t1="{ row }">
            {{ oneIn(row.tiers[1]) }}
          </template>
          <template #cell-t2="{ row }">
            {{ oneIn(row.tiers[2]) }}
          </template>
          <template #cell-t3="{ row }">
            {{ oneIn(row.tiers[3]) }}
          </template>
          <template #cell-t4="{ row }">
            {{ oneIn(row.tiers[4]) }}
          </template>
          <template #cell-rate="{ row }">
            {{ oneIn(row.rate) }}
          </template>
        </DataTable>
      </section>

      <p
        v-if="lower"
        class="foot caveat-line"
      >
        <b>The "1 in N" columns are a floor</b> — {{ s.artiUnknown.length }} artifact-find source(s)
        can't be derived from the save, so your real chance is better than shown. Rankings and ×
        comparisons are unaffected. Details:
        <RouterLink to="/stats?recipe=artifactFind">
          Stats → Artifact Find Chance
        </RouterLink>.
      </p>
    </template>

    <p
      v-else
      class="note"
    >
      No computed <code>sailing</code> data on this snapshot yet — sync a save (and rebuild if it
      predates the computed <code>baseMulti</code> field).
    </p>
  </div>
</template>

<style scoped>
.grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: var(--gap); margin-bottom: var(--gap); }
@media (max-width: 940px) { .grid2 { grid-template-columns: 1fr; } }

.kpis.five, .attention { margin-bottom: var(--gap); }

/* quick-tips band */
.attention { background: var(--surface-1); border: 2px solid var(--border); border-radius: 16px; padding: 13px 16px; box-shadow: inset 0 1px 0 var(--border-soft); }
.bandtitle { font-size: 15px; font-weight: 800; color: var(--accent); margin-bottom: 10px; }
.att-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--gap); }
@media (max-width: 940px) { .att-grid { grid-template-columns: 1fr; } }
.att-card { position: relative; display: grid; grid-template-columns: auto 1fr; gap: 10px; background: var(--well); border: 1px solid var(--border); border-radius: 12px; padding: 10px 12px; }
.att-card .rank { position: absolute; top: 6px; right: 9px; font-size: 11px; font-weight: 800; color: var(--ink-muted); }
.att-body h3 { font-size: 13.5px; font-weight: 800; color: var(--ink-1); margin-bottom: 3px; }
.att-body .why { font-size: 12px; color: var(--ink-2); margin: 2px 0; }
.att-body .act { font-size: 12px; color: var(--ink-muted); margin-top: 2px; }

/* levers */
.levers { display: grid; gap: 6px; }
.lever { display: grid; grid-template-columns: 1fr 120px auto; gap: 8px; align-items: center; }
.lname { font-size: 12px; color: var(--ink-2); }
.lbar { background: var(--track); border-radius: 4px; height: 8px; overflow: hidden; }
.lfill { background: var(--series-1); height: 100%; border-radius: 0 4px 4px 0; }
.lval { font-size: 12px; font-weight: 700; color: var(--ink-1); text-align: right; }
.lnote { margin-top: 8px; font-size: 11.5px; color: var(--ink-muted); }

/* island artifact chips */
.isl { white-space: nowrap; }
.pick td { background: var(--glow); }
.artchip { position: relative; display: inline-block; margin: 0 3px 2px 0; }
.artchip .tb { position: absolute; right: -2px; bottom: -3px; font-size: 9px; font-weight: 800; color: var(--accent); text-shadow: 0 0 2px #000; }

/* captain-shop recommendation */
.rec { border-left: 3px solid var(--good); background: rgba(12, 163, 12, .06); padding: 7px 11px; border-radius: 0 8px 8px 0; margin-bottom: 10px; font-size: 12.5px; }
.rec.none { border-left-color: var(--border); background: var(--well); color: var(--ink-muted); }

.foot { margin-top: var(--gap); }
.caveat-line { font-size: 12px; color: var(--ink-2); }
</style>
