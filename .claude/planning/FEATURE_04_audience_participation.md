# Feature: Audience Participation

**Status**: Planning
**Created**: 2025-10-21
**Last Updated**: 2025-10-21
**Owner**: AI Session
**Related ADRs**: ADR-002 (Database Design), ADR-005 (Frontend State Management)
**Related Issues**: N/A
**Dependencies**: Feature 03 (GM Player Management) - character reassignment functionality

---

## 1. Overview

### Problem Statement
**What problem does this feature solve?**

Many games have spectators who want to follow the story but don't want the commitment of playing a full character. Additionally, GMs often need help controlling NPCs (non-player characters) to enrich the game world. Currently:
- Users can only join as full players or not at all
- GMs must control all NPCs themselves (one GM controlling 20+ NPCs is overwhelming)
- Spectators have no legitimate way to observe games
- GMs cannot delegate NPC control to trusted helpers
- No way to view all private message conversations for moderation/story oversight

### Goals
**What are we trying to achieve?**

- [ ] Goal 1: Allow users to apply as "audience" members instead of players
- [ ] Goal 2: After recruitment ends, ONLY allow audience applications
- [ ] Goal 3: Audience members can control multiple NPC characters
- [ ] Goal 4: Audience NPCs can post in common room and reply to private messages
- [ ] Goal 5: Audience NPCs NEVER submit actions
- [ ] Goal 6: Provide read-only "All Private Messages" tab for audience members and GM
- [ ] Goal 7: Allow GM to post as audience NPCs when needed
- [ ] Goal 8: Allow GM to set per-game auto-accept setting for audience applications
- [ ] Goal 9: Audience members receive notifications for activity
- [ ] Goal 10: Audience members appear in roster with special "Audience" label
- [ ] Goal 11: Audience members have same unread comment tracking as players
- [ ] Goal 12: Audience members can view player action submissions (read-only)
- [ ] Goal 13: Provide read-only "All Action Submissions" view for audience members and GM

### Non-Goals
**What is explicitly out of scope?**

- Non-goal 1: Audience members submitting actions (explicitly forbidden)
- Non-goal 2: Audience member promotion to player (use remove + re-add workflow)
- Non-goal 3: Audience chat/discussion features separate from game
- Non-goal 4: Audience member limits (can have unlimited audience members)
- Non-goal 5: Audience members editing or deleting action submissions

### Success Criteria
**How do we know this feature is successful?**

- [ ] Users can apply as audience member during and after recruitment
- [ ] Audience members can be assigned multiple NPC characters
- [ ] Audience can post as their NPCs in common room
- [ ] Audience can reply to private messages as their NPCs
- [ ] "All Private Messages" tab shows read-only view of all conversations
- [ ] "All Action Submissions" tab shows read-only view of all player actions
- [ ] GM can post as any audience NPC character
- [ ] Auto-accept audience setting works correctly
- [ ] Audience members appear in participant list with clear label
- [ ] Audience members receive notifications
- [ ] Unread comment tracking works for audience
- [ ] Audience can view action submissions but cannot edit or submit
- [ ] Unit test coverage: >85% for service layer
- [ ] Integration tests: All API endpoints tested
- [ ] Component test coverage: >85% for frontend
- [ ] All regression tests passing
- [ ] Manual UI testing complete with documented flows

---

## 2. User Stories

### Primary User Stories

```gherkin
As a user
I want to apply to join a game as an audience member
So that I can follow the story without the commitment of playing

Acceptance Criteria:
- Given I am viewing a game
  When I click "Apply to Join"
  Then I see options for "Player" or "Audience"
  And when I select "Audience" and submit
  Then my application is submitted with role = "audience"
  And if auto-accept is enabled, I'm automatically approved
```

```gherkin
As a GM
I want to assign NPCs to audience members
So that they can help me bring the game world to life

Acceptance Criteria:
- Given I have approved audience members
  When I assign an NPC character to an audience member
  Then that character shows as assigned to them
  And they can post as that character in common room
  And they can reply to private messages as that character
  And I can still post as that character if needed
```

```gherkin
As an audience member
I want to view all private message conversations
So that I can follow the full story and help with continuity

Acceptance Criteria:
- Given I am an audience member
  When I navigate to the "All Private Messages" tab
  Then I see a read-only list of all conversations
  And I can filter by character
  And I can infinite scroll to load more
  And I cannot create, edit, or delete messages in this view
```

```gherkin
As an audience member controlling an NPC
I want to participate in private conversations
So that I can roleplay as my assigned character

Acceptance Criteria:
- Given I control an NPC character
  When I go to the normal "Messages" tab
  Then I can create new conversations as my NPC
  And I can reply to existing conversations
  And I receive notifications for new messages to my NPC
```

```gherkin
As an audience member
I want to view all player action submissions
So that I can follow the full story and understand what players are doing

Acceptance Criteria:
- Given I am an audience member
  When I navigate to the "All Action Submissions" tab
  Then I see a read-only list of all action submissions
  And I can filter by character or phase
  And I can infinite scroll to load more
  And I cannot create, edit, or delete action submissions
  And I see action status (draft, submitted, result posted)
```

```gherkin
As a GM
I want to enable auto-accept for audience applications
So that spectators can join immediately without my approval

Acceptance Criteria:
- Given I am editing game settings
  When I enable "Auto-accept audience applications"
  Then all new audience applications are automatically approved
  And applicants immediately gain audience access
  And I receive a notification about new audience members
```

### Edge Cases & Error Scenarios

