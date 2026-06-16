const axios = require('axios');
const fs = require('fs');
const path = require('path');

// ── CONFIG ────────────────────────────────────────────────────────────────
// Primary: worldcup26.ir (real-time live status, free, JWT auth)
// Fallback: football-data.org (used if primary fails)
const WC26_TOKEN    = process.env.WC26_API_TOKEN;
const WC26_BASE     = 'https://worldcup26.ir';
const FD_KEY        = process.env.FOOTBALLDATA_KEY;
const FD_BASE       = 'https://api.football-data.org/v4';
const WC_CODE       = 'WC';
const WC_SEASON     = 2026;

if (!WC26_TOKEN && !FD_KEY) {
  console.error('❌ No API credentials. Set WC26_API_TOKEN or FOOTBALLDATA_KEY.');
  process.exit(1);
}

// Initialize Firebase Admin only if credentials are provided
let db = null;
if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  try {
    const admin = require('firebase-admin');
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    db = admin.firestore();
    console.log('✅ Firebase Admin initialized');
  } catch (err) {
    console.warn('⚠️  Firebase Admin init failed (will skip Firestore writes):', err.message);
  }
}

// ── FLAGS ─────────────────────────────────────────────────────────────────
function flagFor(name) {
  const map = {
    // Group stage teams (worldcup26.ir names)
    'Mexico': '🇲🇽', 'South Africa': '🇿🇦', 'South Korea': '🇰🇷', 'Korea Republic': '🇰🇷',
    'Canada': '🇨🇦', 'Bosnia and Herzegovina': '🇧🇦', 'United States': '🇺🇸', 'USA': '🇺🇸',
    'Paraguay': '🇵🇾', 'Qatar': '🇶🇦', 'Switzerland': '🇨🇭', 'Haiti': '🇭🇹',
    'Scotland': '🏴󠁧󠁢󠁳󠁣󠁴󠁿', 'Brazil': '🇧🇷', 'Morocco': '🇲🇦', 'Japan': '🇯🇵',
    'Germany': '🇩🇪', 'Curaçao': '🇨🇼', 'Netherlands': '🇳🇱', 'Sweden': '🇸🇪',
    'Australia': '🇦🇺', 'Turkey': '🇹🇷', 'Türkiye': '🇹🇷', 'Ivory Coast': '🇨🇮',
    'Ecuador': '🇪🇨', 'Tunisia': '🇹🇳', 'Czech Republic': '🇨🇿', 'Argentina': '🇦🇷',
    'Uruguay': '🇺🇾', 'Costa Rica': '🇨🇷', 'Saudi Arabia': '🇸🇦', 'France': '🇫🇷',
    'Spain': '🇪🇸', 'Belgium': '🇧🇪', 'England': '🏴󠁧󠁢󠁥󠁮󠁧󠁿', 'Portugal': '🇵🇹',
    'Colombia': '🇨🇴', 'Senegal': '🇸🇳', 'Nigeria': '🇳🇬', 'Egypt': '🇪🇬',
    'Serbia': '🇷🇸', 'Croatia': '🇭🇷', 'Poland': '🇵🇱', 'Denmark': '🇩🇰',
    'Venezuela': '🇻🇪', 'Peru': '🇵🇪', 'Algeria': '🇩🇿', 'New Zealand': '🇳🇿',
    'Honduras': '🇭🇳', 'Guatemala': '🇬🇹', 'Jamaica': '🇯🇲', 'Cuba': '🇨🇺',
    'New Caledonia': '🇳🇨', 'Panama': '🇵🇦', 'Bolivia': '🇧🇴', 'Chile': '🇨🇱',
    'Cameroon': '🇨🇲', 'Italy': '🇮🇹', 'Iran': '🇮🇷',
    'Norway': '🇳🇴', 'Austria': '🇦🇹', 'Ghana': '🇬🇭', 'Iraq': '🇮🇶',
    'Jordan': '🇯🇴', 'Uzbekistan': '🇺🇿', 'Cape Verde': '🇨🇻', 'Cape Verde Islands': '🇨🇻',
    'Democratic Republic of the Congo': '🇨🇩', 'DR Congo': '🇨🇩', 'Congo DR': '🇨🇩',
    'Czechia': '🇨🇿',
    'Bosnia-Herzegovina': '🇧🇦', 'Bosnia': '🇧🇦',
  };
  return map[name] || '🏳️';
}

