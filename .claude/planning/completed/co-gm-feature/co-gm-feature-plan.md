# Co-GM Feature Implementation Plan

**Last Updated: 2025-10-31**

## Executive Summary

Implement the ability for games to have a secondary co-GM (co-game master) with full GM permissions except the ability to promote other users to GM roles. This feature enables shared game management responsibilities while maintaining clear primary ownership.

**Key Points**:
- Database schema already supports `co_gm` role in `game_participants` table
- Frontend permissions system already recognizes co-GM role
- Primary work is adding promotion/demotion UI and backend endpoints
- Co-GM has full GM permissions except editing game settings and promoting others

**User Requirements (Confirmed)**:
- **Promotion UI**: Context menu/dropdown on participant cards
- **Visibility**: Co-GM displayed in game header alongside primary GM
- **GM Succession**: Game becomes orphaned if primary GM leaves (no auto-promotion)
- **Demotion**: Primary GM can demote co-GM to audience at any time

## Current State Analysis

### ✅ Already Implemented

**Database Schema** (`backend/pkg/db/migrations/20250805170112_add_game_system_tables.up.sql`):
- `game_participants` table has `role` column with CHECK constraint including `'co_gm'`
- Primary GM stored in `games.gm_user_id`
- Co-GM stored as participant with `role = 'co_gm'`

**Frontend Permissions** (`frontend/src/hooks/useGamePermissions.ts`):
```typescript
export type UserGameRole = 'gm' | 'player' | 'co_gm' | 'audience' | 'none';

// Permission flags
const isGM = userRole === 'gm';
const isCoGM = userRole === 'co_gm';
const canEditGame = isGM;                    // Primary GM only
const canManagePhases = isGM || isCoGM;      // Both can manage
const canViewAllActions = isGM || isCoGM;    // Both can view
```

**UI Components**:
- `PeopleView.tsx` already renders participants grouped by role (line 102)
- Shows "Co GMs" section when co_gm participants exist
- `RemovePlayerButton.tsx` pattern exists for GM actions on participants

### ❌ Missing Components

**Backend**:
- No API endpoints for promoting audience to co-GM
- No API endpoints for demoting co-GM to audience
- No permission checks preventing co-GM from promoting others
- No service methods for role transitions

**Frontend**:
- No context menu UI on participant cards
- No co-GM display in game header
- No API client methods for promote/demote
- No warning when primary GM tries to leave with co-GM present

**Testing**:
- No tests for co-GM role transitions
- No E2E tests for co-GM feature

## Proposed Future State

### User Flows

**Primary GM Promotes Audience Member**:
1. GM opens PeopleView → Participants tab
2. GM hovers over audience member card → sees three-dot menu
3. GM clicks menu → selects "Promote to Co-GM"
4. Confirmation modal appears: "Grant [username] co-GM permissions?"
5. GM confirms → API call → participant role updated to 'co_gm'
6. Co-GM appears in game header and "Co GMs" section
7. Co-GM can now manage phases, view all actions, create handouts

**Primary GM Demotes Co-GM**:
1. GM opens context menu on co-GM card
2. GM selects "Demote to Audience"
3. Confirmation modal: "Remove [username]'s co-GM permissions?"
4. GM confirms → participant role updated to 'audience'
5. Co-GM removed from game header and "Co GMs" section
6. User loses GM permissions, retains audience access

**Co-GM Attempts to Promote Others** (blocked):
1. Co-GM opens participant context menu
2. "Promote to Co-GM" option is hidden/disabled
3. If co-GM somehow calls API → returns 403 Forbidden

**Primary GM Leaves Game**:
1. Primary GM clicks "Leave Game" button
2. Warning modal: "You are the primary GM. If you leave, this game will become orphaned. Continue?"
3. GM confirms → removed from game
4. Co-GM remains but cannot perform GM-only actions (editing game settings, promoting)

### System Architecture

