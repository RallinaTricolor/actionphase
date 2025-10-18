# Feature: Comment Editor Improvements - Character Mentions

**Status**: Planning
**Created**: 2025-10-17
**Last Updated**: 2025-10-17
**Owner**: AI Session
**Related ADRs**: None
**Related Issues**: N/A
**Dependencies**: Required by FEATURE_NOTIFICATIONS.md

---

## 1. Overview

### Problem Statement
**What problem does this feature solve?**

Users in the common room currently have no way to explicitly tag or mention characters in their comments. This makes it difficult to:
- Direct comments to specific characters
- Get the attention of character controllers
- Create clear in-character conversations
- Trigger notifications when characters are mentioned

The notification system (FEATURE_NOTIFICATIONS.md) requires character tagging functionality to notify users when their characters are mentioned. This feature is a **dependency** for character mention notifications.

### Goals
**What are we trying to achieve?**

- [ ] Goal 1: Users can tag characters in comments using `@CharacterName` syntax
- [ ] Goal 2: Character names auto-complete as users type `@`
- [ ] Goal 3: Tagged characters are visually distinguished in rendered comments (highlighted/linked)
- [ ] Goal 4: Backend parses mentions and triggers notifications for character controllers
- [ ] Goal 5: Autocomplete shows only characters from the current game

### Non-Goals
**What is explicitly out of scope?**

- **Mentioning users** (e.g., `@username`) - Only character mentions in MVP
- **Mentioning users in private messages** - Only common room for MVP
- **Rich text formatting** (bold, italic, lists) - Keep text editor simple
- **Emoji picker** - Future enhancement
- **Image/file attachments in comments** - Future enhancement
- **Edit history for comments** - Future enhancement
- **Draft saving** - Comments are short, auto-save not needed

### Success Criteria
**How do we know this feature is successful?**

- [ ] User types `@` and sees autocomplete dropdown with character names
- [ ] User selects character from autocomplete, `@CharacterName` inserted into comment
- [ ] Submitted comment displays mentions as highlighted text
- [ ] Backend correctly extracts character IDs from mentions
- [ ] Notifications are triggered for mentioned characters (integration with FEATURE_NOTIFICATIONS.md)
- [ ] Autocomplete performs well with 50+ characters in game
- [ ] Test coverage: >80% for frontend components and backend parsing
- [ ] All regression tests passing

---

## 2. User Stories

### Primary User Stories

```gherkin
As a Player or GM
I want to tag a character in my comment using @CharacterName
So that I can direct my comment to that character and notify their controller

Acceptance Criteria:
- Given I am writing a comment in the common room
  When I type "@"
  Then I see an autocomplete dropdown showing characters from the current game
- Given I see the autocomplete dropdown
  When I select a character from the list
  Then "@CharacterName" is inserted into my comment
- Given I submit a comment with "@CharacterName"
  When the comment is posted
  Then the mention appears highlighted in the rendered comment
  And the character's controller receives a notification (if FEATURE_NOTIFICATIONS implemented)
```

```gherkin
As a Player or GM
I want the autocomplete to filter characters as I type
So that I can quickly find the character I want to mention

Acceptance Criteria:
- Given the autocomplete dropdown is open
  When I type "@Ara"
  Then only characters whose names start with "Ara" are shown (e.g., "Aragorn", "Arael")
- Given I type "@" followed by a space
  When the dropdown is still showing
  Then the dropdown closes (space cancels mention)
```

```gherkin
As a developer (backend)
I want to parse character mentions from comment content
So that I can extract character IDs and trigger notifications

Acceptance Criteria:
- Given a comment contains "@CharacterName"
  When the comment is submitted
  Then the backend extracts the character name and looks up the character ID
- Given multiple mentions in one comment
  When the comment is submitted
  Then all mentioned characters are identified
- Given a character name that doesn't exist
  When the comment is submitted
  Then the mention is preserved as text but no notification is sent
```

### Edge Cases & Error Scenarios

- **Edge Case 1**: User types `@` at the end of a long comment → Autocomplete dropdown should not overflow screen
- **Edge Case 2**: Character name contains special characters (e.g., "Thra'kul") → Mention should work, autocomplete should handle special chars
- **Edge Case 3**: Multiple users tag same character in same comment → Character controller receives only ONE notification
- **Edge Case 4**: User tags a character they control → No notification sent to self
- **Edge Case 5**: User tags deleted/removed character → Mention rendered as plain text, no error
- **Error Scenario 1**: Autocomplete API fails → Show error message, allow user to type mention manually
- **Error Scenario 2**: Character name with typo (e.g., "@Aragron" instead of "@Aragorn") → Mention rendered as plain text, no notification sent

