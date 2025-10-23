# Feature: Completed Game Archive (Read-Only Mode)

**Status**: Planning
**Created**: 2025-10-23
**Last Updated**: 2025-10-23
**Owner**: AI Session
**Related ADRs**:
- ADR-002: Database Design Approach
- ADR-004: API Design Principles
**Related Issues**: N/A

---

## 1. Overview

### Problem Statement
**What problem does this feature solve?**

When a Game Master marks a game as "completed", the game currently has no restrictions on content creation. Players can still post messages, submit actions, and GMs can create new phases. This creates confusion about whether the game is truly finished and allows for accidental or intentional modifications to what should be a completed narrative archive.

Games in the "completed" state should be preserved as read-only archives, allowing participants to review the complete story (common room posts, private messages, action submissions, phase history) but preventing any new content from being created or existing content from being modified.

### Goals
**What are we trying to achieve?**

- [ ] Goal 1: Enforce read-only access for all game content when game state is "completed"
- [ ] Goal 2: Provide clear UI indication that a game is archived and cannot be modified
- [ ] Goal 3: Maintain full read access to all game history, posts, messages, actions, and phases
- [ ] Goal 4: Prevent state transitions from "completed" (already enforced in constants.go)
- [ ] Goal 5: Display appropriate user-friendly messages when users attempt restricted actions
- [ ] Goal 6: Allow ANY user (including non-participants) to view completed games with full read access (public archive mode)
- [ ] Goal 7: Modify all read endpoint permission checks to allow access when game state is "completed"

### Non-Goals
**What is explicitly out of scope?**

- Non-goal 1: Data deletion or anonymization of completed games (future GDPR feature)
- Non-goal 2: Exporting game archives to external formats (future enhancement)
- Non-goal 3: Archiving "cancelled" games (separate feature, different requirements)
- Non-goal 4: GM ability to "un-complete" a game (state transitions are terminal by design)
- Non-goal 5: Different permission levels for archived content (all participants see same read-only view)

### Success Criteria
**How do we know this feature is successful?**

- [ ] User cannot create new common room posts in completed games
- [ ] User cannot create new private messages in completed games
- [ ] User cannot submit new actions in completed games
- [ ] User cannot create new phases in completed games
- [ ] User cannot edit or delete existing content in completed games
- [ ] User can read all historical content (posts, messages, actions, phases)
- [ ] UI displays clear "Archived" or "Read-Only" indicators throughout the game interface
- [ ] Error messages clearly explain why actions are restricted
- [ ] Game state cannot transition from "completed" to any other state
- [ ] Unit test coverage: >85% for service layer validation
- [ ] Integration tests: All restricted API endpoints return 403 Forbidden
- [ ] Component test coverage: >80% for UI restriction logic
- [ ] All regression tests passing
- [ ] Manual UI testing complete with documented flows

---

## 2. User Stories

### Primary User Stories

```gherkin
As a Player in a completed game
I want to be able to read all game content (posts, messages, actions)
So that I can reminisce about the game and review the complete story

Acceptance Criteria:
- Given I am a player in a completed game
  When I navigate to the game's common room
  Then I can see all historical posts
  And the post creation form is disabled with a message "This game has been completed and is now read-only"

- Given I am a player in a completed game
  When I view the action submission tab
  Then I can see all my past action submissions and results
  And the action submission form is disabled with a message "This game has been completed and is now read-only"

- Given I am a player in a completed game
  When I view private messages
  Then I can read all message history
  And the reply/compose form is disabled with a message "This game has been completed and is now read-only"
```

```gherkin
As a Game Master
I want to be required to confirm before completing a game
So that I don't accidentally mark a game as complete and lock it permanently

Acceptance Criteria:
- Given I am the GM of an active game
  When I attempt to transition the game to "completed" state
  Then I see a confirmation dialog explaining the consequences
  And the dialog requires me to type "completed" to confirm
  And I cannot proceed until the text matches exactly

- Given I am viewing the completion confirmation dialog
  When I type something other than "completed"
  Then the confirm button remains disabled

- Given I am viewing the completion confirmation dialog
  When I type "completed" correctly
  Then the confirm button becomes enabled
  And clicking confirm transitions the game to completed state
  And the dialog closes

- Given I am viewing the completion confirmation dialog
  When I click "Cancel" or click outside the dialog
  Then the dialog closes without changing game state
  And I return to the game management screen
```

```gherkin
As a Game Master
I want completed games to be automatically read-only
So that the game's narrative integrity is preserved and no accidental changes occur

Acceptance Criteria:
- Given I am the GM of a completed game
  When I transition the game to "completed" state
  Then all write operations are automatically disabled
  And I receive confirmation that the game is now archived

- Given I am the GM of a completed game
  When I attempt to create a new phase
  Then I receive a 403 Forbidden error
  And the UI shows "Cannot create phases in completed games"

- Given I am the GM of a completed game
  When I view the game dashboard
  Then I see a prominent "ARCHIVED" badge
  And all action buttons (create phase, edit settings, etc.) are disabled
```

```gherkin
As a system administrator
I want completed games to be immutable by design
So that game archives maintain their integrity over time

Acceptance Criteria:
- Given a game is in "completed" state
  When any user attempts to POST/PUT/DELETE game content via API
  Then the API returns 403 Forbidden with error code ErrCodeGameArchived
  And the error message explains the game is read-only

- Given a game is in "completed" state
  When checking game state transitions
  Then "completed" has no valid transition targets (already enforced)
  And attempts to change state return 400 Bad Request
```

### Edge Cases & Error Scenarios

- **Edge Case 1**: User has API call in-flight when game transitions to completed → API validates game state before processing, returns 403 if now completed
- **Edge Case 2**: Multiple tabs open when game completes → React Query cache invalidates, UI updates to show read-only mode in all tabs
- **Edge Case 3**: GM completes game then immediately tries to undo → UI explains state is terminal, suggests contacting admin if necessary
- **Edge Case 4**: Audience member joins completed game → Can read all content, sees same read-only restrictions as players
- **Error Scenario 1**: API validation fails to check game state → Regression test ensures all write endpoints validate game state
- **Error Scenario 2**: Frontend shows disabled UI but API allows write → Integration test catches missing backend validation
- **Error Scenario 3**: User bookmarks action submission form → Opening bookmark redirects to read-only view with explanation

---

## 3. Technical Design

### 3.1 Database Schema

**No database changes required.**

The `games` table already has the `state` column with "completed" as a valid value. The existing state machine (core/constants.go) already prevents transitions from "completed" state:

```go
// Terminal states - no transitions allowed
GameStateCompleted: {},
GameStateCancelled: {},
```

**Verification Queries (for testing):**

```sql
-- Verify game is in completed state
SELECT id, title, state FROM games WHERE id = ? AND state = 'completed';

-- Count write attempts on completed games (for audit log, future enhancement)
-- (No audit table exists yet, but could be added in future)
```

**Migration Plan:**
No migration needed. This feature adds business logic validation only.

### 3.2 Database Queries (sqlc)

**No new queries required.**

We will reuse existing queries and add state validation in service layer:
- `GetGame` - To check game state before write operations
- All existing read queries continue to work unchanged

**Query Performance Considerations:**
- [x] No new queries, no performance impact
- [x] Additional state check adds negligible overhead (~1 microsecond)
- [x] No additional indexes needed

