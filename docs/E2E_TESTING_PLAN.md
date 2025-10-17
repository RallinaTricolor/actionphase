# E2E Testing Plan for ActionPhase

**Date**: 2025-10-17
**Status**: Planning Phase
**Goal**: Implement comprehensive end-to-end testing for critical user journeys

---

## Executive Summary

ActionPhase has excellent unit test coverage (1,167 tests, 84% backend, 60% frontend), but lacks end-to-end tests that validate complete user workflows. This plan outlines the setup, critical journeys, and integration strategy for Playwright-based E2E testing.

**Success Metrics**:
- ✅ E2E tests for 5 critical user journeys
- ✅ Automated in CI/CD pipeline
- ✅ < 10 minute total execution time
- ✅ Integrated into feature development workflow

---

## Part 1: E2E Testing Setup

### Tool Selection: Playwright

**Why Playwright?**
- ✅ **Multi-browser support** (Chromium, Firefox, WebKit)
- ✅ **Built-in test runner** with parallel execution
- ✅ **Auto-wait** for elements (no manual waits)
- ✅ **Network interception** for API mocking/stubbing
- ✅ **Screenshot & video** on failure
- ✅ **Excellent TypeScript** support
- ✅ **Fast execution** with parallelization
- ✅ **CI-friendly** with containerized browsers

**Alternatives Considered**:
- Cypress: Good but slower, less browser support, network mocking limitations
- Selenium: Older, more complex setup, slower
- Puppeteer: Chrome-only, lower-level API

### Installation & Setup

#### 1.1 Install Playwright

```bash
cd frontend
npm install -D @playwright/test
npx playwright install
```

**Installs**:
- `@playwright/test` - Test runner and assertion library
- Browser binaries (Chromium, Firefox, WebKit)

#### 1.2 Configure Playwright

Create `frontend/playwright.config.ts`:

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html'],
    ['junit', { outputFile: 'test-results/junit.xml' }]
  ],

  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    // Add Firefox/WebKit later if needed
  ],

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
```

**Key Configuration**:
- `testDir`: E2E tests in `frontend/e2e/`
- `fullyParallel`: Run tests in parallel for speed
- `retries`: Retry flaky tests in CI
- `webServer`: Auto-start dev server before tests
- `trace/screenshot/video`: Debug artifacts on failure

#### 1.3 Project Structure

```
frontend/
├── e2e/                          # E2E test directory
│   ├── auth/                     # Authentication journeys
│   │   ├── login.spec.ts
│   │   └── register.spec.ts
│   ├── games/                    # Game management journeys
│   │   ├── create-game.spec.ts
│   │   ├── join-game.spec.ts
│   │   └── game-lifecycle.spec.ts
│   ├── gameplay/                 # Core gameplay journeys
│   │   ├── character-creation.spec.ts
│   │   ├── phase-transitions.spec.ts
│   │   └── action-submission.spec.ts
│   ├── messaging/                # Communication journeys
│   │   ├── private-messages.spec.ts
│   │   └── common-room.spec.ts
│   ├── fixtures/                 # Test data & utilities
│   │   ├── test-users.ts
│   │   ├── auth-helpers.ts
│   │   └── game-helpers.ts
│   └── global-setup.ts           # One-time setup (DB seed, etc.)
├── playwright.config.ts          # Playwright configuration
└── package.json                  # Add E2E scripts
```

#### 1.4 Add NPM Scripts

Update `frontend/package.json`:

```json
{
  "scripts": {
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:e2e:debug": "playwright test --debug",
    "test:e2e:headed": "playwright test --headed",
    "test:e2e:report": "playwright show-report"
  }
}
```

**Script Descriptions**:
- `test:e2e`: Run all E2E tests (headless)
- `test:e2e:ui`: Interactive UI mode for debugging
- `test:e2e:debug`: Step-through debugging
- `test:e2e:headed`: Show browser during tests
- `test:e2e:report`: View HTML test report

### Backend Setup for E2E Tests

#### 1.5 Test Database Strategy

**Option A: Separate Test Database** (Recommended)

```bash
# Create test database
createdb actionphase_e2e_test

