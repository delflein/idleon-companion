/* src/ui/fmt.js — the ONE number formatter, collapsing 3 competing legacy `fmt()` variants
 * (docs/migration/survey-pages.md, "secondary duplicated helpers"). Read verbatim from the
 * repo root before writing this:
 *
 *   1. mining.html / kitchens.html / meals.html / owl.html-style ("mining/owl-style"):
 *        >=1e9 -> B (2dp), >=1e6 -> M (2dp), >=1e4 -> rounded int with commas, else 2dp.
 *   2. sneaking.html-style ("W4-style"): >=1e15 -> exponential, >=1e9 -> B (2dp),
 *        >=1e4 -> rounded int with commas, else 2dp. (No M bucket — 1e6..1e9 falls through to
 *        the comma-int branch instead of an "M" suffix.)
 *   3. dashboard.html: plain `Number(n).toLocaleString("en-US")` — NO suffix scaling at all.
 *        Used only for already-integer account totals (accountLv, achievesDone, bubbleLv...)
 *        where "12K achievements" would read as broken, not concise.
 *   (farming.html / landrank.html carry a 4th/5th bespoke variant each, out of scope for this
 *   audit's "3 pages" but consistent with the same ladder — confirms the shape below, not a
 *   contradiction: farming adds a K bucket at >=1e4 with 1dp, e.g. `mining/owl` collapses that
 *   into the comma-int branch instead.)
 *
 * DECISION: one ladder, not "recipe wins" — a StatModule for a mining-style stat and a
 * StatModule for a sneaking-style stat must render numbers identically, otherwise the whole
 * point of extracting ONE component (D6/M4) is lost by re-introducing page-specific formatting.
 * Kept: the K/M/B suffix ladder (reads better than sci notation for the multiplier/percent-ish
 * magnitudes most stats live in) AND the exponential fallback for genuinely huge numbers (some
 * W4/rift-adjacent stats do overflow past 1e15 — confirmed in sneaking.html's gacha-roll math).
 * DEVIATION from mining.html specifically: numbers >=1e9 no longer silently skip a hypothetical
 * exponential band, and the M bucket (1e6..1e9) is now ALWAYS shown as "M" (mining.html already
 * did this; sneaking.html's omission was model drift between copies, not a deliberate choice —
 * nothing in the survey documents 1e6..1e9 needing different treatment per page).
 * KEPT SEPARATE: `plain()` reproduces dashboard.html's uncapped toLocaleString for raw counts —
 * this is a distinct, deliberate use case (exact integers, not compressible), not folded into
 * the same ladder.
 */

/** The unified suffix ladder. `digits` controls decimal places for the B/M/exponential/plain-
 *  decimal branches (not the >=1e4 comma-int branch, which is always a rounded integer, matching
 *  all three legacy variants). */
export function fmt(n, { digits = 2 } = {}) {
  if (n == null || !Number.isFinite(n)) return "—";
  const a = Math.abs(n);
  if (a >= 1e15) return n.toExponential(digits).replace("e+", "e");
  if (a >= 1e9) return (n / 1e9).toFixed(digits) + "B";
  if (a >= 1e6) return (n / 1e6).toFixed(digits) + "M";
  if (a >= 1e4) return Math.round(n).toLocaleString("en-US");
  return String(+n.toFixed(digits));
}

/** dashboard.html's uncapped formatter — exact comma-grouped integers, no suffix scaling.
 *  For raw counts (achievement totals, character levels) where compression would mislead. */
export function plain(n) {
  if (n == null || !Number.isFinite(n)) return "—";
  return Number(n).toLocaleString("en-US");
}

/** A stat's headline value, honoring the honesty contract's "lower bound" marker (≥) and the
 *  recipe's declared `format` ("points" | "percent" | anything else -> multiplier "x"). Mirrors
 *  every legacy recipe-module's `valueText` line verbatim (mining.html/sneaking.html: `(r.lowerBound
 *  ? "≥ " : "") + fmt(r.value) + (isPoints ? " pts" : "x")`). */
export function fmtStatValue(value, format, lowerBound) {
  const prefix = lowerBound ? "≥ " : "";
  const suffix = format === "points" ? " pts" : format === "percent" ? "%" : "x";
  return prefix + fmt(value) + suffix;
}

/** One term's raw contribution, exactly as legacy `termRow()`'s `rawVal` computed it:
 *  add -> "+N%" (or "+N pts" for point-format recipes), mul -> "×N", anything else -> bare N. */
export function fmtTermRaw(term, isPoints) {
  if (term.kind === "add") return "+" + fmt(term.value) + (isPoints ? " pts" : "%");
  if (term.kind === "mul") return "×" + fmt(term.value);
  return fmt(term.value);
}

/**
 * niceItem — display-clean a game item/critter codename ("Bug_Ladybug2" → "Bug Ladybug 2").
 * Duplicated across ~6 legacy pages (survey-pages.md "secondary duplicated helpers"); this is
 * the one shared home. Underscores → spaces, camelCase and letter-digit boundaries split.
 * @param {string} s
 */
export function niceItem(s) {
  return String(s ?? "")
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/([A-Za-z])(\d)/g, "$1 $2")
    .trim();
}
