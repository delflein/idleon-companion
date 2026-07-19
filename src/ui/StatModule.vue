<script setup>
/**
 * StatModule — THE recipe-breakdown module renderer, copy-pasted near-byte-identical across
 * 20+ legacy pages (docs/migration/survey-pages.md's single biggest cross-page finding: the
 * `currentResult`/`bucketTerms`/`termRow`/`lockedRow`/`pendingModuleHTML`/`liveModuleHTML`
 * function set — confirmed verbatim in mining.html, near-verbatim in sneaking.html). This
 * component IS that function set, ported to Vue: same bucketing, same eqMult math, same
 * honesty-contract "lower bound" caveat, same show-more cap, same locked/unknown folds.
 *
 * Input shape matches `/api/stats`'s per-recipe entry exactly (companion.mjs:
 * `{ name, label, format, display, ...evaluatePerChar(recipe, s, opts) }`, i.e.
 * `{ name, label, format, display, byChar, collapsed, sensitive }` where `collapsed`/each
 * `byChar[].result` is `{ value, additivePoolPct, multiplicative, terms, unknown, lowerBound }`
 * — see src/core/stats/engine.mjs). Pass `:stat="null"` for the "recipe not registered yet"
 * pending state (legacy `pendingModuleHTML`).
 *
 * DELIBERATE DEVIATION from most legacy copies: `unknownCount` (used for the coverage tile and
 * the "N sources not derivable yet" fold header) is computed as
 * `terms.filter(t => t.status === "unknown").length` — this is breeding.html's fix, called out
 * in docs/migration/survey-pages.md as "an `unknownCount` bugfix not present in other copies —
 * worth propagating". Most pages (mining.html included) already use this form; sneaking.html and
 * a few others use `r.unknown.length` (the count of ctx.unknown() honesty-flag MESSAGES, which
 * can diverge from the actual unknown-term count — a term can trigger zero, one, or several
 * messages). The unknown-terms LIST shown in the fold below still lists `result.unknown`
 * (the messages) either way — that part is identical across every legacy copy.
 *
 * Pure presentational: no store/API imports. All data — the stat result, char names, and
 * history series — comes in as props; the only state owned locally is UI-only (which
 * character's view is selected, whether the term list is expanded).
 */
import { ref, computed } from "vue";
import SpriteIcon from "./SpriteIcon.vue";
import StatTermRow from "./StatTermRow.vue";
import { fmt, fmtStatValue, fmtTermRaw } from "./fmt.js";

const props = defineProps({
  /** The `/api/stats` entry for this recipe: `{ name, label, format, display, byChar,
   *  collapsed, sensitive }`. Pass `null` while the snapshot/recipe isn't available yet — the
   *  module renders the "recipe pending" placeholder instead (legacy `pendingModuleHTML`). */
  stat: { type: Object, default: null },
  /** Fallback title shown in the pending state (and used if `stat.label` is absent). */
  title: { type: String, default: "" },
  /** Header sprite, e.g. `{ file: "Copper", dir: "afk_targets" }` (legacy `cfg.icon`). */
  icon: { type: Object, default: null },
  /** One-line description under the title (legacy `cfg.blurb`), shown in both live and
   *  pending states. */
  blurb: { type: String, default: "" },
  /** charIdx -> display name, e.g. `SNAP.charNames`. Falls back to `"char " + i`, same as
   *  legacy `charName()`. */
  charNames: { type: Array, default: () => [] },
  /** History series keyed like the /api/history response: `{ "stat.<name>.<termId>": [{ts,v}] }`
   *  (and optionally `"stat.<name>"` for a future total-value chart). Passed straight to each
   *  term row's Sparkline. */
  series: { type: Object, default: () => ({}) },
  /** Term rows shown before the "show N more" toggle (legacy default: 12). */
  cap: { type: Number, default: 12 },
});

const emit = defineEmits(["char-select"]);

const charSel = ref("account");
const showAll = ref(false);

function charName(i) {
  return props.charNames?.[i] ?? "char " + i;
}

