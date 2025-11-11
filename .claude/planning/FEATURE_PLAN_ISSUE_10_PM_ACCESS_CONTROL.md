# Feature Plan: Issue #10 - PM Access Control During Phases

**Issue**: Users can send private messages outside of common room phases, breaking game flow design
**Status**: 🟡 Ready to Implement
**Priority**: 🔴 High (User Experience Blocker - breaks game flow)
**Estimated Time**: 2 hours
**Created**: 2025-11-10

---

## 1. Problem Statement

### Current Behavior (Bug)
- Players can create new PM conversations at ANY time during `in_progress` game state
- Players can send messages in existing conversations during action phases, results phases, etc.
- This breaks the intended game flow where messaging should only occur during common room

### Expected Behavior
- ✅ Messages tab should remain VISIBLE at all times (players can read history)
- ❌ Players should NOT be able to CREATE new conversations outside common room
- ❌ Players should NOT be able to SEND messages outside common room
- ✅ GM should have unrestricted access (can message at any time)

### Root Cause
**Location**: Messages functionality does not check current phase type

Frontend:
- `src/components/PrivateMessages.tsx` - "New Conversation" button has no phase check
- `src/components/MessageThread.tsx` - Send button has no phase check

Backend:
- `backend/pkg/messages/api.go` - No phase validation in CreateConversation or SendMessage handlers

---

## 2. Design & Architecture

### Permission Rules

| User Role | Phase Type | Can View Messages | Can Create Conv | Can Send Message |
|-----------|-----------|------------------|-----------------|------------------|
| GM        | Any       | ✅               | ✅              | ✅               |
| Player    | Common Room | ✅             | ✅              | ✅               |
| Player    | Action    | ✅               | ❌              | ❌               |
| Player    | Results   | ✅               | ❌              | ❌               |
| Audience  | Any       | ✅               | ✅              | ✅               |

**Note**: Audience members with assigned characters follow player rules

### UI/UX Design

**Messages Tab (Always Visible)**:
```
┌──────────────────────────────────────────┐
│  Messages                                │
│  [+ New] (disabled if not common room)   │
├──────────────────────────────────────────┤
│  ⓘ You can read message history, but     │
│     new messages can only be sent during │
│     Common Room phases.                  │  ← Info banner (only when not common room)
├──────────────────────────────────────────┤
│  Conversation 1                          │
│  Conversation 2                          │
└──────────────────────────────────────────┘
```

**Message Thread (Not Common Room)**:
```
┌──────────────────────────────────────────┐
│  Conversation with PlayerX               │
├──────────────────────────────────────────┤
│  [Message history displayed here]        │
│                                          │
├──────────────────────────────────────────┤
│  ⓘ Messages can only be sent during      │
│     Common Room phases.                  │
├──────────────────────────────────────────┤
│  [Message input box]                     │
│  [Send] (disabled)                       │  ← Disabled with tooltip
└──────────────────────────────────────────┘
```

### Data Flow

**Frontend Check Flow**:
```
User Action → Check currentPhaseType
              ↓
              Is phase type 'common_room'?
              ↓
              NO → Disable button, show tooltip
              YES → Enable button, allow action
```

**Backend Validation Flow**:
```
API Request → Extract gameID from params
              ↓
              Get current phase for game
              ↓
              Check phase.PhaseType == 'common_room'
              ↓
              NO → Return 403 Forbidden
              YES → Process request
```

---

## 3. API Changes

### No New Endpoints Required

Existing endpoints with added validation:
- `POST /api/v1/games/{id}/messages/conversations` - Add phase check
- `POST /api/v1/games/{id}/messages/conversations/{conversation_id}/messages` - Add phase check

### Backend Validation Logic

