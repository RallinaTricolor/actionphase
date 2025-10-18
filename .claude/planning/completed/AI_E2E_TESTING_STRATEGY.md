# AI-Friendly E2E Testing Strategy

**Purpose**: Define patterns and practices that make E2E testing effective when working with AI assistants like Claude Code.

**Problem**: E2E tests have long feedback loops, complex async behaviors, and limited debugging visibility - all challenging for AI-driven development.

---

## Current Pain Points (Observed)

### 1. **Long Feedback Loops**
- E2E tests take 20-30+ seconds to run
- AI cannot see progress in real-time
- Difficult to know when tests complete without blocking
- Multiple test runs waste significant time

### 2. **Limited Debugging Visibility**
- Cannot view browser console logs directly
- Screenshots require opening in external apps
- Network requests/responses are invisible
- React component state is opaque

### 3. **Async Execution Challenges**
- Tests run in background with `&`
- No clear signal when tests complete
- Output gets mixed with other logs
- Hard to correlate failures with code changes

### 4. **Complex Browser Interactions**
- `.fill()` vs `.pressSequentially()` behave differently
- Event triggering is unpredictable
- React state updates are async
- Timing issues are hard to diagnose

### 5. **Multi-System Coordination**
- Frontend (Vite), backend (Go), database (PostgreSQL), browser (Chromium)
- All must be in sync and running
- State can drift between systems
- Cache invalidation is unclear

---

## Strategic Solutions

### Phase 1: Pre-E2E Verification (CRITICAL)

**Principle**: Never write E2E tests until lower-level tests pass.

#### 1.1 Unit Test First (Backend)
```bash
# ALWAYS run before E2E
SKIP_DB_TESTS=true go test ./pkg/db/services -v -run TestSpecificFeature
```

**AI Action**: Before writing E2E test, verify:
- Backend unit tests exist and pass
- Service layer logic is correct
- Data structures match expectations

#### 1.2 Component Test First (Frontend)
```bash
# ALWAYS run before E2E
npm test -- ComponentName.test.tsx
```

**AI Action**: Before writing E2E test, verify:
- Component renders correctly
- User interactions work (click, type, etc.)
- Props flow correctly

#### 1.3 Integration Test (API)
```bash
# Test API endpoint directly
curl -X POST http://localhost:3000/api/v1/... | jq '.'
```

**AI Action**: Before writing E2E test, verify:
- API returns expected data structure
- mentioned_character_ids is in response
- Authentication works
- Data persists to database

**RULE**: Only write E2E tests after all three levels pass.

---

### Phase 2: E2E Test Structure

#### 2.1 One Concern Per Test
```typescript
// ❌ BAD: Tests multiple things
test('mentions work', async () => {
  // ... autocomplete
  // ... submission
  // ... rendering
  // ... markdown
});

// ✅ GOOD: Tests one thing
test('autocomplete shows all game characters when typing @', async () => {
  await textarea.pressSequentially('@');
  await expect(autocomplete).toBeVisible();
  await expect(autocomplete).toContainText('Character 1');
});

test('submitted mentions are highlighted in rendered comment', async () => {
  // Assumes comment with mention already exists (from fixture or prior test)
  await expect(page.locator('mark[data-mention-id]')).toBeVisible();
});
```

**Why**: Single failures are easier to diagnose. AI can fix one thing at a time.

#### 2.2 Explicit Waits (Not Timeouts)
```typescript
// ❌ BAD: Arbitrary timeout
await page.waitForTimeout(3000);

// ✅ GOOD: Wait for specific condition
await page.waitForSelector('mark[data-mention-id]', { state: 'visible' });
await page.waitForResponse(resp => resp.url().includes('/comments'));
```

**Why**: Tests are faster and more reliable. AI can understand what's being waited for.

#### 2.3 Descriptive Selectors
```typescript
// ❌ BAD: Generic selector
const button = page.locator('button').first();

// ✅ GOOD: Semantic selector with data-testid
const submitButton = page.locator('[data-testid="comment-submit-button"]');
const mentionedChar = page.locator('[data-mention-id="123"]');
```

**Why**: AI can understand intent. Easier to debug when selectors fail.

