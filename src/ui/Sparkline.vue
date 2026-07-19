<script setup>
/**
 * Sparkline — legacy `spark(key)` (mining.html/sneaking.html/stats.html, byte-identical
 * everywhere) ported AS-IS per docs/ARCHITECTURE.md D6 ("keep the tiny hand-rolled sparkline
 * helper" — it's small enough not to need uPlot). Same math, same output shape, just a
 * component instead of an innerHTML string built from a page-global `SERIES[key]` lookup —
 * the points array is now a prop, since src/ui/ components take no store/API dependencies.
 *
 * Pure presentational: no store imports.
 */
import { computed } from "vue";

const props = defineProps({
  /** Time-series points, same shape as history()/SERIES[key]: [{ts, v}]. Needs >=2 points to
   *  draw anything (a single point has no trend to show — legacy returned "" here too). */
  points: { type: Array, default: () => [] },
  width: { type: Number, default: 72 },
  height: { type: Number, default: 18 },
});

const geometry = computed(() => {
  const pts = props.points;
  if (!pts || pts.length < 2) return null;
  const w = props.width, h = props.height;
  const vs = pts.map((p) => p.v);
  const min = Math.min(...vs), max = Math.max(...vs);
  const y = (v) => (max === min ? h / 2 : h - 2 - ((v - min) / (max - min)) * (h - 4));
  const step = w / (pts.length - 1);
  const points = vs.map((v, i) => `${(i * step).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const up = vs[vs.length - 1] > vs[0];
  return { points, stroke: up ? "var(--good)" : "var(--ink-muted)" };
});
</script>

<template>
  <svg
    v-if="geometry"
    class="spark"
    :width="width"
    :height="height"
  >
    <polyline
      :points="geometry.points"
      fill="none"
      :stroke="geometry.stroke"
      stroke-width="1.5"
    />
  </svg>
</template>
