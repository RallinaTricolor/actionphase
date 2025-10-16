# Test Coverage Analysis & Improvement Plan

**Date**: 2025-10-16
**Status**: MVP Complete - Transitioning to Regression Prevention Phase
**Goal**: Achieve comprehensive test coverage to prevent regressions as new features are added

---

## Executive Summary

ActionPhase has reached MVP completion with core functionality implemented across:
- Authentication & authorization
- Game management with state machine
- Character creation and management
- Phase-based gameplay (action & common_room phases)
- Private messaging & conversations
- Application review workflow

**Current Test Coverage Status**:
- **Backend**: ~72 test functions across 13 test files (**INADEQUATE** - many critical paths untested)
- **Frontend**: Only 2 component tests (LoginForm, BackendStatus) (**CRITICAL GAP**)
- **Integration Tests**: Exist but currently **FAILING** due to schema drift
- **E2E Tests**: **NON-EXISTENT**

**Critical Issues**:
1. **Schema Drift**: Test database missing recent migrations (`is_anonymous`, `is_published` columns)
2. **Untested Services**: `messages.go`, `conversations.go`, `game_applications.go` have **NO** unit tests
3. **Frontend Coverage**: <5% of components have tests
4. **No Regression Tests**: Recent bugs (GM application prevention) had no tests preventing recurrence
5. **Test Infrastructure**: Missing test fixtures, builders, and utilities per ADR-007

---

## Part 1: ADR Evaluation & Required Updates

### ADR-003: Authentication Strategy ✅ **MOSTLY CURRENT**

**Status**: Generally aligned with implementation
**Discrepancy Found**:
- ADR documents JWT contains `user_id` in payload
- **Recent security fix (this session)**: Removed `user_id` from JWT payload, now fetched from `/auth/me` endpoint

**Required Update**:
```markdown
## Section to Update: JWT Token Structure (Line 155-164)

OLD:
{
  "sub": "user-123",
  "username": "player1",
  "exp": 1625097600,
  "iat": 1625096700,
  "jti": "token-uuid"
}

NEW:
{
  "sub": "username",  // Changed from user-123 to actual username
  "exp": 1625097600,
  "iat": 1625096700,
  "jti": "token-uuid"
}

Note: user_id is NO LONGER in JWT for security reasons.
User ID is fetched from /api/v1/auth/me endpoint after token validation.
```

**Impact**: Low - documentation only, implementation is more secure than documented

---

### ADR-005: Frontend State Management ✅ **REQUIRES SIGNIFICANT UPDATE**

**Status**: **MAJOR REFACTOR COMPLETED** (this session)
**Changes Implemented**:
1. **Migrated to unified AuthContext** - Completed state management refactor
2. **Centralized user data fetching** - AuthProvider now single source of truth
3. **Eliminated JWT decoding** - Removed client-side JWT parsing
4. **Reduced API calls** - 60-70% reduction in duplicate user fetches

**Required Update**:
```markdown
## Add New Section: "Recent Refactoring (2025-10)"

### Authentication State Consolidation

We completed a major refactoring to eliminate duplicate user fetching across components:

**Changes**:
- Created unified `AuthContext` at `frontend/src/contexts/AuthContext.tsx`
- Migrated from per-component user fetching to single AuthProvider
- Removed JWT decoding functions from components (security improvement)
- Updated 15+ components to use centralized `useAuth()` hook

**Benefits**:
- Single source of truth for authentication state
- 60-70% reduction in API calls
- Improved security (no client-side JWT parsing)
- Better loading state management with `isCheckingAuth`

**Components Updated**:
- GameDetailsPage, CommonRoom, ActionSubmission
- GamesList, CharactersList, PrivateMessages
- + 10 more components

**Pattern**:
```typescript
// OLD (per-component):
const [currentUserId, setCurrentUserId] = useState<number | null>(null);
useEffect(() => {
  const fetchUser = async () => {
    const userData = await apiClient.getCurrentUser();
    setCurrentUserId(userData.id);
  };
  fetchUser();
}, []);