---

### Phase 3: AI-Optimized Test Execution

#### 3.1 Synchronous Test Running
```bash
# ❌ BAD: Background execution
npx playwright test e2e/feature.spec.ts &

# ✅ GOOD: Foreground with timeout and output capture
npx playwright test e2e/feature.spec.ts --reporter=list 2>&1 | tee /tmp/e2e-output.log
```

**AI Action**:
1. Run test in foreground (blocking)
2. Capture output to file
3. Check file immediately after test completes
4. Parse failures from structured output

#### 3.2 Targeted Test Execution
```bash
# ❌ BAD: Run all tests on every change
npx playwright test

# ✅ GOOD: Run specific test
npx playwright test e2e/mentions.spec.ts -g "should highlight mentions"

# ✅ BETTER: Run one test until it passes
npx playwright test e2e/mentions.spec.ts -g "should highlight mentions" --max-failures=1
```

**Why**: Faster feedback. AI can iterate on one failing test.

#### 3.3 Pre-Test System Verification
```bash
#!/bin/bash
# verify-e2e-ready.sh

# Check backend
curl -sf http://localhost:3000/health > /dev/null || {
  echo "❌ Backend not running"
  exit 1
}

# Check frontend
curl -sf http://localhost:5173 > /dev/null || {
  echo "❌ Frontend not running"
  exit 1
}

# Check database
psql "postgres://postgres:example@localhost:5432/actionphase?sslmode=disable" -c "SELECT 1" > /dev/null || {
  echo "❌ Database not accessible"
  exit 1
}

echo "✅ All systems ready for E2E tests"
```

**AI Action**: Always run this before E2E tests.

---

### Phase 4: Debugging Workflows

#### 4.1 Console Log Capture
```typescript
// In test setup
page.on('console', msg => {
  if (msg.type() === 'error') {
    console.log(`BROWSER ERROR: ${msg.text()}`);
  }
});

page.on('pageerror', error => {
  console.log(`PAGE ERROR: ${error.message}`);
});
```

**Why**: AI can see browser errors without opening DevTools.

#### 4.2 Network Request Logging
```typescript
page.on('response', response => {
  if (response.url().includes('/api/')) {
    console.log(`API: ${response.status()} ${response.url()}`);
  }
});

// Or for specific requests
const response = await page.waitForResponse(resp =>
  resp.url().includes('/comments') && resp.status() === 201
);
const data = await response.json();
console.log('Comment created:', data);
```

**Why**: AI can verify API responses match expectations.

#### 4.3 Screenshot on Failure (Auto)
```typescript
// playwright.config.ts
export default defineConfig({
  use: {
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
});
```

**AI Action**: After test failure, check for screenshot path in output and use Read tool to view it.

#### 4.4 Component State Inspection
```typescript
// Get component props/state
const mentionedIds = await page.evaluate(() => {
  const comment = document.querySelector('[data-testid="comment"]');
  return comment?.__reactProps$?.mentionedCharacterIds;
});
console.log('Mentioned IDs:', mentionedIds);
```

**Why**: AI can verify data is flowing through React components.

---

### Phase 5: Test Data Management

#### 5.1 Deterministic Fixtures
```sql
-- ❌ BAD: Random or generated IDs
INSERT INTO characters (id, name, game_id)
VALUES (gen_random_uuid(), 'Test Character', 164);

-- ✅ GOOD: Fixed IDs
INSERT INTO characters (id, name, game_id)
VALUES (1000, 'Test Player 1 Character', 164);
```

**Why**: AI can reference exact IDs in tests. Failures are reproducible.

#### 5.2 Minimal Test Data
```typescript
// ❌ BAD: Relies on complex fixture setup
test('mentions work', async () => {
  // Depends on Game #164 with Phase #1440 with 3 specific characters...
});

// ✅ GOOD: Creates own test data
test('mentions work', async () => {
  const { gameId, characterId } = await setupTestGame();
  // ...
});
```

**Why**: Tests are isolated. Fixture changes don't break tests.

