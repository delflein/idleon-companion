<script setup>
/**
 * HomePage (route "/") — THE DASHBOARD. The M5 port of dashboard.html, the survey's highest-risk
 * legacy page (~490 lines). This replaces the M4 UI-kit demo entirely (the "core: N recipes loaded"
 * proof-of-bundle line is gone — the kit is proven by 44 real ported pages now).
 *
 * WHAT WAS DROPPED (stated per the M5 brief — appState + DataPage own these now):
 *   - the page's own `parseSave(raw)` (a full duplicate of domain.mjs's parser, with REF constants
 *     copied verbatim): GONE. Every number here comes from appState's `entities`/`metrics`/`stats`
 *     computeds (deriveEntities/deriveMetrics over the core parser) — one parser, no drift.
 *   - all standalone sync plumbing (IdleonSync server + browser/Firebase modes, the Steam-SSO
 *     connect modal, auto-refresh polling, `⬇ save` download) and the drag-drop savegame.json
 *     loader: GONE. The Data page (/data) owns connect + sync + import/export.
 *   - the bespoke hover-crosshair SVG `renderHistory()` line chart: replaced by the shared
 *     TimeChart (uPlot, D6) driven by a metric-key picker, keeping the legacy metric-selection UX.
 * (The daily/weekly checklist was initially dropped, then restored below — same localStorage keys
 * as the legacy page, so checked-off state carries over.)
 *
 * WHAT WAS PORTED:
 *   - buildAdvice() → src/core/dashboard-advice.mjs (pure, framework-free), rendered here as the
 *     "Needs your attention" band (top 3) + "More focus targets" advisor panel, with real
 *     <RouterLink>s replacing the legacy inline `<a href="foo.html">` anchors.
 *   - the KPI tile grid, the Engines panel, the Characters strip — each mapped tile-for-tile onto
 *     entities/metrics.
 *   - the per-metric history sparklines (useHistory getter form) + the detailed TimeChart.
 *
 * EMPTY STATE: a fresh install with no snapshot shows a friendly onboarding card pointing at /data
 * (this page is now the app's front door).
 */
import { computed, ref } from "vue";
import { state, entities, metrics, stats, useHistory } from "../data/appState.js";
import { buildAdvice } from "../core/dashboard-advice.mjs";
import { plain } from "../ui/fmt.js";
import SpriteIcon from "../ui/SpriteIcon.vue";
import Sparkline from "../ui/Sparkline.vue";
import TimeChart from "../ui/TimeChart.vue";

/* Metric keys + labels — the legacy dashboard.html `metricKeys()` list and `METRIC_LABELS` map,
 * verbatim. These are the metrics the fetch script snapshots one-point-per-day, and the keys the
 * time-series charts read (term ids never rename — CLAUDE.md — so history stays intact). */
const METRICS = [
  { key: "accountLv", label: "Account LV" },
  { key: "skillsLv", label: "Skills LV" },
  { key: "bubbleLv", label: "Total Bubble LV" },
  { key: "stampLv", label: "Stamp LV ~" },
  { key: "vaultLv", label: "Vault LV" },
  { key: "dreamsDone", label: "Equinox dreams" },
  { key: "achievesDone", label: "Achievements" },
  { key: "artifactScore", label: "Artifact tiers" },
  { key: "atomLvTotal", label: "Atom levels" },
  { key: "greenstacks", label: "Greenstacks" },
  { key: "mealLvTotal", label: "Meal LV total" },
  { key: "cardsFound", label: "Cards found" },
  { key: "researchNodes", label: "Research nodes" },
  { key: "spelunkZones", label: "Spelunk zones" },
  { key: "emperorShowdown", label: "Emperor showdowns" },
];
const METRIC_KEYS = METRICS.map((m) => m.key);
const LABEL_OF = Object.fromEntries(METRICS.map((m) => [m.key, m.label]));

