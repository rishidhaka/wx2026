# API Integration

## Overview

Live tournament data flows:
```
worldcup26.ir (primary)      ┐
football-data.org (fallback) ┘→ GitHub Actions (every 5 min, smart-gated) → data/wc2026.json → Client (polling)

football-data.org → Cloud Function (every 60 min) → Firestore → Client (real-time)
```

The client never calls either API directly. API keys never touch the browser.

GitHub Actions is triggered three ways now, all hitting the same `shouldFetchNow()` smart-gate in `fetch-data.js`: the native `schedule` cron (every 5 min, can be delayed under GitHub's load), an external cron-job.org job calling the `workflow_dispatch` API every 5 min as a more reliable supplement, and the manual `force-update-data.yml` workflow (see below) for an immediate, gate-bypassing refresh. All scheduled/push-triggered workflows are restricted to `rishidhaka/wx2026` only — see "GitHub Actions" below.

---

## worldcup26.ir (Primary Live Source)

- Provider: worldcup26.ir
- Free, JWT auth via `Authorization: Bearer <token>` header
- Provides real-time live match status, scores, and per-match goal scorers
- Secret: `WC26_API_TOKEN` (GitHub Actions secret + Cloud Function secret)
- Axios timeout: 60s (bumped from 15s — the API occasionally takes up to ~60s to respond)

**Team name differences from football-data.org** — `flagFor()` must include both variants:

| worldcup26.ir name | football-data.org name |
|---|---|
| Czechia | Czech Republic |
| Congo DR | Democratic Republic of the Congo |
| Bosnia-Herzegovina | Bosnia and Herzegovina |
| Cape Verde Islands | Cape Verde |

**Separately**, the picks wizard's static `WC_GROUPS` team names (in `index.html`) don't always match worldcup26.ir's names either — see `docs/AI_CONTEXT.md`'s "Groups" section and `TEAM_NAME_ALIASES` in `calcScore()`. This is a different mismatch (picks vs. live results, not flag lookups) with its own fix.

### Goal scorers (`home_scorers` / `away_scorers`)

Each game object includes scorer strings in a `{}`-wrapped set-notation format:
```
"home_scorers": "{\"F. Balogun 31'\",\"F. Balogun 45'+5'\",\"D. Bobadilla 7'(OG)\"}"
```
Formats seen: `"Name 31'"` (regular), `"Name 45'+5'"` (injury time), `"Name 7'(OG)"` (own goal), `"Name 17' (p)"` (penalty). Some entries use curly/smart quotes (`“ ” ‘ ’`) instead of straight quotes, which breaks `JSON.parse` if not normalised first.

`parseGoalScorers(raw, teamName, gameId)` in `scripts/fetch-data.js` parses these into `{name, minute, tag, team, og}` objects — `tag` (`"(P)"`/`"(OG)"`/`""`) is attached per-goal, not baked into the name, so a player with both a penalty and a regular goal in one match still groups under a single name in the UI and counts once in `buildTopScorers()`. `OG_OVERRIDES` is a manual list for own goals the API doesn't flag itself (confirmed case: Belgium 1-1 Egypt, Mohamed Hany).

**Resolved**: this API previously returned scorer names in Arabic script for some teams (Egypt, Saudi Arabia) and garbled Latin transliterations for others — both were upstream data-quality issues fixed by the API provider, confirmed via live fetch in June 2026. No client-side filtering/workaround is needed or present.

---

## football-data.org (Fallback / Cloud Function)

- Provider: football-data.org
- Free tier: 10 requests/minute
- Competition code: `WC`
- Season: `2026`
- Auth: `X-Auth-Token` request header
- Endpoint base: `https://api.football-data.org/v4`

### Required endpoints

| Endpoint | Used for |
|---|---|
| `/competitions/WC/matches?season=2026` | All 104 fixtures + live scores |
| `/competitions/WC/scorers?season=2026&limit=20` | Top scorers |

Group standings are **derived from fixture results** — the standings endpoint returns a flat 48-team table with no group info, so per-group tables are computed from match data instead.

### Stage labels

football-data.org uses these stage identifiers in match responses:

| API value | Display label |
|---|---|
| `GROUP_STAGE` | Group Stage |
| `LAST_32` | Round of 32 |
| `LAST_16` | Round of 16 |
| `QUARTER_FINALS` | Quarter-finals |
| `SEMI_FINALS` | Semi-finals |
| `THIRD_PLACE` | 3rd Place Playoff |
| `FINAL` | Final |

---

## GitHub Actions (Static Data)

File: `.github/workflows/update-data.yml`

**Runs every 5 minutes** (cron `*/5 * * * *`), plus `workflow_dispatch` for manual/external triggering. Changed from every 1 minute because native GitHub scheduled cron can be delayed under platform load regardless of frequency — an external service (cron-job.org) calling the `workflow_dispatch` API every 5 min was set up as a more reliable supplement. **Restricted to the upstream repo** (`if: github.repository == 'rishidhaka/wx2026'`) — previously the fork ran its own independent copy of this on every scheduled tick, wasting Actions minutes and API calls with no effect on the deployed site.

The 5-min cadence (from either trigger) is cheap because `scripts/fetch-data.js` runs a smart guard (`shouldFetchNow()`) that reads the existing `data/wc2026.json` and exits early unless one of these conditions is met:

- **Midnight ET window** (12:00–12:14 AM ET): always refresh to update today's fixtures
- **Active game window**: a game kicks off within the next 15 minutes, or started within the last 2 hours AND its status is not yet `fin`
- **`FORCE_FETCH=true` env var is set**: bypasses the gate entirely — see `force-update-data.yml` below

When the guard passes, it:
1. Tries worldcup26.ir first (primary); falls back to football-data.org if it fails
2. Derives per-group standings from GROUP_STAGE fixtures
3. Parses goal scorers into `homeGoals`/`awayGoals` per fixture (worldcup26.ir path only — see "Goal scorers" above)
4. Fetches top scorers
5. Locks in `utcDate` values by indexing both by match ID and by `home|away` team pair — so kick-off times survive API switches and ID changes across runs
6. Writes `data/wc2026.json` to the repo
7. Firebase Hosting redeploys automatically if the file changed

Secrets required (both set in GitHub Actions):
- `WC26_API_TOKEN` — worldcup26.ir JWT
- `FOOTBALLDATA_KEY` — football-data.org key
- `FIREBASE_SERVICE_ACCOUNT_WORLD_CUP_2026_E1A0B` — for Firestore writes from Actions

### `force-update-data.yml` — manual-only, bypasses the game-window gate

File: `.github/workflows/force-update-data.yml`. `workflow_dispatch` only, no schedule. Sets `FORCE_FETCH=true` so `shouldFetchNow()` returns `true` immediately regardless of whether a game is active. Use this from the Actions tab when you need `data/wc2026.json` regenerated right away — e.g. right after deploying a change to the fixture data shape — instead of waiting for the next live game to naturally trigger a refresh.

---

## Cloud Function

File: `functions/index.js`

### `syncWorldCup` — scheduled, every 60 minutes
1. Fetches all 104 fixtures + top scorers in parallel
2. Derives per-group standings from fixture results
3. Derives bracket from knockout fixture results
4. Derives results object (which teams won each round)
5. Writes to `wc2026/tournament` (display data, capped at 120 fixtures)
6. Writes to `wc2026/results` (scoring data) with merge
7. Recalculates all player scores → `wc2026/scores`
8. Unlocks Phase 2 automatically once all 72 group stage games finish

### `syncNow` — HTTP trigger (currently unused/legacy)
For immediate sync without waiting for the schedule. Reuses `FOOTBALLDATA_KEY` itself as the bearer token for auth (not a separate secret) — a bit unusual but not exposed client-side, so low risk.
Auth: `Authorization: Bearer YOUR_FOOTBALLDATA_KEY` header required.

```bash
curl -X POST https://REGION-world-cup-2026-e1a0b.cloudfunctions.net/syncNow \
  -H "Authorization: Bearer YOUR_FOOTBALLDATA_KEY"
```

**As of June 2026, nothing in this repo's GitHub Actions workflows actually calls this endpoint** — `update-data.yml`/`force-update-data.yml` write `data/wc2026.json` directly via git commit, a separate mechanism from this HTTP-triggered Cloud Function path. It's still deployed and reachable if you know the URL + key; confirm whether it's still needed before relying on it, or consider removing it to reduce attack surface (see `docs/SECURITY.md`).

Secret required: set via `firebase functions:secrets:set FOOTBALLDATA_KEY`

---

## Firestore Data Written by Cloud Function

### `wc2026/tournament`
```json
{
  "groups": [
    {
      "name": "A",
      "standings": [
        { "team": "USA", "flag": "🇺🇸", "played": 3, "won": 2, "drawn": 1, "lost": 0, "gd": 4, "points": 7 }
      ]
    }
  ],
  "fixtures": [
    {
      "id": 123456,
      "date": "Thu 19 Jun",
      "time": "20:00 UTC",
      "utcDate": "2026-06-19T20:00:00Z",
      "round": "Group Stage - Matchday 1",
      "stage": "GROUP_STAGE",
      "home": "USA",
      "homeFlag": "🇺🇸",
      "away": "England",
      "awayFlag": "🏴󠁧󠁢󠁥󠁮󠁧󠁿",
      "homeScore": 1,
      "awayScore": 0,
      "status": "fin",
      "winner": "USA"
    }
  ],
  "scorers": [
    { "name": "Kylian Mbappé", "team": "France", "flag": "🇫🇷", "goals": 5, "assists": 2 }
  ],
  "bracket": {
    "r32": ["USA", "Mexico"],
    "r16": [], "qf": [], "sf": [], "final": [], "winner": []
  },
  "lastSync": 1718000000000
}
```

### `wc2026/results` (scoring-relevant subset)
```json
{
  "groups": { "A": ["USA", "England", "Panama", "Bolivia"] },
  "thirdPlaceQualifiers": [],
  "bracket": { "r32": [], "r16": [], "qf": [], "sf": [], "final": [], "winner": [] },
  "goldenBoot": "",
  "phase2Unlocked": false
}
```

---

## Static JSON (`data/wc2026.json`)

Written by `scripts/fetch-data.js` (run by GitHub Actions every 5 min, smart-gated). Served via Firebase Hosting with a 60-second cache (`max-age=60, stale-while-revalidate=300`). The frontend fetches this file on load and polls every 5 minutes. All date fields are computed in ET (America/New_York); the frontend also re-derives the ET date from `utcDate` at load time for correctness.

Group objects in this file use a `group` key (e.g. `"group": "A"`). The frontend normalises this to `name` on load.

**Fixtures here (unlike `wc2026/tournament`) include `homeGoals`/`awayGoals`** — see `docs/AI_CONTEXT.md`'s "Match Modal & Goal Data" section for the full field shape and the carry-forward gotcha when the Cloud Function's Firestore listener fires after this JSON loads.

---

## Error Handling

- API failures: Cloud Function logs error, does NOT overwrite existing Firestore data
- Partial data: merge strategy — only updates fields it has data for
- Retry: 2 automatic retries with exponential backoff per endpoint
- Fallback: Admin panel manual entry always available

---

## Monitoring

```bash
firebase functions:log
firebase functions:log --lines=50
```

Firebase Console → Functions → Logs tab also works.
