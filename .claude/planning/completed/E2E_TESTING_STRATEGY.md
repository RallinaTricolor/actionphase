# ActionPhase E2E Testing Strategy

## Executive Summary

This document defines a comprehensive E2E testing strategy for ActionPhase, focusing on critical user journeys, maintainable test structure, and efficient test data management. The strategy emphasizes testing complete workflows rather than individual features, with multiple assertions per test where logical.

**Status**: Current coverage ~2,700 lines across 25 E2E test files. Test data separation implemented with dedicated demo and E2E fixtures.

**Recent Updates** (Oct 24, 2025):
- ✅ Test data separated into `common/`, `demo/`, and `e2e/` directories
- ✅ Fixture load order fixed (demo data now loads correctly)
- ✅ 3 Page Objects implemented (CommonRoom, GameDetails, PhaseManagement)
- 🚧 Need more `data-testid` attributes for stable selectors
- 🚧 Need journey-based test organization

---

## 1. Core Principles

### 1.1 User Journey Focus
- Test complete workflows, not isolated features
- Follow realistic user paths through the application
- Verify both happy paths and critical error scenarios

### 1.2 Test Efficiency
- **Multiple assertions per test** when testing a coherent workflow
- Avoid test duplication across journeys
- Use parallel-safe test fixtures (dedicated test games)
- Run tests in parallel whenever possible

### 1.3 Maintainability
- Page Object Model for all UI interactions
- Centralized test data and helpers
- Descriptive test names that explain the journey
- Comments explaining test prerequisites and state

---

## 2. Critical User Journeys

### 2.1 Core Game Lifecycle (Priority 1)

#### Journey 1: Game Creation and Setup
```
GM creates game → Configures settings → Opens recruitment → Reviews applications → Accepts players → Starts game
```
**Key Assertions:**
- Game appears in listings with correct status
- Settings persist correctly
- Applications workflow functions
- State transitions are atomic

#### Journey 2: Player Onboarding
```
Player discovers game → Applies → Gets accepted → Creates character → Character approved → Joins active game
```
**Key Assertions:**
- Application form validates properly
- Character creation respects game rules
- Approval notifications work
- Player sees correct game state after joining

#### Journey 3: Complete Action Phase
```
GM creates action phase → Players submit actions → GM reviews → GM resolves → Results published → Next phase
```
**Key Assertions:**
- All players can submit within deadline
- Draft vs final submission states
- GM can edit/resolve all actions
- Results visibility respects settings
- Phase transitions correctly

### 2.2 Communication Flows (Priority 1)

#### Journey 4: Common Room Discussion
```
Player posts → Others reply → Nested threading → Edit/Delete → Notifications sent
```
**Key Assertions:**
- Threading depth limits work (8 levels)
- Edit history tracked
- Delete permissions respected
- Unread indicators accurate
- Character mentions trigger notifications

#### Journey 5: Private Messaging
```
Player initiates conversation → Selects participants → Sends messages → Real-time updates → Mark as read
```
**Key Assertions:**
- Participant selection validates
- Messages appear for all participants
- Read receipts work
- Conversation list updates

### 2.3 Character Management (Priority 2)

#### Journey 6: Character Evolution
```
Create character → Add abilities → Manage inventory → Upload avatar → Track through phases
```
**Key Assertions:**
- Attribute calculations correct
- Inventory CRUD operations
- Avatar upload and display
- Character sheet permissions

#### Journey 7: NPC Management (GM)
```
GM creates NPC → Assigns to scenes → NPCs interact → Audience controls NPCs
```
**Key Assertions:**
- NPC creation workflow
- Assignment permissions
- Audience member capabilities
- NPC visibility in different contexts

### 2.4 Game Discovery (Priority 2)

#### Journey 8: Browse and Join
```
Browse games → Filter/Search → View details → Check requirements → Apply
```
**Key Assertions:**
- Filters work correctly
- Search is responsive
- Game details complete
- Application prerequisites checked

### 2.5 Administrative (Priority 3)

#### Journey 9: Game Moderation
```
GM manages players → Removes disruptive player → Archives game → Exports data
```
**Key Assertions:**
- Player removal cascades correctly
- Archive preserves data
- Export includes all content
- Permissions enforced

---

## 3. Test Data Strategy

### 3.1 Fixture Organization (Current Implementation)

