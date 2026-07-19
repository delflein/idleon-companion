/* stats/shrine-exp.mjs — recipe `shrineExp`, "Shrine EXP-gain rate".
 *
 * WorkbenchStuff("ShrineExpBonus", b, 0), VERBATIM from N.js (transcribed in
 * bonuses/shrines.mjs::shrineExpBonus). 9 sources across 5 factors — the default combine
 * ((1+pool/100)*mul) reproduces the client product exactly:
 *   mul: superbit(8), Moai+Skill-Mastery, vote(19), shrine tower level
 *   add: Crystal Shrine(2), post-office box(17b), golden food, star talent(639), vial ShrineSpd
 *
 * PER-SHRINE: the tower term is TowerInfo[b+18] — this shrine's own tower level. The recipe defaults
 * to shrine 0 (Woodular); pass ctx.args.shrineIdx for another. Map-applicability (a shrine only
 * pays off its own map unless the Moai Head globalises it) is a separate gate the shrines.mjs Clover
 * fragment already models; it is NOT re-applied here (this is the raw ShrineExpBonus multiplier). */

import { T } from "./engine.mjs";
import { shrineExpBonus } from "../bonuses/shrines.mjs";

export const DISPLAY = {
  superbit8: { label: "Superbit (8): shrine exp", where: "W5 Gaming → Superbits", how: "+50% × SuperBitType(8)." },
  moaiRift: { label: "Moai artifact + Skill Mastery (Rift)", where: "Sailing + Rift", how: "ArtifactBonus(0) + 15×RiftSkillBonus,7 — mostly unread." },
  vote19: { label: "Bonus Ballot (vote 19)", where: "W2 Ballot", how: "VotingBonusz(19) — active vote only." },
  tower: { label: "Shrine tower level", where: "W3 Construction → shrine tower", how: "+10% per level." },
  shrine2: { label: "Crystal Shrine (2)", where: "W3 Shrines", how: "Shrine(2) additive %." },
  box17b: { label: "Post office box (17b)", where: "W3 Post Office", how: 'BoxRewards["17b"] — per-char, unread.' },
  goldFood: { label: "Golden food: shrine effect", where: "Golden food", how: "GoldFoodBonuses(ShrineEffect) — unread." },
  talent639: { label: "Star talent (639)", where: "Star talents", how: "GetTalentNumber(1,639) — unread." },
  vial: { label: "Vial: ShrineSpd", where: "Alchemy → Vials", how: "AlchVials.ShrineSpd." },
};

const MUL = new Set(["superbit8", "moaiRift", "vote19", "tower"]);

export const shrineExp = {
  name: "shrineExp",
  label: "Shrine EXP-gain rate",
  display: DISPLAY,
  terms(ctx) {
    const idx = ctx.args?.shrineIdx ?? 0;
    const r = shrineExpBonus(ctx, idx);
    const byId = Object.fromEntries(r.parts.map((p) => [p.id, p]));
    const ids = ["superbit8", "moaiRift", "vote19", "tower", "shrine2", "box17b", "goldFood", "talent639", "vial"];
    return ids.map((id) => {
      const p = byId[id] ?? { value: 0, note: "" };
      const kind = MUL.has(id) ? "mul" : "add";
      const value = kind === "mul" ? 1 + (Number(p.value) || 0) / 100 : (Number(p.value) || 0);
      const unread = String(p.note).includes("unread") || String(p.note).includes("unknown");
      return T(id, `ShrineExpBonus.${id}`, kind, value, unread ? "unknown" : "computed", `${DISPLAY[id]?.label ?? id}: ${p.note ?? ""}`);
    });
  },
};
