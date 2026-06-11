/**
 * FIFA 2026 Prediction League - Core Logic Tests
 * Tests for scoring, deadlines, bracket seeding, and third-place qualifiers
 */

const { describe, test, expect, beforeEach } = require('@jest/globals');

// ══════════════════════════════════════════════════════════════════════════
// CORE CONSTANTS AND FUNCTIONS (extracted from index.html)
// ══════════════════════════════════════════════════════════════════════════

const WC_GROUPS = {
  A: [{name:"USA",flag:"🇺🇸"},{name:"England",flag:"🏴󠁧󠁢󠁥󠁮󠁧󠁿"},{name:"Panama",flag:"🇵🇦"},{name:"Bolivia",flag:"🇧🇴"}],
  B: [{name:"Mexico",flag:"🇲🇽"},{name:"Ecuador",flag:"🇪🇨"},{name:"Jamaica",flag:"🇯🇲"},{name:"Venezuela",flag:"🇻🇪"}],
  C: [{name:"Argentina",flag:"🇦🇷"},{name:"Canada",flag:"🇨🇦"},{name:"Chile",flag:"🇨🇱"},{name:"Peru",flag:"🇵🇪"}],
  D: [{name:"France",flag:"🇫🇷"},{name:"Australia",flag:"🇦🇺"},{name:"Guatemala",flag:"🇬🇹"},{name:"Saudi Arabia",flag:"🇸🇦"}],
  E: [{name:"Spain",flag:"🇪🇸"},{name:"Colombia",flag:"🇨🇴"},{name:"Costa Rica",flag:"🇨🇷"},{name:"Morocco",flag:"🇲🇦"}],
  F: [{name:"Germany",flag:"🇩🇪"},{name:"Japan",flag:"🇯🇵"},{name:"Honduras",flag:"🇭🇳"},{name:"South Africa",flag:"🇿🇦"}],
  G: [{name:"Brazil",flag:"🇧🇷"},{name:"Uruguay",flag:"🇺🇾"},{name:"Paraguay",flag:"🇵🇾"},{name:"New Zealand",flag:"🇳🇿"}],
  H: [{name:"Portugal",flag:"🇵🇹"},{name:"Croatia",flag:"🇭🇷"},{name:"Algeria",flag:"🇩🇿"},{name:"South Korea",flag:"🇰🇷"}],
  I: [{name:"Netherlands",flag:"🇳🇱"},{name:"Serbia",flag:"🇷🇸"},{name:"Nigeria",flag:"🇳🇬"},{name:"Cuba",flag:"🇨🇺"}],
  J: [{name:"Belgium",flag:"🇧🇪"},{name:"Turkey",flag:"🇹🇷"},{name:"Senegal",flag:"🇸🇳"},{name:"Egypt",flag:"🇪🇬"}],
  K: [{name:"Poland",flag:"🇵🇱"},{name:"Switzerland",flag:"🇨🇭"},{name:"Qatar",flag:"🇶🇦"},{name:"Cameroon",flag:"🇨🇲"}],
  L: [{name:"Italy",flag:"🇮🇹"},{name:"Denmark",flag:"🇩🇰"},{name:"Iran",flag:"🇮🇷"},{name:"Tunisia",flag:"🇹🇳"}]
};

const R32_SEEDING = [
  ["2A","2B"],
  ["1E","3ABCDF"],
  ["1F","2C"],
  ["1C","2F"],
  ["1I","3CDFGH"],
  ["2E","2I"],
  ["1A","3CEFHI"],
  ["1L","3EHIJK"],
  ["1D","3BEFIJ"],
  ["1G","3AEHIJ"],
  ["2K","2L"],
  ["1H","2J"],
  ["1B","3EFGIJ"],
  ["1J","2H"],
  ["1K","3DEIJL"],
  ["2D","2G"]
];

const P1_KO_PTS = { r32:2, r16:3, qf:5, sf:10, final:20 };
const P2_PTS = { champion: 15, sf: 10, r16: 5, qf: 5 };

const PHASE1_DEADLINE = new Date("2026-06-17T23:59:59-06:00");
const GROUP_STAGE_END = new Date("2026-06-27T23:59:59-06:00");

function isPhase1Open() {
  return new Date() < PHASE1_DEADLINE;
}