---

## 3. Technical Design

### 3.1 Frontend Components

#### Component: `CommentEditor` (Enhancement)
**Location**: `frontend/src/components/CommentEditor.tsx` (if exists) or create new
**Purpose**: Rich text input with character mention autocomplete

**Key Libraries**:
- **Option A**: Use existing textarea + custom autocomplete overlay
- **Option B**: Use library like `@tiptap/react` (WYSIWYG editor with mention support)
- **Recommendation**: Start with Option A (simpler, lighter weight)

**Props**:
```typescript
interface CommentEditorProps {
  gameId: number;
  onSubmit: (content: string, mentionedCharacterIds: number[]) => void;
  placeholder?: string;
  maxLength?: number; // e.g., 2000 characters
}
```

**State**:
- `content: string` - Current comment text
- `showAutocomplete: boolean` - Whether autocomplete dropdown is visible
- `autocompletePosition: { top: number, left: number }` - Dropdown position
- `autocompleteQuery: string` - Current search query (text after @)
- `selectedIndex: number` - Currently selected item in autocomplete
- `cursorPosition: number` - Cursor position in textarea

**User Interactions**:
1. User types `@` → Show autocomplete dropdown
2. User types characters after `@` → Filter character list
3. User presses arrow keys → Navigate autocomplete list
4. User presses Enter or clicks item → Insert `@CharacterName` into text
5. User presses Escape or Space → Close autocomplete
6. User submits comment → Extract mentions, call onSubmit with character IDs

---

#### Component: `CharacterAutocomplete`
**Location**: `frontend/src/components/CharacterAutocomplete.tsx`
**Purpose**: Dropdown showing filterable list of characters

**Props**:
```typescript
interface CharacterAutocompleteProps {
  characters: Character[];
  query: string; // Filter text
  position: { top: number, left: number };
  onSelect: (character: Character) => void;
  selectedIndex: number;
  onClose: () => void;
}
```

**Features**:
- Filter characters by name matching query
- Highlight selected item
- Show character name + avatar (if available)
- Keyboard navigation (arrow keys, enter, escape)
- Click to select
- Position relative to cursor in textarea

---

#### Component: `CommentWithMentions` (Enhancement)
**Location**: `frontend/src/components/CommentCard.tsx` or similar
**Purpose**: Render comment text with highlighted character mentions

**Props**:
```typescript
interface CommentWithMentionsProps {
  content: string; // Comment text with @CharacterName mentions
  mentionedCharacters?: Array<{ id: number, name: string }>; // Optional pre-parsed mentions
}
```

**Rendering**:
- Parse comment content for `@CharacterName` patterns
- Render mentions as `<span className="mention">@CharacterName</span>` with special styling
- Optionally make mentions clickable (navigate to character sheet - future enhancement)

**Styling** (Tailwind):
```css
.mention {
  @apply bg-purple-100 text-purple-800 rounded px-1 font-semibold;
}
```

---

### 3.2 Frontend Hooks

**Location**: `frontend/src/hooks/useCharacterMentions.ts`

```typescript
export function useCharacterMentions(gameId: number) {
  return useQuery({
    queryKey: ['characters', gameId, 'mentions'],
    queryFn: () => apiClient.getGameCharacters(gameId),
    staleTime: 60000, // Characters don't change frequently
    select: (data) =>
      data.map(char => ({
        id: char.id,
        name: char.name,
        avatar_url: char.avatar_url,
      })),
  });
}

// Helper function to extract mentions from text
export function extractMentions(
  text: string,
  characters: Array<{ id: number, name: string }>
): number[] {
  const mentionRegex = /@(\w+(?:\s+\w+)*)/g;
  const mentions: number[] = [];
  let match;

  while ((match = mentionRegex.exec(text)) !== null) {
    const mentionedName = match[1];
    const character = characters.find(
      char => char.name.toLowerCase() === mentionedName.toLowerCase()
    );
    if (character && !mentions.includes(character.id)) {
      mentions.push(character.id);
    }
  }

  return mentions;
}

// Helper to insert mention at cursor position
export function insertMention(
  currentText: string,
  cursorPosition: number,
  characterName: string,
  queryStartPosition: number
): { newText: string, newCursorPosition: number } {
  const before = currentText.substring(0, queryStartPosition);
  const after = currentText.substring(cursorPosition);
  const mention = `@${characterName}`;
  const newText = before + mention + after;
  const newCursorPosition = queryStartPosition + mention.length;

  return { newText, newCursorPosition };
}
```

