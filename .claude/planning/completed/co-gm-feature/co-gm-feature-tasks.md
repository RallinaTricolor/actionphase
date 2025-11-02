# Co-GM Feature - Task Checklist

**Last Updated: 2025-10-31**

This checklist tracks implementation progress for the co-GM feature. Mark tasks complete as you finish them.

## Phase 1: Backend API Endpoints

### 1.1 Database Query Functions [M]
- [ ] Add UPDATE query to change participant role in `backend/pkg/db/queries/games.sql`
- [ ] Add SELECT query to get participant by game_id and user_id
- [ ] Run `just sqlgen` to generate Go code
- [ ] Verify queries compile without errors

**Acceptance**: Queries successfully update role field

### 1.2 Service Methods [L]
- [ ] Open `backend/pkg/db/services/games.go`
- [ ] Implement `PromoteToCoGM(ctx, gameID, userID, requestingUserID)` method
  - [ ] Verify requester is primary GM (`game.gm_user_id == requestingUserID`)
  - [ ] Verify target user exists in game_participants
  - [ ] Verify target user role is 'audience'
  - [ ] Check no existing co-GM in game (prevent multiple)
  - [ ] Update participant role to 'co_gm'
  - [ ] Log promotion action
- [ ] Implement `DemoteFromCoGM(ctx, gameID, userID, requestingUserID)` method
  - [ ] Verify requester is primary GM
  - [ ] Verify target user exists in game_participants
  - [ ] Verify target user role is 'co_gm'
  - [ ] Update participant role to 'audience'
  - [ ] Log demotion action
- [ ] Add error handling for all edge cases

**Acceptance**: Methods successfully transition roles with proper validation

### 1.3 API Handlers [M]
- [ ] Open `backend/pkg/games/api_participants.go`
- [ ] Add `PromoteToCoGM` handler function
  - [ ] Parse game ID and user ID from URL params
  - [ ] Extract requesting user ID from JWT using `core.GetUserIDFromJWT`
  - [ ] Call `gameService.PromoteToCoGM`
  - [ ] Return 204 No Content on success
  - [ ] Return appropriate error responses (400, 403, 500)
- [ ] Add `DemoteFromCoGM` handler function
  - [ ] Parse game ID and user ID from URL params
  - [ ] Extract requesting user ID from JWT
  - [ ] Call `gameService.DemoteFromCoGM`
  - [ ] Return 204 No Content on success
  - [ ] Return appropriate error responses

**Acceptance**: Handlers successfully process requests with proper HTTP codes

### 1.4 Register Routes [S]
- [ ] Open `backend/pkg/http/root.go`
- [ ] Add route: `POST /api/v1/games/{id}/participants/{userId}/promote-to-co-gm`
- [ ] Add route: `POST /api/v1/games/{id}/participants/{userId}/demote-from-co-gm`
- [ ] Ensure routes require authentication middleware
- [ ] Verify routes registered correctly (check startup logs)

**Acceptance**: Routes accessible and return 401 when unauthenticated

### 1.5 Backend Unit Tests [L]
- [ ] Create/update `backend/pkg/games/api_participants_test.go`
- [ ] Test: Successful promotion (GM promotes audience member)
- [ ] Test: Non-GM attempt returns 403 Forbidden
- [ ] Test: Promoting non-audience member returns 400 Bad Request
- [ ] Test: Promoting when co-GM already exists returns 400
- [ ] Test: Successful demotion (GM demotes co-GM)
- [ ] Test: Demoting non-co-GM returns 400
- [ ] Test: Non-existent user returns 404
- [ ] Run tests: `just test`
- [ ] Verify >80% code coverage for new code

**Acceptance**: All tests pass, coverage meets threshold

### 1.6 Manual API Testing [S]
- [ ] Start backend: `just dev`
- [ ] Login as GM: `./backend/scripts/api-test.sh login-gm`
- [ ] Test promote endpoint with curl:
```bash
curl -X POST \
  -H "Authorization: Bearer $(cat /tmp/api-token.txt)" \
  http://localhost:3000/api/v1/games/2/participants/3/promote-to-co-gm
```
- [ ] Verify 204 response
- [ ] Check database: `SELECT * FROM game_participants WHERE role = 'co_gm';`
- [ ] Test demote endpoint with curl
- [ ] Verify participant role changed back to 'audience'

