<script setup>
/**
 * WeeklyPage — the weekly.html port (Vote Ballot / Meritocracy / Killroy / Islands). Legacy
 * weekly.html has no recipe module at all (docs/migration/survey-pages.md: "entities.w2.{ballot,
 * killroy,islands} ... GLOSS.fractalThresholds ... no fetch to /api/stats") — three independent,
 * sortable/show-more-capped panels built straight off entities.w2. `cleanDesc()` is a text-cleaner
 * (N.js flavor text uses "{"/"}"and"_" — see the module comment below), not game logic.
 *
 * SHAPE RESOLUTION (per the migration brief): legacy weekly.html tolerated TWO shapes of
 * `entities.w2.islands` — a bare array (older snapshots) and `{list, fractalAfkHours}` (current).
 * src/core/domain.mjs (see the w2.islands assignment, "NOTE: fractalAfkHours MUST live inside this
 * object") ALWAYS emits the `{list, fractalAfkHours}` object shape now — deriveEntities recomputes
 * fresh from the save on every read, there is no persisted legacy-array snapshot in the SPA's data
 * model to be compatible with. So this page supports ONLY the current object shape and drops the
 * `Array.isArray(islObj)` fallback entirely.
 */
import { ref, computed } from "vue";
import { entities } from "../data/appState.js";
import { w2Glossary } from "../data/derived.js";
import ShowMore from "../ui/ShowMore.vue";
import Chip from "../ui/Chip.vue";
import SpriteIcon from "../ui/SpriteIcon.vue";
import { fmt } from "../ui/fmt.js";

const GLOSS = w2Glossary();

/* Raw N.js flavor text used directly off entities (ballot categories, islands) still carries
 * "{"/"}" value-placeholders and "_" for spaces — glossary text is pre-cleaned server-side
 * (stats/w2-report.mjs), but entity-sourced text (ballot, killroy, islands) is not, so this page
 * cleans it the same way legacy weekly.html/stamps.html did. */
function cleanDesc(s) {
  return String(s ?? "").replace(/[{}]/g, "").replace(/_/g, " ").replace(/\s+/g, " ").trim();
}

const w2 = computed(() => entities.value?.w2 ?? null);
const ballot = computed(() => w2.value?.ballot ?? null);
const killroy = computed(() => w2.value?.killroy ?? null);
/* Current-shape-only (see module comment): entities.w2.islands is always { list, fractalAfkHours }. */
const islandsObj = computed(() => w2.value?.islands ?? null);
const islands = computed(() => islandsObj.value?.list ?? []);
const islandsUnlocked = computed(() => islands.value.filter((i) => i.unlocked).length);
const fractalHours = computed(() => (typeof islandsObj.value?.fractalAfkHours === "number" ? islandsObj.value.fractalAfkHours : null));

const thresholds = computed(() => GLOSS.fractalThresholds || []);
const nextThresholdIdx = computed(() => (fractalHours.value == null ? -1 : thresholds.value.findIndex((t) => t > fractalHours.value)));
const nextThreshold = computed(() => (nextThresholdIdx.value === -1 ? null : thresholds.value[nextThresholdIdx.value]));
const prevThresholdsDone = computed(() => (fractalHours.value == null ? 0 : thresholds.value.filter((t) => t <= fractalHours.value).length));

/* ---- Vote Ballot + Meritocracy: sort-by-select, cap+show-more (legacy VOTE_SORT/MERIT_SORT) ---- */
const voteSort = ref("idx"); // "idx" | "base"
const meritSort = ref("idx");

const voteAll = computed(() => (ballot.value?.vote.categories ?? []).slice()
  .sort((x, y) => (voteSort.value === "base" ? y.baseValue - x.baseValue : x.idx - y.idx)));
const meritAll = computed(() => (ballot.value?.meritocracy.categories ?? []).slice()
  .sort((x, y) => (meritSort.value === "base" ? y.baseValue - x.baseValue : x.idx - y.idx)));

/* ---- Killroy shop: cheapest first (legacy default, no user sort control) ---- */
const killroyShop = computed(() => (killroy.value?.shop ?? []).slice().sort((a, b) => a.skullCost - b.skullCost));
</script>

