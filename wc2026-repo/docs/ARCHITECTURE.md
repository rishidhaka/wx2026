# Architecture

## Overview

Single-page app. No build step. One HTML file contains all HTML, CSS, and JS.
Firebase provides auth, database, hosting, and serverless functions.

```
Browser ──── Firebase Auth (Google) ─────────────── Google Identity
    │
    ├── Firestore (real-time listeners)
    │     ├── wc2026/players      (all player picks + identity)
    │     ├── wc2026/results      (confirmed match results)
    │     ├── wc2026/leagues      (mini league membership)
    │     ├── wc2026/tournament   (live data written by Cloud Function)
    │     └── wc2026picks/{uid}   (full picks doc per user)
    │
    └── Firebase Hosting ──── index.html (the app)

Cloud Function (hourly)
    └── API-Football → Firestore wc2026/tournament + wc2026/results
```

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

- **Mobile** (< 600px): Single column, full-width tabs, touch drag for groups
- **Tablet** (600–1024px): Wider cards, more breathing room
- **Desktop** (> 1024px): Two-column layout — leaderboard left, picks/live right; bracket displayed full-width horizontally