const loaded = computed(() => !!state.value);
const e = computed(() => entities.value);
const charNames = computed(() => state.value?.charNames ?? []);
const meta = computed(() => (state.value?.ts ? new Date(state.value.ts) : null));

const { series } = useHistory(METRIC_KEYS);

/* delta for a metric key = last point minus the previous point (the SPA analogue of legacy's
 * `hist[last].metrics[k] - hist[last-1].metrics[k]`); only positive deltas surface, matching the
 * legacy `delta()` helper. Empty/short history → 0 (no delta shown). */
function deltaOf(key) {
  const pts = series.value?.[key];
  if (!pts || pts.length < 2) return 0;
  const d = pts[pts.length - 1].v - pts[pts.length - 2].v;
  return d > 0 ? d : 0;
}

/* ---- KPI tiles (legacy tiles()) — one tile per legacy T[] entry, same icons/labels/order ---- */
const tiles = computed(() => {
  if (!e.value) return [];
  const m = metrics.value ?? {};
  const eq = e.value.equinox, emp = e.value.emperor;
  const achTotal = e.value.achievements?.length ?? 0;
  const achDone = e.value.achievements?.filter((a) => a.done).length ?? 0;
  return [
    { file: "ClassIcons14", dir: "data", label: "Account LV", value: plain(m.accountLv), sub: `${e.value.characters.length} characters`, delta: deltaOf("accountLv") },
    { file: "Sailing_Skill_0", dir: "etc", label: "Skills LV", value: plain(m.skillsLv), sub: "all characters", delta: deltaOf("skillsLv") },
    { file: "aJarB0", dir: "data", label: "Total Bubble LV", value: plain(m.bubbleLv), sub: "Tome line #1", delta: deltaOf("bubbleLv") },
    { file: "Rift_0", dir: "etc", label: "Rift", value: plain(e.value.misc?.rift), sub: "Cooking Mastery unlocked", delta: 0 },
    { file: "Equinox_Mirror", dir: "etc", label: "Equinox dreams", value: plain(eq?.dreamsDone), of: plain(eq?.dreamTotal), delta: deltaOf("dreamsDone") },
    { file: "Ribbon0", dir: "data", label: "Achievements", value: plain(achDone), of: plain(achTotal), delta: deltaOf("achievesDone") },
    { file: "Ribbon23", dir: "data", label: "Emperor", value: plain(emp?.showdown), sub: `showdowns · ${emp?.attemptsBanked ?? 0} banked`, delta: 0 },
    { file: "SailChest2", dir: "data", label: "Greenstacks", value: plain(m.greenstacks), sub: "", delta: deltaOf("greenstacks") },
  ];
});

/* ---- Engines panel (legacy renderEngines()) ---- */
const engines = computed(() => {
  const eng = e.value?.engines;
  if (!eng) return [];
  return [
    { file: "ClassIcons14", name: "Grimoire", eng: eng.grimoire, sub: "Bones · Death Bringer" },
    { file: "ClassIcons29", name: "Compass", eng: eng.compass, sub: "Dust · Wind Walker" },
    { file: "ClassIcons40", name: "Tesseract", eng: eng.tesseract, sub: "Tachyons · Arcane Cultist" },
    { file: "VaultBut", name: "Upgrade Vault", eng: eng.vault, sub: "gems / coins" },
  ].map((x) => ({ ...x, missing: x.eng.total - x.eng.bought }));
});

/* ---- Characters strip (legacy renderChars()) ---- */
const chars = computed(() => {
  if (!e.value) return [];
  return e.value.characters.map((c) => ({
    idx: c.idx,
    classId: c.classId,
    name: charNames.value[c.idx] ?? c.name ?? `char ${c.idx}`,
    level: c.level,
    className: c.className,
    skills: c.skillsTotal,
  }));
});

