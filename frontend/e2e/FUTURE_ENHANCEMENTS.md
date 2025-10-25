# E2E Testing - Future Enhancements

**Roadmap for scaling and improving the E2E testing framework.**

Last Updated: 2025-10-24

---

## Overview

The E2E testing framework is **production-ready** with solid foundations:
- ✅ 26 tests covering critical paths
- ✅ Test data factory and fixtures
- ✅ Page Object Model
- ✅ Comprehensive documentation

This document tracks **future enhancements** to expand coverage, improve efficiency, and add advanced features.

---

## ✅ Priority 1: Essential Coverage - **COMPLETE** (October 24, 2025)

### 1.1 Additional Journey Tests ✅

**Character Management Journey** ✅
- **Why**: Characters are core to gameplay
- **Tests implemented**:
  - ✅ Player creates character (name, playbook, traits)
  - ✅ Player edits character sheet
  - ✅ GM creates NPC
  - ✅ Character progression/updates during game
  - ✅ Character death/retirement flow
- **File**: `frontend/e2e/journeys/standard/character-management.spec.ts`
- **Actual**: 5 tests, ~2 hours ✅

**Conversation/Messaging Journey** ✅
- **Why**: Communication is critical for collaboration
- **Tests implemented**:
  - ✅ Player sends private message to GM
  - ✅ GM broadcasts message to all players
  - ✅ Player creates new conversation thread
  - ✅ Player replies to existing thread
  - ✅ Notification on new message
- **File**: `frontend/e2e/journeys/standard/messaging.spec.ts`
- **Actual**: 5 tests, ~2 hours ✅

**Game State Transitions** ✅
- **Why**: State management is complex and error-prone
- **Tests implemented**:
  - ✅ GM transitions: setup → recruitment
  - ✅ GM transitions: recruitment → character_creation
  - ✅ GM transitions: character_creation → in_progress
  - ✅ GM pauses active game
  - ✅ GM resumes paused game
  - ✅ GM completes finished game
  - ✅ GM cancels game in recruitment
- **File**: `frontend/e2e/journeys/standard/game-state-transitions.spec.ts`
- **Actual**: 7 tests, ~3 hours ✅

### 1.2 Missing Page Objects ✅

**PostPage** ✅ (Game posts/timeline):
- ✅ `goto(gameId)`, `waitForPostsToLoad()`, `getPosts()`
- ✅ `showComments()`, `createComment()`, `getComments()`
- ✅ `getCommentCount()`, `hasUnreadComments()`
- ✅ `getPostAuthorCharacter()`, `isCurrentUserAuthor()`
- **File**: `frontend/e2e/pages/PostPage.ts` (180 lines)

**ConversationPage** ✅ (Messaging):
- ✅ `goto(gameId)`, `waitForConversationsToLoad()`
- ✅ `getConversationTitles()`, `selectConversation()`
- ✅ `sendMessage()`, `getMessages()`, `getMessageCount()`
- ✅ `hasUnreadBadge()`, `markAsRead()`
- **File**: `frontend/e2e/pages/ConversationPage.ts` (210 lines)

**NotificationsPage** ✅:
- ✅ `goto()`, `getNotifications()`, `getNotificationCount()`
- ✅ `markAllAsRead()`, `clickNotification()`
- ✅ `openNotificationDropdown()`, `hasUnreadNotifications()`
- ✅ `getUnreadCountFromBell()`, `backToDashboard()`
- **File**: `frontend/e2e/pages/NotificationsPage.ts` (190 lines)

**Total Implementation**: 3 Page Objects (580 lines), 17 tests (820 lines), ~12 hours ✅

---

## Priority 2: Visual Regression Testing (Next 1-2 months)

### 2.1 Tool Selection

**Option A: Playwright Screenshots (Recommended)**
- **Pros**: Built-in, no external service, free
- **Cons**: Manual baseline management
- **Setup**: ~2 hours
- **Cost**: Free

**Option B: Percy.io**
- **Pros**: Automated diff management, PR integration, cloud storage
- **Cons**: Paid service ($299/mo for team)
- **Setup**: ~4 hours (includes CI integration)
- **Cost**: $299/month

**Option C: Chromatic (Storybook)**
- **Pros**: Component-level testing, great for design systems
- **Cons**: Requires Storybook setup
- **Setup**: ~8 hours (Storybook + Chromatic)
- **Cost**: $149/month

**Recommendation**: Start with **Playwright Screenshots** (free), migrate to Percy if visual regressions become frequent.

### 2.2 Visual Test Implementation

**Phase 1: Critical Pages** (~4 hours)
- Home page (light + dark mode)
- Login/Registration forms
- Game details page
- Dashboard
- Settings page

