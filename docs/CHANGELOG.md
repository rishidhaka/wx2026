# Changelog

## v4.6.0 — Goal-Scorer Modal, Actions Reliability, View-Only Picks (June 16, 2026) ⚡ CURRENT

### Added
- **Tappable match goal-scorer modal**: tapping any match pill (Home tab) or fixture row (World Cup → Results tab) opens a modal with the scoreboard and a per-team list of goal scorers + minutes. New global `fixtureMap` (id → fixture) populated in `applyTournamentData`, looked up by `showMatchModal(id)`
  - Modal is a centred, fully-rounded card on screens ≥600px; unchanged bottom-sheet behaviour on phones/tablets (`@media (min-width:37.5rem)` override on `.match-modal-overlay`/`.match-modal`)
  - Multiple goals by the same scorer are grouped into a single row, with each timestamp keeping its own tag — e.g. `K. Havertz 45+5' (P), 88'` instead of two separate rows
  - Own goals and penalties render as `(OG)` / `(P)` attached to the specific goal's timestamp, not the player's name — this matters because tagging the *name* instead of the *timestamp* silently broke grouping (and double-counted goals on the top-scorers leaderboard) for any player with both a penalty and a regular goal in the same match
- **`scripts/fetch-data.js`**: `parseGoalScorers()` rewritten to extract minute, injury time (`45'+5'`), own goals (`(OG)`), and penalties (`(p)`/`(pen)`) from worldcup26.ir's `home_scorers`/`away_scorers` strings; results feed `homeGoals`/`awayGoals` on each fixture (previously these fields didn't exist at all — only a simpler name-only parse existed, used solely for the top-scorers list)
  - Fixed a parsing bug: some scorer strings use curly/smart quotes (`“ ” ‘ ’`) instead of straight quotes, which silently broke `JSON.parse` and dropped those goals entirely
  - `OG_OVERRIDES` manual list added for own goals the API doesn't flag itself (e.g. Belgium 1-1 Egypt — Mohamed Hany's goal is an OG, credited to Belgium, not flagged `(OG)` by the API)
  - worldcup26.ir's previous Arabic-script/garbled-transliteration scorer-name issue (Egypt, Saudi Arabia/Uruguay) was fixed **upstream by the API provider** — confirmed via live fetch; no client-side workaround needed
  - Bumped the worldcup26.ir axios timeout from 15s to 60s (15s was occasionally insufficient)
- **`.github/workflows/force-update-data.yml`**: new manual-only (`workflow_dispatch`) workflow that sets `FORCE_FETCH=true`, which makes `shouldFetchNow()` skip its game-window gate and fetch immediately — for refreshing `data/wc2026.json` right after a data-shape change instead of waiting for the next live game
- **My Picks — view-only mode for submitted Phase 1 picks**: previously, once `phase1SubmittedAt` was set (and before Phase 2 unlocked), "My Picks" showed a blocking "picks submitted and locked" message with no way to see what you'd actually picked. It now renders the real Groups/Thirds/Knockouts tabs read-only — no dragging, no tapping bracket buttons, golden boot shown as static text
  - Each pick is highlighted green if it already scored points, red if already proven wrong, and left uncoloured if not yet decided or not a scoring pick (e.g. teams ranked 9–12 in the third-place ranking, or groups with no games played yet) — driven directly by `calcScore()`'s existing `detail` hit/miss object
  - Added new CSS: `.pick-correct` / `.pick-wrong` (generic row highlight) and `.bracket-team-btn.selected.pick-correct` / `.selected.pick-wrong` (bracket button override)
  - The lock is now also enforced in `pickBracket()`, `saveGroupsAndNext()`, `saveThirdPlaceAndNext()` directly (checking `myPicks.phase1SubmittedAt`) as defense-in-depth, not just by hiding the UI — though see Known Issues below, this still isn't enforced at the Firestore rules layer