function isGroupStageComplete() {
  return new Date() >= GROUP_STAGE_END;
}

function defaultGroups() {
  const g = {};
  Object.entries(WC_GROUPS).forEach(([k, teams]) => { g[k] = teams.map(t => t.name); });
  return g;
}

function flagFor(name) {
  for (const teams of Object.values(WC_GROUPS)) {
    const t = teams.find(t => t.name === name);
    if (t) return t.flag;
  }
  return "🏳️";
}

function seedBracketFromGroups(groups, thirdPlaceQualifiers = []) {
  const seed = {};
  const thirdByGroup = {};

  Object.entries(groups).forEach(([grp, order]) => {
    seed["1"+grp] = order[0] || "";
    seed["2"+grp] = order[1] || "";
    thirdByGroup[grp] = order[2] || "";
  });

  const qualifiers = thirdPlaceQualifiers.filter(t => t && t.trim());
  const qualifiedGroups = Object.entries(thirdByGroup)
    .filter(([, team]) => qualifiers.includes(team))
    .map(([grp]) => grp);
  const thirdSlotGroups = resolveThirdPlaceSlotGroups(qualifiedGroups);

  const resolveToken = token => {
    if (!token.startsWith("3") || token.length <= 2) return seed[token] || token;
    const grp = thirdSlotGroups[token];
    if (grp && thirdByGroup[grp]) return thirdByGroup[grp];
    return token;
  };

  return R32_SEEDING.map(([h, a]) => {
    const homeTeam = resolveToken(h);
    const awayTeam = resolveToken(a);
    return {
      home: homeTeam,
      away: awayTeam,
      homeFlag: flagFor(homeTeam),
      awayFlag: flagFor(awayTeam)
    };
  });
}

function resolveThirdPlaceSlotGroups(qualifiedGroups) {
  const slots = [...new Set(R32_SEEDING.flat().filter(t => t.startsWith("3") && t.length > 2))];
  const qualifiedSet = new Set(qualifiedGroups || []);
  const options = {};

  slots.forEach(slot => {
    options[slot] = slot.slice(1).split("").filter(g => qualifiedSet.has(g));
  });

  const orderedSlots = [...slots].sort((a, b) => options[a].length - options[b].length || a.localeCompare(b));
  const used = new Set();
  const assignment = {};

  [["B", "3BEFIJ"], ["L", "3DEIJL"], ["K", "3EHIJK"]].forEach(([group, slot]) => {
    if (qualifiedSet.has(group) && options[slot]?.includes(group) && !assignment[slot] && !used.has(group)) {
      assignment[slot] = group;
      used.add(group);
    }
  });

  const remainingSlots = orderedSlots.filter(slot => !assignment[slot]);

  function backtrack(i) {
    if (i === remainingSlots.length) return true;
    const slot = remainingSlots[i];
    for (const grp of options[slot]) {
      if (used.has(grp)) continue;
      used.add(grp);
      assignment[slot] = grp;
      if (backtrack(i + 1)) return true;
      used.delete(grp);
      delete assignment[slot];
    }
    return false;
  }

  backtrack(0);
  return assignment;
}

