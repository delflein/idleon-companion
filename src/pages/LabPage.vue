<script setup>
/**
 * LabPage — the lab.html port. Legacy lab.html reads NO `entities.w4` data at all
 * (docs/migration/survey-pages.md: "none (static stub)... KPI tiles, gapbox callout — no
 * tables/charts") — there is no `entities.w4.lab` entity yet (domain.mjs has never wrapped
 * `bonuses/labboard.mjs`'s connectivity solver into one), so this page cannot render live
 * connectivity data honestly. Rather than guess a shape or invent a "disconnected" state (the
 * README honesty rule this repo lives by: unknown beats guessed), it stays a static status strip
 * + cross-links to the two recipes that already carry a Lab-jewel term as an honest lower bound
 * (`mealBonuses` on MealsPage, `kitchenSpeed` on KitchensPage — both render their "jewel unread"
 * terms as `unknown`/partial via StatModule/Chip, never as a fake "disconnected" value) plus a
 * gap explainer for what a real module still needs. Legacy's cross-links pointed at
 * `stats.html?recipe=...`, which has no SPA route yet (StatsPage.vue is still a stub) — the SPA
 * equivalent is linking straight to the page that already hosts that recipe's live StatModule.
 */
import SpriteIcon from "../ui/SpriteIcon.vue";
</script>

<template>
  <header class="app">
    <h1>Lab</h1>
  </header>
  <div
    id="err"
    class="err"
  />

  <div class="cards">
    <div class="tile pending">
      <SpriteIcon
        file="Laboratory"
        dir="afk_targets"
        :size="28"
      />
      <div class="label">
        Mainframe connectivity
      </div>
      <div class="value">
        —
      </div>
      <div class="sub">
        no entities.w4 data yet
      </div>
    </div>
    <div class="tile">
      <div class="label">
        Meal global multi — Lab jewel term
      </div>
      <div class="value">
        <RouterLink
          to="/meals"
          style="font-size:14px"
        >
          see breakdown ↗
        </RouterLink>
      </div>
      <div class="sub">
        jewel 116, currently unread → lower bound
      </div>
    </div>
    <div class="tile">
      <div class="label">
        Kitchen speed — Lab jewel terms
      </div>
      <div class="value">
        <RouterLink
          to="/kitchens"
          style="font-size:14px"
        >
          see breakdown ↗
        </RouterLink>
      </div>
      <div class="sub">
        jewels 100 &amp; 114, currently unread → lower bound
      </div>
    </div>
  </div>

  <section class="panel">
    <h2>
      <SpriteIcon
        file="Laboratory"
        dir="afk_targets"
        :size="20"
      />
      Lab
      <span class="hint">
        Mainframe nodes, jewels and chips — not yet surfaced as a save-derived entity on this
        page.
      </span>
    </h2>
    <div class="gapbox">
      <h3>Why there's no Lab module yet</h3>
      <p>
        A connectivity FLOOR SOLVER already exists server-side (<code>bonuses/labboard.mjs</code>
        — 18 mainframe nodes + 24 jewels, proven-or-unknown, never guessed) and node/jewel
        geometry is fully extracted (<code>gamedata-lab.mjs</code>). But
        <b>domain.mjs exposes none of it as an entity</b> — every page must read
        <code>entities.w4</code>, and today that object has no <code>lab</code> key. This page is
        scoped to NOT add new backend, so it stops at these cross-links instead of guessing at a
        shape.
      </p>
      <h3>What the interview pass needs to unblock a real Lab module</h3>
      <ul>
        <li>
          A <code>domain.mjs</code> <code>e.w4.lab</code> entity wrapping
          <code>solveLab(ctx)</code>'s proven node/jewel connectivity, plus each node's off/on
          value pair (from <code>bonuses/lab.mjs</code>'s <code>LAB_ROWS</code> — currently 16 of
          18 node ids covered, ids 8/15 need an evidence pass).
        </li>
        <li>
          Per-character equipped chips (<code>savemap</code> already has
          <code>sel.labChips</code>) surfaced per-char — <code>bonuses/chips.mjs</code> only
          resolves 3 of ~70 possible chip keys (<code>dr</code>/<code>card1</code>/<code>card2</code>)
          today, so a chip-rotation table needs the rest of <code>gamedata-cards.mjs</code>'s
          <code>CHIP_KEY</code>/<code>CHIP_VALUE</code> audited against N.js.
        </li>
        <li>
          A product decision on what the module should actually recommend: line-width/range
          priority for a still-unconnected node vs. jewel purchase priority vs. chip loadout —
          the research pass flagged this as a "weaker push-higher fit" since the underlying
          mechanic is a binary connected/not-connected outcome, not a smooth stat.
        </li>
      </ul>
    </div>
  </section>
</template>

<style scoped>
/* .tile.pending isn't in src/styles/base.css (only section.panel.pending is) — legacy
 * lab.html's own <style> block defined it locally too. One-off, kept scoped here rather than
 * touching the shared stylesheet for a single dimmed tile. */
.tile.pending { opacity: .5; }
</style>
