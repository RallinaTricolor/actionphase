# Feature: GM Handouts / Informational Documents

**Status**: Planning
**Created**: 2025-10-21
**Last Updated**: 2025-10-21
**Owner**: AI Session
**Related ADRs**: ADR-002 (Database Design), ADR-004 (API Design Principles)
**Related Issues**: N/A

---

## 1. Overview

### Problem Statement
**What problem does this feature solve?**

GMs need a way to share reference materials, rules, and world-building information with players that:
- Persists across all phases of the game
- Is separate from the game narrative (common room posts)
- Can be drafted and published when ready
- Stays organized and easily accessible
- Provides a central knowledge base for the game

Currently, GMs must use common room posts for this, which mixes narrative with reference material and disappears when phases change.

### Goals
**What are we trying to achieve?**

- [ ] Goal 1: Allow GMs to create informational documents (handouts) with title and markdown content
- [ ] Goal 2: Provide draft/published state for handouts
- [ ] Goal 3: Show published handouts to all participants and applicants
- [ ] Goal 4: Hide draft handouts from everyone except GM
- [ ] Goal 5: Allow GM to organize information using threaded comments/replies
- [ ] Goal 6: Prevent players from replying to handouts (one-way communication)
- [ ] Goal 7: Show handouts in dedicated "Handouts" tab
- [ ] Goal 8: Handouts exist in all game states (recruitment, active, paused, completed)
- [ ] Goal 9: Notify players when handouts are published or updated
- [ ] Goal 10: Display last updated timestamp on handouts

### Non-Goals
**What is explicitly out of scope?**

- Non-goal 1: Version history for handouts (future enhancement)
- Non-goal 2: Player comments on handouts (explicitly forbidden)
- Non-goal 3: Handout templates or categories
- Non-goal 4: Collaborative editing (only GM can edit)
- Non-goal 5: File attachments (use markdown links if needed)

### Success Criteria
**How do we know this feature is successful?**

- [ ] GMs can create handouts with draft status
- [ ] GMs can publish handouts, triggering player notifications
- [ ] Published handouts visible to all participants and applicants
- [ ] Draft handouts only visible to GM
- [ ] GMs can add threaded replies to organize information
- [ ] Players cannot reply to handouts
- [ ] Handouts appear in dedicated tab
- [ ] Last updated timestamp displayed
- [ ] Markdown rendering works correctly
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
I want to create a draft handout with rules information
So that I can prepare reference materials before publishing

Acceptance Criteria:
- Given I am the GM
  When I create a new handout with status "draft"
  Then the handout is saved
  And only I can see it
  And players do not receive notifications
```

```gherkin
As a GM
I want to publish a handout
So that players can access important game information

Acceptance Criteria:
- Given I have a draft handout
  When I change status to "published"
  Then all participants can see the handout
  And all participants receive a notification
  And the last_updated timestamp is set
```

```gherkin
As a player
I want to view published handouts
So that I can reference game rules and world information

Acceptance Criteria:
- Given I am a participant or applicant
  When I navigate to the Handouts tab
  Then I see all published handouts sorted newest first
  And I can click to expand and read full content
  And I cannot reply or edit
```

```gherkin
As a GM
I want to add threaded comments to my handout
So that I can organize information in sections

Acceptance Criteria:
- Given I published a handout
  When I add a comment/reply to the handout
  Then it appears below the main content
  And I can reply to my own comments to create threads
  And players cannot add comments
```

```gherkin
As an applicant
I want to read handouts before applying
So that I understand the game rules and setting

Acceptance Criteria:
- Given I am viewing a game I haven't joined
  When I navigate to the Handouts tab
  Then I see all published handouts
  And I can read all content
  And I see an "Apply to Join" button
```

### Edge Cases & Error Scenarios

- **Edge Case 1**: GM updates published handout → Players get notification
- **Edge Case 2**: GM unpublishes handout (published → draft) → Handout hidden from players, no notification
- **Edge Case 3**: No handouts exist → Show empty state with "Create Handout" button for GM
- **Edge Case 4**: Very long handout (10,000+ words) → Collapsible with "Read More" button
- **Edge Case 5**: Game is deleted → Handouts are cascaded deleted
- **Error Scenario 1**: Player tries to create handout → 403 Forbidden
- **Error Scenario 2**: Player tries to reply to handout → No reply button shown

---

## 3. Technical Design

### 3.1 Database Schema

**New Table:**

```sql
CREATE TABLE handouts (
    id SERIAL PRIMARY KEY,
    game_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'draft' NOT NULL, -- 'draft' or 'published'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT fk_handouts_game
        FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
);

