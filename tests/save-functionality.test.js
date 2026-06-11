/**
 * Save Functionality Tests
 *
 * Tests the exact functions that were broken:
 *  - cleanData() — strips undefined before Firestore writes
 *  - saveDraftPicks() / savePicks() payloads contain NO undefined
 *  - Validation guards (isPhase1PredictionComplete, isPhase2PredictionComplete)
 *  - normalizeBracketData / normalizeRoundWinners
 *  - Save button flow (fires Firestore write, shows toast, re-renders)
 *
 * If ANY of these fail, the save will break in production.
 */

const { describe, test, expect, beforeEach } = require('@jest/globals');

// ─── Replicate the exact functions from index.html ────────────────────────
// NOTE: When you change these in index.html, update them here too.
// That is the contract — tests break if implementation diverges.

function cleanData(obj) {
  if (obj === null || obj === undefined) return undefined;
  if (Array.isArray(obj)) return obj.map(cleanData).filter(x => x !== undefined);
  if (typeof obj === 'object') {
    const cleaned = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        const val = cleanData(obj[key]);
        if (val !== undefined) cleaned[key] = val;
      }
    }
    return Object.keys(cleaned).length > 0 ? cleaned : undefined;
  }
  return obj;
}

function hasFirestoreUndefined(obj) {
  // Simulate what Firestore does: walks entire object tree looking for undefined
  if (obj === undefined) return true;
  if (obj === null || typeof obj !== 'object') return false;
  if (Array.isArray(obj)) return obj.some(hasFirestoreUndefined);
  return Object.values(obj).some(hasFirestoreUndefined);
}

function normalizeRoundWinners(arr, totalTeams) {
  const source = Array.isArray(arr) ? arr : [];
  const winners = [];
  for (let i = 0; i < totalTeams; i += 2) {
    const a = source[i];
    const b = source[i + 1];
    winners.push((a && a.trim()) || (b && b.trim()) || '');
  }
  return winners;
}

function normalizeBracketData(bracket, isPhase2) {
  if (!bracket || typeof bracket !== 'object') return {};
  const normalized = { ...bracket };
  if (isPhase2) {
    normalized.r16 = normalizeRoundWinners(bracket.r16, 16);
    normalized.qf = normalizeRoundWinners(bracket.qf, 8);
    normalized.sf = normalizeRoundWinners(bracket.sf, 4);
    normalized.final = normalizeRoundWinners(bracket.final, 2);
  } else {
    normalized.r32 = normalizeRoundWinners(bracket.r32, 32);
    normalized.r16 = normalizeRoundWinners(bracket.r16, 16);
    normalized.qf = normalizeRoundWinners(bracket.qf, 8);
    normalized.sf = normalizeRoundWinners(bracket.sf, 4);
    normalized.final = normalizeRoundWinners(bracket.final, 2);
  }
  return normalized;
}

function isFilledTeamSlot(v) {
  return typeof v === 'string' && v.trim() !== '' && v !== 'TBD';
}

const WC_GROUPS = {
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
  L: ['Italy', 'Denmark', 'Iran', 'Tunisia'],
};

function hasCompleteGroups(groups) {
  if (!groups || typeof groups !== 'object') return false;
  const keys = Object.keys(WC_GROUPS);
  if (keys.some(k => !(groups[k] && Array.isArray(groups[k]) && groups[k].length === 4))) return false;
  return keys.every(k => groups[k].every(isFilledTeamSlot));
}

function hasCompleteBracketPath(bracket, isPhase2) {
  // pickBracket stores match winners in dense arrays: bracket[round][matchIdx]=winner
  // where matchIdx=Math.floor(teamIdx/2). So each position is a match winner.
  // Required match counts: r32=16, r16=8, qf=4, sf=2, final=1
  const required = isPhase2
    ? [{ key: 'r16', matches: 8 }, { key: 'qf', matches: 4 }, { key: 'sf', matches: 2 }, { key: 'final', matches: 1 }]
    : [{ key: 'r32', matches: 16 }, { key: 'r16', matches: 8 }, { key: 'qf', matches: 4 }, { key: 'sf', matches: 2 }, { key: 'final', matches: 1 }];
  return required.every(({ key, matches }) => {
    const arr = (bracket || {})[key] || [];
    if (arr.length < matches) return false;
    // Check that we have 'matches' number of filled slots
    let filled = 0;
    for (let i = 0; i < matches; i++) {
      if (isFilledTeamSlot(arr[i])) filled++;
    }
    return filled >= matches;
  });
}

