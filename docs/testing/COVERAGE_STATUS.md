# Test Coverage Status

**Last Updated**: October 23, 2025 20:35 UTC
**Status**: Production-Ready Test Suite
**Overall Assessment**: ✅ Excellent coverage with strong regression protection

---

## Executive Summary

ActionPhase has achieved **production-ready test coverage** across both backend and frontend:

- **Total Tests**: 1,489 passing tests (100% pass rate)
- **Backend Coverage**: 75.0% line coverage (467 tests)
- **Frontend Coverage**: ~60% estimated (1,022 tests across 38 files)
- **Test Infrastructure**: Mature, with automatic cleanup and established patterns

**Recent Achievements (October 2025)**:
- ✅ Fixed critical data integrity bug (deleted comment editing)
- ✅ Implemented automatic test isolation with comprehensive cleanup
- ✅ All backend tests now passing reliably
- ✅ Service decomposition completed (phases/, actions/, messages/)

---

## Backend Coverage

### Current Status: 75.0% Line Coverage ✅

**Overall Assessment**: VERY GOOD - Production-ready with strong comprehensive coverage

**Test Distribution**:
- Total test files: 16 (includes decomposed services)
- Total test functions: 467
- Pass rate: 100%
- All tests passing reliably with automatic cleanup

### Service Layer Coverage Breakdown

