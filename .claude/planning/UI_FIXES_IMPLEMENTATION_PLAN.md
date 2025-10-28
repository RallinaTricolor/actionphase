# UI Fixes Implementation Plan

**Created**: October 27, 2025
**Source**: MORE_UI_NOTES.md verification results
**Total Issues**: 23 confirmed bugs/improvements

## Overview

This plan organizes all verified UI/UX fixes into logical implementation phases, ordered by:
- Dependencies between fixes
- Complexity and effort required
- User impact and priority
- Code locality (group related changes)

## Phase 1: Critical Quick Wins (High Impact, Low Effort)

**Goal**: Fix the most visible/broken UX issues
**Estimated Time**: 4-6 hours
**Files Modified**: ~8 files

### 1.1 Landing Page Sign-up Button (CSS Fix)

**Issue**: White text on blue button background - completely unreadable

**Files to Modify**:
- `frontend/src/pages/LandingPage.tsx` or relevant component
- Look for button with "Sign up or Login" text

**Implementation**:
```tsx
// Find the button element and update text color
<Button variant="primary">
  <span className="text-white">Sign up or Login</span>
</Button>
// Or fix the Button component's primary variant CSS
```

**Testing**:
- Visual inspection while logged out
- Verify text is readable in both light and dark mode

**Complexity**: ⭐ (Trivial)

---

### 1.2 "GameParticipants" Spacing Fix

**Issue**: Shows "GameParticipants (3)" instead of "Game Participants (3)"

**Files to Modify**:
- `frontend/src/pages/GameDetailsPage.tsx` (People tab section)
- Search for "GameParticipants" string literal

**Implementation**:
```tsx
// Change from:
<button>GameParticipants ({count})</button>

// To:
<button>Game Participants ({count})</button>
```

**Testing**:
- Navigate to any game → People tab
- Verify spacing in button text

**Complexity**: ⭐ (Trivial)

---

### 1.3 Delete Comment Browser Alert → Modal

**Issue**: Uses browser `confirm()` instead of custom modal

**Files to Modify**:
- `frontend/src/components/ThreadedComment.tsx` or comment component
- Look for `window.confirm()` or `confirm()` call

**Implementation**:
1. Import existing confirmation modal component (or create if needed)
2. Replace `confirm()` with state-controlled modal
3. Show modal with same message
4. Handle confirm/cancel actions

```tsx
const [showDeleteModal, setShowDeleteModal] = useState(false);

const handleDeleteClick = () => {
  setShowDeleteModal(true);
};

const handleConfirmDelete = async () => {
  await deleteComment(commentId);
  setShowDeleteModal(false);
};

// Render:
{showDeleteModal && (
  <ConfirmationModal
    title="Delete Comment"
    message="Are you sure you want to delete this comment? This action cannot be undone."
    onConfirm={handleConfirmDelete}
    onCancel={() => setShowDeleteModal(false)}
    variant="danger"
  />
)}
```

**Testing**:
- Try to delete any comment
- Verify modal appears instead of browser alert
- Test confirm and cancel actions

**Complexity**: ⭐⭐ (Simple)

---

### 1.4 Default Tab Should Be Common Room

**Issue**: Games load with "People" tab selected instead of "Common Room"

**Affected Sections**: Authenticated users, Players (duplicate issue)

**Files to Modify**:
- `frontend/src/pages/GameDetailsPage.tsx`
- Tab routing/default logic

**Implementation**:
```tsx
// In GameDetailsPage, update default tab logic:
const getDefaultTab = (gameState: string) => {
  if (gameState === 'in_progress') {
    // Check if there's an active action phase first
    if (hasActiveActionPhase) {
      return 'actions';
    }
    return 'common-room';
  }
  if (gameState === 'recruiting') {
    return 'people';
  }
  return 'common-room';
};

// Use in initial tab state
const [activeTab, setActiveTab] = useState(
  searchParams.get('tab') || getDefaultTab(game.state)
);
```

**Testing**:
- Navigate to in_progress game without ?tab= param
- Should default to common-room
- Navigate with explicit ?tab=people
- Should respect explicit parameter

**Complexity**: ⭐⭐ (Simple)

---

### 1.5 History View Read-Only for Active Phases

**Issue**: Both GM and Players can post comments in History view for active phases

**Files to Modify**:
- `frontend/src/components/CommonRoomHistory.tsx` or similar
- Add conditional rendering for reply/comment buttons