- **Fixed a real scoring bug, not just a display bug**: 8 teams had inconsistent name spellings between the picks wizard's static `WC_GROUPS` list and the live API feeding `results` — Korea Republic/South Korea, Czechia/Czech Republic, USA/United States, Türkiye/Turkey, Côte d'Ivoire/Ivory Coast, IR Iran/Iran, Cabo Verde/Cape Verde, Congo DR/Democratic Republic of the Congo. Since scoring compared these with strict `===`, a *correct* pick involving any of these teams was being scored as wrong, across 6 of 12 groups. Added `TEAM_NAME_ALIASES`/`canonicalTeam()`/`teamsMatch()` in `calcScore()` so both old (already-submitted) and future picks compare correctly regardless of which spelling was used on either side

### Changed
- **GitHub Actions cron frequency**: `update-data.yml` changed from every 1 minute to every 5 minutes (`*/5 * * * *`) — native GitHub scheduled cron can be delayed under load regardless of frequency, and an external trigger (cron-job.org calling the `workflow_dispatch` API) was set up as a more reliable supplement. The 5-min cadence is cheap either way since `shouldFetchNow()` smart-skips outside active game windows
- **`update-data.yml`, `firebase-hosting-merge.yml`, `firebase-hosting-pull-request.yml`**: all three now guard on `if: github.repository == 'rishidhaka/wx2026'` so they only run on the upstream/production repo. Previously the fork (`siddhaka/wx2026`) was independently running its own copy of all three on every push/schedule, wasting Actions minutes and API calls with no effect on the deployed site

### Known Issues / Found, Not Yet Fixed 🐛
- **Group 4th-place picks score points, contradicting `docs/SCORING.md`**: `calcScore()` awards 1pt for a correct 4th-place group pick, same as 1st/2nd/3rd — but `SCORING.md` documents only 3 scoring positions per group (36pts max for groups, 178pts Phase 1 max, 258pts combined max). This is **pre-existing**, not introduced this session — it was simply invisible while submitted picks were hidden behind the old "locked" message, and is now visible for the first time via the new read-only picks view (4th-place picks now visibly highlight green/red). The documented design (3 positions, no scoring for 4th) is the intended one; **the code currently contradicts it** — see `index.html`'s `calcScore()`, the `_4th` block in the group-picks loop. Not fixed yet: changing this affects live leaderboard scores for an active competition, so it needs a deliberate decision (fix forward only vs. recompute already-awarded points) before touching it.
- **Firestore security gaps found via audit, not yet fixed** (see `docs/SECURITY.md` for full detail and drafted-but-reverted fix code):
  - Picks lock (`phase1SubmittedAt` → `phase1` immutable) is enforced **only in client JS**. A user can bypass it with a direct Firestore SDK call from the browser console.
  - `wc2026/leagues` allows any signed-in user to write the entire shared leagues document — comments claim "enforced in app logic," which provides no real protection against direct SDK calls.
  - `ADMIN_UID` (`index.html`) and the matching UID in `firestore.rules` were never set to a real value (`"YOUR_ADMIN_UID_HERE"` placeholder) — the intended UID-gated admin boundary isn't actually wired up.
  - `ADMIN_PASS` is a hardcoded plaintext client-side password (`"worldcup2026"`), visible via View Source — only gates UI visibility, not Firestore writes.
  - `wc2026/players`' write rule likely breaks for more than one player (checks the full resulting document has only one key, instead of diffing affected keys).
  - Fixes for the rules-layer issues were drafted and verified against documented Firestore Rules syntax, then reverted at the user's request since rules changes can't be deployed/tested without Firebase Console access. Revisit when that access is available.

---

## v4.5.0 — UI Overhaul: Home Banner, Tab Nav, Group Picker & Picks Flow (June 15, 2026)