# Add to .env.test
DATABASE_URL=postgresql://user:pass@localhost:5432/actionphase_e2e_test
```

**Option B: Database Transactions** (Faster, more complex)

Use test fixtures that automatically rollback after each test.

#### 1.6 Test Data Fixtures

Create `backend/pkg/db/test_fixtures/e2e_seed.sql`:

```sql
-- E2E Test Users
INSERT INTO users (id, username, email, password_hash, created_at, updated_at) VALUES
  (100, 'e2e_gm', 'e2e_gm@test.com', '$2a$10$...', NOW(), NOW()),
  (101, 'e2e_player1', 'e2e_player1@test.com', '$2a$10$...', NOW(), NOW()),
  (102, 'e2e_player2', 'e2e_player2@test.com', '$2a$10$...', NOW(), NOW());

-- E2E Test Game
INSERT INTO games (id, title, description, gm_user_id, state, max_players, is_public, created_at, updated_at) VALUES
  (100, 'E2E Test Game', 'Test game for E2E tests', 100, 'setup', 4, true, NOW(), NOW());
```

**Password Hash**: Use `bcrypt` to generate hash for known password (e.g., "testpassword123")

#### 1.7 Global Setup Script

Create `frontend/e2e/global-setup.ts`:

```typescript
import { chromium, FullConfig } from '@playwright/test';

async function globalSetup(config: FullConfig) {
  // Reset test database
  console.log('Resetting E2E test database...');
  await fetch('http://localhost:8080/api/v1/test/reset-db', {
    method: 'POST',
  });

  // Seed test data
  console.log('Seeding E2E test data...');
  await fetch('http://localhost:8080/api/v1/test/seed-e2e', {
    method: 'POST',
  });

  console.log('E2E setup complete');
}