**Permission Hierarchy**:
```
Primary GM (gm_user_id)
├── Can edit game settings (title, description, recruitment, etc.)
├── Can promote audience to co-GM
├── Can demote co-GM to audience
├── Can manage phases
├── Can view all actions
└── Can remove participants

Co-GM (participant with role='co_gm')
├── CANNOT edit game settings
├── CANNOT promote anyone to co-GM
├── Can manage phases
├── Can view all actions
└── Can remove participants (except primary GM)

Audience (participant with role='audience')
└── Can view game, cannot perform GM actions
```

## Implementation Phases

### Phase 1: Backend API Endpoints
**Goal**: Create API endpoints for role transitions with proper permission checks

**Files to Modify**:
- `backend/pkg/games/api_participants.go` - Add handlers
- `backend/pkg/http/root.go` - Register routes
- `backend/pkg/db/services/games.go` - Add service methods
- `backend/pkg/core/interfaces.go` - Update interface if needed

**New Endpoints**:
```
POST /api/v1/games/:id/participants/:userId/promote-to-co-gm
POST /api/v1/games/:id/participants/:userId/demote-from-co-gm
```

**Service Methods**:
```go
// In GameService
PromoteToCoGM(ctx context.Context, gameID, userID, requestingUserID int32) error
DemoteFromCoGM(ctx context.Context, gameID, userID, requestingUserID int32) error
```

**Business Rules**:
1. Only primary GM (`game.gm_user_id`) can promote/demote
2. Can only promote audience members to co-GM
3. Can only demote co-GM to audience
4. Cannot have multiple co-GMs (enforce in service layer)
5. Log all role transitions for audit trail

### Phase 2: Frontend API Client & Hooks
**Goal**: Create React Query mutations for promote/demote actions

**Files to Create/Modify**:
- `frontend/src/lib/api.ts` - Add API methods
- `frontend/src/hooks/useCoGMManagement.ts` - Create custom hook

**API Client Methods**:
```typescript
// In apiClient.games
promoteToCoGM(gameId: number, userId: number): Promise<void>
demoteFromCoGM(gameId: number, userId: number): Promise<void>
```

**Hook Structure**:
```typescript
export function useCoGMManagement(gameId: number) {
  const promoteMutation = useMutation({
    mutationFn: (userId: number) => apiClient.games.promoteToCoGM(gameId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries(['gameParticipants', gameId]);
      queryClient.invalidateQueries(['gameDetails', gameId]);
    }
  });

  const demoteMutation = useMutation({
    mutationFn: (userId: number) => apiClient.games.demoteFromCoGM(gameId, userId),
    onSuccess: () => { /* same invalidations */ }
  });

  return { promoteMutation, demoteMutation };
}
```

### Phase 3: Context Menu UI Component
**Goal**: Add context menu to participant cards with role management options

**Files to Create**:
- `frontend/src/components/ParticipantContextMenu.tsx` - New component

**Files to Modify**:
- `frontend/src/components/PeopleView.tsx` - Integrate menu

**Component Structure**:
```tsx
interface ParticipantContextMenuProps {
  participant: GameParticipant;
  gameId: number;
  isGM: boolean;
  isCoGM: boolean;
  onPromoteToCoGM: (userId: number) => void;
  onDemoteFromCoGM: (userId: number) => void;
  onRemovePlayer: (userId: number) => void;
}

// Menu shows different options based on participant role:
// - Audience: "Promote to Co-GM" | "Remove from Game"
// - Co-GM: "Demote to Audience" | "Remove from Game"
// - Player: "Remove from Game"
```

**UI Behavior**:
- Three-dot icon appears on hover (only for primary GM)
- Click opens dropdown menu anchored to icon
- Confirmation modals for promote/demote actions
- Loading states during API calls
- Success toast on completion
- Error handling with user-friendly messages

### Phase 4: Co-GM Display in Game Header
**Goal**: Show co-GM information prominently in game UI

**Files to Modify**:
- `frontend/src/components/GameHeader.tsx` (or game detail component)
- `frontend/src/types/games.ts` - Add co-GM to types

**Display Logic**:
```tsx
// Fetch co-GM from participants where role === 'co_gm'
const coGM = participants.find(p => p.role === 'co_gm');

// In header:
<div className="game-leadership">
  <div>GM: {game.gm_username}</div>
  {coGM && <div>Co-GM: {coGM.username}</div>}
</div>
```