<template>
  <header class="app">
    <h1>Weekly (Ballot/Killroy/Islands)</h1>
  </header>
  <div
    id="err"
    class="err"
  />

  <template v-if="w2">
    <div class="cards">
      <div class="tile">
        <SpriteIcon
          file="KillsSkull"
          dir="data"
          :size="28"
        />
        <div class="label">
          Skulls banked
        </div>
        <div class="value">
          {{ fmt(killroy.skulls) }}
        </div>
        <div class="sub">
          spend in the Killroy shop below
        </div>
      </div>
      <div class="tile">
        <SpriteIcon
          file="VoteBG"
          dir="data"
          :size="28"
        />
        <div class="label">
          Meritocracy voting
        </div>
        <div class="value">
          {{ ballot.canVote ? "unlocked" : "locked" }}
        </div>
        <div class="sub">
          weekly-rotating account bonuses
        </div>
      </div>
      <div class="tile">
        <SpriteIcon
          file="IslandSail5"
          dir="data"
          :size="28"
        />
        <div class="label">
          Islands unlocked
        </div>
        <div class="value">
          {{ islandsUnlocked }}<span class="of">/{{ islands.length }}</span>
        </div>
        <div class="sub">
          {{ fractalHours == null ? "Fractal AFK hours n/a" : `${fmt(fractalHours)} Fractal AFK hrs banked` }}
        </div>
      </div>
    </div>

    <section class="panel">
      <h2>
        <SpriteIcon
          file="VoteBG"
          dir="data"
          :size="20"
        />
        Vote Ballot &amp; Meritocracy
        <span class="hint">Weekly-rotating account bonuses. Meritocracy's selection is stored in your save; the Vote Ballot's active category is runtime server state captured at sync time.</span>
      </h2>
      <div class="chipbar">
        <Chip
          :variant="ballot.canVote ? 'live' : 'dead'"
          force
        >
          {{ ballot.canVote ? "Meritocracy voting unlocked" : "Meritocracy voting locked" }}
        </Chip>
      </div>

      <h2 class="subhead">
        Vote Ballot
      </h2>
      <div
        v-if="ballot.vote.active.idx != null"
        class="rec"
      >
        <b>Active vote:</b> {{ cleanDesc(ballot.vote.active.description) }} — base
        {{ fmt(ballot.vote.active.baseValue) }} × {{ fmt(ballot.vote.active.multi) }} bonus multi =
        <b>{{ fmt(ballot.vote.active.bonusValue) }}</b>
        <span
          v-if="ballot.vote.active.unread?.length"
          class="tip"
          :title="`${ballot.vote.active.unread.length} bonus source(s) not yet decoded (Cosmo/Palette/Legend/Sushi) — real multiplier is a lower bound.`"
        >ⓘ</span>
      </div>
      <div
        v-else
        class="rec none"
      >
        <b>Active vote not observed.</b> The Vote Ballot rotates weekly and isn't stored in your
        save — this repo reads it from a live sync's server-config snapshot; sync again while the
        ballot is showing in-game to capture it. Bonus multiplier from your own account sources:
        ×{{ fmt(ballot.vote.active.multi) }}.
      </div>
      <p class="note">
        All {{ voteAll.length }} categories — for planning which weeks are worth extra attention.
        <select
          v-model="voteSort"
          class="inlinesel"
        >
          <option value="idx">
            Sort by category #
          </option>
          <option value="base">
            Sort by base bonus
          </option>
        </select>
      </p>
      <ShowMore
        v-slot="{ items }"
        :items="voteAll"
        :cap="12"
      >
        <div class="scroll">
          <table>
            <tr>
              <th>Category</th><th class="num">
                Base bonus
              </th>
            </tr>
            <tr
              v-for="c in items"
              :key="c.idx"
              :class="{ dim: c.idx !== ballot.vote.active.idx }"
            >
              <td>
                <Chip
                  v-if="c.idx === ballot.vote.active.idx"
                  variant="live"
                  force
                >
                  active
                </Chip>
                <b>{{ cleanDesc(c.description) }}</b>
              </td>
              <td class="num">
                {{ fmt(c.baseValue) }}
              </td>
            </tr>
          </table>
        </div>
      </ShowMore>

      <h2
        class="subhead"
        style="margin-top:14px"
      >
        Meritocracy
      </h2>
      <div
        v-if="ballot.meritocracy.active"
        class="rec"
      >
        <b>Active Meritocracy:</b> {{ cleanDesc(ballot.meritocracy.active.description) }} — base
        {{ fmt(ballot.meritocracy.active.baseValue) }} → <b>{{ fmt(ballot.meritocracy.active.bonusValue) }}</b>
        <Chip :status="ballot.meritocracy.active.status" />
      </div>
      <div
        v-else
        class="rec none"
      >
        No Meritocracy category selected yet.
      </div>
      <p class="note">
        All {{ meritAll.length }} categories.
        <select
          v-model="meritSort"
          class="inlinesel"
        >
          <option value="idx">
            Sort by category #
          </option>
          <option value="base">
            Sort by base bonus
          </option>
        </select>
      </p>
      <ShowMore
        v-slot="{ items }"
        :items="meritAll"
        :cap="12"
      >
        <div class="scroll">
          <table>
            <tr>
              <th>Category</th><th class="num">
                Base bonus
              </th>
            </tr>
            <tr
              v-for="c in items"
              :key="c.idx"
              :class="{ dim: c.idx !== ballot.meritocracy.selectedIdx }"
            >
              <td>
                <Chip
                  v-if="c.idx === ballot.meritocracy.selectedIdx"
                  variant="live"
                  force
                >
                  active
                </Chip>
                <b>{{ cleanDesc(c.description) }}</b>
              </td>
              <td class="num">
                {{ fmt(c.baseValue) }}
              </td>
            </tr>
          </table>
        </div>
      </ShowMore>
    </section>

    <section class="panel">
      <h2>
        <SpriteIcon
          file="KillsSkull"
          dir="data"
          :size="20"
        />
        Killroy
        <span class="hint">Skulls drop from monster kills; spend them in the shop below — cheapest first.</span>
      </h2>
      <div
        class="cards"
        style="margin-bottom:10px"
      >
        <div class="tile">
          <SpriteIcon
            file="KillsSkull"
            dir="data"
            :size="28"
          />
          <div class="label">
            Skulls banked
          </div>
          <div class="value">
            {{ fmt(killroy.skulls) }}
          </div>
        </div>
        <div class="tile">
          <div class="label">
            Artifact Find bonus
          </div>
          <div class="value">
            ×{{ fmt(killroy.artifactFindBonus) }}
          </div>
          <div class="sub">
            from Killroy shop row 11
          </div>
        </div>
        <div class="tile">
          <div class="label">
            Crop Evolution bonus
          </div>
          <div class="value">
            ×{{ fmt(killroy.cropEvoBonus) }}
          </div>
          <div class="sub">
            from Killroy shop row 13
          </div>
        </div>
      </div>
      <ShowMore
        v-slot="{ items }"
        :items="killroyShop"
        :cap="12"
      >
        <div class="scroll">
          <table>
            <tr>
              <th>Reward</th><th class="num">
                Skull cost
              </th>
            </tr>
            <tr
              v-for="r in items"
              :key="r.idx"
            >
              <td>{{ cleanDesc(r.description) }}</td>
              <td class="num">
                {{ fmt(r.skullCost) }}
              </td>
            </tr>
          </table>
        </div>
      </ShowMore>
    </section>

    <section class="panel">
      <h2>
        <SpriteIcon
          file="IslandSail5"
          dir="data"
          :size="20"
        />
        Islands
        <span class="hint">The 6 W2 coastal minigame islands (unrelated to Sailing's islands) — unlocked once, then each runs its own daily/weekly shop.</span>
      </h2>
      <div class="scroll">
        <table>
          <tr>
            <th>Island</th><th>What it does</th><th>Status</th>
          </tr>
          <tr
            v-for="isl in islands"
            :key="isl.idx"
          >
            <td>
              <SpriteIcon
                :file="'IslandSail' + isl.idx"
                dir="data"
                :size="22"
              /> <b>{{ isl.name }}</b>
            </td>
            <td class="note">
              {{ cleanDesc(isl.description) }}
            </td>
            <td>
              <Chip
                :variant="isl.unlocked ? 'live' : 'dead'"
                force
              >
                {{ isl.unlocked ? "unlocked" : "locked" }}
              </Chip>
            </td>
          </tr>
        </table>
      </div>
      <div
        class="cards"
        style="margin-top:10px"
      >
        <div class="tile">
          <SpriteIcon
            file="IslandSail5"
            dir="data"
            :size="28"
          />
          <div class="label">
            Fractal AFK hours <span
              class="tip"
              title="Time Candy dumped into the Fractal Island banks toward permanent account bonuses (e.g. Sailing artifact-find chance) at fixed hour thresholds — no daily action needed, it's a one-time deposit ladder."
            >ⓘ</span>
          </div>
          <div class="value">
            {{ fractalHours == null ? "—" : fmt(fractalHours) }}<span class="of">hrs banked</span>
          </div>
          <div class="sub">
            {{ fractalHours == null
              ? "not available on this snapshot (pre-fix entity) — re-sync to populate"
              : nextThreshold != null
                ? `${prevThresholdsDone}/${thresholds.length} thresholds cleared — next at ${fmt(nextThreshold)}h`
                : `all ${thresholds.length} thresholds cleared` }}
          </div>
        </div>
      </div>
    </section>
  </template>
  <p
    v-else
    class="note"
  >
    No <code>w2</code> entity on this snapshot yet.
  </p>
</template>

<style scoped>
.subhead { font-size: 13px; margin: 4px 0 8px; }
.tip { cursor: help; color: var(--accent); font-weight: 700; border-bottom: 1px dotted var(--accent); }
.chipbar { display: flex; flex-wrap: wrap; gap: 6px; margin: 6px 0 10px; }
.rec { border-left: 3px solid var(--accent); padding: 3px 0 3px 11px; margin: 2px 0 10px; font-size: 13px; }
.rec.none { border-left-color: var(--baseline); color: var(--ink-muted); }
.rec b { color: var(--ink-1); }
</style>