- **Edge Case 1**: User is player in game A, applies as audience in game B → Should work (different games)
- **Edge Case 2**: Recruitment ends, user tries to apply as player → Only "Audience" option available
- **Edge Case 3**: Audience member assigned 13 NPCs → Should handle gracefully (tested scenario)
- **Edge Case 4**: GM and audience both post as same NPC simultaneously → Last write wins, both posts visible
- **Edge Case 5**: Remove audience member → Their NPCs become inactive, can be reassigned
- **Edge Case 6**: No private messages exist → "All PM" tab shows empty state
- **Edge Case 7**: No action submissions exist → "All Actions" tab shows empty state
- **Edge Case 8**: Player submits action while audience viewing → Action appears in real-time (after refresh/poll)
- **Error Scenario 1**: Non-participant tries to access "All PM" tab → 403 Forbidden
- **Error Scenario 2**: Audience member tries to submit action → 403 Forbidden (no submit UI shown)
- **Error Scenario 3**: Non-audience/GM tries to access "All Actions" tab → 403 Forbidden
- **Error Scenario 4**: Audience member tries to edit action submission → No edit UI shown, API returns 403

---

## 3. Technical Design

### 3.1 Database Schema

**Schema Modifications:**

```sql
-- Add role column to game_participants (if not exists)
-- This should already exist, but add if needed:
-- ALTER TABLE game_participants ADD COLUMN role VARCHAR(50) DEFAULT 'player' NOT NULL;

-- Update role to have audience as valid value
-- (No schema change needed, just validate in application)

-- Add auto_accept_audience column to games
ALTER TABLE games ADD COLUMN auto_accept_audience BOOLEAN DEFAULT FALSE NOT NULL;

-- Add character type for audience NPCs (already have 'npc_gm', add 'npc_audience')
-- (No schema change needed, character_type is already flexible)

-- Create index for filtering by role
CREATE INDEX idx_game_participants_role ON game_participants(game_id, role);

-- Create index for finding audience NPCs
CREATE INDEX idx_characters_audience ON characters(game_id, character_type)
WHERE character_type = 'npc_audience';
```

**Migration Plan:**
1. Migration file: `[timestamp]_add_audience_support.up.sql`
2. Rollback file: `[timestamp]_add_audience_support.down.sql`
3. Data migration strategy: Existing participants default to role='player'

### 3.2 Database Queries (sqlc)

**Location**: `backend/pkg/db/queries/games.sql`, `backend/pkg/db/queries/characters.sql`, `backend/pkg/db/queries/messages.sql`

```sql
-- name: CreateAudienceApplication :one
INSERT INTO game_participants (
    game_id,
    user_id,
    role,
    status,
    application_text
) VALUES (
    $1,  -- game_id
    $2,  -- user_id
    'audience',
    $3,  -- status ('pending' or 'approved' if auto-accept)
    $4   -- application_text
) RETURNING *;

-- name: ListAudienceMembers :many
SELECT gp.*, u.username, u.email
FROM game_participants gp
JOIN users u ON gp.user_id = u.id
WHERE gp.game_id = $1
  AND gp.role = 'audience'
  AND gp.status = 'approved'
  AND gp.removed_at IS NULL
ORDER BY gp.joined_at ASC;

-- name: ListAudienceNPCs :many
SELECT c.*, u.username
FROM characters c
JOIN users u ON c.user_id = u.id
WHERE c.game_id = $1
  AND c.character_type = 'npc_audience'
  AND c.is_active = TRUE
ORDER BY u.username, c.name;

-- name: AssignNPCToAudience :exec
UPDATE characters
SET user_id = $1,
    character_type = 'npc_audience',
    is_active = TRUE,
    updated_at = NOW()
WHERE id = $2;

-- name: GetGameAutoAcceptAudience :one
SELECT auto_accept_audience
FROM games
WHERE id = $1;

-- name: UpdateGameAutoAcceptAudience :exec
UPDATE games
SET auto_accept_audience = $1,
    updated_at = NOW()
WHERE id = $2;

-- name: ListAllPrivateConversations :many
-- Get all private message conversations in a game
SELECT DISTINCT ON (pm.conversation_id)
    pm.conversation_id,
    pm.game_id,
    pm.from_character_id,
    pm.to_character_id,
    pm.subject,
    pm.created_at,
    pm.updated_at,
    fc.name as from_character_name,
    tc.name as to_character_name,
    fu.username as from_username,
    tu.username as to_username,
    (SELECT COUNT(*) FROM private_messages WHERE conversation_id = pm.conversation_id) as message_count,
    (SELECT MAX(created_at) FROM private_messages WHERE conversation_id = pm.conversation_id) as last_message_at
FROM private_messages pm
LEFT JOIN characters fc ON pm.from_character_id = fc.id
LEFT JOIN characters tc ON pm.to_character_id = tc.id
LEFT JOIN users fu ON fc.user_id = fu.id
LEFT JOIN users tu ON tc.user_id = tu.id
WHERE pm.game_id = $1
ORDER BY pm.conversation_id, pm.created_at DESC;

-- name: GetConversationMessages :many
-- Get all messages in a conversation (for All PM view)
SELECT
    pm.*,
    c.name as character_name,
    u.username
FROM private_messages pm
JOIN characters c ON pm.from_character_id = c.id
JOIN users u ON c.user_id = u.id
WHERE pm.conversation_id = $1
ORDER BY pm.created_at ASC;

-- name: CheckAudienceAccess :one
SELECT COUNT(*) as has_access
FROM game_participants
WHERE game_id = $1
  AND user_id = $2
  AND (role = 'audience' OR role = 'gm')
  AND status = 'approved'
  AND removed_at IS NULL;

-- name: ListAllActionSubmissions :many
-- Get all action submissions in a game (for All Actions view)
SELECT
    a.id,
    a.game_id,
    a.phase_id,
    a.character_id,
    a.content,
    a.status,
    a.submitted_at,
    a.created_at,
    a.updated_at,
    c.name as character_name,
    u.username,
    p.name as phase_name,
    p.phase_number
FROM action_submissions a
JOIN characters c ON a.character_id = c.id
JOIN users u ON c.user_id = u.id
JOIN phases p ON a.phase_id = p.id
WHERE a.game_id = $1
  AND a.status != 'draft'  -- Only show submitted actions, not drafts
ORDER BY a.submitted_at DESC
LIMIT $2
OFFSET $3;

-- name: CountAllActionSubmissions :one
-- Count all action submissions for pagination
SELECT COUNT(*) as total
FROM action_submissions
WHERE game_id = $1
  AND status != 'draft';
```

