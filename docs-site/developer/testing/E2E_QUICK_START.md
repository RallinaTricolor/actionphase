# E2E Testing Quick Start Guide

**Quick Reference for ActionPhase E2E Testing**

---

## 🔑 Test Users

**IMPORTANT**: Usernames are **case-sensitive** and use PascalCase!

All test users have password: `testpassword123`

| Username | Email | Role |
|----------|-------|------|
| `TestGM` | `test_gm@example.com` | Game Master |
| `TestPlayer1` | `test_player1@example.com` | Player 1 |
| `TestPlayer2` | `test_player2@example.com` | Player 2 |
| `TestPlayer3` | `test_player3@example.com` | Player 3 |
| `TestPlayer4` | `test_player4@example.com` | Player 4 |
| `TestPlayer5` | `test_player5@example.com` | Player 5 |
| `TestAudience` | `test_audience@example.com` | Audience |

**Login Example**:
```typescript
await loginAs(page, 'GM');  // Uses TestGM username
await loginAs(page, 'PLAYER_1');  // Uses TestPlayer1 username
```

---

## 🚀 Getting Started (5 Minutes)

### Install Playwright

```bash
cd frontend
npm install -D @playwright/test
npx playwright install
```

### Run Your First E2E Test

```bash
# After implementing first test
npm run test:e2e

# Interactive UI mode
npm run test:e2e:ui

# Debug mode (step through)
npm run test:e2e:debug
```

---

## 📋 5 Critical User Journeys

**Priority 1 - Must Implement First**:

1. **User Registration & Login** (45s)
   - File: `e2e/auth/registration-and-login.spec.ts`
   - Users can register and log in

2. **GM Creates Game & Recruits** (120s)
   - File: `e2e/games/gm-creates-and-recruits.spec.ts`
   - GM creates game, player applies, GM approves

3. **Player Creates Character** (90s)
   - File: `e2e/gameplay/character-creation-flow.spec.ts`
   - Player creates character after being approved

4. **Phase-Action-Result Flow** (180s)
   - File: `e2e/gameplay/phase-action-result-flow.spec.ts`
   - GM creates phase, player submits action, GM publishes result

5. **Private Messages** (120s)
   - File: `e2e/messaging/private-messages-flow.spec.ts`
   - Players send messages to each other

**Total Time**: ~9 minutes

---

## 🏗️ Project Structure

```
frontend/
├── e2e/
│   ├── auth/
│   │   └── registration-and-login.spec.ts
│   ├── games/
│   │   └── gm-creates-and-recruits.spec.ts
│   ├── gameplay/
│   │   ├── character-creation-flow.spec.ts
│   │   └── phase-action-result-flow.spec.ts
│   ├── messaging/
│   │   └── private-messages-flow.spec.ts
│   ├── fixtures/
│   │   ├── auth-helpers.ts
│   │   └── game-helpers.ts
│   └── global-setup.ts
└── playwright.config.ts
```

---

## 📝 Test Template

```typescript
import { test, expect } from '@playwright/test';
import { loginAs } from '../fixtures/auth-helpers';

test.describe('Feature Name', () => {
  test('should accomplish user goal', async ({ page }) => {
    // 1. Setup - Login as test user
    await loginAs(page, 'PLAYER_1');

    // 2. Perform user actions
    await page.goto('/feature');
    await page.click('button:has-text("Action")');
    await page.fill('[name="field"]', 'value');
    await page.click('button[type="submit"]');

    // 3. Verify outcome
    await expect(page.locator('text=Success')).toBeVisible();
    await expect(page).toHaveURL('/expected/path');
  });
});
```

---

## 🗄️ Test Fixture Management

**⚠️ IMPORTANT: Tests automatically reset fixtures before running**

### Automatic Fixture Reset

Fixtures are automatically reset before each test run via global setup:

```bash
# Just run tests - fixtures reset automatically!
npm run test:e2e
```

The global setup script (`e2e/global-setup.ts`) runs `apply_all.sh` before tests start.

### Manual Fixture Reset

If you need to reset fixtures manually:

```bash
# From project root
./backend/pkg/db/test_fixtures/apply_all.sh
```

### Shared vs Dedicated Fixtures

**Shared Fixtures (READ-ONLY)**:
- Use for tests that only VIEW data
- Safe for parallel execution
- Examples: "The Heist at Goldstone Bank", "Shadows Over Innsmouth"

