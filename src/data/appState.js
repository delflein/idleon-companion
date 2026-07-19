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
import { shallowRef, markRaw, reactive } from "vue";
import { openSave } from "../core/savemap.mjs";
import { db, latestSnapshot, getRaw, getSetting, setSetting } from "./db.js";
import { ingest } from "./ingest.js";
import { ingestInWorker, workerAvailable } from "./workerClient.js";
import { fetchSave } from "./sync.js";

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
