/**
 * FIFA 2026 Prediction League - League Management Tests
 * Tests for league creation, joining, URL invites, and leaderboards
 */

const { describe, test, expect, beforeEach } = require('@jest/globals');

// ══════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS (extracted from index.html)
// ══════════════════════════════════════════════════════════════════════════

function generateLeagueCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 5; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function createInviteLink(leagueCode, baseUrl = 'https://world-cup-2026-e1a0b.web.app') {
  return `${baseUrl}/?league=${leagueCode}`;
}

function getLeagueCodeFromURL(urlString) {
  try {
    const url = new URL(urlString);
    const code = url.searchParams.get('league');
    return code ? code.toUpperCase().slice(0, 5) : null;
  } catch {
    return null;
  }
}

function validateLeagueCode(code) {
  if (!code) return false;
  if (code.length !== 5) return false;
  return /^[A-Z0-9]+$/.test(code);
}

function calculateLeaderboard(players, results) {
  const scores = [];
  
  Object.entries(players).forEach(([uid, data]) => {
    const name = data.displayName || 'Anonymous';
    const email = data.email || '';
    const photoURL = data.photoURL || null;
    
    // Mock scoring calculation
    let total = 0;
    if (data.phase1 && data.phase1.groups) {
      total += Object.keys(data.phase1.groups).length; // Simple mock
    }
    
    scores.push({ uid, name, email, photoURL, total });
  });
  
  // Sort by total descending
  scores.sort((a, b) => b.total - a.total);
  
  return scores;
}

// ══════════════════════════════════════════════════════════════════════════
// TEST SUITES
// ══════════════════════════════════════════════════════════════════════════

describe('League Code Generation', () => {
  test('should generate 5-character code', () => {
    const code = generateLeagueCode();
    expect(code).toHaveLength(5);
  });

  test('should only use uppercase letters and numbers', () => {
    const code = generateLeagueCode();
    expect(/^[A-Z0-9]+$/.test(code)).toBe(true);
  });

  test('should not include ambiguous characters (I, O, 0, 1)', () => {
    // Generate 100 codes to test randomness
    for (let i = 0; i < 100; i++) {
      const code = generateLeagueCode();
      expect(code).not.toMatch(/[IO01]/);
    }
  });

  test('should generate different codes', () => {
    const codes = new Set();
    for (let i = 0; i < 50; i++) {
      codes.add(generateLeagueCode());
    }
    // Should have high uniqueness (at least 45/50)
    expect(codes.size).toBeGreaterThan(45);
  });
});

describe('League Invite Links', () => {
  test('should create valid invite URL', () => {
    const link = createInviteLink('ABC12');
    expect(link).toBe('https://world-cup-2026-e1a0b.web.app/?league=ABC12');
  });

  test('should handle custom base URL', () => {
    const link = createInviteLink('XYZ99', 'https://custom.domain.com');
    expect(link).toBe('https://custom.domain.com/?league=XYZ99');
  });

  test('should extract league code from URL', () => {
    const url = 'https://world-cup-2026-e1a0b.web.app/?league=ABC12';
    const code = getLeagueCodeFromURL(url);
    expect(code).toBe('ABC12');
  });

  test('should handle lowercase codes in URL', () => {
    const url = 'https://world-cup-2026-e1a0b.web.app/?league=abc12';
    const code = getLeagueCodeFromURL(url);
    expect(code).toBe('ABC12');
  });

  test('should handle URLs with multiple parameters', () => {
    const url = 'https://world-cup-2026-e1a0b.web.app/?utm_source=email&league=DEF45&ref=promo';
    const code = getLeagueCodeFromURL(url);
    expect(code).toBe('DEF45');
  });

  test('should return null for URL without league parameter', () => {
    const url = 'https://world-cup-2026-e1a0b.web.app/';
    const code = getLeagueCodeFromURL(url);
    expect(code).toBeNull();
  });

  test('should handle invalid URLs gracefully', () => {
    expect(getLeagueCodeFromURL('not-a-url')).toBeNull();
    expect(getLeagueCodeFromURL('')).toBeNull();
    expect(getLeagueCodeFromURL(null)).toBeNull();
  });
});

