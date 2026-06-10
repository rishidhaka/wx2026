# FIFA 2026 World Cup Prediction League

A full-stack prediction league web app built with vanilla JS + Firebase. No framework required. Deployed as a single HTML file.

## Live URL
`https://world-cup-2026-e1a0b.web.app`

## Quick Links
- [Setup Guide](docs/SETUP.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Scoring Rules](docs/SCORING.md)
- [Design System](docs/DESIGN.md)
- [API Integration](docs/API.md)
- [Security](docs/SECURITY.md)
- [Changelog](docs/CHANGELOG.md)

---

## What It Does
- Google Sign-In — no name conflicts, identity tied to Google account
- **Phase 1 picks**: Predict group standings (1st/2nd/3rd per group) + which 8 third-placed teams advance + full knockout bracket seeded from your group picks + Golden Boot
- **Phase 2 (Second Chance)**: Unlocks after group stage — real R16 bracket, 5pts flat per correct pick — keeps everyone in the game
- Mini Leagues — create a private group with a 5-letter code, share with friends or work colleagues
- Global leaderboard — all players ranked, updates rolling as each match finishes
- Live tournament tab — groups, fixtures, bracket, top scorers (via Cloud Function + API-Football)
- Admin panel — password + UID-protected, controls Phase 2 unlock and manual result entry

---

## Tech Stack
| Layer | Tech |
|---|---|
| Frontend | Vanilla JS, single HTML file |
| Auth | Firebase Authentication (Google Sign-In) |
| Database | Cloud Firestore (real-time listeners) |
| Backend | Firebase Cloud Functions (scheduled, hourly) |
| Live data | API-Football via RapidAPI (free tier) |
| Hosting | Firebase Hosting |
| CI/CD | GitHub Actions → Firebase auto-deploy |

---

## Firebase Project
- **Project ID**: `world-cup-2026-e1a0b`
- **Auth domain**: `world-cup-2026-e1a0b.firebaseapp.com`
- **Hosting URL**: `https://world-cup-2026-e1a0b.web.app`

---

## Repository Structure
```
wc2026-repo/
├── index.html              ← Full frontend app (deploy this)
├── functions/
│   ├── index.js            ← Cloud Function (live data sync)
│   └── package.json
├── tests/
│   └── suite.jsx           ← Full test suite (React artifact)
├── docs/
│   ├── SETUP.md            ← Step-by-step deploy guide
│   ├── ARCHITECTURE.md     ← Data models, Firestore schema
│   ├── SCORING.md          ← Complete scoring rules
│   ├── DESIGN.md           ← UI/UX design system
│   ├── API.md              ← Cloud Function + API-Football guide
│   ├── SECURITY.md         ← Firestore rules + security model
│   └── CHANGELOG.md        ← Version history
├── firestore.rules         ← Firestore security rules
├── firebase.json           ← Firebase config
└── .github/
    └── workflows/
        └── deploy.yml      ← Auto-deploy on push to main
```
