# Refactor Plan 01: Test Pyramid Restructuring
**Status**: Ready for Execution
**Executor**: Sonnet Model Compatible
**Estimated Effort**: 1-2 weeks

## Problem Statement
- E2E tests are brittle with hardcoded waits, fixture dependencies, and UI-heavy testing
- 15 E2E test files testing what should be integration-tested
- Backend integration tests missing for critical workflows
- Test pyramid is inverted (too many E2E, not enough integration)

## Success Criteria
✅ E2E tests reduced to 5-7 critical user journeys
✅ API integration tests cover 90% of endpoints
✅ E2E tests run in < 2 minutes
✅ Zero `waitForTimeout` in E2E tests
✅ Integration tests run in < 30 seconds

---

## Part A: Shift E2E Tests to Integration Tests

### Step 1: Identify What to Move
**For each E2E test file, categorize:**

| E2E Test | Keep as E2E | Move to Integration | New Test Type |
|----------|-------------|-------------------|---------------|
| character-mentions.spec.ts | ❌ | ✅ | API integration test |
| autocomplete.spec.ts | ❌ | ✅ | Component test |
| notification-flow.spec.ts | ❌ | ✅ | API + Component test |
| character-avatar.spec.ts | ❌ | ✅ | API upload test |
| common-room.spec.ts | Partial | Partial | Keep post creation, move mention logic |
| login-flow.spec.ts | ✅ | - | Critical path |
| game-creation-flow.spec.ts | ✅ | - | Critical path |

### Step 2: Create API Integration Tests

**Create file**: `backend/pkg/integration_tests/api_test.go`

```go
package integration_tests

import (
    "testing"
    "net/http/httptest"
    "encoding/json"
)

// Template for each endpoint test
func TestAPI_CreatePost(t *testing.T) {
    // 1. Setup test database
    db := setupTestDB(t)
    defer db.Close()

    // 2. Create test server
    app := setupApp(db)
    server := httptest.NewServer(app.Router)
    defer server.Close()

    // 3. Test the endpoint
    tests := []struct {
        name       string
        request    CreatePostRequest
        wantStatus int
        wantError  bool
    }{
        {
            name:       "valid post with mention",
            request:    CreatePostRequest{Content: "Hello @[Character Name]"},
            wantStatus: 201,
            wantError:  false,
        },
        // Add all test cases here
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            // Execute and verify
        })
    }
}
```

### Step 3: Replace E2E Tests with Integration Tests

**For each E2E test being moved:**

1. **Character Mentions** (character-mentions.spec.ts → mentions_api_test.go):
   ```go
   func TestAPI_CharacterMentions(t *testing.T) {
       // Test mention extraction
       // Test mention notifications
       // Test mention rendering
       // Test autocomplete endpoint
   }
   ```

2. **Autocomplete** (autocomplete.spec.ts → autocomplete_test.tsx):
   ```typescript
   // frontend/src/components/__tests__/Autocomplete.test.tsx
   describe('Autocomplete Component', () => {
     it('should show suggestions on @ trigger', () => {
       // Mock API call
       // Render component
       // Simulate typing @
       // Verify dropdown appears
     });
   });
   ```

3. **Notifications** (notification-flow.spec.ts → notifications_api_test.go):
   ```go
   func TestAPI_NotificationFlow(t *testing.T) {
       // Test notification creation
       // Test marking as read
       // Test notification list endpoint
   }
   ```

---

## Part B: Fix E2E Test Brittleness

### Step 1: Remove All waitForTimeout

**Search and replace pattern**:
```typescript
// BAD - Remove these
await page.waitForTimeout(1000);
await page.waitForTimeout(2000);

// GOOD - Replace with
await page.waitForLoadState('networkidle');
await expect(element).toBeVisible();
await page.waitForSelector('[data-testid="post-list"]');
```

### Step 2: Add Data Test IDs

**For each component that E2E tests interact with:**

```typescript
// Add to components
<div data-testid="common-room-container">
<button data-testid="create-post-button">
<textarea data-testid="post-content-input">
<div data-testid={`post-${post.id}`}>
<div data-testid={`comment-${comment.id}`}>
```

### Step 3: Create Page Object Models

**Create file**: `frontend/e2e/pages/CommonRoomPage.ts`

```typescript
export class CommonRoomPage {
  constructor(private page: Page) {}

  async createPost(content: string) {
    await this.page.fill('[data-testid="post-content-input"]', content);
    await this.page.click('[data-testid="create-post-button"]');
    await this.page.waitForSelector(`text="${content}"`, { state: 'visible' });
  }

  async addComment(postId: number, content: string) {
    const post = this.page.locator(`[data-testid="post-${postId}"]`);
    await post.locator('[data-testid="add-comment-button"]').click();
    await post.locator('[data-testid="comment-input"]').fill(content);
    await post.locator('[data-testid="submit-comment-button"]').click();
  }
}
```

