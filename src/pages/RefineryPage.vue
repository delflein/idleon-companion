<script setup>
/**
 * RefineryPage — the refinery.html port. Legacy refinery.html is a KPI tile + one bespoke panel
 * (bay cycle-time "lever" list, per-salt rank/power/fuel table, Salt Lick upgrade table) ahead of
 * the generic `refineryCycle` recipe module (docs/migration/survey-pages.md: "entities.w3.refinery
 * (cycleSpeed, cycles[], salts[], saltLickUpgrades); GLOSS.saltLickEffects; stats.refineryCycle").
 * `w3Glossary()` is pure/static (src/data/derived.js re-exports it verbatim) — no save parsing,
 * same payload every call.
 */
import { computed } from "vue";
import { state, entities, stats, useHistory } from "../data/appState.js";
import { w3Glossary } from "../data/derived.js";
import StatModule from "../ui/StatModule.vue";
import LevelBar from "../ui/LevelBar.vue";
import SpriteIcon from "../ui/SpriteIcon.vue";
import { fmt, niceItem } from "../ui/fmt.js";

const BAY_NAMES = ["Combustion", "Synthesis", "Polymerize"];

const charNames = computed(() => state.value?.charNames ?? []);
const w3 = computed(() => entities.value?.w3 ?? null);
const refinery = computed(() => w3.value?.refinery ?? null);

/* Refinery bay base-cycle seconds divided by the account's cycleSpeed multiplier — a STATIC
 * planning number ("at current speed, a Combustion cycle takes ~11m"), never a live countdown;
 * pure arithmetic on the already-computed cycleSpeed, not new domain logic (survey-pages.md:
 * "fmtDuration() is pure arithmetic on server-supplied cycleSpeed, not new logic"), so it stays a
 * page-local presentational helper rather than a src/core module. */
function fmtDuration(sec) {
  if (sec == null || !isFinite(sec) || sec <= 0) return "—";
  if (sec < 60) return Math.round(sec) + "s";
  const min = sec / 60; if (min < 60) return min.toFixed(1) + "m";
  const hr = min / 60; if (hr < 48) return hr.toFixed(1) + "h";
  return (hr / 24).toFixed(1) + "d";
}
function cycleAtSpeed(c) {
  return fmtDuration(c.baseCycleSeconds / Math.max(0.01, refinery.value.cycleSpeed));
}

/* Salt raw-name -> display-name map, for the fuel-cost itemlist (legacy SALT_NAME_BY_RAW). */
const saltNameByRaw = computed(() => Object.fromEntries((refinery.value?.salts ?? []).map((s) => [s.rawName, s.name])));

const GLOSS = w3Glossary();
function saltLickEffectOf(u) {
  const g = GLOSS.saltLickEffects.find((e) => e.i === u.i);
  return g ? g.effect : "";
}

const refineryCycleStat = computed(() => stats.value?.refineryCycle ?? null);