function calcScore(playerData, results) {
  // Handle null/undefined inputs
  if (!playerData || typeof playerData !== 'object') {
    playerData = {};
  }
  
  const p1 = playerData.phase1 || {};
  const p2 = playerData.phase2 || {};
  const res = results || {};
  let p1Group = 0, p1Third = 0, p1KO = 0, p2Score = 0, gbScore = 0;

  // Phase 1 - Group predictions (1 pt each)
  Object.entries(p1.groups || {}).forEach(([grp, order]) => {
    const actual = (res.groups || {})[grp] || [];
    if (actual[0] && order[0] === actual[0]) p1Group += 1;
    if (actual[1] && order[1] === actual[1]) p1Group += 1;
  });

  // Phase 1 - Third-place qualifiers (2 pts each, max 16 pts)
  const p1ThirdQual = p1.thirdPlaceQualifiers || [];
  const resThirdQual = res.thirdPlaceQualifiers || [];
  p1ThirdQual.forEach(team => {
    if (team && resThirdQual.includes(team)) p1Third += 2;
  });

  // Phase 1 - Knockout bracket predictions
  Object.entries(P1_KO_PTS).forEach(([round, pts]) => {
    const picks = (p1.bracket || {})[round] || [];
    const actual = (res.bracket || {})[round] || [];
    picks.forEach((team, i) => {
      if (actual[i] && team === actual[i]) p1KO += pts;
    });
  });

  // Phase 2 - Only if unlocked (after group stage)
  if (res.phase2Unlocked) {
    const p2Bracket = p2.bracket || {};
    const resBracket = res.bracket || {};
    
    // R16 picks (5 pts each)
    const p2R16 = p2Bracket.r16 || [];
    const resR16 = resBracket.r16 || [];
    p2R16.forEach((team, i) => {
      if (resR16[i] && team === resR16[i]) p2Score += P2_PTS.r16;
    });
    
    // QF picks (5 pts each)
    const p2QF = p2Bracket.qf || [];
    const resQF = resBracket.qf || [];
    p2QF.forEach((team, i) => {
      if (resQF[i] && team === resQF[i]) p2Score += P2_PTS.qf;
    });
    
    // SF picks (10 pts each)
    const p2SF = p2Bracket.sf || [];
    const resSF = resBracket.sf || [];
    p2SF.forEach((team, i) => {
      if (resSF[i] && team === resSF[i]) p2Score += P2_PTS.sf;
    });
    
    // Final + Champion (15 pts for champion)
    const p2Final = p2Bracket.final || [];
    const resFinal = resBracket.final || [];
    p2Final.forEach((team, i) => {
      if (resFinal[i] && team === resFinal[i]) {
        p2Score += P2_PTS.champion;
      }
    });
  }

  // Golden Boot
  const gb1 = (p1.goldenBoot || "").toLowerCase().trim();
  const gbR = (res.goldenBoot || "").toLowerCase().trim();
  if (gb1 && gbR && gb1 === gbR) gbScore = 10;

  return {
    total: p1Group + p1Third + p1KO + p2Score + gbScore,
    p1Group,
    p1Third,
    p1KO,
    p2: p2Score,
    goldenBoot: gbScore
  };
}

// ══════════════════════════════════════════════════════════════════════════
// TEST SUITES
// ══════════════════════════════════════════════════════════════════════════

describe('FIFA 2026 Tournament Data', () => {
  test('should have 12 groups with 4 teams each', () => {
    expect(Object.keys(WC_GROUPS)).toHaveLength(12);
    Object.values(WC_GROUPS).forEach(teams => {
      expect(teams).toHaveLength(4);
    });
  });

  test('should have 48 total teams', () => {
    const totalTeams = Object.values(WC_GROUPS).reduce((sum, teams) => sum + teams.length, 0);
    expect(totalTeams).toBe(48);
  });

  test('should have 16 R32 matchups', () => {
    expect(R32_SEEDING).toHaveLength(16);
  });

  test('each team should have name and flag', () => {
    Object.values(WC_GROUPS).flat().forEach(team => {
      expect(team).toHaveProperty('name');
      expect(team).toHaveProperty('flag');
      expect(team.name).toBeTruthy();
      expect(team.flag).toBeTruthy();
    });
  });
});

describe('Deadline Logic', () => {
  test('Phase 1 deadline should be June 17, 2026 23:59:59 UTC-6', () => {
    expect(PHASE1_DEADLINE.toISOString()).toBe('2026-06-18T05:59:59.000Z');
  });

  test('Group stage end should be June 27, 2026 23:59:59 UTC-6', () => {
    expect(GROUP_STAGE_END.toISOString()).toBe('2026-06-28T05:59:59.000Z');
  });

  test('isPhase1Open should return true before deadline', () => {
    // Current date in test is June 10, 2026 (before deadline)
    const mockNow = new Date('2026-06-10T12:00:00Z');
    jest.spyOn(global, 'Date').mockImplementation(() => mockNow);
    expect(isPhase1Open()).toBe(true);
    jest.restoreAllMocks();
  });

  test('isGroupStageComplete should return false before June 27', () => {
    const mockNow = new Date('2026-06-10T12:00:00Z');
    jest.spyOn(global, 'Date').mockImplementation(() => mockNow);
    expect(isGroupStageComplete()).toBe(false);
    jest.restoreAllMocks();
  });
});