**Dedicated Fixtures (STATE-MODIFYING)**:
- Use for tests that CHANGE game state
- Reset automatically before each test run
- Examples:
  - `E2E_COMPLETE` → "E2E Test: Game to Complete"
  - `E2E_CANCEL` → "E2E Test: Game to Cancel"
  - `E2E_PAUSE` → "E2E Test: Game to Pause"
  - `E2E_ACTION` → "E2E Test: Action Submission"

### Looking Up Fixture Games

**Always use `getFixtureGameId()` - never hardcode IDs!**

```typescript
import { getFixtureGameId, FIXTURE_GAMES } from '../fixtures/game-helpers';

// ✅ GOOD: Look up by title (resilient to fixture resets)
const gameId = await getFixtureGameId(page, 'E2E_COMPLETE');
await page.goto(`/games/${gameId}`);

// ❌ BAD: Hardcoded ID (breaks when fixtures reset)
const gameId = 364;
```

**Available Fixture Game Constants**:
```typescript
FIXTURE_GAMES = {
  // Shared (read-only)
  HEIST: 'The Heist at Goldstone Bank',
  WESTMARCH: 'Chronicles of Westmarch',
  SHADOWS: 'Shadows Over Innsmouth',
  DRAGON: 'The Dragon of Mount Krag',
  MANOR: 'The Mystery of Blackwood Manor',
  COMMON_ROOM_TEST: 'E2E Common Room Test Game',

  // Dedicated (state-modifying - safe to modify)
  E2E_COMPLETE: 'E2E Test: Game to Complete',
  E2E_CANCEL: 'E2E Test: Game to Cancel',
  E2E_PAUSE: 'E2E Test: Game to Pause',
  E2E_ACTION: 'E2E Test: Action Submission',
}
```

**Example Usage**:
```typescript
test('GM can complete a game', async ({ page }) => {
  await loginAs(page, 'GM');

  // Use dedicated E2E fixture (safe to modify)
  const gameId = await getFixtureGameId(page, 'E2E_COMPLETE');
  await page.goto(`/games/${gameId}`);

  // Safe to complete this game - it resets before next test run
  await page.click('button:has-text("Complete Game")');
  await expect(page.locator('span:has-text("Completed")')).toBeVisible();
});
```

---

## 🎯 When to Add E2E Tests

**Always**:
- ✅ New user journey (multi-page workflow)
- ✅ Critical business flow (registration, checkout, etc.)
- ✅ Features with complex state transitions

**Sometimes**:
- ⚠️ Admin-only features
- ⚠️ Edge cases with high business impact

**Never**:
- ❌ Purely cosmetic changes
- ❌ Features with strong unit test coverage and no user interaction

---

## 📚 Feature Plan Template

When creating a new feature, use `.claude/planning/FEATURE_TEMPLATE.md`:

```bash
cp .claude/planning/FEATURE_TEMPLATE.md .claude/planning/feature-[name].md
```

**Key E2E Section** (in template):

- [ ] **User Journey**: Describe end-to-end flow
- [ ] **Happy Path Test**: Main user workflow
- [ ] **Error Scenarios**: Invalid input, permissions, network errors
- [ ] **Multi-User** (if needed): GM-Player interactions
- [ ] **Test Duration**: < 3 minutes
- [ ] **Update Catalog**: Add to `docs/E2E_TEST_CATALOG.md`

---

## ⚡ Quick Commands

```bash
# Run all E2E tests
npm run test:e2e

# Run specific test file
npm run test:e2e -- e2e/auth/login.spec.ts

# Run specific test by name
npm run test:e2e -- -g "should login successfully"

# Debug mode (step through with browser visible)
npm run test:e2e:debug

# UI mode (interactive)
npm run test:e2e:ui

# Run with specific browser
npm run test:e2e -- --project=chromium

# View HTML report
npm run test:e2e:report

# Run headed (see browser)
npm run test:e2e:headed
```

---

## 🔍 Selector Best Practices

**Priority Order**:

1. **User-facing text** (best)
   ```typescript
   await page.click('button:has-text("Submit")');
   await page.getByRole('button', { name: 'Submit' });
   ```

2. **Labels and ARIA** (good)
   ```typescript
   await page.getByLabel('Username');
   await page.getByPlaceholder('Enter username');
   ```

