<script setup>
/**
 * Chip — the small pill-badge used everywhere (`.chip` in companion.css). Ports legacy
 * `chip(status)` (mining.html/sneaking.html) as a component: given a stat term's `status`,
 * picks the right visual variant. Also usable standalone (`variant` prop) for one-off badges
 * (e.g. sneaking.html's "owned"/"not bought" emporium rows).
 *
 * Pure presentational: no store imports.
 */
import { computed } from "vue";

const props = defineProps({
  /** Term status from the stats engine: "computed" | "partial" | "unknown" | "user-supplied" |
   *  "per-char" | "locked". "computed" renders nothing (legacy chip() returns "" for it) unless
   *  `force` is set. Ignored if `variant` is supplied directly. */
  status: { type: String, default: null },
  /** Direct visual variant, bypassing the status->variant mapping: "live" | "dead" | "soon" |
   *  "user" | "pc" | "none". */
  variant: { type: String, default: null },
  /** Render even when the resolved variant is "none" (computed/neutral) — off by default,
   *  matching legacy chip()'s "computed status shows nothing" behavior. */
  force: { type: Boolean, default: false },
});

// legacy chip(status): status === "computed" -> "" else map to a CSS class + echo the label.
const STATUS_VARIANT = {
  computed: "none",
  partial: "soon",
  unknown: "dead",
  "user-supplied": "user",
  "per-char": "pc",
  locked: "dead",
};

const resolvedVariant = computed(() => props.variant ?? STATUS_VARIANT[props.status] ?? "none");
const label = computed(() => props.variant ?? props.status);
</script>

<template>
  <span
    v-if="resolvedVariant !== 'none' || force"
    class="chip"
    :class="resolvedVariant"
  >
    <slot>{{ label }}</slot>
  </span>
</template>
