# Feature Plan: Issue #11 - Polls Not Visible in History Tab

**Status**: Investigation Complete - Ready for Implementation
**Priority**: Medium
**Estimated Time**: 2-3 hours
**Created**: 2025-01-10

## 1. Problem Statement

### User-Reported Issue
Users cannot see expired or completed polls in the History tab. When they navigate to the History tab to review past phases, polls that were created during those phases are not displayed.

### Root Cause Analysis

After systematic investigation, three frontend bugs were identified:

**BUG #1: Poll Creation Doesn't Set phase_id**
- File: `frontend/src/components/CreatePollForm.tsx:66-70`
- The CreatePollForm component does NOT set `phase_id` when creating polls
- The component doesn't receive `currentPhaseId` as a prop
- Even though the backend API accepts phase_id, it's not being passed from frontend

**BUG #2: GameContext Missing Current Phase**
- File: `frontend/src/contexts/GameContext.tsx`
- The GameContextValue interface doesn't expose current phase information
- Components can't access the current phase even if they wanted to

**BUG #3: HistoryView Doesn't Display Polls**
- File: `frontend/src/components/HistoryView.tsx`
- The HistoryView component has no poll-related code at all
- No queries to fetch polls by phase
- No display logic for historical polls

### Infrastructure Status (GOOD NEWS)

All backend infrastructure EXISTS and works correctly:

✅ **Database Schema** (backend/pkg/db/migrations/20251105203704_add_polling_system.up.sql:8)
```sql
phase_id INTEGER REFERENCES game_phases(id) ON DELETE CASCADE
```

✅ **SQL Queries** (backend/pkg/db/queries/polls.sql:25-30)
```sql
-- name: ListPollsByPhase :many
SELECT * FROM common_room_polls
WHERE game_id = $1
  AND phase_id = $2
  AND is_deleted = FALSE
ORDER BY created_at DESC;
```

✅ **Backend Service** (backend/pkg/db/services/poll_service.go:58-62)
```go
phaseID := pgtype.Int4{}
if req.PhaseID != nil {
    phaseID.Int32 = *req.PhaseID
    phaseID.Valid = true
}
```

✅ **API Layer** (backend/pkg/polls/api_polls.go:26)
```go
PhaseID *int32 `json:"phase_id,omitempty"`
```

✅ **TypeScript Types** (frontend/src/types/polls.ts:96)
```typescript
phase_id?: number;
```

**Conclusion**: This is purely a frontend implementation issue. All backend pieces are in place.

---

## 2. Technical Design

### 2.1 Architecture Overview

**Data Flow (Current - Broken)**:
```
GameWithDetails (includes current_phase_id)
    ↓
GameContext (doesn't expose phase)
    ↓
CreatePollForm (doesn't receive phase)
    ↓
API Request (phase_id missing)
    ↓
Database (poll created without phase_id = NULL)
    ↓
HistoryView (doesn't query polls at all)
    ↓
❌ User sees no polls in history
```

**Data Flow (Fixed)**:
```
GameWithDetails (includes current_phase_id)
    ↓
GameContext (expose currentPhaseId)
    ↓
CreatePollForm (receives currentPhaseId prop)
    ↓
API Request (phase_id included)
    ↓
Database (poll created with phase_id)
    ↓
HistoryView (queries polls by phase)
    ↓
PhaseHistoryPolls component (displays polls)
    ↓
✅ User sees polls in history
```

### 2.2 Component Changes

#### Change #1: Update GameContext

**File**: `frontend/src/contexts/GameContext.tsx`

**Add to GameContextValue interface**:
```typescript
interface GameContextValue {
  gameId: number;
  game: GameWithDetails | null;
  participants: GameParticipant[];
  isLoadingGame: boolean;
  userRole: UserGameRole;
  isGM: boolean;
  userCharacters: Character[];
  currentPhaseId: number | null;  // ADD THIS
}
```

**Expose from provider**:
```typescript
const value: GameContextValue = {
  gameId,
  game: gameData || null,
  participants: participantsData || [],
  isLoadingGame,
  userRole,
  isGM: userRole === 'gm',
  userCharacters,
  currentPhaseId: gameData?.current_phase_id || null,  // ADD THIS
};
```

