/* stats/w3-report.mjs — the /api/w3 payload: a small STATIC glossary for World 3 (Frostbite
 * Tundra) that w3.html needs but the entities.w3 shape (domain.mjs) intentionally does not
 * carry, because it's account-independent gamedata rather than a parsed save value:
 *   - Construction TOWER effect/description text (entities.w3.towers carries level/maxLevel,
 *     not what each tower's bonus actually does — TOWER_INFO's `desc` has that)
 *   - ATOM effect/description text (entities.w3.atoms carries level/bonus/costToNext, not the
 *     in-game tooltip explaining what the bonus number means)
 *   - SALT LICK upgrade effect text (entities.w3.refinery.saltLickUpgrades carries level/
 *     maxLevel/name, not what the upgrade does)
 *   - PRINTER slot-unlock descriptions (entities.w3.printer.slotUnlocks carries name/grants,
 *     not the flavor text)
 *   - SHRINE base/per-level bonus + which stat each shrine boosts (entities.w3.shrines carries
 *     only level; the base/perLevel curve and stat name live in bonuses/shrines.mjs's
 *     SHRINE_INFO, which itself has no stat-name field — the names below are transcribed from
 *     that file's own row comments, cross-checked against the shrine's in-game tooltip name)
 *
 * No save parsing here — this never changes between snapshots, so it takes no argument and
 * does no per-account computation. Pages must not import gamedata-*.mjs directly (see README
 * "For a new STAT specifically" / implementation guide §3) — this is the sanctioned server-side
 * seam for that data to reach the browser. Same pattern as stats/w1-report.mjs / w2-report.mjs.
 */
import { TOWER_INFO } from "../../gamedata/gamedata-w3-towers.mjs";
import { ATOM_INFO } from "../../gamedata/gamedata-w3-atoms.mjs";
import { SALT_LICK_UPGRADES } from "../../gamedata/gamedata-w3-refinery.mjs";
import { PRINTER_SLOT_UNLOCKS } from "../../gamedata/gamedata-w3-printer.mjs";
import { SHRINE_INFO } from "../bonuses/shrines.mjs";

/* N.js text tables encode spaces as "_" and leave "{"/"}"/"<"/">"/"$" as unfilled value
 * placeholders (the live number they'd substitute is shown separately, from the entity's own
 * computed fields) — strip all five rather than show raw punctuation in the UI. Same convention
 * as stats/w1-report.mjs / w2-report.mjs's clean(), extended with "<"/">"/"$" which W3's
 * tower/atom desc strings (gamedata-w3-towers.mjs, gamedata-w3-atoms.mjs) also use as
 * placeholder glyphs; "_@_" (a section break, e.g. "...printing_resources!_@_Current_Bonuses:")
 * becomes ". " so multi-clause tower descriptions still read as sentences. */
const clean = (s) => String(s ?? "")
  .replace(/_@_/g, ". ")
  .replace(/[{}<>$@]/g, "")
  .replace(/_/g, " ")
  .replace(/\s+/g, " ")
  .trim();

/* SHRINE_INFO (bonuses/shrines.mjs) rows are commented 0-8 with the stat each shrine boosts —
 * transcribed here since the data file itself has no stat-name field. */
const SHRINE_STAT_NAMES = [
  "Total Damage", "Max HP + DEF", "Shrine Level-Up Rate", "Carry Capacity", "Drop Rate",
  "ALL Exp Gain", "Crystal/Giant Mob Spawn Chance", "Respawn Rate", "AFK Gain Rate",
];

export function w3Glossary() {
  return {
    towerEffects: TOWER_INFO.map((t) => ({ id: t.id, name: clean(t.name), desc: clean(t.desc) })),
    atomEffects: ATOM_INFO.map((a) => ({ id: a.id, name: clean(a.name), desc: clean(a.desc) })),
    saltLickEffects: SALT_LICK_UPGRADES.map((u) => ({ i: u.i, name: clean(u.displayNameToolbox), effect: clean(u.effect), baseCost: u.baseCost, perLevelBonus: u.perLevelBonus, maxLevel: u.maxLevel })),
    printerSlotEffects: PRINTER_SLOT_UNLOCKS.map((u) => ({ key: u.key, name: clean(u.name), desc: clean(u.desc) })),
    shrineEffects: SHRINE_INFO.map((s, i) => ({ id: i, statName: SHRINE_STAT_NAMES[i] ?? "", base: s.base, perLevel: s.perLevel })),
  };
}
