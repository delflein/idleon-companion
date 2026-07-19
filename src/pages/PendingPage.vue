<script setup>
/* PendingPage — the ONE shared "not yet migrated" stub (M5-prep, deliverable B).
 *
 * Every planned page has its own wrapper file (e.g. MiningPage.vue) that renders this until a batch
 * agent rewrites that wrapper into the real port. Pre-creating all ~44 wrappers now — each lazy-
 * imported by router.js — means a batch agent edits ONLY its own page file and never touches the
 * shared router.js/App.vue, so parallel page ports don't collide.
 *
 * Parameterised entirely by route meta ({ title, icon:[file,dir], group }) — no per-page code here.
 * The legacy page for the same system keeps working standalone against the old companion server
 * until its replacement renders real data (docs/ARCHITECTURE.md migration note / PANELS.md step 5).
 */
import { computed } from "vue";
import { useRoute } from "vue-router";
import SpriteIcon from "../ui/SpriteIcon.vue";

const route = useRoute();
const title = computed(() => route.meta?.title ?? route.name ?? "Page");
const icon = computed(() => route.meta?.icon ?? null); // [file, dir]
const legacyHref = computed(() => {
  // The legacy page filename mirrors the route name (mining -> /mining.html) — a convenience link
  // back to the still-working standalone page while this one is pending. Only meaningful when the
  // old companion server is running; harmless (404) otherwise.
  const name = typeof route.name === "string" ? route.name : "";
  return name ? `/${name}.html` : null;
});
</script>

<template>
  <section class="pending">
    <header class="pending-head">
      <SpriteIcon
        v-if="icon"
        :file="icon[0]"
        :dir="icon[1]"
        :size="36"
      />
      <h1>{{ title }}</h1>
    </header>
    <p class="pending-note">
      This page hasn't been migrated to the new app yet.
    </p>
    <p class="pending-sub">
      Use the legacy page meanwhile<span v-if="legacyHref"> — <a :href="legacyHref">{{ legacyHref }}</a></span>.
    </p>
  </section>
</template>

<style scoped>
.pending {
  max-width: 40rem;
  margin: 3rem auto;
  padding: 1.5rem 1.75rem;
  border: 1px solid #262a35;
  border-radius: 10px;
  background: #161922;
}

.pending-head {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.pending-head h1 {
  font-size: 1.3rem;
  margin: 0;
}

.pending-note {
  color: #e6e8ee;
  font-size: 1rem;
  margin: 0 0 0.4rem;
}

.pending-sub {
  color: #9aa4b8;
  font-size: 0.9rem;
  margin: 0;
}

.pending-sub a {
  color: #7aa2ff;
}
</style>