export default globalSetup;
```

**Note**: Requires backend test endpoints (`/api/v1/test/*`) that only work in test environment.

---

## Part 2: Critical User Journeys

### Journey Selection Criteria

**High Priority Journeys** (Must Have):
1. Core business value (users can't accomplish goals without it)
2. Multiple steps/pages (integration complexity)
3. Frequent user path (high usage)
4. Recent bugs (regression risk)

**Medium Priority Journeys** (Should Have):
- Important but less frequent
- Single-page workflows
- Admin/GM-only features

**Low Priority Journeys** (Nice to Have):
- Edge cases
- Rarely used features
- Features with strong unit test coverage

### Priority 1: Critical User Journeys (MVP)

#### Journey 1: User Registration & Login

**User Story**: New user can register and log in to access the platform

**Flow**:
1. Navigate to `/register`
2. Fill in username, email, password
3. Submit registration form
4. Redirect to games list (`/games`)
5. Verify authenticated (user menu visible)
6. Logout
7. Navigate to `/login`
8. Log in with credentials
9. Verify authenticated again

**Why Critical**:
- Authentication is foundational - nothing works without it
- 100% of users must complete this journey
- Recent refactor to AuthContext needs validation

**Test File**: `e2e/auth/registration-and-login.spec.ts`

**Estimated Time**: 30-45 seconds

#### Journey 2: GM Creates Game & Recruits Players

**User Story**: GM can create a game, start recruitment, and accept player applications

**Flow**:
1. Login as GM user
2. Navigate to games page
3. Click "Create Game"
4. Fill in game details (title, description, max players)
5. Submit form
6. Verify game appears in game list
7. Click on game to view details
8. Click "Start Recruitment"
9. Verify game state changes to "recruitment"
10. Login as Player 1 (new browser context)
11. Navigate to games list
12. Apply to join game
13. Switch back to GM context
14. View applications
15. Approve Player 1's application
16. Verify Player 1 appears in participants list

**Why Critical**:
- Core game master workflow
- Tests game state machine (setup → recruitment)
- Tests application approval system
- Recent bug fix (GM can't apply to own game) needs validation

**Test File**: `e2e/games/gm-creates-and-recruits.spec.ts`

**Estimated Time**: 90-120 seconds

#### Journey 3: Player Creates Character & Joins Game

**User Story**: Approved player can create a character and participate in the game

**Flow**:
1. Login as Player 1 (from Journey 2)
2. Navigate to game details
3. Verify "Create Character" button visible
4. Click "Create Character"
5. Fill in character details (name, background, etc.)
6. Submit character form
7. Verify character appears in character list
8. GM transitions game to "active" state
9. Verify Player 1 can see active game UI

**Why Critical**:
- Essential player onboarding flow
- Character creation is complex with nested components
- Tests game state transitions (recruitment → character_creation → active)

**Test File**: `e2e/gameplay/character-creation-flow.spec.ts`

**Estimated Time**: 60-90 seconds

#### Journey 4: GM Manages Phases & Player Submits Action

**User Story**: GM can create phases and players can submit actions during action phases

**Flow**:
1. Login as GM
2. Navigate to active game
3. Open Phase Management
4. Create new "Action Phase"
5. Set phase details (title, description, deadline)
6. Activate phase
7. Login as Player 1
8. Navigate to game
9. See active action phase
10. Submit action with character
11. Verify action saved (draft or submitted)
12. Switch to GM
13. View submitted actions
14. Create action result
15. Publish result
16. Switch to Player 1
17. View published result

**Why Critical**:
- Core gameplay loop (phases → actions → results)
- Most complex user flow
- Tests phase state machine
- Tests permissions (players can only see their results)

**Test File**: `e2e/gameplay/phase-action-result-flow.spec.ts`

**Estimated Time**: 120-180 seconds

#### Journey 5: Players Exchange Private Messages

**User Story**: Players can send private messages to each other within a game

**Flow**:
1. Login as Player 1
2. Navigate to game
3. Open "Private Messages" tab
4. Click "New Conversation"
5. Select Player 2 as participant
6. Enter message content
7. Send message
8. Login as Player 2
9. Navigate to game
10. Open "Private Messages" tab
11. See conversation with Player 1
12. Click conversation to view messages
13. Reply to Player 1
14. Switch back to Player 1
15. Verify reply received

**Why Critical**:
- Key social feature for player coordination
- Tests conversation deduplication (recent bug fix)
- Tests real-time messaging (or polling)

**Test File**: `e2e/messaging/private-messages-flow.spec.ts`

**Estimated Time**: 90-120 seconds

### Priority 2: Supporting Journeys (Post-MVP)

6. **GM Edits Game Settings** - Update game details after creation
7. **Player Views Phase History** - See past phases and results
8. **GM Manages Game Applications** - Bulk approve/reject applications
9. **Player Posts in Common Room** - Public game communication
10. **GM Ends Game** - Complete game lifecycle

### Priority 3: Edge Cases & Admin (Future)

11. **Password Reset Flow** - Forgot password functionality
12. **Character Editing** - Update character after creation
13. **Game Deletion** - GM removes game
14. **Multi-Character Gameplay** - Player with multiple characters
15. **Anonymous Game Mode** - Hidden player identities

---

## Part 3: E2E Test Implementation Guide

### 3.1 Test Structure Pattern

```typescript
import { test, expect } from '@playwright/test';
import { loginAs, createGame } from './fixtures/helpers';

test.describe('Journey Name', () => {
  // Run before each test - ensures clean state
  test.beforeEach(async ({ page }) => {
    // Reset test data or navigate to starting point
    await page.goto('/');
  });

  test('should complete [specific user goal]', async ({ page }) => {
    // Arrange: Setup preconditions
    const { user, token } = await loginAs(page, 'e2e_gm');

    // Act: Perform user actions
    await page.goto('/games');
    await page.click('text=Create Game');
    await page.fill('[name="title"]', 'My Test Game');
    await page.fill('[name="description"]', 'E2E test game');
    await page.click('button:has-text("Create")');

    // Assert: Verify outcomes
    await expect(page.locator('text=My Test Game')).toBeVisible();
    await expect(page).toHaveURL(/\/games\/\d+/);
  });

  test('should handle error scenarios', async ({ page }) => {
    // Test unhappy paths
  });
});
```

### 3.2 Helper Functions & Fixtures

Create `e2e/fixtures/auth-helpers.ts`:

```typescript
import { Page } from '@playwright/test';

export async function loginAs(page: Page, username: string, password: string = 'testpassword123') {
  await page.goto('/login');
  await page.fill('[name="username"]', username);
  await page.fill('[name="password"]', password);
  await page.click('button[type="submit"]');

  // Wait for redirect to games page
  await page.waitForURL('/games');

  // Extract token from localStorage for API calls
  const token = await page.evaluate(() => localStorage.getItem('token'));

  return { token };
}

export async function logout(page: Page) {
  await page.click('[aria-label="User menu"]');
  await page.click('text=Logout');
  await page.waitForURL('/login');
}
```

Create `e2e/fixtures/game-helpers.ts`:

```typescript
import { Page } from '@playwright/test';

export async function createGame(
  page: Page,
  options: { title: string; description?: string; maxPlayers?: number }
) {
  await page.goto('/games');
  await page.click('text=Create Game');

  await page.fill('[name="title"]', options.title);
  if (options.description) {
    await page.fill('[name="description"]', options.description);
  }
  if (options.maxPlayers) {
    await page.fill('[name="maxPlayers"]', options.maxPlayers.toString());
  }

  await page.click('button:has-text("Create")');

  // Wait for navigation to game details page
  await page.waitForURL(/\/games\/\d+/);

  // Extract game ID from URL
  const url = page.url();
  const gameId = parseInt(url.match(/\/games\/(\d+)/)?.[1] || '0');

  return { gameId };
}

export async function startRecruitment(page: Page, gameId: number) {
  await page.goto(`/games/${gameId}`);
  await page.click('button:has-text("Start Recruitment")');

  // Wait for state change confirmation
  await page.waitForSelector('text=Recruitment Active');
}
```

### 3.3 Page Object Model (Optional)

For complex pages, create page objects:

```typescript
// e2e/pages/GameDetailsPage.ts
import { Page, Locator } from '@playwright/test';

export class GameDetailsPage {
  readonly page: Page;
  readonly startRecruitmentButton: Locator;
  readonly phaseManagementTab: Locator;
  readonly privateMessagesTab: Locator;

  constructor(page: Page) {
    this.page = page;
    this.startRecruitmentButton = page.locator('button:has-text("Start Recruitment")');
    this.phaseManagementTab = page.locator('[role="tab"]:has-text("Phase Management")');
    this.privateMessagesTab = page.locator('[role="tab"]:has-text("Private Messages")');
  }

  async goto(gameId: number) {
    await this.page.goto(`/games/${gameId}`);
  }

  async startRecruitment() {
    await this.startRecruitmentButton.click();
    await this.page.waitForSelector('text=Recruitment Active');
  }

  async openPhaseManagement() {
    await this.phaseManagementTab.click();
  }
}
```

### 3.4 Multi-User Testing with Contexts

```typescript
import { test, expect } from '@playwright/test';

test('GM and Player interaction', async ({ browser }) => {
  // Create separate contexts for GM and Player
  const gmContext = await browser.newContext();
  const playerContext = await browser.newContext();

  const gmPage = await gmContext.newPage();
  const playerPage = await playerContext.newPage();

  // GM creates game
  await loginAs(gmPage, 'e2e_gm');
  const { gameId } = await createGame(gmPage, { title: 'Multi-user Test' });
  await startRecruitment(gmPage, gameId);

  // Player applies to game
  await loginAs(playerPage, 'e2e_player1');
  await playerPage.goto(`/games/${gameId}`);
  await playerPage.click('button:has-text("Apply to Join")');

  // GM approves application
  await gmPage.reload();
  await gmPage.click('text=View Applications');
  await gmPage.click('button:has-text("Approve")');

  // Player sees approval
  await playerPage.reload();
  await expect(playerPage.locator('text=Application Approved')).toBeVisible();

  // Cleanup
  await gmContext.close();
  await playerContext.close();
});
```

---

## Part 4: CI/CD Integration

### 4.1 GitHub Actions Workflow

Create `.github/workflows/e2e-tests.yml`:

```yaml
name: E2E Tests

on:
  push:
    branches: [main, master]
  pull_request:
    branches: [main, master]

jobs:
  e2e-tests:
    timeout-minutes: 15
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: actionphase_e2e_test
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: frontend/package-lock.json

      - name: Setup Go
        uses: actions/setup-go@v4
        with:
          go-version: '1.21'

      - name: Install frontend dependencies
        working-directory: frontend
        run: npm ci

      - name: Install backend dependencies
        working-directory: backend
        run: go mod download

      - name: Run database migrations
        working-directory: backend
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/actionphase_e2e_test
        run: |
          go run main.go migrate up

      - name: Start backend server
        working-directory: backend
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/actionphase_e2e_test
          JWT_SECRET: test-secret-key
          ENVIRONMENT: test
        run: |
          go run main.go serve &
          sleep 5

      - name: Install Playwright browsers
        working-directory: frontend
        run: npx playwright install --with-deps chromium

      - name: Run E2E tests
        working-directory: frontend
        run: npm run test:e2e

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report
          path: frontend/playwright-report/
          retention-days: 30
```

### 4.2 Local CI Simulation

Add justfile command:

```bash
# Run E2E tests locally with Docker
e2e-local:
    #!/usr/bin/env bash
    set -euo pipefail

    # Start test database
    docker run -d --name actionphase-e2e-db \
      -e POSTGRES_PASSWORD=postgres \
      -e POSTGRES_DB=actionphase_e2e_test \
      -p 5433:5432 \
      postgres:15

    # Wait for DB
    sleep 3

    # Run migrations
    DATABASE_URL=postgresql://postgres:postgres@localhost:5433/actionphase_e2e_test \
      just migrate

    # Start backend
    DATABASE_URL=postgresql://postgres:postgres@localhost:5433/actionphase_e2e_test \
      just dev &
    BACKEND_PID=$!

    # Wait for backend
    sleep 5

    # Run E2E tests
    cd frontend && npm run test:e2e

    # Cleanup
    kill $BACKEND_PID
    docker stop actionphase-e2e-db
    docker rm actionphase-e2e-db
```

---

## Part 5: Best Practices & Patterns

### 5.1 Selector Strategy

**Priority Order**:
1. **User-facing attributes** (text, labels, roles)
   ```typescript
   await page.click('button:has-text("Submit")');
   await page.getByRole('button', { name: 'Submit' });
   await page.getByLabel('Username');
   ```

2. **Test IDs** (when text is dynamic/translated)
   ```typescript
   await page.click('[data-testid="submit-button"]');
   ```

3. **CSS selectors** (last resort)
   ```typescript
   await page.click('.submit-btn');
   ```

**Avoid**: XPath, overly specific CSS selectors

### 5.2 Waiting & Synchronization

**Auto-wait**: Playwright waits automatically for:
- Element to be visible
- Element to be enabled
- Navigation to complete

**Explicit waits** (when needed):
```typescript
// Wait for element
await page.waitForSelector('text=Success');

// Wait for URL
await page.waitForURL('/games/123');

// Wait for network
await page.waitForResponse('**/api/v1/games');