**Implementation**:
```tsx
// In history view component:
const isActivePhase = phase.id === currentPhaseId;

// Conditionally render action buttons:
{!isActivePhase && (
  <>
    <button onClick={handleReply}>Reply</button>
    <button onClick={handleAddComment}>Add Comment</button>
  </>
)}

// Or show read-only message:
{isActivePhase && (
  <div className="text-text-secondary">
    This is the current active phase. Use the Common Room tab to participate.
  </div>
)}
```

**Testing**:
- As GM: Navigate to History → Click active phase → Verify no reply/comment buttons
- As Player: Same verification
- Click on completed phase → Verify buttons still appear

**Complexity**: ⭐⭐ (Simple)

---

## Phase 2: Permission & Access Control Fixes

**Goal**: Fix permission-related bugs
**Estimated Time**: 6-8 hours
**Files Modified**: ~10 files (backend + frontend)

### 2.1 New Comments 403 for Non-Participants

**Issue**: Non-participants get 403 error when accessing New Comments tab

**Files to Modify**:
- `backend/pkg/conversations/api.go` (or relevant handler)
- Endpoint serving new comments
- Frontend error handling in `frontend/src/pages/GameDetailsPage.tsx`

**Backend Implementation**:
```go
// Option 1: Allow read access for non-participants
func (s *Service) GetNewComments(gameID int64, userID int64) ([]Comment, error) {
    // Remove participant check, or make it less restrictive
    // Allow anyone who can view the game to see new comments

    // Check if game is public or user has view access
    canView, err := s.CanViewGame(gameID, userID)
    if err != nil {
        return nil, err
    }
    if !canView {
        return nil, ErrForbidden
    }

    return s.queries.GetNewComments(gameID, userID)
}

// Option 2: Hide the tab for non-participants (frontend)
```

**Frontend Implementation**:
```tsx
// In GameDetailsPage, conditionally show New Comments tab
const canViewNewComments = isParticipant || game.isPublic;

{canViewNewComments ? (
  <button onClick={() => setSubTab('new-comments')}>
    New Comments
  </button>
) : (
  <Alert variant="info">
    Join the game to see new comments
  </Alert>
)}
```

**Testing**:
- As non-participant (TestPlayer4): View game 50704
- Click New Comments tab → Should either work or be hidden
- As participant: Verify still works

**Complexity**: ⭐⭐⭐ (Moderate - backend + frontend)

---

### 2.2 GM Can't Create Player Characters (403)

**Issue**: GMs get 403 when trying to create player characters

**Files to Modify**:
- `backend/pkg/characters/api.go`
- Character creation endpoint and permission checks
- `frontend/src/components/CharacterCreationForm.tsx` or similar

**Backend Implementation**:
```go
func (s *Service) CreateCharacter(req CreateCharacterRequest) (*Character, error) {
    // Check if user is GM
    isGM, err := s.IsGameMaster(req.GameID, req.CreatorUserID)
    if err != nil {
        return nil, err
    }

    if req.CharacterType == "player" {
        // GMs can create player characters
        if !isGM {
            return nil, ErrForbidden
        }
        // Require player assignment for GMs creating player chars
        if req.AssignedPlayerID == 0 {
            return nil, errors.New("player assignment required")
        }
    }

    // Continue with creation...
}
```

**Frontend Implementation**:
```tsx
// Add player assignment field for GMs creating player characters
{isGM && characterType === 'player' && (
  <Select
    label="Assign to Player"
    value={assignedPlayerId}
    onChange={setAssignedPlayerId}
    required
  >
    <option value="">Select player...</option>
    {participants
      .filter(p => p.role === 'player')
      .map(p => (
        <option key={p.userId} value={p.userId}>
          {p.username}
        </option>
      ))
    }
  </Select>
)}
```

**Testing**:
- As TestGM: Create new player character
- Should see player assignment dropdown
- Should successfully create when player assigned
- As TestPlayer1: Should not see option to create player chars

**Complexity**: ⭐⭐⭐ (Moderate)

---

### 2.3 Players Can Edit Character Stats (Should Be GM-Only)

**Issue**: Players can add abilities, skills, items, currency to their characters

**Files to Modify**:
- `frontend/src/components/CharacterSheet/AbilitiesSection.tsx`
- `frontend/src/components/CharacterSheet/InventorySection.tsx`
- Add permission checks before showing Add buttons

