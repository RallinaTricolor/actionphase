# Backend Test Coverage Gaps Analysis

**Date**: October 23, 2025
**Focus**: Actions Service Test Implementation Plan
**Current Coverage**: 46.2% → **Target**: 80%+

---

## Executive Summary

The **Actions Service** has the lowest coverage of all backend services at 46.2%. This analysis identifies:
- **10 completely untested functions** (0% coverage)
- **Specific test cases** needed for each function
- **Implementation order** for maximum efficiency
- **Estimated time**: 3-4 hours to reach 80%+ coverage

---

## Actions Service Architecture

**Location**: `/backend/pkg/db/services/actions/`

**Structure**:
```
actions/
├── service.go              - Service struct
├── queries.go              - Query helpers (0% coverage ❌)
├── submissions.go          - Action submissions (partial coverage)
├── submissions_test.go     - 6 tests ✅
├── results.go              - Results management (partial coverage)
├── results_test.go         - 3 tests ✅
├── validation.go           - Permission checks
└── validation_test.go      - Tests ✅
```

**Current Test Count**: 9 tests
**Target Test Count**: 20-25 tests
**Functions Tested**: 8 / 18 functions
**Functions Untested**: 10 functions

---

## Critical Gap: queries.go (0% Coverage) 🔴

**File**: `/backend/pkg/db/services/actions/queries.go`
**Lines**: 96
**Coverage**: 0% (ALL 6 functions untested)

### Function 1: GetUserActions

**Purpose**: Retrieve all action submissions for a user across phases in a game
**Signature**: `GetUserActions(ctx, gameID, userID int32) ([]models.GetUserActionsRow, error)`

**Use Cases**:
- Player viewing their submission history
- "My Actions" dashboard view
- Character action history

**Test Cases Needed**:

1. **Returns user's actions for a game**
   - Setup: Create game with 2 phases, user submits action to each
   - Test: Call GetUserActions(gameID, userID)
   - Verify: Returns 2 actions

2. **Returns empty list when user has no actions**
   - Setup: Create game, user is participant but hasn't submitted
   - Test: Call GetUserActions(gameID, userID)
   - Verify: Returns empty slice, no error

3. **Filters by game ID correctly**
   - Setup: User participates in 2 games, submits actions to both
   - Test: Call GetUserActions(game1ID, userID)
   - Verify: Only returns actions from game1

4. **Includes draft and final submissions**
   - Setup: User submits 1 draft, 1 final action
   - Test: Call GetUserActions(gameID, userID)
   - Verify: Both actions returned

**Estimated Time**: 20 minutes

---

### Function 2: GetGameActions

**Purpose**: Retrieve all action submissions for a game (GM only)
**Signature**: `GetGameActions(ctx, gameID int32) ([]models.GetGameActionsRow, error)`

**Use Cases**:
- GM reviewing all player submissions
- GM dashboard showing submission status
- Bulk results creation

**Test Cases Needed**:

1. **Returns all actions for a game**
   - Setup: 3 players submit actions to same phase
   - Test: Call GetGameActions(gameID)
   - Verify: Returns 3 actions

2. **Returns actions across multiple phases**
   - Setup: Game with 2 phases, players submit to both
   - Test: Call GetGameActions(gameID)
   - Verify: Returns actions from all phases

3. **Returns empty list for game with no submissions**
   - Setup: New game with active phase, no submissions yet
   - Test: Call GetGameActions(gameID)
   - Verify: Returns empty slice, no error

4. **Includes metadata (usernames, character names)**
   - Setup: Create actions with character associations
   - Test: Call GetGameActions(gameID)
   - Verify: Returns rows with username and character name fields populated

**Estimated Time**: 20 minutes

---

### Function 3: GetUserResults

**Purpose**: Retrieve all published action results for a user
**Signature**: `GetUserResults(ctx, gameID, userID int32) ([]models.GetUserResultsRow, error)`

**Use Cases**:
- Player viewing GM feedback on their actions
- "My Results" history view
- Result notification triggers

**Test Cases Needed**:

1. **Returns published results for user**
   - Setup: Create 2 results for user, publish both
   - Test: Call GetUserResults(gameID, userID)
   - Verify: Returns 2 results

2. **Excludes unpublished results**
   - Setup: Create 2 results for user, publish only 1
   - Test: Call GetUserResults(gameID, userID)
   - Verify: Returns only 1 (published) result

3. **Returns empty list when no results exist**
   - Setup: User has submitted actions but GM hasn't created results
   - Test: Call GetUserResults(gameID, userID)
   - Verify: Returns empty slice, no error

