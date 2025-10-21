# Feature: GM Player Management (Add/Remove Players)

**Status**: Planning
**Created**: 2025-10-21
**Last Updated**: 2025-10-21
**Owner**: AI Session
**Related ADRs**: ADR-002 (Database Design), ADR-003 (Authentication Strategy)
**Related Issues**: N/A

---

## 1. Overview

### Problem Statement
**What problem does this feature solve?**

Currently, GMs have limited control over their game roster once recruitment is complete. They cannot:
- Remove problematic players who violate game rules
- Handle emergency situations where a player needs to be removed quickly
- Reassign characters when players leave the game
- Directly add trusted players who missed the application window
- Manage the roster during active gameplay when issues arise

This creates friction and forces GMs to work around system limitations rather than focusing on running their game.

### Goals
**What are we trying to achieve?**

- [ ] Goal 1: Allow GMs to remove players from their games at any time, regardless of game state
- [ ] Goal 2: When removing a player, keep their character(s) and mark them inactive
- [ ] Goal 3: Allow GMs to reassign inactive characters to themselves or audience members
- [ ] Goal 4: Allow GMs to add players directly, bypassing the application process
- [ ] Goal 5: Removed players lose all access to the game unless granted audience access
- [ ] Goal 6: Provide clear UI for managing the game roster

### Non-Goals
**What is explicitly out of scope?**

- Non-goal 1: Automatic notifications to removed players (can be added later)
- Non-goal 2: Player removal appeals process
- Non-goal 3: Removing players during active action submission (allowed, but may cause edge cases)
- Non-goal 4: Bulk player management tools
- Non-goal 5: Player transfer between games

### Success Criteria
**How do we know this feature is successful?**

- [ ] GMs can remove players from their game with confirmation dialog
- [ ] Removed player's characters remain in game and marked inactive
- [ ] GMs can reassign inactive characters to themselves or audience members
- [ ] GMs can add players directly without application process
- [ ] Added players immediately gain access to the game
- [ ] Removed players cannot access the game
- [ ] Unit test coverage: >85% for service layer
- [ ] Integration tests: All API endpoints tested
- [ ] Component test coverage: >85% for frontend
- [ ] All regression tests passing
- [ ] Manual UI testing complete with documented flows

---

## 2. User Stories

### Primary User Stories

```gherkin
As a GM
I want to remove a player from my game
So that I can handle problematic situations quickly

Acceptance Criteria:
- Given I am the GM of a game
  When I click "Remove Player" on a participant
  Then I see a confirmation dialog warning about consequences
  And when I confirm, the player is removed from game_participants
  And their characters are marked inactive
  And I can reassign those characters
  And the removed player loses game access
```

```gherkin
As a GM
I want to reassign an inactive character to myself
So that I can continue the story with that character as an NPC

Acceptance Criteria:
- Given I am the GM and a character is marked inactive
  When I click "Assign Character" on the inactive character
  Then I see a list of valid assignees (myself and audience members)
  And when I select myself and confirm
  Then the character is assigned to me
  And the character is marked as active
  And I can post as that character in the common room
```

```gherkin
As a GM
I want to add a trusted player directly to my game
So that they can join without going through the application process

Acceptance Criteria:
- Given I am the GM of a game
  When I click "Add Player Directly"
  Then I see a search/input for user email or username
  And when I select a user and confirm
  Then they are added to game_participants with status "approved"
  And they immediately gain access to the game
  And they can create characters (if game allows)
```

```gherkin
As a removed player
I want to know I've lost access to the game
So that I understand my current status

Acceptance Criteria:
- Given I was removed from a game
  When I try to access that game
  Then I see a 403 Forbidden error or message
  And I cannot view the game in my games list
  And I cannot receive notifications for that game
```

### Edge Cases & Error Scenarios

- **Edge Case 1**: Remove player during active phase → Character actions submitted but not yet processed are preserved
- **Edge Case 2**: Remove only remaining player → Game continues with just GM
- **Edge Case 3**: GM removes themselves → Not allowed (GM cannot remove themselves)
- **Edge Case 4**: Reassign character to audience member who already has max characters → Should still work (no max for audience NPCs)
- **Edge Case 5**: Add player who already has pending application → Application is auto-approved
- **Edge Case 6**: Add player who was previously removed → Allowed, they regain access
- **Error Scenario 1**: Non-GM tries to remove player → 403 Forbidden
- **Error Scenario 2**: Try to add non-existent user → 404 User Not Found

---

## 3. Technical Design

### 3.1 Database Schema

**Schema Modifications:**

