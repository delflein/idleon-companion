/* bonuses/alchemy.mjs — AlchVials[key]: vial bonuses.
 *
 * Client: AlchVials[key] += CauldronStats("VialBonus",4,g,0) for every vial g whose
 * AlchemyDescription[4][g][11] == key, and
 *   VialBonus = (MainframeBonus(10)==2 ? 2 : 1)
 *             * (1 + DNzz/100) * (1 + Summoning2("MeritocBonusz",20,0)/100)
 *             * ArbitraryCode5Inputs(row[3], row[1], row[2], CauldronInfo[4][g])
 *   DNzz = (Rift[0] > 34 ? 2*<maxed vial count> : 0) + VaultUpgBonus(42)
 * The `2*GenINFO[108]` term is the Rift-35 "Vial Mastery": GenINFO[108] is runtime UI state,
 * but it is the COUNT OF MAXED VIALS, which the save does have. Identified empirically —
 * 67 maxed vials reproduced an in-game +379% exactly — so it is `inferred`, not read from the
 * client. MeritocBonusz is scene-gated and returns 0 outside the vote window; treated as 0
 * (flagged). VIAL_ROWS holds the per-vial curve rows verified in N.js. */

import { sel, vals } from "../savemap.mjs";
import { arbitraryCode5 } from "./util.mjs";
import { vaultUpgBonus, meritocBonusz } from "./summoning.mjs";
import { mainframeBonus } from "./lab.mjs";
import { VIAL_INFO } from "../../gamedata/gamedata-w2-vials.mjs";

/** Full AlchemyDescription[4] table (86 vials), keyed by index and by AlchVials key. The 5
 *  previously hand-verified rows (64/66/72/74/84) are reproduced exactly by this extraction
 *  (gamedata-w2-vials.mjs header) — so this generic path is regression-safe for them. */
const VIAL_BY_KEY = {};
for (const v of VIAL_INFO) if (!(v.key in VIAL_BY_KEY)) VIAL_BY_KEY[v.key] = v;
export const vialByKey = (key) => VIAL_BY_KEY[key];

const VIAL_MAX_LEVEL = 13, RIFT_VIAL_MASTERY_LV = 34, VIAL_OVERTUNE = 42;

/** AlchVials value for one vial row (by index), as a fragment (a PERCENT). */
export function vialBonus(ctx, idx) {
  const row = VIAL_INFO[idx];
  if (!row) throw new Error(`vial ${idx}: no AlchemyDescription[4][${idx}] in VIAL_INFO`);
  const vials = sel.vialLevels(ctx.s);
  const lv = Number(vials[idx] ?? 0);
  if (!lv) return { value: 0, note: "vial not unlocked" };
  const base = arbitraryCode5(row.func, row.x1, row.x2, lv);
  const maxedVials = vals(vials).map(Number).filter((x) => x >= VIAL_MAX_LEVEL).length;
  const riftOn = Number((sel.rift(ctx.s) ?? [])[0] ?? 0) > RIFT_VIAL_MASTERY_LV;
  const dnzz = (riftOn ? 2 * maxedVials : 0) + vaultUpgBonus(ctx, VIAL_OVERTUNE);
  /* MeritocBonusz(20) "All vials give }x higher bonuses" — gated from the save (OptLacc[453]);
   * exact 0 when another category is selected, partial floor when 20 IS selected. */
  const meritoc = meritocBonusz(ctx, 20);
  const mf = mainframeBonus(ctx, 10);
  if (mf.value === null) ctx.unknown("Lab node connectivity for MainframeBonus(10) (vial doubler) — solver could not prove it; vial computed WITHOUT the x2");
  const doubler = mf.value === 2 ? 2 : 1;
  return {
    value: doubler * (1 + dnzz / 100) * (1 + meritoc.value / 100) * base,
    status: mf.value === null || meritoc.status === "partial" ? "partial" : "computed",
    note: `vial lv${lv} -> base ${base}; ${maxedVials} maxed vials${riftOn ? " (Rift>34 active)" : ""} + VaultUpgBonus(42)=${vaultUpgBonus(ctx, VIAL_OVERTUNE)} -> DNzz=${dnzz}; Meritoc(20): ${meritoc.note}; lab doubler x${doubler}${mf.value === null ? " (connectivity unknown)" : ""}`,
  };
}

/** AlchVials[key] as a fragment — same value the client's builder stores under `key`. Sums every
 *  vial whose AlchemyDescription[4][g][11] == key (all real vial keys are unique, so this is one
 *  row). Returns {value:0} when no such key (e.g. "Liquid4Cap" — no vial grants it). */
export function vialBonusByKey(ctx, key) {
  const row = VIAL_BY_KEY[key];
  if (!row) return { value: 0, note: `no vial has key "${key}"` };
  return vialBonus(ctx, row.i);
}

