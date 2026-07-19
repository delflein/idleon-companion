<script setup>
/**
 * TimeChart — uPlot wrapper for real multi-point time series (docs/ARCHITECTURE.md D6: uPlot
 * for anything beyond a sparkline; the tiny hand-rolled `spark()` stays a sparkline — see
 * Sparkline.vue — this component is for the "detailed history" mode dashboard.html's
 * `renderHistory()` used to hand-roll as a bespoke SVG line chart with hover crosshair +
 * tooltip). Kept lean per the M4 brief: one canvas, one shared tooltip div (the same
 * fixed-position `.tooltip` pattern dashboard.html already used for its crosshair — ported as
 * the "one in-repo tooltip helper" rather than reaching for a uPlot tooltip plugin), resize via
 * ResizeObserver.
 *
 * Input shape matches src/data's `history()` output: `{ [key]: [{ts, v}] }`, one array per
 * metric key, timestamps in epoch milliseconds (Date.now()-style, matching every legacy
 * SERIES[key]/hist entry). Series don't need matching timestamps — they're merged onto one
 * sorted x-axis and missing points render as gaps (uPlot `null`), not interpolated.
 *
 * Pure presentational: no store imports. uPlot's colors must be concrete CSS color strings
 * (canvas 2D can't resolve `var(--x)` the way DOM/CSSOM can), so the design-token colors are
 * read once via getComputedStyle at mount — this component is still theme-driven, just resolved
 * a layer earlier than the rest of the CSS-variable-based UI kit.
 */
import { ref, onMounted, onBeforeUnmount, watch, nextTick } from "vue";
import uPlot from "uplot";
import "uplot/dist/uPlot.min.css";

const props = defineProps({
  /** `{ [seriesKey]: [{ts, v}] }` — one or more time series, epoch-ms timestamps. */
  series: { type: Object, required: true },
  /** seriesKey -> legend/tooltip label. Falls back to the raw key. */
  labels: { type: Object, default: () => ({}) },
  /** Chart title shown above the plot (optional — omit for a bare embedded chart). */
  title: { type: String, default: "" },
  /** Plot height in px; width always tracks the container (resize-aware). */
  height: { type: Number, default: 160 },
});

const hostEl = ref(null);
const tipEl = ref(null);
let plot = null;
let resizeObserver = null;

const FALLBACK_ORDER = ["--series-1", "--good", "--warning", "--serious", "--critical"];

function cssVar(el, name, fallback) {
  const v = getComputedStyle(el).getPropertyValue(name).trim();
  return v || fallback;
}

/** Merge `{key:[{ts,v}]}` onto one sorted x-axis; missing points become `null` (a gap, never an
 *  interpolated guess — consistent with the rest of the app's honesty-contract instincts). */
function toUplotData(seriesMap) {
  const allTs = new Set();
  for (const pts of Object.values(seriesMap)) for (const p of pts) allTs.add(p.ts);
  const xs = [...allTs].sort((a, b) => a - b);
  const cols = Object.values(seriesMap).map((pts) => {
    const byTs = new Map(pts.map((p) => [p.ts, p.v]));
    return xs.map((t) => (byTs.has(t) ? byTs.get(t) : null));
  });
  return [xs.map((t) => Math.round(t / 1000)), ...cols]; // uPlot's time axis wants seconds
}

function buildOpts(width) {
  const el = hostEl.value;
  const ink2 = cssVar(el, "--ink-2", "#d3c0a0");
  const grid = cssVar(el, "--grid", "#3a2a16");
  const baseline = cssVar(el, "--baseline", "#4a3418");
  const keys = Object.keys(props.series);
  const colorOf = (i) => cssVar(el, FALLBACK_ORDER[i % FALLBACK_ORDER.length], "#3d95e2");

  return {
    width,
    height: props.height,
    cursor: { points: { size: 6 } },
    scales: { x: { time: true } },
    axes: [
      { stroke: ink2, grid: { stroke: grid }, ticks: { stroke: baseline } },
      { stroke: ink2, grid: { stroke: grid }, ticks: { stroke: baseline } },
    ],
    series: [
      {},
      ...keys.map((k, i) => ({
        label: props.labels[k] || k,
        stroke: colorOf(i),
        width: 2,
        points: { show: false },
      })),
    ],
    legend: { show: false },
    hooks: {
      setCursor: [(u) => {
        const { idx } = u.cursor;
        if (idx == null || !tipEl.value) { if (tipEl.value) tipEl.value.classList.remove("open"); return; }
        const x = u.data[0][idx];
        const parts = keys.map((k, i) => {
          const v = u.data[i + 1][idx];
          return v == null ? null : `${props.labels[k] || k}: <b>${v.toLocaleString("en-US")}</b>`;
        }).filter(Boolean);
        if (!parts.length) { tipEl.value.classList.remove("open"); return; }
        tipEl.value.innerHTML = `${new Date(x * 1000).toLocaleDateString("en-GB", { day: "numeric", month: "short" })} — ${parts.join(" · ")}`;
        tipEl.value.classList.add("open");
        const rect = u.over.getBoundingClientRect();
        const left = rect.left + (u.cursor.left ?? 0) + 12;
        const top = rect.top + (u.cursor.top ?? 0) + 12;
        tipEl.value.style.left = left + "px";
        tipEl.value.style.top = top + "px";
      }],
    },
  };
}

function render() {
  if (!hostEl.value) return;
  const width = hostEl.value.clientWidth || 300;
  destroyPlot();
  plot = new uPlot(buildOpts(width), toUplotData(props.series), hostEl.value);
}

function destroyPlot() {
  if (plot) { plot.destroy(); plot = null; }
}

onMounted(async () => {
  await nextTick();
  render();
  resizeObserver = new ResizeObserver(() => {
    if (plot && hostEl.value) plot.setSize({ width: hostEl.value.clientWidth || 300, height: props.height });
  });
  if (hostEl.value) resizeObserver.observe(hostEl.value);
});

onBeforeUnmount(() => {
  destroyPlot();
  if (resizeObserver) resizeObserver.disconnect();
});

watch(() => props.series, () => render(), { deep: true });
</script>

<template>
  <div class="hchart">
    <div
      v-if="title"
      class="nm"
    >
      {{ title }}
    </div>
    <div ref="hostEl" />
    <div
      ref="tipEl"
      class="tooltip"
    />
  </div>
</template>

<style scoped>
:deep(.u-legend) { font-size: 11.5px; }
</style>
