# Full Game Flow Issues - Investigation & Tracking

**Created:** 2025-11-08
**Test Context:** Issues tested in Game #9 (Test Full Game Flow) and Game #3 (Shadows Over Innsmouth) for polls
**Status:** Investigation Phase - Systematic Reproduction Required

---

## Investigation Methodology

Before any fixes are implemented:
1. ✅ Reproduce the issue in the test environment
2. ✅ Document steps to reproduce
3. ✅ Investigate root cause (backend/frontend/both)
4. ✅ Propose solution with test strategy
5. ✅ Get approval before implementing
6. ✅ Implement fix with tests
7. ✅ Verify fix resolves issue

---

## Issue Categories Overview

| Category | Count | Priority | Status |
|----------|-------|----------|--------|
| Game State & Tab Visibility | 8 | High | Not Started |
| Settings Persistence | 2 | High | Not Started |
| Filter/Query Issues | 2 | High | Not Started |
| Character Visibility & Permissions | 3 | High | Not Started |
| Poll System | 8 | Medium | Not Started |
| Character Sheet & Results | 5 | Medium | Not Started |
| UI/UX Improvements | 5 | Medium | Not Started |
| Messaging & Communication | 4 | Low | Not Started |

**Total Issues:** 37

---

## Category 1: Game State & Tab Visibility Issues (8 issues)

### Issue 1.1: Deadlines Header Visible in Wrong States
**Status:** 🔴 Not Investigated
**Priority:** High
**Reported Behavior:**
Deadlines header is visible in "Setup" and "Recruiting" states, but should only be visible in "Character Creation" and "In Progress" states.

**Investigation:**
- [ ] Check current game state conditions in frontend tab rendering
- [ ] Verify backend game state transitions
- [ ] Identify where deadline visibility logic is implemented

**Root Cause:**
_To be determined_

**Proposed Solution:**
_To be determined_

**Test Strategy:**
- [ ] Add E2E test for deadline visibility by game state
- [ ] Unit test for tab visibility logic
- [ ] Test all game states: Setup, Recruiting, Character Creation, In Progress, Completed

**Files to Review:**
- Frontend game detail page component
- Tab rendering logic
- Game state constants

---

### Issue 1.2: Limited Editing in "Setup" State
**Status:** 🔴 Not Investigated
**Priority:** High
**Reported Behavior:**
In "Setup" state, can only edit game settings. Should have:
- Handouts tab available (to start writing content)
- Maybe People tab
- Note: Handouts needs to be available in every state for both GMs and players

**Investigation:**
- [ ] Check tab availability logic by game state
- [ ] Verify handout creation/editing permissions
- [ ] Review what "Setup" state should allow vs what it currently allows

**Root Cause:**
_To be determined_

**Proposed Solution:**
_To be determined_

**Test Strategy:**
- [ ] E2E test for handout access in all game states
- [ ] Permission tests for GMs and players
- [ ] Verify handout editing across all states

**Files to Review:**
- Game detail page tab logic
- Handout permissions
- Game state transition logic

---

### Issue 1.3: Applications Tab Visible After Recruitment
**Status:** 🔴 Not Investigated
**Priority:** Medium
**Reported Behavior:**
"Applications" tab is still visible after recruitment ends. Should be hidden once character creation or game starts.

**Investigation:**
- [ ] Check tab visibility conditions
- [ ] Determine correct states where Applications should be visible
- [ ] Review game flow: Recruiting → Character Creation transition

**Root Cause:**
_To be determined_

**Proposed Solution:**
_To be determined_

**Test Strategy:**
- [ ] E2E test for tab visibility after recruitment closes
- [ ] Unit test for conditional rendering
- [ ] Test transition from Recruiting to Character Creation

**Files to Review:**
- Game detail page tab rendering
- Game state constants

---

### Issue 1.4: Participants/Characters Tabs Split During Character Creation
**Status:** 🔴 Not Investigated
**Priority:** Medium
**Reported Behavior:**
During character creation, "Participants" and "Characters" are shown as separate tabs instead of a unified "People" tab.

**Investigation:**
- [ ] Review tab structure during character creation
- [ ] Check if unified "People" tab exists or needs to be created
- [ ] Determine what information should be in unified view

**Root Cause:**
_To be determined_

**Proposed Solution:**
_To be determined_

**Test Strategy:**
- [ ] E2E test for People tab in character creation
- [ ] Verify content shows both participants and characters
- [ ] Test tab visibility across all game states

**Files to Review:**
- Game detail page tabs
- People/Participants/Characters components

---

### Issue 1.5: GM Sees "Recent Action Results"
**Status:** 🔴 Not Investigated
**Priority:** Low
**Reported Behavior:**
The GM can see "Recent Action Results" but shouldn't (players see their own results).

**Investigation:**
- [ ] Check where "Recent Action Results" is displayed
- [ ] Verify user role detection
- [ ] Determine correct visibility logic

**Root Cause:**
_To be determined_

**Proposed Solution:**
_To be determined_

**Test Strategy:**
- [ ] Unit test for conditional rendering by role
- [ ] E2E test as GM and player
- [ ] Verify results visibility permissions

**Files to Review:**
- Action results component
- User role/permission logic

---

### Issue 1.6: History Tab Not Read-Only in Completed Games
**Status:** 🔴 Not Investigated
**Priority:** Medium
**Reported Behavior:**
Can still edit/delete comments in "History" view of completed game. History tab should be completely read-only regardless of game state.

**Investigation:**
- [ ] Check edit/delete button visibility in History
- [ ] Verify backend permissions for completed games
- [ ] Review what actions should be blocked

**Root Cause:**
_To be determined_

**Proposed Solution:**
_To be determined_

**Test Strategy:**
- [ ] E2E test for read-only History in completed game
- [ ] Backend test for permission denial on edit attempts
- [ ] Test all comment types (common room, private messages, etc.)

**Files to Review:**
- History tab component
- Comment edit/delete handlers
- Backend permission checks

---

### Issue 1.7: No Reading Mode for Completed Games
**Status:** 🔴 Not Investigated
**Priority:** Low
**Reported Behavior:**
No dedicated reading mode for completed games (archival/read-only view).

**Investigation:**
- [ ] Determine what "reading mode" should include
- [ ] Check if this is a new feature or enhancement
- [ ] Review current completed game view

**Root Cause:**
_Feature request, not a bug_

**Proposed Solution:**
_To be determined_

**Test Strategy:**
- [ ] Define reading mode requirements
- [ ] E2E test for reading mode navigation
- [ ] Test all content types in reading mode

**Files to Review:**
- Game detail page
- Completed game view
- History tab

---

### Issue 1.8: "Close Recruitment" Button Clarity
**Status:** 🔴 Not Investigated
**Priority:** Medium
**Reported Behavior:**
"Close Recruitment" button isn't clear that it's starting Character Creation. Also, Edit button is always first, but phase transitions should be above Edit Game.

**Investigation:**
- [ ] Review button text and placement
- [ ] Check button ordering logic
- [ ] Determine best UX for phase transitions

**Root Cause:**
_To be determined_

**Proposed Solution:**
_To be determined_

**Test Strategy:**
- [ ] E2E test for button visibility and ordering
- [ ] Verify button text communicates action clearly
- [ ] Test phase transition confirmation

**Files to Review:**
- Game detail page header/actions
- Phase transition buttons
- Game settings/edit button

---

## Category 2: Settings Persistence Issues (2 issues)

