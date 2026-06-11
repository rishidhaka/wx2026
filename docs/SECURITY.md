# Security

## Threat Model

| Threat | Mitigation |
|---|---|
| User overwrites another user's picks | Firestore rule: can only write own UID key |
| User spoofs display name | Firestore rule: name must === Google auth token name |
| Non-admin writes results | Firestore rule: results write requires matching admin UID |
| Client bypasses admin password | Admin password is UX only; UID check is server-side |
| XSS via display name / team name | All user content passed through `esc()` before DOM insertion |
| XSS via photoURL (javascript: scheme) | `referrerpolicy="no-referrer"` on all img tags; add CSP header |
| Unauthenticated reads/writes | All Firestore rules require `request.auth != null` |
| League manipulation (remove members) | Rule validates members array can only grow, not shrink |
| Mass write / DoS | Firebase App Check (optional, free) rate-limits writes |
| API key exposure | API-Football key lives only in Cloud Function environment config, never in client |

---

## Firestore Rules (full)

See `firestore.rules` in repo root. Summary:

```
wc2026/players  → read: authed | write: own UID only, name must match token
wc2026/results  → read: authed | write: admin UID only
wc2026/leagues  → read: authed | write: authed (validated client-side)
wc2026/tournament → read: authed | write: false (Cloud Function uses service account)
wc2026/scores   → read: authed | write: false (Cloud Function only)
wc2026picks/{uid} → read: own UID only | write: own UID only
/**             → read/write: false (catch-all deny)
```

---

## Getting Your Admin UID

1. Deploy the app
2. Sign in with your Google account
3. Firebase Console → Authentication → Users → copy UID column
4. Paste into `firestore.rules` replacing `YOUR_ADMIN_UID_HERE`
5. Save rules

---

## XSS Prevention

The `esc()` function is applied to all user-supplied content before DOM insertion:

```js
function esc(s) {
  return String(s||"")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
```

`escA()` is used for HTML attribute contexts (onclick strings):
```js
function escA(s) {
  return String(s||"").replace(/'/g, "\\'");
}
```

**Known residual risk**: `javascript:` scheme in photoURL is not blocked by `esc()`.
Mitigated by `referrerpolicy="no-referrer"` and the fact that Firebase Auth
only returns valid HTTPS photoURLs from Google's CDN.

Recommended additional mitigation: add CSP header in `firebase.json`:
```json
"headers": [{
  "source": "**",
  "headers": [{
    "key": "Content-Security-Policy",
    "value": "default-src 'self' 'unsafe-inline' https://*.googleapis.com https://*.gstatic.com https://*.firebaseio.com; img-src 'self' https: data:"
  }]
}]
```

---

## Data Integrity

- Player scores are computed client-side from picks + results — no stored score can be tampered with
- The Cloud Function score cache (`wc2026/scores`) is write-blocked from clients
- League membership can only be appended to, never removed via client
- Phase 2 unlock is write-blocked to non-admin UIDs

---

## Rate Limiting (optional, recommended for public launch)

Firebase App Check prevents automated abuse:
1. Firebase Console → App Check → Register your web app
2. Choose reCAPTCHA v3 (free)
3. Add to `index.html`:
```html
<script src="https://www.gstatic.com/firebasejs/10.12.0/firebase-app-check-compat.js"></script>
```
```js
const appCheck = firebase.appCheck();
appCheck.activate('YOUR_RECAPTCHA_SITE_KEY', true);
```