**Styling**:
- Use consistent badge/label styling
- Clear visual hierarchy (GM more prominent than co-GM)
- Responsive design for mobile

### Phase 5: Primary GM Leave Prevention/Warning
**Goal**: Warn users about consequences of primary GM leaving

**Files to Modify**:
- `frontend/src/components/PeopleView.tsx` - Add warning modal
- `backend/pkg/games/api_participants.go` - Add check in LeaveGame

**Frontend Logic**:
```tsx
const handleGMLeave = () => {
  if (isGM && hasCoGM) {
    showModal({
      title: "Leave Game as Primary GM?",
      message: "This game will become orphaned if you leave. The co-GM will remain but cannot perform primary GM functions. Continue?",
      confirmText: "Leave Anyway",
      variant: "danger"
    });
  } else {
    proceedWithLeave();
  }
};
```

**Backend Logic**:
- Allow primary GM to leave (no blocking)
- Log warning when GM leaves with co-GM present
- Game remains in current state (not auto-cancelled)

### Phase 6: Permission Guard Updates
**Goal**: Ensure co-GM cannot bypass primary-GM-only restrictions

**Files to Audit**:
- All game editing endpoints (update title, description, settings, etc.)
- Game state transition endpoints
- Application approval endpoints
- Any endpoint that should be primary-GM-only

**Pattern**:
```go
// Verify requesting user is the PRIMARY GM, not co-GM
if game.GmUserID != requestingUserID {
    return core.ErrForbidden("only the primary GM can perform this action")
}
```

**Endpoints to Check**:
- `UpdateGame` - Edit game details
- `PromoteToCoGM` - Promote others
- `DemoteFromCoGM` - Demote co-GM
- Game state transitions (if primary-GM-only)

### Phase 7: Testing
**Goal**: Comprehensive test coverage for co-GM feature

**Backend Tests**:
```go
// backend/pkg/games/api_participants_test.go
TestPromoteToCoGM_Success
TestPromoteToCoGM_NonGMAttempt
TestPromoteToCoGM_PromotePlayer (should fail)
TestPromoteToCoGM_PromoteNonExistent
TestDemoteFromCoGM_Success
TestDemoteFromCoGM_DemoteAudience (should fail)
TestCoGMCannotPromoteOthers
```

**Frontend Tests**:
```typescript
// ParticipantContextMenu.test.tsx
test('shows promote option for audience members (GM only)')
test('shows demote option for co-GM (GM only)')
test('hides promote option from co-GM')
test('calls promote mutation on confirm')
test('shows loading state during API call')
```

**E2E Tests**:
```typescript
// e2e/co-gm/promote-demote.spec.ts
test('GM promotes audience member to co-GM')
test('Co-GM sees game header with their role')
test('Co-GM can manage phases')
test('Co-GM cannot see promote option')
test('GM demotes co-GM back to audience')
test('Primary GM leaving shows warning modal')
```

## Detailed Task List

### Phase 1 Tasks (Backend API)

**1.1 Create Database Query Functions** [M]
- File: `backend/pkg/db/queries/games.sql`
- Add UPDATE query to change participant role
- Add SELECT query to get participant by game_id and user_id
- **Acceptance**: Queries successfully update role field

**1.2 Implement Service Methods** [L]
- File: `backend/pkg/db/services/games.go`
- Implement `PromoteToCoGM(ctx, gameID, userID, requestingUserID)`
  - Verify requester is primary GM
  - Verify target is audience member
  - Verify no existing co-GM
  - Update participant role to 'co_gm'
- Implement `DemoteFromCoGM(ctx, gameID, userID, requestingUserID)`
  - Verify requester is primary GM
  - Verify target is co-GM
  - Update participant role to 'audience'
- **Acceptance**: Methods successfully transition roles with proper validation

**1.3 Create API Handlers** [M]
- File: `backend/pkg/games/api_participants.go`
- Add `PromoteToCoGM` handler
- Add `DemoteFromCoGM` handler
- Extract user ID from JWT
- Call service methods
- Return appropriate HTTP status codes
- **Acceptance**: Handlers successfully process requests