**Implementation**:
```tsx
// In character sheet components:
const canEditStats = isGM || character.type === 'npc';
const isOwnCharacter = character.userId === currentUserId;

// Conditionally render Add buttons:
{canEditStats && (
  <>
    <button onClick={handleAddAbility}>Add Ability</button>
    <button onClick={handleAddSkill}>Add Skill</button>
    <button onClick={handleAddItem}>Add Item</button>
    <button onClick={handleAddCurrency}>Add Currency</button>
  </>
)}

// Show helpful message for players:
{isOwnCharacter && !canEditStats && (
  <Alert variant="info">
    Only the GM can modify character stats. Contact your GM to add abilities or items.
  </Alert>
)}
```

**Backend Protection** (defense in depth):
```go
// In character update endpoints, verify GM permission
func (s *Service) AddCharacterAbility(req AddAbilityRequest) error {
    char, err := s.GetCharacter(req.CharacterID)
    if err != nil {
        return err
    }

    isGM, _ := s.IsGameMaster(char.GameID, req.UserID)
    isNPCOwner := char.Type == "npc" && char.AssignedGMID == req.UserID

    if !isGM && !isNPCOwner {
        return ErrForbidden
    }

    return s.queries.AddAbility(req)
}
```

**Testing**:
- As TestPlayer1: Edit own character → Verify no Add buttons for stats
- As TestGM: Edit any character → Verify Add buttons appear
- Try API call as player (curl) → Should return 403

**Complexity**: ⭐⭐⭐ (Moderate - multiple components + backend)

---

### 2.4 Audience Badge Shows "Player" on Dashboard

**Issue**: Audience members in recruiting games show "Player" badge instead of "Audience"

**Files to Modify**:
- `frontend/src/pages/Dashboard.tsx` or game card component
- Badge display logic

**Implementation**:
```tsx
// In game card component:
const getUserRole = (participation: Participation) => {
  // Check actual role from participation record
  if (participation.role === 'audience') {
    return 'Audience';
  }
  if (participation.role === 'player') {
    return participation.characterId ? 'Player' : 'Applied';
  }
  if (participation.role === 'gm') {
    return 'GM';
  }
  return participation.role;
};

<Badge variant={getBadgeVariant(participation.role)}>
  {getUserRole(participation)}
</Badge>
```

**Backend Check**:
- Verify API returns correct `role` field in participations
- Check `backend/pkg/db/queries/participations.sql`

**Testing**:
- As TestPlayer4: Join game as audience member
- Check dashboard → Should show "Audience" badge
- Join as player → Should show "Player" or "Applied"

**Complexity**: ⭐⭐ (Simple - likely just frontend logic)

---

## Phase 3: UI Polish & Component Improvements

**Goal**: Improve user experience with better UI components
**Estimated Time**: 8-10 hours
**Files Modified**: ~12 files

### 3.1 Apply to Join vs Join as Audience Redundancy

**Issue**: Two separate buttons for joining (one allows audience, one is audience-only)

**Files to Modify**:
- `frontend/src/pages/GameDetailsPage.tsx` or game header component
- Button rendering logic

**Implementation**:
```tsx
// Option 1: Remove "Join as Audience" button, keep unified "Apply to Join"
{game.state === 'recruiting' && !isParticipant && (
  <Button variant="primary" onClick={() => setShowApplicationModal(true)}>
    Apply to Join
  </Button>
)}

// In ApplicationModal, make role selection prominent:
<Select label="Join as..." value={role} onChange={setRole} required>
  <option value="player">Player (requires application review)</option>
  <option value="audience">Audience (instant join)</option>
</Select>

// Option 2: Keep separate buttons but make UX clearer:
<div className="flex gap-2">
  <Button variant="primary" onClick={() => openApplicationModal('player')}>
    Apply as Player
  </Button>
  <Button variant="secondary" onClick={() => joinAsAudience()}>
    Join as Audience
  </Button>
</div>
```

**Testing**:
- As non-participant: View recruiting game
- Verify single clear entry point for joining
- Test both player application and audience join flows

**Complexity**: ⭐⭐ (Simple)

---

### 3.2 GM Post Form Not Minimized

**Issue**: Post creation form is fully expanded when posts already exist

**Files to Modify**:
- `frontend/src/components/CommonRoom.tsx` or post creation component