### Added
- **FIFA WC 2026 emblem SVG** (`2026_FIFA_World_Cup_emblem.svg`): displayed on the login screen (220px) and centred in the home banner (80px)
- **Home banner redesign**: 3-column CSS grid — avatar + greeting on left, logo centred, rank chip right-aligned. Background lightened to `#2D333B` (was `--surface` `#161B22`) so the dark logo is visible against it
- **Mini banner on non-home tabs**: compact strip (44px logo, same background) that appears at the top of every non-home view; tapping it navigates back to Home. Hidden on the Home tab
- **Conditional home picks card**: new users (no `phase1SubmittedAt`) see a full-width "Make Your Predictions" CTA with crystal ball; returning users see their points, rank, and deadline footer
- **`hasPicks` dual-signal detection**: `!!myPicks.phase1SubmittedAt || !!allPlayers[currentUser.uid]`. The second signal handles legacy users who saved picks before `phase1SubmittedAt` was introduced — `wc2026/players` only contains users who have actually saved picks, so its presence is a reliable fallback
- **Dynamic Predict/My Picks tab label**: `updatePicksTabLabel()` reads the same `hasPicks` signal and sets the 2nd tab label to "Predict" for new users and "My Picks" for returning users
- **Collapsible group blocks in Picks tab**: group headers show a `▼` chevron that rotates to `▶` when collapsed; `toggleGroup()` toggles both the content and the chevron class
- **World Cup → Groups subtab arrow navigation**: replaced the old group-pill selector with `‹ / ›` arrow buttons cycling through groups A–L (same pattern as Results date navigation); uses `activeGroupPill` state and `shiftGroup(delta)` function
- **Phase 1 deadline label**: footer of home picks card reads "Phase 1 deadline: Jun 17 · 11:59 PM ET" (was "Next Picks Deadline")
- **Knockout bracket UX fix**: round label (`bracket-round-indicator`) increased from 12px to 16px; Prev/Next buttons scoped to `.bracket-round-nav .btn` to override the full-width `100%` default without touching other buttons globally

### Changed
- **Bottom tab order**: Home → Predict/My Picks → World Cup → Standings → Leagues (was Home → World Cup → Standings → Leagues → Predict)
- **Picks tab moved to position 2**: surfacing prediction entry earlier reduces friction for new users
- **Desktop layout width**: `max-width: 60%` of viewport using relative units (was hardcoded `px`). Tabs use `position:sticky;bottom:0` inside the app container on wider screens
- **Banner rank chip**: only shown for users with a real rank (rank ≠ "—" and rank ≠ 0); new users see nothing in the right column of the banner (CTA lives only in the home content card, not the banner)
- **Toast pill fix**: `.toast` default changed to `visibility:hidden` (not `display:none`) so the CSS `transform` transition still fires on `.toast.show`. This fixed an empty gold pill visible at the bottom of all screens

### Fixed
- **Missing flags for Czechia, Congo DR, Bosnia-Herzegovina, Cape Verde Islands**: `worldcup26.ir` uses different team name strings than `football-data.org`. Both `scripts/fetch-data.js` and the inline `flagFor()` in `index.html` now include all name variants: `'Czechia'`, `'Congo DR'`, `'Bosnia-Herzegovina'`, `'Cape Verde Islands'`
- **Results tab fixture ordering**: fixtures now sorted client-side by `utcDate` before grouping by date, fixing cases where the JSON arrived in an inconsistent order
- **Live match score dashes**: null scores from the API defaulted to `—`; now default to `0` for live matches

---

## v4.4.0 — Smart Polling, Home Tab, Results Nav & Scoring Fix (June 12, 2026)

### Added
- **Home tab (landing page)**: shows today's fixtures, top 3 leaderboard, Group A standings, and top 3 scorers — each with a "See all →" link to the relevant tab
- **Results date navigator**: single-day view with ‹ › arrows; defaults to today in ET
- **Smart polling in GitHub Actions**: workflow fires every 10 min but only hits the API during active game windows (15 min before kickoff through 2h after) or at midnight ET; exits early otherwise

### Changed
- **Top Scorers tab redesigned**: 3-column fixed-width grid (rank | player | team | goals). Team column shows flag + 3-letter country code (MEX, FRA, BRA, etc.) via new `teamAbbr()` helper