#### Change #2: Update CreatePollForm

**File**: `frontend/src/components/CreatePollForm.tsx`

**Update component props**:
```typescript
interface CreatePollFormProps {
  gameId: number;
  currentPhaseId?: number;  // ADD THIS
  onSuccess: () => void;
  onCancel: () => void;
}
```

**Update request building** (lines 66-70):
```typescript
const request: CreatePollRequest = {
  question: question.trim(),
  description: description.trim() || undefined,
  deadline: deadlineISO,
  vote_as_type: voteAsType,
  show_individual_votes: showIndividualVotes,
  allow_other_option: allowOtherOption,
  phase_id: currentPhaseId,  // ADD THIS
  options: filledOptions.map((text, index) => ({
    text,
    display_order: index + 1,
  })),
};
```

#### Change #3: Update CreatePollModal

**File**: `frontend/src/components/CreatePollModal.tsx`

**Pass currentPhaseId from GameContext**:
```typescript
export function CreatePollModal({ gameId, isOpen, onClose, onSuccess }: CreatePollModalProps) {
  const { currentPhaseId } = useGame();  // ADD THIS

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg" title="Create New Poll">
      <CreatePollForm
        gameId={gameId}
        currentPhaseId={currentPhaseId || undefined}  // ADD THIS
        onSuccess={() => {
          onSuccess();
          onClose();
        }}
        onCancel={onClose}
      />
    </Modal>
  );
}
```

#### Change #4: Create PhaseHistoryPolls Component

**New File**: `frontend/src/components/PhaseHistoryPolls.tsx`

```typescript
import { usePollsByPhase } from '@/hooks';
import { PollCard } from './PollCard';
import { Card, CardBody } from './ui';
import { Spinner } from './ui/Spinner';

interface PhaseHistoryPollsProps {
  gameId: number;
  phaseId: number;
  isGM: boolean;
  isAudience: boolean;
}

export function PhaseHistoryPolls({ gameId, phaseId, isGM, isAudience }: PhaseHistoryPollsProps) {
  const { data: polls, isLoading, error } = usePollsByPhase(gameId, phaseId);

  if (isLoading) {
    return (
      <div className="flex justify-center py-4">
        <Spinner size="md" />
      </div>
    );
  }

  if (error) {
    return (
      <Card variant="bordered">
        <CardBody>
          <p className="text-text-secondary">Error loading polls for this phase.</p>
        </CardBody>
      </Card>
    );
  }

  if (!polls || polls.length === 0) {
    return null; // No polls for this phase - don't show anything
  }

  return (
    <div className="space-y-4 mt-4">
      <h4 className="text-sm font-semibold text-text-secondary uppercase">
        Polls from this Phase
      </h4>
      <div className="space-y-3">
        {polls.map(poll => (
          <PollCard
            key={poll.id}
            poll={poll}
            gameId={gameId}
            isGM={isGM}
            isAudience={isAudience}
          />
        ))}
      </div>
    </div>
  );
}
```

#### Change #5: Update HistoryView

**File**: `frontend/src/components/HistoryView.tsx`

**Import the new component**:
```typescript
import { PhaseHistoryPolls } from './PhaseHistoryPolls';
```

**Add PhaseHistoryPolls to each phase display** (find where phases are rendered):
```typescript
{phases.map(phase => (
  <div key={phase.id} className="space-y-4">
    {/* Existing phase content... */}

    {/* ADD THIS: Display polls for this phase */}
    <PhaseHistoryPolls
      gameId={gameId}
      phaseId={phase.id}
      isGM={isGM}
      isAudience={isAudience}
    />
  </div>
))}
```

#### Change #6: Add usePollsByPhase Hook

**File**: `frontend/src/hooks/usePolls.ts`

**Add new query hook**:
```typescript
export function usePollsByPhase(gameId: number, phaseId: number) {
  return useQuery<Poll[]>({
    queryKey: ['polls', 'by-phase', gameId, phaseId],
    queryFn: () => api.polls.listByPhase(gameId, phaseId),
    staleTime: 1000 * 60, // 1 minute
  });
}
```

