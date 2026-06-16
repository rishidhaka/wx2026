# AI Context — FIFA 2026 Prediction League

This file is for resuming work with an AI assistant (Claude or otherwise).
Read this entire file before touching the codebase. It describes the current
state of the app, all key design decisions, and the gotchas that have already
cost debugging time.

---

## What This Project Is

A football prediction league web app for FIFA World Cup 2026.
Users sign in with Google, submit predictions, compete on leaderboards.
Single HTML file frontend (`index.html`), Firebase backend, no framework, no build step.

**Live URL**: `https://world-cup-2026-e1a0b.web.app`
**Firebase project**: `world-cup-2026-e1a0b`
**GitHub repos**:
- `rishidhaka/wx2026` — upstream/production (origin remote)
- `siddhaka/wx2026` — active development fork (fork remote)

All UI work happens on `siddhaka/wx2026:main`; PRs go to `rishidhaka:main`.
Never commit directly to `rishidhaka/wx2026`.

---

## Current State (as of v4.5.0, June 15, 2026)

### Completed ✅
- Google Sign-In (`signInWithPopup`) — Firebase Auth
- Firestore real-time sync via `onSnapshot` listeners
- Phase 1 picks wizard: group drag-to-rank → third-place qualifiers → bracket → golden boot
- Phase 2 (Second Chance): unlocks post-group-stage, real R16 bracket, 5pts flat per pick
- One-time submission lock: `phase1SubmittedAt` timestamp set on first save; picks locked after
- Mini leagues with 5-letter codes + URL-based invites (`?league=XXXXX`)
- Global leaderboard with per-player score breakdown modal
- Home tab: today's fixtures, top-3 leaderboard preview, group standings, top scorers
- World Cup tab: Groups (arrow nav A–L), Knockouts, Scorers, Results (date arrow nav)
- Admin panel: phase control, manual result entry
- Scoring engine: `calcScore(playerData, results)` — client-side, returns full detail
- Firebase Cloud Function: `syncWorldCup` (every 60 min, football-data.org)
- GitHub Actions: every-minute polling with smart skip logic (worldcup26.ir primary, football-data.org fallback)
- Full documentation suite in `docs/`
- `2026_FIFA_World_Cup_emblem.svg` — WC 2026 logo used in login and home banner

### Known Issues / Not Yet Done 🐛
- **Safari sign-in failures**: `signInWithPopup` routes through `world-cup-2026-e1a0b.firebaseapp.com` as an intermediary; Safari ITP partitions that cross-origin sessionStorage causing auth to fail for some users. Fix: set `authDomain` in `firebaseConfig` to the app's own production domain and add it to Firebase Console → Authentication → Authorized Domains. Code-level fix is one line in `firebaseConfig`.
- **R32 bracket seeding**: simplified 1A-vs-2B seeding is used; exact 495 FIFA third-place scenarios not implemented
- **Full two-column desktop layout**: not yet built; current desktop is single-column at 60% width
- **`startedGroups` accuracy**: group pick points are only awarded for groups where games have started, tracked via `results.startedGroups`; relies on Cloud Function + admin keeping this up to date

---

## Repository Structure

```
wx2026/
├── index.html                          ← Entire frontend (HTML + CSS + JS, single file)
├── 2026_FIFA_World_Cup_emblem.svg      ← Official WC 2026 logo (used in login + banner)
├── data/
│   └── wc2026.json                     ← Written by GitHub Actions; never commit manually
├── scripts/
│   └── fetch-data.js                   ← GitHub Actions data fetcher (worldcup26.ir + football-data.org)
├── functions/
│   └── index.js                        ← Cloud Function (syncWorldCup, every 60 min)
├── firestore.rules                     ← Security rules
├── firebase.json                       ← Hosting + caching config
├── .github/workflows/
│   └── update-data.yml                 ← Runs every minute, smart-gated
└── docs/
    ├── AI_CONTEXT.md                   ← This file
    ├── ARCHITECTURE.md                 ← Data models, Firestore schema, key patterns
    ├── DESIGN.md                       ← Colour tokens, components, layout
    ├── CHANGELOG.md                    ← Version history
    ├── API.md                          ← worldcup26.ir + football-data.org integration
    ├── SCORING.md                      ← Complete scoring rules
    ├── SECURITY.md                     ← Firestore rules + security model
    └── SETUP.md                        ← Step-by-step deploy guide

DO NOT commit: scripts/test-*.js, data/wc2026.json (manual), API keys, service account JSON
```

---

## Tab Structure

Bottom tab order (left → right):
1. 🏠 Home (`home`)
2. ✏️ Predict / My Picks (`picks`) — label switches via `updatePicksTabLabel()`
3. ⚽ World Cup (`live`)
4. 🏆 Standings (`global`)
5. 👥 Leagues (`leagues`)

