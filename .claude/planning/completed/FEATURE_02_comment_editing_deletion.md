# Feature: Comment Editing and Deletion

**Status**: Planning
**Created**: 2025-10-21
**Last Updated**: 2025-10-21
**Owner**: AI Session
**Related ADRs**: ADR-007 (Testing Strategy)
**Related Issues**: N/A

---

## 1. Overview

### Problem Statement
**What problem does this feature solve?**

Currently, users cannot edit or delete their comments after posting, leading to:
- Typos and errors remaining permanently visible
- No way to remove accidentally posted sensitive information
- No moderation capability for inappropriate content
- User frustration when they cannot correct mistakes

### Goals
**What are we trying to achieve?**

- [ ] Goal 1: Allow users to edit their own comments at any time
- [ ] Goal 2: Show visual indicator when a comment has been edited
- [ ] Goal 3: Allow users to delete their own comments
- [ ] Goal 4: Allow GMs to delete any comment in their game
- [ ] Goal 5: Allow admins (when admin mode is enabled) to delete any comment
- [ ] Goal 6: Soft-delete comments to preserve thread structure
- [ ] Goal 7: Re-trigger notifications for new @mentions when comments are edited

### Non-Goals
**What is explicitly out of scope?**

- Non-goal 1: Edit history / version tracking (future enhancement)
- Non-goal 2: Time limit on edits (users can always edit)
- Non-goal 3: Ability for GMs/admins to edit content (only delete)
- Non-goal 4: Removing old notifications when mentions are removed
- Non-goal 5: Hard deletion of comments

### Success Criteria
**How do we know this feature is successful?**

- [ ] Users can edit their own comments and see "edited" indicator
- [ ] Users can delete their own comments, which show as "[deleted]"
- [ ] GMs can delete comments in their games
- [ ] Admins can delete comments when admin mode is enabled
- [ ] Thread structure is preserved after deletions
- [ ] New @mentions in edited comments trigger notifications
- [ ] Unit test coverage: >85% for service layer
- [ ] Integration tests: All API endpoints tested
- [ ] Component test coverage: >85% for frontend
- [ ] All regression tests passing
- [ ] Manual UI testing complete with documented flows

---

## 2. User Stories

### Primary User Stories

```gherkin
As a player
I want to edit my comment to fix a typo
So that my message is clear and correct

Acceptance Criteria:
- Given I authored a comment
  When I click "Edit" on my comment
  Then I see an edit form with my current comment content
  And I can modify the text
  And I can save the changes
  And the comment shows "(edited)" indicator
  And new @mentions trigger notifications
```

```gherkin
As a player
I want to delete my accidentally posted comment
So that I can remove sensitive information

Acceptance Criteria:
- Given I authored a comment
  When I click "Delete" on my comment
  Then I see a confirmation dialog
  And when I confirm, the comment is deleted
  And the comment shows "[deleted]" in the thread
  And replies to my comment remain visible
```

```gherkin
As a GM
I want to delete inappropriate comments in my game
So that I can maintain a positive environment

Acceptance Criteria:
- Given I am the GM of a game
  When I view any comment in my game
  Then I see a "Delete" button (but not "Edit")
  And when I delete it, the comment shows "[deleted]"
  And I cannot restore it
```

```gherkin
As an admin
I want to delete rule-violating comments across all games
So that I can moderate the platform

Acceptance Criteria:
- Given I am an admin with admin mode enabled
  When I view any comment on the platform
  Then I see a "Delete" button
  And when I delete it, the comment is soft-deleted
  And the action is logged (future: audit log)
```

### Edge Cases & Error Scenarios

- **Edge Case 1**: User edits comment with @mentions → New mentions trigger notifications
- **Edge Case 2**: User deletes a comment with replies → Replies remain visible, parent shows "[deleted]"
- **Edge Case 3**: User tries to edit another user's comment → 403 Forbidden
- **Edge Case 4**: GM tries to edit (not delete) a comment → Option not available in UI
- **Edge Case 5**: Already-deleted comment → Cannot be edited or deleted again
- **Error Scenario 1**: Network failure during edit → Changes not saved, error message shown
- **Error Scenario 2**: Concurrent edits (rare) → Last write wins, no conflict resolution needed