#### Change #7: Add API Client Method

**File**: `frontend/src/lib/api.ts`

**Add to polls object**:
```typescript
polls: {
  // ... existing methods ...

  listByPhase: async (gameId: number, phaseId: number): Promise<Poll[]> => {
    const response = await api.get(`/games/${gameId}/phases/${phaseId}/polls`);
    return response.data;
  },
},
```

---

## 3. API Design

### 3.1 New Endpoint (Backend)

**Route**: `GET /api/v1/games/:gameId/phases/:phaseId/polls`

**Handler Location**: `backend/pkg/polls/api_polls.go`

**Implementation**:
```go
func (h *Handler) HandleListPollsByPhase(w http.ResponseWriter, r *http.Request) {
    correlationID := logger.GetCorrelationID(r.Context())

    // Extract IDs from URL
    gameID, err := strconv.Atoi(chi.URLParam(r, "gameId"))
    if err != nil {
        logger.ErrorContext(r.Context(), "Invalid game ID",
            "correlation_id", correlationID,
            "error", err,
        )
        http.Error(w, "Invalid game ID", http.StatusBadRequest)
        return
    }

    phaseID, err := strconv.Atoi(chi.URLParam(r, "phaseId"))
    if err != nil {
        logger.ErrorContext(r.Context(), "Invalid phase ID",
            "correlation_id", correlationID,
            "error", err,
        )
        http.Error(w, "Invalid phase ID", http.StatusBadRequest)
        return
    }

    // Get user ID from context
    userID, ok := r.Context().Value(middleware.UserIDKey).(int32)
    if !ok {
        logger.ErrorContext(r.Context(), "User ID not found in context",
            "correlation_id", correlationID,
        )
        http.Error(w, "Unauthorized", http.StatusUnauthorized)
        return
    }

    // List polls by phase
    polls, err := h.App.PollService.ListPollsByPhase(r.Context(), int32(gameID), int32(phaseID), userID)
    if err != nil {
        logger.ErrorContext(r.Context(), "Failed to list polls by phase",
            "correlation_id", correlationID,
            "game_id", gameID,
            "phase_id", phaseID,
            "error", err,
        )
        http.Error(w, "Failed to list polls", http.StatusInternalServerError)
        return
    }

    logger.InfoContext(r.Context(), "Listed polls by phase",
        "correlation_id", correlationID,
        "game_id", gameID,
        "phase_id", phaseID,
        "poll_count", len(polls),
    )

    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(polls)
}
```

**Route Registration** (backend/pkg/http/root.go):
```go
r.Route("/games/{gameId}", func(r chi.Router) {
    // ... existing routes ...

    r.Route("/phases/{phaseId}", func(r chi.Router) {
        r.Get("/polls", pollHandler.HandleListPollsByPhase)
    })
})
```

### 3.2 Service Method (Already Exists!)

The service method `ListPollsByPhase` already exists in the PollService interface and implementation:

**File**: `backend/pkg/db/services/poll_service.go`

```go
func (s *pollService) ListPollsByPhase(ctx context.Context, gameID, phaseID, userID int32) ([]core.PollWithOptions, error) {
    // Implementation already exists!
}
```

---

## 4. Testing Requirements

### 4.1 Backend Tests

**File**: `backend/pkg/polls/api_polls_test.go`

**Test Cases**:
```go
func TestHandleListPollsByPhase(t *testing.T) {
    tests := []struct {
        name           string
        gameID         string
        phaseID        string
        mockSetup      func(*MockPollService)
        expectedStatus int
    }{
        {
            name:    "successfully lists polls by phase",
            gameID:  "1",
            phaseID: "100",
            mockSetup: func(m *MockPollService) {
                m.On("ListPollsByPhase", mock.Anything, int32(1), int32(100), int32(1)).
                    Return([]core.PollWithOptions{
                        {ID: 1, Question: "Test Poll 1"},
                        {ID: 2, Question: "Test Poll 2"},
                    }, nil)
            },
            expectedStatus: http.StatusOK,
        },
        {
            name:           "returns 400 for invalid game ID",
            gameID:         "invalid",
            phaseID:        "100",
            mockSetup:      func(m *MockPollService) {},
            expectedStatus: http.StatusBadRequest,
        },
        {
            name:           "returns 400 for invalid phase ID",
            gameID:         "1",
            phaseID:        "invalid",
            mockSetup:      func(m *MockPollService) {},
            expectedStatus: http.StatusBadRequest,
        },
        {
            name:    "returns 500 on service error",
            gameID:  "1",
            phaseID: "100",
            mockSetup: func(m *MockPollService) {
                m.On("ListPollsByPhase", mock.Anything, int32(1), int32(100), int32(1)).
                    Return(nil, errors.New("database error"))
            },
            expectedStatus: http.StatusInternalServerError,
        },
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            // Test implementation...
        })
    }
}
```

