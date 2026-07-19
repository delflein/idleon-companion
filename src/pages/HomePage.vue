<script setup>
// M4 UI-KIT DEMO PAGE. This replaces the M1 "core: N recipes loaded" stub with a demo of the
// shared components built in this package (src/ui/**) — StatModule, DataTable, Sparkline,
// TimeChart. Real pages (mining.html -> src/pages/MiningPage.vue, etc.) land in M5, wired to
// live /api-equivalent data from src/core + src/data; everything below is STATIC FIXTURE DATA,
// not a live save. The fixture's stat object shape is copied verbatim from what
// src/core/stats/index.mjs's evaluatePerChar() produces (see src/core/stats/engine.mjs and
// companion.mjs's GET /api/stats handler, which is the same shape over the wire):
//   { name, label, format, display, byChar, collapsed, sensitive }
// where `collapsed` / each `byChar[].result` is
//   { value, additivePoolPct, multiplicative, terms, unknown, lowerBound }.

// M2 proof-of-bundle: a deliberate, temporary import of the ported framework-free core (see
// docs/ARCHITECTURE.md M2) — proves the whole src/core/ + src/gamedata/ tree bundles under Vite,
// not just node --check. Remove once a real page imports the core for its own reasons.
import { RECIPES } from "../core/stats/index.mjs";

import StatModule from "../ui/StatModule.vue";
import DataTable from "../ui/DataTable.vue";
import Sparkline from "../ui/Sparkline.vue";
import TimeChart from "../ui/TimeChart.vue";

/* ---------------------------------------------------------------------------------------------
 * Fixture: one recipe's worth of terms, built twice — once "collapsed" (per-char terms sit at
 * their neutral element, honestly unknown-until-you-pick-a-character) and once per character
 * (resolved). Mirrors src/core/stats/mining-eff.mjs's actual shape/status vocabulary
 * ("computed" | "unknown" | "per-char" | "user-supplied"), not a real evaluation.
 * ------------------------------------------------------------------------------------------- */
function buildTerms({ miningLvl = null, brute85 = null } = {}) {
  const resolved = miningLvl != null;
  return [
    { id: "toolPower", key: "ItemDef[pickaxe].Weapon_Power + EquipmentMap[1][0].Weapon_Power",
      kind: "add", value: 0, status: "unknown",
      note: "worn pickaxe power not in the save — the single biggest gap; lower bound." },
    { id: "miningLvl", key: "Lv0[1] mining level", kind: "add", value: miningLvl ?? 0,
      status: resolved ? "computed" : "per-char",
      note: resolved ? `mining level ${miningLvl}` : "resolved in the per-character view" },
    { id: "baseFlat4", key: "flat +4", kind: "add", value: 4, status: "computed",
      note: "always-on mining base." },
    { id: "brute85", key: "GetTalentNumber(1,85) Brute Efficiency", kind: "add", value: brute85 ?? 0,
      status: resolved ? "computed" : "per-char",
      note: resolved ? "talent points invested" : "resolved in the per-character view" },
    { id: "copperSet", key: "GetSetBonus(\"COPPER_SET\",\"Bonus\",0,0)", kind: "add", value: 0,
      status: "computed", note: "Copper armour set not currently worn — locked, not contributing." },
    { id: "userOverride", key: "user-read screen value (example)", kind: "add", value: 15,
      status: "user-supplied", note: "supplied by caller, not derived from the save." },
    { id: "allEfficiencies", key: "SkillStats(\"AllEfficiencies\")", kind: "mul", value: 1.18,
      status: "computed", note: "family, Frost Relic, cards, summoning winner, guild, prayers.",
      parts: [
        { label: "Family bonus", value: 1.04 },
        { label: "Frost Relic", value: 1.02 },
        { label: "Card set", value: 1.03 },
      ] },
    { id: "extraMinEff", key: "DNSM.ExtraMinEff (BIG PICK)", kind: "mul", value: 1,
      status: "computed", note: "Big Pick factor not modelled (neutral ×1)." },
  ];
}

const DISPLAY = {
  toolPower: { label: "Pickaxe power", where: "Equipped pickaxe (+ its upgrades)" },
  miningLvl: { label: "Mining level", where: "Mining skill" },
  baseFlat4: { label: "Base +4", where: "Always on" },
  brute85: { label: "Talent: Brute Efficiency", where: "Character talents" },
  copperSet: { label: "Copper armour set", where: "Armor sets" },
  userOverride: { label: "User-supplied example", where: "Read off your own screen" },
  allEfficiencies: { label: "All Skill Efficiency (shared multiplier)", where: "Shared eff chain" },
  extraMinEff: { label: "Big Pick", where: "Mining" },
};

/** Mirrors engine.mjs's `defaultCombine` — most recipes use it; a few (mining-eff among them)
 *  override `combine()` with the client's real nested expression. This fixture keeps the
 *  generic form since it only needs to look structurally right, not match N.js exactly. */
const poolOf = (terms) => terms.filter((t) => t.kind === "add").reduce((a, t) => a + t.value, 0);
const mulOf = (terms) => terms.filter((t) => t.kind === "mul").reduce((a, t) => a * t.value, 1);
const combine = (terms) => (1 + poolOf(terms) / 100) * mulOf(terms);

const collapsedTerms = buildTerms();
const char0Terms = buildTerms({ miningLvl: 45, brute85: 8 });
const char1Terms = buildTerms({ miningLvl: 52, brute85: 5 });

