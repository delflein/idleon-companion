<script setup>
/**
 * ShowMore — the "cap at 10-12, click to reveal the rest" pagination idiom used in nearly every
 * table across the 45 legacy pages (docs/migration/survey-pages.md's cross-cutting findings;
 * e.g. sneaking.html's `EMPORIUM_SHOWALL`/`CHARMS_SHOWALL` toggles). Takes the full list, slices
 * it for the caller via a scoped slot, and renders the toggle button itself.
 *
 * Pure presentational: no store imports. Caller owns how each item renders (table row, card,
 * list item, ...) — this component only owns the cap/expand state and the button.
 */
import { ref, computed } from "vue";

const props = defineProps({
  /** The full, already-sorted item list. */
  items: { type: Array, required: true },
  /** How many to show before the first render (legacy default was 10-12, varies per page). */
  cap: { type: Number, default: 10 },
});

const showAll = ref(false);
const visible = computed(() => (showAll.value ? props.items : props.items.slice(0, props.cap)));
const hiddenCount = computed(() => Math.max(0, props.items.length - props.cap));
</script>

<template>
  <slot
    :items="visible"
    :hidden-count="hiddenCount"
    :show-all="showAll"
  />
  <button
    v-if="hiddenCount > 0"
    class="showmore"
    @click="showAll = !showAll"
  >
    {{ showAll ? "show fewer" : `show ${hiddenCount} more` }}
  </button>
</template>