**Query Performance Considerations:**
- [x] Index on (game_id, role) for filtering audience members
- [x] Index on (game_id, character_type) for finding audience NPCs
- [x] Pagination for All PM view (infinite scroll)
- [x] Filter option for All PM view to reduce query load

### 3.3 Backend Service Layer

**Service Interface** (`backend/pkg/core/interfaces.go`):

```go
// Add to existing GameServiceInterface
type GameServiceInterface interface {
    // ... existing methods ...

    // Audience management
    ApplyAsAudience(ctx context.Context, gameID int32, userID int32, applicationText string) (*GameParticipant, error)
    ListAudienceMembers(ctx context.Context, gameID int32) ([]*ParticipantWithUser, error)
    SetAutoAcceptAudience(ctx context.Context, gameID int32, autoAccept bool) error
    GetAutoAcceptAudience(ctx context.Context, gameID int32) (bool, error)
}

// Add to existing CharacterServiceInterface
type CharacterServiceInterface interface {
    // ... existing methods ...

    // Audience NPC management
    AssignNPCToAudience(ctx context.Context, characterID int32, audienceUserID int32, gmUserID int32) error
    ListAudienceNPCs(ctx context.Context, gameID int32) ([]*Character, error)
}

// Add to existing MessageServiceInterface
type MessageServiceInterface interface {
    // ... existing methods ...

    // All private messages view
    ListAllPrivateConversations(ctx context.Context, gameID int32, userID int32, limit int, offset int) ([]*ConversationSummary, error)
    GetConversationMessages(ctx context.Context, conversationID string, userID int32) ([]*PrivateMessage, error)
    CheckUserCanViewAllMessages(ctx context.Context, gameID int32, userID int32) (bool, error)
}

// Add to existing ActionServiceInterface
type ActionServiceInterface interface {
    // ... existing methods ...

    // All action submissions view
    ListAllActionSubmissions(ctx context.Context, gameID int32, userID int32, limit int, offset int) ([]*ActionSubmissionWithDetails, int, error)
    CheckUserCanViewAllActions(ctx context.Context, gameID int32, userID int32) (bool, error)
}
```

**Domain Models** (`backend/pkg/core/models.go`):

```go
// Update existing GameParticipant (role field should already exist)
type GameParticipant struct {
    ID              int32      `json:"id"`
    GameID          int32      `json:"game_id"`
    UserID          int32      `json:"user_id"`
    Status          string     `json:"status"` // pending, approved, rejected
    Role            string     `json:"role"`   // player, audience, gm
    ApplicationText *string    `json:"application_text,omitempty"`
    JoinedAt        time.Time  `json:"joined_at"`
    CreatedAt       time.Time  `json:"created_at"`
    UpdatedAt       time.Time  `json:"updated_at"`
}

// Add conversation summary for All PM view
type ConversationSummary struct {
    ConversationID     string     `json:"conversation_id"`
    GameID             int32      `json:"game_id"`
    FromCharacterID    int32      `json:"from_character_id"`
    ToCharacterID      int32      `json:"to_character_id"`
    Subject            string     `json:"subject"`
    FromCharacterName  string     `json:"from_character_name"`
    ToCharacterName    string     `json:"to_character_name"`
    FromUsername       string     `json:"from_username"`
    ToUsername         string     `json:"to_username"`
    MessageCount       int        `json:"message_count"`
    LastMessageAt      time.Time  `json:"last_message_at"`
    CreatedAt          time.Time  `json:"created_at"`
}

type AudienceApplicationRequest struct {
    ApplicationText string `json:"application_text" validate:"required,min=10,max=1000"`
}

type ActionSubmissionWithDetails struct {
    ID            int32      `json:"id"`
    GameID        int32      `json:"game_id"`
    PhaseID       int32      `json:"phase_id"`
    CharacterID   int32      `json:"character_id"`
    Content       string     `json:"content"`
    Status        string     `json:"status"` // draft, submitted, result_posted
    SubmittedAt   *time.Time `json:"submitted_at,omitempty"`
    CreatedAt     time.Time  `json:"created_at"`
    UpdatedAt     time.Time  `json:"updated_at"`
    CharacterName string     `json:"character_name"`
    Username      string     `json:"username"`
    PhaseName     string     `json:"phase_name"`
    PhaseNumber   int        `json:"phase_number"`
}
```

**Business Rules:**

1. **Users can apply as audience during or after recruitment**
   - Validation: No special validation needed
   - Implementation: Allow audience applications in any game state

2. **After recruitment ends, ONLY audience applications allowed**
   - Validation: If game state != 'recruitment', only allow role='audience'
   - Error: "Game is no longer recruiting players. You may apply as an audience member."

3. **Auto-accept audience setting applies immediately**
   - Implementation: If auto_accept_audience = TRUE, set status = 'approved' on insert
   - No GM approval needed

4. **Audience members can be assigned multiple NPCs**
   - Implementation: No limit on number of npc_audience characters per user
   - Tested with 13 NPCs for one user

5. **Only GM or audience can access All PM view**
   - Validation: Check user has role='gm' OR role='audience' in game
   - Error: "Only GM and audience members can view all private messages"