CREATE INDEX idx_handouts_game_id ON handouts(game_id);
CREATE INDEX idx_handouts_status ON handouts(game_id, status);

-- Add handout comments table (similar to post comments but simpler)
CREATE TABLE handout_comments (
    id SERIAL PRIMARY KEY,
    handout_id INT NOT NULL,
    user_id INT NOT NULL,
    parent_comment_id INT DEFAULT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    edited_at TIMESTAMPTZ DEFAULT NULL,
    edit_count INT DEFAULT 0 NOT NULL,
    deleted_at TIMESTAMPTZ DEFAULT NULL,
    deleted_by_user_id INT DEFAULT NULL,

    CONSTRAINT fk_handout_comments_handout
        FOREIGN KEY (handout_id) REFERENCES handouts(id) ON DELETE CASCADE,
    CONSTRAINT fk_handout_comments_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_handout_comments_parent
        FOREIGN KEY (parent_comment_id) REFERENCES handout_comments(id) ON DELETE CASCADE,
    CONSTRAINT fk_handout_comments_deleted_by
        FOREIGN KEY (deleted_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_handout_comments_handout ON handout_comments(handout_id);
CREATE INDEX idx_handout_comments_parent ON handout_comments(parent_comment_id);
```

**Migration Plan:**
1. Migration file: `[timestamp]_create_handouts.up.sql`
2. Rollback file: `[timestamp]_create_handouts.down.sql`
3. Data migration strategy: None (new feature)

### 3.2 Database Queries (sqlc)

**Location**: `backend/pkg/db/queries/handouts.sql`

```sql
-- name: CreateHandout :one
INSERT INTO handouts (
    game_id,
    title,
    content,
    status
) VALUES (
    $1, $2, $3, $4
) RETURNING *;

-- name: GetHandout :one
SELECT * FROM handouts
WHERE id = $1;

-- name: ListHandoutsByGame :many
-- For GM: show all handouts
-- For players: only show published
SELECT * FROM handouts
WHERE game_id = $1
  AND (status = 'published' OR $2 = TRUE) -- $2 is is_gm
ORDER BY created_at DESC;

-- name: UpdateHandout :one
UPDATE handouts
SET title = $1,
    content = $2,
    status = $3,
    updated_at = NOW()
WHERE id = $4
RETURNING *;

-- name: DeleteHandout :exec
DELETE FROM handouts WHERE id = $1;

-- name: PublishHandout :one
UPDATE handouts
SET status = 'published',
    updated_at = NOW()
WHERE id = $1
RETURNING *;

-- name: UnpublishHandout :one
UPDATE handouts
SET status = 'draft',
    updated_at = NOW()
WHERE id = $1
RETURNING *;

-- Handout Comments

-- name: CreateHandoutComment :one
INSERT INTO handout_comments (
    handout_id,
    user_id,
    parent_comment_id,
    content
) VALUES (
    $1, $2, $3, $4
) RETURNING *;

-- name: ListHandoutComments :many
SELECT
    hc.*,
    u.username as author_username
FROM handout_comments hc
JOIN users u ON hc.user_id = u.id
WHERE hc.handout_id = $1
  AND hc.deleted_at IS NULL
ORDER BY hc.created_at ASC;

-- name: UpdateHandoutComment :one
UPDATE handout_comments
SET content = $1,
    edited_at = NOW(),
    edit_count = edit_count + 1,
    updated_at = NOW()
WHERE id = $2 AND deleted_at IS NULL
RETURNING *;

-- name: DeleteHandoutComment :exec
UPDATE handout_comments
SET deleted_at = NOW(),
    deleted_by_user_id = $2,
    updated_at = NOW()
WHERE id = $1 AND deleted_at IS NULL;
```

**Query Performance Considerations:**
- [x] Index on (game_id, status) for filtering published handouts
- [x] Index on handout_id for comment lookups
- [x] Cascade deletes for data integrity

### 3.3 Backend Service Layer

**Service Interface** (`backend/pkg/core/interfaces.go`):

```go
// Add new HandoutServiceInterface
type HandoutServiceInterface interface {
    // CRUD operations
    CreateHandout(ctx context.Context, gameID int32, title string, content string, status string) (*Handout, error)
    GetHandout(ctx context.Context, handoutID int32, userID int32) (*Handout, error)
    ListHandouts(ctx context.Context, gameID int32, userID int32, isGM bool) ([]*Handout, error)
    UpdateHandout(ctx context.Context, handoutID int32, title string, content string, status string, userID int32) (*Handout, error)
    DeleteHandout(ctx context.Context, handoutID int32, userID int32) error

    // Publishing
    PublishHandout(ctx context.Context, handoutID int32, userID int32) (*Handout, error)
    UnpublishHandout(ctx context.Context, handoutID int32, userID int32) (*Handout, error)

    // Comments (GM only)
    CreateHandoutComment(ctx context.Context, handoutID int32, userID int32, parentCommentID *int32, content string) (*HandoutComment, error)
    ListHandoutComments(ctx context.Context, handoutID int32) ([]*HandoutComment, error)
    UpdateHandoutComment(ctx context.Context, commentID int32, userID int32, content string) (*HandoutComment, error)
    DeleteHandoutComment(ctx context.Context, commentID int32, userID int32, isGM bool) error
}
```

**Domain Models** (`backend/pkg/core/models.go`):

```go
type Handout struct {
    ID        int32     `json:"id"`
    GameID    int32     `json:"game_id"`
    Title     string    `json:"title"`
    Content   string    `json:"content"`
    Status    string    `json:"status"` // 'draft' or 'published'
    CreatedAt time.Time `json:"created_at"`
    UpdatedAt time.Time `json:"updated_at"`
}

type HandoutComment struct {
    ID              int32      `json:"id"`
    HandoutID       int32      `json:"handout_id"`
    UserID          int32      `json:"user_id"`
    ParentCommentID *int32     `json:"parent_comment_id,omitempty"`
    Content         string     `json:"content"`
    CreatedAt       time.Time  `json:"created_at"`
    UpdatedAt       time.Time  `json:"updated_at"`
    EditedAt        *time.Time `json:"edited_at,omitempty"`
    EditCount       int        `json:"edit_count"`
    DeletedAt       *time.Time `json:"deleted_at,omitempty"`

    // Related data
    AuthorUsername string `json:"author_username"`
}

type CreateHandoutRequest struct {
    Title   string `json:"title" validate:"required,min=3,max=255"`
    Content string `json:"content" validate:"required,min=10,max=50000"`
    Status  string `json:"status" validate:"required,oneof=draft published"`
}

type UpdateHandoutRequest struct {
    Title   string `json:"title" validate:"required,min=3,max=255"`
    Content string `json:"content" validate:"required,min=10,max=50000"`
    Status  string `json:"status" validate:"required,oneof=draft published"`
}

type CreateHandoutCommentRequest struct {
    ParentCommentID *int32 `json:"parent_comment_id,omitempty"`
    Content         string `json:"content" validate:"required,min=1,max=10000"`
}
```

**Business Rules:**

1. **Only GM can create handouts**
   - Validation: Check user is game GM
   - Error: "Only the GM can create handouts"

2. **Only GM can update/delete handouts**
   - Validation: Check user is game GM
   - Error: "Only the GM can modify handouts"

3. **Only GM can comment on handouts**
   - Validation: Check user is game GM
   - Error: "Only the GM can comment on handouts"

4. **Draft handouts only visible to GM**
   - Validation: Check status = 'published' OR requesting user is GM
   - Error: "Handout not found" (404, don't reveal existence)

5. **Publishing handout triggers notifications**
   - Implementation: Create notification for all participants when status changes draft → published
   - Also trigger when updating published handout

6. **Handouts accessible to applicants if published**
   - Implementation: No auth required to view published handouts (just game_id)
   - Encourages applications by showing game info

---

### 3.4 API Endpoints

**Base Path**: `/api/v1/games/:game_id/handouts`

#### POST /api/v1/games/:game_id/handouts
**Description**: Create a new handout
**Auth Required**: Yes
**Permissions**: User must be GM

**Request Body:**
```json
{
  "title": "Character Creation Rules",
  "content": "# Creating Your Character\n\n## Step 1: Choose a concept...",
  "status": "draft"
}
```

**Response (201 Created):**
```json
{
  "id": 123,
  "game_id": 456,
  "title": "Character Creation Rules",
  "content": "# Creating Your Character...",
  "status": "draft",
  "created_at": "2025-10-21T10:00:00Z",
  "updated_at": "2025-10-21T10:00:00Z"
}
```

**Error Responses:**
- `400 Bad Request`: Validation error
- `401 Unauthorized`: No auth token
- `403 Forbidden`: User is not GM
- `500 Internal Server Error`: Database error

---

#### GET /api/v1/games/:game_id/handouts
**Description**: List all handouts for a game
**Auth Required**: No (public for applicants), but filters based on auth
**Permissions**: Shows published to everyone, drafts only to GM

**Response (200 OK):**
```json
{
  "handouts": [
    {
      "id": 123,
      "game_id": 456,
      "title": "Character Creation Rules",
      "content": "# Creating Your Character...",
      "status": "published",
      "created_at": "2025-10-21T10:00:00Z",
      "updated_at": "2025-10-21T10:30:00Z"
    }
  ]
}
```

---

#### GET /api/v1/handouts/:id
**Description**: Get a specific handout
**Auth Required**: No (if published), Yes (if draft - GM only)
**Permissions**: Published visible to all, draft only to GM

**Response (200 OK):**
```json
{
  "id": 123,
  "game_id": 456,
  "title": "Character Creation Rules",
  "content": "# Creating Your Character...",
  "status": "published",
  "created_at": "2025-10-21T10:00:00Z",
  "updated_at": "2025-10-21T10:30:00Z"
}
```

---

#### PUT /api/v1/handouts/:id
**Description**: Update a handout
**Auth Required**: Yes
**Permissions**: User must be GM

**Request Body:**
```json
{
  "title": "Updated Title",
  "content": "Updated content...",
  "status": "published"
}
```

**Response (200 OK):**
```json
{
  "id": 123,
  "game_id": 456,
  "title": "Updated Title",
  "content": "Updated content...",
  "status": "published",
  "created_at": "2025-10-21T10:00:00Z",
  "updated_at": "2025-10-21T11:00:00Z"
}
```

---

#### DELETE /api/v1/handouts/:id
**Description**: Delete a handout
**Auth Required**: Yes
**Permissions**: User must be GM

**Response (204 No Content)**

---

#### POST /api/v1/handouts/:id/publish
**Description**: Publish a draft handout (triggers notifications)
**Auth Required**: Yes
**Permissions**: User must be GM

**Response (200 OK):**
```json
{
  "id": 123,
  "status": "published",
  "updated_at": "2025-10-21T11:00:00Z"
}
```

---

#### GET /api/v1/handouts/:id/comments
**Description**: List comments on a handout
**Auth Required**: No (if handout is published)
**Permissions**: Anyone can view comments on published handouts

**Response (200 OK):**
```json
{
  "comments": [
    {
      "id": 1,
      "handout_id": 123,
      "user_id": 50,
      "parent_comment_id": null,
      "content": "## Additional Notes",
      "author_username": "GM_User",
      "created_at": "2025-10-21T10:30:00Z"
    }
  ]
}
```

---

#### POST /api/v1/handouts/:id/comments
**Description**: Add a comment to a handout
**Auth Required**: Yes
**Permissions**: User must be GM

**Request Body:**
```json
{
  "parent_comment_id": null,
  "content": "## Additional Notes\n\nRemember to..."
}
```

**Response (201 Created):**
```json
{
  "id": 1,
  "handout_id": 123,
  "user_id": 50,
  "content": "## Additional Notes...",
  "author_username": "GM_User",
  "created_at": "2025-10-21T10:30:00Z"
}
```

---

### 3.5 Frontend Components

**Component Hierarchy:**

```
[GameDetailsPage]
├── [TabNavigation]
│   └── [HandoutsTab] (new)
└── [HandoutsView] (new)
    ├── [CreateHandoutButton] (new, GM only)
    ├── [HandoutsList] (new)
    │   └── [HandoutCard] (new)
    │       ├── [HandoutHeader] (new)
    │       ├── [MarkdownContent] (reuse)
    │       └── [HandoutComments] (new)
    └── [CreateHandoutModal] (new)
        └── [MarkdownEditor] (reuse)
```

**Component Specifications:**

#### Component: `HandoutsView`
**Location**: `frontend/src/components/handouts/HandoutsView.tsx`
**Purpose**: Main container for handouts feature

**Props:**
```typescript
interface HandoutsViewProps {
  gameId: number;
  isGM: boolean;
}
```

**State:**
- Server state: Uses `useHandouts` query
- Local state: `showCreateModal` (boolean)

**Features:**
- Shows list of handouts
- "Create Handout" button for GM
- Empty state for no handouts

---

#### Component: `HandoutCard`
**Location**: `frontend/src/components/handouts/HandoutCard.tsx`
**Purpose**: Display single handout with collapsible content

**Props:**
```typescript
interface HandoutCardProps {
  handout: Handout;
  isGM: boolean;
  gameId: number;
}
```

**State:**
- Local state: `isExpanded` (boolean), `showComments` (boolean)
- Server state: Uses `useHandoutComments` query when expanded

**Features:**
- Collapsible content (expand/collapse)
- Draft/Published badge
- Edit/Delete buttons (GM only)
- Publish button (GM only, if draft)
- Last updated timestamp
- Threaded comments section
- Uses semantic theme tokens throughout

---

#### Component: `CreateHandoutModal`
**Location**: `frontend/src/components/handouts/CreateHandoutModal.tsx`
**Purpose**: Modal for creating new handout

**Props:**
```typescript
interface CreateHandoutModalProps {
  gameId: number;
  isOpen: boolean;
  onClose: () => void;
}
```

**State:**
- Local state: `title`, `content`, `status`, `isSubmitting`
- Server state: Uses `useCreateHandout` mutation

**Features:**
- Title input
- Markdown editor for content (with preview)
- Draft/Publish radio buttons
- Save button
- Uses semantic theme tokens and UI components

---

### 3.6 Frontend API Client

**Location**: `frontend/src/lib/api.ts`

```typescript
class ApiClient {
  handouts = {
    // Create handout
    async createHandout(
      gameId: number,
      data: CreateHandoutRequest
    ): Promise<Handout> {
      const response = await this.client.post<Handout>(
        `/api/v1/games/${gameId}/handouts`,
        data
      );
      return response.data;
    },

    // List handouts
    async listHandouts(gameId: number): Promise<Handout[]> {
      const response = await this.client.get<{ handouts: Handout[] }>(
        `/api/v1/games/${gameId}/handouts`
      );
      return response.data.handouts;
    },

    // Get single handout
    async getHandout(handoutId: number): Promise<Handout> {
      const response = await this.client.get<Handout>(
        `/api/v1/handouts/${handoutId}`
      );
      return response.data;
    },

    // Update handout
    async updateHandout(
      handoutId: number,
      data: UpdateHandoutRequest
    ): Promise<Handout> {
      const response = await this.client.put<Handout>(
        `/api/v1/handouts/${handoutId}`,
        data
      );
      return response.data;
    },

    // Delete handout
    async deleteHandout(handoutId: number): Promise<void> {
      await this.client.delete(`/api/v1/handouts/${handoutId}`);
    },

    // Publish handout
    async publishHandout(handoutId: number): Promise<Handout> {
      const response = await this.client.post<Handout>(
        `/api/v1/handouts/${handoutId}/publish`
      );
      return response.data;
    },

    // Handout comments
    async listHandoutComments(handoutId: number): Promise<HandoutComment[]> {
      const response = await this.client.get<{ comments: HandoutComment[] }>(
        `/api/v1/handouts/${handoutId}/comments`
      );
      return response.data.comments;
    },

    async createHandoutComment(
      handoutId: number,
      data: CreateHandoutCommentRequest
    ): Promise<HandoutComment> {
      const response = await this.client.post<HandoutComment>(
        `/api/v1/handouts/${handoutId}/comments`,
        data
      );
      return response.data;
    },
  };
}
```

### 3.7 Frontend Custom Hooks

**Location**: `frontend/src/hooks/useHandouts.ts`

```typescript
export function useHandouts(gameId: number) {
  return useQuery({
    queryKey: ['handouts', gameId],
    queryFn: () => apiClient.handouts.listHandouts(gameId),
    staleTime: 60000, // 1 minute
  });
}

export function useHandout(handoutId: number) {
  return useQuery({
    queryKey: ['handouts', handoutId],
    queryFn: () => apiClient.handouts.getHandout(handoutId),
    enabled: !!handoutId,
  });
}

export function useCreateHandout(gameId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateHandoutRequest) =>
      apiClient.handouts.createHandout(gameId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['handouts', gameId] });
    },
  });
}

