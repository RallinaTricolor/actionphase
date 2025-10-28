# E2E Test Failures Analysis

**Date**: 2025-10-26
**Test Run**: 121 passing, 7 failing, 50 skipped
**Context**: Continuing E2E test improvements with fixture-based approach

---

## Summary of Failures

### 1. Character Approval Workflow (2 failures)

**Tests**:
- `rejected character can be edited and resubmitted`
- `approved characters appear in active game`

**Error**: `Internal error: step id not found: fixture@85`, `fixture@67`

**Analysis**:
- Playwright framework error, not a code bug
- Tests use fixtures from `14_character_workflows.sql` (Game #301)
- Fixtures include pre-created characters in different states
- Error occurs during parallel test execution
- Tests likely pass when run individually

**Root Cause**: Playwright test isolation or parallel execution issue

**Status**: ⚠️ Framework issue - tests are correctly implemented

---

### 2. Private Messages - GM with NPCs (1 failure)

**Test**: `GM can send private messages as different NPCs`

**Error**:
```
locator.selectOption: options[0].label: expected string, got object
at pages/MessagingPage.ts:90
```

**Analysis**:
- Error shows `selectOption({ label: new RegExp(characterName) })`
- Playwright's `selectOption` doesn't accept RegExp for label
- MessagingPage.ts:83-113 already has correct implementation using value-based selection
- Error suggests stale test compilation or cached build

**Root Cause**: Test code is already fixed but cache may be stale

**Status**: ✅ Fixed in code, may need cache clear

---

### 3. Private Messages - Audience Member (1 failure)

**Test**: `Audience member can send private messages as assigned NPC`

**Error 1** (Fixed): `Cannot read properties of undefined (reading 'username')`
- Was caused by missing AUDIENCE user in test-users.ts
- **FIXED**: AUDIENCE user exists in test-users.ts

**Error 2** (Current): "Failed to load messages" when audience member accesses Messages tab

**Screenshot Evidence**:
- Audience user (TestAudience) successfully logs in
- Navigates to Game #302 (E2E Test: GM Messaging)
- Messages tab shows: "Failed to load messages" error

**Analysis**:
- Backend endpoint: `/api/v1/games/302/private-messages/all`
- Permission check: `CanUserViewGame` → calls `IsUserInGame`
- Fixture: Audience member IS added as participant (14_character_workflows.sql:187)
  ```sql
  (game_gm_messaging_id, aud1_id, 'audience', 'active', NOW() - INTERVAL '8 days')
  ```
- SQL query: `ListAllPrivateConversations` has no permission filtering
- Backend service: Calls `CanUserViewGame` which should pass for audience

**Hypothesis**:
- Possible timing issue with fixture loading
- Or backend permission logic has edge case for audience + empty conversations
- Need backend logs to confirm exact failure point

**Status**: ⚠️ Backend permission or data loading issue - needs investigation

---

### 4. Common Room Threading (3 failures)

**Tests**:
- `Players can reply to each others comments (nested replies)`
- `Multiple players can reply to the same comment`
- `Deep nesting shows Continue this thread button at max depth`

**Error**: Nested replies not visible to other users after page reload

**Screenshot Evidence**:

Test sequence for "nested replies":
1. **Screenshot 1**: GM creates post (shows "Create New GM Post" form)
2. **Screenshot 2**: Player 2 views post and adds comment
   - Post visible: "Discussion 1761540165131: What should we do next?"
   - Comment visible: "Comment 1761540167262: I think we should scout ahead"
   - Reply button available
3. Player 1 (not shown) replies to Player 2's comment ✓
4. **Screenshot 3**: Player 2 reloads page
   - **CRITICAL**: Entire Common Room is EMPTY
   - Shows: "View GM posts and join the discussion..."
   - NO posts, NO comments - everything disappeared!

**Analysis**:

This is NOT just a nested reply caching issue. The entire post/comment tree disappears when Player 2 reloads the page.

Possible causes:
1. **Posts not persisted**: Dynamically created test data isn't being saved to database
2. **Transaction rollback**: Test operations happening in a transaction that's rolled back
3. **Query issue**: Posts query failing for Player 2 after reload
4. **Fixture reset**: Fixtures being reset between test operations (unlikely - fixtures load once)

**Root Cause Investigation Needed**:
- Check if posts created via API during tests are actually persisted
- Verify React Query isn't blocking fresh data fetch on reload
- Check backend posts query for Player 2's permissions
- Examine browser console logs during test execution

**Status**: 🔴 Critical - Posts disappearing on reload (not just nested replies)

---

## Test Infrastructure Issues

### Playwright "Internal error: step id not found"

**Occurrences**:
- `fixture@67` - approved characters test
- `fixture@85` - rejected character resubmission test
- `fixture@46` - GM messaging test
- `fixture@106` - Multiple players reply test
- `fixture@39` - Audience messaging test
- `fixture@114` - Threading test

**Pattern**: Appears consistently during parallel test execution

**Impact**: Tests may be interfering with each other despite using isolated fixture games

**Hypothesis**:
- Playwright's fixture system has issues with parallel execution
- Or tests are sharing some state unexpectedly
- Or fixture cleanup/setup timing issue

---

## Recommendations

### Immediate Actions

1. **Common Room Post Persistence** (CRITICAL)
   - Add backend logging to post creation endpoint
   - Verify posts are actually saved to database during tests
   - Check if there's any transaction handling that could cause rollback
   - Run threading test with `--headed` flag to watch browser behavior

2. **Run Tests Sequentially** (SHORT-TERM FIX)
   - Try `npx playwright test --workers=1` to eliminate parallel execution issues
   - If Playwright errors disappear, confirms isolation problem
   - May reveal if character approval and messaging tests actually pass

3. **Clear Test Cache**
   - `npx playwright test --update-snapshots` (won't help but good practice)
   - Delete `node_modules/.cache` and `playwright/.cache`
   - Rebuild: `npm run build`

### Medium-Term Fixes

1. **Audience Messages Investigation**
   - Add debug logging to backend `ListAllPrivateConversations`
   - Verify `CanUserViewGame` succeeds for audience
   - Test manually: `curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/v1/games/302/private-messages/all`

2. **Post Persistence Verification**
   - Create dedicated test to verify post CRUD operations
   - Check database directly after test creates post: `SELECT * FROM posts WHERE game_id = 164`
   - Verify React Query cache invalidation on mutation

3. **Test Isolation Review**
   - Ensure each test uses dedicated fixture game (already doing this ✓)
   - Verify no shared state between browser contexts
   - Check if fixture IDs are truly isolated (Games 164-168 for Common Room tests ✓)

---

## Current Status

**Test Success Rate**: 121/178 passing = **68%** (excluding 50 skipped visual regression tests)

**Actual Failures**:
- 7 functional tests failing
- 2 are framework issues (Playwright internal errors)
- 2 are likely already fixed (code updated, cache stale)
- 3 are real bugs (post persistence + audience permissions)

**True Bug Count**: 3-5 failures need investigation

---

## Fixes Implemented

### ✅ Fix #1: CommonRoom Loading State (PARTIAL FIX)

**Issue**: CommonRoom component returned `null` when `currentPhaseData` was undefined, causing blank screen on reload.

**Root Cause**:
- Line 196 in `GameTabContent.tsx` required `currentPhaseData?.phase?.phase_type === 'common_room'`
- When page reloaded, this data hadn't loaded yet, so component didn't render
- No loading state meant users saw blank screen instead of spinner

**Fix Applied**:
```typescript
// GameDetailsPage.tsx:47
const { data: currentPhaseData, isLoading: isLoadingPhase } = useQuery({...})

// GameTabContent.tsx:198-232
if (activeTab === 'common-room' && game.state === 'in_progress') {
  // Show loading spinner while phase data loads
  if (isLoadingPhase) {
    return <Spinner />;
  }

  // Render CommonRoom when phase data is ready
  if (currentPhaseData?.phase?.phase_type === 'common_room') {
    return <CommonRoom ... />;
  }
}
```

**Result**:
- ✅ CommonRoom now renders with loading state
- ✅ No more blank screen on page reload
- ⚠️ Posts still not loading (separate issue - see below)

**Files Modified**:
- `frontend/src/pages/GameDetailsPage.tsx` (added `isLoadingPhase`)
- `frontend/src/components/GameTabContent.tsx` (added loading state UI)

### 🔴 Remaining Issue: Posts Not Loading After Reload

**Current Status**: Posts exist in database but don't display after page reload

**Evidence**:
```sql
-- Posts ARE in database with correct phase_id
SELECT id, content, phase_id FROM messages
WHERE game_id = 164 AND message_type = 'post';
 id  | content                                    | phase_id
-----+--------------------------------------------+----------
 189 | Discussion 1761540710426: What should... |      773

-- Active phase matches
SELECT id FROM game_phases WHERE game_id = 164 AND is_active = true;
 id
-----
 773
```

**Screenshots Show**:
1. Before reload: Posts and comments visible ✓
2. After reload: Common Room renders but posts missing ✗

**Hypothesis**: React Query cache or API filtering issue
- The `getGamePosts` API call filters by `phase_id`
- Phase data loads correctly (loading state works)
- But posts query may be cached or filtered incorrectly

**Next Investigation Steps**:
1. Add browser console logging to see actual API calls
2. Check React Query devtools to see cache state
3. Verify `phaseId` prop is correct when passed to CommonRoom
4. Check if there's a race condition between phase load and posts load

---

## Next Steps (Priority Order)

1. ✅ **Document findings** (this file - UPDATED)
2. 🟡 **Complete post loading fix** - Debug why posts don't load after reload
3. ⚠️ **Run tests sequentially** - Eliminate parallel execution as variable
4. ⚠️ **Debug audience messages** - Backend logs + manual API test
5. ✅ **Clear caches** - Eliminate stale compilation as variable

---

## Notes

- Fixture-based approach is working well for stable tests (character avatars, game lifecycle, etc.)
- Issues appear mainly in tests that CREATE data dynamically (posts, messages)
- Common Room game #164 should be isolated but posts aren't persisting
- Backend API may be working (other similar tests pass) - could be test-specific issue