```
backend/pkg/db/test_fixtures/
├── common/                         # Shared base data
│   ├── 00_reset.sql                # Database cleanup
│   └── 01_users.sql                # Test users (GM, Players 1-5, Audience)
│
├── demo/                           # Human-friendly showcase data
│   ├── 02_games_recruiting.sql     # "The Lost Mine of Phandelver" (recruiting)
│   ├── 03_games_running.sql        # "Shadows Over Innsmouth", "Heist", etc.
│   ├── 04_characters.sql           # Detailed character sheets
│   ├── 05_actions.sql              # Sample actions
│   ├── 06_results.sql              # Published results
│   ├── 09_demo_content.sql         # Rich posts and conversations
│   └── 10_deeply_nested_comments.sql  # 8-level deep comment threading
│
├── e2e/                            # Automated test fixtures
│   ├── 07_common_room.sql          # E2E Common Room games (164-167)
│   └── 08_e2e_dedicated_games.sql  # Additional E2E test games
│
├── apply_common.sh                 # Load only users + config
├── apply_demo.sh                   # Load common + demo data
├── apply_e2e.sh                    # Load common + E2E fixtures
└── apply_all.sh                    # Load everything (dev only)
```

**Load Commands:**
```bash
just load-demo    # Staging/showcase → common + demo
just load-e2e     # CI/CD testing → common + E2E
just load-all     # Development → everything
```

### 3.2 Dedicated E2E Test Games

| Game ID | Name | Purpose | Safe to Modify |
|---------|------|---------|----------------|
| 164 | E2E Common Room - Posts | Testing post creation/editing | Yes |
| 165 | E2E Common Room - Mentions | Character mention testing | Yes |
| 166 | E2E Common Room - Notifications | Notification workflows | Yes |
| 167 | E2E Common Room - Misc | General testing | Yes |
| 2 | "Curse of Strahd" | Read-only demo content | No |
| 6 | "The Lost Mine" | Pagination testing (50+ items) | No |

### 3.3 Test Data Principles

1. **Isolation**: Each test uses dedicated games to avoid conflicts
2. **Deterministic**: Known IDs and states for reliable assertions
3. **Reset Strategy**: Tests should be idempotent (work with existing data)
4. **Rich Content**: Sufficient data for realistic scenarios

---

## 4. Test Structure Guidelines

### 4.1 Test Organization

```typescript
// Good: Complete journey with multiple assertions
test('Complete action submission workflow', async ({ page }) => {
  // Login
  await loginAs(page, 'PLAYER_1');

  // Navigate to game
  const gamePage = new GameDetailsPage(page);
  await gamePage.goto(gameId);

  // Submit action (multiple related assertions)
  await gamePage.goToSubmitAction();
  await expect(page.locator('[data-testid="phase-deadline"]')).toBeVisible();
  await expect(page.locator('[data-testid="character-select"]')).toBeEnabled();
  await expect(page.locator('[data-testid="action-textarea"]')).toBeFocused();

  // Fill and submit
  await page.fill('[data-testid="action-textarea"]', 'My action...');
  await page.click('[data-testid="submit-action"]');

  // Verify submission (multiple related checks)
  await expect(page.locator('[data-testid="action-status"]')).toHaveText('Submitted');
  await expect(page.locator('[data-testid="edit-button"]')).toBeVisible();
  await expect(page.locator('[data-testid="action-content"]')).toContainText('My action');
});
```

### 4.2 Selector Strategy

**Priority Order:**
1. `data-testid` attributes (most stable)
2. ARIA labels and roles (accessibility)
3. Text content (for user-visible elements)
4. CSS classes (last resort)

```typescript
// Preferred
await page.click('[data-testid="submit-button"]');
await page.click('button[aria-label="Submit action"]');

// Acceptable
await page.click('button:has-text("Submit")');

// Avoid
await page.click('.btn-primary.submit-btn');
```

### 4.3 Assertion Patterns

```typescript
// Group related assertions
test('Game displays correct state after phase transition', async ({ page }) => {
  await transitionToNextPhase(page, gameId);

  // All related state checks in one test
  await expect(page.locator('[data-testid="phase-name"]')).toHaveText('Investigation Phase');
  await expect(page.locator('[data-testid="phase-number"]')).toHaveText('2');
  await expect(page.locator('[data-testid="phase-type"]')).toHaveText('Action');
  await expect(page.locator('[data-testid="submit-action-btn"]')).toBeEnabled();
  await expect(page.locator('[data-testid="previous-results"]')).toBeVisible();
});
```

