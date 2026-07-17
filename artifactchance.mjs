/* artifactchance.mjs — computes the client's BoatArtiMulti from the save.
 *
 * This replaces the hardcoded `baseMulti = 2182.12e6/100` (one account's in-game reading) and
 * the solved-for `calibration.additivePoolPct`. Both were account-specific; this is computed.
 *
 * THE EXPRESSION, verbatim from N.js `_customBlock_Sailing` ~line 17705 (stitched across the
 * wrapped lines; re-verified character-by-character against the client):
 *
 *   max(1, (1 + ( Sailing("ArtifactBonus",3,0)          // Fauxory Tusk
 *               + CaptBonusCalc(3, Boats[b][0])         // this boat's captain, Artifact Find
 *               + Breeding("ShinyBonusS","Nah",21,-1)
 *               + 20*RandomEvent("FractalIslandBonus",3,999)
 *               + GetBribeBonus("34")
 *               + 25*min(30, NONdummies[60])
 *               + ArcadeBonus(32) + ArcadeBonus(66)
 *               + Holes("B_UPG",55,0)
 *               + FarmingStuffs("StickerBonus",2,0)
 *               + ResearchStuff("Grid_Bonus",109,0)
 *               + Summoning("VaultUpgBonus",63,0) )/100)
 *     * (1 + StarSigns["61"]/100)                       // Artifosho — ACTIVE CHARACTER only
 *     * max(1, min(2, 1+2*Companions(154)))
 *     * max(1, RandomEvent("KillroyBonuses",0,0))
 *     * (1 + Minehead("Button_Bonuses",3,0)/100)
 *     * (1 + ResearchStuff("Grid_Bonus",106,0)/100)
 *     * (1 + AlchVials["6turtle"]/100)
 *     * max(1, pow(1.5, Stuff2("PurpleChestSlugsOwned",0,0)))
 *     * (1 + SushiStuff("RoG_BonusQTY",7,0)/100)
 *     * (1 + Summoning("WinBonus",3,0)/100)
 *     * Sailing("DaveyJonesBonus", b, 0)                // a MULTIPLIER, not a percent
 *     * (1 + MainframeBonus(14)/100)
 *     * (1 + Thingies("LoreEpiBon",3,0)/100)
 *     * (1 + Ninja("PristineBon",2,0)/100)
 *     * (1 + Summoning("VotingBonusz",20,0)/100)
 *     * (1 + Companions(43))
 *     * (1 + Holes("MonumentROGbonuses",1,2)/100)
 *     * (1 + FarmingStuffs("ExoticBonusQTY",45,0)/100)
 *     * (1 + GamingStatType("PaletteBonus",5,0)/100)
 *     * max(1, pow(1.02, Spelunk[6].length) * GamingStatType("SuperBitType",26,0)))
 *
 * HONESTY CONTRACT. Some terms are not derivable from the save at all (Companions come from a
 * native `getCompanionInfoMe()` bridge, not the save). A term we cannot compute is returned with
 * status "unknown" and contributes its NEUTRAL element (0 additive, 1 multiplicative). It is
 * NEVER filled with a plausible guess. The consequence, which callers must surface: the result
 * is a LOWER BOUND, not an estimate. `unknown.length > 0` means the real number is higher.
 *
 * STATUS vs THE VALIDATION TARGET (one account's in-game reading, 2.18212e9 for boat 0).
 * These terms now reproduce that account's on-screen numbers essentially exactly, which is the
 * only reason to trust the surrounding structure:
 *     arcade 151.532 (screen: 151.53) · vial +378.56% (379) · Monument of Justice 18.569 (18.57)
 *   · shinies 46 (14+16+16) · Killroy 1.174 · Purple Slug 1.5 · WinBonus 34.97 (35.08)
 * With that account's companions and lab connectivity supplied, the whole expression lands at
 * ~1.3e9 against 2.18212e9 — i.e. still ~1.7x LOW, and ~1.2x low even with every remaining
 * unknown (Tome score, active vote) pinned at its most generous value. That residual is REAL and
 * is deliberately left open: nothing here is tuned to close it. See the report / `unknown` list.
 * Suspects, in order: the Tome score (bounds the LoreEpiBon term), the active vote, and — most
 * likely — a term we still read wrong. Do NOT introduce a constant to make this match.
 */

import { sel, vals } from "./savemap.mjs";
import {
  SHINY_SLOT_TO_BONUS, SHINY_BONUS_PER_LV, PET_SHINY_SLOT, SHINY_ARTIFACT_BONUS, NUMBER_2_LETTER,
  SUMMON_ENEMY_NAMES, SUMMON_ENEMY_SLOT, SUMMON_ENEMY_VAL, SUMMON_ENDLESS_SLOT, SUMMON_ENDLESS_VAL,
  EMPEROR_BON_VAL, EMPEROR_BON_CYCLE, COMPANION_VAL, ARCADE_ROWS, VAULT_COEFF, VAULT_NO_MASTERY,
  LEGEND_TALENT_COEFF, SET_BONUS_VAL,
} from "./gamedata.mjs";

/* --- client constants, each cited ---------------------------------------- */

/** ArtifactInfo[i][3] = base value of artifact i's main bonus. Fauxory Tusk is index 3, base 1
 *  ("Fauxory_Tusk 10 100 1 +{%_artifact_find_chance_per_sailing_LV..."). */
const FAUXORY_IDX = 3, FAUXORY_BASE = 1;
/** BribeDescriptions[34] = "Artifact_Pilfering ... +20%", field[5] = 20. */
const BRIBE_ARTIFACT = 34, BRIBE_ARTIFACT_PCT = 20;
/** Minehead Button_BonusPerTime table, verbatim: "2 3 2 2 4 5 4 25 5". Bucket 3 -> 2. */
const BUTTON_PER_TIME = [2, 3, 2, 2, 4, 5, 4, 25, 5];
/** GamingPalette[5] = ["0","248","255","Bright_Cyan","300","1","5000","1.30","1000000","9",
 *  "}x_Artifact_Find_chance"]; field[4]=300 is the cap, field[5]=1 selects the L/(L+25) curve. */
const PALETTE_ARTIFACT_IDX = 5, PALETTE_CAP = 300, PALETTE_SOFT = 25;
/** Spelunk[6].length feeds 1.02^n, gated on super bit 26. Number2Letter[0]="_" so 26 -> "z". */
const SPELUNK_BIT = 26;
/** CustomLists.StarSigns[61] = ["Artifosho","+15%_Artifact_Find","Chance","(Multiplicative)"].
 *  The 15 is hardcoded in the StarSigns builder: `StarSigns["61"] = 15 + StarSigns["61"]` — a flat
 *  addend with no multiplier chain, unlike (say) the vial's DNSM entry. */
const ARTIFOSHO = 61, ARTIFOSHO_PCT = 15, ARTIFOSHO_NAME = "Artifosho";
/** CompanionDB[43]="w7a7" value .25 (1.25x); CompanionDB[154]="w7b3b" value .6 (-> min(2,2.2)=2x). */
const COMPANION_ARTI = 43, COMPANION_ARTI_VAL = 0.25;
const COMPANION_SAIL = 154, COMPANION_SAIL_VAL = 0.6;

const T = (key, kind, value, status, note) => ({ key, kind, value, status, note });

/** Fauxory Tusk: Sailing("ArtifactBonus",3,0).
 *  Client: base = (tier==0 ? 0 : ArtifactInfo[3][3]); then `3==l` branch multiplies by Lv0[13]
 *  (the sailing level); then the tier text ("doubled"/"tripled"/.../"sixtupled") multiplies by
 *  2..6 at tiers 2..6.
 *  The tier multiplier is CONFIRMED general, not assumed. An earlier note here claimed the
 *  doubling chain "appears exactly once, written against a hardcoded index 25" and flagged the
 *  general application as unverified. That was a misreading — there are TWO chains:
 *    - inside the `-1==b` builder loop the chain is written against the LOOP VARIABLE `l`, e.g.
 *      `"The_artifact's_main_bonus_is_sixtupled!"==ArtifactInfo[l][13] && 6==Sailing[3][l] &&
 *       (SailzArtiBonusL[l] = 6*SailzArtiBonusL[l])` — this is the general one, and it runs for
 *      every artifact;
 *    - a SEPARATE `25==b && ...` block afterwards recomputes artifact 25 alone (it depends on the
 *      active character's class stats, so it cannot be cached like the rest). That is the
 *      hardcoded-25 chain the old note found.
 *  ArtifactInfo[3] = ["Fauxory_Tusk","10","100","1","+{%_artifact_find_chance_per_sailing_LV...",
 *  "The_artifact's_main_bonus_is_doubled!","1",...,"The_artifact's_main_bonus_is_sixtupled!","1"],
 *  so at tier 6 the chain's last arm fires: base 1 * Lv0[13] * 6. Verified end-to-end. */
function fauxory(s) {
  const tier = sel.artifactTiers(s)[FAUXORY_IDX] ?? 0;
  if (!tier) return T("Sailing(ArtifactBonus,3,0) Fauxory Tusk", "add", 0, "computed", "artifact not found");
  const lv = sel.sailingLv(s);
  const tierMult = tier >= 2 ? tier : 1;   // tier 6 -> "sixtupled" -> x6
  return T("Sailing(ArtifactBonus,3,0) Fauxory Tusk", "add", FAUXORY_BASE * lv * tierMult, "computed",
    `base ${FAUXORY_BASE} x sailing lv ${lv} x tier ${tier} (x${tierMult})`);
}