// ── UTC HELPERS ───────────────────────────────────────────────────────────
// Once correct utcDates are stored in data/wc2026.json (from football-data.org),
// we lock them in permanently by indexing both by ID and by home|away team pair.
// Every subsequent run finds the stored value by team pair and skips localDateToUTC.
function loadExistingUtcDates() {
  const dataPath = path.join(__dirname, '..', 'data', 'wc2026.json');
  if (!fs.existsSync(dataPath)) return {};
  try {
    const existing = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    const map = {};
    for (const f of (existing.fixtures || [])) {
      if (!f.utcDate) continue;
      if (f.id != null) map[String(f.id)] = f.utcDate;
      // Also index by team pair so utcDates survive API switches and ID changes
      if (f.home && f.away) map[`${f.home}|${f.away}`] = f.utcDate;
    }
    return map;
  } catch { return {}; }
}

// Fallback UTC conversion — assumes Eastern Daylight Time (UTC-4).
// WC 2026 venue timezones range from UTC-4 (ET) to UTC-7 (PT);
// using ET means we may poll up to 3h early for Pacific games (harmless)
// but we rely on the alreadyLive check to catch games whose window we miss.
function localDateToUTC(localDate) {
  if (!localDate) return null;
  try {
    const [datePart, timePart] = localDate.split(' ');
    const [m, d, y] = datePart.split('/');
    return new Date(`${y}-${m}-${d}T${timePart}:00-04:00`).toISOString();
  } catch { return null; }
}

// ── KNOCKOUT STAGE MAPPING ────────────────────────────────────────────────
// worldcup26.ir type field directly encodes the knockout round.
function stageFromType(type) {
  const map = {
    'r32':   { stage: 'LAST_32',       round: 'Round of 32' },
    'r16':   { stage: 'LAST_16',       round: 'Round of 16' },
    'qf':    { stage: 'QUARTER_FINALS', round: 'Quarter-finals' },
    'sf':    { stage: 'SEMI_FINALS',   round: 'Semi-finals' },
    'third': { stage: 'THIRD_PLACE',   round: '3rd Place Playoff' },
    'final': { stage: 'FINAL',         round: 'Final' },
  };
  return map[type] || { stage: 'KNOCKOUT', round: 'Knockout' };
}

// ── SCORER PARSING ────────────────────────────────────────────────────────
// worldcup26.ir encodes scorers as the string: {"Name Minute'","Name Minute'"}
// Formats seen: "Name 31'" | "Name 45'+5'" (injury time) | "Name 7'(OG)" (own goal) | "Name 17' (p)" (penalty)

// The API doesn't always flag own goals with "(OG)" in the raw scorer string.
// Add entries here when one is spotted so it displays correctly and is excluded
// from the top-scorers leaderboard. Match on gameId + exact base name (pre-suffix).
const OG_OVERRIDES = [
  { gameId: 15, name: 'Mohamed Hany' }, // Belgium 1-1 Egypt — credited to Belgium, scored by Egypt's Hany
];

