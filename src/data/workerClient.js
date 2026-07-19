/* src/data/workerClient.js — main-thread proxy to worker.js. Correlates request/response by id and
 * surfaces the two heavy operations as promises. Framework-free (appState.js is the only caller).
 *
 * The worker is created lazily with Vite's documented `new Worker(new URL(...), {type:'module'})`
 * form so the bundler emits a real chunk for it. If Worker construction ever fails (e.g. a
 * non-worker test environment), callers fall back to running ingest/rebuild inline — see appState.
 */

let worker = null;
let seq = 0;
const pending = new Map(); // id -> { resolve, reject, onProgress }

function ensureWorker() {
  if (worker) return worker;
  worker = new Worker(new URL("./worker.js", import.meta.url), { type: "module" });
  worker.onmessage = (ev) => {
    const { id, op } = ev.data;
    const entry = pending.get(id);
    if (!entry) return;
    if (op === "progress") {
      entry.onProgress?.(ev.data);
      return;
    }
    pending.delete(id);
    if (ev.data.ok) entry.resolve(ev.data.result);
    else entry.reject(new Error(ev.data.error));
  };
  worker.onerror = (e) => {
    // A worker-level error rejects everything in flight; the seam is intentionally loud.
    for (const [, entry] of pending) entry.reject(new Error(e.message || "worker error"));
    pending.clear();
  };
  return worker;
}

function call(message, onProgress) {
  const w = ensureWorker();
  const id = ++seq;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject, onProgress });
    w.postMessage({ id, ...message });
  });
}

/** Parse + persist a raw save in the worker. Returns {id, ts, day, metricsCount}. */
export function ingestInWorker(raw, opts = {}) {
  return call({ op: "ingest", raw, ...opts });
}

/** Replay every stored raw, rewriting daily metric rows. onProgress({done,total}) is optional. */
export function rebuildInWorker(onProgress) {
  return call({ op: "rebuild" }, onProgress);
}

/** True if a worker could be constructed in this environment (used for the inline fallback). */
export function workerAvailable() {
  return typeof Worker !== "undefined";
}
