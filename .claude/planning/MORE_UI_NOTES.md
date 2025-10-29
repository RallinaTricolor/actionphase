Below is a list of UI bugs, missing functionality, or incorrect UX that I've noticed in the app.

**Last Verification**: October 27, 2025 @ 20:45
**Verification Tool**: Playwright MCP with demo data

For each item in this list:
0. Each item on this list is categorized as UI, BUG, or FEATURE informing you of what kind of work it is.
1. Check if it's still an issue (some of them may have already been resolved by our E2E work)
2. Determine a solution, asking questions if anything is unclear or you need more information
3. For large features, create a plan for it in the .claude/planning folder
4. For bug fixes, use test-driven development methodologies and create unit/integration/E2E tests to prevent regressions. Determine the type of test as appropriate (unit, integration, E2E)
5. Verify functionality with Playwright MCP as needed
6. Update this document as you go so it can be used as the source of truth for progress
7. Each section has a header that describes the class of user that is affected. Make sure you are logged in as a relevant user (TestPlayer1-3 are in every game; TestPlayer4 is not in some games; TestGM is always the game master; TestAudience is assumed to be audience but you'll likely need to join the audience in each game)

## Legend
- ✅ VERIFIED - Issue confirmed to still exist (Oct 27, 2025)
- ✓ FIXED - Issue has been resolved
- ⏸️ SKIPPED - Not checked yet

- Unauthenticated User
  - Landing Page
    - ✅ UI: Landing page is rough. No games listed (unclear if that's intentional)
      - **Status**: Confirmed - Landing page shows "No games match your current filters" with no games visible
      - **Location**: http://localhost:5173/ (logged out)
      - **Note**: Unclear if this is intentional design or if public/recruiting games should be shown to unauthenticated users
    - ✓ UI: Text on the "Sign up or Login" button is invisible against the button color
      - **Status**: FIXED - Added not-prose class to prevent .prose styles from overriding button text color
      - **Location**: Bottom of landing page (http://localhost:5173/ when logged out)
- Authenticated User, Not in a Game
  - ⏸️ UI: Default after registration is "recruiting games" instead of a dashboard
  - ⏸️ FEATURE: Dashboard should exist, but largely be empty for consistent UX
  - ✓ UI: Default tab for an "in_progress" game is "phases" but it should be "common room" if available
      - **Status**: FIXED - Added missing dependencies to useGameTabs memo, now defaults to common-room correctly
      - **Location**: /games/50704?tab=phases (should default to ?tab=common-room)
  - ✓ BUG: The "New Comments" sub-tab returns a 403 (it should not)
      - **Status**: FIXED - Removed permission check from ListRecentCommentsWithParents to match GetGamePosts (publicly viewable)
      - **Location**: /games/50704?tab=common-room → Click "New Comments" as TestPlayer4 (non-participant)
      - **Fix**: Backend: api.go removed participant check, comments are now publicly viewable like posts
  - ✓ UI: The "Apply to Join" dialogue allows you to join as a player or the audience, but there's a "Join as Audience" button right next to it
      - **Status**: FIXED - Removed separate "Join as Audience" button, kept unified "Apply to Join" modal with role selection
      - **Location**: /games/50702 (recruiting game) - Both buttons were visible side-by-side
      - **Fix**: Removed redundant button from GameActions, removed handler from GameDetailsPage
  - ✓ UI: On the "Participants" tab, "GameParticipants" is one word and it lists "Audiences" (instead of Audience Members) as a category which is incorrect
      - **Status**: FIXED - Changed "GameParticipants" to "Game Participants" in PeopleView.tsx
      - **Location**: /games/50704?tab=people
  - ✓ BUG: Joining a game that is in the recruiting state as audience results in the game showing up on your dashboard with you having applied, rather than joined as an audience member
      - **Status**: FIXED - Added audience role handling to DashboardGameCard getRoleDisplay function
      - **Location**: Join game 50702 as audience → Check /dashboard → Game now shows "Audience" correctly
      - **Fix**: Updated role display logic in DashboardGameCard.tsx to handle 'audience' role, added test
- Game Master
  - ✓ UI: New Common Room post submission form should be minimized by default when there are already posts in the commmon room
      - **Status**: FIXED - Added collapse/expand functionality with shouldStartCollapsed prop
      - **Location**: /games/50704?tab=common-room as TestGM
      - **Fix**: Created collapsed button state, full form shows chevron to collapse, preserves content when toggling
      - **Files Modified**:
        - `CreatePostForm.tsx`: Added isCollapsed state, collapse button view, expand button in header
        - `CommonRoom.tsx`: Pass `shouldStartCollapsed={posts.length > 0}` prop
        - `CreatePostForm.test.tsx`: Added 6 tests for collapse/expand behavior (40 tests total, all passing)
  - ✓ BUG: Attempting to create a character of type "Player" results in a 403. GMs should be allowed to create player characters and have an autocomplete on that form to assign them to a player
      - **Status**: FIXED - GMs can now create player characters and assign them to specific players
      - **Location**: /games/50704?tab=people → Click "Create Character" → Enter name → Select "Player Character" → Select player from dropdown
      - **Fix**:
        - Backend: Modified permission check to allow GMs, added optional user_id to request, require user_id when GM creates player character
        - Frontend: Added user selector dropdown that appears when GM creates player character, populated with game players
        - Players can only create characters for themselves (security)
      - **Files Modified**:
        - Backend: `pkg/characters/requests.go` (added user_id field), `pkg/characters/api_crud.go` (updated permissions and assignment logic)
        - Frontend: `src/types/characters.ts` (added user_id to request type), `src/components/CreateCharacterModal.tsx` (added user selector), `src/components/CharactersList.tsx` (fetch and pass participants)
      - **Test Pyramid Progress**:
        - [✓] 1. Backend unit tests - `pkg/characters/api_crud_test.go` - ALL TESTS PASSING
          - TestCharacterAPI_GMCanCreatePlayerCharacters: 3 test cases covering GM permissions
          - TestCharacterAPI_PlayerCanOnlyCreateOwnCharacter: 3 test cases covering player restrictions
          - Tests verify: GM can create for players, GM must provide user_id, players auto-assigned to self, player can't create NPC
        - [✓] 2. API verification with curl - **✅ VERIFIED WORKING**
          - ✓ Logged in as TestGM successfully
          - ✓ Created player character for TestPlayer3 (user_id=4) on game 604
          - ✓ Response: 201 Created with character assigned to user_id=4
          - **Test Command**:
            ```bash
            curl -s -X POST http://localhost:3000/api/v1/games/604/characters \
              -H "Content-Type: application/json" \
              -H "Authorization: Bearer $(cat /tmp/api-token.txt)" \
              -d '{"name":"Test Character","character_type":"player_character","user_id":4}'
            ```
          - **Response**:
            ```json
            {"id":433,"game_id":604,"user_id":4,"name":"Test Character",
             "character_type":"player_character","status":"pending",
             "created_at":"2025-10-27T22:49:07.936198-07:00",
             "updated_at":"2025-10-27T22:49:07.936198-07:00"}
            ```
          - **Verified**: GM can create player characters and assign them to specific players via API
        - [✓] 3. Frontend component tests for CreateCharacterModal - **✅ ALL 30 TESTS PASSING**
          - Created `frontend/src/components/CreateCharacterModal.test.tsx`
          - **Test Coverage**:
            - Modal Visibility (2 tests)
            - Player Role - Basic Functionality (6 tests)
            - GM Role - Character Type Selection (5 tests)
            - GM Role - User Selector for Player Characters (10 tests)
            - Form Submission (5 tests)
            - Modal Close/Cancel (2 tests)
          - **Key Test Scenarios**:
            - ✓ GM sees both "Player Character" and "NPC" options
            - ✓ GM sees user selector when creating player character
            - ✓ GM cannot submit without selecting a player for player character
            - ✓ User selector disappears when switching to NPC
            - ✓ user_id is cleared when switching from player character to NPC
            - ✓ Players only see "Player Character" option
            - ✓ Players don't see user selector (auto-assigned on backend)
            - ✓ Form validation (name required, player selection required for GMs)
            - ✓ API calls include correct user_id for GM-created player characters
            - ✓ Error handling displays error messages
          - **Result**: 30 tests passed, 0 failed
        - [✓] 4. System verification (manual testing with running servers) - **✅ VERIFIED WORKING**
          - Tested with Playwright MCP as TestGM on game 604
          - **Verification Steps**:
            1. ✓ Navigated to game 604 (character_creation state)
            2. ✓ Clicked "Create Character" button
            3. ✓ Modal opened with correct form fields
            4. ✓ Verified GM sees "Player Character" and "NPC" options
            5. ✓ Verified "Assign to Player" dropdown visible
            6. ✓ Verified TestPlayer3 available in dropdown
            7. ✓ Entered name "Manual Test Character"
            8. ✓ Selected TestPlayer3 from dropdown
            9. ✓ Clicked "Create Character" button
            10. ✓ Modal closed automatically
            11. ✓ New character appeared in list with correct data
          - **Verified Behavior**:
            - ✓ Submit button disabled until name + player selected
            - ✓ Character created with status "pending"
            - ✓ Character assigned to correct player (TestPlayer3)
            - ✓ Character type displays as "player character"
            - ✓ Character appears at top of list (most recent)
            - ✓ GM can see "Approve" and "Reject" buttons
          - **Conclusion**: Feature works perfectly in production environment
        - [ ] 5. E2E test in `e2e/characters/gm-creates-player-character.spec.ts`
  - ✓ FEATURE: There is no way to delete characters currently
      - **Status**: FIXED - GM can now delete characters with confirmation modal
      - **Location**: /games/300?tab=characters as TestGM
      - **Implementation Details**:
        - Backend: DELETE /api/v1/characters/:id endpoint (GM only)
        - Validation: Prevents deletion of characters with existing messages or action submissions
        - Frontend: Delete button on character cards with confirmation modal
        - Modal shows character name and warning about restrictions
        - Successful deletion refreshes character list
      - **Test Pyramid Progress**:
        - [✓] 1. Backend unit tests in `pkg/characters/api_crud_test.go` - 6 tests passing
          - Successfully delete character with no activity
          - Prevent deletion when character has messages
          - Prevent deletion when character has action submissions
          - CASCADE delete character_data
          - CASCADE delete npc_assignments
          - Delete nonexistent character returns error
        - [✓] 2. API verification with curl - **✅ VERIFIED WORKING**
          - ✓ Created test character 126 (no activity)
          - ✓ Deleted character 126 → HTTP 204 No Content
          - ✓ Created message for character 73
          - ✓ Attempted to delete character 73 → HTTP 400 with error "cannot delete character with existing messages"
        - [✓] 3. Frontend component tests - **✅ 8 NEW TESTS PASSING (40 total in CharactersList.test.tsx)**
          - GM should see delete button for all characters
          - Player should NOT see delete button
          - Clicking delete button opens confirmation modal
          - Confirmation modal displays character name
          - Clicking confirm button calls delete API
          - Modal closes on successful deletion
          - Displays error message if deletion fails
          - Cancel button closes modal without deleting
        - [✓] 4. Manual testing with Playwright MCP - **✅ VERIFIED WORKING**
          - Logged in as TestGM on game 300
          - Created test character "Test Character to Delete" (NPC)
          - Verified Delete button visible on character card
          - Clicked Delete button → Confirmation modal appeared
          - Modal displayed character name and warning correctly
          - Clicked "Delete Character" → Character successfully deleted
          - Character list refreshed showing "No characters created yet"
        - [✓] 5. E2E tests in `e2e/characters/character-deletion.spec.ts` - **✅ 5 TESTS PASSING**
          - ✓ GM can delete character with no activity
          - ✓ Error shown when deleting character with messages (test creates message first)
          - ✓ Canceling deletion keeps character
          - ✓ Players don't see delete button
          - ✓ Only GM sees delete button
          - **Test Coverage**: Complete workflow from creation to deletion with all edge cases
  - ⏸️ FEATURE: Rejecting a character is permanent, there should be a way to approve a character that has been rejected (and vice versa)
  - ⏸️ BUG: Rejected characters should not show up in the messages tab as an option to send messages to
  - ✓ UI: Handout creation could use a preview window for markdown
      - **Status**: FIXED - Added Preview/Edit toggle button with MarkdownPreview component
      - **Location**: /games/164?tab=handouts → Click "Create Handout"
      - **Implementation**: Toggle button switches between textarea (Edit) and rendered markdown (Preview)
      - **Features**:
        - Preview button shows rendered markdown with proper formatting
        - Edit button returns to textarea with content preserved
        - Helper text shows supported markdown syntax
        - Empty content shows "No content to preview..." placeholder
      - **Files Modified**: `frontend/src/components/CreateHandoutModal.tsx`
      - **Verified**: Manually tested with Playwright MCP - markdown renders correctly (headings, bold, italic, lists, links)
  - ✓ BUG: GM can create posts in the History view of a common room phase
      - **Status**: FIXED - HistoryView passes isCurrentPhase={false}, making CommonRoom read-only
      - **Location**: /games/50704?tab=history → Click on "Phase 1 Arrival at the Harbor"
      - **Expected**: History view should be read-only for active phases
  - ⏸️ FEATURE: Cancelling a game needs a confirmation modal
  - ⏸️ FEATURE: GMs should be able to edit results before publishing them. Currently there is no way to view or edit pending results.
  - ⏸️ FEATURE: Is the npc_assignments table vs. user_id on a character worth it to maintain as a split? Could we just make a character_assignments table and use that to avoid having to check all of this extra logic?
- Players
  - ✅ UI: Description of Phases isn't visible anywhere
      - **Status**: Confirmed - Phase description is only visible in History tab phase cards, not in Common Room view
      - **Location**: /games/50704?tab=common-room shows "Common Room - Arrival at the Harbor" header but description ("The investigators arrive at Innsmouth harbor...") is nowhere visible
      - **Expected**: Phase description should be displayed somewhere in the Common Room view, perhaps near the phase title or deadline
  - ✓ UI: Default tab for an "in_progress" game is "people" but it should be "common room" or "actions"
      - **Status**: FIXED - Added missing dependencies to useGameTabs memo, now defaults correctly
      - **Location**: /games/50704 defaults to ?tab=people
      - **Expected**: Should default to ?tab=common-room for in_progress games, or ?tab=actions if there's an active action phase
      - **Note**: This is duplicate of the "Authenticated User, Not in a Game" item about default tabs
  - ✓ BUG: History tab common rooms can have replies made to them if the phase is still active
      - **Status**: FIXED - HistoryView passes isCurrentPhase={false}, cascades readOnly prop to disable reply/comment buttons
      - **Location**: /games/50704?tab=history → Click on active "Phase 1 Arrival at the Harbor"
      - **Expected**: History view should be read-only, no reply/comment buttons for active phases
  - ⏸️ BUG: Leaving a game should relinquish control of character
  - ✅ UI: "Leave Game" button should be less prominent -- people tab
      - **Status**: Confirmed - "Leave Game" button is prominently displayed in game header section
      - **Location**: /games/50704 - visible in game header below game stats
      - **Expected**: Button should be less prominent, possibly moved to a settings menu or made smaller/less visible
  - ✓ FEATURE: Action Result flow is a little off now. If the GM starts a new common room immediately after publishing results, the only place to see your results is in the history tab
      - **Status**: FIXED - Implemented Option B: Embedded Results Section (see detailed implementation in section 2 below)
      - **Location**: Common Room tab shows "Recent Action Results" section when applicable
      - **Implementation**: RecentResultsSection component displays at top of Common Room, auto-collapses after first view
  - ✅ BUG: Players are able to edit their abilities, skills, items, and currency--this is GM only functionality.
      - **Status**: Confirmed - Players can add abilities, skills, items, and currency to their own characters
      - **Location**: /games/50704?tab=people → Edit Sheet → Abilities & Skills / Inventory tabs
      - **Confirmed Actions**: "Add Ability", "Add Item", "Add Currency" buttons all open forms for players
      - **Expected**: These buttons should only be visible/functional for GMs. Players should have read-only view of their character stats.
- General
  - ⏸️ BUG: "Player replied to your comment" should be a hard link to the comment in question, currently just the common room
  - ✓ BUG: As all roles, the deep discussion thread on Shadows Over Innsmouth has one reply that just says "Loading replies..." instead of the full comment chain
      - **Status**: FIXED - Thread displays correctly with all comments visible
  - ✅ FEATURE: The "New Comments" sub-tab could use a refresh button to fetch new data without a full page reload
      - **Status**: Confirmed - New Comments tab has no refresh button or mechanism to reload without full page refresh
      - **Location**: /games/50704?tab=common-room → Click "New Comments"
      - **Expected**: Add refresh button to fetch latest comments without full page reload
  - ✅ FEATURE: @ mentions of characters appear to be links but don't do anything. We could add a little hover modal with their name, player, and avatar
      - **Status**: Confirmed - Character mentions like "@Dr. Sarah Chen" are styled as links but clicking does nothing
      - **Location**: Any common room post with @mentions (e.g., /games/50704?tab=common-room)
      - **Expected**: Add hover modal showing character info (name, player, avatar) and/or make clickable to navigate to character sheet
      - **Note**: Make sure existing E2E tests reflect this change
  - ✅ UI: Character sheets do not need both a "Public Profile" and "Physical Appearance". Just the "Public Profile" is sufficient
      - **Status**: Confirmed - Bio/Background tab shows both "Public Profile" and "Physical Appearance" sections
      - **Location**: /games/50704?tab=people → Edit Sheet → Bio/Background tab
      - **Expected**: Consolidate into single "Public Profile" field
  - ✅ UI: Ditto with "Private Notes" and "Secrets" -- these feel like they should just be one field
      - **Status**: Confirmed - Private Notes tab shows both "Private Notes" and "Character Secrets" sections
      - **Location**: /games/50704?tab=people → Edit Sheet → Private Notes tab
      - **Expected**: Consolidate into single field (suggest keeping "Private Notes")
  - ⏸️ UI: On the character sheet, Abilities, Skills, Items, and Currency all have rounded bottom borders which is incorrect
      - **Note**: Observed rounded borders on all character sheet sections. Appears to be intentional card design but marked as incorrect in original issue. Needs visual design verification.
  - ⏸️ UI: Adding currency on character sheets is somewhat annoying, typing a number doesn't get rid of the default "0" so you have to select all text with a mouse and then type
      - **Note**: Tested with Playwright fill() method and "0" was correctly replaced with "5". May need manual keyboard testing to verify actual behavior.
  - ⏸️ UI: If there is an unread message badge on a private message in the sidebar, the start of the text moves out of the box
      - **Note**: Requires active private messages with unread badges to verify. Cannot test with current demo data.
  - ✓ UI: Deleting a comment has a standard browser alert() instead of a modal.
      - **Status**: FIXED - Created ConfirmModal component, replaced browser confirm() with custom modal
      - **Location**: Any comment with Delete button → Click Delete
      - **Expected**: Should use custom modal for consistency with app design
  - ⏸️ FEATURE: Players, Audience Members, and Game Masters should be able to delete private messages as well as conversations. There's not a lot of screen real estate here so the UI will need to be slick.
      - **Note**: Cannot test without implementing delete functionality first.
  - ✅ FEATURE: We need pagination for the /games endpoint, it currently loads all games
      - **Status**: Confirmed - Games page shows "Showing 9 of 9 games" with all games listed, no pagination controls
      - **Location**: /games page
      - **Expected**: Add pagination controls (page numbers, next/prev, or load more) when game count exceeds reasonable limit (e.g., 20-50 games)

## Verification Summary (Oct 27, 2025)
**Verified Issues**: 23 confirmed, 1 already fixed
**Remaining to Verify**: ~20 items (require specific scenarios or cannot test with demo data)

### Quick Wins (Confirmed & Easy to Fix)
1. ✓ Sign up button invisible text - CSS fix - FIXED (added not-prose class)
2. ✓ "GameParticipants" spacing - String literal fix - FIXED
3. ✓ Default tab should be Common Room - Logic fix in GameDetailsPage - FIXED (useGameTabs dependency array)
4. ✓ GM can post in History view - Add conditional rendering - FIXED (HistoryView passes isCurrentPhase={false})
5. ✓ Players can post in History view - Same fix as #4 - FIXED (readOnly prop cascade)
6. ✓ New Comments 403 error for non-participants - Permission/error handling fix - FIXED (removed permission check)
7. ✓ Apply to Join vs Join as Audience redundancy - Remove redundant button - FIXED (removed "Join as Audience" button)
8. ✓ Audience badge shows as "Player" - Fix dashboard role display logic - FIXED (getRoleDisplay function)
9. ✓ GM post form not minimized - Add collapse/expand functionality - FIXED (shouldStartCollapsed prop)
10. ✓ GM can't create player characters (403) - Fix permission + add player assignment - FIXED (backend permissions + user selector)
11. ✓ No delete button for characters - Add delete functionality with confirmation - FIXED (GM-only, with activity validation)
    12. ✓ Handout creation no preview - Add markdown preview pane/toggle - FIXED (Preview/Edit toggle button)
13. ✓ Delete comment uses browser alert - Replace with custom modal - FIXED (ConfirmModal component)
14. ✓ Public Profile + Physical Appearance redundancy - Consolidate character sheet fields - FIXED (single "Character Description" field)
    - **Status**: FIXED - Consolidated Bio module from 2 fields to 1 comprehensive field
    - **Location**: Character Sheet → Bio/Background tab
    - **Changes**: Modified CHARACTER_MODULES in frontend/src/types/characters.ts
15. ✓ Private Notes + Secrets redundancy - Consolidate character sheet fields - FIXED (single "Private Notes & Secrets" field)
    - **Status**: FIXED - Consolidated Notes module from 2 fields to 1 comprehensive field
    - **Location**: Character Sheet → Private Notes tab
    - **Changes**: Modified CHARACTER_MODULES in frontend/src/types/characters.ts
16. ✓ Phase description not visible - Display phase description in Common Room view - FIXED (CommonRoom displays description in Card)
    - **Status**: FIXED - Added phaseDescription prop to CommonRoom component, displays in bordered Card with MarkdownPreview
    - **Location**: Game Common Room tab (current phase) and History view (historical phases)
    - **Changes**: Modified CommonRoom.tsx, GameTabContent.tsx, HistoryView.tsx

### Moderate Complexity
17. ✓ Players can edit abilities, skills, items, currency - Add permission checks for character stat editing
18. ✓ Leave Game button too prominent - UI restructure to make button less prominent
19. ✓ Games pagination - Add pagination to /games endpoint
    - **Status**: FIXED - Added full-stack pagination with comprehensive test coverage
    - **Location**: /games page
    - **Implementation**:
      - Backend: Added page/page_size parameters to game listing API with validation (default page=1, page_size=20, max=100)
      - Backend: Added pagination metadata (total_pages, has_next_page, has_previous_page, filtered_count)
      - Frontend: Created reusable Pagination component with page numbers and size selector
      - Frontend: Integrated pagination into useGameListing hook with URL synchronization
      - Frontend: Updated GamesPage to display pagination controls
    - **Test Coverage**:
      - Backend: 4 test functions with 14 subtests (defaults, custom values, invalid params, metadata)
      - Frontend Component: 14 tests for Pagination UI
      - Frontend Hook: 6 new tests for pagination state management (26 total tests)
    - **Bug Fixes**:
      - Fixed divide by zero error when filters.PageSize is 0
      - Fixed currency tab visibility for non-GM players
    - **Files Modified**: 23 files (backend + frontend)
    - **All Tests Passing**: Backend ✓, Frontend 75 files (1678 tests) ✓

### Features to Implement
20. ✓ New Comments refresh button - Add button to reload comments without page refresh
    - **Status**: FIXED - Added refresh button with loading state to NewCommentsView component
    - **Location**: /games/{id}?tab=common-room → New Comments sub-tab
    - **Implementation**:
      - Added RefreshCw icon from lucide-react with animated spin on refresh
      - Button disabled while refreshing or initially loading
      - Uses React Query's refetch function for data refresh
      - Button text changes from "Refresh" to "Refreshing..." during operation
      - Positioned in header next to "Recent Comments" title
    - **Files Modified**:
      - `frontend/src/components/NewCommentsView.tsx` - Added refresh button and state
      - `frontend/src/components/__tests__/NewCommentsView.test.tsx` - Added 6 tests for refresh functionality (19 total tests passing)
    - **Test Coverage**:
      - ✓ Refresh button renders with comments
      - ✓ Calls refetch when clicked
      - ✓ Disables button while refreshing
      - ✓ Shows "Refreshing..." text while loading
      - ✓ Disables button during initial load
    - **Frontend Tests**: ✅ All 75 test files passing (1684 tests)

21. ✓ @ mention interactivity - Add hover tooltip for character mentions
    - **Status**: FIXED & IMPROVED - Added interactive hover tooltip with avatar and improved visibility
    - **Location**: Any common room post or comment with @mentions (e.g., /games/{id}?tab=common-room)
    - **Implementation**:
      - Added hover state tracking in MarkdownPreview component
      - Tooltip shows character avatar, name, player username, and character type
      - Uses `position: fixed` with viewport-relative coordinates (4px below mention)
      - Solid dark background (bg-gray-900 dark:bg-gray-800) for excellent readability
      - Flexbox layout with avatar on left, text on right
      - Expanded MentionedCharacter interface to include username, character_type, and avatar_url (backwards compatible)
    - **Bug Fixes**:
      1. **Data Issue**: Updated ThreadedComment to pass complete character data (username, character_type, avatar_url) to MarkdownPreview
      2. **Positioning Issue**: Fixed tooltip positioning calculation - removed window.scrollY/scrollX offset (not needed for fixed positioning)
      3. **Transparency Issue**: Changed from bg-bg-secondary to solid bg-gray-900/gray-800 for better contrast and readability
    - **Features**:
      - Hover over any @ mention to see tooltip
      - Tooltip displays: Character avatar (CharacterAvatar component), Character Name (bold white), Player username (gray), Character type (lighter gray)
      - Smooth transition on hover/leave
      - Non-interactive (pointer-events-none) to prevent tooltip flickering
      - Correctly positions within viewport regardless of scroll position
      - Avatar displays proper character initials with colored background
    - **Files Modified**:
      - `frontend/src/components/MarkdownPreview.tsx` - Added CharacterAvatar import, updated tooltip rendering with avatar and solid background
      - `frontend/src/components/ThreadedComment.tsx` - Updated character data mapping to include avatar_url
    - **Testing**:
      - Manually verified on Game #606 (E2E Common Room - View Posts)
      - Tooltip correctly displays avatar, name, username, and character type with excellent readability
      - Solid background ensures text is readable over any content
      - Tooltip positioning works correctly with page scroll
      - Screenshot saved: `.playwright-mcp/mention-tooltip-improved.png`
      - Frontend Tests: ✅ All 1684 tests passing
    - **Backwards Compatible**: Works with existing mentions that only have id/name (avatar optional)

### Items Requiring Specific Test Scenarios - Detailed Evaluation

#### 1. ⏸️ BUG: Leaving a game should relinquish control of character
- **Status**: NEEDS VERIFICATION - Can test with existing fixtures
- **Test Setup**: Use Game #302 (GM Messaging) with TestPlayer1
- **Current Behavior**: Unknown - need to verify if leaving game properly removes character control
- **Required Data**: ✅ Available - Multiple games with player participation
- **Verification Steps**:
  1. Navigate to game with controlled character
  2. Click "Leave Game" button
  3. Verify character is no longer controllable by player
  4. Check Messages tab doesn't show character
  5. Verify character appears as NPC to other players
- **Implementation**: If bug exists, update leave game handler to clear character_player_id
- **Complexity**: Low (Backend + Frontend)
- **Priority**: Medium - Affects game integrity

#### 2. ✓ FIXED: Action Result visibility when GM starts new Common Room immediately (Option B)
- **Status**: IMPLEMENTED - Option B: Embedded Results Section
- **Original Issue**: "If the GM starts a new common room immediately after publishing results, the only place to see your results is in the history tab"
- **Implementation Date**: October 28, 2025
- **Test Setup**: Game #326 (E2E Test: Action Results) - Phase 1 (action, expired) → Phase 2 (common room, active)
- **Tested As**: TestGM (GM role) and TestPlayer1 (Player role)

##### Current Behavior (CONFIRMED)
**What Works:**
- ✅ Results ARE accessible to players via History tab → Phase 1 → Results
- ✅ Results display correctly with narrative and game mechanics
- ✅ GMs can view all results (published + draft)
- ✅ Players can only see published results

**UX Problems Discovered:**
1. **Hidden Results Problem**
   - When GM starts new common room after publishing results:
   - Phase description says: "Players discuss the results of their investigations"
   - But provides NO link, button, or indicator of where to find those results
   - Players must discover History tab → Phase 1 → Results path themselves

2. **Multi-Step Discovery Journey** (7 steps to find results!)
   ```
   1. Log in and see common room
   2. Read phase description mentioning results
   3. Look for results (NOT FOUND)
   4. Discover History tab exists
   5. Click History tab
   6. Realize Phase 1 might contain results
   7. Click Phase 1 to finally view results
   ```

3. **Misleading Context**
   - Phase description directly references results
   - Creates expectation results should be visible in current context
   - Results feel "lost" or "buried" in history

4. **Technical Issues**
   - Console shows 403 Forbidden errors when loading History tab as player
   - Results still display (from different endpoint), but suggests permission confusion

##### Recommended Solution: Combination Approach

**Implement Option A + Option B for optimal UX:**

**Option A: Enhanced Phase Indicator (Quick Win - 2-4 hours)**
```
Current Phase: Discussion 📋 Previous results available
                         └─ Dropdown: "View Phase 1 Results"
```
- Add indicator to current phase chip when previous phase has results
- Dropdown menu with direct link to results
- Minimal architectural change
- Clear visual cue

**Option B: Embedded Results Section (Better Long-Term - 4-8 hours)**
```
┌─────────────────────────────────────────────┐
│  📋 Recent Action Results (Phase 1)         │
│  ▼ Basement Investigation Results           │
│  ▼ Library Research Results                 │
│                                              │
│  [View Full Results in History]             │
└─────────────────────────────────────────────┘
```
- Add collapsible "Recent Results" section at top of Common Room
- Show when:
  - Current phase is common_room
  - Previous phase was action with published results
  - No new action phase has started since
- Results displayed in collapsed/expandable cards
- Auto-collapse after first view (tracked in localStorage)
- "View Full Results" button links to History → Phase X

##### Implementation Tasks

**Phase 1: Quick Fix (Phase Indicator Enhancement)**
- [ ] Update `CurrentPhaseIndicator` component (frontend/src/components/CurrentPhaseIndicator.tsx)
- [ ] Add logic to detect if previous phase has published results
- [ ] Add visual indicator (📋 icon) to phase chip
- [ ] Add dropdown menu with "View Previous Results" link
- [ ] Link navigates to History tab with phase expanded
- **Estimated Time**: 2-4 hours
- **Complexity**: Low

**✓ Implemented: Embedded Results Section (Option B)**
- [✓] Created `RecentResultsSection` component with collapsible design
- [✓] Added `usePreviousPhaseResults` hook to fetch previous phase results
- [✓] Integrated into `CommonRoom` component
- [✓] Added collapse/expand state with localStorage persistence
- [✓] Styled to match design system (Card, Badge components)
- [✓] Added "View Full Results" link to History
- **Actual Time**: ~4 hours
- **Complexity**: Medium

**Implementation Details:**
- **New Component**: `frontend/src/components/RecentResultsSection.tsx`
  - Displays recent action results at top of Common Room
  - Collapsible header with 📋 icon, phase title, and result count badge
  - Individual result cards with expand/collapse functionality
  - Preview shows first 150 characters, full content with MarkdownPreview
  - "View Full Results" buttons navigate to History tab with phase selected
  - localStorage tracks viewed state: `results-viewed-${gameId}-${previousPhaseId}`
  - Auto-collapses after first view for cleaner UX

- **New Hook**: `frontend/src/hooks/usePreviousPhaseResults.ts`
  - Business logic for determining when to show results
  - Fetches game phases and action results in parallel
  - Shows results when:
    - Current phase is `common_room`
    - Previous phase was `action` with published results
    - No newer action phases between previous and current
  - Returns: `shouldShowResults`, `results[]`, `previousPhaseId`, `previousPhaseTitle`
  - Handles both GM (all results) and player (published only) endpoints

- **Modified Components**:
  - `frontend/src/components/CommonRoom.tsx`:
    - Added `currentPhase?: GamePhase | null` prop
    - Integrated `usePreviousPhaseResults` hook
    - Renders `RecentResultsSection` when `isCurrentPhase && shouldShowResults`
  - `frontend/src/components/GameTabContent.tsx`:
    - Passes `currentPhase` prop to `CommonRoom` component

**Testing:**
- ✅ Manually tested with Playwright MCP on Game #326 (E2E Test: Action Results)
- ✅ Verified results display correctly with expand/collapse functionality
- ✅ Confirmed localStorage persistence works (auto-collapse on second visit)
- ✅ Verified "View Full Results" button navigates to History tab correctly
- ✅ Tested as both GM and Player roles

**Result:**
- Players now see recent action results immediately when entering Common Room
- Results are contextually placed at top of discussion area
- Clean UX with collapse/expand and one-time viewing tracking
- Seamless navigation to full results in History tab

**Phase 3: Technical Cleanup**
- [ ] Investigate and fix 403 errors in History tab for players
- [ ] Verify permissions for results endpoints are correct
- [ ] Add loading states and error handling
- [ ] Add smooth transition animations
- **Estimated Time**: 2-4 hours
- **Complexity**: Low-Medium

##### Alternative Options Considered

**Option C: Results Banner** (Not Recommended)
- Dismissible banner: "📋 New action results available! [View Results]"
- **Rejected**: Can be ignored or dismissed too quickly

**Option D: Dedicated Results Tab** (Future Enhancement)
- New "Results" tab showing all published results chronologically
- **Deferred**: More significant architectural change, consider for v2

##### Files to Modify

**Frontend Components:**
- `frontend/src/components/CurrentPhaseIndicator.tsx` - Add results indicator
- `frontend/src/components/CommonRoom.tsx` - Integrate RecentResultsSection
- `frontend/src/components/RecentResultsSection.tsx` - NEW component
- `frontend/src/components/GameDetailView.tsx` - Update phase history logic

**API Hooks:**
- `frontend/src/hooks/usePhaseResults.ts` - Fetch previous phase results
- `frontend/src/hooks/usePhases.ts` - Add logic to detect previous action phase

**Backend Verification:**
- Check permissions on `/api/v1/games/:id/phases/:phaseId/results` endpoint
- Investigate 403 errors for player role

- **Complexity**: Medium (Frontend implementation + minor backend fixes)
- **Priority**: High - Core game loop UX, directly affects player engagement and satisfaction

#### 3. ⏸️ BUG: "Player replied to your comment" notification link
- **Status**: NEEDS TESTING - Can create test scenario
- **Test Setup**: Use Game #606 or #607 for comment testing
- **Current Behavior**: Unknown - notification link may not navigate correctly
- **Required Data**: ✅ Can Create - Add comment as Player 2, reply as Player 1
- **Verification Steps**:
  1. Login as TestPlayer2
  2. Create comment on a post
  3. Login as TestPlayer1
  4. Reply to TestPlayer2's comment
  5. Login as TestPlayer2
  6. Click notification for reply
  7. Verify navigation to correct comment with highlight
- **Implementation**: Check notification link format and CommonRoom navigation
- **Complexity**: Low (Frontend navigation)
- **Priority**: Medium - UX issue

#### 4. ⏸️ FEATURE: Add UI for editing pending (unpublished) results
- **Status**: NEEDS IMPLEMENTATION - Backend supports pending results, but no edit UI exists
- **Current Behavior**: GMs can create results, but there's no way to edit them before publishing
- **Test Setup**: Game with pending action results (unpublished)
- **Required Data**: ⚠️ PARTIAL - Need game with action submissions to create results
- **Backend Verification Needed**:
  1. Confirm API supports PATCH/PUT on results where published=false
  2. Verify backend prevents editing published results (published=true)
  3. Check what fields can be edited (result_data, etc.)
- **Frontend Implementation Required**:
  1. Add "Edit Result" button/interface for pending results
  2. Create modal or inline edit form for result content
  3. Allow editing result_data (markdown content)
  4. Show "Draft" or "Pending" status indicator
  5. Disable editing once published
- **Verification Steps** (after implementation):
  1. As GM, create results for action submissions
  2. Verify "Edit" button appears on pending results
  3. Click edit, modify result content
  4. Save changes and verify they persist
  5. Publish results
  6. Verify edit button disappears/disables after publishing
- **Implementation Tasks**:
  - [ ] Backend: Verify/add PATCH endpoint for results (check published=false)
  - [ ] Frontend: Add ResultEditModal component
  - [ ] Frontend: Add "Edit Result" button to results list
  - [ ] Frontend: Add visual indicator for pending vs published results
  - [ ] Frontend: Disable edit for published results
  - [ ] Tests: Backend unit tests for result updates
  - [ ] Tests: Frontend component tests for edit UI
  - [ ] Tests: E2E test for complete edit workflow
- **Complexity**: Medium (Backend verification + Frontend implementation)
- **Priority**: High - Critical GM workflow gap, prevents result corrections before publishing

#### 5. ⏸️ FEATURE: Cancelling a game needs confirmation modal
- **Status**: NEEDS IMPLEMENTATION - Missing confirmation
- **Test Setup**: Game #338 (Recruitment state) or any game
- **Current Behavior**: Likely cancels immediately without confirmation
- **Required Data**: ✅ Available - Any game GM can cancel
- **Verification Steps**:
  1. As GM, navigate to game settings
  2. Click "Cancel Game" button
  3. Verify confirmation modal appears
  4. Test "Cancel" (dismiss) and "Confirm" (proceed) options
  5. Verify game cancelled only on confirmation
- **Implementation**: Add confirmation modal to game settings cancel action
- **Complexity**: Low (Frontend modal)
- **Priority**: High - Prevents accidental game deletion

#### 6. ⏸️ FEATURE: Rejecting/approving characters - UI improvements
- **Status**: NEEDS TESTING - Functionality exists, verify UX
- **Test Setup**: Games #301, #601, #603 (character approval scenarios)
- **Current Behavior**: Character approval exists, may need UX improvements
- **Required Data**: ⚠️ PARTIAL - Need characters in pending state
- **Verification Steps**:
  1. As GM, navigate to character approval interface
  2. Test approve/reject actions
  3. Verify player receives notification
  4. Check rejected character can be edited
  5. Verify resubmission workflow
- **Implementation**: Test existing flow, add improvements if needed
- **Complexity**: Medium (Full workflow)
- **Priority**: Medium - Core character creation flow

#### 7. ⏸️ BUG: Rejected characters in messages tab
- **Status**: NEEDS VERIFICATION - Related to #6
- **Test Setup**: Create rejected character scenario
- **Current Behavior**: Rejected characters may incorrectly appear in messages
- **Required Data**: ⚠️ Need rejected character
- **Verification Steps**:
  1. Create character and have GM reject it
  2. Navigate to game Messages tab
  3. Verify rejected character doesn't appear in character selector
  4. Verify can't send messages as rejected character
- **Implementation**: Filter rejected characters from messages character list
- **Complexity**: Low (Frontend filtering)
- **Priority**: Low - Edge case

#### 8. ⏸️ UI: Unread message badge text overflow
- **Status**: NEEDS VISUAL VERIFICATION - Create scenario
- **Test Setup**: Game #302 or #354 (private messages)
- **Current Behavior**: Badge may overflow with large numbers (99+)
- **Required Data**: ⚠️ Need many unread messages
- **Verification Steps**:
  1. Create multiple unread private messages
  2. Check badge display at various counts (9, 10, 99, 100+)
  3. Verify text doesn't overflow container
  4. Test "99+" truncation works correctly
- **Implementation**: Add max-width and truncation (99+) to badge
- **Complexity**: Very Low (CSS fix)
- **Priority**: Low - Visual polish

#### 9. ⏸️ FEATURE: Delete private messages/conversations
- **Status**: NOT IMPLEMENTED - Feature doesn't exist
- **Test Setup**: N/A - Requires implementation first
- **Current Behavior**: No delete functionality exists
- **Required Data**: N/A
- **Verification Steps**: (After implementation)
  1. Navigate to private messages
  2. Select message or conversation
  3. Click delete button
  4. Verify confirmation modal
  5. Confirm deletion removes messages
  6. Verify can't restore deleted messages
- **Implementation**: Full feature implementation required
  - Backend: Delete message API endpoints
  - Backend: Soft delete vs hard delete decision
  - Frontend: Delete button UI
  - Frontend: Confirmation modal
- **Complexity**: High (Full feature)
- **Priority**: Medium - Quality of life feature

#### 10. ⏸️ UI: Character sheet rounded borders
- **Status**: NEEDS VISUAL VERIFICATION - Design decision
- **Test Setup**: Any character sheet
- **Current Behavior**: Unknown - need to check current styling
- **Required Data**: ✅ Available - Any character
- **Verification Steps**:
  1. Open character sheet
  2. Review border-radius on containers
  3. Check consistency with design system
  4. Verify dark mode compatibility
- **Implementation**: Apply consistent border-radius from design tokens
- **Complexity**: Very Low (CSS update)
- **Priority**: Very Low - Visual polish

#### 11. ⏸️ UI: Currency input default "0" behavior
- **Status**: NEEDS MANUAL TESTING - Keyboard interaction
- **Test Setup**: Character sheet inventory/currency tab
- **Current Behavior**: May auto-fill "0" when focused, unclear UX
- **Required Data**: ✅ Available - Any character with currency
- **Verification Steps**:
  1. Open character sheet currency section
  2. Focus empty currency input
  3. Test typing behavior (does "0" interfere?)
  4. Test backspace/delete behavior
  5. Verify clear and intuitive UX
- **Implementation**: Adjust placeholder vs value behavior
- **Complexity**: Low (Input component update)
- **Priority**: Low - Minor UX improvement

#### 12. ⏸️ FEATURE: NPC assignments table refactor
- **Status**: ARCHITECTURE DECISION - Not a bug
- **Test Setup**: GM view of NPCs
- **Current Behavior**: Current NPC assignment works, may need UX improvements
- **Required Data**: ✅ Available - Games with NPCs
- **Verification Steps**:
  1. Review current NPC assignment interface
  2. Evaluate if table/list view would improve UX
  3. Gather user feedback on current approach
  4. Decide if refactor needed
- **Implementation**: Depends on decision - may not need changes
- **Complexity**: Medium (If implemented)
- **Priority**: Very Low - Enhancement, not bug

### Recommended Action Order:
1. **Immediate** (#5): Add cancel game confirmation modal - prevents data loss
2. **High Priority** (#2, #4): UX evaluation for action results visibility + implement result editing UI
   - #2: Evaluate and improve result visibility after GM starts new common room
   - #4: Add edit functionality for pending (unpublished) results
3. **Quick Wins** (#8): Fix unread badge overflow - quick CSS fix
4. **Short-term** (#1, #3): Test and fix leave game and notification bugs
5. **Medium-term** (#6): Test character approval workflow and UX improvements
6. **Long-term** (#9): Implement delete messages feature
7. **Polish** (#7, #10, #11, #12): Visual refinements and architecture decisions

### Already Fixed
1. ✓ Deep discussion thread "Loading replies..." bug