**Acceptance**: API endpoints work correctly via curl

---

## Phase 2: Frontend API Client & Hooks

### 2.1 API Client Methods [S]
- [ ] Open `frontend/src/lib/api.ts`
- [ ] Add `promoteToCoGM(gameId: number, userId: number)` method
  - [ ] Use POST request
  - [ ] Include authorization header
  - [ ] Endpoint: `/api/v1/games/${gameId}/participants/${userId}/promote-to-co-gm`
- [ ] Add `demoteFromCoGM(gameId: number, userId: number)` method
  - [ ] Use POST request
  - [ ] Endpoint: `/api/v1/games/${gameId}/participants/${userId}/demote-from-co-gm`

**Acceptance**: Methods make correct API calls

### 2.2 Custom Hook [M]
- [ ] Create `frontend/src/hooks/useCoGMManagement.ts`
- [ ] Import `useMutation` and `useQueryClient` from React Query
- [ ] Create `useCoGMManagement(gameId)` hook
- [ ] Implement `promoteMutation`:
  - [ ] Call `apiClient.games.promoteToCoGM`
  - [ ] Invalidate `gameParticipants` query on success
  - [ ] Invalidate `gameDetails` query on success
  - [ ] Show success toast
- [ ] Implement `demoteMutation`:
  - [ ] Call `apiClient.games.demoteFromCoGM`
  - [ ] Invalidate queries on success
  - [ ] Show success toast
- [ ] Export both mutations from hook

**Acceptance**: Hook successfully manages mutations with query invalidation

### 2.3 Hook Tests [M]
- [ ] Create `frontend/src/hooks/useCoGMManagement.test.ts`
- [ ] Test: Promote mutation calls API with correct parameters
- [ ] Test: Demote mutation calls API with correct parameters
- [ ] Test: Success invalidates participant queries
- [ ] Test: Success invalidates game details queries
- [ ] Test: Error shows error toast
- [ ] Run tests: `just test-frontend`

**Acceptance**: All hook tests pass

---

## Phase 3: Context Menu UI Component

### 3.1 Create Context Menu Component [L]
- [ ] Create `frontend/src/components/ParticipantContextMenu.tsx`
- [ ] Import dropdown component (Headless UI Menu or similar)
- [ ] Define props interface:
  - `participant: GameParticipant`
  - `gameId: number`
  - `isGM: boolean`
  - `isCoGM: boolean`
  - `onPromoteToCoGM: (userId: number) => void`
  - `onDemoteFromCoGM: (userId: number) => void`
  - `onRemovePlayer: (userId: number) => void`
- [ ] Implement dropdown trigger (three-dot icon)
- [ ] Show menu options based on participant role:
  - [ ] Audience: "Promote to Co-GM" | "Remove from Game"
  - [ ] Co-GM: "Demote to Audience" | "Remove from Game"
  - [ ] Player: "Remove from Game" only
- [ ] Add loading states during mutations
- [ ] Style with Tailwind CSS

**Acceptance**: Component renders and shows appropriate options

### 3.2 Add Confirmation Modals [M]
- [ ] Create promote confirmation modal
  - [ ] Title: "Promote to Co-GM?"
  - [ ] Message: "Grant [username] co-GM permissions? They will be able to manage phases and view all actions."
  - [ ] Confirm button: "Promote"
  - [ ] Cancel button: "Cancel"
- [ ] Create demote confirmation modal
  - [ ] Title: "Demote from Co-GM?"
  - [ ] Message: "Remove [username]'s co-GM permissions? They will return to audience role."
  - [ ] Confirm button: "Demote"
  - [ ] Cancel button: "Cancel"
- [ ] Wire up modals to mutation callbacks

**Acceptance**: Modals appear and prevent accidental actions

