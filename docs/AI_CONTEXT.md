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

## Current State (as of v4.6.0, June 16, 2026)

### Completed ✅
- Google Sign-In (`signInWithPopup`) — Firebase Auth
- Firestore real-time sync via `onSnapshot` listeners
- Phase 1 picks wizard: group drag-to-rank → third-place qualifiers → bracket → golden boot
- Phase 2 (Second Chance): unlocks post-group-stage, real R16 bracket, 5pts flat per pick
- One-time submission lock: `phase1SubmittedAt` timestamp set on first save; `phase1` becomes immutable client-side after (see Known Issues — not yet enforced server-side)
- **My Picks view-only mode**: once submitted, picks render read-only with green/red correctness highlighting instead of a blocking message — see "Read-Only Picks View" below
- **Tappable match goal-scorer modal**: tap any match pill/fixture row to see scoreboard + goal scorers with minutes — see "Match Modal & Goal Data" below
- Mini leagues with 5-letter codes + URL-based invites (`?league=XXXXX`)
- Global leaderboard with per-player score breakdown modal
- Home tab: today's fixtures, top-3 leaderboard preview, group standings, top scorers
- World Cup tab: Groups (arrow nav A–L), Knockouts, Scorers, Results (date arrow nav)
- Admin panel: phase control, manual result entry
- Scoring engine: `calcScore(playerData)` — client-side, returns full detail; uses `canonicalTeam()`/`teamsMatch()` to reconcile team-name spelling differences between picks and results (see Known Issues — fixed this session)
- Firebase Cloud Function: `syncWorldCup` (every 60 min, football-data.org)
- GitHub Actions: every-5-minutes polling with smart skip logic (worldcup26.ir primary, football-data.org fallback), `workflow_dispatch` for manual/external triggering, restricted to the upstream repo only (see "GitHub Actions" below)
- Full documentation suite in `docs/`
- `2026_FIFA_World_Cup_emblem.svg` — WC 2026 logo used in login and home banner

### Known Issues / Not Yet Done 🐛
- **Safari sign-in failures**: `signInWithPopup` routes through `world-cup-2026-e1a0b.firebaseapp.com` as an intermediary; Safari ITP partitions that cross-origin sessionStorage causing auth to fail for some users. Fix: set `authDomain` in `firebaseConfig` to the app's own production domain and add it to Firebase Console → Authentication → Authorized Domains. Code-level fix is one line in `firebaseConfig`.
- **R32 bracket seeding**: simplified 1A-vs-2B seeding is used; exact 495 FIFA third-place scenarios not implemented
- **Full two-column desktop layout**: not yet built; current desktop is single-column at 60% width
- **`startedGroups` accuracy**: group pick points are only awarded for groups where games have started, tracked via `results.startedGroups`; relies on Cloud Function + admin keeping this up to date
- **Group 4th-place picks score points, contradicting `docs/SCORING.md`** (found this session, pre-existing): `calcScore()` awards 1pt for a correct 4th-place pick same as 1st/2nd/3rd, making groups worth 48pts not the documented 36pts. Was invisible until the new read-only picks view made all four positions visible with hit/miss colouring. Decided to keep `SCORING.md` as the source of truth (3 positions) and treat the 4th-place scoring as a bug to fix later — touching it now would change live leaderboard scores mid-competition without a plan for already-awarded points. Do not silently "fix" this without raising it first.
- **Firestore security gaps found via audit this session, not yet fixed** — full detail in `docs/SECURITY.md`, including drafted (then reverted) fix code:
  - `wc2026picks/{userId}` only enforces "picks lock once submitted" in client JS — a direct Firestore SDK call from the browser console bypasses it entirely.
  - `wc2026/leagues` allows any signed-in user to write the whole shared leagues document; the "enforced in app logic" comment provides no protection against direct SDK calls.
  - `ADMIN_UID` placeholder (`"YOUR_ADMIN_UID_HERE"`) was never replaced with a real UID, in both `index.html` and `firestore.rules` — the admin tab is permanently hidden and the results-write rule never matches any real user.
  - `ADMIN_PASS` is a hardcoded plaintext password in client JS, visible via View Source.
  - `wc2026/players` write rule probably breaks for 2+ players (uses `hasOnly` against the full resulting doc instead of diffing affected keys).
  - Reason these aren't fixed yet: deploying/testing Firestore rule changes needs Firebase Console access the user didn't have when this was found. Don't re-attempt without checking in — the fix was already drafted once.

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
│   ├── update-data.yml                 ← Runs every 5 min, smart-gated, upstream repo only
│   ├── force-update-data.yml           ← Manual-only, bypasses the game-window gate (FORCE_FETCH=true)
│   ├── firebase-hosting-merge.yml      ← Deploy on push to main, upstream repo only
│   └── firebase-hosting-pull-request.yml ← Deploy preview on PR, upstream repo only
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

