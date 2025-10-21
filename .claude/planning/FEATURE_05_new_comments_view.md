# Feature: New Comments View

**Status**: Planning
**Created**: 2025-10-21
**Last Updated**: 2025-10-21
**Owner**: AI Session
**Related ADRs**: ADR-005 (Frontend State Management)
**Related Issues**: N/A

---

## 1. Overview

### Problem Statement
**What problem does this feature solve?**

Players currently struggle to track new comments across multiple posts in the common room. To find new activity, they must:
- Scroll through multiple GM posts
- Expand each post to see comments
- Remember which comments they've already read
- Navigate complex threading structures

This makes it difficult to keep up with active games, especially those with lots of discussion.

### Goals
**What are we trying to achieve?**

- [ ] Goal 1: Provide a dedicated "New Comments" view showing recent unread comments
- [ ] Goal 2: Show immediate parent comment for each new comment to provide context
- [ ] Goal 3: Include deep links to the full thread for both comment and parent
- [ ] Goal 4: Sort comments by date, newest first
- [ ] Goal 5: Show NEW badges aligned with existing `unread_comment_ids` tracking
- [ ] Goal 6: Implement infinite scroll (start with 10, load more as needed)
- [ ] Goal 7: Integrate as separate tab within Common Room section

### Non-Goals
**What is explicitly out of scope?**

- Non-goal 1: "Mark all as read" button (scrapped from requirements)
- Non-goal 2: Filtering by post or character
- Non-goal 3: Replying directly from this view (use deep link to thread)
- Non-goal 4: Showing full comment chain (only immediate parent)

### Success Criteria
**How do we know this feature is successful?**

- [ ] Players can view most recent comments in chronological order
- [ ] Parent comments provide sufficient context
- [ ] Deep links navigate to correct thread location
- [ ] NEW badges appear for unread comments
- [ ] Infinite scroll loads more comments smoothly
- [ ] View is easily accessible from Common Room
- [ ] Unit test coverage: >80% for service layer
- [ ] Integration tests: All API endpoints tested
- [ ] Component test coverage: >85% for frontend
- [ ] All regression tests passing
- [ ] Manual UI testing complete with documented flows

---

## 2. User Stories

### Primary User Stories

```gherkin
As a player
I want to see all new comments in one place
So that I can catch up on activity without navigating multiple threads

Acceptance Criteria:
- Given I navigate to the "New Comments" tab
  When the view loads
  Then I see the 10 most recent comments sorted newest first
  And each comment shows its parent for context
  And unread comments have a NEW badge
```

```gherkin
As a player
I want to jump to the full thread from a new comment
So that I can see the complete conversation

Acceptance Criteria:
- Given I am viewing a comment in the New Comments view
  When I click the deep link on the comment
  Then I navigate to the common room thread
  And the specific comment is highlighted/scrolled to
```

```gherkin
As a player
I want to see the parent comment for context
So that I understand what the comment is responding to

Acceptance Criteria:
- Given a comment is a reply to another comment
  When I view it in New Comments
  Then I see the parent comment above it
  And the parent has a deep link to its location
  And the parent shows who wrote it and when
```

```gherkin
As a player
I want to scroll to see older comments
So that I can catch up if I've been away for a while

Acceptance Criteria:
- Given I am at the bottom of the New Comments list
  When I scroll down
  Then the next 10 comments load automatically
  And there's a loading indicator while fetching
  And scrolling continues until all comments are loaded
```

### Edge Cases & Error Scenarios

- **Edge Case 1**: Comment has no parent (top-level comment) → Show comment without parent section
- **Edge Case 2**: Parent comment was deleted → Show "[deleted]" placeholder as parent
- **Edge Case 3**: No unread comments → Show empty state with friendly message
- **Edge Case 4**: All comments are read → Still shows recent comments, no NEW badges
- **Edge Case 5**: Deep link to deleted comment → Navigate to post, show message
- **Error Scenario 1**: Network failure loading more → Show retry button
- **Error Scenario 2**: Invalid comment ID in deep link → Navigate to post

---

## 3. Technical Design

