# Changelog

## v4.0.0 — Current (in progress)
### Added
- Group stage: full 1st/2nd/3rd/4th ranking with drag-to-reorder
- Third-place qualifier picks: predict which 8 of 12 third-placed teams advance (2pts each)
- Responsive desktop layout: two-column grid on screens ≥ 1024px
- Updated max score: 178pts Phase 1 + 80pts Phase 2 = 258pts total
- Updated R32 seeding logic to account for third-place team slots

### Changed
- Group scoring: now awards 1pt for 3rd place correct (was 1st/2nd only)
- Scoring rules tab fully rewritten to reflect new format
- Architecture doc updated with thirdPlaceQualifiers field in data model

### Fixed
- Max score was incorrectly stated as 180pts in tests and rules tab

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
