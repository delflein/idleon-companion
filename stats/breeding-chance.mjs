/* stats/breeding-chance.mjs — recipe `breedingChance`, "Breeding New-Species Chance (account multi)".
 *
 * THE EXPRESSION, verbatim from p._customBlock_Breeding "TotalBreedChance", N.js:12478-86
 * (transcribed in gamedata-w4-breeding.mjs §4). The full per-pet chance is:
 *
 *   TotalBreedChance(e,f) = ACCOUNT_MULTI × BaseBreedChance(e,f)
 *                           × 1stMulti(e,f)×2ndMulti×3rdMulti×4thMulti×5thMulti
 * where the ACCOUNT-WIDE multiplier (identical for every pet) that this recipe models is:
 *
 *   ACCOUNT_MULTI = (1 + 10*GemItemsPurchased[119]/100)
 *                 * (1 + (AlchVials.NewPet + AlchBubbles.NewPetRift*Rift[0])/100)
 *                 * (1 + StampBonusOfTypeX("NewPet")/100)
 *                 * (1 + MealBonus("Npet")/100)
 *                 * Math.pow(Math.max(1, PetUpgBONUS(9)), TOTALKITCHEN/100)
 *
 * The per-pet base + the five per-species multiplier TIERS are surfaced on the entity where the
 * save holds them; 4thMulti's exact shape is UNVERIFIED (gamedata note) so it is deliberately not
 * modeled here. This recipe's VALUE is the account-wide breeding-chance multiplier — the shared
 * lever every pet's odds ride on. Each bracket is its own (1+x/100) factor, so all terms are "mul"
 * and the default combine yields the product. */

import { sel } from "../savemap.mjs";
import { T } from "./engine.mjs";
import { vialBonusByKey } from "../bonuses/alchemy.mjs";
import { alchBubble } from "../bonuses/bubbles.mjs";
import { stampBonusOfType } from "../bonuses/stamps.mjs";
import { mealBonus } from "../bonuses/meals.mjs";
import { petUpgBonus } from "../bonuses/breeding.mjs";
import { totalKitchenLadles } from "../bonuses/cooking.mjs";

const num = (x) => Number(x) || 0;
const safe = (fn, d = null) => { try { const r = fn(); return r == null ? d : r; } catch { return d; } };

export const DISPLAY = {
  gem119: { label: "Gem shop: New Pet Chance", where: "Gem shop", how: "10% per GemItemsPurchased[119]." },
  vialBubRift: { label: "Vial + Bubble×Rift: New Pet", where: "Alchemy vials/bubbles", how: "AlchVials.NewPet + AlchBubbles.NewPetRift × Rift level." },
  stampNewPet: { label: "Stamp: New Pet Chance", where: "Stamps", how: 'StampBonusOfTypeX("NewPet").' },
  mealNpet: { label: "Meal: New Mob Breed Odds", where: "W4 Dinner Table", how: 'MealBonus("Npet") — several meals feed this.' },
  kitchenPow: { label: "Overwhelmed Golden Egg ^ kitchen ladles", where: "W4 Breeding upg 9 + kitchens", how: "pow(PetUpgBONUS(9), TOTALKITCHEN/100)." },
};

export const breedingChance = {
  name: "breedingChance",
  label: "Breeding New-Species Chance (account multi)",
  display: DISPLAY,
  terms(ctx) {
    const gem119 = num(sel.gemItemsPurchased(ctx.s)[119]);
    const t1 = T("gem119", "GemItemsPurchased[119]", "mul", 1 + 10 * gem119 / 100, "computed", `${DISPLAY.gem119.label}: ${gem119} purchases`);

    const vial = safe(() => vialBonusByKey(ctx, "NewPet"));
    const bub = safe(() => alchBubble(ctx, "NewPetRift"));
    const rift = sel.riftLevel(ctx.s);
    const vbVal = (vial ? num(vial.value) : 0) + (bub ? num(bub.value) : 0) * rift;
    let vbStatus = "computed";
    if (!vial) { ctx.unknown("breedingChance: AlchVials.NewPet unread -> lower bound"); vbStatus = "partial"; }
    if (!bub) { ctx.unknown("breedingChance: AlchBubbles.NewPetRift unread -> lower bound"); vbStatus = "partial"; }
    const t2 = T("vialBubRift", "AlchVials.NewPet + AlchBubbles.NewPetRift*Rift[0]", "mul", 1 + vbVal / 100, vbStatus, `${DISPLAY.vialBubRift.label}: +${vbVal.toFixed(1)}% (rift ${rift})`);

    const stamp = safe(() => stampBonusOfType(ctx, "NewPet"));
    let stampStatus = "computed";
    if (!stamp) { ctx.unknown("breedingChance: StampBonusOfTypeX(NewPet) unread -> lower bound"); stampStatus = "partial"; }
    const stampV = stamp ? num(stamp.value) : 0;
    const t3 = T("stampNewPet", 'StampBonusOfTypeX("NewPet")', "mul", 1 + stampV / 100, stampStatus, `${DISPLAY.stampNewPet.label}: +${stampV}%`);

    const meal = safe(() => mealBonus(ctx, "Npet"));
    const mealV = meal ? num(meal.value) : 0;
    if (!meal) ctx.unknown('breedingChance: MealBonus("Npet") unread -> lower bound');
    const t4 = T("mealNpet", 'MealBonus("Npet")', "mul", 1 + mealV / 100, meal?.status ?? "unknown", `${DISPLAY.mealNpet.label}: +${mealV.toFixed(1)}%`, meal?.parts);

    const upg9 = Math.max(1, petUpgBonus(ctx, 9));
    const kitchen = totalKitchenLadles(ctx);
    const t5 = T("kitchenPow", "pow(max(1,PetUpgBONUS(9)), TOTALKITCHEN/100)", "mul", Math.pow(upg9, kitchen.value / 100), "computed",
      `${DISPLAY.kitchenPow.label}: pow(${upg9.toFixed(3)}, ${kitchen.value}/100) over ${kitchen.kitchensCounted} kitchens`);

    return [t1, t2, t3, t4, t5];
  },
};