### 3.3 Integrate Menu into PeopleView [M]
- [ ] Open `frontend/src/components/PeopleView.tsx`
- [ ] Import `ParticipantContextMenu` component
- [ ] Import `useCoGMManagement` hook
- [ ] Call hook: `const { promoteMutation, demoteMutation } = useCoGMManagement(gameId);`
- [ ] Add ParticipantContextMenu to participant card (lines 116-146)
- [ ] Show menu only when `isGM === true`
- [ ] Pass callbacks to menu component
- [ ] Test in browser: hover over participant card, see three-dot menu

**Acceptance**: Menu appears on participant cards, actions work

### 3.4 Component Tests [L]
- [ ] Create `frontend/src/components/ParticipantContextMenu.test.tsx`
- [ ] Test: Menu shows "Promote to Co-GM" for audience members
- [ ] Test: Menu shows "Demote to Audience" for co-GM
- [ ] Test: Menu shows "Remove from Game" for all roles
- [ ] Test: Menu hidden when `isGM === false`
- [ ] Test: Clicking "Promote" opens confirmation modal
- [ ] Test: Confirming promotion calls mutation
- [ ] Test: Clicking "Demote" opens confirmation modal
- [ ] Test: Confirming demotion calls mutation
- [ ] Run tests: `just test-frontend`

**Acceptance**: All component tests pass

---

## Phase 4: Co-GM Display in Game Header

### 4.1 Add Co-GM Field to Types [S]
- [ ] Open `frontend/src/types/games.ts`
- [ ] Add optional `co_gm_username?: string` to `GameWithDetails` type
- [ ] Run type check: `just test-frontend` (or `npx tsc --noEmit`)

**Acceptance**: TypeScript compilation succeeds

### 4.2 Update Game Header Component [M]
- [ ] Locate game header component (check `GameHeader.tsx` or equivalent)
- [ ] Extract co-GM from participants list:
```typescript
const coGM = participants.find(p => p.role === 'co_gm');
```
- [ ] Display co-GM in header:
```tsx
<div className="game-leadership">
  <div>GM: {game.gm_username}</div>
  {coGM && <div>Co-GM: {coGM.username}</div>}
</div>
```
- [ ] Style consistently with existing GM display
- [ ] Test in browser: promote user to co-GM, verify appears in header

**Acceptance**: Co-GM visible in header when role exists

### 4.3 Responsive Styling [S]
- [ ] Test header on mobile (Chrome DevTools mobile view)
- [ ] Ensure GM/Co-GM stack vertically on small screens
- [ ] Verify text doesn't overflow
- [ ] Add Tailwind responsive classes if needed

**Acceptance**: Header looks good on all screen sizes

---

## Phase 5: Primary GM Leave Warning

### 5.1 Add Frontend Warning Modal [M]
- [ ] Open `frontend/src/components/PeopleView.tsx`
- [ ] Find leave game logic (around lines 127-137)
- [ ] Add check for co-GM existence:
```typescript
const hasCoGM = participants.some(p => p.role === 'co_gm');
```
- [ ] Create warning modal component or use existing modal pattern
- [ ] Show modal when `isGM && hasCoGM`
- [ ] Modal content:
  - [ ] Title: "Leave Game as Primary GM?"
  - [ ] Message: "This game will become orphaned if you leave. The co-GM will remain but cannot perform primary GM functions (editing game settings, promoting others). Continue?"
  - [ ] Confirm button: "Leave Anyway" (danger variant)
  - [ ] Cancel button: "Cancel"
- [ ] Only proceed with leave if user confirms

**Acceptance**: Warning appears when primary GM tries to leave with co-GM

### 5.2 Add Backend Logging [S]
- [ ] Open `backend/pkg/games/api_participants.go`
- [ ] Find `LeaveGame` handler (lines 16-71)
- [ ] Add check for co-GM existence before removing GM
- [ ] Log warning if primary GM leaves with co-GM present:
```go
h.App.Logger.Warn("Primary GM leaving game with co-GM present",
    "game_id", gameID,
    "gm_user_id", userID,
    "co_gm_exists", true)
```
- [ ] Allow leave to proceed (no blocking)

**Acceptance**: Warning logged to observability system

---

## Phase 6: Permission Guard Audit

### 6.1 Audit Game Editing Endpoints [M]
- [ ] Open `backend/pkg/games/api_crud.go`
- [ ] Review `UpdateGame` handler
- [ ] Verify permission check: `if game.GmUserID != requestingUserID { return 403 }`
- [ ] Test: co-GM attempts to edit game title
- [ ] Expected: 403 Forbidden response

