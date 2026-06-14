const axios = require('axios');
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

// ── CONFIG ────────────────────────────────────────────────────────────────
const API_KEY = process.env.FOOTBALLDATA_KEY;
const API_BASE = "https://api.football-data.org/v4";
const WC_CODE = "WC";
const WC_SEASON = 2026;

if (!API_KEY) {
  console.error('❌ FOOTBALLDATA_KEY environment variable is not set.');
  console.error('   Run: FOOTBALLDATA_KEY=your_key node scripts/fetch-data.js');
  process.exit(1);
}

// Initialize Firebase Admin (uses service account from env)
if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    console.log('✅ Firebase Admin initialized');
  } catch (err) {
    console.warn('⚠️  Firebase Admin init failed (will skip Firestore writes):', err.message);
  }
}

const db = admin.apps.length > 0 ? admin.firestore() : null;
const headers = { 'X-Auth-Token': API_KEY };

// ── HELPER: flag emoji from team name ────────────────────────────────────
function flagFor(name) {
  const map = {
    'Mexico': '🇲🇽', 'South Africa': '🇿🇦', 'Korea Republic': '🇰🇷', 'South Korea': '🇰🇷',
    'Canada': '🇨🇦', 'Qatar': '🇶🇦', 'Switzerland': '🇨🇭', 'United States': '🇺🇸', 'USA': '🇺🇸',
    'Colombia': '🇨🇴', 'Argentina': '🇦🇷', 'Morocco': '🇲🇦', 'Nigeria': '🇳🇬', 'Tunisia': '🇹🇳',
    'Brazil': '🇧🇷', 'Japan': '🇯🇵', 'Australia': '🇦🇺', 'Saudi Arabia': '🇸🇦', 'France': '🇫🇷',
    'Egypt': '🇪🇬', 'Iran': '🇮🇷', 'Peru': '🇵🇪', 'Spain': '🇪🇸', 'Senegal': '🇸🇳',
    'Ecuador': '🇪🇨', 'England': '🏴󠁧󠁢󠁥󠁮󠁧󠁿', 'Portugal': '🇵🇹', 'Cameroon': '🇨🇲', 'Chile': '🇨🇱',
    'Germany': '🇩🇪', 'Belgium': '🇧🇪', 'Costa Rica': '🇨🇷', 'Italy': '🇮🇹', 'Uruguay': '🇺🇾',
    'Panama': '🇵🇦', 'Bolivia': '🇧🇴', 'Netherlands': '🇳🇱', 'Croatia': '🇭🇷', 'Serbia': '🇷🇸',
    'Paraguay': '🇵🇾', 'Poland': '🇵🇱', 'Denmark': '🇩🇰', 'Venezuela': '🇻🇪', 'Turkey': '🇹🇷',
    'Türkiye': '🇹🇷', 'Algeria': '🇩🇿', 'New Zealand': '🇳🇿', 'Honduras': '🇭🇳',
    'Guatemala': '🇬🇹', 'Jamaica': '🇯🇲', 'Cuba': '🇨🇺', 'New Caledonia': '🇳🇨',
  };
  return map[name] || '🏳️';
}

// ── FETCH: Group standings (derived from match results) ───────────────────
// football-data.org returns a flat 48-team standings table with no group info,
// so we compute per-group standings from group stage fixtures instead.
async function fetchGroups() {
  try {
    const res = await axios.get(`${API_BASE}/competitions/${WC_CODE}/matches`, {
      headers, params: { season: WC_SEASON, stage: 'GROUP_STAGE' }
    });
    const matches = res.data.matches || [];

    // Build a map: groupKey → { teamName → stats }
    const groups = {};
    for (const m of matches) {
      const g = m.group; // e.g. "GROUP_A"
      if (!g) continue;
      if (!groups[g]) groups[g] = {};

      const home = m.homeTeam.name;
      const away = m.awayTeam.name;
      if (!groups[g][home]) groups[g][home] = { team: home, flag: flagFor(home), played:0, won:0, drawn:0, lost:0, gf:0, ga:0, gd:0, points:0 };
      if (!groups[g][away]) groups[g][away] = { team: away, flag: flagFor(away), played:0, won:0, drawn:0, lost:0, gf:0, ga:0, gd:0, points:0 };

      const fin = ['FINISHED', 'AWARDED'].includes(m.status);
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
        group: g.replace('GROUP_', ''),
        standings: Object.values(teamsMap).sort((a, b) =>
          b.points - a.points || b.gd - a.gd || b.gf - a.gf
        ),
      }));
  } catch (err) {
    console.error('Error fetching groups:', err.response?.data?.message || err.message);
    return [];
  }
}