/** CaptBonusCalc(3, Boats[b][0]) — this boat's own captain, Artifact Find (stat id 3).
 *  Both stat slots are summed; a captain may roll the same id twice. Effect = level * roll. */
function captainArtifactFind(s, boatIdx) {
  const boat = sel.boats(s)[boatIdx];
  const ci = boat?.[0] ?? -1;
  if (ci < 0) return T("CaptBonusCalc(3, Boats[b][0])", "add", 0, "computed", "boat has no captain");
  const c = sel.captains(s)[ci];
  if (!c) return T("CaptBonusCalc(3, Boats[b][0])", "add", 0, "computed", "captain missing");
  const v = (c[1] === 3 ? c[3] * c[5] : 0) + (c[2] === 3 ? c[3] * c[6] : 0);
  return T("CaptBonusCalc(3, Boats[b][0])", "add", v, "computed",
    `captain ${ci} tier ${c[0]} lv ${c[3]} stats [${c[1]},${c[2]}]`);
}

/** ArcadeBonus(32) and ArcadeBonus(66).
 *  Client: `mult=1; if(ArcadeUpg[i]==101) mult*=2; if(Companions(27)==1) mult*=2;
 *          return mult * ArbitraryCode5Inputs(row[3], row[1], row[2], ArcadeUpg[i])`
 *  Both rows use mode "decay" => b*f/(f+c):
 *    ArcadeShopInfo[32] = ["+{%_Artifact_Find","50","100","decay",...] -> 50*L/(L+100)
 *    ArcadeShopInfo[66] = ["+{%_Artifact_Find","60","100","decay",...] -> 60*L/(L+100)
 *  Level 101 means MAXED (hence the x2). Companion 27 is "reindeer 2.00x_Gold_Ball_Shop_Bonuses"
 *  — the Gold Ball Shop IS the arcade — so it doubles both. Companion ownership is server-side,
 *  so when it is unknown we take the LOWER bound (no reindeer) and flag it. */
const ARCADE_ARTIFACT_IDS = [32, 66];
const REINDEER_COMPANION = 27;
function arcade(s, companions, unknowns) {
  const u = sel.arcadeUpg(s);
  const reindeer = companions ? companions.has(REINDEER_COMPANION) : false;
  if (!companions) unknowns.push(`Companions(${REINDEER_COMPANION}) Spirit Reindeer — doubles BOTH arcade artifact bonuses; needs the _comp RTDB doc`);
  let total = 0;
  const parts = [];
  for (const i of ARCADE_ARTIFACT_IDS) {
    const L = Number(u[i] ?? 0);
    const v = arcadeBonusOf(i, L, reindeer);
    total += v;
    parts.push(`ArcadeUpg[${i}]=${L}${L === 101 ? " maxed(x2)" : ""}${reindeer ? " x2 reindeer" : ""} -> ${v.toFixed(3)}%`);
  }
  return T("ArcadeBonus(32)+ArcadeBonus(66)", "add", total, companions ? "computed" : "partial",
    parts.join(", ") + (companions ? "" : "; reindeer ownership UNKNOWN -> lower bound"));
}

/** 25 * min(30, NONdummies[60]); NONdummies[60] = number of tier-6 captains (client caps the
 *  scan at the first 30 captains, so the cap binds twice over). */
function tier6Captains(s) {
  const n = sel.tier6CaptainCount(s);
  return T("25*min(30, NONdummies[60]) tier-6 captains", "add", 25 * Math.min(30, n), "computed", `${n} tier-6 captains`);
}

/** GetBribeBonus("34") = BribeStatus[34]==1 ? BribeDescriptions[34][5] : 0. */
function bribe(s) {
  const owned = sel.bribeStatus(s)[BRIBE_ARTIFACT] === 1;
  return T('GetBribeBonus("34") Artifact Pilfering', "add", owned ? BRIBE_ARTIFACT_PCT : 0, "computed",
    owned ? "bribe owned" : "bribe not bought");
}

/** RandomEvent("KillroyBonuses",0,0) = 1 + OptLacc[228]/(300+OptLacc[228]). */
function killroy(s) {
  const x = sel.killroyStat(s);
  return T("max(1, RandomEvent(KillroyBonuses,0,0))", "mul", Math.max(1, 1 + x / (300 + x)), "computed", `OptLacc[228]=${x}`);
}

/** Artifosho, star sign 61 — `(1 + DNSM.StarSigns["61"]/100)`.
 *
 *  The previous implementation asked "which character is sailing?" and degraded to unknown
 *  without one. That was WRONG for any account with Infinite Star Signs, which is the normal
 *  endgame state. `_customBlock_StarSigns` (N.js ~9861) builds StarSignsDL as a UNION:
 *      StarSignsDL = PersonalValuesMap.StarSign.split(",")          // active char's equipped
 *      for (f=0, g=RiftStuff("enabledStarSigns",0)|0; f<g;) {       // ...THEN append
 *        var k=f++;
 *        if (k < CustomLists.StarSigns.length && StarSignsUnlocked.hasOwnProperty(StarSigns[k][0]))
 *          StarSignsDL.push(""+k);
 *      }
 *  and later `if (contains(StarSignsDL,"61")) StarSigns["61"] = 15 + StarSigns["61"]` — a FLAT 15,
 *  no multipliers (checked; that is why ARTIFOSHO_PCT is a constant and not a curve).
 *  So the first N signs BY LIST INDEX that are unlocked are permanently active regardless of who
 *  is sailing. N = RiftStuff("enabledStarSigns",0) = `Rift[0] < 10 ? 0 : 5 + ShinyBonusS(3)`
 *  (verified in _customBlock_RiftStuff) — Rift-gated, then driven by shiny pets.
 *  `StarSignsUnlocked` is save key `StarSg` (verified: `addSaveEntryMap("StarSg",
 *  getGameAttribute("StarSignsUnlocked"))`), an 80-entry dict keyed by star sign NAME;
 *  CustomLists.StarSigns[61][0] === "Artifosho".
 *
 *  When 61 >= N the union's second arm cannot fire, so the term genuinely depends on the ACTIVE
 *  character's equipped list — which is not in the save. That case degrades to an explicit
 *  option, never a guess. */
function artifosho(s, activeChar, starSignNames, nSigns, unknowns) {
  const unlocked = starSignNames.has(ARTIFOSHO_NAME);
  if (ARTIFOSHO < nSigns) {
    return T("(1 + StarSigns[61]/100) Artifosho", "mul", unlocked ? 1 + ARTIFOSHO_PCT / 100 : 1, "computed",
      `Infinite Star Signs: enabledStarSigns=${nSigns} > 61, StarSg${unlocked ? " has" : " LACKS"} "${ARTIFOSHO_NAME}"` +
      ` -> sign 61 ${unlocked ? "permanently active (character-independent)" : "not unlocked"}`);
  }
  // Not covered by the infinite window -> back to "whoever is sailing".
  if (activeChar == null) {
    const cands = sel.charsWithStarSign(s, ARTIFOSHO);
    unknowns.push("(1 + StarSigns[61]/100) Artifosho — enabledStarSigns=" + nSigns +
      " does not reach index 61, so this depends on the ACTIVE character, which is not in the save; pass activeChar");
    return T("(1 + StarSigns[61]/100) Artifosho", "mul", 1, "unknown",
      `enabledStarSigns=${nSigns} <= 61; equipped on character(s) [${cands.join(",")}] -> would be x${(1 + ARTIFOSHO_PCT / 100).toFixed(2)}`);
  }
  const has = sel.hasStarSign(s, activeChar, ARTIFOSHO);
  return T("(1 + StarSigns[61]/100) Artifosho", "mul", has ? 1 + ARTIFOSHO_PCT / 100 : 1, "computed",
    `enabledStarSigns=${nSigns} <= 61; character ${activeChar} ${has ? "has" : "does not have"} Artifosho equipped`);
}

/** RiftStuff("enabledStarSigns",0) = `Rift[0] < 10 ? 0 : 5 + Breeding("ShinyBonusS","Nah",3,-1)`.
 *  Verbatim from N.js _customBlock_RiftStuff. Shiny bonus 3 is worth SHINY_BONUS_PER_LV[3]=2/lv. */
const INFINITE_SIGNS_RIFT_LV = 10, INFINITE_SIGNS_BASE = 5, SHINY_STARSIGN_BONUS = 3;
function enabledStarSigns(s) {
  if (Number((sel.rift(s) ?? [])[0] ?? 0) < INFINITE_SIGNS_RIFT_LV) return 0;
  return INFINITE_SIGNS_BASE + shinyBonusOf(s, SHINY_STARSIGN_BONUS).total;
}