function onCharSelect(e) {
  charSel.value = e.target.value;
  emit("char-select", charSel.value);
}

/** legacy `currentResult(cfg, st)` */
const currentResult = computed(() => {
  if (!props.stat) return null;
  if (charSel.value !== "account" && props.stat.byChar) {
    const c = props.stat.byChar.find((x) => String(x.charIdx) === charSel.value);
    if (c) return c.result;
  }
  return props.stat.collapsed;
});

/** legacy `bucketTerms(r)` — verbatim math: additive terms priced as their equivalent
 *  multiplier against the shared pool, multiplicative terms priced at face value, then
 *  everything sorted by that equivalent multiplier descending. Neutral-element terms that
 *  aren't unknown/per-char are "locked" (the source exists but isn't contributing right now)
 *  and bucketed separately, below the fold. */
function bucketTerms(r) {
  const bracket = 1 + r.additivePoolPct / 100;
  const eqMult = (t) => (t.kind === "add"
    ? (100 + r.additivePoolPct) / Math.max(1, 100 + r.additivePoolPct - (t.value || 0))
    : t.kind === "mul" ? (t.value || 1)
      : (bracket + (t.value || 0)) / bracket);
  const isNeutral = (t) => (t.kind === "add" && t.value === 0) || (t.kind === "mul" && t.value === 1);
  const locked = r.terms.filter((t) => isNeutral(t) && t.status !== "unknown" && t.status !== "per-char");
  const lockedSet = new Set(locked);
  const rest = r.terms.filter((t) => !lockedSet.has(t)).sort((a, b) => eqMult(b) - eqMult(a));
  return { rest, locked, eqMult };
}

const bucketed = computed(() => (currentResult.value ? bucketTerms(currentResult.value) : null));

const isPoints = computed(() => props.stat?.format === "points");

/** See the module-level comment: the breeding.html "bugfix" form, not `result.unknown.length`. */
const unknownCount = computed(() => currentResult.value?.terms.filter((t) => t.status === "unknown").length ?? 0);
const perCharCount = computed(() => currentResult.value?.terms.filter((t) => t.status === "per-char").length ?? 0);

const rows = computed(() => {
  if (!bucketed.value) return [];
  return showAll.value ? bucketed.value.rest : bucketed.value.rest.slice(0, props.cap);
});
const hiddenCount = computed(() => Math.max(0, (bucketed.value?.rest.length ?? 0) - props.cap));

const valueText = computed(() => currentResult.value
  ? fmtStatValue(currentResult.value.value, props.stat.format, currentResult.value.lowerBound)
  : "");

/** legacy `termRow()`'s `shownVal`/`expr` split. */
function shownValue(t) {
  const rawVal = fmtTermRaw(t, isPoints.value);
  if (isPoints.value) return { value: rawVal, expr: "" };
  const eq = bucketed.value.eqMult(t);
  if (t.kind === "mul") return { value: "×" + fmt(eq), expr: "" };
  return { value: `×${eq >= 1.1 ? eq.toFixed(2) : eq.toFixed(3)}`, expr: `${rawVal} of pool` };
}

function displayOf(t) {
  return props.stat?.display?.[t.id] ?? {};
}
</script>

