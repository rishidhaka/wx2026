# Architecture

## Overview

Single-page app. No build step. One HTML file contains all HTML, CSS, and JS.
Firebase provides auth, database, hosting, and serverless functions.

```
Browser ──── Firebase Auth (Google signInWithPopup) ── Google Identity
    │
    ├── Firestore (real-time listeners)
    │     ├── wc2026/players      (all player picks + identity; only users who have saved picks)
    │     ├── wc2026/results      (confirmed match results)
    │     ├── wc2026/leagues      (mini league membership)
    │     ├── wc2026/tournament   (live data written by Cloud Function)
    │     └── wc2026picks/{uid}   (full picks doc per user, including phase1SubmittedAt)
    │
    └── Firebase Hosting ──── index.html (the app)
                         └─── data/wc2026.json (static, 60s cache)

Cloud Function (every 60 min)
    └── football-data.org → Firestore wc2026/tournament + wc2026/results

GitHub Actions (every 1 min, smart-gated)
    └── fetch-data.js checks existing data before calling the API:
        active game window or midnight ET → fetch + deploy
        no active games → exit early (no API call, no commit)
```

### Data sources for live data
`scripts/fetch-data.js` (run by GitHub Actions) uses a **primary + fallback** strategy:
- **Primary**: `worldcup26.ir` — real-time live match status, JWT auth (`WC26_API_TOKEN` secret)
- **Fallback**: `football-data.org` — used if primary fails (`FOOTBALLDATA_KEY` secret)

**Critical**: These two APIs use different team name strings. `flagFor()` must include all variants. Known mismatches: Czechia vs Czech Republic, Congo DR vs Democratic Republic of the Congo, Bosnia-Herzegovina vs Bosnia and Herzegovina, Cape Verde Islands vs Cape Verde.

### Repository fork structure
```
rishidhaka/wx2026  ← origin (upstream, production)
siddhaka/wx2026    ← fork (development)
```
All UI development happens on `siddhaka/wx2026:main`. PRs are opened from `siddhaka:main` → `rishidhaka:main`. The GitHub Actions auto-deploy fires on push to `rishidhaka/wx2026:main`.

---

## Firestore Collections

### `wc2026/players` (map document)
Written by client on pick save. Keyed by Firebase UID.
```json
{
  "uid_abc123": {
    "name": "Rishi D",
    "email": "rishi@gmail.com",
    "photoURL": "https://...",
    "phase1": {
      "groups": {
        "A": ["USA", "England", "Panama", "Bolivia"],
        "B": ["Mexico", "Ecuador", "Jamaica", "Venezuela"],
        ...all 12 groups...
      },
      "thirdPlaceQualifiers": ["USA", "Mexico", "Japan", "Morocco", "Senegal", "Poland", "Switzerland", "Croatia"],
      "bracket": {
        "r32":   ["USA", "Mexico", ...32 teams...],
        "r16":   ["USA", "Mexico", ...16 teams...],
        "qf":    ["USA", "Mexico", ...8 teams...],
        "sf":    ["USA", "Brazil", "France", "Argentina"],
        "final": ["Brazil", "France"],
        "winner": ["Brazil"]
      },
      "goldenBoot": "Kylian Mbappé"
    },
    "phase2": {
      "bracket": {
        "r16":   [...16 teams...],
        "qf":    [...8 teams...],
        "sf":    [...4 teams...],
        "final": [...2 teams...],
        "winner": ["Argentina"]
      },
      "goldenBoot": "Lionel Messi"
    }
  }
}
```

### `wc2026/results` (map document)
Written by admin panel or Cloud Function.
```json
{
  "groups": {
    "A": ["USA", "England", "Panama", "Bolivia"],
    ...
  },
  "thirdPlaceQualifiers": ["Poland", "Morocco", "Japan", ...8 teams...],
  "bracket": {
    "r32":   [...32 actual R32 winners...],
    "r16":   [...16 actual R16 winners...],
    "qf":    [...8 actual QF winners...],
    "sf":    [...4 actual SF winners...],
    "final": [...2 actual finalists...],
    "winner": ["Argentina"]
  },
  "startedGroups": ["A", "B", "C"],
  "goldenBoot": "Lionel Messi",
  "phase2Unlocked": false
}
```

