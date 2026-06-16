# FIFA 2026 World Cup Bracket

A full-stack World Cup bracket competition app built with vanilla JS + Firebase. No framework required. Deployed as a single HTML file.

## 🌐 Live URL
**https://world-cup-2026-e1a0b.web.app**

## 📚 Quick Links
- [Setup Guide](docs/SETUP.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Scoring Rules](docs/SCORING.md)
- [Design System](docs/DESIGN.md)
- [API Integration](docs/API.md)
- [Security](docs/SECURITY.md)
- [Changelog](docs/CHANGELOG.md)
- [Phase Timing & Deadlines](PHASE_TIMING_IMPLEMENTATION.md) 🆕
- [Email Reminders Setup](EMAIL_REMINDERS.md) 🆕

---

## ✨ Key Features

### 🔐 Authentication
- Google Sign-In only — no username conflicts, identity tied to Google account
- User avatar and display name from Google account
- Sign out anytime

### 📅 Phase 1: Group Stage Predictions (Closes June 17, 2026)
- **Deadline**: June 17, 2026 11:59 PM (UTC-6) - after first round of group matches
- **One-time submission**: Picks lock permanently once saved (prevents editing after watching matches)
- **Dynamic countdown**: Shows time remaining until deadline
- Predict all 12 group standings (drag-to-reorder interface)
- Pick which 8 of 12 third-placed teams advance to R32 (2pts each)
- Predict full knockout bracket (auto-seeded from your group picks)
- Choose Golden Boot winner (5pts)
- **Scoring**: Groups (1pt/2pt/1pt per position) + Thirds (2pts each) + Bracket (R32→Final: 2/3/5/10/20pts) + Golden Boot (5pts)

### ⚡ Phase 2: Second Chance (Auto-unlocks June 27, 2026)
- **Unlocks**: June 27, 2026 11:59 PM (UTC-6) - automatically after group stage ends
- Uses real R16 bracket (not your predictions)
- Predict R16 → QF → SF → Final → Champion
- **Balanced scoring**: R16/QF (5pts each), SF (10pts each), Champion (15pts), Golden Boot (5pts)
- Keeps everyone competitive after Phase 1

### 🏆 Mini Leagues
- Create private leagues with 5-letter codes
- **URL-based invites**: Share via `?league=XXXXX` parameter
- One-click join from invite links
- Copy invite link buttons throughout UI
- Multiple leagues per user
- Switch between leagues instantly

### 📊 Leaderboards
- **Global**: All players across all leagues
- **League**: Filtered to your mini league members
- Live updates as tournament progresses
- Score breakdown: Groups · Thirds · Bracket · 2nd Chance
- Click any player to see detailed score breakdown

### 🎮 Live Tournament Tab
- Real-time groups standings
- Match fixtures with scores
- **Tap any match for goal scorers + minutes** (see-through modal: centred card on desktop, bottom sheet on mobile)
- Knockout bracket with results
- Top scorers leaderboard
- Updates via Cloud Function + football-data.org

### ✅ My Picks (after submitting)
- Submitted Phase 1 picks are viewable, not hidden behind a "locked" message
- Each pick highlighted green (already scored), red (already wrong), or uncoloured (not yet decided / not a scoring pick)
- Fully read-only — no editing once submitted

### 🔧 Admin Panel
- Password + UID-protected (⚠️ admin UID is currently an unfilled placeholder in production — see [docs/SECURITY.md](docs/SECURITY.md))
- Phase 2 unlock toggle (or auto-unlocks June 27)
- Manual result entry for groups/thirds/bracket
- Testing and troubleshooting tools

---

## Tech Stack
| Layer | Tech |
|---|---|
| Frontend | Vanilla JS, single HTML file (`index.html`) |
| Auth | Firebase Authentication (Google `signInWithPopup`) |
| Database | Cloud Firestore (real-time `onSnapshot` listeners) |
| Backend | Firebase Cloud Functions (scheduled every 60 min) |
| Live data (primary) | worldcup26.ir — real-time live status, goal scorers, JWT auth |
| Live data (fallback) | football-data.org — free tier, 10 req/min |
| Hosting | Firebase Hosting (60s cache on `data/wc2026.json`) |
| CI/CD | GitHub Actions (every 5 min + workflow_dispatch, smart-gated, upstream repo only) → Firebase auto-deploy |

---

## Firebase Project
- **Project ID**: `world-cup-2026-e1a0b`
- **Auth domain**: `world-cup-2026-e1a0b.firebaseapp.com`
- **Hosting URL**: `https://world-cup-2026-e1a0b.web.app`

---

