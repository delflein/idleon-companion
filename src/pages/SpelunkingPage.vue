<script setup>
/**
 * SpelunkingPage — the spelunking.html port. Legacy spelunking.html is a 4-tile KPI strip + a
 * caves table + a show-more shop table + a lore-chapter reference grid, no recipe/history
 * (docs/migration/survey-pages.md: "entities.w7.spelunking (caves[], shopLevels[], discoveries);
 * GLOSS.spelunkShop/spelunkChapters" — "explicitly documents a deferred parsing gap rather than
 * faking data", no page-local domain logic).
 *
 * NO-TIMERS product rule preserved verbatim: W7 Spelunking (Tunnels) is an active minigame with no
 * AFK time-candy path — this page shows levels/progress only, never a live timer or "time until
 * X" countdown (same caveat legacy states inline).
 */
import { computed } from "vue";
import { entities } from "../data/appState.js";
import { w7Glossary } from "../data/derived.js";
import ShowMore from "../ui/ShowMore.vue";
import SpriteIcon from "../ui/SpriteIcon.vue";
import { fmt } from "../ui/fmt.js";

const w7 = computed(() => entities.value?.w7 ?? null);
const spelunking = computed(() => w7.value?.spelunking ?? null);

const GLOSS = w7Glossary();
const shopDescOf = computed(() => Object.fromEntries((GLOSS.spelunkShop ?? []).map((s) => [s.id, s.desc])));

const totalPow = computed(() => (spelunking.value?.caves ?? []).reduce((a, c) => a + c.pow, 0));

// Legacy `renderShop()`: bought rows (level > 0) first (highest level first), untouched after.
const shopRows = computed(() => {
  const s = spelunking.value;
  if (!s) return [];
  const bought = s.shopLevels.filter((r) => r.level > 0).sort((a, b) => b.level - a.level);
  const untouched = s.shopLevels.filter((r) => r.level === 0);
  return bought.concat(untouched);
});

function depthPct(c) {
  return c.maxDepth ? Math.round((100 * c.depth) / c.maxDepth) : 0;
}
</script>

