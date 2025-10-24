# Test Coverage Improvement Plan

**Created**: October 23, 2025
**Status**: Active
**Overall Goal**: Fix failing tests, update coverage metrics, and strategically increase test coverage

---

## Executive Summary

**Current Situation**:
- ✅ Backend: Strong test coverage with decomposed service architecture
- ⚠️ **CRITICAL**: Messages service has 1 failing test
- ✅ Frontend: Production-ready at ~60% coverage (1,022 tests)
- ⚠️ Coverage report (COVERAGE_STATUS.md) is **OUTDATED** (October 17)
- ✅ Test infrastructure is mature and well-established

**Key Finding**: The codebase has evolved significantly since the last coverage report. Services have been decomposed into focused modules with dedicated test files. The reported 22.7% phases coverage is obsolete - actual coverage is 82.4%.

---

## Priority 0: Fix Failing Test (IMMEDIATE) 🔴

### Issue: Messages Service Test Failure

**Failing Test**: `TestMessageService_CommentEditDeleteTracking/cannot_edit_or_delete_already_deleted_comment`

**Location**: `/backend/pkg/db/services/messages/messages_test.go:1446`

**Problem**: Test expects an error when editing a deleted comment, but no error is returned

**Impact**: This is a **potential security/data integrity bug**. Users should NOT be able to edit deleted comments.

**Action Required**:
1. Read the test code to understand expected behavior
2. Read the `UpdateComment` implementation in `comments.go`
3. Add validation to prevent editing deleted comments
4. Verify all related tests pass
5. **Estimated Time**: 30-60 minutes

**Priority**: CRITICAL - Must fix before proceeding with coverage analysis

---

## Priority 1: Update Coverage Metrics (HIGH) 📊

### Problem

The `/docs/testing/COVERAGE_STATUS.md` document is outdated:
- Last Updated: October 17, 2025
- Reports phases.go at 22.7% coverage (actual: 82.4%)
- Reports messages.go at 47.3% coverage (actual: 71.7%)
- Doesn't reflect service decomposition architecture

### Service Architecture Evolution

Since October 17, major services have been decomposed:

**Phases Service** → `/backend/pkg/db/services/phases/`:
- `service.go` - Main service struct
- `crud.go` + `crud_test.go` - CRUD operations
- `transitions.go` + `transitions_test.go` - Phase transitions
- `history.go` + `history_test.go` - History operations
- `validation.go` + `validation_test.go` - Validation logic
- `converters.go` + `converters_test.go` - Data conversion

**Actions Service** → `/backend/pkg/db/services/actions/`:
- `service.go` - Service struct
- `submissions.go` + `submissions_test.go` - Action submissions
- `results.go` + `results_test.go` - Results management
- `validation.go` + `validation_test.go` - Validation
- `queries.go` - Query helpers

**Messages Service** → `/backend/pkg/db/services/messages/`:
- `service.go` - Service struct
- `posts.go` - Post operations
- `comments.go` - Comment operations
- `reactions.go` - Reaction handling
- `read_tracking.go` + `read_tracking_test.go` - Read status tracking
- `validation.go` - Validation logic
- `audience.go` - Audience management
- `messages_test.go` - Comprehensive test suite (56KB!)
- `mentions_extraction_test.go` - Mention parsing tests
- `recent_comments_test.go` - Recent comments tests

### Action Required

**Step 1: Generate Fresh Coverage Report**

```bash
# Run full test suite with coverage
SKIP_DB_TESTS=false go test ./pkg/db/services/... -coverprofile=coverage.out -covermode=atomic

# Generate per-file breakdown
go tool cover -func=coverage.out | grep -E '\.go:' > coverage_breakdown.txt

# Get overall coverage
go tool cover -func=coverage.out | tail -1

# Generate HTML visualization
go tool cover -html=coverage.out -o coverage.html
```

**Step 2: Analyze Coverage by Service**

```bash
# Actions service
SKIP_DB_TESTS=false go test ./pkg/db/services/actions -coverprofile=actions_cov.out
go tool cover -func=actions_cov.out

# Phases service
SKIP_DB_TESTS=false go test ./pkg/db/services/phases -coverprofile=phases_cov.out
go tool cover -func=phases_cov.out

# Messages service (after fixing failing test)
SKIP_DB_TESTS=false go test ./pkg/db/services/messages -coverprofile=messages_cov.out
go tool cover -func=messages_cov.out

# Characters service
SKIP_DB_TESTS=false go test ./pkg/db/services/characters -coverprofile=characters_cov.out
go tool cover -func=characters_cov.out

# Games service
SKIP_DB_TESTS=false go test ./pkg/db/services -run "TestGame.*" -coverprofile=games_cov.out
go tool cover -func=games_cov.out
```

