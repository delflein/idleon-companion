/* bonuses/shrines.mjs — Shrine(d): the W3 shrine bonus dispatcher.
 *
 * Client (_customBlock_Shrine, N.js:12279), verbatim for the value arm:
 *   ShrineStuffz723[b] = (1 + 5*CardLv("Boss3B")/100)
 *                      * ((ShrineInfo[b][3]-1)*CustomLists.ShrineInfo[b][3]
 *                          + CustomLists.ShrineInfo[b][2])
 *   but only when it is ACTIVE for the player, i.e.
 *     ( Sailing("ArtifactBonus",0,0) >= 1                      // Moai Head -> global
 *       || CurrentMap == ShrineInfo[b][0]                      // standing on the shrine's map
 *       || (MainframeBonus(5)==1 && sameWorld) )               // Chronometer -> same-world
 *     && ShrineInfo[b][3] > 0.5                                // shrine leveled at all
 * ShrineInfo (the SAVE) holds each shrine's row; [b][3] is its LEVEL (savemap w123.mjs).
 * CustomLists.ShrineInfo (na.ShrineInfo(), N.js:24075) is the static curve: [b][2]=base,
 * [b][3]=per-level increment.
 *
 * ACCOUNT-WIDE MODELLING: this recipe values the overworld stat, where CurrentMap is not known.
 * A shrine only contributes off its own map when the Moai Head artifact is owned (owned = its
 * artifact tier >= 1, since ArtifactBonus(0) = 1*tierMult; Moai_Head @N.js:23861 "Get bonuses
 * from all shrines from any map"). The Chronometer mainframe bonus (5) is a second same-world
 * globaliser we do not read; we note it rather than guess. So: Moai owned -> the leveled value;
 * else -> 0 with a note that it is map-local (a floor, not "unknown"). */

import { sel } from "../savemap.mjs";
import { cardLv } from "./cards.mjs";
import { superBitType } from "./gaming.mjs";
import { artifactBonus } from "./sailing.mjs";
import { votingBonus } from "./summoning.mjs";
import { getTalentNumber } from "./talents.mjs";
import { vialBonusByKey } from "./alchemy.mjs";
import { boxReward } from "./postoffice.mjs";

/** CustomLists.ShrineInfo[b] -> {name, base, perLevel}, verbatim from na.ShrineInfo() @N.js:24075
 *  (columns [2]=base, [3]=perLevel kept). Index = the Shrine(d) argument. Shrine(4) = Clover
 *  Shrine = "Boosts Drop Rate of players on this map". */
export const SHRINE_INFO = [
  { name: "Woodular_Shrine",   base: 12, perLevel: 3   }, // 0  Total Damage
  { name: "Isaccian_Shrine",   base: 12, perLevel: 3   }, // 1  Max HP + DEF
  { name: "Crystal_Shrine",    base: 20, perLevel: 4   }, // 2  Shrine Lv Up Rate
  { name: "Pantheon_Shrine",   base: 10, perLevel: 2   }, // 3  Carry Capacity
  { name: "Clover_Shrine",     base: 15, perLevel: 3   }, // 4  Drop Rate
  { name: "Summereading_Shrine", base: 6, perLevel: 1  }, // 5  ALL Exp Gain
  { name: "Crescent_Shrine",   base: 50, perLevel: 7.5 }, // 6  Crystal/Giant spawn
  { name: "Undead_Shrine",     base: 5,  perLevel: 1   }, // 7  Respawn Rate
  { name: "Primordial_Shrine", base: 1,  perLevel: 0.1 }, // 8  AFK Gain Rate
];

/** ArtifactInfo[0] = Moai_Head. Owned = its sailing artifact tier >= 1. */
const moaiOwned = (s) => Number(sel.artifactTiers(s)[0] ?? 0) >= 1;

/**
 * Shrine(d) for the account-wide overworld view. Returns a fragment {value, status, note}.
 * status "computed" always: an inactive (map-local, Moai-less) shrine legitimately contributes 0
 * here — the value IS derivable, it is just conditional on where you stand.
 */
export function shrineBonus(ctx, d) {
  const row = SHRINE_INFO[d];
  if (!row) throw new Error(`Shrine(${d}): CustomLists.ShrineInfo[${d}] not verified in N.js — add to SHRINE_INFO first`);
  const lv = Number((sel.shrineLevels(ctx.s)[d] ?? [])[3] ?? 0);
  if (lv <= 0.5) return { value: 0, status: "computed", note: `${row.name}: not leveled (level ${lv})` };
  const boss3b = cardLv(ctx, "Boss3B");
  const raw = (1 + 5 * boss3b / 100) * ((lv - 1) * row.perLevel + row.base);
  if (moaiOwned(ctx.s)) {
    return { value: raw, status: "computed",
      note: `${row.name}: level ${lv} -> ${raw.toFixed(2)}% (Moai Head owned -> global; x${(1 + 5 * boss3b / 100).toFixed(2)} Boss3B card lv ${boss3b})` };
  }
  return { value: 0, status: "computed",
    note: `${row.name}: level ${lv} would give ${raw.toFixed(2)}% but only on its own map — no Moai Head artifact (Chronometer mainframe bonus 5, unread, could also globalise it)` };
}

