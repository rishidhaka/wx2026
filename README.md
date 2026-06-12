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
- Knockout bracket with results
- Top scorers leaderboard
- Updates via Cloud Function + football-data.org

### 🔧 Admin Panel
- Password + UID-protected
- Phase 2 unlock toggle (or auto-unlocks June 27)
- Manual result entry for groups/thirds/bracket
- Testing and troubleshooting tools

---

## Tech Stack
| Layer | Tech |
|---|---|
| Frontend | Vanilla JS, single HTML file |
| Auth | Firebase Authentication (Google Sign-In) |
| Database | Cloud Firestore (real-time listeners) |
| Backend | Firebase Cloud Functions (scheduled, hourly) |
| Live data | football-data.org (free tier) |
| Hosting | Firebase Hosting |
| CI/CD | GitHub Actions → Firebase auto-deploy |

---

## Firebase Project
- **Project ID**: `world-cup-2026-e1a0b`
- **Auth domain**: `world-cup-2026-e1a0b.firebaseapp.com`
- **Hosting URL**: `https://world-cup-2026-e1a0b.web.app`

---

## 📂 Repository Structure
```
wc2026-repo/
├── index.html                          ← Full frontend app (deploy this)
├── PHASE_TIMING_IMPLEMENTATION.md      ← Deadlines & phase unlock documentation 🆕
├── EMAIL_REMINDERS.md                  ← Email reminder setup guide 🆕
├── DEPLOYMENT_READY.md                 ← Deployment checklist
├── README.md                           ← This file
├── functions/
│   ├── index.js                        ← Cloud Function (live data sync)
│   └── package.json
├── tests/
│   └── suite.jsx                       ← Full test suite (React artifact)
├── docs/
│   ├── SETUP.md                        ← Step-by-step deploy guide
│   ├── ARCHITECTURE.md                 ← Data models, Firestore schema
│   ├── SCORING.md                      ← Complete scoring rules
│   ├── DESIGN.md                       ← UI/UX design system
│   ├── API.md                          ← Cloud Function + API-Football guide
│   ├── SECURITY.md                     ← Firestore rules + security model
│   ├── CHANGELOG.md                    ← Version history
│   └── AI_CONTEXT.md                   ← AI-friendly codebase summary
├── firestore.rules                     ← Firestore security rules
├── firebase.json                       ← Firebase config
├── .firebaserc                         ← Firebase project binding
└── .github/
    └── workflows/
        ├── firebase-hosting-merge.yml  ← Auto-deploy on push to main
        └── firebase-hosting-pull-request.yml ← Preview deploys for PRs
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

## 🎯 Latest Updates (June 2026)

✅ **One-time submission lock** - Phase 1 picks lock permanently once saved  
✅ **App renamed to "Bracket"** - More familiar terminology  
✅ **World Cup tab** - Renamed from Tournament for clarity  
✅ **Knockouts tab** - Moved after Groups, renamed from Bracket  
✅ **Responsive design** - Better text scaling across all screen sizes  
✅ **Phase timing controls** - Deadlines enforced automatically  
✅ **Auto-unlock Phase 2** - June 27, no manual action needed  
✅ **Countdown banners** - Shows time remaining  
✅ **Balanced scoring** - Champion 15pts in Phase 2  
✅ **Player autocomplete** - Easy Golden Boot selection  
✅ **URL-based invites** - Share leagues with one link  
✅ **GitHub auto-deploy** - Push to main = instant deploy  

📖 **See [docs/CHANGELOG.md](docs/CHANGELOG.md) for full version history**