**Step 3: Update COVERAGE_STATUS.md**

Update the following sections:
- Overall backend coverage percentage
- Per-service coverage breakdown
- Test count (likely significantly higher now)
- Service architecture notes (reflect decomposition)
- Update "Last Updated" date

**Estimated Time**: 1-2 hours

---

## Priority 2: Backend Test Gaps Analysis (MEDIUM) 🔍

### Once Coverage Report is Updated

**Analyze Each Service for Gaps**:

1. **Actions Service** (`/backend/pkg/db/services/actions/`)
   - Review coverage of `submissions.go`
   - Review coverage of `results.go`
   - Identify untested edge cases
   - Focus on business logic validation

2. **Phases Service** (`/backend/pkg/db/services/phases/`)
   - Already at 82.4% - identify remaining 17.6%
   - Focus on error paths
   - Complex transition edge cases

3. **Messages Service** (`/backend/pkg/db/services/messages/`)
   - Currently 71.7% - target 85%+
   - Likely gaps in `posts.go` and `comments.go` CRUD operations
   - Edge cases in mention extraction
   - Permission checks

4. **Characters Service** (`/backend/pkg/db/services/characters/`)
   - Review current coverage
   - Focus on character ownership validation
   - NPC vs PC workflows

5. **Games Service** (`/backend/pkg/db/services/`)
   - Still in monolithic file structure
   - Review `games.go`, `game_applications.go`, `conversations.go`
   - Consider decomposition if needed

### Target Metrics

| Service | Current | Target | Priority |
|---------|---------|--------|----------|
| actions | TBD | 85%+ | High |
| phases | 82.4% | 90%+ | Medium |
| messages | 71.7% | 85%+ | High |
| characters | TBD | 85%+ | Medium |
| games | TBD | 80%+ | Medium |
| game_applications | TBD | 85%+ | Low |
| conversations | TBD | 80%+ | Low |

**Estimated Time**: 3-5 hours of test writing based on gaps found

---

## Priority 3: Frontend Coverage Assessment (MEDIUM) 📱

### Current Status

✅ **Production-Ready**: ~60% coverage, 1,022 tests across 38 test files

### Assessment Questions

1. **Are there new components since October 17?**
   - Check for new components without tests
   - Verify all recent features have tests

2. **Recent Bug Fixes**
   - Bug #7: Toast notifications (replaced 29 alerts) - Do we have toast tests?
   - Bug #8: Auto-reject applications on game cancellation - Tests exist
   - Bug #10: Character avatars in audience view - Need component test?
   - Bug #3: DateTimeInput enhancement - Need component test?

3. **High-Value Test Additions**
   - Complex user workflows (not yet covered)
   - Recent refactors (AuthContext consolidation tests?)
   - Edge cases in new features

### Action Plan

**Step 1: Identify Recent Components** (30 min)
```bash
# Find recently modified components
find frontend/src/components -name "*.tsx" -type f -mtime -30 | sort

# Check which ones have tests
find frontend/src/components/__tests__ -name "*.test.tsx" -type f -mtime -30 | sort
```

**Step 2: Gap Analysis** (1 hour)
- Compare recent component changes to test coverage
- Identify critical components without adequate tests
- Document findings