### Step 4: Simplify E2E Tests to Critical Paths Only

**New E2E test structure**:
```
frontend/e2e/critical/
├── 01-auth-flow.spec.ts         # Login/logout only
├── 02-game-lifecycle.spec.ts    # Create game, recruit, start
├── 03-gameplay-flow.spec.ts     # Submit action, view results
├── 04-messaging-flow.spec.ts    # Send message, receive notification
└── 05-character-flow.spec.ts    # Create character, join game
```

---

## Part C: Backend Integration Test Infrastructure

### Step 1: Create Test Helpers

**Create file**: `backend/pkg/testutil/integration.go`

```go
package testutil

type IntegrationTest struct {
    DB     *sql.DB
    App    *core.App
    Server *httptest.Server
    Client *http.Client
}

func SetupIntegrationTest(t *testing.T) *IntegrationTest {
    // 1. Create test database
    // 2. Run migrations
    // 3. Create app
    // 4. Start test server
    // 5. Return test context
}

func (it *IntegrationTest) Cleanup() {
    // Close connections
    // Drop test database
}

func (it *IntegrationTest) AuthenticatedRequest(userID int32) *http.Request {
    // Create request with JWT token
}
```

### Step 2: Create API Test Suite

**Create file**: `backend/pkg/api_integration_test.go`

```go
package backend

func TestAPIIntegration(t *testing.T) {
    it := testutil.SetupIntegrationTest(t)
    defer it.Cleanup()

    t.Run("Messages", func(t *testing.T) {
        testMessageEndpoints(t, it)
    })

    t.Run("Characters", func(t *testing.T) {
        testCharacterEndpoints(t, it)
    })

    t.Run("Games", func(t *testing.T) {
        testGameEndpoints(t, it)
    })
}
```

### Step 3: Test Each API Workflow

**Template for endpoint testing**:

```go
func testMessageEndpoints(t *testing.T, it *IntegrationTest) {
    // Setup test data
    user := createTestUser(t, it.DB)
    game := createTestGame(t, it.DB, user.ID)

    t.Run("CreatePost", func(t *testing.T) {
        req := it.AuthenticatedRequest(user.ID)
        // ... test post creation
    })

    t.Run("GetPosts", func(t *testing.T) {
        // ... test fetching posts
    })

    t.Run("CreateComment", func(t *testing.T) {
        // ... test comment creation
    })
}
```

---

## Execution Checklist

### Phase 1: Backend Integration Tests (Days 1-3)
- [ ] Create `backend/pkg/testutil/integration.go`
- [ ] Create `backend/pkg/api_integration_test.go`
- [ ] Write integration tests for Messages API
- [ ] Write integration tests for Characters API
- [ ] Write integration tests for Games API
- [ ] Write integration tests for Phases API
- [ ] Write integration tests for Notifications API
- [ ] Verify all integration tests pass

### Phase 2: Frontend Component Tests (Days 4-5)
- [ ] Create Autocomplete component tests
- [ ] Create NotificationDropdown component tests
- [ ] Create CommonRoom component tests
- [ ] Create CharacterMention component tests
- [ ] Remove UI testing from E2E scope

### Phase 3: E2E Test Refactoring (Days 6-7)
- [ ] Add data-testid attributes to all interactive elements
- [ ] Create Page Object Models for each page
- [ ] Remove all waitForTimeout calls
- [ ] Reduce E2E tests to 5 critical flows
- [ ] Ensure E2E tests run in < 2 minutes

### Phase 4: Documentation (Day 8)
- [ ] Update testing documentation
- [ ] Document new integration test patterns
- [ ] Create migration guide for future tests
- [ ] Update CI/CD pipeline configuration

---

## Validation Steps

After implementation:
1. Run `just test-integration` - should complete in < 30 seconds
2. Run `npm run test:e2e` - should complete in < 2 minutes
3. Check test coverage - should be > 80% for API layer
4. Verify no flaky tests in CI for 5 consecutive runs
5. Document any remaining E2E tests that couldn't be moved

---

## Common Pitfalls to Avoid

1. **Don't test UI in integration tests** - Test API responses only
2. **Don't use real database in unit tests** - Use mocks
3. **Don't test implementation details** - Test behavior
4. **Don't create interdependent tests** - Each test should be isolated
5. **Don't ignore test performance** - Slow tests won't be run

---

## Success Metrics

**Before**:
- 15 E2E test files
- ~5 minutes E2E execution
- Frequent flaky test failures
- Heavy reliance on waitForTimeout

**After**:
- 5 E2E test files (critical paths only)
- < 2 minutes E2E execution
- 20+ integration test files
- < 30 seconds integration test execution
- Zero flaky tests
- No waitForTimeout usage
