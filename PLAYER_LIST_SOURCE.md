# Player List Sources

## Current Implementation
- **Type:** Static hardcoded list in `index.html` datalist
- **Count:** ~30 popular players
- **Source:** Manually curated star players

## Improvement Plan

### Option 1: API-Football Integration (Dynamic)
**Endpoint:** `/players/topscorers`
- ✅ Available in Cloud Functions
- ❌ Only works DURING tournament (not before)
- ❌ Requires 100+ API calls to get all squads
- ❌ API rate limit: 100 requests/day (free tier)

**Endpoint:** `/players/squads` (if available)
- Would need to fetch 48 team squads
- 48 API calls minimum
- Need to verify endpoint availability

### Option 2: Comprehensive Static List (Recommended)
**Sources for official squad lists:**
1. **FIFA Official** - https://www.fifa.com/fifaplus/en/tournaments/mens/worldcup/canadamexicousa2026
2. **Transfermarkt** - Squad values and likely starters
3. **National team rosters** - Most recent callups

**Coverage:**
- ~50-80 most likely Golden Boot candidates
- Top strikers/forwards from all 48 teams
- Based on current form, age, and historical WC performance

### Option 3: Hybrid Approach (Best UX)
1. **Static list** of 100+ likely candidates (updated manually as squads announced)
2. **Dynamic update** from API-Football scorers during tournament
3. **Free-text fallback** - users can type any name

## Implementation Strategy

### Phase 1 - Immediate (Static List)
Create comprehensive list of ~100 players:
- 2-3 forwards per team from the 48 qualified nations
- Focus on:
  - Current international form
  - Age (peak years 23-32)
  - Club performance
  - Previous World Cup experience

### Phase 2 - Tournament Start (Dynamic Sync)
Cloud Function enhancement:
```javascript
// Update player list from API-Football top scorers
async function updatePlayerList() {
  const scorers = await fetchScorers();
  const playerNames = scorers.map(p => p.name);
  await db.collection("wc2026").doc("players").set({ 
    autocomplete: playerNames 
  });
}
```

Then fetch in frontend:
```javascript
db.collection("wc2026").doc("players").onSnapshot(s => {
  const players = s.data()?.autocomplete || DEFAULT_PLAYERS;
  updatePlayerDatalist(players);
});
```

## Current Teams (48 nations for 2026)

### Confirmed Groups
- **Group A:** USA, England, Panama, Bolivia
- **Group B:** Mexico, Ecuador, Jamaica, Venezuela
- **Group C:** Argentina, Canada, Chile, Peru
- **Group D:** France, Australia, Guatemala, Saudi Arabia
- **Group E:** Spain, Colombia, Costa Rica, Morocco
- **Group F:** Germany, Japan, Honduras, South Africa
- **Group G:** Brazil, Uruguay, Paraguay, New Zealand
- **Group H:** Portugal, Croatia, Algeria, South Korea
- **Group I:** Netherlands, Serbia, Nigeria, Cuba
- **Group J:** Belgium, Turkey, Senegal, Egypt
- **Group K:** Poland, Switzerland, Qatar, Cameroon
- **Group L:** Italy, Denmark, Iran, Tunisia

### Top Golden Boot Candidates (by team)
Based on current form and age projection to June 2026:

**South America:**
- Argentina: Lautaro Martínez, Julián Álvarez
- Brazil: Vinicius Junior, Rodrygo, Richarlison
- Uruguay: Darwin Núñez, Luis Suárez
- Colombia: Luis Díaz, Rafael Santos Borré
- Ecuador: Enner Valencia
- Chile: Alexis Sánchez, Ben Brereton
- Paraguay: Miguel Almirón
- Peru: Gianluca Lapadula

**Europe:**
- England: Harry Kane, Bukayo Saka, Phil Foden, Cole Palmer
- France: Kylian Mbappé, Marcus Thuram, Randal Kolo Muani
- Germany: Kai Havertz, Florian Wirtz, Niclas Füllkrug
- Spain: Álvaro Morata, Ferran Torres, Lamine Yamal
- Portugal: Cristiano Ronaldo, Rafael Leão, Gonçalo Ramos
- Netherlands: Memphis Depay, Cody Gakpo
- Belgium: Romelu Lukaku
- Italy: Giacomo Raspadori, Moise Kean
- Poland: Robert Lewandowski
- Switzerland: Breel Embolo
- Croatia: Andrej Kramarić
- Denmark: Rasmus Højlund
- Serbia: Dušan Vlahović, Aleksandar Mitrović
- Turkey: Arda Güler

**CONCACAF:**
- USA: Christian Pulisic, Folarin Balogun, Ricardo Pepi
- Mexico: Santiago Giménez, Hirving Lozano
- Canada: Alphonso Davies, Jonathan David
- Jamaica: Michail Antonio
- Costa Rica: Joel Campbell
- Panama: José Fajardo

**Africa:**
- Morocco: Youssef En-Nesyri
- Senegal: Sadio Mané
- Nigeria: Victor Osimhen
- Egypt: Mohamed Salah
- Cameroon: Vincent Aboubakar
- Algeria: Islam Slimani
- Tunisia: Wahbi Khazri
- South Africa: Percy Tau

**Asia:**
- South Korea: Son Heung-min
- Japan: Takefusa Kubo, Kaoru Mitoma
- Australia: Mathew Leckie
- Iran: Sardar Azmoun
- Saudi Arabia: Salem Al-Dawsari
- Qatar: Akram Afif

## Next Steps

1. **Immediate:** Expand static list to ~100 players
2. **Pre-tournament:** Update list when final 48 squads announced (May 2026)
3. **During tournament:** Sync with API-Football top scorers
4. **Post-group stage:** Highlight remaining players only

## Notes
- Free-text input already works (datalist is suggestion only)
- Golden Boot scoring: 10 pts (Phase 1), 5 pts (Phase 2 update)
- Case-insensitive matching in score calculation