**Step 3: Strategic Test Additions** (2-4 hours)
- Focus on recent bug fixes (regression tests)
- Test new features (DateTimeInput, Toast notifications)
- High-value components only (don't chase 100%)

**Estimated Time**: 3-5 hours total

---

## Priority 4: Integration & E2E Testing Strategy (LOW) 🎭

### Current State

**Backend Integration Tests**: ✅ Excellent
- All service tests use real database
- Transaction-based isolation
- Comprehensive CRUD coverage

**Frontend E2E Tests**: ⚠️ Minimal/None
- High-value opportunity
- Better ROI than more unit tests at this point

### E2E Testing Plan

**Philosophy**: Test complete user journeys, not individual features

**Critical Journeys to Test**:

1. **New Player Journey** (15-20 min to implement)
   - Register → Browse games → Apply to game → Get approved → View dashboard

2. **GM Game Management Journey** (20-30 min to implement)
   - Login → Create game → Review applications → Approve player → Start game

3. **Active Phase Journey** (20-30 min to implement)
   - Login as player → View active phase → Submit action → View results

4. **Communication Journey** (15-20 min to implement)
   - Login → Create private conversation → Send message → Reply → View history

5. **Phase Transition Journey** (20-30 min to implement)
   - Login as GM → View unpublished results → Publish all → Activate next phase

**Technology**: Playwright (already configured)

**Setup Required**:
- Test fixture database
- Seed data for E2E scenarios
- Page object patterns
- CI/CD integration

**Estimated Time**: 6-10 hours for initial 5 journeys

**Priority**: LOW (defer until backend coverage updated and gaps filled)

---

## Implementation Timeline

### Week 1 (Immediate)

**Day 1** (2-3 hours):
- [ ] Fix failing messages service test
- [ ] Generate fresh backend coverage report
- [ ] Update COVERAGE_STATUS.md with accurate numbers

**Day 2** (3-4 hours):
- [ ] Analyze backend coverage gaps by service
- [ ] Identify specific untested functions
- [ ] Document test cases needed

**Day 3** (3-4 hours):
- [ ] Write high-priority backend tests (actions, messages)
- [ ] Verify coverage improvements
- [ ] Update COVERAGE_STATUS.md

### Week 2 (Strategic)

**Day 1** (2-3 hours):
- [ ] Frontend gap analysis (recent components)
- [ ] Identify regression test needs

**Day 2** (3-4 hours):
- [ ] Write frontend tests for recent features
- [ ] Add regression tests for bug fixes
- [ ] Run full frontend test suite

**Day 3** (2-3 hours):
- [ ] Final coverage report generation
- [ ] Update all documentation
- [ ] Verify all tests passing

### Future (Deferred)

**E2E Testing** (10-15 hours):
- [ ] Playwright test infrastructure
- [ ] 5 critical journey tests
- [ ] CI/CD integration

**Total Estimated Time**:
- **Immediate Work**: 8-11 hours
- **Strategic Work**: 7-10 hours
- **Future Work**: 10-15 hours

---

## Success Metrics

### Backend

| Metric | Current | Target | Status |
|--------|---------|--------|--------|
| Overall Coverage | TBD | 85%+ | 🔄 Pending |
| Test Count | 145 | 170+ | 🔄 Pending |
| All Tests Passing | ❌ No | ✅ Yes | 🔴 Failing |
| Actions Coverage | TBD | 85%+ | 🔄 Pending |
| Phases Coverage | 82.4% | 90%+ | 🟡 Close |
| Messages Coverage | 71.7% | 85%+ | 🔄 Pending |

### Frontend

| Metric | Current | Target | Status |
|--------|---------|--------|--------|
| Overall Coverage | ~60% | 65%+ | ✅ Good |
| Test Count | 1,022 | 1,050+ | ✅ Excellent |
| All Tests Passing | ✅ Yes | ✅ Yes | ✅ Passing |
| Recent Features Tested | ❓ | 100% | 🔄 Pending |

### Combined

| Metric | Target | Status |
|--------|--------|--------|
| Total Tests | 1,200+ | 🔄 Pending |
| Pass Rate | 100% | 🔴 Failing (backend) |
| Production Ready | ✅ Yes | 🟡 After fixes |

---

## Appendix: Testing Commands Reference

### Backend

```bash
# All tests with coverage
SKIP_DB_TESTS=false go test ./pkg/db/services/... -coverprofile=coverage.out -covermode=atomic

# Fast unit tests (mocks only)
SKIP_DB_TESTS=true go test ./...

# Specific service
SKIP_DB_TESTS=false go test ./pkg/db/services/messages -v

# Specific test
SKIP_DB_TESTS=false go test ./pkg/db/services/messages -run TestMessageService_CommentEditDeleteTracking -v

# Coverage report
go tool cover -func=coverage.out
go tool cover -html=coverage.out -o coverage.html
```

### Frontend

```bash
# All tests
npm run test

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage

# Specific file
npm run test -- GamesList.test.tsx
```

### E2E (Future)

```bash
# Run E2E tests
npx playwright test

# Watch mode
npx playwright test --ui

# Specific test
npx playwright test new-player-journey.spec.ts
```

---

## Next Actions

**IMMEDIATE** (Do Now):
1. Fix the failing messages service test
2. Generate accurate coverage report
3. Update COVERAGE_STATUS.md

**THIS WEEK**:
1. Analyze backend coverage gaps
2. Write high-priority tests
3. Frontend gap analysis

**NEXT SPRINT**:
1. Frontend regression tests
2. Consider E2E test infrastructure

---

**Plan Owner**: Claude Code
**Last Updated**: October 23, 2025
**Next Review**: After Priority 0 and Priority 1 completed
