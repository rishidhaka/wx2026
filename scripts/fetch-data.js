const axios = require('axios');
const fs = require('fs');
const path = require('path');

// ── CONFIG ────────────────────────────────────────────────────────────────
const API_KEY = process.env.APIFOOTBALL_KEY;
const API_BASE = "https://v3.football.api-sports.io";
const WC_2026_ID = 1; // FIFA World Cup
const WC_SEASON = 2026;

const axiosConfig = {
  headers: {
    'x-rapidapi-key': API_KEY,
    'x-rapidapi-host': 'v3.football.api-sports.io'
  }
};

// ── HELPER: Get flag emoji from country name ────────────────────────────
function getFlagEmoji(countryName) {
  const flagMap = {
    'Mexico': '🇲🇽', 'South Africa': '🇿🇦', 'Korea Republic': '🇰🇷', 'Czechia': '🇨🇿',
    'Canada': '🇨🇦', 'Bosnia and Herzegovina': '🇧🇦', 'Qatar': '🇶🇦', 'Switzerland': '🇨🇭',
    'USA': '🇺🇸', 'Colombia': '🇨🇴', 'Northern Ireland': '🏴', 'China PR': '🇨🇳',
    'Argentina': '🇦🇷', 'Morocco': '🇲🇦', 'Nigeria': '🇳🇬', 'Tunisia': '🇹🇳',
    'Brazil': '🇧🇷', 'Japan': '🇯🇵', 'Australia': '🇦🇺', 'Saudi Arabia': '🇸🇦',
    'France': '🇫🇷', 'Egypt': '🇪🇬', 'IR Iran': '🇮🇷', 'Peru': '🇵🇪',
    'Spain': '🇪🇸', 'Ukraine': '🇺🇦', 'Senegal': '🇸🇳', 'Ecuador': '🇪🇨',
    'England': '🏴󠁧󠁢󠁥󠁮󠁧󠁿', 'Portugal': '🇵🇹', 'Cameroon': '🇨🇲', 'Chile': '🇨🇱',
    'Germany': '🇩🇪', 'Belgium': '🇧🇪', 'Costa Rica': '🇨🇷', 'Zambia': '🇿🇲',
    'Italy': '🇮🇹', 'Uruguay': '🇺🇾', 'Panama': '🇵🇦', 'Bolivia': '🇧🇴',
    'Netherlands': '🇳🇱', 'Croatia': '🇭🇷', 'Serbia': '🇷🇸', 'Paraguay': '🇵🇾',
    'Poland': '🇵🇱', 'Denmark': '🇩🇰', 'Ghana': '🇬🇭', 'Venezuela': '🇻🇪',
    'Türkiye': '🇹🇷', 'Sweden': '🇸🇪', 'Algeria': '🇩🇿', 'New Zealand': '🇳🇿'
  };
  return flagMap[countryName] || '🏴';
}

// ── FETCH: Group standings ────────────────────────────────────────────────
async function fetchGroups() {
  try {
    const res = await axios.get(`${API_BASE}/standings`, {
      ...axiosConfig,
      params: { league: WC_2026_ID, season: WC_SEASON }
    });
    
    if (!res.data?.response?.[0]?.league?.standings) {
      console.log('No group standings available yet');
      return [];
    }
    
    return res.data.response[0].league.standings.map(group => ({
      group: group[0].group.replace('Group ', ''),
      standings: group.map(t => ({
        team: t.team.name,
        flag: getFlagEmoji(t.team.name),
        played: t.all.played,
        won: t.all.win,
        drawn: t.all.draw,
        lost: t.all.lose,
        gf: t.all.goals.for,
        ga: t.all.goals.against,
        gd: t.goalsDiff,
        pts: t.points
      }))
    }));
  } catch (err) {
    console.error('Error fetching groups:', err.message);
    return [];
  }
}

// ── FETCH: Fixtures ────────────────────────────────────────────────────────
async function fetchFixtures() {
  try {
    const res = await axios.get(`${API_BASE}/fixtures`, {
      ...axiosConfig,
      params: { league: WC_2026_ID, season: WC_SEASON }
    });
    
    if (!res.data?.response) {
      console.log('No fixtures available yet');
      return [];
    }
    
    return res.data.response.map(f => ({
      id: f.fixture.id,
      round: f.league.round,
      date: f.fixture.date,
      status: f.fixture.status.short,
      homeTeam: f.teams.home.name,
      homeFlag: getFlagEmoji(f.teams.home.name),
      awayTeam: f.teams.away.name,
      awayFlag: getFlagEmoji(f.teams.away.name),
      homeScore: f.goals.home,
      awayScore: f.goals.away
    }));
  } catch (err) {
    console.error('Error fetching fixtures:', err.message);
    return [];
  }
}

// ── FETCH: Top scorers ─────────────────────────────────────────────────────
async function fetchScorers() {
  try {
    const res = await axios.get(`${API_BASE}/players/topscorers`, {
      ...axiosConfig,
      params: { league: WC_2026_ID, season: WC_SEASON }
    });
    
    if (!res.data?.response) {
      console.log('No top scorers available yet');
      return [];
    }
    
    return res.data.response.slice(0, 20).map(p => ({
      name: p.player.name,
      team: p.statistics[0].team.name,
      goals: p.statistics[0].goals.total || 0,
      assists: p.statistics[0].goals.assists || 0
    }));
  } catch (err) {
    console.error('Error fetching scorers:', err.message);
    return [];
  }
}

// ── MAIN ───────────────────────────────────────────────────────────────────
async function main() {
  console.log('Fetching World Cup 2026 data...');
  
  const [groups, fixtures, scorers] = await Promise.all([
    fetchGroups(),
    fetchFixtures(),
    fetchScorers()
  ]);
  
  const data = {
    lastUpdated: new Date().toISOString(),
    groups,
    fixtures,
    topScorers: scorers
  };
  
  // Ensure data directory exists
  const dataDir = path.join(__dirname, '..', 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  
  // Write to file
  const outputPath = path.join(dataDir, 'wc2026.json');
  fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));
  
  console.log(`✅ Data written to ${outputPath}`);
  console.log(`   Groups: ${groups.length}`);
  console.log(`   Fixtures: ${fixtures.length}`);
  console.log(`   Top Scorers: ${scorers.length}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
