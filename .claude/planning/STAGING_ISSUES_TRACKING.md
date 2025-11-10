# Staging Issues Tracking

**Source**: User testing in staging environment
**Created**: 2025-11-10
**Last Updated**: 2025-11-10

This document tracks issues reported by users testing the staging environment. Each issue includes investigation notes, fix status, and testing requirements.

---

## Issue #1: Better Error Feedback on Registration/Login

**Status**: 🔴 Not Started

**Description**:
- Password length validation not shown to user
- Raw error responses displayed throughout the app
- Users don't understand what went wrong during registration/login

**Investigation**:
- [ ] Check frontend error handling in auth forms
- [ ] Review backend error response format
- [ ] Identify all places showing raw error messages
- [ ] Check password validation rules in backend

**Fix Plan**:
- [ ] Add frontend password validation with real-time feedback
- [ ] Create user-friendly error message mapper (raw API error → human message)
- [ ] Update registration form with inline validation
- [ ] Update login form with clear error messages
- [ ] Add password requirements display on registration page

**Tests Required**:
- [ ] Component tests for registration form validation
- [ ] Component tests for login error display
- [ ] E2E test for registration with invalid password
- [ ] E2E test for login with invalid credentials

**Notes**:
- See `src/pages/RegisterPage.tsx` and `src/pages/LoginPage.tsx`
- Backend error responses in `backend/pkg/auth/api.go`

---

## Issue #2: Token Expiration Issues

**Status**: 🟡 Investigated - Ready to Implement

**Description**:
- JWT + Auth Cookie stored simultaneously - is this wise?
- User logged out with no error message or explanation
- Unclear token expiration behavior

**Investigation** ✅ Completed:
- [x] Review current auth flow (JWT + Cookie usage)
- [x] Check token expiration times (access token vs refresh token)
- [x] Investigate silent logout behavior
- [x] Review refresh token logic
- [x] Check for race conditions in token refresh

**Root Cause Identified**:
**Location**: `frontend/src/lib/api/client.ts` (lines 137-147)

The token refresh interceptor has logic to redirect users to `/login` when refresh fails, but:
1. **No user-facing error message** is shown explaining why they were logged out
2. The redirect logic **excludes public pages** (login, games list, home) so users on those pages get a silent logout with no indication
3. React Query cache is not cleared, so stale authenticated data may appear briefly

**Fix Plan**:
```typescript
// src/lib/api/client.ts (lines 130-147)
catch (refreshError) {
  logger.error('Token refresh failed', { error: refreshError });

  // Clear any legacy localStorage tokens
  localStorage.removeItem('auth_token');

  // **NEW**: Show toast notification to user
  import { toast } from 'react-hot-toast'; // or your toast library
  toast.error('Your session has expired. Please log in again.');

  // **NEW**: Clear React Query cache to remove stale auth data
  window.dispatchEvent(new CustomEvent('auth:logout'));

  // Don't redirect if we're already on login page or public pages
  if (!window.location.pathname.includes('/login') &&
      !window.location.pathname.includes('/games') &&
      window.location.pathname !== '/') {
    logger.info('Redirecting to login after failed token refresh');
    window.location.href = '/login';
  }

  return Promise.reject(refreshError);
}
```

**Additional Changes**:
- [ ] Add event listener in `AuthContext.tsx` to clear query cache when `auth:logout` event fires
- [ ] Consider adding a more prominent "Session Expired" modal instead of just a toast for critical pages
- [ ] Install toast library if not already present (e.g., react-hot-toast, sonner)

**Tests Required**:
- [ ] E2E test: Expire token → verify toast appears
- [ ] E2E test: Verify redirect to login after token expiry
- [ ] Unit test: Auth context clears cache on logout event

**Notes**:
- Current auth: `src/contexts/AuthContext.tsx`
- Backend auth: `backend/pkg/auth/jwt.go`
- ADR-003 documents authentication strategy
- Dual storage (localStorage + cookie) is for backwards compatibility during migration

---

## Issue #3: Character Creation Shows for Non-Participants

**Status**: ✅ COMPLETED (2025-11-10)

**Description**:
- Users who are not participants in a game can see character creation UI
- This should only be visible to game participants

