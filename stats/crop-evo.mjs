/* stats/crop-evo.mjs — recipe for the client's NextCropChance MULTIPLIER STACK ("Crop
 * Evolution Chance", the number behind the in-game Crop Info tool).
 *
 * THE EXPRESSION: _customBlock_FarmingStuffs("NextCropChance", 99, 0), N.js:17946-17951 —
 * read whole and transcribed into bonuses/farming.mjs evoStackParts(). ~29 multiplicative
 * sources; the b==99 display variant uses PLOT 0's land rank for the per-rank term (mirrored
 * here for screen parity). A PLOT's actual chance = this stack x 0.30 (the client initializes
 * the base to SeedInfo[0][5] for EVERY tier) x decay^evoProgress (Glassy 0.05, Medal 0.003) —
 * the farming page applies that tail per plot via nextCropChancePlot().
 *
 * All terms are multiplicative FACTORS (kind "mul"); the additive pool stays empty, so the
 * engine's default combine yields the plain product. Honesty: fragments that cannot be derived
 * contribute their neutral factor 1 and flag ctx.unknown (vote, star sign without activeChar,
 * superbits >= 53, meal multis, lab connectivity...). */

import { T } from "./engine.mjs";
import { evoStackParts } from "../bonuses/farming.mjs";
import { signIsCharDependent } from "../bonuses/starsigns.mjs";
import { chipBonusesOf } from "../bonuses/chips.mjs";
import { sel } from "../savemap.mjs";

const DISPLAY = {
  bio: { label: "Biology Boost (Day Market)", where: "W6 Farming → Day Market" },
  win10: { label: "Summoning winner bonus (Crop EVO)", where: "W6 Summoning → endless wins" },
  lamp: { label: "Cavern Lamp wishes (W6 Majigers)", where: "W5 The Cavern → Lamp" },
  sushi35: { label: "Sushi: 2x farming evo", where: "W7 Sushi Bar (Rift of Gods)" },
  bubW10: { label: "Crop Chapter bubble (× Tome stacks)", where: "Alchemy W-cauldron + Tome points" },
  bubY6: { label: "Cropius Mapper bubble (× W6 maps)", where: "Alchemy Y-cauldron" },
  vial66: { label: "Flavorgil vial", where: "Alchemy vials" },
  cardW7b5: { label: "W7 Farming EVO card", where: "W7 card (50%/star)" },
  mealEvo: { label: "Bill Jack Pep meal", where: "W4 Dinner Table" },
  vault78: { label: "Croppius Evolvius (Vault)", where: "Upgrade Vault" },
  monument: { label: "Wisdom Monument (cavern)", where: "W5 The Cavern → Wisdom Monument" },
  stamp: { label: "Crop Evo Stamp", where: "Stamps tab 2" },
  grim14: { label: "Sacrifice of Harvest (Grimoire)", where: "Death Bringer Grimoire" },
  mealSumm: { label: "Nyanborgir meal (× Summoning LV)", where: "W4 Dinner Table + Summoning level" },
  ach355: { label: "Lil' Overgrowth achievement", where: "W6 achievement (OG 32x)" },
  killroy: { label: "Killroy evo upgrade", where: "Killroy shop" },
  evoGmo: { label: "Evolution GMO (compounds per crop ≥200)", where: "W6 Farming → Night Market" },
  rift: { label: "Skill Mastery: Farming (Rift)", where: "Rift — 200+ total farming levels" },
  sign65: { label: "Cropiovo Minor (× Farming LV)", where: "Star sign 65 (+ Silkrode Nanochip)" },
  lrt0: { label: "Evolution Mega/Super/Ultraboost", where: "W6 Farming → Land Rank Database" },
  talent205: { label: "Mass Irrigation (Death Bringer)", where: "Death Bringer talent" },
  plotRank: { label: "Evolution Boost × plot rank + weekly vote", where: "Land Rank Database + Ballot" },
  sprout0: { label: "Sproutluck I (exotic)", where: "W6 Farming → Exotic Market" },
  button5: { label: "The Button (Minehead)", where: "W7 Minehead button presses" },
  sprout1: { label: "Sproutluck II (exotic)", where: "W6 Farming → Exotic Market" },
  sticker4: { label: "Sporrious Stalk stickers", where: "Megacrop stickers" },
  sprout2: { label: "Sproutluck III (exotic)", where: "W6 Farming → Exotic Market" },
  sprout3: { label: "Sproutluck IV (exotic)", where: "W6 Farming → Exotic Market" },
  geneology: { label: "Geneology I–V (× Farming LV past 50/100/…)", where: "W6 Farming → Exotic Market" },
};

export const cropEvo = {
  name: "cropEvo",
  label: "Crop Evolution Chance",
  display: DISPLAY,
  terms(ctx) {
    const rank0 = Number((sel.farmRanks(ctx.s)[0] ?? [])[0] ?? 0);
    return evoStackParts(ctx, rank0).map((p) =>
      T(p.id, p.key, "mul", p.value, p.frag.status ?? "computed", p.frag.note ?? ""));
  },
  /* Sensitive only when the Cropiovo sign itself is char-dependent, or some character could
   * double it with a star chip (Silkrode Nanochip) while having the sign equipped. */
  activeCharSensitive(s) {
    if (signIsCharDependent(s, 65)) return true;
    return s.charIdxs.some((i) => chipBonusesOf(s, i, "star") > 0 && sel.hasStarSign(s, i, 65));
  },
};
