/* src/data/appState.js — the app-wide data store and the ONE deliberate exception to the layering
 * rule: this file may import from 'vue' (reactivity primitives ONLY — no components), because it is
 * the seam between the framework-free data layer (db/ingest/sync/worker) and the Vue UI. Everything
 * below it stays Vue-free so it runs in a Web Worker; everything above it (src/ui, src/pages) reads
 * this store. Keep it that way.
 *
 * State shape (docs/ARCHITECTURE.md D1: parse once, derive many — one save object, markRaw'd so Vue
 * never deep-proxies ~800 KB of save data):
 *   { snapshotId, ts, charNames, raw, save }   where `save` is openSave(raw, charNames).
 */
import { shallowRef, markRaw, computed, ref, watchEffect } from "vue";
import { openSave } from "../core/savemap.mjs";
import { db, latestSnapshot, getRaw } from "./db.js";
import { ingest, history } from "./ingest.js";
import { ingestInWorker, workerAvailable } from "./workerClient.js";
import { fetchSave } from "./sync.js";
import { deriveEntities, deriveMetrics, deriveStats, deriveFarming } from "./derived.js";

/** The current snapshot in memory, or null before init()/first sync. */
export const state = shallowRef(null);

/** Last successful sync/load metadata for the Data page status line. */
export const lastSync = shallowRef(null); // { ts, source } | null

function setState(raw, charNames, snapshotId, ts) {
  state.value = {
    snapshotId,
    ts,
    charNames: charNames ?? null,
    raw: markRaw(raw),
    save: markRaw(openSave(raw, charNames)),
  };
}

// TEST-ONLY SEAM (test/pages.test.js): seeds `state` synchronously the same way init() would,
// without touching Dexie. Lets the page-mount harness get real entities/stats/farming computeds
// from a fixture raw save without spinning up IndexedDB reads. Not called by any app code path.
export function _seedForTest(raw, charNames = null, { snapshotId = 0, ts = new Date().toISOString() } = {}) {
  setState(raw, charNames, snapshotId, ts);
}

/** Load the latest snapshot from Dexie on boot (no network). Null-safe: fresh installs stay empty. */
export async function init() {
  const snap = await latestSnapshot();
  if (!snap) return;
  const raw = await getRaw(snap.id);
  if (!raw) return; // legacy metric-only snapshot with no raw — nothing to parse
  setState(raw, snap.charNames ?? null, snap.id, snap.ts);
  lastSync.value = { ts: snap.ts, source: snap.source };
}

/**
 * Sync now: fetch the live save (sync.js), ingest it (parse + persist happen in the worker so the
 * UI never janks), then refresh the in-memory state. The raw is already in hand from fetchSave, so
 * we openSave() it directly rather than round-tripping through Dexie.
 */
export async function syncNow(source = "manual") {
  const { raw, charNames } = await fetchSave();
  const result = workerAvailable()
    ? await ingestInWorker(raw, { source, charNames })
    : await ingest(db, raw, { source, charNames }); // inline fallback (non-worker envs)
  setState(raw, charNames, result.id, result.ts);
  lastSync.value = { ts: result.ts, source };
  return result;
}

/* Manual stat inputs (tomePoints / labConnectedIds / activeVote) were REMOVED 2026-07-20: every
 * one of them is auto-derived now — the Tome score is computed natively (stats/tome.mjs, as a
 * floor), lab connectivity comes from the board solver, and the active vote arrives in
 * __serverVars on every sync. The engine's opts seam still exists (evaluate() accepts them), so
 * a pinning UI could return — but with no UI feeding them, affected terms simply follow the
 * honesty contract: derived where provable, unknown/lower-bound where not. */

/* ---------- derived computeds (docs/ARCHITECTURE.md D1: parse once, derive many) ----------
 * The single seam where the framework-free derivation layer (derived.js, mirrors the old REST
 * endpoints) meets Vue reactivity. Each is a lazy, cached computed() over the current save —
 * a page reads these INSTEAD of the fetch('/api/X') it used against the old server. */

/** `/api/state` snapshot.entities — the per-system entity tree (numbers pages render). */
export const entities = computed(() => (state.value ? deriveEntities(state.value.raw, state.value.charNames) : null));

/** `/api/state` snapshot.metrics — the flat {key:number} map (derived off `entities`, not re-parsed). */
export const metrics = computed(() => (entities.value ? deriveMetrics(entities.value) : null));

/** `/api/stats` .stats — every recipe evaluated per-char. Default (Explorer) villager; a page
 * needing a specific villager's breakdown calls derived.deriveStats directly with { villager }. */
export const stats = computed(() => (state.value ? deriveStats(state.value.save) : null));

/** `/api/farming` .report — the four-module farming report. */
export const farming = computed(() => (state.value ? deriveFarming(state.value.save) : null));

/* ---------- history (charts) ----------
 * The time-series stays in Dexie (ingest.js's history()); pages that chart a metric call this to
 * async-load {key:[{ts,v}]} into a ref. Reload after a sync/rebuild via the returned reload().
 */
/**
 * @param {string[]|null|(() => string[]|null)} keys metric keys to load (null = all — the rare
 *   full-scan path). Pass a GETTER for keys derived from reactive state — the load re-runs when
 *   the getter's result changes.
 * @param {string|null} [from] inclusive ISO lower bound
 * @returns {{ series: import('vue').Ref<object>, loading: import('vue').Ref<boolean>, reload: () => Promise<void> }}
 */
export function useHistory(keys, from = null) {
  const series = ref({});
  const loading = ref(false);
  const resolveKeys = typeof keys === "function" ? keys : () => keys;
  async function reload() {
    loading.value = true;
    try {
      series.value = await history(db, resolveKeys(), from);
    } finally {
      loading.value = false;
    }
  }
  /* Re-load when the key set changes (getter form) or when a sync/rebuild lands a new snapshot —
   * without this, a page mounted before the first-ever sync would keep an empty history for the
   * whole visit (pilot-batch finding). watchEffect tracks resolveKeys()'s reactive deps plus
   * state's snapshot identity; the JSON key makes "same keys, new array" a no-op. */
  let lastTrigger = null;
  watchEffect(() => {
    const trigger = JSON.stringify([resolveKeys(), state.value?.snapshotId ?? null, state.value?.ts ?? null]);
    if (trigger === lastTrigger) return;
    lastTrigger = trigger;
    reload();
  });
  return { series, loading, reload };
}
