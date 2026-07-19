#!/usr/bin/env node
// scripts/copy-assets.mjs
//
// Copies the manifest of idleon-toolbox sprite assets the companion app actually
// references into public/assets/, preserving the toolbox's data/ etc/ afk_targets/
// sub-structure (so referencing code just swaps the "idleon-toolbox/public/" prefix
// for "public/assets/" and the rest of the path is unchanged).
//
// Manifest derived from docs/migration/survey-assets.md §9 — 11 dynamic-family globs
// + 65 static single-file references, 824 unique files ≈ 751 KB total.
//
// Plain Node, no dependencies. Idempotent (safe to re-run; skips files already
// copied and unchanged). Exits nonzero and lists any manifest entry that matched
// zero files on disk.

import { readdirSync, statSync, mkdirSync, copyFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");
const SRC_ROOT = join(REPO_ROOT, "idleon-toolbox", "public");
const DEST_ROOT = join(REPO_ROOT, "public", "assets");

// ---- dynamic families (glob copy) — one entry per row in survey §3 ----
const GLOBS = [
  "data/FarmCrop*.png",
  "data/ConTower*.png",
  "data/Atom*.png",
  "data/Refinery*.png",
  "data/Liquid*.png",
  "data/HoleUIvillager*.png",
  "data/ClassIcons*.png",
  "data/SailT*.png",
  "data/Arti*.png",
  "data/Statue*.png",
  "data/IslandSail*.png",
];

// ---- static singles (explicit copy) — survey §4 / §9 ----
const FILES = [
  "data/SmithingHammerChisel.png",
  "data/KillsSkull.png",
  "afk_targets/Poppy.png",
  "etc/Tome_0.png",
  "afk_targets/Divinity.png",
  "etc/Sailing_Skill_0.png",
  "data/PetEgg1.png",
  "etc/Owl.png",
  "afk_targets/Gaming.png",
  "data/GamingPal.png",
  "afk_targets/Oak_Tree.png",
  "data/ForgeA.png",
  "data/ResearchBG.png",
  "data/ZenithBG.png",
  "data/Ribbon0.png",
  "data/Ladle.png",
  "etc/Cavern_0.png",
  "etc/Endless_Summoning.png",
  "data/Sushi1.png",
  "afk_targets/Cooking.png",
  "etc/Slab.png",
  "data/MineHead0.png",
  "data/ShrineBG.png",
  "data/PrintSlot.png",
  "data/PrintBG.png",
  "data/LegendTalentBG.png",
  "data/aVials1.png",
  "data/SigilSyrup.png",
  "etc/beanstalk.png",
  "afk_targets/Copper.png",
  "data/UIstampB.png",
  "afk_targets/Laboratory.png",
  "data/Boss6.png",
  "data/LootDice.png",
  "data/Cash.png",
  "data/UIafkclaim.png",
  "data/SkillInfo1.png",
  "etc/Rift_0.png",
  "data/WorshipSkull1.png",
  "data/AlchBarF1.png",
  "data/KrukPart.png",
  "etc/Sneaking_Ninja.png",
  "etc/jade_coin.png",
  "etc/Spelunking.png",
  "data/aJarB0.png",
  "etc/Equinox_Mirror.png",
  "etc/CookingMastery.png",
  "data/Ribbon23.png",
  "data/SailChest0.png",
  "data/SailChest2.png",
  "data/SailChest4.png",
  "data/SailChest5.png",
  "etc/Captain_3.png",
  "data/Bits_x1.png",
  "data/SnailMail.png",
  "data/GamingRatCrown.png",
  "etc/Bribe.png",
  "data/CoralDiv.png",
  "afk_targets/Clammie.png",
  "etc/ButtonG.png",
  "data/VoteBG.png",
  "data/IslandSail5.png", // also covered by the IslandSail* family glob — deduped below
  "etc/Guild.png",
  "etc/CharFam0.png",
  "etc/ObolEmpty1.png",
  "etc/Star4.png",
];

function globToRegExp(pattern) {
  // Our patterns are all "Prefix*.png" (single wildcard) — a small general
  // matcher is enough, no need for a glob dependency.
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp("^" + pattern.split("*").map(esc).join(".*") + "$");
}

function resolveGlob(globPath) {
  const slash = globPath.lastIndexOf("/");
  const dir = globPath.slice(0, slash);
  const pattern = globPath.slice(slash + 1);
  const re = globToRegExp(pattern);
  const srcDir = join(SRC_ROOT, dir);
  if (!existsSync(srcDir)) return [];
  return readdirSync(srcDir)
    .filter((f) => re.test(f))
    .map((f) => `${dir}/${f}`);
}

// ---- resolve manifest into a deduped flat list of source-relative paths ----
const relPaths = new Set();
const manifestReport = []; // { pattern, matched } — for the zero-match check

for (const g of GLOBS) {
  const matches = resolveGlob(g);
  manifestReport.push({ pattern: g, matched: matches.length });
  matches.forEach((m) => relPaths.add(m));
}
for (const f of FILES) {
  manifestReport.push({ pattern: f, matched: existsSync(join(SRC_ROOT, f)) ? 1 : 0 });
  relPaths.add(f);
}

// ---- copy (idempotent: skip files already present and byte-identical size) ----
let freshlyCopied = 0;
let alreadyCurrent = 0;
let totalBytes = 0;
const missing = [];

for (const rel of relPaths) {
  const src = join(SRC_ROOT, rel);
  const dest = join(DEST_ROOT, rel);
  if (!existsSync(src)) {
    missing.push(rel);
    continue;
  }
  const srcStat = statSync(src);
  let needsCopy = true;
  if (existsSync(dest)) {
    const destStat = statSync(dest);
    needsCopy = destStat.size !== srcStat.size;
  }
  if (needsCopy) {
    mkdirSync(dirname(dest), { recursive: true });
    copyFileSync(src, dest);
    freshlyCopied++;
  } else {
    alreadyCurrent++;
  }
  totalBytes += srcStat.size;
}

// ---- summary ----
const totalPresent = freshlyCopied + alreadyCurrent;
console.log(
  `copy-assets: ${totalPresent} files in public/assets/ (${freshlyCopied} copied this run, ` +
    `${alreadyCurrent} already current), ${missing.length} missing, ${totalBytes} bytes ` +
    `(${(totalBytes / 1024).toFixed(1)} KB)`
);
if (missing.length) {
  console.log("Missing from idleon-toolbox/public (manifest entry present but no source file):");
  missing.forEach((m) => console.log(`  ${m}`));
}

const zeroMatchGlobs = manifestReport.filter((m) => m.matched === 0);
if (zeroMatchGlobs.length) {
  console.log("Manifest entries with ZERO matches on disk:");
  zeroMatchGlobs.forEach((m) => console.log(`  ${m.pattern}`));
  process.exit(1);
}