---

## 3. Technical Design

### 3.1 Database Schema

**Schema Modifications:**

```sql
-- Add deleted_at column for soft deletes
ALTER TABLE comments ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE comments ADD COLUMN deleted_by_user_id INT DEFAULT NULL;

-- Add edited tracking
ALTER TABLE comments ADD COLUMN edited_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE comments ADD COLUMN edit_count INT DEFAULT 0 NOT NULL;

-- Add foreign key for deleted_by
ALTER TABLE comments
ADD CONSTRAINT fk_comments_deleted_by
FOREIGN KEY (deleted_by_user_id) REFERENCES users(id) ON DELETE SET NULL;

-- Add index for querying non-deleted comments
CREATE INDEX idx_comments_deleted_at ON comments(deleted_at) WHERE deleted_at IS NULL;

-- Add index for edited comments
CREATE INDEX idx_comments_edited_at ON comments(edited_at) WHERE edited_at IS NOT NULL;
```

**Migration Plan:**
1. Migration file: `[timestamp]_add_comment_edit_delete_tracking.up.sql`
2. Rollback file: `[timestamp]_add_comment_edit_delete_tracking.down.sql`
3. Data migration strategy: Existing comments will have NULL for new columns (indicating never edited/deleted)

### 3.2 Database Queries (sqlc)

**Location**: `backend/pkg/db/queries/comments.sql`

```sql
-- name: UpdateCommentContent :one
UPDATE comments
SET content = $1,
    edited_at = NOW(),
    edit_count = edit_count + 1,
    updated_at = NOW()
WHERE id = $1 AND deleted_at IS NULL
RETURNING *;

-- name: SoftDeleteComment :exec
UPDATE comments
SET deleted_at = NOW(),
    deleted_by_user_id = $2,
    updated_at = NOW()
WHERE id = $1 AND deleted_at IS NULL;

-- name: GetComment :one
-- Update existing query to include new fields
SELECT
  c.*,
  u.username as author_username,
  char.name as character_name
FROM comments c
JOIN users u ON c.user_id = u.id
LEFT JOIN characters char ON c.character_id = char.id
WHERE c.id = $1;

-- name: ListCommentsByPost :many
-- Update existing query to handle deleted comments
SELECT
  c.*,
  u.username as author_username,
  char.name as character_name,
  CASE WHEN c.deleted_at IS NOT NULL THEN TRUE ELSE FALSE END as is_deleted
FROM comments c
JOIN users u ON c.user_id = u.id
LEFT JOIN characters char ON c.character_id = char.id
WHERE c.post_id = $1
ORDER BY c.created_at ASC;

-- name: CheckCommentOwnership :one
SELECT user_id, deleted_at
FROM comments
WHERE id = $1;
```

**Query Performance Considerations:**
- [x] Index on deleted_at for filtering non-deleted comments
- [x] Index on edited_at for displaying edit indicators
- [x] No N+1 queries (comments fetched with user/character info)

### 3.3 Backend Service Layer

**Service Interface** (`backend/pkg/core/interfaces.go`):

```go
// Update existing MessageServiceInterface
type MessageServiceInterface interface {
    // ... existing methods ...

    // Comment editing
    UpdateComment(ctx context.Context, commentID int32, userID int32, content string) (*Comment, error)

    // Comment deletion
    DeleteComment(ctx context.Context, commentID int32, userID int32, isGM bool, isAdmin bool) error

    // Permission checks
    CanEditComment(ctx context.Context, commentID int32, userID int32) (bool, error)
    CanDeleteComment(ctx context.Context, commentID int32, userID int32, isGM bool, isAdmin bool) (bool, error)
}
```

**Domain Models** (`backend/pkg/core/models.go`):