## 📂 Repository Structure
```
wx2026/
├── index.html                          ← Full frontend app (single file — HTML + CSS + JS)
├── 2026_FIFA_World_Cup_emblem.svg      ← Official WC 2026 logo (login screen + home banner)
├── data/
│   └── wc2026.json                     ← Written by GitHub Actions (never commit manually)
├── scripts/
│   └── fetch-data.js                   ← Data fetcher (worldcup26.ir primary, football-data.org fallback)
├── PHASE_TIMING_IMPLEMENTATION.md      ← Deadlines & phase unlock documentation
├── EMAIL_REMINDERS.md                  ← Email reminder setup guide
├── DEPLOYMENT_READY.md                 ← Deployment checklist
├── README.md                           ← This file
├── functions/
│   ├── index.js                        ← Cloud Function (live data sync, every 60 min)
│   └── package.json
├── docs/
│   ├── AI_CONTEXT.md                   ← Start here when resuming with an AI assistant
│   ├── ARCHITECTURE.md                 ← Data models, Firestore schema, key patterns
│   ├── DESIGN.md                       ← Colour tokens, components, layout decisions
│   ├── CHANGELOG.md                    ← Version history
│   ├── API.md                          ← worldcup26.ir + football-data.org integration
│   ├── SCORING.md                      ← Complete scoring rules
│   ├── SECURITY.md                     ← Firestore rules + security model
│   └── SETUP.md                        ← Step-by-step deploy guide
├── firestore.rules                     ← Firestore security rules
├── firebase.json                       ← Firebase config (includes 60s cache on wc2026.json)
├── .firebaserc                         ← Firebase project binding
└── .github/
    └── workflows/
        ├── update-data.yml             ← Runs every 5 min, smart-gated, upstream repo only
        ├── force-update-data.yml       ← Manual-only, bypasses the game-window gate
        ├── firebase-hosting-merge.yml  ← Deploy on push to main, upstream repo only
        └── firebase-hosting-pull-request.yml ← Deploy preview on PR, upstream repo only
```

---

## ⏰ Important Dates (2026 Tournament)

| Date | Event | System Behavior |
|------|-------|-----------------|
| **June 10** | Today! | Phase 1 open (7 days left) |
| **June 11** | Tournament starts | Phase 1 still open |
| **June 17, 11:59 PM** | 🔒 **Phase 1 Deadline** | Picks/joins close |
| **June 27, 11:59 PM** | ⚡ **Group Stage Ends** | Phase 2 auto-unlocks |
| **June 28** | Round of 32 starts | Phase 2 picks available |
| **July 19** | Final (MetLife Stadium) | Tournament complete |

📖 **See [PHASE_TIMING_IMPLEMENTATION.md](PHASE_TIMING_IMPLEMENTATION.md) for complete deadline logic**

---

## 🚀 Quick Start

### For Players
1. Visit: https://world-cup-2026-e1a0b.web.app
2. Sign in with Google
3. Make your Phase 1 picks (before June 17!)
4. Create or join a mini league
5. Phase 2 starts June 27 - predict the real knockout bracket

### For Developers
```bash
# Clone repo
git clone https://github.com/rishidhaka/wx2026.git
cd wx2026/wc2026-repo

# Deploy to Firebase Hosting
firebase deploy --only hosting

# Deploy Cloud Functions (optional, for live data)
cd functions
npm install
cd ..
firebase deploy --only functions
```

📖 **See [docs/SETUP.md](docs/SETUP.md) for detailed setup instructions**

---

## 📧 Email Reminders (Optional)

Send automatic reminders to users who haven't made picks:
- Firebase Cloud Functions + SendGrid
- Free tier (100 emails/day)
- Stops automatically after deadline

📖 **See [EMAIL_REMINDERS.md](EMAIL_REMINDERS.md) for setup guide**

---

## 🎯 Latest Updates (v4.6.0 — June 16, 2026)

✅ **Tappable goal-scorer modal** — tap any match for scoreboard + per-team goal scorers with minutes; centred card on desktop, bottom sheet on mobile  
✅ **Multi-goal grouping + (P)/(OG) tags** — a player's penalty and regular goals group into one row; tags attach to the timestamp, not the name  
✅ **My Picks view-only mode** — submitted Phase 1 picks are now viewable (not hidden behind a locked message), colour-coded green/red by correctness, fully non-editable  
✅ **Fixed a real scoring bug** — 8 teams with inconsistent name spellings between the picks wizard and live results were scoring correct picks as wrong across 6 of 12 groups  
✅ **GitHub Actions reliability** — 5-min cron + `workflow_dispatch`, new manual force-fetch workflow, all auto-triggered workflows restricted to the upstream repo (no more wasted runs on the fork)  
⚠️ **Security audit found real gaps, not yet fixed** — picks lock and league writes aren't enforced server-side; see [docs/SECURITY.md](docs/SECURITY.md)

### v4.5.0 — June 15, 2026
✅ **WC 2026 emblem** — Official SVG logo on login screen and centred in the home banner  
✅ **Home banner redesign** — 3-column grid: greeting · logo · rank chip. Lighter background (`#2D333B`) for logo visibility  
✅ **Mini banner on non-home tabs** — compact logo strip that navigates back to Home when tapped  
✅ **Conditional home picks card** — new users see a "Make Your Predictions" CTA; returning users see score + rank  
✅ **Predict / My Picks tab** — label switches dynamically based on whether picks are submitted  
✅ **Tab reorder** — Home → Predict/My Picks → World Cup → Standings → Leagues  
✅ **Groups arrow navigation** — World Cup Groups subtab now uses ‹/› arrows to cycle A–L (like Results tab)  
✅ **Collapsible group blocks** — animated ▼/▶ chevron in Picks wizard  
✅ **Bracket Prev/Next fix** — round label enlarged; buttons no longer full-width  
✅ **Layout: 60% viewport width** — relative units, not px  
✅ **Toast fix** — removed ghost gold pill that appeared on all screens  
✅ **Phase 1 deadline label** — "Phase 1 deadline" in the picks card footer  
✅ **Flag fixes** — worldcup26.ir name variants added (Czechia, Congo DR, Bosnia-Herzegovina, Cape Verde Islands)  

📖 **See [docs/CHANGELOG.md](docs/CHANGELOG.md) for full version history**  
🤖 **See [docs/AI_CONTEXT.md](docs/AI_CONTEXT.md) for AI-resumable context**