**Phase 2: Component Variations** (~6 hours)
- Buttons (all variants: primary, secondary, danger, ghost)
- Cards (default, elevated, bordered)
- Forms (inputs, textareas, selects with errors)
- Modals (all modal types)
- Alerts (info, success, warning, danger)

**Phase 3: Complex Layouts** (~8 hours)
- Game page with all tabs
- Character sheet
- Phase history view
- Admin dashboard
- Threaded conversations

**Implementation Pattern**:
```typescript
test('Visual: Game details page', async ({ page }) => {
  await page.goto('/games/123');
  await page.waitForLoadState('networkidle');

  // Take screenshot
  await expect(page).toHaveScreenshot('game-details.png', {
    fullPage: true,
    maxDiffPixels: 100,
  });
});
```

**Total Estimated Time**: 18 hours across 3 phases

### 2.3 Visual Regression CI Integration

- Configure baseline screenshot storage
- Set up GitHub Actions workflow
- Define acceptable diff thresholds
- Create PR comment integration
- Document baseline update process

**Estimated**: 4 hours

---

## Priority 3: Performance & Reliability (Ongoing)

### 3.1 Performance Testing

**Load Time Benchmarks**:
```typescript
test('Performance: Game list loads in <2s', async ({ page }) => {
  const startTime = Date.now();
  await page.goto('/games');
  await page.waitForLoadState('networkidle');
  const loadTime = Date.now() - startTime;

  expect(loadTime).toBeLessThan(2000);
  console.log(`Game list loaded in ${loadTime}ms`);
});
```

**Tests to add**:
- Home page load time < 1s
- Game details load time < 2s
- Dashboard load time < 2s
- Character sheet load time < 1.5s
- Search results < 1s

**Estimated**: 5 tests, ~2 hours

### 3.2 Flaky Test Detection

**Track flaky tests**:
- Tag with `@flaky` when discovered
- Run 10 times to confirm flakiness
- Document repro steps
- Fix or quarantine

**Process**:
1. Identify flaky test (fails <10% of time)
2. Add `@flaky` tag
3. Investigate root cause (race condition, timing, test data)
4. Fix or document as known issue
5. Remove tag once stable

### 3.3 Test Parallelization

**Current**: Tests run sequentially
**Goal**: Parallel execution for faster CI

**Implementation**:
```typescript
// playwright.config.ts
export default defineConfig({
  workers: 4, // Run 4 tests in parallel
  fullyParallel: true,
});
```

**Challenges**:
- Database state conflicts (need test isolation)
- Shared test fixtures (need per-worker cleanup)
- Resource contention (browser instances)

**Solution**: Database per worker or test transactions

**Estimated**: 8 hours to implement properly

---

## Priority 4: Advanced Testing Features (Future)

### 4.1 API Contract Testing

**Why**: Ensure frontend/backend contracts stay in sync

**Approach**:
- Use Playwright's `request` fixture
- Test API responses match expected schemas
- Validate error handling
- Check authentication flows

**Example**:
```typescript
test('API: Games endpoint returns valid schema', async ({ request }) => {
  const response = await request.get('/api/v1/games');
  expect(response.status()).toBe(200);

  const games = await response.json();
  expect(games).toHaveProperty('data');
  expect(games.data[0]).toHaveProperty('id');
  expect(games.data[0]).toHaveProperty('title');
});
```

**Estimated**: 15 tests, ~6 hours

### 4.2 Accessibility Testing

**Why**: Ensure application is accessible to all users

**Tools**:
- `@axe-core/playwright` for automated a11y checks
- Manual keyboard navigation tests
- Screen reader testing (manual)

**Tests to add**:
- All pages pass axe-core audit
- All interactive elements are keyboard-accessible
- Form validation errors are announced
- Focus management in modals
- ARIA labels on buttons

**Estimated**: 10 hours initial implementation, 2 hours per new feature

### 4.3 Mobile/Responsive Testing

**Why**: Application should work on all screen sizes

**Devices to test**:
- Mobile (375x667 - iPhone SE)
- Tablet (768x1024 - iPad)
- Desktop (1920x1080)

**Tests**:
- Navigation menu adapts to mobile
- Forms are usable on small screens
- Modals don't overflow
- Tables scroll horizontally
- Touch targets are adequate (44x44px minimum)

**Implementation**:
```typescript
test('Mobile: Navigation menu works', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto('/');

  // Test hamburger menu
  const menuButton = page.locator('[data-testid="mobile-menu"]');
  await expect(menuButton).toBeVisible();
  await menuButton.click();

  // Verify menu opens
  await expect(page.locator('nav')).toBeVisible();
});
```

**Estimated**: 8 tests, ~4 hours

### 4.4 Cross-Browser Testing

**Current**: Only Chromium tested
**Goal**: Test Firefox and WebKit

**Implementation**:
```typescript
// playwright.config.ts
export default defineConfig({
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
});
```

