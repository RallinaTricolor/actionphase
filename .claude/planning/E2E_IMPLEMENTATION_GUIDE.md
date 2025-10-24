# E2E Testing Implementation Guide (Sonnet-Optimized)

## Quick Start for Implementation

This guide provides concrete steps to implement the E2E testing strategy. Follow these tasks sequentially for best results.

**Current Status** (Oct 24, 2025):
- ✅ Test data separation complete (`common/`, `demo/`, `e2e/`)
- ✅ 3 Page Objects implemented
- ✅ 25 E2E test files exist (needs reorganization into journeys)
- ✅ Fixture loading scripts working correctly
- 🚧 Need more `data-testid` attributes
- 🚧 Need journey-based organization

---

## Task 0: Understanding Test Data Separation (READ FIRST)

**Important:** ActionPhase uses a three-tier test data system. Understanding this prevents fixture conflicts and ensures tests run correctly.

### The Three Data Tiers

#### 1. Common Data (Always Loaded)
**Location:** `backend/pkg/db/test_fixtures/common/`
**Purpose:** Shared users and base configuration
**Contents:**
- `00_reset.sql` - Cleans database
- `01_users.sql` - Test users (TestGM, TestPlayer1-5, TestAudience)

**Never modify these files** - they're shared by both demo and E2E.

#### 2. Demo Data (Staging/Showcase)
**Location:** `backend/pkg/db/test_fixtures/demo/`
**Purpose:** Rich, human-readable content for demos and manual testing
**Load command:** `just load-demo`

**When to use:**
- Manual testing in the UI
- Staging environment
- Screenshots and demonstrations
- Exploring features interactively

**Characteristics:**
- Games like "Shadows Over Innsmouth", "Curse of Strahd"
- Rich narratives and detailed character backstories
- Natural-sounding conversations
- Uses database sequences (IDs not hardcoded)

#### 3. E2E Data (Automated Testing)
**Location:** `backend/pkg/db/test_fixtures/e2e/`
**Purpose:** Isolated, predictable fixtures for automated tests
**Load command:** `just load-e2e`

**When to use:**
- Running E2E tests locally
- CI/CD pipelines
- Automated test verification

**Characteristics:**
- Hardcoded IDs for reliability (e.g., Game 164, 165, 166, 167)
- Minimal narrative content
- Isolated games that don't conflict
- Fast to load

### Quick Reference

| Task | Command | What You Get |
|------|---------|--------------|
| Manual testing | `just load-demo` | Rich demo games + users |
| Running E2E tests | `just load-e2e` | Test games 164-167 + users |
| Development (both) | `just load-all` | Everything (slower) |
| Fresh start | `just db-reset && just load-demo` | Clean slate |

### Critical Rules

1. **E2E tests MUST use E2E fixtures** - Don't reference demo game IDs
2. **Demo fixtures should NOT hardcode IDs** - Use `RETURNING id INTO variable`
3. **Always run the right load command** before testing
4. **Check fixture ordering** when creating new files (see Troubleshooting section)

---

## Task 1: Add Data-TestId Attributes (Priority: CRITICAL)

### Files to Update:
1. **`frontend/src/components/ActionSubmission.tsx`**
   ```tsx
   // Add these data-testid attributes:
   - data-testid="action-submission-form"
   - data-testid="character-select"
   - data-testid="action-textarea"
   - data-testid="submit-action-button"
   - data-testid="action-status"
   - data-testid="phase-deadline"
   ```

2. **`frontend/src/components/GamesList.tsx`**
   ```tsx
   - data-testid="games-list"
   - data-testid="game-card-{gameId}"
   - data-testid="game-status-{status}"
   - data-testid="apply-button-{gameId}"
   ```

3. **`frontend/src/components/CommonRoom.tsx`**
   ```tsx
   - data-testid="common-room-container"
   - data-testid="post-{postId}"
   - data-testid="reply-button-{postId}"
   - data-testid="new-post-textarea"
   - data-testid="post-submit-button"
   ```

**Pattern to follow:**
```tsx
<div data-testid="component-name" className={existingClasses}>
```

---

## Task 2: Create Core Page Objects

### Create: `frontend/e2e/pages/DashboardPage.ts`
```typescript
import { Page, Locator } from '@playwright/test';

export class DashboardPage {
  readonly page: Page;
  readonly myGamesSection: Locator;
  readonly notificationBadge: Locator;

  constructor(page: Page) {
    this.page = page;
    this.myGamesSection = page.locator('[data-testid="my-games-section"]');
    this.notificationBadge = page.locator('[data-testid="notification-badge"]');
  }

  async goto() {
    await this.page.goto('/dashboard');
    await this.page.waitForLoadState('networkidle');
  }

  async getGameCount(): Promise<number> {
    const games = await this.page.locator('[data-testid^="game-card-"]').count();
    return games;
  }

  async navigateToGame(gameId: number) {
    await this.page.click(`[data-testid="game-card-${gameId}"]`);
    await this.page.waitForURL(`**/games/${gameId}`);
  }
}
```