The 2nd tab label reads "Predict" for new users and "My Picks" for users who have submitted picks. This is driven by `updatePicksTabLabel()` which reads the same `hasPicks` signal as the home card.

---

## `hasPicks` Detection — Critical Pattern

```js
const hasPicks = !!myPicks.phase1SubmittedAt || !!(currentUser && allPlayers[currentUser.uid]);
```

Used in three places: `renderHomeTab()`, `renderHomeHeader()`, `updatePicksTabLabel()`.

**Why two signals?**
1. `myPicks.phase1SubmittedAt` — set on first save (v4.2.0+). New users have this as null.
2. `allPlayers[currentUser.uid]` — `wc2026/players` Firestore doc contains ONLY users who have actually saved picks. Legacy users who saved before `phase1SubmittedAt` existed are caught here.

Do NOT use `Object.keys(myPicks.phase1.groups).length > 0` — `defaultGroups()` pre-populates all groups for every user, so this is always truthy and cannot distinguish new from returning users.

---

## Home Banner Layout

The home banner uses a 3-column CSS grid:

```css
.home-header-row {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 12px;
}
```

- **Col 1**: avatar circle + greeting ("Good evening," / first name)
- **Col 2**: `2026_FIFA_World_Cup_emblem.svg` at 80px, `justify-self: center`
- **Col 3**: rank chip (`#N`) for ranked users; empty div for new users

The rank chip is only shown when `myRank !== "—" && myRank !== 0`. New users see nothing in col 3. The "Make Picks" CTA is only in the home content card, not the banner — this was a deliberate decision to keep the banner clean.

Banner background: `#2D333B` — lightened from `--surface` (`#161B22`) specifically because the WC logo has a lot of black in it and was invisible against the dark default surface.

---

## Mini Banner (Non-Home Tabs)

```html
<div id="mini-banner" class="mini-banner" style="display:none" onclick="navTo('home')">
  <img src="2026_FIFA_World_Cup_emblem.svg" alt="FIFA World Cup 2026">
</div>
```

Placed inside `.desktop-center` but **outside** all `.view` divs, so it persists across tab switches.

`setMiniBanner(tabName)` shows it on any non-home tab (`display: flex`) and hides it on home (`display: none`). Called from both the tab click listener and `navTo()`.

---

## Colour System

Two palettes co-exist in `index.html`. Do not mix them:

**Global UI** (home, standings, leagues, mini banner):
```css
--bg: #0E1117; --surface: #161B22; --elevated: #1C2128; --border: #21262D;
--gold: #F5A623; --gold-tint: rgba(245,166,35,0.12); --gold-border: rgba(245,166,35,0.25);
--text: #E6EDF3; --muted: #7a9ab5; --live: #2ecc71; --red: #e74c3c;
```

**Picks wizard / bracket** (uses `--navy-*`, `--amber`, `--pitch`):
```css
--navy: #0d1b2a; --navy-card: #111f2f; --navy-border: #1e3045;
--pitch: #1a3a2a; --amber: #f5a623; --green: #2ecc71; --white: #f0f4f8;
```

---

## Key Functions in index.html

| Function | Purpose |
|---|---|
| `calcScore(playerData, results)` | Scoring engine — returns `{total, p1Group, p1ThirdQual, p1KO, p2, gb, detail}` |
| `seedBracketFromGroups(groups, thirds)` | R32 seeding from user's group picks |
| `flagFor(teamName)` | Returns emoji flag; includes all API name variants |
| `defaultGroups()` | Returns default group order (all 48 teams); always populates `myPicks.phase1.groups` for new users |
| `renderPicksView()` | Renders the 3-step picks wizard |
| `renderGroupsStep()` | Drag-to-rank group stage UI with collapsible chevron |
| `renderBracketStep(isPhase2)` | Visual bracket UI with round-by-round arrow nav |
| `renderHomeTab()` | Home tab: calls `renderHomeHeader()` then builds content |
| `renderHomeHeader()` | Renders the 3-column banner into `#home-header-block` |
| `updatePicksTabLabel()` | Sets tab 2 label to "Predict" or "My Picks" |
| `setMiniBanner(tabName)` | Shows/hides `#mini-banner` based on active tab |
| `navTo(tab, liveSub)` | Programmatic tab switch; calls `setMiniBanner` + render |
| `renderLiveGroups(el, groups)` | World Cup groups: single-group view with ‹/› arrows |
| `shiftGroup(delta)` | Increments `activeGroupPill` and re-renders groups |
| `renderLiveFixtures(el, fixtures)` | Results tab with date ‹/› navigation |
| `shiftResultsDate(delta)` | Increments `resultsDateIndex` and re-renders fixtures |
| `toggleGroup(key)` | Collapses/expands a group block in the picks wizard; toggles chevron |
| `pickBracket(round, idx, team, isPhase2)` | Bracket tap + propagate winner forward |
| `clearDownstream(bracket, rounds, from, slot)` | Clears invalid downstream picks |
| `savePicks(isPhase2)` | Save picks to Firestore; sets `phase1SubmittedAt` on first save |
| `renderGlobal()` / `renderLeaderboard(elId, players)` | Leaderboard rendering |
| `signIn()` / `signOut()` | Firebase Auth (popup only — no redirect) |
| `startListeners()` | Set up all Firestore `onSnapshot` listeners |
| `isPhase1Open()` | Returns true if current time is before June 17 deadline |

