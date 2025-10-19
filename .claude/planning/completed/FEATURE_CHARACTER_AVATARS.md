# Feature: Character Avatars

**Status**: Planning
**Created**: 2025-10-18
**Last Updated**: 2025-10-18
**Owner**: AI Session
**Related ADRs**: TBD (Storage abstraction pattern)
**Related Issues**: N/A

---

## 1. Overview

### Problem Statement
**What problem does this feature solve?**

Characters in ActionPhase lack visual representation, making them harder to identify at a glance and less personable. When players are reading through common room posts or private messages, they must rely solely on character names to differentiate between speakers. Avatar images would provide instant visual identification and improve the overall user experience.

### Goals
**What are we trying to achieve?**

- [ ] Goal 1: Allow players to upload custom avatar images for their characters
- [ ] Goal 2: Display character avatars consistently across all communication interfaces (common room, private messages, character sheets)
- [ ] Goal 3: Support both local filesystem storage (dev/staging) and S3-compatible storage (production) with environment-based configuration
- [ ] Goal 4: Ensure avatar upload is secure with validation for file type, size, and content
- [ ] Goal 5: Provide fallback display (initials or default icon) when no avatar is uploaded

### Non-Goals
**What is explicitly out of scope?**

- Non-goal 1: Animated avatars (GIF, video) - static images only
- Non-goal 2: Image editing/cropping in-app (users prepare images externally)
- Non-goal 3: Avatar galleries or predefined avatar libraries
- Non-goal 4: Avatar change history or versioning
- Non-goal 5: Multiple avatars per character (one avatar per character)
- Non-goal 6: User account avatars (this is character-specific only)

### Success Criteria
**How do we know this feature is successful?**

- [ ] Player can upload an avatar image (JPG, PNG, WebP) for their character
- [ ] Avatar displays correctly in common room posts
- [ ] Avatar displays correctly in private messages
- [ ] Avatar displays correctly on public character sheets
- [ ] System validates file type (only images) and size (<5MB)
- [ ] Storage backend is configurable (local filesystem vs S3)
- [ ] GM can upload avatars for NPC characters
- [ ] Fallback display works when no avatar is uploaded
- [ ] Performance: Avatar loading <200ms (cached on subsequent loads)
- [ ] Test coverage: >80% for new code
- [ ] All regression tests passing

---

## 2. User Stories

### Primary User Stories

```gherkin
As a Player
I want to upload an avatar image for my character
So that my character is visually identifiable in posts and messages

Acceptance Criteria:
- Given I am viewing my character sheet
  When I click "Upload Avatar" or "Change Avatar"
  Then I see a file picker to select an image
- Given I select an image file (JPG, PNG, WebP under 5MB)
  When I submit the upload
  Then the avatar is saved and immediately visible
- Given I upload an invalid file (wrong type or too large)
  When I submit the upload
  Then I see a clear error message explaining the issue
```

```gherkin
As a Player reading the Common Room
I want to see character avatars next to each post
So that I can quickly identify who is speaking without reading names

Acceptance Criteria:
- Given I am viewing common room posts
  When I see a post from a character with an avatar
  Then the avatar image displays next to the character name
- Given I see a post from a character without an avatar
  When I view the post
  Then I see a fallback avatar (initials or default icon)
```

```gherkin
As a GM
I want to upload avatars for my NPC characters
So that NPCs have visual identity in the game

Acceptance Criteria:
- Given I am viewing an NPC character sheet that I control
  When I upload an avatar
  Then the avatar is saved and displayed for that NPC in all locations
```

```gherkin
As a Player in Private Messages
I want to see avatars for all conversation participants
So that I can quickly see who is in the conversation

Acceptance Criteria:
- Given I am viewing a private message conversation
  When I see messages from different characters
  Then each message shows the sender's avatar
- Given I am viewing the conversation list sidebar
  When I see conversation participants
  Then participant avatars are displayed next to their names
```

### Edge Cases & Error Scenarios