### Fixed
- **Results tab date grouping**: ET date now derived from `utcDate` in the browser at load time, overriding the pre-computed string in `wc2026.json` which could be UTC-based when generated on the Actions runner (Linux/Node.js)
- **Leaderboard scores for unplayed groups**: group pick points are no longer awarded for groups where no games have been played yet. Tracked via `startedGroups` field in `wc2026/results`, populated by both the Cloud Function and `updateResultsFromLiveData`
- **Group standings sort in `updateResultsFromLiveData`**: was sorting by `pts` (wrong field); now correctly sorts by `points`, `gd`, `gf`

---

## v4.3.0 — API Migration, UI Polish & Data Fixes (June 11, 2026)

### Changed
- **Live data source switched from API-Football to football-data.org**
  - API-Football free tier does not support the 2026 season
  - football-data.org provides live 2026 data on the free tier (10 req/min)
  - Auth: `X-Auth-Token` header; competition code `WC`, season `2026`
  - Group standings now derived from fixture results (API returns flat table)
  - Stage labels updated: `LAST_32`/`LAST_16` instead of `ROUND_OF_32`/`ROUND_OF_16`
  - Env var renamed: `APIFOOTBALL_KEY` → `FOOTBALLDATA_KEY`
  - Cloud Function secret: `firebase functions:secrets:set FOOTBALLDATA_KEY`
  - GitHub Actions secret: `FOOTBALLDATA_KEY`
- **Font changed from Inter to DM Sans** site-wide — more distinctive, less generic
- **Base font size increased to 15px**; smallest hardcoded sizes bumped throughout

### Added
- **Emoji icons on World Cup subtabs**: 🏟️ Groups, 🏆 Knockouts, ⚽ Scorers, 📋 Results
- **ET time display in Results tab**: match times converted from UTC to America/New_York
- **Live match indicator**: green dot + "Live" label replaces missing minute counter
- **60-second cache header** on `data/wc2026.json` via `firebase.json` — eliminates stale data without requiring cache clears

### Fixed
- Results tab was showing only flags with no country names — field name mismatch (`homeTeam`/`awayTeam` in JSON vs `home`/`away` expected by renderer); fixed in both `fetch-data.js` and `loadTournamentData`
- Subtab active-state detection switched from fragile textContent matching to `data-tab` attribute

---

## v4.2.0 — UX Refinements & Competitive Integrity (June 10, 2026)
### Added
- **One-time submission lock**: Phase 1 picks permanently lock after first save
  - New `phase1SubmittedAt` timestamp field tracks first submission
  - Prevents editing picks after watching early matches
  - Locked UI shows submission date and explanation
  - Ensures competitive integrity — all players pick before seeing results
- **Responsive design improvements**: Better text scaling across all screen sizes
  - Fluid typography with `clamp()` for titles, tabs, and content
  - Responsive breakpoints: mobile (100%), tablet (768px), desktop (1100px)
  - Better padding and spacing on smaller screens
  - All text remains readable from 320px phones to large monitors

### Changed
- **App renamed to "Bracket"**: Changed from "Prediction League" to match familiar March Madness terminology
  - Page title: "FIFA 2026 · Bracket"
  - Main header: "BRACKET" (single word, cleaner)
  - Sign-in screen: "JOIN THE BRACKET"
- **Tournament tab renamed to "World Cup"**: More descriptive and event-specific
- **Fixtures renamed to "Results"**: Clearer intent (shows match results, not upcoming fixtures)
- **Bracket tab renamed to "Knockouts"**: Better describes the knockout stage
  - Moved to position 2 (after Groups) for logical flow
  - New tab order: Groups → Knockouts → Top Scorers → Results
- **Phase 2 messaging updated**: Changed "Come back after June 27" to "Phase 2 starts June 27"
  - More informative, less passive
  - Includes "details" context in documentation

### Documentation
- **README.md**: Updated with new branding, one-time submission lock, latest features
- **CHANGELOG.md**: This entry
- **Rules page**: Added deadlines section with June 17 warning and submission lock explanation
- **How to Play modal**: Added critical deadlines section, updated Phase 1 and Tips sections

### Deployment
- Commit: `47e5a76`
- Live URL: https://world-cup-2026-e1a0b.web.app

---

