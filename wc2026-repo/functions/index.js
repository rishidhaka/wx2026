/**
 * FIFA 2026 Prediction League — Firebase Cloud Function
 * ─────────────────────────────────────────────────────
 * Runs every 60 minutes. Fetches from API-Football, writes
 * structured tournament data to Firestore wc2026/tournament.
 * Also auto-updates wc2026/results and recalculates all scores.
 *
 * SETUP:
 *   cd functions
 *   npm install firebase-admin firebase-functions axios
 *   firebase functions:config:set apifootball.key="YOUR_API_KEY"
 *   firebase deploy --only functions
 */

const functions  = require("firebase-functions");
const admin      = require("firebase-admin");
const axios      = require("axios");

admin.initializeApp();
const db = admin.firestore();

// ── CONFIG ────────────────────────────────────────────────────────────────
const API_KEY     = process.env.APIFOOTBALL_KEY;
const API_BASE    = "https://v3.football.api-sports.io";
const WC_2026_ID  = 1; // FIFA World Cup - league ID verified from API-Football (ID: 1, Season: 2026)
const WC_SEASON   = 2026;

const PICK_CATS = [
  { key: "groupWinners",  count: 12, pts: 2  },
  { key: "quarterFinals", count: 8,  pts: 3  },
  { key: "semiFinals",    count: 4,  pts: 5  },
  { key: "finalists",     count: 2,  pts: 10 },
  { key: "winner",        count: 1,  pts: 20 },
];

// Round name → results key mapping
const ROUND_MAP = {
  "Group Stage":        "groupWinners",
  "Round of 16":        "quarterFinals",  // teams who win R16 become QF players
  "Quarter-finals":     "semiFinals",
  "Semi-finals":        "finalists",
  "Final":              "winner",
};

// ── AXIOS CLIENT ──────────────────────────────────────────────────────────
const api = axios.create({
  baseURL: API_BASE,
  headers: {
    "x-rapidapi-key":  API_KEY,
    "x-rapidapi-host": "v3.football.api-sports.io",
  },
  timeout: 10000,
});

// ── HELPERS ───────────────────────────────────────────────────────────────
function getFlagEmoji(countryCode) {
  if (!countryCode || countryCode.length !== 2) return "🏳️";
  const offset = 127397;
  return [...countryCode.toUpperCase()].map(c => String.fromCodePoint(c.charCodeAt(0) + offset)).join("");
}

async function fetchWithRetry(url, params, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await api.get(url, { params });
      return res.data.response || [];
    } catch (e) {
      if (i === retries) throw e;
      await new Promise(r => setTimeout(r, 2000 * (i + 1)));
    }
  }
}

// ── MAIN FUNCTION — runs every 60 minutes ─────────────────────────────────
exports.syncWorldCup = functions
  .runWith({ timeoutSeconds: 120, memory: "256MB" })
  .pubsub.schedule("every 60 minutes")
  .onRun(async () => {
    functions.logger.info("Starting World Cup sync…");

    try {
      const [groups, fixtures, scorers] = await Promise.all([
        fetchGroups(),
        fetchFixtures(),
        fetchScorers(),
      ]);

      const bracket  = deriveBracket(fixtures);
      const results  = deriveResults(fixtures, groups);

      // Write tournament display data
      await db.collection("wc2026").doc("tournament").set({
        groups,
        fixtures: fixtures.slice(0, 100), // cap for Firestore doc size
        bracket,
        scorers,
        lastSync: Date.now(),
      });

      // Write results (used for score calculation)
      await db.collection("wc2026").doc("results").set(results, { merge: true });

      // Recalculate all player scores
      await recalculateScores(results, scorers);

      functions.logger.info("Sync complete ✓");
    } catch (e) {
      functions.logger.error("Sync failed:", e.message);
    }
  });

