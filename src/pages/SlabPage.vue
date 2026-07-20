<script setup>
/**
 * SlabPage — the slab.html port. Legacy slab.html: a KPI tile, progress bar + Slab-of-Legend
 * tier ladder, and a bonus-hooks table — no recipe module, no per-char selector
 * (docs/migration/survey-pages.md: "entities.w5.slab (pct, looted, total, greenstacks, jars,
 * legendTiers[], bonuses[])... progress bar, reward-ladder pills, bonus-hooks table"). Legacy
 * fetched `/api/w5` into `GLOSS` but never visibly read it (survey's "dead fetches" finding) — not
 * ported here; `entities.w5.slab` already carries every field this page renders.
 */
import { computed } from "vue";
import { entities } from "../data/appState.js";
import SpriteIcon from "../ui/SpriteIcon.vue";
import { fmt } from "../ui/fmt.js";

const w5 = computed(() => entities.value?.w5 ?? null);
const slab = computed(() => w5.value?.slab ?? null);

/* Entity text already has "_" -> " " (domain.mjs); this strips the N.js value-placeholder
 * punctuation ("{", "}", "#", etc.) that domain.mjs leaves untouched. Ports legacy `stripPh()`
 * (divinity.html/palette.html/slab.html) — a small display-text cleaner, not domain logic, so it
 * stays local rather than growing a new src/core/ module or touching the shared fmt.js. */
function stripPh(s) {
  return String(s ?? "").replace(/[{}<>$@#]/g, "").replace(/\s+/g, " ").trim();
}

const nextTier = computed(() => (slab.value?.legendTiers ?? []).find((t) => !t.done));
const lastTierThreshold = computed(() => {
  const tiers = slab.value?.legendTiers ?? [];
  return tiers[tiers.length - 1]?.threshold;
});
const lastTierPct = computed(() => {
  const s = slab.value;
  if (!s || !lastTierThreshold.value) return 0;
  return Math.round((100 * lastTierThreshold.value) / s.total);
});
</script>

<template>
  <header class="app">
    <h1>The Slab</h1>
  </header>
  <div
    id="err"
    class="err"
  />

  <template v-if="slab">
    <div class="cards">
      <div class="tile">
        <SpriteIcon
          file="Slab"
          dir="etc"
          :size="28"
        />
        <div class="label">
          Slab completion
        </div>
        <div class="value">
          {{ slab.pct }}%
        </div>
        <div class="sub">
          {{ fmt(slab.looted) }}/{{ fmt(slab.total) }} items
        </div>
      </div>
    </div>

    <section class="panel">
      <h2>
        <SpriteIcon
          file="Slab"
          dir="etc"
          :size="20"
        />
        The Slab
        <span class="hint">
          A lifetime "have you ever owned this item" tracker across {{ fmt(slab.total) }} items —
          8 small bonuses unlock in steps as your count climbs.
          <span
            class="tip"
            title="The Slab counts DISTINCT items you've ever owned (Cards[1], deduped against the 1911-item registry) — it never decreases. Greenstacks is a SEPARATE counter: an inventory SLOT currently holding 10,000,000+ of one item. They can move independently — clearing a green stack doesn't undo Slab progress, and a fresh green stack doesn't require a new Slab item."
          >ⓘ</span>
        </span>
      </h2>
      <div
        class="cards"
        style="margin-bottom:10px"
      >
        <div class="tile">
          <SpriteIcon
            file="Slab"
            dir="etc"
            :size="28"
          />
          <div class="label">
            Slab completion
          </div>
          <div class="value">
            {{ slab.pct }}%
          </div>
          <div class="sub">
            {{ fmt(slab.looted) }}/{{ fmt(slab.total) }} items
          </div>
        </div>
        <div class="tile">
          <div class="label">
            Green stacks
          </div>
          <div class="value">
            {{ fmt(slab.greenstacks) }}
          </div>
          <div class="sub">
            10M+ in one slot, right now
          </div>
        </div>
        <div class="tile">
          <div class="label">
            Jars
          </div>
          <div class="value">
            {{ fmt(slab.jars) }}
          </div>
          <div class="sub">
            Cavern collectibles found
          </div>
        </div>
      </div>

      <div
        class="bar-bg"
        style="margin-bottom:4px"
      >
        <div
          class="bar-fill"
          :style="{ width: slab.pct + '%' }"
        />
      </div>
      <div class="rewardladder">
        <span
          v-for="t in slab.legendTiers"
          :key="t.tier"
          :class="{ got: t.done, next: !t.done && (!nextTier || t.tier === nextTier.tier) }"
          :title="`Tier ${t.tier}: ${fmt(t.threshold)} items`"
        >T{{ t.tier }}</span>
      </div>
      <p
        class="note"
        style="margin:6px 0 0"
      >
        Slab-of-Legend achievement ladder — max tier only needs {{ fmt(lastTierThreshold) }}/{{ fmt(slab.total) }}
        items (~{{ lastTierPct }}%), not full completion.
      </p>

      <h2
        class="subhead"
        style="margin-top:14px"
      >
        Bonus hooks <span class="of">step up every N items past a threshold</span>
      </h2>
      <div class="scroll">
        <table>
          <tr>
            <th>Bonus</th><th>Stat</th><th class="num">
              Steps active
            </th><th class="num">
              Next step
            </th>
          </tr>
          <tr
            v-for="b in slab.bonuses"
            :key="b.name"
          >
            <td><b>{{ b.name }}</b></td>
            <td class="note">
              {{ stripPh(b.stat) }}
            </td>
            <td class="num">
              {{ b.steps }} step{{ b.steps === 1 ? "" : "s" }}
            </td>
            <td class="num">
              {{ b.nextThresholdItems > 0 ? `${fmt(b.nextThresholdItems)} more items` : "at next step" }}
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
    No <code>w5</code> entity on this snapshot yet.
  </p>
</template>