```go
// Update existing Comment model
type Comment struct {
    ID               int32      `json:"id"`
    PostID           int32      `json:"post_id"`
    UserID           int32      `json:"user_id"`
    CharacterID      *int32     `json:"character_id,omitempty"`
    ParentCommentID  *int32     `json:"parent_comment_id,omitempty"`
    Content          string     `json:"content"`
    CreatedAt        time.Time  `json:"created_at"`
    UpdatedAt        time.Time  `json:"updated_at"`

    // New fields for editing/deletion
    EditedAt         *time.Time `json:"edited_at,omitempty"`
    EditCount        int        `json:"edit_count"`
    DeletedAt        *time.Time `json:"deleted_at,omitempty"`
    DeletedByUserID  *int32     `json:"deleted_by_user_id,omitempty"`

    // Computed fields
    IsDeleted        bool       `json:"is_deleted"`

    // Related data (from joins)
    AuthorUsername   string     `json:"author_username"`
    CharacterName    *string    `json:"character_name,omitempty"`
}

type UpdateCommentRequest struct {
    Content string `json:"content" validate:"required,min=1,max=10000"`
}
```

**Business Rules:**

1. **Only comment author can edit**
   - Validation: Check comment.user_id == requesting_user_id
   - Error: "You can only edit your own comments"

2. **Cannot edit deleted comments**
   - Validation: Check comment.deleted_at IS NULL
   - Error: "Cannot edit deleted comment"

3. **Delete permissions: Author OR GM OR Admin**
   - Validation: Check if user is comment author, game GM, or admin with admin mode on
   - Error: "You don't have permission to delete this comment"

4. **Cannot delete already-deleted comments**
   - Validation: Check comment.deleted_at IS NULL
   - Error: "Comment is already deleted"

5. **Deleted comments show "[deleted]" but preserve thread structure**
   - Implementation: Frontend renders "[deleted]" when deleted_at IS NOT NULL
   - Child comments remain visible

6. **Edited comments with new @mentions trigger notifications**
   - Implementation: Extract mentions from updated content, compare with original, create notifications for new mentions
   - Previous mentions keep their notifications

---

### 3.4 API Endpoints

**Base Path**: `/api/v1/comments`

#### PUT /api/v1/comments/:id
**Description**: Update a comment's content
**Auth Required**: Yes
**Permissions**: User must be comment author

**Request Body:**
```json
{
  "content": "Updated comment content with @CharacterName mention"
}
```

**Response (200 OK):**
```json
{
  "id": 123,
  "post_id": 456,
  "user_id": 789,
  "character_id": 101,
  "content": "Updated comment content with @CharacterName mention",
  "created_at": "2025-10-21T10:00:00Z",
  "updated_at": "2025-10-21T10:30:00Z",
  "edited_at": "2025-10-21T10:30:00Z",
  "edit_count": 1,
  "is_deleted": false,
  "author_username": "player1",
  "character_name": "Detective Kane"
}
```

**Error Responses:**
- `400 Bad Request`: Content validation failed (empty, too long)
- `401 Unauthorized`: No valid authentication token
- `403 Forbidden`: User is not comment author
- `404 Not Found`: Comment doesn't exist or is deleted
- `500 Internal Server Error`: Database error

---

#### DELETE /api/v1/comments/:id
**Description**: Soft-delete a comment
**Auth Required**: Yes
**Permissions**: User must be comment author OR game GM OR admin with admin mode enabled

**Response (204 No Content)**

**Error Responses:**
- `401 Unauthorized`: No valid authentication token
- `403 Forbidden`: User doesn't have permission to delete
- `404 Not Found`: Comment doesn't exist
- `409 Conflict`: Comment is already deleted
- `500 Internal Server Error`: Database error

---

#### GET /api/v1/comments/:id/permissions
**Description**: Check what actions user can perform on a comment
**Auth Required**: Yes
**Permissions**: Any authenticated user

**Response (200 OK):**
```json
{
  "can_edit": true,
  "can_delete": true
}
```