/** Sailing("DaveyJonesBonus", b, 0), verbatim:
 *   (1 + (50*GemItemsPurchased[8] + Thingies("LegendPTS_bonus",11,0))/100)
 *   * (1 + 2*max(0, min(1, floor((Boats[b][3]+Boats[b][5]+99600)/1e5) * ResearchStuff("Grid_Bonus",105,1))))
 *  Note the gem term is ADDITIVE +50% per purchase in code, even though the shop text says
 *  "boosts ... by 1.50x" per purchase. The code is authoritative. */
/** Sailing("DaveyJonesBonus", b, 0) — per-BOAT, and part of the displayed BoatArtiMulti.
 *   (1 + (50*GemItemsPurchased[8] + Thingies("LegendPTS_bonus",11,0))/100)
 * * (1 + 2*max(0, min(1, floor((Boats[b][3]+Boats[b][5]+99600)/1e5) * ResearchStuff("Grid_Bonus",105,1))))
 * The second factor is a pure ON/OFF x3: `floor((sum+99600)/1e5)` is 1 exactly when the boat's
 * two upgrade levels sum to >= 400, which matches ResGridSquares[105]
 * "Revival_of_the_Undead_Battalion ... at LV 400+" — so the arithmetic and the flavour text
 * agree, which is a good sign we are reading the gate right.
 * Grid_Bonus(105,1) is the NODE LEVEL (e==1), not a bonus. min(1,..) makes any level >= 1 fire. */
const UNDEAD_BATTALION_NODE = 105, DAVEY_LEGEND_TALENT = 11;
function daveyJones(s, boatIdx) {
  const buys = sel.daveyJonesPurchases(s);
  const boat = sel.boats(s)[boatIdx] ?? [];
  const gate = Math.floor(((Number(boat[3]) || 0) + (Number(boat[5]) || 0) + 99600) / 1e5);
  const node = gridLevel(s, UNDEAD_BATTALION_NODE);
  // LegendTalents[11] = "Davey_Jones_Returns", max LV 4, coeff 15 -> "}x bonus to all the same
  // stats that 'Davey Jones Training' gives". It lands in the SAME additive bracket as the gem
  // purchases, which is why it belongs here and not as an outer factor.
  const legend = legendPts(s, DAVEY_LEGEND_TALENT);
  const first = 1 + (50 * buys + legend) / 100;
  const second = 1 + 2 * Math.max(0, Math.min(1, gate * node));
  return T("Sailing(DaveyJonesBonus, b, 0)", "mul", first * second, "computed",
    `GemItemsPurchased[8]=${buys} (+${50 * buys}%) + LegendPTS_bonus(11)=${legend}% -> x${first.toFixed(2)}; boat[3]+boat[5]=${(Number(boat[3]) || 0) + (Number(boat[5]) || 0)} -> gate ${gate}, Grid_Bonus(105,1)=node lv ${node} -> x${second} (Undead Battalion)`);
}

/** Minehead("Button_Bonuses",3,0): buckets OptLacc[594] presses into 9 buckets of 5 by
 *  `floor(f/5) mod 9`, accumulating Button_BonusPerTime[bucket] * Button_BonusMULTI.
 *  Button_BonusMULTI = (1+Companions(147)/100)*(1+Grid_Bonus(125,0)/100). */
const MINEHEAD_COMPANION = 147, MINEHEAD_GRID_NODE = 125;
function minehead(s, companions, unknowns) {
  const presses = sel.mineheadButtonPresses(s);
  let hits = 0;
  for (let f = 0; f < presses; f++) if (Math.floor(f / 5) % 9 === 3) hits++;
  const c147 = companions ? (companions.has(MINEHEAD_COMPANION) ? COMPANION_VAL[MINEHEAD_COMPANION] : 0) : null;
  if (c147 === null) unknowns.push(`Companions(${MINEHEAD_COMPANION}) [inside Minehead Button_BonusMULTI] — needs the _comp RTDB doc`);
  // ResGridSquares[125] = "Better_Button", coeff 5 -> "All button bonuses are +{%_bigger".
  const grid = gridBonus(s, MINEHEAD_GRID_NODE, companions).value;
  const multi = (1 + (c147 ?? 0) / 100) * (1 + grid / 100);
  const pct = hits * BUTTON_PER_TIME[3] * multi;
  return T("(1 + Minehead(Button_Bonuses,3,0)/100)", "mul", 1 + pct / 100, c147 === null ? "partial" : "computed",
    `OptLacc[594]=${presses} presses -> ${hits} in bucket 3 x ${BUTTON_PER_TIME[3]} x MULTI ${multi.toFixed(3)} (companion 147 = ${c147 === null ? "UNKNOWN" : c147}, Grid_Bonus(125,0)=${grid.toFixed(1)} Better_Button) = ${pct.toFixed(1)}%`);
}

/** GamingStatType("PaletteBonus",5,0). GamingPalette[5][5]==1 so the base curve is
 *  L/(L+25) * 300 with L = Spelunk[9][5] — but the builder does NOT stop there. Verbatim, the
 *  tail of the per-colour loop applies TWO more factors that the previous reading missed:
 *    PaletteBonz[g] *= (1 + Thingies("LegendPTS_bonus",10,0)/100)      // Picasso_Gaming, coeff 25
 *    PaletteBonz[g] *= (1 + 0.5*Spelunk("DoWeHaveLoreN1",8,0))         // lore book 8 -> x1.5
 *  (there is also a `*(2 + 0.5*SuperBitType(59,0))` arm, but it is gated on g in {25,13,31,18,3,12}
 *  and 5 is not among them, so it does not apply here.)
 *  LegendTalents[10] = "Picasso_Gaming" max LV 5, coeff 25 -> "All the bonuses from your Gaming
 *  Palette colours are }x higher": at LV 5 that is +125%, i.e. it more than DOUBLES this term.
 *  Spelunk("DoWeHaveLoreN1",b,0) = Spelunk[0][b] >= 1 ? 1 : 0. */
const PALETTE_LEGEND_TALENT = 10, PALETTE_LORE_BOOK = 8;
function palette(s) {
  const L = Number(sel.paletteLevels(s)[PALETTE_ARTIFACT_IDX] ?? 0);
  const base = L / (L + PALETTE_SOFT) * PALETTE_CAP;
  const picasso = legendPts(s, PALETTE_LEGEND_TALENT);
  const lore = Number(sel.loreOwned(s)[PALETTE_LORE_BOOK] ?? 0) >= 1 ? 1 : 0;
  const pct = base * (1 + picasso / 100) * (1 + 0.5 * lore);
  return T("(1 + GamingStatType(PaletteBonus,5,0)/100)", "mul", 1 + pct / 100, "computed",
    `Spelunk[9][5]=${L} -> ${L}/(${L}+25)*300 = ${base.toFixed(2)}; x(1+LegendPTS_bonus(10)=${picasso}/100) Picasso_Gaming; x(1+0.5*lore8=${lore}) => ${pct.toFixed(2)}%`);
}

/** max(1, 1.02^Spelunk[6].length * SuperBitType(26,0)).
 *  SuperBitType(b) = Gaming[12].indexOf(Number2Letter[b]) != -1 ? 1 : 0. Number2Letter[0]="_"
 *  (Gaming[12] starts with "_"), so index 26 is "z". When the bit is unowned the product is 0
 *  and max(1, 0) = 1 — i.e. the whole spelunking term is gated off. */
function spelunk(s) {
  const n = sel.spelunkMaterials(s).length;
  const bit = String(sel.superBits(s)).indexOf(NUMBER_2_LETTER[SPELUNK_BIT]) !== -1 ? 1 : 0;
  return T("max(1, 1.02^Spelunk[6].length * SuperBitType(26,0))", "mul",
    Math.max(1, Math.pow(1.02, n) * bit), bit ? "computed" : "computed",
    `${n} materials -> 1.02^${n}=${Math.pow(1.02, n).toFixed(3)}; super bit 26 ("${NUMBER_2_LETTER[SPELUNK_BIT]}") ${bit ? "owned" : "NOT owned -> term gated to 1"}`);
}

/** Companions(43) and Companions(154).
 *  `Companions(d)` returns CompanionDB[d][2] when owned, else 0. Ownership is NOT in the
 *  Firestore save — the client reads the native `getCompanionInfoMe()` bridge, which is backed
 *  by the Firebase RTDB doc `_comp/{uid}`. companion.mjs fetches that and merges it into the
 *  raw as `__companions`; sel.companionsOwned() unions it with the Pet-Bonus-Token ids in
 *  OptLacc[606] (those have no _comp entry, so both sources are required).
 *  `owned === null` means we genuinely do not know (doc absent / fetch failed) — that stays
 *  `unknown`, and must never collapse to "owns nothing". */
function companionTerms(s, owned, unknowns) {
  const out = [];
  for (const [id, label, fn] of [
    [COMPANION_SAIL, "max(1, min(2, 1+2*Companions(154)))", (v) => Math.max(1, Math.min(2, 1 + 2 * v))],
    [COMPANION_ARTI, "(1 + Companions(43))", (v) => 1 + v],
  ]) {
    if (owned === null) {
      unknowns.push(`Companions(${id}) — no _comp RTDB doc on this snapshot; cannot tell`);
      out.push(T(label, "mul", 1, "unknown", `ownership unknown -> would be x${fn(COMPANION_VAL[id])} if owned`));
      continue;
    }
    const v = owned.has(id) ? COMPANION_VAL[id] : 0;
    out.push(T(label, "mul", fn(v), "computed",
      owned.has(id) ? `companion ${id} owned, CompanionDB[${id}][2]=${COMPANION_VAL[id]} -> x${fn(v)}` : `companion ${id} not owned -> x1`));
  }
  return out;
}