**1.4 Register Routes** [S]
- File: `backend/pkg/http/root.go`
- Add POST route for promote endpoint
- Add POST route for demote endpoint
- Require authentication middleware
- **Acceptance**: Routes accessible and return 401 when unauthenticated

**1.5 Write Backend Unit Tests** [L]
- File: `backend/pkg/games/api_participants_test.go`
- Test successful promotion
- Test non-GM attempt (should return 403)
- Test promoting non-audience (should fail)
- Test demoting non-co-GM (should fail)
- Test duplicate co-GM prevention
- **Acceptance**: All tests pass, >80% coverage

### Phase 2 Tasks (Frontend API Client)

**2.1 Add API Client Methods** [S]
- File: `frontend/src/lib/api.ts`
- Add `promoteToCoGM(gameId, userId)` method
- Add `demoteFromCoGM(gameId, userId)` method
- Use proper HTTP methods and endpoints
- **Acceptance**: Methods make correct API calls

**2.2 Create Custom Hook** [M]
- File: `frontend/src/hooks/useCoGMManagement.ts`
- Create `useCoGMManagement(gameId)` hook
- Export promote and demote mutations
- Invalidate queries on success
- Show toast notifications
- **Acceptance**: Hook successfully manages mutations

**2.3 Write Hook Tests** [M]
- File: `frontend/src/hooks/useCoGMManagement.test.ts`
- Test promote mutation calls API correctly
- Test demote mutation calls API correctly
- Test query invalidation on success
- Test error handling
- **Acceptance**: All hook tests pass

### Phase 3 Tasks (Context Menu UI)

**3.1 Create Context Menu Component** [L]
- File: `frontend/src/components/ParticipantContextMenu.tsx`
- Build dropdown menu with Headless UI or Radix
- Show different options based on participant role
- Add confirmation modals for promote/demote
- Handle loading and error states
- **Acceptance**: Component renders and handles all interactions

**3.2 Integrate Menu into PeopleView** [M]
- File: `frontend/src/components/PeopleView.tsx`
- Add three-dot icon to participant cards (GM only)
- Wire up useCoGMManagement hook
- Pass callbacks to context menu
- **Acceptance**: Menu appears on participant cards, actions work

**3.3 Add Confirmation Modals** [M]
- Use existing modal pattern or create reusable component
- "Promote [username] to Co-GM?" with explanation
- "Demote [username] from Co-GM?" with explanation
- **Acceptance**: Modals appear and prevent accidental actions

**3.4 Write Component Tests** [L]
- File: `frontend/src/components/ParticipantContextMenu.test.tsx`
- Test menu shows correct options for each role
- Test menu hidden for non-GMs
- Test promote action triggers mutation
- Test demote action triggers mutation
- **Acceptance**: All component tests pass

### Phase 4 Tasks (Game Header Display)

**4.1 Add Co-GM Field to Types** [S]
- File: `frontend/src/types/games.ts`
- Add optional `co_gm_username` to GameWithDetails type
- **Acceptance**: TypeScript compilation succeeds

**4.2 Update Game Header Component** [M]
- File: `frontend/src/components/GameHeader.tsx`
- Extract co-GM from participants list
- Display "Co-GM: [username]" when present
- Style consistently with GM display
- **Acceptance**: Co-GM visible in header when role exists

**4.3 Add Responsive Styling** [S]
- Ensure header looks good on mobile
- Stack GM/Co-GM vertically on small screens
- **Acceptance**: Header responsive on all screen sizes

### Phase 5 Tasks (GM Leave Warning)

**5.1 Add Frontend Warning Modal** [M]
- File: `frontend/src/components/PeopleView.tsx`
- Detect if user is primary GM and co-GM exists
- Show warning modal before leave
- Allow user to proceed or cancel
- **Acceptance**: Warning appears when conditions met

**5.2 Add Backend Logging** [S]
- File: `backend/pkg/games/api_participants.go`
- Log warning when primary GM leaves with co-GM present
- Include game_id, user_id, co-GM info
- **Acceptance**: Logs appear in observability system

### Phase 6 Tasks (Permission Guards)