---

### 3.3 Backend Changes

#### Database Schema
**No new tables needed** - Character mentions are stored as plain text in comments

**Existing Tables Used**:
- `comments` - Contains comment content with mentions
- `characters` - Used to validate mentioned character names
- `notifications` - Created when characters are mentioned (FEATURE_NOTIFICATIONS.md)

---

#### Backend Service Layer

**Enhancement to** `backend/pkg/posts/api.go` or comments service:

**Add Method**: `extractCharacterMentions(content string, gameID int32) ([]int32, error)`

```go
// extractCharacterMentions parses comment content and returns character IDs mentioned
func (s *PostService) extractCharacterMentions(ctx context.Context, content string, gameID int32) ([]int32, error) {
    // Regex to match @CharacterName (handles multi-word names)
    mentionRegex := regexp.MustCompile(`@(\w+(?:\s+\w+)*)`)
    matches := mentionRegex.FindAllStringSubmatch(content, -1)

    if len(matches) == 0 {
        return nil, nil
    }

    var mentionedCharacterIDs []int32
    seenIDs := make(map[int32]bool) // Deduplicate

    for _, match := range matches {
        characterName := match[1]

        // Look up character by name in this game
        character, err := s.db.GetCharacterByNameAndGame(ctx, db.GetCharacterByNameAndGameParams{
            Name:   characterName,
            GameID: gameID,
        })

        if err != nil {
            // Character not found - skip (not an error, might be typo)
            continue
        }

        if !seenIDs[character.ID] {
            mentionedCharacterIDs = append(mentionedCharacterIDs, character.ID)
            seenIDs[character.ID] = true
        }
    }

    return mentionedCharacterIDs, nil
}
```

**Integration in CreateComment**:

```go
func (s *PostService) CreateComment(ctx context.Context, req *CreateCommentRequest) (*Comment, error) {
    // ... existing validation ...

    // Create comment
    comment, err := s.db.CreateComment(ctx, ...)
    if err != nil {
        return nil, err
    }

    // Extract character mentions
    mentionedCharacterIDs, err := s.extractCharacterMentions(ctx, req.Content, req.GameID)
    if err != nil {
        // Log error but don't fail comment creation
        log.WithError(err).Warn("Failed to extract character mentions")
    }

    // Trigger notifications for mentioned characters (async, fire-and-forget)
    if len(mentionedCharacterIDs) > 0 {
        go func() {
            ctx := context.Background()
            for _, characterID := range mentionedCharacterIDs {
                // Get character to find owner user ID
                character, err := s.db.GetCharacter(ctx, characterID)
                if err != nil {
                    continue
                }

                // Don't notify self
                if character.UserID == req.UserID {
                    continue
                }

                // Create notification (requires FEATURE_NOTIFICATIONS implementation)
                _ = s.notificationService.NotifyCharacterMention(
                    ctx,
                    character.UserID,
                    req.GameID,
                    characterID,
                    character.Name,
                    req.Username,
                    comment.ID,
                )
            }
        }()
    }

    return comment, nil
}
```

---

#### SQL Query Addition

**Location**: `backend/pkg/db/queries/characters.sql`

```sql
-- name: GetCharacterByNameAndGame :one
SELECT * FROM characters
WHERE name = $1 AND game_id = $2
LIMIT 1;
```

**Run** `just sqlgen` after adding query.

---

### 3.4 API Endpoints

**No new endpoints needed** - Uses existing character and comment endpoints

**Existing Endpoints Used**:
- `GET /api/v1/games/:id/characters` - Get characters for autocomplete
- `POST /api/v1/games/:game_id/posts/:post_id/comments` - Create comment with mentions

**Enhancement to CreateComment Response**:

Add `mentioned_character_ids` field to response (optional, for client-side validation):

```json
{
  "id": 123,
  "content": "Hey @Aragorn, what do you think about @Gandalf's plan?",
  "mentioned_character_ids": [5, 12],
  "created_at": "2025-10-17T10:30:00Z"
}
```

