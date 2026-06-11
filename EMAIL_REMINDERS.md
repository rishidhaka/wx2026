# Email Reminders Setup

## Overview
Send automatic email reminders to users who haven't made their picks yet.

## Implementation Steps

### 1. Install Firebase Extensions (Easiest)

```bash
cd /path/to/wx2026/wc2026-repo
firebase ext:install trigger-email
```

Configure:
- **SMTP Connection**: Use SendGrid, Mailgun, or Gmail SMTP
- **Default FROM address**: `noreply@world-cup-2026-e1a0b.firebaseapp.com`
- **Collection path**: `mail`

### 2. Create Cloud Function (Scheduled)

Create `functions/index.js`:

```javascript
const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

// Run daily at 6 PM UTC (adjust timezone as needed)
exports.sendPickReminders = functions.pubsub
  .schedule('0 18 * * *')
  .timeZone('America/Mexico_City')
  .onRun(async (context) => {
    const db = admin.firestore();
    const now = new Date();
    const phase1Deadline = new Date('2026-06-17T23:59:59-06:00');
    
    // Only send reminders before Phase 1 deadline
    if (now >= phase1Deadline) {
      console.log('Phase 1 closed, no reminders needed');
      return null;
    }
    
    // Get all users from auth
    const listUsersResult = await admin.auth().listUsers();
    const allUserEmails = new Set(listUsersResult.users
      .filter(u => u.email)
      .map(u => u.email));
    
    // Get users who have already made picks
    const picksSnapshot = await db.collection('wc2026picks').get();
    const usersWithPicks = new Set(picksSnapshot.docs.map(doc => {
      const data = doc.data();
      return data.email;
    }));
    
    // Find users without picks
    const usersNeedingReminder = [...allUserEmails].filter(
      email => !usersWithPicks.has(email)
    );
    
    console.log(`Sending reminders to ${usersNeedingReminder.length} users`);
    
    // Create email documents (processed by trigger-email extension)
    const batch = db.batch();
    const daysLeft = Math.ceil((phase1Deadline - now) / (1000 * 60 * 60 * 24));
    
    usersNeedingReminder.forEach(email => {
      const mailRef = db.collection('mail').doc();
      batch.set(mailRef, {
        to: email,
        template: {
          name: 'pickReminder',
          data: {
            daysLeft: daysLeft,
            deadline: 'June 17, 2026 11:59 PM',
            link: 'https://world-cup-2026-e1a0b.web.app'
          }
        }
      });
    });
    
    await batch.commit();
    console.log('Reminder emails queued');
    return null;
  });
```

### 3. Email Template

Create `functions/email-templates/pickReminder.html`:

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Make Your World Cup 2026 Picks!</title>
</head>
<body style="font-family: 'Inter', sans-serif; background: #0d1b2a; color: #f0f4f8; padding: 20px;">
  <div style="max-width: 600px; margin: 0 auto; background: #111f2f; border: 1px solid #f5a623; border-radius: 10px; padding: 30px;">
    <h1 style="color: #f5a623; text-align: center;">⚽ FIFA 2026 Prediction League</h1>
    
    <p style="font-size: 16px; line-height: 1.6;">
      Hey there! The World Cup starts soon and you haven't made your picks yet! 🏆
    </p>
    
    <div style="background: #2a1a0a; border: 1px solid #f5a623; border-radius: 8px; padding: 15px; margin: 20px 0; text-align: center;">
      <p style="font-size: 14px; color: #f5a623; font-weight: 600; margin: 0;">
        ⏰ Phase 1 closes in <strong style="color: #fff;">{{daysLeft}} days</strong>
      </p>
      <p style="font-size: 12px; color: #7a9ab5; margin: 5px 0 0 0;">
        Deadline: {{deadline}}
      </p>
    </div>
    
    <p style="font-size: 14px; line-height: 1.6;">
      Don't miss out! Make your predictions for:
    </p>
    
    <ul style="font-size: 14px; line-height: 1.8;">
      <li>✅ Group stage standings (all 12 groups)</li>
      <li>✅ Third-place qualifiers (8 teams)</li>
      <li>✅ Full knockout bracket to the final</li>
      <li>✅ Golden Boot winner</li>
    </ul>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="{{link}}" style="display: inline-block; background: #f5a623; color: #0d1b2a; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 800; font-size: 14px;">
        MAKE MY PICKS NOW →
      </a>
    </div>
    
    <p style="font-size: 12px; color: #7a9ab5; text-align: center; margin-top: 20px;">
      You're receiving this because you signed in to the FIFA 2026 Prediction League
    </p>
  </div>
</body>
</html>
```

### 4. Deploy

```bash
cd functions
npm install firebase-functions firebase-admin
cd ..
firebase deploy --only functions
```

### 5. Test Locally

```bash
firebase functions:shell
# Then run:
sendPickReminders()
```

## Alternative: Simple Approach with SendGrid API

If you don't want Cloud Functions, manually trigger from Firebase Console or use a simple script:

```javascript
// Run this in Firebase Console > Firestore > Run Query
const usersWithoutPicks = await db.collection('wc2026picks').get();
const emails = /* get emails from auth */;
// Use SendGrid API to batch send
```

## Cost Estimate

- **SendGrid Free Tier**: 100 emails/day (plenty for reminders)
- **Cloud Functions**: ~$0.01/day for scheduled function
- **Total**: Free for most leagues!

## When to Send Reminders

- **June 10 (7 days before)**: First reminder
- **June 14 (3 days before)**: Second reminder  
- **June 16 (1 day before)**: Final reminder
- **Stop after June 17**: Phase 1 closed

Adjust the schedule in the Cloud Function cron expression.