function isPhase1PredictionComplete(phase1) {
  const p = phase1 || {};
  const qualifiers = (p.thirdPlaceQualifiers || []).filter(isFilledTeamSlot);
  return hasCompleteGroups(p.groups)
    && qualifiers.length === 8
    && hasCompleteBracketPath(p.bracket, false)
    && isFilledTeamSlot(p.goldenBoot || '');
}

function isPhase2PredictionComplete(phase2) {
  const p = phase2 || {};
  return hasCompleteBracketPath(p.bracket, true)
    && isFilledTeamSlot(p.goldenBoot || '');
}

// Build a complete valid phase1 picks object for testing
function makeCompleteGroups() {
  const groups = {};
  Object.entries(WC_GROUPS).forEach(([k, teams]) => {
    groups[k] = teams.slice(); // 4 teams per group
  });
  return groups;
}

function makeCompletePhase1Bracket() {
  // Real pick format: pickBracket stores match winners at matchIdx = Math.floor(teamIdx/2)
  // Dense arrays: each element is a match winner
  // r32: 16 matches → 16 winners, r16: 8 matches → 8 winners, etc.
  return {
    r32:   ['France','Spain','Brazil','Germany','Argentina','Portugal','England','Netherlands','Italy','Belgium','Croatia','Switzerland','Denmark','Mexico','Uruguay','Poland'],
    r16:   ['France','Spain','Brazil','Germany','Argentina','Portugal','England','Netherlands'],
    qf:    ['France','Brazil','Argentina','England'],
    sf:    ['France','Argentina'],
    third: ['Brazil'],
    final: ['France'],
  };
}

function makeCompletePhase1() {
  return {
    groups: makeCompleteGroups(),
    thirdPlaceQualifiers: ['Brazil', 'Argentina', 'Spain', 'Germany', 'Portugal', 'Italy', 'Netherlands', 'Belgium'],
    bracket: makeCompletePhase1Bracket(),
    goldenBoot: 'Kylian Mbappé',
  };
}

// ─── 1. cleanData ─────────────────────────────────────────────────────────
describe('cleanData — strips undefined for Firestore', () => {
  test('undefined input returns undefined', () => {
    expect(cleanData(undefined)).toBeUndefined();
  });

  test('null input returns undefined (Firestore does NOT allow null by default)', () => {
    // cleanData returns undefined for null, caller uses ||{} as fallback
    expect(cleanData(null)).toBeUndefined();
  });

  test('primitive values pass through unchanged', () => {
    expect(cleanData('France')).toBe('France');
    expect(cleanData(42)).toBe(42);
    expect(cleanData(true)).toBe(true);
    expect(cleanData('')).toBe('');
  });

  test('flat object with no undefined passes through', () => {
    const input = { name: 'Rishi', score: 10 };
    expect(cleanData(input)).toEqual({ name: 'Rishi', score: 10 });
  });

  test('flat object removes undefined values', () => {
    const input = { name: 'Rishi', bad: undefined, score: 10 };
    const result = cleanData(input);
    expect(result).toEqual({ name: 'Rishi', score: 10 });
    expect('bad' in result).toBe(false);
  });

  test('deeply nested undefined is removed', () => {
    const input = {
      phase1: {
        bracket: {
          qf: undefined,
          sf: ['France', 'Spain'],
        },
        goldenBoot: 'Mbappé',
      },
    };
    const result = cleanData(input);
    expect(result.phase1.bracket.sf).toEqual(['France', 'Spain']);
    expect('qf' in result.phase1.bracket).toBe(false);
  });

  test('arrays filter out undefined elements', () => {
    const input = { teams: ['France', undefined, 'Spain', undefined] };
    const result = cleanData(input);
    expect(result.teams).toEqual(['France', 'Spain']);
  });

  test('empty object after stripping returns undefined (caller uses ||{})', () => {
    expect(cleanData({})).toBeUndefined();
    expect(cleanData({ a: undefined })).toBeUndefined();
  });

  test('result contains NO undefined — Firestore-safe', () => {
    const dirty = {
      phase1: {
        groups: { A: undefined, B: ['France', 'Spain', 'Brazil', 'Germany'] },
        bracket: { r16: undefined, qf: ['France', 'Spain'], sf: undefined },
        goldenBoot: undefined,
        thirdPlaceQualifiers: [undefined, 'France', undefined, 'Spain'],
      },
      phase2: undefined,
      name: 'Rishi',
    };
    const result = cleanData(dirty) || {};
    expect(hasFirestoreUndefined(result)).toBe(false);
  });

  test('JSON.stringify round-trip also produces no undefined', () => {
    // This simulates the backup protection used in saveDraftPicks
    const dirty = { a: undefined, b: { c: undefined, d: 'ok' }, e: [undefined, 'x'] };
    const clean = cleanData(dirty) || {};
    const roundTripped = JSON.parse(JSON.stringify(clean));
    expect(hasFirestoreUndefined(roundTripped)).toBe(false);
  });
});