### 3.1 Database Schema

**No schema changes needed** - uses existing tables:
- `comments` table (already has all needed data)
- Existing `unread_comment_ids` tracking in game_participants

### 3.2 Database Queries (sqlc)

**Location**: `backend/pkg/db/queries/comments.sql`

```sql
-- name: ListRecentCommentsWithParents :many
-- Get recent comments with their parent comments for New Comments view
WITH recent_comments AS (
    SELECT
        c.id,
        c.post_id,
        c.parent_comment_id,
        c.user_id,
        c.character_id,
        c.content,
        c.created_at,
        c.updated_at,
        c.edited_at,
        c.edit_count,
        c.deleted_at,
        u.username as author_username,
        char.name as character_name,
        p.title as post_title
    FROM comments c
    JOIN users u ON c.user_id = u.id
    LEFT JOIN characters char ON c.character_id = char.id
    JOIN posts p ON c.post_id = p.id
    WHERE c.post_id IN (
        SELECT id FROM posts WHERE game_id = $1
    )
    AND c.deleted_at IS NULL
    ORDER BY c.created_at DESC
    LIMIT $2 OFFSET $3
),
parent_comments AS (
    SELECT
        c.id,
        c.content,
        c.created_at,
        c.deleted_at,
        u.username as author_username,
        char.name as character_name
    FROM comments c
    JOIN users u ON c.user_id = u.id
    LEFT JOIN characters char ON c.character_id = char.id
    WHERE c.id IN (
        SELECT parent_comment_id FROM recent_comments
        WHERE parent_comment_id IS NOT NULL
    )
)
SELECT
    rc.*,
    pc.id as parent_id,
    pc.content as parent_content,
    pc.created_at as parent_created_at,
    pc.deleted_at as parent_deleted_at,
    pc.author_username as parent_author_username,
    pc.character_name as parent_character_name
FROM recent_comments rc
LEFT JOIN parent_comments pc ON rc.parent_comment_id = pc.id
ORDER BY rc.created_at DESC;

-- name: GetTotalCommentCount :one
-- Get total count of comments in a game
SELECT COUNT(*) as total
FROM comments c
JOIN posts p ON c.post_id = p.id
WHERE p.game_id = $1
  AND c.deleted_at IS NULL;
```

**Query Performance Considerations:**
- [x] Uses existing indexes on comments table
- [x] CTE for efficient parent comment fetching
- [x] Pagination via LIMIT/OFFSET
- [x] Already have index on (post_id, created_at)

### 3.3 Backend Service Layer

**Service Interface** (`backend/pkg/core/interfaces.go`):

```go
// Add to existing MessageServiceInterface
type MessageServiceInterface interface {
    // ... existing methods ...

    // New comments view
    ListRecentCommentsWithParents(
        ctx context.Context,
        gameID int32,
        limit int,
        offset int,
    ) ([]*CommentWithParent, error)

    GetTotalCommentCount(ctx context.Context, gameID int32) (int, error)
}
```

**Domain Models** (`backend/pkg/core/models.go`):

```go
// Add new model for comment with parent
type CommentWithParent struct {
    // Comment data
    ID              int32      `json:"id"`
    PostID          int32      `json:"post_id"`
    PostTitle       string     `json:"post_title"`
    ParentCommentID *int32     `json:"parent_comment_id,omitempty"`
    UserID          int32      `json:"user_id"`
    CharacterID     *int32     `json:"character_id,omitempty"`
    Content         string     `json:"content"`
    CreatedAt       time.Time  `json:"created_at"`
    UpdatedAt       time.Time  `json:"updated_at"`
    EditedAt        *time.Time `json:"edited_at,omitempty"`
    EditCount       int        `json:"edit_count"`
    DeletedAt       *time.Time `json:"deleted_at,omitempty"`
    AuthorUsername  string     `json:"author_username"`
    CharacterName   *string    `json:"character_name,omitempty"`

    // Parent comment data (null if top-level comment)
    ParentID             *int32     `json:"parent_id,omitempty"`
    ParentContent        *string    `json:"parent_content,omitempty"`
    ParentCreatedAt      *time.Time `json:"parent_created_at,omitempty"`
    ParentDeletedAt      *time.Time `json:"parent_deleted_at,omitempty"`
    ParentAuthorUsername *string    `json:"parent_author_username,omitempty"`
    ParentCharacterName  *string    `json:"parent_character_name,omitempty"`
}
```

