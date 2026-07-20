<script setup>
/**
 * LeversPage — the levers.html port. Legacy levers.html bundles five small W7 leaf systems onto
 * one page — Zenith Market, Coral Reef, Clam Work, Advice Fish, and The Button
 * (docs/migration/survey-pages.md: "entities.w7.{zenith,coralReef,clamWork,adviceFish,button};
 * GLOSS text only" — no registered recipe, no /api/stats/history; "KPI sums are display
 * aggregation of already-known values", not page-local domain logic). Every number here comes
 * straight off `entities.w7` (src/core/domain.mjs) or the static `w7Glossary()` text — this page
 * only sums/zips/labels, exactly like the legacy renderer.
 *
 * DESCRIPTION SOURCING (matches legacy's `descOf[id] ?? entity.desc/name` fallback exactly):
 * `entities.w7`'s own per-row `desc`/`name` fields only run N.js text through `dash()` (underscore
 * -> space); they still contain unfilled "{"/"}"/"$"/"^"/"~" template placeholders for Coral
 * Kid/Reef Buildings/Dancing Coral/Clam upgrades. `w7Glossary()` supplies the FULLY CLEANED text
 * for those same rows, keyed by id — so this page prefers the glossary text and only falls back to
 * the entity's raw text if the glossary doesn't have that id (w7-report.mjs's documented reason
 * these two text sources coexist).
 */
import { computed } from "vue";
import { entities } from "../data/appState.js";
import { w7Glossary } from "../data/derived.js";
import SpriteIcon from "../ui/SpriteIcon.vue";
import { fmt } from "../ui/fmt.js";

const w7 = computed(() => entities.value?.w7 ?? null);
const GLOSS = w7Glossary();

const zenithLv = computed(() => (w7.value?.zenith.levels ?? []).reduce((a, r) => a + r.level, 0));
const coralLv = computed(() => {
  const cr = w7.value?.coralReef;
  if (!cr) return 0;
  return cr.coralKid.reduce((a, r) => a + r.level, 0) + cr.buildings.reduce((a, r) => a + r.level, 0);
});
const adviceLv = computed(() => (w7.value?.adviceFish.levels ?? []).reduce((a, r) => a + r.level, 0));

/* Known consumers of Zenith Market rows — cross-linked into the recipes that already read them
 * (see stats/kruk-bubbles.mjs "zenith4", stats/class-xp.mjs "zenith9", stats/statue-multi.mjs
 * "zenith", bonuses/holes.mjs lampBonus, bonuses/talents.mjs superTalentLvGiven). Display-only
 * cross-reference, not part of any recipe. Indexed by ROW POSITION (0-9), matching legacy. */
const ZENITH_CONSUMERS = {
  0: { label: "Statue Bonus Multiplier", to: "/stats?recipe=statueMulti" },
  2: { label: "Cavern Lamp bonus", to: "/cavern" },
  4: { label: "Bubble LVs / Day", to: "/stats?recipe=krukBubbles" },
  5: { label: "Super Talent points-given", to: null },
  9: { label: "Class EXP", to: "/stats?recipe=classXp" },
};

const zenithDescOf = computed(() => Object.fromEntries((GLOSS.zenithMarket ?? []).map((z) => [z.id, z.desc])));
const coralKidDescOf = computed(() => Object.fromEntries((GLOSS.coralKid ?? []).map((r) => [r.id, r.desc])));
const coralBldDescOf = computed(() => Object.fromEntries((GLOSS.coralBuildings ?? []).map((r) => [r.id, r.desc])));
const dancingCoralDescOf = computed(() => Object.fromEntries((GLOSS.dancingCoral ?? []).map((r) => [r.id, r.desc])));
const clamUpgDescOf = computed(() => Object.fromEntries((GLOSS.clamUpgrades ?? []).map((r) => [r.id, r.desc])));
const adviceFishDescOf = computed(() => Object.fromEntries((GLOSS.adviceFish ?? []).map((r) => [r.id, r.desc])));

const clamLadder = computed(() => w7.value?.clamWork.jobs ?? []);
const buttonTasks = computed(() => GLOSS.buttonTasks ?? []);

const CLAM_TOOLTIP_STYLE = "Mr. Musselini's job ladder — 9 promotions, each granting a fixed account-wide reward.";
const BUTTON_TOOLTIP = "Button_Task() indexes a 100-entry runtime shuffle table (CustomLists.Research[39]) that is procedurally assigned, not a static N.js literal — the currently active task can't be derived from the save alone, so it's honestly shown as unknown rather than guessed.";
const ZENITH_TOOLTIP = "ZenithMarketBonus(b) = floor(coeff x level), verbatim. No unread inputs — fully save-derivable.";
</script>