## v4.1.0 — Phase Timing & Email Reminders (June 10, 2026)
### Added
- **Phase 1 deadline enforcement**: Picks and league joins close June 17, 2026 11:59 PM (UTC-6)
  - `PHASE1_DEADLINE` constant with timezone-aware date
  - `isPhase1Open()` helper checks current date vs deadline
  - `getPhase1TimeRemaining()` shows dynamic countdown (e.g., "7d 12h left")
  - Deadline checks in `savePicks()` and `joinLeague()` functions
- **Phase 2 auto-unlock**: System automatically unlocks Phase 2 on June 27, 2026 11:59 PM (UTC-6)
  - `GROUP_STAGE_END` constant
  - `isGroupStageComplete()` helper
  - Auto-unlock logic in Firestore listener (no manual admin action needed)
- **Deadline countdown banner**: Shows in Picks tab
  - Before deadline: "⏰ Phase 1 closes: **7d 12h left** (June 17, 11:59 PM)"
  - After deadline: "🔒 Phase 1 closed — Picks locked until Phase 2 opens"
  - CSS styling: `.deadline-banner` and `.deadline-banner.closed`
- **Email reminders documentation**: Complete setup guide for Firebase Cloud Functions + SendGrid
  - Scheduled reminders for users without picks
  - HTML email template with countdown
  - Automatically stops after deadline
  - Cost: $0/month for most leagues (SendGrid free tier)
- **Player autocomplete**: Datalist with 30+ top players for Golden Boot selection
  - Includes Mbappé, Haaland, Messi, Ronaldo, Kane, Lewandowski, etc.
  - Works for both Phase 1 and Phase 2 Golden Boot inputs

### Changed
- **Phase 2 scoring rebalanced**: Champion now 15pts (was 20pts)
  - R16: 5pts (was 2pts in Phase 1)
  - QF: 5pts (was 3pts in Phase 1)
  - SF: 10pts (same as Phase 1)
  - Final: 15pts for champion (was 20pts in Phase 1)
  - Golden Boot: 5pts (same as Phase 1)
  - **Rationale**: Prevents Phase 2 from being worth more than Phase 1

### Fixed
- **Third-place team display in bracket**: Shows actual team names instead of "3Q1", "3Q2", etc.
  - Improved `seedBracketFromGroups()` with better filtering: `.filter(t=>t&&t.trim())`
  - Conditional seed lookup to prevent "TBD" fallback when team name is empty
  - Fixes bug where third-place teams weren't propagating to bracket display

### Documentation
- **PHASE_TIMING_IMPLEMENTATION.md**: Complete guide to deadline logic, auto-unlock, testing
- **EMAIL_REMINDERS.md**: Step-by-step Cloud Function + SendGrid setup
- **README.md**: Updated with new features, important dates timeline
- **DEPLOYMENT_READY.md**: Updated checklist with phase timing

### Deployment
- Commits: `b9dca27`, `8df6f6a`
- Live URL: https://world-cup-2026-e1a0b.web.app
- GitHub auto-deploy: Active (pushes to main auto-deploy)

---

## v4.0.0 — Third-Place Qualifiers + Desktop Layout + URL Invites
### Added
- **Third-place qualifier picks**: Predict which 8 of 12 third-placed teams advance (2pts each, 16pts max)
  - New wizard step: Groups → **Thirds** → Bracket → Phase 2
  - `myPicks.phase1.thirdPlaceQualifiers` array (8 team names)
  - `renderThirdPlaceStep()` with visual selection interface
  - `toggleThirdPlaceTeam()` and `saveThirdPlaceAndNext()` functions
  - Admin panel: Third-place qualifier input (8 teams)
- **Desktop responsive layout**: Two-column grid on screens ≥ 1024px
  - Left sidebar (340px, sticky): User bar, tabs, leagues
  - Right content (1fr): Main view area
  - CSS: `@media (min-width: 1024px)` with `.desktop-grid`
- **URL-based league invitations**: Share leagues with one link
  - `getLeagueCodeFromURL()` - parses `?league=XXXXX` from URL
  - `createInviteLink(code)` - generates full invite URL
  - Auto-join flow: URL parameter → pre-fill join screen
  - Copy invite link buttons throughout UI (after creation, in league list, active league)