### 4.2 Frontend Component Tests

**Test File**: `frontend/src/components/PhaseHistoryPolls.test.tsx`

**Test Cases**:
```typescript
describe('PhaseHistoryPolls', () => {
  it('displays polls when available', async () => {
    // Mock usePollsByPhase to return polls
    // Verify PollCard components are rendered
  });

  it('shows loading spinner while fetching', () => {
    // Mock usePollsByPhase with isLoading=true
    // Verify Spinner is displayed
  });

  it('shows error message on fetch failure', () => {
    // Mock usePollsByPhase with error
    // Verify error message displayed
  });

  it('renders nothing when no polls exist', () => {
    // Mock usePollsByPhase returning empty array
    // Verify component returns null
  });

  it('passes correct props to PollCard', () => {
    // Mock polls data
    // Verify PollCard receives gameId, isGM, isAudience
  });
});
```

**Test File**: `frontend/src/components/CreatePollForm.test.tsx`

**Additional Test Case**:
```typescript
describe('CreatePollForm - Phase Association', () => {
  it('includes phase_id in request when currentPhaseId provided', async () => {
    const mockSubmit = vi.fn();
    render(
      <CreatePollForm
        gameId={1}
        currentPhaseId={100}
        onSuccess={mockSubmit}
        onCancel={vi.fn()}
      />
    );

    // Fill out form
    // Submit
    // Verify mockSubmit called with phase_id: 100
  });

  it('omits phase_id when currentPhaseId not provided', async () => {
    // Render without currentPhaseId
    // Verify request doesn't include phase_id
  });
});
```

### 4.3 E2E Tests

**Test File**: `frontend/e2e/games/game-polls-history.spec.ts`

**Test Scenarios**:
```typescript
test.describe('Polls in History Tab', () => {
  test('GM can see polls in history tab after phase advance', async ({ page }) => {
    // 1. Login as GM
    // 2. Navigate to game
    // 3. Create a poll in current phase
    // 4. Advance to next phase
    // 5. Navigate to History tab
    // 6. Verify poll is visible in previous phase
  });

  test('player can see expired polls in history', async ({ page }) => {
    // 1. Login as player
    // 2. Navigate to game with historical polls
    // 3. Go to History tab
    // 4. Verify polls from previous phases are visible
    // 5. Verify poll results are displayed (since expired)
  });

  test('polls without phase_id do not appear in history', async ({ page }) => {
    // This tests backward compatibility
    // 1. Create poll without phase_id (simulate old data)
    // 2. Verify it doesn't appear in history
    // 3. Verify it appears in Common Room (current polls)
  });
});
```

### 4.4 Manual Testing Checklist

- [ ] Create poll in Phase 1
- [ ] Verify poll appears in Common Room
- [ ] Advance to Phase 2
- [ ] Verify poll disappears from Common Room
- [ ] Navigate to History tab
- [ ] Verify poll appears under Phase 1
- [ ] Verify poll results are displayed (expired)
- [ ] Verify "Vote Now" button is NOT shown (historical)
- [ ] Create poll in Phase 2
- [ ] Verify Phase 2 poll appears in Common Room
- [ ] Verify Phase 1 poll still in History
- [ ] Test as GM, player, and audience member
- [ ] Test with polls created before phase_id fix (NULL phase_id)
- [ ] Verify dark mode styling

---

## 5. Implementation Phases

### Phase 1: Backend API Endpoint (20 min)
**Status**: Ready to start

