/* bonuses/stamps.mjs — StampBonusOfTypeX(type): stamp bonuses summed by type, over ANY effect
 * type in STAMP_INFO. Now a fully generic path: the growth curve is the shared 14-case
 * ArbitraryCode5Inputs evaluator (bonuses/util.mjs, transcribed verbatim in gamedata-stamps.mjs),
 * so a recipe can ask for any `stat` code without per-type curve verification.
 *
 * ── Client, x._customBlock_StampBonusOfTypeX(type) (N.js:~6030) ──
 * The type's tab DRI is whichever CustomLists.StampBonusIndex[DRI] list contains it. For each
 * stamp slot g in that tab whose item def desc_line1 CONTAINS the type and whose
 * StampLevel[DRI][g] > 0:
 *     total += exalt * ArbitraryCode5Inputs(func, x1, x2, floor(StampOverLevel(id)))
 *   exalt   = Compass[4] contains (Number2Letter[DRI] + g) ? 1 + Windwalker("StampDoubler")/100 : 1
 *   item    = ItemDefinitionsGET["Stamp"+Number2Letter[DRI+1].toUpperCase()+(g+1)]  (i.e. slot g
 *             reads the item KEYED (g+1) — see StampDetails N.js:6057, which resolves id=DRI*1000+g
 *             through "Stamp"+letter+(g+1)).
 *
 * ── SAVE-SLOT MAPPING (load-bearing; verified against N.js this pass) ──
 * gamedata-stamps.mjs STAMP_INFO rows carry `indexInTab`, but that value is the item KEY NUMBER
 * (= slot + 1), NOT the StampLevel slot. StampDetails proves the client reads StampLevel[tab][s]
 * with item key "Stamp{L}{s+1}", and STAMP_INFO's row for that item sits at indexInTab = s+1
 * (checked by matching STAMP_INFO.stat against every N.js item Stamp{L}{s+1}, slots 0-49, all
 * three tabs: 110 matches / 0 mismatches at offset +1; 0/112 at offset 0). Therefore:
 *
 *     save slot = STAMP_INFO.indexInTab - 1
 *
 * (This corrects a latent off-by-one in the previous hand-built STAMP_ROWS: DropRate was right at
 * slot 36 [item StampA37/Golden_Sixes], but CropEvo was slot 47 when the true slot is 46 [item
 * StampB47/Crop_Evo_Stamp, ID 1047]; the generic path now reads the correct slot.)
 *
 * ── OVER-LEVEL DEFICIT, k._customBlock_StampOverLevel(id) (N.js:6058) ── applies ONLY when
 *   desc[10] (skillIndex) > 0  AND  Ninja("EmporiumBonus",5,0) == 0 (Jade Emporium upg 5 unowned)
 *   AND reqItemMultiplicationLevel (desc[4]) > 1:
 *     stampLv = level * (200 / (20*req));  dc = 3;
 *     overlevel = stampLv > dc
 *       ? (dc + (stampLv - dc) * pow(Lv0[skillIndex]/(stampLv - dc), 0.75)) * (20*req/200)
 *       : stampLv;
 *     effectiveLevel = min(overlevel, level);
 *   else effectiveLevel = level.
 * Lv0[skillIndex] is the ACTIVE character's skill level, so a stamp under an active deficit is
 * per-character; when the account owns Jade Emporium upg 5 the deficit is disabled and the whole
 * type is clean account-wide.
 *
 * ── Windwalker("StampDoubler") (N.js Windwalker branch) ── the exalted-stamp multiplier:
 *   100 + AtomCollider("AtomBonuses",12,0) + Ninja("PristineBon",20,0) + Windwalker("CompassBonus",76,0)
 *       + GetSetBonus("EMPEROR_SET","Bonus",0,0) + 20*Summoning("EventShopOwned",18,0)
 *       + GamingStatType("PaletteBonus",23,0) + FarmingStuffs("ExoticBonusQTY",49,0)
 *       + round(Spelunk[4][3]) + Thingies("LegendPTS_bonus",36,0) + SushiStuff("RoG_BonusQTY",17,0)
 * Each arm is computed when its evaluator resolves; arms whose id is not table-verified (or whose
 * evaluator we don't yet have — AtomBonuses(12), CompassBonus(76)) are listed in `missing` and
 * contribute their neutral 0, so the doubler is an honest LOWER BOUND and exalted stamps report
 * partial. */

import { sel } from "../savemap.mjs";
import { NUMBER_2_LETTER } from "../gamedata.mjs";
import { STAMP_INFO } from "../gamedata-stamps.mjs";
import { arbitraryCode5 } from "./util.mjs";
import { eventShopOwned, setBonus } from "./misc.mjs";
import { legendPts } from "./thingies.mjs";
import { paletteBonus } from "./gaming.mjs";
import { pristineBon, jadeEmporiumOwned } from "./ninja.mjs";
import { exoticBonus } from "./farming.mjs";
import { sushiRoG } from "./sushi.mjs";

/** STAMP_INFO indexed by effect `stat`, each row carrying its true save (tab, slot). */
const TAB_OF = { combat: 0, skills: 1, misc: 2 };
const BY_STAT = {};
for (const r of STAMP_INFO) {
  const slot = r.indexInTab - 1;          // indexInTab = item key number = slot + 1
  if (slot < 0) continue;                 // idx-0 rows map to slot -1 (extraction artifact)
  (BY_STAT[r.stat] ??= []).push({ ...r, tab: TAB_OF[r.category], slot });
}

