/* test/support/vue-loader.mjs — Node ESM loader hook that compiles .vue Single-File Components
 * on the fly using @vue/compiler-sfc (already a transitive dependency of `vue` itself — no new
 * package added for this). This is what lets `test/pages.test.js` `import()` real page/ui .vue
 * files under plain `node --test`, with no Vite/Jest/Vitest involved.
 *
 * Registers itself via `node:module`'s `registerHooks()` (in-thread, synchronous hook — the
 * non-deprecated replacement for `register()`) as a side effect of being imported. Import this
 * module FIRST, before any dynamic `import()` of a .vue file (router.js's PAGES entries are all
 * `() => import("./pages/X.vue")` — lazy, so importing this at the top of pages.test.js is early
 * enough).
 *
 * Deliberately minimal: compiles <script setup> + <template> into one ESM module (`export default
 * { ..., render }`), matching what @vitejs/plugin-vue produces at build time (minus scoped-CSS
 * `<style>` handling, which page-mount assertions never need — see pages.test.js's assertions:
 * mount succeeds + rendered text is sane. Any later batch that needs style-dependent behavior in a
 * test should say so rather than silently rely on this).
 */
import { registerHooks } from "node:module";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parse, compileScript, compileTemplate } from "@vue/compiler-sfc";

function load(url, context, nextLoad) {
  // A plain CSS side-effect import (e.g. TimeChart.vue's `import "uplot/dist/uPlot.min.css"` —
  // Vite handles these at build time; plain Node has no loader for `.css` at all). Content is
  // irrelevant to a mount-and-read-text assertion, so stub it out to an empty module rather than
  // erroring — this is general (any future page pulling in any CSS-importing component benefits),
  // not a one-off fix for this batch's pages.
  if (url.endsWith(".css")) return { format: "module", source: "export default {};", shortCircuit: true };
  if (!url.endsWith(".vue")) return nextLoad(url, context);

  const filename = fileURLToPath(url);
  const source = readFileSync(filename, "utf-8");
  const { descriptor, errors } = parse(source, { filename });
  if (errors.length) throw new Error(`[vue-loader] ${filename}: ${errors.map((e) => e.message).join("; ")}`);

  // A stable-enough id for compiler scoping purposes (not used for scoped CSS here — see above).
  const id = filename.replace(/[^a-zA-Z0-9]/g, "_");

  const script = descriptor.scriptSetup || descriptor.script ? compileScript(descriptor, { id }) : null;

  // Vite injects `import.meta.env` at build time (SpriteIcon.vue reads `import.meta.env.BASE_URL`
  // per docs/ARCHITECTURE.md D5's GitHub Pages subpath handling); plain Node has no such global, so
  // shim it here rather than touch src/ui/SpriteIcon.vue (outside this batch's file ownership).
  let code = "import.meta.env ??= { BASE_URL: \"/\" };\n";
  code += script ? script.content : "export default {}";
  // The compiled script always ends with `export default { ... }` — rename it so we can attach
  // the compiled render function (Vue's own runtime looks for `.render` on the component object,
  // exactly how @vitejs/plugin-vue's own combined output works).
  code = code.replace(/export default/, "const __sfc__ =");

  if (descriptor.template) {
    const tmpl = compileTemplate({
      source: descriptor.template.content,
      filename,
      id,
      compilerOptions: { bindingMetadata: script?.bindings },
    });
    if (tmpl.errors.length) throw new Error(`[vue-loader] ${filename} template: ${tmpl.errors.map(String).join("; ")}`);
    code += `\n${tmpl.code}\n__sfc__.render = render;\n`;
  }

  code += `\n__sfc__.__file = ${JSON.stringify(filename)};\nexport default __sfc__;\n`;

  return { format: "module", source: code, shortCircuit: true };
}

registerHooks({ load });