function parseGoalScorers(raw, teamName, gameId) {
  if (!raw || raw === 'null') return [];
  try {
    // Some entries use curly/smart quotes (“ ” ‘ ’) instead of straight quotes — normalise before parsing.
    const json = raw.trim()
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'")
      .replace(/^\{/, '[')
      .replace(/\}$/, ']');
    const entries = JSON.parse(json);
    return entries.map(text => {
      const parts = text.trim().split(/\s+/);
      // Time token is the last token starting with a digit, or the second-to-last
      // if the last is a trailing modifier like (p)/(OG) with no leading digit.
      let timeIdx = parts.length - 1;
      if (!/^\d/.test(parts[timeIdx]) && timeIdx > 0 && /^\d/.test(parts[timeIdx - 1])) {
        timeIdx = timeIdx - 1;
      }
      const timeToken = parts[timeIdx];
      if (/^\d/.test(timeToken)) {
        // Tag (P)/(OG) is attached to this specific goal's timestamp, not the player's
        // name — keeps multiple goals by the same player (e.g. one penalty, one open-play)
        // grouped together under a single name when rendered.
        const name = parts.slice(0, timeIdx).join(' ');
        const isOG = text.toUpperCase().includes('(OG)')
          || OG_OVERRIDES.some(o => o.gameId === gameId && o.name === name);
        const isPen = text.toLowerCase().includes('(p)') || text.toLowerCase().includes('(pen)');
        const minute = timeToken.replace(/'/g, '').replace(/\(.*\)/g, '').trim() || null;
        const tag = isOG ? '(OG)' : isPen ? '(P)' : '';
        return { name, minute, tag, team: teamName, og: isOG };
      }
      return { name: text.trim(), minute: null, tag: '', team: teamName, og: false };
    });
  } catch { return []; }
}

function buildTopScorers(games) {
  const map = {};
  for (const g of games) {
    if (g.finished !== 'TRUE') continue;
    const home = g.home_team_name_en;
    const away = g.away_team_name_en;
    const gameId = parseInt(g.id);
    for (const s of [
      ...parseGoalScorers(g.home_scorers, home, gameId),
      ...parseGoalScorers(g.away_scorers, away, gameId),
    ]) {
      if (s.og) continue; // own goals don't count toward the scorer's tally
      const key = `${s.name}|${s.team}`;
      if (!map[key]) map[key] = { name: s.name, team: s.team, flag: flagFor(s.team), goals: 0, assists: 0 };
      map[key].goals++;
    }
  }
  return Object.values(map).sort((a, b) => b.goals - a.goals).slice(0, 20);
}

// ── GROUP STANDINGS ───────────────────────────────────────────────────────
// Compute group standings from game results — same logic as football-data.org path.
function computeGroups(games) {
  const groups = {};
  for (const game of games) {
    if (game.type !== 'group') continue;
    const g = game.group;
    if (!g) continue;
    if (!groups[g]) groups[g] = {};
    const home = game.home_team_name_en;
    const away = game.away_team_name_en;
    if (!groups[g][home]) groups[g][home] = { team: home, flag: flagFor(home), played:0, won:0, drawn:0, lost:0, gf:0, ga:0, gd:0, points:0 };
    if (!groups[g][away]) groups[g][away] = { team: away, flag: flagFor(away), played:0, won:0, drawn:0, lost:0, gf:0, ga:0, gd:0, points:0 };
    if (game.finished !== 'TRUE') continue;
    const hg = parseInt(game.home_score) || 0;
    const ag = parseInt(game.away_score) || 0;
    groups[g][home].played++; groups[g][away].played++;
    groups[g][home].gf += hg; groups[g][home].ga += ag;
    groups[g][away].gf += ag; groups[g][away].ga += hg;
    groups[g][home].gd += hg - ag; groups[g][away].gd += ag - hg;
    if (hg > ag)      { groups[g][home].won++; groups[g][home].points += 3; groups[g][away].lost++; }
    else if (hg < ag) { groups[g][away].won++; groups[g][away].points += 3; groups[g][home].lost++; }
    else              { groups[g][home].drawn++; groups[g][home].points++; groups[g][away].drawn++; groups[g][away].points++; }
  }
  return Object.entries(groups)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([g, teamsMap]) => ({
      group: g,
      standings: Object.values(teamsMap).sort((a, b) =>
        b.points - a.points || b.gd - a.gd || b.gf - a.gf
      ),
    }));
}

// ── FETCH FD UTCDATES ─────────────────────────────────────────────────────
// football-data.org scheduled times are always accurate (no live delay on dates).
// We fetch these to use as ground truth for utcDate, so worldcup26.ir's ambiguous
// local_date timezone never affects what we display.
async function loadFDUtcDates() {
  if (!FD_KEY) return {};
  try {
    const res = await axios.get(`${FD_BASE}/competitions/${WC_CODE}/matches`, {
      headers: { 'X-Auth-Token': FD_KEY }, params: { season: WC_SEASON }, timeout: 15000,
    });
    const norm = s => (s || '').toLowerCase().replace(/[^a-z]/g, '');
    // Some team names differ between APIs — normalise both to match
    const aliases = {
      'korearepublic': 'southkorea', 'republicofkorea': 'southkorea',
      'unitedstates': 'usa',
      'turkiye': 'turkey',
      'ivorycoast': 'cotedivoire',
      'democraticrepublicofthecongo': 'drcongo', 'congodr': 'drcongo',
    };
    const canonical = s => { const n = norm(s); return aliases[n] || n; };
    const map = {};
    for (const m of (res.data.matches || [])) {
      if (!m.utcDate) continue;
      const key = `${canonical(m.homeTeam.name)}|${canonical(m.awayTeam.name)}`;
      map[key] = m.utcDate;
    }
    console.log(`📅  football-data.org utcDates: ${Object.keys(map).length} fixtures`);
    return map;
  } catch (err) {
    console.warn('⚠️  Could not fetch football-data.org utcDates:', err.message);
    return {};
  }
}

