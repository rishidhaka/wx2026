/**
 * FIFA 2026 Prediction League — Firebase Cloud Function
 * ─────────────────────────────────────────────────────
 * Runs every 60 minutes. Fetches from football-data.org, writes
 * structured tournament data to Firestore wc2026/tournament.
 * Also auto-updates wc2026/results and recalculates all scores.
 *
 * SETUP:
 *   cd functions
 *   npm install firebase-admin firebase-functions axios
 *   # Set the API key as a Firebase secret:
 *   firebase functions:secrets:set FOOTBALLDATA_KEY
 *   firebase deploy --only functions
 */

const functions = require("firebase-functions");
const admin     = require("firebase-admin");
const axios     = require("axios");

admin.initializeApp();
const db = admin.firestore();

// ── CONFIG ────────────────────────────────────────────────────────────────
const API_KEY  = process.env.FOOTBALLDATA_KEY;
const API_BASE = "https://api.football-data.org/v4";
const WC_CODE  = "WC";
const WC_SEASON = 2026;

// ── AXIOS CLIENT ──────────────────────────────────────────────────────────
const api = axios.create({
  baseURL: API_BASE,
  headers: { "X-Auth-Token": API_KEY },
  timeout: 15000,
});

// ── HELPERS ───────────────────────────────────────────────────────────────
function flagFor(name) {
  const map = {
    "Mexico": "🇲🇽", "South Africa": "🇿🇦", "Korea Republic": "🇰🇷", "South Korea": "🇰🇷",
    "Canada": "🇨🇦", "Qatar": "🇶🇦", "Switzerland": "🇨🇭", "United States": "🇺🇸", "USA": "🇺🇸",
    "Colombia": "🇨🇴", "Argentina": "🇦🇷", "Morocco": "🇲🇦", "Nigeria": "🇳🇬", "Tunisia": "🇹🇳",
    "Brazil": "🇧🇷", "Japan": "🇯🇵", "Australia": "🇦🇺", "Saudi Arabia": "🇸🇦", "France": "🇫🇷",
    "Egypt": "🇪🇬", "Iran": "🇮🇷", "Peru": "🇵🇪", "Spain": "🇪🇸", "Senegal": "🇸🇳",
    "Ecuador": "🇪🇨", "England": "🏴󠁧󠁢󠁥󠁮󠁧󠁿", "Portugal": "🇵🇹", "Cameroon": "🇨🇲", "Chile": "🇨🇱",
    "Germany": "🇩🇪", "Belgium": "🇧🇪", "Costa Rica": "🇨🇷", "Italy": "🇮🇹", "Uruguay": "🇺🇾",
    "Panama": "🇵🇦", "Bolivia": "🇧🇴", "Netherlands": "🇳🇱", "Croatia": "🇭🇷", "Serbia": "🇷🇸",
    "Paraguay": "🇵🇾", "Poland": "🇵🇱", "Denmark": "🇩🇰", "Venezuela": "🇻🇪", "Turkey": "🇹🇷",
    "Türkiye": "🇹🇷", "Algeria": "🇩🇿", "New Zealand": "🇳🇿", "Honduras": "🇭🇳",
    "Guatemala": "🇬🇹", "Jamaica": "🇯🇲", "Cuba": "🇨🇺",
  };
  return map[name] || "🏳️";
}

function humanRound(stage) {
  const map = {
    "LAST_32": "Round of 32", "LAST_16": "Round of 16",
    "QUARTER_FINALS": "Quarter-finals", "SEMI_FINALS": "Semi-finals",
    "THIRD_PLACE": "3rd Place Playoff", "FINAL": "Final",
    "GROUP_STAGE": "Group Stage",
  };
  return map[stage] || stage;
}

function winnerName(m) {
  if (!m.score?.winner) return null;
  if (m.score.winner === "HOME_TEAM") return m.homeTeam.name;
  if (m.score.winner === "AWAY_TEAM") return m.awayTeam.name;
  return null;
}

async function fetchWithRetry(path, params = {}, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await api.get(path, { params });
      return res.data;
    } catch (e) {
      if (i === retries) throw e;
      await new Promise(r => setTimeout(r, 2000 * (i + 1)));
    }
  }
}

