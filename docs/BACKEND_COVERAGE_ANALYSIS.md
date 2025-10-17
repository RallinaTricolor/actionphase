# Backend Service Coverage Analysis - 2025-10-16

## Summary

**Overall Coverage: 51.0%** (down from estimated 85%+)

### Coverage by File

| File | Coverage | Status | Priority |
|------|----------|--------|----------|
| sessions.go | 100.0% | ✅ Complete | - |
| characters.go | 79.0% | ✅ Good | Low |
| conversations.go | 66.8% | ⚠️ Decent | Medium |
| games.go | 56.5% | ⚠️ Decent | Medium |
| messages.go | 47.3% | ❌ Needs Work | High |
| game_applications.go | 46.2% | ❌ Needs Work | High |
| phases.go | 22.7% | ❌ **CRITICAL** | **URGENT** |
| users.go | 0.0% | ❌ No Tests | Low |
| doc.go | 0.0% | N/A | - |

## Critical Gaps

### 1. phases.go - 22.7% coverage (LARGEST GAP)

**Untested Functions:**
- `GetGamePhases` - 0%
- `ExtendPhaseDeadline` - 0%
- `SubmitAction` (old version) - 0%
- `GetUserAction` - 0%
- `GetUserActions` - 0%
- `GetPhaseActions` - 0%
- `GetGameActions` - 0%
- `DeleteAction` - 0%
- `SendActionResult` - 0%
- `GetUserResults` - 0%
- `GetGameResults` - 0%
- `CanUserManagePhases` - 0%
- `CanUserSubmitActions` - 0%
- `ConvertPhaseToResponse` - 0%
- `ConvertActionToResponse` - 0%
- `GetPhaseHistory` - 0%
- `GetActionSubmission` - 0%
- `GetUserPhaseSubmission` - 0%
- `GetPhaseSubmissions` - 0%
- `DeleteActionSubmission` - 0%
- `GetActionResult` - 0%
- `GetUserPhaseResults` - 0%
- `PublishActionResult` - 0%
- `PublishAllPhaseResults` - 0%
- `GetUnpublishedResultsCount` - 0%
- `UpdateActionResult` - 0%
- `CanUserSubmitAction` - 0%

**Impact:** This is the game's core functionality - action submission and results. Critical business logic untested.

### 2. game_applications.go - 46.2% coverage

**Untested Functions:**
- `GetUserGameApplications` - 0%
- `DeleteGameApplication` - 0%
- `HasUserAppliedToGame` - 0%
- `CountPendingApplicationsForGame` - 0%
- `BulkRejectApplications` - 0%
- `GetGameApplicationByUserAndGame` - 0%
- `PublishApplicationStatuses` - 0%

**Tested Functions:** ✅
- CreateGameApplication (includes GM bug regression test)
- ApproveApplication
- RejectApplication
- BulkApproveApplications
- GetGameApplications

### 3. messages.go - 47.3% coverage

**Untested Functions:**
- `GetPhasePosts` - 0%
- `GetComment` - 0%
- `GetPostComments` - 0%
- `UpdateComment` - 0%
- `DeleteComment` - 0%
- `GetGamePostCount` - 0%
- `GetPostCommentCount` - 0%
- `GetUserPostsInGame` - 0%
- `GetMessageReactions` - 0%

**Tested Functions:** ✅
- CreatePost
- CreateComment
- DeletePost
- AddReaction
- RemoveReaction
- GetReactionCounts
- ValidateCharacterOwnership

### 4. users.go - 0% coverage

**Status:** No test file exists

**Functions:**
- `User`
- `UserByUsername`
- `Users`
- `CreateUser`
- `DeleteUser`

**Note:** This is a thin wrapper around database queries. Low priority since most user logic is tested via integration tests in auth package.

## Recommendations

### Priority 1: Phase Service Tests (URGENT)

**Estimated Effort:** 3-4 hours

Add tests for:
1. **Read Operations**:
   - GetGamePhases
   - GetPhaseHistory
   - GetActionSubmission
   - GetUserPhaseSubmission
   - GetPhaseSubmissions

2. **Action Submission Tests** (new system):
   - SubmitAction (comprehensive tests)
   - GetUserPhaseSubmission
   - DeleteActionSubmission

3. **Results System**:
   - CreateActionResult
   - GetActionResult
   - GetUserPhaseResults
   - PublishActionResult
   - PublishAllPhaseResults
   - GetUnpublishedResultsCount
   - UpdateActionResult

4. **Permission Checks**:
   - CanUserManagePhases
   - CanUserSubmitActions
   - CanUserSubmitAction

**Expected Coverage Increase:** 22.7% → 75%+ (adds ~30% to overall)

### Priority 2: Complete Game Applications Tests (HIGH)

**Estimated Effort:** 1-2 hours

Add tests for:
- GetUserGameApplications
- DeleteGameApplication
- HasUserAppliedToGame
- CountPendingApplicationsForGame
- BulkRejectApplications
- GetGameApplicationByUserAndGame

**Expected Coverage Increase:** 46.2% → 85%+

### Priority 3: Complete Messages Tests (HIGH)

**Estimated Effort:** 2-3 hours

Add tests for:
- Comment CRUD (GetComment, UpdateComment, DeleteComment, GetPostComments)
- Post queries (GetPhasePosts, GetGamePostCount, GetPostCommentCount, GetUserPostsInGame)
- Reaction queries (GetMessageReactions)

**Expected Coverage Increase:** 47.3% → 85%+

### Priority 4: Conversations & Games (MEDIUM)

**Estimated Effort:** 2-3 hours

Review existing tests and add edge cases to reach 80%+

### Priority 5: Users Service Tests (LOW)

**Estimated Effort:** 30 minutes

Simple wrapper service, low value but would improve overall coverage metrics.

## Projected Coverage After Improvements

| Phase | Coverage | Time |
|-------|----------|------|
| Current | 51.0% | - |
| After Phase Service Tests | ~70% | 3-4 hours |
| After Game Apps Complete | ~75% | +1-2 hours |
| After Messages Complete | ~80% | +2-3 hours |
| After Conversations/Games | ~85% | +2-3 hours |
| After Users Tests | ~87% | +30 min |

**Total Estimated Time: 9-13 hours to reach 85%+ coverage**

## Next Steps

1. ✅ Generate coverage report (DONE)
2. ✅ Analyze gaps (DONE)
3. Start with phases.go tests (highest impact)
4. Continue with game_applications.go and messages.go
5. Polish conversations.go and games.go
6. Add users.go tests (optional)