6. **Audience NPCs cannot submit actions**
   - Validation: Check character_type != 'npc_audience' when submitting action
   - Error: "Audience NPCs cannot submit actions"

7. **GM can post as any audience NPC**
   - Implementation: Check if user is GM when posting as npc_audience character
   - Allow both GM and assigned audience member to post

8. **Audience members receive notifications**
   - Implementation: Include audience members in notification queries for common room, private messages
   - Same unread tracking as players

9. **Only GM or audience can access All Actions view**
   - Validation: Check user has role='gm' OR role='audience' in game
   - Error: "Only GM and audience members can view all action submissions"

10. **Audience can view submitted actions but not drafts**
    - Implementation: Filter action_submissions WHERE status != 'draft'
    - Drafts are private to the submitting player

11. **Audience cannot edit or delete action submissions**
    - Validation: Check user role when attempting to modify actions
    - Error: "Audience members cannot edit action submissions"

---

### 3.4 API Endpoints

**Base Path**: `/api/v1/games/:game_id`

#### POST /api/v1/games/:game_id/apply/audience
**Description**: Apply to join game as audience member
**Auth Required**: Yes
**Permissions**: Any authenticated user (not already participant)

**Request Body:**
```json
{
  "application_text": "I'd love to follow this campaign and help with NPC roleplay!"
}
```

**Response (201 Created):**
```json
{
  "id": 123,
  "game_id": 456,
  "user_id": 789,
  "role": "audience",
  "status": "approved",
  "application_text": "I'd love to follow this campaign...",
  "joined_at": "2025-10-21T10:00:00Z",
  "created_at": "2025-10-21T10:00:00Z"
}
```

**Error Responses:**
- `400 Bad Request`: Validation error (application text too short)
- `401 Unauthorized`: No valid authentication token
- `409 Conflict`: User is already a participant
- `500 Internal Server Error`: Database error

---

#### GET /api/v1/games/:game_id/audience
**Description**: List all audience members in the game
**Auth Required**: Yes
**Permissions**: User must have access to the game

**Response (200 OK):**
```json
{
  "audience_members": [
    {
      "id": 1,
      "game_id": 456,
      "user_id": 789,
      "username": "audience_user1",
      "role": "audience",
      "status": "approved",
      "joined_at": "2025-10-21T10:00:00Z"
    }
  ]
}
```

---

#### GET /api/v1/games/:game_id/characters/audience-npcs
**Description**: List all audience-controlled NPCs
**Auth Required**: Yes
**Permissions**: User must have access to the game

**Response (200 OK):**
```json
{
  "npcs": [
    {
      "id": 123,
      "game_id": 456,
      "user_id": 789,
      "username": "audience_user1",
      "name": "Shopkeeper",
      "character_type": "npc_audience",
      "is_active": true
    }
  ]
}
```

---

#### PUT /api/v1/games/:game_id/settings/auto-accept-audience
**Description**: Enable/disable auto-accept for audience applications
**Auth Required**: Yes
**Permissions**: User must be GM

**Request Body:**
```json
{
  "auto_accept_audience": true
}
```

**Response (200 OK):**
```json
{
  "message": "Auto-accept audience setting updated"
}
```

---

#### GET /api/v1/games/:game_id/private-messages/all
**Description**: Get all private message conversations (read-only view for GM/audience)
**Auth Required**: Yes
**Permissions**: User must be GM or audience member

**Query Parameters:**
- `limit` (int, optional): Number of results (default: 10)
- `offset` (int, optional): Pagination offset (default: 0)
- `character_id` (int, optional): Filter by character involved

**Response (200 OK):**
```json
{
  "conversations": [
    {
      "conversation_id": "uuid-here",
      "game_id": 456,
      "from_character_id": 100,
      "to_character_id": 101,
      "subject": "Secret Meeting",
      "from_character_name": "Detective Kane",
      "to_character_name": "The Informant",
      "from_username": "player1",
      "to_username": "player2",
      "message_count": 5,
      "last_message_at": "2025-10-21T15:00:00Z",
      "created_at": "2025-10-21T10:00:00Z"
    }
  ],
  "total": 25
}
```

---

#### GET /api/v1/private-messages/conversation/:conversation_id/all
**Description**: Get all messages in a conversation (for All PM view)
**Auth Required**: Yes
**Permissions**: User must be GM or audience member of the game

**Response (200 OK):**
```json
{
  "messages": [
    {
      "id": 1,
      "conversation_id": "uuid",
      "from_character_id": 100,
      "character_name": "Detective Kane",
      "username": "player1",
      "content": "I have information about the case...",
      "created_at": "2025-10-21T10:00:00Z"
    }
  ]
}
```

---

#### GET /api/v1/games/:game_id/action-submissions/all
**Description**: Get all action submissions (read-only view for GM/audience)
**Auth Required**: Yes
**Permissions**: User must be GM or audience member

**Query Parameters:**
- `limit` (int, optional): Number of results (default: 10)
- `offset` (int, optional): Pagination offset (default: 0)
- `character_id` (int, optional): Filter by character
- `phase_id` (int, optional): Filter by phase

**Response (200 OK):**
```json
{
  "action_submissions": [
    {
      "id": 123,
      "game_id": 456,
      "phase_id": 789,
      "character_id": 100,
      "content": "I investigate the mysterious door...",
      "status": "submitted",
      "submitted_at": "2025-10-21T15:00:00Z",
      "created_at": "2025-10-21T14:00:00Z",
      "updated_at": "2025-10-21T15:00:00Z",
      "character_name": "Detective Kane",
      "username": "player1",
      "phase_name": "Investigation Phase",
      "phase_number": 3
    }
  ],
  "total": 45
}
```

**Error Responses:**
- `401 Unauthorized`: No valid authentication token
- `403 Forbidden`: User is not GM or audience member
- `404 Not Found`: Game doesn't exist
- `500 Internal Server Error`: Database error