// ── FETCH GROUPS (derived from group stage fixtures) ──────────────────────
async function fetchGroups(allMatches) {
  const groupMatches = allMatches.filter(m => m.stage === "GROUP_STAGE");
  const groups = {};

  for (const m of groupMatches) {
    const g = m.group;
    if (!g) continue;
    if (!groups[g]) groups[g] = {};

    const home = m.homeTeam.name;
    const away = m.awayTeam.name;
    if (!groups[g][home]) groups[g][home] = { team: home, flag: flagFor(home), played:0, won:0, drawn:0, lost:0, gf:0, ga:0, gd:0, points:0 };
    if (!groups[g][away]) groups[g][away] = { team: away, flag: flagFor(away), played:0, won:0, drawn:0, lost:0, gf:0, ga:0, gd:0, points:0 };

    const fin = ["FINISHED", "AWARDED"].includes(m.status);
    if (!fin) continue;

    const hg = m.score.fullTime.home ?? 0;
    const ag = m.score.fullTime.away ?? 0;

    groups[g][home].played++; groups[g][away].played++;
    groups[g][home].gf += hg; groups[g][home].ga += ag;
    groups[g][away].gf += ag; groups[g][away].ga += hg;
    groups[g][home].gd += hg - ag; groups[g][away].gd += ag - hg;

    if (hg > ag) {
      groups[g][home].won++; groups[g][home].points += 3; groups[g][away].lost++;
    } else if (hg < ag) {
      groups[g][away].won++; groups[g][away].points += 3; groups[g][home].lost++;
    } else {
      groups[g][home].drawn++; groups[g][home].points++;
      groups[g][away].drawn++; groups[g][away].points++;
    }
  }

  return Object.entries(groups)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([g, teamsMap]) => ({
      name: g.replace("GROUP_", ""),
      standings: Object.values(teamsMap).sort((a, b) =>
        b.points - a.points || b.gd - a.gd || b.gf - a.gf
      ),
    }));
}

// ── FETCH ALL MATCHES ─────────────────────────────────────────────────────
async function fetchAllMatches() {
  const data = await fetchWithRetry(`/competitions/${WC_CODE}/matches`, { season: WC_SEASON });
  return (data.matches || []).map(m => {
    const fin  = ["FINISHED", "AWARDED"].includes(m.status);
    const live = ["IN_PLAY", "PAUSED", "HALF_TIME"].includes(m.status);
    const ft   = m.score?.fullTime || {};
    return {
      id:        m.id,
      stage:     m.stage,
      group:     m.group || null,
      round:     m.stage === "GROUP_STAGE"
        ? `Group Stage - Matchday ${m.matchday}`
        : humanRound(m.stage),
      matchday:  m.matchday,
      date:      new Date(m.utcDate).toLocaleDateString("en-GB", { weekday:"short", day:"numeric", month:"short", timeZone:"America/New_York" }),
      time:      new Date(m.utcDate).toLocaleTimeString("en-US", { hour:"numeric", minute:"2-digit", timeZone:"America/New_York", hour12:true }) + " ET",
      utcDate:   m.utcDate,
      home:      m.homeTeam.name,
      away:      m.awayTeam.name,
      homeFlag:  flagFor(m.homeTeam.name),
      awayFlag:  flagFor(m.awayTeam.name),
      homeScore: (fin || live) ? ft.home : null,
      awayScore: (fin || live) ? ft.away : null,
      status:    live ? "live" : fin ? "fin" : "upcoming",
      winner:    fin ? winnerName(m) : null,
    };
  });
}

// ── FETCH TOP SCORERS ─────────────────────────────────────────────────────
async function fetchScorers() {
  const data = await fetchWithRetry(`/competitions/${WC_CODE}/scorers`, { season: WC_SEASON, limit: 20 });
  return (data.scorers || []).map(s => ({
    name:    s.player.name,
    team:    s.team.name,
    flag:    flagFor(s.team.name),
    goals:   s.goals || 0,
    assists: s.assists || 0,
  }));
}

// ── DERIVE BRACKET FROM KNOCKOUT FIXTURES ────────────────────────────────
function deriveBracket(fixtures) {
  const bracket = { r32:[], r16:[], qf:[], sf:[], final:[], winner:[] };
  const stageMap = {
    "LAST_32":        "r32",
    "LAST_16":        "r16",
    "QUARTER_FINALS": "qf",
    "SEMI_FINALS":    "sf",
    "FINAL":          "final",
  };

  for (const f of fixtures) {
    const key = stageMap[f.stage];
    if (!key) continue;
    if (f.home && f.away) bracket[key].push(f.home, f.away);
    if (key === "final" && f.winner) bracket.winner = [f.winner];
  }

  return bracket;
}

// ── DERIVE RESULTS FOR SCORING ────────────────────────────────────────────
function deriveResults(fixtures, groups) {
  const results = {
    groups:               {},   // { A: ["Team1","Team2","Team3","Team4"] } ranked
    thirdPlaceQualifiers: [],
    bracket:              { r32:[], r16:[], qf:[], sf:[], final:[], winner:[] },
    goldenBoot:           "",
    phase2Unlocked:       false,
  };

  // Group order from standings
  for (const g of groups) {
    results.groups[g.name] = g.standings.map(t => t.team);
  }

  // Knockout results
  const stageMap = {
    "LAST_32":        "r32",
    "LAST_16":        "r16",
    "QUARTER_FINALS": "qf",
    "SEMI_FINALS":    "sf",
    "FINAL":          "final",
  };

  for (const f of fixtures) {
    const key = stageMap[f.stage];
    if (!key || f.status !== "fin") continue;
    if (f.home && f.away) results.bracket[key].push(f.home, f.away);
    if (f.winner) {
      if (key === "final") results.bracket.winner = [f.winner];
    }
  }

  // Unlock Phase 2 once all group stage games are finished
  const groupFixtures = fixtures.filter(f => f.stage === "GROUP_STAGE");
  const allGroupDone  = groupFixtures.length > 0 && groupFixtures.every(f => f.status === "fin");
  results.phase2Unlocked = allGroupDone;

  return results;
}