// ══ PRIMARY: WORLDCUP26.IR ════════════════════════════════════════════════
async function fetchFromWC26(fdUtcDates = {}) {
  console.log('🌐  Fetching from worldcup26.ir…');
  const headers = { Authorization: `Bearer ${WC26_TOKEN}` };
  const res = await axios.get(`${WC26_BASE}/get/games`, { headers, timeout: 60000 });
  const games = Array.isArray(res.data) ? res.data : res.data.games || res.data.data || [];
  if (!games.length) throw new Error('worldcup26.ir returned 0 games');

  const existingUtcDates = loadExistingUtcDates();
  const norm = s => (s || '').toLowerCase().replace(/[^a-z]/g, '');
  const aliases = {
    'korearepublic': 'southkorea', 'republicofkorea': 'southkorea',
    'unitedstates': 'usa', 'turkiye': 'turkey',
    'ivorycoast': 'cotedivoire',
    'democraticrepublicofthecongo': 'drcongo', 'congodr': 'drcongo',
  };
  const canonical = s => { const n = norm(s); return aliases[n] || n; };

  const fixtures = games.map(game => {
    const isLive = game.time_elapsed === 'live';
    const isFin  = game.finished === 'TRUE';
    const status = isLive ? 'live' : isFin ? 'fin' : 'upcoming';
    const homeScore = parseInt(game.home_score) || 0;
    const awayScore = parseInt(game.away_score) || 0;

    // Priority: football-data.org (accurate schedule) → stored team pair → stored ID → localDateToUTC
    // Once a correct utcDate is stored in the JSON, the team-pair lookup locks it in permanently.
    const homeName  = game.home_team_name_en || game.home_team_label || null;
    const awayName  = game.away_team_name_en || game.away_team_label || null;
    const fdKey     = `${canonical(homeName)}|${canonical(awayName)}`;
    const pairKey   = `${homeName}|${awayName}`;
    const utcDate   = fdUtcDates[fdKey]
      || existingUtcDates[pairKey]
      || existingUtcDates[String(game.id)]
      || localDateToUTC(game.local_date);

    const isGroup = game.type === 'group';
    let stage, round;
    if (isGroup) {
      stage = 'GROUP_STAGE';
      round = `Group Stage - Matchday ${game.matchday}`;
    } else {
      ({ stage, round } = stageFromType(game.type));
    }

    return {
      id: parseInt(game.id),
      round,
      stage,
      group: isGroup ? `GROUP_${game.group}` : null,
      matchday: parseInt(game.matchday) || null,
      date: utcDate
        ? new Date(utcDate).toLocaleDateString('en-GB', { weekday:'short', day:'numeric', month:'short', timeZone:'America/New_York' })
        : game.local_date,
      time: utcDate
        ? new Date(utcDate).toLocaleTimeString('en-US', { hour:'numeric', minute:'2-digit', timeZone:'America/New_York', hour12:true }) + ' ET'
        : '',
      utcDate,
      home: homeName,
      homeFlag: flagFor(homeName),
      away: awayName,
      awayFlag: flagFor(awayName),
      homeScore: (isFin || isLive) ? homeScore : null,
      awayScore: (isFin || isLive) ? awayScore : null,
      homeGoals: (isFin || isLive) ? parseGoalScorers(game.home_scorers, homeName, parseInt(game.id)) : [],
      awayGoals: (isFin || isLive) ? parseGoalScorers(game.away_scorers, awayName, parseInt(game.id)) : [],
      status,
      winner: isFin ? (homeScore > awayScore ? game.home_team_name_en : awayScore > homeScore ? game.away_team_name_en : null) : null,
    };
  });

  fixtures.sort((a, b) => (a.utcDate || '').localeCompare(b.utcDate || ''));

  const groups  = computeGroups(games);
  const scorers = buildTopScorers(games);

  const live = fixtures.filter(f => f.status === 'live');
  console.log(`✅  worldcup26.ir: ${fixtures.length} fixtures, ${groups.length} groups, ${scorers.length} scorers${live.length ? `, ${live.length} LIVE` : ''}`);
  return { fixtures, groups, scorers };
}