```sql
-- Add removed_at column to game_participants for tracking removals
ALTER TABLE game_participants ADD COLUMN removed_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE game_participants ADD COLUMN removed_by_user_id INT DEFAULT NULL;

-- Add foreign key for removed_by
ALTER TABLE game_participants
ADD CONSTRAINT fk_game_participants_removed_by
FOREIGN KEY (removed_by_user_id) REFERENCES users(id) ON DELETE SET NULL;

-- Add index for querying active participants (not removed)
CREATE INDEX idx_game_participants_removed_at
ON game_participants(game_id, removed_at)
WHERE removed_at IS NULL;

-- Add inactive status to characters
ALTER TABLE characters ADD COLUMN is_active BOOLEAN DEFAULT TRUE NOT NULL;

-- Add index for active characters
CREATE INDEX idx_characters_active ON characters(game_id, is_active);

-- Add column to track character reassignments
ALTER TABLE characters ADD COLUMN original_owner_user_id INT DEFAULT NULL;

-- Update to set original_owner_user_id for existing characters
UPDATE characters
SET original_owner_user_id = user_id
WHERE original_owner_user_id IS NULL;
```

**Migration Plan:**
1. Migration file: `[timestamp]_add_player_management_tracking.up.sql`
2. Rollback file: `[timestamp]_add_player_management_tracking.down.sql`
3. Data migration strategy: Existing participants/characters will have NULL removed_at and TRUE is_active

### 3.2 Database Queries (sqlc)

**Location**: `backend/pkg/db/queries/games.sql` and `backend/pkg/db/queries/characters.sql`

```sql
-- name: RemoveParticipant :exec
UPDATE game_participants
SET removed_at = NOW(),
    removed_by_user_id = $2,
    updated_at = NOW()
WHERE game_id = $1 AND user_id = $2 AND removed_at IS NULL;

-- name: AddParticipantDirectly :one
INSERT INTO game_participants (
    game_id,
    user_id,
    status,
    role,
    application_text
) VALUES (
    $1,
    $2,
    'approved',
    'player',
    'Added directly by GM'
) RETURNING *;

-- name: DeactivatePlayerCharacters :exec
UPDATE characters
SET is_active = FALSE,
    updated_at = NOW()
WHERE game_id = $1
  AND user_id = $2
  AND is_active = TRUE;

-- name: ReassignCharacter :exec
UPDATE characters
SET user_id = $1,
    is_active = TRUE,
    updated_at = NOW()
WHERE id = $2;

-- name: ListInactiveCharacters :many
SELECT c.*, u.username
FROM characters c
JOIN users u ON c.user_id = u.id
WHERE c.game_id = $1 AND c.is_active = FALSE
ORDER BY c.name ASC;

-- name: GetActiveParticipants :many
SELECT gp.*, u.username, u.email
FROM game_participants gp
JOIN users u ON gp.user_id = u.id
WHERE gp.game_id = $1
  AND gp.removed_at IS NULL
  AND gp.status = 'approved'
ORDER BY gp.joined_at ASC;

-- name: CheckParticipantExists :one
SELECT COUNT(*) as count
FROM game_participants
WHERE game_id = $1
  AND user_id = $2
  AND removed_at IS NULL;

-- name: RestoreParticipant :exec
-- If player was previously removed, restore them
UPDATE game_participants
SET removed_at = NULL,
    removed_by_user_id = NULL,
    updated_at = NOW()
WHERE game_id = $1 AND user_id = $2 AND removed_at IS NOT NULL;
```

**Query Performance Considerations:**
- [x] Index on (game_id, removed_at) for filtering active participants
- [x] Index on (game_id, is_active) for finding inactive characters
- [x] No N+1 queries (participants fetched with user info)

### 3.3 Backend Service Layer

**Service Interface** (`backend/pkg/core/interfaces.go`):

```go
// Add to existing GameServiceInterface
type GameServiceInterface interface {
    // ... existing methods ...

    // Player management
    RemovePlayer(ctx context.Context, gameID int32, userID int32, removedByUserID int32) error
    AddPlayerDirectly(ctx context.Context, gameID int32, userID int32, gmUserID int32) (*GameParticipant, error)
    ListActiveParticipants(ctx context.Context, gameID int32) ([]*ParticipantWithUser, error)
}

// Add to existing CharacterServiceInterface
type CharacterServiceInterface interface {
    // ... existing methods ...

    // Character management
    ReassignCharacter(ctx context.Context, characterID int32, newOwnerUserID int32, requestingUserID int32) error
    ListInactiveCharacters(ctx context.Context, gameID int32) ([]*Character, error)
    DeactivateCharactersForUser(ctx context.Context, gameID int32, userID int32) error
}
```

**Domain Models** (`backend/pkg/core/models.go`):

