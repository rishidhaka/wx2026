/**
 * FIFA 2026 Prediction League - Privacy Tests
 * Tests for pick visibility and leaderboard filtering
 */

const { describe, test, expect } = require('@jest/globals');

// ══════════════════════════════════════════════════════════════════════════
// MOCK DATA
// ══════════════════════════════════════════════════════════════════════════

const mockPlayers = {
  // Player with Phase 1 picks
  'user-with-p1-picks': {
    name: 'Alice',
    photoURL: 'https://example.com/alice.jpg',
    phase1: {
      groups: {
        A: ['USA', 'England', 'Panama', 'Bolivia'],
        B: ['Mexico', 'Ecuador', 'Jamaica', 'Venezuela']
      },
      thirdPlaceQualifiers: ['Panama', 'Jamaica', 'Chile', 'Peru', 'Costa Rica', 'Honduras', 'Paraguay', 'Algeria'],
      bracket: { r32: ['USA', 'Mexico'], r16: ['USA'], qf: ['USA'], sf: ['USA'], final: ['USA'] },
      goldenBoot: 'Lionel Messi'
    },
    phase2: {}
  },
  
  // Player with Phase 2 picks only
  'user-with-p2-picks': {
    name: 'Bob',
    photoURL: 'https://example.com/bob.jpg',
    phase1: {},
    phase2: {
      bracket: { r16: ['Brazil', 'France'], qf: ['Brazil'], sf: ['Brazil'], final: ['Brazil'] },
      goldenBoot: 'Kylian Mbappe'
    }
  },
  
  // Player with NO picks yet
  'user-no-picks': {
    name: 'Charlie',
    photoURL: 'https://example.com/charlie.jpg',
    phase1: {},
    phase2: {}
  },
  
  // Player with empty groups object (no picks)
  'user-empty-groups': {
    name: 'Diana',
    photoURL: 'https://example.com/diana.jpg',
    phase1: { groups: {} },
    phase2: {}
  },
  
  // Player with both Phase 1 and Phase 2 picks
  'user-complete-picks': {
    name: 'Eve',
    photoURL: 'https://example.com/eve.jpg',
    phase1: {
      groups: {
        A: ['USA', 'England', 'Panama', 'Bolivia']
      },
      thirdPlaceQualifiers: ['Panama', 'Jamaica', 'Chile', 'Peru', 'Costa Rica', 'Honduras', 'Paraguay', 'Algeria'],
      bracket: { r32: ['USA'], r16: ['USA'], qf: ['USA'], sf: ['USA'], final: ['USA'] },
      goldenBoot: 'Cristiano Ronaldo'
    },
    phase2: {
      bracket: { r16: ['Brazil'], qf: ['Brazil'], sf: ['Brazil'], final: ['Brazil'] },
      goldenBoot: 'Neymar'
    }
  }
};

// ══════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS (extracted from index.html)
// ══════════════════════════════════════════════════════════════════════════

function hasPicksPhase1(player) {
  if (!player) return false;
  return !!(player.phase1?.groups && Object.keys(player.phase1.groups).length > 0);
}

function hasPicksPhase2(player) {
  if (!player) return false;
  return !!(player.phase2?.bracket && Object.keys(player.phase2.bracket).length > 0);
}

function hasPicks(player) {
  if (!player) return false;
  return hasPicksPhase1(player) || hasPicksPhase2(player);
}

function filterPlayersWithPicks(players) {
  return Object.entries(players || {})
    .filter(([uid, p]) => hasPicks(p))
    .reduce((acc, [uid, p]) => {
      acc[uid] = p;
      return acc;
    }, {});
}

// ══════════════════════════════════════════════════════════════════════════
// TESTS
// ══════════════════════════════════════════════════════════════════════════

describe('Privacy - Pick Detection', () => {
  test('detects Phase 1 picks correctly', () => {
    expect(hasPicksPhase1(mockPlayers['user-with-p1-picks'])).toBe(true);
    expect(hasPicksPhase1(mockPlayers['user-with-p2-picks'])).toBe(false);
    expect(hasPicksPhase1(mockPlayers['user-no-picks'])).toBe(false);
    expect(hasPicksPhase1(mockPlayers['user-empty-groups'])).toBe(false);
  });

  test('detects Phase 2 picks correctly', () => {
    expect(hasPicksPhase2(mockPlayers['user-with-p2-picks'])).toBe(true);
    expect(hasPicksPhase2(mockPlayers['user-with-p1-picks'])).toBe(false);
    expect(hasPicksPhase2(mockPlayers['user-no-picks'])).toBe(false);
  });

  test('detects any picks correctly', () => {
    expect(hasPicks(mockPlayers['user-with-p1-picks'])).toBe(true);
    expect(hasPicks(mockPlayers['user-with-p2-picks'])).toBe(true);
    expect(hasPicks(mockPlayers['user-complete-picks'])).toBe(true);
    expect(hasPicks(mockPlayers['user-no-picks'])).toBe(false);
    expect(hasPicks(mockPlayers['user-empty-groups'])).toBe(false);
  });

  test('handles null/undefined player data', () => {
    expect(hasPicks(null)).toBe(false);
    expect(hasPicks(undefined)).toBe(false);
    expect(hasPicks({})).toBe(false);
  });
});

