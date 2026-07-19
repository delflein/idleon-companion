<script setup>
/**
 * SpriteIcon — the ui.js `sprite()` helper (repo-root `ui.js`) as a component. Renders one
 * pixelated game-asset PNG. Legacy pages built the src as `/public/assets/{dir}/{file}.png`
 * (served by companion.mjs from the repo-root `public/` folder); the SPA instead resolves
 * against Vite's configured base so the same component works under the GitHub Pages subpath
 * (docs/ARCHITECTURE.md D5/D7 — `import.meta.env.BASE_URL + 'assets/'`).
 *
 * Pure presentational: no store/API access, just a path + <img> tag.
 */
defineProps({
  /** Asset file name, no extension — e.g. "Copper", "Sneaking_Ninja". */
  file: { type: String, required: true },
  /** Asset subdirectory under public/assets/ — e.g. "data", "etc", "afk_targets". */
  dir: { type: String, default: "data" },
  /** Rendered width/height in px (assets are square). */
  size: { type: Number, default: 20 },
  /** Extra class(es) appended alongside the shared `.px` pixelated-rendering class. */
  cls: { type: String, default: "" },
});

// `import.meta` is module-only syntax — it can't appear inside a template expression (the
// compiled render function isn't a module), so resolve it here in <script setup> instead.
const ASSET_BASE = `${import.meta.env.BASE_URL}assets/`;
</script>

<template>
  <img
    class="px"
    :class="cls"
    :src="`${ASSET_BASE}${dir}/${file}.png`"
    alt=""
    :width="size"
    :height="size"
    loading="lazy"
  >
</template>