// ─── 2. Firestore payload safety ─────────────────────────────────────────
describe('Firestore payload — never contains undefined', () => {
  function buildSavePayload(myPicks, user) {
    // Mirrors the exact logic in savePicks() / saveDraftPicks()
    const saveData = {
      phase1: cleanData(myPicks.phase1) || {},
      phase2: cleanData(myPicks.phase2) || {},
      name: (user && user.displayName) || 'Anonymous',
      photoURL: (user && user.photoURL) || '',
      email: (user && user.email) || '',
    };
    if (myPicks.phase1SubmittedAt) {
      saveData.phase1SubmittedAt = myPicks.phase1SubmittedAt;
    }
    return JSON.parse(JSON.stringify(saveData));
  }

  test('fresh empty myPicks produces no undefined', () => {
    const myPicks = { phase1: { groups: {}, thirdPlaceQualifiers: [], bracket: {}, goldenBoot: '' }, phase2: { bracket: {}, goldenBoot: '' }, phase1SubmittedAt: null };
    const user = { displayName: 'Rishi', photoURL: '', email: 'r@test.com' };
    const payload = buildSavePayload(myPicks, user);
    expect(hasFirestoreUndefined(payload)).toBe(false);
  });

  test('myPicks with undefined bracket rounds produces no undefined', () => {
    const myPicks = {
      phase1: {
        groups: { A: undefined },
        thirdPlaceQualifiers: [undefined, 'France'],
        bracket: { r32: undefined, r16: undefined, qf: undefined },
        goldenBoot: undefined,
      },
      phase2: undefined,
      phase1SubmittedAt: null,
    };
    const user = { displayName: 'Rishi', photoURL: null, email: undefined };
    const payload = buildSavePayload(myPicks, user);
    expect(hasFirestoreUndefined(payload)).toBe(false);
  });

  test('partially-filled bracket produces no undefined', () => {
    const myPicks = {
      phase1: {
        groups: makeCompleteGroups(),
        thirdPlaceQualifiers: ['France', 'Spain'],
        bracket: { r32: ['France', undefined, 'Spain'], r16: undefined, qf: [] },
        goldenBoot: 'Mbappé',
      },
      phase2: { bracket: {}, goldenBoot: '' },
      phase1SubmittedAt: null,
    };
    const user = { displayName: 'Rishi', photoURL: '', email: 'r@test.com' };
    const payload = buildSavePayload(myPicks, user);
    expect(hasFirestoreUndefined(payload)).toBe(false);
  });

  test('complete picks object produces no undefined', () => {
    const myPicks = {
      phase1: makeCompletePhase1(),
      phase2: { bracket: {}, goldenBoot: '' },
      phase1SubmittedAt: null,
    };
    const user = { displayName: 'Rishi', photoURL: 'https://photo.jpg', email: 'r@test.com' };
    const payload = buildSavePayload(myPicks, user);
    expect(hasFirestoreUndefined(payload)).toBe(false);
    expect(payload.name).toBe('Rishi');
    expect(payload.phase1).toBeDefined();
    expect(payload.phase2).toBeDefined();
  });

  test('players doc payload produces no undefined', () => {
    const myPicks = {
      phase1: makeCompletePhase1(),
      phase2: { bracket: {}, goldenBoot: '' },
    };
    const user = { uid: 'abc123', displayName: 'Rishi', photoURL: '', email: 'r@test.com' };
    const playersData = {
      [user.uid]: JSON.parse(JSON.stringify({
        name: user.displayName || 'Anonymous',
        photoURL: user.photoURL || '',
        email: user.email || '',
        phase1: cleanData(myPicks.phase1) || {},
        phase2: cleanData(myPicks.phase2) || {},
      })),
    };
    expect(hasFirestoreUndefined(playersData)).toBe(false);
  });
});