### Create: `frontend/e2e/pages/CommonRoomPage.ts`
```typescript
import { Page, Locator } from '@playwright/test';

export class CommonRoomPage {
  readonly page: Page;
  readonly postTextarea: Locator;
  readonly submitButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.postTextarea = page.locator('[data-testid="new-post-textarea"]');
    this.submitButton = page.locator('[data-testid="post-submit-button"]');
  }

  async createPost(content: string) {
    await this.postTextarea.fill(content);
    await this.submitButton.click();
    await this.page.waitForLoadState('networkidle');
  }

  async replyToPost(postId: number, content: string) {
    await this.page.click(`[data-testid="reply-button-${postId}"]`);
    await this.page.fill('[data-testid="reply-textarea"]', content);
    await this.page.click('[data-testid="reply-submit-button"]');
  }
}
```

---

## Task 3: Create Essential Test Helpers

### Create: `frontend/e2e/helpers/game-actions.ts`
```typescript
import { Page } from '@playwright/test';

export async function createQuickGame(page: Page, title: string) {
  await page.goto('/games/create');
  await page.fill('[data-testid="game-title-input"]', title);
  await page.fill('[data-testid="game-description-textarea"]', 'Test game description');
  await page.click('[data-testid="create-game-button"]');
  await page.waitForURL('**/games/*');

  // Extract game ID from URL
  const url = page.url();
  const gameId = parseInt(url.split('/games/')[1]);
  return gameId;
}

export async function submitAction(page: Page, gameId: number, action: string) {
  await page.goto(`/games/${gameId}/submit-action`);
  await page.fill('[data-testid="action-textarea"]', action);
  await page.click('[data-testid="submit-action-button"]');
  await page.waitForLoadState('networkidle');
}

export async function transitionPhase(page: Page, gameId: number) {
  await page.goto(`/games/${gameId}/manage`);
  await page.click('[data-testid="transition-phase-button"]');
  await page.click('[data-testid="confirm-transition-button"]');
  await page.waitForLoadState('networkidle');
}
```

---

## Task 4: Implement Priority 1 User Journeys

### Test 1: Complete Game Lifecycle
**File:** `frontend/e2e/journeys/game-lifecycle.spec.ts`

```typescript
import { test, expect } from '@playwright/test';
import { loginAs } from '../fixtures/auth-helpers';
import { createQuickGame, submitAction, transitionPhase } from '../helpers/game-actions';
import { DashboardPage } from '../pages/DashboardPage';

test.describe('Complete Game Lifecycle', () => {
  test('GM can create game, accept players, run phase, and complete', async ({ page }) => {
    // Step 1: Login as GM
    await loginAs(page, 'GM');

    // Step 2: Create new game
    const gameId = await createQuickGame(page, `Test Game ${Date.now()}`);

    // Step 3: Verify game appears in dashboard
    const dashboard = new DashboardPage(page);
    await dashboard.goto();

    // Multiple assertions for game state
    await expect(page.locator(`[data-testid="game-card-${gameId}"]`)).toBeVisible();
    await expect(page.locator(`[data-testid="game-status-recruiting"]`)).toBeVisible();
    await expect(page.locator(`[data-testid="player-count-0"]`)).toBeVisible();

    // Step 4: Accept a player application (using fixture data)
    // ... continue implementation
  });
});
```

### Test 2: Action Phase Flow
**File:** `frontend/e2e/journeys/action-phase.spec.ts`

```typescript
test('Complete action phase workflow with multiple players', async ({ page }) => {
  // Use fixture game #2 which has active phase
  const gameId = 2;

  // Player 1 submits action
  await loginAs(page, 'PLAYER_1');
  await submitAction(page, gameId, 'Player 1 investigates the tavern');

  // Player 2 submits action
  await loginAs(page, 'PLAYER_2');
  await submitAction(page, gameId, 'Player 2 searches the library');

  // GM reviews and resolves
  await loginAs(page, 'GM');
  await page.goto(`/games/${gameId}/manage`);

  // Verify both actions visible
  await expect(page.locator('[data-testid="action-player-1"]')).toBeVisible();
  await expect(page.locator('[data-testid="action-player-2"]')).toBeVisible();

  // ... continue with resolution
});
```

---

## Task 5: Update Test Configuration

### Update: `frontend/playwright.config.ts`

