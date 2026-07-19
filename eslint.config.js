import js from "@eslint/js";
import vue from "eslint-plugin-vue";
import globals from "globals";
import { defineConfig, globalIgnores } from "eslint/config";

// Flat config, scoped to the M1 app (src/**, config files at root). Legacy root *.html /
// *.mjs pages and the pre-migration idleon-toolbox/ clone are owned by other packages/agents —
// ignored here rather than linted.
export default defineConfig([
  globalIgnores([
    "dist/**",
    "node_modules/**",
    // Everything below is owned by other packages/agents (see repo-root CLAUDE.md's file
    // ownership) — the ~45 legacy root *.html pages, their *.mjs modules, and the pre-migration
    // reference clone. `eslint .` walks the whole repo by default, so without these the linter
    // would sweep N.js (24 MB decompiled client) and OOM, plus flag code this package doesn't own.
    "idleon-toolbox/**",
    "stats/**",
    "bonuses/**",
    "savemap/**",
    "scripts/**",
    "*.mjs",
    "*.js",
    "*.html",
    "!vite.config.mjs",
    "!eslint.config.js",
  ]),
  js.configs.recommended,
  vue.configs["flat/recommended"],
  {
    files: ["**/*.{js,mjs,vue}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: { ...globals.browser, ...globals.es2024 },
    },
    rules: {
      "vue/multi-word-component-names": "off",
    },
  },
  {
    files: ["vite.config.mjs", "eslint.config.js"],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
]);
