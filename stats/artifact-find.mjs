/* stats/artifact-find.mjs — recipe for the client's BoatArtiMulti ("Artifact Find Chance").
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
 * VALIDATION CAMPAIGN (2026-07-17, against live in-game displays; reference total 2183.50M
 * = 2.18350e9 for boat 0). EVERY significant term now matches the game's own sub-display:
 *     Fauxory +1026 ("1.03k%") · arcade 151.53 · tier-6 captains 6 (+150) · Tune +220
 *   · sticker +278.5 ("279", crown count FIXED to live Research[11].length=53; the 279 read
 *     also proves superbit 62 is NOT owned on this account) · vault +414.7 ("415")
 *   · shinies 46 · Killroy 1.174 · Button 1.531 ("1.53") · The Maw 2.2 · vial 4.786 ("379%",
 *     incl. the solver-proven lab doubler) · Purple Slug 1.5 · WinBonus 35.079 ("35.08" —
 *     became exact when EmperorBon's inner ArcadeBonus(51) got the reindeer doubling)
 *   · Monument 18.57 · palette 3.732 ("3.73") · spelunk 5.60 ("5.6") · Tome/LoreEpi 2.802
 *     ("2.80" at the user's exact Tome score 44,931) · voting exact via server vars
 *   · per-boat structure PROVEN by boat displays: our boat-2/boat-0 ratio 1.273 vs observed
 *     2.8B/2.19B (and that ratio test proves the residual below is NOT in the additive pool).
 *
 * THE RESIDUAL: in-game total / computed = x1.52174 (2.18350e9 / 1.43487e9). It is a SHARED
 * MULTIPLICATIVE factor (boat ratios exclude the pool and all per-boat terms), it has NO
 * sub-display among everything read above, and no single term's verbatim formula can produce
 * it (best composite fit: ~x1.500 flat x ~1.015). Checked and excluded: duplicate dispatcher
 * definitions (all single), the LabMFbonuses cache (stores plain values; only nodes 9/11/114
 * post-adjusted), slug stacking (Stuff2 is a single 0/1 flag), StarSigns double-pass (skipped
 * when Infinite Signs active), the display call sites (plain BoatArtiMulti). Deliberately NOT
 * tuned away — the per-term breakdown is screen-true, which is what the app needs; the
 * absolute total is a documented lower bound. If a changelog ever mentions a flat ~1.5x
 * artifact bonus with no UI, that is the missing piece.
 *
 * The per-term evaluators live in bonuses/ (one module per client dispatcher); this file is
 * only the transcription of the expression above. Unknowable terms (companions without the
 * _comp doc, lab connectivity, Tome score, active vote) follow the engine's honesty contract:
 * neutral element + lowerBound flag, never a guess.
 */

import { sel } from "../savemap.mjs";
import { T, term, evaluate } from "./engine.mjs";
import { NUMBER_2_LETTER, COMPANION_VAL } from "../gamedata.mjs";
import { artifactBonus, captainStat, daveyJonesBonus } from "../bonuses/sailing.mjs";
import { shinyBonus } from "../bonuses/breeding.mjs";
import { arcadeBonus } from "../bonuses/arcade.mjs";
import { bribeBonus, killroyBonus, fractalIslandBonus, purpleChestSlugsOwned } from "../bonuses/misc.mjs";
import { bUpg, monumentJusticeArtifact } from "../bonuses/holes.mjs";
import { buttonBonus } from "../bonuses/minehead.mjs";
import { stickerBonus, exoticBonus } from "../bonuses/farming.mjs";
import { gridBonus } from "../bonuses/research.mjs";
import { vaultUpgBonus, winBonus, votingBonus } from "../bonuses/summoning.mjs";
import { sushiRoG } from "../bonuses/sushi.mjs";
import { starSignActive, SIGN_FLAT, signIsCharDependent } from "../bonuses/starsigns.mjs";
import { companion } from "../bonuses/companions.mjs";
import { vialBonus } from "../bonuses/alchemy.mjs";
import { mainframeBonus } from "../bonuses/lab.mjs";
import { loreEpiBon } from "../bonuses/thingies.mjs";
import { pristineBon } from "../bonuses/ninja.mjs";
import { paletteBonus, superBitType } from "../bonuses/gaming.mjs";
import { getTomePoints } from "../bonuses/tome.mjs";

