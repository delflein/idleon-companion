# IdleOn Companion

Local companion tool: dashboard, achievement tracker, live save sync, SQLite-backed
history. Built 2026-07-16, designed to grow.

## Start it

Double-click **`start-companion.command`** (or `node companion.mjs`) → opens
http://localhost:8317. Needs Node 22.5+ (`brew install node`). Leave the
terminal window open; Ctrl+C stops it.

The DB is not in the repo (it holds save data). On a fresh clone you start empty:
hit **Connect** in the UI to link your account, then **Sync now** — that writes the
first snapshot into **`idleon.db`**. If you have a `savegame.json` / `history.json`
lying around, first run migrates them in automatically.

## Architecture

```
companion.mjs   HTTP server: static UI + REST API + auto-refresh timer + Steam connect
db.mjs          SQLite layer (node:sqlite). Tables:
                  snapshots(ts, raw_gz, char_names)   full gzipped raw save per snapshot
                  entities(snapshot_id, entity, json) structured objects per snapshot
                  metrics(snapshot_id, key, value)    long-format time-series
                  achievement_state(snapshot_id, i, done, progress)
                  players(snapshot_id, char_idx, ...)        one row per character
                  player_skills(snapshot_id, char_idx, skill, level)  long-format
                  settings(key, value)
                All derived writes go through one writeDerived() — add a table there and
                POST /api/rebuild backfills it over all history.
savemap.mjs     THE MAP: every save key named, documented and evidenced. 225 families
  savemap/        (all 817 keys), split by system. Each entry records shape, sub-index
                  meanings, WHERE IN N.js it was confirmed, and a confidence:
                    confirmed (read in N.js) / inferred (looks obvious, unverified) /
                    unknown (we don't know — an honest answer, do not "improve" it).
                Also records `scope`: character | account | account-via-aggregate |
                account-via-active. A per-character value does NOT necessarily only affect
                that character — star signs are read from the ACTIVE char, so never assume
                character 0 (that's IdleonToolbox's bug).
                Exposes openSave(raw) + `sel.*` named selectors. Nothing else should touch
                raw keys or magic indices.
gamedata.mjs    Constants lifted from the client (shiny-pet tables, arcade rows,
                Number2Letter). v1.19-era — refresh after major patches.
gamedata-cards.mjs  GENERATED: the full card system tables (272 cards with star thresholds,
                bonus texts and values; card-bonus id maps; lab chip key/value tables),
                extracted verbatim from CardStuff/IDforCardBonus/ChipDesc in N.js.
stats/          THE STAT ENGINE. engine.mjs defines the recipe contract: a stat is the
                client's expression transcribed as an ordered term list; evaluation yields
                {value, terms, unknown, lowerBound} plus per-character as-if-active variants
                (evaluatePerChar) and long-format metric rows (metricRows). index.mjs is the
                registry — a recipe added there is automatically in e.stats, in the metrics
                time-series (rebuild backfills all history), and available to every page.
                artifact-find.mjs is recipe #1 (the ~30-term Sailing("BoatArtiMulti"));
                drop-rate.mjs is TotStatMAP["DropRarity"] (~75 terms, per-character);
                tome.mjs is the TOME SCORE (118 rows, format:"points") — computed natively
                from bonuses/tome.mjs and fed back as ctx.tomePoints into the other recipes
                (a floor while any row is unknown; a user-entered score overrides as exact).
                HONESTY CONTRACT: a term not derivable from the save (companions without the
                _comp doc, lab connectivity, Tome score, active vote) reports status "unknown"
                and contributes its neutral element — the result is an honest LOWER BOUND,
                never a guess. Check `lowerBound`.
                KNOWN OPEN: against one account's in-game reading artifact-find still lands
                ~1.7x low with everything supplied. Unexplained, deliberately NOT tuned away.
bonuses/        Shared evaluators, ONE MODULE PER CLIENT DISPATCHER (summoning, research,
                thingies, holes, gaming, sailing, breeding, farming, arcade, alchemy, lab,
                labboard [the connectivity FLOOR SOLVER — proves lab-node connections from
                the save; never answers "disconnected", only proven/unknown], cards, chips,
                talents, stamps, bubbles, postoffice,
                ninja, minehead, starsigns, companions, sushi, arcane, misc, util). Each
                mirrors the client function's signature — arcadeBonus(ctx, id),
                shinyBonus(ctx, bonusId) — and is generic where the client table in
                gamedata.mjs is complete, TABLE-GUARDED where it is partial: calling with an
                unverified id THROWS ("add to X first") instead of guessing. Evaluators
                return fragments {value, status, note, parts}; recipes name them into terms.
domain.mjs      THE parser: raw save -> entities (characters, achievements, artifacts,
                sailing, atoms, equinox, engines, alchemy, stamps, meals, cards, emperor,
                misc, w7, caverns) + metricsFrom(). Consumes savemap selectors, not raw
                indices. Extend here; POST /api/rebuild backfills every stored snapshot
                retroactively from the raw saves.
gamedata-farming.mjs  GENERATED: SeedInfo / MarketInfo / MarketExoticInfo (80 rows) /
                Land Rank Database / sticker tables, verbatim from N.js (extraction script
                in the session scratchpad; refresh after major patches).
stats/farming-report.mjs  the /api/farming payload: four modules (medal evo push with
                marginal-gain ranking, exotic weekly planner with the EXACT client PRNG
                rotation forecast keyed to WALL CLOCK, OG & stickers, markets & spending).
                bonuses/farming.mjs is the full _customBlock_FarmingStuffs mirror
                (N.js:17920-17969 transcribed whole); stats/crop-evo.mjs is the ~29-term
                NextCropChance recipe. Known client-truth: the in-game "Plot Rank Gain"
                display OVERSTATES (award code applies fewer sources — both exposed);
                evolution rolls happen ONCE per collect cycle, so OG-stacking a plot
                competes with evolution attempts.
dashboard.html / achievements.html   UI. Server mode when served from localhost;
                still work as plain files (savedata.js / browser sync) as fallback.
farming.html    the four farming modules (planning only — NO live timers, by design).
landrank.html   Land Rank calculator: weighted-log greedy allocation over the client's own
                curves — goal presets + custom weights, full-respec vs add-only, caps modeled
                (value 10k×, 5th-column max). No hand-tuned ratios (unlike every community
                tool — see the 2026-07-18 research). Per-rank rows use each plot's OWN rank.
sync.js         shared client logic: server API adapter + direct-Firebase fallback.
fetch-idleon.mjs  legacy CLI fetcher (still works; the server replaces it).
```