---

## 4. Implementation Plan

### Phase 1: Frontend Autocomplete Component
**Estimated Time**: 4-6 hours

- [ ] Create `CommentEditor` component with textarea
- [ ] Implement `@` detection and autocomplete trigger
- [ ] Create `CharacterAutocomplete` dropdown component
- [ ] Implement keyboard navigation (arrow keys, enter, escape)
- [ ] Implement character name filtering
- [ ] **Write component tests**
- [ ] Style with Tailwind CSS
- [ ] Test autocomplete UX manually

**Acceptance Criteria:**
- [ ] Typing `@` shows autocomplete dropdown
- [ ] Autocomplete filters as user types
- [ ] Selecting character inserts mention into text
- [ ] Keyboard navigation works smoothly
- [ ] All component tests passing

---

### Phase 2: Frontend Mention Rendering
**Estimated Time**: 2-3 hours

- [ ] Create `CommentWithMentions` component
- [ ] Implement mention parsing and highlighting
- [ ] Update existing comment display components to use `CommentWithMentions`
- [ ] **Write rendering tests**
- [ ] Test with various mention patterns (single, multiple, edge cases)

**Acceptance Criteria:**
- [ ] Mentions render with special styling
- [ ] Multiple mentions in one comment work
- [ ] Comments without mentions render normally
- [ ] All rendering tests passing

---

### Phase 3: Backend Mention Parsing
**Estimated Time**: 3-4 hours

- [ ] Add `GetCharacterByNameAndGame` SQL query
- [ ] Run `just sqlgen`
- [ ] Implement `extractCharacterMentions()` function
- [ ] **Write unit tests** for mention extraction
  - [ ] Test single mention
  - [ ] Test multiple mentions
  - [ ] Test duplicate mentions (should dedupe)
  - [ ] Test non-existent character names
  - [ ] Test multi-word character names
- [ ] Run tests: `just test-mocks`

**Acceptance Criteria:**
- [ ] Mention extraction correctly identifies character IDs
- [ ] Duplicate mentions are deduplicated
- [ ] Non-existent characters are gracefully skipped
- [ ] All unit tests passing (>85% coverage)

---

### Phase 4: Integration with Comments & Notifications
**Estimated Time**: 2-3 hours

- [ ] Update `CreateComment` handler to call `extractCharacterMentions()`
- [ ] Add notification creation for mentioned characters (if FEATURE_NOTIFICATIONS implemented)
  - [ ] Create `NotifyCharacterMention()` helper method
  - [ ] Ensure no self-notifications
- [ ] **Write integration tests**
  - [ ] Test comment with mention creates notification
  - [ ] Test comment without mention does NOT create notification
  - [ ] Test self-mention does NOT create notification
- [ ] Run tests: `SKIP_DB_TESTS=false just test`

**Acceptance Criteria:**
- [ ] Comments with mentions trigger notifications
- [ ] No self-notifications
- [ ] Notification creation doesn't break comment creation if it fails
- [ ] All integration tests passing

---

### Phase 5: End-to-End Testing
**Estimated Time**: 3-4 hours

- [ ] Write E2E test: "User can mention character in comment"
  - [ ] User types comment with `@CharacterName`
  - [ ] Autocomplete appears and user selects character
  - [ ] Comment is submitted
  - [ ] Mention renders with highlighting
  - [ ] Character controller receives notification (if FEATURE_NOTIFICATIONS implemented)
- [ ] Write E2E test: "Autocomplete filters characters by name"
- [ ] Run E2E tests: `npm run test:e2e`
- [ ] Manual testing of complete flow

**Acceptance Criteria:**
- [ ] All E2E tests passing
- [ ] Manual testing confirms smooth UX
- [ ] No performance issues with autocomplete

---

## 5. Testing Strategy

### 5.1 Frontend Tests

**Component Tests:**