/** Breeding("ShinyBonusS","Nah",21,-1) — shiny pets with the artifact-find shiny bonus.
 *  Client walks worlds 0..3; for each pet with shiny xp > 0 it adds
 *  round(shinyLevel * RANDOlist[92][bonusId]) to that bonus id. Bonus 21 is artifact find,
 *  worth 2%/level. shinyLevel: lv=1; for b in 0..18: if xp > floor((1+(b+1)^1.6)*1.7^(b+1)) lv=b+2. */
const shinyLevel = (xp) => {
  let lv = 1;
  for (let b = 0; b < 19; b++) if (xp > Math.floor((1 + Math.pow(b + 1, 1.6)) * Math.pow(1.7, b + 1))) lv = b + 2;
  return lv;
};
/** Breeding("ShinyBonusS","Nah",<bonusId>,-1) for ANY bonus id — generalised because the star
 *  sign gate needs bonus 3 (`enabledStarSigns`) as well as 21 (artifact find). */
function shinyBonusOf(s, bonusId) {
  const br = sel.breeding(s);
  let total = 0;
  const hits = [];
  for (let w = 0; w < PET_SHINY_SLOT.length; w++) {
    const row = br[22 + w] ?? [];
    for (let m = 0; m < PET_SHINY_SLOT[w].length; m++) {
      const xp = Number(row[m] ?? 0);
      if (!(xp > 0)) continue;
      const slot = PET_SHINY_SLOT[w][m];
      if (SHINY_SLOT_TO_BONUS[slot] !== bonusId) continue;
      const lv = shinyLevel(xp);
      const v = Math.round(lv * SHINY_BONUS_PER_LV[bonusId]);
      total += v;
      hits.push(`w${w}/pet${m} lv${lv} -> ${v}%`);
    }
  }
  return { total, hits };
}
function shinyPets(s) {
  const { total, hits } = shinyBonusOf(s, SHINY_ARTIFACT_BONUS);
  return T('Breeding("ShinyBonusS","Nah",21,-1) shiny pets', "add", total, "computed", hits.join(", ") || "no artifact-find shiny pets");
}

/** Holes("B_UPG",55,0) — "Tune of Artifaction": +10% per power of 10 Natural Notes.
 *  Client: `Holes[13][55]===0 ? 0 : 10 * floor(log10(Holes[9][11]))` (getLOG is log10). */
function tuneOfArtifaction(s) {
  const holes = s.get("Holes") ?? [];
  if (((holes[13] ?? [])[55] ?? 0) === 0) return T('Holes("B_UPG",55,0) Tune of Artifaction', "add", 0, "computed", "building not unlocked");
  const notes = (holes[9] ?? [])[11] ?? 0;
  const v = 10 * Math.floor(Math.log(Math.max(notes, 1)) / 2.30259);
  return T('Holes("B_UPG",55,0) Tune of Artifaction', "add", v, "computed", `Natural Notes ${Number(notes).toExponential(3)} -> 10*floor(log10) = ${v}%`);
}

/** Summoning("VaultUpgBonus",63,0) — vault "Artifact_Find_Chance".
 *  63 is NOT in the client's exempt chain, so it takes its band's mastery (61<=63<89 -> id 89,
 *  "Vault_Mastery_III", which IS exempt and so terminates the recursion). */
function vaultArtifact(s) {
  const val = vaultUpg(s, 63);
  return T('Summoning("VaultUpgBonus",63,0)', "add", val, "computed",
    `UpgVault[63]=${sel.upgVault(s)[63]} x coeff ${VAULT_COEFF[63]} x mastery III (UpgVault[89]=${sel.upgVault(s)[89]}) = ${val.toFixed(2)}%`);
}

/** ResearchStuff("Grid_Bonus",b,0) = ResGridSquares[b][2] * Research[0][b]
 *    * (Research[1][b]==-1 ? 1 : 1+Research[5][Research[1][b]]/100) * max(1, Allmulti).
 *  Allmulti depends on Companions/Dream/Sushi53 and is NOT evaluated -> treated as 1 (its own
 *  max(1,..) floor), which makes these lower bounds. Flagged via `unknowns`.
 *  ResGridSquares[109] = "Transcendent_Artifacts", coeff 25 (ADDITIVE %).
 *  ResGridSquares[106] = "The_Maw",              coeff 25 (MULTIPLICATIVE %). */
const RES_OCCURRENCE_PCT = [25, 15, 50, 20, 20, 35, 25, 30, 35, 60];   // == CustomLists.Research[5]
function gridBonus(s, node, companions) {
  const r = sel.research(s);
  const lv = Number((r[0] ?? [])[node] ?? 0);
  const occ = Number((r[1] ?? [])[node] ?? -1);
  const occMult = occ === -1 ? 1 : 1 + RES_OCCURRENCE_PCT[occ] / 100;
  const all = gridAllmulti(s, companions);
  return { value: (RES_GRID_COEFF[node] ?? 0) * lv * occMult * all.value, lv, occ, occMult, all };
}

/** ResearchStuff("Grid_Bonus_Allmulti",0,0), verbatim:
 *    1 + ( Companions(55)
 *        + 5*min(1, Research[0][173] * Companions(0))
 *        + Dreamstuff("CloudBonus",71) + CloudBonus(72) + CloudBonus(76)
 *        + SushiStuff("RoG_BonusQTY",53,0) ) / 100
 *  and every Grid_Bonus(b,0) is multiplied by `max(1, Allmulti)`. Previously floored at 1 and
 *  flagged; it is fully derivable, and it is SMALL — the point of decoding it was to rule it out
 *  as the missing multiplier, which it is:
 *    Companions(55) = CompanionDB[55][2] = 15 (a flat 15, not 15x).
 *    Companions(0) is additionally gated on Lv0[14] >= 2 inside _customBlock_Companions.
 *    CloudBonus(b) = `WeeklyBoss["d_"+b] == -1 ? 1 : 0` — a 0/1 FLAG, worth at most 1 each. The
 *      "}x" in the shop text does not mean the block returns a multiplier.
 *    SushiStuff("RoG_BonusQTY",53,0) = UniqueSushi() > 53 ? Research[37][53] : 0.
 *  So the whole thing lands ~1.2x, not the ~5x the gap needed. */
const ALLMULTI_COMPANION = 55, ALLMULTI_COMPANION_GATE = 0, ALLMULTI_GATE_NODE = 173;
const ALLMULTI_CLOUDS = [71, 72, 76], ALLMULTI_SUSHI = 53;
function gridAllmulti(s, companions) {
  const c55 = companions ? (companions.has(ALLMULTI_COMPANION) ? COMPANION_VAL[ALLMULTI_COMPANION] : 0) : null;
  const c0 = companions ? (companions.has(ALLMULTI_COMPANION_GATE) ? COMPANION_VAL[ALLMULTI_COMPANION_GATE] : 0) : null;
  const gateNode = Number((sel.research(s)[0] ?? [])[ALLMULTI_GATE_NODE] ?? 0);
  const gate = 5 * Math.min(1, gateNode * (c0 ?? 0));
  const clouds = ALLMULTI_CLOUDS.reduce((a, i) => a + sel.cloudBonus(s, i), 0);
  const sushi = uniqueSushi(s) > ALLMULTI_SUSHI ? SUSHI_ROG[ALLMULTI_SUSHI] ?? 0 : 0;
  const sum = (c55 ?? 0) + gate + clouds + sushi;
  return {
    value: Math.max(1, 1 + sum / 100), known: companions !== null,
    note: `Companions(55)=${c55 ?? "?"} + gate ${gate} + clouds ${clouds} + sushi53 ${sushi} -> x${(1 + sum / 100).toFixed(3)}`,
  };
}

/** ResearchStuff("Grid_Bonus", b, 1) — the `e` param is NOT a flag, it selects a whole
 *  different return. `1==e` returns `Math.round(Research[0][b])`, i.e. the raw NODE LEVEL,
 *  not a bonus at all. (`2==e` is a third, display-oriented set of special cases.)
 *  Missing this is why DaveyJonesBonus was stuck at "partial": its x3 gate calls with e=1. */
const gridLevel = (s, node) => Math.round(Number((sel.research(s)[0] ?? [])[node] ?? 0));
/** ResGridSquares[b][2], read from the client's own table:
 *   68  "Boony_Crowns"            coeff 1   (stickers give {% higher bonuses; used via e==2)
 *   106 "The_Maw"                 coeff 25  (MULTIPLICATIVE %)
 *   109 "Transcendent_Artifacts"  coeff 25  (ADDITIVE %)
 *   125 "Better_Button"           coeff 5   (all button bonuses +{% bigger) */
const RES_GRID_COEFF = { 68: 1, 106: 25, 109: 25, 125: 5 };