### Issue 2.1: Game Creation Settings Not Persisted
**Status:** ✅ COMPLETE - Fix + All Tests + Additional Bug Fixed (Ready to Commit)
**Priority:** High
**Reported Behavior:**
"Anonymous Mode" and "Auto Accept Audience" were checked in game creation form but weren't persisted.

**Investigation:**
✅ **Investigated - Root cause identified at multiple layers**

**Root Cause:**
**Multi-layer issue affecting both fields:**

1. **`is_anonymous` (Anonymous Mode):**
   - ✅ Frontend: `GameFormFields` has checkbox
   - ✅ Frontend: Form state initialized with `is_anonymous: false`
   - ❌ **Frontend BUG:** `CreateGameForm.tsx` line 51 does NOT send `is_anonymous` to API
   - ❌ **Backend BUG:** `games.CreateGameRequest` (requests.go) does NOT have `IsAnonymous` field
   - ✅ Backend: `core.CreateGameRequest` HAS `IsAnonymous` field
   - ✅ Backend: Service layer supports it
   - ✅ Database query includes `is_anonymous`

2. **`auto_accept_audience` (Auto Accept Audience):**
   - ✅ Frontend: `GameFormFields` has checkbox
   - ❌ **Frontend BUG:** `CreateGameForm.tsx` state does NOT have `auto_accept_audience`
   - ❌ **Frontend BUG:** `CreateGameForm.tsx` line 51 does NOT send `auto_accept_audience` to API
   - ❌ **Backend BUG:** `games.CreateGameRequest` does NOT have `AutoAcceptAudience` field
   - ❌ **Backend BUG:** `core.CreateGameRequest` does NOT have `AutoAcceptAudience` field
   - ❌ **Backend BUG:** Database query does NOT include `auto_accept_audience` column
   - ✅ Database schema has `auto_accept_audience` column

**Proposed Solution:**

**Frontend (CreateGameForm.tsx):**
1. Add `auto_accept_audience: false` to formData state initialization
2. Add `auto_accept_audience: formData.auto_accept_audience` to gameData object
3. Add `is_anonymous: formData.is_anonymous` to gameData object (currently missing!)

**Frontend (types/games.ts):**
1. Add `is_anonymous?: boolean` to CreateGameRequest interface
2. Add `auto_accept_audience?: boolean` to CreateGameRequest interface

**Backend (games/requests.go):**
1. Add `IsAnonymous bool` field to CreateGameRequest struct
2. Add `AutoAcceptAudience bool` field to CreateGameRequest struct

**Backend (core/interfaces.go):**
1. Add `AutoAcceptAudience bool` field to CreateGameRequest struct

**Backend (games/api_crud.go):**
1. Pass `IsAnonymous: data.IsAnonymous` to core.CreateGameRequest
2. Pass `AutoAcceptAudience: data.AutoAcceptAudience` to core.CreateGameRequest

**Backend (db/queries/games.sql):**
1. Add `auto_accept_audience` to INSERT column list
2. Add `$11` parameter for auto_accept_audience value

**Backend (db/services/games.go):**
1. Pass `req.AutoAcceptAudience` to database query

**Test Strategy:**
- [x] Backend unit test for CreateGame with both flags true ✅ `api_crud_settings_test.go`
- [x] Backend unit test for CreateGame with both flags false ✅ `api_crud_settings_test.go`
- [x] Backend unit test for UpdateGame with flag toggling ✅ `api_crud_settings_test.go`
- [x] Backend unit test for settings persistence after refresh ✅ `api_crud_settings_test.go`
- [x] API integration test: POST /games with both flags, verify response ✅ `test_game_settings_api.sh`
- [x] API integration test: GET /games/:id after creation, verify flags persisted ✅ `test_game_settings_api.sh`
- [x] API integration test: PUT /games/:id to update settings ✅ `test_game_settings_api.sh`
- [x] API integration test: Verify updated settings persist ✅ `test_game_settings_api.sh`
- [ ] E2E test: Fill form with both checkboxes checked, verify in UI after refresh
- [ ] E2E test: Verify anonymous mode behavior in game
- [ ] E2E test: Verify auto-accept audience behavior on application

**Implementation Summary (2025-11-08):**

✅ **Frontend:**
- Added `auto_accept_audience: false` to CreateGameForm state initialization
- Added both fields to CreateGameRequest type in games.ts
- Updated gameData object to send both fields to API

✅ **Backend API Layer:**
- Added `IsAnonymous` and `AutoAcceptAudience` to games.CreateGameRequest
- Added `AutoAcceptAudience` to games.UpdateGameRequest

✅ **Backend Core Layer:**
- Added `AutoAcceptAudience` to core.CreateGameRequest
- Added `AutoAcceptAudience` to core.UpdateGameRequest

✅ **Backend Handlers:**
- Updated CreateGame handler to pass both fields to service
- Updated UpdateGame handler to pass AutoAcceptAudience to service

✅ **Backend Database:**
- Updated CreateGame SQL query to include `auto_accept_audience` column
- Updated UpdateGame SQL query to include `auto_accept_audience` column
- Regenerated sqlc models

✅ **Backend Services:**
- Updated CreateGame service to pass AutoAcceptAudience to query
- Updated UpdateGame service to pass AutoAcceptAudience to query
- Added AutoAcceptAudience to logging

✅ **Build Verification:**
- Backend builds successfully with no errors

✅ **Additional Bug Found During Testing:**
- CreateGame response mapping was missing `IsAnonymous` and `AutoAcceptAudience` fields
- GameResponse struct was missing `AutoAcceptAudience` field
- Fixed: Added `AutoAcceptAudience` to GameResponse struct (responses.go:21)
- Fixed: Set both fields in CreateGame response mapping (api_crud.go:88-89)

✅ **Backend Unit Tests Added (2025-11-08):**
- `TestCreateGame_WithSettings` - Table-driven test with 4 scenarios (all combinations of settings)
- `TestUpdateGame_WithSettings` - Table-driven test with 4 update scenarios
- `TestCreateGame_SettingsPersistAfterRefresh` - Persistence verification test
- All tests passing ✅

✅ **Additional Bugs Found During Testing:**
1. **GetGame response mapping bug (api_crud.go:135-143)**:
   - GetGame handler was missing IsAnonymous and AutoAcceptAudience fields
   - Fields were in database but not mapped to API response
   - Fixed by adding both fields to GetGame response construction

2. **UpdateGame response mapping bug (api_crud.go:363-372)**:
   - UpdateGame had IsAnonymous but was missing AutoAcceptAudience field
   - Fixed by adding AutoAcceptAudience to UpdateGame response construction

✅ **Backend Integration Tests Added (2025-11-08):**
- Created `backend/scripts/test_game_settings_api.sh` with comprehensive API testing
- Tests 6 scenarios: create with enabled, GET verification (both endpoints), update to disabled, GET verification after update, create with disabled
- All integration tests passing ✅
- Verified end-to-end persistence through full request cycle

✅ **E2E Testing Revealed Additional Backend Bug (2025-11-08):**
**Problem:** E2E tests failed even after all unit and integration tests passed
- Frontend uses `/api/v1/games/{id}/details` endpoint (NOT `/api/v1/games/{id}`)
- Integration tests used `/games/{id}` which returned `auto_accept_audience` correctly ✅
- Details endpoint `/games/{id}/details` returned `auto_accept_audience: null` ❌

**Root Cause:**
- `GetGameWithDetails` query (games.sql:94-107) correctly selects `g.*` which includes `auto_accept_audience`
- But `GameWithDetailsResponse` struct (responses.go:31-47) was missing `AutoAcceptAudience` field
- Handler mapped all other fields correctly but silently dropped `auto_accept_audience`