```typescript
describe('CommentEditor', () => {
  it('shows autocomplete when @ is typed', async () => {
    const user = userEvent.setup();
    render(<CommentEditor gameId={1} onSubmit={vi.fn()} />);

    const textarea = screen.getByRole('textbox');
    await user.type(textarea, '@');

    expect(screen.getByRole('listbox')).toBeVisible();
  });

  it('filters characters as user types', async () => {
    const user = userEvent.setup();
    render(<CommentEditor gameId={1} onSubmit={vi.fn()} />);

    const textarea = screen.getByRole('textbox');
    await user.type(textarea, '@Ara');

    // Should show "Aragorn" but not "Gandalf"
    expect(screen.getByText('Aragorn')).toBeInTheDocument();
    expect(screen.queryByText('Gandalf')).not.toBeInTheDocument();
  });

  it('inserts mention when character selected', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<CommentEditor gameId={1} onSubmit={onSubmit} />);

    const textarea = screen.getByRole('textbox');
    await user.type(textarea, '@Ara');
    await user.click(screen.getByText('Aragorn'));

    expect(textarea).toHaveValue('@Aragorn');
  });
});

describe('CommentWithMentions', () => {
  it('highlights character mentions', () => {
    const content = 'Hey @Aragorn, what do you think?';
    render(<CommentWithMentions content={content} />);

    const mention = screen.getByText('@Aragorn');
    expect(mention).toHaveClass('mention');
  });

  it('handles multiple mentions', () => {
    const content = '@Aragorn and @Gandalf should team up';
    render(<CommentWithMentions content={content} />);

    expect(screen.getByText('@Aragorn')).toHaveClass('mention');
    expect(screen.getByText('@Gandalf')).toHaveClass('mention');
  });
});
```

---

### 5.2 Backend Tests

**Unit Tests:**

```go
func TestExtractCharacterMentions(t *testing.T) {
    tests := []struct {
        name     string
        content  string
        expected []string // Character names
    }{
        {
            name:     "single mention",
            content:  "Hey @Aragorn, what do you think?",
            expected: []string{"Aragorn"},
        },
        {
            name:     "multiple mentions",
            content:  "@Gandalf told @Aragorn to go to @Rivendell",
            expected: []string{"Gandalf", "Aragorn", "Rivendell"},
        },
        {
            name:     "duplicate mentions",
            content:  "@Aragorn and @Aragorn should know",
            expected: []string{"Aragorn"}, // Deduplicated
        },
        {
            name:     "no mentions",
            content:  "This is a regular comment",
            expected: []string{},
        },
        {
            name:     "multi-word character name",
            content:  "Talk to @Gandalf the Grey about this",
            expected: []string{"Gandalf"}, // Only matches first word
        },
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            // Test implementation
        })
    }
}
```

---

### 5.3 E2E Testing Requirements

#### User Journey Description

**Journey Name**: User mentions character in common room comment

**User Goal**: Tag a character in comment to notify their controller

**Journey Steps**:
1. Player logs in and navigates to common room
2. Player clicks to write a new comment
3. Player types `@` in comment field
4. Autocomplete dropdown appears with character names
5. Player types a few letters to filter
6. Player selects character from autocomplete
7. `@CharacterName` is inserted into comment
8. Player submits comment
9. Comment appears with mention highlighted
10. Character controller receives notification (if FEATURE_NOTIFICATIONS implemented)

#### E2E Test Specification

**Test File**: `frontend/e2e/messaging/character-mentions.spec.ts`

**Happy Path Tests**:

- [ ] Test name: `should allow user to mention character in comment with autocomplete`
- [ ] Estimated duration: 45 seconds
- [ ] Preconditions:
  - [ ] Test users exist: GM, PLAYER_1, PLAYER_2
  - [ ] Test game exists with common room phase
  - [ ] Characters exist in game: "Aragorn" (controlled by PLAYER_2)

#### Fixture Requirements

**Test Fixtures Needed**:
- Uses existing fixtures from `backend/pkg/db/test_fixtures/`:
  - `01_test_users.sql` - Test users
  - `07_common_room.sql` - Common room test game
  - `05_characters.sql` - Characters in game

**Test Data Setup**:
- Use `getFixtureGameId(page, 'COMMON_ROOM_TEST')`
- Characters "Aragorn" and "Gandalf" exist in fixture
- PLAYER_1 posts comment mentioning PLAYER_2's character "Aragorn"