**Investigation** ✅ Completed:
- [x] Identify where character creation UI is rendered
- [x] Check participant status logic
- [x] Review game participation states (pending, active, rejected, etc.)
- [x] Test as audience member, non-participant, and rejected applicant

**Root Cause Identified**:
**Location**: `frontend/src/components/CharactersList.tsx` (lines 106-112)

```typescript
const canCreateCharacter = () => {
  if (gameState === 'completed' || gameState === 'cancelled') return false;
  if (userRole === 'gm') return true;
  if (userRole === 'player' && (gameState === 'character_creation' || gameState === 'setup')) return true;
  return false;
};
```

**Problem**: This only checks `userRole` and `gameState`, but doesn't check if the user is actually a **participant** in this specific game. A logged-in user who is not a participant will see the "Create Character" button if the game is in `character_creation` or `setup` state.

**Fix Plan**:
```typescript
// src/components/CharactersList.tsx
// Add isParticipant prop
interface CharactersListProps {
  gameId: number;
  userRole?: string;
  currentUserId?: number;
  gameState?: string;
  isAnonymous?: boolean;
  isParticipant?: boolean;  // **NEW**: Add this prop
}

export function CharactersList({
  gameId,
  userRole = 'player',
  gameState = 'setup',
  isAnonymous = false,
  isParticipant = false  // **NEW**: Receive from parent
}: CharactersListProps) {
  // ...

  const canCreateCharacter = () => {
    if (gameState === 'completed' || gameState === 'cancelled') return false;
    if (userRole === 'gm') return true;
    // **NEW**: Check isParticipant for players
    if (userRole === 'player' && isParticipant && (gameState === 'character_creation' || gameState === 'setup')) return true;
    return false;
  };
}
```

**Parent Component Update**:
```typescript
// src/components/GameTabContent.tsx or wherever CharactersList is rendered
<CharactersList
  gameId={gameId}
  userRole={userRole}
  gameState={gameState}
  isAnonymous={isAnonymous}
  isParticipant={isParticipant}  // **NEW**: Pass from GameContext
/>
```

**Implementation Completed** ✅:
- [x] Added `isParticipant` prop to CharactersList component
- [x] Updated `canCreateCharacter()` to check isParticipant for players
- [x] Modified PeopleView to calculate and pass isParticipant prop
- [x] Updated existing tests to pass isParticipant where needed

**Tests Completed** ✅:
- [x] Component test: Non-participant player cannot see create button (character_creation state)
- [x] Component test: Non-participant player cannot see create button (setup state)
- [x] Component test: Participant player can see create button (character_creation state)
- [x] Component test: Participant player can see create button (setup state)
- [x] Component test: GM sees create button regardless of isParticipant prop
- [x] Component test: Participants cannot create in active games
- [x] Fixed existing tests to pass isParticipant={true} where create button was expected

**Test Results**: All 41 tests passing (`CharactersList.test.tsx`)

**Backend Validation** (Future Enhancement):
- [ ] Add participant check in character creation API endpoint
- [ ] Return 403 Forbidden if non-participant tries to create character

**Files Modified**:
- `frontend/src/components/CharactersList.tsx` (added isParticipant prop and logic)
- `frontend/src/components/PeopleView.tsx` (calculates and passes isParticipant)
- `frontend/src/components/__tests__/CharactersList.test.tsx` (added 6 new tests, updated 2 existing tests)

**Notes**:
- Frontend validation complete, backend API validation recommended as defense-in-depth
- `isParticipant` calculated from participants array with status check (must be 'active')

---

## Issue #4: Re-approve Applicant Not Working

**Status**: 🔴 Not Started

**Description**:
- Re-approving an applicant doesn't seem to work
- Related concerns:
  - What happens if a player creates many characters?
  - Does the GM see all of them all the time?
  - Maybe need to bring back "Rejected" status

**Investigation**:
- [ ] Test re-approve flow in UI
- [ ] Check backend logic for re-approval
- [ ] Review character creation limits per user
- [ ] Check if rejected characters are hidden or visible
- [ ] Review participant state transitions

**Fix Plan**:
- [ ] Fix re-approve backend logic if broken
- [ ] Add character limit per player per game (e.g., 5 max)
- [ ] Implement "Rejected" status to hide rejected applications
- [ ] Hide rejected characters from GM view by default
- [ ] Add "Show Rejected" toggle for GM if needed