describe('Privacy - Leaderboard Filtering', () => {
  test('filters out players without picks', () => {
    const filtered = filterPlayersWithPicks(mockPlayers);
    
    expect(filtered['user-with-p1-picks']).toBeDefined();
    expect(filtered['user-with-p2-picks']).toBeDefined();
    expect(filtered['user-complete-picks']).toBeDefined();
    expect(filtered['user-no-picks']).toBeUndefined();
    expect(filtered['user-empty-groups']).toBeUndefined();
  });

  test('returns empty object when all players have no picks', () => {
    const noPicks = {
      'user1': { name: 'User1', phase1: {}, phase2: {} },
      'user2': { name: 'User2', phase1: {}, phase2: {} }
    };
    
    const filtered = filterPlayersWithPicks(noPicks);
    expect(Object.keys(filtered)).toHaveLength(0);
  });

  test('returns all players when all have picks', () => {
    const allWithPicks = {
      'user1': mockPlayers['user-with-p1-picks'],
      'user2': mockPlayers['user-with-p2-picks'],
      'user3': mockPlayers['user-complete-picks']
    };
    
    const filtered = filterPlayersWithPicks(allWithPicks);
    expect(Object.keys(filtered)).toHaveLength(3);
  });

  test('handles empty input', () => {
    expect(Object.keys(filterPlayersWithPicks(null))).toHaveLength(0);
    expect(Object.keys(filterPlayersWithPicks(undefined))).toHaveLength(0);
    expect(Object.keys(filterPlayersWithPicks({}))).toHaveLength(0);
  });
});

describe('Privacy - Edge Cases', () => {
  test('player with only groups but empty = no picks', () => {
    const player = { phase1: { groups: {} }, phase2: {} };
    expect(hasPicks(player)).toBe(false);
  });

  test('player with one group = has picks', () => {
    const player = { 
      phase1: { groups: { A: ['USA', 'England', 'Panama', 'Bolivia'] } },
      phase2: {}
    };
    expect(hasPicks(player)).toBe(true);
  });

  test('player with only bracket = has picks', () => {
    const player = { 
      phase1: {},
      phase2: { bracket: { r16: ['Brazil'] } }
    };
    expect(hasPicks(player)).toBe(true);
  });

  test('player with only goldenBoot but no groups/bracket = no picks', () => {
    const player = { 
      phase1: { goldenBoot: 'Messi', groups: {} },
      phase2: {}
    };
    expect(hasPicks(player)).toBe(false);
  });

  test('player with thirdPlaceQualifiers but no groups = no picks', () => {
    const player = { 
      phase1: { 
        groups: {},
        thirdPlaceQualifiers: ['Panama', 'Jamaica']
      },
      phase2: {}
    };
    expect(hasPicks(player)).toBe(false);
  });
});

describe('Privacy - Real-world Scenarios', () => {
  test('new user who just signed in = no picks', () => {
    const newUser = {
      name: 'New User',
      photoURL: 'https://example.com/new.jpg',
      email: 'new@example.com'
      // No phase1 or phase2 properties yet
    };
    expect(hasPicks(newUser)).toBe(false);
  });

  test('user who saved picks mid-way = has picks', () => {
    const midwayUser = {
      name: 'Midway User',
      phase1: {
        groups: {
          A: ['USA', 'England', 'Panama', 'Bolivia'],
          B: ['Mexico', 'Ecuador', 'Jamaica', 'Venezuela']
          // Only 2 groups filled, but still counts as picks
        }
      },
      phase2: {}
    };
    expect(hasPicks(midwayUser)).toBe(true);
  });

  test('user who only completed Phase 2 after deadline = has picks', () => {
    const phase2OnlyUser = {
      name: 'Phase 2 Only',
      phase1: {}, // Missed Phase 1 deadline
      phase2: {
        bracket: { r16: ['Brazil', 'France'], qf: ['Brazil'], sf: ['Brazil'], final: ['Brazil'] }
      }
    };
    expect(hasPicks(phase2OnlyUser)).toBe(true);
  });
});