---

### 3.5 Frontend Components

**Component Hierarchy:**

```
[Comment] (existing component - updates)
├── [CommentHeader]
│   ├── [EditedIndicator] (new)
│   └── [CommentActions] (updated)
│       ├── [EditCommentButton] (new)
│       └── [DeleteCommentButton] (new)
├── [CommentContent]
│   └── [DeletedPlaceholder] (new)
└── [EditCommentForm] (new)
```

**Component Specifications:**

#### Component: `EditedIndicator`
**Location**: `frontend/src/components/comments/EditedIndicator.tsx`
**Purpose**: Show visual indicator when comment has been edited

**Props:**
```typescript
interface EditedIndicatorProps {
  editedAt: string | null;
  editCount: number;
}
```

**Rendering:**
- If `editedAt` is not null, show "(edited)" with tooltip showing timestamp
- Small, unobtrusive text using `text-content-tertiary`

---

#### Component: `EditCommentForm`
**Location**: `frontend/src/components/comments/EditCommentForm.tsx`
**Purpose**: Inline form for editing comment content

**Props:**
```typescript
interface EditCommentFormProps {
  comment: Comment;
  onSave: () => void;
  onCancel: () => void;
}
```

**State:**
- Local state: `content` (string), `isSubmitting` (boolean)
- Server state: Uses `useUpdateComment` mutation

**User Interactions:**
- Type in textarea → Updates local state
- Click "Save" → Calls API, triggers onSave callback
- Click "Cancel" → Calls onCancel without saving
- Supports markdown editing (existing editor component)

---

#### Component: `DeletedPlaceholder`
**Location**: `frontend/src/components/comments/DeletedPlaceholder.tsx`
**Purpose**: Show "[deleted]" text for deleted comments

**Props:**
```typescript
interface DeletedPlaceholderProps {
  deletedAt: string;
}
```

**Rendering:**
- Displays "[deleted]" in muted text color
- Shows timestamp in tooltip
- Maintains same height/structure as regular comment

---

### 3.6 Frontend API Client

**Location**: `frontend/src/lib/api.ts`

```typescript
class ApiClient {
  comments = {
    // ... existing methods ...

    // Update comment
    async updateComment(
      commentId: number,
      data: UpdateCommentRequest
    ): Promise<Comment> {
      const response = await this.client.put<Comment>(
        `/api/v1/comments/${commentId}`,
        data
      );
      return response.data;
    },

    // Delete comment
    async deleteComment(commentId: number): Promise<void> {
      await this.client.delete(`/api/v1/comments/${commentId}`);
    },

    // Get comment permissions
    async getCommentPermissions(commentId: number): Promise<CommentPermissions> {
      const response = await this.client.get<CommentPermissions>(
        `/api/v1/comments/${commentId}/permissions`
      );
      return response.data;
    },
  };
}
```

### 3.7 Frontend Custom Hooks

**Location**: `frontend/src/hooks/useCommentActions.ts`

```typescript
export function useUpdateComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, content }: { id: number; content: string }) =>
      apiClient.comments.updateComment(id, { content }),
    onSuccess: (data) => {
      // Invalidate comment queries
      queryClient.invalidateQueries({ queryKey: ['comments'] });
      queryClient.invalidateQueries({ queryKey: ['posts'] });

      // Process new @mentions and create notifications
      // (This will be handled by backend, but frontend can show optimistic update)
    },
  });
}

export function useDeleteComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (commentId: number) =>
      apiClient.comments.deleteComment(commentId),
    onSuccess: () => {
      // Invalidate comment queries to refresh UI
      queryClient.invalidateQueries({ queryKey: ['comments'] });
      queryClient.invalidateQueries({ queryKey: ['posts'] });
    },
  });
}

export function useCommentPermissions(commentId: number) {
  return useQuery({
    queryKey: ['comment-permissions', commentId],
    queryFn: () => apiClient.comments.getCommentPermissions(commentId),
    enabled: !!commentId,
  });
}
```