const FRACTAL_ARTIFACT_IDX = 3, SPELUNK_BIT = 26;
const FRACTAL_ARTIFACT_PCT = 20, ARTIFOSHO = 61;
const COMPANION_ARTI = 43, COMPANION_SAIL = 154;

/** Player-facing display metadata per term: what it is, WHERE to find it in-game, and what
 *  makes it bigger. The Stat Explorer shows these up front; the client expression and the
 *  raw derivation live behind the "internals" toggle. */
export const DISPLAY = {
  fauxory: { label: "Fauxory Tusk (artifact)", where: "Sailing → Artifacts → Fauxory Tusk",
    how: "+1% per Sailing level, ×6 at Transcendent tier. Improve: level Sailing." },
  captain: { label: "Boat captains (Artifact Find)", where: "Sailing → boats & captains",
    how: "The headline number is boat 1's (the game's baseline, +0% here). Every boat's own odds add its captain's AF rolls — per-boat breakdown below, best first." },
  shinyPets: { label: "Shiny pets (Artifact Find)", where: "Breeding → shiny pets with 'Higher Artifact Find Chance'",
    how: "+2% per shiny level on those pets. Improve: keep them levelling in the nest." },
  fractalIsland: { label: "Fractal Isle milestone", where: "W5 → Fractal Isle (Random Events)", flag: true,
    how: "Flat +20% at 2,500 island points (you're at ~half)." },
  arcade: { label: "Arcade upgrades", where: "W2 Arcade → Gold Ball Shop (two artifact rows)",
    how: "Both rows decay-scale with level; ×2 when maxed, ×2 more with the Spirit Reindeer pet." },
  tier6Captains: { label: "Tier 6 captains", where: "Sailing → captain roster",
    how: "+25% per tier-6 captain (first 30 slots counted)." },
  bribe: { label: "Bribe: Artifact Pilfering", where: "W1 Bribes", flag: true,
    how: "Flat +20% once bought." },
  tuneOfArtifaction: { label: "Tune of Artifaction", where: "The Cavern → Engineer → Blueprints",
    how: "+10% per power of 10 Natural Notes." },
  sticker: { label: "Farming sticker (artifact)", where: "W6 Farming → Stickers",
    how: "Sticker level ×15%, multiplied by Boony Crowns (King Rat crowns) and an event-shop item." },
  vault: { label: "Upgrade Vault: Artifact Find", where: "Upgrade Vault (W1 town)",
    how: "+1% per level, multiplied by Vault Mastery III." },
  gridTranscendent: { label: "Research: Transcendent Artifacts", where: "W7 Research grid",
    how: "+25% per node level × occurrence slot × research all-multi." },
  artifosho: { label: "Star sign: Artifosho", where: "Telescope star signs", flag: true,
    how: "×1.15 — permanently active via Infinite Star Signs." },
  companionSail: { label: "Pet: Glimbo", where: "Pets (followers)", flag: true,
    how: "×2 artifact find while owned (hard-capped)." },
  killroy: { label: "Killroy skull shop", where: "W2 Killroy → permanent upgrades",
    how: "Soft-capped toward ×2 as you buy the artifact upgrade repeatedly." },
  minehead: { label: "The Button", where: "W7 Minehead → The Button",
    how: "Presses landing on the artifact slot; boosted by Better Button research and the Mantaray pet." },
  gridMaw: { label: "Research: The Maw", where: "W7 Research grid",
    how: "×(1 + 25% per node level × all-multi)." },
  turtleVial: { label: "Vial: Turtle Tisane", where: "Alchemy → Vials",
    how: "4% per vial level; ×2 from the lab's Chemistry Set node; scaled by maxed-vial count (Rift 35) and vault." },
  purpleSlug: { label: "Purple Chest Slug", where: "Event shop collectible", flag: true,
    how: "Flat ×1.5 while owned." },
  sushiRoG: { label: "Sushi bar set bonus", where: "W7 Sushi Station", flag: true,
    how: "×1.3 at 8+ unique sushi made (threshold, done once)." },
  summonWin: { label: "Summoning winner bonus", where: "W6 Summoning → victories",
    how: "Grows with career wins & endless rounds; multiplied by Crystal Comb charm, gem shop and the Winz Lantern." },
  daveyJones: { label: "Davey Jones", where: "Gem shop (Davey Jones Training) + W7 Research (Undead Battalion)",
    how: "Three sub-sources below — gem purchases and the legend talent share one additive bracket; the Battalion ×3 needs the research node + boat level 400+." },
  labAttraction: { label: "Lab: Artifact Attraction", where: "Lab mainframe (needs Jade Emporium 'Artifact Matrix')", flag: true,
    how: "×1.5 while the node is connected." },
  tome: { label: "Tome: artifact multi", where: "The Tome (W4)",
    how: "Scales with your Tome score; multiplied by the Grey Tome Book grimoire upgrade and the Troll armor set." },
  glowingVeil: { label: "Pristine charm: Glowing Veil", where: "W6 Sneaking → Pristine charms", flag: true,
    how: "Flat ×1.4 while owned — you don't have this one yet!" },
  voting: { label: "Weekly ballot", where: "W2 Town Ballot", flag: true,
    how: "×1.31+ only in weeks when the artifact vote wins — nothing to push, just patience." },
  companionArti: { label: "Pet: Litterfish", where: "Pets (followers)", flag: true,
    how: "×1.25 artifact find while owned." },
  monumentJustice: { label: "Monument of Justice", where: "The Cavern → Justice Monument",
    how: "Scales with monument level; boosted by Monumental Vibes majik and the fountain." },
  exoticClover: { label: "Exotic: 5-Leaf Clover", where: "W6 Farming → Exotic Market",
    how: "Saturating toward +30%." },
  palette: { label: "Gaming palette: Bright Cyan", where: "W5 Gaming → Palette",
    how: "Colour level curve (cap ×4 base) × Picasso legend talent × lore book 9." },
  spelunk: { label: "Spelunking discoveries", where: "Spelunking (needs the gaming superbit)",
    how: "×1.02 per discovered material." },
};

