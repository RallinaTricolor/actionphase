# Known Bugs

## Fixed ✅

- ✅ **Bug #1**: From the games page, the game card links cannot be opened in new tabs
  - **Fixed**: Converted `<div onClick>` to `<Link>` element in `EnhancedGameCard.tsx`
  - **Tests**: 5 tests in `EnhancedGameCard.test.tsx`

- ✅ **Bug #2**: Clicking the "Parent" link of a top level reply to a post goes to a threaded version of that post with no comments
  - **Fixed**: Check `thread_depth === 1` to use `postId` vs `comment` parameter in `ThreadedComment.tsx:356-371`
  - **Tests**: 3 tests in `ThreadedComment.test.tsx`

- ✅ **Bug #4**: In the "Phase History" view, Action Phases are clickable but they will never have any content
  - **Fixed**: Made action phases non-clickable divs with visual indicators in `PhaseHistoryView.tsx:106-141`
  - **Tests**: 3 tests in `PhaseHistoryView.test.tsx`

- ✅ **Bug #9**: Audience members cannot leave games
  - **Fixed**: Updated leave button visibility to include `userRole === 'audience'` in `GameActions.tsx:101`
  - **Tests**: 6 tests in `GameActions.test.tsx`

- ✅ **Bug #11**: The "Messages" tab should not be visible to Audience Members unless they have been assigned an NPC
  - **Fixed**: Added `hasCharacters` check to tab visibility logic in `useGameTabs.ts:102`
  - **Tests**: 5 tests in `useGameTabs.test.tsx`

- ✅ **Bug #12**: The "Submit Action" button should not be visible to users who have not joined a game or to audience members
  - **Fixed**: Added `isParticipant` check to Actions tab visibility in `useGameTabs.ts:91`
  - **Tests**: 5 tests in `useGameTabs.test.tsx`

- ✅ **Bug #5**: The Game Edit modal doesn't have the option to toggle automatic audience approval
  - **Fixed**: Added `auto_accept_audience` checkbox to `GameFormFields.tsx:107-113` and included in `EditGameModal.tsx:90`
  - **Tests**: 4 tests in `EditGameModal.test.tsx` (initial value, toggle interaction, API payload)

- ✅ **Bug #6**: The "Pause Game" button should have a confirm dialogue
  - **Fixed**: Created `PauseGameConfirmationDialog.tsx` component, added pause confirmation logic to `useGameStateManagement.ts:31-34,61-72`, integrated in `GameDetailsPage.tsx:265-272`
  - **Tests**: Manual testing (dialog appears before pausing, can cancel or confirm)

- ✅ **Bug #8**: Player applications can still be "pending" in cancelled games, leaving with a permanent "application pending" badge
  - **Fixed**: Modified `UpdateGameState` in `games.go:117-126` to automatically reject all pending applications when game is cancelled
  - **Tests**: `TestGameService_CancelledGameRejectsPendingApplications` in `games_test.go:1073-1142`

- ✅ **Bug #7**: All instances of JavaScript "alert" boxes should be replaced with modals
  - **Fixed**: Created `ToastContext.tsx` with toast notification system, integrated in `App.tsx:149-151`
  - **Replaced (29/29 alerts)**:
    - `useGameStateManagement.ts:44,56,69,84` - State change errors (4 alerts)
    - `useGameApplication.ts:57` - Withdraw application error (1 alert)
    - `GamesPage.tsx:85,113` - Application success/error (2 alerts)
    - `GameDetailsPage.tsx:111` - Join audience error (1 alert)
    - `AdminPage.tsx:52,55,64,67,77,80,90,93` - Admin actions (8 alerts)
    - `GameApplicationsList.tsx:44,53` - Application review errors (2 alerts)
    - `MessageThread.tsx:202` - Send message error (1 alert)
    - `ThreadedComment.tsx:97,127,145` - Comment actions (3 alerts)
    - `CreateActionResultForm.tsx:28` - Validation warning (1 alert)
    - `HandoutsList.tsx:37,51,59,67,75` - Handout operations (5 alerts)
    - `usePhaseManagement.ts:56` - Phase activation error (1 alert)
  - **Note**: Test files (MarkdownPreview.test.tsx, CommentEditor.test.tsx) intentionally use alert() for XSS testing
  - **Tests**: Manual testing (toasts appear and auto-dismiss after 5 seconds)

- ✅ **Bug #10**: Private Messages in the read only audience view should have character avatars
  - **Fixed**: Replaced conditional `<img>` tag with `CharacterAvatar` component in `AllPrivateMessagesView.tsx:387-391`
  - **Benefit**: Avatars now always display with proper fallback initials when avatar URL is missing
  - **Tests**: Manual testing (avatars visible in audience view)

- ✅ **Bug #3**: There is a date picker for date fields, but no time picker
  - **Fixed**: Enhanced `DateTimeInput` component with react-datepicker library in `DateTimeInput.tsx`
  - **Features**:
    - Calendar popup for intuitive date selection
    - Integrated time picker with 15-minute intervals
    - Consistent UI across all browsers (no more native datetime-local inconsistencies)
    - Custom styling matching theme system (light/dark mode support)
    - Better accessibility
  - **Files Modified**:
    - `DateTimeInput.tsx` - Replaced native input with react-datepicker component
    - `styles/datepicker.css` - Custom theme-aware styling
    - `main.tsx` - Import custom CSS
    - `PhaseCard.tsx` - Removed redundant `type` prop
  - **Tests**: Manual testing (calendar popup works, time selection available)

## Pending 🔧

None - All known bugs fixed!
