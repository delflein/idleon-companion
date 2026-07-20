<script setup>
/**
 * AchievementsPage — the achievements.html port. Legacy achievements.html is one of the two
 * standalone-capable legacy pages (server sync via IdleonSync.serverInit/serverSyncNow, OR a
 * direct browser/Firebase fallback, OR a dropped savegame.json) — that whole sync/fallback
 * plumbing is now the app-wide Data page's job (docs/migration/survey-pages.md's sync findings;
 * this page just reads appState's `entities` computed like every other ported page). What's KEPT
 * verbatim: grouping by completion mode (CATS), the how-to tips, Steam-exclusive handling, the
 * progress bars, and the pin (☆) feature.
 *
 * Data: entities.value.achievements (domain.mjs's extractEntities) is the per-account {i, done,
 * progress} triple for each REAL (non-UNUSED_SLOT) achievement, built in the exact same order as
 * achData().real — see domain.mjs: "e.achievements = achData().real.map((a) => ({ i, done,
 * progress }))". So the two arrays zip 1:1 by index; achData() (also exported by domain.mjs) is
 * the static per-achievement dataset (name/desc/world/qty/hard/steam/secret/cat/tip) sourced from
 * gamedata/achievements-data.mjs (420 slots, 268 real — matches legacy ach-data.js's "total":268
 * real-achievement count; the newer gamedata file is the current N.js-verified source, so it's
 * used here instead of the repo-root ach-data.js the legacy page loaded via <script>).
 *
 * PIN PERSISTENCE: appState.js's only settings surface is the whitelisted statInputs/setStatInput
 * pair (3 fixed stat-input keys, not a generic accessor) — there is no generic setting accessor
 * exported for pages to reuse, so per the migration brief's fallback this uses localStorage
 * directly under a clearly-named key ("idleon-achievements-pins"), same mechanism (guarded
 * try/catch) as legacy achievements.html's own `store` helper.
 */
import { computed, reactive } from "vue";
import { entities } from "../data/appState.js";
import { achData } from "../core/domain.mjs";
import { plain } from "../ui/fmt.js";

const PINS_KEY = "idleon-achievements-pins";
function loadPins() {
  try {
    return new Set(JSON.parse(localStorage.getItem(PINS_KEY) || "[]"));
  } catch {
    return new Set();
  }
}
const pins = reactive(loadPins());
function persistPins() {
  try {
    localStorage.setItem(PINS_KEY, JSON.stringify([...pins]));
  } catch {
    /* localStorage unavailable (private mode / disabled) — pins just don't survive a reload. */
  }
}
function togglePin(i) {
  if (pins.has(i)) pins.delete(i);
  else pins.add(i);
  persistPins();
}

/* Grouping-by-completion-mode (verbatim from legacy achievements.html's CATS table). */
const CATS = [
  ["active", "Active missions", "one focused session + the right strategy — tips included"],
  ["stack", "Exact stacks", "prep the exact amount in your Storage Chest"],
  ["dungeon", "Dungeon runs", "manual party-dungeon sessions"],
  ["minigame", "Minigame challenges", "skill-based — a different beast, pick your battles"],
  ["grind", "Long grinds", "background persistence over weeks"],
  ["idle", "Finishes itself", "just keep idling — zero action needed"],
];
const CAT_TABS = [
  ["active", "Missions"], ["minigame", "Minigames"], ["stack", "Stacks"],
  ["dungeon", "Dungeons"], ["grind", "Grinds"], ["idle", "Idle"],
];
const WORLD_TABS = [0, 1, 2, 3, 4, 5].map((w) => ({ v: w, label: "W" + (w + 1) }));

const FILTER = reactive({ status: "open", world: -1, cat: "all", q: "" });

/* Zip the static per-achievement dataset with this account's {done, progress}, same shape legacy
 * build() produced from ACH_DATA + AchieveReg/SteamAchieve. */
const achievements = computed(() => {
  const acct = entities.value?.achievements;
  if (!acct) return null;
  return achData().real.map((a, idx) => {
    const p = acct[idx];
    const done = !!p?.done;
    const qty = a.qty && a.qty > 1 ? a.qty : null;
    const prog = done ? null : (p?.progress ?? 0);
    const frac = done ? 1 : (qty ? Math.min(prog / qty, 0.999) : null);
    return { ...a, prog, done, qty, frac };
  });
});

const totalCount = computed(() => achievements.value?.length ?? 0);
const doneCount = computed(() => (achievements.value ?? []).filter((a) => a.done).length);
const donePct = computed(() => (totalCount.value ? Math.round((doneCount.value / totalCount.value) * 100) : 0));
const openList = computed(() => (achievements.value ?? []).filter((a) => !a.done));
function countCat(c) {
  return openList.value.filter((a) => a.cat === c).length;
}