/* ---- Advisor (legacy buildAdvice → renderAdvisor): top 3 → attention band, rest → panel ---- */
const advice = computed(() => (e.value ? buildAdvice(e.value, metrics.value, stats.value, state.value?.save) : []));
const attention = computed(() => advice.value.slice(0, 3));
const advisor = computed(() => advice.value.slice(3));

/* ---- Progress-over-time: per-metric sparkline cards double as the picker; the selected metric
 *      feeds the detailed TimeChart (D6 replacement for the legacy hand-rolled SVG). ---- */
const selectedKey = ref("accountLv");
const metricCards = computed(() =>
  METRICS.map((m) => {
    const pts = series.value?.[m.key] ?? [];
    const cur = pts.length ? pts[pts.length - 1].v : null;
    const first = pts.length ? pts[0].v : null;
    return { ...m, points: pts, cur, growth: cur != null && first != null && cur > first ? cur - first : 0, has: pts.length > 0 };
  }).filter((c) => c.has),
);
const hasHistory = computed(() => metricCards.value.some((c) => c.points.length >= 2));
/* Follow the picker, but fall back to the first metric that actually has history so the chart is
 * never asked to plot an empty series. */
const activeKey = computed(() => {
  const avail = metricCards.value.map((c) => c.key);
  return avail.includes(selectedKey.value) ? selectedKey.value : (avail[0] ?? selectedKey.value);
});
/* TimeChart wants epoch-ms timestamps; history() yields ISO strings — convert here (Sparkline reads
 * only `.v`, so its cards take the raw points). */
const chartSeries = computed(() => {
  const pts = series.value?.[activeKey.value] ?? [];
  return { [activeKey.value]: pts.map((p) => ({ ts: Date.parse(p.ts), v: p.v })) };
});
const chartLabels = computed(() => ({ [activeKey.value]: LABEL_OF[activeKey.value] ?? activeKey.value }));

/* ---- Daily/weekly checklist (legacy dashboard.html DAILY/WEEKLY + renderChecklist, ported
 * verbatim). Manual to-do state, keyed per day ("d<ISO date>:<id>") / per week ("w<year>-<week>:
 * <id>") in localStorage — the SAME keys the legacy page used, so state checked off there today
 * carries over. Notes read from entities/metrics where the legacy note functions did. */