**6.1 Audit Game Editing Endpoints** [M]
- File: `backend/pkg/games/api_crud.go`
- Review UpdateGame handler
- Ensure checks `game.gm_user_id == requestingUserID`
- **Acceptance**: Co-GM cannot edit game settings

**6.2 Audit Promotion Endpoints** [S]
- File: `backend/pkg/games/api_participants.go`
- Ensure PromoteToCoGM checks primary GM
- Ensure DemoteFromCoGM checks primary GM
- **Acceptance**: Co-GM cannot promote/demote others

**6.3 Test Permission Boundaries** [M]
- Write integration tests for each guarded endpoint
- Test co-GM attempts to bypass restrictions
- Verify proper 403 Forbidden responses
- **Acceptance**: All permission guards working

### Phase 7 Tasks (Testing)

**7.1 Write Backend Integration Tests** [L]
- File: `backend/pkg/games/api_participants_test.go`
- Test full promote flow with API calls
- Test full demote flow with API calls
- Test edge cases and error conditions
- **Acceptance**: All backend tests pass

**7.2 Write Frontend Component Tests** [L]
- Test ParticipantContextMenu rendering
- Test useCoGMManagement hook behavior
- Test game header co-GM display
- **Acceptance**: All frontend tests pass

**7.3 Write E2E Tests** [XL]
- File: `frontend/e2e/co-gm/promote-demote.spec.ts`
- Test GM promotes audience to co-GM
- Test co-GM can manage phases
- Test co-GM cannot promote others
- Test GM demotes co-GM to audience
- Test GM leave warning
- **Acceptance**: All E2E tests pass reliably

**7.4 Manual QA** [M]
- Test full feature in development environment
- Verify UI/UX meets expectations
- Check for edge cases
- **Acceptance**: Feature works smoothly in manual testing

## Risk Assessment and Mitigation

### High Risks

**Risk: Co-GM bypasses primary-GM-only restrictions**
- **Impact**: Security vulnerability, unauthorized game modifications
- **Likelihood**: Medium
- **Mitigation**:
  - Comprehensive audit of all GM-gated endpoints (Phase 6)
  - Automated permission boundary tests
  - Code review checklist item

**Risk: Multiple co-GMs created accidentally**
- **Impact**: Confusing game state, unclear permissions
- **Likelihood**: Low
- **Mitigation**:
  - Service layer validates only one co-GM allowed
  - Database unique constraint not feasible (other roles need multiple)
  - Clear error message on attempt

### Medium Risks

**Risk: Primary GM leaves, game becomes unusable**
- **Impact**: Co-GM frustrated they can't perform key actions
- **Likelihood**: Medium
- **Mitigation**:
  - Clear warning modal explaining consequences
  - Future: Admin tool to transfer primary GM ownership
  - Documentation for users

**Risk: Context menu UX confusing**
- **Impact**: Users don't discover feature, poor adoption
- **Likelihood**: Medium
- **Mitigation**:
  - User testing before final implementation
  - Tooltip on first hover
  - In-app documentation/help text

### Low Risks

**Risk: Performance impact from additional queries**
- **Impact**: Slower page loads on PeopleView
- **Likelihood**: Low
- **Mitigation**:
  - Co-GM info already fetched with participants
  - No additional database queries needed
  - Existing indexes support queries

**Risk: Breaking changes to existing GM features**
- **Impact**: Regression in existing functionality
- **Likelihood**: Low
- **Mitigation**:
  - Comprehensive test suite
  - Backward compatibility maintained
  - No database schema changes needed

## Success Metrics

### Functional Metrics
- [ ] Co-GM can manage phases (verified in E2E test)
- [ ] Co-GM can view all action submissions (verified in E2E test)
- [ ] Co-GM cannot edit game settings (verified with 403 response)
- [ ] Co-GM cannot promote others (verified UI hidden + API blocked)
- [ ] Primary GM can promote audience to co-GM (successful API call)
- [ ] Primary GM can demote co-GM to audience (successful API call)
- [ ] Co-GM visible in game header when role exists

### Quality Metrics
- [ ] Backend test coverage >80% for new code
- [ ] Frontend test coverage >70% for new components
- [ ] All E2E tests pass reliably (3 consecutive runs)
- [ ] No regressions in existing GM features
- [ ] Code review approved by 1+ team member

