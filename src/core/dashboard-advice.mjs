/* src/core/dashboard-advice.mjs — the dashboard's "what should I do next" advisor.
 *
 * This is the framework-free port of dashboard.html's page-local `buildAdvice(m)` engine
 * (survey-pages.md flags it as one of the two dashboard.html domain-logic blocks with NO server
 * equivalent). Every rule below is ported faithfully from the legacy function; the only structural
 * change is the OUTPUT shape — instead of returning HTML-ish `{t, why, act, chips, icon}` objects
 * whose `act`/why carried inline `<a href="foo.html">` anchors, it returns structured items the Vue
 * page renders with real <RouterLink>s:
 *
 *   { kind, severity, icon:[file,dir], title, why, act:[part…], chips:[{label,value}…], link }
 *   part  = { text } | { text, to }        // `to` = a RouterLink target (string-form)
 *   link  = { to, label } | null           // the item's primary link-target (schema's link-target)
 *
 * Pure over (entities, metrics, stats, save) — no Vue, no DOM, no fetch (CLAUDE.md layering: core
 * stays framework-free). `stats`/`save` are accepted for contract-completeness / future rules but
 * the ported legacy rules only need `entities` (+ one metric, bubbleLv); see per-rule notes.
 *
 * NUMBER FORMATTING: legacy dashboard.html's `fmt()` was a bare `Number(n).toLocaleString("en-US")`
 * (fmt.js `plain()` — NO K/M/B scaling; these are exact account totals). Reproduced locally as
 * `plain()` so this file needs no src/ui import (which the layering rule forbids anyway).
 */

/** Legacy dashboard.html REF constants that are NOT carried on the parsed entity tree — kept
 *  verbatim, with the provenance the legacy page documented. Caps/totals that DO live on entities
 *  now (atom cap, meal cap, dream total, artifact count, cavern total, achievement count) are read
 *  from entities instead of duplicated here — that was the whole point of the domain.mjs port. What
 *  remains hard-coded is genuinely page-local knowledge: the Tome-point weightings per line and the
 *  hand-tuned thresholds/heuristics, none of which the save exposes. */
export const ADVICE_REF = {
  tomePts: { achievements: 850, equinox: 750, meals: 750, bubbles: 1750, caverns: 750 }, // Tome line weights, dashboard.html
  mealCount: 74,       // total meal slots — domain.mjs REF.mealCount (entities.meals doesn't surface the full total)
  transcendentTier: 5, // artifacts at tier===5 (Sovereign) still need a Transcendent re-find — dashboard.html rule 2
};

/** dashboard.html's `fmt` — plain comma-grouped integer, no suffix scaling. */
const plain = (n) => (n == null || !Number.isFinite(Number(n)) ? "—" : Number(n).toLocaleString("en-US"));

/**
 * Port of dashboard.html `buildAdvice(m)`. Returns advice items in the legacy PRIORITY ORDER
 * (achievements → artifacts → atoms → engines → equinox → meals → bubbles → caverns); the page
 * puts the first three that fire into the "Needs your attention" band and the rest into the advisor
 * panel, exactly as the legacy page did with `A.slice(0,3)` / `A.slice(3)`. `severity` is an
 * importance hint for styling (heaviest Tome lines = "high"), NOT the display order.
 *
 * @param {object} entities  appState `entities` (deriveEntities) — the parsed per-system tree.
 * @param {object} metrics   appState `metrics` (deriveMetrics) — flat {key:number}; only bubbleLv used.
 * @param {object} [stats]   appState `stats` — unused by the ported rules (contract completeness).
 * @param {object} [save]    openSave() blob — unused by the ported rules (contract completeness).
 * @returns {Array<object>} advice items (see file header for the shape).
 */
