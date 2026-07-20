<script setup>
/* App shell — dark layout frame + the "world pills" navigation (mockups/header-bar.html,
 * variant C): the nav mirrors IdleOn's world structure. Dashboard is a plain link; each world
 * is its own pill (small W# label + the world's lead sprite) opening a flyout of that world's
 * pages; non-world groups (Account, Meta) are text dropdowns. Data keeps a permanent slot on
 * the right — it's the app's only way to load a save and must never be buried.
 *
 * Still fully data-driven from router.js's PAGES/NAV_GROUPS (M5-prep): a new page appears in
 * its world's flyout the moment its router entry exists — nobody edits this file for that.
 */
import { computed, ref } from "vue";
import { PAGES, NAV_GROUPS } from "./router.js";
import SpriteIcon from "./ui/SpriteIcon.vue";

const openId = ref(null); // which pill/dropdown is open (group id), or null

const isWorld = (id) => /^W\d$/.test(id);

// Worlds → pills (in NAV_GROUPS order); everything else → text dropdowns. Home and Data are
// pulled out (brand-adjacent Dashboard link / permanent Data button) so they aren't duplicated.
const grouped = computed(() =>
  NAV_GROUPS.map((g) => ({
    ...g,
    world: isWorld(g.id),
    pages: PAGES.filter((p) => p.group === g.id && p.name !== "home" && p.name !== "data"),
  })).filter((g) => g.pages.length),
);
const worldPills = computed(() => grouped.value.filter((g) => g.world));
const otherGroups = computed(() => grouped.value.filter((g) => !g.world));

/** The pill's face icon: the first page in the world that has one (the mockup's "lead icon"). */
const leadIcon = (g) => g.pages.find((p) => p.icon)?.icon ?? null;

function toggle(id) {
  openId.value = openId.value === id ? null : id;
}
function close() {
  openId.value = null;
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

      <nav class="pages">
        <RouterLink
          class="navlink"
          to="/"
          @click="close"
        >
          Dashboard
        </RouterLink>

        <!-- one pill per world -->
        <span
          v-for="g in worldPills"
          :key="g.id"
          class="dd wpill"
          :class="{ open: openId === g.id }"
        >
          <button
            class="trig"
            :aria-expanded="openId === g.id"
            @click.stop="toggle(g.id)"
          >
            <span class="wn">{{ g.id }}</span>
            <SpriteIcon
              v-if="leadIcon(g)"
              :file="leadIcon(g)[0]"
              :dir="leadIcon(g)[1]"
              :size="16"
            />
          </button>
          <div
            v-if="openId === g.id"
            class="dd-pop"
          >
            <div class="wname"><b>{{ g.id }}</b>{{ g.label.replace(/^W\d\s*[·—-]?\s*/, "") }}</div>
            <RouterLink
              v-for="p in g.pages"
              :key="p.name"
              :to="p.path"
              class="mrow"
              @click="close"
            >
              <SpriteIcon
                v-if="p.icon"
                :file="p.icon[0]"
                :dir="p.icon[1]"
                :size="16"
              />
              <span>{{ p.title }}</span>
            </RouterLink>
          </div>
        </span>

        <!-- non-world groups as text dropdowns -->
        <span
          v-for="g in otherGroups"
          :key="g.id"
          class="dd"
          :class="{ open: openId === g.id }"
        >
          <button
            class="trig"
            :aria-expanded="openId === g.id"
            @click.stop="toggle(g.id)"
          >
            {{ g.label }} <span class="caret">▼</span>
          </button>
          <div
            v-if="openId === g.id"
            class="dd-pop"
          >
            <RouterLink
              v-for="p in g.pages"
              :key="p.name"
              :to="p.path"
              class="mrow"
              @click="close"
            >
              <SpriteIcon
                v-if="p.icon"
                :file="p.icon[0]"
                :dir="p.icon[1]"
                :size="16"
              />
              <span>{{ p.title }}</span>
            </RouterLink>
          </div>
        </span>
      </nav>

      <span class="spacer" />

      <RouterLink
        class="navlink nav-data"
        to="/data"
        @click="close"
      >
        Data
      </RouterLink>
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
  gap: 9px;
  padding: 0.6rem 1.25rem;
  border-bottom: 1px solid #262a35;
  background: #161922;
  position: relative;
}

.app-header .spacer {
  flex: 1;
}

.app-title {
  font-size: 1.05rem;
  font-weight: 600;
  margin: 0 0.6rem 0 0;
  color: #e6e8ee;
  text-decoration: none;
  white-space: nowrap;
}

nav.pages {
  display: flex;
  align-items: center;
  gap: 2px;
  flex-wrap: wrap;
}

/* plain links (Dashboard, Data) share the trig look */
.navlink {
  color: #b7bfd0;
  text-decoration: none;
  font-size: 13px;
  font-weight: 650;
  padding: 5px 11px;
  border-radius: 9px;
}

.navlink:hover {
  background: #1e2230;
}

.navlink.router-link-exact-active,
.nav-data.router-link-active {
  color: #e6e8ee;
  background: #1e2230;
}

/* dropdown plumbing (mockup .dd/.dd-pop) */
.dd {
  position: relative;
}

.dd > button.trig {
  background: none;
  border: none;
  color: #b7bfd0;
  font: inherit;
  font-size: 13px;
  font-weight: 650;
  padding: 5px 11px;
  border-radius: 9px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
}

.dd > button.trig:hover {
  background: #1e2230;
}

.dd.open > button.trig {
  background: #232838;
  color: #e6e8ee;
}

.dd .caret {
  font-size: 9px;
  opacity: 0.6;
}

.dd-pop {
  position: absolute;
  top: calc(100% + 9px);
  left: 0;
  z-index: 60;
  min-width: 180px;
  background: #161922;
  border: 2px solid #2c3140;
  border-radius: 14px;
  box-shadow: 0 10px 30px rgb(0 0 0 / 45%);
  padding: 10px;
}

/* world pills (mockup .wpill) */
.wpill > button.trig {
  padding: 4px 8px;
  gap: 5px;
  font-weight: 750;
  color: #e6e8ee;
}

.wpill > button.trig .wn {
  font-size: 10px;
  font-weight: 800;
  color: #6b7488;
}

.wname {
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #6b7488;
  padding: 3px 9px 6px;
  white-space: nowrap;
}

.wname b {
  color: #4c7dd4;
  margin-right: 5px;
}

/* menu rows (mockup .mrow) */
.mrow {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 9px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 650;
  color: #e6e8ee;
  text-decoration: none;
  white-space: nowrap;
}

.mrow:hover {
  background: #1e2230;
}

.mrow.router-link-active {
  background: #1e2230;
}

.app-main {
  flex: 1;
  padding: 1.25rem;
}
</style>
