/* core/sailing-page.mjs — the page-local domain logic that used to live INSIDE sailing.html
 * (docs/migration/survey-pages.md flags it as "the largest concentration of unique logic in the
 * app"). Ported here, framework-free, so the Vue page (src/pages/SailingPage.vue) is thin and this
 * math is unit-testable — exactly like the stats/ recipes (docs/ARCHITECTURE.md D2/D8).
 *
 * It builds ON the existing core sailing surface rather than duplicating it:
 *   - domain.mjs already PARSES the fleet (extractSailing) into `entities.sailing` — baseMulti,
 *     additivePoolPct, boats[] (each with its captain's chestDist + artifactFind roll), captains,
 *     shop, islands[] (each with its `divisor` = transcendentChances() at the READ server vars,
 *     and `unmaxed` artifact count), phase, arrowheadBonus.
 *   - domain.mjs exports chestDist() (roll = U(0,1)/divisor, nested thresholds — N.js
 *     `_customBlock_AddChest`) and chestArtifactChance()/transcendentChances(). We CONSUME
 *     chestDist() for the what-if captain projections rather than re-deriving the threshold
 *     ladder client-side the way the legacy page did.
 *   - stats/artifact-find.mjs is the ~30-term BoatArtiMulti recipe (`stats.artifactFind`); its
 *     `collapsed` result feeds topSources() (the "levers" panel).
 *
 * What is genuinely page-local and lives here: rescaling a boat's multiplier by ITS captain's
 * Artifact-Find roll (the account stat is boat 0's), ranking islands by expected artifacts per
 * chest across the whole fleet, and the captain-shop buy/move scorer (projects each shop roll to
 * level 20 so a good low-level roll isn't undervalued). None of these have a server counterpart.
 *
 * HONESTY (README + domain.mjs's serverVars note): absolute "1 in N" odds inherit the calibrated
 * Firebase server vars and any un-derived BoatArtiMulti term (baseMulti is then a LOWER bound).
 * RATIOS between islands / boats / captains cancel both and are trustworthy — rank on ratios, and
 * the page surfaces the caveat wherever it shows an absolute. */

import { chestDist } from "./domain.mjs";

/** Captain stat names, indexed by stat id — the client's CaptainBonuses table order
 *  (domain.mjs REF.captainStats). */
export const STAT_NAMES = ["Boat Speed", "Loot Value", "Cloud Discover", "Artifact Find", "Rare Chest"];

/** Roman tier labels for artifact chips (index = tier 0..6). */
export const TIER_ROMAN = ["", "I", "II", "III", "IV", "V", "VI"];

/** Per-chest-rarity artifact multiplier (the 1.4^r term), r = 0..5. Basic..Occult = 1.4^r,
 *  Miracle is a flat 30 (the client's else-branch overrides the curve — CONFIRMED in N.js
 *  `_customBlock_AddChest`). Kept in lockstep with domain.mjs REF.chestTiers[].artiMulti. */
export const CHEST_ARTI = [1.0, 1.4, 1.96, 2.744, 3.8416, 30];

/** Chest tier display names, r = 0..5 (domain.mjs REF.chestTiers). */
export const CHEST_NAMES = ["Basic", "Iron", "Gilded", "Noble", "Occult", "Miracle"];

/** Which captain stat ids are LIVE (worth a slot) in each account phase — phase-dependent, not
 *  fixed. The old community ranking predates Transcended artifacts (see sailing.html's comment):
 *    speed    — still distance-bound: Boat Speed buys real trips/hour
 *    artifact — clamped at min travel time, artifacts outstanding: Rare Chest then Artifact Find
 *    loot     — everything maxed: artifact-find is dead, Loot Value levels the ships
 *  Cloud Discover is never worth a slot at any phase. */
export const LIVE_STATS = { speed: [0, 1], artifact: [4, 3], loot: [1] };

/** The level shop captains are projected to when scoring — effect = level × storedRoll, and shop
 *  captains arrive at level 1, so scoring them as-is buries good rolls (the roll never changes,
 *  the level does). */
export const CAP_LV = 20;

/** The game labels captains with letters, not indices: 0=A, 1=B, … 25=Z, 26=AA. */
export function capLabel(i) {
  let s = "", n = i;
  do { s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26) - 1; } while (n >= 0);
  return s;
}

/** Chance ONE chest yields >= 1 artifact on island `isl`: the client rolls each un-maxed artifact
 *  on the island independently against the same frozen chest value (SailzDN2 = ∏(1 − multi/div)).
 *  Uses the island's own `divisor` (computed by domain.extractSailing from the READ server vars),
 *  which is the honest, per-snapshot value — the equivalent of domain.chestArtifactChance() but
 *  keyed off the entity's divisor rather than recomputing it at the default calibrated vars. */
export function chanceFor(multi, isl) {
  return isl.unmaxed ? Math.min(1, 1 - Math.pow(1 - multi / isl.divisor, isl.unmaxed)) : 0;
}

/** BoatArtiMulti for a hypothetical Artifact-Find captain roll on top of the account's base.
 *  The account stat (baseMulti) is boat 0's number — a captain-less baseline; a boat's REAL
 *  multiplier scales that by its own Artifact-Find roll inside the shared additive bracket:
 *  baseMulti × (100 + pool + af) / (100 + pool). */