```go
// Helper function to check if messaging is allowed
func (h *Handler) canSendMessages(ctx context.Context, gameID int32, userID int32) (bool, error) {
    // GMs can always send messages
    game, err := h.gameService.GetGameByID(ctx, gameID)
    if err != nil {
        return false, err
    }

    if game.CreatedBy == userID {
        return true, nil  // GM
    }

    // Check if co-GM
    isCoGM, err := h.gameService.IsCoGM(ctx, gameID, userID)
    if err != nil {
        return false, err
    }
    if isCoGM {
        return true, nil
    }

    // For regular participants, check phase type
    currentPhase, err := h.phaseService.GetCurrentPhase(ctx, gameID)
    if err != nil {
        return false, err
    }

    if currentPhase == nil {
        return false, fmt.Errorf("no active phase found")
    }

    return currentPhase.PhaseType == "common_room", nil
}
```

---

## 4. Implementation Steps

### Phase 1: Backend Validation (Foundation)

#### Step 1.1: Add Phase Check Helper Function
**File**: `backend/pkg/messages/api.go`
**Time**: 15 minutes

```go
// Add after Handler struct definition
func (h *Handler) validateMessagingPhase(ctx context.Context, gameID int32, userID int32) error {
    // GM check
    game, err := h.gameService.GetGameByID(ctx, gameID)
    if err != nil {
        return fmt.Errorf("failed to get game: %w", err)
    }

    if game.CreatedBy == userID {
        return nil  // GM can always message
    }

    // Co-GM check
    isCoGM, err := h.gameService.IsCoGM(ctx, gameID, userID)
    if err != nil {
        return fmt.Errorf("failed to check co-GM status: %w", err)
    }
    if isCoGM {
        return nil
    }

    // Phase check for regular participants
    currentPhase, err := h.phaseService.GetCurrentPhase(ctx, gameID)
    if err != nil {
        return fmt.Errorf("failed to get current phase: %w", err)
    }

    if currentPhase == nil {
        return fmt.Errorf("no active phase found")
    }

    if currentPhase.PhaseType != "common_room" {
        return fmt.Errorf("messages can only be sent during common room phases")
    }

    return nil
}
```

#### Step 1.2: Add Validation to CreateConversation
**File**: `backend/pkg/messages/api.go`
**Time**: 10 minutes

```go
func (h *Handler) CreateConversation(w http.ResponseWriter, r *http.Request) {
    ctx := r.Context()
    userID := middleware.GetUserID(ctx)
    gameID, err := util.ParseInt32Param(r, "id")
    if err != nil {
        http.Error(w, "Invalid game ID", http.StatusBadRequest)
        return
    }

    // **NEW**: Validate messaging phase
    if err := h.validateMessagingPhase(ctx, gameID, userID); err != nil {
        h.Logger.Warn("Message phase validation failed",
            "error", err,
            "user_id", userID,
            "game_id", gameID,
        )
        http.Error(w, err.Error(), http.StatusForbidden)
        return
    }

    // ... rest of existing logic ...
}
```

#### Step 1.3: Add Validation to SendMessage
**File**: `backend/pkg/messages/api.go`
**Time**: 10 minutes

```go
func (h *Handler) SendMessage(w http.ResponseWriter, r *http.Request) {
    ctx := r.Context()
    userID := middleware.GetUserID(ctx)
    gameID, err := util.ParseInt32Param(r, "id")
    if err != nil {
        http.Error(w, "Invalid game ID", http.StatusBadRequest)
        return
    }

    // **NEW**: Validate messaging phase
    if err := h.validateMessagingPhase(ctx, gameID, userID); err != nil {
        h.Logger.Warn("Message phase validation failed",
            "error", err,
            "user_id", userID,
            "game_id", gameID,
        )
        http.Error(w, err.Error(), http.StatusForbidden)
        return
    }

    // ... rest of existing logic ...
}
```

#### Step 1.4: Write Backend Tests
**File**: `backend/pkg/messages/api_test.go` (new tests)
**Time**: 30 minutes

