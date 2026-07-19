# Asset self-containment survey — idleon-toolbox/ → assets/

Scope: every reference to `idleon-toolbox/` in `*.html`, `*.js`, `*.mjs`, `*.css` at the repo
root (`/Users/doe/Projects/Games/IdleOn`), excluding the `idleon-toolbox/` clone itself and
`mockups/`. Read-only audit — nothing was modified.

## 1. How assets are actually served today

`companion.mjs` has no special-casing for `idleon-toolbox/` at all — it's a generic static file
server rooted at the repo directory (`companion.mjs:349-359`, `full = join(DIR, file)`). Requests
like `/idleon-toolbox/public/data/Foo.png` resolve on disk to
`<repo>/idleon-toolbox/public/data/Foo.png` purely because that directory happens to sit at the
repo root. **Consequence for the migration**: moving the real files to a new `assets/` directory
is not enough by itself — every `idleon-toolbox/public/<dir>/` string in code must also change to
point at the new location (see §6). The two places that matter:

- `ui.js:31` — the shared `sprite(file, size, dir="data", cls="")` helper, the single choke point
  used by every page:
  ```js
  function sprite(file, size, dir = "data", cls = "") {
    return `<img class="px ${cls}" src="/idleon-toolbox/public/${dir}/${file}.png" ...>`;
  }
  ```
- Each page's own `<h1><img src="/idleon-toolbox/public/data/....png">` header icon (one per
  page, hand-written, not through the helper).

Fixing `ui.js`'s one template string (and the ~45 hand-written `<h1>` `<img>` tags) is the entire
code-side migration — there is no other indirection layer.

## 2. Reference categories found

### 2a. Real asset dependencies (images actually fetched at runtime)
Two code shapes, both ultimately funneled through `UI.sprite(file, size, dir)`:
- Direct `<img src="/idleon-toolbox/public/<dir>/<Name>.png">` in ~45 page `<h1>` headers.
- `UI.sprite("Name", size, "dir")` calls (static string args) — the vast majority.
- `UI.sprite(f, size, d)` where `f`/`d` come from a `"Name|dir"` string embedded in a small
  in-page array (a very deliberate, consistent convention used across ~15 pages) — still fully
  static, just one array-destructure away from the literal.
- A handful of genuinely **dynamic** `UI.sprite("Prefix" + variable, ...)` calls where the
  variable ranges over a whole family of sprites (crop ids, atom ids, tower ids, etc.) — see §3.

