<script setup>
/**
 * StatTermRow — one row of the recipe-breakdown table (used by StatModule). Ports legacy
 * `termRow()`/`lockedRow()` (mining.html/sneaking.html, byte-identical apart from one CSS
 * `max-width` — docs/migration/survey-pages.md). Renders as a <tr> (+ an optional sibling <tr>
 * for the drill-down) so StatModule can `v-for` these straight into its own <table>; a standalone
 * DataTable didn't fit here because the column set (source / effect / status / history / how)
 * and the expand-on-click parts row are specific to this one recipe-module shape, not generic.
 *
 * Pure presentational: no store imports. StatModule does all the math (bucketing, eqMult,
 * formatting) and hands this component already-resolved strings.
 */
import { ref, computed } from "vue";
import Chip from "./Chip.vue";
import Sparkline from "./Sparkline.vue";
import { fmt } from "./fmt.js";

const props = defineProps({
  /** Term/source label, e.g. "Talent: Tool Proficiency". */
  label: { type: String, required: true },
  /** Where the source comes from, shown as a small line under the label (legacy `d.where`). */
  where: { type: String, default: "" },
  /** Already-formatted "Effect" column text, e.g. "×1.23" or "+12%". Ignored when `locked`. */
  value: { type: String, default: "—" },
  /** Secondary line under `value` (legacy `.expr` — e.g. "12% of pool" for additive terms). */
  expr: { type: String, default: "" },
  /** Engine term status ("computed" | "partial" | "unknown" | "user-supplied" | "per-char") —
   *  fed straight to Chip. Ignored when `locked`. */
  status: { type: String, default: "computed" },
  /** True for a neutral-element / inactive source (legacy `lockedRow()`): shows a fixed
   *  "locked/inactive" chip, "—" value, no sparkline, no drill-down, regardless of the other
   *  value/status/parts props. */
  locked: { type: Boolean, default: false },
  /** "How it works" note (legacy `d.how || t.note`). */
  note: { type: String, default: "" },
  /** Drill-down rows for this term (legacy `t.parts`): [{ label, value?, valueText?, note? }].
   *  Rendered on row click via the default `drilldown` slot, or a caller override. */
  parts: { type: Array, default: () => [] },
  /** History sparkline points, same shape as Sparkline's `points` prop. Empty = no chart cell
   *  content (legacy `spark(key)` also renders nothing under 2 points). */
  points: { type: Array, default: () => [] },
});

const expanded = ref(false);
const hasParts = computed(() => props.parts.length > 0);
function toggle() {
  if (hasParts.value) expanded.value = !expanded.value;
}
</script>

<template>
  <tr
    v-if="locked"
    class="dim"
  >
    <td style="max-width:340px">
      <b>{{ label }}</b>
      <div
        v-if="where"
        class="where"
      >
        {{ where }}
      </div>
    </td>
    <td class="num">
      —
    </td>
    <td>
      <Chip
        variant="dead"
        force
      >
        locked/inactive
      </Chip>
    </td>
    <td />
    <td class="note">
      {{ note || "Not contributing right now — the source system is locked or inactive on this account." }}
    </td>
  </tr>
  <template v-else>
    <tr
      class="expander"
      @click="toggle"
    >
      <td style="max-width:340px">
        <b>{{ label }}</b> <span
          v-if="hasParts"
          class="expr"
        >▸</span>
        <div
          v-if="where"
          class="where"
        >
          {{ where }}
        </div>
      </td>
      <td class="num">
        {{ value }}
        <div
          v-if="expr"
          class="expr"
        >
          {{ expr }}
        </div>
      </td>
      <td><Chip :status="status" /></td>
      <td><Sparkline :points="points" /></td>
      <td class="note">
        {{ note }}
      </td>
    </tr>
    <tr
      v-if="hasParts && expanded"
      class="parts"
    >
      <td colspan="5">
        <slot
          name="drilldown"
          :parts="parts"
        >
          <div
            v-for="(p, i) in parts"
            :key="i"
            class="partrow"
          >
            {{ p.label }}: <b>{{ p.valueText ?? fmt(p.value) }}</b>
            <span
              v-if="p.note"
              class="expr"
            >{{ p.note }}</span>
          </div>
        </slot>
      </td>
    </tr>
  </template>
</template>