/** SushiStuff("RoG_BonusQTY",b,0) = UniqueSushi() > b ? CustomLists.Research[37][b] : 0.
 *  UniqueSushi counts LEADING consecutive Sushi[5][f] >= 0; the first negative stops it.
 *  Research[37] verbatim from the client (only the ids used here matter): [7]=30 (artifact find),
 *  [53]=1 (feeds Grid_Bonus_Allmulti). */
const SUSHI_ROG = { 7: 30, 53: 1 };
const SUSHI_ARTIFACT_IDX = 7;
function uniqueSushi(s) {
  const row = (sel.sushi(s)[5] ?? []);
  let u = 0;
  for (let f = 0; f < row.length; f++) { if (Number(row[f]) >= 0) u = f + 1; else break; }
  return u;
}
function sushiRoG(s) {
  const u = uniqueSushi(s);
  const v = u > SUSHI_ARTIFACT_IDX ? SUSHI_ROG[SUSHI_ARTIFACT_IDX] : 0;
  return T('(1 + SushiStuff("RoG_BonusQTY",7,0)/100)', "mul", 1 + v / 100, "computed", `UniqueSushi=${u} -> ${v}%`);
}

/** Thingies("LegendPTS_bonus",b,0) = round(Spelunk[18][b] * CustomLists.LegendTalents[b][2]).
 *  Verbatim from N.js _customBlock_Thingies. Fully derivable — it was previously listed as
 *  "not decoded" inside DaveyJonesBonus, where it is worth a real +60%. */
const legendPts = (s, id) => Math.round(Number(sel.legendTalentLevels(s)[id] ?? 0) * (LEGEND_TALENT_COEFF[id] ?? 0));

/** GetSetBonus(name,"Bonus",0,0). N.js _customBlock_GetSetBonus, "Bonus"==b branch:
 *    if (OptLacc[379].split(",") contains name)        -> EquipmentSets[name][3][2]
 *    else if (PartsOn(name) >= PartsReq(name))         -> EquipmentSets[name][3][2]
 *    else                                              -> 0
 *  The FIRST arm is the important one and was missed before: OptLacc[379] is the list of
 *  PERMANENTLY unlocked sets, and a set in it pays out with nothing equipped. That is why these
 *  terms do NOT need the active character's gear, contrary to the old note. Only if the set is
 *  not perma-unlocked do we need EquipOrder_N, and then we say so rather than guess. */
function setBonus(s, name) {
  if (sel.setsPermaUnlocked(s).has(name)) return { value: SET_BONUS_VAL[name] ?? 0, known: true, why: `${name} is perma-unlocked in OptLacc[379] -> bonus applies with no pieces equipped` };
  return { value: 0, known: false, why: `${name} not in OptLacc[379]; would need the active character's EquipOrder_N to count pieces` };
}

/** FarmingStuffs("StickerBonus",2,0), verbatim:
 *    (1 + (Grid_Bonus(68,2) + 30*EventShopOwned(37))/100)
 *  * (1 + 20*SuperBitType(62,0)/100)
 *  * Research[9][b] * CustomLists.Research[25][b]
 *  Sticker 2 is the artifact one: CustomLists.Research[24][2] = "Increases_Artifact_Find_Chance_
 *  by_a_measly,_almost_imperceivable_+{%", coeff Research[25][2] = 15. ADDITIVE %.
 *  Grid_Bonus(68,2) is the `2==e` special case: `Grid_Bonus(68,0) * Research[11].length` — node 68
 *  is "Boony_Crowns" (coeff 1, "for every King Rat Crown you reclaim, all your stickers give {%
 *  higher bonuses") and Research[11] is the 32-long head list. */
const STICKER_ARTIFACT_IDX = 2, STICKER_COEFF = 15, STICKER_CROWN_NODE = 68, STICKER_CROWN_HEADS = 32;
const STICKER_EVENTSHOP = 37, STICKER_EVENTSHOP_PCT = 30, STICKER_SUPERBIT = 62, STICKER_SUPERBIT_PCT = 20;
function stickerBonus(s, companions, unknowns) {
  const lv = Number(sel.stickerLevels(s)[STICKER_ARTIFACT_IDX] ?? 0);
  const crown = gridBonus(s, STICKER_CROWN_NODE, companions).value * STICKER_CROWN_HEADS;
  const shop = eventShopOwned(s, STICKER_EVENTSHOP) ? STICKER_EVENTSHOP_PCT : 0;
  const bit = superBitType(s, STICKER_SUPERBIT);
  if (bit === null) unknowns.push(`GamingStatType("SuperBitType",62,0) [inside StickerBonus] — Number2Letter[62] is not in N.js (game-attribute data, ids >= 53 unrecoverable); treated as not owned, costs at most x1.2 on this term`);
  const v = (1 + (crown + shop) / 100) * (1 + STICKER_SUPERBIT_PCT * (bit ?? 0) / 100) * lv * STICKER_COEFF;
  return T('FarmingStuffs("StickerBonus",2,0)', "add", v, bit === null ? "partial" : "computed",
    `Research[9][2]=${lv} x coeff ${STICKER_COEFF}; Grid_Bonus(68,2)=${crown.toFixed(1)} (Boony Crowns x${STICKER_CROWN_HEADS} heads) + eventShop37 ${shop} -> x${(1 + (crown + shop) / 100).toFixed(3)}; superbit62 ${bit === null ? "UNKNOWN" : bit} => ${v.toFixed(1)}%`);
}

/** 20 * RandomEvent("FractalIslandBonus",3,999).
 *  RandomEvent("FractalIslandBonus",b) just reads DNSM.FracIsBn[b], which is built as
 *    for (f in 0..GenINFO[25].length) FracIsBn.push(OptLacc[184] >= GenINFO[25][f] ? 1 : 0)
 *  so it is a 0/1 FLAG, not a magnitude — the term can only ever be 0 or +20. The thresholds are
 *  pushed literally right above it, and the sibling GenINFO[24] descriptions confirm the index:
 *  GenINFO[24][3] = "1.20x_Chance_to_find_Sailing_Artifacts". */
const FRACTAL_THRESHOLDS = [24, 200, 750, 2500, 1e4, 2e4, 4e4, 6e4];
const FRACTAL_ARTIFACT_IDX = 3, FRACTAL_ARTIFACT_PCT = 20;
function fractalIsland(s) {
  const pts = sel.fractalIslandPts(s);
  const need = FRACTAL_THRESHOLDS[FRACTAL_ARTIFACT_IDX];
  const on = pts >= need ? 1 : 0;
  return T('20*RandomEvent("FractalIslandBonus",3,999)', "add", FRACTAL_ARTIFACT_PCT * on, "computed",
    `OptLacc[184]=${pts} vs threshold ${need} -> flag ${on}${on ? "" : " (Fractal Island owned but this tier not reached -> legitimately 0)"}`);
}

/** Thingies("LoreEpiBon",3,0), verbatim from the DNSM.LoreEpiBon builder:
 *    for g in 0..CustomLists.Spelunky[20].length:
 *      Spelunk[13][2] > g
 *        ? push( (1 + (GrimoireUpgBonus(17) + GetSetBonus("TROLL_SET","Bonus",0,0))/100)
 *                * Number(Spelunky[21][g].split("|")[0])
 *                * max(0, X^0.7 / (25 + X^0.7)) )      // X = floor(max(0, GenInfo[84]-thr)/100)
 *        : push(0)
 *  Spelunky[20][3] = "}x|Artifact_Find" and Spelunky[21][3] = "100|3000" -> base 100, threshold
 *  3000. GrimoireUpg[17] = "Grey_Tome_Book" coeff 1 ("}x_higher_bonuses_from_the_Tome"), and
 *  TROLL_SET's bonus is "}x_Higher_Bonuses_from_Tome" — both flavour texts agree this is the
 *  Tome-bonus multiplier, which is a good independent check that we are reading the right knobs.
 *
 *  X is driven by GenInfo[84] = the TOME SCORE (`GenInfo[84] = TomeQTYtot`, the sum of
 *  Summoning("TomePTS",g,0) over all 118 Tome rows). We do NOT reimplement that: it is 118 bespoke
 *  per-row stat lookups across the whole account, which is a lot of surface to get subtly wrong
 *  for a term whose value is hard-bounded anyway. Instead the score is an explicit option (the
 *  game prints it as "<N>_PTS" on the Tome page), and without it we report the term as unknown
 *  WITH its real bounds rather than guessing: the ratio is monotonic in the score and
 *  sum(Tome[b][3]) = 49695 is the maximum any account can score, so the term cannot exceed
 *  ~x2.84 no matter what. That bound is what rules LoreEpiBon out as the whole missing factor. */