### 3.3 Backend Service Layer

**Service Interface** (`backend/pkg/core/interfaces.go`):

No new methods needed. All existing write methods will be enhanced with state validation.

**Domain Models** (`backend/pkg/core/models.go`):

```go
// Add new error type
type GameArchivedError struct {
    GameID int32
    BaseError
}

func (e *GameArchivedError) Error() string {
    return fmt.Sprintf("game %d is archived and read-only", e.GameID)
}
```

**Helper Function** (in service layer or core package):

```go
// ValidateGameNotCompleted checks if a game is in a completed or cancelled state
// and returns an error if write operations are not allowed.
//
// This should be called before any write operation (create/update/delete) on game content
// such as posts, messages, phases, actions, or game settings.
//
// Parameters:
//   - ctx: Request context
//   - game: The game to validate (must contain State field)
//
// Returns:
//   - error: ErrGameArchived if game is completed/cancelled, nil if writable
func ValidateGameNotCompleted(ctx context.Context, game *models.Game) error {
    if game.State.String == core.GameStateCompleted || game.State.String == core.GameStateCancelled {
        correlationID := middleware.GetCorrelationID(ctx)
        return core.ErrGameArchived(game.ID, correlationID)
    }
    return nil
}
```

**Business Rules:**

1. **All write operations must validate game state**
   - Validation: Check if game.state = 'completed' OR game.state = 'cancelled'
   - Error: "This game is archived and read-only. No new content can be created."
   - Error Code: `ErrCodeGameArchived = 1313` (new constant)

2. **Read operations continue to work without restriction**
   - Validation: None needed for GET endpoints
   - Behavior: All historical data remains accessible

3. **State transitions from 'completed' remain blocked**
   - Validation: Already enforced in core/constants.go GameStateTransitions
   - Error: "Cannot transition from completed state"

**Services Requiring Validation:**

The following service methods must add `ValidateGameNotCompleted` checks:

**PhaseService** (`backend/pkg/db/services/phases/`):
- `CreatePhase()` - Add validation before phase creation
- `TransitionToNextPhase()` - Add validation before transition
- `UpdatePhase()` - Add validation before update

**ActionService** (`backend/pkg/db/services/actions/`):
- `SubmitAction()` - Add validation before submission
- `CreateActionResult()` - Add validation before result creation
- `UpdateActionResult()` - Add validation before update

**MessageService** (`backend/pkg/db/services/messages/`):
- `CreatePost()` - Add validation before post creation
- `CreateComment()` - Add validation before comment creation
- `UpdatePost()` - Add validation before update
- `UpdateComment()` - Add validation before update
- `DeletePost()` - Add validation before delete
- `DeleteComment()` - Add validation before delete
- `CreateReaction()` - Add validation before reaction

**MessageService (Private Messages):**
- `CreatePrivateMessage()` - Add validation before message creation
- `CreatePrivateMessageReply()` - Add validation before reply

