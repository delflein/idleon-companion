<script setup>
/* App shell — dark layout frame + grouped, world-sectioned navigation built entirely from
 * router.js's PAGES array (M5-prep). Home is the brand link; every other page is reached from the
 * "Pages" dropdown, sectioned by world (W1..W7 / Account / Meta) in NAV_GROUPS order. Each item
 * carries the sprite icon its legacy page header used (docs/migration/survey-pages.md).
 *
 * The nav is data-driven so a batch agent porting a page never touches this file — the entry is
 * already here the moment the wrapper stub exists.
 */
import { computed, ref } from "vue";
import { PAGES, NAV_GROUPS } from "./router.js";
import SpriteIcon from "./ui/SpriteIcon.vue";

const open = ref(false);

// Group PAGES by their meta group, in NAV_GROUPS order; drop empty groups. Home is pulled out as
// the brand link so it isn't duplicated in the dropdown.
const groups = computed(() =>
  NAV_GROUPS.map((g) => ({
    ...g,
    pages: PAGES.filter((p) => p.group === g.id && p.name !== "home"),
  })).filter((g) => g.pages.length),
);

function close() {
  open.value = false;
}
</script>

<template>
  <div class="app-shell">
    <header class="app-header">
      <RouterLink
        to="/"
        class="app-title"
        @click="close"
      >
        IdleOn Companion
      </RouterLink>

      <nav class="app-nav">
        <!-- Data (sync/connect/import) gets a permanent slot in the bar — burying the app's only
             way to load a save inside the Pages dropdown left fresh installs with no visible
             entry point. -->
        <RouterLink
          class="nav-toggle nav-data"
          to="/data"
          @click="close"
        >
          Data
        </RouterLink>
        <button
          class="nav-toggle"
          :aria-expanded="open"
          @click="open = !open"
        >
          Pages ▾
        </button>
        <div
          v-if="open"
          class="nav-menu"
        >
          <section
            v-for="g in groups"
            :key="g.id"
            class="nav-group"
          >
            <h3 class="nav-group-title">
              {{ g.label }}
            </h3>
            <RouterLink
              v-for="p in g.pages"
              :key="p.name"
              :to="p.path"
              class="nav-item"
              @click="close"
            >
              <SpriteIcon
                v-if="p.icon"
                :file="p.icon[0]"
                :dir="p.icon[1]"
                :size="18"
              />
              <span>{{ p.title }}</span>
            </RouterLink>
          </section>
        </div>
      </nav>
    </header>

    <main
      class="app-main"
      @click="close"
    >
      <RouterView />
    </main>
  </div>
</template>

<style>
:root {
  color-scheme: dark;
}

body {
  margin: 0;
  background: #111318;
  color: #e6e8ee;
  font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
}

img.px {
  image-rendering: pixelated;
  vertical-align: middle;
}

.app-shell {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.app-header {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  padding: 0.75rem 1.25rem;
  border-bottom: 1px solid #262a35;
  background: #161922;
  position: relative;
}

.app-title {
  font-size: 1.1rem;
  font-weight: 600;
  margin: 0;
  color: #e6e8ee;
  text-decoration: none;
}

.app-nav {
  position: relative;
}

.nav-toggle {
  background: #1e2230;
  color: #e6e8ee;
  border: 1px solid #2c3140;
  border-radius: 6px;
  padding: 0.35rem 0.75rem;
  font-size: 0.9rem;
  cursor: pointer;
}

.nav-data {
  text-decoration: none;
  margin-right: 0.4rem;
  display: inline-block;
}

.nav-data.router-link-active {
  border-color: #4c7dd4;
}

.nav-toggle:hover {
  background: #262c3c;
}

.nav-menu {
  position: absolute;
  top: calc(100% + 0.5rem);
  left: 0;
  z-index: 20;
  display: grid;
  grid-template-columns: repeat(3, minmax(11rem, 1fr));
  gap: 0.25rem 1.25rem;
  max-height: 75vh;
  overflow-y: auto;
  padding: 1rem 1.25rem;
  background: #161922;
  border: 1px solid #2c3140;
  border-radius: 10px;
  box-shadow: 0 12px 32px rgb(0 0 0 / 45%);
}

.nav-group {
  min-width: 11rem;
}

.nav-group-title {
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #6b7488;
  margin: 0.6rem 0 0.35rem;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.28rem 0.4rem;
  border-radius: 5px;
  color: #9aa4b8;
  text-decoration: none;
  font-size: 0.88rem;
}

.nav-item:hover {
  background: #1e2230;
  color: #e6e8ee;
}

.nav-item.router-link-active {
  color: #e6e8ee;
  font-weight: 600;
}

.app-main {
  flex: 1;
  padding: 1.25rem;
}
</style>
