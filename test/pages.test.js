/* test/pages.test.js — the reusable page-mount harness (M5-prep, PILOT BATCH — read this before
 * copying the pattern into batch 2+; nothing here should need editing when a later batch migrates
 * its own pages, only router.js's PAGES array growing "pending" entries into real ones).
 *
 * What this proves per page:
 *   - still-pending pages (rendering the shared PendingPage stub, detected via its `data-pending`
 *     marker) are auto-skipped, not asserted on — router.js currently lists 47 pages, 7 of which
 *     are real (home/data/sync-spike from M1/M3/M4 + this batch's mining/choppin/worship/shrines),
 *     leaving 40 pending;
 *   - every migrated page mounts without throwing, renders non-trivial text (>200 chars), and
 *     contains none of the honesty-contract red flags ('NaN', 'undefined', '[object Object]') —
 *     the exact bugs a half-wired computed() or a missing null-guard would produce.
 *
 * Personal save data: this suite reads the latest raw save straight out of ./idleon.db (the
 * legacy companion's SQLite store) via node:sqlite, so assertions run against a REAL account
 * rather than a synthetic fixture — closer to a true regression check on the actual numbers a
 * page renders. idleon.db is gitignored and never committed; CI (and any fresh clone) has no such
 * file, so the whole suite SKIPS cleanly rather than failing — see test/support/fixture.mjs.
 *
 * How a page mounts under plain `node --test` (no Vite/Jest/Vitest):
 *   - test/support/vue-loader.mjs is an in-thread Node ESM loader hook (`node:module`'s
 *     `registerHooks()`) that compiles .vue SFCs on the fly via @vue/compiler-sfc (already a
 *     transitive dependency of `vue` itself — no new package for this). It must be imported
 *     before any dynamic `import()` of a .vue file; router.js's PAGES entries are all lazy
 *     `() => import("./pages/X.vue")`, so importing it up top here is early enough.
 *   - test/support/dom-env.mjs installs the minimal happy-dom globals (window/document/...) Vue's
 *     runtime-dom + vue-router's hash history touch.
 *   - `./setup.js` (fake-indexeddb + the dexie-export-import `self` shim) is imported first, same
 *     as test/data.test.js — Dexie-backed bits (appState.js's `useHistory`) resolve against an
 *     empty in-memory IndexedDB rather than throwing under Node (there is no real browser store).
 *   - state is seeded via appState.js's `_seedForTest` seam (a tiny, clearly-marked micro-edit) —
 *     the same shape `init()` would produce from a real Dexie snapshot, without touching Dexie.
 *   - The REAL router (src/router.js's singleton) is pushed to each page's route before mounting,
 *     so `useRoute()`/route.meta work exactly as in the app; RouterLink/RouterView are global
 *     stubs (per the PART 1 brief) since no page in this batch needs their real navigation
 *     behavior to render its own content.
 *
 * A LATER BATCH ADDS ZERO LINES HERE: rewriting a stub page.vue file (router.js untouched, this
 * file untouched) simply moves that page out of "skipped (pending)" and into the asserted set the
 * next time this suite runs — the whole point of PAGES being the one source of truth (router.js's
 * own header comment).
 */
import "./setup.js"; // MUST be first: fake-indexeddb + dexie-export-import's `self` shim
import "./support/vue-loader.mjs"; // MUST be before any dynamic import() of a .vue file

import { test } from "node:test";
import assert from "node:assert/strict";

import { installDomEnv } from "./support/dom-env.mjs";
import { loadLatestFixture } from "./support/fixture.mjs";

// happy-dom globals must exist before vue-router/runtime-dom modules are evaluated below.
installDomEnv();

const { mount, flushPromises } = await import("@vue/test-utils");
const { router, PAGES } = await import("../src/router.js");
const { _seedForTest } = await import("../src/data/appState.js");

const FORBIDDEN = ["NaN", "undefined", "[object Object]"];

const fixture = await loadLatestFixture();

if (!fixture) {
  test("pages: skipped — ./idleon.db not present (no personal save data in this environment)", { skip: true }, () => {});
} else {
  _seedForTest(fixture.raw, fixture.charNames, { ts: fixture.ts });

  for (const page of PAGES) {
    test(`page: ${page.name} (${page.path})`, async (t) => {
      const Comp = (await page.component()).default;

      await router.push({ name: page.name });
      await router.isReady();

      const wrapper = mount(Comp, {
        global: {
          plugins: [router],
          stubs: { RouterLink: true, RouterView: true },
        },
      });
      // Let any immediately-resolving onMounted() async work (e.g. DataPage's init()) settle
      // before reading the DOM — otherwise a real page's FIRST paint (before its data loads)
      // could look "trivial" and fail the >200-char check through no fault of its own wiring.
      await flushPromises();
      await flushPromises();

      const isPending = wrapper.find("[data-pending]").exists();
      if (isPending) {
        t.skip("still PendingPage — not migrated yet");
        wrapper.unmount();
        return;
      }

      const text = wrapper.text();
      const html = wrapper.html();
      assert.ok(
        text.length > 200,
        `${page.name}: rendered text is only ${text.length} chars (expected >200 for a migrated page) — text: ${JSON.stringify(text.slice(0, 300))}`,
      );
      for (const bad of FORBIDDEN) {
        assert.ok(!text.includes(bad), `${page.name}: rendered text contains "${bad}"`);
        assert.ok(!html.includes(bad), `${page.name}: rendered HTML contains "${bad}"`);
      }

      wrapper.unmount();
    });
  }
}