/** One doubler arm: run fn() (number | fragment); on throw/null it becomes a `missing` arm. */
function arm(label, fn) {
  try {
    const r = fn();
    if (r === null || r === undefined) return { label, value: 0, missing: true };
    const v = typeof r === "number" ? r : Number(r.value ?? 0);
    return { label, value: v, missing: false };
  } catch {
    return { label, value: 0, missing: true };
  }
}

/** Windwalker("StampDoubler") — every verified arm summed; `missing` lists the unresolved ones. */
export function stampDoubler(ctx) {
  const arms = [
    { label: "base", value: 100, missing: false },
    arm("Atom Collider (AtomBonuses 12)", () => { throw 0; }),               // no evaluator yet
    arm("Pristine Charm (PristineBon 20)", () => pristineBon(ctx, 20)),
    arm("Compass (CompassBonus 76)", () => { throw 0; }),                    // no evaluator yet
    arm("Armor set (EMPEROR_SET)", () => setBonus(ctx, "EMPEROR_SET")),
    arm("Event shop (EventShopOwned 18)", () => 20 * (eventShopOwned(ctx, 18) ?? 0)),
    arm("Sculpting palette (PaletteBonus 23)", () => paletteBonus(ctx, 23)),
    arm("Exotic market (ExoticBonusQTY 49)", () => exoticBonus(ctx, 49)),
    arm("Spelunk (Spelunk[4][3])", () => Math.round(Number(((ctx.s.get("Spelunk") ?? [])[4] ?? [])[3] ?? 0))),
    arm("Legend talent (LegendPTS_bonus 36)", () => legendPts(ctx, 36)),
    arm("Sushi (RoG_BonusQTY 17)", () => sushiRoG(ctx, 17)),
  ];
  const value = arms.reduce((a, x) => a + x.value, 0);
  const missing = arms.filter((x) => x.missing).map((x) => x.label);
  return { value, missing, arms };
}

/** StampOverLevel(row, level, ctx) -> {level, perChar}. perChar=true means an active-char deficit
 *  is in force but no active char is set (the effective level cannot be resolved account-wide). */
function stampOverLevel(ctx, row, level) {
  const req = Number(row.reqItemMultiplicationLevel) || 0;
  const skillIndex = Number(row.skillIndex);
  const jade5 = jadeEmporiumOwned(ctx, 5);           // Ninja("EmporiumBonus",5,0)
  if (!(skillIndex > 0) || jade5 === 1 || !(req > 1)) return { level, perChar: false };
  // deficit active -> needs the ACTIVE character's Lv0[skillIndex]
  if (ctx.activeChar == null) return { level, perChar: true };
  const yourLv = Number((ctx.s.at("Lv0_N", ctx.activeChar) ?? [])[skillIndex] ?? 0);
  const stampLv = level * (200 / (20 * req));
  const dc = 3;
  let overlevel = stampLv > dc
    ? (dc + (stampLv - dc) * Math.pow(yourLv / (stampLv - dc), 0.75)) * (20 * req / 200)
    : stampLv;
  return { level: Math.min(overlevel, level), perChar: false };
}

/**
 * StampBonusOfTypeX(type) as a fragment. Sums every STAMP_INFO stamp whose `stat` === type over
 * its true save slot, applying the exalted doubler and the over-level deficit. Account-wide unless
 * a skill-linked stamp is under an active deficit (Jade Emporium upg 5 unowned) — then per-char.
 */
export function stampBonusOfType(ctx, type) {
  const rows = BY_STAT[type];
  if (!rows) throw new Error(`StampBonusOfTypeX("${type}"): no STAMP_INFO row has stat "${type}"`);
  const exalted = ((ctx.s.get("Compass") ?? [])[4] ?? []).map(String);
  let total = 0, anyPartial = false, anyPerChar = false;
  const parts = [];
  for (const r of rows) {
    const lv = Number((sel.stampTab(ctx.s, r.tab))[r.slot] ?? 0);
    if (!(lv > 0)) { parts.push({ label: r.displayName, value: 0, note: "level 0" }); continue; }
    const ol = stampOverLevel(ctx, r, lv);
    if (ol.perChar) { anyPerChar = true; }
    const eff = Math.floor(ol.level);
    // exalt token: Number2Letter[tab] + slot (client's Compass[4] membership test)
    const token = (NUMBER_2_LETTER[r.tab] ?? "") + String(r.slot);
    let exalt = 1, exaltNote = "";
    if (exalted.includes(token)) {
      const d = stampDoubler(ctx);
      exalt = 1 + d.value / 100;
      anyPartial = true;
      exaltNote = ` EXALTED x${exalt.toFixed(2)} (doubler floor ${d.value}; ${d.missing.length} unread arm${d.missing.length === 1 ? "" : "s"})`;
    }
    const v = exalt * arbitraryCode5(r.func, r.x1, r.x2, eff);
    total += v;
    parts.push({
      label: r.displayName, value: v,
      note: `lv ${lv}${eff !== lv ? ` (eff ${eff}, deficit)` : ""}, ${r.func}(${r.x1},${r.x2})${ol.perChar ? " [per-char deficit; account view lower bound]" : ""}${exaltNote}`,
    });
  }
  const status = anyPerChar ? "partial" : anyPartial ? "partial" : "computed";
  return {
    value: total, status,
    note: parts.map((p) => `${p.label}: ${(+p.value).toFixed(2)}%`).join(", "),
    parts,
  };
}