**Tests Required**:
- [ ] E2E test for re-approving applicant
- [ ] E2E test for character creation limit
- [ ] Backend test for participant state transitions
- [ ] E2E test for rejected character visibility

**Notes**:
- Game participant states in `backend/pkg/core/models.go`
- Application management in GM tools
- May need database migration to add rejected_at field

---

## Issue #5: Dashboard Card Unread Count Doesn't Refresh

**Status**: ✅ COMPLETED (2025-11-10)

**Description**:
- Unread notification count on dashboard game cards doesn't update without hard refresh
- User must manually refresh page to see updated counts

**Investigation** ✅ Completed:
- [x] Check React Query cache invalidation for game cards
- [x] Review notification polling logic
- [x] Check if unread count API endpoint is being called
- [x] Test notification clearing behavior

**Root Cause Identified**:
**Location**: `frontend/src/hooks/useDashboard.ts`

The dashboard query has `refetchInterval: 60000` (60 seconds) and `refetchOnWindowFocus: true`, **BUT** when notifications are marked as read in other parts of the app, the dashboard query cache is NOT invalidated.

**Example Flow** (Bug):
1. User sees "5 unread" on dashboard card
2. User navigates to game → reads messages
3. Notifications are marked as read (API call succeeds)
4. Dashboard query cache is NOT invalidated
5. User returns to dashboard → still shows "5 unread" (stale data)
6. Only updates after 60 seconds OR hard refresh

**Fix Plan**:

**Option A: Cache Invalidation (Recommended)**:
```typescript
// src/contexts/NotificationContext.tsx or wherever notifications are marked as read
const markAsReadMutation = useMutation({
  mutationFn: (notificationIds: number[]) =>
    apiClient.notifications.markAsRead(notificationIds),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
    // **NEW**: Invalidate dashboard to update unread counts
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  }
});
```

**Option B: Reduce Refetch Interval**:
```typescript
// src/hooks/useDashboard.ts
export function useDashboard() {
  return useQuery<DashboardData>({
    queryKey: ['dashboard'],
    queryFn: async () => {
      const response = await simpleApi.getDashboard();
      return response.data;
    },
    refetchInterval: 15000, // Reduce from 60s to 15s (matches notification polling)
    refetchOnWindowFocus: true,
    placeholderData: (previousData) => previousData,
  });
}
```

**Recommendation**: Implement **both** options for best UX.
- Cache invalidation ensures immediate updates
- Shorter interval provides background sync

**Implementation Completed** ✅:
- [x] Added dashboard cache invalidation to `useMarkNotificationAsRead()` hook
- [x] Added dashboard cache invalidation to `useMarkAllAsRead()` hook
- [x] Added dashboard cache invalidation to `useDeleteNotification()` hook
- [x] Reduced dashboard refetch interval from 60s to 15s (matches notification polling)
- [x] Updated comments to explain the fix

**Tests Completed** ✅:
- [x] Updated unit test for `useMarkNotificationAsRead()` to verify dashboard invalidation
- [x] Updated unit test for `useMarkAllAsRead()` to verify dashboard invalidation
- [x] Updated unit test for `useDeleteNotification()` to verify dashboard invalidation

**Test Results**: All 17 tests passing (`useNotifications.test.tsx`)

**Files Modified**:
- `frontend/src/hooks/useNotifications.ts` (added dashboard cache invalidation to 3 mutation hooks)
- `frontend/src/hooks/useDashboard.ts` (reduced refetch interval 60s → 15s)
- `frontend/src/hooks/useNotifications.test.tsx` (updated 3 tests to verify dashboard invalidation)

**Notes**:
- Dashboard now updates immediately when notifications are marked as read/deleted
- Background sync every 15s ensures consistency even if cache invalidation is missed
- Dashboard unread count comes from `/api/v1/dashboard` endpoint

---

## Issue #6: Reply Button Shows for Non-Participants

**Status**: 🔴 Not Started

**Description**:
- Reply button appears on common room posts even if user is not a participant
- Non-participants should not be able to reply to threads

**Investigation**:
- [ ] Find where Reply button is rendered in common room posts
- [ ] Check participant status logic in common room
- [ ] Test as audience member and non-participant
- [ ] Verify GM can always reply