4. **Filters by game ID**
   - Setup: User has results in 2 different games
   - Test: Call GetUserResults(game1ID, userID)
   - Verify: Only returns results from game1

**Estimated Time**: 20 minutes

---

### Function 4: GetGameResults

**Purpose**: Retrieve all action results for a game (GM only)
**Signature**: `GetGameResults(ctx, gameID int32) ([]models.GetGameResultsRow, error)`

**Use Cases**:
- GM viewing all results for management
- Results dashboard
- Bulk publish workflow

**Test Cases Needed**:

1. **Returns all results for a game**
   - Setup: GM creates results for 3 different players
   - Test: Call GetGameResults(gameID)
   - Verify: Returns 3 results

2. **Includes both published and unpublished results**
   - Setup: Create 2 published, 2 unpublished results
   - Test: Call GetGameResults(gameID)
   - Verify: Returns all 4 results

3. **Returns empty list for game with no results**
   - Setup: Game with submissions but no GM responses yet
   - Test: Call GetGameResults(gameID)
   - Verify: Returns empty slice, no error

4. **Returns results across multiple phases**
   - Setup: Game with 2 phases, results in both
   - Test: Call GetGameResults(gameID)
   - Verify: Returns results from all phases

**Estimated Time**: 20 minutes

---

### Function 5: ListAllActionSubmissions

**Purpose**: Paginated list of all submissions for audience/GM view
**Signature**: `ListAllActionSubmissions(ctx, gameID, phaseID, limit, offset int32) ([]models.ListAllActionSubmissionsRow, error)`

**Use Cases**:
- Audience viewing player actions (audience participation feature)
- GM browsing submissions with pagination
- Public game action feed

**Test Cases Needed**:

1. **Returns paginated submissions**
   - Setup: Create 15 submissions
   - Test: Call ListAllActionSubmissions(gameID, 0, limit=10, offset=0)
   - Verify: Returns first 10 submissions

2. **Pagination offset works correctly**
   - Setup: 15 submissions
   - Test: Call ListAllActionSubmissions(gameID, 0, limit=10, offset=10)
   - Verify: Returns last 5 submissions

3. **Filters by phase when phaseID provided**
   - Setup: Game with 2 phases, 5 submissions each
   - Test: Call ListAllActionSubmissions(gameID, phase1ID, limit=100, offset=0)
   - Verify: Returns only 5 submissions from phase1

4. **Returns all phases when phaseID=0**
   - Setup: Game with 2 phases, 5 submissions each
   - Test: Call ListAllActionSubmissions(gameID, 0, limit=100, offset=0)
   - Verify: Returns all 10 submissions

5. **Returns empty list when no submissions match**
   - Setup: Game with no submissions
   - Test: Call ListAllActionSubmissions(gameID, 0, limit=10, offset=0)
   - Verify: Returns empty slice, no error

**Estimated Time**: 25 minutes

---

### Function 6: CountAllActionSubmissions

**Purpose**: Count total submissions for pagination support
**Signature**: `CountAllActionSubmissions(ctx, gameID, phaseID int32) (int64, error)`

**Use Cases**:
- Calculate total pages for pagination
- Submission statistics
- Audience view pagination

**Test Cases Needed**:

1. **Counts all submissions in game**
   - Setup: Create 7 submissions across 2 phases
   - Test: Call CountAllActionSubmissions(gameID, 0)
   - Verify: Returns 7

2. **Counts submissions for specific phase**
   - Setup: Phase1 has 5 submissions, Phase2 has 3
   - Test: Call CountAllActionSubmissions(gameID, phase1ID)
   - Verify: Returns 5

3. **Returns 0 for game with no submissions**
   - Setup: New game with no submissions
   - Test: Call CountAllActionSubmissions(gameID, 0)
   - Verify: Returns 0

4. **Works with phaseID=0 for all phases**
   - Setup: 10 submissions across multiple phases
   - Test: Call CountAllActionSubmissions(gameID, 0)
   - Verify: Returns 10

**Estimated Time**: 15 minutes

---

**queries.go Total**: 6 functions, 23 test cases, ~2 hours

---

## submissions.go Gaps (Partial Coverage) 🟡

**File**: `/backend/pkg/db/services/actions/submissions.go`
**Current Coverage**: ~52%
**Functions Tested**: 4/6
**Functions Untested**: 2

### Function 7: GetUserPhaseSubmission

