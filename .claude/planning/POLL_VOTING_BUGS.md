# Poll Voting Bugs - Investigation & Fix

**Context**: User reported that after voting on a poll as a player, they saw:
1. Brief "Loading results..." message (which shouldn't appear for players on active polls)
2. 403 error trying to fetch poll results
3. "Not Voted" badge persisting even after successful vote (200 OK response)

**Testing Method**: Manual testing with Playwright MCP in Game ID 169

---

## Bug #1: Players Fetching Results on Active Polls (403 Errors)

### What the Issue Is
After voting on an active poll, players briefly saw "Loading results..." and the browser console showed 403 errors trying to fetch `/api/v1/polls/{id}/results`. Players are not authorized to view results on active polls (only after expiration), so this fetch should never happen.

### Investigation/Reproduction
1. Logged in as TestPlayer1 (player role)
2. Navigated to Game ID 169 polls tab
3. Clicked "Vote Now" on poll #22
4. Selected an option and submitted vote
5. **Observed**: "Loading results..." appeared briefly
6. **Browser console**: `GET /api/v1/polls/22/results 403 (Forbidden)`

### Root Cause
In `PollCard.tsx` line 92-95 (before fix), the `onSuccess` callback unconditionally set `showResults=true` for ALL users after voting. This triggered the `usePollResults` hook to fetch results, which players don't have permission for on active polls.

**Permission rules**:
- **Players**: Can only view results AFTER poll expires
- **GM/Audience**: Can view results anytime (even on active polls)

### Fix Applied
**File**: `frontend/src/components/PollCard.tsx`

Modified `onSuccess` callback to check permissions before showing results:
```typescript
onSuccess={() => {
  setShowVotingForm(false);
  // Only show results if user is allowed to view them
  // Players can only see results on expired polls
  // GMs and audience can see results anytime
  if (poll.is_expired || isGM || isAudience) {
    setShowResults(true);
  }
}}
```

### Tests Updated
- **E2E test needs update**: `frontend/e2e/gameplay/polls-flow.spec.ts` - Need to verify NO 403 errors in console after voting

### Status
✅ **FIXED** - No more 403 errors, no "Loading results..." for players on active polls

---

## Bug #2: Initial State Triggering Unauthorized Fetch

### What the Issue Is
Even on initial page load (before voting), if `poll.user_has_voted` was true, the component would try to fetch results immediately, causing a 403 error for players on active polls.

### Investigation/Reproduction
1. Refreshed page after voting on poll #22
2. **Observed**: 403 error appeared immediately on page load
3. **Root cause**: `useState(poll.is_expired || poll.user_has_voted)` didn't check permissions

### Root Cause
Line 18 (before fix) initialized `showResults` state to `poll.user_has_voted` without checking if the user has permission to view results:
```typescript
const [showResults, setShowResults] = useState(poll.is_expired || poll.user_has_voted);
```

This meant that for players who had voted on an active poll, `showResults` would be `true` on initial render, triggering the `usePollResults` hook immediately.

### Fix Applied
**File**: `frontend/src/components/PollCard.tsx`

Calculate initial state with permission check:
```typescript
// Calculate initial showResults state with permission check
// Players can only see results on expired polls
// GMs and audience can see results anytime (even on active polls)
const initialShowResults =
  (poll.is_expired || poll.user_has_voted) && // User has voted or poll expired
  (poll.is_expired || isGM || isAudience);     // AND user has permission to view

const [showResults, setShowResults] = useState(initialShowResults);
```

### Tests Updated
- **E2E test needs update**: Verify no 403 errors on page load for voted polls

### Status
✅ **FIXED** - No unauthorized fetches on initial render

---

## Bug #3: State Not Syncing After Cache Invalidation

### What the Issue Is
After successfully voting, the `showResults` state didn't update when the poll data changed due to React Query cache invalidation. The `useEffect` wasn't watching the right dependencies.

### Investigation/Reproduction
1. Voted on poll #22 successfully
2. React Query invalidated cache and refetched polls
3. **Expected**: `showResults` state should update based on new `poll.user_has_voted` value
4. **Actual**: State stayed stale, causing badge to not update

### Root Cause
Missing `useEffect` to sync `showResults` state when `poll` prop changes after cache invalidation.

### Fix Applied
**File**: `frontend/src/components/PollCard.tsx`

Added `useEffect` to sync state when poll data updates:
```typescript
// Sync showResults state when poll data changes (after cache invalidation)
useEffect(() => {
  // Determine if results should be shown based on user permissions
  const shouldShowResults =
    (poll.is_expired || poll.user_has_voted) && // User has voted or poll expired
    (poll.is_expired || isGM || isAudience);     // AND user has permission to view

  setShowResults(shouldShowResults);
}, [poll.is_expired, poll.user_has_voted, isGM, isAudience]);
```

### Tests Updated
- **E2E test needs update**: Verify badge updates immediately after voting (no refresh needed)

### Status
✅ **FIXED** - State syncs correctly after cache invalidation

---

## Bug #4: Backend Missing `user_has_voted` Field

### What the Issue Is
The `/api/v1/games/{id}/polls` endpoint didn't return a `user_has_voted` field in the response, so the frontend had no data to determine if the user had voted. This caused badges to always show "Not Voted" regardless of actual vote status.

### Investigation/Reproduction
```bash
curl -H "Authorization: Bearer $(cat /tmp/api-token.txt)" \
  "http://localhost:3000/api/v1/games/169/polls" | jq

# Response (before fix):
[{
  "id": 22,
  "question": "What should the party do next?",
  # ... other fields ...
  # MISSING: "user_has_voted" field
}]
```

### Root Cause
The `ListGamePolls` handler directly returned the database models without adding computed fields like `user_has_voted`.

### Fix Applied
**File**: `backend/pkg/polls/api_polls.go`

1. Created new response type `PollListItem` that embeds `db.CommonRoomPoll` and adds `UserHasVoted`:
```go
type PollListItem struct {
	db.CommonRoomPoll
	UserHasVoted bool `json:"user_has_voted"`
}
```

2. Updated handler to check vote status for each poll:
```go
pollListItems := make([]PollListItem, len(polls))
for i, poll := range polls {
	// Check if user has voted at all (as player OR with any character)
	hasVoted, err := pollService.HasUserVotedAny(ctx, poll.ID, userID)
	// ... error handling ...

	pollListItems[i] = PollListItem{
		CommonRoomPoll: poll,
		UserHasVoted:   hasVoted,
	}
}
```

### Tests Updated
- **Backend unit test needed**: Test that `ListGamePolls` returns `user_has_voted` field
- **API test**: `curl` verification that field is present

### Status
✅ **FIXED** - Backend now returns `user_has_voted` field

---

## Bug #5: Character Votes Not Detected

### What the Issue Is
The backend `HasUserVoted` query only checked for a specific `character_id`, so when checking "has user voted at all", it missed votes made with a character if we passed `nil` for character_id.

**Example**: User votes on poll #23 as "Polls Test Char 1" (character_id=14823). When we call `HasUserVoted(pollID=23, userID=1701, characterID=nil)`, it returns `false` because it's specifically looking for votes where `character_id IS NULL` (player votes).

### Investigation/Reproduction
1. Voted on poll #23 as character "Polls Test Char 1"
2. Backend check: `HasUserVoted(23, 1701, nil)` returned `false`
3. **Root cause**: SQL query uses `COALESCE(character_id, 0) = COALESCE(@character_id, 0)`, which doesn't match character votes when `@character_id` is NULL

### Root Cause
**SQL Query** (`backend/pkg/db/queries/polls.sql:210-218`):
```sql
SELECT EXISTS(
    SELECT 1 FROM poll_votes
    WHERE poll_id = @poll_id
      AND user_id = @user_id
      AND COALESCE(character_id, 0) = COALESCE(@character_id, 0)
) as has_voted;
```

When `@character_id` is NULL:
- `COALESCE(@character_id, 0)` = 0
- Only matches votes where `COALESCE(character_id, 0)` = 0 (i.e., player votes)
- Does NOT match votes where `character_id` = 14823

### Fix Applied
**Files**:
- `backend/pkg/db/queries/polls.sql`
- `backend/pkg/db/services/poll_service.go`
- `backend/pkg/polls/api_polls.go`

1. **Added new SQL query** `HasUserVotedAny`:
```sql
-- Check if user has voted in a poll at all (as player OR with any character)
SELECT EXISTS(
    SELECT 1 FROM poll_votes
    WHERE poll_id = @poll_id
      AND user_id = @user_id
) as has_voted;
```

2. **Added service method**:
```go
func (s *PollService) HasUserVotedAny(ctx context.Context, pollID int32, userID int32) (bool, error) {
	queries := db.New(s.DB)
	params := db.HasUserVotedAnyParams{
		PollID: pollID,
		UserID: userID,
	}
	return queries.HasUserVotedAny(ctx, params)
}
```

3. **Updated API handler** to use `HasUserVotedAny`:
```go
hasVoted, err := pollService.HasUserVotedAny(ctx, poll.ID, userID)
```

### Tests Updated
- **Backend unit test needed**: Test `HasUserVotedAny` with character votes
- **Integration test needed**: Verify polls list shows voted=true for character votes

### Status
✅ **FIXED** - Character votes now correctly detected

---

## Why E2E Tests Didn't Catch These Bugs

### Test Pyramid Violation

**The E2E test was checking the WRONG things at the WRONG level**:

1. **❌ E2E tested final UI state only** ("Voted" badge visible)
   - Didn't check **browser console for errors**
   - Didn't verify **no unauthorized API calls**
   - Didn't validate **permission logic**

2. **❌ No component tests for permission logic**
   - `PollCard.tsx` has complex permission logic (player vs GM/audience, active vs expired)
   - This should be tested at component level, not E2E level

3. **❌ No backend unit tests for `user_has_voted` field**
   - Backend changes (adding computed fields) had no tests
   - API contract not validated

4. **❌ No API integration tests**
   - Should have verified with `curl` that API returns correct fields
   - Should have tested both player votes AND character votes

### What Was Actually Tested

**E2E Test** (`polls-flow.spec.ts`):
```typescript
// Test ONLY checked that badge text changed
await expect(pollCard.getByText('Voted')).toBeVisible();
```

**What it MISSED**:
- ✗ 403 errors in console
- ✗ Unauthorized API calls being made
- ✗ "Loading results..." flash
- ✗ Badge state after voting with character
- ✗ Permission logic for players vs GM/audience

### Correct Testing Strategy

**Following the Test Pyramid**:

```
1. ✅ Backend Unit Tests (FIRST)
   - Test HasUserVotedAny logic
   - Test player votes vs character votes
   - Test ListGamePolls includes user_has_voted

2. ✅ API Integration Tests
   - curl verification of user_has_voted field
   - Test both player and character votes

3. ✅ Component Tests (React Testing Library)
   - Test PollCard permission logic
   - Test showResults state management
   - Mock different user roles (player, GM, audience)
   - Verify no unauthorized API calls (MSW)

4. ✅ E2E Tests (LAST - Happy Path Only)
   - Vote flow works end-to-end
   - Badge updates correctly
   - Check console for errors
```

### Lessons Learned

**Red Flags We Missed**:

1. **Skipped lower levels** - Went straight to E2E without component/unit tests
2. **Surface-level assertions** - Only checked visible text, not behavior
3. **No error checking** - E2E didn't monitor console or network calls
4. **Incomplete scenarios** - Only tested player votes, not character votes
5. **Permission logic untested** - Complex state management had zero unit tests

**What We Should Have Done**:

1. **Component test for PollCard permissions**:
```typescript
describe('PollCard permissions', () => {
  it('does not fetch results for players on active polls', () => {
    const { result } = renderHook(() => usePollResults(null));
    // Verify poll results hook is NOT called
  });

  it('shows results for GM on active polls', () => {
    // Test GM can see results immediately
  });
});
```

2. **Backend unit test for user_has_voted**:
```go
func TestListGamePolls_IncludesUserHasVoted(t *testing.T) {
	// Vote on poll as character
	// List polls
	// Assert user_has_voted = true
}
```

3. **API integration test**:
```bash
# Test player vote
TOKEN=$(cat /tmp/api-token.txt)
curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3000/api/v1/games/169/polls" | \
  jq '.[0].user_has_voted'  # Should be true/false

# Test character vote
curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3000/api/v1/games/169/polls" | \
  jq '.[1].user_has_voted'  # Should be true after character vote
```

4. **E2E test with console monitoring**:
```typescript
test('voting shows correct badge with no errors', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  // Vote on poll
  await page.click('[data-testid="vote-button"]');

  // Verify badge updated
  await expect(page.getByText('Voted')).toBeVisible();

  // CRITICAL: Verify no errors
  expect(consoleErrors).toHaveLength(0);
});
```

---

## Action Items for E2E Test Update

### Must Add to E2E Test

1. **Monitor browser console for errors**:
```typescript
const consoleErrors: string[] = [];
page.on('console', msg => {
  if (msg.type() === 'error') consoleErrors.push(msg.text());
});
```

2. **Verify no 403 errors after voting**:
```typescript
await expect(page.getByText('Voted')).toBeVisible();
expect(consoleErrors.filter(e => e.includes('403'))).toHaveLength(0);
```

3. **Test character voting scenario**:
```typescript
test('character vote updates badge correctly', async ({ page }) => {
  // Vote on character poll
  // Verify badge shows "Voted"
  // Verify no console errors
});
```

4. **Verify no "Loading results..." for players**:
```typescript
// After voting, should NOT see loading state
await expect(page.getByText('Loading results')).not.toBeVisible();
```

### Should Add Component Tests

File: `frontend/src/components/PollCard.test.tsx` (NEW)

```typescript
describe('PollCard permission logic', () => {
  it('does not fetch results for players on active polls after voting', () => {
    // Test showResults state logic
  });

  it('fetches results for GM on active polls', () => {
    // Test GM permission
  });

  it('syncs showResults when poll data updates', () => {
    // Test useEffect sync
  });
});
```

### Should Add Backend Tests

File: `backend/pkg/db/services/poll_service_test.go`

```go
func TestHasUserVotedAny_CharacterVote(t *testing.T) {
	// Vote as character
	// Check HasUserVotedAny returns true
}

func TestListGamePolls_IncludesUserHasVoted(t *testing.T) {
	// Verify API includes user_has_voted field
}
```

---

## Summary

**Bugs Fixed**: 5 bugs (2 frontend state management, 3 backend API)

**Root Cause**: Violation of Test Pyramid
- ✗ Skipped unit/component tests
- ✗ E2E tested wrong things (UI state only, not behavior)
- ✗ No console error monitoring
- ✗ Incomplete test scenarios (missing character votes)

**Correct Approach**:
1. Backend unit tests for vote detection logic
2. API tests with curl for contract validation
3. Component tests for permission logic
4. E2E tests for happy path + error monitoring

---

## Deep Re-evaluation of E2E Test Strategy

### What the Current E2E Test Actually Validates

**Current test structure** (`polls-flow.spec.ts`):
```
1. GM can create a player-level poll → ✅ Poll appears in UI
2. Player can view poll and vote → ✅ Badge shows "Voted"
3. Another player can vote with "other" → ✅ Badge shows "Voted"
4. GM can create a character-level poll → ✅ Poll appears in UI
5. Player can vote as character → ✅ Badge shows "Voted"
6. GM can view poll results → ✅ Results visible
7. Player CANNOT view results → ✅ "Show Results" button not visible
8. Audience CAN view results → ✅ Button visible, results toggle
9. Poll filtering → ✅ Toggle works
```

**What it actually tests**: "Does the UI render the expected elements after actions?"

**What it MISSED**: "Does the application behave correctly without errors?"

### The Fundamental Problem

The E2E test validated **OUTCOMES** but not **BEHAVIOR**:

❌ **What we tested:**
- Badge text changed to "Voted" → PASS

✅ **What we should have tested:**
- Badge text changed to "Voted" → PASS
- No 403 errors in console → **FAIL** (bug existed!)
- No "Loading results..." flash → **FAIL** (bug existed!)
- No unauthorized API calls → **FAIL** (bug existed!)
- Badge persists on page reload → **FAIL** (would have caught Bug #4!)

### Why Serial Tests Hide Problems

The current test is a **serial flow** (tests run in order, building on previous state):

```typescript
test.describe.serial('Polls Flow', () => {
  test('GM creates poll', ...);
  test('Player 1 votes', ...);
  test('Player 2 votes', ...);
  test('GM creates character poll', ...);
  test('Player votes as character', ...);
  // etc.
});
```

**Problem**: When test #5 passes, we assume everything worked. But:
- Badge showed "Voted" ✅
- But backend had bugs ❌
- But 403 errors happened ❌
- But "Loading..." flashed ❌

**Why it passed**: The test only checked `expect(badge).toBeVisible()`, not the JOURNEY to get there.

### What E2E Tests Should Actually Test

**E2E tests validate USER EXPERIENCES**, not implementation details. But user experience includes:

1. **Visual Feedback**: Does the UI show the right thing?
2. **Error-Free Behavior**: No console errors, no unexpected API calls
3. **Performance**: No loading spinners when data should be instant
4. **State Persistence**: Reload page, state is maintained
5. **Permission Enforcement**: Users can't do things they shouldn't

**Current test only checks #1**. It completely ignores #2, #3, #4, and #5.

### Proposed E2E Test Restructure

Instead of one serial flow testing "everything works", break into focused tests:

#### **Test Category 1: Happy Path (Keep Serial)**
```typescript
test.describe.serial('Polls - Happy Path', () => {
  test('Complete poll lifecycle works end-to-end', async ({ page }) => {
    // GM creates → Player votes → Badge updates → Results visible to GM
    // This is the "smoke test" - does the feature work at all?
  });
});
```

#### **Test Category 2: Error-Free Behavior (NEW)**
```typescript
test.describe('Polls - No Unauthorized Behavior', () => {
  test('Player voting does not trigger 403 errors', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    // Vote on poll
    await voteToPoll(page);

    // EXPLICIT check for 403s
    const forbidden = consoleErrors.filter(e => e.includes('403'));
    expect(forbidden).toHaveLength(0);
  });

  test('Player voting does not show Loading results flash', async ({ page }) => {
    // Vote on poll
    await voteToPoll(page);

    // Explicitly verify loading state NEVER appears for players
    await expect(page.getByText('Loading results...')).not.toBeVisible({ timeout: 100 });
  });

  test('Players do not make /results API calls on active polls', async ({ page }) => {
    const apiCalls: string[] = [];
    page.on('request', req => apiCalls.push(req.url()));

    // Vote on poll
    await voteToPoll(page);

    // Verify NO calls to /results endpoint
    const resultsCalls = apiCalls.filter(url => url.includes('/results'));
    expect(resultsCalls).toHaveLength(0);
  });
});
```

#### **Test Category 3: State Persistence (NEW)**
```typescript
test.describe('Polls - State Persistence', () => {
  test('Voted badge persists after page reload', async ({ page }) => {
    // Vote on poll
    await voteToPoll(page);

    // Verify badge shows "Voted"
    await expect(page.getByText('Voted')).toBeVisible();

    // Reload page
    await page.reload();

    // Badge should STILL show "Voted" (tests API + cache)
    await expect(page.getByText('Voted')).toBeVisible();
  });

  test('Character vote badge persists after page reload', async ({ page }) => {
    // Vote as character
    await voteAsCharacter(page);

    // Reload page
    await page.reload();

    // Badge should show "Voted" (tests Bug #5 fix)
    await expect(page.getByText('Voted')).toBeVisible();
  });
});
```

#### **Test Category 4: Permission Enforcement (Expand Existing)**
```typescript
test.describe('Polls - Permission Enforcement', () => {
  test('Player cannot view results on active poll', async ({ page }) => {
    // Existing test - keep as is
  });

  test('Audience can toggle results on active poll', async ({ page }) => {
    // Existing test - keep as is
  });

  test('GM can view results immediately after creation', async ({ page }) => {
    // Create poll as GM
    await createPoll(page);

    // Should immediately see "Show Results" button
    await expect(page.getByRole('button', { name: 'Show Results' })).toBeVisible();
  });
});
```

### Why This Structure is Better

1. **Explicit Test Names**: "Player voting does not trigger 403 errors" vs "Player can vote"
   - First name tells you EXACTLY what broke when test fails
   - Second name is vague - did vote fail? Did badge fail? Did API fail?

2. **Isolated Concerns**: Each test validates ONE behavior
   - Test fails → You know exactly what broke
   - Current test fails → Could be any of 5 things

3. **Regression Detection**: Each test maps to a specific bug
   - "No 403 errors" → Would catch Bug #1
   - "Badge persists on reload" → Would catch Bug #4
   - "Character vote badge updates" → Would catch Bug #5

4. **Maintainability**: Easy to add new tests for new bugs
   - New bug found? Add explicit test for that behavior
   - Don't bury it in a giant serial flow

### Implementation Priority

**Phase 1: Add Error Monitoring to Existing Tests** (Quick Win)
- Add console/network monitoring to current serial tests
- Verify no regressions in existing flow

**Phase 2: Add State Persistence Tests** (High Value)
- Test page reload scenarios
- Catches API contract bugs (like Bug #4)

**Phase 3: Refactor into Categories** (Long Term)
- Break apart serial tests into focused categories
- Easier to maintain and debug

**Phase 4: Add Component Tests** (Fill the Gap)
- Test PollCard permission logic in isolation
- Mock API responses to test edge cases
- This is where we SHOULD have caught these bugs

### Next Steps
1. ~~Update E2E test with console monitoring~~ ← Started but INCOMPLETE
2. **Re-evaluate**: Are we testing the RIGHT things?
3. Add state persistence tests (page reload scenarios)
4. Add network request monitoring
5. Add component tests for PollCard
6. Add backend unit tests for HasUserVotedAny
7. Document permission logic clearly
