/* bonuses/guild.mjs — GuildBonuses(d): the guild-upgrade bonus dispatcher.
 *
 * Client (_customBlock_GuildBonuses, N.js:12158), verbatim:
 *   GuildBonuses(d) = ArbitraryCode5Inputs(
 *       ""+CustomLists.GuildBonuses[d][6],     // mode  (curve)
 *       CustomLists.GuildBonuses[d][4],        // b
 *       CustomLists.GuildBonuses[d][5],        // c
 *       GuildTasks[0][d],                      // f = the bonus's level
 *       0, 0)
 * GuildTasks[0] is save key "Guild"[0] — 18 numbers, one level per bonus (savemap w123.mjs).
 *
 * The curve rows are CustomLists.GuildBonuses (na.GuildBonuses(), N.js:24038). Each row is a
 * space-split string; the columns GuildBonuses(d) reads are [4]=b, [5]=c, [6]=mode. Transcribed
 * verbatim below (only those three columns kept per row; index = the GuildBonuses(d) argument).
 * Row 10 "Gold_Charm" is +{%_Total_Drop_Rate — GuildBonuses(10) in the drop-rate recipe. */

import { sel } from "../savemap.mjs";
import { arbitraryCode5 } from "./util.mjs";

/** CustomLists.GuildBonuses[d] -> {name, b, c, mode}, verbatim from na.GuildBonuses() @N.js:24038.
 *  Names kept for readability; only b/c/mode feed the curve. */
export const GUILD_BONUSES = [
  { name: "Guild_Gifts",               b: 700, c: 100, mode: "decay" }, // 0  +{%_chance_extra_Guild_Gift
  { name: "Stat_Runes",                b: 40,  c: 50,  mode: "decay" }, // 1  +{_Total_All_Stats
  { name: "Rucksack",                  b: 70,  c: 50,  mode: "decay" }, // 2  +{%_Total_Carry_Cap
  { name: "Power_of_Pow",              b: 10,  c: 50,  mode: "decay" }, // 3  +{_Weapon_Power
  { name: "REM_Fighting",              b: 10,  c: 50,  mode: "decay" }, // 4  +{%_Fight_AFK_gain_rate
  { name: "Make_or_Break",             b: 30,  c: 50,  mode: "decay" }, // 5  +{%_Production_Rate
  { name: "Multi_Tool",                b: 30,  c: 50,  mode: "decay" }, // 6  +{%_Total_Skill_Efficiency
  { name: "Sleepy_Skiller",            b: 10,  c: 50,  mode: "decay" }, // 7  +{%_Skill_AFK_gain_rate
  { name: "Coin_Supercharger",         b: 20,  c: 20,  mode: "decay" }, // 8  +{%_Cash_per_world
  { name: "Bonus_GP_for_small_guilds", b: 200, c: 50,  mode: "decay" }, // 9
  { name: "Gold_Charm",                b: 40,  c: 50,  mode: "decay" }, // 10 +{%_Total_Drop_Rate
  { name: "Star_Dazzle",               b: 120, c: 50,  mode: "decay" }, // 11 +{_Star_Talent_Points
  { name: "C2_Card_Spotter",           b: 60,  c: 50,  mode: "decay" }, // 12 +{%_Card_Drop_Rate
  { name: "Bestone",                   b: 16,  c: 50,  mode: "decay" }, // 13 +{%_Stone_Upgrade_Success
  { name: "Skilley_Skillet",           b: 30,  c: 120, mode: "decay" }, // 14 +{%_Skill_EXP
  { name: "Craps",                     b: 28,  c: 50,  mode: "decay" }, // 15 +{%_AFK_Reroll_chance
  { name: "Anotha_One",                b: 26,  c: 50,  mode: "decay" }, // 16 +{%_2x_EXP_when_claiming_AFK
  { name: "Wait_A_Minute",             b: 1,   c: 0,   mode: "add"   }, // 17 +{%_Nothing_Yet
];

/**
 * GuildBonuses(d) for the account. Guild bonus levels come from save key "Guild"[0]; when the
 * account is not in a guild (no Guild key) the levels are absent and every bonus is 0 — which is
 * exactly the client's behaviour (asNumber(undefined) = 0), so this stays "computed", not unknown.
 * @returns {{value, note, parts?}}
 */
export function guildBonus(ctx, d) {
  const row = GUILD_BONUSES[d];
  if (!row) throw new Error(`GuildBonuses(${d}): CustomLists.GuildBonuses[${d}] not verified in N.js — add to GUILD_BONUSES first`);
  const lv = Number(sel.guildBonusLevels(ctx.s)[d] ?? 0);
  const value = arbitraryCode5(row.mode, row.b, row.c, lv);
  return { value, note: `${row.name}: level ${lv}, ${row.mode}(${row.b},${row.c}) -> ${value.toFixed(2)}` };
}
