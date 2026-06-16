# Design System

## Philosophy
Dark football-pitch aesthetic. Feels like a stadium scoreboard.
Functional first — every pixel earns its place.
Mobile-first, but scales gracefully to desktop.

---

## Colour Tokens

The app uses two colour namespaces that co-exist in `index.html`:

### Global UI tokens (home banner, tabs, picks wizard, leaderboard)
```css
:root {
  /* Backgrounds */
  --bg:          #0E1117;   /* Page background */
  --surface:     #161B22;   /* Card/panel background */
  --elevated:    #1C2128;   /* Elevated surfaces (inputs, pills) */
  --border:      #21262D;   /* Borders, dividers */

  /* Brand */
  --gold:        #F5A623;   /* Primary CTA, active tabs, scores */
  --gold-tint:   rgba(245,166,35,0.12);  /* Subtle gold fill */
  --gold-border: rgba(245,166,35,0.25);  /* Gold-tinted borders */

  /* Semantic */
  --live:        #2ecc71;   /* Correct picks, advancing teams, success */
  --red:         #e74c3c;   /* Wrong picks, errors */
  --phase2:      #6c3fc7;   /* Phase 2 / Second Chance purple */
  --phase2-light:#8b5cf6;   /* Phase 2 text on dark */

  /* Text */
  --text:        #E6EDF3;   /* Primary text */
  --muted:       #7a9ab5;   /* Secondary text, labels */
}
```

### Picks wizard & bracket tokens (legacy, used inside the picks view)
```css
  --navy:        #0d1b2a;   /* Picks wizard background */
  --navy-card:   #111f2f;   /* Bracket card background */
  --navy-border: #1e3045;   /* Bracket borders */
  --pitch:       #1a3a2a;   /* Selected/active team state */
  --amber:       #f5a623;   /* Group header text, active picks */
  --green:       #2ecc71;   /* Correct picks */
  --white:       #f0f4f8;   /* Primary text inside wizard */

  /* Rankings */
  --gold-rank:   #ffd700;   /* 1st place medal */
  --silver:      #c0c0c0;   /* 2nd place medal */
  --bronze:      #cd7f32;   /* 3rd place medal */
```

**Why two namespaces?** The picks wizard and bracket were built earlier with a navy palette. The home/standings/leagues UI was redesigned in v4.5.0 with a GitHub-style dark palette. Both systems live in the same file; avoid mixing `--navy` in global UI or `--surface` inside the wizard.

---

## Typography

```css
/* Site-wide body font (switched from Inter in v4.3.0) */
font-family: 'DM Sans', sans-serif;

/* Display / Group headers inside picks wizard */
font-weight: 900;
letter-spacing: 2-3px;
text-transform: uppercase;

/* Body */
font-weight: 400-600;
font-size: 13-15px;   /* base 15px since v4.3.0 */

/* Numbers / Scores */
font-family: 'JetBrains Mono', monospace;
font-weight: 600-700;
```

Font sizes use `clamp()` for responsive scaling:
```css
home greeting name: 26px, weight 800
home greeting sub:  13px, --muted
section title:      16-18px, weight 900
card title:         11px, uppercase, letter-spacing 1px, --muted
body text:          13-14px
labels/meta:        10-11px
```

---

## Spacing
- Card padding: `14-16px`
- Gap between cards: `12-14px`
- View padding: `14px`
- Border radius: cards `10px`, buttons `6px`, pills `20px`, avatars `50%`

---

## Components

### Home Banner
3-column CSS grid (`grid-template-columns: 1fr auto 1fr`):
- **Left**: circular avatar (initials fallback) + greeting sub-text + bold first name
- **Centre**: `2026_FIFA_World_Cup_emblem.svg` at 80px height, `justify-self: center`
- **Right**: rank chip (rank label + `#N` number) only if the user has a real rank; nothing otherwise. The "Make Picks" CTA is intentionally NOT in the banner — it lives only in the home content card below.

Background: `linear-gradient(160deg, #2D333B 60%, rgba(245,166,35,0.10) 100%)`. `#2D333B` was chosen specifically because it's light enough to contrast the dark SVG emblem but dark enough to not feel out of place.

Status row below the grid shows: live match count · host countries · sign-out button.

### Mini Banner (non-home tabs)
A slim strip (`padding: 10px 16px`) at the top of the content area on every non-home tab. Contains the WC emblem at 44px centred. Tapping it calls `navTo('home')`. Implemented as a single `#mini-banner` div outside all view divs, shown/hidden by `setMiniBanner(tabName)` which is called from both the tab click handler and `navTo()`.

Why outside views: the div must be persistent across tab switches and not re-rendered — placing it inside each view would require duplicating it or re-mounting it.

### Picks Card (Home tab)
**New user** (no `phase1SubmittedAt` and not in `allPlayers`):
- Crystal ball emoji, headline "Make Your Predictions", description copy, full-width "Get Started →" button

**Returning user**:
- Points (large number), rank number, groups-settled / total-groups count
- Footer row: ⏰ "Phase 1 deadline: Jun 17 · 11:59 PM ET" + "View Picks" button

### Leaderboard Row
```
[rank medal] [avatar] [name + breakdown] [score pts]
```
- `me` variant: amber border + pitch background
- Tap to open score detail modal
- Score breakdown line: `Groups: Xpt · KO: Xpt · 2nd: Xpt`