const DAILY = [
  { id: "emp", t: "Emperor attempt(s)", auto: true, n: () => `${e.value?.emperor?.attemptsBanked ?? 0} banked at last sync · showdown ${e.value?.emperor?.showdown ?? "—"}` },
  { id: "summon", t: "Summoning daily battles", n: () => "win streak attempts + endless push" },
  { id: "research", t: "Research: roll dice + assign studies", n: () => "keep all magnifying-glass slots busy" },
  { id: "spelunk", t: "Spelunking dive", n: () => "no time candy works in W7 — active time" },
  { id: "engines", t: "Engine rotation: Dust / Bones / Tachyons", n: () => "one active block each on WW, DB, AC maps" },
  { id: "opals", t: "Caverns: spend opals + bank monument hours", n: () => "" },
  { id: "farm", t: "Farming: harvest + Sticker/market attempts", n: () => "" },
  { id: "arcade", t: "Arcade: claim balls", n: () => "gold ball shop = 1200-pt Tome line" },
  { id: "sushi", t: "Sushi Station rotation", n: () => "" },
];
const WEEKLY = [
  { id: "button", t: "Press The Button", n: () => "weekly multiplicative bonus — check requirements panel" },
  { id: "weeklyboss", t: "Weekly Battles", n: () => "" },
  { id: "cavpush", t: "Cavern depth push", n: () => "deepest cavern + Gambit attempt" },
  { id: "dream", t: "Finish ≥ 1 Equinox dream", n: () => `${e.value?.equinox?.dreamsDone ?? "—"}/${e.value?.equinox?.dreamTotal ?? "—"} done` },
  { id: "review", t: "Tome & account review", n: () => "sync fresh, then compare history" },
];
const dayKey = () => "d" + new Date().toISOString().slice(0, 10);
const weekKey = () => { const d = new Date(), y = d.getFullYear(), on = new Date(y, 0, 1); return "w" + y + "-" + Math.ceil(((d - on) / 864e5 + on.getDay() + 1) / 7); };
const chkTab = ref("daily");
const chkVersion = ref(0); // bump to re-read localStorage after a toggle
const chkStore = { get(k) { try { return localStorage.getItem(k); } catch { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch { /* storage blocked — session-only */ } } };
const chkItems = computed(() => {
  void chkVersion.value;
  const items = chkTab.value === "daily" ? DAILY : WEEKLY;
  const key = chkTab.value === "daily" ? dayKey() : weekKey();
  return items.map((it) => ({ ...it, note: it.n(), done: chkStore.get(key + ":" + it.id) === "1" }));
});
const chkDate = computed(() => chkTab.value === "daily"
  ? new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" })
  : "resets weekly");
function toggleChk(id) {
  const key = (chkTab.value === "daily" ? dayKey() : weekKey()) + ":" + id;
  chkStore.set(key, chkStore.get(key) === "1" ? "0" : "1");
  chkVersion.value++;
}
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
        Command Center
      </h1>
      <span
        v-if="meta"
        class="meta"
      >synced {{ meta.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) }}</span>
    </header>
    <div
      id="err"
      class="err"
    />

    <!-- ONBOARDING (fresh install, no snapshot) — the app's front door -->
    <section
      v-if="!loaded"
      class="panel onboarding"
    >
      <h2>
        <SpriteIcon
          file="Sailing_Skill_0"
          dir="etc"
          :size="22"
        />
        Welcome to your IdleOn Command Center
      </h2>
      <p class="note">
        No save loaded yet. Head to the <b>Data</b> page to connect your account and pull your live
        save, or import a backup — then this dashboard fills in with your KPIs, focus targets, and
        progress-over-time charts.
      </p>
      <RouterLink
        class="cta"
        to="/data"
      >
        Go to Data → Connect &amp; Sync (or Import)
      </RouterLink>
    </section>

    <template v-else>
      <!-- Needs your attention: top-3 advice -->
      <section
        v-if="attention.length"
        class="attention"
      >
        <h2 class="bandtitle">
          Needs your attention
        </h2>
        <div class="att-grid">
          <div
            v-for="(a, i) in attention"
            :key="a.kind"
            class="att-card"
            :class="a.severity"
          >
            <div class="rank">
              {{ i + 1 }}
            </div>
            <SpriteIcon
              :file="a.icon[0]"
              :dir="a.icon[1]"
              :size="34"
              cls="att-sprite"
            />
            <div class="att-body">
              <h3>{{ a.title }}</h3>
              <p class="why">
                {{ a.why }}
              </p>
              <p class="act">
                <template
                  v-for="(seg, k) in a.act"
                  :key="k"
                >
                  <RouterLink
                    v-if="seg.to"
                    :to="seg.to"
                  >
                    {{ seg.text }}
                  </RouterLink><span v-else>{{ seg.text }}</span>
                </template>
              </p>
              <div
                v-if="a.chips.length"
                class="chips"
              >
                <span
                  v-for="(c, k) in a.chips.slice(0, 4)"
                  :key="k"
                  class="chip"
                >{{ c.label }}<b v-if="c.value"> {{ c.value }}</b></span>
                <span
                  v-if="a.chips.length > 4"
                  class="chip"
                >+{{ a.chips.length - 4 }} more</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- KPI tiles -->
      <div class="cards">
        <div
          v-for="(t, i) in tiles"
          :key="i"
          class="tile"
        >
          <SpriteIcon
            :file="t.file"
            :dir="t.dir"
            :size="28"
          />
          <div class="label">
            {{ t.label }}
          </div>
          <div class="value">
            {{ t.value }}<span
              v-if="t.of"
              class="of"
            > / {{ t.of }}</span>
          </div>
          <div class="sub">
            {{ t.sub }}<span
              v-if="t.delta"
              class="up"
            > ▲ {{ plain(t.delta) }}</span>
          </div>
        </div>
      </div>

      <div class="grid2">
        <div class="stack">
          <!-- Engines -->
          <section class="panel">
            <h2>
              Engines <span class="hint">account-wide power systems</span>
            </h2>
            <div class="eng-grid">
              <div
                v-for="en in engines"
                :key="en.name"
                class="eng"
              >
                <SpriteIcon
                  :file="en.file"
                  :size="24"
                />
                <div>
                  <div class="nm">
                    {{ en.name }}
                  </div>
                  <div class="lv">
                    {{ plain(en.eng.levelSum) }}
                  </div>
                  <div class="st">
                    {{ en.sub }}<br>
                    {{ en.eng.bought }}/{{ en.eng.total }} upgrades<span
                      v-if="en.missing"
                      class="warn"
                    > · {{ en.missing }} unbought</span><span v-else> · all bought</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <!-- Characters -->
          <section class="panel">
            <h2>Characters</h2>
            <div class="charstrip">
              <div
                v-for="c in chars"
                :key="c.idx"
                class="char"
              >
                <SpriteIcon
                  :file="'ClassIcons' + c.classId"
                  :size="20"
                />
                <div>
                  <b>{{ c.name }}</b>
                  <span>LV {{ plain(c.level) }} · {{ c.className }} · skills {{ plain(c.skills) }}</span>
                </div>
              </div>
            </div>
          </section>

          <!-- Daily / weekly checklist (legacy dashboard checklist, same localStorage keys) -->
          <section class="panel">
            <h2>
              Checklist
              <span class="hint">{{ chkDate }}</span>
              <span class="spacer" />
              <button
                class="chktab"
                :class="{ active: chkTab === 'daily' }"
                @click="chkTab = 'daily'"
              >
                daily
              </button>
              <button
                class="chktab"
                :class="{ active: chkTab === 'weekly' }"
                @click="chkTab = 'weekly'"
              >
                weekly
              </button>
            </h2>
            <ul class="check">
              <li
                v-for="it in chkItems"
                :key="it.id"
                :class="{ done: it.done }"
                @click="toggleChk(it.id)"
              >
                <div class="box">
                  {{ it.done ? "✓" : "" }}
                </div>
                <div class="txt">
                  <b>{{ it.t }}</b>
                  <span
                    v-if="it.auto"
                    class="autotag"
                  >from save</span>
                  <span
                    v-if="it.note"
                    class="note"
                  >{{ it.note }}</span>
                </div>
              </li>
            </ul>
          </section>
        </div>

        <!-- More focus targets: advice ranks 4+ -->
        <section class="panel">
          <h2>
            More focus targets <span class="hint">computed from your save — Tome push &amp; uncapped small things</span>
          </h2>
          <p
            v-if="!advisor.length"
            class="note"
          >
            Nothing else flagged — the big focus targets are all in the attention band above.
          </p>
          <div
            v-for="(a, i) in advisor"
            :key="a.kind"
            class="advice"
            :class="a.severity"
          >
            <div class="rank">
              {{ i + 4 }}
            </div>
            <div>
              <h3>{{ a.title }}</h3>
              <div class="why">
                {{ a.why }}
              </div>
              <div class="act">
                <template
                  v-for="(seg, k) in a.act"
                  :key="k"
                >
                  <RouterLink
                    v-if="seg.to"
                    :to="seg.to"
                  >
                    {{ seg.text }}
                  </RouterLink><span v-else>{{ seg.text }}</span>
                </template>
              </div>
              <div
                v-if="a.chips.length"
                class="chips"
              >
                <span
                  v-for="(c, k) in a.chips.slice(0, 13)"
                  :key="k"
                  class="chip"
                >{{ c.label }}<b v-if="c.value"> {{ c.value }}</b></span>
                <span
                  v-if="a.chips.length > 13"
                  class="chip"
                >+{{ a.chips.length - 13 }} more</span>
              </div>
            </div>
          </div>
        </section>
      </div>

      <!-- Progress over time -->
      <section class="panel">
        <h2>
          Progress over time <span class="hint">one point per day — pick a metric to expand</span>
        </h2>
        <template v-if="metricCards.length">
          <div class="hist-grid">
            <button
              v-for="c in metricCards"
              :key="c.key"
              class="mcard"
              :class="{ sel: c.key === activeKey }"
              type="button"
              @click="selectedKey = c.key"
            >
              <div class="nm">
                {{ c.label }}
              </div>
              <div class="cur">
                {{ plain(c.cur) }}<span
                  v-if="c.growth"
                  class="up"
                > ▲ {{ plain(c.growth) }}</span>
              </div>
              <Sparkline
                :points="c.points"
                :width="150"
                :height="34"
              />
            </button>
          </div>
          <TimeChart
            v-if="hasHistory"
            :series="chartSeries"
            :labels="chartLabels"
            :title="LABEL_OF[activeKey]"
            :height="200"
          />
          <p
            v-else
            class="note"
          >
            Only one snapshot so far — the detailed chart appears once there are at least two days of
            history.
          </p>
        </template>
        <p
          v-else
          class="note"
        >
          No history yet — each daily sync appends a snapshot, and the charts fill in from there.
        </p>
      </section>
    </template>
  </div>