**Fix Applied (2025-11-08):**
1. Added `AutoAcceptAudience bool` field to `GameWithDetailsResponse` struct (responses.go:44)
2. Updated `GetGameWithDetails` handler to populate the field (api_crud.go:481)

**Why Integration Tests Didn't Catch This:**
- Integration tests tested the WRONG endpoint (`/games/{id}` instead of `/games/{id}/details`)
- This demonstrates the importance of E2E tests that use the same endpoints as the frontend
- Lesson: Integration tests must test the ACTUAL endpoints used by the UI

✅ **E2E Tests Added (2025-11-08):**
- Added `isAutoAcceptAudience()` and `toggleAutoAcceptAudience()` methods to GameSettingsPage POM
- Updated `GamesListPage.createGame()` to support `isAnonymous` and `autoAcceptAudience` parameters
- Added test: "GM can toggle auto accept audience" in `gm-edits-game-settings.spec.ts`
- Added test: "GM can create a game with anonymous mode and auto accept audience enabled" in `gm-creates-and-recruits.spec.ts`
- All E2E tests passing ✅ (8/8 passed)

**Files Modified:**
- `frontend/src/components/CreateGameForm.tsx`
- `frontend/src/types/games.ts`
- `frontend/e2e/pages/GameSettingsPage.ts` (added auto_accept_audience methods)
- `frontend/e2e/pages/GamesListPage.ts` (added isAnonymous/autoAcceptAudience params)
- `frontend/e2e/games/gm-edits-game-settings.spec.ts` (added toggle test)
- `frontend/e2e/games/gm-creates-and-recruits.spec.ts` (added creation test)
- `backend/pkg/games/requests.go`
- `backend/pkg/games/responses.go` (added AutoAcceptAudience to GameWithDetailsResponse)
- `backend/pkg/core/interfaces.go`
- `backend/pkg/games/api_crud.go` (fixed GetGameWithDetails handler)
- `backend/pkg/db/queries/games.sql`
- `backend/pkg/db/services/games.go`

---

### Issue 2.2: Auto Accept Audience Can't Be Enabled on Edit
**Status:** ✅ Fixed - Tests Added
**Priority:** High
**Reported Behavior:**
Game editing allowed enabling "Anonymous Mode" but NOT "Auto Accept Audience", despite request being correct (all data sent).

**Investigation:**
✅ **Investigated - Same root cause as Issue 2.1**

**Root Cause:**
**Multi-layer issue (same pattern as creation):**

1. **Frontend:** Sends `auto_accept_audience` correctly in UpdateGameRequest ✅
2. **Backend `games.UpdateGameRequest`:** Does NOT have `AutoAcceptAudience` field ❌
3. **Backend `core.UpdateGameRequest`:** Does NOT have `AutoAcceptAudience` field ❌
4. **Backend handler (api_crud.go:336-347):** Does NOT pass `AutoAcceptAudience` to service ❌
5. **Database query `UpdateGame`:** Does NOT update `auto_accept_audience` column ❌

**NOTE:** There EXISTS a separate query `UpdateGameAutoAcceptAudience` (line 195 in games.sql) that ONLY updates this field, but it's never called from the main UpdateGame handler.

**Proposed Solution:**

**Backend (games/requests.go):**
1. Add `AutoAcceptAudience bool` field to UpdateGameRequest struct

**Backend (core/interfaces.go):**
1. Add `AutoAcceptAudience bool` field to UpdateGameRequest struct

**Backend (games/api_crud.go):**
1. Pass `AutoAcceptAudience: data.AutoAcceptAudience` to core.UpdateGameRequest (line 336-347)

**Backend (db/queries/games.sql):**
1. Update `UpdateGame` query to include `auto_accept_audience = $11` in SET clause
2. Add `$11` parameter (or remove separate `UpdateGameAutoAcceptAudience` query if no longer needed)

**Backend (db/services/games.go):**
1. Pass `req.AutoAcceptAudience` to UpdateGame query

**Test Strategy:**
- [ ] Backend unit test for UpdateGame with AutoAcceptAudience true
- [ ] Backend unit test for UpdateGame with AutoAcceptAudience false
- [ ] API integration test: PUT /games/:id with auto_accept_audience, verify persisted
- [ ] API integration test: Verify IsAnonymous still works
- [ ] E2E test: Edit game, check auto_accept_audience checkbox, verify persisted
- [ ] E2E test: Edit game, uncheck auto_accept_audience, verify persisted
- [ ] E2E test: Verify auto-accept audience behavior after update

**Implementation Summary (2025-11-08):**

✅ **Fixed together with Issue 2.1** - Same root cause, same solution applied to both CREATE and UPDATE operations.

**Note:** Both issues have been completely resolved with the same set of changes covering the entire stack from frontend to database.

---

## Category 3: Filter/Query Issues (2 issues)

### Issue 3.1: "Has Open Spots" Filter Shows Wrong Games
**Status:** 🟢 Reproduced - Solution Proposed
**Priority:** High
**Reported Behavior:**
"Has Open Spots" filter shows games that aren't in "Recruiting" state.

**Investigation:**
✅ Investigated - Backend query missing game state filter

**Reproduced:**
✅ Confirmed - Filter returns games in "setup", "in_progress", "paused", "completed" states when has_open_spots=true

**Root Cause:**
The SQL query filter (lines 78-82 in `games_listing.sql`) checks if a game has open spots:
```sql
AND (
  $4::boolean IS NOT true OR
  (g.max_players IS NULL OR (SELECT COUNT(*) FROM game_participants WHERE game_id = g.id AND status = 'active') < g.max_players)
)
```

**Problem:** The filter checks `current_players < max_players` but does NOT filter by game state. This means games in ANY state with open spots will match, even though only games in "recruitment" state should be looking for new players.

**Proposed Solution:**
Update the `has_open_spots` filter to ONLY match games in "recruitment" state:

```sql
-- Filter by open spots (only recruiting games with available spots)
AND (
  $4::boolean IS NOT true OR
  (
    g.state = 'recruitment' AND
    (g.max_players IS NULL OR (SELECT COUNT(*) FROM game_participants WHERE game_id = g.id AND status = 'active') < g.max_players)
  )
)
```

**Test Strategy:**
- [ ] Backend unit test: has_open_spots=true returns ONLY recruitment games
- [ ] Backend unit test: has_open_spots=true excludes games in other states (setup, in_progress, completed)
- [ ] Backend unit test: has_open_spots=false works correctly
- [ ] Integration test with curl: verify filter returns correct games
- [ ] E2E test: UI filter shows only recruiting games with spots

**Files to Modify:**
- `backend/pkg/db/queries/games_listing.sql` (lines 78-82) - Add state check
- `backend/pkg/db/queries/games_listing.sql` (lines 149-153) - Add state check to CountFilteredGames
- `backend/pkg/db/services/games_test.go` - Add unit tests
- `frontend/e2e/games/game-filters.spec.ts` - Add E2E test

---

### Issue 3.2: "Applied" Filter Doesn't Show Applied Games
**Status:** 🟢 Reproduced - Solution Proposed
**Priority:** High
**Reported Behavior:**
"Applied" game filter doesn't show games that the user has applied to.

**Investigation:**
✅ Investigated - Frontend/Backend parameter name mismatch

**Reproduced:**
✅ Confirmed - Filter returns ALL games (292 games) instead of just applied games when using `participation_filter=applied`

**Root Cause:**
**Parameter name mismatch between frontend and backend:**