// NEW (centralized):
const { currentUser, isCheckingAuth } = useAuth();
const currentUserId = currentUser?.id ?? null;
```

**Files**:
- Core: `frontend/src/contexts/AuthContext.tsx`
- Hook: Exports `useAuth()` custom hook
- App: Wrapped in `<AuthProvider>` in `App.tsx`
```

---

### ADR-007: Testing Strategy ❌ **MAJOR GAP - NOT IMPLEMENTED**

**Status**: **CRITICAL** - ADR documents comprehensive testing strategy but **implementation is far behind**

**Documented vs. Actual**:

| Testing Layer | ADR-007 Requirement | Current Status | Gap |
|---------------|---------------------|----------------|-----|
| Backend Unit Tests | Interface mocks, all services | 13 test files, 72 tests | **~40% coverage** |
| Backend Integration | DB tests with transactions | Exist but FAILING (schema drift) | **BROKEN** |
| Backend API Tests | E2E HTTP endpoint tests | Minimal | **~20% coverage** |
| Frontend Unit Tests | All components + hooks | **2 files only** | **~5% coverage** |
| Frontend Integration | Multi-component tests | **NONE** | **0%** |
| Frontend E2E | Playwright tests | **NONE** | **0%** |
| Test Data Builders | Factories & fixtures | Test fixtures exist but incomplete | **30%** |
| Performance Tests | Benchmarks | **NONE** | **0%** |

**Required Actions**: See Part 3 for comprehensive improvement plan

---

### Other ADRs: ✅ **CURRENT**

- **ADR-001 (Technology Stack)**: Accurate, no changes needed
- **ADR-002 (Database Design)**: Accurate, JSONB usage aligns with implementation
- **ADR-004 (API Design)**: Accurate, RESTful patterns followed
- **ADR-006 (Observability)**: Accurate, logging/metrics infrastructure matches

---

## Part 2: Current Test Coverage Assessment

### Backend Test Coverage

#### ✅ **Well-Tested Areas** (60-80% coverage estimated):
1. **Authentication** (`pkg/auth/`):
   - `auth_integration_test.go` - Login/register/refresh flows
   - `auth_api_integration_test.go` - HTTP API tests
   - `sessions_test.go` - Session management

2. **Games Service** (`pkg/db/services/games.go`):
   - `games_test.go` - Core game operations
   - `games_integration_test.go` - Database integration
   - **72 test functions total** covering state transitions

3. **Characters** (`pkg/db/services/characters.go`):
   - `characters_test.go` - Character CRUD
   - `characters_integration_test.go` - Workflow tests
   - `character_workflow_test.go` - Complex scenarios

4. **Phases** (`pkg/db/services/phases.go`):
   - `phases_test.go` - Phase management
   - State transitions and deadlines

#### ❌ **CRITICAL GAPS - Untested Services**:

1. **Messages Service** (`pkg/db/services/messages.go`): **0% coverage**
   - Private message creation
   - Thread management
   - Read status tracking
   - **~300 lines of code - NO TESTS**

2. **Conversations Service** (`pkg/db/services/conversations.go`): **0% coverage**
   - Conversation creation
   - Participant management
   - Conversation retrieval with participants
   - **~250 lines of code - NO TESTS**

3. **Game Applications** (`pkg/db/services/game_applications.go`): **0% coverage**
   - Application submission (GM prevention bug was here!)
   - Application approval/rejection
   - Bulk operations
   - Participant conversion
   - **~350 lines of code - NO TESTS**

4. **Users Service** (`pkg/db/services/users.go`): **Partial coverage**
   - User creation tested
   - User updates/queries **NOT tested**

#### ⚠️ **Test Infrastructure Issues**:

1. **Schema Drift**: Tests failing with:
   ```
   ERROR: column "is_anonymous" of relation "games" does not exist
   ```
   **Root Cause**: Test database not running latest migrations

2. **Missing Test Utilities**:
   - Test data builders mentioned in ADR-007 **not fully implemented**
   - `test_factories_example_test.go` exists but incomplete
   - No standardized mock patterns for all interfaces