export function buildAdvice(entities, metrics = null, stats = null, save = null) { // eslint-disable-line no-unused-vars
  const e = entities;
  if (!e) return [];
  const A = [];

  /* 1 — achievement sweep. Legacy: achLeft = REF.achieveTotal - m.achievesDone. The real count
   *     now comes from entities.achievements (achData().real, the 268 non-filler slots), so we read
   *     it rather than hard-coding 268 — same number, no drift. */
  if (Array.isArray(e.achievements) && e.achievements.length) {
    const total = e.achievements.length;
    const done = e.achievements.filter((a) => a.done).length;
    const achLeft = total - done;
    if (achLeft > 0) {
      A.push({
        kind: "achievements", severity: "high", icon: ["Tome_0", "etc"],
        title: `Achievement sweep — ${done}/${total}`,
        why: `One-time Tome cleanup (${ADVICE_REF.tomePts.achievements}-pt line): ${achLeft} left, grouped by how you finish them — active missions with tips, exact stacks, minigames, and ones that finish themselves.`,
        act: [
          { text: "Open the " },
          { text: "Achievement Tracker", to: "/achievements" },
          { text: " — categories, live progress, and how-to tips for the tricky ones." },
        ],
        chips: [{ label: "open", value: plain(achLeft) }, { label: "Tome pts", value: String(ADVICE_REF.tomePts.achievements) }],
        link: { to: "/achievements", label: "Achievement Tracker" },
      });
    }
  }

  /* 2 — ascend the Sovereign (tier 5) artifacts to Transcendent. Legacy read m.artifacts/{Found,T6}
   *     from parseSave; entities.artifacts carries the same per-artifact {tier}. Legacy had no
   *     anchor here (plain prose about parking sailing loot); we add a Sailing route link since the
   *     act text is entirely about the sailing fleet. */
  if (Array.isArray(e.artifacts) && e.artifacts.length) {
    const t5 = e.artifacts.filter((a) => a.tier === ADVICE_REF.transcendentTier);
    if (t5.length) {
      const found = e.artifacts.filter((a) => a.tier > 0).length;
      const t6 = e.artifacts.filter((a) => a.tier >= 6).length;
      const total = e.artifacts.length;
      A.push({
        kind: "artifacts", severity: "high", icon: ["Arti33", "data"],
        title: `Ascend ${t5.length} artifacts to Transcendent`,
        why: `You've found all ${found}/${total} artifacts; ${t6} are Transcendent already. The last ${t5.length} need re-finds (requires Research grid upgrade #109).`,
        act: [
          { text: "Park sailing loot on World's End + The Maw islands; check Transcendent unlock in the Research grid first. See " },
          { text: "Sailing", to: "/sailing" },
          { text: "." },
        ],
        chips: t5.slice(0, 13).map((a) => ({ label: a.name, value: "" })),
        link: { to: "/sailing", label: "Sailing" },
      });
    }
  }

  /* 3 — cap the last atoms. entities.atoms carries {level, cap} per atom (cap = REF.atomCap 50). */
  if (Array.isArray(e.atoms) && e.atoms.length) {
    const lowAtoms = e.atoms.filter((a) => a.level < a.cap);
    if (lowAtoms.length) {
      const capped = e.atoms.length - lowAtoms.length;
      const cap = e.atoms[0].cap;
      A.push({
        kind: "atoms", severity: "normal", icon: ["Atom0", "data"],
        title: `Cap the last ${lowAtoms.length} atoms`,
        why: `${capped}/${e.atoms.length} atoms are at ${cap}. Particle dumping is a classic "small thing that never got finished".`,
        act: [
          { text: "Dump particles into the low atoms below; check the Compass 'Atomic Potential' + Isotope Discovery superbit are maxed for the cap. Open " },
          { text: "Atoms", to: "/atoms" },
          { text: "." },
        ],
        chips: lowAtoms.map((a) => ({ label: a.name, value: `${a.level}/${a.cap}` })),
        link: { to: "/atoms", label: "Atoms" },
      });
    }
  }

  /* 4 — unlock the missing engine upgrades (Tesseract/Compass/Grimoire, in that order — legacy did
   *     NOT include the Upgrade Vault here). entities.engines.<name>.{bought,total}. */
  if (e.engines) {
    const unbought = [];
    const eng = e.engines;
    if (eng.tesseract && eng.tesseract.bought < eng.tesseract.total) unbought.push(["Tesseract", eng.tesseract.total - eng.tesseract.bought]);
    if (eng.compass && eng.compass.bought < eng.compass.total) unbought.push(["Compass", eng.compass.total - eng.compass.bought]);
    if (eng.grimoire && eng.grimoire.bought < eng.grimoire.total) unbought.push(["Grimoire", eng.grimoire.total - eng.grimoire.bought]);
    if (unbought.length) {
      A.push({
        kind: "engines", severity: "normal", icon: ["ClassIcons14", "data"],
        title: "Unlock the missing engine upgrades",
        why: "Some master-class upgrades are still unpurchased — usually the newest/most expensive rows, which are often the strongest.",
        act: [{ text: "Next active farming blocks: rotate Tachyon (Arcane Cultist), Dust (Wind Walker) and Bones (Death Bringer) maps until the last rows are bought." }],
        chips: unbought.map(([n, c]) => ({ label: n, value: `${c} unbought` })),
        link: null,
      });
    }
  }

  /* 5 — equinox dreams + level-0 upgrades. entities.equinox.{dreamsDone,dreamTotal,upgrades[{level}]}. */
  if (e.equinox) {
    const zeroUpg = (e.equinox.upgrades || []).filter((u) => u.level === 0);
    const dreamsLeft = (e.equinox.dreamTotal ?? 0) - (e.equinox.dreamsDone ?? 0);
    if (dreamsLeft > 0 || zeroUpg.length) {
      A.push({
        kind: "equinox", severity: "high", icon: ["Equinox_Mirror", "etc"],
        title: `Equinox: ${dreamsLeft} dreams left (${e.equinox.dreamsDone}/${e.equinox.dreamTotal})`,
        why: zeroUpg.length
          ? `${ADVICE_REF.tomePts.equinox} Tome pts on Equinox clouds — and ${zeroUpg.length} Equinox upgrades are still level 0.`
          : `${ADVICE_REF.tomePts.equinox} Tome pts on Equinox clouds.`,
        act: [{ text: "Keep 5 dream challenges active at all times; check the level-0 upgrades below are intentional skips, not forgotten." }],
        chips: zeroUpg.map((u) => ({ label: u.name, value: "lv 0" })),
        link: null,
      });
    }
  }

  /* 6 — meals below cap. entities.meals.{levels[],cap,min}. mealCount (74) stays a REF constant —
   *     entities.meals doesn't surface the full slot total (levels[] is sliced to whatever the save
   *     holds). Legacy `mealCapMax` = entities.meals.cap (160). */
  if (e.meals && Array.isArray(e.meals.levels)) {
    const cap = e.meals.cap;
    const mealsBelow = e.meals.levels.filter((x) => x > 0 && x < cap).length;
    if (mealsBelow) {
      A.push({
        kind: "meals", severity: "normal", icon: ["CookingMastery", "etc"],
        title: `Meals: all ${ADVICE_REF.mealCount} found — push toward LV ${cap} cap`,
        why: `Lowest meal is LV ${e.meals.min}. Meal cap scales with Causticolumn tier (Transcendent = +60), Grimoire #27, Jade upgrades and the W7 lore boss.`,
        act: [
          { text: "Ladle into the lowest meals (see " },
          { text: "Meals", to: "/meals" },
          { text: "); ascending Causticolumn (the artifact card above) raises the ceiling for all of them." },
        ],
        chips: [
          { label: "below cap", value: String(mealsBelow) },
          { label: "lowest", value: `LV ${e.meals.min}` },
          { label: "Tome pts", value: String(ADVICE_REF.tomePts.meals) },
        ],
        link: { to: "/meals", label: "Meals" },
      });
    }
  }

  /* 7 — bubble levels (the #1 Tome line). ALWAYS shown (legacy pushed unconditionally). bubbleLv
   *     from metrics.bubbleLv, falling back to entities.alchemy.bubbleLvTotal. The Tome-score link
   *     went to stats.html?recipe=tomeScore → /stats?recipe=tomeScore. */
  {
    const bubbleLv = (metrics && metrics.bubbleLv != null) ? metrics.bubbleLv : (e.alchemy?.bubbleLvTotal ?? 0);
    A.push({
      kind: "bubbles", severity: "high", icon: ["aJarB0", "data"],
      title: "Bubble levels — the #1 Tome line",
      why: `Total Bubble LV is worth ${ADVICE_REF.tomePts.bubbles} pts, the heaviest line in the Tome. You're at ${plain(bubbleLv)} total levels.`,
      act: [
        { text: "Keep No Bubble Left Behind rolling, spend Gold Pens on W1–W3 barrels, and prioritize lab chips/atoms that boost bubble raising. Every Tome line, exact: " },
        { text: "Tome Score breakdown", to: "/stats?recipe=tomeScore" },
        { text: "." },
      ],
      chips: [{ label: "current", value: plain(bubbleLv) }, { label: "Tome pts", value: String(ADVICE_REF.tomePts.bubbles) }],
      link: { to: "/stats?recipe=tomeScore", label: "Tome Score breakdown" },
    });
  }

  /* 8 — caverns not yet fully unlocked. Legacy heuristic: m.caverns = min(18, villagers[0]); the
   *     domain port computes the real unlock count via cavernsOwned() into entities.w5.caverns
   *     {unlocked,total} — we use that (more correct than the villager-0 proxy) and still show the
   *     villager levels chip. Falls back to the legacy proxy if w5 is absent on an old snapshot. */
  {
    const villagerLevels = e.caverns?.villagerLevels ?? [];
    const cav = e.w5?.caverns;
    const unlocked = cav ? cav.unlocked : Math.min(18, villagerLevels[0] || 0);
    const total = cav ? cav.total : 18;
    if (unlocked < total) {
      A.push({
        kind: "caverns", severity: "normal", icon: ["Cavern_0", "etc"],
        title: `Caverns: ${unlocked}/${total} unlocked`,
        why: `The newest caverns (Fountain, Bottomless Trench, Glunko Cove) sit at the end — cavern resources are a ${ADVICE_REF.tomePts.caverns}-pt Tome line and villagers compound weekly.`,
        act: [
          { text: "Spend opals on Explorer first; push your deepest cavern each week after Gambit/Monument resets. Open " },
          { text: "Caverns", to: "/cavern" },
          { text: "." },
        ],
        chips: [{ label: "villager levels", value: villagerLevels.join(" / ") || "—" }],
        link: { to: "/cavern", label: "Caverns" },
      });
    }
  }

  return A;
}