### User Experience Metrics
- [ ] Context menu discoverable (tooltip/help text)
- [ ] Confirmation modals prevent accidental actions
- [ ] Clear error messages for failed operations
- [ ] Loading states prevent double-clicks
- [ ] Mobile-responsive UI

## Required Resources and Dependencies

### Development Resources
- **Backend Engineer**: ~6-8 hours for API implementation and tests
- **Frontend Engineer**: ~8-10 hours for UI components and tests
- **QA Engineer**: ~3-4 hours for E2E tests and manual testing
- **Designer**: ~1-2 hours for UX review of context menu (optional)

### Technical Dependencies
- **Database**: PostgreSQL with existing schema (no migrations needed)
- **Backend**: Go, Chi router, sqlc
- **Frontend**: React, TypeScript, React Query, Tailwind CSS
- **Testing**: Vitest (unit), Playwright (E2E)

### External Dependencies
- None (feature self-contained within existing system)

### Blocking Dependencies
- None (can start immediately)

## Timeline Estimates

### Conservative Estimate (with buffer)
- **Phase 1 (Backend API)**: 2-3 days
- **Phase 2 (API Client)**: 0.5 day
- **Phase 3 (Context Menu UI)**: 2-3 days
- **Phase 4 (Header Display)**: 0.5-1 day
- **Phase 5 (Leave Warning)**: 0.5-1 day
- **Phase 6 (Permission Guards)**: 1-2 days
- **Phase 7 (Testing)**: 2-3 days

**Total: 9-14 days** (assuming 1 developer working part-time)

### Aggressive Estimate (ideal conditions)
- **Phase 1**: 1 day
- **Phase 2**: 0.5 day
- **Phase 3**: 1.5 days
- **Phase 4**: 0.5 day
- **Phase 5**: 0.5 day
- **Phase 6**: 1 day
- **Phase 7**: 1.5 days

**Total: 6.5 days** (assuming 1 developer focused full-time)

## Rollout Strategy

### Stage 1: Backend Deployment (Day 1-3)
- Deploy backend API endpoints to staging
- Test with curl/Postman
- Verify permission checks working
- **Success Criteria**: API endpoints functional and secure

### Stage 2: Frontend Development (Day 4-7)
- Build and test UI components locally
- Integration testing with staging backend
- **Success Criteria**: UI functional in dev environment

### Stage 3: E2E Testing (Day 8-10)
- Run full E2E test suite
- Manual QA on staging
- Fix any discovered issues
- **Success Criteria**: All tests passing, no major bugs

### Stage 4: Production Deployment (Day 11)
- Deploy to production during low-traffic window
- Monitor error logs and metrics
- **Success Criteria**: No errors, feature working as expected

### Stage 5: Monitoring (Day 12-14)
- Watch for usage patterns
- Collect user feedback
- Monitor error rates
- **Success Criteria**: Stable feature, positive feedback

## Post-Launch Considerations

### Future Enhancements
- **Multiple co-GMs**: Allow more than one co-GM per game
- **Co-GM promotion by primary GM leaving**: Auto-promote instead of orphaning
- **Fine-grained permissions**: Allow primary GM to customize co-GM permissions
- **Admin GM transfer tool**: Allow admins to transfer primary GM ownership

### Documentation Needs
- **User Guide**: How to use co-GM feature
- **API Documentation**: New endpoints for developers
- **Admin Guide**: Handling orphaned games

### Monitoring and Observability
- **Metrics to Track**:
  - Number of co-GM promotions per week
  - Number of co-GM demotions per week
  - Co-GM adoption rate (% of games with co-GM)
  - Primary GM leave rate with co-GM present
  - Failed permission checks (co-GM attempting restricted actions)

### Support Readiness
- **Common Issues**:
  - "How do I make someone a co-GM?"
  - "Why can't the co-GM edit game settings?"
  - "What happens if the GM leaves?"
- **Escalation Path**: Document for support team

---

**Plan Status**: ✅ Ready for Implementation
**Next Step**: Begin Phase 1 (Backend API Endpoints)