/* ShrineExpBonus(b) — WorkbenchStuff("ShrineExpBonus", b, 0), VERBATIM from N.js:
 *   (1 + 50*GamingStatType("SuperBitType",8,0)/100)
 * * (1 + (Sailing("ArtifactBonus",0,1) + 15*RiftStuff("RiftSkillBonus,7",1))/100)   // Moai + Skill Mastery
 * * (1 + Summoning("VotingBonusz",19,0)/100)                                          // vote
 * * (1 + 10*TowerInfo[b+18]/100)                                                      // per-shrine tower level
 * * (1 + ( Shrine(2) + BoxRewards["17b"] + GoldFoodBonuses("ShrineEffect")
 *         + GetTalentNumber(1,639) + AlchVials.ShrineSpd )/100)
 * b is the shrine index; TowerInfo[b+18] is that shrine's own tower level (gamedata-w3-towers.mjs).
 * Terms with no evaluator (Moai ArtifactBonus(0), RiftSkillBonus,7, BoxRewards["17b"] per-char,
 * GoldFood ShrineEffect, talent 639) contribute their neutral element and flag a lower bound. */

const num = (x) => Number(x) || 0;
const safeFrag = (ctx, fn) => { try { const r = fn(); return r == null ? null : r; } catch { return null; } };

/** ShrineExpBonus(shrineIdx) as {value, status, parts:[{id,label,value,note}]}. */
export function shrineExpBonus(ctx, shrineIdx) {
  const parts = [];
  let partial = false;
  const push = (id, label, value, note, unknown) => { parts.push({ id, label, value, note }); if (unknown) partial = true; };

  // add pool (last factor's inner sum)
  const shr2 = safeFrag(ctx, () => shrineBonus(ctx, 2));
  push("shrine2", "Crystal Shrine (2)", shr2 ? num(shr2.value) : 0, shr2?.note ?? "Shrine(2) unread", !shr2);
  const box = safeFrag(ctx, () => boxReward(ctx, "17b"));
  if (box === null) { ctx.unknown('ShrineExp: BoxRewards["17b"] not in PO_ROWS / per-char -> 0 (lower bound)'); partial = true; }
  push("box17b", "Post office box (17b)", box ? num(box.value) : 0, box?.note ?? 'BoxRewards["17b"] unread', box === null);
  ctx.unknown('ShrineExp: GoldFoodBonuses("ShrineEffect") unread -> 0 (lower bound)');
  push("goldFood", "Golden food: shrine effect", 0, "GoldFoodBonuses(ShrineEffect) unread", true);
  const t639 = safeFrag(ctx, () => getTalentNumber(ctx, 639));
  if (t639 === null) { ctx.unknown("ShrineExp: GetTalentNumber(1,639) unread/per-char -> 0 (lower bound)"); partial = true; }
  push("talent639", "Star talent (639)", t639 ? num(t639.value) : 0, t639?.note ?? "talent 639 unread", t639 === null);
  const vial = vialBonusByKey(ctx, "ShrineSpd");
  push("vial", "Vial: ShrineSpd", num(vial.value), vial.note ?? "");
  const pool = num((parts.find((p) => p.id === "shrine2") || {}).value) + num((parts.find((p) => p.id === "box17b") || {}).value) + num(vial.value);

  // mul factors
  const sb8 = superBitType(ctx, 8);
  let sb8V = 0, sb8Status = "computed";
  if (sb8 === null) { sb8Status = "unknown"; ctx.unknown("ShrineExp: SuperBitType(8) unknown -> ×1 (lower bound)"); partial = true; } else sb8V = sb8;
  push("superbit8", "Superbit (8): shrine exp", 50 * sb8V, sb8 === null ? "SuperBitType(8) unknown" : `50 × SuperBitType(8)=${sb8}`, sb8 === null);

  let moai = 0; const moaiFrag = safeFrag(ctx, () => artifactBonus(ctx, 0));
  if (moaiFrag === null) { ctx.unknown("ShrineExp: Sailing ArtifactBonus(0) [Moai] not in SAILING_ARTIFACT -> 0 (lower bound)"); partial = true; } else moai = num(moaiFrag.value);
  ctx.unknown("ShrineExp: RiftStuff(RiftSkillBonus,7) skill-mastery unread -> 0 (lower bound)");
  push("moaiRift", "Moai artifact + Skill Mastery (Rift)", moai, `Moai ${moai} + 15×RiftSkillBonus,7 (rift unread)`, true);

  const vote = safeFrag(ctx, () => votingBonus(ctx, 19));
  push("vote19", "Bonus Ballot (vote 19)", vote ? num(vote.value) : 0, vote?.note ?? "VotingBonusz(19) unread", vote === null || vote?.status === "unknown");

  const towerLv = num(sel.towerLevels(ctx.s)[shrineIdx + 18]);
  push("tower", "Shrine tower level", 10 * towerLv, `10 × TowerInfo[${shrineIdx + 18}]=${towerLv}`);

  const fSuperbit = 1 + 50 * sb8V / 100;
  const fMoaiRift = 1 + moai / 100;   // rift term unread -> +0
  const fVote = 1 + (vote ? num(vote.value) : 0) / 100;
  const fTower = 1 + 10 * towerLv / 100;
  const fPool = 1 + pool / 100;   // goldFood + talent639 unread -> excluded from pool
  const value = fSuperbit * fMoaiRift * fVote * fTower * fPool;
  return { value, status: partial ? "partial" : "computed", parts, shrineIdx };
}
