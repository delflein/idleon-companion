/* src/data/worker.js — the parse-heavy data operations, off the main thread (docs/ARCHITECTURE.md
 * D3: "rebuildDerived run in a Web Worker, so a parser fix backfills all history" without janking
 * the UI — replaying years of raws through the whole recipe engine is seconds of CPU). ingest's
 * parse step lives here too, for the same reason.
 *
 * The worker opens its OWN Dexie connection to the same-named database (IndexedDB is available in
 * workers, and Dexie handles multi-connection access). The core imports cleanly here precisely
 * because it is framework-free (survey-core.md §2). Tiny message protocol:
 *
 *   { id, op: 'ingest', raw, ts?, source?, charNames? }  -> { id, ok, result } | { id, ok:false, error }
 *   { id, op: 'rebuild' }                                 -> progress {id, op:'progress', done,total}
 *                                                            then { id, ok, result:{count} }
 */
import { createDb } from "./db.js";
import { ingest, rebuildDerived } from "./ingest.js";

const db = createDb();

self.onmessage = async (ev) => {
  const { id, op } = ev.data;
  try {
    if (op === "ingest") {
      const { raw, ts, source, charNames } = ev.data;
      const result = await ingest(db, raw, { ts, source, charNames });
      self.postMessage({ id, ok: true, result });
    } else if (op === "rebuild") {
      const count = await rebuildDerived(db, {
        onProgress: (p) => self.postMessage({ id, op: "progress", ...p }),
      });
      self.postMessage({ id, ok: true, result: { count } });
    } else {
      self.postMessage({ id, ok: false, error: `unknown op: ${op}` });
    }
  } catch (e) {
    self.postMessage({ id, ok: false, error: e?.message || String(e) });
  }
};