// Wait for condition
await page.waitForFunction(() => window.dataLoaded === true);
```

### 5.3 Test Data Management

**Strategy**:
1. **Seed data** in global setup (test users, base games)
2. **Per-test creation** for test-specific data
3. **Cleanup** in afterEach or use transactions

**Example**:
```typescript
test.beforeEach(async ({ page }) => {
  // Reset to known state
  await fetch('http://localhost:8080/api/v1/test/reset-game-state');
});

test.afterEach(async ({ page }) => {
  // Cleanup test-created data
  const gameId = page.url().match(/\/games\/(\d+)/)?.[1];
  if (gameId) {
    await fetch(`http://localhost:8080/api/v1/test/delete-game/${gameId}`, {
      method: 'DELETE'
    });
  }
});
```

### 5.4 Handling Flakiness

**Common causes & solutions**:

1. **Race conditions**
   ```typescript
   // BAD - assumes instant update
   await page.click('button');
   expect(page.locator('.success')).toBeVisible();

   // GOOD - wait for update
   await page.click('button');
   await expect(page.locator('.success')).toBeVisible();
   ```

2. **Animations/transitions**
   ```typescript
   // Wait for animation to complete
   await page.waitForTimeout(300); // Only as last resort

   // Better: wait for stable state
   await expect(page.locator('.modal')).toHaveCSS('opacity', '1');
   ```

3. **Network delays**
   ```typescript
   // Use response waiters
   const responsePromise = page.waitForResponse('**/api/v1/games');
   await page.click('button');
   await responsePromise;
   ```

---

## Part 6: Feature Development Integration

### 6.1 Feature Plan Template

Create `.claude/planning/FEATURE_TEMPLATE.md`:

```markdown
# Feature: [Feature Name]