---

### 3.5 Frontend Components

**Component Hierarchy:**

```
[GameDetailsPage]
├── [TabNavigation]
│   ├── [AllPrivateMessagesTab] (new)
│   ├── [AllActionSubmissionsTab] (new)
│   └── [existing tabs]
├── [AllPrivateMessagesView] (new)
│   ├── [ConversationList] (new)
│   │   └── [ConversationCard] (new)
│   └── [ConversationMessagesView] (new)
│       └── [MessageBubble] (reuse existing)
└── [AllActionSubmissionsView] (new)
    ├── [ActionSubmissionList] (new)
    │   └── [ActionSubmissionCard] (new)
    └── [ActionSubmissionFilters] (new)

[GameApplicationModal] (existing - updates)
├── [ApplicationTypeSelector] (new)
└── [ApplicationForm] (existing)

[GameSettingsPage] (existing - updates)
└── [AutoAcceptAudienceToggle] (new)

[ParticipantsList] (existing - updates)
└── [AudienceMemberBadge] (new)

[CharacterAssignmentModal] (new)
└── [AudienceMemberSelector] (new)
```

**Component Specifications:**

#### Component: `ApplicationTypeSelector`
**Location**: `frontend/src/components/game/ApplicationTypeSelector.tsx`
**Purpose**: Allow user to choose between player or audience application

**Props:**
```typescript
interface ApplicationTypeSelectorProps {
  gameState: string;
  selectedType: 'player' | 'audience';
  onTypeChange: (type: 'player' | 'audience') => void;
}
```

**Rendering:**
- If gameState === 'recruitment', show both options
- If gameState !== 'recruitment', only show "Audience" option
- Use semantic theme tokens for selection highlighting

---

#### Component: `AllPrivateMessagesView`
**Location**: `frontend/src/components/messages/AllPrivateMessagesView.tsx`
**Purpose**: Read-only view of all private message conversations

**Props:**
```typescript
interface AllPrivateMessagesViewProps {
  gameId: number;
}
```

**State:**
- Server state: Uses `useAllPrivateConversations` query
- Local state: `selectedConversation` (string | null), `characterFilter` (number | null)

**Features:**
- Infinite scroll for conversations list
- Filter by character
- Click conversation → View messages in that conversation
- Read-only (no create/reply buttons)
- Visual indicator that this is read-only mode

---

#### Component: `ConversationList`
**Location**: `frontend/src/components/messages/ConversationList.tsx`
**Purpose**: List of conversation summaries with infinite scroll

**Props:**
```typescript
interface ConversationListProps {
  gameId: number;
  onSelectConversation: (conversationId: string) => void;
  characterFilter?: number;
}
```

**Features:**
- Infinite scroll using Intersection Observer
- Shows last message timestamp
- Shows message count
- Highlights selected conversation

---

#### Component: `AudienceMemberBadge`
**Location**: `frontend/src/components/game/AudienceMemberBadge.tsx`
**Purpose**: Visual badge showing "Audience" label on participants

**Props:**
```typescript
interface AudienceMemberBadgeProps {
  // No props, just a styled badge
}
```

**Rendering:**
- Small badge with semantic info colors
- Text: "Audience"
- Positioned next to username

---

#### Component: `CharacterAssignmentModal`
**Location**: `frontend/src/components/characters/CharacterAssignmentModal.tsx`
**Purpose**: Assign inactive NPC to audience member

**Props:**
```typescript
interface CharacterAssignmentModalProps {
  character: Character;
  gameId: number;
  isOpen: boolean;
  onClose: () => void;
}
```

**State:**
- Server state: Uses `useAudienceMembers` query, `useAssignNPCToAudience` mutation
- Local state: `selectedAudienceUserId` (number | null)

**Features:**
- Dropdown of audience members
- Shows how many NPCs each already controls
- Confirm button
- Uses semantic theme tokens and UI components

---

#### Component: `AllActionSubmissionsView`
**Location**: `frontend/src/components/actions/AllActionSubmissionsView.tsx`
**Purpose**: Read-only view of all action submissions for audience and GM

**Props:**
```typescript
interface AllActionSubmissionsViewProps {
  gameId: number;
}
```

**State:**
- Server state: Uses `useAllActionSubmissions` infinite query
- Local state: `characterFilter` (number | null), `phaseFilter` (number | null)

**Features:**
- Infinite scroll for action submissions list
- Filter by character and/or phase
- Shows action status (draft, submitted, result_posted)
- Read-only (no create/edit/delete buttons)
- Visual indicator that this is read-only mode
- Displays character name, phase name, and submission date

**Styling:**
- Use semantic theme tokens
- Clear "Read-Only" badge at top
- Action cards with status badges (submitted = info color, result_posted = success color)

---

#### Component: `ActionSubmissionCard`
**Location**: `frontend/src/components/actions/ActionSubmissionCard.tsx`
**Purpose**: Display individual action submission

**Props:**
```typescript
interface ActionSubmissionCardProps {
  actionSubmission: ActionSubmissionWithDetails;
  isReadOnly?: boolean;
}
```

**Features:**
- Shows character name and username
- Shows phase name and number
- Shows action content (markdown formatted)
- Shows status badge
- Shows submitted timestamp
- No edit/delete buttons when isReadOnly=true

---

### 3.6 Frontend API Client

**Location**: `frontend/src/lib/api.ts`