**Business Rules:**

1. **Only show comments from posts in the game**
   - Validation: Filter by game_id via posts table
   - Ensures cross-game comment leakage impossible

2. **Do not show deleted comments**
   - Filter: WHERE deleted_at IS NULL
   - Maintains clean view

3. **Parent comments can be deleted**
   - Implementation: If parent has deleted_at, show "[deleted]" in UI
   - Preserves context while respecting deletions

---

### 3.4 API Endpoints

**Base Path**: `/api/v1/games/:game_id`

#### GET /api/v1/games/:game_id/comments/recent
**Description**: Get recent comments with parent context
**Auth Required**: Yes
**Permissions**: User must have access to the game

**Query Parameters:**
- `limit` (int, optional): Number of results (default: 10, max: 50)
- `offset` (int, optional): Pagination offset (default: 0)

**Response (200 OK):**
```json
{
  "comments": [
    {
      "id": 123,
      "post_id": 456,
      "post_title": "Night Falls",
      "parent_comment_id": 122,
      "user_id": 789,
      "character_id": 100,
      "content": "I agree, we should investigate tonight.",
      "created_at": "2025-10-21T15:00:00Z",
      "updated_at": "2025-10-21T15:00:00Z",
      "edited_at": null,
      "edit_count": 0,
      "author_username": "player1",
      "character_name": "Detective Kane",

      "parent_id": 122,
      "parent_content": "Those footprints are the clincher.",
      "parent_created_at": "2025-10-21T14:30:00Z",
      "parent_deleted_at": null,
      "parent_author_username": "player2",
      "parent_character_name": "Dr. Chen"
    }
  ],
  "total": 45,
  "limit": 10,
  "offset": 0
}
```

**Error Responses:**
- `401 Unauthorized`: No valid authentication token
- `403 Forbidden`: User doesn't have access to game
- `404 Not Found`: Game doesn't exist
- `500 Internal Server Error`: Database error

---

### 3.5 Frontend Components

**Component Hierarchy:**

```
[CommonRoomView] (existing - updates)
├── [TabNavigation] (existing - updates)
│   ├── [LatestPostsTab] (existing)
│   └── [NewCommentsTab] (new)
└── [NewCommentsView] (new)
    ├── [CommentWithParentCard] (new)
    │   ├── [ParentCommentPreview] (new)
    │   └── [CommentPreview] (new)
    └── [InfiniteScrollTrigger] (new)
```

**Component Specifications:**

#### Component: `NewCommentsView`
**Location**: `frontend/src/components/comments/NewCommentsView.tsx`
**Purpose**: Main container for new comments feed

**Props:**
```typescript
interface NewCommentsViewProps {
  gameId: number;
}
```

**State:**
- Server state: Uses `useRecentComments` infinite query
- Local state: None needed (query handles pagination)

**Features:**
- Infinite scroll
- Shows loading indicator while fetching
- Empty state when no comments
- Integration with unread tracking for NEW badges

---

#### Component: `CommentWithParentCard`
**Location**: `frontend/src/components/comments/CommentWithParentCard.tsx`
**Purpose**: Display single comment with parent context

**Props:**
```typescript
interface CommentWithParentCardProps {
  comment: CommentWithParent;
  unreadCommentIds: number[];
}
```

**Rendering:**
- Shows parent comment (if exists) with muted styling
- Shows main comment with full styling
- Both have deep link buttons
- NEW badge if comment ID in unreadCommentIds
- Uses semantic theme tokens throughout

---

#### Component: `ParentCommentPreview`
**Location**: `frontend/src/components/comments/ParentCommentPreview.tsx`
**Purpose**: Display parent comment context