```go
// Update existing GameParticipant model
type GameParticipant struct {
    ID               int32      `json:"id"`
    GameID           int32      `json:"game_id"`
    UserID           int32      `json:"user_id"`
    Status           string     `json:"status"`
    Role             string     `json:"role"`
    ApplicationText  *string    `json:"application_text,omitempty"`
    JoinedAt         time.Time  `json:"joined_at"`
    CreatedAt        time.Time  `json:"created_at"`
    UpdatedAt        time.Time  `json:"updated_at"`

    // New fields
    RemovedAt        *time.Time `json:"removed_at,omitempty"`
    RemovedByUserID  *int32     `json:"removed_by_user_id,omitempty"`
}

// Update existing Character model
type Character struct {
    ID                  int32      `json:"id"`
    GameID              int32      `json:"game_id"`
    UserID              int32      `json:"user_id"`
    Name                string     `json:"name"`
    CharacterType       string     `json:"character_type"`
    Status              string     `json:"status"`
    CharacterSheet      JSONObject `json:"character_sheet"`
    CreatedAt           time.Time  `json:"created_at"`
    UpdatedAt           time.Time  `json:"updated_at"`

    // New fields
    IsActive            bool       `json:"is_active"`
    OriginalOwnerUserID *int32     `json:"original_owner_user_id,omitempty"`
}

type ParticipantWithUser struct {
    *GameParticipant
    Username string `json:"username"`
    Email    string `json:"email"`
}

type AddPlayerRequest struct {
    UserID int32 `json:"user_id" validate:"required"`
}

type ReassignCharacterRequest struct {
    NewOwnerUserID int32 `json:"new_owner_user_id" validate:"required"`
}
```

**Business Rules:**

1. **Only GM can remove players**
   - Validation: Check requesting user is game GM
   - Error: "Only the GM can remove players"

2. **GM cannot remove themselves**
   - Validation: Check userID to remove != GM user ID
   - Error: "GM cannot remove themselves from the game"

3. **Removing player deactivates their characters**
   - Implementation: Update all characters for user to is_active = FALSE
   - Preserves character data for potential reassignment

4. **Only GM can reassign characters**
   - Validation: Check requesting user is game GM
   - Error: "Only the GM can reassign characters"

5. **Can only reassign inactive characters**
   - Validation: Check character.is_active = FALSE
   - Error: "Can only reassign inactive characters"

6. **Can reassign to GM or audience members only**
   - Validation: Check new owner is GM or has audience role
   - Error: "Can only reassign to GM or audience members"

7. **Adding player directly requires GM permission**
   - Validation: Check requesting user is game GM
   - Error: "Only the GM can add players directly"

8. **Cannot add player who is already active participant**
   - Validation: Check for existing active participant record
   - Error: "Player is already a participant in this game"

9. **Adding previously removed player restores them**
   - Implementation: If removed_at IS NOT NULL, update to NULL instead of insert

---

### 3.4 API Endpoints

**Base Path**: `/api/v1/games/:game_id`

#### DELETE /api/v1/games/:game_id/participants/:user_id
**Description**: Remove a player from the game
**Auth Required**: Yes
**Permissions**: User must be GM of the game

**Response (204 No Content)**

**Error Responses:**
- `401 Unauthorized`: No valid authentication token
- `403 Forbidden`: User is not the GM
- `404 Not Found`: Game or participant doesn't exist
- `409 Conflict`: Trying to remove GM themselves
- `500 Internal Server Error`: Database error

---

#### POST /api/v1/games/:game_id/participants/direct-add
**Description**: Add a player directly to the game without application
**Auth Required**: Yes
**Permissions**: User must be GM of the game

**Request Body:**
```json
{
  "user_id": 123
}
```

**Response (201 Created):**
```json
{
  "id": 456,
  "game_id": 789,
  "user_id": 123,
  "status": "approved",
  "role": "player",
  "application_text": "Added directly by GM",
  "joined_at": "2025-10-21T10:00:00Z",
  "created_at": "2025-10-21T10:00:00Z",
  "updated_at": "2025-10-21T10:00:00Z"
}
```

**Error Responses:**
- `400 Bad Request`: Invalid user_id
- `401 Unauthorized`: No valid authentication token
- `403 Forbidden`: User is not the GM
- `404 Not Found`: Game or user doesn't exist
- `409 Conflict`: User is already an active participant
- `500 Internal Server Error`: Database error

---

#### GET /api/v1/games/:game_id/participants
**Description**: List active participants (update existing endpoint to exclude removed)
**Auth Required**: Yes
**Permissions**: User must have access to the game

**Response (200 OK):**
```json
{
  "participants": [
    {
      "id": 1,
      "game_id": 789,
      "user_id": 123,
      "username": "player1",
      "email": "player1@example.com",
      "status": "approved",
      "role": "player",
      "joined_at": "2025-10-21T10:00:00Z"
    }
  ]
}
```