## Data & refresh

- **Sync now** button = `POST /api/sync` — server pulls your save from the game's
  Firestore (auth cached in `.idleon-auth.json`; UI has Connect to link/re-auth).
- **auto** dropdown in the header: OFF / 1 / 5 / 15 / 60 min server-side auto-refresh
  (persisted in the DB). Pages poll and repaint when a new snapshot lands.
- One snapshot per calendar day is kept (same-day syncs update it) — full raw save,
  gzipped (~130KB/day), so ANY future metric can be computed over all history.
- **Metrics are two-layered** (2026-07-18): every sync ALSO appends all metric rows to
  `metrics_live(ts, key, value)` — intra-day resolution for charts at ~2MB/yr. The
  snapshot-keyed `metrics` table stays the daily, rebuildable layer. `history()` unions
  both (the day's final sync exists in both with the same ts; deduped). Trade-off, by
  design: a metric added later backfills DAILY from the raw anchors; intra-day points
  exist only from the metric's birth onward. Delta-compressing raws was measured
  (key-level delta = only 3x smaller — hot keys carry AFK counters) and rejected.

## API quick reference

`GET /api/state` · `POST /api/sync` · `GET /api/farming` · `GET /api/history?keys=a,b&from=ISO` ·
`GET /api/snapshots` · `GET /api/snapshot/:id/raw` · `GET|POST /api/settings` ·
`POST /api/connect {url}` · `GET /api/auth` · `POST /api/rebuild`

## Extending (the intended loop)

0. Find the save key in **`savemap.mjs`** — it's already named and evidenced. If its
   confidence is `inferred`/`unknown`, confirm it in the client first and upgrade the entry.
1. Add parsing to `domain.mjs` (new entity or metric), reading via `sel.*` — never `raw[...]`
   and never a bare index.
2. `POST /api/rebuild` → all stored snapshots get the new fields, history included.
3. Render it in the UI.

**For a new STAT specifically**: grep the client for its expression, transcribe it verbatim
into a recipe in `stats/` (one term per factor/addend), implement any missing dispatcher
calls in `bonuses/` (extend the table if the id is table-guarded — with N.js evidence cited),
register it in `stats/index.mjs`, rebuild. History backfills; term-level time-series come free
(`stat.<name>.<termId>`). Term ids are metric keys — never rename a shipped one.
Game reference constants (achievement list `achievements-data.json`, artifact/atom
names, caps in `domain.mjs` REF + dashboard REF, `gamedata.mjs`) are v1.19-era — refresh
after major patches.

### Ground rules for game logic

The decompiled client is authoritative; the wiki and community "research" have been caught
wrong repeatedly (they claimed the artifact multiplier is `1.70^rarity` when the client
literally says `Math.pow(1.4, rarity)`, and every chest-rarity threshold we'd inherited from
them was wrong too). Confirm in the client, cite the function in a comment, and record
uncertainty honestly — `unknown` beats a plausible guess, because a wrong label gets trusted.

Two things are **not knowable from the save** and must never be silently faked:
- **Firebase server vars** (`AncientOddPerIsland`, `AncientArtiPCT`) — pure remote config,
  no default in the client. `REF.serverVars` is CALIBRATED from one account's observation.
  Absolute "1 in X" odds inherit that; **ratios between islands/boats/captains do not.**
- **Companion ownership** — comes from a native `getCompanionInfoMe()` bridge. Worth up to
  ~5x on artifact find. Pass it explicitly or leave the term `unknown`.

## Achievement Tracker

Grouped by completion mode: active missions (with how-to tips), exact stacks,
dungeon runs, minigames, long grinds, self-finishing. Steam-exclusive ones read
from `SteamAchieve`. Pin (☆) to keep on top.

## Privacy

`.idleon-auth.json` + `idleon.db` contain your token & save data — keep private,
gitignore. Server binds to 127.0.0.1 only.