```typescript
class ApiClient {
  games = {
    // ... existing methods ...

    // Apply as audience
    async applyAsAudience(
      gameId: number,
      applicationText: string
    ): Promise<GameParticipant> {
      const response = await this.client.post<GameParticipant>(
        `/api/v1/games/${gameId}/apply/audience`,
        { application_text: applicationText }
      );
      return response.data;
    },

    // List audience members
    async listAudienceMembers(gameId: number): Promise<ParticipantWithUser[]> {
      const response = await this.client.get<{
        audience_members: ParticipantWithUser[];
      }>(`/api/v1/games/${gameId}/audience`);
      return response.data.audience_members;
    },

    // Set auto-accept audience
    async setAutoAcceptAudience(
      gameId: number,
      autoAccept: boolean
    ): Promise<void> {
      await this.client.put(
        `/api/v1/games/${gameId}/settings/auto-accept-audience`,
        { auto_accept_audience: autoAccept }
      );
    },
  };

  characters = {
    // ... existing methods ...

    // List audience NPCs
    async listAudienceNPCs(gameId: number): Promise<Character[]> {
      const response = await this.client.get<{ npcs: Character[] }>(
        `/api/v1/games/${gameId}/characters/audience-npcs`
      );
      return response.data.npcs;
    },

    // Assign NPC to audience
    async assignNPCToAudience(
      gameId: number,
      characterId: number,
      audienceUserId: number
    ): Promise<void> {
      await this.client.put(
        `/api/v1/games/${gameId}/characters/${characterId}/assign-audience`,
        { audience_user_id: audienceUserId }
      );
    },
  };

  privateMessages = {
    // ... existing methods ...

    // Get all conversations (for GM/audience)
    async getAllConversations(
      gameId: number,
      options?: {
        limit?: number;
        offset?: number;
        characterId?: number;
      }
    ): Promise<{ conversations: ConversationSummary[]; total: number }> {
      const response = await this.client.get<{
        conversations: ConversationSummary[];
        total: number;
      }>(`/api/v1/games/${gameId}/private-messages/all`, {
        params: options,
      });
      return response.data;
    },

    // Get conversation messages (for All PM view)
    async getConversationMessages(
      conversationId: string
    ): Promise<PrivateMessage[]> {
      const response = await this.client.get<{ messages: PrivateMessage[] }>(
        `/api/v1/private-messages/conversation/${conversationId}/all`
      );
      return response.data.messages;
    },
  };

  actions = {
    // ... existing methods ...

    // Get all action submissions (for GM/audience)
    async getAllActionSubmissions(
      gameId: number,
      options?: {
        limit?: number;
        offset?: number;
        characterId?: number;
        phaseId?: number;
      }
    ): Promise<{ action_submissions: ActionSubmissionWithDetails[]; total: number }> {
      const response = await this.client.get<{
        action_submissions: ActionSubmissionWithDetails[];
        total: number;
      }>(`/api/v1/games/${gameId}/action-submissions/all`, {
        params: options,
      });
      return response.data;
    },
  };
}
```

### 3.7 Frontend Custom Hooks

**Location**: `frontend/src/hooks/useAudience.ts`

```typescript
export function useApplyAsAudience(gameId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (applicationText: string) =>
      apiClient.games.applyAsAudience(gameId, applicationText),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['game-participants', gameId] });
      queryClient.invalidateQueries({ queryKey: ['audience-members', gameId] });
    },
  });
}

export function useAudienceMembers(gameId: number) {
  return useQuery({
    queryKey: ['audience-members', gameId],
    queryFn: () => apiClient.games.listAudienceMembers(gameId),
    enabled: !!gameId,
  });
}

export function useAudienceNPCs(gameId: number) {
  return useQuery({
    queryKey: ['audience-npcs', gameId],
    queryFn: () => apiClient.characters.listAudienceNPCs(gameId),
    enabled: !!gameId,
  });
}

export function useAssignNPCToAudience(gameId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      characterId,
      audienceUserId,
    }: {
      characterId: number;
      audienceUserId: number;
    }) =>
      apiClient.characters.assignNPCToAudience(
        gameId,
        characterId,
        audienceUserId
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['audience-npcs', gameId] });
      queryClient.invalidateQueries({ queryKey: ['characters', gameId] });
    },
  });
}

export function useAllPrivateConversations(
  gameId: number,
  options?: { limit?: number; offset?: number; characterId?: number }
) {
  return useInfiniteQuery({
    queryKey: ['all-private-conversations', gameId, options],
    queryFn: ({ pageParam = 0 }) =>
      apiClient.privateMessages.getAllConversations(gameId, {
        ...options,
        offset: pageParam,
      }),
    getNextPageParam: (lastPage, pages) => {
      const loadedCount = pages.reduce(
        (sum, page) => sum + page.conversations.length,
        0
      );
      return loadedCount < lastPage.total ? loadedCount : undefined;
    },
  });
}

export function useConversationMessages(conversationId: string) {
  return useQuery({
    queryKey: ['conversation-messages', conversationId],
    queryFn: () =>
      apiClient.privateMessages.getConversationMessages(conversationId),
    enabled: !!conversationId,
  });
}

export function useAllActionSubmissions(
  gameId: number,
  options?: { characterId?: number; phaseId?: number }
) {
  return useInfiniteQuery({
    queryKey: ['all-action-submissions', gameId, options],
    queryFn: ({ pageParam = 0 }) =>
      apiClient.actions.getAllActionSubmissions(gameId, {
        ...options,
        offset: pageParam,
        limit: 10,
      }),
    getNextPageParam: (lastPage, pages) => {
      const loadedCount = pages.reduce(
        (sum, page) => sum + page.action_submissions.length,
        0
      );
      return loadedCount < lastPage.total ? loadedCount : undefined;
    },
  });
}
```

### 3.8 Frontend Type Definitions

**Location**: `frontend/src/types/games.ts` and `frontend/src/types/messages.ts`