#### 5.3 Test Data Documentation
```typescript
/**
 * Test Fixture: Game #164 (E2E Common Room Test Game)
 * - GM: test_gm@example.com (User ID: 1)
 * - Players: test_player1@example.com (User ID: 2), test_player2@example.com (User ID: 3)
 * - Characters:
 *   - GM Test Character (ID: 1200, User: 1)
 *   - Test Player 1 Character (ID: 1201, User: 2)
 *   - Test Player 2 Character (ID: 1202, User: 3)
 * - Active Phase: "Common Room Discussion" (ID: 1440)
 */
```

**Why**: AI knows what data exists without querying database.

---

### Phase 6: Progressive E2E Development

#### 6.1 Manual Test First
```markdown
## Manual Test Checklist
Before writing E2E test:

1. [ ] Open http://localhost:5173
2. [ ] Login as test_player1@example.com / testpassword123
3. [ ] Navigate to Game #164 → Common Room
4. [ ] Type "@" in comment box
5. [ ] Verify autocomplete appears with all 3 characters
6. [ ] Select "Test Player 2 Character"
7. [ ] Submit comment
8. [ ] Verify "@Test Player 2 Character" is highlighted in blue

If ANY step fails, fix before writing E2E test.
```

**AI Action**: Ask user to perform manual test first, or use component/integration tests to verify.

#### 6.2 Incremental Test Writing
```typescript
// Step 1: Just navigation
test('can navigate to common room', async () => {
  await page.goto(`http://localhost:5173/games/${gameId}/common-room`);
  await expect(page.locator('h1')).toContainText('Common Room');
});

// Step 2: Add interaction (once Step 1 passes)
test('can type in comment box', async () => {
  await page.goto(...);
  const textarea = page.locator('textarea');
  await textarea.fill('Test message');
  await expect(textarea).toHaveValue('Test message');
});

// Step 3: Add autocomplete (once Step 2 passes)
test('autocomplete appears when typing @', async () => {
  // ...
});
```

**Why**: Each step builds on previous. Failures are localized.

---

### Phase 7: AI Workflow Integration

#### 7.1 Test Status Checks
```bash
# Before making code changes
just test-e2e-status() {
  echo "🧪 Checking E2E test status..."
  npx playwright test --reporter=json > /tmp/test-status.json
  jq '.stats' /tmp/test-status.json
}
```

**AI Action**: Run this before starting work to know baseline.

#### 7.2 Test-Driven E2E Development
```markdown
## AI TDD Workflow for E2E

1. **Write failing test** (red)
   - Describe expected behavior in test
   - Run test, verify it fails for RIGHT reason

2. **Implement feature** (green)
   - Backend: API endpoint + tests
   - Frontend: Component + tests
   - Integration: Manual API test

3. **Run E2E test** (validate)
   - Should pass now
   - If not, debug with targeted tests

4. **Refactor** (if needed)
   - E2E test stays green throughout
```

#### 7.3 Continuous Verification
```bash
# After each code change
verify-change() {
  echo "1. Running unit tests..."
  just test-mocks || return 1

  echo "2. Checking TypeScript..."
  npx tsc --noEmit || return 1

  echo "3. Testing API..."
  curl -sf http://localhost:3000/api/v1/... || return 1

  echo "4. Running E2E..."
  npx playwright test --grep "critical path" || return 1
}
```

**AI Action**: Run after each significant change.

---

## Implementation Checklist

### Immediate Actions
- [ ] Create `verify-e2e-ready.sh` script
- [ ] Add console/network logging to test setup
- [ ] Document all test fixtures with IDs
- [ ] Add data-testid attributes to components
- [ ] Create manual test checklists for complex features

### Short Term
- [ ] Refactor existing E2E tests to one-concern-per-test
- [ ] Add pre-test verification to CI
- [ ] Create E2E test templates
- [ ] Document common failure patterns

### Long Term
- [ ] Build test data factories for deterministic setup
- [ ] Create visual regression testing (screenshot comparison)
- [ ] Implement E2E test impact analysis (which tests cover which code)

---

## Success Metrics

**For AI Development:**
- ✅ E2E test failures can be diagnosed in <2 iterations
- ✅ New E2E tests pass on first run >80% of the time
- ✅ Zero "mystery failures" requiring manual investigation

**For Team:**
- ✅ E2E tests complete in <30 seconds
- ✅ Flaky test rate <5%
- ✅ Clear ownership: unit → integration → E2E test pyramid

---

## Current Status (2025-10-18)

### What Works
- ✅ Test fixtures with fixed IDs
- ✅ Separate test database
- ✅ Playwright configuration
- ✅ Test isolation (each test resets fixtures)

### What Needs Work
- ❌ Tests running in background make debugging hard
- ❌ No pre-test system verification
- ❌ Limited console/network logging
- ❌ Tests are too broad (multiple concerns)
- ❌ No data-testid attributes on components

### Immediate Priority
1. Fix current mention rendering test (3 failing)
2. Add data-testid to CommentEditor, CharacterAutocomplete
3. Create verify-e2e-ready.sh
4. Split multi-concern tests into focused tests

---

## Example: Good E2E Test

```typescript
import { test, expect } from '@playwright/test';
import { TEST_FIXTURES } from './fixtures';