**Purpose**: Retrieve a specific user's submission for a phase
**Signature**: `GetUserPhaseSubmission(ctx, phaseID, userID int32) (*models.ActionSubmission, error)`

**Use Cases**:
- Check if user has already submitted
- Load user's existing submission for editing
- Submission status checks

**Test Cases Needed**:

1. **Returns user's submission when exists**
   - Setup: User submits action to phase
   - Test: Call GetUserPhaseSubmission(phaseID, userID)
   - Verify: Returns the submission

2. **Returns nil when no submission exists**
   - Setup: User is participant but hasn't submitted to phase
   - Test: Call GetUserPhaseSubmission(phaseID, userID)
   - Verify: Returns nil, no error

3. **Returns correct submission when multiple phases exist**
   - Setup: User submits to phase1 and phase2
   - Test: Call GetUserPhaseSubmission(phase1ID, userID)
   - Verify: Returns only phase1 submission

**Estimated Time**: 15 minutes

---

### Function 8: GetPhaseSubmissions

**Purpose**: Get all submissions for a phase
**Signature**: `GetPhaseSubmissions(ctx, phaseID int32) ([]models.ActionSubmission, error)`

**Use Cases**:
- GM viewing all phase submissions
- Calculating submission statistics
- Bulk operations on phase submissions

**Test Cases Needed**:

1. **Returns all submissions for a phase**
   - Setup: 4 players submit actions to same phase
   - Test: Call GetPhaseSubmissions(phaseID)
   - Verify: Returns 4 submissions

2. **Returns empty list when no submissions**
   - Setup: Phase exists but no submissions yet
   - Test: Call GetPhaseSubmissions(phaseID)
   - Verify: Returns empty slice, no error

3. **Includes draft and final submissions**
   - Setup: 2 draft submissions, 3 final submissions
   - Test: Call GetPhaseSubmissions(phaseID)
   - Verify: Returns all 5 submissions

4. **Properly converts character_id field**
   - Setup: Create submission with character association
   - Test: Call GetPhaseSubmissions(phaseID)
   - Verify: CharacterID field properly populated in result

**Estimated Time**: 20 minutes

---

**submissions.go Total**: 2 functions, 7 test cases, ~35 minutes

---

## results.go Gaps (Partial Coverage) 🟡

**File**: `/backend/pkg/db/services/actions/results.go`
**Current Coverage**: ~58%
**Functions Tested**: 5/7
**Functions Untested**: 2

### Function 9: GetUserPhaseResults

**Purpose**: Get all results for a user in a specific phase
**Signature**: `GetUserPhaseResults(ctx, phaseID, userID int32) ([]models.ActionResult, error)`

**Use Cases**:
- Player viewing results for a specific phase
- Phase-specific result history
- Notification triggers for phase results

**Test Cases Needed**:

1. **Returns user's results for a phase**
   - Setup: Create 2 results for user in same phase
   - Test: Call GetUserPhaseResults(phaseID, userID)
   - Verify: Returns 2 results

2. **Returns empty list when no results**
   - Setup: User submitted action but no result created yet
   - Test: Call GetUserPhaseResults(phaseID, userID)
   - Verify: Returns empty slice, no error

3. **Filters by phase correctly**
   - Setup: User has results in phase1 and phase2
   - Test: Call GetUserPhaseResults(phase1ID, userID)
   - Verify: Returns only phase1 results

4. **Returns only results for specified user**
   - Setup: Multiple users have results in same phase
   - Test: Call GetUserPhaseResults(phaseID, user1ID)
   - Verify: Returns only user1's results

**Estimated Time**: 20 minutes

---

### Function 10: PublishAllPhaseResults

**Purpose**: Bulk publish all unpublished results for a phase
**Signature**: `PublishAllPhaseResults(ctx, phaseID int32) error`

**Use Cases**:
- GM publishing all results at once when phase ends
- Bulk workflow for GM efficiency
- Phase transition automation

**Test Cases Needed**:

1. **Publishes all unpublished results**
   - Setup: Create 3 unpublished results, 1 published result
   - Test: Call PublishAllPhaseResults(phaseID)
   - Verify: All 4 results are now published

2. **No error when no unpublished results exist**
   - Setup: All results already published
   - Test: Call PublishAllPhaseResults(phaseID)
   - Verify: No error, no changes

3. **No error when no results exist at all**
   - Setup: Phase with no results
   - Test: Call PublishAllPhaseResults(phaseID)
   - Verify: No error

