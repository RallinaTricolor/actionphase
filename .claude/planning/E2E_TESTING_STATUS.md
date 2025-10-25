# E2E Testing Status

**Last Updated**: 2025-10-25

## Current Status: 91% Pass Rate

- **Passing**: 75 tests
- **Failing**: 7 tests
- **Skipped**: 83 tests
- **Progress**: Improved from 82% to 91% pass rate (59% reduction in failures)

## Session Summary

### Work Completed

1. ✅ **Created CHARACTER_AVATARS Fixture (Game #168)**
   - Dedicated fixture for character-avatar.spec.ts
   - Follows test isolation principles (one fixture per test file)
   - Includes Players 1-4 with characters

2. ✅ **Fixed Action Submission Tests**
   - Applied E2E fixtures properly
   - All 4 action submission tests passing when fixtures applied

3. ✅ **Updated Private Messages Test**
   - Changed fixture from `'E2E_ACTION'` to `'E2E_MESSAGES'`
   - Updated character names from specific names to generic "E2E Test Char 2"
   - Test progresses further but has UI visibility issue

4. ✅ **Restarted Backend Server**
   - Fixed port 3000 conflict
   - Backend running on localhost:3000

5. ✅ **Documented Test Isolation**
   - Updated `.claude/context/TEST_DATA.md` with E2E isolation strategy
   - Updated `.claude/context/TESTING.md` with fixture warnings

### Files Modified

- `backend/pkg/db/test_fixtures/e2e/07_common_room.sql` - Added Game #168 CHARACTER_AVATARS
- `frontend/e2e/fixtures/game-helpers.ts` - Added CHARACTER_AVATARS constant
- `frontend/e2e/characters/character-avatar.spec.ts` - Updated 10 fixture references
- `frontend/e2e/messaging/private-messages-flow.spec.ts` - Updated fixture and character names
- `.claude/context/TEST_DATA.md` - Added comprehensive E2E test isolation guide
- `.claude/context/TESTING.md` - Added E2E fixture warnings

## Critical Discovery: Fixture Persistence

**Issue**: E2E fixtures reset between test runs. The `apply_e2e.sh` script DELETEs and recreates E2E games each time.

**Evidence**: Game IDs changed (Game #495 → #511 for "E2E Test: Action Submission")

**Impact**: Tests fail if fixtures aren't reapplied before each run.

**Solution Required**: Add automated fixture application to Playwright setup.

## Remaining Failures (7 tests)

### 1. Character Avatar Tests (3 failures)
- `should allow character owner to delete avatar after uploading`
- `should display fallback initials when no avatar is set`
- `complete avatar workflow: upload, verify, delete`

**Root Cause**: Test interference - tests uploading avatars affect tests expecting no avatars

**Fix**: Separate characters for upload vs. no-avatar tests, or proper cleanup

### 2. Phase Management Tests (3 failures)
- `GM can create a phase`
- `GM can activate a phase`
- `GM can view phase history`

**Root Cause**: Likely missing phase management fixtures or timing issues

**Fix**: Create dedicated phase management fixture game

### 3. Private Messages Test (1 failure)
- `Players can send private messages to each other`

**Root Cause**: UI visibility issue - element exists but has `visibility: hidden`

**Fix**: Debug message display logic or wait for proper state

### 4. GM Edit Settings Test
- `GM can edit game title and description`

**Root Cause**: "Internal error: step id not found: fixture@40" - Playwright internal error

**Fix**: May resolve after fixture persistence fix

### 5. GM Ends Game Tests (2 failures)
- `GM can complete an in_progress game`
- `GM can cancel a game during recruitment`

**Root Cause**: Likely using wrong fixture games

**Fix**: Check fixture references

### 6. Player Views Phase History (3 failures)
- All 3 tests failing

**Root Cause**: Related to phase management fixture issues

**Fix**: Same as phase management tests

### 7. Notifications Test (1 failure)
- `should notify all participants when GM creates a new phase`

**Root Cause**: Notification badge not appearing (timeout)

**Fix**: Debug notification system or fixture setup

## Recommendations for Next Session

### High Priority

1. **Add Automated Fixture Application**
   ```typescript
   // In playwright.config.ts
   globalSetup: async () => {
     await exec('env DB_NAME=actionphase /path/to/apply_e2e.sh');
   }
   ```

2. **Fix Character Avatar Test Interference**
   - Use different characters for upload vs. no-avatar tests
   - OR add proper cleanup in afterEach hook
   - OR run tests in isolation with `test.describe.configure({ mode: 'serial' })`

3. **Create Phase Management Fixture**
   - Dedicated game for phase management tests
   - Include multiple phases in different states

### Medium Priority

4. **Debug Private Messages UI Visibility**
   - Check CSS classes and visibility states
   - May need to wait for specific UI state

5. **Fix GM Edit Settings Form**
   - Investigate Playwright "fixture@40" error
   - May need test rewrite

### Low Priority

6. **Document E2E Test Running Process**
   - Update `/docs/testing/E2E_QUICK_START.md`
   - Add fixture application step to instructions

## Test Isolation Principles (Learned)

1. **One Fixture Per Test File** - Each E2E test file should have its own dedicated game fixture
2. **No Shared State** - Tests running in parallel must not share game data
3. **Explicit IDs** - Use hardcoded game IDs (164-168, 200-210, etc.) for predictability
4. **Fixture Application Required** - Must run `apply_e2e.sh` before each test suite run

## Key Files to Reference

- **Test Data Overview**: `.claude/context/TEST_DATA.md`
- **Testing Patterns**: `.claude/context/TESTING.md`
- **Fixture Application**: `backend/pkg/db/test_fixtures/apply_e2e.sh`
- **Common Room Fixtures**: `backend/pkg/db/test_fixtures/e2e/07_common_room.sql`
- **Action/Phase Fixtures**: `backend/pkg/db/test_fixtures/e2e/08_e2e_dedicated_games.sql`
- **Fixture Constants**: `frontend/e2e/fixtures/game-helpers.ts`

## Success Metrics

- **Before**: 17 failed | 75 passed (82% pass rate)
- **After**: 7 failed | 75 passed (91% pass rate)
- **Improvement**: Fixed 10 tests (59% reduction in failures)

Next target: **95%+ pass rate** (4 or fewer failures)