---

#### PUT /api/v1/characters/:character_id/reassign
**Description**: Reassign an inactive character to a new owner
**Auth Required**: Yes
**Permissions**: User must be GM of the game

**Request Body:**
```json
{
  "new_owner_user_id": 456
}
```

**Response (200 OK):**
```json
{
  "id": 123,
  "game_id": 789,
  "user_id": 456,
  "name": "Detective Kane",
  "character_type": "player_character",
  "is_active": true,
  "original_owner_user_id": 789,
  "updated_at": "2025-10-21T10:30:00Z"
}
```

**Error Responses:**
- `400 Bad Request`: Invalid request body
- `401 Unauthorized`: No valid authentication token
- `403 Forbidden`: User is not the GM
- `404 Not Found`: Character doesn't exist
- `409 Conflict`: Character is active or new owner is invalid
- `500 Internal Server Error`: Database error

---

#### GET /api/v1/games/:game_id/characters/inactive
**Description**: List all inactive characters in the game
**Auth Required**: Yes
**Permissions**: User must be GM of the game

**Response (200 OK):**
```json
{
  "characters": [
    {
      "id": 123,
      "game_id": 789,
      "user_id": 999,
      "username": "former_player",
      "name": "Detective Kane",
      "character_type": "player_character",
      "is_active": false,
      "original_owner_user_id": 999,
      "created_at": "2025-10-21T10:00:00Z",
      "updated_at": "2025-10-21T10:30:00Z"
    }
  ]
}
```

---

### 3.5 Frontend Components

**Component Hierarchy:**

```
[GameDetailsPage]
├── [ParticipantsList] (existing - updates)
│   ├── [ParticipantCard] (existing - updates)
│   │   ├── [RemovePlayerButton] (new)
│   │   └── [RemovePlayerConfirmDialog] (new)
│   └── [AddPlayerButton] (new)
│       └── [AddPlayerModal] (new)
└── [InactiveCharactersList] (new)
    ├── [InactiveCharacterCard] (new)
    │   └── [ReassignCharacterButton] (new)
    └── [ReassignCharacterModal] (new)
```

**Component Specifications:**

#### Component: `RemovePlayerButton`
**Location**: `frontend/src/components/game/RemovePlayerButton.tsx`
**Purpose**: Button to initiate player removal

**Props:**
```typescript
interface RemovePlayerButtonProps {
  gameId: number;
  userId: number;
  username: string;
}
```

**State:**
- Local state: `showConfirmDialog` (boolean)
- Server state: Uses `useRemovePlayer` mutation

**User Interactions:**
- Click button → Shows confirmation dialog
- Confirm → Calls API, removes player, updates UI

---

#### Component: `RemovePlayerConfirmDialog`
**Location**: `frontend/src/components/game/RemovePlayerConfirmDialog.tsx`
**Purpose**: Confirmation dialog warning about consequences

**Props:**
```typescript
interface RemovePlayerConfirmDialogProps {
  isOpen: boolean;
  username: string;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading: boolean;
}
```

**Rendering:**
- Shows warning about removing player
- Lists consequences (character deactivation, loss of access)
- Uses semantic warning colors for visibility

---

#### Component: `AddPlayerModal`
**Location**: `frontend/src/components/game/AddPlayerModal.tsx`
**Purpose**: Modal for adding player directly to game

**Props:**
```typescript
interface AddPlayerModalProps {
  gameId: number;
  isOpen: boolean;
  onClose: () => void;
}
```

**State:**
- Local state: `searchQuery` (string), `selectedUser` (User | null)
- Server state: Uses `useSearchUsers` query, `useAddPlayer` mutation

**User Interactions:**
- Type in search box → Shows matching users
- Select user → Enables "Add Player" button
- Click "Add Player" → Calls API, closes modal, refreshes participants

---

#### Component: `InactiveCharactersList`
**Location**: `frontend/src/components/game/InactiveCharactersList.tsx`
**Purpose**: Display inactive characters for GM to reassign

**Props:**
```typescript
interface InactiveCharactersListProps {
  gameId: number;
}
```

**State:**
- Server state: Uses `useInactiveCharacters` query

**Rendering:**
- Shows empty state if no inactive characters
- Lists inactive characters with reassign buttons
- Only visible to GM

---

#### Component: `ReassignCharacterModal`
**Location**: `frontend/src/components/game/ReassignCharacterModal.tsx`
**Purpose**: Modal for reassigning character to new owner

**Props:**
```typescript
interface ReassignCharacterModalProps {
  character: Character;
  gameId: number;
  isOpen: boolean;
  onClose: () => void;
}
```

**State:**
- Local state: `selectedUserId` (number | null)
- Server state: Uses `useGameParticipants` query, `useReassignCharacter` mutation