3. **Fixture Management**:
   - `backend/pkg/db/test_fixtures/` directory exists with SQL files
   - Not integrated into test workflow
   - Manual SQL vs. programmatic builders inconsistency

### Frontend Test Coverage

#### ✅ **Tested Components** (5% coverage):
1. **LoginForm.test.tsx** - Form submission, validation
2. **BackendStatus.test.tsx** - Connection status display

#### ❌ **CRITICAL GAPS - 38 Untested Components**:

**High Priority (User-Facing Critical Paths)**:
1. **GameDetailsPage** - Game detail view, main hub (~630 lines, **0 tests**)
2. **GamesList** - Game discovery (just fixed GM bug, **0 tests**)
3. **CharacterSheet** - Character display/edit (complex state, **0 tests**)
4. **ActionSubmission** - Action submission form (complex validation, **0 tests**)
5. **PhaseManagement** - GM phase controls (critical game flow, **0 tests**)
6. **PrivateMessages** - Messaging UI (complex state, **0 tests**)
7. **ConversationList** - Conversation display (just fixed dedup bug, **0 tests**)
8. **GameApplicationCard** - Application review (just fixed button bug, **0 tests**)

**Medium Priority (Supporting Components)**:
9. **ApplyToGameModal** - Application submission
10. **CreateGameForm** - Game creation
11. **CreateCharacterModal** - Character creation
12. **EditGameModal** - Game editing
13. **CommonRoom** - Common room phase UI
14. **PhaseHistoryView** - Phase history display

**Low Priority (Simple Components)**:
15-38. Various utility components (Modal, ErrorDisplay, etc.)

#### ❌ **Missing Test Infrastructure**:

1. **No Test Setup Files**:
   - Missing `frontend/src/__tests__/setup.ts`
   - No MSW (Mock Service Worker) setup for API mocking
   - No React Query test utilities

2. **No Custom Hook Tests**:
   - `frontend/src/hooks/` - **0 test files** despite having:
     - `useAuth.ts`
     - `useActionResults.ts`
     - `useErrorHandler.ts`

3. **No Integration Tests**:
   - No multi-component interaction tests
   - No complete user flow tests

4. **No E2E Tests**:
   - No Playwright configuration
   - No end-to-end user journeys

---

## Part 3: Comprehensive Test Improvement Plan

### Phase 1: Foundation (Week 1) - **CRITICAL**

**Goal**: Fix broken tests and establish test infrastructure

#### Backend Tasks:

**1.1 Fix Schema Drift** ⚠️ **BLOCKING**
```bash
# Apply all migrations to test database
just migrate_test

# Or reset test DB entirely
just db_reset
just db_create
just migrate_test
```

**Test Command**:
```bash
SKIP_DB_TESTS=false go test ./pkg/db/services -v
```

**Success Criteria**: All existing integration tests pass

**1.2 Create Test Utilities Package**
```go
// backend/pkg/testutil/builders.go

type GameBuilder struct {
    game *core.Game
}

func NewGameBuilder() *GameBuilder {
    return &GameBuilder{
        game: &core.Game{
            Title:       "Test Game",
            Description: "Test Description",
            GMUserID:    1,
            State:       core.GameStateSetup,
            MaxPlayers:  4,
            IsPublic:    true,
            IsAnonymous: false, // NEW FIELD
            GameConfig:  make(map[string]interface{}),
        },
    }
}

func (b *GameBuilder) WithGM(userID int32) *GameBuilder {
    b.game.GMUserID = userID
    return b
}

func (b *GameBuilder) WithState(state string) *GameBuilder {
    b.game.State = state
    return b
}

func (b *GameBuilder) AsAnonymous() *GameBuilder {
    b.game.IsAnonymous = true
    return b
}

func (b *GameBuilder) Build() *core.Game {
    return b.game
}

// Similar builders for: User, Character, Phase, Application, Message
```