**Fix Plan**:
- [ ] Add participant check before showing Reply button
- [ ] Hide Reply button for non-participants and audience
- [ ] Show tooltip explaining why Reply is disabled (if needed)
- [ ] Ensure GM always has Reply access

**Tests Required**:
- [ ] E2E test as non-participant (no Reply button)
- [ ] E2E test as audience (no Reply button)
- [ ] E2E test as participant (has Reply button)
- [ ] E2E test as GM (has Reply button)

**Notes**:
- Common room post component: `src/components/CommonRoomPost.tsx`
- Check participant status in game context

---

## Issue #7: Can't Vote with Multiple Characters

**Status**: 🔴 Not Started

**Description**:
- Polls that allow character-level voting don't support multiple votes
- If a player has multiple characters, they should be able to vote with each

**Investigation**:
- [ ] Review poll voting logic (player vs character voting)
- [ ] Check if character selection is available in voting modal
- [ ] Test with multiple characters in same game
- [ ] Review backend logic for multiple character votes

**Fix Plan**:
- [ ] Add character selection dropdown in voting modal (character polls)
- [ ] Allow one vote per character (not one per player)
- [ ] Update backend to track votes by character_id
- [ ] Show "Already voted" badge per character, not per player
- [ ] Update poll results to show character names (if show_individual_votes)

**Tests Required**:
- [ ] Backend test for multiple character votes
- [ ] E2E test: player with 2 characters votes with both
- [ ] E2E test: verify vote badges show per-character status

**Notes**:
- Poll voting: `src/components/PollVotingModal.tsx`
- Backend: `backend/pkg/polls/api_polls.go`
- May need database schema change (add character_id to poll_votes)

---

## Issue #8: Can't Reply to Deeply Nested Comments

**Status**: 🔴 Not Started

**Description**:
- When a comment thread reaches max nesting depth and shows "Continue this thread"
- The deepest comment has no Reply button
- Users can't reply to deeply nested comments

**Investigation**:
- [ ] Check max nesting depth logic in common room
- [ ] Review "Continue this thread" implementation
- [ ] Test replying at max depth
- [ ] Check if Reply button is hidden at max depth

**Fix Plan**:
- [ ] Add Reply button even at max depth
- [ ] Ensure "Continue this thread" page shows Reply button
- [ ] Consider increasing max depth (currently 5?)
- [ ] Test reply functionality in thread detail view

**Tests Required**:
- [ ] E2E test for deep comment nesting (covered in existing tests?)
- [ ] E2E test for replying from "Continue this thread" view
- [ ] Component test for Reply button at max depth

**Notes**:
- Common room thread: `src/components/CommonRoomThread.tsx`
- Max depth constant likely in common room component
- Existing E2E test: `e2e/gameplay/common-room.spec.ts` (deep nesting test)

---

## Issue #9: Load More Button for Top-Level Replies

**Status**: 🔴 Not Started

**Description**:
- Currently loads ALL replies to a common room post
- If there are hundreds of replies, this causes performance issues
- Need pagination for top-level replies

**Investigation**:
- [ ] Review current reply loading logic
- [ ] Check API endpoint for common room comments
- [ ] Test with game that has many replies
- [ ] Measure performance impact of 100+ replies

**Fix Plan**:
- [ ] Implement pagination for top-level replies (e.g., 20 per page)
- [ ] Add "Load More" button at bottom of reply list
- [ ] Keep nested replies fully loaded (or paginate those too?)
- [ ] Update backend API to support limit/offset or cursor pagination
- [ ] Consider infinite scroll as alternative to "Load More"

**Tests Required**:
- [ ] Backend test for paginated comment replies
- [ ] E2E test for "Load More" functionality
- [ ] Performance test with 100+ replies

**Notes**:
- API endpoint: likely `GET /games/{id}/posts/{post_id}/comments`
- Backend: `backend/pkg/db/services/messages/api.go` or similar
- Frontend: `src/hooks/useCommonRoomPosts.ts`

---

## Issue #10: Can Send PMs Outside of Common Room

**Status**: 🟡 Investigated - Ready to Implement

**Description**:
- Direct messaging should only be available during an active common room phase
- Currently users can send PMs even when there's no active common room
- This breaks the game flow design

**Investigation** ✅ Completed:
- [x] Check when Messages tab is visible
- [x] Review phase type logic for messaging
- [x] Test PM access during action phase, results phase
- [x] Verify messaging is disabled when no active common room

