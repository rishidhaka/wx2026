# Changelog

## v4.3.0 — API Migration, UI Polish & Data Fixes (June 11, 2026) ⚡ CURRENT

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