**Test Pseudocode**:
```typescript
test('should allow user to mention character in comment with autocomplete', async ({ page }) => {
  // 1. Login as Player 1
  await loginAs(page, 'PLAYER_1');

  // 2. Navigate to common room
  const gameId = await getFixtureGameId(page, 'COMMON_ROOM_TEST');
  await page.goto(`/games/${gameId}`);
  await page.click('button:has-text("Common Room")');

  // 3. Start writing a comment
  const commentField = page.locator('textarea[placeholder*="comment"]');
  await commentField.fill('Hey ');

  // 4. Type @ to trigger autocomplete
  await commentField.pressSequentially('@');

  // 5. Verify autocomplete appears
  await expect(page.locator('[role="listbox"]')).toBeVisible({ timeout: 2000 });

  // 6. Verify characters are shown
  await expect(page.locator('text=Aragorn')).toBeVisible();

  // 7. Select character
  await page.click('text=Aragorn');

  // 8. Verify mention inserted
  await expect(commentField).toHaveValue('Hey @Aragorn');

  // 9. Complete and submit comment
  await commentField.fill('Hey @Aragorn, what do you think?');
  await page.click('button:has-text("Post Comment")');

  // 10. Verify comment appears with highlighted mention
  await expect(page.locator('.mention:has-text("@Aragorn")')).toBeVisible({ timeout: 3000 });
});

test('should filter autocomplete as user types', async ({ page }) => {
  await loginAs(page, 'PLAYER_1');
  const gameId = await getFixtureGameId(page, 'COMMON_ROOM_TEST');
  await page.goto(`/games/${gameId}`);
  await page.click('button:has-text("Common Room")');

  const commentField = page.locator('textarea[placeholder*="comment"]');
  await commentField.fill('@Ara');

  // Should show "Aragorn" but not "Gandalf"
  await expect(page.locator('[role="listbox"] >> text=Aragorn')).toBeVisible();
  await expect(page.locator('[role="listbox"] >> text=Gandalf')).not.toBeVisible();
});
```

---

## 6. Rollout Strategy

### Deployment Checklist
- [ ] Backend mention parsing implemented and tested
- [ ] Frontend autocomplete component implemented and tested
- [ ] Frontend mention rendering implemented and tested
- [ ] Integration with notification system tested (if FEATURE_NOTIFICATIONS implemented)
- [ ] All unit tests passing
- [ ] All E2E tests passing
- [ ] Code reviewed
- [ ] Feature flag enabled (if applicable)

### Rollback Plan
**If deployment fails:**

1. Revert frontend components (autocomplete disabled)
2. Revert backend mention parsing
3. Verify system stability (comments still work without mentions)
4. Investigate and fix issue
5. Re-deploy when fixed

**Rollback triggers:**
- Autocomplete causes UI freezing/performance issues
- Mention parsing crashes comment creation
- User complaints about broken comment functionality

---

## 7. Future Enhancements

**Post-MVP Ideas:**

1. **User mentions** - `@username` to mention players/GMs directly
2. **Hashtags** - `#topic` to categorize/search comments
3. **Clickable mentions** - Click `@CharacterName` to view character sheet
4. **Mention history** - See all comments where character was mentioned
5. **Disable mentions setting** - Users can opt out of mention notifications
6. **Rich text editor** - Bold, italic, lists, etc.
7. **Emoji picker** - Add emojis to comments
8. **GIF support** - Embed GIFs in comments (integration with Giphy API)

---

## 8. References

### Related Documentation
- `FEATURE_NOTIFICATIONS.md` - Notification system (depends on this feature)
- `.claude/context/STATE_MANAGEMENT.md` - Frontend state patterns

### External Resources
- [Textarea autocomplete patterns](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/)
- [Regex for @mentions](https://regexr.com/3cg7r)
- [TipTap Editor](https://tiptap.dev/) - Alternative rich text editor option

---

## Session Log

### Session 1 - 2025-10-17
**Accomplished:**
- Created feature plan for Comment Editor Improvements
- Designed character mention autocomplete UX
- Designed backend mention parsing logic
- Created implementation plan (5 phases, 14-20 hours total)
- Defined E2E testing requirements

**Next Steps:**
- Begin Phase 1: Frontend Autocomplete Component
- Coordinate with FEATURE_NOTIFICATIONS.md implementation

---

## Completion Checklist

**Before marking feature complete:**

- [ ] All phases implemented (Phases 1-5)
- [ ] All tests passing (>80% coverage)
- [ ] E2E tests written and passing
- [ ] Code reviewed
- [ ] Integrated with FEATURE_NOTIFICATIONS.md
- [ ] Character mention notifications working end-to-end
- [ ] Documentation updated
- [ ] Feature marked complete in tracking system

**Archive this plan to** `.claude/planning/archive/` **when complete.**