**Root Cause Identified**:
**Location**: `frontend/src/hooks/useGameTabs.ts` (lines 107-114)

The Messages tab visibility logic:
```typescript
// Messages - Only visible to:
// 1. GM (always)
// 2. Regular participants (players)
// 3. Audience members WITH assigned NPCs
const canSeeMessages = isGM || isParticipant || (isAudience && hasCharacters);
if (canSeeMessages) {
  tabList.push({ id: 'messages', label: 'Messages', icon: icons.messages });
}
```

**Problem**: Messages tab is shown **always** during `in_progress` state, regardless of current phase type. Players can create new conversations and send messages during action/results phases.

**IMPORTANT CLARIFICATION**:
- ✅ Players SHOULD be able to VIEW the Messages tab and READ message history at any time
- ❌ Players should NOT be able to CREATE new conversations or SEND messages outside common room
- Only the WRITE operations should be restricted to common room phases

**Fix Plan**:

**Frontend Changes** - Keep tab visible, disable creation/sending:

```typescript
// src/components/PrivateMessages.tsx
// Add phase check for "New Conversation" button
<Button
  variant="primary"
  size="sm"
  onClick={() => setShowNewConversationModal(true)}
  disabled={currentPhaseType !== 'common_room'}  // **NEW**: Disable outside common room
  title={currentPhaseType !== 'common_room' ? 'New conversations can only be started during Common Room' : ''}
>
  + New
</Button>

// src/components/MessageThread.tsx
// Add phase check for message send button
<button
  type="submit"
  disabled={isSubmitting || !message.trim() || currentPhaseType !== 'common_room'}  // **NEW**
  title={currentPhaseType !== 'common_room' ? 'Messages can only be sent during Common Room' : ''}
>
  Send
</button>

// Show info banner when not in common room
{currentPhaseType !== 'common_room' && (
  <Alert variant="info">
    You can read message history, but new messages can only be sent during Common Room phases.
  </Alert>
)}
```

**Backend Validation** (Defense in Depth):
```go
// backend/pkg/messages/api.go
func (h *Handler) CreateConversation(w http.ResponseWriter, r *http.Request) {
    // ... existing code ...

    // **NEW**: Check if there's an active common room phase
    currentPhase, err := h.phaseService.GetCurrentPhase(ctx, gameID)
    if err != nil {
        http.Error(w, "Failed to get current phase", http.StatusInternalServerError)
        return
    }

    if currentPhase == nil || currentPhase.PhaseType != "common_room" {
        http.Error(w, "Conversations can only be created during common room phases", http.StatusForbidden)
        return
    }

    // ... continue with conversation creation ...
}

func (h *Handler) SendMessage(w http.ResponseWriter, r *http.Request) {
    // ... existing code ...

    // **NEW**: Check if there's an active common room phase
    currentPhase, err := h.phaseService.GetCurrentPhase(ctx, gameID)
    if err != nil {
        http.Error(w, "Failed to get current phase", http.StatusInternalServerError)
        return
    }

    if currentPhase == nil || currentPhase.PhaseType != "common_room" {
        http.Error(w, "Messages can only be sent during common room phases", http.StatusForbidden)
        return
    }

    // ... continue with message creation ...
}
```

**Tests Required**:
- [ ] E2E test: Messages tab visible during action phase (can read)
- [ ] E2E test: "New Conversation" button disabled during action phase
- [ ] E2E test: Message send button disabled during action phase
- [ ] E2E test: Messages work normally during common room phase
- [ ] Backend test: Reject conversation creation outside common room
- [ ] Backend test: Reject message sending outside common room

**Notes**:
- Messages tab remains visible at all times (for reading history)
- Only WRITE operations (create conversation, send message) are restricted
- Backend validation prevents API abuse even if frontend is bypassed
- Consider showing phase-specific banner explaining restriction

---

## Issue #11: Can't View Previous Polls in History Tab

**Status**: 🔴 Not Started

**Description**:
- Users can't see expired or completed polls in the History tab
- Polls should be visible in phase history after they expire

**Investigation**:
- [ ] Check how polls are associated with phases
- [ ] Review History tab poll display logic
- [ ] Test with game that has expired polls
- [ ] Check if polls are stored with phase_id