## Match Modal & Goal Data

Tapping a match pill (Home tab) or fixture row (World Cup → Results) calls `showMatchModal(${f.id})`, which looks up the fixture in the global `fixtureMap` (id → fixture, rebuilt in `applyTournamentData` on every data load) and renders a scoreboard + per-team goal-scorer list into `#match-modal`.

**Where goal data comes from**: `scripts/fetch-data.js`'s `fetchFromWC26()` parses worldcup26.ir's `home_scorers`/`away_scorers` strings via `parseGoalScorers()` into `homeGoals`/`awayGoals` arrays of `{name, minute, tag, team, og}`. `tag` is `"(P)"`/`"(OG)"`/`""` and is attached to the **timestamp**, not the name — this matters because a player who scores both a penalty and a regular goal in the same match needs to group under one name in the modal (and count as one entry, not two, on the top-scorers leaderboard).

**`fetchFromFootballData()` (the fallback path, used only if worldcup26.ir fails entirely) does NOT populate `homeGoals`/`awayGoals`** — if you're debugging "why don't I see goal scorers," check which path actually ran.

**Critical gotcha**: `wc2026/tournament` (written by the Cloud Function) also does NOT include `homeGoals`/`awayGoals` — only `data/wc2026.json` does. Since the Cloud Function's `onSnapshot` listener can fire *after* the JSON load and overwrite `fixtureMap`, `applyTournamentData` explicitly carries forward `homeGoals`/`awayGoals` from the previous `fixtureMap` entry when the incoming fixture doesn't have them (`f.homeGoals !== undefined ? f.homeGoals : (prev && prev.homeGoals)`). Don't remove this carry-forward without also fixing the Cloud Function to write goal data, or the modal will regress to "Goal details updating…" for everyone.

**Own goals the API doesn't flag**: `OG_OVERRIDES` in `fetch-data.js` is a manual list of `{gameId, name}` pairs for own goals the API credits to the wrong team without an `(OG)` marker (one confirmed case: Belgium 1-1 Egypt, Mohamed Hany). Add entries here as they're discovered — there's no general way to detect this from the API alone.

---

## Read-Only Picks View

Once `myPicks.phase1SubmittedAt` is set, "My Picks" no longer blocks access behind a message — `renderPicksView()` always renders the wizard tabs (Groups/Thirds/Knockouts/Phase 2), but `renderGroupsStep()`, `renderThirdPlaceStep()`, and `renderBracketStep(false)` each check `myPicks.phase1SubmittedAt` and switch to a non-interactive rendering: no `draggable`, no `onclick` on bracket buttons, golden boot shown as static text instead of an `<input>`. Phase 2 (`renderBracketStep(true)`) is unaffected and stays fully editable.

Correctness highlighting reuses `calcScore(myPicks).detail` — the same hit/miss object that's always existed for the leaderboard score-breakdown modal, just never previously rendered against the full picks UI:
- `detail.p1Group[grp+"_1st"/"_2nd"/"_3rd"/"_4th"]` → group position rows
- `detail.p1ThirdQual["q"+i]` → third-place qualifier rows (only for `i < 8`, i.e. teams actually picked as qualifiers; ranks 9–12 never get a colour since they don't score)
- `detail.p1KO[round+"_"+matchIdx]` → bracket match buttons
- `"hit"` → `.pick-correct` (green), `"miss"` → `.pick-wrong` (red), absent key → no colour (not yet decided, or not a scoring pick)

**The lock itself is enforced in three places in client JS** (`pickBracket`, `saveGroupsAndNext`, `saveThirdPlaceAndNext` all check `myPicks.phase1SubmittedAt` and bail with a toast) as defense-in-depth beyond just hiding the editable UI — but this is still not enforced at the Firestore rules layer. See Known Issues above and `docs/SECURITY.md`.

---

## Colour System

One palette, defined once in `:root`. The picks wizard/bracket's `--navy-*`/`--amber`/`--pitch`/`--white`/`--green` names are now just backwards-compat aliases onto the same tokens (kept so older CSS selectors don't need renaming) — there are not two independent hex value sets to keep in sync:

```css
--bg:#0E1117; --surface:#161B22; --elevated:#1C2128; --border:#21262D;
--gold:#F5A623; --gold-tint:rgba(245,166,35,0.12); --gold-border:rgba(245,166,35,0.25);
--text:#F0F6FC; --muted:#7D8590;
--live:#22C55E; --live-tint:rgba(34,197,94,0.12);
--red:#F85149; --red-tint:rgba(248,81,73,0.12);
--phase2:#A78BFA; --phase2-light:#C4B5FD;
/* Aliases: --navy→--bg, --navy-card→--surface, --navy-border→--border,
   --white→--text, --green→--live, --amber→--gold, --pitch:#0a2a1a (own value) */
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
| `showMatchModal(id)` / `closeMatchModal()` | Looks up `fixtureMap[id]`, renders scoreboard + grouped goal-scorer list |
| `canonicalTeam(name)` / `teamsMatch(a,b)` | Reconciles team-name spelling differences (e.g. "Côte d'Ivoire" vs "Ivory Coast") before comparing picks to results in `calcScore()` |

`renderGroupsStep()`, `renderThirdPlaceStep()`, `renderBracketStep(isPhase2)`, and `renderBracketGrid(rounds, bracket, isPhase2, locked, detail)` now all branch on `myPicks.phase1SubmittedAt` to render read-only with green/red correctness highlighting instead of editable drag/tap controls — see "Read-Only Picks View" below.

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

### `data/wc2026.json` fixture fields (NOT present in `wc2026/tournament` — see Match Modal section above)
```json
{
  "id": 15, "home": "Belgium", "away": "Egypt", "homeScore": 1, "awayScore": 1, "status": "fin",
  "homeGoals": [{"name": "Mohamed Hany", "minute": "66", "tag": "(OG)", "team": "Belgium", "og": true}],
  "awayGoals": [{"name": "Emam Ashour", "minute": "20", "tag": "", "team": "Egypt", "og": false}]
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

This is the real post-draw lineup, defined in `index.html`'s `WC_GROUPS` constant — any earlier version of this doc listing different teams was written before the actual draw and is wrong.
```
A: Mexico, South Africa, Korea Republic, Czechia
B: Canada, Bosnia and Herzegovina, Qatar, Switzerland
C: Brazil, Morocco, Haiti, Scotland
D: USA, Paraguay, Australia, Türkiye
E: Germany, Curaçao, Côte d'Ivoire, Ecuador
F: Netherlands, Japan, Sweden, Tunisia
G: Belgium, Egypt, IR Iran, New Zealand
H: Spain, Cabo Verde, Saudi Arabia, Uruguay
I: France, Senegal, Iraq, Norway
J: Argentina, Algeria, Austria, Jordan
K: Portugal, Congo DR, Uzbekistan, Colombia
L: England, Croatia, Ghana, Panama
```

**Team-name gotcha**: the names above (used throughout the picks wizard) don't always match what the live worldcup26.ir API returns for the same team — e.g. `WC_GROUPS` says "Korea Republic", the API says "South Korea"; "Côte d'Ivoire" vs "Ivory Coast"; "USA" vs "United States"; "Türkiye" vs "Turkey"; "IR Iran" vs "Iran"; "Cabo Verde" vs "Cape Verde"; "Czechia" vs "Czech Republic"; "Congo DR" vs "Democratic Republic of the Congo". Since `results.groups` (used for scoring) is synced from the live API, a strict string comparison would mark correct picks wrong. Fixed this session via `canonicalTeam()`/`teamsMatch()` in `calcScore()` — see Known Issues / v4.6.0 changelog. If you rename a `WC_GROUPS` entry or add a new team-name source, check whether `TEAM_NAME_ALIASES` needs a new entry.

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