export function multiForAf(s, artifactFind) {
  return s.baseMulti * (100 + s.additivePoolPct + artifactFind) / (100 + s.additivePoolPct);
}

/** A boat's own BoatArtiMulti (its captain's Artifact-Find roll applied to the account base). */
export function boatMulti(s, b) {
  return multiForAf(s, b.artifactFind);
}

/** Expected artifacts per chest for a boat on an island, integrated over its rarity distribution
 *  (b.chestDist, already computed per-boat by domain.extractSailing from the captain's Rare-Chest
 *  roll + arrowhead). */
export function boatRate(s, b, isl) {
  const m = boatMulti(s, b);
  return b.chestDist.reduce((t, p, r) => t + p * chanceFor(m * CHEST_ARTI[r], isl), 0);
}

/** Whole-fleet expected artifacts per chest on an island. */
export function fleetOn(s, isl) {
  return s.boats.reduce((t, b) => t + boatRate(s, b, isl), 0);
}

/** Project a captain's Artifact-Find / Rare-Chest totals to a given level (effect = level × roll,
 *  summed across both stat slots — a captain can roll the same id twice). */
export function atLevel(c, lv) {
  return {
    rareChest: c.stats.reduce((t, x) => t + (x.id === 4 ? lv * x.raw : 0), 0),
    artifactFind: c.stats.reduce((t, x) => t + (x.id === 3 ? lv * x.raw : 0), 0),
  };
}

/** Expected artifacts per chest for a hypothetical captain value {rareChest, artifactFind} on an
 *  island — used to score a shop roll before it exists on a boat. Its Rare-Chest roll reshapes the
 *  chest distribution via domain.chestDist(); its Artifact-Find roll rescales the multiplier. */
export function rateWith(s, v, isl) {
  return chestDist(v.rareChest, s.arrowheadBonus)
    .reduce((t, p, r) => t + p * chanceFor(multiForAf(s, v.artifactFind) * CHEST_ARTI[r], isl), 0);
}

/** Every (shop captain × current boat) swap, scored as the change in that boat's per-chest rate
 *  on island `isl`, both at the roll's CURRENT level (`now`) and projected to CAP_LV (`late`).
 *  Sorted best-`late`-first: judge the roll, not its current level (a swap can be negative now
 *  and still correct — the roll never changes, the level does). */
export function computeSwaps(s, isl, capLv = CAP_LV) {
  const swaps = [];
  for (const c of s.shop) for (const b of s.boats) {
    const now = rateWith(s, atLevel(c, c.level), isl) - boatRate(s, b, isl);
    const late = rateWith(s, atLevel(c, capLv), isl) - boatRate(s, b, isl);
    swaps.push({ c, b, now, late });
  }
  swaps.sort((a, b) => b.late - a.late);
  return swaps;
}

/** Islands that still hold un-maxed artifacts (the only ones worth sailing for artifacts). */
export function liveIslands(s) {
  return s.islands.filter((i) => i.unmaxed > 0);
}

/** The island the fleet is currently parked on (boat 0's island), falling back to island 0. */
export function currentIsland(s) {
  return s.islands.find((i) => i.i === s.boats[0]?.island) || s.islands[0];
}

/** The live island with the highest whole-fleet per-chest rate (best target), or null. */
export function bestIsland(s) {
  const live = liveIslands(s);
  return live.length ? [...live].sort((a, b) => fleetOn(s, b) - fleetOn(s, a))[0] : null;
}

/** Friendly labels for the top artifact-find sources shown in the "levers" panel (legacy
 *  sailing.html TERM_LABELS) — a curated rename of the additive-pool term ids. */
export const LEVER_LABELS = {
  fauxory: "Fauxory Tusk (t6 × sailing lv)", captain: "Best AF captain",
  shinyPets: "Shiny pets", arcade: "Arcade upgrades", tier6Captains: "Tier-6 captains owned",
  bribe: "Bribe", tuneOfArtifaction: "Tune of Artifaction", sticker: "Sticker + research grid",
  vault: "Upgrade Vault", gridTranscendent: "Transcendent grid node",
};

/**
 * The "levers" summary — the top additive-pool artifact-find sources, biggest first, for the
 * levers panel. Reads the artifactFind recipe result (`stats.artifactFind`), same shape as the
 * old /api/stats payload. Returns null when there is nothing to show.
 * @param {object|null} af the artifactFind stat entry ({ collapsed: { terms, additivePoolPct, multiplicative } })
 * @returns {{ terms: {v:number,kind:string,label:string}[], max:number, additivePoolPct:number, multiplicative:number }|null}
 */
export function topSources(af) {
  const r = af?.collapsed;
  if (!r) return null;
  const terms = (r.terms || [])
    // the "captain" term's headline is boat 0 (+0%); use its best-boat sub-part instead
    .map((t) => ({ v: t.id === "captain" ? (t.parts?.[0]?.value || 0) : t.value, kind: t.kind, label: LEVER_LABELS[t.id] || t.id }))
    .filter((t) => t.kind === "add" && t.v > 0)
    .sort((a, b) => b.v - a.v)
    .slice(0, 7);
  if (!terms.length) return null;
  return { terms, max: terms[0].v, additivePoolPct: r.additivePoolPct, multiplicative: r.multiplicative };
}