**Fix Plan**:
- [ ] Ensure polls are associated with the phase they were created in
- [ ] Show polls in History tab for each phase
- [ ] Display poll results (readonly) in history
- [ ] Add "Expired on [date]" badge to historical polls
- [ ] Show vote results even if poll was set to hide results

**Tests Required**:
- [ ] Backend test for poll phase association
- [ ] E2E test: create poll, advance phase, check history
- [ ] Component test for historical poll display

**Notes**:
- History tab: `src/components/PhaseHistory.tsx`
- Polls: `backend/pkg/polls/` (check if phase_id is stored)
- May need database migration to add phase_id to polls table

---

## Priority Assessment

### 🔴 High Priority (User Experience Blockers) - ✅ ALL INVESTIGATED
1. **Issue #2**: Token expiration - users getting logged out unexpectedly ✅ READY TO IMPLEMENT
2. **Issue #5**: Dashboard unread counts - requires hard refresh ✅ READY TO IMPLEMENT
3. **Issue #10**: PM access control - breaks game flow design ✅ READY TO IMPLEMENT
4. **Issue #3**: Character creation for non-participants - security concern ✅ READY TO IMPLEMENT

### 🟡 Medium Priority (Functionality Issues)
5. **Issue #4**: Re-approve applicant + character spam (needs investigation)
6. **Issue #7**: Multiple character voting (needs investigation)
7. **Issue #11**: Historical polls not visible (needs investigation)
8. **Issue #9**: Load more for replies - performance (needs investigation)

### 🟢 Low Priority (Quality of Life)
9. **Issue #1**: Better error messages - UX improvement (needs investigation)
10. **Issue #6**: Reply button for non-participants - minor (needs investigation)
11. **Issue #8**: Deep nesting reply button - edge case (needs investigation)

---

## Next Steps

### ✅ Phase 1: Investigation Complete (4 High Priority Issues)
All high priority issues have been investigated and are ready for implementation.

### 🚀 Phase 2: Implementation (Recommended Order)

1. **Issue #3: Character Creation Visibility** (SIMPLEST - Start Here)
   - Single prop addition + validation check
   - Prevents security issue
   - Estimated: 30 minutes

2. **Issue #5: Dashboard Unread Counts** (MEDIUM)
   - Cache invalidation + refetch interval change
   - Immediate UX improvement
   - Estimated: 1 hour

3. **Issue #10: PM Access Control** (COMPLEX)
   - Frontend: Disable buttons + show info banner
   - Backend: Phase validation in 2 endpoints
   - Most code changes but well-defined scope
   - Estimated: 2 hours

4. **Issue #2: Token Expiration** (REQUIRES SETUP)
   - Need to install/configure toast library
   - Add event listener for cache clearing
   - More testing required
   - Estimated: 2-3 hours

### 📋 Implementation Checklist for Each Issue:
1. [ ] Create feature branch
2. [ ] Write tests first (TDD approach)
3. [ ] Implement frontend changes
4. [ ] Implement backend validation (if needed)
5. [ ] Run tests (unit + integration + E2E)
6. [ ] Manual testing in local environment
7. [ ] Update this tracking document with status
8. [ ] Create PR for review

---

## Notes

### Investigation Summary (2025-11-10)
- ✅ All 4 high priority issues investigated and documented with root causes
- ✅ Code locations identified for all issues
- ✅ Fix plans reviewed and approved
- ✅ Issue #10 requirements clarified: Messages tab stays visible, only WRITE operations restricted

### Key Findings:
- **Permission Logic**: Many issues (3 of 4) relate to missing permission checks
  - Character creation missing `isParticipant` check
  - Messages missing phase-type restriction for writes
- **Cache Invalidation**: Dashboard issue is classic React Query cache staleness
- **User Communication**: Token expiration needs better user-facing error messages

### Architectural Considerations:
- **Issue #2**: Toast library needed - recommend `sonner` (lightweight, modern)
- **Issue #10**: Consider creating ADR for messaging permissions and phase restrictions
- **Issue #5**: Monitor dashboard refetch performance after reducing interval to 15s
- **All Issues**: Follow defense-in-depth principle (frontend + backend validation)

### Testing Strategy:
- All high priority fixes require E2E tests
- Backend fixes need integration tests with phase mocking
- Component tests for permission logic changes
- Performance monitoring for dashboard query changes
