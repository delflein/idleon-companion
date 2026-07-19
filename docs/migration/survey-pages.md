# IdleOn Companion — Page Inventory (SPA migration audit)

Scope: all 45 `*.html` files in the repo root (idleon-toolbox/ and mockups/ excluded).
Method: full read of every page's inline `<script>` content, cross-referenced against
`ui.js`, `sync.js`, `companion.mjs` (API surface), `domain.mjs`, `bonuses/*.mjs`, `stats/*.mjs`,
and `gamedata-*.mjs` to distinguish page-local domain logic from display-only code.

## Shared infrastructure (read in full)

- **ui.js** — loaded on every page. Renders `<nav class="pages">` (world-pill dropdown nav),
  mounts a color-tone options panel into `<span id="uiOptions">`, exposes
  `window.UI = { sprite, tones }` (builds `<img src="/idleon-toolbox/public/{dir}/{file}.png">`).
- **sync.js** — used by dashboard.html and achievements.html only. Exposes `window.IdleonSync`
  (server-mode: `serverInit/serverSyncNow/serverConnect/serverHistory/serverSettings` calling
  `/api/state`, `/api/sync`, `/api/connect`, `/api/history`, `/api/settings`; browser-mode:
  direct Firebase/Firestore Steam-SSO sync fallback: `connect/sync/loadBest/mergedHistory/
  downloadSave/getAuth`), plus `window.extractMetrics(raw)` / `window.achievesDone(...)`.
- **companion.mjs** (server) — REST surface: `GET /api/state`, `POST /api/sync`,
  `GET /api/history?keys=&from=`, `GET /api/w1..w7` (static glossary text; numeric data comes
  from `entities.w1..w7` via `/api/state`), `GET /api/snapshots`, `GET /api/snapshot/:id/raw`,
  `GET/POST /api/settings`, `POST /api/connect`, `GET /api/auth`, `POST /api/rebuild`,
  `GET /api/stats` (registry in `stats/index.mjs`, evaluated via `evaluatePerChar`/`RECIPES`),
  `GET /api/farming` (fully pre-aggregated report, `stats/farming-report.mjs`).
- **companion.css** — shared stylesheet, used by all pages.
- Domain/calculation logic lives server-side in `domain.mjs` (raw save → `entities`),
  `bonuses/*.mjs` (per-system bonus/multiplier math), `stats/*.mjs` (named "recipes" —
  per-stat breakdowns with per-term attribution, exposed through `/api/stats` and
  `stats.html?recipe=...`), and `gamedata-*.mjs` (static per-system reference tables/constants).

## The single biggest cross-page finding

A **generic "recipe-breakdown module" renderer** — the function set `currentResult`,
`bucketTerms`, `termRow`, `lockedRow`, `pendingModuleHTML`, `liveModuleHTML`,
`renderRecipeModules`, `wireModuleEvents`, `loadHistory`, plus helpers `fmt`, `chip`, `spark`,
`charName`, `niceItem` — is copy-pasted **near byte-identical** across at least 20 of the 45
pages (confirmed verbatim or near-verbatim in: account, anvil, atoms, breeding, cavern,
choppin, construction, emperor, fishing, gaming, kitchens, meals, mining, owl, legends,
palette, printer, refinery, shrines, sneaking, statues, summoning, worship, stats, sushi, and
partially in bubbles/cauldrons). This is ~150–200 duplicated lines per page and the highest-
value single component to extract into the SPA (config-driven by a `RECIPE_MODULES` array +
`stats/*.mjs` "recipe" shape, which the pages already mirror internally). `stats.html` is
effectively the generic/reference implementation of this same idea (single recipe + char
picker driven by `?recipe=&char=`).

Secondary duplicated helpers to extract: `fmt()` (at least 3 competing variants — "W4-style"
1e15-exponential, "mining/owl-style" 1e9/1e6/1e4, and page-bespoke variants in farming/landrank),
`levelBar()` (construction.html ↔ divinity.html; refinery.html ↔ rift.html, near-dupe),
`niceItem()` (forge/fishing; stamps/vials/worship; printer/refinery/rift), `stripPh()`
(palette.html ↔ slab.html), and two incompatible chart implementations (the tiny inline-SVG
`spark()` sparkline used everywhere vs. dashboard.html's much richer hover-crosshair+tooltip
SVG line chart `renderHistory`).

