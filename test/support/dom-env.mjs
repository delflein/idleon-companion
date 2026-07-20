/* test/support/dom-env.mjs — installs a minimal happy-dom global environment so @vue/test-utils
 * can `mount()` real components under plain `node --test` (no browser, no jsdom). Exported as a
 * function (not a side-effecting module) so pages.test.js controls exactly when it runs, after
 * `./setup.js` (fake-indexeddb) and `./vue-loader.mjs` (the .vue compile hook) are both loaded.
 *
 * Only the globals Vue's runtime-dom + vue-router's hash history actually touch are defined —
 * this is not a general jsdom replacement, just enough surface for `mount()` + `createWebHashHistory`.
 */
import { Window } from "happy-dom";

export function installDomEnv(url = "http://localhost/#/") {
  const window = new Window({ url });
  const define = (k, v) => Object.defineProperty(globalThis, k, { value: v, configurable: true, writable: true });

  define("window", window);
  define("document", window.document);
  define("navigator", window.navigator);
  define("location", window.location);
  define("history", window.history);
  define("localStorage", window.localStorage);
  define("sessionStorage", window.sessionStorage);
  define("Element", window.Element);
  define("HTMLElement", window.HTMLElement);
  define("SVGElement", window.SVGElement);
  define("Node", window.Node);
  define("Text", window.Text);
  define("Comment", window.Comment);
  define("DocumentFragment", window.DocumentFragment);
  define("customElements", window.customElements);
  define("CustomEvent", window.CustomEvent);
  define("Event", window.Event);
  define("MutationObserver", window.MutationObserver);
  define("getComputedStyle", window.getComputedStyle.bind(window));
  define("requestAnimationFrame", (cb) => setTimeout(cb, 0));
  define("cancelAnimationFrame", (id) => clearTimeout(id));
  // ResizeObserver: happy-dom has no layout engine, so sizes are always 0 — fine for a mount-only
  // smoke test (TimeChart.vue's ResizeObserver callback simply never fires under this shim).
  define("ResizeObserver", window.ResizeObserver ?? class { observe() {} unobserve() {} disconnect() {} });
  define("addEventListener", window.addEventListener.bind(window));
  define("removeEventListener", window.removeEventListener.bind(window));
  define("devicePixelRatio", window.devicePixelRatio ?? 1);
  define("matchMedia", window.matchMedia.bind(window));

  // happy-dom has no canvas backend (`getContext('2d')` returns null) — uPlot (TimeChart.vue,
  // D6) unconditionally draws to one on mount/resize. A permissive no-op 2D context stub lets it
  // run its draw calls harmlessly instead of throwing (including on a stray post-unmount
  // requestAnimationFrame callback, which otherwise surfaces as an uncaught exception that fails
  // the whole test file rather than the one test). Not this batch's page — TimeChart is exercised
  // by HomePage.vue (M4) — but any future page using it hits the same gap, so this belongs in the
  // shared harness, not a page-specific workaround.
  const noopCtx = new Proxy(
    {},
    {
      get(target, prop) {
        if (prop === "measureText") return () => ({ width: 0 });
        if (prop === "createLinearGradient") return () => ({ addColorStop() {} });
        if (prop === "getImageData") return () => ({ data: [] });
        if (typeof target[prop] === "function") return target[prop].bind(target);
        if (prop in target) return target[prop];
        return () => {};
      },
      set(target, prop, value) {
        target[prop] = value;
        return true;
      },
    },
  );
  window.HTMLCanvasElement.prototype.getContext = function (type) {
    return type === "2d" ? noopCtx : null;
  };
  // uPlot also constructs `new Path2D()` directly (not just via ctx) — happy-dom has no Canvas
  // API at all, so this global is simply absent; a permissive no-op stub (any method call is a
  // no-op, same shape as noopCtx above) is enough for a mount-and-read-text assertion.
  define(
    "Path2D",
    function Path2D() {
      return new Proxy({}, {
        get(target, prop) {
          if (typeof target[prop] === "function") return target[prop].bind(target);
          return () => {};
        },
      });
    },
  );

  return window;
}
