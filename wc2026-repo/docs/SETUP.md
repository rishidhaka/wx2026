# Setup & Deploy Guide

## Prerequisites
- Firebase project: `world-cup-2026-e1a0b` (already created)
- Google Auth: enabled ✅
- Firestore: enabled ✅
- GitHub account: needed for phone-based deploy

---

## Part 1 — Deploy Frontend (Phone-Friendly)

### Step 1 — GitHub
1. Go to https://github.com → sign in
2. Create repo: `wc2026-predictor` (Public)
3. Upload all files from this repo

### Step 2 — Connect Firebase Hosting to GitHub
1. Firebase Console → Hosting → Add channel OR get started
2. Choose **"Set up GitHub Actions"**
3. Connect GitHub account → select `wc2026-predictor`
4. Firebase adds `.github/workflows/firebase-hosting-*.yml` automatically
5. Every push to `main` deploys to `https://world-cup-2026-e1a0b.web.app`

### Step 3 — Test
Open `https://world-cup-2026-e1a0b.web.app` → sign in with Google → should work.

---

## Part 2 — Get Your Admin UID

1. Open the app and sign in once with your Google account
2. Firebase Console → Authentication → Users
3. Find your email → copy the **User UID** column (long string like `abc123xyz...`)
4. Paste it into `firestore.rules` replacing `YOUR_ADMIN_UID_HERE`
5. Also update the Cloud Function if using auto-sync

---

## Part 3 — Set Firestore Security Rules

Firebase Console → Firestore → Rules → paste contents of `firestore.rules` from this repo.

Key rules:
- Players can only write their own UID
- Name must match Google token (prevents spoofing)
- Only your admin UID can write results
- Cloud Function writes are via service account (bypass rules)

---

## Part 4 — Deploy Cloud Function (Needs a Laptop, One Time)

```bash
# Install Firebase CLI
npm install -g firebase-tools

# Login
firebase login

# In the repo root
firebase init functions
# → Select existing project: world-cup-2026-e1a0b
# → Language: JavaScript
# → ESLint: No
# → Install dependencies: Yes

# Set API-Football key
firebase functions:config:set apifootball.key="YOUR_RAPIDAPI_KEY_HERE"

# Deploy
firebase deploy --only functions
```

### Get API-Football key (free)
1. https://rapidapi.com/api-sports/api/api-football
2. Sign up → subscribe to Basic (free, 100 req/day)
3. Copy API key from dashboard

### Verify
- Firebase Console → Functions → `syncWorldCup` should appear
- Runs every 60 minutes automatically
- Check logs: `firebase functions:log`

---

## Part 5 — Change Admin Password

In `index.html`, find:
```js
const ADMIN_PASS = "worldcup2026";
```
Change to something only you know. This is the client-side password for the Admin tab UI. The real server-side protection is your UID in Firestore rules.

---

## Part 6 — Pre-Tournament Checklist

- [ ] App deployed and accessible at web.app URL
- [ ] Google Auth working (can sign in)
- [ ] Your admin UID in Firestore rules
- [ ] Admin password changed from default
- [ ] Phase 2 locked (default) — don't unlock until group stage ends
- [ ] Test: submit picks as yourself, verify leaderboard updates
- [ ] Share the URL with your group
- [ ] Share league codes with each group

---

## Part 7 — During the Tournament

### After each match day
The Cloud Function auto-syncs within 60 minutes.
If you want immediate update: Admin panel → Save & Recalculate.

### After group stage ends (all 72 games played)
1. Verify Cloud Function has correct group standings
2. Admin panel → Unlock Second Chance (Phase 2)
3. Share with group: "Second Chance is now open! Submit your R16 picks"

### Ongoing
- Monitor Firebase Console → Firestore for data correctness
- Check Functions logs for any API-Football sync failures
- If API fails: use Admin panel to manually enter results

---

## Free Tier Limits (Firebase Spark)

| Resource | Free limit | Expected usage |
|---|---|---|
| Firestore reads | 50,000/day | ~500/day for 50 users |
| Firestore writes | 20,000/day | ~50/day |
| Cloud Functions | 125k/month | 720/month (hourly) |
| Hosting bandwidth | 10 GB/month | <1 GB |
| API-Football | 100 req/day | 24/day |

All within free limits for a group of 50-100 people.

---

## Troubleshooting

### "Script error" on load
→ Firebase config values not filled in. Check `const firebaseConfig = {...}` in index.html.

### Google Sign-In popup blocked
→ User's browser is blocking popups. Tell them to allow popups for the domain.

### Picks not saving
→ Check Firestore rules. User's UID must match the key they're writing to.

### Live data not appearing
→ Cloud Function not deployed, or API-Football key not set. Use Admin panel as fallback.

### Phase 2 not unlocking
→ Admin must be signed in with the UID that's in Firestore rules, then enter admin password and click unlock.
