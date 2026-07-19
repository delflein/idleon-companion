/* test/setup.js — must be imported FIRST by every test file.
 *
 *  - fake-indexeddb/auto installs an in-memory IndexedDB so Dexie runs under node --test.
 *  - dexie-export-import reads `self` at module-load time (it exists in browsers/workers, the only
 *    place it runs in production). Node has no `self`, so we alias it to globalThis before that
 *    module is evaluated. This must run before any import of src/data/importExport.js.
 */
import "fake-indexeddb/auto";

if (typeof globalThis.self === "undefined") globalThis.self = globalThis;

// dexie-export-import's importInto reads incoming blobs via FileReader.readAsArrayBuffer (a browser
// API). Node has none — a tiny Blob-backed shim covers exactly the one method/event it touches.
if (typeof globalThis.FileReader === "undefined") {
  globalThis.FileReader = class {
    readAsArrayBuffer(blob) {
      blob
        .arrayBuffer()
        .then((result) => {
          this.result = result;
          this.onload?.({ target: this });
        })
        .catch((error) => {
          this.error = error;
          this.onerror?.({ target: this });
        });
    }
  };
}