**1.3 Standardize Mock Interfaces**
```go
// backend/pkg/testutil/mocks.go

type MockGameService struct {
    CreateGameFunc   func(ctx context.Context, game *core.Game) (*core.Game, error)
    GetGameFunc      func(ctx context.Context, id int32) (*core.Game, error)
    UpdateGameFunc   func(ctx context.Context, game *core.Game) error
    // ... all interface methods
}

// Implement all methods with fallback to "not implemented" error
// Apply pattern to: UserService, CharacterService, etc.
```

#### Frontend Tasks:

**1.4 Setup Frontend Test Infrastructure**

Create `frontend/vitest.setup.ts`:
```typescript
import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
import { server } from './src/mocks/server';

// Setup MSW
beforeAll(() => server.listen());
afterEach(() => {
  cleanup();
  server.resetHandlers();
});
afterAll(() => server.close());
```

Create `frontend/src/mocks/server.ts`:
```typescript
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';

export const handlers = [
  // Auth endpoints
  http.post('/api/v1/auth/login', () => {
    return HttpResponse.json({
      data: {
        token: 'mock-token',
        user: { id: 1, username: 'testuser' }
      }
    });
  }),

  // Games endpoints
  http.get('/api/v1/games', () => {
    return HttpResponse.json({
      data: [
        { id: 1, title: 'Test Game', state: 'recruitment' }
      ]
    });
  }),

  // Add all critical API endpoints
];

export const server = setupServer(...handlers);
```

**1.5 Create Test Utilities**
```typescript
// frontend/src/test-utils/render.tsx

export function renderWithProviders(
  ui: React.ReactElement,
  {
    preloadedState = {},
    ...renderOptions
  } = {}
) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <BrowserRouter>
            {children}
          </BrowserRouter>
        </AuthProvider>
      </QueryClientProvider>
    );
  }

  return { ...render(ui, { wrapper: Wrapper, ...renderOptions }), queryClient };
}

// Export commonly used testing utilities
export * from '@testing-library/react';
export { renderWithProviders as render };
```

**Success Criteria**: Test infrastructure allows easy component testing

---

### Phase 2: Critical Path Coverage (Week 2-3)

**Goal**: Test recent bug fixes and critical user journeys

#### Backend Priority Tests:

**2.1 Game Applications Service** (Fix recent GM bug)
```go
// backend/pkg/db/services/game_applications_test.go

func TestGameApplicationService_GMCannotApply(t *testing.T) {
    // Regression test for GM application prevention bug

    pool := testutil.SetupTestDB(t)
    defer testutil.CleanupTestDB(t, pool)

    service := &GameApplicationService{DB: pool}

    // Create game with GM
    game := testutil.NewGameBuilder().
        WithGM(123).
        WithState(core.GameStateRecruitment).
        Build()
    createdGame := testutil.CreateGame(t, pool, game)

    // Attempt to apply as GM should fail
    req := core.CreateGameApplicationRequest{
        GameID: createdGame.ID,
        UserID: 123, // Same as GM
        Role:   core.RolePlayer,
    }

    _, err := service.CreateGameApplication(context.Background(), req)

    require.Error(t, err)
    assert.Contains(t, err.Error(), "game master cannot apply")
}

func TestGameApplicationService_ApprovalFlow(t *testing.T) {
    // Test complete approval workflow
}

func TestGameApplicationService_BulkOperations(t *testing.T) {
    // Test bulk approve/reject
}

// Add 10+ more tests covering all operations
```

**2.2 Messages & Conversations Services**
```go
// backend/pkg/db/services/messages_test.go

func TestMessageService_CreateMessage(t *testing.T) {
    // Test message creation
}

func TestMessageService_GetConversationMessages(t *testing.T) {
    // Test message retrieval
}

func TestMessageService_MarkAsRead(t *testing.T) {
    // Test read status updates
}

// backend/pkg/db/services/conversations_test.go

func TestConversationService_CreateConversation(t *testing.T) {
    // Test conversation creation
}

func TestConversationService_DeduplicationBug(t *testing.T) {
    // Regression test for duplicate conversation bug
}

func TestConversationService_ParticipantFiltering(t *testing.T) {
    // Test smart participant filtering
}
```