describe('League Code Validation', () => {
  test('should validate correct 5-character codes', () => {
    expect(validateLeagueCode('ABC12')).toBe(true);
    expect(validateLeagueCode('XYZ99')).toBe(true);
    expect(validateLeagueCode('HELLO')).toBe(true);
  });

  test('should reject codes with wrong length', () => {
    expect(validateLeagueCode('ABC')).toBe(false);
    expect(validateLeagueCode('ABCD')).toBe(false);
    expect(validateLeagueCode('ABC123')).toBe(false);
  });

  test('should reject codes with lowercase letters', () => {
    expect(validateLeagueCode('abc12')).toBe(false);
    expect(validateLeagueCode('AbC12')).toBe(false);
  });

  test('should reject codes with special characters', () => {
    expect(validateLeagueCode('ABC-2')).toBe(false);
    expect(validateLeagueCode('ABC_2')).toBe(false);
    expect(validateLeagueCode('ABC@2')).toBe(false);
  });

  test('should reject null/undefined/empty codes', () => {
    expect(validateLeagueCode(null)).toBe(false);
    expect(validateLeagueCode(undefined)).toBe(false);
    expect(validateLeagueCode('')).toBe(false);
  });
});

describe('Leaderboard Calculation', () => {
  test('should rank players by total score', () => {
    const players = {
      'uid1': { displayName: 'Alice', email: 'alice@test.com', phase1: { groups: { A: [], B: [], C: [] } } },
      'uid2': { displayName: 'Bob', email: 'bob@test.com', phase1: { groups: { A: [], B: [] } } },
      'uid3': { displayName: 'Charlie', email: 'charlie@test.com', phase1: { groups: { A: [] } } }
    };

    const leaderboard = calculateLeaderboard(players, {});
    
    expect(leaderboard).toHaveLength(3);
    expect(leaderboard[0].name).toBe('Alice');
    expect(leaderboard[1].name).toBe('Bob');
    expect(leaderboard[2].name).toBe('Charlie');
  });

  test('should handle players with same score', () => {
    const players = {
      'uid1': { displayName: 'Alice', email: 'alice@test.com', phase1: { groups: { A: [] } } },
      'uid2': { displayName: 'Bob', email: 'bob@test.com', phase1: { groups: { B: [] } } }
    };

    const leaderboard = calculateLeaderboard(players, {});
    expect(leaderboard).toHaveLength(2);
    // Both should have same score
    expect(leaderboard[0].total).toBe(leaderboard[1].total);
  });

  test('should handle anonymous players', () => {
    const players = {
      'uid1': { phase1: { groups: { A: [] } } }
    };

    const leaderboard = calculateLeaderboard(players, {});
    expect(leaderboard[0].name).toBe('Anonymous');
  });

  test('should handle empty players object', () => {
    const leaderboard = calculateLeaderboard({}, {});
    expect(leaderboard).toHaveLength(0);
  });

  test('should include all player fields in leaderboard', () => {
    const players = {
      'uid1': {
        displayName: 'Test User',
        email: 'test@example.com',
        photoURL: 'https://example.com/photo.jpg',
        phase1: { groups: { A: [] } }
      }
    };

    const leaderboard = calculateLeaderboard(players, {});
    expect(leaderboard[0]).toHaveProperty('uid');
    expect(leaderboard[0]).toHaveProperty('name');
    expect(leaderboard[0]).toHaveProperty('email');
    expect(leaderboard[0]).toHaveProperty('photoURL');
    expect(leaderboard[0]).toHaveProperty('total');
  });
});

describe('League Management Edge Cases', () => {
  test('should handle very long league codes gracefully', () => {
    const longCode = 'ABCDEFGHIJKLMNOP';
    const extracted = getLeagueCodeFromURL(`https://test.com/?league=${longCode}`);
    expect(extracted).toHaveLength(5); // Should truncate to 5
  });

  test('should handle URL with hash and query params', () => {
    const url = 'https://world-cup-2026-e1a0b.web.app/?league=ABC12#section';
    const code = getLeagueCodeFromURL(url);
    expect(code).toBe('ABC12');
  });

  test('league invite link should be copyable', () => {
    const link = createInviteLink('TEST5');
    expect(typeof link).toBe('string');
    expect(link.startsWith('https://')).toBe(true);
  });

  test('should handle malformed league codes in URL', () => {
    const testCases = [
      { url: 'https://test.com/?league=', expected: null },
      { url: 'https://test.com/?league=AB', expected: 'AB' }, // Will be 2 chars (truncated)
      { url: 'https://test.com/?league=TOOLONG123', expected: 'TOOLO' } // Truncated to 5
    ];

    testCases.forEach(({ url, expected }) => {
      const code = getLeagueCodeFromURL(url);
      if (expected === null) {
        expect(code).toBeNull();
      } else {
        expect(code).toBe(expected);
      }
    });
  });
});
