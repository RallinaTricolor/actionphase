# E2E Testing - Immediate Actions Guide

## Quick Start: What to Do Right Now

This guide provides immediate, actionable steps you can start today to improve the E2E testing infrastructure while the full rework plan is being implemented.

## Day 1: Critical Quick Wins (4 hours)

### 1. Add Test Tags to Enable Selective Execution (30 min)

Create `frontend/e2e/fixtures/test-tags.ts`:
```typescript
// Test tag definitions
export const tags = {
  SMOKE: '@smoke',        // 5-min health check
  CRITICAL: '@critical',  // Must pass for deploy
  AUTH: '@auth',         // Authentication tests
  GAME: '@game',         // Game management
  SLOW: '@slow',         // Tests > 30s
  FLAKY: '@flaky',       // Known flaky tests
};

// Helper to add tags to test names
export function tagTest(tags: string[], name: string) {
  return `${tags.join(' ')} ${name}`;
}
```

Update a few critical tests:
```typescript
import { tagTest, tags } from '../fixtures/test-tags';

test(tagTest([tags.SMOKE, tags.AUTH], 'User can login'), async ({ page }) => {
  // existing test code
});
```

### 2. Create Missing Critical Page Objects (1 hour)

Create `frontend/e2e/pages/CharacterSheetPage.ts`:
```typescript
export class CharacterSheetPage {
  constructor(private page: Page) {}

  async goto(gameId: number, characterId: number) {
    await this.page.goto(`/games/${gameId}/characters/${characterId}`);
    await this.page.waitForLoadState('networkidle');
  }

  async editField(field: string, value: string) {
    await this.page.click(`[data-testid="edit-${field}"]`);
    await this.page.fill(`[data-testid="input-${field}"]`, value);
    await this.page.click(`[data-testid="save-${field}"]`);
  }

  async uploadAvatar(filePath: string) {
    const fileInput = this.page.locator('input[type="file"]');
    await fileInput.setInputFiles(filePath);
    await this.page.click('[data-testid="upload-avatar"]');
  }
}
```

Create `frontend/e2e/pages/RegistrationPage.ts`:
```typescript
export class RegistrationPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/register');
  }

  async register(email: string, username: string, password: string) {
    await this.page.fill('[data-testid="register-email"]', email);
    await this.page.fill('[data-testid="register-username"]', username);
    await this.page.fill('[data-testid="register-password"]', password);
    await this.page.fill('[data-testid="register-confirm-password"]', password);
    await this.page.click('[data-testid="register-submit"]');
    await this.page.waitForURL('/dashboard');
  }
}
```

### 3. Implement First Critical Journey Test (1.5 hours)

Create `frontend/e2e/journeys/critical/game-lifecycle.spec.ts`:
```typescript
import { test, expect } from '@playwright/test';
import { tagTest, tags } from '../../fixtures/test-tags';
import { loginAs } from '../../fixtures/auth-helpers';

test.describe('Critical: Complete Game Lifecycle', () => {
  test(tagTest([tags.CRITICAL, tags.GAME], 'GM creates game and recruits players'), async ({ browser }) => {
    // Step 1: GM creates a game
    const gmContext = await browser.newContext();
    const gmPage = await gmContext.newPage();
    await loginAs(gmPage, 'GM');

    await gmPage.goto('/games/create');
    const gameTitle = `Critical Test Game ${Date.now()}`;
    await gmPage.fill('[data-testid="game-title"]', gameTitle);
    await gmPage.fill('[data-testid="game-description"]', 'Testing complete lifecycle');
    await gmPage.selectOption('[data-testid="max-players"]', '3');
    await gmPage.click('[data-testid="create-game-submit"]');

    // Extract game ID from URL
    await gmPage.waitForURL(/\/games\/\d+/);
    const gameId = gmPage.url().match(/games\/(\d+)/)?.[1];
    expect(gameId).toBeTruthy();

    // Step 2: Start recruitment
    await gmPage.click('[data-testid="start-recruitment"]');
    await expect(gmPage.locator('text=Recruiting')).toBeVisible();

    // Step 3: Player applies
    const playerContext = await browser.newContext();
    const playerPage = await playerContext.newPage();
    await loginAs(playerPage, 'PLAYER_1');

    await playerPage.goto(`/games/${gameId}`);
    await playerPage.click('[data-testid="apply-to-game"]');
    await playerPage.fill('[data-testid="application-message"]', 'I would like to join!');
    await playerPage.click('[data-testid="submit-application"]');

    // Step 4: GM approves application
    await gmPage.reload();
    await gmPage.click('[data-testid="view-applications"]');
    await gmPage.click('[data-testid="approve-application-0"]');
    await expect(gmPage.locator('text=Application approved')).toBeVisible();

    // Cleanup contexts
    await playerContext.close();
    await gmContext.close();
  });
});
```