**Props:**
```typescript
interface ParentCommentPreviewProps {
  parentId: number;
  parentContent: string;
  parentAuthorUsername: string;
  parentCharacterName?: string;
  parentCreatedAt: string;
  parentDeleted: boolean;
  postId: number;
}
```

**Rendering:**
- Muted background (surface-raised)
- Smaller text
- "In reply to" label
- Deep link to parent comment
- If deleted, shows "[deleted]" placeholder

---

#### Component: `InfiniteScrollTrigger`
**Location**: `frontend/src/components/common/InfiniteScrollTrigger.tsx`
**Purpose**: Trigger loading more items when scrolled into view

**Props:**
```typescript
interface InfiniteScrollTriggerProps {
  onLoadMore: () => void;
  isLoading: boolean;
  hasMore: boolean;
}
```

**Implementation:**
- Uses Intersection Observer API
- Calls onLoadMore when visible
- Shows loading spinner when isLoading
- Hidden when !hasMore

---

### 3.6 Frontend API Client

**Location**: `frontend/src/lib/api.ts`

```typescript
class ApiClient {
  comments = {
    // ... existing methods ...

    // Get recent comments with parents
    async getRecentComments(
      gameId: number,
      options?: { limit?: number; offset?: number }
    ): Promise<{
      comments: CommentWithParent[];
      total: number;
      limit: number;
      offset: number;
    }> {
      const response = await this.client.get<{
        comments: CommentWithParent[];
        total: number;
        limit: number;
        offset: number;
      }>(`/api/v1/games/${gameId}/comments/recent`, {
        params: options,
      });
      return response.data;
    },
  };
}
```

### 3.7 Frontend Custom Hooks

**Location**: `frontend/src/hooks/useRecentComments.ts`

```typescript
export function useRecentComments(gameId: number) {
  return useInfiniteQuery({
    queryKey: ['recent-comments', gameId],
    queryFn: ({ pageParam = 0 }) =>
      apiClient.comments.getRecentComments(gameId, {
        limit: 10,
        offset: pageParam,
      }),
    getNextPageParam: (lastPage) => {
      const loadedCount = lastPage.offset + lastPage.comments.length;
      return loadedCount < lastPage.total ? loadedCount : undefined;
    },
    staleTime: 30000, // 30 seconds
  });
}
```

### 3.8 Frontend Type Definitions

**Location**: `frontend/src/types/comments.ts`

```typescript
export interface CommentWithParent {
  // Comment data
  id: number;
  post_id: number;
  post_title: string;
  parent_comment_id?: number;
  user_id: number;
  character_id?: number;
  content: string;
  created_at: string;
  updated_at: string;
  edited_at?: string;
  edit_count: number;
  deleted_at?: string;
  author_username: string;
  character_name?: string;

  // Parent comment data
  parent_id?: number;
  parent_content?: string;
  parent_created_at?: string;
  parent_deleted_at?: string;
  parent_author_username?: string;
  parent_character_name?: string;
}
```

---

## 4. Testing Strategy

### 4.1 Backend Tests

**Test Files:**
- `backend/pkg/db/services/messages/recent_comments_test.go`

