<script setup>
/**
 * RiftPage — the rift.html port. Legacy rift.html is informational-only (no registered recipe —
 * docs/migration/survey-pages.md: "entities.w4.rift (level/task/progress), entities.w4.
 * skillMastery; GLOSS.riftRewards/skillMasteryThresholds... no stats/history"): the current
 * cosmetic tier + task, the 5-tier reward ladder, and the Skill Mastery rank table (locked until
 * Rift 15). `w4Glossary()` is pure/static (src/data/derived.js re-exports it verbatim) — the
 * reward ladder and rank thresholds are account-independent gamedata, not a save-derived value.
 */
import { computed } from "vue";
import { entities } from "../data/appState.js";
import { w4Glossary } from "../data/derived.js";
import LevelBar from "../ui/LevelBar.vue";
import Chip from "../ui/Chip.vue";
import SpriteIcon from "../ui/SpriteIcon.vue";
import { fmt, niceItem } from "../ui/fmt.js";

const GLOSS = w4Glossary();

const w4 = computed(() => entities.value?.w4 ?? null);
const rift = computed(() => w4.value?.rift ?? null);
const skillMastery = computed(() => w4.value?.skillMastery ?? null);

const rewards = computed(() => GLOSS.riftRewards || []);
const nextUnlockAt = computed(() => {
  const level = rift.value?.level ?? -1;
  const upcoming = rewards.value.filter((o) => o.unlockAt > level).map((o) => o.unlockAt);
  return upcoming.length ? Math.min(...upcoming) : Infinity;
});

const thresholds = computed(() => GLOSS.skillMasteryThresholds || []);
const skillRows = computed(() => (skillMastery.value?.skills ?? [])
  .slice()
  .sort((a, b) => b.rank - a.rank || b.total - a.total));

function nextThreshold(rank) {
  return thresholds.value[rank];
}
</script>

<template>
  <header class="app">
    <h1>Rift</h1>
  </header>
  <div
    id="err"
    class="err"
  />

  <template v-if="w4">
    <div class="cards">
      <div class="tile">
        <SpriteIcon
          file="Rift_0"
          dir="etc"
          :size="28"
        />
        <div class="label">
          Rift
        </div>
        <div class="value">
          {{ rift.level + 1 }}
        </div>
        <div class="sub">
          {{ rift.nextTask ? "task in progress" : "—" }}
        </div>
      </div>
    </div>

    <section class="panel">
      <h2>
        <SpriteIcon
          file="Rift_0"
          dir="etc"
          :size="20"
        />
        Rift
        <span class="hint">
          Endless-mode Rift tier ladder — cosmetic tiers with a rotating task type, and the
          reward milestones each tier unlocks. Planning info only, no timers.
          <span
            class="tip"
            title="The Rift counter only goes up (defeat mobs in the current cosmetic tier's task to advance). Each tier's task TYPE and requirement amount are fixed by the tier's slot in a 70-tier cycle; reward milestones unlock every 5 tiers."
          >ⓘ</span>
        </span>
      </h2>
      <div class="stripcard">
        <div>
          <div class="lbl">
            Current
          </div>
          <div class="big">
            Rift {{ rift.level + 1 }}
          </div>
        </div>
        <div>
          <div class="lbl">
            Task
          </div>
          <div
            class="big"
            style="font-size:14px;font-weight:650"
          >
            {{ rift.nextTask ?? "—" }}
          </div>
        </div>
        <div>
          <div class="lbl">
            Progress
          </div>
          <div class="big">
            <template v-if="rift.taskReq != null">
              {{ fmt(rift.progress) }}<span class="of">/{{ fmt(rift.taskReq) }}</span>
            </template>
            <template v-else>
              {{ fmt(rift.progress) }}
            </template>
          </div>
        </div>
        <div v-if="rift.completed != null">
          <div class="lbl">
            Status
          </div>
          <div
            class="big"
            style="font-size:14px"
          >
            <Chip
              :variant="rift.completed ? 'live' : 'soon'"
              force
            >
              {{ rift.completed ? "ready to advance" : "in progress" }}
            </Chip>
          </div>
        </div>
      </div>

      <h2 class="subhead">
        Reward ladder <span class="of">every 5 tiers</span>
      </h2>
      <div class="rewardladder">
        <span
          v-for="rw in rewards"
          :key="rw.idx"
          :class="{ got: rift.level >= rw.unlockAt, next: rift.level < rw.unlockAt && rw.unlockAt === nextUnlockAt }"
          :title="`Rift ${rw.unlockAt + 1}`"
        >
          {{ rw.name }}
        </span>
      </div>

      <details
        class="fold"
        style="margin-top:14px"
      >
        <summary>
          Skill Mastery — {{ skillMastery.unlocked ? `${skillMastery.skills.length} skills tracked` : `locked until Rift ${skillMastery.unlockRift + 1}` }}
        </summary>
        <div
          v-if="skillMastery.unlocked"
          class="scroll"
          style="margin-top:8px"
        >
          <table>
            <tr>
              <th>Skill</th><th class="num">
                Rank
              </th><th>Total level vs next rank</th>
            </tr>
            <tr
              v-for="s in skillRows"
              :key="s.idx"
            >
              <td><b>{{ niceItem(s.name) }}</b></td>
              <td class="num">
                Rank {{ s.rank }}<span class="of">/{{ thresholds.length }}</span>
              </td>
              <td>
                <LevelBar
                  v-if="nextThreshold(s.rank) != null"
                  :level="s.total"
                  :max-level="nextThreshold(s.rank)"
                />
                <template v-else>
                  {{ fmt(s.total) }} <Chip
                    variant="live"
                    force
                  >
                    max rank
                  </Chip>
                </template>
              </td>
            </tr>
          </table>
        </div>
        <p
          v-else
          class="note"
        >
          Skill Mastery converts each skill's ACCOUNT-WIDE total level (summed across every
          character) into a rank 0-{{ thresholds.length }}, which feeds several late-game bonus
          formulas. Unlocks at Rift {{ skillMastery.unlockRift + 1 }}.
        </p>
      </details>
    </section>
  </template>
  <p
    v-else
    class="note"
  >
    No <code>w4</code> entity on this snapshot yet.
  </p>
</template>
