# GitHub Actions Setup

This project uses GitHub Actions to automatically fetch World Cup data every hour and deploy to Firebase Hosting.

## Required GitHub Secrets

### 1. FOOTBALLDATA_KEY
Your football-data.org API key.

**To add:**
1. Go to https://github.com/rishidhaka/wx2026/settings/secrets/actions
2. Click "New repository secret"
3. Name: `FOOTBALLDATA_KEY`
4. Value: your key from https://www.football-data.org/client/register
5. Click "Add secret"

### 2. FIREBASE_SERVICE_ACCOUNT_WORLD_CUP_2026_E1A0B
Firebase service account JSON for deployment (used by `firebase-hosting-merge.yml`).

### 3. FIREBASE_SERVICE_ACCOUNT
Firebase service account JSON for deployment (used by `update-data.yml`).

Both secrets take the same value — the full JSON content of a Firebase service account key.

**To generate:**
1. Go to https://console.firebase.google.com/project/world-cup-2026-e1a0b/settings/serviceaccounts/adminsdk
2. Click "Generate new private key" → download the JSON file
3. Copy the entire JSON content and paste it as the secret value for both secrets above

## How It Works

1. **GitHub Actions** runs every hour (`0 * * * *`)
2. Fetches latest data from football-data.org (groups derived from fixtures, scorers)
3. Writes `data/wc2026.json`
4. Commits and pushes if data changed
5. Auto-deploys to Firebase Hosting
6. Users see updates within 1 minute (60s cache + 5 min client polling)

## Manual Trigger

1. Go to https://github.com/rishidhaka/wx2026/actions/workflows/update-data.yml
2. Click "Run workflow" → "Run workflow"

## Local Testing

```bash
npm install axios
FOOTBALLDATA_KEY=your_key_here node scripts/fetch-data.js
cat data/wc2026.json
```

## Cost

- GitHub Actions: **FREE** (2,000 minutes/month included)
- football-data.org: **FREE** (10 requests/minute on free tier)
- Firebase Hosting: **FREE** (10GB storage, 360MB/day transfer)

**Total: $0.00/month**