/* --- Sigils: Labb("SigilBonus","Blank",e,0) --------------------------------
 * Client (_customBlock_Labb, "SigilBonus" arm, N.js:12557), verbatim (non-Tutorial):
 *   tier = CauldronP2W[4][1 + 2*e]                 // the sigil's build tier (savemap w123.mjs)
 *   value = tier < -0.1 ? 0
 *         : SigilDesc[e][ tier<0.5?3 : tier<1.5?4 : tier<2.5?8 : tier<3.5?10 : 12 ]
 *           * (1 + Sailing("ArtifactBonus",16,0))
 *           * (1 + Summoning2("MeritocBonusz",21,0)/100)
 * SigilDesc (na.SigilDesc(), N.js:24025): the tier value lives in columns [3]/[4]/[8]/[10]/[12].
 * Sigil 11 "TROVE" is "Boosts drop rate by +{%" — Labb("SigilBonus","Blank",11,0) in drop rate. */

/** CustomLists.SigilDesc[e] -> {name, tiers:[c3,c4,c8,c10,c12]}, verbatim from na.SigilDesc(). */
export const SIGIL_DESC = [
  { name: "BIG_MUSCLE",     tiers: [10, 20, 40, 100, 200] }, // 0
  { name: "PUMPED_KICKS",   tiers: [10, 20, 40, 100, 200] }, // 1
  { name: "ODD_LITEARTURE", tiers: [10, 20, 40, 100, 200] }, // 2
  { name: "GOOD_FORTUNE",   tiers: [10, 20, 40, 100, 200] }, // 3
  { name: "PLUNGING_SWORD", tiers: [75, 225, 1000, 5000, 10000] }, // 4
  { name: "WIZARDLY_HAT",   tiers: [10, 20, 30, 50, 60] },   // 5
  { name: "ENVELOPE_PILE",  tiers: [12, 25, 40, 65, 75] },   // 6
  { name: "SHINY_BEACON",   tiers: [1, 2, 5, 10, 12] },      // 7
  { name: "METAL_EXTERIOR", tiers: [6, 12, 20, 50, 70] },    // 8
  { name: "TWO_STARZ",      tiers: [10, 25, 45, 100, 125] }, // 9
  { name: "PIPE_GAUGE",     tiers: [10, 20, 30, 60, 75] },   // 10
  { name: "TROVE",          tiers: [10, 20, 30, 100, 150] }, // 11 Boosts drop rate by +{%
  { name: "PEA_POD",        tiers: [25, 50, 100, 450, 600] }, // 12
  { name: "TUFT_OF_HAIR",   tiers: [3, 6, 10, 15, 20] },     // 13
  { name: "EMOJI_VEGGIE",   tiers: [10, 25, 40, 60, 80] },   // 14
  { name: "VIP_PARCHMENT",  tiers: [10, 25, 50, 100, 150] }, // 15
  { name: "DREAM_CATCHER",  tiers: [1, 2, 4, 10, 15] },      // 16
  { name: "DUSTER_STUDS",   tiers: [3, 7, 15, 25, 40] },     // 17
  { name: "GARLIC_GLOVE",   tiers: [15, 35, 60, 90, 95] },   // 18
  { name: "LAB_TESSTUBE",   tiers: [8, 20, 35, 70, 100] },   // 19
  { name: "PECULIAR_VIAL",  tiers: [15, 25, 35, 50, 65] },   // 20
  { name: "LOOT_PILE",      tiers: [10, 20, 30, 60, 100] },  // 21
  { name: "DIV_SPIRAL",     tiers: [10, 30, 50, 100, 150] }, // 22
  { name: "COOL_COIN",      tiers: [20, 50, 100, 250, 400] }, // 23
];

/**
 * Labb("SigilBonus","Blank",e,0) as a fragment (a PERCENT). Account-wide (CauldronP2W is account
 * alchemy). The Sailing ArtifactBonus(16) multiplier is not read here (its ArtifactInfo row is
 * unverified), so the value is a lower bound whenever that artifact is owned -> status "partial".
 */
export function sigilBonus(ctx, e) {
  const row = SIGIL_DESC[e];
  if (!row) throw new Error(`Labb("SigilBonus",${e}): CustomLists.SigilDesc[${e}] not verified in N.js — add to SIGIL_DESC first`);
  const tier = Number(sel.sigilTiers(ctx.s)[1 + 2 * e] ?? 0);
  if (tier < -0.1) return { value: 0, status: "computed", note: `${row.name}: sigil not unlocked` };
  const col = tier < 0.5 ? 0 : tier < 1.5 ? 1 : tier < 2.5 ? 2 : tier < 3.5 ? 3 : 4;
  const base = row.tiers[col];
  /* The two multipliers (1 + Sailing ArtifactBonus(16)) and (1 + Summoning2 MeritocBonusz(21)/100)
   * are not applied: ArtifactInfo[16] is unverified and MeritocBonusz(21) is not in the guarded
   * NinjaInfo table. Both are >= 1x, so the base value is a LOWER BOUND -> status "partial". */
  return {
    value: base,
    status: "partial",
    note: `${row.name}: tier ${tier} -> base ${base}; excludes the ArtifactBonus(16) & MeritocBonusz(21) multipliers (both unread, x>=1) -> lower bound`,
  };
}
