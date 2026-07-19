/* bonuses/arcane.mjs — ArcaneUpgBonus(b): Arcane Cultist tesseract upgrades.
 *
 * ArcaneUpgBonus(b) = Arcane[b] * ArcaneUpg[b][5], times band mastery unless exempt (same
 * band-mastery pattern as the Summoning vault — not yet needed for a verified id, so not
 * implemented). Verified ids only in ARCANE_COEFF; id 48 is exempt from mastery. */

import { sel } from "../savemap.mjs";

/** ArcaneUpg[b][5] for verified ids. 48: coeff 1, exempt from mastery (feeds EmperorBon).
 *  57 "Universe_Talent": coeff 1; its only known consumer caps it at min(5,·), so possible
 *  mastery scaling is moot — do NOT reuse 57 uncapped without reading the mastery chain. */
export const ARCANE_COEFF = { 48: 1, 57: 1 };

export function arcaneUpgBonus(ctx, b) {
  if (!(b in ARCANE_COEFF)) throw new Error(`ArcaneUpgBonus(${b}): ArcaneUpg[${b}][5] not verified in N.js — add to ARCANE_COEFF first`);
  return Number((sel.tesseract(ctx.s) ?? [])[b] ?? 0) * ARCANE_COEFF[b];
}