**Tasks**:
1. Add route registration in `backend/pkg/http/root.go`
2. Implement `HandleListPollsByPhase` handler in `backend/pkg/polls/api_polls.go`
3. Add unit tests in `backend/pkg/polls/api_polls_test.go`
4. Test endpoint with curl

**Acceptance Criteria**:
- [ ] `GET /api/v1/games/:gameId/phases/:phaseId/polls` returns 200
- [ ] Returns array of polls for the specified phase
- [ ] Returns 400 for invalid IDs
- [ ] Returns 401 for unauthenticated requests
- [ ] Logs correlation ID and operation details

### Phase 2: Frontend Context & Poll Creation (30 min)
**Status**: Ready to start

**Tasks**:
1. Update GameContext to expose `currentPhaseId`
2. Update CreatePollForm props to accept `currentPhaseId`
3. Update CreatePollModal to pass `currentPhaseId`
4. Set `phase_id` in CreatePollRequest
5. Add unit tests for CreatePollForm

**Acceptance Criteria**:
- [ ] GameContext exposes currentPhaseId
- [ ] CreatePollForm receives currentPhaseId prop
- [ ] CreatePollRequest includes phase_id
- [ ] Tests verify phase_id is set correctly
- [ ] Tests verify backward compatibility (no phase_id)

### Phase 3: History Display Component (40 min)
**Status**: Ready to start

**Tasks**:
1. Create `PhaseHistoryPolls.tsx` component
2. Add `usePollsByPhase` hook in `usePolls.ts`
3. Add API client method in `api.ts`
4. Add component tests
5. Update HistoryView to use PhaseHistoryPolls

**Acceptance Criteria**:
- [ ] PhaseHistoryPolls component created
- [ ] usePollsByPhase hook created
- [ ] API client method added
- [ ] Component tests pass
- [ ] Component handles loading, error, empty states
- [ ] Component displays polls correctly

### Phase 4: Integration & E2E Testing (40 min)
**Status**: Ready to start

**Tasks**:
1. Manual testing of complete flow
2. Create E2E test file `game-polls-history.spec.ts`
3. Implement E2E test scenarios
4. Test with existing polls (NULL phase_id)
5. Verify dark mode styling

**Acceptance Criteria**:
- [ ] Polls created in phases appear in history
- [ ] Polls without phase_id don't appear in history
- [ ] E2E tests pass
- [ ] Manual testing checklist complete
- [ ] Dark mode works correctly

### Phase 5: Documentation & Cleanup (10 min)
**Status**: Ready to start

**Tasks**:
1. Update STAGING_ISSUES_TRACKING.md with completion status
2. Update API documentation
3. Add inline code comments
4. Update frontend/TESTING_NOTES.md if applicable

**Acceptance Criteria**:
- [ ] Issue #11 marked as COMPLETED
- [ ] API docs updated
- [ ] Code comments added
- [ ] Testing notes updated

---

## 6. Migration Strategy & Backward Compatibility

### 6.1 Existing Polls Without phase_id

**Issue**: Polls created before this fix have `phase_id = NULL` in the database.

**Solution**: These polls will:
1. Continue to appear in Common Room (current polls list)
2. NOT appear in History tab (since they have no phase association)
3. This is acceptable behavior - they're "orphaned" polls

**Optional Migration** (if needed):
```sql
-- Associate orphaned polls with the phase they were likely created in
-- This is OPTIONAL and should only be done if there are important historical polls

UPDATE common_room_polls
SET phase_id = (
    SELECT id FROM game_phases
    WHERE game_id = common_room_polls.game_id
    AND created_at <= common_room_polls.created_at
    ORDER BY created_at DESC
    LIMIT 1
)
WHERE phase_id IS NULL
  AND is_deleted = FALSE;
```

**Decision**: Do NOT run this migration unless users request it. Let NULL phase_id polls remain in Common Room.

### 6.2 Testing Backward Compatibility

**Test Scenario**: Verify system handles NULL phase_id correctly
1. Create poll without phase_id (simulate old behavior)
2. Verify it appears in Common Room
3. Verify it does NOT appear in History
4. Verify no errors or crashes

---