describe('Group Seeding', () => {
  test('defaultGroups should create groups with all team names', () => {
    const groups = defaultGroups();
    expect(Object.keys(groups)).toHaveLength(12);
    expect(groups.A).toEqual(['USA', 'England', 'Panama', 'Bolivia']);
    expect(groups.L).toEqual(['Italy', 'Denmark', 'Iran', 'Tunisia']);
  });

  test('flagFor should return correct flag for team', () => {
    expect(flagFor('USA')).toBe('🇺🇸');
    expect(flagFor('Brazil')).toBe('🇧🇷');
    expect(flagFor('Italy')).toBe('🇮🇹');
    expect(flagFor('Unknown Team')).toBe('🏳️');
  });
});

describe('Bracket Seeding from Groups', () => {
  test('should seed R32 bracket from group predictions', () => {
    const mockGroups = {
      A: ['USA', 'England', 'Panama', 'Bolivia'],
      B: ['Mexico', 'Ecuador', 'Jamaica', 'Venezuela'],
      C: ['Argentina', 'Canada', 'Chile', 'Peru'],
      D: ['France', 'Australia', 'Guatemala', 'Saudi Arabia'],
      E: ['Spain', 'Colombia', 'Costa Rica', 'Morocco'],
      F: ['Germany', 'Japan', 'Honduras', 'South Africa'],
      G: ['Brazil', 'Uruguay', 'Paraguay', 'New Zealand'],
      H: ['Portugal', 'Croatia', 'Algeria', 'South Korea'],
      I: ['Netherlands', 'Serbia', 'Nigeria', 'Cuba'],
      J: ['Belgium', 'Turkey', 'Senegal', 'Egypt'],
      K: ['Poland', 'Switzerland', 'Qatar', 'Cameroon'],
      L: ['Italy', 'Denmark', 'Iran', 'Tunisia']
    };

    const bracket = seedBracketFromGroups(mockGroups);
    expect(bracket).toHaveLength(16);
    expect(bracket[0].home).toBe('England');
    expect(bracket[0].away).toBe('Ecuador');
    expect(bracket[0].homeFlag).toBe(flagFor('England'));
    expect(bracket[0].awayFlag).toBe('🇪🇨');
  });

  test('should assign official third-place slots with constraints', () => {
    const mockGroups = {
      A: ['USA', 'England', 'Panama', 'Bolivia'],
      B: ['Mexico', 'Ecuador', 'Jamaica', 'Venezuela'],
      C: ['Argentina', 'Canada', 'Chile', 'Peru'],
      D: ['France', 'Australia', 'Guatemala', 'Saudi Arabia'],
      E: ['Spain', 'Colombia', 'Costa Rica', 'Morocco'],
      F: ['Germany', 'Japan', 'Honduras', 'South Africa'],
      G: ['Brazil', 'Uruguay', 'Paraguay', 'New Zealand'],
      H: ['Portugal', 'Croatia', 'Algeria', 'South Korea'],
      I: ['Netherlands', 'Serbia', 'Nigeria', 'Cuba'],
      J: ['Belgium', 'Turkey', 'Senegal', 'Egypt'],
      K: ['Poland', 'Switzerland', 'Qatar', 'Cameroon'],
      L: ['Italy', 'Denmark', 'Iran', 'Tunisia']
    };
    const thirds = ['Jamaica', 'Chile', 'Guatemala', 'Costa Rica', 'Honduras', 'Paraguay', 'Qatar', 'Iran'];
    
    const bracket = seedBracketFromGroups(mockGroups, thirds);

    expect(bracket).toHaveLength(16);
    // B third place should map to Winner D slot (match index 8 away)
    expect(bracket[8].away).toBe('Jamaica');
    // L third place should map to Winner K slot (match index 14 away)
    expect(bracket[14].away).toBe('Iran');
    // K third place should map to Winner L slot (match index 7 away)
    expect(bracket[7].away).toBe('Qatar');
  });

  test('should handle empty third-place qualifiers gracefully', () => {
    const mockGroups = { A: ['USA', 'England'], B: ['Mexico', 'Ecuador'] };
    const bracket = seedBracketFromGroups(mockGroups, []);
    expect(bracket).toHaveLength(16);
  });
});