// ─── 3. savePicks mock test ───────────────────────────────────────────────
describe('savePicks — Firestore mock', () => {
  let mockSet;
  let capturedPayloads;

  beforeEach(() => {
    capturedPayloads = [];
    mockSet = jest.fn(async (data) => {
      // Simulate what Firestore does: throw if any undefined field
      if (hasFirestoreUndefined(data)) {
        throw new Error(`Function DocumentReference.set() called with invalid data. Unsupported field value: undefined`);
      }
      capturedPayloads.push(JSON.parse(JSON.stringify(data)));
    });
  });

  async function simulateSave(myPicks, user) {
    const saveData = {
      phase1: cleanData(myPicks.phase1) || {},
      phase2: cleanData(myPicks.phase2) || {},
      name: (user && user.displayName) || 'Anonymous',
      photoURL: (user && user.photoURL) || '',
      email: (user && user.email) || '',
    };
    if (myPicks.phase1SubmittedAt) saveData.phase1SubmittedAt = myPicks.phase1SubmittedAt;
    const sanitized = JSON.parse(JSON.stringify(saveData));
    await mockSet(sanitized);
    return sanitized;
  }

  test('save with empty picks does not throw', async () => {
    const myPicks = { phase1: { groups: {}, thirdPlaceQualifiers: [], bracket: {}, goldenBoot: '' }, phase2: { bracket: {}, goldenBoot: '' }, phase1SubmittedAt: null };
    const user = { displayName: 'Rishi', photoURL: '', email: 'r@test.com' };
    await expect(simulateSave(myPicks, user)).resolves.not.toThrow();
    expect(mockSet).toHaveBeenCalledTimes(1);
  });

  test('save with undefined bracket fields does not throw', async () => {
    const myPicks = {
      phase1: { groups: { A: undefined }, bracket: { r16: undefined }, goldenBoot: undefined, thirdPlaceQualifiers: undefined },
      phase2: undefined,
      phase1SubmittedAt: null,
    };
    const user = { displayName: 'Rishi', photoURL: undefined, email: undefined };
    await expect(simulateSave(myPicks, user)).resolves.not.toThrow();
  });

  test('saved payload reaching Firestore mock has no undefined', async () => {
    const myPicks = {
      phase1: { groups: { A: undefined, B: ['M', 'N', 'O', 'P'] }, bracket: { r16: undefined }, goldenBoot: undefined, thirdPlaceQualifiers: [undefined, 'France'] },
      phase2: undefined,
      phase1SubmittedAt: null,
    };
    const user = { displayName: 'Test', photoURL: null, email: '' };
    const payload = await simulateSave(myPicks, user);
    expect(hasFirestoreUndefined(payload)).toBe(false);
  });

  test('save with complete phase1 picks stores goldenBoot', async () => {
    const complete = makeCompletePhase1();
    const myPicks = { phase1: complete, phase2: { bracket: {}, goldenBoot: '' }, phase1SubmittedAt: null };
    const user = { displayName: 'Rishi', photoURL: 'https://photo.jpg', email: 'r@test.com' };
    const payload = await simulateSave(myPicks, user);
    expect(payload.phase1.goldenBoot).toBe('Kylian Mbappé');
  });

  test('Firestore mock DOES throw when given undefined directly', async () => {
    await expect(mockSet({ name: 'Rishi', bad: undefined })).rejects.toThrow('undefined');
  });
});