### `wc2026/leagues` (map document)
Keyed by 5-letter league code.
```json
{
  "K7X2P": {
    "name": "Work Gang",
    "members": ["uid_abc123", "uid_def456"],
    "createdBy": "uid_abc123",
    "createdByName": "Rishi D"
  }
}
```

### `wc2026/tournament` (map document)
Written only by Cloud Function. Never by client.
```json
{
  "groups": [...group standings...],
  "fixtures": [...upcoming and recent matches...],
  "bracket": {...knockout results...},
  "scorers": [...top scorers...],
  "lastSync": 1718000000000
}
```

### `wc2026picks/{uid}` (per-user document)
Full picks stored here for retrieval on login.
Same schema as the player entry in `wc2026/players`.

---

## 2026 Format — Key Facts

- **48 teams**, **12 groups** of 4
- **32 teams advance**: 12 group winners + 12 runners-up + **8 best third-placed teams**
- Third-place tiebreaker: points → goal difference → goals scored → fair play → FIFA ranking
- **R32 bracket seeding**: 495 pre-defined FIFA scenarios. Matchups not confirmed until all 72 group games finish.
- Round of 32 → R16 → QF → SF → Third-place playoff → Final

## Bracket Seeding Complexity

The R32 seeding is the hardest part to model. Approach:

**Phase 1 (pre-tournament)**: Users predict groups fully (1st/2nd/3rd/4th).
They also pick which 8 of the 12 third-placed teams advance.
The bracket is then auto-seeded using simplified rules (1A vs 2B etc)
as a best approximation — exact seeding depends on which groups the
thirds come from (FIFA's 495 scenarios).

**Phase 2 (after group stage)**: Real R32 bracket is known. Users predict
from R16 onwards with the actual teams. 5pts flat per correct pick.

**Admin**: After group stage ends, admin enters the real R32 matchups
in the results doc. Phase 2 is then unlocked.

---

## Scoring Engine

`calcScore(playerData, results)` runs entirely client-side.
Called on every Firestore snapshot update.
Returns `{ total, p1Group, p1ThirdQual, p1KO, p2, gb, detail }`.

No server-side score storage needed for display.
The Cloud Function optionally writes computed scores to `wc2026/scores`
for fast sorting at scale (>500 players).

---

## Rolling Score Updates

1. Match finishes
2. Cloud Function runs (within 60 min) or admin saves manually
3. `wc2026/results` updated in Firestore
4. All client Firestore listeners fire simultaneously
5. `calcScore()` re-runs for every player in the leaderboard
6. UI updates with no page refresh needed

---

## Responsive Layout

- **Mobile** (< 37.5rem): Single column, full-width tabs (sticky bottom), touch drag for groups
- **Desktop** (≥ 37.5rem): `max-width: 60%` of viewport; tabs sticky at bottom of the app container

The 60% breakpoint uses relative units so the layout is device-agnostic. No two-column layout yet — that remains a future task.

---

## Tab Navigation & `setMiniBanner`

The bottom tab bar has 5 tabs: Home · Predict/My Picks · World Cup · Standings · Leagues.

Tab switches call `setMiniBanner(tabName)` which shows a compact logo bar on every non-home tab and hides it on Home. This function is called from both the tab click listener and from `navTo()` (the programmatic navigation helper used by in-app buttons).

`navTo('home')` also calls `renderHomeTab()` directly, so navigating home from the mini banner correctly re-renders the home content.

---

## `hasPicks` Detection

Two signals are OR'd together to determine whether a user has submitted picks:

```js
const hasPicks = !!myPicks.phase1SubmittedAt || !!(currentUser && allPlayers[currentUser.uid]);
```

**Why two signals?**
- `phase1SubmittedAt` is set when a user saves picks after the field was introduced (v4.2.0)
- `allPlayers` (`wc2026/players` Firestore doc) only contains users who have *actually saved picks* — it is NOT populated for new users who haven't submitted yet (unlike `myPicks.phase1.groups` which is always pre-filled by `defaultGroups()`)
- Legacy users who saved before `phase1SubmittedAt` existed are caught by the `allPlayers` check

This pattern is used in three places: `renderHomeTab()`, `renderHomeHeader()`, and `updatePicksTabLabel()`.