### 3.8 Frontend Type Definitions

**Location**: `frontend/src/types/comments.ts`

```typescript
export interface Comment {
  id: number;
  post_id: number;
  user_id: number;
  character_id?: number;
  parent_comment_id?: number;
  content: string;
  created_at: string;
  updated_at: string;

  // New fields
  edited_at?: string;
  edit_count: number;
  deleted_at?: string;
  deleted_by_user_id?: number;
  is_deleted: boolean;

  // Related data
  author_username: string;
  character_name?: string;
}

export interface UpdateCommentRequest {
  content: string;
}

export interface CommentPermissions {
  can_edit: boolean;
  can_delete: boolean;
}
```

---

## 4. Testing Strategy

### 4.1 Backend Tests

**Test Files:**
- `backend/pkg/db/services/messages/comment_edit_test.go` - Edit tests
- `backend/pkg/db/services/messages/comment_delete_test.go` - Delete tests
- `backend/pkg/messages/api_test.go` - API endpoint tests

**Unit Tests:**
```go
func TestMessageService_UpdateComment(t *testing.T) {
    tests := []struct {
        name        string
        commentID   int32
        userID      int32
        content     string
        setup       func(*MockDB)
        wantErr     bool
        errContains string
    }{
        {
            name:      "author can edit own comment",
            commentID: 1,
            userID:    100,
            content:   "Updated content",
            setup: func(db *MockDB) {
                db.Comments[1] = &Comment{
                    ID:     1,
                    UserID: 100,
                    Content: "Original content",
                }
            },
            wantErr: false,
        },
        {
            name:      "cannot edit other user's comment",
            commentID: 1,
            userID:    200,
            content:   "Updated content",
            setup: func(db *MockDB) {
                db.Comments[1] = &Comment{
                    ID:     1,
                    UserID: 100,
                }
            },
            wantErr:     true,
            errContains: "can only edit your own comments",
        },
        {
            name:      "cannot edit deleted comment",
            commentID: 1,
            userID:    100,
            content:   "Updated content",
            setup: func(db *MockDB) {
                deletedAt := time.Now()
                db.Comments[1] = &Comment{
                    ID:        1,
                    UserID:    100,
                    DeletedAt: &deletedAt,
                }
            },
            wantErr:     true,
            errContains: "Cannot edit deleted comment",
        },
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            // Test implementation
        })
    }
}

func TestMessageService_DeleteComment(t *testing.T) {
    tests := []struct {
        name        string
        commentID   int32
        userID      int32
        isGM        bool
        isAdmin     bool
        setup       func(*MockDB)
        wantErr     bool
        errContains string
    }{
        {
            name:      "author can delete own comment",
            commentID: 1,
            userID:    100,
            isGM:      false,
            isAdmin:   false,
            setup: func(db *MockDB) {
                db.Comments[1] = &Comment{ID: 1, UserID: 100}
            },
            wantErr: false,
        },
        {
            name:      "GM can delete any comment in their game",
            commentID: 1,
            userID:    200,
            isGM:      true,
            isAdmin:   false,
            setup: func(db *MockDB) {
                db.Comments[1] = &Comment{ID: 1, UserID: 100}
            },
            wantErr: false,
        },
        {
            name:      "admin can delete any comment",
            commentID: 1,
            userID:    300,
            isGM:      false,
            isAdmin:   true,
            setup: func(db *MockDB) {
                db.Comments[1] = &Comment{ID: 1, UserID: 100}
            },
            wantErr: false,
        },
        {
            name:      "regular user cannot delete other's comment",
            commentID: 1,
            userID:    200,
            isGM:      false,
            isAdmin:   false,
            setup: func(db *MockDB) {
                db.Comments[1] = &Comment{ID: 1, UserID: 100}
            },
            wantErr:     true,
            errContains: "don't have permission",
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
- [ ] Service layer: >90% coverage (critical for data integrity)
- [ ] Permission checks: 100% coverage
- [ ] API handlers: >85% coverage

### 4.2 Frontend Tests

**Test Files:**
- `frontend/src/components/__tests__/EditCommentForm.test.tsx`
- `frontend/src/components/__tests__/EditedIndicator.test.tsx`
- `frontend/src/components/__tests__/DeletedPlaceholder.test.tsx`
- `frontend/src/hooks/__tests__/useCommentActions.test.ts`

**Component Tests:**
```typescript
describe('EditCommentForm', () => {
  it('renders with existing comment content', () => {
    const comment = {
      id: 1,
      content: 'Original content',
      // ... other fields
    };

    render(<EditCommentForm comment={comment} onSave={vi.fn()} onCancel={vi.fn()} />);

    expect(screen.getByDisplayValue('Original content')).toBeInTheDocument();
  });

  it('saves edited content on submit', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    const comment = { id: 1, content: 'Original' };

    server.use(
      http.put('/api/v1/comments/1', () => {
        return HttpResponse.json({
          ...comment,
          content: 'Edited content',
          edited_at: new Date().toISOString(),
          edit_count: 1,
        });
      })
    );

    render(<EditCommentForm comment={comment} onSave={onSave} onCancel={vi.fn()} />);

    const textarea = screen.getByRole('textbox');
    await user.clear(textarea);
    await user.type(textarea, 'Edited content');
    await user.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalled();
    });
  });

  it('cancels edit without saving', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();

    render(<EditCommentForm comment={{ id: 1, content: 'Original' }} onSave={vi.fn()} onCancel={onCancel} />);

    await user.click(screen.getByRole('button', { name: /cancel/i }));

    expect(onCancel).toHaveBeenCalled();
  });
});