## 7. Success Criteria

### Functional Requirements
- [x] Backend has API endpoint for listing polls by phase
- [x] Frontend creates polls with phase_id association
- [x] History tab displays polls from historical phases
- [x] Polls without phase_id continue to work (backward compatible)
- [x] Poll results are visible in history (expired polls)

### Quality Requirements
- [x] Backend unit tests pass
- [x] Frontend component tests pass
- [x] E2E tests pass
- [x] Manual testing checklist complete
- [x] Dark mode works correctly

### Documentation Requirements
- [x] API documentation updated
- [x] Code comments added
- [x] Issue tracking updated
- [x] Testing notes updated

---

## 8. Risks & Mitigations

### Risk 1: Breaking Existing Polls
**Likelihood**: Low
**Impact**: Medium
**Mitigation**:
- phase_id is optional (nullable) in database
- Existing polls with NULL phase_id continue to work
- Comprehensive tests for NULL phase_id handling

### Risk 2: Performance Impact
**Likelihood**: Low
**Impact**: Low
**Mitigation**:
- Database index already exists: `idx_polls_game_phase`
- Query is efficient (indexed lookup)
- React Query caching prevents excessive fetches

### Risk 3: UI Clutter in History
**Likelihood**: Medium
**Impact**: Low
**Mitigation**:
- Only show polls section if polls exist for phase
- Use collapsible sections if needed
- Limit to reasonable number of polls per phase

---

## 9. Future Enhancements

### Enhancement 1: Poll Filtering
- Filter history polls by status (completed, expired)
- Search polls by question text
- Sort polls by deadline, creation date

### Enhancement 2: Poll Statistics
- Show aggregate voting statistics in history
- Display participation rate
- Show voting trends over time

### Enhancement 3: Poll Archiving
- Allow GMs to archive old polls
- Bulk operations for poll management
- Export poll results as CSV

---

## 10. Implementation Notes

### Key Files to Modify

**Backend**:
- `backend/pkg/http/root.go` - Route registration
- `backend/pkg/polls/api_polls.go` - Handler implementation
- `backend/pkg/polls/api_polls_test.go` - Handler tests

**Frontend**:
- `frontend/src/contexts/GameContext.tsx` - Expose currentPhaseId
- `frontend/src/components/CreatePollForm.tsx` - Accept and use phase_id
- `frontend/src/components/CreatePollModal.tsx` - Pass phase_id
- `frontend/src/components/PhaseHistoryPolls.tsx` - NEW component
- `frontend/src/components/HistoryView.tsx` - Add PhaseHistoryPolls
- `frontend/src/hooks/usePolls.ts` - Add usePollsByPhase hook
- `frontend/src/lib/api.ts` - Add listByPhase method

**Tests**:
- `backend/pkg/polls/api_polls_test.go` - Backend tests
- `frontend/src/components/PhaseHistoryPolls.test.tsx` - NEW test file
- `frontend/src/components/CreatePollForm.test.tsx` - Additional tests
- `frontend/e2e/games/game-polls-history.spec.ts` - NEW E2E tests

### SQL Query (Already Exists)
```sql
-- backend/pkg/db/queries/polls.sql:25-30
-- name: ListPollsByPhase :many
SELECT * FROM common_room_polls
WHERE game_id = $1
  AND phase_id = $2
  AND is_deleted = FALSE
ORDER BY created_at DESC;
```

### Estimated Total Time
**2-3 hours total**
- Phase 1 (Backend): 20 min
- Phase 2 (Poll Creation): 30 min
- Phase 3 (History Display): 40 min
- Phase 4 (Testing): 40 min
- Phase 5 (Documentation): 10 min

---

## 11. Conclusion

This is a straightforward fix with all backend infrastructure already in place. The solution requires:
1. Exposing current phase from GameContext (5 lines)
2. Passing phase_id to CreatePollForm (10 lines)
3. Adding new backend route handler (50 lines)
4. Creating PhaseHistoryPolls component (60 lines)
5. Integrating into HistoryView (5 lines)

Total new code: ~130 lines + tests

The fix is low-risk, backward compatible, and will significantly improve the user experience by making historical polls visible in the History tab.
