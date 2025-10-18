# Testing Context - Read Before Writing Tests

**IMPORTANT: Always read this file before writing or modifying tests.**

## Testing Philosophy

**Tests are MANDATORY for all new features and bug fixes.**

ActionPhase follows Test-Driven Development (TDD) where practical:
1. Write failing tests first (when possible)
2. Implement the feature
3. Verify tests pass
4. Refactor with confidence

**For bug fixes: ALWAYS add a regression test that reproduces the bug before fixing it.**

## Current Test Coverage Status

**Last updated: October 2025**

### Backend Coverage
- **72 test functions** across 13 test files
- **Services WITHOUT tests** (0% coverage):
  - `pkg/db/services/messages.go` (~300 lines)
  - `pkg/db/services/conversations.go` (~250 lines)
  - `pkg/db/services/game_applications.go` (~350 lines)

### Frontend Coverage
- **2 component tests** out of 40+ components (~5% coverage)
- Components tested: LoginForm, BackendStatus
- **38+ components UNTESTED**

### Critical Gap
**Integration tests FAILING** due to schema drift - missing `is_anonymous` column in test database.

## Testing Strategy by Layer

### Backend Testing

#### 1. Unit Tests (Fast, No Database)
**Use mocks for external dependencies**

```go
func TestServiceMethod(t *testing.T) {
    tests := []struct {
        name    string
        input   interface{}
        want    interface{}
        wantErr bool
    }{
        {"success case", validInput, expectedOutput, false},
        {"error case", invalidInput, nil, true},
    }
    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            // Test implementation with mocks
        })
    }
}
```

**Run**: `just test-mocks` or `SKIP_DB_TESTS=true just test`

#### 2. Integration Tests (With Database)
**Use test database with transaction rollback**

```go
func TestServiceWithDB(t *testing.T) {
    // Setup test database
    db := setupTestDB(t)
    defer db.Close()

    tx, _ := db.Begin(context.Background())
    defer tx.Rollback(context.Background())

    // Run test within transaction
    service := NewService(tx)
    result, err := service.Method(ctx, input)

    // Assertions
    assert.NoError(t, err)
    assert.Equal(t, expected, result)
}
```

**Run**: `SKIP_DB_TESTS=false just test-integration`

#### 3. API Endpoint Tests
**Test complete HTTP request/response cycle**

- Test authentication and authorization
- Test input validation and error responses
- Test success paths with proper status codes
- Test edge cases and boundary conditions

#### 3. E2E Tests (Playwright)
**⚠️ CRITICAL: READ BEFORE WRITING E2E TESTS**

**THE GOLDEN RULE: E2E tests are the LAST step, not the first.**

E2E tests have long feedback loops (~20-30 seconds) and limited debugging visibility. They are expensive to run and debug. **NEVER write E2E tests until lower-level tests pass.**

**MANDATORY Pre-E2E Test Checklist:**
```bash
# 1. Backend unit test MUST pass
SKIP_DB_TESTS=true go test ./pkg/db/services -run TestFeature -v

# 2. API endpoint MUST return correct data
curl -X POST http://localhost:3000/api/v1/endpoint -d '...' | jq '.field'

# 3. Frontend component MUST render correctly
npm test -- ComponentName.test.tsx

# 4. System verification MUST pass
curl -sf http://localhost:3000/health  # Backend
curl -sf http://localhost:5173         # Frontend
```

**Only after ALL four pass, write E2E test.**

**E2E Test Structure Rules:**

1. **One Concern Per Test**
   ```typescript
   // ❌ BAD: Multiple concerns
   test('feature works', async () => {
     // autocomplete + submission + rendering + validation
   });

   // ✅ GOOD: Single concern
   test('autocomplete appears when typing trigger character', async () => {
     await input.pressSequentially('@');
     await expect(dropdown).toBeVisible();
   });
   ```

