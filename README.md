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
                  settings(key, value)
domain.mjs      THE parser: raw save -> entities (characters, achievements, artifacts,
                atoms, equinox, engines, alchemy, stamps, meals, emperor, w7, caverns)
                + metricsFrom(). Extend here; POST /api/rebuild backfills every stored
                snapshot retroactively from the raw saves.
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

1. Add parsing to `domain.mjs` (new entity or metric).
2. `POST /api/rebuild` → all stored snapshots get the new fields, history included.
3. Render it in the UI.
Game reference constants (achievement list `achievements-data.json`, artifact/atom
names, caps in `domain.mjs` REF + dashboard REF) are v1.19-era — refresh after
major patches.

## Achievement Tracker

Grouped by completion mode: active missions (with how-to tips), exact stacks,
dungeon runs, minigames, long grinds, self-finishing. Steam-exclusive ones read
from `SteamAchieve`. Pin (☆) to keep on top.

## Privacy

`.idleon-auth.json` + `idleon.db` contain your token & save data — keep private,
gitignore. Server binds to 127.0.0.1 only.
