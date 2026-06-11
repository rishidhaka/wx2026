# AI Context — FIFA 2026 Prediction League

This file is for resuming work with an AI assistant (Claude or otherwise).
Paste this file's contents at the start of a new chat to restore full context.

---

## What This Project Is

A football prediction league web app for FIFA World Cup 2026.
Users sign in with Google, submit predictions, compete on leaderboards.
Single HTML file frontend, Firebase backend, no framework.

**Live URL**: `https://world-cup-2026-e1a0b.web.app`
**Firebase project**: `world-cup-2026-e1a0b`
**GitHub repo**: `wc2026-predictor`

---

## Current State (as of last session)

### Completed ✅
- Google Sign-In (Firebase Auth)
- Firestore real-time sync
- Phase 1 picks: group drag-to-rank, bracket seeding, golden boot
- Phase 2 (Second Chance): unlocks post-group-stage, real R16 bracket, 5pts flat
- Mini leagues with 5-letter codes
- Global leaderboard with score breakdown
- Live tournament tab (groups/fixtures/bracket/scorers — awaits Cloud Function)
- Admin panel: phase control, manual result entry
- Scoring engine: `calcScore(playerData, results)` — client-side, full detail
- Full test suite (10 suites, ~75 tests)
- Pen test suite (6 suites, 30 tests)
- Firestore security rules
- Firebase Cloud Function for live data (functions/index.js)
- Full documentation suite in docs/

### In Progress / Next Up 🔄
- **Third-place qualifier picks** (needs UI + scoring): users pick which 8 of 12 third-placed teams advance (2pts each)
- **Desktop responsive layout**: two-column grid for screens ≥ 1024px
- **Group scoring update**: award 1pt for 3rd place correct (currently only 1st/2nd)
- **R32 seeding with thirds**: integrate third-place teams into bracket seeding logic

### Known Issues 🐛
- R32 seeding uses simplified 1A-vs-2B logic — doesn't implement FIFA's 495 third-place scenarios
- Desktop shows narrow single column (mobile-first, not yet responsive for desktop)
- Max score shown as 180 in some places — correct max is 178pts Phase 1 + 80pts Phase 2 = 258pts

---

## 2026 Tournament Format (Critical)

48 teams, 12 groups of 4.
**32 teams advance**: 12 group winners + 12 runners-up + **8 best third-placed teams**.

Third-place tiebreaker order:
1. Points
2. Goal difference
3. Goals scored
4. Fair play (fewest cards)
5. FIFA ranking

R32 seeding: 495 pre-defined FIFA scenarios depending on which groups the 8 thirds come from.
Bracket only confirmed after all 72 group games finish.

Path to win: 3 group + R32 + R16 + QF + SF + Final = 8 games total.

---

## Scoring System (Complete)

### Phase 1
- Group 1st correct: 1pt (12 max)
- Group 2nd correct: 1pt (12 max)
- Group 3rd correct: 1pt (12 max) ← NOT YET IMPLEMENTED
- Third-place qualifier correct: 2pts × 8 = 16pts ← NOT YET IMPLEMENTED
- R32 winner correct: 2pts (32 max)
- R16 winner correct: 3pts (24 max)
- QF winner correct: 5pts (20 max)
- SF winner correct: 10pts (20 max)
- Final winner: 20pts
- Golden Boot: 10pts
- **Phase 1 max: 178pts**

### Phase 2 (Second Chance, unlocks post-group-stage)
- Any KO pick correct: 5pts flat
- R16 (8) + QF (4) + SF (2) + Final (1) = 75pts max
- Golden Boot update: 5pts
- **Phase 2 max: 80pts**

**Combined max: 258pts**

---

## Data Schema

### Firestore Collections
```
wc2026/players    → { [uid]: { name, photoURL, email, phase1, phase2 } }
wc2026/results    → { groups, thirdPlaceQualifiers, bracket, goldenBoot, phase2Unlocked }
wc2026/leagues    → { [code]: { name, members:[uid], createdBy, createdByName } }
wc2026/tournament → { groups, fixtures, bracket, scorers, lastSync } (Cloud Fn only)
wc2026/scores     → { [uid]: totalScore } (Cloud Fn only)
wc2026picks/{uid} → { phase1, phase2, name, photoURL, email }
```