**Estimated**: 30+ new test functions across 3 service files

#### Frontend Priority Tests:

**2.3 Test Recent Bug Fixes**
```typescript
// frontend/src/components/__tests__/GamesList.test.tsx

describe('GamesList', () => {
  it('hides Apply button when user is GM', async () => {
    // Regression test for GM application bug
    const currentUser = { id: 1, username: 'gm-user' };

    server.use(
      http.get('/api/v1/auth/me', () => {
        return HttpResponse.json({ data: currentUser });
      }),
      http.get('/api/v1/games', () => {
        return HttpResponse.json({
          data: [{
            id: 1,
            title: 'My Game',
            state: 'recruitment',
            gm_user_id: 1 // Same as current user
          }]
        });
      })
    );

    render(<GamesList />);

    await waitFor(() => {
      expect(screen.getByText('My Game')).toBeInTheDocument();
    });

    // Apply button should NOT be present
    expect(screen.queryByText(/apply to join/i)).not.toBeInTheDocument();
  });

  it('shows Apply button for non-GM users', async () => {
    // Test normal flow
  });
});

// frontend/src/components/__tests__/ConversationList.test.tsx

describe('ConversationList', () => {
  it('deduplicates conversations when user owns multiple characters', async () => {
    // Regression test for duplicate conversation bug

    server.use(
      http.get('/api/v1/games/:gameId/conversations', () => {
        return HttpResponse.json({
          data: {
            conversations: [
              { id: 1, title: 'Conversation 1' },
              { id: 1, title: 'Conversation 1' }, // Duplicate
              { id: 2, title: 'Conversation 2' }
            ]
          }
        });
      })
    );

    render(<ConversationList gameId={1} onSelectConversation={vi.fn()} />);

    await waitFor(() => {
      const items = screen.getAllByRole('button');
      expect(items).toHaveLength(2); // Should be deduplicated
    });
  });
});

// frontend/src/components/__tests__/GameApplicationCard.test.tsx

describe('GameApplicationCard', () => {
  it('shows both approve and reject buttons for pending applications', () => {
    // Regression test for button visibility bug

    const application = {
      id: 1,
      status: 'pending',
      user_id: 123,
      username: 'player1',
      role: 'player'
    };

    render(
      <GameApplicationCard
        application={application}
        isGM={true}
        gameState="recruitment"
        onApprove={vi.fn()}
        onReject={vi.fn()}
      />
    );

    expect(screen.getByText('Approve')).toBeInTheDocument();
    expect(screen.getByText('Reject')).toBeInTheDocument();
  });

  it('shows only reject button for approved applications', () => {
    // Test approved state
  });
});
```

**2.4 Test Critical User Journeys**
```typescript
// frontend/src/components/__tests__/GameDetailsPage.test.tsx

describe('GameDetailsPage', () => {
  describe('Game Master View', () => {
    it('renders GM controls when user is GM', async () => {
      // Test GM-specific UI
    });

    it('allows GM to manage phases', async () => {
      // Test phase management
    });

    it('allows GM to review applications', async () => {
      // Test application review
    });
  });

  describe('Player View', () => {
    it('renders player controls when user is participant', async () => {
      // Test player-specific UI
    });

    it('allows player to submit actions', async () => {
      // Test action submission
    });

    it('shows private messages tab', async () => {
      // Test messaging UI
    });
  });

  describe('Visitor View', () => {
    it('shows apply button when game is recruiting', async () => {
      // Test visitor flow
    });

    it('hides apply button for GM', async () => {
      // Regression test
    });
  });
});
```

**Estimated**: 50+ new test cases across 8-10 component test files

---

### Phase 3: Comprehensive Coverage (Week 4-6)

**Goal**: Achieve 80%+ test coverage across all layers

#### Backend Tasks:

**3.1 Complete Service Layer Coverage**
- Users Service: 15+ tests
- Sessions Service: 10+ tests
- Phases Service: 20+ tests (complex state machine)
- All CRUD operations
- All business logic validation
- All error conditions