const historyKeys = computed(() => {
  const st = refineryCycleStat.value;
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
    <h1>Refinery</h1>
  </header>
  <div
    id="err"
    class="err"
  />

  <template v-if="w3">
    <div class="cards">
      <div class="tile">
        <SpriteIcon
          file="Refinery3"
          dir="data"
          :size="28"
        />
        <div class="label">
          Refinery cycle speed
        </div>
        <div class="value">
          {{ (refinery.cycleSpeedLowerBound ? "≥ " : "") + "×" + fmt(refinery.cycleSpeed) }}
        </div>
        <div class="sub">
          Polymerize-bay multiplier
        </div>
      </div>
    </div>

    <section class="panel">
      <h2>
        <SpriteIcon
          file="Refinery3"
          dir="data"
          :size="20"
        />
        Refinery
        <span class="hint">
          Refine salts into upgrade materials over time — rank/power progress per salt, and the
          account-wide cycle-speed multiplier that shrinks every bay's cycle time.
          <span
            class="tip"
            title="Each salt slowly accumulates POWER every refinery cycle; filling the power bar advances that salt's RANK, which unlocks cheaper/better crafting recipes using it. Power requirement grows with rank."
          >ⓘ</span>
        </span>
      </h2>
      <div
        v-if="refinery.cycleSpeedLowerBound"
        class="lowerbound"
      >
        <b>Lower bound.</b> Some cycle-speed sources aren't derivable from the save yet — see the
        breakdown below. Real speed is higher (cycles are actually faster/shorter than shown).
      </div>
      <div
        class="cards"
        style="margin-bottom:10px"
      >
        <div class="tile">
          <SpriteIcon
            file="Refinery3"
            dir="data"
            :size="28"
          />
          <div class="label">
            Cycle speed
          </div>
          <div class="value">
            {{ (refinery.cycleSpeedLowerBound ? "≥ " : "") + "×" + fmt(refinery.cycleSpeed) }}
          </div>
          <div class="sub">
            <a href="#mod_refineryCycle">full breakdown ↓</a>
          </div>
        </div>
      </div>

      <h2 class="subhead">
        Bay cycle times <span class="of">static rate at current speed — not a live countdown</span>
      </h2>
      <div
        class="levers"
        style="margin-bottom:14px"
      >
        <div
          v-for="c in refinery.cycles"
          :key="c.bay"
          class="lever"
        >
          <span class="lname">{{ c.name }}</span>
          <span />
          <span class="lval">base {{ fmtDuration(c.baseCycleSeconds) }} → {{ cycleAtSpeed(c) }} at current speed</span>
        </div>
      </div>

      <h2 class="subhead">
        Salts
      </h2>
      <div class="scroll">
        <table>
          <tr>
            <th>Salt</th><th>Bay</th><th>Rank</th><th>Power progress</th><th>Fuel per craft</th>
          </tr>
          <tr
            v-for="s in refinery.salts"
            :key="s.index"
            :class="{ dim: s.unreleased }"
          >
            <td>
              <SpriteIcon
                :file="'Refinery' + (s.index + 1)"
                dir="data"
                :size="22"
              /> <b>{{ s.name }}</b>
              <span
                v-if="s.unreleased"
                class="chip soon"
              >not yet released</span>
            </td>
            <td>{{ BAY_NAMES[s.bay] || "bay " + s.bay }}</td>
            <td>Rank {{ s.rank }}</td>
            <td>
              <span
                v-if="s.powerPct == null"
                class="note"
              >rank maxed</span>
              <template v-else>
                {{ fmt(s.power) }}<span class="of">/{{ fmt(s.powerToNextRank) }}</span>
                <div
                  class="bar-bg"
                  style="margin-top:3px"
                >
                  <div
                    class="bar-fill"
                    :style="{ width: Math.max(0, Math.min(100, s.powerPct)) + '%' }"
                  />
                </div>
              </template>
            </td>
            <td>
              <div class="itemlist">
                <span
                  v-for="(f, i) in s.fuel"
                  :key="i"
                >{{ niceItem(saltNameByRaw[f.item] || f.item) }} ×{{ fmt(f.qty) }}</span>
              </div>
            </td>
          </tr>
        </table>
      </div>

      <h2
        class="subhead"
        style="margin-top:14px"
      >
        Salt Lick upgrades
        <span
          class="tip"
          title="A separate Construction tower that spends refinery salts (and other W3 resources) for one-time account bonuses — distinct from the salts' own rank progression above."
        >ⓘ</span>
      </h2>
      <div class="scroll">
        <table>
          <tr>
            <th>Upgrade</th><th>Level</th><th>Effect</th>
          </tr>
          <tr
            v-for="u in refinery.saltLickUpgrades"
            :key="u.i"
          >
            <td><b>{{ u.name }}</b></td>
            <td>
              <LevelBar
                :level="u.level"
                :max-level="u.maxLevel"
              />
            </td>
            <td class="note">
              {{ saltLickEffectOf(u) }}
            </td>
          </tr>
        </table>
      </div>
    </section>
  </template>
  <p
    v-else
    class="note"
  >
    No <code>w3</code> entity on this snapshot yet.
  </p>

  <StatModule
    id="mod_refineryCycle"
    :stat="refineryCycleStat"
    title="Refinery Cycle Speed"
    :icon="{ file: 'Refinery3', dir: 'data' }"
    blurb="Every source that shortens a refinery cycle — vials, Salt Lick, family, sigil, stamps, shinies, Construction Mastery, arcade, vote, research grid, Lab chip, Legend Talent."
    :char-names="charNames"
    :series="series"
  />
</template>

<style scoped>
/* refinery.html-specific (companion.css inline block) — page-unique, not promoted to
 * src/styles/base.css since no other src/ui/** component needs it yet. */
.subhead { font-size: 13px; margin: 4px 0 8px; }
.tip { cursor: help; color: var(--accent); font-weight: 700; border-bottom: 1px dotted var(--accent); }
.itemlist { display: flex; flex-direction: column; gap: 2px; }
.itemlist span { font-size: 12.5px; }
.levers { display: grid; grid-template-columns: minmax(130px, auto) 1fr auto; gap: 8px 12px; align-items: center; }
.lever { display: contents; }
.lname { font-size: 13px; color: var(--ink-2); font-weight: 650; }
.lval { text-align: right; font-variant-numeric: tabular-nums; font-size: 13px; font-weight: 800; }
</style>
