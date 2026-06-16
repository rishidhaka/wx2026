# Security

## ⚠️ Status as of June 2026 audit

A security review was done in June 2026 (prompted by noticing exposed-looking state via browser dev tools) and found several real gaps between this document's *intended* security model and what `firestore.rules` *actually* enforces. Fixes were drafted and verified against documented Firestore Rules syntax, then **reverted at the user's request** because rules changes can't be deployed or tested without Firebase Console access, which wasn't available at the time. The draft is preserved below under "Known Gaps" so it isn't lost — apply it (and test against the [Firestore emulator](https://firebase.google.com/docs/rules/emulator-setup) or a staging project) when that access is available.

The rest of this document has been corrected to describe `firestore.rules` as it actually is today, not as originally planned.

---

## Threat Model (current actual state)

| Threat | Mitigation |
|---|---|
| User overwrites another user's picks | Firestore rule: can only write own UID key (`wc2026picks/{userId}`) |
| User spoofs display name | Firestore rule: name must === Google auth token name |
| **User edits Phase 1 picks after submission** | **Not mitigated server-side.** Only enforced in client JS (`savePicks()`, `pickBracket()`, `saveGroupsAndNext()`, `saveThirdPlaceAndNext()` all check `myPicks.phase1SubmittedAt`). A direct Firestore SDK call from the browser console bypasses all of it. See Known Gaps. |
| Non-admin writes results | Firestore rule requires `request.auth.uid` to match a literal admin UID string — **but that string is still the unfilled placeholder `"YOUR_ADMIN_UID_HERE"`**, so in practice no real user's UID will ever match it. See Known Gaps. |
| Client bypasses admin password | **Not true today.** `ADMIN_PASS` is a hardcoded plaintext string in client JS (`"worldcup2026"`), visible via View Source. It only gates whether the admin panel *UI* renders, not any Firestore write — but since the admin UID check above is also non-functional, there is currently no real server-side admin boundary at all. |
| XSS via display name / team name | All user content passed through `esc()` before DOM insertion |
| XSS via photoURL (`javascript:` scheme) | `referrerpolicy="no-referrer"` on all img tags; CSP header recommended, not yet added |
| Unauthenticated reads/writes | All Firestore rules require `request.auth != null` |
| **League manipulation** (delete/corrupt other users' leagues) | **Not mitigated.** `wc2026/leagues` rule is `allow write: if request.auth != null` — any signed-in user can overwrite the entire shared leagues document via a direct SDK call. The comment claiming "validated client-side" provides no protection against bypassing the client. See Known Gaps. |
| Mass write / DoS | Firebase App Check (optional, free) rate-limits writes — not yet enabled |
| API key exposure | Server-side secrets (`WC26_API_TOKEN`, `FOOTBALLDATA_KEY`, `FIREBASE_SERVICE_ACCOUNT`) live only in GitHub Actions secrets / Cloud Function config, never in client JS — confirmed via audit, no leaks found |

**Not a vulnerability, despite looking like one**: the Firebase `apiKey` in `firebaseConfig` (visible in client JS) is not a secret credential — it just routes requests to your Firebase project. Real protection comes entirely from Firestore Rules (and optionally App Check), not from hiding this value.

---

## Firestore Rules (full, as actually deployed)

See `firestore.rules` in repo root. Summary:

```
wc2026/players  → read: authed | write: own UID only, name must match token
                  (write rule uses .keys().hasOnly([uid]) against the FULL resulting
                  document — likely breaks for a 2nd+ player; see Known Gaps)
wc2026/results  → read: authed | write: admin UID only, BUT the UID is still the
                  unfilled "YOUR_ADMIN_UID_HERE" placeholder
wc2026/leagues  → read: authed | write: authed, NO further validation despite the
                  comment claiming client-side enforcement
wc2026/tournament → read: authed | write: false (Cloud Function uses service account)
wc2026/scores   → read: authed | write: false (Cloud Function only)
wc2026picks/{uid} → read: own UID only | write: own UID only, NO immutability
                  check on phase1 after phase1SubmittedAt is set
/**             → read/write: false (catch-all deny)
```

---

## Known Gaps (Audited June 2026, Not Yet Fixed)

These are listed in priority order. A fix for all four was drafted and verified against documented Firestore Rules syntax/semantics, but **not deployed or tested against a live/emulated Firestore instance** — verify before trusting it in production.

### 1. Picks lock not enforced server-side (highest priority)
The entire "permanently locked once submitted" guarantee — the core integrity mechanism of the competition — only exists in client JS. Anyone can open the browser console and call the Firestore SDK directly to rewrite their own `phase1` picks after submission, e.g. after watching real results.

Drafted fix for `wc2026picks/{userId}`:
```
match /wc2026picks/{userId} {
  allow read: if request.auth != null && request.auth.uid == userId;

  allow create: if request.auth != null && request.auth.uid == userId;

  allow update: if request.auth != null && request.auth.uid == userId
    && (
      !("phase1SubmittedAt" in resource.data) || resource.data.phase1SubmittedAt == null
      || (
        request.resource.data.phase1 == resource.data.phase1
        && request.resource.data.phase1SubmittedAt == resource.data.phase1SubmittedAt
      )
    );

  // Deleting and recreating the doc would be a way to dodge the lock above.
  allow delete: if false;
}
```
Once `phase1SubmittedAt` is set, both `phase1` and `phase1SubmittedAt` itself must stay byte-identical on every subsequent write (closes a two-step bypass where someone nulls `phase1SubmittedAt` in one write, then edits `phase1` freely in the next). `phase2` and other fields (`name`, `photoURL`, `email`) remain freely writable.

### 2. Leagues collection wide open
`wc2026/leagues` is one shared document holding every league. Any signed-in user can currently overwrite the whole thing — delete other people's leagues, hijack membership, change creators.

Drafted partial fix (blocks the most damaging case — deletion/wipeout — but can't fully validate per-league fields like `createdBy` immutability while all leagues share one document; that needs a data-model migration to a subcollection, `wc2026/leagues/{code}`, which is a bigger change than a rules-only fix):
```
match /wc2026/leagues {
  allow read:   if request.auth != null;
  allow create: if request.auth != null;
  allow update: if request.auth != null
    && resource.data.diff(request.resource.data).removedKeys().size() == 0;
  allow delete: if false;
}
```

### 3. Admin UID/password never wired up
Both `index.html`'s `ADMIN_UID` constant and `firestore.rules`' results-write rule still have the literal placeholder `"YOUR_ADMIN_UID_HERE"`. Steps to fix (needs Firebase Console access):
1. Sign in to the app once with your real Google account.
2. Firebase Console → Authentication → Users → copy your UID.
3. Replace the placeholder in both `index.html` (`ADMIN_UID`) and `firestore.rules` (the `wc2026/results` write rule).
4. Deploy rules: `firebase deploy --only firestore:rules`.

Separately, consider whether `ADMIN_PASS` (hardcoded plaintext in client JS) is worth keeping once the UID check works — it provides no real protection, only gates whether the panel UI renders, and reveals a password via View Source that may be reused elsewhere by mistake.

### 4. `wc2026/players` write rule likely broken for 2+ players
Current rule requires the *entire resulting document* to have only your own key (`request.resource.data.keys().hasOnly([request.auth.uid])`). For a merge write, Firestore Rules evaluate `request.resource.data` as the full post-merge document — so once a second player's entry exists, every subsequent player's write would include multiple keys and fail this check. (Worth confirming this is actually biting in production — if the real leaderboard already has multiple players, something about the deployed rules may differ from this file, which would itself be worth investigating.)

Drafted fix — diff-based instead of full-document-based:
```
match /wc2026/players {
  allow read: if request.auth != null;

  allow create: if request.auth != null
    && request.resource.data.keys().hasOnly([request.auth.uid])
    && request.resource.data[request.auth.uid].name is string
    && request.resource.data[request.auth.uid].name == request.auth.token.name;

  allow update: if request.auth != null
    && resource.data.diff(request.resource.data).affectedKeys().hasOnly([request.auth.uid])
    && request.resource.data[request.auth.uid].name is string
    && request.resource.data[request.auth.uid].name == request.auth.token.name;
}
```

---

## Getting Your Admin UID

**Not yet completed in production** — see Known Gap #3 above.

1. Deploy the app
2. Sign in with your Google account
3. Firebase Console → Authentication → Users → copy UID column
4. Paste into `firestore.rules` replacing `YOUR_ADMIN_UID_HERE`, and into `index.html`'s `ADMIN_UID` constant
5. Save and deploy rules: `firebase deploy --only firestore:rules`

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

- Player scores are computed client-side from picks + results — no stored score can be tampered with directly, but picks themselves can currently be tampered with after submission (see Known Gap #1)
- The Cloud Function score cache (`wc2026/scores`) is write-blocked from clients
- League membership protection is currently weaker than this doc previously claimed — see Known Gap #2
- Phase 2 unlock write-blocking depends on the same non-functional admin UID check — see Known Gap #3

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