const LOREEPI_ARTIFACT_IDX = 3, LOREEPI_BASE = 100, LOREEPI_THRESHOLD = 3000;
const LOREEPI_EXP = 0.7, LOREEPI_SOFT = 25, TOME_GRIMOIRE_UPG = 17, TOME_MAX_SCORE = 49695;
const loreEpiRatio = (tomePts) => {
  const x = Math.pow(Math.floor(Math.max(0, tomePts - LOREEPI_THRESHOLD) / 100), LOREEPI_EXP);
  return Math.max(0, x / (LOREEPI_SOFT + x));
};
function loreEpiBon(s, tomePoints, unknowns) {
  const key = '(1 + Thingies("LoreEpiBon",3,0)/100)';
  if (sel.loreEpicUnlocked(s) <= LOREEPI_ARTIFACT_IDX)
    return T(key, "mul", 1, "computed", `Spelunk[13][2]=${sel.loreEpicUnlocked(s)} <= 3 -> entry 3 not unlocked, pushes 0`);
  const grim = sel.grimoireLv(s, TOME_GRIMOIRE_UPG);
  const troll = setBonus(s, "TROLL_SET");
  const scale = (1 + (grim + troll.value) / 100) * LOREEPI_BASE;
  if (tomePoints == null) {
    unknowns.push(`Thingies("LoreEpiBon",3,0) — needs the Tome score (GenInfo[84] = sum of Summoning("TomePTS",g,0) over 118 rows); pass tomePoints (the game prints it as "<N>_PTS" on the Tome page). BOUNDED: x1 .. x${(1 + scale * loreEpiRatio(TOME_MAX_SCORE) / 100).toFixed(3)} (the upper bound uses the maximum score any account can reach, ${TOME_MAX_SCORE})`);
    return T(key, "mul", 1, "unknown",
      `Tome score unknown -> term is in [x1, x${(1 + scale * loreEpiRatio(TOME_MAX_SCORE) / 100).toFixed(3)}]; scale = (1 + (GrimoireUpgBonus(17)=${grim} + TROLL_SET=${troll.value})/100) x ${LOREEPI_BASE} = ${scale.toFixed(1)}`);
  }
  const v = scale * loreEpiRatio(tomePoints);
  return T(key, "mul", 1 + v / 100, troll.known ? "computed" : "partial",
    `Tome score ${tomePoints} -> X=${Math.floor(Math.max(0, tomePoints - LOREEPI_THRESHOLD) / 100)}, ratio ${loreEpiRatio(tomePoints).toFixed(4)}; scale ${scale.toFixed(1)} (Grimoire[17]=${grim}, ${troll.why}) => ${v.toFixed(1)}%`);
}

/** GamingStatType("SuperBitType",b,0) = Gaming[12].indexOf(Number2Letter[b]) != -1 ? 1 : 0.
 *  Returns null when the id is past the end of the recoverable Number2Letter table (>= 53) —
 *  "we cannot tell", NOT "not owned". See gamedata NUMBER_2_LETTER. */
function superBitType(s, b) {
  const ch = NUMBER_2_LETTER[b];
  if (ch === undefined) return null;
  return String(sel.superBits(s)).indexOf(ch) !== -1 ? 1 : 0;
}
/** Summoning("EventShopOwned",b,0) = OptLacc[311].indexOf(Number2Letter[b]) != -1 ? 1 : 0. */
function eventShopOwned(s, b) {
  const ch = NUMBER_2_LETTER[b];
  if (ch === undefined) return null;
  return String((s.get("OptLacc") ?? [])[311] ?? "").indexOf(ch) !== -1 ? 1 : 0;
}

/** Ninja("PristineBon",2,0) = Ninja[107][2]===1 ? NjEQ.NjTrP2[3](=40) : 0 — "Glowing Veil". */
const GLOWING_VEIL_PCT = 40;
function glowingVeil(s) {
  const owned = ((sel.ninja(s)[107] ?? [])[2] ?? 0) === 1;
  return T('(1 + Ninja("PristineBon",2,0)/100) Glowing Veil', "mul", owned ? 1 + GLOWING_VEIL_PCT / 100 : 1, "computed",
    owned ? "charm owned -> +40%" : "Ninja[107][2]=0, charm NOT owned -> x1");
}

/** FarmingStuffs("ExoticBonusQTY",45,0) — market exotic 45 "5_LEAF_CLOVER".
 *  MarketExoticInfo[45] = [...,"79","30","1","2"]: coeff 30, saturating flag 1
 *  => 30 * (L/(1000+L)), with L = FarmUpg[20+45]. */
function exoticClover(s) {
  const L = Number(sel.farmUpg(s)[20 + 45] ?? 0);
  const pct = 30 * (L / (1000 + L));
  return T('(1 + FarmingStuffs("ExoticBonusQTY",45,0)/100)', "mul", 1 + pct / 100, "computed",
    `FarmUpg[65]=${L} -> 30*(${L}/${1000 + L}) = ${pct.toFixed(3)}%`);
}

/** Holes("MonumentROGbonuses",1,2) — Monument of Justice artifact-find.
 *  coeff = HolesInfo[37][12] = 500 (>=30, so the SATURATING arm):
 *    0.1 * ceil(10 * (L/(250+L)) * coeff * max(1, dn))
 *  dn = (1 + MonumentROGbonuses(1,9)/100 + CosmoBonusQTY(0,0)/100) * (1 + fountainBon(1,13)/100)
 *  fountainBon(b,e) = round(marble * lvl * HoleFountUPG[b][e][6]), marble = Holes[32][b][e]===0
 *                     ? 1 : 1.5 + 0.5*Holes[32][b][e]. CosmoBonusQTY(0,0) = floor(25 * Holes[4][0]). */
const MONUMENT_JUSTICE_COEFF = 500, JUSTICE_MULTI_COEFF = 250, COSMO_MONUMENTAL_VIBES = 25, JUDICIAL_BOOST_COEFF = 1;
function monumentJustice(s) {
  const holes = s.get("Holes") ?? [];
  const lvlAt = (i) => Number((holes[15] ?? [])[i] ?? 0);
  const selfMulti = 0.1 * Math.ceil(10 * (lvlAt(19) / (250 + lvlAt(19))) * JUSTICE_MULTI_COEFF * 1);
  const cosmo = Math.floor(COSMO_MONUMENTAL_VIBES * Number((holes[4] ?? [])[0] ?? 0));
  const fLvl = Number(((holes[31] ?? [])[1] ?? [])[13] ?? 0);
  const fMarble = Number(((holes[32] ?? [])[1] ?? [])[13] ?? 0);
  const fountain = Math.round((fMarble === 0 ? 1 : 1.5 + 0.5 * fMarble) * fLvl * JUDICIAL_BOOST_COEFF);
  const dn = (1 + selfMulti / 100 + cosmo / 100) * (1 + fountain / 100);
  const L = lvlAt(12);
  const pct = 0.1 * Math.ceil(10 * (L / (250 + L)) * MONUMENT_JUSTICE_COEFF * Math.max(1, dn));
  return T('(1 + Holes("MonumentROGbonuses",1,2)/100) Monument of Justice', "mul", 1 + pct / 100, "computed",
    `Holes[15][12]=${L}, selfMulti=${selfMulti}, cosmo=${cosmo}, fountain=${fountain}, dn=${dn.toFixed(3)} -> ${pct.toFixed(2)}% = ${(1 + pct / 100).toFixed(2)}x`);
}

/** Summoning("VotingBonusz",20,0) = 31 * multi IFF vote 20 is the CURRENTLY ACTIVE vote.
 *  The active vote lives in runtime UI state (PixelHelperActor[25]._GenINFO[36]), NOT in the
 *  save. Not computable from the save alone; honestly unknown unless the caller supplies it. */
function votingBonus(s, activeVote, unknowns) {
  if (activeVote == null) {
    unknowns.push('Summoning("VotingBonusz",20,0) — active vote is runtime UI state, not in the save');
    return T('(1 + Summoning("VotingBonusz",20,0)/100)', "mul", 1, "unknown", "active vote unknown; 0 unless vote 20 is live (then +31% x multi)");
  }
  const v = activeVote === 20 ? 31 : 0;
  return T('(1 + Summoning("VotingBonusz",20,0)/100)', "mul", 1 + v / 100, "computed",
    activeVote === 20 ? "vote 20 active -> +31% (multi not applied)" : `active vote is ${activeVote}, not 20 -> x1`);
}

/** max(1, 1.5^Stuff2("PurpleChestSlugsOwned",0,0)).
 *  Stuff2("PurpleChestSlugsOwned") = round(Summoning("EventShopOwned",48,0)), and
 *  EventShopOwned(b) = OptLacc[311].indexOf(Number2Letter[b]) != -1 ? 1 : 0.
 *  So this is a FLAG, not a count — the exponent can only ever be 0 or 1, capping the term at
 *  1.5x. (The community claim that it stacks / is uncapped is wrong: the client cannot express
 *  a value above 1.) */
const PURPLE_SLUG_SHOP_IDX = 48;
function purpleChestSlug(s) {
  const owned = String((s.get("OptLacc") ?? [])[311] ?? "").indexOf(NUMBER_2_LETTER[PURPLE_SLUG_SHOP_IDX]) !== -1 ? 1 : 0;
  return T('max(1, 1.5^Stuff2("PurpleChestSlugsOwned",0,0))', "mul", Math.max(1, Math.pow(1.5, owned)), "computed",
    `OptLacc[311] ${owned ? "contains" : "lacks"} "${NUMBER_2_LETTER[PURPLE_SLUG_SHOP_IDX]}" -> owned=${owned} -> 1.5^${owned}`);
}

