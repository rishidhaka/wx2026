# GitHub Actions Setup

This project uses GitHub Actions to automatically fetch World Cup data every hour and deploy to Firebase Hosting.

## Required GitHub Secrets

You need to set up two secrets in your GitHub repository:

### 1. APIFOOTBALL_KEY
Your API-Football API key.

**To add:**
1. Go to https://github.com/rishidhaka/wx2026/settings/secrets/actions
2. Click "New repository secret"
3. Name: `APIFOOTBALL_KEY`
4. Value: `b971e3884ef7210ad9a1667abd2a87d7`
5. Click "Add secret"

### 2. FIREBASE_SERVICE_ACCOUNT
Firebase service account JSON for deployment.

**To generate:**
1. Go to https://console.firebase.google.com/project/world-cup-2026-e1a0b/settings/serviceaccounts/adminsdk
2. Click "Generate new private key"
3. Download the JSON file
4. Copy the ENTIRE JSON content

**To add:**
1. Go to https://github.com/rishidhaka/wx2026/settings/secrets/actions
2. Click "New repository secret"
3. Name: `FIREBASE_SERVICE_ACCOUNT`
4. Value: Paste the entire JSON content from the downloaded file
5. Click "Add secret"

## How It Works

1. **GitHub Actions** runs every hour (cron: `0 * * * *`)
2. Fetches latest data from API-Football (groups, fixtures, top scorers)
3. Generates `data/wc2026.json` with the latest tournament data
4. Commits and pushes if data changed
5. Auto-deploys to Firebase Hosting
6. Users see updates within 5 minutes (client-side polling)

## Manual Trigger

You can manually trigger the workflow:
1. Go to https://github.com/rishidhaka/wx2026/actions/workflows/update-data.yml
2. Click "Run workflow"
3. Select branch: `main`
4. Click "Run workflow"

## Local Testing

```bash
# Install dependencies
npm install axios

# Run data fetch script
APIFOOTBALL_KEY=your_key_here node scripts/fetch-data.js

# Check generated file
cat data/wc2026.json
```

## Cost

- GitHub Actions: **FREE** (2,000 minutes/month included)
- API-Football: **FREE** (100 requests/day, we use ~24/day)
- Firebase Hosting: **FREE** (10GB storage, 360MB/day transfer)

**Total: $0.00/month** 🎉
