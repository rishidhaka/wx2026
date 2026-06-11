# API Integration

## Overview

Live tournament data flows:
```
API-Football (RapidAPI) → Cloud Function (hourly) → Firestore → Client (real-time)
```

The client never calls API-Football directly. API key never touches the browser.

---

## API-Football

- Provider: RapidAPI / api-sports.io
- Free tier: 100 requests/day
- Used: 24/day (hourly sync)
- Endpoint base: `https://v3.football.api-sports.io`

### Required endpoints

| Endpoint | Used for | Calls/day |
|---|---|---|
| `/standings?league=X&season=2026` | Group tables | 1 |
| `/fixtures?league=X&season=2026` | All fixtures + scores | 1 |
| `/players/topscorers?league=X&season=2026` | Top scorers | 1 |

3 calls per sync × 24 syncs/day = 72 calls/day. Within free 100/day limit.

### League ID
FIFA World Cup 2026 league ID on API-Football: **to confirm closer to tournament**.
Check via: `GET /leagues?name=FIFA+World+Cup&season=2026`
Update `WC_2026_ID` constant in `functions/index.js`.

---

## Cloud Function

File: `functions/index.js`

### `syncWorldCup` — scheduled, every 60 minutes
1. Fetches standings, fixtures, top scorers in parallel
2. Derives bracket from fixture results
3. Derives results object (which teams won each round)
4. Writes to `wc2026/tournament` (display data)
5. Writes to `wc2026/results` (scoring data) — merge only, doesn't overwrite admin manual entries where API doesn't have data yet
6. Recalculates all player scores → `wc2026/scores`

### `syncNow` — HTTP trigger (manual)
For immediate sync without waiting for the schedule.
Auth: `Authorization: Bearer YOUR_API_KEY` header required.

```bash
curl -X POST https://REGION-world-cup-2026-e1a0b.cloudfunctions.net/syncNow \
  -H "Authorization: Bearer YOUR_API_KEY"
```

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
      "time": "20:00",
      "venue": "Dallas",
      "round": "Group Stage",
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
    "r32": ["USA", "Mexico", ...],
    "r32_scores": ["2", "1", ...],
    "r16": [...],
    "winner": ["Argentina"]
  },
  "lastSync": 1718000000000
}
```

### `wc2026/results` (scoring-relevant subset)
```json
{
  "groups": { "A": ["USA", "England", "Panama", "Bolivia"], ... },
  "thirdPlaceQualifiers": ["Poland", "Morocco", "Japan", ...],
  "bracket": { "r32": [...winners...], "r16": [...], ... },
  "goldenBoot": "Kylian Mbappé",
  "phase2Unlocked": false
}
```

---

## Error Handling

- API failures: Cloud Function logs error, does NOT overwrite existing Firestore data
- Partial data: merge strategy — only updates fields it has data for
- Retry: 2 automatic retries with exponential backoff per endpoint
- Fallback: Admin panel manual entry always available

---

## Monitoring

```bash
# View Cloud Function logs
firebase functions:log

# View last 50 lines
firebase functions:log --lines=50

# Filter by function name
firebase functions:log --only syncWorldCup
```

Firebase Console → Functions → Logs tab also works.

---

## Alternative Data Sources

If API-Football free tier runs out or is unavailable:

| Alternative | Free tier | Notes |
|---|---|---|
| football-data.org | 10 req/min | Good coverage, different schema |
| TheSportsDB | Free tier | Less reliable for live scores |
| ESPN API (unofficial) | None official | Scraping risk |
| Manual admin entry | N/A | Always available as fallback |

The Cloud Function can be adapted to any JSON API by updating the fetch functions.
The Firestore data schema does not change — only the transformation logic.