---

## Data Schema

### Firestore Collections
```
wc2026/players    → { [uid]: { name, photoURL, email, phase1, phase2 } }
                    Only contains users who have SAVED picks. New users are absent.
wc2026picks/{uid} → { phase1, phase2, name, photoURL, email, phase1SubmittedAt }
wc2026/results    → { groups, thirdPlaceQualifiers, bracket, goldenBoot, phase2Unlocked, startedGroups }
wc2026/leagues    → { [code]: { name, members:[uid], createdBy, createdByName } }
wc2026/tournament → { groups, fixtures, bracket, scorers, lastSync } (Cloud Function only)
wc2026/scores     → { [uid]: totalScore } (Cloud Function only, for fast leaderboard sort at scale)
```

### picks.phase1 schema
```json
{
  "groups": { "A": ["USA","England","Panama","Bolivia"], ...12 groups },
  "thirdPlaceQualifiers": ["Team1", ..., "Team8"],
  "bracket": {
    "r32": [...32], "r16": [...16], "qf": [...8],
    "sf": [...4], "final": [...2], "winner": ["X"]
  },
  "goldenBoot": "Player Name"
}
```

### `wc2026picks/{uid}` additional fields
```json
{
  "phase1SubmittedAt": "2026-06-13T14:22:00.000Z"
}
```

---

## 2026 Tournament Format

48 teams, 12 groups of 4.
**32 teams advance**: 12 group winners + 12 runners-up + **8 best third-placed teams**.

Third-place tiebreaker: points → goal difference → goals scored → fair play → FIFA ranking.

R32 seeding: 495 pre-defined FIFA scenarios depending on which groups the 8 thirds come from. App uses simplified seeding (1A vs 2B etc) as a best approximation.

Path to win: 3 group + R32 + R16 + QF + SF + Final = 8 games total.

---

## Groups (all 48 teams)
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

---

## Scoring System

### Phase 1
- Group 1st correct: 1pt (12 max)
- Group 2nd correct: 1pt (12 max)
- Group 3rd correct: 1pt (12 max)
- Third-place qualifier correct: 2pts × 8 = 16pts max
- R32 winner correct: 2pts (32 max)
- R16 winner correct: 3pts (24 max)
- QF winner correct: 5pts (20 max)
- SF winner correct: 10pts (20 max)
- Final winner: 20pts
- Golden Boot: 10pts
- **Phase 1 max: ~178pts**

### Phase 2 (Second Chance, unlocks ~June 27)
- R16/QF/SF/Final correct: 5pts flat each (75pts max)
- Golden Boot update: 5pts
- **Phase 2 max: 80pts**

**Combined max: ~258pts**

Points are only awarded for groups where at least one game has been played (`results.startedGroups`).

---

## Firebase Config (in index.html)
```js
const firebaseConfig = {
  apiKey: "AIzaSyCdvfS5SvUcGav26RtMmBI8cY7KLCuy4dA",
  authDomain: "world-cup-2026-e1a0b.firebaseapp.com",  // ← known Safari ITP issue; see Known Issues
  projectId: "world-cup-2026-e1a0b",
  storageBucket: "world-cup-2026-e1a0b.firebasestorage.app",
  messagingSenderId: "888615445320",
  appId: "1:888615445320:web:a721b6bf9a3cd939f1897d"
};
```

Firebase SDK: v10.12.0 compat (`firebase-app-compat.js`, `firebase-auth-compat.js`, `firebase-firestore-compat.js`)

---

## Toast System

`.toast` uses `visibility: hidden` (not `display: none`) as the hidden default. This is intentional — `display: none` prevents CSS `transform` transitions from firing, causing the toast to appear without animation. `visibility: hidden` preserves the layout space and allows the `translateY` slide-in transition on `.toast.show`.

---

## What To Tell Claude When Resuming

"I'm working on a FIFA 2026 prediction league web app. Here's the `docs/AI_CONTEXT.md` from the project — please read it fully before making any changes. The main app is `index.html` — a single-file vanilla JS + Firebase app. I need to [describe what you want to do next]."

Common next tasks:
- "Fix the Safari sign-in issue — we need to change authDomain to the production domain"
- "Implement the full two-column desktop layout"
- "Update the scoring engine to include 3rd place group picks"
- "The groups data needs updating — here are the actual draw results: [paste]"
- "Add push notifications when scores update"