### 2b. NOT asset dependencies — false positives from the raw grep
169 of the ~250 raw `idleon-toolbox` grep hits are in `gamedata-*.mjs` files and
`stats/army-power.mjs`. Every single one is a **source-provenance comment** ("cross-checked
against idleon-toolbox's `data/website-data.json`", "see `parsers/world-3/refinery.ts`") — plain
English citing where a formula was independently verified. None of them are `fetch()`, `import`,
or `require()` calls; I grepped explicitly for those verbs against every `idleon-toolbox` hit in
`.mjs`/`.js` files and found zero runtime references. **These files have no code dependency on
`idleon-toolbox/` at all** — they can be left completely alone; only the comments mention the
name.

### 2c. Non-image dependencies
None. Grep of every `idleon-toolbox/...\.ext` reference by extension across the whole repo root
gives: 49 `.png`, 9 `.json`, 12 `.ts` — and every `.json`/`.ts` hit is one of the provenance
comments from §2b (citing `data/website-data.json` or a `parsers/**/*.ts` file as a cross-check
source during formula research, never loaded by running code). No fonts, no JS modules, no CSS
url()s reference `idleon-toolbox/` anywhere (`grep` of `*.css` for the string returned nothing).

## 3. Dynamic families (variable-driven filename ranges)

For each, I found the concatenation site, then read the surrounding save/game-data to bound the
variable, then cross-checked that bound against what actually exists on disk. All of these are
copied *wholesale* (glob) rather than enumerated, because the variable is driven by live save
data (which crop/atom/statue/etc. a given account has) and any value in-range is reachable:

| Family (glob) | Call site | Variable space | Files on disk | Size |
|---|---|---|---|---|
| `data/FarmCrop*.png` | `farming.html:80` `"FarmCrop"+id`, also `landrank.html` header | `cropId` 0-329 per `SEED_INFO`/`MARKET_INFO` in `gamedata-farming.mjs` (7 tiers, `cropIdMax` up to 329) | 332 | 131.8 KB |
| `data/ConTower*.png` | `construction.html:114/123` `"ConTower"+t.id` | 9 live towers (0-8) per `gamedata-w3-towers.mjs`, but `A`/`B` tower-skin variants exist too | 61 | 92.5 KB |
| `data/Atom*.png` | `atoms.html:112/129` `"Atom"+a.id` | 15 atoms, ids 0-14, `gamedata-w3-atoms.mjs` `ATOM_INFO` | 17 | 65.8 KB |
| `data/Refinery*.png` | `refinery.html:131/142` `"Refinery"+(s.index+1)` | 9 salts (Refinery1-9) per `gamedata-w3-refinery.mjs` | 18 | 24.4 KB |
| `data/Liquid*.png` | `cauldrons.html:91/120` `"Liquid"+(l.idx+1)+"_x1"` | 4 cauldrons (power/quicc/high-iq/kazam) | 4 | 2.3 KB |
| `data/HoleUIvillager*.png` | `cavern.html:114` `"HoleUIvillager"+v.idx` | 5 workable villagers (per page hint text); 8 files exist | 8 | 12.8 KB |
| `data/ClassIcons*.png` | `dashboard.html:433` `"ClassIcons"+c.clsId` | `clsId` read straight from save (`CharacterClass_i`), unbounded per-account — any class id in the game's roster can appear | 74 | 50.2 KB |
| `data/SailT*.png` | `sailing.html:174/179/205` `` `SailT${i*2+1}` `` | island index × 2 + 1, up to ~35 sail-tier sprites | 46 | 19.6 KB |
| `data/Arti*.png` | `sailing.html:210` `"Arti"+a.i` | artifact index, 41 artifacts total (per `dashboard.html` "41" reference) + stand-variant sprites | 54 | 48.8 KB |
| `data/Statue*.png` | `statues.html:97/115` `statueTierIcon(s.tier)+(s.id+1)`, `statueTierIcon` returns `Statue`/`StatueG`/`StatueO`/`StatueZ` by tier | 32 statues × 4 tier-prefixes | 138 | 124.3 KB |
| `data/IslandSail*.png` | `weekly.html:83-91` `"IslandSail"+isl.idx` (W2 coastal islands, 6 of them) | islands 0-5ish | 7 | 8.6 KB |

**Family subtotal: 759 unique files, ~581 KB.**

## 4. Static single-file references (verified to exist)

65 distinct hardcoded `Name|dir` (or `<img>`/`UI.sprite("Name",...,"dir")`) references, one per
page header icon plus per-recipe-module icons (`icon: ["Name","dir"]` config objects that drive
the "full breakdown" panels on ~20 pages). All 65 verified present on disk. Full list with dirs
is in the manifest (§7); total size **65 files, ~144 KB** (all but 4 are 4 KB placeholder-style
sprites; `CharFam0.png` and `Star4.png` are 12-16 KB).

One entry (`IslandSail5.png`) is also covered by the `IslandSail*` family glob — no double-copy in
the manifest.

## 5. Grand total

**824 unique files, 769,392 bytes ≈ 751 KB (0.73 MB).**

That's the entire self-contained `assets/` directory needed to replace the 147 MB
`idleon-toolbox/` clone (whose `public/` alone is 88 MB, `public/data/` alone 78 MB / 16,427
files) — a >99.5% size reduction, using **0.05%** of `idleon-toolbox/public/data/`'s file count.

## 6. Bugs found along the way (not fixed — read-only audit)

Two dir mismatches where the request uses `"data"` but the file only exists in `etc/` — these are
almost certainly already-broken/404ing images in the live app, unrelated to this migration but
worth a follow-up fix:
- `dashboard.html:367` — `["Rift_0", "data", ...]`; `Rift_0.png` only exists at
  `idleon-toolbox/public/etc/Rift_0.png` (used correctly elsewhere as `etc` in `rift.html:88`).
- `dashboard.html:314` — `icon: ["Cavern_0", "data"]`; `Cavern_0.png` only exists at
  `idleon-toolbox/public/etc/Cavern_0.png` (used correctly elsewhere as `etc` in `cavern.html`).

Both are in the manifest under their correct (`etc`) dir, so the self-contained `assets/` copy
will have the right file — but the app itself will keep 404ing on these two tiles as `data` dir
until someone fixes the two literals. Flagging, not fixing, per task scope.

## 7. License situation

- `idleon-toolbox/README.md` (`§License`, line 37-40) claims: *"This project is licensed under the
  MIT License."*
- `idleon-toolbox/LICENSE` (674 lines) is actually the **full GNU GPLv3** text, not MIT. The
  README and the actual LICENSE file disagree — worth noting if this project's own README/legal
  page ever cites idleon-toolbox's license, since "MIT" is not what's actually there.
- Neither the LICENSE nor the README says anything about the *game sprites* specifically — the
  GPL/MIT-labeled license covers idleon-toolbox's own code (the Next.js/React site, parsers,
  etc.), not the `public/data`, `public/etc`, `public/afk_targets` sprite sheets, which are
  extracted directly from Legends of Idleon's client assets (Lavaflame2 / Codigo Creations IP).
  idleon-toolbox itself is a fan tool redistributing ripped game sprites under the same informal
  convention every Idleon fan-site uses (no explicit asset license, tacit fair-use/fan-content
  tolerance from the developer, same as this project's own use of `N.js`). Copying only the
  sprite files (not idleon-toolbox's code) into `assets/` doesn't change that footing either way —
  we're neither more nor less exposed than we already are by depending on the toolbox's copy of
  the same sprites today. Recommend this project's own README carry a short "sprites are Legends
  of Idleon assets (Lavaflame2), not original work, used under the same fan-tool convention as
  idleon-toolbox" note once `assets/` ships, so the provenance isn't silently lost when the
  `idleon-toolbox/` clone (and its own such note, if any) disappears from the repo.

## 8. Recommended migration shape

1. Copy the manifest below into `assets/` preserving the `data/`, `etc/`, `afk_targets/`
   sub-structure (so relative filenames don't collide — e.g. both `data/Cavern_0.png` would never
   exist, but the same base name can appear under different dirs, e.g. `Rift_0.png` only in
   `etc/`).
2. Update `ui.js:31`'s template string from `/idleon-toolbox/public/${dir}/${file}.png` to
   `/assets/${dir}/${file}.png`.
3. Update the ~45 hardcoded `<h1><img src="/idleon-toolbox/public/data/....png">` header tags
   (one per page) to `/assets/...`.
4. Grep for `idleon-toolbox` again after the rewrite to confirm zero remaining code references
   (comments in `gamedata-*.mjs` can stay — they're historical citations, not paths to fix).
5. Delete `idleon-toolbox/` (147 MB) once the app is confirmed working end-to-end against
   `assets/`.

## 9. Machine-usable manifest

Format: `glob_pattern_in_idleon-toolbox/public -> dest_subpath_under_assets/`. Family entries are
globs; everything else is one explicit relative path. All paths are relative to
`idleon-toolbox/public/` on the source side and `assets/` on the dest side (i.e. same
sub-structure, straight copy, no renaming).

```
# ---- dynamic families (glob copy) ----
data/FarmCrop*.png        -> data/
data/ConTower*.png        -> data/
data/Atom*.png            -> data/
data/Refinery*.png        -> data/
data/Liquid*.png          -> data/
data/HoleUIvillager*.png  -> data/
data/ClassIcons*.png      -> data/
data/SailT*.png           -> data/
data/Arti*.png            -> data/
data/Statue*.png          -> data/
data/IslandSail*.png      -> data/

# ---- static singles (explicit copy) ----
data/SmithingHammerChisel.png -> data/
data/KillsSkull.png           -> data/
afk_targets/Poppy.png         -> afk_targets/
etc/Tome_0.png                -> etc/
afk_targets/Divinity.png      -> afk_targets/
etc/Sailing_Skill_0.png       -> etc/
data/PetEgg1.png              -> data/
etc/Owl.png                   -> etc/
afk_targets/Gaming.png        -> afk_targets/
data/GamingPal.png            -> data/
afk_targets/Oak_Tree.png      -> afk_targets/
data/ForgeA.png                -> data/
data/ResearchBG.png            -> data/
data/ZenithBG.png              -> data/
data/Ribbon0.png               -> data/
data/Ladle.png                 -> data/
etc/Cavern_0.png                -> etc/
etc/Endless_Summoning.png       -> etc/
data/Sushi1.png                 -> data/
afk_targets/Cooking.png         -> afk_targets/
etc/Slab.png                    -> etc/
data/MineHead0.png              -> data/
data/ShrineBG.png               -> data/
data/PrintSlot.png              -> data/
data/PrintBG.png                -> data/
data/LegendTalentBG.png         -> data/
data/aVials1.png                -> data/
data/SigilSyrup.png             -> data/
etc/beanstalk.png               -> etc/
afk_targets/Copper.png          -> afk_targets/
data/UIstampB.png               -> data/
afk_targets/Laboratory.png      -> afk_targets/
data/Boss6.png                  -> data/
data/LootDice.png               -> data/
data/Cash.png                   -> data/
data/UIafkclaim.png             -> data/
data/SkillInfo1.png             -> data/
etc/Rift_0.png                  -> etc/
data/WorshipSkull1.png          -> data/
data/AlchBarF1.png              -> data/
data/KrukPart.png               -> data/
etc/Sneaking_Ninja.png          -> etc/
etc/jade_coin.png               -> etc/
etc/Spelunking.png              -> etc/
data/aJarB0.png                 -> data/
etc/Equinox_Mirror.png          -> etc/
etc/CookingMastery.png          -> etc/
data/Ribbon23.png               -> data/
data/SailChest0.png             -> data/
data/SailChest2.png             -> data/
data/SailChest4.png             -> data/
data/SailChest5.png             -> data/
etc/Captain_3.png               -> etc/
data/Bits_x1.png                -> data/
data/SnailMail.png              -> data/
data/GamingRatCrown.png         -> data/
etc/Bribe.png                   -> etc/
data/CoralDiv.png               -> data/
afk_targets/Clammie.png         -> afk_targets/
etc/ButtonG.png                 -> etc/
data/VoteBG.png                 -> data/
data/IslandSail5.png            -> data/   # also covered by IslandSail* family glob above
etc/Guild.png                   -> etc/
etc/CharFam0.png                -> etc/
etc/ObolEmpty1.png              -> etc/
etc/Star4.png                   -> etc/
```

**Totals: 11 family globs (759 files, ~581 KB) + 65 static singles (~144 KB, 1 overlapping with a
family glob) = 824 unique files, ~751 KB.**