3. **Test IDs** (when dynamic)
   ```typescript
   await page.click('[data-testid="submit-btn"]');
   ```

4. **CSS selectors** (last resort)
   ```typescript
   await page.click('.submit-btn');
   ```

---

## 🛠️ Helper Functions

### Auth Helper

```typescript
// e2e/fixtures/auth-helpers.ts
export async function loginAs(
  page: Page,
  userKey: keyof typeof TEST_USERS
) {
  const user = TEST_USERS[userKey];

  await page.goto('/login');
  await page.fill('[name="username"]', user.username); // e.g., 'TestGM'
  await page.fill('[name="password"]', user.password);
  await page.click('button[type="submit"]');
  await page.waitForURL('/dashboard');

  return { user, token: await getAuthToken(page) };
}
```

### Game Helper

```typescript
// e2e/fixtures/game-helpers.ts
export async function createGame(
  page: Page,
  { title, description = '', maxPlayers = 4 }
) {
  await page.goto('/games');
  await page.click('text=Create Game');
  await page.fill('[name="title"]', title);
  await page.fill('[name="description"]', description);
  await page.fill('[name="maxPlayers"]', maxPlayers.toString());
  await page.click('button:has-text("Create")');

  await page.waitForURL(/\/games\/\d+/);
  const gameId = parseInt(page.url().match(/\/games\/(\d+)/)?.[1] || '0');
  return { gameId };
}
```

---

## 🔐 Multi-User Testing

```typescript
test('GM and Player interaction', async ({ browser }) => {
  // Create separate browser contexts
  const gmContext = await browser.newContext();
  const playerContext = await browser.newContext();

  const gmPage = await gmContext.newPage();
  const playerPage = await playerContext.newPage();

  // GM actions
  await loginAs(gmPage, 'GM');
  const { gameId } = await createGame(gmPage, { title: 'Test Game' });

  // Player actions
  await loginAs(playerPage, 'PLAYER_1');
  await playerPage.goto(`/games/${gameId}`);
  await playerPage.click('button:has-text("Apply")');

  // GM approves
  await gmPage.reload();
  await gmPage.click('button:has-text("Approve")');

  // Verify player sees approval
  await playerPage.reload();
  await expect(playerPage.locator('text=Approved')).toBeVisible();

  // Cleanup
  await gmContext.close();
  await playerContext.close();
});
```

---

## 📊 Implementation Timeline

### Phase 1: Foundation (Week 1, 8-12 hours)
- [ ] Install Playwright
- [ ] Setup config and structure
- [ ] Implement Journey 1 (Registration & Login)
- [ ] CI/CD integration

### Phase 2: Critical Journeys (Week 2-3, 12-16 hours)
- [ ] Journey 2: GM Creates & Recruits
- [ ] Journey 3: Character Creation
- [ ] Journey 4: Phase-Action-Result
- [ ] Journey 5: Private Messages
- [ ] E2E test catalog

### Phase 3: Supporting Journeys (Week 4, 8-10 hours)
- [ ] Additional 4 journeys
- [ ] Optimize test execution
- [ ] Improve helper functions

---

## 📖 Full Documentation

- **Complete Plan**: `docs/E2E_TESTING_PLAN.md`
- **Feature Template**: `.claude/planning/FEATURE_TEMPLATE.md`
- **Test Catalog**: `docs/E2E_TEST_CATALOG.md` (created after first test)
- **Playwright Docs**: https://playwright.dev/docs/intro

---

## ✅ Pre-Merge Checklist

Before merging any feature PR:

- [ ] E2E test written for user journey
- [ ] E2E test passing locally
- [ ] E2E test passing in CI
- [ ] Test duration < 3 minutes
- [ ] Test catalog updated
- [ ] No flaky behavior (run 10x)

---

## 🎯 Success Targets

**Coverage**:
- ✅ 5 critical journeys (MVP)
- ✅ 9-10 total journeys (complete)

**Performance**:
- ✅ Total execution < 10 minutes
- ✅ Individual tests < 3 minutes
- ✅ Flaky rate < 1%

**Quality**:
- ✅ 100% pass rate on main
- ✅ Screenshots on failure
- ✅ Video on failure

---

**Quick Start Version**: 1.0 (2025-10-17)
**For Full Details**: See `docs/E2E_TESTING_PLAN.md`