const MOCK_STAT = {
  name: "miningEffDemo",
  label: "Mining Efficiency",
  format: "multiplier",
  display: DISPLAY,
  sensitive: true,
  byChar: [
    { charIdx: 0, result: {
      value: combine(char0Terms), additivePoolPct: poolOf(char0Terms), multiplicative: mulOf(char0Terms),
      terms: char0Terms,
      unknown: ["worn pickaxe power not in the save — the single biggest gap; lower bound."],
      lowerBound: true,
    } },
    { charIdx: 1, result: {
      value: combine(char1Terms), additivePoolPct: poolOf(char1Terms), multiplicative: mulOf(char1Terms),
      terms: char1Terms,
      unknown: ["worn pickaxe power not in the save — the single biggest gap; lower bound."],
      lowerBound: true,
    } },
  ],
  collapsed: {
    value: combine(collapsedTerms), additivePoolPct: poolOf(collapsedTerms), multiplicative: mulOf(collapsedTerms),
    terms: collapsedTerms,
    unknown: [
      "worn pickaxe power not in the save — the single biggest gap; lower bound.",
      "account view only: per-character terms (mining level, Brute Efficiency) sit at their " +
      "neutral element here — pick a character to resolve them.",
    ],
    lowerBound: true,
  },
};
const CHAR_NAMES = ["Reaper", "Mage"];

/* Fake history for the StatModule's per-term sparklines — same shape as /api/history's
 * `series[key]`: [{ts, v}]. */
const DAY_MS = 86_400_000;
const today = Date.UTC(2026, 6, 19);
const trend = (start, step, n) => Array.from({ length: n }, (_, i) => ({ ts: today - (n - 1 - i) * DAY_MS, v: +(start + step * i).toFixed(2) }));
const SERIES = {
  "stat.miningEffDemo.allEfficiencies": trend(1.05, 0.012, 10),
  "stat.miningEffDemo.baseFlat4": trend(4, 0, 10),
};

/* ---------------------------------------------------------------------------------------------
 * DataTable demo fixture — a small sortable roster, exercising the sailing.html click-header-
 * to-sort pattern DataTable ports.
 * ------------------------------------------------------------------------------------------- */
const CHAR_ROWS = [
  { name: "Reaper", cls: "Death Bringer", level: 412, skillsLv: 3180 },
  { name: "Mage", cls: "Bubonic Conjuror", level: 398, skillsLv: 3025 },
  { name: "Archer", cls: "Mayheim", level: 405, skillsLv: 2990 },
  { name: "Squire", cls: "Divine Knight", level: 388, skillsLv: 2870 },
];
const CHAR_COLUMNS = [
  { key: "name", label: "Character", get: (r) => r.name },
  { key: "cls", label: "Class", get: (r) => r.cls },
  { key: "level", label: "Level", get: (r) => r.level, numeric: true },
  { key: "skillsLv", label: "Skills LV", get: (r) => r.skillsLv, numeric: true },
];

/* Sparkline standalone demo (StatModule already exercises Sparkline internally, per term). */
const SPARK_POINTS = trend(100, 6, 12);

/* TimeChart demo — two synthetic series sharing a timeline, e.g. "current" vs "coverage". */
const TIME_SERIES = {
  value: trend(1.2, 0.02, 21),
  coverage: trend(4, 0.15, 21),
};
const TIME_LABELS = { value: "Mining Efficiency", coverage: "Coverage" };
</script>

<template>
  <section>
    <h2>UI Kit demo — M4</h2>
    <p class="note">
      This page is the <b>M4 demo</b>: it renders the shared components from <code>src/ui/</code>
      against hardcoded fixture data shaped exactly like a real <code>/api/stats</code> entry —
      there is no save loaded here. Real per-system pages (mining, sneaking, sailing, ...) land in
      <b>M5</b>, replacing the legacy root <code>*.html</code> files one at a time and wiring
      these same components to live data from <code>src/core</code> + <code>src/data</code>.
    </p>
    <p class="note">
      core: {{ RECIPES.length }} recipes loaded
    </p>
    <p class="note">
      <RouterLink to="/sync-spike">
        Sync spike
      </RouterLink> (M1) is still here — verifies the CORS-facing save-sync network calls.
    </p>

    <h3 style="margin:18px 0 8px">
      StatModule
    </h3>
    <StatModule
      :stat="MOCK_STAT"
      :icon="{ file: 'Copper', dir: 'afk_targets' }"
      blurb="Fixture data — every source that speeds up mining, per character."
      :char-names="CHAR_NAMES"
      :series="SERIES"
    />

    <h3 style="margin:18px 0 8px">
      StatModule — pending state
    </h3>
    <StatModule
      :stat="null"
      title="Choppin Efficiency"
      :icon="{ file: 'Oak_Tree', dir: 'afk_targets' }"
      blurb="Every source that speeds up choppin."
    />

    <h3 style="margin:18px 0 8px">
      DataTable
    </h3>
    <DataTable
      :columns="CHAR_COLUMNS"
      row-key="name"
      :rows="CHAR_ROWS"
    />

    <h3 style="margin:18px 0 8px">
      Sparkline
    </h3>
    <p><Sparkline :points="SPARK_POINTS" /> — 12 synthetic points, trending up.</p>

    <h3 style="margin:18px 0 8px">
      TimeChart
    </h3>
    <TimeChart
      :series="TIME_SERIES"
      :labels="TIME_LABELS"
      title="Synthetic history (uPlot)"
    />
  </section>
</template>