**Acceptance**: Co-GM cannot edit game settings

### 6.2 Audit Promotion Endpoints [S]
- [ ] Open `backend/pkg/games/api_participants.go`
- [ ] Review `PromoteToCoGM` handler
- [ ] Verify check: only primary GM can promote
- [ ] Review `DemoteFromCoGM` handler
- [ ] Verify check: only primary GM can demote
- [ ] Test: co-GM attempts to promote audience member
- [ ] Expected: 403 Forbidden response

**Acceptance**: Co-GM cannot promote/demote others

### 6.3 Permission Boundary Integration Tests [M]
- [ ] Create test file or add to existing: `backend/pkg/games/permissions_test.go`
- [ ] Test: Co-GM attempts `UpdateGame` → 403
- [ ] Test: Co-GM attempts `PromoteToCoGM` → 403
- [ ] Test: Co-GM attempts `DemoteFromCoGM` → 403
- [ ] Test: Co-GM CAN manage phases → 200
- [ ] Test: Co-GM CAN view all actions → 200
- [ ] Run tests: `just test`

**Acceptance**: All permission guard tests pass

---

## Phase 7: Comprehensive Testing

### 7.1 Backend Integration Tests [L]
- [ ] Open/create `backend/pkg/games/api_participants_test.go`
- [ ] Test full promote flow:
  - [ ] Setup: Create game with GM and audience member
  - [ ] Action: GM calls promote endpoint
  - [ ] Verify: Participant role updated to 'co_gm'
  - [ ] Verify: HTTP 204 response
- [ ] Test full demote flow:
  - [ ] Setup: Promote user to co-GM first
  - [ ] Action: GM calls demote endpoint
  - [ ] Verify: Participant role updated to 'audience'
  - [ ] Verify: HTTP 204 response
- [ ] Test edge cases (see Phase 1.5 checklist)
- [ ] Run all tests: `just test`

**Acceptance**: All backend integration tests pass

### 7.2 Frontend Component Tests [L]
- [ ] Verify all component tests from Phase 3.4 are passing
- [ ] Add integration test for PeopleView with context menu
- [ ] Test game header shows co-GM after promotion
- [ ] Test leave warning appears for primary GM
- [ ] Run all tests: `just test-frontend`

**Acceptance**: All frontend tests pass with >70% coverage

### 7.3 E2E Tests [XL]
- [ ] Create `frontend/e2e/co-gm/promote-demote.spec.ts`
- [ ] Test: GM promotes audience member to co-GM
  - [ ] Login as GM (test_gm@example.com)
  - [ ] Navigate to game page
  - [ ] Open People tab
  - [ ] Click context menu on audience member
  - [ ] Click "Promote to Co-GM"
  - [ ] Confirm in modal
  - [ ] Verify co-GM appears in game header
  - [ ] Verify participant moved to "Co GMs" section
- [ ] Test: Co-GM can manage phases
  - [ ] Logout, login as co-GM
  - [ ] Navigate to game page
  - [ ] Click "Phases" tab
  - [ ] Verify "Advance Phase" button visible
  - [ ] Click "Advance Phase"
  - [ ] Verify phase advanced successfully
- [ ] Test: Co-GM can view all actions
  - [ ] Navigate to Actions tab
  - [ ] Verify all player actions visible
- [ ] Test: Co-GM cannot see promote option
  - [ ] Open People tab
  - [ ] Click context menu on audience member
  - [ ] Verify "Promote to Co-GM" option NOT present
- [ ] Test: GM demotes co-GM to audience
  - [ ] Logout, login as primary GM
  - [ ] Navigate to People tab
  - [ ] Click context menu on co-GM
  - [ ] Click "Demote to Audience"
  - [ ] Confirm in modal
  - [ ] Verify co-GM removed from header
  - [ ] Verify participant moved to "Audience" section
- [ ] Test: Primary GM leave warning
  - [ ] Promote user to co-GM again
  - [ ] Click "Leave Game" button
  - [ ] Verify warning modal appears
  - [ ] Click "Cancel"
  - [ ] Verify still in game