**3.2 API Handler Tests**
```go
// backend/pkg/games/api_test.go additions

func TestGameAPI_CreateGame_Validation(t *testing.T) {
    // Test all validation rules
}

func TestGameAPI_UpdateGame_Authorization(t *testing.T) {
    // Test authorization rules
}

// Similar for: characters, phases, messages, conversations
```

**3.3 Integration Test Suite**
```go
// backend/tests/integration/complete_game_flow_test.go

func TestCompleteGameLifecycle(t *testing.T) {
    // Test entire game lifecycle from creation to completion
    // 1. Create game
    // 2. Accept applications
    // 3. Transition to character_creation
    // 4. Create characters
    // 5. Start game
    // 6. Run multiple phases
    // 7. Complete game
}
```

#### Frontend Tasks:

**3.4 Component Test Coverage**

Test all 38 components, priority order:
1. Critical paths (8 components) - Week 4
2. Supporting components (14 components) - Week 5
3. Utility components (16 components) - Week 6

**3.5 Custom Hook Tests**
```typescript
// frontend/src/hooks/__tests__/useAuth.test.ts

describe('useAuth', () => {
  it('initializes with stored token', async () => {
    // Test token initialization
  });

  it('refreshes token automatically', async () => {
    // Test automatic token refresh
  });

  it('clears auth on logout', async () => {
    // Test logout flow
  });
});

// Similar for: useActionResults, useErrorHandler, etc.
```

**3.6 Integration Tests**
```typescript
// frontend/src/__tests__/integration/game-creation-flow.test.tsx

describe('Game Creation Flow', () => {
  it('allows authenticated user to create game', async () => {
    // Test complete game creation flow
    // 1. Navigate to games page
    // 2. Click create game
    // 3. Fill form
    // 4. Submit
    // 5. Verify game appears
  });
});

// Similar for:
// - Character creation flow
// - Application submission flow
// - Action submission flow
// - Message sending flow
```

---

### Phase 4: E2E & Performance (Week 7-8)

**Goal**: Add E2E tests and performance testing

#### E2E Tests:

**4.1 Setup Playwright**
```bash
npm install -D @playwright/test
npx playwright install
```

**4.2 Critical User Journeys**
```typescript
// frontend/e2e/game-lifecycle.spec.ts

test('complete game lifecycle as GM', async ({ page }) => {
  // Login as GM
  await page.goto('/login');
  await page.fill('[name="username"]', 'gm-user');
  await page.fill('[name="password"]', 'password');
  await page.click('button[type="submit"]');

  // Create game
  await page.goto('/games');
  await page.click('text=Create Game');
  await page.fill('[name="title"]', 'E2E Test Game');
  await page.click('button:has-text("Create")');

  // Start recruitment
  await page.click('text=Start Recruitment');

  // ... complete flow
});

// Similar tests for:
// - Player joining game
// - Character creation
// - Phase progression
// - Messaging
```

#### Performance Tests:

**4.3 Backend Benchmarks**
```go
// backend/pkg/db/services/games_benchmark_test.go

func BenchmarkGameService_CreateGame(b *testing.B) {
    pool := benchutil.SetupBenchDB(b)
    defer benchutil.CleanupBenchDB(b, pool)

    service := &GameService{DB: pool}
    game := testutil.NewGameBuilder().Build()

    b.ResetTimer()
    for i := 0; i < b.N; i++ {
        game.Title = fmt.Sprintf("Benchmark Game %d", i)
        _, err := service.CreateGame(context.Background(), game)
        if err != nil {
            b.Fatal(err)
        }
    }
}

// Benchmarks for all database operations
```

**4.4 Frontend Performance Tests**
```typescript
// frontend/src/__tests__/performance/render-performance.test.tsx

describe('Render Performance', () => {
  it('renders GamesList with 100 games in <500ms', () => {
    const games = Array.from({ length: 100 }, (_, i) => ({
      id: i,
      title: `Game ${i}`,
      state: 'recruitment'
    }));

    const start = performance.now();
    render(<GamesList />);
    const end = performance.now();

    expect(end - start).toBeLessThan(500);
  });
});
```

