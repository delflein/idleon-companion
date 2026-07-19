import { createRouter, createWebHashHistory } from "vue-router";

// Hash routing (docs/ARCHITECTURE.md D5) — zero-config on GitHub Pages, no 404.html trick needed.
export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: "/", name: "home", component: () => import("./pages/HomePage.vue") },
    { path: "/sync-spike", name: "sync-spike", component: () => import("./pages/SyncSpike.vue") },
  ],
});
