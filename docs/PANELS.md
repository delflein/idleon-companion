# PANELS.md — how to add a panel (the M5 loop)

M4 built the shared UI kit (`src/ui/**`) and a demo page (`src/pages/HomePage.vue`). M5 is
where it pays off: porting the ~45 legacy root `*.html` pages, one at a time, into real
`src/pages/*.vue` routes. This is the loop, concretely, using `mining.html` -> a hypothetical
`src/pages/MiningPage.vue` as the worked example (mining.html is the thinnest legacy page — its
whole body is one `StatModule` — so it is the best first real port).

## The loop

1. **Pick a legacy page.** Prefer the queue order in
   `docs/migration/survey-pages.md`'s inventory table, thinnest/least-domain-logic first
   (mining, choppin, shrines, statues, owl, ...) before the five flagged high-risk pages
   (dashboard, sailing, landrank, gaming, beanstalk — those need their page-local domain logic
   ported into `src/core/` FIRST, with an N.js citation, per docs/ARCHITECTURE.md D8).

2. **Find its stat recipe(s) / entities.** Cross-reference the inventory table's "API endpoints"
   and "Entities/keys consumed" columns:
   - A recipe name (`stats.miningEff`) means `src/core/stats/<name>.mjs` already has the
     evaluator (M2 ported all of them) — no new core work needed, just call
     `evaluatePerChar(recipe, save, opts)` (or the registry's `evaluateAll`) from the page.
   - An `entities.wN.*` field means the page also needs raw save-derived display data beyond a
     single stat (e.g. mining.html doesn't need this — it's recipe-only; sneaking.html does, for
     its stealth table / emporium / charms / gemstones panels). That data comes from
     `src/core/domain.mjs`'s `extractEntities()`, already ported in M2.
   - Flagged page-local domain logic (survey-pages.md's numbered list) must be ported into
     `src/core/` — with the N.js citation — BEFORE the page ports, not copy-pasted into the
     Vue component. `src/core/**` stays framework-free (docs/ARCHITECTURE.md D2/CLAUDE.md
     layering rule) so it's testable and reusable the same way the stats/ recipes are.

3. **Compose the page from `src/ui/` components.** Don't hand-roll markup that a component
   already covers:
   - One `StatModule` per recipe the page shows (mining.html: exactly one, `miningEff`).
   - `DataTable` for anything with a sortable column header (most legacy pages used a
     `<select>`-driven re-render instead — prefer `DataTable`'s real click-to-sort now that it's
     free).
   - `LevelBar` / `Chip` / `ShowMore` for the small recurring widgets — don't recreate the
     "cap at 10, click to reveal the rest" idiom inline.
   - `TimeChart` for anything wanting more than a trend glance (dashboard.html's old
     `renderHistory`); `Sparkline` for the inline per-row trend the way `StatModule` already
     uses it per term.
   - Page-unique, non-recurring UI (farming's plot grid, landrank's orb board, sailing's
     captain-shop table) stays bespoke in the page component — forcing it into a shared
     component that only that one page uses is not the goal.

4. **Wire the route.** Add the route to `src/router.js` (owned by the router-layer agent /
   whoever's turn it is — M4 does not touch it): `{ path: "/mining", name: "mining", component:
   () => import("./pages/MiningPage.vue") }`, and a nav entry once the header/nav component
   exists. One page per skill/system/feature (CLAUDE.md's "page per system" rule) — never a
   per-world grouping, so `MiningPage.vue`, not `World1Page.vue`.

5. **Delete the legacy page only when its replacement renders real data**
   (docs/ARCHITECTURE.md's migration-plan note) — not before. Until then the legacy `mining.html`
   keeps working standalone against the old companion server.

## Code skeleton

```vue
<!-- src/pages/MiningPage.vue -->
<script setup>
import { computed, shallowRef } from "vue";
import { evaluatePerChar } from "../core/stats/engine.mjs";
import { miningEff } from "../core/stats/mining-eff.mjs";
import StatModule from "../ui/StatModule.vue";
// import { useSaveStore } from "../data/save-store.js"; // whatever M3's save-access API ends up being

// shallowRef + markRaw for the parsed save (docs/ARCHITECTURE.md D1) — one big object, replaced
// whole on each sync/rebuild, never mutated. Every panel below derives from it via computed().
const save = shallowRef(/* injected/loaded parsed save */ null);
const history = shallowRef(/* {} from src/data's history(keys) */ {});

const miningStat = computed(() => {
  if (!save.value) return null;
  const { byChar, collapsed, sensitive } = evaluatePerChar(miningEff, save.value);
  return { name: miningEff.name, label: miningEff.label, format: miningEff.format ?? "multiplier",
    display: miningEff.display ?? {}, byChar, collapsed, sensitive };
});

const charNames = computed(() => save.value?.charNames ?? []);
</script>

<template>
  <header class="app">
    <h1>Mining</h1>
  </header>
  <div id="err" class="err" />
  <StatModule
    :stat="miningStat"
    title="Mining Efficiency"
    :icon="{ file: 'Copper', dir: 'afk_targets' }"
    blurb="Every source that speeds up mining, per character — tool, talents, stats, statue, and stamps."
    :char-names="charNames"
    :series="history"
  />
</template>
```

That's the whole page for a `mining.html`-shape port: one recipe, one `StatModule`, no bespoke
markup. Sneaking-shaped pages (bigger recipe pages) add a few more sibling sections
(`DataTable`/`ShowMore` for the emporium/charms/gemstones lists) before or after the
`StatModule`, following the same "compose, don't reinvent" rule.