/** A companion-driven multiplier term; unknown ownership -> honest unknown, never "not owned". */
function companionTerm(ctx, id, termId, key, fn) {
  const c = companion(ctx, id);
  if (c.owned === null) {
    ctx.unknown(`Companions(${id}) — no _comp RTDB doc on this snapshot; cannot tell`);
    return T(termId, key, "mul", 1, "unknown", `ownership unknown -> would be x${fn(COMPANION_VAL[id])} if owned`);
  }
  return T(termId, key, "mul", fn(c.value), "computed",
    c.owned ? `companion ${id} owned, CompanionDB[${id}][2]=${c.value} -> x${fn(c.value)}` : `companion ${id} not owned -> x1`);
}

export const artifactFind = {
  name: "artifactFind",
  label: "Artifact Find Chance",
  display: DISPLAY,
  /** Artifosho is the only active-char-dependent input, and only until the Infinite Star Signs
   *  window reaches index 61 — the normal endgame state, where this recipe is char-independent. */
  activeCharSensitive: (s) => signIsCharDependent(s, ARTIFOSHO),
  combine: ({ pool, mul }) => Math.max(1, (1 + pool / 100) * mul),

  terms(ctx) {
    /* Tome score: user-supplied value wins (exact); otherwise the natively computed FLOOR
     * from bonuses/tome.mjs — LoreEpiBon then reports partial instead of unknown. */
    if (ctx.tomePoints == null) {
      const tp = getTomePoints(ctx);
      ctx.tomePoints = tp.value;
      ctx.tomePointsFloor = !tp.exact;
    }
    const boatIdx = ctx.args.boatIdx ?? 0;
    const boat = sel.boats(ctx.s)[boatIdx];
    const t6 = sel.tier6CaptainCount(ctx.s);
    const arc32 = arcadeBonus(ctx, 32), arc66 = arcadeBonus(ctx, 66);
    const fractal = fractalIslandBonus(ctx, FRACTAL_ARTIFACT_IDX);
    const sign = starSignActive(ctx, ARTIFOSHO);
    const kill = killroyBonus(ctx);
    const mine = buttonBonus(ctx, 3);
    const g109 = gridBonus(ctx, 109), g106 = gridBonus(ctx, 106);
    const vial = vialBonus(ctx, 74);
    const slug = purpleChestSlugsOwned(ctx);
    const sushi = sushiRoG(ctx, 7);
    const win = winBonus(ctx, 3);
    const lab14 = mainframeBonus(ctx, 14);
    if (lab14.value === null)
      ctx.unknown("Lab node connectivity for MainframeBonus(14) — the Artifact Matrix IS owned, but whether the node is CONNECTED is not simulated; pass labConnectedIds to resolve (x1.5 vs x1.0)");
    const tome = loreEpiBon(ctx, 3);
    const veil = pristineBon(ctx, 2);
    const vote = votingBonus(ctx, 20);
    const justice = monumentJusticeArtifact(ctx);
    const clover = exoticBonus(ctx, 45);
    const pal = paletteBonus(ctx, 5);
    const spelunkN = sel.spelunkMaterials(ctx.s).length;
    const spelunkBit = superBitType(ctx, SPELUNK_BIT);

    return [
      term("fauxory", 'Sailing("ArtifactBonus",3,0) Fauxory Tusk', "add", artifactBonus(ctx, 3)),
      (() => {
        /* The account stat is boat 1's number (the game's own baseline). Each boat's REAL odds
         * add its captain's AF rolls — so break down every boat that has one, best first. */
        const boats = sel.boats(ctx.s);
        const perBoat = boats.map((bt, i) => ({ i, af: captainStat(ctx, bt?.[0] ?? -1, 3).value }))
          .filter((x) => x.af > 0).sort((a, b) => b.af - a.af);
        const base = captainStat(ctx, boat?.[0] ?? -1, 3);
        return T("captain", "CaptBonusCalc(3, Boats[b][0])", "add", base.value, "computed",
          base.note + (perBoat.length ? `; best AF boat: Boat ${perBoat[0].i + 1} (+${perBoat[0].af}%)` : "; no boat carries an AF captain"),
          perBoat.slice(0, 8).map((x, k) => ({
            label: `Boat ${x.i + 1}${k === 0 ? " — best" : ""}`, value: x.af, valueText: `+${x.af}%`,
            where: `Sailing → Boat ${x.i + 1}`,
            note: k === 0 ? "the strongest artifact-find captain in the fleet" : "",
          })));
      })(),
      term("shinyPets", 'Breeding("ShinyBonusS","Nah",21,-1) shiny pets', "add", shinyBonus(ctx, 21)),
      T("fractalIsland", '20*RandomEvent("FractalIslandBonus",3,999)', "add",
        FRACTAL_ARTIFACT_PCT * fractal.value, "computed",
        fractal.note + (fractal.value ? "" : " (this tier not reached -> legitimately 0)")),
      T("arcade", "ArcadeBonus(32)+ArcadeBonus(66)", "add", arc32.value + arc66.value, arc32.status,
        `${arc32.note} + ${arc66.note}`,
        [{ label: "ArcadeBonus(32)", value: arc32.value, note: arc32.note },
         { label: "ArcadeBonus(66)", value: arc66.value, note: arc66.note }]),
      T("tier6Captains", "25*min(30, NONdummies[60]) tier-6 captains", "add",
        25 * Math.min(30, t6), "computed", `${t6} tier-6 captains (client caps its scan at the first 30)`),
      term("bribe", 'GetBribeBonus("34") Artifact Pilfering', "add", bribeBonus(ctx, 34)),
      term("tuneOfArtifaction", 'Holes("B_UPG",55,0) Tune of Artifaction', "add", bUpg(ctx, 55)),
      term("sticker", 'FarmingStuffs("StickerBonus",2,0)', "add", stickerBonus(ctx, 2)),
      T("vault", 'Summoning("VaultUpgBonus",63,0)', "add", vaultUpgBonus(ctx, 63), "computed",
        `UpgVault[63]=${sel.upgVault(ctx.s)[63]} x coeff x mastery III (UpgVault[89]=${sel.upgVault(ctx.s)[89]})`),
      T("gridTranscendent", 'ResearchStuff("Grid_Bonus",109,0) Transcendent Artifacts', "add",
        g109.value, g109.status, g109.note, g109.parts),

      T("artifosho", "(1 + StarSigns[61]/100) Artifosho", "mul",
        sign.active === null ? 1 : (sign.active ? 1 + SIGN_FLAT[ARTIFOSHO] / 100 : 1),
        sign.active === null ? "unknown" : "computed", sign.why),
      companionTerm(ctx, COMPANION_SAIL, "companionSail", "max(1, min(2, 1+2*Companions(154)))",
        (v) => Math.max(1, Math.min(2, 1 + 2 * v))),
      T("killroy", "max(1, RandomEvent(KillroyBonuses,0,0))", "mul", Math.max(1, kill.value), "computed", kill.note),
      T("minehead", "(1 + Minehead(Button_Bonuses,3,0)/100)", "mul", 1 + mine.value / 100, mine.status, mine.note),
      T("gridMaw", '(1 + ResearchStuff("Grid_Bonus",106,0)/100) The Maw', "mul",
        1 + g106.value / 100, g106.status, g106.note, g106.parts),
      T("turtleVial", '(1 + AlchVials["6turtle"]/100) Turtle Tisane', "mul", 1 + vial.value / 100, vial.status, vial.note),
      T("purpleSlug", 'max(1, 1.5^Stuff2("PurpleChestSlugsOwned",0,0))', "mul",
        Math.max(1, Math.pow(1.5, slug.value)), "computed", slug.note + ` -> 1.5^${slug.value}`),
      T("sushiRoG", '(1 + SushiStuff("RoG_BonusQTY",7,0)/100)', "mul", 1 + sushi.value / 100, "computed", sushi.note),
      T("summonWin", '(1 + Summoning("WinBonus",3,0)/100)', "mul", 1 + win.value / 100, win.status,
        win.note + ` => ${win.value.toFixed(1)}%`, win.parts),
      term("daveyJones", "Sailing(DaveyJonesBonus, b, 0)", "mul", daveyJonesBonus(ctx, boatIdx)),
      T("labAttraction", "(1 + MainframeBonus(14)/100) Lab Artifact Attraction", "mul",
        lab14.value === null ? 1 : 1 + lab14.value / 100, lab14.status,
        lab14.value === null ? "Artifact Matrix owned; node connectivity unknown -> would be x1.5 when connected" : lab14.note),
      T("tome", '(1 + Thingies("LoreEpiBon",3,0)/100)', "mul", 1 + tome.value / 100, tome.status ?? "computed", tome.note),
      T("glowingVeil", '(1 + Ninja("PristineBon",2,0)/100) Glowing Veil', "mul", 1 + veil.value / 100, "computed", veil.note),
      T("voting", '(1 + Summoning("VotingBonusz",20,0)/100)', "mul", 1 + vote.value / 100, vote.status ?? "computed", vote.note),
      companionTerm(ctx, COMPANION_ARTI, "companionArti", "(1 + Companions(43))", (v) => 1 + v),
      T("monumentJustice", '(1 + Holes("MonumentROGbonuses",1,2)/100) Monument of Justice', "mul",
        1 + justice.value / 100, "computed", justice.note, justice.parts),
      T("exoticClover", '(1 + FarmingStuffs("ExoticBonusQTY",45,0)/100)', "mul", 1 + clover.value / 100, "computed", clover.note),
      T("palette", "(1 + GamingStatType(PaletteBonus,5,0)/100)", "mul", 1 + pal.value / 100, pal.status, pal.note),
      T("spelunk", "max(1, 1.02^Spelunk[6].length * SuperBitType(26,0))", "mul",
        Math.max(1, Math.pow(1.02, spelunkN) * (spelunkBit ?? 0)), "computed",
        `${spelunkN} materials -> 1.02^${spelunkN}=${Math.pow(1.02, spelunkN).toFixed(3)}; ` +
        `super bit 26 ("${NUMBER_2_LETTER[SPELUNK_BIT]}") ${spelunkBit ? "owned" : "NOT owned -> term gated to 1"}`),
    ];
  },
};

/** Compatibility wrapper with the old artifactchance.mjs signature. */
export function boatArtiMulti(s, boatIdx = 0, opts = {}) {
  return evaluate(artifactFind, s, { ...opts, args: { boatIdx } });
}
