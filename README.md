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
artifactchance.mjs  Evaluates the client's ~30-term Sailing("BoatArtiMulti") against the
                save, with a per-term breakdown. Terms it cannot derive (the active vote is
                runtime UI state; the Tome score needs 118 bespoke stat lookups) are returned
                as status:"unknown" contributing their neutral element — so the result is an
                honest LOWER BOUND, never a guess. Check `lowerBound`.
                Opts worth knowing: `companions` (Set of owned ids — companion.mjs fetches the
                RTDB `_comp` doc; WITHOUT it several terms are honestly unknown and the result
                is ~7x low), `labConnectedIds` (lab-board connectivity gates MainframeBonus(10)
                the vial doubler and (14) Artifact Attraction), `tomePoints`, `activeVote`.
                KNOWN OPEN: against one account's in-game reading it still lands ~1.7x low with
                everything supplied. The residual is unexplained and deliberately NOT tuned away.
domain.mjs      THE parser: raw save -> entities (characters, achievements, artifacts,
                sailing, atoms, equinox, engines, alchemy, stamps, meals, cards, emperor,
                misc, w7, caverns) + metricsFrom(). Consumes savemap selectors, not raw
                indices. Extend here; POST /api/rebuild backfills every stored snapshot
                retroactively from the raw saves.
dashboard.html / achievements.html   UI. Server mode when served from localhost;
                still work as plain files (savedata.js / browser sync) as fallback.
sync.js         shared client logic: server API adapter + direct-Firebase fallback.
fetch-idleon.mjs  legacy CLI fetcher (still works; the server replaces it).
```

## Data & refresh

- **Sync now** button = `POST /api/sync` — server pulls your save from the game's
  Firestore (auth cached in `.idleon-auth.json`; UI has Connect to link/re-auth).
- **auto** dropdown in the header: OFF / 1 / 5 / 15 / 60 min server-side auto-refresh
  (persisted in the DB). Pages poll and repaint when a new snapshot lands.
- One snapshot per calendar day is kept (same-day syncs update it) — full raw save,
  gzipped (~80KB/day), so ANY future metric can be computed over all history.

## API quick reference

`GET /api/state` · `POST /api/sync` · `GET /api/history?keys=a,b&from=ISO` ·
`GET /api/snapshots` · `GET /api/snapshot/:id/raw` · `GET|POST /api/settings` ·
`POST /api/connect {url}` · `GET /api/auth` · `POST /api/rebuild`

## Extending (the intended loop)

0. Find the save key in **`savemap.mjs`** — it's already named and evidenced. If its
   confidence is `inferred`/`unknown`, confirm it in the client first and upgrade the entry.
1. Add parsing to `domain.mjs` (new entity or metric), reading via `sel.*` — never `raw[...]`
   and never a bare index.
2. `POST /api/rebuild` → all stored snapshots get the new fields, history included.
3. Render it in the UI.
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