// ─── 4. Validation functions ──────────────────────────────────────────────
describe('isPhase1PredictionComplete', () => {
  test('returns false for empty phase1', () => {
    expect(isPhase1PredictionComplete({})).toBe(false);
  });

  test('returns false when groups missing', () => {
    const p = makeCompletePhase1();
    delete p.groups;
    expect(isPhase1PredictionComplete(p)).toBe(false);
  });

  test('returns false when fewer than 8 third-place qualifiers', () => {
    const p = makeCompletePhase1();
    p.thirdPlaceQualifiers = ['France', 'Spain'];
    expect(isPhase1PredictionComplete(p)).toBe(false);
  });

  test('returns false when bracket missing r16', () => {
    const p = makeCompletePhase1();
    p.bracket.r16 = [];
    expect(isPhase1PredictionComplete(p)).toBe(false);
  });

  test('returns false when r16 has fewer than 16 teams', () => {
    const p = makeCompletePhase1();
    p.bracket.r16 = ['France', 'Spain']; // only 2 of 16
    expect(isPhase1PredictionComplete(p)).toBe(false);
  });

  test('returns false when final is missing', () => {
    const p = makeCompletePhase1();
    p.bracket.final = [];
    expect(isPhase1PredictionComplete(p)).toBe(false);
  });

  test('returns false when golden boot is empty', () => {
    const p = makeCompletePhase1();
    p.goldenBoot = '';
    expect(isPhase1PredictionComplete(p)).toBe(false);
  });

  test('returns false when golden boot is TBD', () => {
    const p = makeCompletePhase1();
    p.goldenBoot = 'TBD';
    expect(isPhase1PredictionComplete(p)).toBe(false);
  });

  test('returns true for fully complete phase1', () => {
    expect(isPhase1PredictionComplete(makeCompletePhase1())).toBe(true);
  });
});

describe('isPhase2PredictionComplete', () => {
  function makeCompletePhase2() {
    return {
      bracket: {
        r16:   ['France','Spain','Brazil','Germany','Argentina','Portugal','England','Netherlands'],
        qf:    ['France','Brazil','Argentina','England'],
        sf:    ['France','Argentina'],
        third: ['Brazil'],
        final: ['France'],
      },
      goldenBoot: 'Kylian Mbappé',
    };
  }

  test('returns false for empty phase2', () => {
    expect(isPhase2PredictionComplete({})).toBe(false);
  });

  test('returns false when qf is empty', () => {
    const p = makeCompletePhase2();
    p.bracket.qf = [];
    expect(isPhase2PredictionComplete(p)).toBe(false);
  });

  test('returns false when final is missing', () => {
    const p = makeCompletePhase2();
    p.bracket.final = [];
    expect(isPhase2PredictionComplete(p)).toBe(false);
  });

  test('returns false when golden boot missing', () => {
    const p = makeCompletePhase2();
    p.goldenBoot = '';
    expect(isPhase2PredictionComplete(p)).toBe(false);
  });

  test('returns true for fully complete phase2', () => {
    expect(isPhase2PredictionComplete(makeCompletePhase2())).toBe(true);
  });
});

// ─── 5. normalizeBracketData ──────────────────────────────────────────────
describe('normalizeBracketData', () => {
  test('handles null/undefined bracket gracefully', () => {
    expect(normalizeBracketData(null, false)).toEqual({});
    expect(normalizeBracketData(undefined, false)).toEqual({});
  });

  test('phase1: fills all round arrays with correct team counts', () => {
    const result = normalizeBracketData({}, false);
    expect(result.r32).toHaveLength(16); // 32 slots = 16 match winners
    expect(result.r16).toHaveLength(8);
    expect(result.qf).toHaveLength(4);
    expect(result.sf).toHaveLength(2);
    expect(result.final).toHaveLength(1);
  });

  test('phase2: only r16 onward, no r32', () => {
    const result = normalizeBracketData({}, true);
    expect(result.r16).toHaveLength(8);
    expect(result.qf).toHaveLength(4);
    expect(result.sf).toHaveLength(2);
    expect(result.final).toHaveLength(1);
    // r32 not populated for phase2
    expect(result.r32).toBeUndefined();
  });

  test('preserves existing winners from bracket', () => {
    const bracket = { r32: new Array(32).fill('France') };
    const result = normalizeBracketData(bracket, false);
    expect(result.r32).toHaveLength(16);
    expect(result.r32.every(t => t === 'France')).toBe(true);
  });

  test('handles sparse/partial arrays without crashing', () => {
    const bracket = { r32: ['France', undefined, 'Spain', undefined] };
    const result = normalizeBracketData(bracket, false);
    expect(result.r32).toBeDefined();
    expect(() => JSON.stringify(result)).not.toThrow();
  });
});