```typescript
// Update GameParticipant (in games.ts)
export interface GameParticipant {
  id: number;
  game_id: number;
  user_id: number;
  status: string;
  role: 'player' | 'audience' | 'gm';
  application_text?: string;
  joined_at: string;
  created_at: string;
  updated_at: string;

  // Related data
  username?: string;
  email?: string;
}

// Add to messages.ts
export interface ConversationSummary {
  conversation_id: string;
  game_id: number;
  from_character_id: number;
  to_character_id: number;
  subject: string;
  from_character_name: string;
  to_character_name: string;
  from_username: string;
  to_username: string;
  message_count: number;
  last_message_at: string;
  created_at: string;
}

export interface AudienceApplicationRequest {
  application_text: string;
}

export interface ActionSubmissionWithDetails {
  id: number;
  game_id: number;
  phase_id: number;
  character_id: number;
  content: string;
  status: 'draft' | 'submitted' | 'result_posted';
  submitted_at?: string;
  created_at: string;
  updated_at: string;
  character_name: string;
  username: string;
  phase_name: string;
  phase_number: number;
}
```

---

## 4. Testing Strategy

### 4.1 Backend Tests

**Test Files:**
- `backend/pkg/db/services/games/audience_test.go`
- `backend/pkg/db/services/characters/audience_npcs_test.go`
- `backend/pkg/db/services/messages/all_messages_view_test.go`

**Unit Tests:**
```go
func TestGameService_ApplyAsAudience(t *testing.T) {
    tests := []struct {
        name            string
        gameID          int32
        userID          int32
        applicationText string
        autoAccept      bool
        wantStatus      string
        wantErr         bool
    }{
        {
            name:            "auto-accept enabled",
            gameID:          1,
            userID:          100,
            applicationText: "I'd love to follow!",
            autoAccept:      true,
            wantStatus:      "approved",
            wantErr:         false,
        },
        {
            name:            "auto-accept disabled",
            gameID:          1,
            userID:          100,
            applicationText: "I'd love to follow!",
            autoAccept:      false,
            wantStatus:      "pending",
            wantErr:         false,
        },
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            // Test implementation
        })
    }
}

func TestMessageService_ListAllPrivateConversations(t *testing.T) {
    tests := []struct {
        name       string
        gameID     int32
        userID     int32
        userRole   string
        wantErr    bool
        errContains string
    }{
        {
            name:     "GM can access",
            gameID:   1,
            userID:   50,
            userRole: "gm",
            wantErr:  false,
        },
        {
            name:     "audience can access",
            gameID:   1,
            userID:   100,
            userRole: "audience",
            wantErr:  false,
        },
        {
            name:        "player cannot access",
            gameID:      1,
            userID:      200,
            userRole:    "player",
            wantErr:     true,
            errContains: "Only GM and audience",
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
- [ ] Service layer: >90% coverage (critical new feature)
- [ ] Permission checks: 100% coverage
- [ ] API handlers: >85% coverage

### 4.2 Frontend Tests

**Test Files:**
- `frontend/src/components/__tests__/ApplicationTypeSelector.test.tsx`
- `frontend/src/components/__tests__/AllPrivateMessagesView.test.tsx`
- `frontend/src/components/__tests__/CharacterAssignmentModal.test.tsx`
- `frontend/src/hooks/__tests__/useAudience.test.ts`

**Component Tests:**
```typescript
describe('ApplicationTypeSelector', () => {
  it('shows both options during recruitment', () => {
    render(
      <ApplicationTypeSelector
        gameState="recruitment"
        selectedType="player"
        onTypeChange={vi.fn()}
      />
    );

    expect(screen.getByText(/player/i)).toBeInTheDocument();
    expect(screen.getByText(/audience/i)).toBeInTheDocument();
  });

  it('only shows audience option after recruitment', () => {
    render(
      <ApplicationTypeSelector
        gameState="in_progress"
        selectedType="audience"
        onTypeChange={vi.fn()}
      />
    );

    expect(screen.queryByText(/player/i)).not.toBeInTheDocument();
    expect(screen.getByText(/audience/i)).toBeInTheDocument();
  });
});