export function useUpdateHandout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      handoutId,
      data,
    }: {
      handoutId: number;
      data: UpdateHandoutRequest;
    }) => apiClient.handouts.updateHandout(handoutId, data),
    onSuccess: (updatedHandout) => {
      queryClient.invalidateQueries({ queryKey: ['handouts'] });
    },
  });
}

export function useDeleteHandout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (handoutId: number) =>
      apiClient.handouts.deleteHandout(handoutId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['handouts'] });
    },
  });
}

export function usePublishHandout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (handoutId: number) =>
      apiClient.handouts.publishHandout(handoutId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['handouts'] });
    },
  });
}

export function useHandoutComments(handoutId: number) {
  return useQuery({
    queryKey: ['handout-comments', handoutId],
    queryFn: () => apiClient.handouts.listHandoutComments(handoutId),
    enabled: !!handoutId,
  });
}

export function useCreateHandoutComment(handoutId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateHandoutCommentRequest) =>
      apiClient.handouts.createHandoutComment(handoutId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['handout-comments', handoutId],
      });
    },
  });
}
```

### 3.8 Frontend Type Definitions

**Location**: `frontend/src/types/handouts.ts`

```typescript
export interface Handout {
  id: number;
  game_id: number;
  title: string;
  content: string;
  status: 'draft' | 'published';
  created_at: string;
  updated_at: string;
}

