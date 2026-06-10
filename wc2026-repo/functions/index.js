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
const API_KEY     = functions.config().apifootball.key;
const API_BASE    = "https://v3.football.api-sports.io";
const WC_2026_ID  = 1; // FIFA World Cup 2026 — confirm league ID on API-Football
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
      const results  = deriveResults(fixtures);

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
      await recalculateScores(results);

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
function deriveResults(fixtures) {
  const results = {
    groupWinners:  [],
    quarterFinals: [],
    semiFinals:    [],
    finalists:     [],
    winner:        [],
    goldenBoot:    "",
  };

  // Group winners = teams that finish top 2 in their group
  // We derive from R32/R16 fixtures — teams who won their group round matches
  const roundWinners = {
    "Group Stage":        new Set(),
    "Round of 16":        new Set(),
    "Quarter-finals":     new Set(),
    "Semi-finals":        new Set(),
    "Final":              new Set(),
  };

  fixtures.forEach(f => {
    if (f.status === "fin" && f.winner && roundWinners[f.round] !== undefined) {
      roundWinners[f.round].add(f.winner);
    }
  });

  // Map round winners to prediction categories
  results.groupWinners  = [...roundWinners["Group Stage"]].slice(0, 12);
  results.quarterFinals = [...roundWinners["Round of 16"]].slice(0, 8);
  results.semiFinals    = [...roundWinners["Quarter-finals"]].slice(0, 4);
  results.finalists     = [...roundWinners["Semi-finals"]].slice(0, 2);
  results.winner        = [...roundWinners["Final"]].slice(0, 1);

  return results;
}

// ── RECALCULATE ALL PLAYER SCORES ─────────────────────────────────────────
async function recalculateScores(results) {
  const playersSnap = await db.collection("wc2026").doc("players").get();
  if (!playersSnap.exists) return;

  const players = playersSnap.data();
  const scores  = {};

  Object.entries(players).forEach(([uid, p]) => {
    const picks = p.picks || {};
    let score   = 0;

    PICK_CATS.forEach(cat => {
      (picks[cat.key] || []).forEach(team => {
        if ((results[cat.key] || []).includes(team)) score += cat.pts;
      });
    });

    // Golden boot
    const gbPick   = (picks.goldenBoot || "").toLowerCase().trim();
    const gbResult = (results.goldenBoot || "").toLowerCase().trim();
    if (gbPick && gbResult && gbPick === gbResult) score += 10;

    scores[uid] = score;
  });

  // Write computed scores to a separate doc for fast leaderboard reads
  await db.collection("wc2026").doc("scores").set(scores);
  functions.logger.info(`Scores recalculated for ${Object.keys(scores).length} players`);
}