**User Interactions:**
- Shows dropdown of valid assignees (GM + audience members)
- Select user → Enables "Reassign" button
- Click "Reassign" → Calls API, closes modal, refreshes character list

---

### 3.6 Frontend API Client

**Location**: `frontend/src/lib/api.ts`

```typescript
class ApiClient {
  games = {
    // ... existing methods ...

    // Remove player from game
    async removePlayer(gameId: number, userId: number): Promise<void> {
      await this.client.delete(
        `/api/v1/games/${gameId}/participants/${userId}`
      );
    },

    // Add player directly to game
    async addPlayerDirectly(
      gameId: number,
      userId: number
    ): Promise<GameParticipant> {
      const response = await this.client.post<GameParticipant>(
        `/api/v1/games/${gameId}/participants/direct-add`,
        { user_id: userId }
      );
      return response.data;
    },

    // List inactive characters
    async listInactiveCharacters(gameId: number): Promise<Character[]> {
      const response = await this.client.get<{ characters: Character[] }>(
        `/api/v1/games/${gameId}/characters/inactive`
      );
      return response.data.characters;
    },
  };

  characters = {
    // ... existing methods ...

    // Reassign character to new owner
    async reassignCharacter(
      characterId: number,
      newOwnerUserId: number
    ): Promise<Character> {
      const response = await this.client.put<Character>(
        `/api/v1/characters/${characterId}/reassign`,
        { new_owner_user_id: newOwnerUserId }
      );
      return response.data;
    },
  };

  users = {
    // Search users by username or email (for adding players)
    async searchUsers(query: string): Promise<User[]> {
      const response = await this.client.get<{ users: User[] }>(
        '/api/v1/users/search',
        { params: { q: query } }
      );
      return response.data.users;
    },
  };
}
```

### 3.7 Frontend Custom Hooks

**Location**: `frontend/src/hooks/useGameManagement.ts`

```typescript
export function useRemovePlayer(gameId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId: number) =>
      apiClient.games.removePlayer(gameId, userId),
    onSuccess: () => {
      // Invalidate participants list
      queryClient.invalidateQueries({ queryKey: ['game-participants', gameId] });
      queryClient.invalidateQueries({ queryKey: ['inactive-characters', gameId] });
    },
  });
}

export function useAddPlayer(gameId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId: number) =>
      apiClient.games.addPlayerDirectly(gameId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['game-participants', gameId] });
    },
  });
}

export function useInactiveCharacters(gameId: number) {
  return useQuery({
    queryKey: ['inactive-characters', gameId],
    queryFn: () => apiClient.games.listInactiveCharacters(gameId),
    enabled: !!gameId,
  });
}

export function useReassignCharacter() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      characterId,
      newOwnerUserId,
    }: {
      characterId: number;
      newOwnerUserId: number;
    }) => apiClient.characters.reassignCharacter(characterId, newOwnerUserId),
    onSuccess: (data) => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['characters'] });
      queryClient.invalidateQueries({
        queryKey: ['inactive-characters', data.game_id],
      });
    },
  });
}

export function useSearchUsers(query: string) {
  return useQuery({
    queryKey: ['users-search', query],
    queryFn: () => apiClient.users.searchUsers(query),
    enabled: query.length >= 3, // Only search if query is 3+ characters
    staleTime: 30000, // Cache for 30 seconds
  });
}
```

### 3.8 Frontend Type Definitions

**Location**: `frontend/src/types/games.ts`

```typescript
// Update existing GameParticipant interface
export interface GameParticipant {
  id: number;
  game_id: number;
  user_id: number;
  status: string;
  role: string;
  application_text?: string;
  joined_at: string;
  created_at: string;
  updated_at: string;

  // New fields
  removed_at?: string;
  removed_by_user_id?: number;

  // Related data
  username?: string;
  email?: string;
}

// Update existing Character interface
export interface Character {
  id: number;
  game_id: number;
  user_id: number;
  name: string;
  character_type: string;
  status: string;
  character_sheet: any;
  created_at: string;
  updated_at: string;

  // New fields
  is_active: boolean;
  original_owner_user_id?: number;

  // Related data
  username?: string;
}

export interface AddPlayerRequest {
  user_id: number;
}

export interface ReassignCharacterRequest {
  new_owner_user_id: number;
}
```

---

## 4. Testing Strategy

### 4.1 Backend Tests

**Test Files:**
- `backend/pkg/db/services/games/player_management_test.go`
- `backend/pkg/db/services/characters/character_reassignment_test.go`
- `backend/pkg/games/api_test.go`