// ── Also expose as HTTP endpoint for manual trigger ───────────────────────
exports.syncNow = functions.https.onRequest(async (req, res) => {
  // Basic auth check — only admin can call this
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (token !== API_KEY) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    await exports.syncWorldCup.run();
    res.json({ ok: true, time: new Date().toISOString() });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── FETCH GROUPS ──────────────────────────────────────────────────────────
async function fetchGroups() {
  const raw = await fetchWithRetry("/standings", {
    league: WC_2026_ID,
    season: WC_SEASON,
  });

  if (!raw.length) return [];

  const standings = raw[0]?.league?.standings || [];

  return standings.map(group => ({
    name:       group[0]?.group?.replace("Group ", "") || "?",
    standings:  group.map(t => ({
      team:    t.team.name,
      flag:    getFlagEmoji(t.team.country || ""),
      played:  t.all.played,
      won:     t.all.win,
      drawn:   t.all.draw,
      lost:    t.all.lose,
      gd:      t.goalsDiff,
      points:  t.points,
    })),
  }));
}

// ── FETCH FIXTURES ────────────────────────────────────────────────────────
async function fetchFixtures() {
  const raw = await fetchWithRetry("/fixtures", {
    league: WC_2026_ID,
    season: WC_SEASON,
  });

  return raw.map(f => {
    const s = f.fixture.status;
    const isLive = ["1H","2H","HT","ET","P"].includes(s.short);
    const isFin  = ["FT","AET","PEN"].includes(s.short);

    return {
      id:        f.fixture.id,
      date:      new Date(f.fixture.date).toLocaleDateString("en-GB", { weekday:"short", day:"numeric", month:"short" }),
      time:      new Date(f.fixture.date).toLocaleTimeString("en-GB", { hour:"2-digit", minute:"2-digit" }),
      venue:     f.fixture.venue?.city || "",
      round:     f.league.round,
      competition: "FIFA World Cup 2026",
      home:      f.teams.home.name,
      away:      f.teams.away.name,
      homeFlag:  getFlagEmoji(f.teams.home.id ? (f.teams.home.country || "") : ""),
      awayFlag:  getFlagEmoji(f.teams.away.id ? (f.teams.away.country || "") : ""),
      homeScore: isFin||isLive ? f.goals.home : null,
      awayScore: isFin||isLive ? f.goals.away : null,
      status:    isLive ? "live" : isFin ? "fin" : "upcoming",
      minute:    isLive ? s.elapsed : null,
      winner:    isFin ? (f.teams.home.winner ? f.teams.home.name : f.teams.away.winner ? f.teams.away.name : null) : null,
    };
  });
}

// ── FETCH TOP SCORERS ─────────────────────────────────────────────────────
async function fetchScorers() {
  const raw = await fetchWithRetry("/players/topscorers", {
    league: WC_2026_ID,
    season: WC_SEASON,
  });

  return raw.slice(0, 20).map(p => ({
    name:   p.player.name,
    team:   p.statistics[0]?.team?.name || "",
    flag:   getFlagEmoji(p.statistics[0]?.team?.country || ""),
    goals:  p.statistics[0]?.goals?.total || 0,
    assists: p.statistics[0]?.goals?.assists || 0,
  }));
}

// ── DERIVE BRACKET FROM FIXTURES ──────────────────────────────────────────
function deriveBracket(fixtures) {
  const bracket = { r32:[], r16:[], qf:[], sf:[], final:[], winner:[] };
  const scoreKeys = { r32:"r32_scores", r16:"r16_scores", qf:"qf_scores", sf:"sf_scores", final:"final_scores" };

  const roundMap = {
    "Round of 32":    "r32",
    "Round of 16":    "r16",
    "Quarter-finals": "qf",
    "Semi-finals":    "sf",
    "Final":          "final",
  };

  Object.values(scoreKeys).forEach(k => bracket[k] = []);

  fixtures.forEach(f => {
    const key = roundMap[f.round];
    if (!key) return;
    bracket[key].push(f.home, f.away);
    bracket[scoreKeys[key]].push(
      f.homeScore !== null ? String(f.homeScore) : "",
      f.awayScore !== null ? String(f.awayScore) : ""
    );
    // Track winner of Final
    if (key === "final" && f.winner) {
      bracket.winner = [f.winner];
    }
  });

  return bracket;
}

// ── DERIVE RESULTS FOR SCORING ────────────────────────────────────────────
function deriveResults(fixtures, groups) {
  const results = {
    groupWinners:      [], // Top 2 from each group
    thirdPlaceQualifiers: [], // Best 3rd place teams
    roundOf16Winners:  [], // Winners of R16 (these advance to QF)
    quarterFinals:     [], // Winners of QF (these advance to SF)
    semiFinals:        [], // Winners of SF (these advance to Final)
    finalists:         [], // The 2 teams in the final
    winner:            [], // Champion
    goldenBoot:        "", // Top scorer name
  };

  // Derive group winners from standings (top 2 from each group)
  groups.forEach(group => {
    const standings = group.standings || [];
    standings.slice(0, 2).forEach(team => {
      results.groupWinners.push(team.team);
    });
  });

  // Derive knockout results from finished fixtures
  const knockoutRounds = {
    "Round of 16":     "roundOf16Winners",
    "Quarter-finals":  "quarterFinals",
    "Semi-finals":     "semiFinals",
    "Final":           "finalists",
  };

  fixtures.forEach(f => {
    if (f.status === "fin" && knockoutRounds[f.round]) {
      const resultKey = knockoutRounds[f.round];
      
      if (f.round === "Final") {
        // For final, store both finalists
        results.finalists.push(f.home, f.away);
        // And the winner
        if (f.winner) results.winner = [f.winner];
      } else if (f.winner) {
        // For other knockout rounds, store winners
        results[resultKey].push(f.winner);
      }
    }
  });

  return results;
}

// ── RECALCULATE ALL PLAYER SCORES ─────────────────────────────────────────
async function recalculateScores(results, scorers) {
  const playersSnap = await db.collection("wc2026picks").get();
  if (playersSnap.empty) return;

  const scores = {};
  const topScorer = scorers.length > 0 ? scorers[0].name : "";

  playersSnap.forEach(doc => {
    const uid = doc.id;
    const data = doc.data();
    const phase1 = data.phase1 || {};
    const phase2 = data.phase2 || {};
    
    let score = 0;

    // PHASE 1 SCORING
    // 1. Group winners (top 2 from each group) - simplified: just check if team in results
    const groupWinners = results.groupWinners || [];
    if (phase1.groups) {
      Object.values(phase1.groups).forEach(group => {
        if (Array.isArray(group)) {
          group.slice(0, 2).forEach(team => {
            if (groupWinners.includes(team)) score += 2;
          });
        }
      });
    }

    // 2. Third place qualifiers (4 best 3rd place teams)
    const tpq = phase1.thirdPlaceQualifiers || [];
    const actualTPQ = results.thirdPlaceQualifiers || [];
    tpq.forEach(team => {
      if (actualTPQ.includes(team)) score += 3;
    });

    // 3. Bracket predictions - Round of 16 winners
    const r16Winners = results.roundOf16Winners || [];
    if (phase1.bracket && Array.isArray(phase1.bracket.r16)) {
      phase1.bracket.r16.forEach(team => {
        if (r16Winners.includes(team)) score += 3;
      });
    }

    // 4. Quarter-finals
    const qfWinners = results.quarterFinals || [];
    if (phase1.bracket && Array.isArray(phase1.bracket.qf)) {
      phase1.bracket.qf.forEach(team => {
        if (qfWinners.includes(team)) score += 5;
      });
    }

    // 5. Semi-finals
    const sfWinners = results.semiFinals || [];
    if (phase1.bracket && Array.isArray(phase1.bracket.sf)) {
      phase1.bracket.sf.forEach(team => {
        if (sfWinners.includes(team)) score += 8;
      });
    }

    // 6. Finalists
    const finalists = results.finalists || [];
    if (phase1.bracket && Array.isArray(phase1.bracket.final)) {
      phase1.bracket.final.forEach(team => {
        if (finalists.includes(team)) score += 10;
      });
    }

    // 7. Winner
    const winner = results.winner || [];
    if (phase1.bracket && Array.isArray(phase1.bracket.winner) && phase1.bracket.winner.length > 0) {
      if (winner.includes(phase1.bracket.winner[0])) score += 20;
    }

    // 8. Golden Boot (Phase 1)
    if (phase1.goldenBoot && topScorer) {
      if (phase1.goldenBoot.toLowerCase().trim() === topScorer.toLowerCase().trim()) {
        score += 10;
      }
    }

    // PHASE 2 SCORING (second chance after groups)
    // Similar logic for phase2.bracket and phase2.goldenBoot if you want to score them

    scores[uid] = score;
  });

  // Write computed scores
  await db.collection("wc2026").doc("scores").set(scores);
  functions.logger.info(`Scores recalculated for ${Object.keys(scores).length} players`);
}