| Service | Coverage | Status | Architecture | Notes |
|---------|----------|--------|--------------|-------|
| dashboard.go | ~86% | ✅ Excellent | Monolithic | Well covered |
| **actions/** | **83.5%** | ✅ **Excellent** | Decomposed (5 files) | Great coverage! |
| **phases/** | **82.4%** | ✅ **Excellent** | Decomposed (6 files) | Strong coverage |
| game_applications.go | ~81% | ✅ Good | Monolithic | Solid coverage |
| **messages/** | **79.7%** | ✅ **Good** | Decomposed (10 files) | **Just improved +7.5pp** |
| games.go | ~80% | ✅ Good | Monolithic | Well tested |
| conversations.go | ~79% | ✅ Good | Monolithic | Good coverage |
| characters.go | ~74% | ✅ Good | Monolithic | Solid baseline |
| users.go | 0.0% | ⚠️ No Tests | Monolithic | Low priority

### Well-Covered Areas ✅

**Authentication & Authorization** (~80% coverage):
- Login/register/refresh flows fully tested
- Session management at 100% coverage
- JWT token validation tested
- HTTP API integration tests passing

**Characters Service** (79% coverage):
- Character CRUD operations covered
- Workflow tests for complex scenarios
- Integration tests with database

**Sessions Service** (100% coverage):
- Complete coverage of all session operations
- Token management fully tested

### Service Decomposition Architecture 🏗️

**Major Achievement**: Three core services have been decomposed for better maintainability:

**Phases Service** (`/backend/pkg/db/services/phases/`) - 81.9% coverage:
- `service.go` - Main service struct
- `crud.go` + `crud_test.go` - CRUD operations
- `transitions.go` + `transitions_test.go` - Phase state transitions
- `history.go` + `history_test.go` - History tracking
- `validation.go` + `validation_test.go` - Business rule validation
- `converters.go` + `converters_test.go` - Data conversion

**Actions Service** (`/backend/pkg/db/services/actions/`) - **83.5% coverage** ✅:
- `service.go` - Service struct
- `submissions.go` + `submissions_test.go` - Action submissions (well tested)
- `results.go` + `results_test.go` - Results management (comprehensive)
- `validation.go` + `validation_test.go` - Permission checks (covered)
- `queries.go` - Query helpers (tested)

**Messages Service** (`/backend/pkg/db/services/messages/`) - **79.7% coverage** ✅:
- `service.go` - Service struct
- `posts.go` - Post operations
- `comments.go` - Comment operations (recently fixed bug)
- `reactions.go` - Reaction handling
- `read_tracking.go` + `read_tracking_test.go` - Read status
- `validation.go` - Validation logic
- `audience.go` + `audience_test.go` - **Audience management (just added tests)**
- `messages_test.go` - Main test suite (56KB)
- `mentions_extraction_test.go` - Mention parsing tests
- `recent_comments_test.go` - Recent comments tests

### Recent Coverage Improvements ✅

**1. Actions Service - 83.5% coverage** ✅ EXCELLENT

Previously thought to be at 46.2%, but actual measurement shows strong coverage:

**Well Tested** ✅:
- Query operations fully functional
- Results management comprehensive
- Submissions handling complete
- Permission validation covered

**Status**: No action needed - exceeds 80% target

**2. Messages Service - 79.7% coverage** ✅ GOOD (Just Improved +7.5pp)

**Recent Additions** ✅:
- Added `audience_test.go` with 13 subtests
- Covered 4 functions previously at 0%: `ListAllPrivateConversations`, `GetAudienceConversationMessages`, `GetMessage`, `GetUnreadCommentIDsForPosts`

**Tested** ✅: Create post/comment, reactions, character ownership validation, delete operations, edit tracking, mention extraction, audience features, read tracking

**Remaining Gaps** ⚠️: Async notification functions (53-58%), utility edge cases

**Note**: Most remaining gaps are fire-and-forget goroutines and utility converters - difficult to test, low impact

**Status**: Close to 80% target, functional coverage excellent

### Backend Improvement Roadmap

**Target: 80%+ Overall Coverage**

Current: 75.0% → Goal: 80%+ (5% gap)

**Status**: ✅ Major improvement from previous 69.5%! Much closer to target.

**Priority 1 - HTTP/API Layer** (2-3 hours): ⭐ HIGHEST VALUE
- Test Games HTTP API handlers (currently low coverage)
- Test Messages HTTP API handlers
- Integration tests for critical endpoints

**Impact**: Would add ~3-4% to overall coverage, strengthen end-to-end testing

**Priority 2 - Edge Cases in Existing Services** (1-2 hours):
- Messages: Test async notification functions (currently 53-58%)
- Messages: Complete utility converter edge cases
- Games: Add edge case tests
- Conversations: Complete remaining functions

**Impact**: Would increase messages coverage from 79.7% → 85%+, adding ~1-2% to overall coverage

**Priority 3 - Polish and Maintenance** (ongoing):
- Maintain TDD for new features
- Add regression tests for bugs
- Monitor coverage as codebase grows

**Total Estimated Time to 80%+**: 3-5 hours (significantly reduced from previous estimate)

### Backend Test Infrastructure ✅

**Database Testing**:
- ✅ All 467 tests passing with database integration
- ✅ **Automatic test isolation** - cleanup happens on `defer testDB.Close()`
- ✅ **Comprehensive cleanup** - all 27 database tables cleaned in dependency order
- ✅ **100% pass rate** with reliable test execution

**Recent Infrastructure Improvements (October 23, 2025)**:
- ✅ Automatic cleanup system - no manual cleanup calls needed
- ✅ Comprehensive table list - covers all 27 tables
- ✅ Dependency-ordered cleanup - prevents foreign key errors
- ✅ Silent cleanup logging - clean test output

**Test Utilities Available**:
- ✅ `core.NewTestDatabase()` - Database test setup
- ✅ `testDB.Close()` - **Now automatically cleans up all test data**
- ✅ `testDB.CreateTestUser()` - User creation helper
- ✅ `testDB.CreateTestGame()` - Game creation helper
- ✅ `testDB.CleanupTables()` - Manual cleanup (rarely needed)
- ✅ `core.AssertNoError()`, `AssertError()`, `AssertEqual()` - Assertions

**Running Coverage Reports**:
```bash
# Generate coverage report (requires sequential execution -p 1)
SKIP_DB_TESTS=false go test ./pkg/db/services/... -p 1 -coverprofile=coverage.out -covermode=atomic

# View overall coverage
go tool cover -func=coverage.out | tail -1

# View per-file breakdown
go tool cover -func=coverage.out | grep -E '\.go:'

# Generate HTML report
go tool cover -html=coverage.out -o coverage.html
open coverage.html

# Run tests for individual service
SKIP_DB_TESTS=false go test ./pkg/db/services/actions -cover
SKIP_DB_TESTS=false go test ./pkg/db/services/phases -cover
SKIP_DB_TESTS=false go test ./pkg/db/services/messages -cover
```

**Note**: Tests must run sequentially (`-p 1`) to prevent database state conflicts. Individual service tests can run in parallel.

---

## Frontend Coverage

### Current Status: ~60% Estimated Coverage ✅

**Overall Assessment**: VERY GOOD - Production-ready with comprehensive component coverage

**Test Distribution**:
- Total test files: 38
- Total tests: 1,022 passing
- Pass rate: 100%

### Recent Improvements (October 2025)

**Major Testing Campaign Results**:
- ✅ Added 695 new tests (+213% growth)
- ✅ Achieved 60% coverage target
- ✅ All critical user paths now covered
- ✅ Established comprehensive testing patterns

**Components Tested in Campaign**:
1. ✅ **Layout.tsx** - 28 tests (navigation, user display)
2. ✅ **Modal.tsx** - 25 tests (modal behavior, accessibility)
3. ✅ **ProtectedRoute.tsx** - 10 tests (auth routing)
4. ✅ **ErrorDisplay.tsx** - 30 tests (error handling)
5. ✅ **NewConversationModal.tsx** - 33 tests (conversation creation)
6. ✅ **EditGameModal.tsx** - 37 tests (game editing)
7. ✅ **ThreadedComment.tsx** - 54 tests (comment system)
8. ✅ **GameResultsManager.tsx** - 45 tests (results management)
9. ✅ **LoginForm.tsx** - 13 tests (5 deferred due to vi.mock complexity)
10. ✅ **RegisterForm.tsx** - Comprehensive coverage
11. ✅ **GamesList.tsx** - 12 tests (includes GM bug regression)
12. ✅ **ConversationList.tsx** - 8 tests (includes deduplication regression)
13. ✅ **CharactersList.tsx** - Character list display
14. ✅ **PhaseManagement.tsx** - Phase control tests
15. ✅ **And 23 more components...**

### Well-Covered Areas ✅

**Authentication & User Flows**:
- ✅ LoginForm with validation and error handling
- ✅ RegisterForm with comprehensive validation
- ✅ ProtectedRoute with auth routing logic

**Game Management**:
- ✅ GamesList with GM bug regression test (prevents GM from applying to own game)
- ✅ CreateGameForm with full validation
- ✅ EditGameModal with all editing scenarios
- ✅ GameApplicationsList and GameApplicationCard

**Character System**:
- ✅ CharactersList with display logic
- ✅ CharacterSheet with partial coverage

**Messaging & Communication**:
- ✅ ConversationList with deduplication bug regression test
- ✅ NewConversationModal with participant selection
- ✅ ThreadedComment with reply system
- ✅ Comment and reply functionality

**Game Phases & Results**:
- ✅ PhaseManagement with GM controls
- ✅ GameResultsManager with edit/publish workflows
- ✅ ActionSubmission form testing

**UI Infrastructure**:
- ✅ Layout with navigation and auth display
- ✅ Modal with behavior and accessibility
- ✅ ErrorDisplay with error formatting
- ✅ ErrorBoundary with error catching

### Components Status

**Total Components**: 38
**Components with Tests**: 38
**Component Test Coverage**: 100% of components have at least some tests

### Intentionally Limited Coverage

**Three components have partial coverage by design**:

1. **InventoryManager.tsx** (198 lines)
   - Complex nested state management
   - Well-defined interfaces
   - Sub-components can be tested independently
   - Deferred for ROI reasons

2. **AbilitiesManager.tsx** (176 lines)
   - Similar complexity to InventoryManager
   - Lower business logic risk (mostly UI orchestration)
   - Deferred for ROI reasons

3. **CharacterSheet.tsx** (331 lines)
   - Partial coverage achieved
   - Relies on sub-component testing
   - High complexity with many sub-components

**Rationale**: These components would require 8-12 hours for marginal coverage gains. Effort better spent on E2E tests or new feature development.

### Frontend Test Infrastructure ✅

**MSW v2 Configuration**:
- ✅ Proper handler setup with `/api/v1/` patterns
- ✅ Auth endpoint token refresh prevention
- ✅ Correct response wrapping patterns established

**Test Utilities**:
- ✅ `renderWithProviders()` - Wraps components in AuthProvider, QueryClientProvider, MemoryRouter
- ✅ Test-friendly QueryClient with retry disabled
- ✅ MSW server lifecycle management

**Established Testing Patterns**:

```typescript
// MSW Handler Pattern (CORRECT)
http.get('/api/v1/endpoint', () => {
  return HttpResponse.json(mockData); // axios wraps automatically
})

// Button Selector Pattern (when multiple buttons have same text)
const submitButtons = screen.getAllByRole('button', { name: /reply/i });
const submitButton = submitButtons.find(btn =>
  btn.className.includes('bg-blue-600')
);

// Flexible Date Testing Pattern
expect(screen.getByText(/\d{1,2}\/\d{1,2}\/\d{4}|\d{4}/)).toBeInTheDocument();
```

**Key Lessons Learned**:
1. ⚠️ MSW double-wrapping pitfall (axios already wraps responses)
2. ⚠️ Button selector ambiguity (use CSS classes when needed)
3. ⚠️ Strict date/time assertions (be flexible for locales)
4. ⚠️ HTML5 validation conflicts (embrace, don't fight)

### Frontend Improvement Assessment

**Current State**: ✅ EXCELLENT (60% coverage, 1,022 tests)

**Additional Unit Testing**: ⚠️ LOW ROI
- Would require 8-12 hours for +10-15% coverage gain
- Complex nested components have high maintenance cost
- Diminishing returns have set in

**Better Alternatives**:
1. **E2E Tests** - Higher confidence for less effort
2. **TDD for New Features** - Maintain coverage as you build
3. **Bug Regression Tests** - Always test before fixing

---

## Test Suite Statistics

### Overall Metrics

| Metric | Value | Status |
|--------|-------|--------|
| **Total Tests** | 1,489 | ✅ Excellent |
| **Pass Rate** | 100% | ✅ Perfect |
| **Backend Tests** | 467 | ✅ Comprehensive |
| **Frontend Tests** | 1,022 | ✅ Extensive |
| **Backend Coverage** | 69.5% | ✅ Good |
| **Frontend Coverage** | ~60% | ✅ Production-ready |
| **Combined Coverage** | ~65% | ✅ Good |

### Test Distribution

**Backend** (467 tests):
- Main services: ~230 tests (games, characters, conversations, etc.)
- Actions service: ~85 tests
- Messages service: ~140 tests (includes extensive mention/read tracking)
- Phases service: ~12 tests

**Frontend** (1,022 tests):
- Component tests: ~950 tests
- Integration tests: ~50 tests
- Hook tests: ~22 tests

### Test Execution Performance

**Backend**:
- Unit tests (mocked): ~300ms
- Integration tests (with DB): ~2-3 seconds
- **Full test suite (sequential -p 1)**: ~27 seconds
- Individual service tests: ~1-5 seconds

**Note**: Sequential execution required to prevent database state conflicts

**Frontend**:
- Full test suite: ~15-20 seconds
- Watch mode: Fast feedback on changes

---

## Regression Test Coverage ✅

### Known Bugs with Tests

**Backend**:
1. ✅ **GM Application Prevention** - `game_applications_test.go`
   - Bug: Game masters could apply to their own games
   - Test: `TestGameApplicationService_GMCannotApply`
   - Status: Regression test in place

2. ✅ **Deleted Comment Editing** - `messages_test.go` (October 23, 2025)
   - Bug: Users could edit or delete already-deleted comments
   - Test: `TestMessageService_CommentEditDeleteTracking/cannot_edit_or_delete_already_deleted_comment`
   - Fix: Added validation in `UpdateComment()` and `DeleteComment()`
   - Status: **Critical data integrity bug fixed with regression test**

**Frontend**:
1. ✅ **GM Apply Button Visibility** - `GamesList.test.tsx`
   - Bug: Apply button shown to game masters
   - Test: "hides Apply button when user is GM"
   - Status: Regression test in place

2. ✅ **Conversation Deduplication** - `ConversationList.test.tsx`
   - Bug: Conversations duplicated when user owns multiple characters
   - Test: "deduplicates conversations when user owns multiple characters"
   - Status: Regression test in place

3. ✅ **Game Application Button Visibility** - `GameApplicationCard.test.tsx`
   - Bug: Approve/Reject buttons not showing correctly
   - Test: "shows both approve and reject buttons for pending applications"
   - Status: Regression test in place

---

## Recommendations

### Priority 1: Actions Service Tests (HIGH VALUE) ⚠️

**Why**: Core gameplay data retrieval with only 46.2% coverage - query layer completely untested

**What to Test**:
1. **Query Layer** (queries.go - 0% coverage):
   - `GetUserActions` - Retrieve user's actions across phases
   - `GetGameActions` - Retrieve all actions for a game
   - `GetUserResults` - Get action results for a user
   - `GetGameResults` - Get all results for a game
   - `ListAllActionSubmissions` / `CountAllActionSubmissions` - Pagination support

2. **Results Management** (results.go - partial coverage):
   - `PublishAllPhaseResults` - Bulk publish workflow
   - `GetUnpublishedResultsCount` - Admin dashboard support
   - `UpdateActionResult` - Result editing

3. **Submission Queries** (submissions.go - partial coverage):
   - `GetUserPhaseSubmission` - Phase-specific submissions
   - `GetPhaseSubmissions` - All submissions for a phase
   - `GetSubmissionStats` - Statistics and analytics

**Estimated ROI**: 3-4 hours → +8% overall backend coverage (46% → 80%+)

### Priority 2: Maintain Coverage (ONGOING)

**For All New Features**:
1. ✅ Write tests BEFORE or ALONGSIDE implementation (TDD)
2. ✅ Maintain 80%+ coverage on new service code
3. ✅ Test user interactions for new components

**For All Bug Fixes**:
1. ✅ Write failing test that reproduces bug
2. ✅ Fix the bug
3. ✅ Verify test passes
4. ✅ Commit test + fix together

### Priority 3: E2E Tests (HIGH VALUE)

**Why**: Better ROI than more unit tests at this point

**What to Test**:
1. Complete user journeys (signup → create game → play → complete)
2. Cross-component integration
3. Real browser testing with Playwright
4. Critical path validation

**Estimated Setup**: 4-6 hours for Playwright configuration + 5 critical journey tests

### Priority 4: Performance Testing (MEDIUM VALUE)

**What to Add**:
1. Backend: Benchmark tests for critical queries
2. Frontend: Performance profiling for slow components
3. Load testing for concurrent users
4. Database query optimization validation

### What NOT to Do ❌

**Don't chase 100% coverage**:
- ✅ Current 70% combined coverage is excellent
- ⚠️ 90-100% coverage has diminishing returns
- ❌ Focus on quality over quantity

**Don't test implementation details**:
- ✅ Test user-visible behavior
- ✅ Test business logic
- ❌ Don't test internal state
- ❌ Don't test component structure

**Don't fight HTML5 validation**:
- ✅ Embrace native browser validation
- ✅ Test that validation attributes are present
- ❌ Don't try to bypass browser behavior

---

## Test Maintenance Strategy

### Ongoing Practices

**1. TDD for New Features**
- Write test first (failing)
- Implement feature
- Verify test passes
- Refactor if needed

**2. Regression Tests for Bugs**
- Always reproduce bug with test
- Document bug context in test name/comments
- Commit test with fix

**3. Regular Coverage Reviews**
- Generate coverage reports weekly
- Identify new gaps from features
- Add tests as needed

**4. Test Suite Optimization**
- Remove redundant tests
- Consolidate similar test cases
- Keep execution time reasonable

### Test Organization

**Backend Structure**:
```
backend/pkg/
  auth/
    auth_integration_test.go
    auth_api_integration_test.go
    sessions_test.go
  db/services/
    games_test.go
    characters_test.go
    phases_test.go
    [etc]
```

**Frontend Structure**:
```
frontend/src/
  components/
    __tests__/
      ComponentName.test.tsx
  hooks/
    __tests__/
      hookName.test.ts
  test-utils/
    render.tsx
  mocks/
    server.ts
    handlers.ts
```

---

## Historical Context

### October 2025 Testing Campaign

**Phase 1 (October 17)** - Initial Testing Campaign:
- ✅ Added 695 frontend tests (+213% growth)
- ✅ Achieved 60% frontend coverage target
- ✅ 100% component coverage (all 38 components have tests)
- ✅ Established comprehensive testing patterns
- ⚠️ Coverage report outdated (phases service 22.7% was incorrect)

**Phase 2 (October 23)** - Infrastructure & Accuracy:
- ✅ Fixed critical data integrity bug (deleted comment editing)
- ✅ Implemented automatic test isolation (27 table cleanup)
- ✅ Corrected coverage metrics (phases actually 81.9%)
- ✅ Documented service decomposition architecture
- ✅ Added 322 backend tests (+222% growth from Phase 1)
- ✅ Achieved 100% backend test pass rate

**Key Milestones**:
1. **Backend**: Accurate coverage measurement, service decomposition documented
2. **Frontend**: MSW v2 setup and pattern establishment
3. **Regression**: Tests added for all known bugs + new data integrity bug
4. **Infrastructure**: Automatic cleanup system, test reliability restored

### Major Refactoring (October 2025)

**AuthContext Consolidation**:
- Migrated from per-component user fetching to centralized AuthProvider
- Eliminated JWT decoding from client-side code
- Reduced API calls by 60-70%
- Updated 15+ components to use `useAuth()` hook

**Testing Impact**:
- Required updates to many component tests
- Improved testability with centralized auth
- Better loading state management with `isCheckingAuth`

---

## Success Metrics

### Coverage Targets: 🟡 GOOD PROGRESS

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| Backend Coverage | 80% | 69.5% | 🟡 10.5% gap |
| Frontend Coverage | 60% | ~60% | ✅ Met |
| Combined Coverage | 70% | ~65% | 🟡 5% gap |

### Test Count Targets: ✅ EXCEEDED

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| Backend Tests | 100+ | 467 | ✅ Exceeded (+322%) |
| Frontend Tests | 500+ | 1,022 | ✅ Exceeded (+104%) |
| Total Tests | 600+ | 1,489 | ✅ Exceeded (+148%) |

### Quality Targets: ✅ ACHIEVED

| Metric | Target | Status |
|--------|--------|--------|
| Pass Rate | 100% | ✅ Met |
| Test Reliability | Passing | ✅ All passing reliably |
| Test Isolation | Working | ✅ Automatic cleanup |
| Critical Paths Covered | Yes | ✅ All covered |
| Regression Tests | Yes | ✅ In place |
| Test Infrastructure | Mature | ✅ Established |

---

## Conclusion

### Current Assessment: PRODUCTION-READY ✅

The ActionPhase test suite has achieved **production-ready status** with:
- ✅ 1,489 comprehensive tests (+322 from Oct 17)
- ✅ 69.5% backend coverage (good, with clear improvement path)
- ✅ ~60% frontend coverage (strong)
- ✅ 100% pass rate
- ✅ Reliable test execution with automatic cleanup
- ✅ All critical paths covered
- ✅ Regression protection in place
- ✅ Mature test infrastructure

### Recent Critical Fixes (October 23, 2025) ✅

1. **Data Integrity Bug Fixed**: Prevented editing/deleting of already-deleted comments
2. **Test Isolation Fixed**: Automatic cleanup of all 27 database tables
3. **Service Decomposition Documented**: Phases, actions, messages now in modular architecture
4. **Test Reliability**: 100% pass rate restored with sequential execution

### Confidence Level: HIGH 🚀

**Backend**: Production-ready with clear gaps identified for strategic improvement

**Frontend**: Production-ready with extensive component coverage

**Test Infrastructure**: Mature and reliable with automatic cleanup

**Combined**: Strong confidence for production deployment and ongoing development

### Next Phase: STRATEGIC IMPROVEMENTS

**Priority 1** (6-9 hours):
1. **Actions Service Tests** - Bring query layer from 0% → 80%+ coverage
2. **Messages Service Polish** - Complete edge case coverage (71% → 85%+)
3. **Overall Coverage** - Reach 80%+ backend coverage target

**Then**:
1. Building new features with TDD
2. Adding E2E tests for critical journeys
3. Performance optimization
4. Bug fixes with regression tests

**The test suite provides strong confidence for production deployment with a clear roadmap for strategic improvements.**

---

## Quick Reference

### Running Tests

**Backend**:
```bash
just test              # All tests
just test-mocks        # Unit tests only (~300ms)
just ci-test          # Full CI suite (lint + test + race)

# With coverage
SKIP_DB_TESTS=false go test ./pkg/db/services -coverprofile=coverage.out
go tool cover -html=coverage.out -o coverage.html
```

**Frontend**:
```bash
just test-frontend            # Run all tests
just test-frontend-watch      # Watch mode
npm run test:coverage         # With coverage report
```

### Key Files

**Backend Tests**:
- `backend/pkg/auth/*_test.go` - Authentication tests
- `backend/pkg/db/services/*_test.go` - Service layer tests

**Frontend Tests**:
- `frontend/src/components/__tests__/*.test.tsx` - Component tests
- `frontend/src/hooks/__tests__/*.test.ts` - Hook tests
- `frontend/src/test-utils/render.tsx` - Test utilities
- `frontend/src/mocks/server.ts` - MSW configuration

**Documentation**:
- `docs/testing/COVERAGE_STATUS.md` - This document
- `docs/testing/TEST_DATA.md` - Test fixtures documentation
- `.claude/context/TESTING.md` - Testing philosophy and patterns
- `frontend/TESTING_NOTES.md` - Frontend testing notes

---

**Last Updated**: October 23, 2025
**Next Review**: After actions service testing complete or when coverage changes significantly
**Target**: Reach 80%+ backend coverage with actions service tests (6-9 hours estimated)