**Implementation**:
```tsx
const [isFormExpanded, setIsFormExpanded] = useState(false);
const hasPosts = posts.length > 0;

// Default to collapsed if posts exist
useEffect(() => {
  setIsFormExpanded(!hasPosts);
}, [hasPosts]);

return (
  <>
    {!isFormExpanded ? (
      <Button
        variant="primary"
        onClick={() => setIsFormExpanded(true)}
        className="w-full"
      >
        Create New GM Post
      </Button>
    ) : (
      <Card>
        <CardHeader>
          <h3>Create New GM Post</h3>
          <button onClick={() => setIsFormExpanded(false)}>
            Minimize
          </button>
        </CardHeader>
        <CardBody>
          {/* Form fields */}
        </CardBody>
      </Card>
    )}
  </>
);
```

**Testing**:
- As GM: Navigate to common room with existing posts
- Form should be minimized by default
- Click to expand, create post
- After posting, form should minimize again

**Complexity**: ⭐⭐ (Simple)

---

### 3.3 Character Sheet Field Consolidation (2 fixes)

**Issue 3.3a**: Public Profile + Physical Appearance are redundant
**Issue 3.3b**: Private Notes + Secrets are redundant

**Files to Modify**:
- `frontend/src/components/CharacterSheet/BioBackgroundTab.tsx`
- `frontend/src/components/CharacterSheet/PrivateNotesTab.tsx`
- `backend/pkg/db/migrations/XXX_consolidate_character_fields.up.sql`
- Character sheet type definitions

**Database Migration**:
```sql
-- Migration: consolidate_character_fields
-- Merge physical_appearance into public_profile
UPDATE character_sheets
SET public_profile = CONCAT_WS(E'\n\n', public_profile, physical_appearance)
WHERE physical_appearance IS NOT NULL AND physical_appearance != '';

-- Merge secrets into private_notes
UPDATE character_sheets
SET private_notes = CONCAT_WS(E'\n\n', private_notes, secrets)
WHERE secrets IS NOT NULL AND secrets != '';

-- Drop columns (in separate migration for safety)
-- ALTER TABLE character_sheets DROP COLUMN physical_appearance;
-- ALTER TABLE character_sheets DROP COLUMN secrets;
```

**Frontend Implementation**:
```tsx
// BioBackgroundTab - remove Physical Appearance section
<Card>
  <CardHeader>
    <h4>Public Profile</h4>
    <p className="text-text-secondary">
      Character's appearance and background visible to all players
    </p>
  </CardHeader>
  <CardBody>
    <Textarea
      label="Public Profile"
      value={publicProfile}
      onChange={setPublicProfile}
      placeholder="Describe your character's appearance, mannerisms, and public background..."
      rows={8}
    />
  </CardBody>
</Card>

// PrivateNotesTab - remove Secrets section
<Card>
  <CardHeader>
    <h4>Private Notes</h4>
    <p className="text-text-secondary">
      Only visible to you and the GM
    </p>
  </CardHeader>
  <CardBody>
    <Textarea
      label="Private Notes"
      value={privateNotes}
      onChange={setPrivateNotes}
      placeholder="Character secrets, motivations, GM-only information..."
      rows={8}
    />
  </CardBody>
</Card>
```

**Testing**:
- Create new character → Verify single field for profile
- Edit existing character → Verify data preserved from both old fields
- Check with GM and player views

**Complexity**: ⭐⭐⭐ (Moderate - requires migration)

---

### 3.4 Phase Description Not Visible in Common Room

**Issue**: Phase description only shows in History, not in active Common Room

**Files to Modify**:
- `frontend/src/components/CommonRoom.tsx`
- Add phase description display near header

**Implementation**:
```tsx
// In CommonRoom component:
<div className="mb-6">
  <div className="flex items-center justify-between mb-2">
    <h2>Common Room - {phase.title}</h2>
    {phase.deadline && (
      <div className="text-text-secondary">
        Deadline: {formatDateTime(phase.deadline)}
      </div>
    )}
  </div>

  {phase.description && (
    <Card variant="bordered" padding="sm">
      <MarkdownPreview content={phase.description} />
    </Card>
  )}
</div>
```

**Testing**:
- Navigate to Common Room
- Verify phase description appears below header
- Check with phases that have/don't have descriptions

**Complexity**: ⭐⭐ (Simple)

---

### 3.5 Leave Game Button Too Prominent

