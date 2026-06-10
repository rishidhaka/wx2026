# Design System

## Philosophy
Dark football-pitch aesthetic. Feels like a stadium scoreboard.
Functional first — every pixel earns its place.
Mobile-first, but scales gracefully to desktop.

---

## Colour Tokens

```css
:root {
  /* Backgrounds */
  --navy:        #0d1b2a;   /* Page background */
  --navy-card:   #111f2f;   /* Card/panel background */
  --navy-border: #1e3045;   /* Borders, dividers */
  --pitch:       #1a3a2a;   /* Selected/active states (grass green) */

  /* Brand */
  --amber:       #f5a623;   /* Primary CTA, active tabs, scores */

  /* Semantic */
  --green:       #2ecc71;   /* Correct picks, advancing teams, success */
  --red:         #e74c3c;   /* Wrong picks, errors, danger */
  --blue:        #3498db;   /* Info states */
  --phase2:      #6c3fc7;   /* Phase 2 / Second Chance purple */
  --phase2-light:#8b5cf6;   /* Phase 2 text on dark */

  /* Text */
  --white:       #f0f4f8;   /* Primary text */
  --muted:       #7a9ab5;   /* Secondary text, labels */

  /* Rankings */
  --gold:        #ffd700;   /* 1st place */
  --silver:      #c0c0c0;   /* 2nd place */
  --bronze:      #cd7f32;   /* 3rd place */
}
```

---

## Typography

```css
/* Display / Headers */
font-family: 'Inter', sans-serif;
font-weight: 900;
letter-spacing: 2-3px;
text-transform: uppercase;

/* Body */
font-family: 'Inter', sans-serif;
font-weight: 400-600;
font-size: 12-14px;

/* Numbers / Scores */
font-family: 'JetBrains Mono', monospace;
font-weight: 600-700;
```

Font sizes use `clamp()` for responsive scaling:
```css
h1: clamp(24px, 7vw, 48px)
section title: 16-18px, weight 900
card title: 11px, uppercase, letter-spacing 1px, --muted colour
body text: 13-14px
labels/meta: 10-11px
```

---

## Spacing
- Card padding: `14-16px`
- Gap between cards: `12-14px`
- View padding: `14px`
- Border radius: cards `10px`, buttons `6px`, pills `20px`, avatars `50%`

---

## Components

### Leaderboard Row
```
[rank medal] [avatar] [name + breakdown] [score pts]
```
- `me` variant: amber border + pitch background
- Tap to open score detail modal
- Score breakdown line: `Groups: Xpt · KO: Xpt · 2nd: Xpt`

### Group Drag Card
```
GROUP A
⠿  1  🇺🇸 USA          ✓ Advances
⠿  2  🏴󠁧󠁢󠁥󠁮󠁧󠁿 England      ✓ Advances
⠿  3  🇵🇦 Panama        —
⠿  4  🇧🇴 Bolivia       —
```
- Position badge colours: gold (1st), silver (2nd), grey (3rd), dark grey (4th)
- Drag handle: `⠿` braille pattern
- Touch-drag supported on mobile

### Bracket Column
- Each round is a vertical column
- Teams shown as tappable buttons: `[flag] [name]`
- Selected state: pitch background + amber text
- Winner of final: gold border display card with large flag
- Columns scroll horizontally as a unit

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

### Mobile (< 600px) — default
- Single column
- Full-width tabs, 5 tabs visible
- Touch drag for group ranking
- Bracket scrolls horizontally
- Tab labels shortened

### Tablet (600–1024px)
- Max-width 600px centred
- Slightly more padding
- Same single-column layout

### Desktop (≥ 1024px)
- Two-column layout: `minmax(340px, 1fr)` each side
- Left: leaderboard + league board
- Right: active view (picks/live/rules)
- Header spans full width
- Tabs shift to left sidebar on very wide screens (future)
- Bracket shown full-width, all rounds visible without scrolling

Desktop CSS:
```css
@media (min-width: 1024px) {
  #app { max-width: 1100px; }
  .desktop-grid {
    display: grid;
    grid-template-columns: 340px 1fr;
    gap: 20px;
  }
}
```

---

## Iconography
All icons are emoji — no icon library dependency.
```
🌍 Global / Board
⚽ Leagues / Live
✏️ Picks
🔧 Admin
📋 Rules
⚡ Phase 2
🏆 Champion
🥾 Golden Boot
🥇🥈🥉 Rank medals
🔒 Locked
👤 Avatar placeholder
⠿ Drag handle
```

Country flags: emoji flags throughout (browser-rendered).
Format: Unicode regional indicator symbols.
Examples: 🇺🇸 🇧🇷 🇫🇷 🇩🇪 🇦🇷 🇪🇸 🇵🇹

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