<template>
  <header class="app">
    <h1>Account Levers — W7</h1>
  </header>
  <div
    id="err"
    class="err"
  />
  <div class="caveat">
    Five small W7 leaf systems, one page each too thin to justify its own nav entry — Zenith
    Market, Coral Reef, Clam Work, Advice Fish, and The Button.
  </div>

  <template v-if="w7">
    <div class="cards">
      <div class="tile">
        <SpriteIcon
          file="ZenithBG"
          dir="data"
          :size="28"
        />
        <div class="label">
          Zenith Market levels
        </div>
        <div class="value">
          {{ fmt(zenithLv) }}
        </div>
        <div class="sub">
          summed across 10 rows
        </div>
      </div>
      <div class="tile">
        <div class="label">
          Coral Reef levels
        </div>
        <div class="value">
          {{ fmt(coralLv) }}
        </div>
        <div class="sub">
          Coral Kid + Reef buildings
        </div>
      </div>
      <div class="tile">
        <div class="label">
          Clam Work job
        </div>
        <div class="value">
          Lv {{ w7.clamWork.jobLevel }}<span class="of">/9</span>
        </div>
        <div class="sub">
          Mr. Musselini's promotion ladder
        </div>
      </div>
      <div class="tile">
        <div class="label">
          Advice Fish levels
        </div>
        <div class="value">
          {{ fmt(adviceLv) }}
        </div>
        <div class="sub">
          summed across 6 rows
        </div>
      </div>
      <div class="tile">
        <div class="label">
          Button presses
        </div>
        <div class="value">
          {{ fmt(w7.button.presses) }}
        </div>
        <div class="sub">
          cycles through {{ w7.button.tasksTotal }} possible tasks
        </div>
      </div>
    </div>

    <section class="panel">
      <h2>
        <SpriteIcon
          file="ZenithBG"
          dir="data"
          :size="20"
        />
        Zenith Market
        <span class="hint">
          The endgame statue-upgrade shop. 5 of its 10 rows already feed OTHER registered recipes
          on this site — those are cross-linked below.
          <span
            class="tip"
            :title="ZENITH_TOOLTIP"
          >ⓘ</span>
        </span>
      </h2>
      <div class="scroll">
        <table>
          <tr>
            <th>Row</th><th class="num">
              Level
            </th><th class="num">
              Bonus
            </th>
          </tr>
          <tr
            v-for="(r, i) in w7.zenith.levels"
            :key="i"
          >
            <td>
              <b>{{ r.id }}</b>
              <div
                v-if="zenithDescOf[i]"
                class="where"
              >
                {{ zenithDescOf[i] }}
              </div>
              <div
                v-if="ZENITH_CONSUMERS[i]"
                class="note"
              >
                feeds:
                <RouterLink
                  v-if="ZENITH_CONSUMERS[i].to"
                  :to="ZENITH_CONSUMERS[i].to"
                >
                  {{ ZENITH_CONSUMERS[i].label }}
                </RouterLink>
                <template v-else>
                  {{ ZENITH_CONSUMERS[i].label }}
                </template>
              </div>
            </td>
            <td class="num">
              {{ r.level }}<span class="of">/{{ r.maxLv }}</span>
            </td>
            <td class="num">
              {{ fmt(r.bonus) }}
            </td>
          </tr>
        </table>
      </div>
    </section>

    <section class="panel">
      <h2>
        <SpriteIcon
          file="CoralDiv"
          dir="data"
          :size="20"
        />
        Coral Reef
      </h2>
      <h2 class="subhead">
        Coral Kid upgrades
      </h2>
      <div class="scroll">
        <table>
          <tr>
            <th>Upgrade</th><th class="num">
              Level
            </th><th class="num">
              Bonus
            </th>
          </tr>
          <tr
            v-for="r in w7.coralReef.coralKid"
            :key="r.id"
          >
            <td><b>{{ coralKidDescOf[r.id] ?? r.desc }}</b></td>
            <td class="num">
              {{ fmt(r.level) }}
            </td>
            <td class="num">
              +{{ fmt(r.bonus) }}
            </td>
          </tr>
        </table>
      </div>
      <h2
        class="subhead"
        style="margin-top:14px"
      >
        Reef buildings
      </h2>
      <div class="scroll">
        <table>
          <tr>
            <th>Building</th><th class="num">
              Level
            </th>
          </tr>
          <tr
            v-for="r in w7.coralReef.buildings"
            :key="r.id"
          >
            <td><b>{{ coralBldDescOf[r.id] ?? r.desc }}</b></td>
            <td class="num">
              {{ r.level }}<span class="of">/{{ r.maxLv }}</span>
            </td>
          </tr>
        </table>
      </div>
      <h2
        class="subhead"
        style="margin-top:14px"
      >
        Dancing Coral
        <span class="hint">Reference only — no owned-level save read is wired for this track yet.</span>
      </h2>
      <div class="scroll">
        <table>
          <tr>
            <th>Reward</th><th class="num">
              Per-level coeff
            </th>
          </tr>
          <tr
            v-for="r in w7.coralReef.dancingCoral"
            :key="r.id"
          >
            <td><b>{{ dancingCoralDescOf[r.id] ?? r.desc }}</b></td>
            <td class="num">
              {{ fmt(r.coeff) }}
            </td>
          </tr>
        </table>
      </div>
      <div class="gapbox">
        <h3>Deferred: Dancing Coral levels</h3>
        <p>
          DancingCoralBonus needs Spelunk[4][7] (a "Grind Time" discount input) and TowerInfo[18+b]
          (the W3 Atom Collider) to compute an owned bonus — both are savemap gaps noted in
          gamedata-w7-coralreef.mjs. The table above lists what each reward slot CAN give, not what
          you currently have.
        </p>
      </div>
    </section>

    <section class="panel">
      <h2>
        <SpriteIcon
          file="Clammie"
          dir="afk_targets"
          :size="20"
        />
        Clam Work
        <span class="hint">{{ CLAM_TOOLTIP_STYLE }}</span>
      </h2>
      <div class="rewardladder">
        <span
          v-for="j in clamLadder"
          :key="j.level"
          :class="{ got: j.reached }"
          :title="j.reward"
        >Lv {{ j.level }}</span>
      </div>
      <h2
        class="subhead"
        style="margin-top:14px"
      >
        Job rewards
      </h2>
      <div class="scroll">
        <table>
          <tr>
            <th>Promotion</th><th>Reward</th><th>Reached</th>
          </tr>
          <tr
            v-for="j in clamLadder"
            :key="j.level"
          >
            <td>Lv {{ j.level }}</td>
            <td class="note">
              {{ j.reward }}
            </td>
            <td>
              <span :class="['chip', j.reached ? 'live' : 'dead']">{{ j.reached ? "yes" : "no" }}</span>
            </td>
          </tr>
        </table>
      </div>
      <h2
        class="subhead"
        style="margin-top:14px"
      >
        Upgrades
      </h2>
      <div class="scroll">
        <table>
          <tr>
            <th>Upgrade</th><th class="num">
              Level
            </th>
          </tr>
          <tr
            v-for="r in w7.clamWork.upgrades"
            :key="r.id"
          >
            <td><b>{{ clamUpgDescOf[r.id] ?? r.name }}</b></td>
            <td class="num">
              {{ fmt(r.level) }}
            </td>
          </tr>
        </table>
      </div>
    </section>

    <section class="panel">
      <h2 class="subhead">
        Advice Fish
        <span class="hint">6 small W7-only bonuses, all fully save-derivable — no unread inputs.</span>
      </h2>
      <div class="scroll">
        <table>
          <tr>
            <th>Advice</th><th class="num">
              Level
            </th><th class="num">
              Bonus
            </th>
          </tr>
          <tr
            v-for="r in w7.adviceFish.levels"
            :key="r.id"
          >
            <td><b>{{ adviceFishDescOf[r.id] ?? r.name }}</b></td>
            <td class="num">
              {{ fmt(r.level) }}
            </td>
            <td class="num">
              +{{ fmt(r.bonus) }}%
            </td>
          </tr>
        </table>
      </div>
    </section>

    <section class="panel">
      <h2 class="subhead">
        The Button
        <span class="hint">
          A rotating daily account-wide requirement (e.g. "reach 1000 total STR"). Pressing it
          re-rolls which of {{ w7.button.tasksTotal }} tasks is active.
          <span
            class="tip"
            :title="BUTTON_TOOLTIP"
          >ⓘ</span>
        </span>
      </h2>
      <div
        class="cards"
        style="margin-bottom:10px"
      >
        <div class="tile">
          <SpriteIcon
            file="ButtonG"
            dir="etc"
            :size="28"
          />
          <div class="label">
            Total presses
          </div>
          <div class="value">
            {{ fmt(w7.button.presses) }}
          </div>
        </div>
        <div class="tile">
          <div class="label">
            Current task
          </div>
          <div class="value">
            unknown
          </div>
          <div class="sub">
            needs a live client read — see (i)
          </div>
        </div>
      </div>
      <details class="fold">
        <summary>All {{ buttonTasks.length }} possible tasks (reference)</summary>
        <div class="taskgrid">
          <div
            v-for="(t, i) in buttonTasks"
            :key="i"
          >
            {{ t.desc }}
          </div>
        </div>
      </details>
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
.caveat { border-left: 3px solid var(--warning); background: rgba(250, 178, 25, .06); padding: 8px 11px; border-radius: 0 10px 10px 0; margin-bottom: var(--gap); font-size: 12.5px; color: var(--ink-2); }
.rewardladder { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
.rewardladder span { font-size: 11px; padding: 2px 8px; border-radius: 999px; border: 1px solid var(--border); color: var(--ink-2); }
.rewardladder span.got { border-color: rgba(12, 163, 12, .5); color: var(--good); }
.gapbox { border: 1px dashed var(--border); border-radius: 10px; padding: 12px 14px; color: var(--ink-2); font-size: 12.5px; margin-top: 12px; }
.gapbox h3 { font-size: 13px; color: var(--ink-1); margin-bottom: 6px; }
.taskgrid { display: grid; grid-template-columns: 1fr; gap: 3px; font-size: 11.5px; color: var(--ink-2); max-height: 260px; overflow-y: auto; }
.taskgrid div { padding: 3px 6px; border-radius: 4px; }
.taskgrid div:nth-child(odd) { background: var(--well); }
</style>