```go
func TestCreateConversation_PhaseRestriction(t *testing.T) {
    tests := []struct {
        name          string
        phaseType     string
        userIsGM      bool
        expectedCode  int
    }{
        {
            name:         "player in common room can create",
            phaseType:    "common_room",
            userIsGM:     false,
            expectedCode: http.StatusCreated,
        },
        {
            name:         "player in action phase cannot create",
            phaseType:    "action",
            userIsGM:     false,
            expectedCode: http.StatusForbidden,
        },
        {
            name:         "GM can create in any phase",
            phaseType:    "action",
            userIsGM:     true,
            expectedCode: http.StatusCreated,
        },
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            // Test implementation
        })
    }
}

func TestSendMessage_PhaseRestriction(t *testing.T) {
    // Similar structure to CreateConversation test
}
```

### Phase 2: Frontend UI Controls

#### Step 2.1: Add Phase Context to Messages Components
**File**: `frontend/src/components/PrivateMessages.tsx`
**Time**: 10 minutes

```tsx
import { useGameContext } from '../contexts/GameContext';

export function PrivateMessages({ gameId }: PrivateMessagesProps) {
  const { currentPhase, isGM } = useGameContext();
  const canSendMessages = isGM || currentPhase?.phase_type === 'common_room';

  // ... rest of component
}
```

#### Step 2.2: Disable New Conversation Button
**File**: `frontend/src/components/PrivateMessages.tsx`
**Time**: 10 minutes

```tsx
<Button
  variant="primary"
  size="sm"
  onClick={() => setShowNewConversationModal(true)}
  disabled={!canSendMessages}
  title={!canSendMessages ? 'New conversations can only be started during Common Room phases' : ''}
>
  + New Conversation
</Button>

{!canSendMessages && (
  <Alert variant="info" className="mt-4">
    You can read message history, but new messages can only be sent during Common Room phases.
  </Alert>
)}
```

#### Step 2.3: Disable Message Send in Thread
**File**: `frontend/src/components/MessageThread.tsx`
**Time**: 10 minutes

```tsx
import { useGameContext } from '../contexts/GameContext';

export function MessageThread({ conversationId, gameId }: MessageThreadProps) {
  const { currentPhase, isGM } = useGameContext();
  const canSendMessages = isGM || currentPhase?.phase_type === 'common_room';

  return (
    <div>
      {/* Message history */}

      {!canSendMessages && (
        <Alert variant="info" className="mb-4">
          Messages can only be sent during Common Room phases.
        </Alert>
      )}

      <form onSubmit={handleSubmit}>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          disabled={!canSendMessages}
          placeholder={canSendMessages ? "Type your message..." : "Messaging disabled outside Common Room"}
        />
        <Button
          type="submit"
          disabled={!canSendMessages || !message.trim() || isSubmitting}
          title={!canSendMessages ? 'Messages can only be sent during Common Room phases' : ''}
        >
          Send
        </Button>
      </form>
    </div>
  );
}
```

### Phase 3: Testing

#### Step 3.1: Component Tests
**File**: `frontend/src/components/PrivateMessages.test.tsx`
**Time**: 20 minutes

```tsx
describe('PrivateMessages - Phase Restrictions', () => {
  it('disables new conversation button during action phase for players', () => {
    // Mock context with action phase and player role
    // Render component
    // Assert button is disabled
    // Assert tooltip shows correct message
  });

  it('enables new conversation button during common room for players', () => {
    // Mock context with common room phase and player role
    // Render component
    // Assert button is enabled
  });

  it('enables new conversation button for GM in any phase', () => {
    // Mock context with action phase and GM role
    // Render component
    // Assert button is enabled
  });

  it('shows info alert when messaging is disabled', () => {
    // Mock context with action phase and player role
    // Render component
    // Assert info alert is visible
  });
});
```

**File**: `frontend/src/components/MessageThread.test.tsx`
**Time**: 20 minutes

```tsx
describe('MessageThread - Phase Restrictions', () => {
  it('disables send button during action phase for players', () => {
    // Similar structure to PrivateMessages tests
  });

  it('disables textarea during action phase', () => {
    // Test textarea disabled state
  });

  it('shows phase restriction alert', () => {
    // Test alert visibility
  });
});
```

#### Step 3.2: E2E Tests
**File**: `frontend/e2e/gameplay/private-messages-phase-control.spec.ts` (NEW)
**Time**: 30 minutes