**Issue**: "Leave Game" button is prominently displayed in game header

**Files to Modify**:
- `frontend/src/pages/GameDetailsPage.tsx` game header section

**Implementation Options**:

**Option 1: Move to dropdown menu**
```tsx
<DropdownMenu>
  <DropdownMenuTrigger>
    <button>⋮ More</button>
  </DropdownMenuTrigger>
  <DropdownMenuContent>
    <DropdownMenuItem onClick={handleSettings}>
      Game Settings
    </DropdownMenuItem>
    <DropdownMenuSeparator />
    <DropdownMenuItem
      onClick={handleLeaveGame}
      className="text-danger"
    >
      Leave Game
    </DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

**Option 2: Move to People tab, make it subtle**
```tsx
// In People tab, bottom of page:
<div className="mt-8 pt-4 border-t border-border-primary">
  <button
    onClick={handleLeaveGame}
    className="text-sm text-text-secondary hover:text-danger"
  >
    Leave this game
  </button>
</div>
```

**Testing**:
- Check game header → Leave button should not be prominent
- Verify still accessible (in dropdown or People tab)
- Test leaving game works from new location

**Complexity**: ⭐⭐ (Simple)

---

### 3.6 Handout Creation Missing Markdown Preview ✓ COMPLETED

**Issue**: Handout content field has no preview for markdown

**Status**: ✅ FIXED (October 28, 2025)

**Files Modified**:
- `frontend/src/components/CreateHandoutModal.tsx` - Added preview toggle functionality

**Implementation**:
```tsx
const [showPreview, setShowPreview] = useState(false);

<div>
  <div className="flex justify-between items-center mb-2">
    <label htmlFor="handout-content" className="block text-sm font-medium text-content-primary">
      Content <span className="text-danger">*</span>
    </label>
    <button
      type="button"
      onClick={() => setShowPreview(!showPreview)}
      className="text-sm text-primary hover:text-primary-hover font-medium"
      data-testid="preview-toggle-button"
    >
      {showPreview ? 'Edit' : 'Preview'}
    </button>
  </div>

  {showPreview ? (
    <div className="surface-secondary border border-border-primary rounded-lg p-4 min-h-[240px] overflow-y-auto" data-testid="handout-preview">
      {formData.content ? (
        <MarkdownPreview content={formData.content} />
      ) : (
        <p className="text-content-tertiary italic">No content to preview...</p>
      )}
    </div>
  ) : (
    <Textarea
      id="handout-content"
      value={formData.content}
      onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
      placeholder="Write your handout content here... (Markdown supported)"
      rows={10}
      required
      helperText="Supports Markdown formatting: **bold**, *italic*, # headings, [links](url)"
      data-testid="handout-content-input"
    />
  )}
</div>
```

**Testing**: ✅ COMPLETED
- ✓ As TestGM: Opened handout creation modal
- ✓ Wrote markdown content with headings, bold, italic, lists, links
- ✓ Toggled preview → Verified markdown renders correctly
- ✓ Button changed to "Edit" in preview mode
- ✓ Switched back to edit → Verified content preserved
- ✓ Button changed back to "Preview" in edit mode
- ✓ Empty content shows placeholder message in preview

**Verification**: Manually tested with Playwright MCP on game 164

**Complexity**: ⭐⭐ (Simple)

---

### 3.7 Character Delete Functionality

**Issue**: No way to delete characters currently

**Files to Modify**:
- `frontend/src/components/CharacterCard.tsx`
- `backend/pkg/characters/api.go`
- `backend/pkg/db/queries/characters.sql`

**Backend Implementation**:
```go
func (s *Service) DeleteCharacter(characterID int64, userID int64) error {
    char, err := s.GetCharacter(characterID)
    if err != nil {
        return err
    }

    // Only GM can delete characters
    isGM, _ := s.IsGameMaster(char.GameID, userID)
    if !isGM {
        return ErrForbidden
    }

    // Don't allow deletion if character has actions/posts
    hasActivity, _ := s.CharacterHasActivity(characterID)
    if hasActivity {
        return errors.New("cannot delete character with existing actions or posts")
    }

    return s.queries.DeleteCharacter(characterID)
}
```

**Frontend Implementation**:
```tsx
// In CharacterCard (GM view):
{isGM && (
  <DropdownMenu>
    <DropdownMenuTrigger>
      <button>⋮</button>
    </DropdownMenuTrigger>
    <DropdownMenuContent>
      <DropdownMenuItem onClick={handleEditSheet}>
        Edit Sheet
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem
        onClick={() => setShowDeleteModal(true)}
        className="text-danger"
      >
        Delete Character
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
)}

