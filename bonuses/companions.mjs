/* bonuses/companions.mjs — Companions(id).
 *
 * `Companions(d)` returns CompanionDB[d][2] when owned, else 0. Ownership is NOT in the
 * Firestore save — the client reads the native `getCompanionInfoMe()` bridge, backed by the
 * Firebase RTDB doc `_comp/{uid}`. companion.mjs fetches that and merges it into the raw as
 * `__companions`; sel.companionsOwned() unions it with the Pet-Bonus-Token ids in OptLacc[606]
 * (those have no _comp entry, so both sources are required).
 * ctx.companions === null means we genuinely do not know (doc absent / fetch failed) — that
 * stays `unknown` and must never collapse to "owns nothing" (worth ~5x on artifact find).
 *
 * NOTE: Companions(0) is additionally gated on the active char's Lv0[14] >= 2 inside
 * _customBlock_Companions — callers of id 0 must apply that gate themselves (see
 * research.mjs gridAllmulti). */

import { COMPANION_VAL } from "../gamedata.mjs";

/** Companions(id) as {owned: true|false|null, value}. value is 0 when not owned. */
export function companion(ctx, id) {
  if (ctx.companions === null) return { owned: null, value: 0 };
  const owned = ctx.companions.has(id);
  return { owned, value: owned ? COMPANION_VAL[id] : 0 };
}