2. **Synchronous Execution (No Background &)**
   ```bash
   # ❌ BAD: Background execution - cannot see output
   npx playwright test feature.spec.ts &

   # ✅ GOOD: Foreground with output capture
   npx playwright test feature.spec.ts --reporter=list 2>&1 | tee /tmp/e2e.log
   ```

3. **Explicit Waits (Not Arbitrary Timeouts)**
   ```typescript
   // ❌ BAD: Arbitrary timeout
   await page.waitForTimeout(3000);

   // ✅ GOOD: Wait for specific condition
   await page.waitForSelector('[data-testid="element"]', { state: 'visible' });
   await page.waitForResponse(resp => resp.url().includes('/api/'));
   ```

4. **Semantic Selectors with data-testid**
   ```typescript
   // ❌ BAD: Generic/fragile selectors
   const button = page.locator('button').first();
   const element = page.locator('.class-name');

   // ✅ GOOD: Explicit test IDs
   const submitBtn = page.locator('[data-testid="submit-button"]');
   const mention = page.locator('[data-mention-id="123"]');
   ```

5. **Debugging Visibility**
   ```typescript
   // Add to test setup
   page.on('console', msg => console.log(`BROWSER: ${msg.text()}`));
   page.on('pageerror', err => console.log(`ERROR: ${err.message}`));
   page.on('response', resp => {
     if (resp.url().includes('/api/')) {
       console.log(`API: ${resp.status()} ${resp.url()}`);
     }
   });
   ```

**E2E Development Workflow:**
```typescript
// Step 1: Just navigation (verify routing works)
test('can navigate to page', async ({ page }) => {
  await page.goto('http://localhost:5173/path');
  await expect(page.locator('h1')).toContainText('Expected Title');
});

// Step 2: Add interaction (once Step 1 passes)
test('can type in input', async ({ page }) => {
  await page.goto('http://localhost:5173/path');
  await page.fill('[data-testid="input"]', 'test');
  await expect(page.locator('[data-testid="input"]')).toHaveValue('test');
});

// Step 3: Add behavior (once Step 2 passes)
test('shows result when submitting', async ({ page }) => {
  // ... build on previous steps
});
```

**Common E2E Failures & Solutions:**

| Failure | Likely Cause | Fix |
|---------|-------------|-----|
| Element not found | Generic selector, element not rendered | Use data-testid, verify component test passes |
| Timeout waiting | API slow, data not loaded | Wait for API response, check network logs |
| Flaky test | Race condition, async state | Use explicit waits, verify event handlers |
| Element not visible | Wrong selector, CSS hiding element | Inspect screenshot, verify element exists in DOM |

**See**: `.claude/planning/AI_E2E_TESTING_STRATEGY.md` for comprehensive guide

**Run**: `npx playwright test --reporter=list`

### Frontend Testing

#### 1. Component Tests (React Testing Library)
**Test user interactions, not implementation details**

```typescript
describe('ComponentName', () => {
  it('renders with initial state', () => {
    render(<ComponentName />);
    expect(screen.getByText('Expected Text')).toBeInTheDocument();
  });

  it('handles user interaction', async () => {
    render(<ComponentName />);
    await userEvent.click(screen.getByRole('button'));
    expect(screen.getByText('Updated Text')).toBeInTheDocument();
  });

  it('handles error state', () => {
    render(<ComponentName error={mockError} />);
    expect(screen.getByText(/error/i)).toBeInTheDocument();
  });
});
```

**Run**: `just test-frontend`

#### 2. Custom Hook Tests
**Use @testing-library/react-hooks**

```typescript
import { renderHook, act } from '@testing-library/react-hooks';

describe('useCustomHook', () => {
  it('returns initial state', () => {
    const { result } = renderHook(() => useCustomHook());
    expect(result.current.value).toBe(initialValue);
  });

  it('updates state on action', () => {
    const { result } = renderHook(() => useCustomHook());
    act(() => {
      result.current.action();
    });
    expect(result.current.value).toBe(updatedValue);
  });
});
```

## Test Requirements by Task Type

