/* src/data/appState.js — the app-wide data store and the ONE deliberate exception to the layering
 * rule: this file may import from 'vue' (reactivity primitives ONLY — no components), because it is
 * the seam between the framework-free data layer (db/ingest/sync/worker) and the Vue UI. Everything
 * below it stays Vue-free so it runs in a Web Worker; everything above it (src/ui, src/pages) reads
 * this store. Keep it that way.
 *
 * State shape (docs/ARCHITECTURE.md D1: parse once, derive many — one save object, markRaw'd so Vue
 * never deep-proxies ~800 KB of save data):
 *   { snapshotId, ts, charNames, raw, save }   where `save` is openSave(raw, charNames).
 *
 * Manual stat inputs (tomePoints / labConnectedIds / activeVote) live in the settings store and
 * feed every stat evaluation — the exact statInputs()/statOpts() contract ported from
 * companion.mjs: blank string = null = honestly unknown, NEVER guessed (README honesty rule).
 */
import { shallowRef, markRaw, reactive, computed, ref } from "vue";
import { openSave } from "../core/savemap.mjs";
import { db, latestSnapshot, getRaw, getSetting, setSetting } from "./db.js";
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

/** Load the latest snapshot from Dexie on boot (no network). Null-safe: fresh installs stay empty. */
export async function init() {
  const snap = await latestSnapshot();
  if (!snap) return;
  const raw = await getRaw(snap.id);
  if (!raw) return; // legacy metric-only snapshot with no raw — nothing to parse
  setState(raw, snap.charNames ?? null, snap.id, snap.ts);
  lastSync.value = { ts: snap.ts, source: snap.source };
  await loadStatInputs();
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

/* ---------- manual stat inputs (settings-backed; keys shared with companion.mjs's SQLite era so
 * an imported idleon.db carries them straight over) ---------- */

const STAT_KEYS = ["statTomePoints", "statLabConnected", "statActiveVote"];

/** Raw values as stored (strings; "" = not set) — bound directly by the Data page inputs. */
export const statInputs = reactive({ statTomePoints: "", statLabConnected: "", statActiveVote: "" });

async function loadStatInputs() {
  for (const k of STAT_KEYS) statInputs[k] = (await getSetting(k, "")) ?? "";
}

/** Persist one manual input. Empty string clears it back to "unknown". */
export async function setStatInput(key, value) {
  if (!STAT_KEYS.includes(key)) throw new Error(`unknown stat input: ${key}`);
  const v = String(value ?? "").trim();
  statInputs[key] = v;
  await setSetting(key, v);
}

/**
 * Parse the manual inputs into evaluate() opts — companion.mjs's statOpts() verbatim in behaviour.
 * Blank stays null so the engine reports the dependent term unknown rather than fabricating a value.
 * Reads the reactive `statInputs`, so the derived computeds below track it and re-evaluate when the
 * user edits an input.
 */
export function statOpts() {
  const t = statInputs.statTomePoints;
  const lab = statInputs.statLabConnected;
  const vote = statInputs.statActiveVote;
  return {
    tomePoints: t !== "" && isFinite(Number(t)) ? Number(t) : null,
    labConnectedIds: lab !== "" ? lab.split(",").map((x) => Number(x.trim())).filter(Number.isFinite) : null,
    activeVote: vote !== "" && isFinite(Number(vote)) ? Number(vote) : null,
  };
}

/* ---------- derived computeds (docs/ARCHITECTURE.md D1: parse once, derive many) ----------
 * The single seam where the framework-free derivation layer (derived.js, mirrors the old REST
 * endpoints) meets Vue reactivity. Each is a lazy, cached computed() over the current save +
 * statOpts() — a page reads these INSTEAD of the fetch('/api/X') it used against the old server.
 * `stats`/`farming` track statInputs (via statOpts()), so editing a manual input re-evaluates
 * exactly the panels that depend on it, nothing else. */

/** `/api/state` snapshot.entities — the per-system entity tree (numbers pages render). */
export const entities = computed(() => (state.value ? deriveEntities(state.value.raw, state.value.charNames) : null));

/** `/api/state` snapshot.metrics — the flat {key:number} map (derived off `entities`, not re-parsed). */
export const metrics = computed(() => (entities.value ? deriveMetrics(entities.value) : null));

/** `/api/stats` .stats — every recipe evaluated per-char, with the manual inputs applied. Default
 * (Explorer) villager; a page needing a specific villager's breakdown calls derived.deriveStats
 * directly with { villager, ...statOpts() }. */
export const stats = computed(() => (state.value ? deriveStats(state.value.save, statOpts()) : null));

/** `/api/farming` .report — the four-module farming report. */
export const farming = computed(() => (state.value ? deriveFarming(state.value.save, statOpts()) : null));

/* ---------- history (charts) ----------
 * The time-series stays in Dexie (ingest.js's history()); pages that chart a metric call this to
 * async-load {key:[{ts,v}]} into a ref. Reload after a sync/rebuild via the returned reload().
 */
/**
 * @param {string[]|null} keys metric keys to load (null = all — the rare full-scan path)
 * @param {string|null} [from] inclusive ISO lower bound
 * @returns {{ series: import('vue').Ref<object>, loading: import('vue').Ref<boolean>, reload: () => Promise<void> }}
 */
export function useHistory(keys, from = null) {
  const series = ref({});
  const loading = ref(false);
  async function reload() {
    loading.value = true;
    try {
      series.value = await history(db, keys, from);
    } finally {
      loading.value = false;
    }
  }
  reload();
  return { series, loading, reload };
}