1. **Frontend** sends: `participation_filter=applied`
2. **Backend** expects: `participation=applied` (line 596 in `api_crud.go`)

```go
// Backend reads "participation" parameter
if participationParam := queryParams.Get("participation"); participationParam != "" {
    filters.ParticipationFilter = &participationParam
}
```

When the parameter name doesn't match, the backend receives `nil` for `ParticipationFilter`, which causes the SQL query's participation filter to be skipped (line 71-76 in `games_listing.sql`), returning ALL visible games instead of filtering by application status.

**Verified:** Using `participation=applied` returns correct result (1 game with user_relationship="applied").

**Proposed Solution:**
**Option 1 (Recommended):** Update backend to accept `participation_filter` to match frontend convention:
```go
if participationParam := queryParams.Get("participation_filter"); participationParam != "" {
    filters.ParticipationFilter = &participationParam
}
```

**Option 2:** Update frontend to send `participation` instead of `participation_filter`.

**Recommendation:** Option 1 (update backend) is preferred because:
- "participation_filter" is more descriptive
- Frontend code may already be deployed/in use
- Backend change is simpler (single line)

**Test Strategy:**
- [ ] Backend unit test: participation_filter=applied returns only applied games
- [ ] Backend unit test: participation_filter=my_games returns only joined games
- [ ] Backend unit test: participation_filter=not_joined returns only non-joined games
- [ ] Integration test with curl: verify all participation filters work
- [ ] E2E test: UI filter dropdowns work correctly

**Files to Modify:**
- `backend/pkg/games/api_crud.go` (line 596) - Change "participation" to "participation_filter"
- `backend/pkg/games/api_crud_test.go` - Add/update filter tests
- `frontend/e2e/games/game-filters.spec.ts` - Add E2E test

---

## Category 4: Character Visibility & Permissions (3 issues)

### Issue 4.1: Player Can't See Own Pending Character
**Status:** 🔴 Not Investigated
**Priority:** High
**Reported Behavior:**
Player can create their own character but can't see it while it's pending (they should be able to).

**Investigation:**
- [ ] Check character visibility logic
- [ ] Verify permission checks for pending characters
- [ ] Review player vs GM character views
- [ ] Test character creation and visibility

**Root Cause:**
_To be determined_

**Proposed Solution:**
_To be determined_

**Test Strategy:**
- [ ] E2E test for character creation and immediate visibility
- [ ] Permission test for viewing own pending character
- [ ] Backend test for character query filtering
- [ ] Test edit permissions for pending character

**Files to Review:**
- Character list component
- Character visibility/permission logic
- Backend character query handler

---

### Issue 4.2: Audience Can't See Pending Characters
**Status:** 🔴 Not Investigated
**Priority:** Medium
**Reported Behavior:**
Audience member cannot see pending characters (should be able to see all).

**Investigation:**
- [ ] Check audience role permissions
- [ ] Verify character visibility by role
- [ ] Review what audience should see
- [ ] Test as audience member

**Root Cause:**
_To be determined_

**Proposed Solution:**
_To be determined_

**Test Strategy:**
- [ ] E2E test as audience member
- [ ] Permission test for audience character visibility
- [ ] Backend test for character query by role
- [ ] Test visibility of pending vs approved characters

**Files to Review:**
- Character list component
- Role-based visibility logic
- Backend character query handler

---

### Issue 4.3: Anonymous Mode Character Editing Issues
**Status:** 🔴 Not Investigated
**Priority:** Medium
**Reported Behavior:**
In "Anonymous Mode" players cannot edit their own character and no "Your Character" badge is shown.

**Investigation:**
- [ ] Check anonymous mode implementation
- [ ] Verify character ownership detection in anonymous mode
- [ ] Review edit permission logic
- [ ] Test badge visibility

**Root Cause:**
_To be determined_

**Proposed Solution:**
_To be determined_

**Test Strategy:**
- [ ] E2E test for anonymous mode character editing
- [ ] Unit test for ownership detection
- [ ] Test badge visibility in anonymous vs normal mode
- [ ] Backend permission test for anonymous mode

**Files to Review:**
- Anonymous mode logic
- Character edit permissions
- Character badge rendering
- Backend permission checks

---

## Category 5: Poll System Issues (8 issues)

### Issue 5.1: Polls as Separate Tab
**Status:** 🔴 Not Investigated
**Priority:** Medium
**Reported Behavior:**
Polls shouldn't be its own tab, should only be associated with Common Rooms.

**Investigation:**
- [ ] Review current poll tab implementation
- [ ] Check how polls relate to common rooms
- [ ] Determine correct UI integration
- [ ] Review poll creation/viewing workflow

**Root Cause:**
_To be determined_

**Proposed Solution:**
_To be determined_

**Test Strategy:**
- [ ] E2E test for poll creation in common room
- [ ] Test poll visibility in common room view
- [ ] Verify no standalone Polls tab
- [ ] Test poll interaction from common room

**Files to Review:**
- Game detail page tabs
- Poll component
- Common room component
- Poll creation workflow

---

### Issue 5.2: Common Room Deadline Not in Deadlines Section
**Status:** 🟢 Reproduced - Solution Proposed
**Priority:** Medium
**Reported Behavior:**
Common Room Deadline isn't visible in the deadlines section (should be).

**Investigation:**
✅ Investigated - Part of broader deadline consolidation issue

**Root Cause:**
Deadlines are fragmented across 3 separate tables:
- `game_deadlines` - Arbitrary deadlines (shown in Deadlines section)
- `game_phases.deadline` - Phase deadlines (shown on dashboard only)
- `common_room_polls.deadline` - Poll deadlines (NOT shown in deadlines section)

The `GetGameDeadlines` query only fetches from `game_deadlines` table, excluding phase and poll deadlines.

**Proposed Solution:**
**See PROPOSAL 2: Deadline Consolidation Refactor** - Create unified query that aggregates ALL deadline types into single view.

**Test Strategy:**
- [ ] Unit test for unified deadline query
- [ ] E2E test for poll deadline visibility in Deadlines section
- [ ] Backend test for GetAllGameDeadlines query
- [ ] Test all 3 deadline types showing together

**Files to Review:**
- `backend/pkg/db/queries/deadlines.sql` - Create unified query
- `frontend/src/components/DeadlinesTabContent.tsx` - Display all deadline types
- `frontend/src/types/deadlines.ts` - Add UnifiedDeadline type

---

### Issue 5.3: Poll Datepicker Non-Standard
**Status:** 🔴 Not Investigated
**Priority:** Low
**Reported Behavior:**
Poll datepicker is non-standard compared to the rest of the app.

**Investigation:**
- [ ] Review poll datepicker component
- [ ] Check standard datepicker used elsewhere
- [ ] Identify differences in implementation

**Root Cause:**
_To be determined_

**Proposed Solution:**
_To be determined_

**Test Strategy:**
- [ ] UI test for datepicker consistency
- [ ] Verify datepicker behavior matches standard
- [ ] Test date selection and validation

**Files to Review:**
- Poll creation form
- Datepicker components
- UI component library

---

### Issue 5.4: GM Can Vote on Polls
**Status:** 🔴 Not Investigated
**Priority:** Medium
**Reported Behavior:**
GM can vote on polls but shouldn't be able to.

**Investigation:**
- [ ] Check poll voting permissions
- [ ] Verify role detection in poll component
- [ ] Review backend vote validation
- [ ] Test as GM and player

**Root Cause:**
_To be determined_

**Proposed Solution:**
_To be determined_

**Test Strategy:**
- [ ] E2E test for GM poll voting prevention
- [ ] Backend test for vote permission denial
- [ ] Unit test for vote button visibility
- [ ] Test error handling for GM vote attempts