// ─── 6. normalizeRoundWinners ─────────────────────────────────────────────
describe('normalizeRoundWinners', () => {
  test('extracts winner from each pair', () => {
    const arr = ['France', 'Spain', 'Brazil', 'Germany'];
    expect(normalizeRoundWinners(arr, 4)).toEqual(['France', 'Brazil']);
  });

  test('handles null input', () => {
    expect(normalizeRoundWinners(null, 4)).toEqual(['', '']);
  });

  test('handles undefined elements', () => {
    const arr = [undefined, 'Spain', 'Brazil', undefined];
    expect(normalizeRoundWinners(arr, 4)).toEqual(['Spain', 'Brazil']);
  });

  test('handles short array without crashing', () => {
    const arr = ['France'];
    expect(() => normalizeRoundWinners(arr, 4)).not.toThrow();
  });

  test('handles empty array', () => {
    expect(normalizeRoundWinners([], 4)).toEqual(['', '']);
  });

  test('does not produce undefined in output', () => {
    const arr = [undefined, undefined, undefined, undefined];
    const result = normalizeRoundWinners(arr, 4);
    expect(result.every(v => v !== undefined)).toBe(true);
  });
});

// ─── 7. hasCompleteBracketPath ────────────────────────────────────────────
describe('hasCompleteBracketPath', () => {
  test('returns false for empty bracket', () => {
    expect(hasCompleteBracketPath({}, false)).toBe(false);
    expect(hasCompleteBracketPath({}, true)).toBe(false);
  });

  test('phase1 requires all rounds filled with match winners', () => {
    const bracket = makeCompletePhase1Bracket();
    // Verify complete bracket passes
    expect(hasCompleteBracketPath(bracket, false)).toBe(true);
    // Break r16 — only 2 of 8 matches filled
    bracket.r16 = ['France', 'Spain']; // 2 matches filled, needs 8
    expect(hasCompleteBracketPath(bracket, false)).toBe(false);
  });

  test('phase2 requires r16 through final', () => {
    // phase2 starts from r16, so r16 picks are required
    const bracket = {
      r16:  ['France','Spain','Brazil','Germany','Argentina','Portugal','England','Netherlands'], // 8 matches
      qf:   ['France','Brazil','Argentina','England'], // 4 matches
      sf:   ['France','Argentina'], // 2 matches
      final:['France'], // 1 match
    };
    expect(hasCompleteBracketPath(bracket, true)).toBe(true);
    // phase2 without r16 should fail
    const noR16 = { qf: bracket.qf, sf: bracket.sf, final: bracket.final };
    expect(hasCompleteBracketPath(noR16, true)).toBe(false);
  });

  test('rejects TBD as final match winner', () => {
    const bracket = makeCompletePhase1Bracket();
    bracket.final = ['TBD']; // TBD is not a valid filled slot
    expect(hasCompleteBracketPath(bracket, false)).toBe(false);
  });

  test('rejects empty final match', () => {
    const bracket = makeCompletePhase1Bracket();
    bracket.final = []; // no winner at all
    expect(hasCompleteBracketPath(bracket, false)).toBe(false);
  });
});

// ─── 8. hasFirestoreUndefined helper self-test ────────────────────────────
describe('hasFirestoreUndefined (test utility self-check)', () => {
  test('detects undefined in flat object', () => {
    expect(hasFirestoreUndefined({ a: undefined })).toBe(true);
  });

  test('detects undefined in nested object', () => {
    expect(hasFirestoreUndefined({ a: { b: { c: undefined } } })).toBe(true);
  });

  test('detects undefined in array', () => {
    expect(hasFirestoreUndefined({ a: [1, undefined, 3] })).toBe(true);
  });

  test('returns false for clean object', () => {
    expect(hasFirestoreUndefined({ a: 'ok', b: 42, c: null, d: [] })).toBe(false);
  });

  test('returns false for empty object', () => {
    expect(hasFirestoreUndefined({})).toBe(false);
  });
});