// ══ FALLBACK: FOOTBALL-DATA.ORG ═══════════════════════════════════════════
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
  return null;
}

async function fetchFromFootballData() {
  console.log('⚠️   Using football-data.org fallback…');
  const headers = { 'X-Auth-Token': FD_KEY };

  const [groupsRes, fixturesRes, scorersRes] = await Promise.all([
    axios.get(`${FD_BASE}/competitions/${WC_CODE}/matches`, { headers, params: { season: WC_SEASON, stage: 'GROUP_STAGE' } }),
    axios.get(`${FD_BASE}/competitions/${WC_CODE}/matches`, { headers, params: { season: WC_SEASON } }),
    axios.get(`${FD_BASE}/competitions/${WC_CODE}/scorers`, { headers, params: { season: WC_SEASON, limit: 20 } }),
  ]);

  // Groups
  const groupMatches = groupsRes.data.matches || [];
  const groupsMap = {};
  for (const m of groupMatches) {
    const g = m.group;
    if (!g) continue;
    if (!groupsMap[g]) groupsMap[g] = {};
    const home = m.homeTeam.name, away = m.awayTeam.name;
    if (!groupsMap[g][home]) groupsMap[g][home] = { team: home, flag: flagFor(home), played:0, won:0, drawn:0, lost:0, gf:0, ga:0, gd:0, points:0 };
    if (!groupsMap[g][away]) groupsMap[g][away] = { team: away, flag: flagFor(away), played:0, won:0, drawn:0, lost:0, gf:0, ga:0, gd:0, points:0 };
    if (!['FINISHED','AWARDED'].includes(m.status)) continue;
    const hg = m.score.fullTime.home ?? 0, ag = m.score.fullTime.away ?? 0;
    groupsMap[g][home].played++; groupsMap[g][away].played++;
    groupsMap[g][home].gf += hg; groupsMap[g][home].ga += ag;
    groupsMap[g][away].gf += ag; groupsMap[g][away].ga += hg;
    groupsMap[g][home].gd += hg-ag; groupsMap[g][away].gd += ag-hg;
    if (hg > ag)      { groupsMap[g][home].won++; groupsMap[g][home].points+=3; groupsMap[g][away].lost++; }
    else if (hg < ag) { groupsMap[g][away].won++; groupsMap[g][away].points+=3; groupsMap[g][home].lost++; }
    else              { groupsMap[g][home].drawn++; groupsMap[g][home].points++; groupsMap[g][away].drawn++; groupsMap[g][away].points++; }
  }
  const groups = Object.entries(groupsMap)
    .sort(([a],[b]) => a.localeCompare(b))
    .map(([g, teamsMap]) => ({
      group: g.replace('GROUP_',''),
      standings: Object.values(teamsMap).sort((a,b) => b.points-a.points || b.gd-a.gd || b.gf-a.gf),
    }));

  // Fixtures
  const fixtures = (fixturesRes.data.matches || []).map(m => {
    const fin  = ['FINISHED','AWARDED'].includes(m.status);
    const live = ['IN_PLAY','PAUSED','HALF_TIME'].includes(m.status);
    const ft   = m.score?.fullTime || {};
    return {
      id: m.id,
      round: m.stage === 'GROUP_STAGE' ? `Group Stage - Matchday ${m.matchday}` : humanRound(m.stage),
      stage: m.stage,
      group: m.group || null,
      matchday: m.matchday,
      date: new Date(m.utcDate).toLocaleDateString('en-GB', { weekday:'short', day:'numeric', month:'short', timeZone:'America/New_York' }),
      time: new Date(m.utcDate).toLocaleTimeString('en-US', { hour:'numeric', minute:'2-digit', timeZone:'America/New_York', hour12:true }) + ' ET',
      utcDate: m.utcDate,
      home: m.homeTeam.name, homeFlag: flagFor(m.homeTeam.name),
      away: m.awayTeam.name, awayFlag: flagFor(m.awayTeam.name),
      homeScore: live ? (ft.home ?? 0) : fin ? ft.home : null,
      awayScore: live ? (ft.away ?? 0) : fin ? ft.away : null,
      status: live ? 'live' : fin ? 'fin' : 'upcoming',
      winner: fin ? winnerName(m) : null,
    };
  });

  // Scorers
  const scorers = (scorersRes.data.scorers || []).map(s => ({
    name: s.player.name, team: s.team.name, flag: flagFor(s.team.name),
    goals: s.goals || 0, assists: s.assists || 0,
  }));

  console.log(`✅  football-data.org fallback: ${fixtures.length} fixtures, ${groups.length} groups`);
  return { fixtures, groups, scorers };
}

