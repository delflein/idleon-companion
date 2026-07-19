import { createRouter, createWebHashHistory } from "vue-router";

/* router.js — the single, data-driven route + nav registry (M5-prep, deliverable B).
 *
 * PAGES is the ONE source of truth: App.vue builds the grouped nav from it, and the routes below
 * are generated from it. Each entry carries an EXPLICIT lazy `component: () => import("...")` with a
 * literal string so Vite statically analyses it and code-splits each page into its own chunk
 * (`npm run build` emits one JS chunk per page). 44 of them point at per-system wrapper files that
 * currently render the shared PendingPage stub; a batch agent ports a page by rewriting ONLY that
 * one wrapper .vue — it never edits this file — so parallel page ports never collide here.
 *
 * The remaining 3 (home/data/sync-spike) already point at their real components (M1/M3/M4).
 * dashboard.html is deliberately absent: it becomes route "/" (replacing HomePage) LATER.
 *
 * meta { title, icon:[file,dir], group } drives PendingPage's header and App.vue's nav. World
 * grouping (W1..W7 / Account / Meta) is nav-only; it follows the icon each legacy page's header
 * used (docs/migration/survey-pages.md).
 */
export const PAGES = [
  // Meta / utility (real pages already built)
  { name: "home", path: "/", title: "Home", icon: ["Sailing_Skill_0", "etc"], group: "Meta", component: () => import("./pages/HomePage.vue") },
  { name: "data", path: "/data", title: "Data", icon: ["Tome_0", "etc"], group: "Meta", component: () => import("./pages/DataPage.vue") },
  { name: "sync-spike", path: "/sync-spike", title: "Sync spike", icon: ["Sailing_Skill_0", "etc"], group: "Meta", component: () => import("./pages/SyncSpike.vue") },
  { name: "achievements", path: "/achievements", title: "Achievements", icon: ["Ribbon0", "data"], group: "Meta", component: () => import("./pages/AchievementsPage.vue") },

  // World 1 — Blunder Hills
  { name: "anvil", path: "/anvil", title: "Anvil", icon: ["SmithingHammerChisel", "data"], group: "W1", component: () => import("./pages/AnvilPage.vue") },
  { name: "choppin", path: "/choppin", title: "Choppin", icon: ["Oak_Tree", "afk_targets"], group: "W1", component: () => import("./pages/ChoppinPage.vue") },
  { name: "forge", path: "/forge", title: "Forge", icon: ["ForgeA", "data"], group: "W1", component: () => import("./pages/ForgePage.vue") },
  { name: "mining", path: "/mining", title: "Mining", icon: ["Copper", "afk_targets"], group: "W1", component: () => import("./pages/MiningPage.vue") },
  { name: "owl", path: "/owl", title: "Owl", icon: ["Owl", "etc"], group: "W1", component: () => import("./pages/OwlPage.vue") },
  { name: "stamps", path: "/stamps", title: "Stamps", icon: ["UIstampB", "data"], group: "W1", component: () => import("./pages/StampsPage.vue") },
  { name: "statues", path: "/statues", title: "Statues", icon: ["Statue1", "data"], group: "W1", component: () => import("./pages/StatuesPage.vue") },

  // World 2 — Yum-Yum Desert
  { name: "bubbles", path: "/bubbles", title: "Bubbles", icon: ["KrukPart", "data"], group: "W2", component: () => import("./pages/BubblesPage.vue") },
  { name: "cauldrons", path: "/cauldrons", title: "Cauldrons", icon: ["Liquid1_x1", "data"], group: "W2", component: () => import("./pages/CauldronsPage.vue") },
  { name: "fishing", path: "/fishing", title: "Fishing", icon: ["Poppy", "afk_targets"], group: "W2", component: () => import("./pages/FishingPage.vue") },
  { name: "vials", path: "/vials", title: "Vials", icon: ["aVials1", "data"], group: "W2", component: () => import("./pages/VialsPage.vue") },
  { name: "weekly", path: "/weekly", title: "Weekly", icon: ["VoteBG", "data"], group: "W2", component: () => import("./pages/WeeklyPage.vue") },

  // World 3 — Frostbite Tundra
  { name: "atoms", path: "/atoms", title: "Atoms", icon: ["AtomBG", "data"], group: "W3", component: () => import("./pages/AtomsPage.vue") },
  { name: "construction", path: "/construction", title: "Construction", icon: ["ConTower1", "data"], group: "W3", component: () => import("./pages/ConstructionPage.vue") },
  { name: "printer", path: "/printer", title: "Printer", icon: ["ConTower0", "data"], group: "W3", component: () => import("./pages/PrinterPage.vue") },
  { name: "refinery", path: "/refinery", title: "Refinery", icon: ["Refinery3", "data"], group: "W3", component: () => import("./pages/RefineryPage.vue") },
  { name: "shrines", path: "/shrines", title: "Shrines", icon: ["ShrineBG", "data"], group: "W3", component: () => import("./pages/ShrinesPage.vue") },
  { name: "worship", path: "/worship", title: "Worship", icon: ["WorshipSkull1", "data"], group: "W3", component: () => import("./pages/WorshipPage.vue") },

  // World 4 — Hyperion Nebula
  { name: "breeding", path: "/breeding", title: "Breeding", icon: ["PetEgg1", "data"], group: "W4", component: () => import("./pages/BreedingPage.vue") },
  { name: "kitchens", path: "/kitchens", title: "Kitchens", icon: ["Ladle", "data"], group: "W4", component: () => import("./pages/KitchensPage.vue") },
  { name: "lab", path: "/lab", title: "Lab", icon: ["Laboratory", "afk_targets"], group: "W4", component: () => import("./pages/LabPage.vue") },
  { name: "meals", path: "/meals", title: "Meals", icon: ["Cooking", "afk_targets"], group: "W4", component: () => import("./pages/MealsPage.vue") },
  { name: "rift", path: "/rift", title: "Rift", icon: ["Rift_0", "etc"], group: "W4", component: () => import("./pages/RiftPage.vue") },

  // World 5 — Smolderin' Plateau
  { name: "cavern", path: "/cavern", title: "Caverns", icon: ["Cavern_0", "etc"], group: "W5", component: () => import("./pages/CavernPage.vue") },
  { name: "divinity", path: "/divinity", title: "Divinity", icon: ["Divinity", "afk_targets"], group: "W5", component: () => import("./pages/DivinityPage.vue") },
  { name: "gaming", path: "/gaming", title: "Gaming", icon: ["Gaming", "afk_targets"], group: "W5", component: () => import("./pages/GamingPage.vue") },
  { name: "palette", path: "/palette", title: "Palette", icon: ["GamingPal", "data"], group: "W5", component: () => import("./pages/PalettePage.vue") },
  { name: "slab", path: "/slab", title: "Slab", icon: ["Slab", "etc"], group: "W5", component: () => import("./pages/SlabPage.vue") },

  // World 6 — Spirited Valley
  { name: "beanstalk", path: "/beanstalk", title: "Beanstalk", icon: ["beanstalk", "etc"], group: "W6", component: () => import("./pages/BeanstalkPage.vue") },
  { name: "emperor", path: "/emperor", title: "Emperor", icon: ["Boss6", "data"], group: "W6", component: () => import("./pages/EmperorPage.vue") },
  { name: "farming", path: "/farming", title: "Farming", icon: ["FarmCrop46", "data"], group: "W6", component: () => import("./pages/FarmingPage.vue") },
  { name: "landrank", path: "/landrank", title: "Land Rank", icon: ["FarmCrop46", "data"], group: "W6", component: () => import("./pages/LandRankPage.vue") },
  { name: "sneaking", path: "/sneaking", title: "Sneaking", icon: ["Sneaking_Ninja", "etc"], group: "W6", component: () => import("./pages/SneakingPage.vue") },
  { name: "summoning", path: "/summoning", title: "Summoning", icon: ["Endless_Summoning", "etc"], group: "W6", component: () => import("./pages/SummoningPage.vue") },

  // World 7 — Shimmerfin Deep
  { name: "legends", path: "/legends", title: "Legends", icon: ["LegendTalentBG", "data"], group: "W7", component: () => import("./pages/LegendsPage.vue") },
  { name: "levers", path: "/levers", title: "Levers", icon: ["ZenithBG", "data"], group: "W7", component: () => import("./pages/LeversPage.vue") },
  { name: "minehead", path: "/minehead", title: "Minehead", icon: ["MineHead0", "data"], group: "W7", component: () => import("./pages/MineheadPage.vue") },
  { name: "research", path: "/research", title: "Research", icon: ["ResearchBG", "data"], group: "W7", component: () => import("./pages/ResearchPage.vue") },
  { name: "spelunking", path: "/spelunking", title: "Spelunking", icon: ["Spelunking", "etc"], group: "W7", component: () => import("./pages/SpelunkingPage.vue") },
  { name: "sushi", path: "/sushi", title: "Sushi", icon: ["Sushi1", "data"], group: "W7", component: () => import("./pages/SushiPage.vue") },

  // Account-wide
  { name: "account", path: "/account", title: "Account", icon: ["LootDice", "data"], group: "Account", component: () => import("./pages/AccountPage.vue") },
  { name: "sailing", path: "/sailing", title: "Sailing", icon: ["Sailing_Skill_0", "etc"], group: "Account", component: () => import("./pages/SailingPage.vue") },
  { name: "stats", path: "/stats", title: "Stat Explorer", icon: ["Tome_0", "etc"], group: "Account", component: () => import("./pages/StatsPage.vue") },
];

/** Nav group order + labels (App.vue renders sections in this order). */
export const NAV_GROUPS = [
  { id: "W1", label: "W1 · Blunder Hills" },
  { id: "W2", label: "W2 · Yum-Yum Desert" },
  { id: "W3", label: "W3 · Frostbite Tundra" },
  { id: "W4", label: "W4 · Hyperion Nebula" },
  { id: "W5", label: "W5 · Smolderin' Plateau" },
  { id: "W6", label: "W6 · Spirited Valley" },
  { id: "W7", label: "W7 · Shimmerfin Deep" },
  { id: "Account", label: "Account-wide" },
  { id: "Meta", label: "Meta" },
];

// Hash routing (docs/ARCHITECTURE.md D5) — zero-config on GitHub Pages, no 404.html trick needed.
export const router = createRouter({
  history: createWebHashHistory(),
  routes: PAGES.map(({ name, path, title, icon, group, component }) => ({
    name,
    path,
    component,
    meta: { title, icon, group },
  })),
});