**Date**: YYYY-MM-DD
**Status**: Planning / In Progress / Complete
**Owner**: @username

## Overview

[Brief description of the feature]

## Requirements

### Functional Requirements
- [ ] Requirement 1
- [ ] Requirement 2

### Non-Functional Requirements
- [ ] Performance: [metric]
- [ ] Security: [requirements]

## Implementation Plan

### Backend Changes
- [ ] Database migration: [description]
- [ ] API endpoint: `POST /api/v1/resource`
- [ ] Service layer: [changes]
- [ ] **Unit tests**: [test coverage plan]

### Frontend Changes
- [ ] Component: [component name]
- [ ] State management: [approach]
- [ ] API integration: [hooks/queries]
- [ ] **Unit tests**: [test coverage plan]

### E2E Testing Requirements ✅

**User Journey**: [Describe the end-to-end user journey this feature enables]

**E2E Test Checklist**:
- [ ] **Happy Path Test**: [Describe main user flow]
  - Test file: `e2e/[category]/[feature-name].spec.ts`
  - Estimated duration: [X seconds]
  - Preconditions: [required setup]

- [ ] **Error Scenarios**: [Describe key error paths to test]
  - Invalid input handling
  - Permission errors
  - Network failures

- [ ] **Multi-User Interactions** (if applicable): [Describe multi-user scenarios]
  - GM and Player interactions
  - Concurrent user actions