**Unit Tests:**
```go
func TestGameService_RemovePlayer(t *testing.T) {
    tests := []struct {
        name            string
        gameID          int32
        userID          int32
        removedByUserID int32
        setup           func(*MockDB)
        wantErr         bool
        errContains     string
    }{
        {
            name:            "GM can remove player",
            gameID:          1,
            userID:          100,
            removedByUserID: 50, // GM
            setup: func(db *MockDB) {
                db.Games[1] = &Game{ID: 1, GMUserID: 50}
                db.Participants[1] = &GameParticipant{
                    GameID: 1,
                    UserID: 100,
                }
            },
            wantErr: false,
        },
        {
            name:            "GM cannot remove themselves",
            gameID:          1,
            userID:          50, // GM trying to remove themselves
            removedByUserID: 50,
            setup: func(db *MockDB) {
                db.Games[1] = &Game{ID: 1, GMUserID: 50}
            },
            wantErr:     true,
            errContains: "cannot remove themselves",
        },
        {
            name:            "non-GM cannot remove player",
            gameID:          1,
            userID:          100,
            removedByUserID: 200,
            setup: func(db *MockDB) {
                db.Games[1] = &Game{ID: 1, GMUserID: 50}
            },
            wantErr:     true,
            errContains: "Only the GM",
        },
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            // Test implementation
        })
    }
}

func TestCharacterService_ReassignCharacter(t *testing.T) {
    tests := []struct {
        name             string
        characterID      int32
        newOwnerUserID   int32
        requestingUserID int32
        setup            func(*MockDB)
        wantErr          bool
        errContains      string
    }{
        {
            name:             "GM can reassign inactive character",
            characterID:      1,
            newOwnerUserID:   200,
            requestingUserID: 50, // GM
            setup: func(db *MockDB) {
                db.Games[1] = &Game{ID: 1, GMUserID: 50}
                db.Characters[1] = &Character{
                    ID:       1,
                    GameID:   1,
                    IsActive: false,
                }
                db.Participants[200] = &GameParticipant{
                    GameID: 1,
                    UserID: 200,
                    Role:   "audience",
                }
            },
            wantErr: false,
        },
        {
            name:             "cannot reassign active character",
            characterID:      1,
            newOwnerUserID:   200,
            requestingUserID: 50,
            setup: func(db *MockDB) {
                db.Characters[1] = &Character{
                    ID:       1,
                    IsActive: true,
                }
            },
            wantErr:     true,
            errContains: "only reassign inactive",
        },
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            // Test implementation
        })
    }
}
```

**Test Coverage Goals:**
- [ ] Service layer: >90% coverage (critical game management)
- [ ] Permission checks: 100% coverage
- [ ] API handlers: >85% coverage

### 4.2 Frontend Tests

**Test Files:**
- `frontend/src/components/__tests__/RemovePlayerButton.test.tsx`
- `frontend/src/components/__tests__/AddPlayerModal.test.tsx`
- `frontend/src/components/__tests__/ReassignCharacterModal.test.tsx`
- `frontend/src/hooks/__tests__/useGameManagement.test.ts`

**Component Tests:**
```typescript
describe('RemovePlayerButton', () => {
  it('shows confirmation dialog on click', async () => {
    const user = userEvent.setup();
    render(
      <RemovePlayerButton gameId={1} userId={100} username="player1" />
    );

    await user.click(screen.getByRole('button', { name: /remove/i }));

    expect(screen.getByText(/are you sure/i)).toBeInTheDocument();
  });

  it('calls API on confirm', async () => {
    const user = userEvent.setup();

    server.use(
      http.delete('/api/v1/games/1/participants/100', () => {
        return new HttpResponse(null, { status: 204 });
      })
    );

    render(
      <RemovePlayerButton gameId={1} userId={100} username="player1" />
    );

    await user.click(screen.getByRole('button', { name: /remove/i }));
    await user.click(screen.getByRole('button', { name: /confirm/i }));

    await waitFor(() => {
      expect(screen.queryByText(/are you sure/i)).not.toBeInTheDocument();
    });
  });
});

describe('AddPlayerModal', () => {
  it('searches for users by query', async () => {
    const user = userEvent.setup();

    server.use(
      http.get('/api/v1/users/search', ({ request }) => {
        const url = new URL(request.url);
        const query = url.searchParams.get('q');

        if (query === 'test') {
          return HttpResponse.json({
            users: [{ id: 123, username: 'testuser', email: 'test@example.com' }],
          });
        }
        return HttpResponse.json({ users: [] });
      })
    );

    render(<AddPlayerModal gameId={1} isOpen={true} onClose={vi.fn()} />);

    const searchInput = screen.getByRole('textbox');
    await user.type(searchInput, 'test');

    await waitFor(() => {
      expect(screen.getByText('testuser')).toBeInTheDocument();
    });
  });

  it('adds selected player to game', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    server.use(
      http.post('/api/v1/games/1/participants/direct-add', () => {
        return HttpResponse.json({
          id: 1,
          game_id: 1,
          user_id: 123,
          status: 'approved',
        });
      })
    );

    render(<AddPlayerModal gameId={1} isOpen={true} onClose={onClose} />);

    // Mock user selection and add
    // ...

    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
  });
});
```