**Files to Review:**
- Poll voting component
- Backend poll vote handler
- Permission checks

---

### Issue 5.5: Poll Results Visible Before End
**Status:** 🔴 Not Investigated
**Priority:** High
**Reported Behavior:**
Poll results are visible to players before the poll ends. Also shows "Not Voted" despite having voted.

**Investigation:**
- [ ] Check poll results visibility logic
- [ ] Verify poll status tracking
- [ ] Review vote status display
- [ ] Test as player before/after voting

**Root Cause:**
_To be determined_

**Proposed Solution:**
_To be determined_

**Test Strategy:**
- [ ] E2E test for poll results visibility by status
- [ ] Unit test for vote status display
- [ ] Test poll before deadline, after voting, after deadline
- [ ] Backend test for results query permissions

**Files to Review:**
- Poll results component
- Poll status logic
- Vote tracking

---

### Issue 5.6: GM Poll Results Visibility
**Status:** 🔴 Not Investigated
**Priority:** Medium
**Reported Behavior:**
GM should be able to see:
- Individual results (who voted what)
- "Other" custom responses

**Investigation:**
- [ ] Check GM poll results view
- [ ] Verify individual vote tracking
- [ ] Review "Other" response handling
- [ ] Test as GM with various poll types

**Root Cause:**
_To be determined_

**Proposed Solution:**
_To be determined_

**Test Strategy:**
- [ ] E2E test for GM poll results view
- [ ] Test individual vote visibility
- [ ] Test "Other" response display
- [ ] Backend test for GM results query

**Files to Review:**
- Poll results component (GM view)
- Backend poll results handler
- Vote tracking logic

---

### Issue 5.7: Audience Can't See Polls
**Status:** 🔴 Not Investigated
**Priority:** Medium
**Reported Behavior:**
Audience cannot see active "Polls" at all.

**Investigation:**
- [ ] Check audience poll visibility
- [ ] Verify role-based poll access
- [ ] Review what audience should see
- [ ] Test as audience member

**Root Cause:**
_To be determined_

**Proposed Solution:**
_To be determined_

**Test Strategy:**
- [ ] E2E test as audience member
- [ ] Test poll visibility (view-only)
- [ ] Verify audience can't vote
- [ ] Backend permission test

**Files to Review:**
- Poll component
- Role-based visibility logic
- Audience permissions

---

### Issue 5.8: Poll Deadline Not in Deadlines Section
**Status:** 🟢 Reproduced - Solution Proposed
**Priority:** Medium
**Reported Behavior:**
Poll deadline is not shown in the deadlines section.

**Investigation:**
✅ Investigated - DUPLICATE OF ISSUE 5.2 - Part of broader deadline consolidation issue

**Root Cause:**
Same as Issue 5.2 - Poll deadlines are stored in `common_room_polls.deadline` but not aggregated with other deadlines.

**Proposed Solution:**
**See PROPOSAL 2: Deadline Consolidation Refactor** - Unified query includes poll deadlines with type badge.

**Test Strategy:**
Same as Issue 5.2 - covered by unified deadline testing

**Files to Review:**
Same as Issue 5.2

---

## Category 6: Character Sheet & Results Issues (5 issues)

### Issue 6.1: Pending Result Form Inconsistency
**Status:** 🔴 Not Investigated
**Priority:** Medium
**Reported Behavior:**
When updating character sheet as part of a pending result, the form for adding abilities, skills, or items is different than normal.

**Investigation:**
- [ ] Compare normal character edit vs pending result edit
- [ ] Check if using different components
- [ ] Identify differences in form structure
- [ ] Review why forms differ

**Root Cause:**
_To be determined_

**Proposed Solution:**
_To be determined_

**Test Strategy:**
- [ ] E2E test for character sheet editing (both contexts)
- [ ] Unit test for form component reuse
- [ ] Visual regression test for form consistency

**Files to Review:**
- Character sheet edit form
- Pending result edit form
- Shared form components

---

### Issue 6.2: Currency Update Unclear
**Status:** 🔴 Not Investigated
**Priority:** Medium
**Reported Behavior:**
Adding currency is unclear if you are setting, adding, or subtracting.

**Investigation:**
- [ ] Review currency update UI
- [ ] Check backend currency update logic
- [ ] Determine correct behavior (set vs modify)
- [ ] Review user expectations

**Root Cause:**
_To be determined_

**Proposed Solution:**
_To be determined_

**Test Strategy:**
- [ ] E2E test for currency updates
- [ ] Backend test for currency operations
- [ ] Test setting, adding, subtracting
- [ ] UI test for clear labeling

**Files to Review:**
- Currency update form
- Backend character update handler
- Character sheet component

---

### Issue 6.3: Remove "Publish Immediately" Checkbox
**Status:** 🔴 Not Investigated
**Priority:** Low
**Reported Behavior:**
"Publish Immediately" checkbox should be removed from "Results" tab.

**Investigation:**
- [ ] Check where checkbox is used
- [ ] Verify if feature is still needed
- [ ] Review publish workflow
- [ ] Determine correct behavior without checkbox

**Root Cause:**
_To be determined_

**Proposed Solution:**
_To be determined_

**Test Strategy:**
- [ ] E2E test for results publishing
- [ ] Test publish workflow without checkbox
- [ ] Verify publish behavior matches expectations

**Files to Review:**
- Results tab component
- Results creation/edit form
- Publish handler

---

### Issue 6.4: Pending Character Updates Not Applied
**Status:** 🔴 Not Investigated
**Priority:** High
**Reported Behavior:**
Pending character sheet updates were not applied on publish (individual or publish all).

**Investigation:**
- [ ] Check publish handler
- [ ] Verify pending update tracking
- [ ] Review database transaction
- [ ] Test individual and batch publish

**Root Cause:**
_To be determined_

**Proposed Solution:**
_To be determined_

**Test Strategy:**
- [ ] Backend unit test for applying pending updates
- [ ] Integration test for publish operation
- [ ] E2E test for individual and batch publish
- [ ] Verify updates persist after publish

**Files to Review:**
- Results publish handler
- Character update service
- Pending update tracking
- Database transaction logic

---

### Issue 6.5: No Notifications for Published Results
**Status:** 🔴 Not Investigated
**Priority:** High
**Reported Behavior:**
Players did not receive notifications when results were published.

**Investigation:**
- [ ] Check notification creation on publish
- [ ] Verify notification service integration
- [ ] Review notification targeting (who should receive)
- [ ] Test notification delivery

**Root Cause:**
_To be determined_

**Proposed Solution:**
_To be determined_

**Test Strategy:**
- [ ] Backend test for notification creation
- [ ] Integration test for notification delivery
- [ ] E2E test for notification receipt
- [ ] Test individual and batch publish notifications

**Files to Review:**
- Results publish handler
- Notification service
- Notification targeting logic

---

## Category 7: UI/UX Improvements (5 issues)

### Issue 7.1: Application Approval UI Jumpy
**Status:** 🔴 Not Investigated
**Priority:** Low
**Reported Behavior:**
UI for approving applications is rough—the UI moves around a lot after hitting "Approve".

**Investigation:**
- [ ] Review application approval UI
- [ ] Check state update and re-render behavior
- [ ] Identify layout shifts
- [ ] Test approval interaction

**Root Cause:**
_To be determined_

**Proposed Solution:**
_To be determined_

**Test Strategy:**
- [ ] E2E test for approval flow
- [ ] Visual regression test
- [ ] Test optimistic UI updates
- [ ] Verify smooth state transitions