function matchesFilter(a) {
  if (FILTER.status === "open" && a.done) return false;
  if (FILTER.status === "done" && !a.done) return false;
  if (FILTER.world >= 0 && a.world !== FILTER.world) return false;
  if (FILTER.cat !== "all" && a.cat !== FILTER.cat) return false;
  if (FILTER.q && !(a.name + " " + a.desc).toLowerCase().includes(FILTER.q)) return false;
  return true;
}
/* attainability sort: pinned > partial progress (closest first) > untracked easy > by world */
function sortOpen(x, y) {
  const px = pins.has(x.i) ? 1 : 0, py = pins.has(y.i) ? 1 : 0;
  if (px !== py) return py - px;
  const fx = x.frac ?? -1, fy = y.frac ?? -1;
  if (fx !== fy) return fy - fx;
  return x.world - y.world || x.i - y.i;
}

const visible = computed(() => (achievements.value ?? []).filter(matchesFilter));
const openVisible = computed(() => visible.value.filter((a) => !a.done));
const doneVisible = computed(() => visible.value.filter((a) => a.done));
const pinnedOpen = computed(() => openVisible.value.filter((a) => pins.has(a.i)).sort(sortOpen));
function catItems(key) {
  return openVisible.value.filter((a) => a.cat === key && !pins.has(a.i)).sort(sortOpen);
}

/* One combined section list — pinned, then each non-empty category (respecting the cat filter),
 * then (independently of FILTER.status==="open") the Done section — mirrors legacy renderLists()'s
 * two back-to-back innerHTML blocks, but as one array so the row markup below is written once. */
const sections = computed(() => {
  const secs = [];
  if (FILTER.status !== "done") {
    if (pinnedOpen.value.length) secs.push({ key: "pinned", title: "★ Pinned", hint: `${pinnedOpen.value.length}`, items: pinnedOpen.value });
    for (const [key, title, hint] of CATS) {
      if (FILTER.cat !== "all" && FILTER.cat !== key) continue;
      const items = catItems(key);
      if (items.length) secs.push({ key, title, hint: `${items.length} — ${hint}`, items });
    }
  }
  if (FILTER.status !== "open") {
    secs.push({ key: "done", title: "Done", hint: `${doneVisible.value.length}`, items: doneVisible.value });
  }
  return secs;
});
const showEmptyNote = computed(() => FILTER.status !== "done" && sections.value.every((s) => s.key === "done"));
</script>