{showDeleteModal && (
  <ConfirmationModal
    title="Delete Character"
    message={`Are you sure you want to delete ${character.name}? This action cannot be undone.`}
    onConfirm={handleConfirmDelete}
    onCancel={() => setShowDeleteModal(false)}
    variant="danger"
  />
)}
```

**Testing**:
- As GM: View character list
- Click delete on character without activity → Should succeed
- Try to delete character with posts/actions → Should show error
- As Player: Should not see delete option

**Complexity**: ⭐⭐⭐ (Moderate)

---

## Phase 4: New Features & Enhancements

**Goal**: Add new functionality requested
**Estimated Time**: 10-12 hours
**Files Modified**: ~8 files

### 4.1 New Comments Refresh Button

**Issue**: No way to refresh New Comments without page reload

**Files to Modify**:
- `frontend/src/components/CommonRoom/NewCommentsView.tsx`
- Add refresh button and loading state

**Implementation**:
```tsx
const { data: newComments, isLoading, refetch } = useQuery({
  queryKey: ['new-comments', gameId],
  queryFn: () => api.getNewComments(gameId),
});

const [isRefreshing, setIsRefreshing] = useState(false);

const handleRefresh = async () => {
  setIsRefreshing(true);
  await refetch();
  setIsRefreshing(false);
};

// In header:
<div className="flex justify-between items-center">
  <h3>New Comments</h3>
  <button
    onClick={handleRefresh}
    disabled={isRefreshing}
    className="flex items-center gap-2"
  >
    <RefreshIcon className={isRefreshing ? 'animate-spin' : ''} />
    Refresh
  </button>
</div>
```

**Testing**:
- Open New Comments tab
- Click refresh → Should show loading state
- Verify new comments appear after refresh
- Test with no new comments

**Complexity**: ⭐⭐ (Simple)

---

### 4.2 @ Mention Interactivity

**Issue**: Character mentions appear as links but do nothing

**Files to Modify**:
- `frontend/src/components/MarkdownPreview.tsx` or mention rendering logic
- Add hover modal or click action

**Implementation Option 1: Hover Modal**
```tsx
const [hoveredCharacter, setHoveredCharacter] = useState<Character | null>(null);
const [hoverPosition, setHoverPosition] = useState({ x: 0, y: 0 });

// In markdown rendering, wrap mentions:
const renderMention = (mention: string) => {
  const character = characters.find(c => c.name === mention);

  return (
    <span
      className="mention-link"
      onMouseEnter={(e) => {
        setHoverPosition({ x: e.clientX, y: e.clientY });
        setHoveredCharacter(character);
      }}
      onMouseLeave={() => setHoveredCharacter(null)}
    >
      @{mention}
    </span>
  );
};

// Render hover card:
{hoveredCharacter && (
  <div
    className="character-hover-card"
    style={{
      position: 'fixed',
      left: hoverPosition.x,
      top: hoverPosition.y + 20,
    }}
  >
    <img src={hoveredCharacter.avatarUrl} alt="" />
    <div>
      <div className="font-semibold">{hoveredCharacter.name}</div>
      <div className="text-sm text-text-secondary">
        {hoveredCharacter.playerUsername}
      </div>
    </div>
  </div>
)}
```

**Implementation Option 2: Click to View Sheet**
```tsx
const handleMentionClick = (characterName: string) => {
  const character = characters.find(c => c.name === characterName);
  if (character) {
    navigate(`/games/${gameId}?tab=people&characterId=${character.id}`);
  }
};
```

**Testing**:
- Find post with @mention
- Hover over mention → Should show character card
- Or click mention → Should navigate to character sheet
- Update E2E tests to verify mention functionality

**Complexity**: ⭐⭐⭐ (Moderate - UI component + testing)

---

### 4.3 Games List Pagination

**Issue**: /games endpoint loads all games, no pagination

**Files to Modify**:
- `backend/pkg/games/api.go` - Add pagination to list endpoint
- `backend/pkg/db/queries/games.sql` - Add LIMIT/OFFSET
- `frontend/src/pages/GamesPage.tsx` - Add pagination UI

**Backend Implementation**:
```go
type ListGamesRequest struct {
    Page     int    `query:"page"`
    PageSize int    `query:"pageSize"`
    State    string `query:"state"`
    // ... other filters
}