describe('AllPrivateMessagesView', () => {
  it('displays conversations list', async () => {
    server.use(
      http.get('/api/v1/games/1/private-messages/all', () => {
        return HttpResponse.json({
          conversations: [
            {
              conversation_id: 'uuid1',
              subject: 'Secret Meeting',
              message_count: 5,
              // ... other fields
            },
          ],
          total: 1,
        });
      })
    );

    render(<AllPrivateMessagesView gameId={1} />);

    await waitFor(() => {
      expect(screen.getByText('Secret Meeting')).toBeInTheDocument();
    });
  });

  it('shows read-only indicator', () => {
    render(<AllPrivateMessagesView gameId={1} />);

    expect(screen.getByText(/read-only/i)).toBeInTheDocument();
  });
});
```

**Test Coverage Goals:**
- [ ] Components: >85% coverage
- [ ] Audience application flow: 100% coverage
- [ ] All PM view: 100% coverage

### 4.3 Regression Tests

**Critical Bugs to Prevent:**

1. **Bug**: Audience members can submit actions
   - **Test**: `TestActionService_RejectsAudienceNPCActions`
   - **Location**: `backend/pkg/db/services/actions/submit_action_test.go`

2. **Bug**: Non-audience/GM can access All PM view
   - **Test**: `TestMessageService_AllPMViewPermission`
   - **Location**: `backend/pkg/db/services/messages/all_messages_view_test.go`

3. **Bug**: Audience member assigned character can submit actions
   - **Test**: `TestActionSubmission_BlocksAudienceNPCs`
   - **Location**: Integration test

### 4.4 Manual UI Testing Checklist

**Happy Path Testing:**
- [ ] Apply as audience member to game
- [ ] If auto-accept enabled, immediately approved
- [ ] GM assigns NPC to audience member
- [ ] Audience member posts as NPC in common room
- [ ] Audience member replies to private message as NPC
- [ ] Audience member views "All Private Messages" tab
- [ ] Infinite scroll loads more conversations
- [ ] Filter conversations by character
- [ ] GM posts as audience NPC character
- [ ] Audience member receives notifications

**Error Handling Testing:**
- [ ] Try to apply as player after recruitment ends → Only audience option
- [ ] Try to access All PM view as regular player → 403 error
- [ ] Try to submit action as audience NPC → No submit button visible

**Multi-User Testing:**
- [ ] Audience member with 13 NPCs → UI handles gracefully
- [ ] GM and audience both post as same NPC → Both posts visible
- [ ] Multiple audience members viewing All PM → All see same data

**UI/UX Testing:**
- [ ] All PM tab clearly labeled and visible
- [ ] Read-only indicator prominent
- [ ] Audience badge visible on participants
- [ ] Character assignment modal intuitive

**Notes Section:**
```
- Test with audience member controlling many NPCs (5-13)
- Verify All PM view performance with 50+ conversations
- Check notification delivery for audience members
```

---

## 5. User Stories for E2E Testing (Future)

**Journey Name**: User joins as audience, is assigned NPC, participates

**User Goal**: Follow game story and help with NPC roleplay

**Journey Steps**:
1. User browses available games
2. Clicks "Apply to Join" on a game
3. Selects "Audience" application type
4. Submits application with text
5. GM approves application (or auto-approved)
6. User navigates to game
7. Sees "All Private Messages" tab
8. GM assigns NPC to user
9. User posts as NPC in common room
10. User receives notification for new message
11. User replies to private message as NPC

**Critical User Flows to Test**:
- [ ] **Flow 1**: Apply as audience → Get assigned NPC → Post as NPC
- [ ] **Flow 2**: View All PM tab → Filter conversations → Read messages
- [ ] **Flow 3**: Audience with multiple NPCs → Manage all characters

**E2E Test Priority**: High (Core new feature)

---

## 6. Implementation Plan

### Phase 1: Database & Backend Foundation
**Estimated Time**: 4 hours

- [ ] Create database migration
- [ ] Update SQL queries
- [ ] Run `just sqlgen`
- [ ] Update interfaces
- [ ] Update models
- [ ] **Write unit tests**
- [ ] Implement ApplyAsAudience
- [ ] Implement audience management methods
- [ ] Implement All PM view methods
- [ ] Run tests: `just test-mocks`

**Acceptance Criteria:**
- [ ] Migration applies cleanly
- [ ] All unit tests passing
- [ ] Permission checks working

### Phase 2: API Endpoints
**Estimated Time**: 3 hours

- [ ] Implement audience application endpoint
- [ ] Implement audience listing endpoints
- [ ] Implement All PM view endpoints
- [ ] Implement auto-accept setting endpoint
- [ ] Add request validation
- [ ] **Write API integration tests**
- [ ] Test with database

**Acceptance Criteria:**
- [ ] All endpoints working
- [ ] Permission checks enforced
- [ ] All API tests passing

### Phase 3: Frontend Implementation
**Estimated Time**: 6 hours

- [ ] Update types
- [ ] Add API methods
- [ ] Create hooks
- [ ] **Write hook tests**
- [ ] Create ApplicationTypeSelector (semantic tokens)
- [ ] Create AllPrivateMessagesView (semantic tokens)
- [ ] Create ConversationList (semantic tokens)
- [ ] Create AudienceMemberBadge (semantic tokens)
- [ ] Create CharacterAssignmentModal (semantic tokens, UI components)
- [ ] **Write component tests**
- [ ] Integrate into GameDetailsPage
- [ ] Add tab navigation
- [ ] Style with Tailwind
- [ ] Run tests: `just test-frontend`

**Acceptance Criteria:**
- [ ] All UI integrated
- [ ] Uses semantic theme tokens
- [ ] All tests passing

### Phase 4: Manual Testing & Documentation
**Estimated Time**: 3 hours

- [ ] **Manual UI testing** (checklist 4.4)
- [ ] Performance testing
- [ ] Security review
- [ ] Documentation updates

**Acceptance Criteria:**
- [ ] All manual tests pass
- [ ] Security review complete
- [ ] Documentation updated

---

## 7. Rollout Strategy

### Deployment Checklist
- [ ] Migration tested
- [ ] Auto-accept setting works
- [ ] All PM view performs well
- [ ] Monitoring configured

### Rollback Plan
1. Rollback migration
2. Revert backend
3. Revert frontend

---

## 8. Monitoring & Observability

### Metrics to Track
- [ ] Audience applications per day
- [ ] Auto-accept rate
- [ ] All PM view usage
- [ ] Audience NPC posts per day

### Logging
- [ ] All audience applications logged
- [ ] All PM view access logged
- [ ] NPC assignments logged

---

## 9. Documentation

### User Documentation
- [ ] Guide for audience members
- [ ] GM guide for managing audience
- [ ] All PM view usage guide

---

## 10. Open Questions

**Technical Questions:**
- [x] Can audience submit actions? → No, explicitly forbidden
- [x] Can audience view player actions? → No

---

## 11. Risks & Mitigations

### Technical Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| All PM view performance | Medium | Medium | Pagination, filtering |
| Audience accessing player data | Low | High | Strict permission checks |

---

## 12. Future Enhancements

- Enhancement 1: Audience chat/discussion features
- Enhancement 2: Audience-only posts in common room
- Enhancement 3: Audience analytics

---

## Completion Checklist

- [ ] All implementation phases complete
- [ ] All tests passing (>90% coverage)
- [ ] Manual UI testing complete
- [ ] Documentation updated
- [ ] Deployed to production

**Archive this plan to** `.claude/planning/archive/` **when complete.**