- **Edge Case 1**: User uploads very large image (10MB+) → Show error: "Image must be under 5MB"
- **Edge Case 2**: User uploads non-image file (PDF, DOC) → Show error: "Only image files (JPG, PNG, WebP) are allowed"
- **Edge Case 3**: User uploads image with extreme aspect ratio (1x1000 or 1000x1) → System accepts but displays in circular crop (may look distorted, user's responsibility)
- **Edge Case 4**: S3 storage is unavailable → Show error: "Unable to upload avatar. Please try again later."
- **Edge Case 5**: User attempts to upload avatar for character they don't own → Return 403 Forbidden
- **Edge Case 6**: Character is deleted → Avatar file is also deleted (cascade cleanup)
- **Error Scenario 1**: Malicious file upload (disguised as image) → MIME type validation catches it, returns error
- **Error Scenario 2**: Network failure during upload → Show retry button, upload not saved
- **Error Scenario 3**: Image fails to load in UI → Show fallback avatar (initials)

---

## 3. Technical Design

### 3.1 Database Schema

**Schema Modifications:**

```sql
-- Add avatar_url column to characters table
ALTER TABLE characters ADD COLUMN avatar_url TEXT NULL;

-- Add index for querying characters with avatars
CREATE INDEX idx_characters_avatar_url ON characters(avatar_url) WHERE avatar_url IS NOT NULL;

-- Avatar URL format:
-- Local: /uploads/avatars/characters/{character_id}/{filename}
-- S3: https://s3.amazonaws.com/{bucket}/avatars/characters/{character_id}/{filename}
```

**Migration Plan:**
1. Migration file: `20251018_add_character_avatars.up.sql`
2. Rollback file: `20251018_add_character_avatars.down.sql`
3. Data migration strategy: Existing characters have NULL avatar_url (shows fallback)

### 3.2 Database Queries (sqlc)

**Location**: `backend/pkg/db/queries/characters.sql`

```sql
-- name: UpdateCharacterAvatar :one
UPDATE characters
SET avatar_url = $2, updated_at = NOW()
WHERE id = $1
RETURNING *;

-- name: DeleteCharacterAvatar :exec
UPDATE characters
SET avatar_url = NULL, updated_at = NOW()
WHERE id = $1;

-- name: GetCharactersWithAvatars :many
-- For cleanup/maintenance: find all characters with avatars
SELECT id, avatar_url FROM characters
WHERE avatar_url IS NOT NULL;
```

**Query Performance Considerations:**
- [x] Index planned for avatar_url column (partial index for non-NULL values)
- [x] No N+1 queries (avatar_url included in existing character queries)
- [x] No pagination needed (single character avatar update)

### 3.3 Backend Service Layer

**Service Interface** (`backend/pkg/core/interfaces.go`):

```go
type AvatarServiceInterface interface {
    // Upload avatar for character
    UploadCharacterAvatar(ctx context.Context, characterID int32, file io.Reader, filename string, contentType string) (string, error)

    // Delete avatar for character
    DeleteCharacterAvatar(ctx context.Context, characterID int32) error

    // Get avatar URL for character (helper)
    GetCharacterAvatarURL(ctx context.Context, characterID int32) (*string, error)
}

type StorageBackendInterface interface {
    // Upload file to storage
    Upload(ctx context.Context, path string, file io.Reader, contentType string) (string, error)

    // Delete file from storage
    Delete(ctx context.Context, path string) error

    // Get public URL for file
    GetURL(path string) string
}
```

**Domain Models** (`backend/pkg/core/models.go`):

```go
type AvatarUploadRequest struct {
    CharacterID int32
    File        multipart.File
    FileHeader  *multipart.FileHeader
}

type AvatarUploadResponse struct {
    AvatarURL string `json:"avatar_url"`
}

// Storage configuration
type StorageConfig struct {
    Backend    string // "local" or "s3"
    LocalPath  string // "/var/uploads" for local storage
    S3Bucket   string // "actionphase-uploads" for S3
    S3Region   string // "us-east-1"
    S3Endpoint string // Optional for S3-compatible (MinIO, DigitalOcean Spaces)
    PublicURL  string // "http://localhost:3000/uploads" or CDN URL
}
```

**Business Rules:**

1. **File type validation**
   - Validation: Check MIME type is image/jpeg, image/png, or image/webp
   - Error: "Invalid file type. Only JPG, PNG, and WebP images are allowed."

2. **File size validation**
   - Validation: File size must be <= 5MB (5 * 1024 * 1024 bytes)
   - Error: "Image too large. Maximum size is 5MB."

3. **Character ownership validation**
   - Validation: User must own the character (via CharacterService.CanUserEditCharacter)
   - Error: "You don't have permission to modify this character's avatar."

4. **Storage path structure**
   - Path: `avatars/characters/{character_id}/{timestamp}_{filename}`
   - Ensures: No path traversal attacks, unique filenames, organized structure

5. **Avatar deletion on character deletion**
   - Validation: When character is deleted, avatar file must also be deleted
   - Implementation: Add cleanup logic in CharacterService.DeleteCharacter

6. **Previous avatar cleanup**
   - Validation: When uploading new avatar, delete the old avatar file
   - Implementation: Before saving new avatar, delete file at old avatar_url

### 3.4 API Endpoints

**Base Path**: `/api/v1/characters/:character_id/avatar`

#### POST /api/v1/characters/:character_id/avatar
**Description**: Upload avatar image for character
**Auth Required**: Yes
**Permissions**: User must own the character (or be GM for NPCs)

**Request:**
- Content-Type: `multipart/form-data`
- Body: `avatar` field with image file

**Response (200 OK):**
```json
{
  "avatar_url": "http://localhost:3000/uploads/avatars/characters/123/1634567890_avatar.jpg"
}
```

**Error Responses:**
- `400 Bad Request`: Invalid file type or size
  ```json
  {
    "error": "Invalid file type. Only JPG, PNG, and WebP images are allowed."
  }
  ```
- `401 Unauthorized`: No valid authentication token
- `403 Forbidden`: User doesn't own character
  ```json
  {
    "error": "You don't have permission to modify this character's avatar"
  }
  ```
- `404 Not Found`: Character doesn't exist
- `413 Payload Too Large`: File exceeds 5MB
- `500 Internal Server Error`: Storage error

---

#### DELETE /api/v1/characters/:character_id/avatar
**Description**: Remove avatar image from character
**Auth Required**: Yes
**Permissions**: User must own the character

**Response (204 No Content)**

**Error Responses:**
- `404 Not Found`: Character doesn't exist
- `403 Forbidden`: User doesn't own character
- `401 Unauthorized`: No valid authentication token

---

#### GET /uploads/avatars/characters/:character_id/:filename
**Description**: Serve avatar image file (local storage only)
**Auth Required**: No (public)
**Note**: Only needed for local filesystem storage. S3 serves directly via its own URL.

**Response (200 OK):**
- Content-Type: image/jpeg, image/png, or image/webp
- Body: Binary image data

**Error Responses:**
- `404 Not Found`: Image file doesn't exist

---

### 3.5 Frontend Components

**Component Hierarchy:**

```
CharacterSheet
├── CharacterHeader
│   ├── CharacterAvatar (displays avatar)
│   └── AvatarUploadButton (if canEdit)
│       └── AvatarUploadModal
│           └── AvatarUploadForm
└── ... (rest of character sheet)

PostCard (Common Room)
├── CharacterAvatar
└── PostContent

PrivateMessageItem
├── CharacterAvatar
└── MessageContent

ConversationParticipantsList
└── CharacterAvatar (for each participant)
```

**Component Specifications:**

#### Component: `CharacterAvatar`
**Location**: `frontend/src/components/CharacterAvatar.tsx`
**Purpose**: Display character avatar with fallback

**Props:**
```typescript
interface CharacterAvatarProps {
  avatarUrl?: string | null;
  characterName: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';  // Default: 'md'
  className?: string;
}
```

**State:**
- Local state: `imageLoadError` (boolean) - tracks if image failed to load
- No server state (avatar URL passed as prop)

**Behavior:**
- If `avatarUrl` exists and loads successfully → Display image
- If `avatarUrl` is null or image fails to load → Display fallback (initials in colored circle)
- Fallback: Extract first letter of first and last word in `characterName`
- Fallback color: Deterministic based on character name (hash to color)

**Size Mapping:**
- xs: 24px (1.5rem)
- sm: 32px (2rem)
- md: 48px (3rem) - default
- lg: 64px (4rem)
- xl: 96px (6rem)

---

#### Component: `AvatarUploadButton`
**Location**: `frontend/src/components/AvatarUploadButton.tsx`
**Purpose**: Trigger to open avatar upload modal

**Props:**
```typescript
interface AvatarUploadButtonProps {
  characterId: number;
  currentAvatarUrl?: string | null;
  onUploadSuccess: (avatarUrl: string) => void;
}
```

**User Interactions:**
- Click button → Opens `AvatarUploadModal`

---

#### Component: `AvatarUploadModal`
**Location**: `frontend/src/components/AvatarUploadModal.tsx`
**Purpose**: Modal dialog for avatar upload with preview

**Props:**
```typescript
interface AvatarUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  characterId: number;
  currentAvatarUrl?: string | null;
  onUploadSuccess: (avatarUrl: string) => void;
}
```

**State:**
- Local state:
  - `selectedFile: File | null` - selected image file
  - `previewUrl: string | null` - preview URL for selected file
  - `uploadProgress: number` - upload progress (0-100)
- Server state: None directly (uses mutation)

**API Interactions:**
- `useMutation`: `useUploadCharacterAvatar` for upload
- `useMutation`: `useDeleteCharacterAvatar` for delete (if has current avatar)

**User Interactions:**
- Click "Choose File" → File picker opens
- Select image file → Preview displays
- Click "Upload" → API call → On success: close modal, trigger `onUploadSuccess`
- Click "Remove Avatar" (if has current avatar) → Confirm → Delete API call
- Click "Cancel" → Close modal, clear state
- Validation errors → Display error message above form

---

### 3.6 Frontend API Client

**Location**: `frontend/src/lib/api.ts`

```typescript
class ApiClient {
  // Upload character avatar
  async uploadCharacterAvatar(
    characterId: number,
    file: File
  ): Promise<{ avatar_url: string }> {
    const formData = new FormData();
    formData.append('avatar', file);

    const response = await this.client.post<{ avatar_url: string }>(
      `/api/v1/characters/${characterId}/avatar`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );
    return response.data;
  }

  // Delete character avatar
  async deleteCharacterAvatar(characterId: number): Promise<void> {
    await this.client.delete(`/api/v1/characters/${characterId}/avatar`);
  }
}
```

### 3.7 Frontend Custom Hooks

**Location**: `frontend/src/hooks/useCharacterAvatar.ts`

```typescript
export function useUploadCharacterAvatar() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ characterId, file }: { characterId: number; file: File }) =>
      apiClient.uploadCharacterAvatar(characterId, file),
    onSuccess: (data, variables) => {
      // Invalidate character queries to refetch with new avatar
      queryClient.invalidateQueries({ queryKey: ['characters', variables.characterId] });
      queryClient.invalidateQueries({ queryKey: ['characters'] });
    },
  });
}

export function useDeleteCharacterAvatar() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (characterId: number) =>
      apiClient.deleteCharacterAvatar(characterId),
    onSuccess: (_, characterId) => {
      queryClient.invalidateQueries({ queryKey: ['characters', characterId] });
      queryClient.invalidateQueries({ queryKey: ['characters'] });
    },
  });
}
```

### 3.8 Frontend Type Definitions

**Location**: `frontend/src/types/characters.ts` (extend existing)

```typescript
// Extend existing Character interface
export interface Character {
  id: number;
  name: string;
  avatar_url?: string | null; // NEW
  // ... other existing fields
}

export interface AvatarUploadResponse {
  avatar_url: string;
}
```

---

## 4. Testing Strategy

### 4.1 Backend Tests

**Test Files:**
- `backend/pkg/storage/storage_test.go` - Storage backend tests
- `backend/pkg/storage/local_test.go` - Local filesystem tests
- `backend/pkg/storage/s3_test.go` - S3 storage tests
- `backend/pkg/avatars/api_test.go` - API endpoint tests

**Unit Tests (with mocks):**
```go
func TestAvatarService_UploadCharacterAvatar(t *testing.T) {
    tests := []struct {
        name        string
        characterID int32
        fileContent []byte
        contentType string
        wantErr     bool
        errMsg      string
    }{
        {
            name:        "valid JPEG upload",
            characterID: 1,
            fileContent: jpegTestImage,
            contentType: "image/jpeg",
            wantErr:     false,
        },
        {
            name:        "invalid file type",
            characterID: 1,
            fileContent: pdfTestFile,
            contentType: "application/pdf",
            wantErr:     true,
            errMsg:      "Invalid file type",
        },
        {
            name:        "file too large",
            characterID: 1,
            fileContent: largeMockImage(6 * 1024 * 1024), // 6MB
            contentType: "image/jpeg",
            wantErr:     true,
            errMsg:      "Image too large",
        },
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            // Test implementation with mock storage backend
        })
    }
}
```

**Integration Tests (with database):**
```go
func TestAvatarUpload_Integration(t *testing.T) {
    pool := testutil.SetupTestDB(t)
    defer testutil.CleanupTestDB(t, pool)

    // Create test character
    character := createTestCharacter(t, pool)

    // Test avatar upload
    avatarService := &AvatarService{
        DB:      pool,
        Storage: NewLocalStorage("/tmp/test-uploads"),
    }

    file := createTestImageFile(t)
    avatarURL, err := avatarService.UploadCharacterAvatar(
        context.Background(),
        character.ID,
        file,
        "avatar.jpg",
        "image/jpeg",
    )

    require.NoError(t, err)
    assert.Contains(t, avatarURL, character.ID)

    // Verify database updated
    updatedChar, err := getCharacter(t, pool, character.ID)
    require.NoError(t, err)
    assert.Equal(t, avatarURL, updatedChar.AvatarURL)
}
```

**API Tests:**
```go
func TestAvatarAPI_Upload(t *testing.T) {
    // Test multipart file upload
    // Verify authorization checks
    // Verify error responses
}

func TestAvatarAPI_Delete(t *testing.T) {
    // Test avatar deletion
    // Verify file cleanup
    // Verify authorization
}
```

**Test Coverage Goals:**
- [x] Storage abstraction layer: >90% coverage
- [x] Avatar service: >85% coverage
- [x] API handlers: >80% coverage
- [x] Business logic (validation): 100% coverage

### 4.2 Frontend Tests

**Test Files:**
- `frontend/src/components/__tests__/CharacterAvatar.test.tsx`
- `frontend/src/components/__tests__/AvatarUploadModal.test.tsx`
- `frontend/src/hooks/__tests__/useCharacterAvatar.test.ts`

**Component Tests:**
```typescript
describe('CharacterAvatar', () => {
  it('displays avatar image when avatarUrl provided', () => {
    render(
      <CharacterAvatar
        avatarUrl="http://example.com/avatar.jpg"
        characterName="Test Character"
      />
    );

    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('src', 'http://example.com/avatar.jpg');
    expect(img).toHaveAttribute('alt', 'Test Character');
  });

  it('displays fallback initials when no avatarUrl', () => {
    render(
      <CharacterAvatar
        avatarUrl={null}
        characterName="Test Character"
      />
    );

    expect(screen.getByText('TC')).toBeInTheDocument();
  });

  it('displays fallback on image load error', async () => {
    render(
      <CharacterAvatar
        avatarUrl="http://example.com/broken.jpg"
        characterName="Test Character"
      />
    );

    const img = screen.getByRole('img');
    fireEvent.error(img);

    await waitFor(() => {
      expect(screen.getByText('TC')).toBeInTheDocument();
    });
  });
});

describe('AvatarUploadModal', () => {
  it('shows file preview after selection', async () => {
    const user = userEvent.setup();
    render(
      <AvatarUploadModal
        isOpen={true}
        onClose={jest.fn()}
        characterId={1}
        onUploadSuccess={jest.fn()}
      />
    );

    const file = new File(['test'], 'avatar.jpg', { type: 'image/jpeg' });
    const input = screen.getByLabelText(/choose file/i);

    await user.upload(input, file);

    await waitFor(() => {
      expect(screen.getByRole('img')).toBeInTheDocument();
    });
  });

  it('shows error for invalid file type', async () => {
    const user = userEvent.setup();
    render(<AvatarUploadModal isOpen={true} {...props} />);

    const file = new File(['test'], 'document.pdf', { type: 'application/pdf' });
    const input = screen.getByLabelText(/choose file/i);

    await user.upload(input, file);

    expect(screen.getByText(/only jpg, png, and webp/i)).toBeInTheDocument();
  });

  it('calls onUploadSuccess after successful upload', async () => {
    const onUploadSuccess = jest.fn();
    const user = userEvent.setup();

    server.use(
      http.post('/api/v1/characters/1/avatar', () => {
        return HttpResponse.json({ avatar_url: 'http://example.com/new-avatar.jpg' });
      })
    );

    render(<AvatarUploadModal {...props} onUploadSuccess={onUploadSuccess} />);

    const file = new File(['test'], 'avatar.jpg', { type: 'image/jpeg' });
    await user.upload(screen.getByLabelText(/choose file/i), file);
    await user.click(screen.getByRole('button', { name: /upload/i }));

    await waitFor(() => {
      expect(onUploadSuccess).toHaveBeenCalledWith('http://example.com/new-avatar.jpg');
    });
  });
});
```

**Hook Tests:**
```typescript
describe('useUploadCharacterAvatar', () => {
  it('uploads avatar and invalidates queries', async () => {
    const { result } = renderHook(() => useUploadCharacterAvatar(), {
      wrapper: createWrapper(),
    });

    const file = new File(['test'], 'avatar.jpg', { type: 'image/jpeg' });

    await act(async () => {
      result.current.mutate({ characterId: 1, file });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.avatar_url).toBeTruthy();
  });
});
```

**Test Coverage Goals:**
- [x] Components: >80% coverage
- [x] Custom hooks: >85% coverage
- [x] User interactions: All upload/delete flows tested

### 4.3 Regression Tests

**Critical Bugs to Prevent:**

1. **Bug**: File upload vulnerability (path traversal, malicious files)
   - **Test**: `TestAvatarService_UploadValidation_PreventsMaliciousFiles`
   - **Location**: `backend/pkg/avatars/avatar_test.go`

2. **Bug**: Avatar not deleted when character is deleted (orphaned files)
   - **Test**: `TestCharacterService_Delete_CleansUpAvatar`
   - **Location**: `backend/pkg/db/services/characters_test.go`

3. **Bug**: Previous avatar not deleted when new one uploaded (storage bloat)
   - **Test**: `TestAvatarService_Upload_DeletesPreviousAvatar`
   - **Location**: `backend/pkg/avatars/avatar_test.go`

4. **Bug**: Unauthorized user can upload avatar for other user's character
   - **Test**: `TestAvatarAPI_Upload_EnforcesAuthorization`
   - **Location**: `backend/pkg/avatars/api_test.go`

### 4.4 E2E Testing Requirements

#### User Journey Description

**Journey Name**: Player uploads character avatar and sees it displayed

**User Goal**: Upload a custom avatar image for their character and see it appear in common room posts, private messages, and character sheet

**Journey Steps**:
1. Player logs in to ActionPhase
2. Navigates to their character sheet in a game
3. Clicks "Upload Avatar" button
4. Selects an image file from their computer
5. Sees preview of the image
6. Clicks "Upload" button
7. Sees success message and avatar immediately displays on character sheet
8. Navigates to common room
9. Creates a post as their character
10. Sees avatar displayed next to their post
11. Navigates to private messages
12. Sends a message as their character
13. Sees avatar displayed next to the message

#### E2E Test Specification

**Test File**: `frontend/e2e/characters/character-avatar.spec.ts`

**Happy Path Test**:
- [x] Test name: `should upload avatar and display in all locations`
- [x] Estimated duration: 30 seconds
- [x] Preconditions:
  - [x] Test user exists: PLAYER_1
  - [x] Test game exists with character for PLAYER_1
  - [x] Test avatar image file available in test fixtures

#### Fixture Requirements

**Test Fixtures Needed**:
- **Option A**: Use existing fixtures
  - `01_test_users.sql` - Test users
  - `02_recruiting_games.sql` or `08_e2e_dedicated_games.sql` - Game with character
  - NEW: Add test avatar image to `frontend/e2e/fixtures/test-avatar.jpg`

**Test Data Setup**:
- Use existing E2E game with PLAYER_1's character
- Dynamically upload avatar during test
- Avatar file automatically cleaned up when test fixtures reset

**Test Pseudocode**:
```typescript
test('should upload avatar and display in all locations', async ({ page }) => {
  // 1. Setup - Login as PLAYER_1
  await loginAs(page, 'PLAYER_1');

  // 2. Get game and character
  const gameId = await getFixtureGameId(page, 'E2E_COMMON_ROOM');
  await page.goto(`/games/${gameId}`);

  // 3. Navigate to character sheet
  await page.click('text="Your Characters"');
  await page.click('a:has-text("Player 1 Character")');

  // 4. Upload avatar
  await page.click('button:has-text("Upload Avatar")');
  await page.setInputFiles('input[type="file"]', 'frontend/e2e/fixtures/test-avatar.jpg');

  // Wait for preview
  await expect(page.locator('img[alt="Preview"]')).toBeVisible();

  // Submit upload
  await page.click('button:has-text("Upload")');

  // 5. Verify avatar on character sheet
  await expect(page.locator('img[alt*="Player 1 Character"]')).toBeVisible();

  // 6. Navigate to common room
  await page.click('button:has-text("Common Room")');

  // Create a post
  await page.click('button:has-text("New Post")');
  await page.fill('textarea', 'Testing avatar display');
  await page.click('button:has-text("Post")');

  // 7. Verify avatar in common room post
  const post = page.locator('.post-card').filter({ hasText: 'Testing avatar display' });
  await expect(post.locator('img[alt*="Player 1 Character"]')).toBeVisible();

  // 8. Navigate to private messages
  await page.click('button:has-text("Private Messages")');

  // Send a message
  await page.click('button:has-text("New Message")');
  await page.fill('input[placeholder*="character"]', 'Player 2');
  await page.click('text="Player 2 Character"');
  await page.fill('textarea[placeholder*="message"]', 'Avatar test message');
  await page.click('button:has-text("Send")');

  // 9. Verify avatar in private message
  const message = page.locator('.message-item').filter({ hasText: 'Avatar test message' });
  await expect(message.locator('img[alt*="Player 1 Character"]')).toBeVisible();
});
```

#### Error Scenario Tests

- [x] **Validation Error Test**: `should reject invalid file types`
  - Upload a PDF or text file
  - Verify error message displays

- [x] **Size Validation Test**: `should reject files over 5MB`
  - Mock large file upload (or use actual large test image)
  - Verify error message displays

- [x] **Permission Error Test**: `should prevent uploading avatar for other user's character`
  - Login as PLAYER_1
  - Attempt to upload avatar for PLAYER_2's character via direct API call
  - Verify 403 Forbidden response

#### E2E Test Implementation Checklist

- [ ] Test file created in `frontend/e2e/characters/`
- [ ] Test avatar image added to `frontend/e2e/fixtures/`
- [ ] Happy path test written and passing
- [ ] Error scenario tests written and passing
- [ ] Test duration < 1 minute (60 seconds)
- [ ] Test uses helper functions (loginAs, getFixtureGameId)
- [ ] Test has descriptive comments
- [ ] Screenshots captured on failure (automatic with Playwright)

#### E2E Acceptance Criteria

- [ ] ✅ All E2E tests passing locally
- [ ] ✅ All E2E tests passing in CI
- [ ] ✅ No flaky behavior (run 10x to verify)
- [ ] ✅ Test execution time < 60 seconds
- [ ] ✅ Test cleanup works (fixtures reset properly)

---

## 5. Implementation Plan

### Phase 1: Backend Storage Abstraction & Migration
**Estimated Time**: 3-4 hours

- [ ] Create database migration files
  - [ ] `20251018_add_character_avatars.up.sql` - Add avatar_url column
  - [ ] `20251018_add_character_avatars.down.sql` - Rollback migration
- [ ] Run migration: `just migrate`
- [ ] Add SQL queries in `queries/characters.sql`
  - [ ] UpdateCharacterAvatar
  - [ ] DeleteCharacterAvatar
- [ ] Run `just sqlgen` to generate models
- [ ] Create storage abstraction layer
  - [ ] Define `StorageBackendInterface` in `core/interfaces.go`
  - [ ] Implement `LocalStorage` in `pkg/storage/local.go`
  - [ ] Implement `S3Storage` in `pkg/storage/s3.go`
  - [ ] Add configuration loading in `pkg/core/config.go`
- [ ] **Write storage tests first** (TDD)
  - [ ] Unit tests for LocalStorage
  - [ ] Unit tests for S3Storage (with mocked S3 client)
- [ ] Verify tests pass: `just test-mocks`

**Acceptance Criteria:**
- [ ] Migration applies and rolls back cleanly
- [ ] Both storage backends have test coverage >90%
- [ ] Configuration supports both local and S3

### Phase 2: Avatar Service & API Endpoints
**Estimated Time**: 4-5 hours

- [ ] Define `AvatarServiceInterface` in `core/interfaces.go`
- [ ] Create avatar service implementation in `pkg/avatars/service.go`
  - [ ] UploadCharacterAvatar with validation
  - [ ] DeleteCharacterAvatar with cleanup
- [ ] **Write service tests first**
  - [ ] Test file type validation
  - [ ] Test file size validation
  - [ ] Test authorization checks
  - [ ] Test cleanup of previous avatar
- [ ] Implement service methods
- [ ] Create API handlers in `pkg/avatars/api.go`
  - [ ] POST /api/v1/characters/:id/avatar (multipart upload)
  - [ ] DELETE /api/v1/characters/:id/avatar
  - [ ] GET /uploads/** (local storage only, static file serving)
- [ ] Add routes to `pkg/http/root.go`
- [ ] Add middleware for multipart parsing
- [ ] **Write API integration tests**
- [ ] Update character deletion to clean up avatars
  - [ ] Modify `CharacterService.DeleteCharacter` to call `AvatarService.DeleteCharacterAvatar`
- [ ] Test with database: `SKIP_DB_TESTS=false just test`
- [ ] Manual testing with curl (upload, delete, view)

**Acceptance Criteria:**
- [ ] All endpoints return correct status codes
- [ ] File validation works (type and size)
- [ ] Authorization enforced
- [ ] Previous avatar deleted on new upload
- [ ] Avatar deleted when character deleted
- [ ] All tests passing

### Phase 3: Frontend Avatar Display Component
**Estimated Time**: 2-3 hours

- [ ] Create `CharacterAvatar.tsx` component
  - [ ] Props: avatarUrl, characterName, size
  - [ ] Display image or fallback initials
  - [ ] Handle image load errors
  - [ ] Implement size variants (xs, sm, md, lg, xl)
- [ ] **Write component tests**
  - [ ] Test image display
  - [ ] Test fallback display
  - [ ] Test error handling
  - [ ] Test size variants
- [ ] Integrate avatar display in existing components
  - [ ] Update `PostCard.tsx` (common room posts)
  - [ ] Update `PrivateMessageItem.tsx` (messages)
  - [ ] Update `CharacterHeader.tsx` (character sheet)
  - [ ] Update `ConversationParticipantsList.tsx` (PM sidebar)
- [ ] Run tests: `just test-frontend`

**Acceptance Criteria:**
- [ ] Avatar displays in all locations
- [ ] Fallback works when no avatar
- [ ] Component tests passing
- [ ] No visual regressions

### Phase 4: Frontend Avatar Upload
**Estimated Time**: 4-5 hours

- [ ] Add API client methods to `lib/api.ts`
  - [ ] uploadCharacterAvatar (multipart FormData)
  - [ ] deleteCharacterAvatar
- [ ] Extend Character type in `types/characters.ts`
  - [ ] Add avatar_url field
- [ ] Create custom hooks in `hooks/useCharacterAvatar.ts`
  - [ ] useUploadCharacterAvatar
  - [ ] useDeleteCharacterAvatar
- [ ] **Write hook tests**
- [ ] Create upload components
  - [ ] `AvatarUploadButton.tsx`
  - [ ] `AvatarUploadModal.tsx`
  - [ ] `AvatarUploadForm.tsx` (file picker, preview, validation)
- [ ] **Write component tests**
  - [ ] Test file selection
  - [ ] Test preview
  - [ ] Test upload flow
  - [ ] Test error handling
  - [ ] Test delete flow
- [ ] Integrate upload button in `CharacterSheet.tsx`
  - [ ] Show button if user canEdit
  - [ ] On upload success, refetch character data
- [ ] Add client-side validation
  - [ ] File type check (before upload)
  - [ ] File size check (before upload)
  - [ ] Display validation errors
- [ ] Run tests: `just test-frontend`

**Acceptance Criteria:**
- [ ] Upload button shows for editable characters
- [ ] File picker works
- [ ] Preview displays
- [ ] Upload succeeds and avatar updates
- [ ] Delete works
- [ ] Validation catches errors
- [ ] All tests passing

### Phase 5: E2E Testing
**Estimated Time**: 2-3 hours

- [ ] Add test avatar image to `frontend/e2e/fixtures/test-avatar.jpg`
- [ ] Create E2E test file `frontend/e2e/characters/character-avatar.spec.ts`
- [ ] Write happy path test
  - [ ] Upload avatar
  - [ ] Verify display on character sheet
  - [ ] Verify display in common room post
  - [ ] Verify display in private message
- [ ] Write error scenario tests
  - [ ] Invalid file type
  - [ ] File too large
- [ ] Run E2E tests: `npm run test:e2e -- e2e/characters/character-avatar.spec.ts`
- [ ] Verify no flaky behavior (run 10 times)

**Acceptance Criteria:**
- [ ] All E2E tests passing
- [ ] Test duration < 60 seconds
- [ ] No flaky behavior

### Phase 6: Integration & Polish
**Estimated Time**: 2-3 hours

- [ ] Manual end-to-end testing
  - [ ] Happy path: Upload avatar, see in all locations
  - [ ] Error scenarios: Invalid file, too large, unauthorized
  - [ ] Delete avatar flow
- [ ] Performance testing
  - [ ] Avatar loading time < 200ms
  - [ ] Upload time < 3 seconds for 2MB image
- [ ] Security review
  - [ ] File upload validation comprehensive
  - [ ] Path traversal prevention
  - [ ] Authorization checks in place
- [ ] Polish UI/UX
  - [ ] Loading states during upload
  - [ ] Success/error messages
  - [ ] Responsive design
- [ ] Documentation updates
  - [ ] Update API documentation
  - [ ] Add deployment notes (S3 configuration)

**Acceptance Criteria:**
- [ ] All manual test scenarios pass
- [ ] Performance meets requirements
- [ ] Security review complete
- [ ] UI polished
- [ ] Documentation updated

---

## 6. Rollout Strategy

### Deployment Checklist
- [ ] Database migration tested in staging
- [ ] Environment variables configured (storage backend, S3 credentials if applicable)
- [ ] Storage backend tested (local or S3)
- [ ] Feature tested in staging environment
- [ ] All tests passing
- [ ] Rollback plan documented

### Rollback Plan
**If deployment fails:**

1. Check error logs for avatar upload failures
2. If database issue: Rollback migration `just migrate_down`
3. If storage issue:
   - Check storage configuration (env variables)
   - Verify S3 credentials if using S3
   - Switch to local storage as fallback (config change)
4. Revert backend code if necessary
5. Revert frontend code if necessary
6. Verify system stability

**Rollback triggers:**
- File upload failures >10%
- Storage errors (S3 unavailable, disk full)
- Security vulnerability discovered
- Performance degradation >30%

---

## 7. Monitoring & Observability

### Metrics to Track
- [ ] Avatar upload success rate (target: >95%)
- [ ] Avatar upload latency (p50, p95, p99) - Target p95 < 3s
- [ ] Storage backend error rate (S3 or local)
- [ ] Image load time in UI (target: <200ms)
- [ ] Disk usage (local storage) / S3 storage costs

### Logging
- [ ] Avatar upload attempts (character_id, user_id, file_size, file_type)
- [ ] Avatar upload failures (reason, correlation_id)
- [ ] Avatar deletion events (character_id, avatar_url)
- [ ] Storage backend errors (S3 connection, disk write failures)

### Alerts
- [ ] Avatar upload failure rate >10% → Warning
- [ ] Storage backend unreachable → Critical
- [ ] Disk space <10% (local storage) → Warning
- [ ] Upload latency p95 >5s → Warning

---

## 8. Documentation

### User Documentation
- [ ] Add "Character Avatars" section to character creation guide
- [ ] Document supported file formats (JPG, PNG, WebP)
- [ ] Document file size limit (5MB)
- [ ] Add FAQ: "How do I remove my avatar?"

### Developer Documentation
- [ ] Document storage abstraction pattern (ADR if needed)
- [ ] Add S3 configuration guide for production deployment
- [ ] Document avatar URL structure
- [ ] Add code comments for storage backend interface

---

## 9. Open Questions

**Technical Questions:**
- [x] Question 1: Should we support image resizing/optimization on the server side? → **Decision: No for MVP, users prepare images externally. Future enhancement.**
- [x] Question 2: Should we enforce square aspect ratio? → **Decision: No, circular crop handles any aspect ratio. User's responsibility to crop before upload.**
- [ ] Question 3: What S3-compatible services should we support? → **Decision: AWS S3, DigitalOcean Spaces, MinIO (any with standard S3 API)**
- [ ] Question 4: Should we add image caching headers? → **Decision: Yes, add Cache-Control headers for 1 year (images immutable with unique filenames)**

**Product Questions:**
- [ ] Question 1: Should GMs be able to set default avatar for NPCs without upload? → **Decision: Future enhancement, fallback initials sufficient for MVP**

**Performance Questions:**
- [x] Question 1: Should we use CDN for avatar delivery? → **Decision: Optional, configurable via PublicURL setting**

---

## 10. Risks & Mitigations

### Technical Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| S3 credentials leaked | Low | High | Use IAM roles, never commit credentials, use .env |
| File upload vulnerability | Low | Critical | Strict MIME validation, file size limits, no execution permissions |
| Storage costs spike (S3) | Medium | Medium | Monitor storage usage, add cleanup job for old avatars |
| Disk space exhaustion (local) | Medium | High | Monitor disk usage, add alerts, implement storage quota |
| Avatar not cleaned up on deletion | Low | Medium | Test cascade deletion thoroughly, add background cleanup job |

### Product Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Users upload inappropriate images | Medium | Medium | Add moderation queue (future), community guidelines |
| Users confused about file formats | Low | Low | Clear error messages, documentation |

---

## 11. Future Enhancements

**Post-MVP Ideas:**
- Enhancement 1: Server-side image resizing/optimization (reduce storage and bandwidth)
- Enhancement 2: Image cropping tool in-app (circular crop preview)
- Enhancement 3: Default avatar library (pre-made avatars to choose from)
- Enhancement 4: Avatar moderation queue (GM or admin review before display)
- Enhancement 5: Avatar change history (see previous avatars)
- Enhancement 6: Animated avatars (GIF support with frame limits)
- Enhancement 7: Background cleanup job (delete avatars for deleted characters older than 30 days)
- Enhancement 8: User account avatars (separate from character avatars)

**Technical Debt:**
- Debt 1: No image optimization - users must prepare images → Add server-side resizing
- Debt 2: No CDN integration by default → Document CDN setup guide
- Debt 3: No avatar moderation - relies on community trust → Add moderation workflow

---

## 12. References

### Related Documentation
- Architecture: Storage abstraction pattern (to be documented in ADR if complex)
- Security: File upload best practices
- Existing: Character system (`backend/pkg/db/services/characters.go`)

### External Resources
- [AWS S3 Documentation](https://docs.aws.amazon.com/s3/)
- [DigitalOcean Spaces](https://www.digitalocean.com/products/spaces)
- [MinIO - S3 Compatible Storage](https://min.io/)
- [Go multipart file uploads](https://golang.org/pkg/mime/multipart/)
- [Image MIME types](https://developer.mozilla.org/en-US/docs/Web/HTTP/Basics_of_HTTP/MIME_types)

---

## Session Log

### Session 1 - 2025-10-18
**Accomplished:**
- Created comprehensive feature plan for character avatars
- Defined storage abstraction strategy (local filesystem vs S3)
- Designed database schema (avatar_url column)
- Planned API endpoints and frontend components
- Created implementation phases with time estimates

**Next Steps:**
- After completing state management integration, return to this plan
- Start with Phase 1: Backend Storage Abstraction & Migration
- Follow TDD approach for storage backends

---

## Completion Checklist

**Before marking feature complete:**

- [ ] All 6 implementation phases completed
- [ ] All tests passing (>80% coverage)
- [ ] E2E tests passing
- [ ] Code reviewed
- [ ] Documentation updated
- [ ] Deployed to staging
- [ ] Manual testing complete
- [ ] Deployed to production
- [ ] Monitoring confirmed working
- [ ] Feature marked complete in tracking system

**Archive this plan to** `.claude/planning/completed/` **when complete.**