<template>
  <header class="app">
    <h1>Achievements</h1>
  </header>
  <div
    id="err"
    class="err"
  />

  <p
    v-if="!achievements"
    id="noData"
  >
    No save data found — open the <RouterLink
      :to="{ name: 'data' }"
      style="color:var(--series-1)"
    >
      Data page
    </RouterLink> first (sync or import a savegame.json there).
  </p>

  <template v-else>
    <div class="cards">
      <div class="tile">
        <div class="label">
          Completed
        </div>
        <div class="value">
          {{ doneCount }} / {{ totalCount }}
        </div>
        <div class="sub">
          {{ donePct }}% · 850-pt Tome line
        </div>
      </div>
      <div class="tile">
        <div class="label">
          Missions &amp; stacks
        </div>
        <div class="value">
          {{ countCat("active") + countCat("stack") + countCat("dungeon") }}
        </div>
        <div class="sub">
          doable sessions — tips included
        </div>
      </div>
      <div class="tile">
        <div class="label">
          Minigames
        </div>
        <div class="value">
          {{ countCat("minigame") }}
        </div>
        <div class="sub">
          skill challenges, own category
        </div>
      </div>
      <div class="tile">
        <div class="label">
          Runs on its own
        </div>
        <div class="value">
          {{ countCat("idle") + countCat("grind") }}
        </div>
        <div class="sub">
          idle timers + background grinds
        </div>
      </div>
    </div>

    <div class="controls">
      <div class="tabs">
        <button
          class="f"
          :class="{ active: FILTER.status === 'open' }"
          @click="FILTER.status = 'open'"
        >
          Open
        </button>
        <button
          class="f"
          :class="{ active: FILTER.status === 'done' }"
          @click="FILTER.status = 'done'"
        >
          Done
        </button>
        <button
          class="f"
          :class="{ active: FILTER.status === 'all' }"
          @click="FILTER.status = 'all'"
        >
          All
        </button>
      </div>
      <div class="worlds">
        <button
          class="f"
          :class="{ active: FILTER.world === -1 }"
          @click="FILTER.world = -1"
        >
          All worlds
        </button>
        <button
          v-for="w in WORLD_TABS"
          :key="w.v"
          class="f"
          :class="{ active: FILTER.world === w.v }"
          @click="FILTER.world = w.v"
        >
          {{ w.label }}
        </button>
      </div>
      <div class="worlds">
        <button
          class="f"
          :class="{ active: FILTER.cat === 'all' }"
          @click="FILTER.cat = 'all'"
        >
          All types
        </button>
        <button
          v-for="[key, label] in CAT_TABS"
          :key="key"
          class="f"
          :class="{ active: FILTER.cat === key }"
          @click="FILTER.cat = key"
        >
          {{ label }}
        </button>
      </div>
      <input
        v-model="FILTER.q"
        type="text"
        placeholder="search…"
      >
    </div>

    <div id="lists">
      <section
        v-for="sec in sections"
        :key="sec.key"
        class="panel"
      >
        <h2>
          {{ sec.title }} <span class="hint">{{ sec.hint }}</span>
        </h2>
        <div
          v-for="a in sec.items"
          :key="a.i"
          class="ach"
        >
          <button
            class="pin"
            :class="{ on: pins.has(a.i) }"
            title="pin"
            @click="togglePin(a.i)"
          >
            {{ pins.has(a.i) ? "★" : "☆" }}
          </button>
          <div :class="['st', { done: a.done }]">
            {{ a.done ? "✓" : "·" }}
          </div>
          <div class="body">
            <div class="nm">
              {{ a.name }}
              <span
                v-if="'steam' in a"
                class="tag"
              >steam</span>
              <span
                v-if="a.secret"
                class="tag"
              >secret</span>
              <span class="tag">W{{ a.world + 1 }}</span>
            </div>
            <div class="desc">
              {{ a.desc }}
            </div>
            <div
              v-if="!a.done && a.tip"
              class="desc"
              style="margin-top:4px;color:var(--ink-1)"
            >
              <span style="color:var(--warning)">💡</span> {{ a.tip }}
            </div>
          </div>
          <div class="prog">
            <template v-if="!a.done && a.qty">
              <div class="pct">
                {{ plain(a.prog || 0) }} / {{ plain(a.qty) }}
              </div>
              <div class="bar-bg">
                <div
                  class="bar-fill"
                  :style="{ width: ((a.frac || 0) * 100).toFixed(1) + '%' }"
                />
              </div>
            </template>
            <div
              v-else-if="!a.done && a.prog > 0"
              class="pct"
            >
              progress: {{ plain(a.prog) }}
            </div>
          </div>
        </div>
      </section>
      <section
        v-if="showEmptyNote"
        class="panel"
      >
        <div class="empty-note">
          Nothing here — filters hide everything, or you've cleared them all. 🎉
        </div>
      </section>
    </div>
    <p class="foot">
      Grouped by <b>how you actually finish them</b>: active missions (one session + the right
      strategy — tips included), skill minigames, dungeon runs, exact storage stacks, background
      grinds, and ones that finish themselves while you idle. Steam-exclusive achievements are
      read from your Steam achievement data. Pin (☆) anything to keep it on top.
    </p>
  </template>
</template>

<style scoped>
/* achievements.html-specific (companion.css inline block) — page-unique, not promoted to
 * src/styles/base.css since no other src/ui/** component needs it yet. Includes the tab-button
 * look (button.f/.f.active) that companion.css defined globally but base.css didn't port. */
.tabs, .worlds { display: flex; gap: 6px; margin-bottom: 0; flex-wrap: wrap; }
.f { background: var(--well); border: 1.5px solid var(--border); border-radius: 999px; color: var(--ink-2); padding: 3px 12px; font: inherit; font-size: 12.5px; font-weight: 650; cursor: pointer; }
.f.active { border-color: var(--accent); color: var(--accent); }
.controls { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; margin-bottom: 12px; }
.controls input { width: 180px; }
.ach { display: flex; gap: 12px; padding: 9px 2px; border-top: 1px solid var(--grid); align-items: flex-start; }
.ach:first-of-type { border-top: none; }
.ach .st { flex: none; width: 20px; text-align: center; font-size: 14px; margin-top: 1px; }
.ach .st.done { color: var(--good); }
.ach .body { flex: 1; min-width: 0; }
.ach .nm { font-weight: 700; font-size: 13.5px; }
.ach .nm .tag { font-size: 10.5px; font-weight: 600; border: 1px solid var(--border); color: var(--ink-muted); border-radius: 5px; padding: 0 5px; margin-left: 6px; vertical-align: 1px; }
.ach .desc { color: var(--ink-2); font-size: 12.5px; margin-top: 1px; }
.ach .prog { flex: none; width: 180px; text-align: right; }
.ach .prog .pct { font-size: 12.5px; font-variant-numeric: tabular-nums; color: var(--ink-2); }
.ach .bar-bg { margin-top: 5px; height: 7px; }
.pin { flex: none; background: none; border: none; color: var(--baseline); cursor: pointer; font-size: 15px; padding: 0 2px; margin-top: 1px; }
.pin.on { color: var(--warning); }
.empty-note { color: var(--ink-muted); font-size: 12.5px; padding: 12px 0; }
#noData { text-align: center; padding: 60px 0; color: var(--ink-2); }
section.panel h2 { font-size: 13.5px; }
.foot { color: var(--ink-muted); font-size: 12px; margin: 14px 0 30px; }
</style>
