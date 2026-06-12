const axios = require('axios');
const fs = require('fs');
const path = require('path');

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
        date: new Date(m.utcDate).toLocaleDateString('en-GB', { weekday:'short', day:'numeric', month:'short' }),
        time: new Date(m.utcDate).toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit', timeZone:'UTC' }) + ' UTC',
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

// ── MAIN ───────────────────────────────────────────────────────────────────
async function main() {
  console.log(`Fetching World Cup 2026 data from football-data.org…`);

  const [groups, fixtures, scorers] = await Promise.all([
    fetchGroups(),
    fetchFixtures(),
    fetchScorers(),
  ]);

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
}

main().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