**Test Coverage Goals:**
- [ ] Components: >85% coverage
- [ ] Player management flows: 100% coverage
- [ ] Character reassignment: 100% coverage

### 4.3 Regression Tests

**Critical Bugs to Prevent:**

1. **Bug**: Removing player deletes their character data
   - **Test**: `TestRemovePlayer_PreservesCharacterData`
   - **Location**: `backend/pkg/db/services/games/player_management_test.go`

2. **Bug**: Non-GM can remove players via API manipulation
   - **Test**: `TestRemovePlayer_EnforcesGMPermission`
   - **Location**: `backend/pkg/games/api_test.go`

3. **Bug**: Reassigning character to non-audience member
   - **Test**: `TestReassignCharacter_ValidatesNewOwner`
   - **Location**: `backend/pkg/db/services/characters/character_reassignment_test.go`

### 4.4 Manual UI Testing Checklist

**Happy Path Testing:**
- [ ] Log in as GM
- [ ] Remove a player from game
- [ ] Verify their characters are marked inactive
- [ ] Verify removed player cannot access game
- [ ] Reassign inactive character to yourself
- [ ] Verify character is now active and you can post as them
- [ ] Add a player directly to game
- [ ] Verify they immediately gain access

**Error Handling Testing:**
- [ ] Try to remove yourself as GM → Verify error message
- [ ] Try to add already-active player → Verify error message
- [ ] Try to reassign active character → Verify not available
- [ ] Log in as non-GM → Verify no remove/add/reassign buttons

**Edge Case Testing:**
- [ ] Remove player during active phase → Verify game continues
- [ ] Add player who was previously removed → Verify restored correctly
- [ ] Reassign character to audience member → Verify they can post

**UI/UX Testing:**
- [ ] Confirmation dialogs are clear and use warning colors
- [ ] Remove/add/reassign actions provide immediate feedback
- [ ] Inactive characters list only visible to GM
- [ ] Search for users is fast and responsive

**Notes Section:**
```
- Test with games in different states (recruitment, in_progress, paused)
- Verify removed player's notifications are cleaned up
- Check that character reassignment maintains all character sheet data
```

---

## 5. User Stories for E2E Testing (Future)

**Journey Name**: GM removes problematic player and reassigns their character

**User Goal**: Handle player removal and continue game smoothly

**Journey Steps**:
1. GM logs in and navigates to game
2. Opens participants list
3. Clicks "Remove Player" on problematic player
4. Sees confirmation dialog with warnings
5. Confirms removal
6. Player is removed from list
7. GM navigates to inactive characters section
8. Sees removed player's character as inactive
9. Clicks "Reassign Character"
10. Selects themselves as new owner
11. Character is now active and GM-controlled
12. GM posts as that character in common room

**Critical User Flows to Test**:
- [ ] **Flow 1**: Remove player → Reassign character → Post as character
- [ ] **Flow 2**: Add player directly → They create character → Game continues
- [ ] **Flow 3**: Remove player → Re-add them later → Characters restored

**E2E Test Priority**: High (Important GM workflow)

---

## 6. Implementation Plan

### Phase 1: Database & Backend Foundation
**Estimated Time**: 3 hours

- [ ] Create database migration files
  - [ ] `.up.sql` with new columns and indexes
  - [ ] `.down.sql` with rollback logic
- [ ] Update SQL queries in `queries/games.sql` and `queries/characters.sql`
- [ ] Run `just sqlgen` to regenerate models
- [ ] Update interfaces in `core/interfaces.go`
- [ ] Update models in `core/models.go`
- [ ] **Write unit tests first**
- [ ] Implement RemovePlayer method
- [ ] Implement AddPlayerDirectly method
- [ ] Implement ReassignCharacter method
- [ ] Implement DeactivateCharactersForUser method
- [ ] Run tests: `just test-mocks`

**Acceptance Criteria:**
- [ ] Migration applies and rolls back cleanly
- [ ] All unit tests passing
- [ ] Permission checks enforced

### Phase 2: API Endpoints
**Estimated Time**: 2 hours

- [ ] Implement DELETE /api/v1/games/:id/participants/:user_id
- [ ] Implement POST /api/v1/games/:id/participants/direct-add
- [ ] Implement PUT /api/v1/characters/:id/reassign
- [ ] Implement GET /api/v1/games/:id/characters/inactive
- [ ] Implement GET /api/v1/users/search (for user lookup)
- [ ] Add request validation
- [ ] **Write API integration tests**
- [ ] Test with database: `SKIP_DB_TESTS=false just test`