```typescript
import { test, expect } from '@playwright/test';
import { loginAs } from '../helpers/auth';

test.describe('Private Messages - Phase Access Control', () => {
  test('player cannot create conversation during action phase', async ({ page }) => {
    await loginAs(page, 'PLAYER');
    // Navigate to game in action phase
    // Go to Messages tab
    // Assert "New Conversation" button is disabled
    // Assert info message is displayed
  });

  test('player cannot send message during action phase', async ({ page }) => {
    await loginAs(page, 'PLAYER');
    // Navigate to game in action phase
    // Open existing conversation
    // Assert send button is disabled
    // Assert textarea is disabled
    // Assert info message is displayed
  });

  test('player can create conversation during common room', async ({ page }) => {
    await loginAs(page, 'PLAYER');
    // Navigate to game in common room phase
    // Go to Messages tab
    // Assert "New Conversation" button is enabled
    // Click button and create conversation
    // Assert conversation created successfully
  });

  test('GM can create conversation in any phase', async ({ page }) => {
    await loginAs(page, 'GM');
    // Navigate to game in action phase
    // Create conversation
    // Assert success
  });
});
```

---

## 5. Testing Strategy

### Test Coverage Requirements

**Backend Tests** (must pass):
- ✅ Player cannot create conversation outside common room → 403
- ✅ Player cannot send message outside common room → 403
- ✅ Player can create conversation in common room → 201
- ✅ Player can send message in common room → 201
- ✅ GM can create conversation in any phase → 201
- ✅ GM can send message in any phase → 201
- ✅ Co-GM can message in any phase → 201

**Component Tests** (must pass):
- ✅ New button disabled for player in action phase
- ✅ New button enabled for player in common room
- ✅ Send button disabled for player in action phase
- ✅ Send button enabled for player in common room
- ✅ Info alert shows when messaging disabled
- ✅ GM controls always enabled

**E2E Tests** (must pass):
- ✅ Player cannot create conversation during action phase
- ✅ Player cannot send message during action phase
- ✅ Player can message normally during common room
- ✅ GM can message in any phase
- ✅ UI shows helpful messaging about restrictions

### Manual Testing Checklist

- [ ] Login as player in game with action phase active
- [ ] Verify "New Conversation" button is disabled with tooltip
- [ ] Verify info alert is displayed
- [ ] Open existing conversation
- [ ] Verify send button is disabled
- [ ] Verify textarea shows disabled placeholder
- [ ] Switch to GM user
- [ ] Verify all controls are enabled
- [ ] Advance phase to common room
- [ ] Verify player controls are now enabled
- [ ] Create conversation and send message successfully

---

## 6. Rollout Plan

### Implementation Order
1. ✅ Backend validation (foundation - prevents API abuse)
2. ✅ Frontend UI controls (user-facing restrictions)
3. ✅ Tests (verification)

### Deployment Steps
1. Merge backend changes first (defensive layer)
2. Merge frontend changes (UI restrictions)
3. Monitor for 403 errors in logs (indicates bypass attempts)
4. Verify no UX regressions in staging

### Rollback Plan
- Backend changes can be rolled back independently
- Frontend changes can be rolled back independently
- No database migrations required

---

## 7. Success Criteria

### Functional Requirements
- ✅ Players cannot create conversations outside common room
- ✅ Players cannot send messages outside common room
- ✅ Players can read message history at any time
- ✅ GM/Co-GM unrestricted access maintained
- ✅ Clear user feedback when restrictions apply

### Technical Requirements
- ✅ Backend validates phase type before allowing message operations
- ✅ Frontend disables controls with helpful tooltips
- ✅ All tests pass (backend + component + E2E)
- ✅ No breaking changes to existing functionality

### UX Requirements
- ✅ Users understand why messaging is disabled
- ✅ Info banner explains restriction clearly
- ✅ Tooltip on disabled buttons provides guidance
- ✅ No confusion about Messages tab visibility

---

## 8. Risk Assessment

### High Risk
- **None identified** - Well-scoped change with clear requirements