test.describe('Character Mentions - Autocomplete', () => {
  test.beforeEach(async ({ page }) => {
    // Setup logging
    page.on('console', msg => console.log(`BROWSER: ${msg.text()}`));
    page.on('pageerror', err => console.log(`ERROR: ${err.message}`));

    // Login and navigate
    await page.goto('http://localhost:5173');
    await page.fill('[data-testid="email-input"]', TEST_FIXTURES.PLAYER1.email);
    await page.fill('[data-testid="password-input"]', TEST_FIXTURES.PLAYER1.password);
    await page.click('[data-testid="login-button"]');
    await page.waitForURL(/\/games/);

    // Navigate to test game common room
    await page.goto(`http://localhost:5173/games/${TEST_FIXTURES.GAME_164.id}/common-room`);
    await page.waitForSelector('[data-testid="common-room-loaded"]');
  });

  test('shows autocomplete when typing @ character', async ({ page }) => {
    const textarea = page.locator('[data-testid="comment-textarea"]');
    await textarea.click();
    await textarea.pressSequentially('@');

    // Wait for autocomplete to appear
    const autocomplete = page.locator('[data-testid="character-autocomplete"]');
    await expect(autocomplete).toBeVisible({ timeout: 2000 });
  });

  test('autocomplete shows all game characters', async ({ page }) => {
    // Assumes autocomplete is visible (from previous test or fixture)
    const autocomplete = page.locator('[data-testid="character-autocomplete"]');

    // Verify specific characters appear
    await expect(autocomplete).toContainText(TEST_FIXTURES.GAME_164.characters[0].name);
    await expect(autocomplete).toContainText(TEST_FIXTURES.GAME_164.characters[1].name);
    await expect(autocomplete).toContainText(TEST_FIXTURES.GAME_164.characters[2].name);
  });

  test('filters autocomplete when typing character name', async ({ page }) => {
    const textarea = page.locator('[data-testid="comment-textarea"]');
    await textarea.pressSequentially('@Test Player 1');

    const autocomplete = page.locator('[data-testid="character-autocomplete"]');

    // Should show Player 1
    await expect(autocomplete).toContainText('Test Player 1 Character');

    // Should NOT show Player 2
    const player2Option = autocomplete.locator('text=Test Player 2 Character');
    await expect(player2Option).not.toBeVisible();
  });
});
```

**Why This Works:**
- ✅ One concern per test
- ✅ Explicit data-testid selectors
- ✅ Console logging enabled
- ✅ Documents assumptions (comments)
- ✅ Uses constants for test data
- ✅ Short and focused

---

## Conclusion

E2E testing with AI requires:
1. **Verification before testing**: Unit → Integration → E2E
2. **Focused tests**: One concern, explicit waits, semantic selectors
3. **Debugging visibility**: Logs, network capture, state inspection
4. **Deterministic data**: Fixed IDs, documented fixtures
5. **Incremental development**: Build tests step-by-step

**Key Insight**: The problem isn't E2E tests themselves - it's trying to write E2E tests before lower levels are verified. AI works best with tight feedback loops. E2E tests have long feedback loops, so they should be the LAST step, not the first.