- [ ] Run E2E tests: `npx playwright test e2e/co-gm/`
- [ ] Verify tests pass 3 consecutive times

**Acceptance**: All E2E tests pass reliably

### 7.4 Manual QA Checklist [M]
- [ ] Start full stack: `just dev` (backend) + `just run-frontend`
- [ ] Login as test GM
- [ ] Navigate to test game (Game #2)
- [ ] **Test Promote Flow**:
  - [ ] Open People tab → Participants sub-tab
  - [ ] Find audience member
  - [ ] Hover over card → three-dot menu appears
  - [ ] Click menu → "Promote to Co-GM" option visible
  - [ ] Click "Promote to Co-GM" → confirmation modal appears
  - [ ] Click "Confirm" → success toast appears
  - [ ] Co-GM appears in game header
  - [ ] Participant moved to "Co GMs" section
- [ ] **Test Co-GM Permissions**:
  - [ ] Logout, login as co-GM user
  - [ ] Navigate to same game
  - [ ] Verify co-GM can access Phases tab
  - [ ] Verify co-GM can access Actions tab (see all submissions)
  - [ ] Verify co-GM CANNOT access game settings
  - [ ] Open People tab → context menu on audience member
  - [ ] Verify "Promote to Co-GM" option NOT visible
- [ ] **Test Demote Flow**:
  - [ ] Logout, login as primary GM
  - [ ] Open People tab
  - [ ] Click context menu on co-GM
  - [ ] Click "Demote to Audience" → confirmation modal
  - [ ] Confirm → co-GM removed from header
  - [ ] Participant moved to "Audience" section
- [ ] **Test Leave Warning**:
  - [ ] Promote user to co-GM again
  - [ ] Click "Leave Game" → warning modal appears
  - [ ] Warning mentions "game will become orphaned"
  - [ ] Cancel → remain in game
  - [ ] Click "Leave Game" again → confirm → successfully leave
- [ ] **Mobile Testing**:
  - [ ] Open Chrome DevTools → mobile view
  - [ ] Test all flows on mobile viewport
  - [ ] Verify context menu works on touch
  - [ ] Verify modals display correctly
- [ ] **Edge Cases**:
  - [ ] Try promoting player (not audience) → should fail gracefully
  - [ ] Try promoting when co-GM already exists → error message
  - [ ] Try demoting audience member (not co-GM) → error message

**Acceptance**: All manual tests pass, UX feels smooth

---

## Deployment Checklist

### Pre-Deployment
- [ ] All tests passing (backend + frontend + E2E)
- [ ] Code review completed
- [ ] Feature branch merged to main
- [ ] CHANGELOG.md updated with feature description

### Deployment
- [ ] Deploy backend to staging
- [ ] Test promote/demote with curl in staging
- [ ] Deploy frontend to staging
- [ ] Manual QA in staging environment
- [ ] Deploy to production (during low-traffic window)
- [ ] Verify no errors in production logs
- [ ] Test feature in production

### Post-Deployment
- [ ] Monitor error rates for 24 hours
- [ ] Check for unexpected 403/400 responses
- [ ] Watch for user feedback
- [ ] Document any issues found
- [ ] Create follow-up tickets for enhancements

---

## Success Criteria Summary

**Must Have** (blocking deployment):
- ✅ Primary GM can promote audience to co-GM
- ✅ Primary GM can demote co-GM to audience
- ✅ Co-GM can manage phases
- ✅ Co-GM can view all actions
- ✅ Co-GM cannot edit game settings
- ✅ Co-GM cannot promote others
- ✅ Co-GM visible in game header
- ✅ All tests passing (>80% backend, >70% frontend)

**Should Have** (nice to have, can be follow-up):
- ✅ Leave warning for primary GM
- ✅ Mobile-responsive context menu
- ✅ Accessible (screen reader support)

**Could Have** (future enhancements):
- Multiple co-GMs support
- Fine-grained co-GM permissions
- Auto-promote co-GM when GM leaves
- Admin tool to transfer primary GM ownership

---

**Last Updated**: 2025-10-31
**Status**: Ready for implementation
**Estimated Completion**: 6.5-14 days