---

## 5. Implementation Roadmap

### Phase 1: Infrastructure (Week 1)
- [ ] Create missing Page Objects for all major pages
- [ ] Standardize test helpers and utilities
- [ ] Add `data-testid` attributes to critical UI elements
- [ ] Set up parallel test execution configuration

### Phase 2: Critical Paths (Week 2-3)
- [ ] Implement Journey 1-3 (Core Game Lifecycle)
- [ ] Implement Journey 4-5 (Communication)
- [ ] Ensure all tests are parallel-safe

### Phase 3: Extended Coverage (Week 4)
- [ ] Implement Journey 6-7 (Characters)
- [ ] Implement Journey 8 (Discovery)
- [ ] Add negative test cases

### Phase 4: Polish (Week 5)
- [ ] Add Journey 9 (Admin)
- [ ] Performance assertions
- [ ] Accessibility checks
- [ ] Visual regression tests for key pages

---

## 6. Test Execution Strategy

### 6.1 Local Development
```bash
# Fast feedback - run specific journey
npm run test:e2e -- --grep "action submission"

# Before commit - run all parallel
npm run test:e2e

# Debug mode
npm run test:e2e:debug
```

### 6.2 CI Pipeline
```yaml
e2e-tests:
  strategy:
    matrix:
      shard: [1, 2, 3, 4]  # Run 4 parallel shards
  steps:
    - npm run test:e2e -- --shard=${{ matrix.shard }}/4
```

### 6.3 Test Reports
- HTML reports with screenshots on failure
- Test execution time tracking
- Flaky test detection
- Coverage mapping to user journeys

---

## 7. Maintenance Guidelines

### 7.1 When to Add E2E Tests
- New user-facing features
- Critical bug fixes
- Complex workflows spanning multiple pages
- Integration points between systems

### 7.2 When NOT to Add E2E Tests
- Pure UI component behavior (use component tests)
- Business logic (use unit tests)
- API contracts (use integration tests)
- Performance metrics (use dedicated perf tests)

### 7.3 Test Review Checklist
- [ ] Tests complete user journey, not fragments
- [ ] Uses Page Object Model
- [ ] Includes appropriate assertions (not too few, not too many)
- [ ] Is parallel-safe
- [ ] Has descriptive name and comments
- [ ] Uses stable selectors
- [ ] Handles loading states properly

---

## 8. Current Gaps to Address

### High Priority
1. **Missing Journeys**: Admin workflows, game end states
2. **Selector Fragility**: Need more data-testid attributes
3. **Test Isolation**: Some tests modify shared data
4. **Assertion Depth**: Many tests only check happy path

### Medium Priority
1. **Performance**: No tests verify response times
2. **Accessibility**: No automated a11y checks
3. **Mobile**: No responsive design tests
4. **Error Recovery**: Limited error scenario coverage

### Low Priority
1. **Visual Regression**: No screenshot comparisons
2. **Data Export**: Import/export features untested
3. **Browser Coverage**: Only testing Chrome
4. **Localization**: No i18n testing

---

## Appendix A: Helper Functions Needed

```typescript
// High-level journey helpers to implement
async function createGameAsGM(page: Page, gameData: Partial<Game>): Promise<number>
async function applyToGameAsPlayer(page: Page, gameId: number, applicationData: ApplicationData): Promise<void>
async function submitActionAsPlayer(page: Page, gameId: number, action: string): Promise<void>
async function transitionToNextPhase(page: Page, gameId: number): Promise<void>
async function createAndApproveCharacter(page: Page, gameId: number, characterData: CharacterData): Promise<number>
async function postToCommonRoom(page: Page, gameId: number, content: string): Promise<void>
async function startConversation(page: Page, participants: string[], message: string): Promise<number>
```

---

## Appendix B: Data-TestId Naming Convention

```
Format: [context]-[element]-[action?]

Examples:
- game-title-input
- character-select-dropdown
- action-submit-button
- phase-deadline-text
- common-room-post-{id}
- notification-badge-count
- conversation-list-item-{id}
```

---

*This is a living document. Update as patterns emerge and requirements evolve.*