### 4. Add Data-TestId Attributes to Critical Components (1 hour)

Update `frontend/src/pages/RegisterPage.tsx`:
```tsx
// Add these data-testid attributes to registration form
<input
  data-testid="register-email"
  type="email"
  {...register('email')}
/>
<input
  data-testid="register-username"
  type="text"
  {...register('username')}
/>
<input
  data-testid="register-password"
  type="password"
  {...register('password')}
/>
<button data-testid="register-submit" type="submit">
  Register
</button>
```

Update `frontend/src/pages/GameCreationPage.tsx`:
```tsx
// Add data-testid to game creation form
<input
  data-testid="game-title"
  {...register('title')}
/>
<textarea
  data-testid="game-description"
  {...register('description')}
/>
<select data-testid="max-players" {...register('maxPlayers')}>
  {/* options */}
</select>
<button data-testid="create-game-submit">Create Game</button>
```

## Day 2: Test Organization & Data Management (4 hours)

### 1. Reorganize Test Structure (1 hour)

```bash
# Create new directory structure
mkdir -p frontend/e2e/journeys/critical
mkdir -p frontend/e2e/journeys/standard
mkdir -p frontend/e2e/smoke
mkdir -p frontend/e2e/regression

# Move existing journey tests
mv frontend/e2e/journeys/*.spec.ts frontend/e2e/journeys/standard/

# Create smoke test suite
cat > frontend/e2e/smoke/health-check.spec.ts << 'EOF'
import { test, expect } from '@playwright/test';
import { tagTest, tags } from '../fixtures/test-tags';

test.describe('Smoke: Application Health', () => {
  test(tagTest([tags.SMOKE], 'Frontend loads'), async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toContainText('ActionPhase');
  });

  test(tagTest([tags.SMOKE], 'API responds'), async ({ request }) => {
    const response = await request.get('/api/v1/health');
    expect(response.status()).toBe(200);
  });

  test(tagTest([tags.SMOKE], 'Login page accessible'), async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('[data-testid="login-form"]')).toBeVisible();
  });
});
EOF
```

### 2. Create Test Data Factory (2 hours)

Create `frontend/e2e/factories/game.factory.ts`:
```typescript
import { faker } from '@faker-js/faker';

export interface TestGame {
  id?: number;
  title: string;
  description: string;
  maxPlayers: number;
  genre: string;
}

export class GameFactory {
  private static games: TestGame[] = [];

  static create(overrides?: Partial<TestGame>): TestGame {
    const game: TestGame = {
      title: faker.company.catchPhrase(),
      description: faker.lorem.paragraph(),
      maxPlayers: faker.number.int({ min: 2, max: 8 }),
      genre: faker.helpers.arrayElement(['Fantasy', 'Sci-Fi', 'Horror']),
      ...overrides
    };

    this.games.push(game);
    return game;
  }

  static async createInAPI(page: Page, overrides?: Partial<TestGame>): Promise<TestGame> {
    const game = this.create(overrides);

    // Use API to create game
    const response = await page.request.post('/api/v1/games', {
      data: game,
      headers: {
        Authorization: `Bearer ${await page.evaluate(() => localStorage.getItem('token'))}`
      }
    });

    const created = await response.json();
    game.id = created.id;
    return game;
  }

  static async cleanup(page: Page) {
    // Delete all test games
    for (const game of this.games) {
      if (game.id) {
        await page.request.delete(`/api/v1/games/${game.id}`);
      }
    }
    this.games = [];
  }
}
```