// ── RECALCULATE ALL PLAYER SCORES ─────────────────────────────────────────
async function recalculateScores(results, scorers) {
  const playersSnap = await db.collection("wc2026picks").get();
  if (playersSnap.empty) return;

  const topScorer = scorers.length > 0 ? scorers[0].name : "";
  const scores = {};

  playersSnap.forEach(doc => {
    const uid    = doc.id;
    const data   = doc.data();
    const phase1 = data.phase1 || {};
    const phase2 = data.phase2 || {};
    let score = 0;

    // Phase 1 — group picks
    const actualGroups = results.groups || {};
    if (phase1.groups) {
      for (const [grp, order] of Object.entries(phase1.groups)) {
        const actual = actualGroups[grp] || [];
        if (actual[0] && order[0] === actual[0]) score += 1; // 1st correct
        if (actual[1] && order[1] === actual[1]) score += 1; // 2nd correct
        if (actual[2] && order[2] === actual[2]) score += 1; // 3rd correct
      }
    }

    // Phase 1 — third place qualifiers
    const actualTPQ = results.thirdPlaceQualifiers || [];
    (phase1.thirdPlaceQualifiers || []).forEach(t => {
      if (actualTPQ.includes(t)) score += 2;
    });

    // Phase 1 — bracket (points per round)
    const P1_PTS = { r32:2, r16:3, qf:5, sf:10, final:20 };
    const actualBracket = results.bracket || {};
    for (const [round, pts] of Object.entries(P1_PTS)) {
      const actual = actualBracket[round] || [];
      (phase1.bracket?.[round] || []).forEach(t => {
        if (t && actual.includes(t)) score += pts;
      });
    }

    // Phase 1 — golden boot
    if (phase1.goldenBoot && topScorer &&
        phase1.goldenBoot.toLowerCase().trim() === topScorer.toLowerCase().trim()) {
      score += 10;
    }

    // Phase 2 — bracket (5pts flat per correct pick)
    const P2_ROUNDS = ["r16", "qf", "sf", "final"];
    for (const round of P2_ROUNDS) {
      const actual = actualBracket[round] || [];
      (phase2.bracket?.[round] || []).forEach(t => {
        if (t && actual.includes(t)) score += 5;
      });
    }

    // Phase 2 — golden boot (5pts)
    if (phase2.goldenBoot && topScorer &&
        phase2.goldenBoot.toLowerCase().trim() === topScorer.toLowerCase().trim()) {
      score += 5;
    }

    scores[uid] = score;
  });

  await db.collection("wc2026").doc("scores").set(scores);
  functions.logger.info(`Scores recalculated for ${Object.keys(scores).length} players`);
}

// ── MAIN SYNC LOGIC ───────────────────────────────────────────────────────
async function runSync() {
  functions.logger.info("Starting World Cup sync (football-data.org)…");

  const [allMatches, scorers] = await Promise.all([
    fetchAllMatches(),
    fetchScorers(),
  ]);

  const groups  = await fetchGroups(allMatches);
  const bracket = deriveBracket(allMatches);
  const results = deriveResults(allMatches, groups);

  // Write tournament display data (cap fixtures to avoid Firestore 1MB limit)
  await db.collection("wc2026").doc("tournament").set({
    groups,
    fixtures: allMatches.slice(0, 120),
    bracket,
    scorers,
    lastSync: Date.now(),
  });

  // Write results used by scoring engine
  await db.collection("wc2026").doc("results").set(results, { merge: true });

  // Recalculate scores
  await recalculateScores(results, scorers);

  functions.logger.info("Sync complete ✓");
}

// ── SCHEDULED FUNCTION — every 60 minutes ────────────────────────────────
exports.syncWorldCup = functions
  .runWith({ timeoutSeconds: 120, memory: "256MB", secrets: ["FOOTBALLDATA_KEY"] })
  .pubsub.schedule("every 60 minutes")
  .onRun(async () => {
    try {
      await runSync();
    } catch (e) {
      functions.logger.error("Sync failed:", e.message);
    }
  });

// ── HTTP ENDPOINT — manual trigger ───────────────────────────────────────
exports.syncNow = functions
  .runWith({ timeoutSeconds: 120, memory: "256MB", secrets: ["FOOTBALLDATA_KEY"] })
  .https.onRequest(async (req, res) => {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (token !== API_KEY) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    try {
      await runSync();
      res.json({ ok: true, time: new Date().toISOString() });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