**Acceptance Criteria:**
- [ ] All endpoints working
- [ ] Permission checks enforced
- [ ] All API tests passing

### Phase 3: Frontend Implementation
**Estimated Time**: 5 hours

- [ ] Update types in `types/games.ts` and `types/characters.ts`
- [ ] Add API methods to `lib/api.ts`
- [ ] Create hooks in `hooks/useGameManagement.ts`
- [ ] **Write hook tests**
- [ ] Create `RemovePlayerButton` component (semantic theme tokens)
- [ ] Create `RemovePlayerConfirmDialog` component (semantic theme tokens, UI components)
- [ ] Create `AddPlayerModal` component (semantic theme tokens, UI components)
- [ ] Create `InactiveCharactersList` component (semantic theme tokens)
- [ ] Create `ReassignCharacterModal` component (semantic theme tokens, UI components)
- [ ] **Write component tests**
- [ ] Integrate into GameDetailsPage
- [ ] Style with Tailwind + semantic tokens
- [ ] Run tests: `just test-frontend`

**Acceptance Criteria:**
- [ ] All UI integrated and functional
- [ ] Uses semantic theme tokens
- [ ] Uses existing UI components (Button, Modal, Input, etc.)
- [ ] All frontend tests passing

### Phase 4: Manual Testing & Documentation
**Estimated Time**: 2 hours

- [ ] **Manual UI testing** (use checklist from Section 4.4)
  - [ ] Happy path: Remove, add, reassign
  - [ ] Error scenarios: Permission checks
  - [ ] Edge cases: Re-add removed player
- [ ] Performance testing
  - [ ] Actions are fast and responsive
  - [ ] No console errors
- [ ] Security review
  - [ ] Permission checks cannot be bypassed
  - [ ] Character data preserved correctly
- [ ] Documentation updates
  - [ ] Update API documentation
  - [ ] Document GM player management workflow

**Acceptance Criteria:**
- [ ] All manual test scenarios pass
- [ ] Security review complete
- [ ] Documentation updated

---

## 7. Rollout Strategy

### Deployment Checklist
- [ ] Database migration tested in staging
- [ ] Existing participants and characters unaffected
- [ ] Monitoring configured
- [ ] Rollback plan documented

### Rollback Plan
**If deployment fails:**

1. Rollback migration: `just migrate_down`
2. Revert backend code
3. Revert frontend code

**Rollback triggers:**
- Data corruption in participants/characters
- Critical permission bypass
- Performance degradation >40%

---

## 8. Monitoring & Observability

### Metrics to Track
- [ ] Player removals per day
- [ ] Direct player additions per day
- [ ] Character reassignments per day
- [ ] Failed permission checks

### Logging
- [ ] All player removals logged with GM ID
- [ ] All character reassignments logged
- [ ] Permission denials logged

### Alerts
- [ ] Failed permission checks >10/hour → Warning
- [ ] Player management endpoint latency p95 >500ms → Warning

---

## 9. Documentation

### User Documentation
- [ ] GM guide for managing players
- [ ] Character reassignment workflow
- [ ] Best practices for handling problem players

### Developer Documentation
- [ ] Document soft removal pattern
- [ ] Character reassignment flow diagram

---

## 10. Open Questions

**Technical Questions:**
- [x] Should removed players be notified? → Answer: Not in v1, future enhancement
- [x] Can removed players rejoin? → Answer: Yes, via re-adding them directly

---

## 11. Risks & Mitigations

### Technical Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Character data loss on removal | Low | Critical | Soft delete, preserve all data |
| Permission bypass | Low | High | Server-side validation always |
| Reassignment breaks game state | Low | Medium | Comprehensive testing |

---

## 12. Future Enhancements

**Post-MVP Ideas:**
- Enhancement 1: Notification to removed players
- Enhancement 2: Bulk player management
- Enhancement 3: Player transfer between games
- Enhancement 4: Removal appeals/review process

---

## 13. References

### Related Documentation
- `.claude/context/ARCHITECTURE.md` - Clean Architecture patterns
- ADR-002: Database Design Approach

---

## Completion Checklist

- [ ] All implementation phases complete
- [ ] All unit tests passing (>90% coverage)
- [ ] All integration tests passing
- [ ] All frontend component tests passing
- [ ] Manual UI testing checklist complete
- [ ] User journeys documented for future E2E tests
- [ ] Code reviewed
- [ ] Documentation updated
- [ ] Deployed to staging
- [ ] Manual testing in staging complete
- [ ] Deployed to production
- [ ] Monitoring confirmed working

**Archive this plan to** `.claude/planning/archive/` **when complete.**