describe('DeletedPlaceholder', () => {
  it('displays deleted message', () => {
    render(<DeletedPlaceholder deletedAt="2025-10-21T10:00:00Z" />);

    expect(screen.getByText('[deleted]')).toBeInTheDocument();
  });
});

describe('EditedIndicator', () => {
  it('shows edited indicator when comment is edited', () => {
    render(<EditedIndicator editedAt="2025-10-21T10:00:00Z" editCount={1} />);

    expect(screen.getByText(/edited/i)).toBeInTheDocument();
  });

  it('does not show when comment is not edited', () => {
    render(<EditedIndicator editedAt={null} editCount={0} />);

    expect(screen.queryByText(/edited/i)).not.toBeInTheDocument();
  });
});
```

**Test Coverage Goals:**
- [ ] Components: >85% coverage
- [ ] Edit/delete flows: 100% coverage
- [ ] Permission checks: 100% coverage

### 4.3 Regression Tests

**Critical Bugs to Prevent:**

1. **Bug**: Deleted comments break thread structure
   - **Test**: `TestDeleteComment_PreservesThreadStructure`
   - **Location**: `backend/pkg/db/services/messages/comment_delete_test.go`

2. **Bug**: Users can edit other users' comments by manipulating API calls
   - **Test**: `TestUpdateComment_EnforcesOwnership`
   - **Location**: `backend/pkg/db/services/messages/comment_edit_test.go`

3. **Bug**: Editing comment removes existing notifications
   - **Test**: `TestUpdateComment_PreservesExistingNotifications`
   - **Location**: `backend/pkg/db/services/messages/comment_edit_test.go`

### 4.4 Manual UI Testing Checklist

**Happy Path Testing:**
- [ ] Create a comment as player
- [ ] Edit the comment → Verify "edited" indicator appears
- [ ] Edit again → Verify edit count increments
- [ ] Delete the comment → Verify "[deleted]" appears
- [ ] Verify replies to deleted comment still visible
- [ ] Log in as GM → Delete another player's comment
- [ ] Enable admin mode → Delete comment in any game

**Error Handling Testing:**
- [ ] Try to edit another user's comment → Verify no edit button
- [ ] Try to delete another user's comment (as player) → Verify no delete button
- [ ] Try to edit already-deleted comment → Verify edit not available
- [ ] Submit edit with empty content → Verify validation error
- [ ] Test edit with very long content (>10000 chars) → Verify validation

**Mention Testing:**
- [ ] Edit comment to add new @mention → Verify new notification created
- [ ] Edit comment to remove @mention → Verify old notification still exists
- [ ] Add multiple @mentions in one edit → Verify all get notified

**UI/UX Testing:**
- [ ] Edit form appears inline (not modal)
- [ ] Edit button placement is intuitive
- [ ] Delete confirmation dialog is clear
- [ ] Deleted comments maintain visual thread hierarchy
- [ ] "Edited" indicator is visible but not distracting

**Notes Section:**
```
- Test with deeply nested comments (5+ levels)
- Verify thread collapse/expand still works with deleted comments
- Check that markdown rendering works in edit form
- Test character mention autocomplete in edit mode
```

---

## 5. User Stories for E2E Testing (Future)

**Journey Name**: User edits and deletes comments with mentions

**User Goal**: Correct mistakes and manage their own content

**Journey Steps**:
1. User logs in and navigates to game
2. Creates a comment with typo
3. Immediately edits comment to fix typo
4. Sees "edited" indicator on comment
5. Adds @mention to another character in edit
6. Mentioned character receives notification
7. User decides to delete comment
8. Clicks delete and confirms
9. Comment shows "[deleted]" but replies remain
10. Other users see thread structure intact

**Critical User Flows to Test**:
- [ ] **Flow 1**: Edit comment, add mentions, verify notifications
- [ ] **Flow 2**: Delete comment with replies, verify thread preserved
- [ ] **Flow 3**: GM deletes inappropriate comment

**E2E Test Priority**: High (Core user-facing feature)

---

## 6. Implementation Plan

### Phase 1: Database & Backend Foundation
**Estimated Time**: 3 hours

- [ ] Create database migration files
  - [ ] `.up.sql` with new columns and indexes
  - [ ] `.down.sql` with rollback logic
- [ ] Update SQL queries in `queries/comments.sql`
- [ ] Run `just sqlgen` to regenerate models
- [ ] Update Comment interface in `core/interfaces.go`
- [ ] Update Comment model in `core/models.go`
- [ ] **Write unit tests first** for edit and delete
- [ ] Implement UpdateComment method
- [ ] Implement DeleteComment method
- [ ] Implement permission check methods
- [ ] Run tests: `just test-mocks`

**Acceptance Criteria:**
- [ ] Migration applies and rolls back cleanly
- [ ] All unit tests passing
- [ ] Permission checks working correctly

### Phase 2: API Endpoints
**Estimated Time**: 2 hours

- [ ] Implement PUT /api/v1/comments/:id endpoint
- [ ] Implement DELETE /api/v1/comments/:id endpoint
- [ ] Implement GET /api/v1/comments/:id/permissions endpoint
- [ ] Add request validation
- [ ] Add error handling
- [ ] Update existing GET endpoints to include new fields
- [ ] **Write API integration tests**
- [ ] Test with database: `SKIP_DB_TESTS=false just test`
- [ ] Manual testing with curl

**Acceptance Criteria:**
- [ ] All endpoints return correct status codes
- [ ] Permission checks enforced
- [ ] All API tests passing

### Phase 3: Mentions & Notifications
**Estimated Time**: 2 hours

- [ ] Extract @mentions from edited comment content
- [ ] Compare with original mentions
- [ ] Create notifications for new mentions
- [ ] **Write tests for mention extraction and notification**
- [ ] Integrate with existing notification system

**Acceptance Criteria:**
- [ ] New mentions trigger notifications
- [ ] Old mentions keep notifications
- [ ] Tests verify mention logic

### Phase 4: Frontend Implementation
**Estimated Time**: 4 hours

- [ ] Update Comment type in `types/comments.ts`
- [ ] Add API methods to `lib/api.ts`
- [ ] Create `useUpdateComment` hook
- [ ] Create `useDeleteComment` hook
- [ ] Create `useCommentPermissions` hook
- [ ] **Write hook tests**
- [ ] Create `EditedIndicator` component (semantic theme tokens)
- [ ] Create `EditCommentForm` component (semantic theme tokens, use UI components)
- [ ] Create `DeletedPlaceholder` component (semantic theme tokens)
- [ ] **Write component tests**
- [ ] Update Comment component to show edit/delete buttons
- [ ] Add confirmation dialog for delete
- [ ] Style with Tailwind + semantic tokens
- [ ] Run tests: `just test-frontend`

**Acceptance Criteria:**
- [ ] Edit and delete UI integrated into Comment component
- [ ] Uses semantic theme tokens throughout
- [ ] All frontend tests passing
- [ ] Responsive design works

### Phase 5: Manual Testing & Documentation
**Estimated Time**: 2 hours

- [ ] **Manual UI testing** (use checklist from Section 4.4)
  - [ ] Happy path: Edit, delete, verify indicators
  - [ ] Error scenarios: Permission checks
  - [ ] Mention scenarios: Add/remove mentions
- [ ] Performance testing
  - [ ] Edit/delete actions are fast
  - [ ] No console errors
- [ ] Security review
  - [ ] Permission checks cannot be bypassed
  - [ ] Soft deletes preserve data
- [ ] Documentation updates
  - [ ] Update API documentation
  - [ ] Document soft delete behavior

**Acceptance Criteria:**
- [ ] All manual test scenarios pass
- [ ] Security review complete
- [ ] Documentation updated

---

## 7. Rollout Strategy

### Deployment Checklist
- [ ] Database migration tested in staging
- [ ] All existing comments work with new schema
- [ ] Monitoring configured
- [ ] Rollback plan documented

### Rollback Plan
**If deployment fails:**

1. Rollback migration: `just migrate_down`
2. Revert backend code
3. Revert frontend code

**Rollback triggers:**
- Data corruption in comments table
- Performance degradation >30%
- Critical permission bypass discovered

---

## 8. Monitoring & Observability

### Metrics to Track
- [ ] Comment edit rate (edits per day)
- [ ] Comment delete rate (deletes per day)
- [ ] Failed edit/delete attempts (permission denials)
- [ ] API latency for edit/delete endpoints

### Logging
- [ ] All edits logged with user ID and comment ID
- [ ] All deletes logged with who deleted (author/GM/admin)
- [ ] Permission denials logged

### Alerts
- [ ] Failed permission checks >20/hour → Warning
- [ ] Edit/delete endpoint latency p95 >500ms → Warning

---

## 9. Documentation

### User Documentation
- [ ] Guide on editing and deleting comments
- [ ] Explanation of "[deleted]" placeholders
- [ ] GM moderation capabilities

### Developer Documentation
- [ ] Soft delete pattern documentation
- [ ] Permission check flow diagram
- [ ] Mention extraction logic

---

## 10. Open Questions

**Technical Questions:**
- [x] Should there be edit time limit? → Answer: No, users can always edit
- [x] Should edit history be kept? → Answer: Not in v1, future enhancement

**Product Questions:**
- [x] Can GMs edit comments? → Answer: No, only delete

---

## 11. Risks & Mitigations

### Technical Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Soft delete breaks queries | Low | High | Index on deleted_at, test all queries |
| Mention extraction fails | Low | Medium | Comprehensive regex testing |
| Permission check bypass | Low | Critical | Server-side validation always |

---

## 12. Future Enhancements

**Post-MVP Ideas:**
- Enhancement 1: Edit history with version diff view
- Enhancement 2: Time limit on edits (e.g., 5 minutes)
- Enhancement 3: Admin restore deleted comments
- Enhancement 4: Bulk moderation tools

---

## 13. References

### Related Documentation
- `.claude/context/STATE_MANAGEMENT.md` - Frontend patterns
- `backend/pkg/db/services/messages/` - Message service implementation

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