**Estimated**: 2 hours setup, ~10% longer test runs

### 4.5 Test Data Management

**Database Snapshots**:
- Create snapshots of known-good test data
- Restore before test runs
- Faster than running SQL fixtures

**Test Factories API**:
- Backend endpoint to create test data
- Faster than UI interactions
- More reliable test setup

**Example**:
```typescript
// Create game via API instead of UI
const { data: game } = await request.post('/api/test/games', {
  data: generateTestGame()
});

// Now test with the game
await page.goto(`/games/${game.id}`);
```

**Estimated**: 12 hours for comprehensive API

---

## Priority 5: Developer Experience (Ongoing)

### 5.1 Test Recording & Playback

**Goal**: Make it easy to create tests from user interactions

**Tools**:
- Playwright Codegen (already available)
- Custom test generator scripts

**Usage**:
```bash
npx playwright codegen http://localhost:5173
# Record actions, generate test code
```

### 5.2 Test Debugging Improvements

**Enhance debugging experience**:
- Better console logging with timestamps
- Screenshot on every action (debug mode)
- Automatic video recording on failure
- Trace viewer for failed tests

### 5.3 CI/CD Integration

**GitHub Actions Workflow**:
- Run smoke tests on every PR
- Run critical tests before merge
- Run full suite nightly
- Comment on PRs with test results
- Upload artifacts (screenshots, videos, traces)

**Example workflow**:
```yaml
name: E2E Tests
on: [pull_request]
jobs:
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: npm install
      - run: npx playwright install chromium
      - run: npm run test:e2e:critical
      - uses: actions/upload-artifact@v3
        if: failure()
        with:
          name: test-results
          path: test-results/
```

**Estimated**: 4 hours setup

---

## Maintenance Tasks

### Regular Reviews (Monthly)

**Coverage Review**:
- Identify untested features
- Prioritize new tests based on risk
- Remove obsolete tests

**Flaky Test Review**:
- Analyze failure patterns
- Fix or document root causes
- Update timeouts/waits as needed

**Performance Review**:
- Check test execution time trends
- Optimize slow tests
- Add/remove parallelization

### Test Data Health (Weekly)

**Verify test fixtures**:
- All test users exist
- All test games are in expected states
- Database migrations don't break fixtures
- Fixture data is realistic

**Cleanup**:
- Remove orphaned test data
- Reset E2E-specific games
- Clear old test user sessions

---

## Metrics to Track

**Test Reliability**:
- Pass rate (target: >95%)
- Flaky test count (target: <5%)
- Average execution time (track trends)

**Coverage**:
- Number of tests per category
- User journeys covered
- Critical paths tested

**Developer Impact**:
- Tests written per feature
- Time to debug test failures
- PR feedback from E2E tests

---

## Decision Log

### Why Playwright Over Cypress?

**Decision**: Use Playwright
**Date**: 2025-10-24
**Reasons**:
- Multi-browser support (Chromium, Firefox, WebKit)
- Better performance
- Native TypeScript support
- Built-in test fixtures
- Better debugging tools

### Why Page Object Model?

**Decision**: Use Page Object pattern
**Date**: 2025-10-24
**Reasons**:
- DRY - selectors defined once
- Maintainability - changes in one place
- Readability - test intent is clear
- Reusability - share across tests

### Why Not Percy Initially?

**Decision**: Defer Percy integration
**Date**: 2025-10-24
**Reasons**:
- Cost ($299/mo)
- Playwright screenshots are sufficient for now
- Can add later when visual regressions become frequent
- Need to stabilize UI first

---

## Getting Started with Enhancements

### For New Contributors

1. **Read** `e2e/README.md` first
2. **Pick** a Priority 1 enhancement
3. **Write** the test following existing patterns
4. **Tag** appropriately (@smoke, @critical, etc.)
5. **Document** any new Page Objects or helpers

### For Maintainers

1. **Review** this document quarterly
2. **Update** priorities based on production issues
3. **Track** metrics in a dashboard
4. **Share** learnings with the team

---

## Resources

**Playwright Documentation**:
- https://playwright.dev/docs/intro
- https://playwright.dev/docs/test-assertions
- https://playwright.dev/docs/test-advanced

**Visual Testing**:
- https://playwright.dev/docs/test-snapshots
- https://percy.io/
- https://www.chromatic.com/

**Performance**:
- https://playwright.dev/docs/test-timeouts
- https://playwright.dev/docs/test-parallel

**Best Practices**:
- https://playwright.dev/docs/best-practices
- `.claude/context/TESTING.md`

---

## Questions?

For questions about E2E testing enhancements, see:
- `frontend/e2e/README.md` - Complete testing guide
- `.claude/planning/E2E_TESTING_PLAN.md` - Original implementation plan
- `.claude/context/TESTING.md` - Testing philosophy