---

## Full inventory table

| Page | API endpoints | Entities/keys consumed | Shared vs unique | Inline JS (~lines) | Domain logic flagged? | Assets | Rendering patterns |
|---|---|---|---|---|---|---|---|
| account.html | /api/state, /api/stats, /api/history | SNAP.entities.guild/family/obols/starSigns; stats.{dropRate,cashMulti,afkGain,classXp,skillXp} | ui.js nav; generic recipe-module renderer (reference copy) | ~286 | No | data/etc sprites, Tome_0.png | KPI tiles, generic recipe table w/ sort, per-char select, sparkline, infra tile strip |
| achievements.html | IdleonSync.serverInit/serverSyncNow, /api/snapshot/:id/raw | raw.AchieveReg, raw.SteamAchieve; external ach-data.js | ui.js; sync.js/IdleonSync | ~147 | No | Ribbon0.png; external savedata.js/sync.js/ach-data.js | tab filters, search, pin/favorite widget, progress bars, KPI tiles |
| anvil.html | /api/state, /api/stats, /api/w1, /api/history | entities.w1.anvil[] (points, selections, productionSpeed); GLOSS.anvilProducts; stats.anvilSpeed | ui.js; generic recipe-module renderer; niceItem (also in bubbles) | ~321 | No | SmithingHammerChisel.png | per-char select, lever/bar widgets, generic recipe table |
| atoms.html | /api/state, /api/stats, /api/w3, /api/history | entities.w3.atoms[] (level/maxLevel/bonus/cost); GLOSS.atomEffects; stats.atomCost | ui.js; generic recipe-module renderer | ~306 | No | AtomBG.png, per-atom sprites | show-more table, tooltip pattern, generic recipe module |
| beanstalk.html | /api/state, /api/w6 | entities.w6.beanstalk (foods[], unlocked flags); GLOSS.goldenFoods | ui.js only (no sync/stats/history) | ~97 | **YES** — `beanstalkBonusLowerBound()` duplicates `gamedata-w6-beanstalk.mjs`'s `beanstalkBonusTerm()` client-side (hardcodes GfoodBonusMULTI=1); two independent implementations of the same formula, drift risk | beanstalk.png | KPI tiles + one static table |
| breeding.html | /api/state, /api/stats, /api/w4, /api/history | entities.w4.breeding (species/shiny/eggs/upgrades), entities.w4.territory.list; stats.breedingChance | ui.js; generic recipe-module renderer (has an `unknownCount` bugfix not present in other copies — worth propagating) | ~324 | No | PetEgg1.png | KPI tiles, 2 show-more tables, generic recipe module |
| bubbles.html | /api/state, /api/stats, /api/w2, /api/history | entities.w2.bubbles[cauldron][]; entities.w2.nblb; GLOSS.bubbleEffects; stats.krukBubbles | ui.js; simplified recipe-module variant (no per-char); niceItem (dupe of anvil.html) | ~305 | No | AlchBarF1.png, KrukPart sprite | 4-way cauldron tab, generic recipe module (simplified) |
| cauldrons.html | /api/state, /api/stats, /api/history (no /api/w2) | entities.w2.cauldronP2W[], entities.w2.liquids[]; stats.liquidCap | ui.js; **deliberately bespoke** renderer (comment explains why generic module doesn't fit heterogeneous units) | ~187 | No (explicitly confirmed no formula math) | Liquid1_x1.png, per-liquid sprites | 4-card lever-bar grid, bespoke term table |
| cavern.html | /api/state, /api/stats, /api/w5, /api/stats?villager=N, /api/history | entities.w5.caverns, entities.w5.villagers[]; GLOSS.villagers; stats.villagerExp per villager | ui.js; generic recipe-module renderer extended with `extraHeader` slot (per-villager, evolved pattern) | ~330 | No | Cavern_0.png, per-villager sprites | reward-ladder chips, lazy per-villager recipe fetch, generic recipe module |
| choppin.html | /api/state, /api/stats, /api/history | stats.choppinEff (no unique entity fields) | ui.js; generic recipe-module renderer (byte-identical to construction/emperor/gaming) | ~230 | No | Oak_Tree.png | generic recipe table, sparkline, KPI tiles |
| construction.html | /api/state, /api/stats, /api/w3, /api/history | entities.w3 towers; GLOSS.towerEffects; stats.libraryRate | ui.js; generic recipe-module renderer (identical); `levelBar()` (dupe w/ divinity.html) | ~300 | No | ConTower{0,1,N}.png | tower table, breakpoint table, recipe module, tooltips |
| dashboard.html | IdleonSync.* (server + browser/Firebase modes), /api/snapshot/:id/raw, drag-drop JSON | Full raw-save parse (accountLv, skillsLv, bubbleLv, stampLv, meals, atoms, artifacts, engines, dreams, emperor attempts, achievements, caverns…) | ui.js; sync.js heavily (both modes) | **~490 (largest)** | **YES — two flags:** (1) `parseSave(raw)` fully reimplements domain.mjs's save parser client-side (REF constants like atomCap:50, dreamTotal:77, achieveTotal:268 duplicated verbatim from domain.mjs) so the page works standalone without the server; will drift from domain.mjs over time. (2) `buildAdvice(m)` is a bespoke recommendation/advisor engine (artifact re-find thresholds, Tome-point weighting, achievement-sweep value, cavern-unlock heuristic) with no server equivalent. | Sailing_Skill_0.png | Steam-SSO modal, tabbed daily/weekly checklist (localStorage), ranked advice cards, engine tiles, char strip, **bespoke hover-crosshair SVG line chart** (2nd charting impl), drag-drop loader |
| divinity.html | /api/state, /api/w5 | entities.w5.divinity; GLOSS.gods/godRankMax | ui.js; `levelBar()` (dupe w/ construction.html) | ~120 | No | Divinity.png | expandable god table (hand-rolled expander, not via shared module), tooltips |
| emperor.html | /api/state, /api/stats, /api/history | entities.w6.emperor; stats.emperorBonus | ui.js; generic recipe-module renderer (near-identical core) | ~230 | No (tooltip text documents formula, not computed) | Boss6.png, jade_coin | KPI tiles, reward-ladder pills, bonus table, recipe module |
| farming.html | **/api/farming only** (no /api/state, /api/stats, /api/history) | R.report.{overview,evo,exotic,markets,og} — fully pre-aggregated | ui.js only — **no shared recipe-module renderer at all**; own 5th fmt() variant | ~355 | **YES (borderline)** — `FOCUS_PRESETS`/`scoreRow()`/night-market "fit" scoring is a client-only weighted recommendation heuristic (re-ranks server values, doesn't derive new rates) but non-trivial enough to require explicit preservation; also a display-only re-derivation of the dry-day sticker-odds curve for a tile sub-label | FarmCrop{id}.png dynamic sprites | plot grid (9-wide), medal-crop table, exotic-market advice column, rotation forecast, night-market advisor, depot tiles — richest bespoke UI of the whole app |
| fishing.html | /api/state, /api/stats, /api/w2, /api/history | entities.w2.fishing; GLOSS (poppy/tarpit/megafish/reset-spiral); stats.fishRate + stats.shinyRate | ui.js; generic recipe-module renderer (identical) | ~315 | No | Poppy.png | 2-col upgrade tables, lever/bar widgets, accordion, 2 stacked recipe modules |
| forge.html | /api/state, /api/w1 (no stats/history) | entities.w1.forge, entities.w1.bribes; GLOSS forge/bribe effects | ui.js; `niceItem()` (dupe w/ fishing.html) | ~105 (smallest of this group) | No | ForgeA.png, Bribe sprite | 2-panel grid, show-more bribe list, KPI tiles |
| gaming.html | /api/state, /api/stats, /api/w5, /api/history | entities.w5.gaming (superbits); stats.gamingBits | ui.js; generic recipe-module renderer (extraHeader variant) | ~330 | **YES** — `sbState(list, idx)` implements the superbit hex-grid adjacency purchase-gate rule (slot buyable if slot above/left/right owned, or page-root); confirmed absent from domain.mjs/bonuses/gaming.mjs (they only expose raw owned flag, not derived availability) | Gaming.png, Bits_x1/SnailMail/GamingRatCrown | superbit hex/grid checklist (4 visual states + legend), fertilizer/import tables, recipe module |
| kitchens.html | /api/state, /api/stats, /api/w4, /api/history | entities.w4.kitchens[], entities.w4 cooking.mastery; GLOSS.cookingMasteryCategories; stats.kitchenSpeed | ui.js; generic recipe-module renderer (verbatim w/ meals/mining/owl) | ~309 | No | Ladle.png | KPI tiles, expandable table rows, show-more, per-char select, sparklines |
| lab.html | /api/state only (deliberately no stats/w4) | none (static stub) | ui.js; dead unused fmt() "for parity" | ~68 | No | Laboratory.png | static KPI tiles, gapbox callout — no tables/charts |
| landrank.html | **/api/farming only** | j.report.markets.{rankDb, rankPtsTotal, plotRanks, rankCalcCtx} | ui.js only — bespoke calculator, not the generic module; own fmt() variant | ~217 | **YES** — `groupValue()`/`objective()`/`optimize()`: a real client-side greedy multi-pass (64/16/4/1 chunk) hill-climbing point allocator across 5 upgrade groups w/ user weight sliders, caps, "seed rows first"/"full respec" modes — genuine optimizer with **no server equivalent**, must be ported intact | FarmCrop46.png | bespoke "board" widget w/ clickable orb slots, weight sliders, preset dropdown, before/after delta tiles |
| legends.html | /api/state, /api/stats, /api/history | entities.w7.legendTalents (points, talents[]); stats.legendTalents | ui.js; simplified recipe-module variant (no per-char/eqMult, account-wide "points" shape) | ~207 | No | LegendTalentBG.png | KPI tiles, dropdown-sort table, show-more, locked-talents fold, sparkline |
| levers.html | /api/state, /api/w7 (no stats/history — no registered recipe) | entities.w7.{zenith,coralReef,clamWork,adviceFish,button}; GLOSS text only | ui.js only | ~180 | No (KPI sums are display aggregation of already-known values) | ZenithBG.png, CoralDiv.png, Clammie.png, ButtonG.png | 5 stacked sub-panels each w/ own table(s), reward-ladder pills, scrollable task grid |
| meals.html | /api/state, /api/stats, /api/w4 (**dead fetch, never read**), /api/history | entities.w4.meals[], mealCap, mealGlobalMulti; stats.mealBonuses | ui.js; generic recipe-module renderer (verbatim w/ kitchens/mining/owl) | ~361 (largest of its group) | **YES (small)** — `pctJump = 100/level` "biggest % jump" ranking formula assumes linear bonus-per-level; no equivalent in bonuses/cooking.mjs or stats/meal-bonus.mjs | Cooking.png, Ribbon0.png | goal-selector dropdown, sortable table w/ per-goal column, recipe module |
| minehead.html | /api/state, /api/w7 (no stats — no registered recipe) | entities.w7.minehead (shop, glimbo trades); GLOSS mineheadShop/glimboCostGrowth | ui.js only | ~108 | No (own comment notes per-upgrade formula "lives in the minigame's own scene code," not modeled anywhere) | MineHead0.png | 2 tables w/ sort+show-more |
| mining.html | /api/state (meta only), /api/stats, /api/history | stats.miningEff only (no entity fields) | ui.js; generic recipe-module renderer (verbatim w/ kitchens/meals/owl) — thinnest instance, whole page is just the module | ~226 | No | Copper.png | purely the generic recipe module |
| owl.html | /api/state, /api/stats, /api/w1, /api/history | entities.w1.owl (featherRate, tiers, upgrades[]); GLOSS.{megaFeatherTiers,owlEffects}; stats.owlRate | ui.js; generic recipe-module renderer (verbatim); niceItem | ~294 | No | Owl.png | KPI tiles, entity detail panel, upgrade table, recipe module |
| palette.html | /api/state, /api/stats, /api/w5, /api/history | entities.w5.palette (luck, slots[]); stats.paletteLuck | ui.js; generic recipe-module renderer (byte-identical hash-verified w/ printer/refinery/shrines/sneaking) | ~282 | No | GamingPal.png | KPI tiles, color-slot table, generic recipe module |
| printer.html | /api/state, /api/stats, /api/w3, /api/history | entities.w3.printer (outputMulti, byChar[], slotUnlocks); GLOSS.printerSlotEffects (joined by name string); stats.printerOutput | ui.js; generic recipe-module renderer (identical); niceItem (dupe w/ refinery/rift) | ~310 | No | ConTower0, PrintSlot, PrintBG | KPI tiles, per-char printing table, gem-shop unlock table, recipe module |
| refinery.html | /api/state, /api/stats, /api/w3, /api/history | entities.w3.refinery (cycleSpeed, cycles[], salts[], saltLickUpgrades); GLOSS.saltLickEffects; stats.refineryCycle | ui.js; generic recipe-module renderer (identical); niceItem; levelBar (near-dupe w/ rift.html) | ~335 | No (`fmtDuration()` is pure arithmetic on server-supplied cycleSpeed, not new logic) | Refinery3, per-salt sprites | lever-style cycle-time list, progress-bar salt table, upgrade table, recipe module |
| research.html | /api/state, /api/stats (**dead fetch, never read**), /api/w7 | entities.w7.research (nodesPlaced, decodedNodes, observations, occurrences[10], nodes[]); GLOSS.farmingStickers/researchTools | ui.js only (no recipe-module renderer) | ~153 | Flag (data-hygiene, not a formula gap): `OCC_PCT` array is a **verbatim hardcoded duplicate** of `bonuses/research.mjs`'s exported `RES_OCCURRENCE_PCT` constant — should be served, not re-declared | ResearchBG.png | occurrence horizontal bar chart, sortable node table, tool reference grid |
| rift.html | /api/state, /api/w4 (no stats/history — no registered recipe) | entities.w4.rift (level/task/progress), entities.w4.skillMastery; GLOSS.riftRewards/skillMasteryThresholds | ui.js; niceItem (dupe w/ printer/refinery); levelBar (near-dupe w/ refinery) | ~122 | No | Rift_0.png | KPI tile, stripcard summary, reward-ladder pills, collapsible mastery table |
| sailing.html | /api/state, /api/stats (progressive enhancement only) | entities.sailing (baseMulti, boats[], captains[], islands[], shop[], chests, phase, bankedHours…); stats.artifactFind | ui.js only — **100% bespoke, no shared recipe module** | ~304 | **YES — largest concentration of unique logic in the app:** `chestDistFor()`/`chanceFor()` re-derive domain.mjs's chest-tier/artifact-chance formulas client-side (needed to evaluate hypothetical captain levels, not just live state); `boatMulti()`/`boatRate()`/`fleetOn()` (island-ranking algorithm, no server counterpart at all); captain-shop scoring (`atLevel`, `rateWith`, ranks by projected gain at level 20 rather than current value) — a genuine buy/move recommendation engine invented in this page. Also: dead unused `RANK` table. | Sailing_Skill_0, Captain_3, SailT{n}, Arti{n}, SailChest{n} | KPI tiles, recommendation cards, captain-shop table w/ banner, sortable fleet table (click-header sort per chest tier), island select |
| shrines.html | /api/state, /api/stats, /api/w3, /api/history | entities.w3.shrines[]; GLOSS.shrineEffects; stats.shrineExp | ui.js; generic recipe-module renderer (identical) | ~276 | No | ShrineBG.png | plain level/effect table, recipe module |
| slab.html | /api/state, /api/w5 (**glossary fetched, not visibly read**) | entities.w5.slab (pct, looted, total, greenstacks, jars, legendTiers[], bonuses[]) | ui.js; fmt() extended variant; `stripPh()` (dupe w/ palette.html) | ~88 (smallest overall) | No | Slab.png | progress bar, reward-ladder pills, bonus-hooks table |
| sneaking.html | /api/state, /api/stats, /api/w6, /api/history | entities.w6.sneaking (ninjaMastery, stealthPerChar[], emporium, charms, gacha, gemstones[]); GLOSS.jadeEmporium/gemstones; stats.stealth | ui.js; generic recipe-module renderer (near-identical, one CSS width differs) | ~341 (largest of its group) | No | Sneaking_Ninja, jade_coin | KPI tiles, per-twin stealth table, 3 checklist tables (owned-last sort + show-more), recipe module |
| spelunking.html | /api/state, /api/w7 (no stats — no registered recipe) | entities.w7.spelunking (caves[], shopLevels[], discoveries); GLOSS.spelunkShop/spelunkChapters | ui.js only | ~126 | No (explicitly documents a deferred parsing gap rather than faking data) | Spelunking.png | KPI tiles, 2 show-more tables, chapter-card grid, tooltip |
| stamps.html | /api/state only (no stats/history) | entities.w1.stamps[] (tab, level, maxLevel, costs, gilded, effect) | ui.js; niceItem (dupe w/ vials/worship) | ~151 | No (sort mode is a documented UX heuristic/proxy, not a calculation) | UIstampB.png, per-tier icons | tab system (Combat/Skills/Misc), goal-sort dropdown, show-more, progress bars |
| stats.html | /api/stats, /api/history, POST /api/settings | DATA.stats[recipe] (.collapsed/.byChar/.display/.format/.unknown) — generic, driven by `?recipe=&char=&internals=` | ui.js; spark/chip (shared); is itself the **origin/reference implementation** of the generic recipe pattern (more bespoke: single-recipe + char/internals selects) | ~245 | No (its `eqMult()` "effective multiplier" transform is complex display algebra over server values, not new game math, but is duplicated in statues/summoning/worship — extraction candidate) | Tome_0.png | recipe+char selects, expandable term rows, sub-source rows, sparkline, per-char comparison bar chart, URL-query-driven state |
| statues.html | /api/state, /api/stats, /api/w1, /api/history | entities.w1.statues[] (tier/level/bonus); GLOSS.statueEffects; stats.statueMulti | ui.js; generic recipe-module renderer (byte-identical w/ summoning/worship); spark/chip | ~292 | No | Statue1.png, per-tier icons | KPI tile, sorted table, generic recipe module |
| summoning.html | /api/state, /api/stats, /api/w6, /api/history | entities.w6.summoning (armyHealth/Damage, winBonusIndex, endless*, stones[]); stats.{armyHealth,armyDamage,winBonus} | ui.js; generic recipe-module renderer (identical) | ~264 | No (tooltip documents `essenceMultiplier` formula already computed in domain.mjs, doesn't compute it) | Endless_Summoning.png, Summoning.png, Boss6.png | KPI tiles w/ anchor links, stones table, deferred-gap box, 3 stacked recipe modules |
| sushi.html | /api/state, /api/stats, /api/w7, /api/history | entities.w7.sushi (dishesUnlocked/Total, rog[], shopBought); stats.sushiRoG | ui.js; lighter recipe-module variant (account-wide "points" shape, same pattern as legends.html) | ~169 | No | Sushi1.png | KPI tiles, dish-ladder pill row, shop reference table, recipe module |
| vials.html | /api/state, /api/w2 (no stats/history) | entities.w2.vials[], entities.w2.sigils[]; GLOSS.vialEffects/sigilEffects | ui.js; niceItem, chip, fmt (dupes) | ~155 | No (hardcoded `VIAL_MAX_LEVEL=13`/`TIER_NAMES`/`nextSigilCost()` are lookup dispatch tables over glossary fields, not formulas — but duplicate knowledge that ideally lives in gamedata-w2-vials.mjs/gamedata-w2-sigils.mjs) | aVials1.png, SigilSyrup.png | 2 tables w/ show-more, dual progress bars |
| weekly.html | /api/state, /api/w2 | entities.w2.{ballot,killroy,islands} (tolerates legacy array vs object island shape); GLOSS.fractalThresholds (from stats/w2-report.mjs) | ui.js; `cleanDesc()` (near-dupe of stamps.html's text cleaner) | ~200 | No (fractal "next threshold" logic only searches/counts against server-supplied sorted array, doesn't compute it) | KillsSkull.png, VoteBG.png, IslandSail{idx}.png | 3 stacked panels, each independently sortable/show-more capped |
| worship.html | /api/state, /api/stats, /api/w3, /api/history | entities.w3.worship (byChar[], totems[]); stats.worshipCharge | ui.js; generic recipe-module renderer (byte-identical w/ statues/summoning); spark/chip/niceItem/charName | ~300 (largest of its group) | No | WorshipSkull1.png | KPI tile, per-char table, totems table, recipe module |

---

## Per-page notes: flagged page-local domain logic (must be preserved verbatim in migration)

1. **dashboard.html** — highest-risk page in the whole app.
   - `parseSave(raw)` (~lines 128–227): a full independent reimplementation of domain.mjs's
     save-parsing logic (account/skill levels, bubbleLv via CauldronInfo summation, stampLv,
     meals, atoms, artifacts/tiers, engines — Grimoire/Compass/Tesseract/Vault, dreams/equinox,
     emperor attempts, achievements, caverns). Exists because dashboard.html must work
     standalone (drag-drop a savegame.json, or pure browser/Firebase sync) without the
     companion server. Its `REF` constants (atomCap:50, dreamTotal:77, mealCapMax:160,
     achieveTotal:268, cavernCount:18, grimoireCount:55, compassCount:173, tessCount:63,
     vaultCount:90) are verbatim duplicates of constants in domain.mjs — two copies of the
     same knowledge, a drift risk. Migration should either share one parsing module between
     server and client, or drop the standalone/no-server mode.
   - `buildAdvice(m)` (~lines 244–320): a bespoke "what should I do next" advisor — artifact
     re-find thresholds (tier===5 needs Transcendent re-find), atom-cap completion, meal-cap
     vs Causticolumn-tier reasoning, achievement-sweep point value (850), dream-count vs
     `REF.dreamTotal`, bubble-LV Tome-point weighting (1750), cavern-unlock heuristic
     (villagers[0] as a proxy, capped at 18). No server-side equivalent exists.
   - `dayKey()`/`weekKey()` — real ISO week-number date math, a genuine small utility.

2. **sailing.html** — second-highest risk, and the most actively-developed page (per recent
   git log). Contains the actual product logic of the whole feature:
   - `chestDistFor(rareChest, arrowhead)` re-derives domain.mjs's chest-tier distribution
     formula client-side (`TH = [1.0,0.2,0.04,0.006,2.3e-4,1e-8]`), needed to evaluate
     hypothetical captain levels rather than only the account's live state.
   - `chanceFor(multi, isl)` = `1 − (1 − multi/isl.divisor)^unmaxed` duplicates
     `chestArtifactChance()`/`transcendentChances()` from domain.mjs.
   - `boatMulti()`, `boatRate()`, `fleetOn()` — an island-ranking algorithm (rescales a boat's
     baseMulti by its captain's roll, integrates expected artifacts/chest across the fleet)
     with **zero server-side counterpart**.
   - Captain-shop scoring (`atLevel(c,20)`, `rateWith()`) ranks shop captains by projected
     gain at level 20 rather than current value, to avoid undervaluing good low-level rolls —
     a genuine recommendation heuristic invented in this page.
   - Dead code found: `RANK` (hardcoded stat-priority table) is defined but never used.

3. **landrank.html** — a real client-side optimizer, not just a display page:
   - `groupValue()` combines 5 upgrade groups (evo/overgrowth/soil-rank-exp/farming-exp/
     crop-value) into per-goal multiplicative bonuses (incl. a crop-value cap clamp).
   - `objective()` — log-weighted-sum scoring across user-adjustable 0–10 weight sliders.
   - `optimize()` — greedy multi-pass (chunk sizes 64/16/4/1) hill-climbing allocator that
     spends the account's Land Rank points across upgrade slots, respecting per-slot caps and
     "seed rows first" / "full respec vs place-unspent-only" modes.
   - (The underlying per-upgrade hyperbolic formula `1.7*base*L/(L+80)` used inside
     `groupValue()` does already exist server-side in bonuses/farming.mjs / stats/farming-
     report.mjs — only the optimizer/scoring layer on top is genuinely page-local.)

4. **gaming.html** — `sbState(list, idx)` implements the superbit hex-grid adjacency
   purchase-gate rule (a slot is buyable if the slot 6-above, or same-row left/right neighbor,
   is owned, or it's a page-root slot). Confirmed absent from domain.mjs/bonuses/gaming.mjs,
   which only expose the raw owned flag — the derived "available vs locked" state is
   real game-rule logic computed only in this page.

5. **beanstalk.html** — `beanstalkBonusLowerBound(amount, rank)` duplicates
   `gamedata-w6-beanstalk.mjs`'s exported `beanstalkBonusTerm()` client-side (with
   `GfoodBonusMULTI` hardcoded to 1). The formula already exists server-side; the risk is
   the duplication itself (two implementations to keep in sync), not a missing formula.

6. **meals.html** (small) — `pctJump = 100 / level` "biggest % jump" ranking assumes bonus is
   linear in level; no equivalent in bonuses/cooking.mjs or stats/meal-bonus.mjs.

7. **farming.html** (borderline) — `FOCUS_PRESETS` weight tables + `scoreRow()`/night-market
   "fit" scoring is a client-only weighted recommendation heuristic layered on top of
   server-computed stats (re-ranks, doesn't invent new rates) — still non-trivial enough to
   require explicit, deliberate preservation during migration rather than being silently
   dropped as "just formatting."

8. **research.html** (data-hygiene, not a logic gap) — `OCC_PCT` array is a verbatim
   hardcoded duplicate of `bonuses/research.mjs`'s exported `RES_OCCURRENCE_PCT` constant.
   Should be served via the API instead of re-declared client-side.

All other 37 pages were confirmed, page by page, to contain **no** page-local domain logic —
every rate/threshold/multiplier/chance value is fetched pre-computed from `/api/state`,
`/api/stats`, `/api/w1..w7`, or `/api/farming`, and the inline JS only fetches, sorts, paginates,
and formats it.

---

## Other cross-cutting findings relevant to migration

- **Dead fetches** found during the audit: meals.html fetches `/api/w4` into `GLOSS` and never
  reads it; research.html fetches `/api/stats` into `DATA` and never reads it; slab.html
  fetches `/api/w5` and doesn't visibly use the glossary. Worth dropping (or wiring up) rather
  than porting as-is.
- **API shape inconsistency**: weekly.html's `entities.w2.islands` handling tolerates both a
  legacy bare-array shape and a newer `{list, fractalAfkHours}` object shape — a versioning
  seam to resolve during migration rather than carry forward as defensive code.
- **No page in the audited set uses canvas** — all "charts" are hand-built inline SVG
  (`spark()` sparklines everywhere, dashboard.html's richer `renderHistory` line chart with
  crosshair/tooltip, research.html's horizontal bar chart, stats.html's width-scaled bar-chart
  spans). A single SPA chart component (sparkline + detailed-history modes) should replace all
  of these.
- **Tab/dropdown/accordion patterns** are consistent enough to standardize: per-cauldron tabs
  (bubbles.html), Combat/Skills/Misc tabs (stamps.html), show-more pagination (used in nearly
  every table across all 45 pages, always the same "cap at 10–12, click to reveal rest"
  idiom), locked/unknown-terms `<details>` folds (recipe-module pages), reward-ladder pill
  chips (rift/slab/levers/emperor), lever/progress-bar widgets (`.lbar`/`.lfill`, `.lever`,
  used in anvil/fishing/refinery), and sortable click-header tables (only sailing.html's fleet
  table — everywhere else "sort" is a `<select>`-driven re-render, not true column-header
  sorting).
- **Page-unique, non-recurring UI** worth building as bespoke SPA views rather than forcing
  into shared components: farming.html's plot grid + night-market advisor, landrank.html's
  orb-slot "board" widget, dashboard.html's Steam-SSO connect modal + drag-drop loader,
  gaming.html's superbit hex-grid checklist, sailing.html's captain-shop/fleet tables.