describe('Scoring Engine - Phase 1', () => {
  test('should award 1 point for correct group winner', () => {
    const playerData = {
      phase1: {
        groups: { A: ['USA', 'England', 'Panama', 'Bolivia'] },
        thirdPlaceQualifiers: [],
        bracket: {},
        goldenBoot: ''
      }
    };
    const results = {
      groups: { A: ['USA', 'England', 'Panama', 'Bolivia'] }
    };

    const score = calcScore(playerData, results);
    expect(score.p1Group).toBe(2); // Both 1st and 2nd correct
  });

  test('should award 2 points per correct third-place qualifier', () => {
    const playerData = {
      phase1: {
        groups: {},
        thirdPlaceQualifiers: ['Panama', 'Jamaica', 'Chile', 'Guatemala'],
        bracket: {},
        goldenBoot: ''
      }
    };
    const results = {
      thirdPlaceQualifiers: ['Panama', 'Jamaica', 'Chile', 'Morocco', 'Costa Rica', 'Honduras', 'Paraguay', 'Algeria']
    };

    const score = calcScore(playerData, results);
    expect(score.p1Third).toBe(6); // 3 correct × 2 pts = 6
  });

  test('should award knockout points correctly', () => {
    const playerData = {
      phase1: {
        groups: {},
        thirdPlaceQualifiers: [],
        bracket: {
          r32: ['USA', 'Mexico', 'Argentina', 'France'],
          r16: ['USA', 'Argentina'],
          qf: ['USA'],
          sf: ['USA'],
          final: ['USA']
        },
        goldenBoot: ''
      }
    };
    const results = {
      bracket: {
        r32: ['USA', 'Mexico', 'Argentina', 'Spain'],
        r16: ['USA', 'Brazil'],
        qf: ['USA'],
        sf: ['USA'],
        final: ['USA']
      }
    };

    const score = calcScore(playerData, results);
    // R32: 3 correct × 2 = 6
    // R16: 1 correct × 3 = 3
    // QF: 1 correct × 5 = 5
    // SF: 1 correct × 10 = 10
    // Final: 1 correct × 20 = 20
    expect(score.p1KO).toBe(44);
  });

  test('should award 10 points for correct Golden Boot in Phase 1', () => {
    const playerData = {
      phase1: {
        groups: {},
        thirdPlaceQualifiers: [],
        bracket: {},
        goldenBoot: 'Kylian Mbappé'
      }
    };
    const results = {
      goldenBoot: 'Kylian Mbappé'
    };

    const score = calcScore(playerData, results);
    expect(score.goldenBoot).toBe(10);
  });
});

describe('Scoring Engine - Phase 2', () => {
  test('should not score Phase 2 if not unlocked', () => {
    const playerData = {
      phase1: { groups: {}, thirdPlaceQualifiers: [], bracket: {}, goldenBoot: '' },
      phase2: {
        bracket: {
          r16: ['USA', 'Brazil'],
          qf: ['USA'],
          sf: ['USA'],
          final: ['USA']
        },
        goldenBoot: ''
      }
    };
    const results = {
      phase2Unlocked: false,
      bracket: {
        r16: ['USA', 'Brazil'],
        qf: ['USA'],
        sf: ['USA'],
        final: ['USA']
      }
    };

    const score = calcScore(playerData, results);
    expect(score.p2).toBe(0);
  });

  test('should award Phase 2 points when unlocked', () => {
    const playerData = {
      phase1: { groups: {}, thirdPlaceQualifiers: [], bracket: {}, goldenBoot: '' },
      phase2: {
        bracket: {
          r16: ['USA', 'Brazil', 'Argentina', 'France'],
          qf: ['USA', 'Argentina'],
          sf: ['USA', 'Argentina'],
          final: ['USA', 'Argentina']
        },
        goldenBoot: ''
      }
    };
    const results = {
      phase2Unlocked: true,
      bracket: {
        r16: ['USA', 'Brazil', 'Spain', 'France'],
        qf: ['USA', 'Spain'],
        sf: ['USA', 'Germany'],
        final: ['USA', 'Germany']
      }
    };

    const score = calcScore(playerData, results);
    // R16: 3 correct (USA, Brazil, France) × 5 = 15
    // QF: 1 correct (USA) × 5 = 5
    // SF: 1 correct (USA) × 10 = 10
    // Final: 1 correct (USA) × 15 = 15
    expect(score.p2).toBe(45);
  });

  test('should ensure Phase 2 champion is 15 points (less than Phase 1 maximum)', () => {
    expect(P2_PTS.champion).toBe(15);
    expect(P2_PTS.champion).toBeLessThan(P1_KO_PTS.final);
  });
});