/* --- ArbitraryCode5Inputs: the client's shared curve dispatcher ----------- */
export function arbitraryCode5(mode, b, c, f) {
  switch (mode) {
    case "add":      return c !== 0 ? ((b + c) / c + 0.5 * (f - 1)) / (b / c) * f * b : b * f;
    case "decay":    return b * f / (f + c);
    case "bigBase":  return b + c * f;
    case "reduce":   return b - c * f;
    case "intervalAdd": return b + Math.floor(f / c);
    case "decayMulti":  return 1 + b * f / (f + c);
    default: return 0;
  }
}

/** ArcadeBonus(i) — generic, using the client's own row + curve rather than hardcoded shapes.
 *  mult = 1; if level==101 (maxed) x2; if Companions(27) (Spirit Reindeer, "2.00x Gold Ball
 *  Shop Bonuses" — the Gold Ball Shop IS the arcade) x2. */
function arcadeBonusOf(i, level, hasReindeer) {
  if (!level) return 0;
  const r = ARCADE_ROWS[i];
  let mult = 1;
  if (level === 101) mult *= 2;
  if (hasReindeer) mult *= 2;
  return mult * arbitraryCode5(r.mode, r.b, r.c, level);
}

/** Summoning("VaultUpgBonus",b,0) = UpgVault[b] * UpgradeVault[b][5], times the mastery of its
 *  band UNLESS b is in the client's exempt chain. Bands: <32 -> Mastery I(32), <61 -> II(61),
 *  <89 -> III(89). The mastery ids are themselves exempt, so this bottoms out. */
function vaultUpg(s, b) {
  const v = sel.upgVault(s);
  const raw = Number(v[b] ?? 0) * (VAULT_COEFF[b] ?? 0);
  if (VAULT_NO_MASTERY.includes(b)) return raw;
  const m = b < 32 ? 32 : b < 61 ? 61 : 89;
  return raw * (1 + vaultUpg(s, m) / 100);
}

/** AlchVials["6turtle"] — Turtle Tisane. VERIFIED to 378.56 vs the account's in-game +379%.
 *  Client: AlchVials[key] += CauldronStats("VialBonus",4,g,0) for every vial g whose
 *  AlchemyDescription[4][g][11] == key (only vial 74 carries "6turtle"), and
 *    VialBonus = (MainframeBonus(10)==2 ? 2 : 1)
 *              * (1 + DNzz/100) * (1 + Summoning2("MeritocBonusz",20,0)/100)
 *              * ArbitraryCode5Inputs(row[3], row[1], row[2], CauldronInfo[4][g])
 *    DNzz = (Rift[0] > 34 ? 2*<maxed vial count> : 0) + VaultUpgBonus(42)
 *  row 74 = ["TURTLE_TISANE","4","0","add",...] -> mode "add", c==0 -> b*f = 4*level.
 *  The `2*GenINFO[108]` term is the Rift-35 "Vial Mastery": GenINFO[108] is runtime UI state,
 *  but it is the COUNT OF MAXED VIALS, which the save does have. Identified empirically —
 *  67 maxed vials reproduces the in-game 379 exactly — so it is `inferred`, not read from the
 *  client. MeritocBonusz is scene-gated and returns 0 outside the vote window; treated as 0. */
const TURTLE_VIAL_IDX = 74, TURTLE_VIAL_B = 4, TURTLE_VIAL_MODE = "add", TURTLE_VIAL_C = 0;
const VIAL_MAX_LEVEL = 13, RIFT_VIAL_MASTERY_LV = 34, VIAL_OVERTUNE = 42;
function turtleVial(s, labConnected, unknowns) {
  const vials = sel.vialLevels(s);
  const lv = Number(vials[TURTLE_VIAL_IDX] ?? 0);
  if (!lv) return T('(1 + AlchVials["6turtle"]/100) Turtle Tisane', "mul", 1, "computed", "vial not unlocked");
  const base = arbitraryCode5(TURTLE_VIAL_MODE, TURTLE_VIAL_B, TURTLE_VIAL_C, lv);
  const maxedVials = vals(vials).map(Number).filter((x) => x >= VIAL_MAX_LEVEL).length;
  const riftOn = Number((sel.rift(s) ?? [])[0] ?? 0) > RIFT_VIAL_MASTERY_LV;
  const dnzz = (riftOn ? 2 * maxedVials : 0) + vaultUpg(s, VIAL_OVERTUNE);
  // LabMainBonus[10] "My 1st Chemistry Set": connected -> row[5]=2, else row[4]=1. VialBonus
  // tests `2 == MainframeBonus(10)`, so a disconnected node means no doubling at all.
  unknowns.push("Summoning2(\"MeritocBonusz\",20,0) [inside the vial] — scene-gated runtime state, returns 0 outside the vote window; treated as 0");
  const conn = labConnected(10);
  if (conn === null) unknowns.push("Lab node connectivity for MainframeBonus(10) (vial doubler) — not simulated; vial computed WITHOUT the x2");
  const doubler = conn ? 2 : 1;
  const pct = doubler * (1 + dnzz / 100) * base;
  return T('(1 + AlchVials["6turtle"]/100) Turtle Tisane', "mul", 1 + pct / 100, conn === null ? "partial" : "computed",
    `vial lv${lv} -> base ${base}; ${maxedVials} maxed vials${riftOn ? " (Rift>34 active)" : ""} + VaultUpgBonus(42)=${vaultUpg(s, VIAL_OVERTUNE)} -> DNzz=${dnzz}; lab doubler x${doubler}${conn === null ? " (connectivity unknown)" : ""} => +${pct.toFixed(2)}%`);
}

/** Summoning("WinBonus",3,0). b=3 hits the default branch:
 *    3.5 * SummWinBonus[3]
 *      * (1 + Ninja("PristineBon",8,0)/100)           // Crystal Comb, NjTrP8[3]=30
 *      * (1 + 10*GemItemsPurchased[11]/100)
 *      * (1 + (Sailing("ArtifactBonus",32,0) + min(10,Tasks[2][5][4]) + AchieveStatus(379)
 *              + AchieveStatus(373) + Summoning("WinBonus",31,0) + Thingies("EmperorBon",8,0)
 *              + GetSetBonus("GODSHARD_SET","Bonus",0,0))/100)
 *  SummWinBonus is built from Summon[1] (defeated enemies, names starting "rift" EXCLUDED)
 *  plus OptLacc[319] endless wins cycling a 40-long table.
 *  PARTIAL: GODSHARD_SET needs the ACTIVE character's equipped gear (GetSetBonus counts set
 *  pieces in EquipmentOrder), which we do not evaluate -> omitted, ~5% low. Flagged. */
const CRYSTAL_COMB_IDX = 8, CRYSTAL_COMB_PCT = 30, WINZ_LANTERN_IDX = 32, WINZ_LANTERN_BASE = 25;
function summonWinBonus(s, unknowns) {
  const W = new Array(32).fill(0);
  for (const nm of (sel.summon(s)[1] ?? [])) {
    if (String(nm).indexOf("rift") === 0) continue;
    const i = SUMMON_ENEMY_NAMES.indexOf(nm);
    if (i < 0) continue;
    const slot = Math.round((SUMMON_ENEMY_SLOT[i] ?? 0) - 1);
    if (slot >= 0 && slot < 32) W[slot] += SUMMON_ENEMY_VAL[i] ?? 0;
  }
  const endless = Number((s.get("OptLacc") ?? [])[319] ?? 0);
  for (let g = 0; g < endless; g++) {
    const k = g % 40;
    const slot = Math.round(SUMMON_ENDLESS_SLOT[k] - 1);
    if (slot >= 0 && slot < 32) W[slot] += SUMMON_ENDLESS_VAL[k];
  }
  const ach = (c) => (sel.achieveReg(s)[c] === -1
    ? ([4, 27, 37, 44, 107, 109, 117].includes(c) ? 5 : c === 108 ? 10 : [99, 104, 112].includes(c) ? 20 : 1) : 0);
  const tier32 = sel.artifactTiers(s)[WINZ_LANTERN_IDX] ?? 0;
  const winz = tier32 ? WINZ_LANTERN_BASE * (tier32 >= 2 ? tier32 : 1) : 0;
  const tasksTerm = Math.min(10, Number(((s.get("TaskZZ2") ?? [])[5] ?? [])[4] ?? 0));
  const emperor = emperorBon(s, 8);
  // GODSHARD_SET is "}x_Higher_Winners_Bonuses_from_Summoning" (EquipmentSets[..][3][2] = 15).
  // The old note said this needed the active character's equipped gear. It does not: the set is
  // perma-unlocked in OptLacc[379], and GetSetBonus's first arm pays out on that alone.
  const godshard = setBonus(s, "GODSHARD_SET");
  if (!godshard.known) unknowns.push('GetSetBonus("GODSHARD_SET") [inside WinBonus] — ' + godshard.why);
  const bracket = winz + tasksTerm + ach(379) + ach(373) + W[31] + emperor + godshard.value;
  const pristine = ((sel.ninja(s)[107] ?? [])[CRYSTAL_COMB_IDX] ?? 0) === 1 ? CRYSTAL_COMB_PCT : 0;
  const gem11 = Number((s.get("GemItemsPurchased") ?? [])[11] ?? 0);
  const v = 3.5 * W[3] * (1 + pristine / 100) * (1 + 10 * gem11 / 100) * (1 + bracket / 100);
  return T('(1 + Summoning("WinBonus",3,0)/100)', "mul", 1 + v / 100, godshard.known ? "computed" : "partial",
    `SummWinBonus[3]=${W[3]} x3.5=${(3.5 * W[3]).toFixed(1)}; CrystalComb +${pristine}%; gem11=${gem11} -> +${10 * gem11}%; bracket=${bracket.toFixed(1)} (Winz ${winz} + tasks ${tasksTerm} + ach ${ach(379) + ach(373)} + WinBonus(31) ${W[31]} + Emperor ${emperor} + GODSHARD ${godshard.value}) => ${v.toFixed(1)}% = ${(1 + v / 100).toFixed(2)}x`);
}