// ── FETCH: Fixtures ────────────────────────────────────────────────────────
async function fetchFixtures() {
  try {
    const res = await axios.get(`${API_BASE}/competitions/${WC_CODE}/matches`, {
      headers, params: { season: WC_SEASON }
    });
    const matches = res.data.matches || [];
    return matches.map(m => {
      const fin  = ['FINISHED', 'AWARDED'].includes(m.status);
      const live = ['IN_PLAY', 'PAUSED', 'HALF_TIME'].includes(m.status);
      const score = m.score || {};
      const ft = score.fullTime || {};
      return {
        id: m.id,
        round: m.stage === 'GROUP_STAGE' ? `Group Stage - Matchday ${m.matchday}` : humanRound(m.stage),
        stage: m.stage,
        group: m.group || null,
        matchday: m.matchday,
        date: new Date(m.utcDate).toLocaleDateString('en-GB', { weekday:'short', day:'numeric', month:'short', timeZone:'America/New_York' }),
        time: new Date(m.utcDate).toLocaleTimeString('en-US', { hour:'numeric', minute:'2-digit', timeZone:'America/New_York', hour12:true }) + ' ET',
        utcDate: m.utcDate,
        home: m.homeTeam.name,
        homeFlag: flagFor(m.homeTeam.name),
        away: m.awayTeam.name,
        awayFlag: flagFor(m.awayTeam.name),
        homeScore: (fin || live) ? ft.home : null,
        awayScore: (fin || live) ? ft.away : null,
        status: live ? 'live' : fin ? 'fin' : 'upcoming',
        winner: fin ? winnerName(m) : null,
      };
    });
  } catch (err) {
    console.error('Error fetching fixtures:', err.response?.data?.message || err.message);
    return [];
  }
}

function humanRound(stage) {
  const map = {
    'LAST_16': 'Round of 16', 'LAST_32': 'Round of 32',
    'QUARTER_FINALS': 'Quarter-finals', 'SEMI_FINALS': 'Semi-finals',
    'THIRD_PLACE': '3rd Place Playoff', 'FINAL': 'Final',
    'GROUP_STAGE': 'Group Stage',
  };
  return map[stage] || stage;
}

function winnerName(m) {
  if (!m.score?.winner) return null;
  if (m.score.winner === 'HOME_TEAM') return m.homeTeam.name;
  if (m.score.winner === 'AWAY_TEAM') return m.awayTeam.name;
  return null; // DRAW
}

// ── FETCH: Top scorers ─────────────────────────────────────────────────────
async function fetchScorers() {
  try {
    const res = await axios.get(`${API_BASE}/competitions/${WC_CODE}/scorers`, {
      headers, params: { season: WC_SEASON, limit: 20 }
    });
    return (res.data.scorers || []).map(s => ({
      name: s.player.name,
      team: s.team.name,
      flag: flagFor(s.team.name),
      goals: s.goals || 0,
      assists: s.assists || 0,
    }));
  } catch (err) {
    console.error('Error fetching scorers:', err.response?.data?.message || err.message);
    return [];
  }
}

// ── DERIVE BRACKET FROM KNOCKOUT FIXTURES (for Firestore scoring) ─────────
function deriveBracket(fixtures) {
  const bracket = { r32:[], r16:[], qf:[], sf:[], final:[], winner:[] };
  const stageMap = {
    'LAST_32': 'r32', 'LAST_16': 'r16',
    'QUARTER_FINALS': 'qf', 'SEMI_FINALS': 'sf', 'FINAL': 'final',
  };

  for (const f of fixtures) {
    const key = stageMap[f.stage];
    if (!key) continue;
    if (f.home && f.away) bracket[key].push(f.home, f.away);
    if (key === 'final' && f.winner) bracket.winner = [f.winner];
  }

  return bracket;
}