### Medium Risk
- **Edge Case**: What if phase transitions while user is typing message?
  - **Mitigation**: Frontend checks phase before submit, backend validates
  - **UX**: User gets clear error, can retry after phase change

- **Co-GM Status**: Need to verify co-GM permission logic
  - **Mitigation**: Add specific test for co-GM messaging
  - **Fallback**: GM can always relay messages

### Low Risk
- **Audience with NPCs**: Should they message anytime or follow player rules?
  - **Decision**: Follow player rules (document in implementation)

---

## 9. Open Questions

### ✅ Resolved
1. **Q**: Should Messages tab be hidden outside common room?
   - **A**: NO - Keep tab visible, only restrict WRITE operations

2. **Q**: What about GM and Co-GM access?
   - **A**: Unrestricted access in all phases (game management need)

3. **Q**: How to handle mid-message phase transitions?
   - **A**: Frontend disables controls, backend rejects with 403, user can retry

### 🔍 To Verify During Implementation
1. **Q**: Does co-GM check work in all message endpoints?
   - **Action**: Test explicitly in backend tests

2. **Q**: Are there other message-related endpoints that need phase checks?
   - **Action**: Audit all message endpoints (delete, edit, mark read)

---

## 10. Documentation Updates

### Code Documentation
- [ ] Add comments explaining phase restrictions in API handlers
- [ ] Document `validateMessagingPhase()` helper function
- [ ] Add JSDoc comments for frontend phase check logic

### User Documentation
- [ ] Update game rules documentation to explain messaging phases
- [ ] Add to GM guide: "Players can only message during common room"
- [ ] Add to player guide: "Use Messages tab to coordinate during common room"

### Architecture Documentation
- [ ] Consider creating ADR for messaging phase restrictions
- [ ] Update ARCHITECTURE.md if significant pattern changes

---

## 11. Time Estimate Breakdown

| Task | Estimated Time | Actual Time |
|------|---------------|-------------|
| Backend helper function | 15 min | |
| Backend endpoint updates | 20 min | |
| Backend tests | 30 min | |
| Frontend context integration | 10 min | |
| Frontend UI updates | 20 min | |
| Frontend component tests | 40 min | |
| E2E tests | 30 min | |
| Manual testing | 15 min | |
| Documentation | 10 min | |
| **TOTAL** | **~3 hours** | |

**Note**: Original estimate was 2 hours, revised to 3 hours accounting for comprehensive testing.

---

## 12. Implementation Checklist

### Backend Implementation
- [ ] Add `validateMessagingPhase()` helper function
- [ ] Update `CreateConversation` handler with phase check
- [ ] Update `SendMessage` handler with phase check
- [ ] Add backend tests for phase restrictions
- [ ] Verify GM and co-GM bypass works
- [ ] Run backend test suite

### Frontend Implementation
- [ ] Add phase context to PrivateMessages component
- [ ] Disable "New Conversation" button with tooltip
- [ ] Add info banner when messaging disabled
- [ ] Add phase context to MessageThread component
- [ ] Disable send button and textarea
- [ ] Add info banner in thread view
- [ ] Update component tests
- [ ] Run frontend test suite

### E2E Testing
- [ ] Create new E2E test file for PM phase control
- [ ] Test player restrictions during action phase
- [ ] Test player access during common room
- [ ] Test GM unrestricted access
- [ ] Run full E2E suite

### Manual Verification
- [ ] Test as player in action phase
- [ ] Test as player in common room
- [ ] Test as GM in various phases
- [ ] Test phase transition while typing
- [ ] Verify all error messages are user-friendly

### Documentation & Cleanup
- [ ] Update STAGING_ISSUES_TRACKING.md status
- [ ] Add code comments where needed
- [ ] Update any affected documentation
- [ ] Review all changes before commit

---

## 13. Next Steps After Completion

1. Update Issue #10 status in STAGING_ISSUES_TRACKING.md to ✅ COMPLETED
2. Move to next high-priority issue: **Issue #2: Token Expiration**
3. Monitor staging for any edge cases or user feedback
4. Consider similar restrictions for other phase-dependent features