// ══ FIRESTORE ══════════════════════════════════════════════════════════════
function deriveBracket(fixtures) {
  const bracket = { r32:[], r16:[], qf:[], sf:[], final:[], winner:[] };
  const stageMap = { 'LAST_32':'r32', 'LAST_16':'r16', 'QUARTER_FINALS':'qf', 'SEMI_FINALS':'sf', 'FINAL':'final' };
  for (const f of fixtures) {
    const key = stageMap[f.stage];
    if (!key) continue;
    if (f.home && f.away) bracket[key].push(f.home, f.away);
    if (key === 'final' && f.winner) bracket.winner = [f.winner];
  }
  return bracket;
}

function deriveResults(fixtures, groups) {
  const results = {
    groups: {}, thirdPlaceQualifiers: [],
    bracket: { r32:[], r16:[], qf:[], sf:[], final:[], winner:[] },
    goldenBoot: '', phase2Unlocked: false,
  };
  for (const g of groups) {
    results.groups[g.group] = g.standings.map(t => t.team);
  }
  results.startedGroups = groups.filter(g => g.standings.some(t => t.played > 0)).map(g => g.group);
  const stageMap = { 'LAST_32':'r32', 'LAST_16':'r16', 'QUARTER_FINALS':'qf', 'SEMI_FINALS':'sf', 'FINAL':'final' };
  for (const f of fixtures) {
    const key = stageMap[f.stage];
    if (!key || f.status !== 'fin') continue;
    if (f.home && f.away) results.bracket[key].push(f.home, f.away);
    if (key === 'final' && f.winner) results.bracket.winner = [f.winner];
  }
  const groupFixtures = fixtures.filter(f => f.stage === 'GROUP_STAGE');
  results.phase2Unlocked = groupFixtures.length > 0 && groupFixtures.every(f => f.status === 'fin');
  return results;
}

async function recalculateScores(results, scorers) {
  if (!db) { console.log('⏭️   Skipping score recalculation (no Firestore)'); return; }
  const playersSnap = await db.collection('wc2026picks').get();
  if (playersSnap.empty) { console.log('   No players yet'); return; }
  const topScorer = scorers[0]?.name || '';
  const scores = {};
  playersSnap.forEach(doc => {
    const { phase1={}, phase2={} } = doc.data();
    let score = 0;
    const actualGroups = results.groups || {};
    const startedGroups = new Set(results.startedGroups || []);
    if (phase1.groups) {
      for (const [grp, order] of Object.entries(phase1.groups)) {
        if (!startedGroups.has(grp)) continue;
        const actual = actualGroups[grp] || [];
        if (actual[0] && order[0] === actual[0]) score++;
        if (actual[1] && order[1] === actual[1]) score++;
        if (actual[2] && order[2] === actual[2]) score++;
      }
    }
    const actualTPQ = results.thirdPlaceQualifiers || [];
    (phase1.thirdPlaceQualifiers || []).forEach(t => { if (actualTPQ.includes(t)) score += 2; });
    const P1_PTS = { r32:2, r16:3, qf:5, sf:10, final:20 };
    const actualBracket = results.bracket || {};
    for (const [round, pts] of Object.entries(P1_PTS)) {
      (phase1.bracket?.[round] || []).forEach(t => { if (t && (actualBracket[round]||[]).includes(t)) score += pts; });
    }
    if (phase1.goldenBoot && topScorer && phase1.goldenBoot.toLowerCase().trim() === topScorer.toLowerCase().trim()) score += 10;
    for (const round of ['r16','qf','sf','final']) {
      (phase2.bracket?.[round] || []).forEach(t => { if (t && (actualBracket[round]||[]).includes(t)) score += 5; });
    }
    if (phase2.goldenBoot && topScorer && phase2.goldenBoot.toLowerCase().trim() === topScorer.toLowerCase().trim()) score += 5;
    scores[doc.id] = score;
  });
  await db.collection('wc2026').doc('scores').set(scores);
  console.log(`   Scores recalculated for ${Object.keys(scores).length} players`);
}

