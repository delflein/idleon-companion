import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { VitePWA } from "vite-plugin-pwa";

// GitHub Pages subpath — the repo is served at https://<user>.github.io/idleon-companion/.
// See docs/ARCHITECTURE.md D5 (hash routing + vite-plugin-pwa, no meta-framework).
const BASE = "/idleon-companion/";

export default defineConfig({
  base: BASE,
  plugins: [
    vue(),
    VitePWA({
      registerType: "prompt",
      includeAssets: ["icons/icon-192.png", "icons/icon-512.png"],
      manifest: {
        name: "IdleOn Companion",
        short_name: "IdleOn Companion",
        description: "Save-synced stat tracking and planning for Legends of Idleon.",
        scope: BASE,
        start_url: BASE,
        display: "standalone",
        background_color: "#111318",
        theme_color: "#111318",
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" },
        ],
      },
      // No legacy root HTML pages are part of this build — Vite's default input is the root
      // index.html only, and the workbox glob below is scoped to the built dist/ output, not
      // the repo root, so the ~45 legacy *.html pages never enter the service-worker cache.
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,ico,woff2}"],
      },
    }),
  ],
});
