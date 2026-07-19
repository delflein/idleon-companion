<script setup>
/**
 * LevelBar — ports legacy `levelBar(level, maxLevel)` (construction.html / divinity.html,
 * byte-identical apart from the tooltip copy — docs/migration/survey-pages.md's "secondary
 * duplicated helpers"). Shows "Lv N/max" with a filled progress track; when `level` exceeds
 * `maxLevel` (a real case — extension sources like Atom/Construction Mastery aren't fully
 * modeled server-side) it drops the bar and shows an "extended past N" chip instead of a
 * silently-wrong >100% fill.
 *
 * Pure presentational: no store imports.
 */
import { computed } from "vue";
import { fmt } from "./fmt.js";

const props = defineProps({
  /** Current level. */
  level: { type: Number, required: true },
  /** Known cap; falsy/undefined means "no known cap" (bar renders without a fraction). */
  maxLevel: { type: Number, default: 0 },
  /** Tooltip text for the "extended past cap" chip — callers should explain WHY their cap can
   *  be exceeded (legacy copy differs per page: construction.html names the extension sources,
   *  divinity.html just says "above the recorded max level"). */
  extendedNote: { type: String, default: "Above the known cap on record." },
});

const withinCap = computed(() => !props.maxLevel || props.level <= props.maxLevel);
const pct = computed(() => props.maxLevel ? Math.max(0, Math.min(100, (props.level / props.maxLevel) * 100)) : 0);
</script>

<template>
  <span>
    Lv {{ fmt(level) }}<span
      v-if="maxLevel"
      class="of"
    >/{{ fmt(maxLevel) }}</span>
    <div
      v-if="withinCap && maxLevel"
      class="bar-bg"
      style="margin-top:3px"
    >
      <div
        class="bar-fill"
        :style="{ width: pct + '%' }"
      />
    </div>
    <span
      v-else-if="!withinCap"
      class="chip user"
      :title="extendedNote"
    >extended past {{ fmt(maxLevel) }}</span>
  </span>
</template>
