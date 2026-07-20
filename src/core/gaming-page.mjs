/* src/core/gaming-page.mjs — page-local domain logic for GamingPage.vue: the Superbit hex-grid
 * adjacency purchase-gate rule (docs/migration/survey-pages.md flag #4, gaming.html: "sbState(list,
 * idx) implements the superbit hex-grid adjacency purchase-gate rule (a slot is buyable if the
 * slot 6-above, or same-row left/right neighbor, is owned, or it's a page-root slot). Confirmed
 * absent from domain.mjs/bonuses/gaming.mjs, which only expose the raw owned flag — the derived
 * 'available vs locked' state is real game-rule logic computed only in this page.").
 *
 * CONFIRMED against N.js directly this session (README ground rule: N.js is ground truth, grep it
 * first) — N.js:17012, the superbit-grid draw handler's adjacency check (de-minified variable
 * names substituted for clarity, control-flow/operators unchanged):
 *   for (f = 0; f < 24; f++) {
 *     available = 0;
 *     if (f-6 >= 0                  && Gaming[12].indexOf(Number2Letter[f-6+24*page]) != -1) available = 1;
 *     if (f-1 >= 0 && f % 6 != 0    && Gaming[12].indexOf(Number2Letter[f-1+24*page]) != -1) available = 1;
 *     if (f+1 <= 23 && f % 6 != 5  && Gaming[12].indexOf(Number2Letter[f+1+24*page]) != -1) available = 1;
 *     if (f == 0) available = 1;
 *   }
 * i.e. a slot (`f`, 0-23 within its page) is buyable once the bit directly ABOVE it (f-6, same
 * column, previous row) is owned, OR the same-row LEFT neighbor (f-1, unless already column 0) is
 * owned, OR the same-row RIGHT neighbor (f+1, unless already column 5) is owned, OR it's the
 * page-root slot (f==0) — a pure grid-adjacency dependency, NOT a stat/currency gate (purchase
 * itself separately needs Gaming[0] (bits) >= SuperbitCost(idx), already modeled in
 * gamedata-w5-gaming.mjs's `superbitCost()`). This cross-checks gamedata-w5-gaming.mjs's own
 * transcription of the same source lines (its SUPERBITS block's "UNLOCK GATE" comment, citing the
 * same N.js:17012-17015 span) — zero discrepancy between the two independent citations.
 *
 * `owned` is `null` for superbit ids >= 53 (`Number2Letter` only encodes the first 53 ids — see
 * bonuses/gaming.mjs's `superBitType()` / domain.mjs's `entities.w5.gaming.superbits.list`, which
 * is what this function's `list` argument is). An honestly-unknown ownership flag must resolve to
 * "unknown", never be silently treated as "not owned" (which would wrongly render it "locked" or
 * "available" instead of admitting the save can't say).
 */

/**
 * Purchase-availability state for one Superbit hex-grid slot.
 * @param {Array<{idx:number, owned:1|0|null}>} list the 72-row superbits list, in idx order
 *   (entities.w5.gaming.superbits.list — domain.mjs's `SUPERBITS.map(r => ({idx, name, owned}))`).
 * @param {number} idx 0-71
 * @returns {"owned"|"available"|"locked"|"unknown"}
 */
export function sbState(list, idx) {
  const b = list[idx];
  if (!b || b.owned === null || b.owned === undefined) return "unknown";
  if (b.owned === 1) return "owned";
  const f = idx % 24;
  const col = f % 6;
  const owns = (i) => list[i]?.owned === 1;
  const available = f === 0
    || (f - 6 >= 0 && owns(idx - 6))
    || (f - 1 >= 0 && col !== 0 && owns(idx - 1))
    || (f + 1 < 24 && col !== 5 && owns(idx + 1));
  return available ? "available" : "locked";
}
