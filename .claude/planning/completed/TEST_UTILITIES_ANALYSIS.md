# Test Utilities Consolidation - Analysis Report

**Date**: 2025-10-19
**Phase**: 1 - Pattern Analysis Complete
**Priority**: P2

---

## Executive Summary

Analyzed 16 test files across backend services (773 lines in largest file). Found significant test infrastructure **already exists** but has:
- ✅ Strong foundation (TestDatabase, UserBuilder, GameBuilder, assertions)
- ⚠️ **Inconsistent usage** (2 different assertion styles)
- ❌ **Missing builders** for 5 core entities
- 🔄 **High duplication** in setup/teardown and service initialization

**Recommendation**: Enhance existing infrastructure rather than start from scratch.

---

## Test Files Analyzed

### Service Test Files (16 total):

1. **backend/pkg/db/services/**
   - `games_test.go` (638 lines) - Using custom assertions
   - `characters_test.go` (773 lines) - Using custom assertions
   - `users_test.go`
   - `sessions_test.go`
   - `game_applications_test.go`
   - `notification_service_test.go`
   - `conversations_test.go`

2. **backend/pkg/db/services/phases/**
   - `crud_test.go` (199 lines) - Using testify assertions ✨
   - `transitions_test.go`
   - `history_test.go`
   - `validation_test.go`
   - `converters_test.go`

3. **backend/pkg/db/services/actions/**
   - `submissions_test.go` - Using testify assertions ✨
   - `results_test.go`
   - `validation_test.go`

4. **backend/pkg/db/services/messages/**
   - `messages_test.go` - Using testify assertions ✨
   - `mentions_extraction_test.go`

---

## Current Test Infrastructure

### ✅ What Already Exists (in `backend/pkg/core/`)

#### 1. TestDatabase (`test_utils.go` - 14,707 bytes)

```go
type TestDatabase struct {
    Pool *pgxpool.Pool
}

// Features:
func NewTestDatabase(t TestingInterface) *TestDatabase
func (td *TestDatabase) Close()
func (td *TestDatabase) CleanupTables(t TestingInterface, tables ...string)
func (td *TestDatabase) SetupFixtures(t TestingInterface) *Fixtures
func (td *TestDatabase) CreateTestUser(t TestingInterface, username, email string) User
func (td *TestDatabase) CreateTestGame(t TestingInterface, gmID int32, title string) Game
```

**Strengths**:
- ✅ Checks SKIP_DB_TESTS environment variable
- ✅ Provides helpful error messages for common issues
- ✅ Handles database connection pooling
- ✅ Fixture setup with test users and games

#### 2. TestDataFactory (`test_factories.go` - 11,812 bytes)

```go
type TestDataFactory struct {
    db       *TestDatabase
    t        TestingInterface
    sequence int // For generating unique values
}

// Existing Builders:
type UserBuilder struct { ... }
type GameBuilder struct { ... }
```

**Strengths**:
- ✅ Fluent builder interface
- ✅ Automatic sequence generation for unique values
- ✅ Both Create() and Build() methods
- ✅ Sensible defaults

**Example Usage**:
```go
user := factory.NewUser().
    WithUsername("testplayer").
    WithEmail("player@test.com").
    Create()
```

#### 3. Assertion Helpers (`test_utils.go`)

**Custom Assertions** (used in games/characters tests):
```go
func AssertNoError(t *testing.T, err error, message string)
func AssertError(t *testing.T, err error, message string)
func AssertEqual[T comparable](t *testing.T, expected, actual T, message string)
func AssertNotEqual[T comparable](t *testing.T, notExpected, actual T, message string)
func AssertTrue(t *testing.T, condition bool, message string)
func AssertErrorContains(t *testing.T, err error, substring string, message string)
func AssertHttpStatus(t *testing.T, expected, actual int, testName, responseBody string)
```

---

## 🚨 Major Issue: Assertion Style Inconsistency

### Two Different Styles in Use:

**Old Style** (games_test.go, characters_test.go):
```go
core.AssertNoError(t, err, "Failed to create character")
core.AssertEqual(t, expected, actual, "Character name mismatch")
```

**New Style** (phases/, actions/, messages/ - using testify):
```go
require.NoError(t, err)
assert.Equal(t, expected, actual)
assert.Contains(t, err.Error(), "invalid phase type")
```

**Impact**:
- Inconsistent developer experience
- Different error messages
- Testify provides more features (Contains, Len, NotNil, etc.)

**Recommendation**: Standardize on **testify** (it's industry standard, more features)

---

## Repeated Patterns Across All Test Files

### 1. Setup/Teardown Pattern (100% duplication)

**Current** (repeated in EVERY test):
```go
testDB := core.NewTestDatabase(t)
defer testDB.Close()
defer testDB.CleanupTables(t, "characters", "games", "sessions", "users")

fixtures := testDB.SetupFixtures(t)
characterService := &CharacterService{DB: testDB.Pool}
```

**Proposed** (using helper):
```go
suite := core.NewTestSuite(t).
    WithTables("characters", "games", "sessions", "users").
    WithFixtures().
    Setup()
defer suite.Cleanup()

characterService := suite.CharacterService()
```

**Impact**: Reduces 5 lines to 2 lines in every test function.

---

### 2. Service Initialization (100% duplication)

**Current** (repeated 50+ times):
```go
gameService := &GameService{DB: testDB.Pool}
characterService := &CharacterService{DB: testDB.Pool}
phaseService := &phases.PhaseService{DB: testDB.Pool}
actionService := &ActionSubmissionService{DB: testDB.Pool}
```

**Proposed** (factory pattern):
```go
services := suite.Services()
// OR
gameService := suite.GameService()
characterService := suite.CharacterService()
```

**Impact**: Centralized service creation, easier to add dependencies.

---

### 3. Character Creation (20+ occurrences in characters_test.go alone)

**Current**:
```go
character, err := characterService.CreateCharacter(context.Background(), CreateCharacterRequest{
    GameID:        fixtures.TestGame.ID,
    UserID:        core.Int32Ptr(int32(fixtures.TestUser.ID)),
    Name:          "Test Character",
    CharacterType: "player_character",
})
core.AssertNoError(t, err, "Failed to create test character")
```

**Proposed** (with CharacterBuilder):
```go
character := factory.NewCharacter().
    InGame(fixtures.TestGame).
    OwnedBy(fixtures.TestUser).
    WithName("Test Character").
    PlayerCharacter().
    Create()
```

**Impact**: 8 lines → 6 lines, more readable, type-safe.

---

### 4. Phase Creation (10+ occurrences)

**Current**:
```go
req := core.CreatePhaseRequest{
    GameID:      game.ID,
    PhaseType:   "action",
    PhaseNumber: 1,
    Title:       "Action Phase",
    Description: "Submit your actions",
    StartTime:   core.TimePtr(time.Now()),
    EndTime:     core.TimePtr(time.Now().Add(48 * time.Hour)),
}
phase, err := phaseService.CreatePhase(context.Background(), req)
require.NoError(t, err)
```

**Proposed** (with PhaseBuilder):
```go
phase := factory.NewPhase().
    InGame(game).
    ActionPhase().
    WithTitle("Action Phase").
    WithDeadline(48 * time.Hour).
    Create()
```

**Impact**: 10 lines → 6 lines, clearer intent.

---

### 5. Game State Transitions (15+ occurrences)

**Current**:
```go
_, err := gameService.UpdateGameState(context.Background(), game.ID, "recruitment")
core.AssertNoError(t, err, "Failed to set game to recruitment")
```

**Proposed** (with helper):
```go
game = suite.TransitionGameTo(game, "recruitment")
```

**Impact**: 2 lines → 1 line, error handling automatic.

---

### 6. Adding Game Participants (30+ occurrences)

**Current**:
```go
_, err := gameService.AddGameParticipant(context.Background(), game.ID, int32(player.ID), "player")
require.NoError(t, err)
```

**Proposed** (with helper):
```go
suite.AddParticipant(game, player, "player")
```

**Impact**: Cleaner, consistent error handling.

---

## Missing Builders

### ❌ CharacterBuilder (needed for 20+ test cases)

**Proposed Interface**:
```go
type CharacterBuilder struct {
    factory       *TestDataFactory
    gameID        int32
    userID        *int32
    name          string
    characterType string
    status        string
}

// Usage:
character := factory.NewCharacter().
    InGame(game).
    OwnedBy(user).                    // OR: .GMControlled() for NPCs
    WithName("Aragorn").
    PlayerCharacter().                 // OR: .NPCGMControlled(), .NPCAudience()
    WithStatus("approved").            // Default: "pending"
    Create()
```

---

### ❌ PhaseBuilder (needed for 15+ test cases)

**Proposed Interface**:
```go
type PhaseBuilder struct {
    factory     *TestDataFactory
    gameID      int32
    phaseType   string
    phaseNumber int32
    title       string
    description string
    startTime   *time.Time
    endTime     *time.Time
    isActive    bool
}

// Usage:
phase := factory.NewPhase().
    InGame(game).
    ActionPhase().                     // OR: .CommonRoomPhase(), .ResultsPhase()
    WithTitle("Gathering Information").
    WithDescription("Investigate the scene").
    WithDeadline(48 * time.Hour).      // Sets EndTime = Now + 48h
    Active().                          // Default: inactive
    Create()
```

---

### ❌ ActionSubmissionBuilder (needed for 10+ test cases)

**Proposed Interface**:
```go
type ActionSubmissionBuilder struct {
    factory   *TestDataFactory
    gameID    int32
    phaseID   int32
    userID    int32
    content   string
    isDraft   bool
}

// Usage:
action := factory.NewActionSubmission().
    InPhase(phase).
    ByUser(user).
    WithContent("I search the ancient library for clues").
    Draft().                           // OR: .Final()
    Create()
```

---

### ❌ MessageBuilder (Post/Comment) (needed for 10+ test cases)

**Proposed Interface**:
```go
type MessageBuilder struct {
    factory       *TestDataFactory
    gameID        int32
    authorID      int32
    characterID   int32
    parentID      *int32
    content       string
    messageType   string
    visibility    string
}

// Usage:
post := factory.NewPost().
    InGame(game).
    ByCharacter(character).
    WithContent("The dragon stirs from its slumber...").
    GameVisible().                     // OR: .PMVisible(), .GMOnly()
    Create()

comment := factory.NewComment().
    OnPost(post).
    ByCharacter(otherCharacter).
    WithContent("We should investigate carefully").
    Create()
```

---

### ❌ GameParticipantBuilder (needed for 30+ test cases)

**Proposed Interface**:
```go
type GameParticipantBuilder struct {
    factory  *TestDataFactory
    gameID   int32
    userID   int32
    role     string
}

// Usage:
participant := factory.NewParticipant().
    InGame(game).
    ForUser(player).
    AsPlayer().                        // OR: .AsGM(), .AsSpectator()
    Create()
```

---

## Common Table Cleanup Patterns

**Analysis of CleanupTables usage**:

Most common combinations:
1. `"games", "sessions", "users"` (15 occurrences)
2. `"characters", "games", "sessions", "users"` (10 occurrences)
3. `"character_data", "npc_assignments", "characters", "games", "sessions", "users"` (8 occurrences)
4. `"game_participants", "games", "sessions", "users"` (12 occurrences)

**Proposed** (preset cleanup groups):
```go
// In test_utils.go
const (
    CleanupGames      = "games,sessions,users"
    CleanupCharacters = "character_data,npc_assignments,characters,games,sessions,users"
    CleanupPhases     = "game_phases,games,sessions,users"
    CleanupMessages   = "messages,characters,games,sessions,users"
)

// Usage:
suite := core.NewTestSuite(t).
    WithCleanup(core.CleanupCharacters).
    Setup()
```

---

## Quantified Duplication Impact

### Lines of Code Analysis:

| Pattern | Occurrences | Lines Per | Total Lines | After Fix | Savings |
|---------|-------------|-----------|-------------|-----------|---------|
| Setup/Teardown | 150+ | 5 | 750 | 150 | **600** |
| Service Init | 50+ | 1 | 50 | 0 | **50** |
| Character Creation | 20+ | 8 | 160 | 120 | **40** |
| Phase Creation | 15+ | 10 | 150 | 90 | **60** |
| Game State Transitions | 15+ | 2 | 30 | 15 | **15** |
| Add Participants | 30+ | 2 | 60 | 30 | **30** |
| **TOTAL** | | | **1,200** | **405** | **795** |

**Projected Impact**:
- Reduce test code by ~795 lines (~40% reduction)
- Improve readability and maintainability
- Standardize patterns across all test files

---

## Existing vs Missing Infrastructure

### Summary Table:

| Component | Status | Location | Notes |
|-----------|--------|----------|-------|
| TestDatabase | ✅ Exists | `core/test_utils.go` | Well-designed, widely used |
| TestDataFactory | ✅ Exists | `core/test_factories.go` | Good foundation |
| UserBuilder | ✅ Exists | `core/test_factories.go` | Good fluent interface |
| GameBuilder | ✅ Exists | `core/test_factories.go` | Good fluent interface |
| CharacterBuilder | ❌ Missing | - | **High priority** (20+ uses) |
| PhaseBuilder | ❌ Missing | - | **High priority** (15+ uses) |
| ActionBuilder | ❌ Missing | - | **Medium priority** (10+ uses) |
| MessageBuilder | ❌ Missing | - | **Medium priority** (10+ uses) |
| ParticipantBuilder | ❌ Missing | - | **Medium priority** (30+ uses) |
| Assertion Helpers | ⚠️ Inconsistent | `core/test_utils.go` | Migrate to testify |
| Service Factory | ❌ Missing | - | **Medium priority** (50+ uses) |
| Cleanup Presets | ❌ Missing | - | **Low priority** (nice-to-have) |

---

## Recommendations

### Phase 2: Package Structure
**Decision**: Enhance `backend/pkg/core/` (don't create new package)

**Rationale**:
- Infrastructure already exists there
- Tests already import `actionphase/pkg/core`
- No migration needed for existing code

**Files to enhance**:
- ✅ `test_utils.go` - Add TestSuite, ServiceFactory, cleanup presets
- ✅ `test_factories.go` - Add 5 missing builders
- ❌ (Don't create new package)

---

### Phase 3: Builder Priority

**High Priority** (implement first):
1. **CharacterBuilder** - Used 20+ times, complex 5-parameter constructor
2. **PhaseBuilder** - Used 15+ times, complex setup with time.Time handling

**Medium Priority** (implement second):
3. **GameParticipantBuilder** - Used 30+ times, but simple (could be helper function)
4. **ActionSubmissionBuilder** - Used 10+ times, important for action tests
5. **MessageBuilder** - Used 10+ times, important for messaging tests

**Low Priority** (implement last):
6. **TestSuite helper** - Reduces setup boilerplate
7. **Cleanup presets** - Nice-to-have convenience

---

### Phase 4: Assertion Migration Strategy

**Problem**: Two different assertion styles in use

**Solution**: Gradual migration to testify

1. **Phase 4a**: Update existing custom assertions to wrap testify
   ```go
   // In test_utils.go
   func AssertNoError(t *testing.T, err error, message string) {
       if message != "" {
           require.NoError(t, err, message)
       } else {
           require.NoError(t, err)
       }
   }
   ```

2. **Phase 4b**: Update new tests to use testify directly
   - Phases ✅ (already using testify)
   - Actions ✅ (already using testify)
   - Messages ✅ (already using testify)
   - Games ❌ (migrate gradually)
   - Characters ❌ (migrate gradually)

3. **Phase 4c**: Deprecate custom assertions (long-term)

**Impact**: Allows gradual migration without breaking existing tests.

---

## Implementation Plan - Revised

### Phase 1: Analysis ✅ COMPLETE
- [x] Analyzed 16 test files
- [x] Identified existing infrastructure
- [x] Found assertion inconsistency issue
- [x] Quantified duplication (795 lines savable)
- [x] Created this analysis document

### Phase 2: Builder Foundation (3 hours)
- [ ] Add CharacterBuilder to test_factories.go
- [ ] Add PhaseBuilder to test_factories.go
- [ ] Add ActionSubmissionBuilder to test_factories.go
- [ ] Add MessageBuilder (Post/Comment) to test_factories.go
- [ ] Add GameParticipantBuilder to test_factories.go
- [ ] Write builder tests

### Phase 3: Helper Functions (2 hours)
- [ ] Add ServiceFactory to test_utils.go
- [ ] Add TestSuite helper to test_utils.go
- [ ] Add cleanup presets to test_utils.go
- [ ] Add state transition helpers
- [ ] Write helper tests

### Phase 4: Test Migration - Pilot (2 hours)
- [ ] Pick 1 small test file as pilot (e.g., `phases/crud_test.go`)
- [ ] Refactor to use new builders
- [ ] Verify all tests pass
- [ ] Document before/after comparison

### Phase 5: Test Migration - Full (4 hours)
- [ ] Migrate characters_test.go (773 lines)
- [ ] Migrate games_test.go (638 lines)
- [ ] Migrate remaining phase tests
- [ ] Migrate action tests
- [ ] Migrate message tests
- [ ] Run full test suite after each file

### Phase 6: Documentation & Verification (1 hour)
- [ ] Update `.claude/context/TESTING.md` with new patterns
- [ ] Create builder usage guide
- [ ] Run full test suite: `SKIP_DB_TESTS=false just test`
- [ ] Verify no test failures
- [ ] Update coverage status if needed

**Total Estimated Time**: 12 hours

---

## Success Metrics

- [ ] All 5 missing builders implemented and tested
- [ ] ServiceFactory and TestSuite helpers available
- [ ] Test code reduced by ~600-800 lines
- [ ] All existing tests pass with no changes in behavior
- [ ] Assertion style standardized (at least for new code)
- [ ] Documentation updated
- [ ] Clear examples of builder usage

---

## Risks & Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| Breaking existing tests | High | Incremental migration, test after each file |
| Builder complexity | Medium | Start with simple builders, iterate |
| Assertion migration resistance | Low | Make it gradual, keep old helpers working |
| Time overrun | Medium | Prioritize high-impact builders first |

---

## Next Steps

1. **Get approval** for this plan
2. **Create builders** (Phase 2) - CharacterBuilder, PhaseBuilder first
3. **Test builders** with small test file
4. **Migrate incrementally** - One file at a time
5. **Document patterns** in `.claude/context/TESTING.md`

---

**Status**: Analysis Complete - Ready for Implementation
**Estimated ROI**: High (795 lines saved, improved maintainability)
**Risk Level**: Low (incremental approach, no breaking changes)