**GameService** (`backend/pkg/db/services/games.go`):
- `UpdateGame()` - Add validation before game settings update
- `UpdateGameState()` - Already validates via GameStateTransitions
- `AddGameParticipant()` - Add validation (can't join completed games)
- `RemoveGameParticipant()` - Add validation (can't remove from completed games)

**CharacterService:**
- `CreateCharacter()` - Add validation before character creation
- `UpdateCharacter()` - Add validation before character update
- `DeleteCharacter()` - Add validation before character deletion

**Implementation Pattern:**

```go
// Example in PhaseService.CreatePhase
func (ps *PhaseService) CreatePhase(ctx context.Context, req *core.CreatePhaseRequest) (*models.Phase, error) {
    // 1. Fetch game to validate state
    game, err := ps.gameService.GetGame(ctx, req.GameID)
    if err != nil {
        return nil, err
    }

    // 2. Validate game is not completed/cancelled
    if err := ValidateGameNotCompleted(ctx, game); err != nil {
        return nil, err
    }

    // 3. Proceed with phase creation logic
    // ... existing implementation
}
```

### 3.4 API Endpoints

**No new endpoints required.**

All existing write endpoints will be enhanced with validation that returns 403 Forbidden when game is completed.

**Error Response Pattern:**

All write endpoints will return this error format when game is completed:

```json
{
  "error": "Game Archived",
  "message": "This game is archived and read-only. No new content can be created.",
  "code": 1313,
  "correlation_id": "abc-123-def"
}
```

**HTTP Status**: `403 Forbidden`

**Affected Endpoints:**

#### POST /api/v1/games/:id/phases
**Change**: Add game state validation before phase creation
**Response (403 Forbidden):**
```json
{
  "error": "Game Archived",
  "message": "Cannot create phases in archived games",
  "code": 1313,
  "correlation_id": "..."
}
```

#### POST /api/v1/games/:game_id/phases/:phase_id/actions
**Change**: Add game state validation before action submission
**Response (403 Forbidden):**
```json
{
  "error": "Game Archived",
  "message": "Cannot submit actions in archived games",
  "code": 1313,
  "correlation_id": "..."
}
```

#### POST /api/v1/games/:id/posts
#### POST /api/v1/games/:game_id/posts/:post_id/comments
**Change**: Add game state validation before post/comment creation
**Response (403 Forbidden):**
```json
{
  "error": "Game Archived",
  "message": "Cannot create posts in archived games",
  "code": 1313,
  "correlation_id": "..."
}
```

#### POST /api/v1/games/:id/messages
**Change**: Add game state validation before private message creation
**Response (403 Forbidden):**
```json
{
  "error": "Game Archived",
  "message": "Cannot send messages in archived games",
  "code": 1313,
  "correlation_id": "..."
}
```

#### PUT /api/v1/games/:id
**Change**: Add game state validation before game settings update
**Response (403 Forbidden):**
```json
{
  "error": "Game Archived",
  "message": "Cannot modify archived games",
  "code": 1313,
  "correlation_id": "..."
}
```

#### All other write endpoints (PUT, DELETE, POST) for game content
**Change**: Add same validation pattern

---

### 3.5 Frontend Components

**Component Hierarchy:**

```
[GameDetailPage]
├── [GameHeader] ← Add "ARCHIVED" badge
│   ├── [GameTitle]
│   └── [GameStatusBadge] ← NEW: Shows "Archived" for completed games
├── [GameTabs]
│   ├── [CommonRoomTab]
│   │   ├── [PostsList] ← Read-only, existing posts visible
│   │   └── [CreatePostForm] ← DISABLED with message for completed games
│   ├── [PrivateMessagesTab]
│   │   ├── [MessageThreads] ← Read-only, existing messages visible
│   │   └── [ComposeMessageForm] ← DISABLED with message for completed games
│   ├── [ActionsTab]
│   │   ├── [ActionsList] ← Read-only, past actions visible
│   │   └── [SubmitActionForm] ← DISABLED with message for completed games
│   ├── [PhasesTab]
│   │   ├── [PhaseHistory] ← Read-only, phase history visible
│   │   └── [CreatePhaseButton] ← HIDDEN for completed games (GM only)
│   └── [CharactersTab]
│       ├── [CharactersList] ← Read-only for completed games
│       └── [CreateCharacterButton] ← HIDDEN for completed games
└── [GameSettingsPanel] (GM only)
    └── [GameActions] ← Edit/Delete disabled for completed games
```

**Component Specifications:**

#### Component: `GameStatusBadge`
**Location**: `frontend/src/components/GameStatusBadge.tsx`
**Purpose**: Display visual indicator for game state, with special styling for archived games

**Props:**
```typescript
interface GameStatusBadgeProps {
  state: string; // Game state: "setup", "in_progress", "completed", etc.
  size?: 'sm' | 'md' | 'lg'; // Badge size
}
```

**State:**
- No local state, purely presentational

**Rendering Logic:**
```typescript
function GameStatusBadge({ state, size = 'md' }: GameStatusBadgeProps) {
  if (state === 'completed') {
    return (
      <Badge variant="secondary" size={size}>
        <ArchiveIcon className="mr-1" />
        Archived
      </Badge>
    );
  }

  // ... existing state badges
}
```

#### Component: `CreatePostForm`
**Location**: `frontend/src/components/CreatePostForm.tsx` (existing)
**Purpose**: Allow post creation, disable for archived games

**Props:**
```typescript
interface CreatePostFormProps {
  gameId: number;
  gameState: string; // Add this prop
  onSuccess: () => void;
}
```

**State:**
- Existing form state (title, content, isSubmitting)

**User Interactions:**
- If `gameState === 'completed'`:
  - Form fields are disabled
  - Submit button shows "Game Archived" and is disabled
  - Display alert: "This game has been completed and is now read-only. You cannot create new posts."
- Otherwise:
  - Normal form functionality

**Rendering Logic:**
```typescript
function CreatePostForm({ gameId, gameState, onSuccess }: CreatePostFormProps) {
  const isArchived = gameState === 'completed' || gameState === 'cancelled';

  if (isArchived) {
    return (
      <Alert variant="info">
        This game has been completed and is now read-only. You cannot create new posts.
      </Alert>
    );
  }

  // ... existing form rendering
}
```

#### Component: `SubmitActionForm`
**Location**: `frontend/src/components/SubmitActionForm.tsx` (existing)
**Purpose**: Allow action submission, disable for archived games

**Changes**: Same pattern as CreatePostForm - add `gameState` prop, show alert if archived

#### Component: `ComposeMessageForm`
**Location**: `frontend/src/components/ComposeMessageForm.tsx` (existing)
**Purpose**: Allow private message composition, disable for archived games

**Changes**: Same pattern as CreatePostForm - add `gameState` prop, show alert if archived

#### Component: `GameActions` (GM only)
**Location**: `frontend/src/components/GameActions.tsx` (existing)
**Purpose**: GM controls for game management

**Changes**:
- Add `gameState` prop
- Disable "Edit Game" button if game is completed
- Disable "Create Phase" button if game is completed
- Show tooltip: "Cannot modify archived games"

#### Component: `CompleteGameConfirmationDialog` (NEW)
**Location**: `frontend/src/components/CompleteGameConfirmationDialog.tsx`
**Purpose**: Prevent accidental game completion by requiring typed confirmation

**Props:**
```typescript
interface CompleteGameConfirmationDialogProps {
  isOpen: boolean;
  gameTitle: string;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}
```

**State:**
```typescript
const [confirmationText, setConfirmationText] = useState('');
const isConfirmEnabled = confirmationText === 'completed';
```

**User Interactions:**
- Dialog opens when GM clicks "Complete Game" button
- User must type "completed" (case-sensitive) to enable confirm button
- Confirm button triggers `onConfirm` callback (which calls API)
- Cancel button or ESC key triggers `onCancel` callback
- Dialog shows loading state during API call

**Rendering Logic:**
```typescript
function CompleteGameConfirmationDialog({
  isOpen,
  gameTitle,
  onConfirm,
  onCancel,
  isLoading = false
}: CompleteGameConfirmationDialogProps) {
  const [confirmationText, setConfirmationText] = useState('');
  const isConfirmEnabled = confirmationText === 'completed';

  const handleConfirm = () => {
    if (isConfirmEnabled) {
      onConfirm();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onCancel}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Complete Game: {gameTitle}</DialogTitle>
        </DialogHeader>

        <Alert variant="warning">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Warning:</strong> This action cannot be undone.
            Once completed, the game will become a public archive visible
            to all users, including private messages and action submissions.
          </AlertDescription>
        </Alert>

        <div className="space-y-4">
          <p>Completing this game will:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li><strong>Make all content publicly visible</strong> (including private messages)</li>
            <li>Prevent players from submitting new actions</li>
            <li>Prevent all users from posting messages or comments</li>
            <li>Prevent you from creating new phases</li>
            <li>Allow any user to browse the complete game as a read-only archive</li>
          </ul>

          <p className="font-semibold">
            To confirm, please type <code className="text-danger">completed</code> below:
          </p>

          <Input
            value={confirmationText}
            onChange={(e) => setConfirmationText(e.target.value)}
            placeholder="Type 'completed' to confirm"
            disabled={isLoading}
          />
        </div>

        <DialogFooter>
          <Button
            variant="secondary"
            onClick={onCancel}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={handleConfirm}
            disabled={!isConfirmEnabled || isLoading}
            loading={isLoading}
          >
            Complete Game
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

**Usage in GameActions:**
```typescript
function GameActions({ gameId, gameState }: GameActionsProps) {
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const completeGameMutation = useCompleteGame();

  const handleCompleteGame = () => {
    completeGameMutation.mutate(gameId, {
      onSuccess: () => {
        setShowCompleteDialog(false);
        toast.success('Game completed successfully');
      }
    });
  };

  return (
    <>
      <Button
        variant="danger"
        onClick={() => setShowCompleteDialog(true)}
        disabled={gameState === 'completed'}
      >
        Complete Game
      </Button>

      <CompleteGameConfirmationDialog
        isOpen={showCompleteDialog}
        gameTitle={gameTitle}
        onConfirm={handleCompleteGame}
        onCancel={() => setShowCompleteDialog(false)}
        isLoading={completeGameMutation.isPending}
      />
    </>
  );
}
```

---

### 3.6 Frontend API Client

**Location**: `frontend/src/lib/api.ts`

**No changes required to API client methods.**

The existing error handling will catch 403 responses and display appropriate error messages.

**Error Handling Enhancement:**

```typescript
// In axios response interceptor or error handling utility
function handleApiError(error: AxiosError) {
  if (error.response?.status === 403) {
    const errorCode = error.response.data?.code;

    if (errorCode === 1313) { // ErrCodeGameArchived
      return {
        title: 'Game Archived',
        message: 'This game is archived and read-only. No new content can be created.',
      };
    }
  }

  // ... existing error handling
}
```

### 3.7 Frontend Custom Hooks

**Location**: `frontend/src/hooks/useGameState.ts` (NEW)

```typescript
/**
 * Hook to check if a game is in an archived state (completed or cancelled)
 */
export function useIsGameArchived(gameState: string | undefined): boolean {
  return gameState === 'completed' || gameState === 'cancelled';
}

/**
 * Hook to get archive-related messaging
 */
export function useArchiveMessage(gameState: string | undefined): string | null {
  if (gameState === 'completed') {
    return 'This game has been completed and is now read-only.';
  }

  if (gameState === 'cancelled') {
    return 'This game has been cancelled and is now read-only.';
  }

  return null;
}
```

**Usage in Components:**

```typescript
function CreatePostForm({ gameId, gameState }: CreatePostFormProps) {
  const isArchived = useIsGameArchived(gameState);
  const archiveMessage = useArchiveMessage(gameState);

  if (isArchived) {
    return <Alert variant="info">{archiveMessage}</Alert>;
  }

  // ... form rendering
}
```

### 3.8 Frontend Type Definitions

**Location**: `frontend/src/types/game.ts` (existing)

No new types needed. Existing `Game` type already includes `state: string`.

**Location**: `frontend/src/types/errors.ts` (existing)

```typescript
// Add new error code constant
export const ERROR_CODES = {
  // ... existing codes
  GAME_ARCHIVED: 1313,
} as const;
```

---

## 4. Testing Strategy

**Testing Philosophy**: This project emphasizes **unit tests** and **integration tests** as the primary quality gates. Manual UI testing validates user experience. E2E tests are deferred to dedicated user story implementations.

**Test Pyramid Focus**:
```
Manual UI Testing     ← Verify read-only UI behavior in browser
   ↑
Integration Tests     ← Verify 403 responses from write endpoints (<5s)
   ↑
Unit Tests           ← Validate game state checks with mocks (<1s)
```

**Manual Testing Expectation**: After implementing backend and frontend, **manually test all user flows in the running application** to verify:
- All write forms are disabled with appropriate messaging
- Archive badges display correctly
- Error states display when API returns 403
- Read operations continue to work normally

---

### 4.1 Backend Tests

**Test Files:**
- `backend/pkg/db/services/phases/phases_test.go` - Unit tests for phase validation
- `backend/pkg/db/services/actions/actions_test.go` - Unit tests for action validation
- `backend/pkg/db/services/messages/messages_test.go` - Unit tests for message validation
- `backend/pkg/core/validation_test.go` - Unit tests for ValidateGameNotCompleted helper

**Unit Tests (with mocks):**

```go
func TestValidateGameNotCompleted(t *testing.T) {
    tests := []struct {
        name      string
        gameState string
        wantErr   bool
        errType   string
    }{
        {
            name:      "active game allows writes",
            gameState: core.GameStateInProgress,
            wantErr:   false,
        },
        {
            name:      "completed game blocks writes",
            gameState: core.GameStateCompleted,
            wantErr:   true,
            errType:   "ErrGameArchived",
        },
        {
            name:      "cancelled game blocks writes",
            gameState: core.GameStateCancelled,
            wantErr:   true,
            errType:   "ErrGameArchived",
        },
        {
            name:      "paused game allows writes",
            gameState: core.GameStatePaused,
            wantErr:   false,
        },
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            ctx := context.Background()
            game := &models.Game{
                ID:    1,
                State: pgtype.Text{String: tt.gameState, Valid: true},
            }

            err := ValidateGameNotCompleted(ctx, game)

            if tt.wantErr {
                require.Error(t, err)
                assert.Contains(t, err.Error(), "archived")
            } else {
                require.NoError(t, err)
            }
        })
    }
}
```

**Integration Tests (with database):**

```go
func TestPhaseService_CreatePhase_CompletedGame(t *testing.T) {
    pool := testutil.SetupTestDB(t)
    defer testutil.CleanupTestDB(t, pool)

    phaseService := &phases.PhaseService{DB: pool}
    gameService := &db.GameService{DB: pool}

    // Create a completed game
    game, _ := gameService.CreateGame(ctx, core.CreateGameRequest{
        Title:       "Test Game",
        Description: "Test",
        GMUserID:    1,
    })

    // Transition to completed state
    _, err := gameService.UpdateGameState(ctx, game.ID, core.GameStateCompleted)
    require.NoError(t, err)

    // Attempt to create phase
    _, err = phaseService.CreatePhase(ctx, &core.CreatePhaseRequest{
        GameID:    game.ID,
        PhaseType: "action",
        Title:     "Should Fail",
    })

    // Assert error
    require.Error(t, err)
    assert.Contains(t, err.Error(), "archived")
}
```

**Test Coverage Goals:**
- [x] ValidateGameNotCompleted helper: 100% coverage (4 test cases)
- [ ] PhaseService.CreatePhase: Add completed game test case
- [ ] ActionService.SubmitAction: Add completed game test case
- [ ] MessageService.CreatePost: Add completed game test case
- [ ] Service layer: >85% coverage overall

### 4.2 Frontend Tests

**Test Files:**
- `frontend/src/components/__tests__/CreatePostForm.test.tsx`
- `frontend/src/components/__tests__/SubmitActionForm.test.tsx`
- `frontend/src/components/__tests__/GameStatusBadge.test.tsx`
- `frontend/src/components/__tests__/CompleteGameConfirmationDialog.test.tsx` (NEW)
- `frontend/src/hooks/__tests__/useGameState.test.ts`

**Component Tests:**

```typescript
describe('CreatePostForm', () => {
  it('shows archived message when game is completed', () => {
    render(
      <CreatePostForm
        gameId={1}
        gameState="completed"
        onSuccess={jest.fn()}
      />
    );

    expect(screen.getByText(/read-only/i)).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('renders form normally when game is active', () => {
    render(
      <CreatePostForm
        gameId={1}
        gameState="in_progress"
        onSuccess={jest.fn()}
      />
    );

    expect(screen.getByRole('textbox')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /submit/i })).toBeEnabled();
  });
});