- [ ] **Integration Points**: [List features this integrates with]
  - Feature A: [interaction]
  - Feature B: [interaction]

**E2E Test Implementation**:
```typescript
// High-level test structure
test.describe('[Feature Name]', () => {
  test('should [accomplish user goal]', async ({ page }) => {
    // 1. Setup
    // 2. User actions
    // 3. Assertions
  });

  test('should handle [error scenario]', async ({ page }) => {
    // Error path test
  });
});
```

**Acceptance Criteria**:
- [ ] E2E test written and passing
- [ ] Test duration < [X] seconds
- [ ] Screenshots captured on failure
- [ ] Documented in E2E_TEST_CATALOG.md

## Testing Strategy

### Unit Tests
- Backend: [coverage targets]
- Frontend: [coverage targets]

### Integration Tests
- [Integration test scenarios]

### E2E Tests (see above)
- [Journey names and files]

### Manual Testing Checklist
- [ ] Test in Chrome
- [ ] Test in Firefox (if time permits)
- [ ] Mobile responsive check
- [ ] Accessibility check (keyboard navigation, screen reader)

## Deployment Plan

- [ ] Database migration tested
- [ ] Feature flag configured (if applicable)
- [ ] Rollback plan documented

## Documentation

- [ ] API documentation updated
- [ ] User documentation updated (if user-facing)
- [ ] E2E test added to catalog

## Success Metrics

- User adoption: [metric]
- Performance: [metric]
- Error rate: [metric]
```

### 6.2 E2E Test Catalog

Create `docs/E2E_TEST_CATALOG.md`:

```markdown
# E2E Test Catalog