async function writeToFirestore(groups, fixtures, scorers, bracket, results) {
  if (!db) { console.log('⏭️   Skipping Firestore writes (no connection)'); return; }
  console.log('📤  Writing to Firestore…');
  await db.collection('wc2026').doc('tournament').set({
    groups: groups.map(g => ({ name: g.group, standings: g.standings })),
    fixtures: fixtures.slice(0, 120),
    bracket,
    scorers,
    lastSync: Date.now(),
  });
  await db.collection('wc2026').doc('results').set(results, { merge: true });
  await recalculateScores(results, scorers);
  console.log('✅  Firestore updated');
}

// ── SMART FETCH GUARD ─────────────────────────────────────────────────────
function shouldFetchNow() {
  // Always refresh in the midnight ET window so daily fixture lists stay current.
  const etStr = new Date().toLocaleTimeString('en-US', {
    timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', hour12: false,
  });
  const [etH, etM] = etStr.split(':').map(Number);
  if (etH === 0 && etM < 15) {
    console.log('⏰  Midnight ET window — refreshing.');
    return true;
  }

  const dataPath = path.join(__dirname, '..', 'data', 'wc2026.json');
  if (!fs.existsSync(dataPath)) { console.log('📂  No existing data — first fetch.'); return true; }

  let existing;
  try { existing = JSON.parse(fs.readFileSync(dataPath, 'utf8')); }
  catch { return true; }

  // If any game is currently live, always fetch — match could still be running.
  const live = (existing.fixtures || []).filter(f => f.status === 'live');
  if (live.length) {
    console.log(`🔴  ${live.map(f => `${f.home} vs ${f.away}`).join(', ')} live in existing data — fetching.`);
    return true;
  }

  // Check upcoming game windows using stored utcDate (accurate from football-data.org origin).
  const nowUTC   = Date.now();
  const BEFORE   = 15 * 60 * 1000;       // 15 min before kickoff
  const AFTER    = 2.5 * 60 * 60 * 1000; // 2.5h after kickoff (covers ET + stoppage)

  const active = (existing.fixtures || []).filter(f => {
    if (!f.utcDate) return false;
    const diff = new Date(f.utcDate).getTime() - nowUTC;
    return diff >= -AFTER && diff <= BEFORE;
  });

  if (!active.length) { console.log('💤  No active game window — skipping.'); return false; }
  if (active.every(f => f.status === 'fin')) {
    console.log(`✅  All active-window games finished (${active.map(f=>`${f.home} vs ${f.away}`).join(', ')}) — skipping.`);
    return false;
  }

  console.log(`⚽  ${active.filter(f=>f.status!=='fin').length} game(s) active or starting soon — fetching.`);
  return true;
}

// ── MAIN ───────────────────────────────────────────────────────────────────
async function main() {
  if (!shouldFetchNow()) process.exit(0);

  let result;
  // Try primary API first; fall back gracefully if it fails.
  if (WC26_TOKEN) {
    // Load football-data.org utcDates in parallel — these are always accurate for scheduling.
    const fdUtcDates = await loadFDUtcDates();
    try {
      result = await fetchFromWC26(fdUtcDates);
    } catch (err) {
      console.warn(`⚠️   worldcup26.ir failed (${err.message}) — trying fallback…`);
      if (!FD_KEY) { console.error('❌ No fallback key available.'); process.exit(1); }
      result = await fetchFromFootballData();
    }
  } else {
    result = await fetchFromFootballData();
  }

  const { fixtures, groups, scorers } = result;
  const bracket = deriveBracket(fixtures);
  const results = deriveResults(fixtures, groups);

  const data = { lastUpdated: new Date().toISOString(), groups, fixtures, topScorers: scorers };

  const dataDir = path.join(__dirname, '..', 'data');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(path.join(dataDir, 'wc2026.json'), JSON.stringify(data, null, 2));

  const played = fixtures.filter(f => f.status === 'fin').length;
  const liveNow = fixtures.filter(f => f.status === 'live').length;
  console.log(`✅  data/wc2026.json written — ${played} played | ${liveNow} live | ${fixtures.length-played-liveNow} upcoming`);

  await writeToFirestore(groups, fixtures, scorers, bracket, results);
}

main().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