describe('Complete Scoring Scenarios', () => {
  test('perfect score scenario', () => {
    const playerData = {
      phase1: {
        groups: {
          A: ['USA', 'England'], B: ['Mexico', 'Ecuador'], C: ['Argentina', 'Canada'],
          D: ['France', 'Australia'], E: ['Spain', 'Colombia'], F: ['Germany', 'Japan'],
          G: ['Brazil', 'Uruguay'], H: ['Portugal', 'Croatia'], I: ['Netherlands', 'Serbia'],
          J: ['Belgium', 'Turkey'], K: ['Poland', 'Switzerland'], L: ['Italy', 'Denmark']
        },
        thirdPlaceQualifiers: ['Panama', 'Jamaica', 'Chile', 'Guatemala', 'Costa Rica', 'Honduras', 'Paraguay', 'Algeria'],
        bracket: {
          r32: Array(16).fill('USA'),
          r16: Array(8).fill('USA'),
          qf: Array(4).fill('USA'),
          sf: Array(2).fill('USA'),
          final: ['USA']
        },
        goldenBoot: 'Kylian Mbappé'
      },
      phase2: {
        bracket: {
          r16: Array(8).fill('USA'),
          qf: Array(4).fill('USA'),
          sf: Array(2).fill('USA'),
          final: ['USA']
        },
        goldenBoot: 'Kylian Mbappé'
      }
    };
    const results = {
      groups: playerData.phase1.groups,
      thirdPlaceQualifiers: playerData.phase1.thirdPlaceQualifiers,
      bracket: playerData.phase1.bracket,
      phase2Unlocked: true,
      goldenBoot: 'Kylian Mbappé'
    };

    const score = calcScore(playerData, results);
    // P1 Groups: 12 groups × 2 = 24
    // P1 Thirds: 8 × 2 = 16
    // P1 KO: 16×2 + 8×3 + 4×5 + 2×10 + 1×20 = 32+24+20+20+20 = 116
    // P2: 8×5 + 4×5 + 2×10 + 1×15 = 40+20+20+15 = 95
    // GB: 10
    expect(score.total).toBe(24 + 16 + 116 + 95 + 10); // 261
  });

  test('zero score scenario', () => {
    const playerData = {
      phase1: {
        groups: {},
        thirdPlaceQualifiers: [],
        bracket: {},
        goldenBoot: ''
      },
      phase2: {
        bracket: {},
        goldenBoot: ''
      }
    };
    const results = {
      groups: {},
      thirdPlaceQualifiers: [],
      bracket: {},
      phase2Unlocked: true,
      goldenBoot: 'Lionel Messi'
    };

    const score = calcScore(playerData, results);
    expect(score.total).toBe(0);
  });
});

describe('Edge Cases', () => {
  test('should handle missing player data gracefully', () => {
    const score = calcScore({}, {});
    expect(score.total).toBe(0);
  });

  test('should handle null/undefined inputs', () => {
    const score1 = calcScore(null, null);
    const score2 = calcScore(undefined, undefined);
    expect(score1.total).toBe(0);
    expect(score2.total).toBe(0);
  });

  test('should handle partial player data', () => {
    const playerData = {
      phase1: {
        groups: { A: ['USA', 'England'] }
        // Missing thirdPlaceQualifiers, bracket, goldenBoot
      }
    };
    const results = {
      groups: { A: ['USA', 'England'] }
    };

    const score = calcScore(playerData, results);
    expect(score.p1Group).toBe(2);
    expect(score.total).toBeGreaterThanOrEqual(0);
  });

  test('should be case-insensitive for Golden Boot', () => {
    const playerData = {
      phase1: { groups: {}, thirdPlaceQualifiers: [], bracket: {}, goldenBoot: 'KYLIAN MBAPPÉ' }
    };
    const results = {
      goldenBoot: 'kylian mbappé'
    };

    const score = calcScore(playerData, results);
    expect(score.goldenBoot).toBe(10);
  });
});