<template>
  <header class="app">
    <h1>Spelunking</h1>
  </header>
  <div
    id="err"
    class="err"
  />
  <div class="caveat">
    W7's Spelunking is an ACTIVE minigame (Tunnels) — there is no time-candy AFK path for it. This
    page shows LEVELS and PROGRESS only; it never shows a live timer or "time until X" countdown,
    by design (see companion product rules).
  </div>

  <template v-if="spelunking">
    <div class="cards">
      <div class="tile">
        <SpriteIcon
          file="Spelunking"
          dir="etc"
          :size="28"
        />
        <div class="label">
          Caves unlocked
        </div>
        <div class="value">
          {{ spelunking.cavesUnlocked }}<span class="of">/{{ spelunking.caves.length }}</span>
        </div>
        <div class="sub">
          Pebble Cove through Scoutpost
        </div>
      </div>
      <div class="tile">
        <div class="label">
          Shop upgrades bought
        </div>
        <div class="value">
          {{ spelunking.shopBought }}<span class="of">/{{ spelunking.shopLevels.length }}</span>
        </div>
        <div class="sub">
          at least 1 level in
        </div>
      </div>
      <div class="tile">
        <div class="label">
          Discoveries
        </div>
        <div class="value">
          {{ fmt(spelunking.discoveries) }}
        </div>
        <div class="sub">
          multiplies POW upgrade 1's bonus
        </div>
      </div>
      <div class="tile">
        <div class="label">
          Total POW across caves
        </div>
        <div class="value">
          {{ fmt(totalPow) }}
        </div>
        <div class="sub">
          per-cave "Caver POW" sum
        </div>
      </div>
    </div>

    <section class="panel">
      <h2>
        <SpriteIcon
          file="Spelunking"
          dir="etc"
          :size="20"
        />
        Caves &amp; Depth
        <span class="hint">9 caves, each with its own max depth and Caver POW requirement to descend further.</span>
      </h2>
      <div class="scroll">
        <table>
          <tr>
            <th>Cave</th><th>Status</th><th class="num">
              Best depth
            </th><th class="num">
              Caver POW
            </th>
          </tr>
          <tr
            v-for="(c, i) in spelunking.caves"
            :key="i"
          >
            <td><b>{{ c.name ?? `Cave ${i + 1}` }}</b></td>
            <td>
              <span :class="['chip', c.unlocked ? 'live' : 'dead']">{{ c.unlocked ? "unlocked" : "locked" }}</span>
            </td>
            <td class="num">
              {{ fmt(c.depth) }}<span class="of">/{{ c.maxDepth }}</span> <span class="note">({{ depthPct(c) }}%)</span>
            </td>
            <td class="num">
              {{ fmt(c.pow) }}
            </td>
          </tr>
        </table>
      </div>
    </section>

    <section class="panel">
      <h2 class="subhead">
        Shop upgrades <span class="of">{{ spelunking.shopBought }}/{{ spelunking.shopLevels.length }} bought</span>
      </h2>
      <ShowMore
        v-slot="{ items }"
        :items="shopRows"
        :cap="10"
      >
        <div class="scroll">
          <table>
            <tr>
              <th>Upgrade</th><th class="num">
                Level
              </th>
            </tr>
            <tr
              v-for="r in items"
              :key="r.id"
            >
              <td>
                <b>{{ r.name }}</b>
                <div
                  v-if="shopDescOf[r.id]"
                  class="where"
                >
                  {{ shopDescOf[r.id] }}
                </div>
              </td>
              <td class="num">
                {{ r.level }}<span class="of">/{{ r.maxLv >= 99999 ? "∞" : r.maxLv }}</span>
              </td>
            </tr>
          </table>
        </div>
      </ShowMore>
    </section>

    <section
      v-if="GLOSS.spelunkChapters?.length"
      class="panel"
    >
      <h2 class="subhead">
        Lore chapters
        <span class="hint">
          Reading pages in each Tunnel's Lore book unlocks these bonuses. Reference only —
          per-chapter page-read progress isn't wired into the save mapping yet (see gap notes
          below), so no live progress is shown here.
          <span
            class="tip"
            title="ChapterBonus(chapter,slot) scales off Spelunk[8][4*chapter+slot], a save index not yet documented in savemap/w67.mjs. Rather than guess, this section only lists what each chapter CAN grant."
          >ⓘ</span>
        </span>
      </h2>
      <div class="chapterlist">
        <div
          v-for="c in GLOSS.spelunkChapters"
          :key="c.chapter"
          class="chaptercard"
        >
          <b>Chapter {{ c.chapter + 1 }}</b>
          <div
            v-for="(r, i) in c.rows"
            :key="i"
          >
            {{ r.name }}
          </div>
        </div>
      </div>
      <div
        class="gapbox"
        style="margin-top:12px"
      >
        <h3>Deferred: live lore progress</h3>
        <p>
          Adding Spelunk[8] (per-chapter pages-read) to savemap/w67.mjs would let this section show
          real progress + the ChapterBonus value instead of just the reference list above — a
          clean follow-up pass, not fabricated here.
        </p>
      </div>
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
.gapbox { border: 1px dashed var(--border); border-radius: 10px; padding: 12px 14px; color: var(--ink-2); font-size: 12.5px; }
.gapbox h3 { font-size: 13px; color: var(--ink-1); margin-bottom: 6px; }
.chapterlist { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 8px; }
.chaptercard { border: 1px solid var(--border); border-radius: 8px; padding: 8px 10px; font-size: 11.5px; color: var(--ink-2); }
.chaptercard b { display: block; color: var(--ink-1); font-size: 12px; margin-bottom: 4px; }
.chaptercard div { margin-bottom: 2px; }
</style>