// ── DERIVE RESULTS FOR SCORING ENGINE ─────────────────────────────────────
function deriveResults(fixtures, groups) {
  const results = {
    groups: {},
    thirdPlaceQualifiers: [],
    bracket: { r32:[], r16:[], qf:[], sf:[], final:[], winner:[] },
    goldenBoot: '',
    phase2Unlocked: false,
  };

  // Group order from standings
  for (const g of groups) {
    results.groups[g.group] = g.standings.map(t => t.team);
  }
  results.startedGroups = groups
    .filter(g => g.standings.some(t => t.played > 0))
    .map(g => g.group);

  // Knockout results
  const stageMap = {
    'LAST_32': 'r32', 'LAST_16': 'r16',
    'QUARTER_FINALS': 'qf', 'SEMI_FINALS': 'sf', 'FINAL': 'final',
  };

  for (const f of fixtures) {
    const key = stageMap[f.stage];
    if (!key || f.status !== 'fin') continue;
    if (f.home && f.away) results.bracket[key].push(f.home, f.away);
    if (key === 'final' && f.winner) results.bracket.winner = [f.winner];
  }

  // Unlock Phase 2 once all group games finish
  const groupFixtures = fixtures.filter(f => f.stage === 'GROUP_STAGE');
  const allGroupDone = groupFixtures.length > 0 && groupFixtures.every(f => f.status === 'fin');
  results.phase2Unlocked = allGroupDone;

  return results;
}

// ── RECALCULATE ALL PLAYER SCORES ──────────────────────────────────────────
async function recalculateScores(results, scorers) {
  if (!db) {
    console.log('⏭️   Skipping score recalculation (no Firestore connection)');
    return;
  }

  const playersSnap = await db.collection('wc2026picks').get();
  if (playersSnap.empty) {
    console.log('   No players to score yet');
    return;
  }

  const topScorer = scorers.length > 0 ? scorers[0].name : '';
  const scores = {};

  playersSnap.forEach(doc => {
    const uid = doc.id;
    const data = doc.data();
    const phase1 = data.phase1 || {};
    const phase2 = data.phase2 || {};
    let score = 0;

    // Phase 1 — group picks (only for started groups)
    const actualGroups = results.groups || {};
    const startedGroups = new Set(results.startedGroups || []);
    if (phase1.groups) {
      for (const [grp, order] of Object.entries(phase1.groups)) {
        if (!startedGroups.has(grp)) continue;
        const actual = actualGroups[grp] || [];
        if (actual[0] && order[0] === actual[0]) score += 1;
        if (actual[1] && order[1] === actual[1]) score += 1;
        if (actual[2] && order[2] === actual[2]) score += 1;
      }
    }

    // Phase 1 — third place qualifiers
    const actualTPQ = results.thirdPlaceQualifiers || [];
    (phase1.thirdPlaceQualifiers || []).forEach(t => {
      if (actualTPQ.includes(t)) score += 2;
    });

    // Phase 1 — bracket
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

    // Phase 2 — bracket
    const P2_ROUNDS = ['r16', 'qf', 'sf', 'final'];
    for (const round of P2_ROUNDS) {
      const actual = actualBracket[round] || [];
      (phase2.bracket?.[round] || []).forEach(t => {
        if (t && actual.includes(t)) score += 5;
      });
    }

    // Phase 2 — golden boot
    if (phase2.goldenBoot && topScorer &&
        phase2.goldenBoot.toLowerCase().trim() === topScorer.toLowerCase().trim()) {
      score += 5;
    }

    scores[uid] = score;
  });

  await db.collection('wc2026').doc('scores').set(scores);
  console.log(`   Scores recalculated for ${Object.keys(scores).length} players`);
}