### picks.phase1 schema
```json
{
  "groups": { "A": ["USA","England","Panama","Bolivia"], ...12 groups },
  "thirdPlaceQualifiers": ["Team1", ..., "Team8"],
  "bracket": { "r32":[...32], "r16":[...16], "qf":[...8], "sf":[...4], "final":[...2], "winner":["X"] },
  "goldenBoot": "Player Name"
}
```

### picks.phase2 schema
```json
{
  "bracket": { "r16":[...16], "qf":[...8], "sf":[...4], "final":[...2], "winner":["X"] },
  "goldenBoot": "Player Name"
}
```

---

## Colour System
```
--navy: #0d1b2a       (background)
--navy-card: #111f2f  (cards)
--navy-border: #1e3045
--amber: #f5a623      (primary CTA, active, scores)
--pitch: #1a3a2a      (selected state)
--green: #2ecc71      (correct, success)
--red: #e74c3c        (wrong, error)
--phase2: #6c3fc7     (Second Chance purple)
--phase2-light: #8b5cf6
--muted: #7a9ab5      (secondary text)
--gold/silver/bronze: rankings
```

---

## Firebase Config (already in index.html)
```js
const firebaseConfig = {
  apiKey: "AIzaSyCdvfS5SvUcGav26RtMmBI8cY7KLCuy4dA",
  authDomain: "world-cup-2026-e1a0b.firebaseapp.com",
  projectId: "world-cup-2026-e1a0b",
  storageBucket: "world-cup-2026-e1a0b.firebasestorage.app",
  messagingSenderId: "888615445320",
  appId: "1:888615445320:web:a721b6bf9a3cd939f1897d"
};
```

---

## Key Functions in index.html

| Function | Purpose |
|---|---|
| `calcScore(playerData, results)` | Scoring engine — returns `{total, p1Group, p1KO, p2, gb, detail}` |
| `seedBracketFromGroups(groups)` | R32 seeding from user's group picks |
| `flagFor(teamName)` | Returns emoji flag for a team name |
| `defaultGroups()` | Returns default group order (all 48 teams) |
| `renderPicksView()` | Renders the 3-step picks wizard |
| `renderGroupsStep()` | Drag-to-rank group stage UI |
| `renderBracketStep(isPhase2)` | Visual bracket UI |
| `renderPhase2Step()` | Second Chance UI (locked/unlocked) |
| `pickBracket(round, idx, team, isPhase2)` | Handle bracket tap + propagate winner |
| `clearDownstream(bracket, rounds, from, slot)` | Clear invalid downstream picks |
| `savePicks(isPhase2)` | Save to Firestore |
| `calcScore(playerData, results)` | Full scoring with detail breakdown |
| `renderGlobal()` / `renderLeaderboard(elId, players)` | Leaderboard rendering |
| `signIn()` / `signOut()` | Firebase Auth |
| `startListeners()` | Set up all Firestore onSnapshot listeners |

---

## Groups Data (all 48 teams)
```
A: USA, England, Panama, Bolivia
B: Mexico, Ecuador, Jamaica, Venezuela
C: Argentina, Canada, Chile, Peru
D: France, Australia, Guatemala, Saudi Arabia
E: Spain, Colombia, Costa Rica, Morocco
F: Germany, Japan, Honduras, South Africa
G: Brazil, Uruguay, Paraguay, New Zealand
H: Portugal, Croatia, Algeria, South Korea
I: Netherlands, Serbia, Nigeria, Cuba
J: Belgium, Turkey, Senegal, Egypt
K: Poland, Switzerland, Qatar, Cameroon
L: Italy, Denmark, Iran, Tunisia
```

NOTE: Groups are based on pre-draw assumptions. Verify against official FIFA draw results before tournament starts.

---

## What To Tell Claude When Resuming

"I'm working on a FIFA 2026 prediction league web app. Here's the AI_CONTEXT.md file from the project repo: [paste this file]. The main app is index.html — a single-file vanilla JS + Firebase app. I need to [describe what you want to do next]."

Common next tasks:
- "Add the third-place qualifier picks step to the wizard"
- "Implement the desktop responsive layout"
- "Update the scoring engine to include 3rd place group picks"
- "Update the test suite for the new scoring rules"
- "Fix a bug where [describe bug]"
- "The groups data needs updating — here are the actual draw results: [paste]"