- **R32 bracket seeding with third-place teams**: Integrates 8 third-place qualifiers into Round of 32
  - `seedBracketFromGroups()` updated to accept `(groups, thirdPlaceQuals)`
  - Creates 16 R32 matchups including 3Q1-3Q8 seeds
  - Matches official 2026 World Cup format (495 possible combinations)

### Changed
- **Max scores removed**: Eliminated "= X max" from all scoring rules displays
- **Scoring engine updated**: `calcScore()` now includes `p1ThirdQual` tracking
  - Leaderboard breakdown: "Groups: X · Quals: X · KO: X · 2nd: X"
  - Score detail modal includes qualifiers breakdown
- **Wizard updated**: 4 steps instead of 3 (Groups → Thirds → Bracket → ⚡ 2nd)
- **Architecture**: Updated with `thirdPlaceQualifiers` field in data model

### Fixed
- Max score was incorrectly stated as 180pts (now correctly shows as calculated values)

### Documentation
- **DEPLOYMENT_READY.md**: Complete deployment checklist and guide
- **README.md**: Added URL invite documentation
- **docs/ARCHITECTURE.md**: Updated data models with third-place fields

---

## v3.0.0 — Full rebuild with group drag + bracket + Phase 2
### Added
- Phase 1 picks wizard: Groups step (drag) → Bracket step (visual) → Phase 2 (Second Chance)
- Phase 2 / Second Chance: unlocks after group stage, real R16 bracket, 5pts flat per pick
- 2026 format: 12 groups × 4 teams, correct group names and flags for all 48 teams
- Auto-seeding: R32 bracket seeded from user's group picks (1A vs 2B etc)
- Bracket propagation: picking a winner cascades to the next round automatically
- Admin: Phase 2 unlock toggle, group result entry (top 2 per group), KO result entry
- Score breakdown: groups / KO / 2nd chance shown separately in modal
- Live tab: groups, fixtures, bracket, top scorers (awaits Cloud Function)
- Picks stored in separate `wc2026picks/{uid}` collection for full history

### Changed
- Score engine completely rewritten: `calcScore(playerData, results)` with detail object
- Leaderboard row shows score breakdown (Groups: X · KO: X · 2nd: X)
- Admin panel split into Phase Control + Group Results + KO Results sections

---

## v2.0.0 — Google Sign-In + Firebase
### Added
- Google Sign-In via Firebase Auth — no name conflicts
- User avatar and display name from Google account shown in leaderboard
- User bar: avatar, name, email, sign-out button
- Sign-in screen with Google button shown before main app
- Identity tied to UID — two people with same name get separate entries
- `wc2026/players` keyed by UID, not name

### Changed
- All player data uses Firebase UID as key
- Leaderboard highlights "YOU" row in amber
- Score detail modal shows player photo

---

## v1.1.0 — Mini leagues + global standings
### Added
- Global standings tab: all players across all leagues
- Mini league system: create with a name, get 5-letter code, share with group
- League leaderboard: filtered to members only
- Multiple leagues: switch between them in the leagues tab
- Invite code display + copy button

---

## v1.0.0 — Initial version (window.storage artifact)
### Added
- Basic picks: group winners (12), QF/SF/finalist/winner + golden boot
- Shared leaderboard via Claude artifact storage
- Admin tab with password protection (client-side only)
- Rules tab
- Score calculation: weighted points per round

---

## Known Issues / Future Work
- [ ] R32 bracket seeding: exact 495 FIFA scenarios not implemented — simplified seeding used
- [ ] Third-place qualifier picks need R32 seeding integration (which groups the 8 thirds come from affects matchups)
- [ ] Desktop two-column layout: needs implementation in index.html
- [ ] Tiebreaker: currently stable sort — could add: most correct picks, then earliest submission
- [ ] Push notifications: notify users when scores update (Firebase Cloud Messaging)
- [ ] Deadline lock: automatically close picks at tournament start time
- [ ] Export: share picks as image for WhatsApp
- [ ] Admin: bulk import results from CSV