### Group Drag Card (Picks wizard)
```
Group A  ▼
⠿  1  🇺🇸 USA          ✓ Advances
⠿  2  🏴󠁧󠁢󠁥󠁮󠁧󠁿 England      ✓ Advances
⠿  3  🇵🇦 Panama        —
⠿  4  🇧🇴 Bolivia       —
```
- Chevron (`▼`) in the header rotates to `▶` when collapsed via `.group-block-chevron.collapsed { transform: rotate(-90deg) }`
- Position badge colours: gold (1st), silver (2nd), grey (3rd), dark grey (4th)
- Drag handle: `⠿` braille pattern; touch-drag supported on mobile

### World Cup Groups Navigation
Single-group view with `‹ / ›` arrow buttons:
```
‹   Group A (1/12)   ›
┌─────────────────────┐
│  #  Team   P W D L GD Pts │
│  1  🇺🇸 USA  3 2 1 0  +4  7 │
│  ...                │
└─────────────────────┘
```
State tracked in `activeGroupPill` (letter string). `shiftGroup(delta)` increments the index and re-renders. Mirrors the Results date navigation pattern exactly.

### Bracket Column
- Each round is a vertical column
- Teams shown as tappable buttons: `[flag] [name]`
- Selected state: pitch background + amber text
- Winner of final: gold border display card with large flag
- Columns scroll horizontally as a unit
- Prev/Next nav between rounds: round label at `16px`, nav buttons scoped to `.bracket-round-nav .btn` (auto width, tight padding) so global `.btn { width: 100% }` does not apply

### Phase 2 Banner
Purple gradient background, distinct from Phase 1 amber theme.
Used to clearly signal the second prediction window.

### Pill (team selector)
- Default: dark background, muted border
- Selected: pitch background, amber border + text, bold
- Result-confirmed: green background + border

### Wizard Steps
```
[1 Groups] [2 3rd Place] [3 Bracket] [⚡ 2nd Chance]
```
- Done steps: green background
- Active step: amber text + pitch background
- Phase 2 step: purple

---

## Responsive Breakpoints

### Mobile (< 37.5rem / ~600px) — default
- `#app { max-width: 100% }`
- Full-width tabs (5 visible), sticky at bottom of viewport
- Touch drag for group ranking
- Bracket scrolls horizontally

### Desktop (≥ 37.5rem)
- `#app { max-width: 60% }` — relative units, not px, so it adapts to any screen
- Tabs use `position: sticky; bottom: 0` and `max-width: 100%` within the app container (no separate transform needed)
- Rationale for 60%: mirrors the proportions of the deployed live site; feels app-like on wider screens without too much empty space

```css
@media (min-width: 37.5rem) {
  #app { max-width: 60% }
  .tabs { position: sticky; bottom: 0; transform: none; left: auto; max-width: 100% }
}
```

Note: a full two-column desktop layout (leaderboard left, picks right) was planned but not yet implemented. The current layout is single-column at 60% width.

---

## Iconography
All icons are emoji — no icon library dependency.
```
🏠 Home tab
✏️ Predict / My Picks tab
⚽ World Cup tab
🏆 Standings tab
👥 Leagues tab
🔧 Admin tab
📋 Rules
⚡ Phase 2
🥾 Golden Boot
🥇🥈🥉 Rank medals
🔒 Locked
👤 Avatar placeholder
⠿ Drag handle
🔮 New user picks CTA
⏰ Deadline footer
▼ / ▶ Collapsible group chevron (CSS rotated, not two separate icons)
‹ / › Arrow navigation (Results date nav, Group nav)
```

**SVG asset**: `2026_FIFA_World_Cup_emblem.svg` — the official WC 2026 emblem. Used at:
- Login screen: 220px height, centred
- Home banner: 80px height, grid centre column
- Mini banner: 44px height, centred

Country flags: emoji flags throughout (browser-rendered).
Format: Unicode regional indicator symbols.
Examples: 🇺🇸 🇧🇷 🇫🇷 🇩🇪 🇦🇷 🇪🇸 🇵🇹

**Flag name variants**: `worldcup26.ir` API uses different country name strings than `football-data.org`. The `flagFor()` function includes all known variants for: Czechia / Czech Republic, Congo DR / Democratic Republic of the Congo, Bosnia-Herzegovina / Bosnia and Herzegovina, Cape Verde Islands / Cape Verde. Always add both variants when adding a new team.

---

## Animations
- Live dot pulse: `opacity 1→0.3→1` over 2s
- Score flash (live match): `opacity 1→0.6→1` over 2s
- Toast slide: `translateY(80px→0)` over 0.3s
- Progress bar fill: `width` transition 0.3s
- Tab underline: `border-bottom-color` transition 0.2s
- Drag-over state: amber top border, green background

---

## Loading States
- Spinner: text "Loading…" centred, muted colour
- Saving: button text changes to "Saving…", disabled=true
- Sync: amber dot pulse in user bar during writes

---

## Empty States
- No players: "No picks yet — be the first!" with football emoji
- No leagues: "⚽\nNo leagues yet.\nCreate one or join with a code."
- Phase 2 locked: "🔒\nSecond Chance\nUnlocks after the group stage ends."
- No live data: "⏳ Awaiting live data" with explanation

---

## Colour Usage Rules
- **Never** use --amber for error states (use --red)
- **Never** use --green for CTAs (use --amber)
- Phase 2 elements always use --phase2 / --phase2-light
- Correct picks: --green. Wrong picks: #a05050 (muted red, not full --red)
- Pending/unknown: --amber