<template>
  <section
    v-if="!stat"
    class="panel pending"
  >
    <h2>
      <SpriteIcon
        v-if="icon"
        :file="icon.file"
        :dir="icon.dir"
        :size="20"
      />
      {{ title }}<span class="pill-pending">recipe pending</span>
    </h2>
    <p class="note">
      {{ blurb }} This recipe hasn't been registered in <code>stats/index.mjs</code> yet — the
      module fills in on its own once it is.
    </p>
  </section>

  <section
    v-else
    class="panel"
  >
    <h2>
      <SpriteIcon
        v-if="icon"
        :file="icon.file"
        :dir="icon.dir"
        :size="20"
      />
      {{ stat.label || title }} <span class="hint">{{ blurb }}</span>
      <span style="flex:1" />
      <select
        v-if="stat.byChar"
        class="inlinesel"
        :value="charSel"
        @change="onCharSelect"
      >
        <option value="account">
          Account view
        </option>
        <option
          v-for="c in stat.byChar"
          :key="c.charIdx"
          :value="String(c.charIdx)"
        >
          {{ charName(c.charIdx) }}
        </option>
      </select>
    </h2>

    <div
      v-if="currentResult.lowerBound || perCharCount"
      class="lowerbound"
    >
      <b>Lower bound.</b>
      {{ unknownCount
        ? `${unknownCount} of ${currentResult.terms.length} sources could not be derived and sit at their neutral element — the real value is higher.`
        : "Minor inputs remain unknowable — the real value can only be higher." }}
      <template v-if="perCharCount">
        {{ perCharCount }} source{{ perCharCount > 1 ? "s are" : " is" }} per-character — pick a
        character to resolve {{ perCharCount > 1 ? "them" : "it" }}.
      </template>
    </div>

    <div
      class="cards"
      style="margin-bottom:10px"
    >
      <div class="tile">
        <SpriteIcon
          v-if="icon"
          :file="icon.file"
          :dir="icon.dir"
          :size="28"
        />
        <div class="label">
          {{ stat.label || title }}
        </div>
        <div class="value">
          {{ valueText }}
        </div>
        <div class="sub">
          {{ charSel === "account" ? "account view" : "as " + charName(Number(charSel)) }}
        </div>
      </div>
      <div class="tile">
        <div class="label">
          Coverage
        </div>
        <div class="value">
          {{ currentResult.terms.length - unknownCount - perCharCount }}<span class="of">/{{ currentResult.terms.length }}</span>
        </div>
        <div class="sub">
          {{ perCharCount ? `+${perCharCount} per-character` : "sources computed" }}
        </div>
      </div>
      <div
        v-if="bucketed.locked.length"
        class="tile"
      >
        <div class="label">
          Locked / inactive
        </div>
        <div class="value">
          {{ bucketed.locked.length }}
        </div>
        <div class="sub">
          not contributing right now
        </div>
      </div>
    </div>

    <div class="scroll">
      <table>
        <tr>
          <th>Source</th><th class="num">
            Effect
          </th><th>Status</th><th>History</th><th>How it works</th>
        </tr>
        <StatTermRow
          v-for="t in rows"
          :key="t.id"
          :label="displayOf(t).label || t.key"
          :where="displayOf(t).where || ''"
          :value="shownValue(t).value"
          :expr="shownValue(t).expr"
          :status="t.status"
          :note="displayOf(t).how || t.note || ''"
          :parts="t.parts || []"
          :points="series[`stat.${stat.name}.${t.id}`] || []"
        />
      </table>
    </div>
    <button
      v-if="hiddenCount > 0"
      class="showmore"
      @click="showAll = !showAll"
    >
      {{ showAll ? "show fewer" : `show ${hiddenCount} more` }}
    </button>

    <details
      v-if="bucketed.locked.length"
      class="fold"
      style="margin-top:6px"
    >
      <summary>{{ bucketed.locked.length }} locked/inactive source{{ bucketed.locked.length > 1 ? "s" : "" }}</summary>
      <div class="scroll">
        <table>
          <StatTermRow
            v-for="t in bucketed.locked"
            :key="t.id"
            locked
            :label="displayOf(t).label || t.key"
            :where="displayOf(t).where || ''"
            :note="displayOf(t).how || t.note || ''"
          />
        </table>
      </div>
    </details>

    <details
      v-if="unknownCount"
      class="fold"
      style="margin-top:6px"
    >
      <summary>{{ unknownCount }} source{{ unknownCount > 1 ? "s" : "" }} not derivable yet</summary>
      <ul class="unknowns">
        <li
          v-for="(u, i) in currentResult.unknown"
          :key="i"
        >
          {{ u }}
        </li>
      </ul>
    </details>
  </section>
</template>