**Unit Tests:**
```go
func TestMessageService_ListRecentCommentsWithParents(t *testing.T) {
    tests := []struct {
        name       string
        gameID     int32
        limit      int
        offset     int
        setup      func(*TestDB)
        wantCount  int
        wantErr    bool
    }{
        {
            name:      "returns recent comments with parents",
            gameID:    1,
            limit:     10,
            offset:    0,
            setup: func(db *TestDB) {
                // Setup posts, comments, parent comments
            },
            wantCount: 10,
            wantErr:   false,
        },
        {
            name:      "handles comments without parents",
            gameID:    1,
            limit:     10,
            offset:    0,
            setup: func(db *TestDB) {
                // Setup top-level comments
            },
            wantCount: 5,
            wantErr:   false,
        },
        {
            name:      "excludes deleted comments",
            gameID:    1,
            limit:     10,
            offset:    0,
            setup: func(db *TestDB) {
                // Setup with some deleted comments
            },
            wantCount: 7, // Only non-deleted
            wantErr:   false,
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
- [ ] Service layer: >85% coverage
- [ ] API handlers: >80% coverage
- [ ] Parent comment joining: 100% coverage

### 4.2 Frontend Tests

**Test Files:**
- `frontend/src/components/__tests__/NewCommentsView.test.tsx`
- `frontend/src/components/__tests__/CommentWithParentCard.test.tsx`
- `frontend/src/hooks/__tests__/useRecentComments.test.ts`

**Component Tests:**
```typescript
describe('NewCommentsView', () => {
  it('displays recent comments', async () => {
    server.use(
      http.get('/api/v1/games/1/comments/recent', () => {
        return HttpResponse.json({
          comments: [
            {
              id: 1,
              content: 'Test comment',
              author_username: 'player1',
              parent_content: 'Parent comment',
              // ... other fields
            },
          ],
          total: 1,
          limit: 10,
          offset: 0,
        });
      })
    );

    render(<NewCommentsView gameId={1} />);

    await waitFor(() => {
      expect(screen.getByText('Test comment')).toBeInTheDocument();
      expect(screen.getByText('Parent comment')).toBeInTheDocument();
    });
  });

  it('shows empty state when no comments', async () => {
    server.use(
      http.get('/api/v1/games/1/comments/recent', () => {
        return HttpResponse.json({
          comments: [],
          total: 0,
          limit: 10,
          offset: 0,
        });
      })
    );

    render(<NewCommentsView gameId={1} />);

    await waitFor(() => {
      expect(screen.getByText(/no new comments/i)).toBeInTheDocument();
    });
  });

  it('loads more comments on scroll', async () => {
    // Test infinite scroll functionality
  });
});