**Last Updated**: YYYY-MM-DD
**Total Tests**: X
**Total Duration**: X minutes

## Test Inventory

| Test Name | File | Duration | Status | Last Run |
|-----------|------|----------|--------|----------|
| User Registration & Login | `e2e/auth/registration-and-login.spec.ts` | 45s | ✅ | 2025-10-17 |
| GM Creates & Recruits | `e2e/games/gm-creates-and-recruits.spec.ts` | 120s | ✅ | 2025-10-17 |
| Character Creation Flow | `e2e/gameplay/character-creation-flow.spec.ts` | 90s | ✅ | 2025-10-17 |
| Phase-Action-Result Flow | `e2e/gameplay/phase-action-result-flow.spec.ts` | 180s | ✅ | 2025-10-17 |
| Private Messages Flow | `e2e/messaging/private-messages-flow.spec.ts` | 120s | ✅ | 2025-10-17 |

## Test Coverage by Feature

### Authentication
- Registration & Login ✅

### Game Management
- Create Game ✅
- Start Recruitment ✅
- Accept Applications ✅

### Gameplay
- Character Creation ✅
- Phase Management ✅
- Action Submission ✅
- Results Publishing ✅

### Messaging
- Private Conversations ✅

## Test Execution Times

**Target**: < 10 minutes total
**Current**: 555 seconds (9m 15s)
**Status**: ✅ Within target

## Flaky Tests

*None currently*

## Disabled Tests