export interface HandoutComment {
  id: number;
  handout_id: number;
  user_id: number;
  parent_comment_id?: number;
  content: string;
  created_at: string;
  updated_at: string;
  edited_at?: string;
  edit_count: number;
  deleted_at?: string;

  // Related data
  author_username: string;
}

export interface CreateHandoutRequest {
  title: string;
  content: string;
  status: 'draft' | 'published';
}

export interface UpdateHandoutRequest {
  title: string;
  content: string;
  status: 'draft' | 'published';
}

export interface CreateHandoutCommentRequest {
  parent_comment_id?: number;
  content: string;
}
```

---

## 4. Testing Strategy

### 4.1 Backend Tests

**Test Files:**
- `backend/pkg/db/services/handouts/handout_service_test.go`
- `backend/pkg/handouts/api_test.go`

**Unit Tests:**
```go
func TestHandoutService_CreateHandout(t *testing.T) {
    tests := []struct {
        name    string
        gameID  int32
        userID  int32
        isGM    bool
        title   string
        content string
        status  string
        wantErr bool
    }{
        {
            name:    "GM can create handout",
            gameID:  1,
            userID:  50,
            isGM:    true,
            title:   "Rules",
            content: "Character rules...",
            status:  "draft",
            wantErr: false,
        },
        {
            name:    "non-GM cannot create handout",
            gameID:  1,
            userID:  100,
            isGM:    false,
            title:   "Rules",
            content: "Content",
            status:  "draft",
            wantErr: true,
        },
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            // Test implementation
        })
    }
}