**Files to Review:**
- Application approval component
- List rendering logic
- State management

---

### Issue 7.2: No Notification for Acceptance
**Status:** 🔴 Not Investigated
**Priority:** Medium
**Reported Behavior:**
No notification sent to user when they're "Accepted" to game once character creation starts.

**Investigation:**
- [ ] Check notification creation on acceptance
- [ ] Verify character creation phase transition
- [ ] Review notification timing
- [ ] Test as applicant

**Root Cause:**
_To be determined_

**Proposed Solution:**
_To be determined_

**Test Strategy:**
- [ ] Backend test for acceptance notification
- [ ] Integration test for phase transition notifications
- [ ] E2E test for notification receipt
- [ ] Test notification content and timing

**Files to Review:**
- Phase transition handler
- Application approval handler
- Notification service

---

### Issue 7.3: Deadline Display Issues
**Status:** 🔴 Not Investigated
**Priority:** Medium
**Reported Behavior:**
Deadline display doesn't show descriptions. The emoji isn't useful and cuts off title text (which is already limited).

**Investigation:**
- [ ] Review deadline component design
- [ ] Check description field display
- [ ] Evaluate emoji usage
- [ ] Test with various deadline lengths

**Root Cause:**
_To be determined_

**Proposed Solution:**
_To be determined_

**Test Strategy:**
- [ ] UI test for deadline display
- [ ] Test with short and long titles
- [ ] Test with and without descriptions
- [ ] Visual regression test

**Files to Review:**
- Deadline component
- Deadline list/card rendering

---

### Issue 7.4: Private Conversation View Too Small
**Status:** 🟢 Reproduced - Solution Proposed
**Priority:** Low
**Reported Behavior:**
Private conversation view feels too small for longer conversations. Conversation window is small in terms of screen real estate.

**Investigation:**
✅ Investigated - Current split-pane layout limits message thread width

**Root Cause:**
Split-pane layout allocates limited width to message thread:
- Left sidebar: Conversation list (collapsible but still takes space)
- Right panel: Message thread (cramped)
- Primary use case (reading messages) gets insufficient screen real estate

**Proposed Solution:**
**See PROPOSAL 1: Private Messages View Redesign** - Full-screen message view with:
- Conversation list → full-width cards
- Message thread → full-screen layout (like Slack, Discord)
- Navigation → breadcrumb back button
- Mobile-first design that scales to desktop

**Test Strategy:**
- [ ] E2E test for navigation: list → thread → back
- [ ] Responsive design test (mobile, tablet, desktop)
- [ ] Visual regression test for layout
- [ ] Test with long conversations

**Files to Review:**
- `frontend/src/components/PrivateMessages.tsx` - Remove split pane
- `frontend/src/components/MessageThread.tsx` - Full-screen layout
- `frontend/src/components/ConversationList.tsx` - Full-width cards

---

### Issue 7.5: Button Ordering (Duplicate of 1.8)
**Status:** 🔴 Not Investigated
**Priority:** Medium
**Reported Behavior:**
Edit button is always first, but phase transitions should be above Edit Game.

_See Issue 1.8 for full details_

---

## Category 8: Messaging & Communication Issues (4 issues)

### Issue 8.1: GM Reply Default to Parent Author
**Status:** 🔴 Not Investigated
**Priority:** Low
**Reported Behavior:**
When GM replies as an NPC, default to the parent comment's author if available.

**Investigation:**
- [ ] Check NPC selection in reply UI
- [ ] Review default NPC logic
- [ ] Verify parent comment tracking
- [ ] Test reply behavior

**Root Cause:**
_To be determined_

**Proposed Solution:**
_To be determined_

**Test Strategy:**
- [ ] E2E test for NPC reply defaults
- [ ] Unit test for default selection logic
- [ ] Test with various parent authors
- [ ] Test when no parent exists

**Files to Review:**
- Reply component
- NPC selection logic
- Comment parent tracking

---

### Issue 8.2: GM Can't See Own NPCs in Conversation Creation
**Status:** 🔴 Not Investigated
**Priority:** Medium
**Reported Behavior:**
GM creating a conversation can't see their own NPCs to add (should be able to for group chat).

**Investigation:**
- [ ] Check conversation creation UI
- [ ] Review NPC list query
- [ ] Verify participant selection logic
- [ ] Test as GM with NPCs

**Root Cause:**
_To be determined_

**Proposed Solution:**
_To be determined_

**Test Strategy:**
- [ ] E2E test for conversation creation
- [ ] Test NPC visibility in participant list
- [ ] Backend test for NPC query
- [ ] Test group conversation with NPCs

**Files to Review:**
- Conversation creation component
- Participant selection logic
- NPC query handler

---

### Issue 8.3: Audience View Character Confusion
**Status:** 🔴 Not Investigated
**Priority:** Low
**Reported Behavior:**
In Audience view, if GM replies to private conversation as 2 different characters in quick succession, it looks like they came from the same character.

**Investigation:**
- [ ] Check message rendering in audience view
- [ ] Review character attribution display
- [ ] Test rapid successive messages
- [ ] Verify character identifier visibility

**Root Cause:**
_To be determined_

**Proposed Solution:**
_To be determined_

**Test Strategy:**
- [ ] E2E test for audience message view
- [ ] Test rapid successive messages from different NPCs
- [ ] Visual test for character distinction
- [ ] Test with various message types

**Files to Review:**
- Audience conversation view
- Message rendering component
- Character attribution display

---

### Issue 8.4: GM Can't Edit Common Room Posts
**Status:** 🔴 Not Investigated
**Priority:** Medium
**Reported Behavior:**
GM cannot edit a post they have created for a common room.

**Investigation:**
- [ ] Check post edit permissions
- [ ] Verify post ownership detection
- [ ] Review edit button visibility
- [ ] Test as GM with own posts

**Root Cause:**
_To be determined_

**Proposed Solution:**
_To be determined_

**Test Strategy:**
- [ ] E2E test for GM post editing
- [ ] Backend test for edit permissions
- [ ] Test edit button visibility
- [ ] Test edit operation

**Files to Review:**
- Common room post component
- Edit permission logic
- Backend post update handler

---

## Implementation Priority Order

### Phase 1: Critical Functionality (Must Fix)
1. **Issue 2.1 & 2.2:** Settings persistence (Anonymous Mode, Auto Accept Audience)
2. **Issue 3.1 & 3.2:** Filter queries (Has Open Spots, Applied)
3. **Issue 4.1:** Player can't see own pending character
4. **Issue 5.5:** Poll results visible before end
5. **Issue 6.4 & 6.5:** Pending updates not applied, no notifications

### Phase 2: High-Impact UX (Should Fix)
1. **Issue 1.1 & 1.2:** Tab visibility by game state
2. **Issue 1.8:** Button clarity and ordering
3. **Issue 4.3:** Anonymous mode character editing
4. **Issue 5.1 & 5.2:** Poll integration with common rooms
5. **Issue 7.2 & 7.3:** Notifications and deadline display

### Phase 3: Polish & Enhancements (Nice to Have)
1. **Issue 1.6 & 1.7:** History read-only, reading mode
2. **Issue 5.4 & 5.6:** Poll GM permissions and visibility
3. **Issue 6.1 & 6.2:** Form consistency, currency clarity
4. **Issue 7.1 & 7.4:** UI improvements
5. **Issue 8.1 - 8.4:** Messaging enhancements

---

## Next Steps