4. **Only affects specified phase**
   - Setup: Unpublished results in phase1 and phase2
   - Test: Call PublishAllPhaseResults(phase1ID)
   - Verify: Only phase1 results published, phase2 unchanged

**Estimated Time**: 20 minutes

---

**results.go Total**: 2 functions, 8 test cases, ~40 minutes

---

## Test Implementation Order

### Recommended Priority Order (Highest Value First)

**Phase 1: Query Layer Foundation** (2 hours)
1. ✅ GetUserActions - Core player feature
2. ✅ GetGameActions - Core GM feature
3. ✅ GetUserResults - Core player feature
4. ✅ GetGameResults - Core GM feature
5. ✅ ListAllActionSubmissions - Audience feature
6. ✅ CountAllActionSubmissions - Pagination support

**Phase 2: Submission Queries** (35 minutes)
7. ✅ GetUserPhaseSubmission - Submission status checks
8. ✅ GetPhaseSubmissions - GM phase management

**Phase 3: Results Management** (40 minutes)
9. ✅ GetUserPhaseResults - Player phase history
10. ✅ PublishAllPhaseResults - GM bulk workflow

**Total Time**: ~3 hours 15 minutes

---

## Test File Structure

### Create: `/backend/pkg/db/services/actions/queries_test.go`

```go
package actions

import (
    "context"
    "testing"

    core "actionphase/pkg/core"
    db "actionphase/pkg/db/services"
    phases "actionphase/pkg/db/services/phases"

    "github.com/stretchr/testify/assert"
    "github.com/stretchr/testify/require"
)

func TestActionSubmissionService_GetUserActions(t *testing.T) {
    testDB := core.NewTestDatabase(t)
    defer testDB.Close()

    // Test implementation here...
}

// ... (6 test functions total)
```

### Expand: `/backend/pkg/db/services/actions/submissions_test.go`

Add 2 new test functions:
- `TestActionSubmissionService_GetUserPhaseSubmission`
- `TestActionSubmissionService_GetPhaseSubmissions`

### Expand: `/backend/pkg/db/services/actions/results_test.go`

Add 2 new test functions:
- `TestActionSubmissionService_GetUserPhaseResults`
- `TestActionSubmissionService_PublishAllPhaseResults`

---

## Expected Coverage Improvement

**Current**:
- queries.go: 0%
- submissions.go: 52%
- results.go: 58%
- **Overall**: 46.2%

**After Implementation**:
- queries.go: 90%+ (all functions tested)
- submissions.go: 90%+ (2 remaining functions tested)
- results.go: 90%+ (2 remaining functions tested)
- **Overall**: 80-85%

**Impact on Backend Coverage**:
- Current Backend: 69.5%
- After Actions Service: **~77-78%** (+7-8%)

---

## Testing Utilities Needed

All utilities already exist in test infrastructure:

✅ `core.NewTestDatabase(t)` - Database setup
✅ `testDB.CreateTestUser(t, username, email)` - User creation
✅ `testDB.CreateTestGame(t, gmUserID, title)` - Game creation
✅ `gameService.AddGameParticipant(ctx, gameID, userID, role)` - Add players
✅ `phaseService.TransitionToNextPhase(ctx, gameID, userID, req)` - Create phases
✅ `actionService.SubmitAction(ctx, req)` - Create submissions
✅ `actionService.CreateActionResult(ctx, req)` - Create results

**No new test helpers required!**

---

## Success Criteria

✅ **Coverage Goals**:
- queries.go: 0% → 90%+
- submissions.go: 52% → 90%+
- results.go: 58% → 90%+
- Overall actions service: 46.2% → 80%+

✅ **Quality Goals**:
- All 10 functions have at least 3 test cases
- Edge cases covered (empty lists, filters, pagination)
- Error cases tested where applicable
- 100% test pass rate

✅ **Documentation**:
- Test names clearly describe scenarios
- Comments explain complex test setup
- Follows existing test patterns

---

## Next Steps

1. **Create** `queries_test.go` file
2. **Implement** 6 test functions for query layer (2 hours)
3. **Expand** `submissions_test.go` with 2 functions (35 minutes)
4. **Expand** `results_test.go` with 2 functions (40 minutes)
5. **Verify** coverage reaches 80%+ target
6. **Update** COVERAGE_STATUS.md with new metrics

**Total Estimated Time**: 3 hours 15 minutes
**Expected Backend Coverage Improvement**: 69.5% → 77-78%

---

**Document Created**: October 23, 2025
**Next Action**: Begin implementing queries_test.go with Phase 1 tests