describe('GameStatusBadge', () => {
  it('shows "Archived" badge for completed games', () => {
    render(<GameStatusBadge state="completed" />);

    expect(screen.getByText(/archived/i)).toBeInTheDocument();
  });

  it('shows normal badge for active games', () => {
    render(<GameStatusBadge state="in_progress" />);

    expect(screen.getByText(/in progress/i)).toBeInTheDocument();
    expect(screen.queryByText(/archived/i)).not.toBeInTheDocument();
  });
});

describe('CompleteGameConfirmationDialog', () => {
  const mockOnConfirm = jest.fn();
  const mockOnCancel = jest.fn();

  beforeEach(() => {
    mockOnConfirm.mockClear();
    mockOnCancel.mockClear();
  });

  it('disables confirm button when confirmation text is empty', () => {
    render(
      <CompleteGameConfirmationDialog
        isOpen={true}
        gameTitle="Test Game"
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    );

    const confirmButton = screen.getByRole('button', { name: /complete game/i });
    expect(confirmButton).toBeDisabled();
  });

  it('disables confirm button when confirmation text is incorrect', async () => {
    const user = userEvent.setup();
    render(
      <CompleteGameConfirmationDialog
        isOpen={true}
        gameTitle="Test Game"
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    );

    const input = screen.getByPlaceholderText(/type 'completed'/i);
    await user.type(input, 'complete'); // Wrong text

    const confirmButton = screen.getByRole('button', { name: /complete game/i });
    expect(confirmButton).toBeDisabled();
  });

  it('enables confirm button when confirmation text matches exactly', async () => {
    const user = userEvent.setup();
    render(
      <CompleteGameConfirmationDialog
        isOpen={true}
        gameTitle="Test Game"
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    );

    const input = screen.getByPlaceholderText(/type 'completed'/i);
    await user.type(input, 'completed'); // Correct text

    const confirmButton = screen.getByRole('button', { name: /complete game/i });
    expect(confirmButton).toBeEnabled();
  });

  it('calls onConfirm when confirm button is clicked with valid input', async () => {
    const user = userEvent.setup();
    render(
      <CompleteGameConfirmationDialog
        isOpen={true}
        gameTitle="Test Game"
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    );

    const input = screen.getByPlaceholderText(/type 'completed'/i);
    await user.type(input, 'completed');

    const confirmButton = screen.getByRole('button', { name: /complete game/i });
    await user.click(confirmButton);

    expect(mockOnConfirm).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel when cancel button is clicked', async () => {
    const user = userEvent.setup();
    render(
      <CompleteGameConfirmationDialog
        isOpen={true}
        gameTitle="Test Game"
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    );

    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    await user.click(cancelButton);

    expect(mockOnCancel).toHaveBeenCalledTimes(1);
    expect(mockOnConfirm).not.toHaveBeenCalled();
  });

  it('shows warning message about public visibility', () => {
    render(
      <CompleteGameConfirmationDialog
        isOpen={true}
        gameTitle="Test Game"
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    );

    expect(screen.getByText(/this action cannot be undone/i)).toBeInTheDocument();
    expect(screen.getByText(/public archive visible to all users/i)).toBeInTheDocument();
    expect(screen.getByText(/including private messages/i)).toBeInTheDocument();
    expect(screen.getByText(/make all content publicly visible/i)).toBeInTheDocument();
  });

  it('disables all inputs when loading', () => {
    render(
      <CompleteGameConfirmationDialog
        isOpen={true}
        gameTitle="Test Game"
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
        isLoading={true}
      />
    );

    const input = screen.getByPlaceholderText(/type 'completed'/i);
    expect(input).toBeDisabled();

    const confirmButton = screen.getByRole('button', { name: /complete game/i });
    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    expect(confirmButton).toBeDisabled();
    expect(cancelButton).toBeDisabled();
  });
});
```

**Hook Tests:**

```typescript
describe('useIsGameArchived', () => {
  it('returns true for completed games', () => {
    const { result } = renderHook(() => useIsGameArchived('completed'));
    expect(result.current).toBe(true);
  });

  it('returns true for cancelled games', () => {
    const { result } = renderHook(() => useIsGameArchived('cancelled'));
    expect(result.current).toBe(true);
  });

  it('returns false for active games', () => {
    const { result } = renderHook(() => useIsGameArchived('in_progress'));
    expect(result.current).toBe(false);
  });

  it('returns false for undefined state', () => {
    const { result } = renderHook(() => useIsGameArchived(undefined));
    expect(result.current).toBe(false);
  });
});
```

**Test Coverage Goals:**
- [ ] Components: >80% coverage
- [ ] Custom hooks: 100% coverage (simple logic)
- [ ] User interactions: All archive scenarios tested

### 4.3 Regression Tests

**Critical Bugs to Prevent:**

1. **Bug**: UI shows disabled form but API still accepts write requests
   - **Test**: `TestPhaseService_CreatePhase_CompletedGame` (integration test with DB)
   - **Location**: `backend/pkg/db/services/phases/phases_test.go`

2. **Bug**: Game state validation bypassed in one service but not others
   - **Test**: Table-driven test covering all write methods across all services
   - **Location**: `backend/pkg/db/services/archive_validation_test.go` (new test suite)

3. **Bug**: Frontend shows "Archived" badge but forms remain enabled
   - **Test**: `CreatePostForm.test.tsx` - verify form elements are not rendered when archived
   - **Location**: `frontend/src/components/__tests__/CreatePostForm.test.tsx`

4. **Bug**: State transitions from 'completed' accidentally allowed
   - **Test**: Already covered by existing `TestIsValidStateTransition` in core package
   - **Location**: `backend/pkg/core/constants_test.go`

### 4.4 Manual UI Testing Checklist

**After implementation, manually verify the following in the running application:**

**Happy Path Testing:**
- [ ] Navigate to a completed game as a player
- [ ] Verify "ARCHIVED" badge displays prominently in game header
- [ ] Verify all posts in common room are visible and readable
- [ ] Verify create post form shows read-only message
- [ ] Verify action submission form shows read-only message
- [ ] Verify private message threads are readable
- [ ] Verify compose message form shows read-only message
- [ ] Verify phase history is visible
- [ ] (GM) Verify "Create Phase" button is hidden/disabled
- [ ] (GM) Verify "Edit Game" button is disabled with tooltip

**Confirmation Dialog Testing (GM only):**
- [ ] Navigate to an active game as GM
- [ ] Click "Complete Game" button
- [ ] Verify confirmation dialog appears with warning message
- [ ] Verify confirm button is disabled initially
- [ ] Type "complete" (wrong text) → Verify button remains disabled
- [ ] Clear input and type "completed" (correct) → Verify button becomes enabled
- [ ] Click "Cancel" → Verify dialog closes, game state unchanged
- [ ] Click "Complete Game" again, type "completed", click confirm
- [ ] Verify loading state displays during API call
- [ ] Verify game transitions to completed state
- [ ] Verify dialog closes on success

**Error Handling Testing:**
- [ ] Use browser dev tools to force-enable a submit button
- [ ] Attempt to submit (should fail with 403)
- [ ] Verify error message displays: "Game is archived and read-only"
- [ ] Attempt to directly POST to API via curl → Verify 403 response
- [ ] Test with various game states (setup, in_progress, paused) → Forms work normally

**UI/UX Testing:**
- [ ] Archive message displays consistently across all tabs
- [ ] Badge styling is visually distinct (gray/muted color)
- [ ] No visual layout shift when forms are hidden
- [ ] Tooltips display on disabled buttons
- [ ] Loading states still work correctly for read operations
- [ ] Responsive design works on mobile/tablet

**Integration Testing:**
- [ ] Complete a game (transition to "completed" state)
- [ ] Verify all tabs immediately update to read-only mode
- [ ] Refresh page → Verify read-only mode persists
- [ ] Test with multiple browser tabs open → All update correctly
- [ ] Test as different user roles (GM, Player, Audience) → All see read-only

**Public Archive Testing (Non-Participants):**
- [ ] Create a new test user who is NOT in the game
- [ ] Navigate to completed game (via direct URL or game listing)
- [ ] Verify user can view common room posts
- [ ] Verify user can view ALL private messages (including player-to-player)
- [ ] Verify user can view ALL action submissions and results
- [ ] Verify user can view phase history
- [ ] Verify user can view all character sheets
- [ ] Verify write forms show "read-only" message (not "you're not in this game")
- [ ] Verify non-participant cannot write content (403 from API)
- [ ] Test with non-authenticated user → Should require login but then allow access

**Performance Testing:**
- [ ] Page loads quickly (< 2 seconds) for large completed games
- [ ] No console errors or warnings
- [ ] Network tab shows no attempted POST requests to write endpoints

**Notes Section:**
```
[Add notes about specific scenarios tested, edge cases discovered, or issues found during manual testing]
```

---

## 5. User Stories for E2E Testing (Future)

**Purpose**: Document user journeys that should have E2E tests created in a dedicated test implementation phase.

**When to create E2E tests**: After manual testing confirms the feature works correctly, create a separate user story/task to implement automated E2E tests for critical user journeys.

**E2E Test Resources**:
- `.claude/reference/E2E_TESTING_LEARNINGS_CODIFIED.md` - Critical lessons for E2E test implementation
- `.claude/planning/E2E_TESTING_PLAN.md` - Comprehensive E2E strategy
- `docs/testing/E2E_QUICK_START.md` - Quick reference and commands

### User Journey Documentation

**Journey Name**: Player Reviews Completed Game Archive

**User Goal**: Player wants to revisit a completed game and read through the full story, including all posts, actions, and messages, but cannot accidentally modify the archive.

**Journey Steps**:
1. Player logs in and navigates to their games list
2. Player clicks on a game with "Archived" badge
3. Player sees game header with prominent "ARCHIVED" indicator
4. Player navigates to Common Room tab
5. Player scrolls through all historical posts (readable)
6. Player sees disabled post creation form with explanation message
7. Player navigates to Actions tab
8. Player reviews all submitted actions and GM results
9. Player sees disabled action submission form
10. Player navigates to Private Messages tab
11. Player reads message history
12. Player sees disabled compose form

**Journey Name**: GM Completes Game and Verifies Archive Mode

**User Goal**: GM finishes a game, marks it as completed, and verifies that all write operations are disabled while read access remains.

**Journey Steps**:
1. GM logs in and navigates to an active game
2. GM transitions game state to "completed" via game settings
3. GM sees confirmation message: "Game is now archived"
4. GM is redirected to game dashboard
5. GM sees "ARCHIVED" badge in header
6. GM verifies "Create Phase" button is disabled
7. GM verifies "Edit Game" button is disabled
8. GM attempts to create a post → Sees read-only message
9. GM logs out and logs in as a player
10. Player sees same read-only restrictions
11. Player can still read all content

**Critical User Flows to Test** (E2E candidates):
- [ ] **Flow 1**: Player browses completed game and attempts various write operations → All blocked with appropriate messaging
- [ ] **Flow 2**: GM completes game → Immediately all tabs show read-only mode without page refresh
- [ ] **Flow 3**: Multi-user scenario: GM completes game while player has action form open → Player's submit fails gracefully with explanation

**E2E Test Priority**: Medium

**Notes for Future E2E Implementation**:
```
- Test should use test fixtures to create a completed game with rich history (posts, actions, messages)
- Verify that React Query cache invalidates properly when state changes
- Test both GM and Player perspectives in same test suite
- Verify error messages are user-friendly and consistent across all restricted actions
```

---

## 6. Implementation Plan

### Phase 1: Backend Foundation & Validation (Write Operations)
**Estimated Time**: 3-4 hours

- [ ] Add `ErrCodeGameArchived = 1313` to `backend/pkg/core/constants.go`
- [ ] Add `ErrGameArchived` error function to `backend/pkg/core/api_errors.go`
- [ ] Create `ValidateGameNotCompleted` helper in `backend/pkg/core/validation.go`
- [ ] **Write unit tests first** for validation helper
  - [ ] Test with "completed" state → Returns error
  - [ ] Test with "cancelled" state → Returns error
  - [ ] Test with "in_progress" state → Returns nil
  - [ ] Test with "paused" state → Returns nil
- [ ] Run tests: `just test-mocks`
- [ ] Add validation to PhaseService methods:
  - [ ] `CreatePhase()` - Add game fetch + validation
  - [ ] Write integration test for completed game scenario
- [ ] Add validation to ActionService methods:
  - [ ] `SubmitAction()` - Add game fetch + validation
  - [ ] Write integration test for completed game scenario
- [ ] Add validation to MessageService methods:
  - [ ] `CreatePost()` - Add game fetch + validation
  - [ ] `CreateComment()` - Add game fetch + validation
  - [ ] Write integration tests
- [ ] Add validation to GameService methods:
  - [ ] `UpdateGame()` - Add validation
  - [ ] `AddGameParticipant()` - Add validation
- [ ] Run all tests: `SKIP_DB_TESTS=false just test`

**Acceptance Criteria:**
- [ ] All write methods validate game state before proceeding
- [ ] Unit tests pass for validation helper (100% coverage)
- [ ] Integration tests demonstrate 403 behavior for completed games
- [ ] No breaking changes to existing functionality

### Phase 1b: Backend Read Permission Changes (Public Archive Mode)
**Estimated Time**: 4-5 hours

**IMPORTANT**: This phase implements public archive access - any user can view completed games with full read access.

- [ ] Create `AllowPublicArchiveAccess` helper in `backend/pkg/core/validation.go`
  ```go
  // Returns true if user has access: (isUserInGame || game.State == "completed")
  // Note: Cancelled games remain private - only completed games are public archives
  func AllowPublicArchiveAccess(ctx context.Context, game *models.Game, userID int32) (bool, error)
  ```
- [ ] **Write unit tests** for public archive access helper
  - [ ] Non-participant + active game → Returns false
  - [ ] Non-participant + completed game → Returns true
  - [ ] Non-participant + cancelled game → Returns false (cancelled games stay private)
  - [ ] Participant + completed game → Returns true
  - [ ] Participant + cancelled game → Returns true
  - [ ] Participant + active game → Returns true
- [ ] Update permission checks in **MessageService** (read operations):
  - [ ] `GetPost()` - Allow if game completed OR user in game
  - [ ] `ListPosts()` - Allow if game completed OR user in game
  - [ ] `GetComment()` - Allow if game completed OR user in game
  - [ ] `GetPrivateMessages()` - **Allow if game completed** (NEW: non-participants can read)
  - [ ] Write integration tests with non-participant users
- [ ] Update permission checks in **ActionService** (read operations):
  - [ ] `GetAction()` - Allow if game completed OR user in game
  - [ ] `ListActions()` - Allow if game completed OR user in game
  - [ ] `GetActionResult()` - Allow if game completed OR user in game
  - [ ] Write integration tests with non-participant users
- [ ] Update permission checks in **PhaseService** (read operations):
  - [ ] `GetPhase()` - Allow if game completed OR user in game
  - [ ] `ListPhases()` - Allow if game completed OR user in game
  - [ ] Write integration tests
- [ ] Update permission checks in **CharacterService** (read operations):
  - [ ] `GetCharacter()` - Allow if game completed OR user in game
  - [ ] `ListCharacters()` - Allow if game completed OR user in game
  - [ ] Write integration tests
- [ ] Update permission checks in **GameService**:
  - [ ] `GetGame()` - Already public, no change needed
  - [ ] `GetGameWithDetails()` - Already public, no change needed
  - [ ] Verify completed games appear in public game listings
- [ ] Run all tests: `SKIP_DB_TESTS=false just test`

**Acceptance Criteria:**
- [ ] Non-participant users can read all content from completed games
- [ ] Existing participant access remains unchanged
- [ ] Private messages from completed games are accessible to any user
- [ ] Action submissions from completed games are accessible to any user
- [ ] All read permission tests pass with non-participant scenarios
- [ ] No breaking changes to active game permissions

### Phase 2: API Endpoint Integration
**Estimated Time**: 2-3 hours

- [ ] Update API error handler to return 403 for `ErrGameArchived`
- [ ] Add consistent error message format
- [ ] Test with curl:
  ```bash
  # Create a completed game in test DB
  # Attempt to POST to write endpoint
  curl -X POST http://localhost:3000/api/v1/games/123/posts \
    -H "Authorization: Bearer $TOKEN" \
    -d '{"title":"Test","content":"Should fail"}' \
    | jq

  # Expected: 403 with error code 1313
  ```
- [ ] Verify error response structure matches design:
  - [ ] `error: "Game Archived"`
  - [ ] `code: 1313`
  - [ ] `correlation_id` present

**Acceptance Criteria:**
- [ ] All write endpoints return 403 for completed games
- [ ] Error messages are user-friendly and consistent
- [ ] Correlation IDs are included for debugging
- [ ] Existing error handling for other cases remains unchanged

### Phase 3: Frontend UI Components
**Estimated Time**: 6-7 hours

- [ ] Create `GameStatusBadge` component
  - [ ] Implement badge rendering with archive styling
  - [ ] Add icon support (ArchiveIcon from UI library)
  - [ ] **Write component tests**
- [ ] Create `useGameState` custom hooks
  - [ ] `useIsGameArchived(gameState)`
  - [ ] `useArchiveMessage(gameState)`
  - [ ] **Write hook tests**
- [ ] Create `CompleteGameConfirmationDialog` component (NEW - Safety mechanism)
  - [ ] Implement dialog with warning message
  - [ ] Add text input requiring user to type "completed"
  - [ ] Disable confirm button until text matches exactly
  - [ ] Show list of consequences (read-only restrictions)
  - [ ] Handle loading state during API call
  - [ ] **Write comprehensive component tests** (8 test cases)
- [ ] Update `CreatePostForm` component
  - [ ] Add `gameState` prop
  - [ ] Use `useIsGameArchived` hook
  - [ ] Render alert message if archived
  - [ ] **Write tests** for archived state
- [ ] Update `SubmitActionForm` component
  - [ ] Same pattern as CreatePostForm
  - [ ] **Write tests**
- [ ] Update `ComposeMessageForm` component
  - [ ] Same pattern as CreatePostForm
  - [ ] **Write tests**
- [ ] Update `GameActions` component (GM controls)
  - [ ] Integrate `CompleteGameConfirmationDialog`
  - [ ] Show dialog when "Complete Game" clicked
  - [ ] Handle confirm/cancel callbacks
  - [ ] Disable buttons for completed games
  - [ ] Add tooltips explaining restrictions
  - [ ] **Write tests**
- [ ] Update `GameHeader` component
  - [ ] Add `GameStatusBadge` display
  - [ ] Position prominently (top-right or with title)
  - [ ] **Write tests**
- [ ] Run tests: `just test-frontend`

**Acceptance Criteria:**
- [ ] Badge displays correctly for completed games
- [ ] Confirmation dialog prevents accidental game completion
- [ ] Dialog requires exact text match ("completed") to proceed
- [ ] All write forms show appropriate messaging
- [ ] Buttons are properly disabled with tooltips
- [ ] All component tests pass (>80% coverage)
- [ ] No visual regressions in other game states

### Phase 4: Manual Testing & Documentation
**Estimated Time**: 3-4 hours (increased due to public archive testing)

- [ ] **Manual UI testing** (use checklist from Section 4.4)
  - [ ] Happy path: Navigate completed game, verify all read operations work
  - [ ] Error scenarios: Verify all write forms disabled
  - [ ] Edge cases: Test state transitions, multi-tab behavior
  - [ ] Multi-role scenarios: Test as GM, Player, Audience
- [ ] Performance testing
  - [ ] Page load times < 2 seconds for large games
  - [ ] No console errors or warnings
  - [ ] Network requests appropriate (no failed POSTs)
- [ ] Security review
  - [ ] Backend validation cannot be bypassed via API
  - [ ] UI restrictions prevent accidental submissions
  - [ ] Error messages don't leak sensitive information
- [ ] Documentation updates
  - [ ] Update API documentation with 403 responses
  - [ ] Add "Archived Games" section to user guide
  - [ ] Update `.claude/context/ARCHITECTURE.md` if needed
  - [ ] Document user journeys for future E2E tests (Section 5)
- [ ] Update completion checklist below

**Acceptance Criteria:**
- [ ] All manual test scenarios pass (Section 4.4 checklist complete)
- [ ] Performance meets requirements (<2s page load)
- [ ] Security review complete (no bypass vulnerabilities)
- [ ] Documentation updated
- [ ] User journeys documented for future E2E test implementation

---

## 7. Rollout Strategy

### Deployment Checklist
- [ ] Feature fully tested in local development
- [ ] Backend validation deployed first (deploy-safe: read operations unaffected)
- [ ] Frontend UI updates deployed after backend
- [ ] No feature flag needed (behavior is state-dependent)
- [ ] Monitor logs for 403 errors (should be rare, user-initiated only)
- [ ] Team notified of new archive behavior

### Rollback Plan
**If deployment fails:**

This feature is low-risk for rollback because:
1. **Backend changes**: Only adds validation, doesn't modify data or schema
2. **Frontend changes**: Only hides/disables UI elements, doesn't break existing functionality
3. **No database migrations**: No rollback needed

**Rollback steps if issues arise:**

1. **Frontend rollback**: Revert commit that added archive UI restrictions
   - Users will see normal UI for completed games (no harm, but write attempts will fail)
2. **Backend rollback**: Revert commit that added validation
   - Completed games become writable again (undesirable but not breaking)
3. **Hotfix strategy**: If validation causes false positives:
   - Add feature flag `ENFORCE_ARCHIVE_MODE=false` to temporarily disable
   - Fix validation logic
   - Re-enable flag

**Rollback triggers:**
- Validation incorrectly blocks write operations on active games
- UI displays archive mode for non-completed games
- User-facing errors >5% increase
- Customer complaints about inability to interact with active games

---

## 8. Monitoring & Observability

### Metrics to Track
- [ ] Count of 403 responses with error code 1313 (should be low, user-initiated only)
- [ ] Game state distribution (% of games in each state)
- [ ] Time-to-archive (time from game creation to completion)
- [ ] Read operations on completed games (analytics for archive engagement)

### Logging
- [ ] Log when game transitions to "completed" state (already logged by state transition)
- [ ] Log 403 responses with correlation ID and user info
  ```go
  log.Info().
      Str("correlation_id", correlationID).
      Int32("game_id", gameID).
      Int32("user_id", userID).
      Str("attempted_action", "create_post").
      Msg("Write operation blocked: game is archived")
  ```
- [ ] Log when users view completed games (optional, for analytics)

### Alerts
- [ ] **No alerts needed** - This is expected behavior, not an error condition
- [ ] Optional: Track 403 rate for anomaly detection (spike might indicate UI bug)

---

## 9. Documentation

### User Documentation
- [ ] Add "Archived Games" section to user guide
  - [ ] Explain what happens when game completes
  - [ ] List what users can and cannot do
  - [ ] Show example screenshots of archive mode
- [ ] Update API documentation (OpenAPI spec)
  - [ ] Document 403 responses for all write endpoints
  - [ ] Include error code 1313 in error catalog
- [ ] Add FAQ entry: "Can I reopen a completed game?"
  - [ ] Answer: No, completed state is terminal by design
  - [ ] Contact admin if game was completed by mistake

### Developer Documentation
- [ ] Update `.claude/context/ARCHITECTURE.md`
  - [ ] Add section on game state validation pattern
  - [ ] Document `ValidateGameNotCompleted` helper
- [ ] Add code comments to validation helper
- [ ] Update `CLAUDE.md` if new patterns emerged
- [ ] Document error code 1313 in error handling guide

---

## 10. Open Questions

**Technical Questions:**
- [x] Question 1: Should "cancelled" games also be read-only? → **Decision: Yes, same as completed**
- [x] Question 2: Should we show different badges for "completed" vs "cancelled"? → **Decision: Yes, use different colors/icons**
- [ ] Question 3: Should we track audit log of attempted writes to archived games? → **Decision: Defer to future observability enhancement**
- [x] Question 4: Should non-participants be able to view completed games? → **Decision: YES - Public archive mode for all completed games**
- [x] Question 5: Should "cancelled" games also be public archives? → **Decision: NO - Cancelled games remain private to participants only**

**Product Questions:**
- [x] Question 1: What does "audience-level permissions in completed games" mean exactly?
  - **DECISION**: **Public Archive Mode** - ALL users (including non-participants) gain full audience-level read access to completed games
  - **This means**:
    - Any logged-in user can view completed games (browse/discover)
    - Full read access to: common room, private messages, actions, phases, characters
    - Completed games become public archives regardless of original visibility settings
    - Users who never participated can still browse the complete story
  - **Privacy implications accepted**:
    - Private messages between players become publicly viewable
    - Action submissions (including OOC notes) become public
    - Character sheets and personal notes become public
    - Players should be warned in completion dialog that game will become fully public
  - **Implementation requirements**:
    - Modify all read endpoint permission checks: `(isUserInGame || game.state == "completed")`
    - Add "Browse Completed Games" discovery page (future enhancement, not MVP)
    - Update completion dialog to warn about full public visibility
    - Consider adding per-game opt-out for public archiving (future enhancement)
- [ ] Question 2: Should GMs be able to "unarchive" a game in exceptional cases? → **Decision: Out of scope, state is terminal. Admin intervention only if needed.**
- [ ] Question 3: Should we send notifications to participants when game is completed? → **Decision: Already handled by existing game state change notification (NotificationTypeGameStateChanged)**

**Performance Questions:**
- [x] Question 1: Does additional state check impact write endpoint performance? → **Decision: Negligible, single DB read per write operation**

---

## 11. Risks & Mitigations

### Technical Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Validation bypassed in some services | Medium | High | Comprehensive unit tests, code review checklist |
| Frontend shows disabled UI but API allows writes | Low | High | Integration tests verify API returns 403 |
| State check adds latency to write operations | Low | Low | Single DB query, cached game object if needed |
| False positive: active game treated as archived | Low | High | Thorough testing of state comparison logic |

### Product Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Users frustrated by inability to "fix" completed game | Medium | Low | Clear messaging, FAQ explaining terminal state |
| GM accidentally completes game too early | Low | Medium | Confirmation dialog on state transition (existing feature) |
| Users expect export/download feature for archives | Medium | Low | Document as future enhancement |

---

## 12. Future Enhancements

**Post-MVP Ideas:**
- Enhancement 1: **Archive Export** - Export completed game to PDF or HTML for offline storage
- Enhancement 2: **Archive Analytics** - Show stats for completed games (total posts, actions, duration)
- Enhancement 3: **GM "Epilogue" Mode** - Allow GM to add a final epilogue post after completion (read-only for players)
- Enhancement 4: **Archive Tags** - Tag completed games for easier filtering ("Epic Campaign", "Short Adventure", etc.)
- Enhancement 5: **Public Archive Sharing** - Share completed game archives with non-participants (privacy-controlled)

**Technical Debt:**
- Debt 1: Audit logging for attempted writes to archived games → Add structured logging, potential compliance requirement
- Debt 2: Cache game state to avoid repeated DB reads → Implement Redis caching for frequently accessed games

---

## 13. References

### Related Documentation
- ADR-002: Database Design Approach - Game state management
- ADR-004: API Design Principles - Error handling patterns
- `.claude/context/ARCHITECTURE.md` - Service layer patterns
- `/docs/adrs/007-testing-strategy.md` - Testing requirements

### External Resources
- [REST API Best Practices - 403 vs 404](https://restfulapi.net/http-status-codes/)
- [React Query - Invalidation](https://tanstack.com/query/latest/docs/react/guides/query-invalidation)

---

## Session Log

### Session 1 - 2025-10-23
**Accomplished:**
- Feature plan drafted using FEATURE_PLAN_TEMPLATE.md
- Analyzed existing game state constants and service implementations
- Designed validation pattern using helper function
- Planned UI component changes with archive messaging
- Defined comprehensive test strategy
- **Added CompleteGameConfirmationDialog** component to prevent accidental game completion
  - Requires GM to type "completed" to confirm state transition
  - Includes warning message about permanent read-only state
  - Added full component specification with 8 test cases
  - Updated implementation plan (Phase 3) to include dialog
  - Added confirmation dialog testing to manual testing checklist
- **Added Open Question about audience permissions** in completed games
  - Need clarification: Should players see all private messages when game completes?
  - Documented privacy vs. transparency tradeoff
  - Three options provided for product decision

**Decisions Made:**
- [x] **Public Archive Mode**: ALL users (including non-participants) gain full audience access to completed games
- [x] **Cancelled Games Privacy**: Cancelled games remain private to participants only (NOT public archives)
- [x] **Confirmation Dialog**: GM must type "completed" to prevent accidental completion
- [x] **Privacy Tradeoff**: Private messages become public in completed game archives (accepted, with warning in dialog)

**Scope Changes:**
- Added Phase 1b: Read permission modifications (4-5 hours)
- Updated dialog warning to mention public visibility
- Added public archive testing to manual testing checklist
- Increased Phase 4 time estimate for expanded testing

**Total Estimated Implementation Time**: 16-20 hours (was 10-14 hours)

**Next Steps:**
- Review updated plan with team/user
- Begin Phase 1 implementation: Backend validation for write operations
- Continue to Phase 1b: Modify read permissions for public archive access
- Implement confirmation dialog with public visibility warning
- Comprehensive testing with non-participant users

---

## Completion Checklist

**Before marking feature complete:**

- [ ] All implementation phases complete (backend validation, API errors, frontend UI, testing)
- [ ] All unit tests passing (>85% coverage on service validation logic)
- [ ] All integration tests passing (403 responses verified for all write endpoints)
- [ ] All frontend component tests passing (archive UI behavior verified)
- [ ] Manual UI testing checklist complete (Section 4.4)
- [ ] User journeys documented for future E2E tests (Section 5)
- [ ] Code reviewed by peer
- [ ] Documentation updated (API docs, user guide, architecture context)
- [ ] Deployed to staging
- [ ] Manual testing in staging environment complete
- [ ] Deployed to production
- [ ] Monitoring confirmed working (403 logs visible)
- [ ] Team notified of archive feature rollout
- [ ] Feature marked complete in tracking system

**Post-Completion (Optional):**
- [ ] Create user story for E2E test implementation
- [ ] Schedule E2E test development as separate task
- [ ] Gather user feedback on archive UX
- [ ] Plan future enhancements (export, analytics)

**Archive this plan to** `.claude/planning/archive/` **when complete.**