1. **Begin systematic investigation** starting with Phase 1 issues
2. **Reproduce each issue** in test environment
3. **Document root causes** as discovered
4. **Propose solutions** with test strategies
5. **Ask clarifying questions** before implementing fixes
6. **Implement fixes** with comprehensive tests
7. **Update this document** with progress

---

## Notes & Decisions

### User Answers (2025-11-08)

✅ **1. Handouts Access:**
- Only GMs can CREATE handouts
- GMs can create in any state EXCEPT completed
- Players can VIEW published handouts in any state

✅ **2. People Tab:**
- Use the existing unified People tab (same as current implementation)

✅ **3. Polls Integration:**
- Completely integrated into Common Room view (no separate tab)

✅ **4. Currency Updates:**
- Support BOTH set absolute value AND add/subtract relative

✅ **5. Private Messages View:**
- Main functionality is READING messages
- Needs most of screen real estate for good viewing experience
- **See Proposal Below**

✅ **6. Deadline Consolidation (NEW):**
- Currently deadlines are fragmented: phases, polls, arbitrary deadlines
- All should show in unified "Deadlines" section
- **Requires refactor - See Proposal Below**

### Design Decisions to Make
- Exact states where each tab should be visible
- Poll visibility and interaction by role (GM, Player, Audience)
- Character visibility rules (pending vs approved, by role, by mode)
- Notification triggers and content
- History/reading mode feature scope

---

## PROPOSAL 1: Private Messages View Redesign

### Current Problem
The private conversation view uses a split-pane layout with:
- **Left sidebar (collapsible):** Conversation list
- **Right panel:** Message thread

The message thread occupies limited screen real estate, making it difficult to read longer conversations. The primary purpose of the private messages feature is READING messages, so the current layout hampers the main use case.

### Proposed Solution: Full-Screen Message View

**Layout Architecture:**

1. **Conversation List View (Default):**
   - Full-width list of conversations
   - Shows conversation participants, last message preview, unread count
   - Click conversation → navigate to full-screen thread view

2. **Full-Screen Thread View:**
   - **Header:** Breadcrumb navigation ("← Back to Conversations" or "← Back to Game")
   - **Thread Area:** Full screen width for messages (responsive padding)
   - **Message Composer:** Fixed at bottom (like modern messaging apps)
   - **Sidebar (Optional):** Collapsible conversation switcher (desktop only)

**User Flow:**
```
Private Messages Tab
  └─> Conversation List (full width)
       ├─> Click Conversation A → Full-screen thread
       ├─> Click Conversation B → Full-screen thread
       └─> "New Conversation" button

Full-Screen Thread
  └─> Header: [← Back] | [Participants] | [Options]
  └─> Messages: Full screen width
  └─> Composer: Fixed bottom
```

### Implementation Details

**Frontend Changes:**

1. **Route Structure:**
   ```
   /games/:gameId/messages           → Conversation list
   /games/:gameId/messages/:convId   → Full-screen thread
   ```

2. **Component Updates:**
   - **PrivateMessages.tsx:**
     - Remove split-pane layout
     - Show ConversationList OR MessageThread (not both)
     - Use route params to determine view

   - **ConversationList.tsx:**
     - Full-width cards (not sidebar)
     - Better preview text (2-3 lines)
     - Larger touch targets

   - **MessageThread.tsx:**
     - Full screen layout
     - Header with back navigation
     - Responsive padding (more width on desktop)
     - Fixed composer at bottom

3. **Responsive Design:**
   - **Mobile:** Full-screen messages (natural fit)
   - **Tablet:** Full-screen with more padding
   - **Desktop:** Full-screen with max-width constraint (e.g., 1200px) centered

**Layout Comparison:**

```
BEFORE (Split Pane):
┌─────────────────────────────────┐
│ Conversations │ Messages        │
│ (sidebar)     │ (cramped)       │
│               │                 │
│  - Conv A     │ Message 1...    │
│  - Conv B     │ Message 2...    │
│  - Conv C     │ Message 3...    │
│               │                 │
│               │ [Composer]      │
└─────────────────────────────────┘

AFTER (Full-Screen):
┌─────────────────────────────────┐
│ ← Back to Conversations         │
│─────────────────────────────────│
│                                 │
│  Message 1 (full width)...      │
│  Message 2 (full width)...      │
│  Message 3 (full width)...      │
│  Message 4 (full width)...      │
│                                 │
│─────────────────────────────────│
│ [Message Composer - Full Width] │
└─────────────────────────────────┘
```

### Benefits
- ✅ Primary use case (reading) gets maximum screen space
- ✅ Better mobile experience (full-screen threads)
- ✅ Familiar UX pattern (like Slack, Discord, WhatsApp Web)
- ✅ Easier to read long messages
- ✅ Less cognitive load (focus on one conversation at a time)

### Testing Strategy
- [ ] E2E test for navigation: list → thread → back
- [ ] Responsive design test (mobile, tablet, desktop)
- [ ] Test conversation switching
- [ ] Test back navigation preserves scroll position
- [ ] Visual regression test

### Files to Modify
- `frontend/src/components/PrivateMessages.tsx` - Remove split pane, add routing logic
- `frontend/src/components/ConversationList.tsx` - Full-width layout
- `frontend/src/components/MessageThread.tsx` - Full-screen layout with header
- `frontend/src/hooks/usePrivateMessagesLayout.ts` - May need updates or removal
- `frontend/src/pages/GameDetailPage.tsx` - Update routing (if needed)

---

## PROPOSAL 2: Deadline Consolidation Refactor

### Current Problem

Deadlines are fragmented across **three separate sources:**

1. **game_deadlines table** - GM-created arbitrary deadlines (working, shown in "Deadlines" tab)
2. **game_phases.deadline** - Phase deadlines (exists, shown on DASHBOARD only)
3. **common_room_polls.deadline** - Poll deadlines (exists, NOT shown anywhere in deadlines section)

**Result:** Users miss important deadlines because they're not all aggregated in one place.

### Current Architecture

**Database Tables:**
```sql
game_deadlines (id, game_id, title, description, deadline, ...)
game_phases (id, game_id, ..., deadline, ...)
common_room_polls (id, game_id, ..., deadline, ...)
```

**Backend Queries:**
- `GetGameDeadlines` - Only fetches `game_deadlines`
- `GetUserUpcomingDeadlines` - Only fetches phase deadlines (dashboard)
- Poll deadlines have NO aggregate query

**Frontend Display:**
- **DeadlinesTabContent** - Shows only `game_deadlines`
- **UpcomingDeadlinesCard** (dashboard) - Shows only phase deadlines
- Polls show deadline in poll card, but NOT in deadlines section

### Proposed Solution: Unified Deadline Service

**Goal:** Create a single unified query that aggregates ALL deadlines from all sources.

### Implementation Plan

#### Phase 1: Backend - Unified Deadline Query

**1. Create New SQL Query (`backend/pkg/db/queries/deadlines.sql`):**

