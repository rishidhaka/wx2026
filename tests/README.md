# FIFA 2026 Prediction League - Test Suite

Comprehensive test suite for all major functionalities of the prediction league app.

## 📋 Test Coverage

### Core Logic Tests (`core-logic.test.js`)
- ✅ Tournament data validation (48 teams, 12 groups, 16 R32 matchups)
- ✅ Deadline logic (Phase 1, Group Stage end)
- ✅ Group seeding and flag lookups
- ✅ Bracket seeding from groups (including third-place qualifiers)
- ✅ Phase 1 scoring (groups, thirds, knockout, golden boot)
- ✅ Phase 2 scoring (R16, QF, SF, Final/Champion)
- ✅ Complete scoring scenarios (perfect score, zero score)
- ✅ Edge cases (missing data, null inputs, case-insensitive golden boot)

### Admin & Authentication Tests (`admin-auth.test.js`)
- ✅ Admin password validation
- ✅ Admin permissions by UID
- ✅ Admin tab visibility logic
- ✅ User authentication flow
- ✅ Security edge cases (malicious inputs, similar UIDs)

### League Management Tests (`league-management.test.js`)
- ✅ League code generation (5 chars, no ambiguous characters)
- ✅ League invite URL creation and parsing
- ✅ League code validation
- ✅ Leaderboard calculation and ranking
- ✅ URL parameter handling
- ✅ Edge cases (long codes, malformed URLs)

## 🚀 Running Tests

### Prerequisites
```bash
cd tests
npm install
```

### Run All Tests
```bash
npm test
```

### Run with Coverage
```bash
npm run test:coverage
```

### Watch Mode (auto-rerun on changes)
```bash
npm run test:watch
```

### Run Specific Test File
```bash
npx jest core-logic.test.js
npx jest admin-auth.test.js
npx jest league-management.test.js
```

## 📊 Expected Test Results

**Total Tests:** 60+

**Test Breakdown:**
- Core Logic: ~30 tests
- Admin & Auth: ~15 tests
- League Management: ~20 tests

**Expected Coverage:**
- Statements: >90%
- Branches: >85%
- Functions: >90%
- Lines: >90%

## 🧪 Test Categories

### Unit Tests
- Pure function testing (scoring, seeding, validation)
- No external dependencies
- Fast execution (<100ms per test)

### Integration Tests
- Multi-function workflows
- Data flow validation
- State management

### Edge Case Tests
- Null/undefined handling
- Invalid inputs
- Boundary conditions
- Security vulnerabilities

## 📝 Test Patterns

### Scoring Tests
```javascript
const playerData = { phase1: {...}, phase2: {...} };
const results = { groups: {...}, bracket: {...} };
const score = calcScore(playerData, results);
expect(score.total).toBe(expectedTotal);
```

### Admin Tests
```javascript
const user = new MockUser(uid, email, displayName, photoURL);
expect(shouldShowAdminTab(user)).toBe(true/false);
```

### League Tests
```javascript
const code = generateLeagueCode();
const link = createInviteLink(code);
const extracted = getLeagueCodeFromURL(link);
expect(extracted).toBe(code);
```

## 🔧 Maintenance

### Adding New Tests
1. Identify the functionality to test
2. Add tests to appropriate file or create new file
3. Follow existing test patterns
4. Update this README with new test count

### Updating Tests After Code Changes
1. Run tests after any index.html changes
2. Update mock functions if APIs change
3. Ensure all tests pass before deployment

## 📈 CI/CD Integration

Tests can be integrated into GitHub Actions:
```yaml
- name: Run Tests
  run: |
    cd tests
    npm install
    npm test
```

## 🐛 Known Limitations

- **Firebase Mocking:** Tests use mock functions, not actual Firebase
- **DOM Testing:** Limited DOM manipulation tests (requires jsdom setup)
- **Async Operations:** Some Firebase async operations not fully tested
- **UI Tests:** No automated UI/visual regression tests

## 🎯 Future Test Additions

- [ ] E2E tests with Playwright/Cypress
- [ ] Visual regression tests
- [ ] Performance/load tests
- [ ] Firebase Security Rules tests
- [ ] Mobile responsiveness tests
- [ ] Accessibility (a11y) tests

## 📚 References

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Testing Best Practices](https://testingjavascript.com/)
- [Firebase Testing Guide](https://firebase.google.com/docs/rules/unit-tests)

---

**Last Updated:** June 10, 2026  
**Test Coverage:** 60+ tests across 3 suites  
**Status:** ✅ All tests passing