func TestHandoutService_ListHandouts(t *testing.T) {
    tests := []struct {
        name      string
        gameID    int32
        userID    int32
        isGM      bool
        setup     func(*TestDB)
        wantCount int
    }{
        {
            name:   "GM sees all handouts",
            gameID: 1,
            userID: 50,
            isGM:   true,
            setup: func(db *TestDB) {
                // Create 2 published, 1 draft
            },
            wantCount: 3,
        },
        {
            name:   "Player only sees published",
            gameID: 1,
            userID: 100,
            isGM:   false,
            setup: func(db *TestDB) {
                // Same setup
            },
            wantCount: 2, // Only published
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
- [ ] Service layer: >90% coverage
- [ ] Permission checks: 100% coverage
- [ ] API handlers: >85% coverage

### 4.2 Frontend Tests

**Component Tests:**
```typescript
describe('HandoutsView', () => {
  it('shows create button for GM', () => {
    render(<HandoutsView gameId={1} isGM={true} />);
    expect(screen.getByRole('button', { name: /create handout/i })).toBeInTheDocument();
  });

  it('does not show create button for players', () => {
    render(<HandoutsView gameId={1} isGM={false} />);
    expect(screen.queryByRole('button', { name: /create handout/i })).not.toBeInTheDocument();
  });

  it('displays published handouts', async () => {
    server.use(
      http.get('/api/v1/games/1/handouts', () => {
        return HttpResponse.json({
          handouts: [
            { id: 1, title: 'Rules', content: 'Content...', status: 'published' }
          ]
        });
      })
    );

    render(<HandoutsView gameId={1} isGM={false} />);

    await waitFor(() => {
      expect(screen.getByText('Rules')).toBeInTheDocument();
    });
  });
});

describe('HandoutCard', () => {
  it('shows draft badge for draft handouts', () => {
    const handout = { id: 1, title: 'Draft', content: 'Content', status: 'draft' };
    render(<HandoutCard handout={handout} isGM={true} gameId={1} />);

    expect(screen.getByText(/draft/i)).toBeInTheDocument();
  });

  it('shows publish button for GM on draft handout', () => {
    const handout = { id: 1, title: 'Draft', content: 'Content', status: 'draft' };
    render(<HandoutCard handout={handout} isGM={true} gameId={1} />);

    expect(screen.getByRole('button', { name: /publish/i })).toBeInTheDocument();
  });
});
```

**Test Coverage Goals:**
- [ ] Components: >85% coverage
- [ ] Create/update flows: 100% coverage
- [ ] Permission checks in UI: 100% coverage

### 4.3 Manual UI Testing Checklist

**Happy Path Testing:**
- [ ] Log in as GM
- [ ] Create draft handout
- [ ] Verify only GM sees draft
- [ ] Publish handout
- [ ] Verify players receive notification
- [ ] Verify players can view handout
- [ ] Add threaded comments as GM
- [ ] Update published handout
- [ ] Verify players notified of update

**Error Handling Testing:**
- [ ] Log in as player → No create button visible
- [ ] Try to access draft handout as player → 404
- [ ] Verify no reply button for players on handouts

**UI/UX Testing:**
- [ ] Markdown rendering works correctly
- [ ] Last updated timestamp displays
- [ ] Collapsible handouts work smoothly
- [ ] Draft/Published badges clear

**Notes:**
```
- Test with very long handouts (5000+ words)
- Verify markdown preview works in editor
- Test notification delivery
```

---

## 5. Implementation Plan

### Phase 1: Database & Backend
**Estimated Time**: 3 hours

- [ ] Create tables
- [ ] Write queries
- [ ] Run `just sqlgen`
- [ ] Define interfaces
- [ ] Define models
- [ ] **Write unit tests**
- [ ] Implement service methods
- [ ] Run tests

---

### Phase 2: API Endpoints
**Estimated Time**: 2 hours

- [ ] Implement endpoints
- [ ] **Write API tests**
- [ ] Test with database

---

### Phase 3: Notifications
**Estimated Time**: 1 hour

- [ ] Integrate with notification system
- [ ] Trigger on publish/update

---

### Phase 4: Frontend
**Estimated Time**: 5 hours

- [ ] Create types
- [ ] Add API methods
- [ ] Create hooks
- [ ] **Write hook tests**
- [ ] Create components (semantic tokens, UI components)
- [ ] **Write component tests**
- [ ] Add tab to GameDetailsPage
- [ ] Run tests

---

### Phase 5: Manual Testing
**Estimated Time**: 2 hours

- [ ] **Manual UI testing**
- [ ] Documentation updates

---

## 6. Completion Checklist

- [ ] All phases complete
- [ ] All tests passing (>85% coverage)
- [ ] Manual testing complete
- [ ] Documentation updated
- [ ] Deployed to production

**Archive this plan to** `.claude/planning/archive/` **when complete.**