// ── WRITE TO FIRESTORE ─────────────────────────────────────────────────────
async function writeToFirestore(groups, fixtures, scorers, bracket, results) {
  if (!db) {
    console.log('⏭️   Skipping Firestore writes (no connection)');
    return;
  }

  console.log('📤  Writing to Firestore…');

  // Write display data
  await db.collection('wc2026').doc('tournament').set({
    groups: groups.map(g => ({ name: g.group, standings: g.standings })),
    fixtures: fixtures.slice(0, 120), // cap to avoid 1MB limit
    bracket,
    scorers,
    lastSync: Date.now(),
  });

  // Write results for scoring
  await db.collection('wc2026').doc('results').set(results, { merge: true });

  // Recalculate scores
  await recalculateScores(results, scorers);

  console.log('✅  Firestore updated');
}

// ── SMART FETCH GUARD ─────────────────────────────────────────────────────
// Returns true if we should actually call the API right now.
// Called before any network requests so we don't burn quota on idle runs.
function shouldFetchNow() {
  // 1. Always refresh during the midnight ET window (12:00–12:14 AM ET)
  //    so "today's fixtures" on the home page and Results tab are current.
  const etStr = new Date().toLocaleTimeString('en-US', {
    timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', hour12: false,
  });
  const [etH, etM] = etStr.split(':').map(Number);
  if (etH === 0 && etM < 15) {
    console.log('⏰  Midnight ET window — refreshing today\'s fixtures.');
    return true;
  }

  // 2. Read existing data to check game schedule.
  const dataPath = path.join(__dirname, '..', 'data', 'wc2026.json');
  if (!fs.existsSync(dataPath)) {
    console.log('📂  No existing data — fetching for the first time.');
    return true;
  }

  let existing;
  try {
    existing = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  } catch {
    return true; // corrupt file, re-fetch
  }

  const nowUTC = Date.now();
  const BEFORE_MS  = 15 * 60 * 1000;    // start polling 15 min before kickoff
  const AFTER_MS   = 2  * 60 * 60 * 1000; // cover 90 min + stoppage time (~2h max)

  // Games whose window overlaps right now
  const activeWindow = (existing.fixtures || []).filter(f => {
    if (!f.utcDate) return false;
    const kick = new Date(f.utcDate).getTime();
    const diff = kick - nowUTC;               // positive = future, negative = past
    return diff >= -AFTER_MS && diff <= BEFORE_MS;
  });

  if (activeWindow.length === 0) {
    console.log('💤  No active game window — skipping API call.');
    return false;
  }

  // If every game in the window has already finished, stop polling
  if (activeWindow.every(f => f.status === 'fin')) {
    const teams = activeWindow.map(f => `${f.home} vs ${f.away}`).join(', ');
    console.log(`✅  All active-window games finished (${teams}) — skipping until next game.`);
    return false;
  }

  const pending = activeWindow.filter(f => f.status !== 'fin');
  console.log(`⚽  ${pending.length} game(s) active or starting soon — fetching.`);
  return true;
}

// ── MAIN ───────────────────────────────────────────────────────────────────
async function main() {
  if (!shouldFetchNow()) process.exit(0);

  console.log(`Fetching World Cup 2026 data from football-data.org…`);

  const [groups, fixtures, scorers] = await Promise.all([
    fetchGroups(),
    fetchFixtures(),
    fetchScorers(),
  ]);

  const bracket = deriveBracket(fixtures);
  const results = deriveResults(fixtures, groups);

  // Write to static JSON for client fallback
  const data = {
    lastUpdated: new Date().toISOString(),
    groups,
    fixtures,
    topScorers: scorers,
  };

  const dataDir = path.join(__dirname, '..', 'data');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

  const outputPath = path.join(dataDir, 'wc2026.json');
  fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));

  console.log(`✅ Data written to ${outputPath}`);
  console.log(`   Groups: ${groups.length}`);
  console.log(`   Fixtures: ${fixtures.length}`);
  console.log(`   Top Scorers: ${scorers.length}`);
  if (fixtures.length) {
    const played = fixtures.filter(f => f.status === 'fin').length;
    const live   = fixtures.filter(f => f.status === 'live').length;
    console.log(`   Played: ${played}  |  Live: ${live}  |  Upcoming: ${fixtures.length - played - live}`);
  }

  // Write to Firestore for real-time updates
  await writeToFirestore(groups, fixtures, scorers, bracket, results);
}

main().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
