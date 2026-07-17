/* savemap/companions.mjs — companion ownership.
 *
 * NOT PART OF THE FIRESTORE SAVE. Companion ownership lives in the Firebase REALTIME
 * DATABASE at `_comp/{uid}`, a separate document from the `_data/{uid}` Firestore save:
 *   GET https://idlemmo.firebaseio.com/_comp/{uid}.json?auth={idToken}
 * Same uid, same idToken we already mint for the save — no new auth, no new dependency.
 *
 * The game client never reads this URL: it calls the native bridge `u.getCompanionInfoMe()`,
 * which is backed by the same store. So this entry is CONFIRMED against the live endpoint and
 * against the client's *consumption* of the data, but the fetch shape itself is not visible in
 * N.js — it is the documented RTDB layout, cross-checked against a real 200 response.
 *
 * companion.mjs merges the response into the stored raw under the `__companions` key.
 * WHY merge rather than add a column: `rebuildDerived()` re-derives everything by replaying
 * `extractEntities(raw, charNames)` over the gzipped raws. Anything not inside `raw` is
 * invisible to that replay, so a new column would silently produce companion-less history and
 * quietly break the backfill guarantee. `__` cannot collide — zero of the 817 real save keys
 * begin with an underscore.
 *
 * OWNERSHIP IS THE UNION OF TWO SOURCES. `_comp.l` alone is necessary but NOT sufficient:
 * companions bought with a Pet Bonus Token are recorded only in `OptLacc[606]` and have no
 * `_comp` entry. sel.companionsOwned() unions both.
 */
export default {
  __companions: {
    name: "companions",
    attr: null,                       // native bridge getCompanionInfoMe(), not a gameAttribute
    family: false,
    scope: "account",
    agg: null,
    governs: null,
    shape: "dict",
    parse: "raw",                     // stored already-parsed; companion.mjs merges the JSON object
    desc: "Firebase RTDB _comp/{uid}. Companion ownership + equipped + shop state. Injected by companion.mjs, NOT a real save key. Absent on older snapshots and when the fetch fails — absence must degrade to `unknown`, never to 'owns nothing'.",
    idx: {
      l: "OWNERSHIP. Array of CSV strings, one per owned COPY (duplicates = extra copies). Field 0 = companion id -> index into CustomLists.CompanionDB. Field 1 = tradable flag. Fields 2-4 unused.",
      e: "currently equipped, same CSV form",
      o: "display order",
      s: "pet crystals",
      x: "boxes opened",
      d: "unknown", t: "unknown", sd: "unknown", sp: "unknown",
      y: "unknown", z22: "unknown", z23: "unknown", zm: "unknown",
    },
    evidence: "Live GET https://idlemmo.firebaseio.com/_comp/{uid}.json?auth={idToken} returns 200 with keys d,e,l,o,s,sd,sp,t,x,y,z22,z23,zm. Consumption confirmed in N.js: _customBlock_Companions(d) returns DNSM.CompanionBon[d], built from `u.getCompanionInfoMe()` by mapping each entry's field 0 through CustomLists.CompanionDB[f][2]. Field semantics for l/e cross-checked against IdleonToolbox firebase/index.js getSnapshot(dbRef, `_comp/${uid}`).",
    confidence: "confirmed",
  },
};