---

## Part 4: Testing Standards & Best Practices

### Backend Testing Standards

**Test Naming Convention**:
```go
func TestServiceName_MethodName_Scenario(t *testing.T) {
    // Example: TestGameService_CreateGame_Success
}
```

**Table-Driven Tests**:
```go
func TestGameValidation(t *testing.T) {
    tests := []struct {
        name    string
        game    *core.Game
        wantErr bool
        errMsg  string
    }{
        {
            name: "valid game",
            game: NewGameBuilder().Build(),
            wantErr: false,
        },
        {
            name: "missing title",
            game: NewGameBuilder().WithTitle("").Build(),
            wantErr: true,
            errMsg: "title is required",
        },
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            err := validateGame(tt.game)
            if tt.wantErr {
                require.Error(t, err)
                assert.Contains(t, err.Error(), tt.errMsg)
            } else {
                require.NoError(t, err)
            }
        })
    }
}
```

**Test Isolation**:
```go
// Always use database transactions for test isolation
func TestGameService(t *testing.T) {
    pool := testutil.SetupTestDB(t)
    defer testutil.CleanupTestDB(t, pool)

    testutil.WithTransaction(t, pool, func(tx pgx.Tx) {
        service := &GameService{DB: pool}
        // All operations within transaction
        // Automatically rolled back after test
    })
}
```

### Frontend Testing Standards

**Test File Location**:
```
src/components/GamesList.tsx
src/components/__tests__/GamesList.test.tsx  // Prefer co-location
```

**Test Structure**:
```typescript
describe('ComponentName', () => {
  describe('Feature/Scenario', () => {
    it('does something specific', () => {
      // Arrange
      // Act
      // Assert
    });
  });
});
```

**User-Centric Testing**:
```typescript
// GOOD - Test user behavior
it('shows error message when login fails', async () => {
  render(<LoginForm />);

  fireEvent.change(screen.getByLabelText(/username/i), {
    target: { value: 'baduser' }
  });
  fireEvent.click(screen.getByRole('button', { name: /login/i }));

  expect(await screen.findByText(/invalid credentials/i))
    .toBeInTheDocument();
});

// BAD - Test implementation details
it('calls setState when input changes', () => {
  // Don't test React internals
});
```

**Mock External Dependencies**:
```typescript
// Use MSW for API mocking
server.use(
  http.post('/api/v1/auth/login', () => {
    return HttpResponse.json(
      { error: 'Invalid credentials' },
      { status: 401 }
    );
  })
);
```

---

## Part 5: Success Metrics & Monitoring

### Coverage Targets

**Phase 1 (Foundation)**: Week 1
- ✅ All tests passing
- ✅ Test infrastructure complete
- Target: 0% → 15% coverage

**Phase 2 (Critical Paths)**: Week 2-3
- ✅ Recent bugs have regression tests
- ✅ Critical services tested
- Target: 15% → 50% coverage

**Phase 3 (Comprehensive)**: Week 4-6
- ✅ All services >80% coverage
- ✅ All critical components tested
- Target: 50% → 80% coverage

**Phase 4 (E2E & Performance)**: Week 7-8
- ✅ E2E tests for user journeys
- ✅ Performance benchmarks established
- Target: 80% → 85% coverage + E2E

### Coverage Commands

**Backend**:
```bash
# Unit tests only (fast)
SKIP_DB_TESTS=true go test ./pkg/... -cover

# Integration tests
SKIP_DB_TESTS=false go test ./pkg/... -cover

# Coverage report
go test ./pkg/... -coverprofile=coverage.out
go tool cover -html=coverage.out

# Target: >85% line coverage
```

**Frontend**:
```bash
# Unit tests
npm run test

# Coverage report
npm run test:coverage

# Target: >80% line coverage
```

### CI Integration

