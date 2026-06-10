# Scoring Rules

Complete and authoritative scoring reference for the FIFA 2026 Prediction League.

---

## Phase 1 — Pre-Tournament Predictions

Submitted before the tournament starts. Picks lock when the first group game kicks off.

### Group Stage Picks (per group, 12 groups total)

| Pick | Points | Max total |
|---|---|---|
| 1st place correct | 1pt | 12pts |
| 2nd place correct | 1pt | 12pts |
| 3rd place correct | 1pt | 12pts |

**Subtotal: 36pts max**

### Third-Place Qualifiers (new in 2026)

8 of the 12 third-placed teams advance to R32.
Users pick which 8 they think will qualify.

| Pick | Points | Max total |
|---|---|---|
| Each correct third-place qualifier | 2pts | 16pts |

**Subtotal: 16pts max**

> Why 2pts? It's harder than picking a group position (you're selecting from 12 teams, not 4) and it rewards understanding of relative group difficulty.

### Knockout Bracket Picks

Users predict match winners all the way through to the Final.
Bracket is auto-seeded from their group picks (simplified seeding —
exact R32 pairings depend on which thirds qualify, per FIFA's 495 scenarios).

| Round | Points per correct pick | Teams to pick | Max total |
|---|---|---|---|
| Round of 32 | 2pts | 16 winners | 32pts |
| Round of 16 | 3pts | 8 winners | 24pts |
| Quarter-finals | 5pts | 4 winners | 20pts |
| Semi-finals | 10pts | 2 winners | 20pts |
| Final (Champion) | 20pts | 1 winner | 20pts |

**Subtotal: 116pts max**

### Golden Boot (Phase 1)

| Pick | Points |
|---|---|
| Correct top scorer | 10pts |

---

## Phase 1 Total Maximum: **178pts**

*(36 group + 16 third qual + 116 KO + 10 golden boot)*

---

## Phase 2 — Second Chance

Unlocks after the group stage ends (admin flips the switch).
Shows the real R16 bracket. Users predict from R16 to the Final.
Flat 5pts per correct pick — no escalation.

| Pick | Points |
|---|---|
| Round of 16 winner (8 picks) | 5pts each = 40pts max |
| Quarter-final winner (4 picks) | 5pts each = 20pts max |
| Semi-final winner (2 picks) | 5pts each = 10pts max |
| Final winner / Champion (1 pick) | 5pts = 5pts max |
| Golden Boot update | 5pts |

**Phase 2 Maximum: 80pts**

---

## Combined Maximum: 258pts

---

## Scoring Behaviour

### Rolling updates
Points are awarded as each match finishes — not at the end of each round.
The moment a result is confirmed (via Cloud Function sync or admin save),
all player scores recalculate instantly on every connected device.

### Wrong group picks cascade
If you predicted Brazil wins Group G but they finish 2nd:
- Your R32 bracket had Brazil as a Group G winner
- Brazil may still appear in your bracket as a 2nd-place seed
- You score points for any picks that happen to be correct regardless
- Phase 2 gives everyone a fresh start with the real bracket

### Third-place qualifier scoring
You pick 8 teams from the 12 third-placed finishers.
Points awarded for each team that actually advances.
The 4 teams that don't advance score 0 — no penalty.

### Golden Boot
- Case-insensitive comparison (`kylian mbappé` = `Kylian Mbappé`)
- Whitespace trimmed
- Phase 1: 10pts. Phase 2 update: 5pts (separate, both can score)
- If same player wins both Phase 1 and Phase 2 picks: both score

### Phase 2 locked
No Phase 2 points awarded until admin sets `phase2Unlocked: true` in Firestore.

---

## Score Breakdown Display

The leaderboard shows:
- Total score (large, amber)
- Groups breakdown
- KO breakdown
- 2nd Chance breakdown (if unlocked)

Tapping a player row shows full detail — which picks hit/missed per category.

---

## Tiebreaker (same score)

Currently: stable sort (first to submit picks ranks higher among equals).
Future enhancement: tiebreak by number of correct picks, then earliest submission.