### New Features
1. **Write tests FIRST** (TDD approach)
2. Unit tests for business logic
3. Integration tests for database operations
4. Component tests for UI elements
5. Coverage goal: 80%+ for critical paths

### Bug Fixes (MANDATORY Process)
1. **Write failing test** that reproduces the bug
2. Verify test fails
3. Fix the bug
4. Verify test now passes
5. Commit test and fix together

**Example**:
```bash
# 1. Write test that reproduces bug
go test ./pkg/db/services -run TestBugFix -v  # Should FAIL

# 2. Fix the bug in code

# 3. Verify test passes
go test ./pkg/db/services -run TestBugFix -v  # Should PASS
```

### Refactoring
1. Ensure existing tests pass BEFORE refactoring
2. Add new tests for uncovered edge cases
3. Run full test suite after refactoring
4. Tests should pass without modification

## Test Data & Fixtures

**Location**: `/backend/pkg/db/test_fixtures/`

- `00_reset.sql` - Clean database state
- `01_users.sql` - Test users
- `02_games_recruiting.sql` - Games in recruitment
- `03_games_running.sql` - Active games
- `04_characters.sql` - Test characters
- `05_actions.sql` - Test actions
- `06_results.sql` - Test results

**Read**: `.claude/context/TEST_DATA.md` for detailed fixture information

## Common Testing Patterns

### Backend: Table-Driven Tests
```go
tests := []struct {
    name    string
    input   RequestType
    want    ResponseType
    wantErr bool
}{
    {
        name: "valid input",
        input: RequestType{Field: "value"},
        want: ResponseType{Result: "expected"},
        wantErr: false,
    },
    {
        name: "invalid input",
        input: RequestType{Field: ""},
        want: ResponseType{},
        wantErr: true,
    },
}
```

### Backend: Mock Interfaces
```go
type MockService struct {
    GetUserFunc func(ctx context.Context, id int) (*User, error)
}

func (m *MockService) GetUser(ctx context.Context, id int) (*User, error) {
    if m.GetUserFunc != nil {
        return m.GetUserFunc(ctx, id)
    }
    return nil, errors.New("not implemented")
}
```

### Frontend: MSW for API Mocking
```typescript
import { rest } from 'msw';
import { setupServer } from 'msw/node';

const server = setupServer(
  rest.get('/api/v1/games', (req, res, ctx) => {
    return res(ctx.json({ data: mockGames }));
  })
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

### Frontend: Query Client Wrapper
```typescript
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return ({ children }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};
```

## Test Commands Reference

### Backend
```bash
# Fast unit tests (no database)
just test-mocks

# Integration tests (requires database)
SKIP_DB_TESTS=false just test-integration

# All tests
just test

# With coverage
just test-coverage

# Race detection
just test-race

# Specific package
go test ./pkg/db/services -v

# Specific test
go test ./pkg/db/services -run TestSpecificTest -v
```

### Frontend
```bash
# All tests
just test-frontend

# Watch mode
just test-frontend-watch

# With coverage
just test-frontend-coverage

# Specific test file
npm test -- ComponentName.test.tsx
```

## Next Steps for Test Improvement

**See**: `/docs/TEST_COVERAGE_ANALYSIS.md` for comprehensive 8-week improvement plan

**Immediate priorities**:
1. Fix schema drift in test database
2. Add regression tests for recent bug fixes
3. Test critical services (messages, conversations, game_applications)
4. Establish MSW setup for frontend
5. Test critical user flows

## References

- **Detailed Strategy**: `/docs/adrs/007-testing-strategy.md`
- **Coverage Analysis**: `/docs/TEST_COVERAGE_ANALYSIS.md`
- **Implementation Guide**: `.claude/reference/TESTING_GUIDE.md`
- **Test Fixtures**: `.claude/context/TEST_DATA.md`

## Quick Checklist Before Committing

- [ ] All new features have tests
- [ ] Bug fixes include regression tests
- [ ] All tests pass locally
- [ ] Coverage maintained or improved
- [ ] No commented-out test code
- [ ] Test names clearly describe what they test