```typescript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  workers: 4,

  use: {
    baseURL: 'http://localhost:3000',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'journeys',
      testMatch: /journeys\/.*\.spec\.ts$/,
    },
    {
      name: 'legacy',
      testMatch: /(games|gameplay|messaging|notifications|auth|characters)\/.*\.spec\.ts$/,
    },
  ],

  reporter: [
    ['html'],
    ['json', { outputFile: 'test-results.json' }],
  ],
});
```

---

## Implementation Checklist

### Week 1: Foundation
- [ ] Add data-testid to 10 most critical components
- [ ] Create 3 core Page Objects (Dashboard, GameDetails, CommonRoom)
- [ ] Create game-actions helper module
- [ ] Update playwright.config.ts

### Week 2: Core Journeys
- [ ] Implement game-lifecycle.spec.ts
- [ ] Implement action-phase.spec.ts
- [ ] Implement common-room-discussion.spec.ts
- [ ] Run all tests in parallel successfully

### Week 3: Extended Coverage
- [ ] Add character management tests
- [ ] Add private messaging tests
- [ ] Add error scenario tests
- [ ] Create test data reset script

### Success Criteria
1. All tests run in < 5 minutes
2. Zero flaky tests (run 10x successfully)
3. 100% of Priority 1 journeys covered
4. Tests can run in parallel without conflicts

---

## Common Patterns to Follow

### Pattern 1: Grouped Assertions
```typescript
// Good - related assertions grouped
await expect(gameCard).toBeVisible();
await expect(gameCard.locator('.status')).toHaveText('Active');
await expect(gameCard.locator('.players')).toHaveText('3/5');

// Bad - separate tests for related state
test('shows game card', ...);
test('shows correct status', ...);
test('shows player count', ...);
```

### Pattern 2: Smart Waiting
```typescript
// Good - wait for specific condition
await page.waitForSelector('[data-testid="loading-complete"]', { state: 'hidden' });
await page.waitForLoadState('networkidle');

// Bad - arbitrary timeout
await page.waitForTimeout(3000);
```

### Pattern 3: Test Data Usage
```typescript
// Good - use fixture game IDs
const gameId = await getFixtureGameId(page, 'E2E_ACTION');

// Bad - hardcoded IDs
const gameId = 164; // Don't hardcode!
```

---

## Debugging Tips

1. **Run single test:** `npx playwright test game-lifecycle.spec.ts --debug`
2. **View trace:** `npx playwright show-trace trace.zip`
3. **Check selectors:** `npx playwright codegen localhost:3000`
4. **Parallel issues:** Add `test.describe.serial()` temporarily

---

## Troubleshooting: Common Issues

### Issue: Fixture Fails with "null value in column violates not-null constraint"

**Symptom:** Running `just load-demo` fails when applying fixtures, showing errors like:
```
ERROR: null value in column "game_id" of relation "messages" violates not-null constraint
```

**Cause:** Fixture files are loaded in **alphabetical order**. A fixture file is trying to reference data that hasn't been created yet.

**Solution:** Rename the fixture file to ensure correct load order:

```bash
# Bad: This file runs before games are created
012_deeply_nested_comments.sql  # ← Runs early (alphabetically)

# Good: This file runs after games exist
10_deeply_nested_comments.sql   # ← Runs after 02, 03, 04, etc.
```

**Load Order Pattern:**
```
demo/
├── 02_games_recruiting.sql     # Create games first
├── 03_games_running.sql        # More games
├── 04_characters.sql           # Characters (need games)
├── 05_actions.sql              # Actions (need characters)
├── 06_results.sql              # Results (need actions)
├── 09_demo_content.sql         # Rich content (needs everything)
└── 10_deeply_nested_comments.sql  # Deep threads (needs game from 03)
```

**Key Rules:**
1. Files load in **numerical then alphabetical order**
2. Number files by dependency: `01` → `02` → `03` → ... → `10` → `11`
3. Leave gaps (02, 03, 05, 09) for future insertions
4. Always test with `just load-demo` after renaming

---

### Issue: "Game ID not found" in E2E tests

**Cause:** Test expects specific game ID but fixture hasn't created it

**Solution:** Use fixture helper to get game IDs dynamically:
```typescript
// Bad - hardcoded
const gameId = 164;

// Good - query from database
const gameId = await getFixtureGameId(page, 'E2E_COMMON_ROOM');
```

---

## Fixture Development Checklist

When creating new fixture files:
- [ ] Named with correct numerical prefix (check load order)
- [ ] Uses variables for IDs (not hardcoded unless E2E-specific)
- [ ] Wraps inserts in `DO $$ BEGIN ... END $$;` for error handling
- [ ] Queries for dependent IDs before inserting
- [ ] Tested with both `just load-demo` and `just load-e2e`
- [ ] Documented purpose at top of file

---

*Start with Task 1 (data-testid attributes) as it enables everything else.*