/** Thingies("EmperorBon",b,0) = floor(acc[b] * (1 + (ArcaneUpgBonus(48) + ArcadeBonus(51))/100))
 *  acc built by cycling OptLacc[369] emperor wins through a 48-long slot table.
 *  Slot 8 = "}x_Summoning_Winner_Bonuses". */
function emperorBon(s, slot) {
  const wins = Number((s.get("OptLacc") ?? [])[369] ?? 0);
  const acc = new Array(12).fill(0);
  for (let g = 0; g < wins; g++) {
    const sl = EMPEROR_BON_CYCLE[g % 48];
    acc[sl] += EMPEROR_BON_VAL[sl] ?? 0;
  }
  const arcane48 = Number((sel.tesseract(s) ?? [])[48] ?? 0) * 1;   // ArcaneUpg[48][5]=1, id 48 is exempt
  const arcade51 = arcadeBonusOf(51, Number(sel.arcadeUpg(s)[51] ?? 0), false);
  return Math.floor(acc[slot] * (1 + (arcane48 + arcade51) / 100));
}

/** MainframeBonus(14) "Artifact Attraction". Two INDEPENDENT gates, both real:
 *   1. id 14 only EXISTS if the Jade Emporium "Artifact Matrix" is bought — the client appends
 *      NinjaInfo[25+e] onto LabMainBonus for e in 0..3 when Ninja EmporiumBonus(8+e)==1, and
 *      MainframeBonus returns 0 outright when `d >= LabMainBonus.length && 99 > d`.
 *      That upgrade only UNCOVERS the node; it does not connect it.
 *   2. the node must be CONNECTED in the lab: connected -> row[5]=50 (1.5x), else row[4]=0 (1.0x).
 *  Gate 1 is fully derivable: EmporiumBonus(b) = Ninja[102][9].indexOf(Number2Letter[b]) != -1.
 *  Gate 2 is lab-board connectivity (the client's _GenINFO[92][d]), which we do not simulate —
 *  it needs the node graph, per-node ranges that depend on other lab bonuses, and player
 *  positions. So connectivity is an explicit input; absent it, we do NOT guess. */
const JADE_ARTIFACT_MATRIX = 8, LAB_ARTIFACT_ATTRACTION = 14, LAB_ARTIFACT_ATTRACTION_PCT = 50;
export const jadeEmporiumOwned = (s, b) =>
  String(((sel.ninja(s)[102] ?? [])[9]) ?? "").indexOf(NUMBER_2_LETTER[b]) !== -1;
function labArtifactAttraction(s, labConnected, unknowns) {
  if (!jadeEmporiumOwned(s, JADE_ARTIFACT_MATRIX))
    return T("(1 + MainframeBonus(14)/100) Lab Artifact Attraction", "mul", 1, "computed",
      "Jade Emporium 'Artifact Matrix' not bought -> lab id 14 does not exist -> MainframeBonus(14)=0");
  const conn = labConnected(LAB_ARTIFACT_ATTRACTION);
  if (conn === null) {
    unknowns.push("Lab node connectivity for MainframeBonus(14) — the Artifact Matrix IS owned, but whether the node is CONNECTED is not simulated; pass labConnectedIds to resolve (x1.5 vs x1.0)");
    return T("(1 + MainframeBonus(14)/100) Lab Artifact Attraction", "mul", 1, "unknown",
      "Artifact Matrix owned; node connectivity unknown -> would be x1.5 when connected");
  }
  return T("(1 + MainframeBonus(14)/100) Lab Artifact Attraction", "mul",
    conn ? 1 + LAB_ARTIFACT_ATTRACTION_PCT / 100 : 1, "computed",
    conn ? "Artifact Matrix owned + node connected -> +50% = x1.5" : "Artifact Matrix owned but node NOT connected -> x1.0");
}

/**
 * Compute BoatArtiMulti for one boat.
 * @param {Save} s
 * @param {number} boatIdx  the client displays boat 0 for the account's "Artifact Find Chance".
 * @param {object} opts
 * @param {number|null} opts.activeChar  which character is sailing. ONLY consulted when the
 *        account's Infinite Star Signs window (RiftStuff("enabledStarSigns")) does not reach index
 *        61; when it does — the normal endgame case — Artifosho is character-independent and this
 *        is not needed. Omit it in the narrow case and the term is reported "unknown", not assumed.
 * @param {number|null} opts.tomePoints  the account's Tome score (the game prints it as "<N>_PTS"
 *        on the Tome page; internally GenInfo[84]). Drives Thingies("LoreEpiBon",3,0). Omit and
 *        that term is unknown-with-bounds rather than guessed.
 * @param {object} opts.override  per-term overrides, e.g. { 'AlchVials["6turtle"]': 379 } — for
 *        values a user reads off their own screen. Marked "user-supplied" in the breakdown.
 * @param {Set<number>|null} opts.companions  companion ids the account OWNS. Defaults to
 *        sel.companionsOwned(s) — the RTDB `_comp` doc unioned with OptLacc[606] token buys.
 *        Null (doc absent / fetch failed) leaves those terms honestly unknown; it must never
 *        be read as "owns nothing", since these are worth ~5x.
 * @param {number[]|null} opts.labConnectedIds  ids of lab bonus nodes that are CONNECTED.
 *        Lab-board connectivity is not simulated (it needs the node graph and ranges that
 *        themselves depend on other lab bonuses). Pass the ids to resolve MainframeBonus(10)
 *        (the vial doubler) and (14) (Artifact Attraction); omit and they stay unknown.
 * @returns {{value:number, terms:Array, unknown:Array, lowerBound:boolean}}
 */
export function boatArtiMulti(s, boatIdx = 0, opts = {}) {
  const {
    activeChar = null, override = {}, activeVote = null, labConnectedIds = null, tomePoints = null,
    companions = sel.companionsOwned(s),
  } = opts;
  const unknowns = [];
  const g109 = gridBonus(s, 109, companions), g106 = gridBonus(s, 106, companions);
  if (!g106.all.known) unknowns.push("ResearchStuff Grid_Bonus_Allmulti (scales EVERY Grid_Bonus, incl. 106/109) — its Companions(55)/Companions(0) inputs need the _comp RTDB doc; computed without them");
  const labConnected = (id) => (labConnectedIds === null ? null : labConnectedIds.includes(id));
  const nSigns = enabledStarSigns(s);
  const starSignNames = new Set(Object.keys(s.get("StarSg") ?? {}));
  const terms = [
    fauxory(s),
    captainArtifactFind(s, boatIdx),
    shinyPets(s),
    fractalIsland(s),
    arcade(s, companions, unknowns),
    tier6Captains(s),
    bribe(s),
    tuneOfArtifaction(s),
    stickerBonus(s, companions, unknowns),
    vaultArtifact(s),
    T('ResearchStuff("Grid_Bonus",109,0) Transcendent Artifacts', "add", g109.value, "computed",
      `Research[0][109]=${g109.lv}, occurrence ${g109.occ} (x${g109.occMult}), Allmulti ${g109.all.note} -> ${g109.value.toFixed(2)}%`),
    artifosho(s, activeChar, starSignNames, nSigns, unknowns),
    killroy(s),
    minehead(s, companions, unknowns),
    T('(1 + ResearchStuff("Grid_Bonus",106,0)/100) The Maw', "mul", 1 + g106.value / 100, "computed",
      `Research[0][106]=${g106.lv}, occurrence ${g106.occ}, Allmulti ${g106.all.note} -> ${g106.value.toFixed(2)}%`),
    turtleVial(s, labConnected, unknowns),
    purpleChestSlug(s),
    sushiRoG(s),
    summonWinBonus(s, unknowns),
    labArtifactAttraction(s, labConnected, unknowns),
    glowingVeil(s),
    monumentJustice(s),
    exoticClover(s),
    votingBonus(s, activeVote, unknowns),
    palette(s),
    spelunk(s),
    daveyJones(s, boatIdx),
    loreEpiBon(s, tomePoints, unknowns),
    ...companionTerms(s, companions, unknowns),
  ].map((t) => (t.key in override
    ? T(t.key, t.kind, override[t.key], "user-supplied", "supplied by caller, not derived from the save")
    : t));

  const pool = terms.filter((t) => t.kind === "add").reduce((a, t) => a + t.value, 0);
  const mul = terms.filter((t) => t.kind === "mul").reduce((a, t) => a * t.value, 1);
  const value = Math.max(1, (1 + pool / 100) * mul);

  return { value, additivePoolPct: pool, multiplicative: mul, terms, unknown: unknowns, lowerBound: unknowns.length > 0 };
}
