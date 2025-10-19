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

#### 5.2 Fixtures for Infrastructure, Dynamic Creation for Content

**Pattern**: Use fixtures for stable infrastructure, create test-specific content dynamically.

```typescript
// ✅ GOOD: Use fixture for infrastructure
test('mentions work', async () => {
  const gameId = 164; // From fixture - Game #164 has characters and active phase

  // Create test-specific content dynamically
  const postContent = `Test Post ${Date.now()}`;
  await gmPage.fill('textarea#content', postContent);
  await gmPage.click('button:has-text("Create GM Post")');

  // Now interact with YOUR post
  await expect(page.locator(`text=${postContent}`)).toBeVisible();
});

// ❌ BAD: Creating entire game infrastructure per test
test('mentions work', async () => {
  const { gameId, characterId } = await createGame();
  await createPhase(gameId);
  await createCharacters(gameId);
  // Too slow, too complex, hard to debug
});
```

**Fixtures Should Provide**:
- ✅ Users (test_player1@example.com, etc.)
- ✅ Games with specific states (recruiting, in_progress, completed)
- ✅ Characters for test users
- ✅ Active phases (but **published = true** to avoid UI filtering issues)
- ✅ Pre-existing state data (draft actions, applications)

**Tests Should Create**:
- ✅ Posts/messages with unique timestamps (`${Date.now()}`)
- ✅ Comments/replies specific to the test
- ✅ Any content that needs to be uniquely identified

**Why**:
- Fixtures are reliable once configured correctly
- Dynamic creation makes tests independent (no pollution)
- Unique content (timestamps) enables specific assertions
- Matches established codebase pattern (see `action-submission-flow.spec.ts`)

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
- ✅ Dynamic content creation pattern (posts with `${Date.now()}`)
- ✅ Multi-context pattern for user interactions

### Lessons Learned (October 2025)

**Problem**: 3 E2E tests failing (avatar, autocomplete, notification)
**Root Causes Found**:
1. **Fixture misconfiguration**: `is_published = false` on common_room phase prevented posts from showing in UI
2. **Test pattern mismatch**: Tests were trying to use static fixture posts instead of creating dynamic content
3. **Real-time dependencies**: Notification test relied on 15-second polling intervals (too slow for E2E)

**Solutions Applied**:
1. ✅ Fixed fixture: Set `is_published = true` on phases
2. ✅ Adopted dynamic creation: GM creates post during test with unique timestamp
3. ✅ Used multi-context pattern: Separate browser contexts for GM and Player
4. ✅ Simplified notification test: Test UI interaction instead of real-time polling
5. ✅ Removed fixture post: Tests create their own content, fixture provides only infrastructure

**Key Insight**:
- **Fixtures ARE reliable** - the issue was a config bug, not fixture unreliability
- **Dynamic creation is still best** for content-heavy tests (matches existing codebase pattern)
- **Test the UI, not the backend** - E2E tests should focus on browser interactions, not real-time server behaviors

### Common Pitfalls to Avoid

1. **Modal Overlays Blocking Clicks**
   - ❌ Problem: Modals don't close properly, blocking subsequent clicks
   - ✅ Solution: Reload page after complex interactions OR use explicit close button clicks

2. **Published State Filtering**
   - ❌ Problem: `is_published = false` on phases hides content in UI
   - ✅ Solution: Always set `is_published = true` in test fixtures

3. **Hardcoding Game IDs**
   - ✅ Acceptable: `const gameId = 164;` when using dedicated test fixture
   - ❌ Bad: Using production game IDs that might change

4. **Waiting for Real-Time Updates**
   - ❌ Problem: Polling intervals (15s) cause test timeouts
   - ✅ Solution: Reload page to check state OR test only UI components

### What Still Needs Work
- ❌ Tests running in background make debugging hard
- ❌ No pre-test system verification
- ❌ Limited console/network logging
- ❌ Some tests are too broad (multiple concerns)
- ❌ Inconsistent use of data-testid attributes

---

## Example: Good E2E Test (Updated Pattern)

```typescript
import { test, expect } from '@playwright/test';
import { loginAs } from './fixtures/auth-helpers';

test.describe('Character Mentions - Autocomplete', () => {
  test('shows autocomplete when typing @ in comment', async ({ browser }) => {
    const gameId = 164; // Fixture provides Game #164 with characters and active phase

    const gmContext = await browser.newContext();
    const playerContext = await browser.newContext();

    const gmPage = await gmContext.newPage();
    const playerPage = await playerContext.newPage();

    try {
      // Setup logging
      playerPage.on('console', msg => console.log(`BROWSER: ${msg.text()}`));
      playerPage.on('pageerror', err => console.log(`ERROR: ${err.message}`));

      // GM creates a post (dynamic content with unique timestamp)
      await loginAs(gmPage, 'GM');
      await gmPage.goto(`/games/${gameId}`);
      await gmPage.waitForLoadState('networkidle');
      await gmPage.click('button:has-text("Common Room")');

      const postContent = `Mission Brief ${Date.now()}`;
      await gmPage.fill('textarea#content', postContent);
      await gmPage.click('button:has-text("Create GM Post")');
      await expect(gmPage.locator(`text=${postContent}`)).toBeVisible();

      // Player views post and adds comment
      await loginAs(playerPage, 'PLAYER_1');
      await playerPage.goto(`/games/${gameId}`);
      await playerPage.waitForLoadState('networkidle');
      await playerPage.click('button:has-text("Common Room")');
      await expect(playerPage.locator(`text=${postContent}`)).toBeVisible();

      // Open comment form
      const postCard = playerPage.locator(`div:has-text("${postContent}")`).first();
      await postCard.locator('button:has-text("Add Comment")').click();

      // Type @ to trigger autocomplete
      const textarea = postCard.locator('textarea[placeholder*="Write a comment"]');
      await textarea.click();
      await textarea.pressSequentially('@');

      // Verify autocomplete appears with characters
      const autocomplete = playerPage.locator('[role="listbox"]');
      await expect(autocomplete).toBeVisible({ timeout: 2000 });
      await expect(autocomplete).toContainText('Test Player 1 Character');
      await expect(autocomplete).toContainText('Test Player 2 Character');
      await expect(autocomplete).toContainText('GM Test Character');

    } finally {
      await gmContext.close();
      await playerContext.close();
    }
  });
});
```

**Why This Works:**
- ✅ Uses fixture for infrastructure (Game #164, characters, phase)
- ✅ Creates dynamic content per test (post with timestamp)
- ✅ Multi-context pattern (GM and Player in separate browsers)
- ✅ One focused concern (autocomplete visibility)
- ✅ Console logging enabled for debugging
- ✅ Explicit waits with timeouts
- ✅ Clean resource management (finally block)
- ✅ Uses semantic selectors (role="listbox")
- ✅ Verifies specific, expected content

---

## Conclusion

E2E testing with AI requires:
1. **Verification before testing**: Unit → Integration → E2E
2. **Focused tests**: One concern, explicit waits, semantic selectors
3. **Debugging visibility**: Logs, network capture, state inspection
4. **Deterministic data**: Fixed IDs, documented fixtures
5. **Incremental development**: Build tests step-by-step

**Key Insight**: The problem isn't E2E tests themselves - it's trying to write E2E tests before lower levels are verified. AI works best with tight feedback loops. E2E tests have long feedback loops, so they should be the LAST step, not the first.