</template>

<style scoped>
/* Checklist — ported verbatim from companion.css ul.check/.autotag + the legacy tab buttons */
ul.check { list-style: none; padding: 0; margin: 0; }
ul.check li { display: flex; gap: 10px; align-items: flex-start; padding: 7px 4px; border-top: 1px solid var(--grid, #262a35); cursor: pointer; }
ul.check li:first-child { border-top: none; }
ul.check .box { width: 18px; height: 18px; flex: none; margin-top: 1px; border: 2px solid var(--baseline, #3a4054); border-radius: 6px; display: flex; align-items: center; justify-content: center; font-size: 12px; color: var(--accent-ink, #e6e8ee); }
ul.check li.done .box { background: var(--good, #7ad19c); border-color: var(--good, #7ad19c); color: #fff; }
ul.check li.done .txt { color: var(--ink-muted, #9aa4b8); text-decoration: line-through; }
ul.check .txt b { font-weight: 700; }
ul.check .txt .note { display: block; color: var(--ink-muted, #9aa4b8); font-size: 12px; }
.autotag { font-size: 10.5px; border: 1px solid var(--border, #2c3140); color: var(--ink-muted, #9aa4b8); border-radius: 5px; padding: 0 5px; margin-left: 6px; vertical-align: 1px; }
.chktab { padding: 2px 10px; background: transparent; color: var(--ink-muted, #9aa4b8); border: 1px solid var(--border, #2c3140); border-radius: 6px; cursor: pointer; font-size: 12px; }
.chktab.active { color: var(--accent-ink, #e6e8ee); border-color: var(--baseline, #3a4054); background: var(--panel-2, #1a1d26); }
.chktab + .chktab { margin-left: 4px; }

.page { display: flex; flex-direction: column; gap: var(--gap); }
.app .meta { color: var(--ink-muted); font-size: 12px; margin-left: auto; }

/* onboarding */
.onboarding .cta {
  display: inline-block; margin-top: 10px; padding: 8px 14px; border-radius: 8px;
  background: var(--series-1); color: #fff; font-weight: 700; font-size: 13px; text-decoration: none;
}

/* attention band (ported from dashboard.html / SailingPage's quick-tips band) */
.attention { background: var(--surface-1); border: 2px solid var(--border); border-radius: 16px; padding: 13px 16px; box-shadow: inset 0 1px 0 var(--border-soft); }
.bandtitle { font-size: 15px; font-weight: 800; color: var(--accent); margin-bottom: 10px; }
.att-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--gap); }
@media (max-width: 940px) { .att-grid { grid-template-columns: 1fr; } }
.att-card { position: relative; display: grid; grid-template-columns: auto 1fr; gap: 10px; background: var(--well); border: 1px solid var(--border); border-radius: 12px; padding: 10px 12px; }
.att-card.high { border-left: 3px solid var(--series-1); }
.att-card .rank { position: absolute; top: 6px; right: 9px; font-size: 11px; font-weight: 800; color: var(--ink-muted); }
.att-body h3 { font-size: 13.5px; font-weight: 800; color: var(--ink-1); margin-bottom: 3px; }
.att-body .why { font-size: 12px; color: var(--ink-2); margin: 2px 0; }
.att-body .act { font-size: 12px; color: var(--ink-muted); margin-top: 2px; }
.att-body .act a { color: var(--series-1); }

/* two-column layout */
.grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: var(--gap); }
@media (max-width: 940px) { .grid2 { grid-template-columns: 1fr; } }
.stack { display: flex; flex-direction: column; gap: var(--gap); }

/* engines */
.eng-grid { display: grid; grid-template-columns: 1fr 1fr; gap: var(--gap); }
.eng { display: grid; grid-template-columns: auto 1fr; gap: 9px; align-items: start; background: var(--well); border: 1px solid var(--border); border-radius: 10px; padding: 9px 11px; }
.eng .nm { font-size: 12px; font-weight: 700; color: var(--ink-1); }
.eng .lv { font-size: 20px; font-weight: 800; color: var(--accent); }
.eng .st { font-size: 11px; color: var(--ink-2); margin-top: 2px; }
.eng .warn { color: var(--warning); font-weight: 650; }

/* characters strip */
.charstrip { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 8px; }
.char { display: grid; grid-template-columns: auto 1fr; gap: 8px; align-items: center; background: var(--well); border: 1px solid var(--border); border-radius: 10px; padding: 7px 10px; }
.char b { font-size: 12.5px; color: var(--ink-1); display: block; }
.char span { font-size: 11px; color: var(--ink-2); }

/* advisor cards (ranks 4+) */
.advice { position: relative; display: grid; grid-template-columns: auto 1fr; gap: 10px; background: var(--well); border: 1px solid var(--border); border-radius: 12px; padding: 10px 12px; margin-bottom: var(--gap); }
.advice.high { border-left: 3px solid var(--series-1); }
.advice .rank { font-size: 15px; font-weight: 800; color: var(--ink-muted); }
.advice h3 { font-size: 13.5px; font-weight: 800; color: var(--ink-1); margin-bottom: 3px; }
.advice .why { font-size: 12px; color: var(--ink-2); margin: 2px 0; }
.advice .act { font-size: 12px; color: var(--ink-muted); }
.advice .act a { color: var(--series-1); }

/* chips */
.chips { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 7px; }
.chip { background: var(--surface-1); border: 1px solid var(--border); border-radius: 20px; padding: 2px 9px; font-size: 11px; color: var(--ink-2); }
.chip b { color: var(--ink-1); font-weight: 700; }

/* progress-over-time */
.hist-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 8px; margin-bottom: var(--gap); }
.mcard { text-align: left; background: var(--well); border: 1px solid var(--border); border-radius: 10px; padding: 8px 10px; cursor: pointer; font: inherit; color: inherit; }
.mcard.sel { border-color: var(--series-1); box-shadow: inset 0 0 0 1px var(--series-1); }
.mcard .nm { font-size: 11.5px; color: var(--ink-muted); font-weight: 650; }
.mcard .cur { font-size: 17px; font-weight: 800; color: var(--accent); margin: 1px 0 3px; }
</style>
