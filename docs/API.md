# API Integration

## Overview

Live tournament data flows:
```
worldcup26.ir (primary)      ┐
football-data.org (fallback) ┘→ GitHub Actions (every 1 min, smart-gated) → data/wc2026.json → Client (polling)

football-data.org → Cloud Function (every 60 min) → Firestore → Client (real-time)
```

The client never calls either API directly. API keys never touch the browser.

---

## worldcup26.ir (Primary Live Source)

- Provider: worldcup26.ir
- Free, JWT auth via `Authorization: Bearer <token>` header
- Provides real-time live match status and scores
- Secret: `WC26_API_TOKEN` (GitHub Actions secret + Cloud Function secret)

**Team name differences from football-data.org** — `flagFor()` must include both variants:

| worldcup26.ir name | football-data.org name |
|---|---|
| Czechia | Czech Republic |
| Congo DR | Democratic Republic of the Congo |
| Bosnia-Herzegovina | Bosnia and Herzegovina |
| Cape Verde Islands | Cape Verde |

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

**Runs every 1 minute** (cron `* * * * *`). The frequent cron is cheap because `scripts/fetch-data.js` runs a smart guard (`shouldFetchNow()`) that reads the existing `data/wc2026.json` and exits early unless one of these conditions is met:

- **Midnight ET window** (12:00–12:14 AM ET): always refresh to update today's fixtures
- **Active game window**: a game kicks off within the next 15 minutes, or started within the last 2 hours AND its status is not yet `fin`

When the guard passes, it:
1. Tries worldcup26.ir first (primary); falls back to football-data.org if it fails
2. Derives per-group standings from GROUP_STAGE fixtures
3. Fetches top scorers
4. Locks in `utcDate` values by indexing both by match ID and by `home|away` team pair — so kick-off times survive API switches and ID changes across runs
5. Writes `data/wc2026.json` to the repo
6. Firebase Hosting redeploys automatically if the file changed

Secrets required (both set in GitHub Actions):
- `WC26_API_TOKEN` — worldcup26.ir JWT
- `FOOTBALLDATA_KEY` — football-data.org key
- `FIREBASE_SERVICE_ACCOUNT_WORLD_CUP_2026_E1A0B` — for Firestore writes from Actions

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

### `syncNow` — HTTP trigger (manual)
For immediate sync without waiting for the schedule.
Auth: `Authorization: Bearer YOUR_FOOTBALLDATA_KEY` header required.

```bash
curl -X POST https://REGION-world-cup-2026-e1a0b.cloudfunctions.net/syncNow \
  -H "Authorization: Bearer YOUR_FOOTBALLDATA_KEY"
```

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

Written by `scripts/fetch-data.js` (run by GitHub Actions every 10 min, smart-gated). Served via Firebase Hosting with a 60-second cache (`max-age=60, stale-while-revalidate=300`). The frontend fetches this file on load and polls every 5 minutes. All date fields are computed in ET (America/New_York); the frontend also re-derives the ET date from `utcDate` at load time for correctness.

Group objects in this file use a `group` key (e.g. `"group": "A"`). The frontend normalises this to `name` on load.

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