func (s *Service) ListGames(req ListGamesRequest) (*PaginatedGames, error) {
    if req.PageSize == 0 {
        req.PageSize = 20
    }
    if req.PageSize > 100 {
        req.PageSize = 100
    }

    offset := (req.Page - 1) * req.PageSize

    games, err := s.queries.ListGames(ListGamesParams{
        Limit:  req.PageSize,
        Offset: offset,
        State:  req.State,
    })

    total, _ := s.queries.CountGames(req.State)

    return &PaginatedGames{
        Games:      games,
        Total:      total,
        Page:       req.Page,
        PageSize:   req.PageSize,
        TotalPages: (total + req.PageSize - 1) / req.PageSize,
    }, nil
}
```

**Frontend Implementation**:
```tsx
const [page, setPage] = useState(1);
const pageSize = 20;

const { data, isLoading } = useQuery({
  queryKey: ['games', page, filters],
  queryFn: () => api.getGames({ page, pageSize, ...filters }),
});

// Pagination component:
<div className="flex justify-between items-center mt-6">
  <div className="text-sm text-text-secondary">
    Showing {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, data.total)} of {data.total} games
  </div>

  <div className="flex gap-2">
    <button
      onClick={() => setPage(p => Math.max(1, p - 1))}
      disabled={page === 1}
    >
      Previous
    </button>

    <div className="flex gap-1">
      {Array.from({ length: data.totalPages }, (_, i) => i + 1)
        .filter(p => Math.abs(p - page) <= 2)
        .map(p => (
          <button
            key={p}
            onClick={() => setPage(p)}
            className={p === page ? 'active' : ''}
          >
            {p}
          </button>
        ))
      }
    </div>

    <button
      onClick={() => setPage(p => Math.min(data.totalPages, p + 1))}
      disabled={page === data.totalPages}
    >
      Next
    </button>
  </div>