*None currently*
```

### 6.3 Developer Workflow

**Before implementing a new feature**:
1. Read feature plan template
2. Identify the user journey the feature enables
3. Plan E2E test alongside implementation

**During implementation**:
1. Implement backend with unit tests
2. Implement frontend with unit tests
3. Write E2E test for the user journey
4. Run E2E test locally: `npm run test:e2e:debug`

**Before merging PR**:
1. ✅ All unit tests passing
2. ✅ E2E test written and passing
3. ✅ E2E test duration acceptable
4. ✅ Test catalog updated
5. ✅ CI pipeline green

---

## Part 7: Implementation Timeline

### Phase 1: Foundation (Week 1)

**Goal**: Setup infrastructure and first test

- [ ] Install Playwright
- [ ] Configure `playwright.config.ts`
- [ ] Setup project structure (`e2e/` directory)
- [ ] Create helper functions (`auth-helpers.ts`, `game-helpers.ts`)
- [ ] Setup test database strategy
- [ ] Create global setup script
- [ ] **Implement Journey 1**: User Registration & Login
- [ ] Add to CI/CD pipeline
- [ ] Update justfile with E2E commands

**Deliverables**:
- Working E2E test infrastructure
- 1 passing E2E test
- CI pipeline running E2E tests

**Time Estimate**: 8-12 hours

### Phase 2: Critical Journeys (Week 2-3)

**Goal**: Cover all MVP user journeys

- [ ] **Journey 2**: GM Creates & Recruits (2-3 hours)
- [ ] **Journey 3**: Character Creation (2-3 hours)
- [ ] **Journey 4**: Phase-Action-Result (4-6 hours, most complex)
- [ ] **Journey 5**: Private Messages (2-3 hours)
- [ ] Create E2E test catalog
- [ ] Document patterns and best practices
- [ ] Add Playwright HTML reporter

**Deliverables**:
- 5 critical user journeys covered
- E2E test catalog
- Developer documentation

**Time Estimate**: 12-16 hours

### Phase 3: Supporting Journeys (Week 4)

**Goal**: Expand coverage to supporting features

- [ ] Journey 6: GM Edits Game
- [ ] Journey 7: Player Views Phase History
- [ ] Journey 8: GM Bulk Application Management
- [ ] Journey 9: Common Room Posts

**Deliverables**:
- 9 total E2E tests
- Improved helper functions
- Page object models (if needed)

**Time Estimate**: 8-10 hours

### Phase 4: Refinement (Week 5)

**Goal**: Optimize and stabilize

- [ ] Add visual regression testing (Playwright screenshots)
- [ ] Optimize test execution (parallelization)
- [ ] Add multi-browser support (Firefox, WebKit)
- [ ] Improve error reporting
- [ ] Add performance assertions

**Deliverables**:
- Optimized test suite
- Visual regression tests
- Multi-browser support

**Time Estimate**: 6-8 hours

---

## Part 8: Success Metrics

### Coverage Metrics

**Target**:
- ✅ 5 critical user journeys (100% of MVP flows)
- ✅ 9-10 total user journeys (includes supporting features)
- ✅ All new features include E2E test

**Tracking**:
- E2E Test Catalog (docs/E2E_TEST_CATALOG.md)
- GitHub Actions badge for E2E test status

### Performance Metrics

**Target**:
- ✅ Total execution time < 10 minutes
- ✅ Individual test < 3 minutes
- ✅ Flaky test rate < 1%

**Monitoring**:
- Playwright HTML report (execution times)
- CI/CD logs (flaky test detection)

### Quality Metrics

**Target**:
- ✅ 100% pass rate on main branch
- ✅ < 5% false failure rate (flakiness)
- ✅ Screenshots captured on all failures
- ✅ Video replay available for debugging

---

## Part 9: Maintenance & Evolution

### Regular Maintenance Tasks

**Weekly**:
- Review flaky tests
- Update E2E test catalog
- Monitor test execution times

**Monthly**:
- Review test coverage vs. feature development
- Update helper functions for common patterns
- Optimize slow tests

**Quarterly**:
- Evaluate new Playwright features
- Review and update best practices
- Consider visual regression testing

### When to Add New E2E Tests

**Always**:
- New critical user journey
- New multi-page workflow
- Features with complex state transitions

**Sometimes**:
- Admin-only features
- Edge cases with high business impact
- Features with recent production bugs

**Never**:
- Purely cosmetic changes
- Features with strong unit test coverage and no state changes
- Temporary or experimental features

---

## Appendices

### Appendix A: Playwright Resources

**Official Docs**:
- Getting Started: https://playwright.dev/docs/intro
- API Reference: https://playwright.dev/docs/api/class-playwright
- Best Practices: https://playwright.dev/docs/best-practices

**Example Repositories**:
- Playwright GitHub: https://github.com/microsoft/playwright
- Example Tests: https://github.com/microsoft/playwright/tree/main/tests

### Appendix B: Troubleshooting Guide

**Common Issues**:

1. **"Timeout waiting for locator"**
   - Check selector is correct
   - Verify element is actually rendered
   - Check if element is hidden/disabled

2. **"Navigation timeout"**
   - Increase timeout in config
   - Check backend is running
   - Verify network connectivity

3. **Flaky tests**
   - Add explicit waits for async operations
   - Use `waitForLoadState('networkidle')`
   - Check for race conditions

### Appendix C: Quick Reference Commands

```bash
# Run all E2E tests
npm run test:e2e

# Run specific test file
npm run test:e2e -- e2e/auth/login.spec.ts

# Debug mode (step through)
npm run test:e2e:debug

# UI mode (interactive)
npm run test:e2e:ui

# Run with specific browser
npm run test:e2e -- --project=chromium

# Generate HTML report
npm run test:e2e:report

# Update snapshots
npm run test:e2e -- --update-snapshots
```

---

## Conclusion

This E2E testing plan provides a comprehensive roadmap for implementing end-to-end tests that validate critical user journeys in ActionPhase. By following this plan, the team will:

1. ✅ **Increase confidence** in production deployments
2. ✅ **Catch integration bugs** before they reach users
3. ✅ **Validate complete workflows** across frontend and backend
4. ✅ **Prevent regressions** in critical user paths
5. ✅ **Streamline development** with automated journey validation

**Next Steps**:
1. Review and approve this plan
2. Begin Phase 1: Foundation setup
3. Implement first E2E test (Journey 1)
4. Iterate and expand coverage

The test suite will be production-ready with 5 critical journeys in 2-3 weeks of focused effort.