```sql
-- name: GetAllGameDeadlines :many
-- Aggregate ALL deadlines for a game: arbitrary, phase, and poll deadlines
SELECT
    'deadline' as deadline_type,
    gd.id as source_id,
    gd.title as title,
    gd.description as description,
    gd.deadline as deadline,
    gd.game_id,
    NULL::INTEGER as phase_id,
    NULL::INTEGER as poll_id,
    false as is_system_deadline
FROM game_deadlines gd
WHERE gd.game_id = $1
  AND gd.deleted_at IS NULL
  AND ($2 = true OR gd.deadline > NOW())  -- includeExpired param

UNION ALL

SELECT
    'phase' as deadline_type,
    gp.id as source_id,
    gp.title as title,
    CONCAT(gp.phase_type, ' Phase ', gp.phase_number) as description,
    gp.deadline as deadline,
    gp.game_id,
    gp.id as phase_id,
    NULL::INTEGER as poll_id,
    true as is_system_deadline
FROM game_phases gp
WHERE gp.game_id = $1
  AND gp.deadline IS NOT NULL
  AND ($2 = true OR gp.deadline > NOW())

UNION ALL

SELECT
    'poll' as deadline_type,
    crp.id as source_id,
    crp.question as title,
    COALESCE(crp.description, 'Poll voting deadline') as description,
    crp.deadline as deadline,
    crp.game_id,
    crp.phase_id,
    crp.id as poll_id,
    false as is_system_deadline
FROM common_room_polls crp
WHERE crp.game_id = $1
  AND crp.is_deleted = false
  AND crp.deadline IS NOT NULL
  AND ($2 = true OR crp.deadline > NOW())

ORDER BY deadline ASC;
```

**2. Create Unified Deadline Model (`backend/pkg/core/models.go`):**

```go
type UnifiedDeadline struct {
    DeadlineType      string    // "deadline", "phase", "poll"
    SourceID          int32
    Title             string
    Description       string
    Deadline          time.Time
    GameID            int32
    PhaseID           *int32    // NULL for arbitrary deadlines
    PollID            *int32    // NULL for non-poll deadlines
    IsSystemDeadline  bool      // true for phase deadlines (can't be deleted by user)
}
```

**3. Update DeadlineService (`backend/pkg/db/services/deadline_service.go`):**

```go
func (s *DeadlineService) GetAllGameDeadlines(
    ctx context.Context,
    gameID int32,
    includeExpired bool,
) ([]core.UnifiedDeadline, error) {
    rows, err := s.DB.GetAllGameDeadlines(ctx, db.GetAllGameDeadlinesParams{
        GameID:         gameID,
        IncludeExpired: includeExpired,
    })
    // ... convert to core.UnifiedDeadline
}
```

**4. Update API Handler (`backend/pkg/deadlines/api_deadlines.go`):**

```go
// Update GetGameDeadlines to use unified query
func (h *Handler) GetGameDeadlines(w http.ResponseWriter, r *http.Request) {
    // ... existing auth logic ...

    deadlineService := &db.DeadlineService{DB: h.App.Pool, Logger: h.App.ObsLogger}
    deadlines, err := deadlineService.GetAllGameDeadlines(ctx, int32(gameID), includeExpired)

    // Convert to unified response format
    response := make([]*UnifiedDeadlineResponse, len(deadlines))
    for i, deadline := range deadlines {
        response[i] = toUnifiedDeadlineResponse(&deadline)
    }

    render.JSON(w, r, response)
}
```

#### Phase 2: Frontend - Display Unified Deadlines

**1. Update TypeScript Types (`frontend/src/types/deadlines.ts`):**

```typescript
export interface UnifiedDeadline {
  deadline_type: 'deadline' | 'phase' | 'poll';
  source_id: number;
  title: string;
  description: string;
  deadline: string; // ISO 8601
  game_id: number;
  phase_id?: number;
  poll_id?: number;
  is_system_deadline: boolean;  // Can't be deleted if true
}
```

**2. Update DeadlineList Component (`frontend/src/components/DeadlineList.tsx`):**

```tsx
// Add deadline type badge
function DeadlineTypeBadge({ type }: { type: string }) {
  const variants = {
    deadline: { label: 'Custom', variant: 'primary' },
    phase: { label: 'Phase', variant: 'success' },
    poll: { label: 'Poll', variant: 'warning' },
  };

  const config = variants[type];
  return <Badge variant={config.variant}>{config.label}</Badge>;
}

// Update delete button visibility
{!deadline.is_system_deadline && onDelete && (
  <Button variant="danger" onClick={() => onDelete(deadline.source_id)}>
    Delete
  </Button>
)}
```

**3. Update DeadlinesTabContent to handle unified deadlines**

**4. Update Dashboard to use same unified query**

#### Phase 3: Migration & Cleanup

**No migration needed** - existing data structure is unchanged, we're just querying it differently.

**Cleanup:**
- [ ] Remove dashboard-specific phase deadline query (consolidate)
- [ ] Update tests to cover unified deadlines
- [ ] Update E2E tests for deadline visibility

### Benefits

✅ **Unified View:** All deadlines in one place
✅ **Better UX:** Users see all time-sensitive items
✅ **Consistent:** Same deadline list everywhere (game detail, dashboard)
✅ **Maintainable:** Single query to update for deadline logic
✅ **Extensible:** Easy to add more deadline sources in future (e.g., handout deadlines, recruitment deadlines)

### Testing Strategy

**Backend Tests:**
- [ ] Unit test for `GetAllGameDeadlines` query
- [ ] Test with game that has all 3 deadline types
- [ ] Test with includeExpired parameter
- [ ] Test ordering (chronological)
- [ ] Test deadline type filtering

**Frontend Tests:**
- [ ] Component test for unified deadline display
- [ ] Test deadline type badges
- [ ] Test system deadline (no delete button)
- [ ] E2E test for deadline visibility in game detail
- [ ] E2E test for all deadline types showing together

### Edge Cases to Handle

1. **Phase deadline updates:** When GM updates phase deadline, unified view should reflect immediately
2. **Poll deletion:** When poll is deleted, its deadline should disappear
3. **Empty states:** Handle games with no deadlines gracefully
4. **Permission checks:** Ensure GMs can't delete system deadlines (phases)
5. **Timezone handling:** All deadlines should respect user timezone

### Rollout Plan

**Phase 1 (Backend):**
1. Create unified query
2. Add unified model
3. Update service layer
4. Update API handler
5. Test with existing frontend (should work with existing query parameter)

**Phase 2 (Frontend):**
1. Update types
2. Update components to display all deadline types
3. Add deadline type badges
4. Handle system deadlines (no delete)
5. Update dashboard to use unified query

**Phase 3 (Polish):**
1. E2E tests
2. Visual polish (deadline type icons, colors)
3. Documentation updates

### Files to Modify

**Backend:**
- `backend/pkg/db/queries/deadlines.sql` - Add GetAllGameDeadlines query
- `backend/pkg/core/models.go` - Add UnifiedDeadline model
- `backend/pkg/db/services/deadline_service.go` - Add GetAllGameDeadlines method
- `backend/pkg/deadlines/api_deadlines.go` - Update GetGameDeadlines handler
- `backend/pkg/db/queries/dashboard.sql` - Update to use unified query

**Frontend:**
- `frontend/src/types/deadlines.ts` - Add UnifiedDeadline type
- `frontend/src/lib/api/deadlines.ts` - Update to expect unified response
- `frontend/src/components/DeadlineList.tsx` - Display deadline types
- `frontend/src/components/DeadlineCard.tsx` - Handle deadline types
- `frontend/src/components/DeadlinesTabContent.tsx` - Use unified deadlines
- `frontend/src/components/UpcomingDeadlinesCard.tsx` - Use unified deadlines

**Tests:**
- `backend/pkg/db/services/deadline_service_test.go` - Test unified query
- `frontend/src/components/DeadlineList.test.tsx` - Test deadline types
- `frontend/e2e/gameplay/deadline-management.spec.ts` - E2E unified deadlines

---

## Status Legend
- 🔴 Not Investigated
- 🟡 In Investigation
- 🟢 Reproduced - Solution Proposed
- ✅ Fixed - Tests Added
- ⏭️ Deferred