</div>
```

**Testing**:
- Create 25+ games in test database
- Navigate to /games
- Verify shows 20 games per page
- Test page navigation
- Verify total count accurate

**Complexity**: ⭐⭐⭐ (Moderate - backend + frontend)

---

## Phase 5: Post-Implementation Testing & Documentation

**Goal**: Ensure all fixes work correctly and are documented
**Estimated Time**: 4-6 hours

### 5.1 Create E2E Tests for Fixed Issues

**Files to Create/Modify**:
- `frontend/e2e/ui-fixes/character-permissions.spec.ts`
- `frontend/e2e/ui-fixes/tab-defaults.spec.ts`
- `frontend/e2e/ui-fixes/history-readonly.spec.ts`

**Example Test**:
```typescript
// character-permissions.spec.ts
test.describe('Character Stat Permissions', () => {
  test('players cannot edit character stats', async ({ page }) => {
    await loginAs(page, 'TestPlayer1');
    await page.goto('/games/50704?tab=people');

    await page.click('button:has-text("Edit Sheet")');
    await page.click('button:has-text("Abilities & Skills")');

    // Add buttons should not be visible
    await expect(page.locator('button:has-text("Add Ability")')).not.toBeVisible();
    await expect(page.locator('button:has-text("Add Item")')).not.toBeVisible();
  });

  test('GMs can edit character stats', async ({ page }) => {
    await loginAs(page, 'TestGM');
    await page.goto('/games/50704?tab=people');

    await page.click('button:has-text("View Sheet")');
    await page.click('button:has-text("Abilities & Skills")');

    // Add buttons should be visible for GM
    await expect(page.locator('button:has-text("Add Ability")')).toBeVisible();
    await expect(page.locator('button:has-text("Add Item")')).toBeVisible();
  });
});
```

### 5.2 Update E2E Fixtures

**Action**: Review all fixtures to ensure they support testing new functionality

**Files to Check**:
- `backend/pkg/db/test_fixtures/e2e/*.sql`
- Ensure characters, games, phases support all test scenarios

### 5.3 Update Documentation

**Files to Update**:
- `CHANGELOG.md` - Add all fixes
- `.claude/planning/MORE_UI_NOTES.md` - Mark items as implemented
- `docs/KNOWN_ISSUES.md` - Remove fixed issues (if exists)

**Create**:
- `.claude/planning/UI_FIXES_CHANGELOG.md` - Detailed log of all changes

---

## Implementation Order Summary

### Week 1 (Priority: High Impact, Low Risk)
1. Phase 1: Critical Quick Wins (6 items) - Days 1-2
2. Phase 2.4: Audience badge fix - Day 2
3. Phase 3.1, 3.2: UI polish (join buttons, form minimize) - Day 3
4. Phase 3.4: Phase description visibility - Day 3

### Week 2 (Priority: Permissions & Safety)
1. Phase 2.1: New Comments 403 fix - Day 4
2. Phase 2.3: Character stat permissions (CRITICAL) - Days 4-5
3. Phase 2.2: GM create player characters - Day 5
4. Phase 3.7: Character deletion - Day 6

### Week 3 (Priority: Polish & Features)
1. Phase 3.3: Field consolidation with migration - Days 7-8
2. Phase 3.5, 3.6: Leave button, handout preview - Day 8
3. Phase 4.1, 4.2: Refresh button, mentions - Days 9-10
4. Phase 4.3: Pagination - Day 10

### Week 4 (Testing & Documentation)
1. Phase 5.1: E2E tests - Days 11-12
2. Phase 5.2: Fixture updates - Day 12
3. Phase 5.3: Documentation - Days 12-13

---

## Risk Assessment

### High Risk Items (Require Extra Care)
1. **Character stat permissions (2.3)** - Security critical, affects game balance
2. **Field consolidation (3.3)** - Data migration, no rollback without backup
3. **Character deletion (3.7)** - Irreversible action, needs constraints

### Medium Risk Items
1. **New Comments 403 (2.1)** - Permission logic, could expose data
2. **GM create player chars (2.2)** - Permission change, test thoroughly
3. **Pagination (4.3)** - Backend change, affects all game listings

### Low Risk Items
All Phase 1 items, most Phase 3 UI polish items

---

## Testing Strategy

### For Each Fix:
1. **Manual Testing** - Test as specified user role(s)
2. **API Testing** - Test backend endpoints with curl if applicable
3. **E2E Testing** - Create regression test
4. **Cross-browser** - Check Chrome, Firefox, Safari (for UI changes)
5. **Mobile** - Verify responsive design works

### Test Matrix:
| Fix | As Player | As GM | As Audience | As Non-participant |
|-----|-----------|-------|-------------|-------------------|
| Default tab | ✓ | ✓ | ✓ | - |
| History read-only | ✓ | ✓ | ✓ | - |
| Stat permissions | ✓ | ✓ | - | - |
| Delete character | - | ✓ | - | - |
| New Comments 403 | - | - | - | ✓ |

---

## Rollback Plan

### For Each Phase:
1. **Create feature branch** before starting
2. **Commit after each fix** with descriptive message
3. **Tag completion** of each phase
4. **Database migrations** - Always create .down.sql file

### Emergency Rollback:
```bash
# Rollback last migration
just migrate-down

# Rollback code changes
git revert <commit-hash>

# Rollback entire phase
git reset --hard <phase-start-tag>
```

---

## Success Criteria

### Phase 1: Quick Wins
- [ ] All 6 items verified fixed
- [ ] No regressions in related functionality
- [ ] E2E tests pass

### Phase 2: Permissions
- [ ] Security audit passed for permission changes
- [ ] API tests confirm 403s where expected
- [ ] No unauthorized access possible

### Phase 3: UI Polish
- [ ] User testing confirms improved UX
- [ ] Mobile responsive
- [ ] Accessibility check passed

### Phase 4: Features
- [ ] Feature demo successful
- [ ] Performance acceptable (pagination < 200ms)
- [ ] E2E coverage for new features

### Phase 5: Complete
- [ ] All 23 issues marked as fixed
- [ ] Documentation updated
- [ ] No open bugs related to fixes
- [ ] Product owner sign-off

---

## Notes

- **Prioritize security fixes** (Phase 2) even though some are marked "moderate complexity"
- **Database migrations** require extra testing - always test .up and .down
- **E2E tests** should be written as you implement, not all at the end
- **Get user feedback** early on UI changes (Phase 3) before finalizing

**Estimated Total Time**: 32-42 hours of development work
**Recommended Timeline**: 3-4 weeks with thorough testing
**Team Size**: 1-2 developers ideal for consistency