**GitHub Actions Workflow**:
```yaml
name: Test Suite

on: [push, pull_request]

jobs:
  backend-tests:
    steps:
      - name: Unit tests
        run: just test-mocks
      - name: Integration tests
        run: SKIP_DB_TESTS=false just test
      - name: Coverage check
        run: |
          coverage=$(go test -cover ./pkg/... | grep -o '[0-9.]*%' | head -1)
          if (( $(echo "$coverage < 85.0" | bc -l) )); then
            echo "Coverage $coverage is below 85% threshold"
            exit 1
          fi

  frontend-tests:
    steps:
      - name: Unit tests
        run: npm run test
      - name: Coverage check
        run: |
          npm run test:coverage
          # Fail if below 80%
```

---

## Part 6: Maintenance & Evolution

### Regression Prevention Process

**For Every Bug Fix**:
1. ✅ Write failing test that reproduces bug
2. ✅ Fix the bug
3. ✅ Verify test passes
4. ✅ Commit test + fix together
5. ✅ Document in commit message

**Example** (GM Application Bug):
```go
// Commit message:
fix: prevent GM from applying to their own game

- Added backend validation in CanUserApplyToGame query
- Added frontend checks in GamesList and GameDetailsPage
- Added regression test TestGameApplicationService_GMCannotApply
- Added frontend test for button visibility

Closes #123
```

### Test Review Checklist

**Before Merging PR**:
- [ ] All new code has tests
- [ ] Bug fixes have regression tests
- [ ] Tests are passing in CI
- [ ] Coverage hasn't decreased
- [ ] Tests follow naming conventions
- [ ] Integration tests use transactions
- [ ] Frontend tests use MSW for API mocking

### Ongoing Maintenance

**Weekly**:
- Review flaky tests
- Update test fixtures for schema changes
- Monitor test execution time

**Monthly**:
- Review coverage reports
- Identify untested areas
- Update test documentation
- Benchmark performance tests

---

## Appendices

### Appendix A: Estimated Effort

| Phase | Backend | Frontend | Total | Priority |
|-------|---------|----------|-------|----------|
| Phase 1: Foundation | 8 hours | 8 hours | 16 hours | **CRITICAL** |
| Phase 2: Critical Paths | 24 hours | 32 hours | 56 hours | **HIGH** |
| Phase 3: Comprehensive | 40 hours | 60 hours | 100 hours | **MEDIUM** |
| Phase 4: E2E & Perf | 16 hours | 24 hours | 40 hours | **LOW** |
| **TOTAL** | **88 hours** | **124 hours** | **212 hours** | - |

**Recommendation**: Dedicate 2-3 hours daily for 8 weeks to achieve comprehensive coverage

### Appendix B: Quick Start Commands

```bash
# Fix schema drift FIRST
cd backend
just db_reset
just db_create
just migrate_test

# Run tests to verify
SKIP_DB_TESTS=false go test ./pkg/db/services -v

# Frontend setup
cd frontend
npm install -D @testing-library/react @testing-library/user-event
npm install -D msw

# Run tests
npm run test
```

### Appendix C: Reference Test Examples

See:
- `backend/pkg/db/services/games_test.go` - Good table-driven test example
- `backend/pkg/db/services/characters_integration_test.go` - Good integration test
- `frontend/src/components/__tests__/LoginForm.test.tsx` - Good component test

---

## Conclusion

ActionPhase has reached MVP completion but **test coverage is critically insufficient** (estimated 25-30% overall). Without comprehensive tests, the codebase is **vulnerable to regressions** as new features are added.

**Immediate Action Required**:
1. **Fix schema drift** (blocking all integration tests)
2. **Add regression tests for recent bugs** (GM application, conversation dedup, button visibility)
3. **Establish test infrastructure** (builders, mocks, MSW setup)

**Success Criteria**:
- **Backend**: >85% line coverage with integration tests passing
- **Frontend**: >80% line coverage with critical user journeys tested
- **E2E**: Key user flows automated with Playwright
- **Process**: No PR merged without tests for new code and bug fixes

With dedicated effort following this plan, ActionPhase will achieve production-ready test coverage within 8 weeks.