### 3. Update package.json with Test Scripts (30 min)

```json
{
  "scripts": {
    "e2e": "playwright test",
    "e2e:smoke": "playwright test --grep @smoke",
    "e2e:critical": "playwright test --grep @critical",
    "e2e:auth": "playwright test --grep @auth",
    "e2e:headed": "playwright test --headed",
    "e2e:debug": "playwright test --debug",
    "e2e:ui": "playwright test --ui",
    "e2e:report": "playwright show-report"
  }
}
```

### 4. Create Test Helpers for Common Operations (30 min)

Create `frontend/e2e/helpers/game-lifecycle.ts`:
```typescript
export class GameLifecycle {
  static async createAndStartGame(
    gmPage: Page,
    playerPages: Page[],
    gameTitle: string
  ): Promise<number> {
    // GM creates game
    await gmPage.goto('/games/create');
    await gmPage.fill('[data-testid="game-title"]', gameTitle);
    await gmPage.click('[data-testid="create-game-submit"]');

    const gameId = parseInt(gmPage.url().match(/games\/(\d+)/)?.[1] || '0');

    // Start recruitment
    await gmPage.click('[data-testid="start-recruitment"]');

    // Players apply
    for (const playerPage of playerPages) {
      await playerPage.goto(`/games/${gameId}`);
      await playerPage.click('[data-testid="apply-to-game"]');
    }

    // GM approves all
    await gmPage.click('[data-testid="approve-all-applications"]');

    // Start game
    await gmPage.click('[data-testid="start-game"]');

    return gameId;
  }
}
```

## Day 3: Critical Coverage Gaps (4 hours)

### 1. Add Registration/Onboarding Tests (2 hours)

Create `frontend/e2e/journeys/critical/user-onboarding.spec.ts`:
```typescript
test.describe('Critical: User Onboarding', () => {
  test(tagTest([tags.CRITICAL, tags.AUTH], 'New user can register and join game'), async ({ page }) => {
    // Registration
    const email = faker.internet.email();
    const username = faker.internet.userName();
    const password = 'TestPassword123!';

    await page.goto('/register');
    await page.fill('[data-testid="register-email"]', email);
    await page.fill('[data-testid="register-username"]', username);
    await page.fill('[data-testid="register-password"]', password);
    await page.fill('[data-testid="register-confirm"]', password);
    await page.click('[data-testid="register-submit"]');

    // Should redirect to dashboard
    await expect(page).toHaveURL('/dashboard');
    await expect(page.locator(`text=Welcome, ${username}`)).toBeVisible();

    // Complete profile
    await page.click('[data-testid="complete-profile"]');
    await page.fill('[data-testid="profile-bio"]', 'New player here!');
    await page.selectOption('[data-testid="profile-timezone"]', 'America/New_York');
    await page.click('[data-testid="save-profile"]');

    // Join first game
    await page.goto('/games');
    await page.click('[data-testid="game-card-105"]'); // Demo game
    await page.click('[data-testid="apply-to-game"]');

    await expect(page.locator('text=Application submitted')).toBeVisible();
  });
});
```

### 2. Add Multi-User Collaboration Test (2 hours)

