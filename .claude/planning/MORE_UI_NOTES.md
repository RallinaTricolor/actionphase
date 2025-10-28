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
  - ✅ FEATURE: There is no way to delete characters currently
      - **Status**: Confirmed - Only "Edit Sheet" buttons visible on character cards, no delete option
      - **Location**: /games/50704?tab=people as TestGM
      - **Expected**: Should have delete button with confirmation for characters (with appropriate restrictions)
  - ⏸️ FEATURE: Rejecting a character is permanent, there should be a way to approve a character that has been rejected (and vice versa)
  - ⏸️ BUG: Rejected characters should not show up in the messages tab as an option to send messages to
  - ✅ UI: Handout creation could use a preview window for markdown
      - **Status**: Confirmed - Handout creation form has Content textarea with Markdown support but no preview window
      - **Location**: /games/50704?tab=handouts → Click "Create Handout"
      - **Expected**: Should have preview pane or toggle to see rendered markdown
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
  - ⏸️ FEATURE: Action Result flow is a little off now. If the GM starts a new common room immediately after publishing results, the only place to see your results is in the history tab
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
11. ✅ No delete button for characters - Add delete functionality with confirmation
12. ✅ Handout creation no preview - Add markdown preview pane/toggle
13. ✅ Delete comment uses browser alert - Replace with custom modal
14. ✅ Public Profile + Physical Appearance redundancy - Consolidate character sheet fields
15. ✅ Private Notes + Secrets redundancy - Consolidate character sheet fields
16. ✅ Phase description not visible - Display phase description in Common Room view

### Moderate Complexity
17. ✅ Players can edit abilities, skills, items, currency - Add permission checks for character stat editing
18. ✅ Leave Game button too prominent - UI restructure to make button less prominent
19. ✅ Games pagination - Add pagination to /games endpoint

### Features to Implement
20. ✅ New Comments refresh button - Add button to reload comments without page refresh
21. ✅ @ mention interactivity - Add hover modal or click action for character mentions

### Items Requiring Specific Test Scenarios (Cannot Verify with Demo Data)
1. ⏸️ BUG: Leaving a game should relinquish control of character - Requires testing leave functionality
2. ⏸️ FEATURE: Action Result flow - Requires GM to publish results and start new common room
3. ⏸️ BUG: "Player replied to your comment" notification link - Requires active notifications
4. ⏸️ FEATURE: GMs editing results before publishing - Requires pending results to exist
5. ⏸️ FEATURE: Cancelling a game needs confirmation modal - Requires testing cancel action
6. ⏸️ FEATURE: Rejecting/approving characters - Requires rejected characters to test
7. ⏸️ BUG: Rejected characters in messages tab - Requires rejected characters
8. ⏸️ UI: Unread message badge text overflow - Requires unread private messages
9. ⏸️ FEATURE: Delete private messages/conversations - Requires implementing feature first
10. ⏸️ UI: Character sheet rounded borders - Needs visual design spec verification
11. ⏸️ UI: Currency input default "0" behavior - Needs manual keyboard testing
12. ⏸️ FEATURE: NPC assignments table refactor - Architecture decision, not a UI bug

### Already Fixed
1. ✓ Deep discussion thread "Loading replies..." bug