describe('CommentWithParentCard', () => {
  it('shows NEW badge for unread comments', () => {
    const comment = {
      id: 123,
      content: 'Test',
      // ... other fields
    };

    render(
      <CommentWithParentCard
        comment={comment}
        unreadCommentIds={[123]}
      />
    );

    expect(screen.getByText('NEW')).toBeInTheDocument();
  });

  it('shows deleted placeholder for deleted parent', () => {
    const comment = {
      id: 123,
      content: 'Reply',
      parent_content: 'Parent',
      parent_deleted_at: '2025-10-21T10:00:00Z',
      // ... other fields
    };

    render(
      <CommentWithParentCard
        comment={comment}
        unreadCommentIds={[]}
      />
    );

    expect(screen.getByText('[deleted]')).toBeInTheDocument();
  });
});
```

**Test Coverage Goals:**
- [ ] Components: >85% coverage
- [ ] Infinite scroll: 100% coverage
- [ ] Deep linking: 100% coverage

### 4.3 Regression Tests

**Critical Bugs to Prevent:**

1. **Bug**: Comments from other games shown in view
   - **Test**: `TestRecentComments_OnlyShowsGameComments`
   - **Location**: `backend/pkg/db/services/messages/recent_comments_test.go`

2. **Bug**: Deleted comments appear in feed
   - **Test**: `TestRecentComments_ExcludesDeletedComments`
   - **Location**: Same as above

### 4.4 Manual UI Testing Checklist

**Happy Path Testing:**
- [ ] Navigate to Common Room → New Comments tab
- [ ] Verify 10 most recent comments load
- [ ] Verify parent comments show for replies
- [ ] Click deep link on comment → Navigate to thread
- [ ] Click deep link on parent → Navigate to parent
- [ ] Scroll down → Next 10 comments load
- [ ] Verify NEW badges appear for unread comments

**Error Handling Testing:**
- [ ] No comments in game → Empty state displays
- [ ] Network failure loading more → Retry button appears
- [ ] Deep link to deleted comment → Graceful handling

**UI/UX Testing:**
- [ ] Parent comments visually distinct from main comments
- [ ] Deep link buttons are intuitive
- [ ] Infinite scroll loads smoothly
- [ ] Loading indicators appear appropriately
- [ ] NEW badges are prominent but not distracting

**Notes Section:**
```
- Test with game that has 100+ comments
- Verify performance with infinite scroll
- Check that unread tracking integrates correctly
```

---

## 5. User Stories for E2E Testing (Future)

**Journey Name**: Player catches up on new comments

**User Goal**: Quickly review all new activity in the game

**Journey Steps**:
1. Player logs in after being away for a day
2. Navigates to game
3. Clicks "New Comments" tab
4. Sees list of recent comments with parent context
5. Reads through comments
6. Clicks deep link on interesting comment
7. Navigates to full thread to participate

**Critical User Flows to Test**:
- [ ] **Flow 1**: View new comments → Click deep link → Navigate to thread
- [ ] **Flow 2**: Infinite scroll → Load all comments → Empty state at end
- [ ] **Flow 3**: Unread badges appear → Navigate to thread → Badges clear

**E2E Test Priority**: Medium (Nice-to-have feature)

---

## 6. Implementation Plan

### Phase 1: Database & Backend
**Estimated Time**: 2 hours

- [ ] Write SQL query with CTE for parent joining
- [ ] Add to `queries/comments.sql`
- [ ] Run `just sqlgen`
- [ ] Update interface
- [ ] Update models
- [ ] **Write unit tests**
- [ ] Implement ListRecentCommentsWithParents
- [ ] Run tests: `just test-mocks`

**Acceptance Criteria:**
- [ ] Query efficient (CTE)
- [ ] All unit tests passing
- [ ] Parent joining working

### Phase 2: API Endpoints
**Estimated Time**: 1 hour

- [ ] Implement GET /api/v1/games/:id/comments/recent
- [ ] Add request validation
- [ ] **Write API tests**
- [ ] Test with database

**Acceptance Criteria:**
- [ ] Endpoint working
- [ ] All API tests passing

### Phase 3: Frontend Implementation
**Estimated Time**: 4 hours

- [ ] Update types
- [ ] Add API method
- [ ] Create useRecentComments hook
- [ ] **Write hook tests**
- [ ] Create NewCommentsView (semantic tokens)
- [ ] Create CommentWithParentCard (semantic tokens)
- [ ] Create ParentCommentPreview (semantic tokens)
- [ ] Create InfiniteScrollTrigger
- [ ] **Write component tests**
- [ ] Add tab to Common Room
- [ ] Integrate unread tracking
- [ ] Style with Tailwind
- [ ] Run tests: `just test-frontend`

**Acceptance Criteria:**
- [ ] All UI working
- [ ] Infinite scroll smooth
- [ ] All tests passing

### Phase 4: Manual Testing
**Estimated Time**: 1 hour

- [ ] **Manual UI testing**
- [ ] Performance testing
- [ ] Documentation updates

**Acceptance Criteria:**
- [ ] All manual tests pass
- [ ] Documentation updated

---

## 7. Rollout Strategy

### Deployment Checklist
- [ ] Query performance tested
- [ ] Infinite scroll working
- [ ] Monitoring configured

### Rollback Plan
1. Remove tab from UI
2. Revert backend
3. Revert frontend

---

## 8. Monitoring & Observability

### Metrics to Track
- [ ] New comments view usage
- [ ] Average comments loaded per session
- [ ] Deep link click rate
- [ ] Query performance

### Logging
- [ ] View access logged
- [ ] Query performance logged

---

## 9. Documentation

### User Documentation
- [ ] Guide for using New Comments view
- [ ] Deep linking explanation

---

## 10. Risks & Mitigations

### Technical Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Query performance with many comments | Low | Medium | CTE optimization, indexes |
| Infinite scroll bugs | Low | Low | Comprehensive testing |

---

## 11. Future Enhancements

- Enhancement 1: Filter by post
- Enhancement 2: Filter by character
- Enhancement 3: "Mark all as read" button
- Enhancement 4: Keyboard navigation

---

## Completion Checklist

- [ ] All implementation phases complete
- [ ] All tests passing (>85% coverage)
- [ ] Manual UI testing complete
- [ ] Documentation updated
- [ ] Deployed to production

**Archive this plan to** `.claude/planning/archive/` **when complete.**