Create `frontend/e2e/journeys/critical/collaborative-gameplay.spec.ts`:
```typescript
test.describe('Critical: Collaborative Gameplay', () => {
  test(tagTest([tags.CRITICAL, tags.GAME], 'Multiple players submit actions simultaneously'), async ({ browser }) => {
    // Create 4 browser contexts
    const contexts = await Promise.all([
      browser.newContext(),  // GM
      browser.newContext(),  // Player 1
      browser.newContext(),  // Player 2
      browser.newContext(),  // Player 3
    ]);

    const pages = await Promise.all(
      contexts.map(ctx => ctx.newPage())
    );

    // Login all users
    await loginAs(pages[0], 'GM');
    await loginAs(pages[1], 'PLAYER_1');
    await loginAs(pages[2], 'PLAYER_2');
    await loginAs(pages[3], 'PLAYER_3');

    // Use existing game with action phase
    const gameId = 105;

    // GM creates new action phase
    const gmPage = pages[0];
    await gmPage.goto(`/games/${gameId}/manage`);
    await gmPage.click('[data-testid="create-phase"]');
    await gmPage.selectOption('[data-testid="phase-type"]', 'action');
    await gmPage.fill('[data-testid="phase-description"]', 'Simultaneous action test');
    await gmPage.click('[data-testid="activate-phase"]');

    // All players submit actions simultaneously
    const submissions = pages.slice(1).map(async (playerPage, index) => {
      await playerPage.goto(`/games/${gameId}`);
      await playerPage.fill(
        '[data-testid="action-textarea"]',
        `Player ${index + 1} performs action at ${Date.now()}`
      );
      await playerPage.click('[data-testid="submit-action"]');
      return playerPage.waitForSelector('text=Action submitted');
    });

    // Wait for all submissions
    await Promise.all(submissions);

    // GM views all actions
    await gmPage.goto(`/games/${gameId}/phase/current/submissions`);
    await expect(gmPage.locator('[data-testid="submission-count"]')).toHaveText('3');

    // Cleanup
    await Promise.all(contexts.map(ctx => ctx.close()));
  });
});
```

## Week 1 Checklist

### Essential Infrastructure (Priority 1)
- [ ] Add test tagging system
- [ ] Create 5 missing Page Objects
- [ ] Reorganize test directory structure
- [ ] Implement test data factory
- [ ] Add npm scripts for test execution

### Critical Test Coverage (Priority 1)
- [ ] Game lifecycle journey test
- [ ] User onboarding journey test
- [ ] Multi-user collaboration test
- [ ] Smoke test suite (5 min execution)

### Data-TestId Attributes (Priority 2)
- [ ] Registration page
- [ ] Game creation page
- [ ] Character sheet page
- [ ] User settings page
- [ ] Admin dashboard

### Documentation (Priority 3)
- [ ] Update README with new test structure
- [ ] Document test tagging conventions
- [ ] Create troubleshooting guide

## Running the Improved Tests

```bash
# Quick smoke tests (5 min)
npm run e2e:smoke

# Critical path tests (15 min)
npm run e2e:critical

# Full test suite
npm run e2e

# Debug a specific test
npm run e2e:debug -- game-lifecycle.spec.ts

# Run with UI mode for development
npm run e2e:ui
```

## Next Steps

After completing these immediate actions:

1. **Measure baseline metrics**:
   - Current test execution time
   - Flakiness rate
   - Coverage percentage

2. **Set up CI pipeline**:
   - Run smoke tests on every PR
   - Run critical tests before merge
   - Full regression nightly

3. **Schedule team training**:
   - Page Object pattern
   - Test data management
   - Debugging techniques

4. **Plan Phase 2**:
   - Visual regression testing
   - Performance benchmarks
   - Cross-browser support

## Success Metrics After Week 1

You should see:
- ✅ Smoke tests complete in <5 minutes
- ✅ Critical paths covered for main user journeys
- ✅ Zero hardcoded test data in new tests
- ✅ Tests can run in parallel without conflicts
- ✅ Clear test organization and naming

---

*Start Date: [Today's Date]*
*Review Date: [End of Week 1]*
*Questions: Contact QA Team Lead*
