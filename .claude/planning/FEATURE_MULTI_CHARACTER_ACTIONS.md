# Feature Plan: Multi-Character Action Submissions

**Status:** RESEARCH COMPLETE - NOT IMPLEMENTED
**Effort Estimate:** 22-24 hours (3 days realistic)
**Complexity:** Medium
**Risk Level:** Medium (database migration required)

---

## 1. Problem Statement

### Current Limitation
Players can only submit **one action per phase**, even if they control multiple characters. This creates an artificial constraint where:
- Player with 2 characters must choose which character acts
- Cannot coordinate actions between their own characters
- Results are sent to users rather than specific characters
- Character-specific gameplay is limited

### Desired Behavior
Allow players who control multiple characters to:
- Submit one action **per character** per phase
- Receive separate results for each character
- Manage character actions independently

### User Stories

**As a player with multiple characters:**
- I want to submit different actions for Character A and Character B
- I want to see which characters have/haven't submitted actions
- I want to receive separate GM results for each character
- I want to track each character's storyline independently

**As a GM:**
- I want to see all action submissions organized by character
- I want to send results to specific characters, not just users
- I want to see which characters submitted actions vs which didn't
- I want to update character sheets for the correct character

---

## 2. Current System Analysis

### 2.1 Database Schema (GOOD NEWS!)

#### ✅ Already Supports Character-Level Actions

**Table: `action_submissions`**
```sql
CREATE TABLE action_submissions (
    id SERIAL PRIMARY KEY,
    game_id INTEGER NOT NULL,
    phase_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    character_id INTEGER REFERENCES characters(id),  -- ✅ Already exists!
    content JSONB NOT NULL,
    is_draft BOOLEAN DEFAULT TRUE,
    submitted_at TIMESTAMP,
    -- ...
);
```

**Current Constraint:**
```sql
CREATE UNIQUE INDEX idx_action_submissions_unique_user_phase
    ON action_submissions(phase_id, user_id);  -- ⚠️ Prevents multiple submissions per user
```

**Needed Constraint:**
```sql
CREATE UNIQUE INDEX idx_action_submissions_unique_character_phase
    ON action_submissions(phase_id, character_id)
    WHERE character_id IS NOT NULL;  -- ✅ Allows multiple submissions per user (one per character)
```

#### ⚠️ Results Currently User-Scoped

**Table: `action_results`**
```sql
CREATE TABLE action_results (
    id SERIAL PRIMARY KEY,
    game_id INTEGER NOT NULL,
    phase_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,  -- ⚠️ Results sent to USER, not CHARACTER
    action_submission_id INTEGER,
    content JSONB NOT NULL,
    is_published BOOLEAN DEFAULT FALSE,
    -- ...
);
```

**Needed:** Add `character_id` to link results to specific characters

### 2.2 Backend Service Layer

**Current State:**
- ✅ Already validates `character_id` ownership
- ✅ Already stores `character_id` in submissions
- ✅ Already queries join with characters table
- ⚠️ Relies on UNIQUE constraint that needs changing

**Key Files:**
- `/backend/pkg/db/services/actions/submissions.go` - Submission logic
- `/backend/pkg/db/services/actions/results.go` - Results logic
- `/backend/pkg/db/queries/phases.sql` - SQL queries

### 2.3 Frontend Components

**Current State:**
- ✅ Already has character selection dropdown
- ✅ Already auto-selects if player has exactly one character
- ✅ Already sends `character_id` in submission
- ⚠️ Shows only ONE action per phase (finds first match)
- ⚠️ Edit mode assumes editing one action

**Key Files:**
- `/frontend/src/components/ActionSubmission.tsx` - Player action UI
- `/frontend/src/components/ActionResultsList.tsx` - Player results display
- `/frontend/src/components/GameResultsManager.tsx` - GM results UI

---

## 3. Required Changes

### 3.1 Database Migration

**Priority:** CRITICAL
**Effort:** 30 minutes
**Risk:** 🟡 MEDIUM (breaking change)

#### Migration File: `XXXXXX_multi_character_actions.up.sql`

```sql
-- Step 1: Add character_id to action_results
ALTER TABLE action_results
    ADD COLUMN character_id INTEGER REFERENCES characters(id) ON DELETE SET NULL;

CREATE INDEX idx_action_results_character_id ON action_results(character_id);

-- Step 2: Backfill character_id from action_submissions for existing results
UPDATE action_results ar
SET character_id = acts.character_id
FROM action_submissions acts
WHERE ar.action_submission_id = acts.id
  AND ar.character_id IS NULL;

-- Step 3: Backfill character_id for orphaned action_submissions
-- (Assign to user's first active character)
UPDATE action_submissions acts
SET character_id = (
    SELECT id FROM characters
    WHERE user_id = acts.user_id
      AND game_id = acts.game_id
      AND status = 'active'
      AND character_type = 'player_character'
    ORDER BY created_at
    LIMIT 1
)
WHERE character_id IS NULL;

-- Step 4: Drop old constraint and add new one
DROP INDEX IF EXISTS idx_action_submissions_unique_user_phase;

CREATE UNIQUE INDEX idx_action_submissions_unique_character_phase
    ON action_submissions(phase_id, character_id)
    WHERE character_id IS NOT NULL;
```

#### Down Migration: `XXXXXX_multi_character_actions.down.sql`

```sql
DROP INDEX IF EXISTS idx_action_submissions_unique_character_phase;
DROP INDEX IF EXISTS idx_action_results_character_id;

ALTER TABLE action_results DROP COLUMN character_id;

CREATE UNIQUE INDEX idx_action_submissions_unique_user_phase
    ON action_submissions(phase_id, user_id);
```

#### Pre-Migration Validation

**Before running migration, verify:**
```sql
-- 1. Check for submissions without character_id
SELECT COUNT(*) FROM action_submissions WHERE character_id IS NULL;

-- 2. Verify all orphaned submissions can be assigned
SELECT user_id, game_id
FROM action_submissions
WHERE character_id IS NULL
  AND NOT EXISTS (
      SELECT 1 FROM characters
      WHERE characters.user_id = action_submissions.user_id
        AND characters.game_id = action_submissions.game_id
        AND status = 'active'
  );
-- Should return 0 rows

-- 3. Verify no duplicate character submissions exist
SELECT phase_id, character_id, COUNT(*)
FROM action_submissions
WHERE character_id IS NOT NULL
GROUP BY phase_id, character_id
HAVING COUNT(*) > 1;
-- Should return 0 rows
```

### 3.2 Backend SQL Queries

**Priority:** HIGH
**Effort:** 1-2 hours
**Risk:** 🟢 LOW

**File:** `/backend/pkg/db/queries/phases.sql`

#### Update SubmitAction Query

```sql
-- name: SubmitAction :one
INSERT INTO action_submissions (game_id, user_id, phase_id, character_id, content, is_draft, submitted_at)
VALUES ($1, $2, $3, $4, $5, $6, CASE WHEN $6 THEN NULL ELSE NOW() END)
ON CONFLICT (phase_id, character_id)  -- ⬅️ CHANGED: per-character instead of per-user
DO UPDATE SET
    content = $5,
    is_draft = $6,
    submitted_at = CASE WHEN $6 THEN action_submissions.submitted_at ELSE COALESCE(action_submissions.submitted_at, NOW()) END,
    updated_at = NOW()
RETURNING *;
```

#### Add New Query: GetUserPhaseActions

```sql
-- name: GetUserPhaseActions :many
-- Get all actions for a user in a specific phase (multi-character support)
SELECT acts.*, c.name as character_name, c.id as character_id
FROM action_submissions acts
LEFT JOIN characters c ON acts.character_id = c.id
WHERE acts.game_id = $1 AND acts.user_id = $2 AND acts.phase_id = $3
ORDER BY c.name, acts.created_at;
```

#### Update CreateActionResult Query

```sql
-- name: CreateActionResult :one
INSERT INTO action_results (game_id, user_id, phase_id, character_id, gm_user_id, content, is_published, sent_at)
VALUES ($1, $2, $3, $4, $5, $6, $7, CASE WHEN $7 THEN NOW() ELSE NULL END)  -- ⬅️ Added character_id param
RETURNING *;
```

#### Update GetUserResults Query

```sql
-- name: GetUserResults :many
SELECT
    results.*,
    gp.phase_type,
    gp.phase_number,
    u.username as gm_username,
    c.name as character_name  -- ⬅️ ADDED
FROM action_results results
JOIN game_phases gp ON results.phase_id = gp.id
JOIN users u ON results.gm_user_id = u.id
LEFT JOIN characters c ON results.character_id = c.id  -- ⬅️ ADDED
WHERE results.game_id = $1 AND results.user_id = $2 AND results.is_published = true
ORDER BY gp.phase_number DESC;
```

**After updating queries:** Run `just sqlgen` to regenerate Go code

### 3.3 Backend Service Layer

**Priority:** HIGH
**Effort:** 1 hour
**Risk:** 🟢 LOW

#### File: `/backend/pkg/db/services/actions/submissions.go`

```go
// Update SubmitAction to require character_id
func (as *ActionSubmissionService) SubmitAction(ctx context.Context, req core.SubmitActionRequest) (*models.ActionSubmission, error) {
    // Add validation: character_id is now REQUIRED
    if req.CharacterID == nil {
        as.Logger.Warn(ctx, "Character ID is required for action submissions")
        return nil, fmt.Errorf("character_id is required for action submissions")
    }

    // ... rest of existing logic ...
}
```

#### File: `/backend/pkg/db/services/actions/results.go`

```go
// Update CreateActionResult to accept character_id
func (as *ActionSubmissionService) CreateActionResult(ctx context.Context, req core.CreateActionResultRequest) (*models.ActionResult, error) {
    // ... existing validation ...

    params := models.CreateActionResultParams{
        GameID:      req.GameID,
        UserID:      req.UserID,
        PhaseID:     req.PhaseID,
        CharacterID: req.CharacterID,  // ⬅️ ADDED
        GmUserID:    game.GmUserID,
        Content:     contentStr,
        IsPublished: pgtype.Bool{Bool: req.IsPublished, Valid: true},
    }

    // ... existing logic ...
}
```

#### File: `/backend/pkg/core/interfaces.go`

```go
// Update request types
type SubmitActionRequest struct {
    GameID      int32
    PhaseID     int32
    UserID      int32
    CharacterID *int32  // Keep as pointer for interface, but validate as required
    Content     interface{}
    IsDraft     bool
}

type CreateActionResultRequest struct {
    GameID             int32
    PhaseID            int32
    UserID             int32
    CharacterID        *int32  // ⬅️ ADDED
    GMUserID           int32
    ActionSubmissionID *int32
    Content            interface{}
    IsPublished        bool
}
```

### 3.4 Backend API Handlers

**Priority:** MEDIUM
**Effort:** 30 minutes
**Risk:** 🟢 LOW

#### File: `/backend/pkg/phases/api_results.go`

```go
// Update CreateActionResult handler to pass character_id
func (h *Handler) CreateActionResult(w http.ResponseWriter, r *http.Request) {
    // ... existing code ...

    req := core.CreateActionResultRequest{
        GameID:      int32(gameID),
        UserID:      data.UserID,
        PhaseID:     activePhase.ID,
        CharacterID: data.CharacterID,  // ⬅️ ADDED
        GMUserID:    int32(gmUser.ID),
        Content:     data.Content,
        IsPublished: data.IsPublished,
    }

    // ... existing code ...
}
```

#### File: `/backend/pkg/phases/requests.go`

```go
// Add CharacterID to CreateActionResultRequest
type CreateActionResultRequest struct {
    UserID      int32       `json:"user_id" validate:"required"`
    CharacterID *int32      `json:"character_id"`  // ⬅️ ADDED
    Content     interface{} `json:"content" validate:"required"`
    IsPublished bool        `json:"is_published"`
}
```

### 3.5 Frontend - Action Submission UI

**Priority:** HIGH
**Effort:** 3-4 hours
**Risk:** 🟡 MEDIUM (UX complexity)

#### File: `/frontend/src/components/ActionSubmission.tsx`

**Current Design:** Shows one action per phase
**New Design:** Show one action form per character (accordion pattern)

```tsx
export function ActionSubmission({ gameId, currentPhase }: ActionSubmissionProps) {
  const { data: userCharacters } = useUserCharacters(gameId);
  const { data: allActions } = useUserPhaseActions(gameId, currentPhase?.id);

  // Group actions by character
  const actionsMap = useMemo(() => {
    const map: Record<number, ActionWithDetails> = {};
    allActions?.forEach(action => {
      if (action.character_id) {
        map[action.character_id] = action;
      }
    });
    return map;
  }, [allActions]);

  // Filter to active characters only
  const activeCharacters = userCharacters.filter(c => c.status === 'active');

  if (activeCharacters.length === 0) {
    return (
      <Alert variant="info">
        <p>You need to create a character before submitting actions.</p>
        <Button href={`/games/${gameId}/characters/new`}>Create Character</Button>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      <h2>Submit Actions - Phase {currentPhase?.phase_number}</h2>
      <p className="text-sm text-content-secondary">
        Submit an action for each of your characters
      </p>

      {activeCharacters.map(character => {
        const action = actionsMap[character.id];
        const hasSubmitted = action && !action.is_draft;

        return (
          <Card key={character.id} variant={hasSubmitted ? "elevated" : "default"}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">{character.name}</h3>
                <Badge variant={hasSubmitted ? "success" : "warning"}>
                  {hasSubmitted ? "Submitted" : "Not Submitted"}
                </Badge>
              </div>
            </CardHeader>
            <CardBody>
              <CharacterActionForm
                character={character}
                currentAction={action}
                phaseId={currentPhase.id}
                gameId={gameId}
              />
            </CardBody>
          </Card>
        );
      })}
    </div>
  );
}
```

**New Component:** `CharacterActionForm.tsx`
```tsx
interface CharacterActionFormProps {
  character: Character;
  currentAction?: ActionWithDetails;
  phaseId: number;
  gameId: number;
}

export function CharacterActionForm({
  character,
  currentAction,
  phaseId,
  gameId
}: CharacterActionFormProps) {
  const [isEditing, setIsEditing] = useState(!currentAction);
  const [content, setContent] = useState(currentAction?.content || '');
  const submitMutation = useSubmitAction(phaseId);

  const handleSubmit = async () => {
    await submitMutation.mutateAsync({
      character_id: character.id,
      content: content,
      is_draft: false
    });
    setIsEditing(false);
  };

  if (!isEditing && currentAction) {
    return (
      <div>
        <MarkdownPreview content={currentAction.content} />
        <Button variant="secondary" onClick={() => setIsEditing(true)}>
          Edit Action
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <Textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder={`What does ${character.name} do this phase?`}
        rows={6}
      />
      <div className="flex gap-2 mt-4">
        <Button type="submit" variant="primary" disabled={!content.trim()}>
          Submit Action
        </Button>
        {currentAction && (
          <Button variant="ghost" onClick={() => setIsEditing(false)}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
```

**New Hook:** `useUserPhaseActions`
```tsx
export function useUserPhaseActions(gameId: number, phaseId?: number) {
  return useQuery({
    queryKey: ['actions', 'user', gameId, phaseId],
    queryFn: async () => {
      if (!phaseId) return [];
      const response = await apiClient.phases.getUserPhaseActions(gameId, phaseId);
      return response.data;
    },
    enabled: !!phaseId
  });
}
```

### 3.6 Frontend - Results Display

**Priority:** MEDIUM
**Effort:** 2 hours
**Risk:** 🟢 LOW

#### File: `/frontend/src/components/ActionResultsList.tsx`

```tsx
// Add character badge to results display
{results.map((result) => (
  <Card key={result.id} className="p-4">
    <div className="flex justify-between items-start mb-2">
      <div className="flex items-center gap-2">
        <span className="text-sm text-content-tertiary">
          Phase {result.phase_number} - {result.phase_type}
        </span>
        {result.character_name && (  // ⬅️ ADDED
          <Badge variant="primary">
            {result.character_name}
          </Badge>
        )}
      </div>
      {result.sent_at && (
        <span className="text-xs text-content-tertiary">
          {new Date(result.sent_at).toLocaleString()}
        </span>
      )}
    </div>
    <MarkdownPreview content={result.content} />
    {result.gm_username && (
      <p className="text-xs text-content-tertiary mt-2">
        From: {result.gm_username}
      </p>
    )}
  </Card>
))}
```

#### TypeScript Type Updates

**File:** `/frontend/src/types/phases.ts`

```tsx
export interface ActionResult {
  id: number;
  game_id: number;
  user_id: number;
  phase_id: number;
  gm_user_id: number;
  content: string;
  is_published: boolean;
  sent_at: string;
  phase_type?: string;
  phase_number?: number;
  gm_username?: string;
  username?: string;
  character_id?: number;     // ⬅️ ADDED
  character_name?: string;   // ⬅️ ADDED
}

export interface ActionWithDetails extends ActionSubmission {
  username?: string;
  character_name?: string;
  phase_type?: string;
  phase_number?: number;
}
```

### 3.7 Frontend - GM Result Creation UI

**Priority:** HIGH
**Effort:** 3-4 hours
**Risk:** 🟡 MEDIUM (new feature)

#### File: `/frontend/src/components/GMActionResults.tsx` (new or updated)

**Design:** Show submissions grouped by player, then by character

```tsx
export function GMActionResults({ gameId, currentPhase }: GMActionResultsProps) {
  const { data: submissions } = usePhaseSubmissions(currentPhase?.id);
  const { data: results } = usePhaseResults(currentPhase?.id);
  const { data: participants } = useGameParticipants(gameId);

  // Group submissions by player, then character
  const submissionsByPlayer = useMemo(() => {
    const grouped: Record<number, {
      player: GameParticipant;
      submissions: Map<number, ActionSubmission>;  // Map<characterId, submission>
    }> = {};

    submissions?.forEach(sub => {
      if (!grouped[sub.user_id]) {
        const player = participants?.find(p => p.user_id === sub.user_id);
        grouped[sub.user_id] = {
          player: player!,
          submissions: new Map()
        };
      }
      if (sub.character_id) {
        grouped[sub.user_id].submissions.set(sub.character_id, sub);
      }
    });

    return grouped;
  }, [submissions, participants]);

  return (
    <div className="space-y-6">
      <h2>Action Submissions - Phase {currentPhase?.phase_number}</h2>

      {Object.entries(submissionsByPlayer).map(([userId, data]) => (
        <Card key={userId} variant="elevated">
          <CardHeader>
            <h3>{data.player.username}</h3>
          </CardHeader>
          <CardBody>
            <div className="space-y-4">
              {Array.from(data.submissions.entries()).map(([charId, submission]) => {
                const existingResult = results?.find(r =>
                  r.character_id === charId && r.phase_id === currentPhase?.id
                );

                return (
                  <CharacterSubmissionCard
                    key={charId}
                    submission={submission}
                    characterId={charId}
                    userId={parseInt(userId)}
                    existingResult={existingResult}
                    gameId={gameId}
                    phaseId={currentPhase.id}
                  />
                );
              })}
            </div>
          </CardBody>
        </Card>
      ))}
    </div>
  );
}
```

**New Component:** `CharacterSubmissionCard.tsx`
```tsx
interface CharacterSubmissionCardProps {
  submission: ActionSubmission;
  characterId: number;
  userId: number;
  existingResult?: ActionResult;
  gameId: number;
  phaseId: number;
}

export function CharacterSubmissionCard({
  submission,
  characterId,
  userId,
  existingResult,
  gameId,
  phaseId
}: CharacterSubmissionCardProps) {
  const [resultContent, setResultContent] = useState(existingResult?.content || '');
  const [isEditing, setIsEditing] = useState(!existingResult);
  const createResultMutation = useCreateActionResult(gameId);

  const handleSubmit = async (isPublished: boolean) => {
    await createResultMutation.mutateAsync({
      user_id: userId,
      character_id: characterId,
      phase_id: phaseId,
      content: resultContent,
      is_published: isPublished
    });
    setIsEditing(false);
  };

  return (
    <div className="border border-theme-default rounded p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Badge variant="primary">{submission.character_name}</Badge>
          {existingResult && (
            <Badge variant={existingResult.is_published ? "success" : "warning"}>
              {existingResult.is_published ? "Published" : "Draft"}
            </Badge>
          )}
        </div>
      </div>

      {/* Action Submission */}
      <div className="mb-4 p-3 bg-bg-secondary rounded">
        <h4 className="text-sm font-semibold mb-2">Action Submitted:</h4>
        <MarkdownPreview content={submission.content} />
      </div>

      {/* Result Form or Display */}
      {isEditing ? (
        <div>
          <h4 className="text-sm font-semibold mb-2">GM Result:</h4>
          <Textarea
            value={resultContent}
            onChange={(e) => setResultContent(e.target.value)}
            placeholder={`What happens to ${submission.character_name}?`}
            rows={6}
          />
          <div className="flex gap-2 mt-3">
            <Button
              variant="secondary"
              onClick={() => handleSubmit(false)}
              disabled={!resultContent.trim()}
            >
              Save Draft
            </Button>
            <Button
              variant="primary"
              onClick={() => handleSubmit(true)}
              disabled={!resultContent.trim()}
            >
              Publish Result
            </Button>
            {existingResult && (
              <Button variant="ghost" onClick={() => setIsEditing(false)}>
                Cancel
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div>
          <h4 className="text-sm font-semibold mb-2">GM Result:</h4>
          <div className="p-3 bg-bg-tertiary rounded">
            <MarkdownPreview content={existingResult!.content} />
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setIsEditing(true)}
            className="mt-2"
          >
            Edit Result
          </Button>
        </div>
      )}
    </div>
  );
}
```

---

## 4. Testing Strategy

### 4.1 Backend Unit Tests

**File:** `/backend/pkg/db/services/actions/submissions_test.go`

```go
func TestSubmitAction_MultipleCharacters(t *testing.T) {
    // Test: User with 2 characters submits actions for both
    // Verify: Both submissions succeed with unique character_ids
    // Verify: Each character can only submit once (constraint)
}

func TestSubmitAction_RequiresCharacterId(t *testing.T) {
    // Test: Submit action without character_id
    // Verify: Returns error
}

func TestSubmitAction_CharacterOwnership(t *testing.T) {
    // Test: User tries to submit for another user's character
    // Verify: Returns authorization error
}

func TestSubmitAction_DuplicateCharacterSubmission(t *testing.T) {
    // Test: Submit action for same character twice
    // Verify: Second submission updates first (upsert behavior)
}
```

**File:** `/backend/pkg/db/services/actions/results_test.go`

```go
func TestCreateActionResult_WithCharacterId(t *testing.T) {
    // Test: Create result with character_id
    // Verify: Result saved with correct character link
}

func TestGetUserResults_IncludesCharacterName(t *testing.T) {
    // Test: Fetch results for user
    // Verify: Results include character_name field
}
```

### 4.2 Frontend Component Tests

**File:** `/frontend/src/components/__tests__/ActionSubmission.test.tsx`

```tsx
describe('ActionSubmission - Multi-Character', () => {
  it('displays action form for each active character', () => {
    // Render with user having 2 characters
    // Verify: 2 separate action forms shown
  });

  it('shows submission status per character', () => {
    // Character 1: has submitted
    // Character 2: has not submitted
    // Verify: Character 1 shows "Submitted" badge
    // Verify: Character 2 shows "Not Submitted" badge
  });

  it('allows submitting actions for different characters', () => {
    // Submit action for Character 1
    // Submit action for Character 2
    // Verify: Both API calls succeed with different character_ids
  });

  it('prevents submission without character selection', () => {
    // This shouldn't be possible with new design, but test validation
  });
});
```

**File:** `/frontend/src/components/__tests__/ActionResultsList.test.tsx`

```tsx
describe('ActionResultsList - Character Context', () => {
  it('displays character name for each result', () => {
    // Render results with character_name
    // Verify: Character badge shown
  });

  it('groups results by character when multiple exist', () => {
    // User receives 2 results (one per character)
    // Verify: Both results displayed with character context
  });
});
```

### 4.3 E2E Tests

**File:** `/frontend/e2e/multi-character-actions.spec.ts`

```typescript
test.describe('Multi-Character Action Workflow', () => {
  test('player submits actions for multiple characters', async ({ page }) => {
    // 1. Login as TestPlayer1 (has 2 characters)
    // 2. Navigate to game with action phase
    // 3. Verify 2 character action cards shown
    // 4. Submit action for Character 1
    // 5. Verify Character 1 shows "Submitted"
    // 6. Submit action for Character 2
    // 7. Verify Character 2 shows "Submitted"
  });

  test('GM sees submissions organized by character', async ({ page }) => {
    // 1. Login as TestGM
    // 2. Navigate to action submissions page
    // 3. Verify player with 2 characters shows 2 separate submissions
    // 4. Verify each submission shows character name
  });

  test('GM sends results to specific characters', async ({ page }) => {
    // 1. Login as TestGM
    // 2. Create result for Character 1
    // 3. Create result for Character 2
    // 4. Publish both results
    // 5. Login as TestPlayer1
    // 6. Verify 2 results received, each with correct character name
  });

  test('cannot submit duplicate action for same character', async ({ page }) => {
    // 1. Login as TestPlayer1
    // 2. Submit action for Character 1
    // 3. Try to submit again for Character 1
    // 4. Verify: shows edit UI instead of duplicate submission
  });
});
```

### 4.4 Migration Testing

**Checklist:**
- [ ] Run migration on copy of production database
- [ ] Verify no data loss (all submissions preserved)
- [ ] Verify backfill assigned valid character_ids
- [ ] Verify constraint prevents duplicate character submissions
- [ ] Verify rollback migration works
- [ ] Test with edge cases:
  - User with 0 characters (orphaned submission)
  - User with 1 character
  - User with 5+ characters
  - NPC assignments (audience controlling NPCs)

**Test Script:** `/backend/test_multi_character_migration.sql`
```sql
-- Test migration in transaction (rollback if fails)
BEGIN;

-- Run migration
\i migrations/XXXXXX_multi_character_actions.up.sql

-- Verify results
SELECT 'Orphaned submissions:' as check_name, COUNT(*) as count
FROM action_submissions WHERE character_id IS NULL;

SELECT 'Duplicate character submissions:' as check_name, COUNT(*) as count
FROM (
    SELECT phase_id, character_id, COUNT(*)
    FROM action_submissions
    GROUP BY phase_id, character_id
    HAVING COUNT(*) > 1
) duplicates;

SELECT 'Results with character_id:' as check_name, COUNT(*) as count
FROM action_results WHERE character_id IS NOT NULL;

-- Rollback to test down migration
ROLLBACK;
```

---

## 5. Risk Assessment & Mitigation

### 5.1 Database Migration Risks

**🔴 HIGH: Data Loss During Migration**

**Risk:** Backfill logic assigns wrong character_id to orphaned submissions

**Mitigation:**
1. Test migration on production copy first
2. Create backup before migration
3. Add validation queries to verify correct assignment
4. Manual review of orphaned submissions before migration
5. Keep rollback migration ready

**🟡 MEDIUM: Constraint Violation During Migration**

**Risk:** Existing data has duplicate character submissions

**Mitigation:**
1. Pre-migration query to detect duplicates
2. Resolve duplicates before migration (merge or delete)
3. Log all duplicate resolutions for audit

### 5.2 User Experience Risks

**🟡 MEDIUM: UI Complexity**

**Risk:** Players with many characters find UI overwhelming

**Mitigation:**
1. Accordion pattern keeps UI collapsed by default
2. Character submission status badges for quick scanning
3. "Submit All" shortcut button (future enhancement)
4. Tutorial/tooltip on first use

**🟡 MEDIUM: User Confusion**

**Risk:** Players accustomed to single action don't understand new system

**Mitigation:**
1. Announcement post explaining change
2. In-app notification on first use
3. Help text: "You can now submit one action per character"
4. FAQ entry

### 5.3 Performance Risks

**🟢 LOW: Query Performance**

**Risk:** Fetching multiple actions per user slows down page

**Mitigation:**
1. Queries already join with characters table
2. Add composite index if needed
3. Monitor query performance after deployment
4. Backend already uses efficient queries

### 5.4 Rollback Risks

**🟡 MEDIUM: Partial Deployment**

**Risk:** Backend deployed with new constraint, frontend not updated

**Mitigation:**
1. Deploy backend + frontend together
2. Feature flag to enable/disable multi-character mode
3. Test on staging with both old and new frontend
4. Gradual rollout to subset of games

---

## 6. Implementation Phases

### Phase 1: Backend Foundation (8-10 hours)

**Goal:** Database + backend ready for multi-character actions

**Tasks:**
1. ✅ Create migration files (up + down)
2. ✅ Test migration on development database
3. ✅ Update SQL queries in `phases.sql`
4. ✅ Run `just sqlgen` to regenerate Go code
5. ✅ Update service layer validation
6. ✅ Update API request/response types
7. ✅ Write backend unit tests
8. ✅ Deploy to staging
9. ✅ Verify no regressions with existing single-character flow

**Success Criteria:**
- Migration completes without data loss
- Backend accepts multiple submissions per user (different characters)
- Constraint prevents duplicate character submissions
- All tests pass

**Rollback Plan:**
- Run down migration
- Revert backend code changes
- Verify single-character flow works

### Phase 2: Player Experience (8-10 hours)

**Goal:** Players can submit multiple actions and view results

**Tasks:**
1. ✅ Create `CharacterActionForm` component
2. ✅ Update `ActionSubmission` to show multiple forms
3. ✅ Create `useUserPhaseActions` hook
4. ✅ Update `ActionResultsList` to show character context
5. ✅ Update TypeScript types
6. ✅ Write frontend component tests
7. ✅ Manual testing with 1, 2, 5 characters
8. ✅ Deploy to production

**Success Criteria:**
- Player with 2 characters sees 2 action forms
- Each submission saves correctly
- Results show character names
- UI works on mobile

**Rollback Plan:**
- Feature flag to show old single-action UI
- Keep backend compatible with both flows

### Phase 3: GM Experience (6-8 hours)

**Goal:** GMs can create results per character

**Tasks:**
1. ✅ Create `GMActionResults` component
2. ✅ Create `CharacterSubmissionCard` component
3. ✅ Update result creation API calls
4. ✅ Write GM component tests
5. ✅ E2E tests for complete workflow
6. ✅ GM user testing
7. ✅ Deploy to production
8. ✅ Update documentation

**Success Criteria:**
- GM sees submissions grouped by character
- GM can create separate results for each character
- Published results appear correctly for players
- Character sheet updates target correct character

**Rollback Plan:**
- GM can still use old result creation flow
- Results without character_id still display

---

## 7. Edge Cases & Special Scenarios

### 7.1 Player with Zero Characters

**Scenario:** Player joined game but hasn't created character yet

**Current Behavior:** Can still submit action without character_id (will fail after migration)

**New Behavior:**
```tsx
if (availableCharacters.length === 0) {
  return (
    <Alert variant="info">
      <p>Create a character before submitting actions.</p>
      <Button href={`/games/${gameId}/characters/new`}>
        Create Character
      </Button>
    </Alert>
  );
}
```

### 7.2 Player with One Character

**Scenario:** Most common case - player has exactly one character

**New Behavior:**
- Still shows single action form (but wrapped in character card)
- Auto-selects the character
- Submission behavior unchanged

### 7.3 Character Dies Mid-Game

**Scenario:** Character marked as 'dead' during action phase

**Current Behavior:** Character status becomes 'dead', can create new character

**New Behavior:**
- Dead character no longer appears in action submission list
- Existing action submission for dead character remains in database
- GM can still send result to dead character (farewell message)
- Player creates new character, new character can submit actions

**Database Consideration:**
```sql
-- Dead character's submissions still exist but are read-only
SELECT * FROM action_submissions
WHERE character_id IN (
    SELECT id FROM characters WHERE status = 'dead'
);
```

### 7.4 NPCs Controlled by Audience

**Scenario:** Audience member assigned to control NPCs

**Current Behavior:** `useUserCharacters` returns controllable NPCs

**New Behavior:**
- NPCs appear in character list
- Can submit actions for each NPC
- No special handling needed (already works!)

### 7.5 Co-GMs

**Scenario:** Game has multiple GMs

**Current Behavior:** All GMs can see action submissions and create results

**New Behavior:**
- All GMs see all character submissions
- Results track which GM created them (`gm_user_id`)
- No conflicts (results are separate records)

### 7.6 Player Joins Mid-Game

**Scenario:** New player approved during action phase

**Current Behavior:** Character marked as 'active', can immediately participate

**New Behavior:**
- New character appears in action submission list
- Can submit action for current phase
- No retroactive actions for past phases

---

## 8. Performance Considerations

### 8.1 Query Optimization

**Current Queries:**
```sql
-- Already efficient: uses JOIN with characters
SELECT acts.*, c.name as character_name
FROM action_submissions acts
LEFT JOIN characters c ON acts.character_id = c.id
WHERE acts.user_id = $1 AND acts.phase_id = $2;
```

**Indexes:**
```sql
-- Existing (sufficient)
CREATE INDEX idx_action_submissions_phase_id ON action_submissions(phase_id);
CREATE INDEX idx_action_submissions_user_id ON action_submissions(user_id);

-- New (from migration)
CREATE UNIQUE INDEX idx_action_submissions_unique_character_phase
    ON action_submissions(phase_id, character_id);
```

**No additional indexes needed** - existing coverage is good

### 8.2 Frontend Performance

**Potential Issue:** Player with 10 characters = 10 separate forms

**Mitigation:**
1. Use accordion pattern (only one expanded at a time)
2. Lazy load action content (fetch on expand)
3. Virtualize list if >20 characters (unlikely edge case)

**Monitoring:**
- Track render time with React DevTools
- Monitor bundle size (new components added)
- Check mobile performance

### 8.3 Backend Performance

**Load Impact:**
- More API calls per phase (one per character vs one per player)
- More database writes (one row per character)

**Estimated Impact:**
- Player with 2 characters: 2x API calls
- Player with 5 characters: 5x API calls
- Still very manageable (async gameplay, not real-time)

**Monitoring:**
- Track submission API response times
- Monitor database write throughput
- Alert if submission time >500ms

---

## 9. Documentation Updates

### 9.1 User Documentation

**File:** `/docs/user-guide/submitting-actions.md`

Update to explain:
- Players can submit one action per character
- How to manage multiple character actions
- Character submission status indicators
- Editing actions after submission

### 9.2 GM Documentation

**File:** `/docs/gm-guide/managing-results.md`

Update to explain:
- How submissions are organized by character
- Creating results for specific characters
- Character sheet updates now target correct character
- Handling players with multiple characters

### 9.3 API Documentation

**File:** `/docs/api/action-submissions.md`

Update to reflect:
- `character_id` now required for submissions
- New endpoint: `GET /api/v1/phases/{id}/user-actions` (all actions for user)
- Response includes `character_name` field
- Constraint changed to per-character

### 9.4 Migration Guide

**File:** `/docs/migrations/multi-character-actions.md`

Document:
- Why the change was made
- What changed in database schema
- Migration steps for self-hosters
- Rollback procedure if needed
- Known issues and workarounds

---

## 10. Future Enhancements (Out of Scope)

### 10.1 Batch Actions
- "Submit same action for all characters" button
- Copy action from one character to another
- Template actions

### 10.2 Character Grouping
- Group characters into teams/parties
- Coordinate actions within group
- Shared action visibility

### 10.3 Action Dependencies
- "Character A's action happens before Character B's"
- Conditional actions based on other characters
- Complex multi-character coordination

### 10.4 Improved GM Tools
- Filter submissions by character status (active/dead)
- Bulk result creation
- Result templates per character type

---

## 11. Decision Log

### Decision 1: Per-Character Constraint vs Per-User
**Decision:** Use `UNIQUE(phase_id, character_id)` instead of `UNIQUE(phase_id, user_id)`

**Rationale:**
- More flexible for future features
- Aligns with character-based gameplay model
- Allows proper multi-character support

**Alternatives Considered:**
- Keep per-user constraint, allow array of actions → Too complex
- Separate table for character actions → Duplicate logic

### Decision 2: Accordion UI vs Tabs
**Decision:** Use accordion/card pattern for character action forms

**Rationale:**
- Scales better with many characters (5-10+)
- Shows submission status at a glance
- Familiar pattern (similar to character sheet cards)

**Alternatives Considered:**
- Tabs → Gets cluttered with many characters
- Dropdown selector → Hides submission status
- Single form with character selector → Easy to forget characters

### Decision 3: Require character_id vs Optional
**Decision:** Make `character_id` required for all new submissions

**Rationale:**
- Clearer data model
- Prevents orphaned submissions
- Forces players to make character choice

**Alternatives Considered:**
- Keep optional → Creates confusion about which character acted
- Auto-assign if only one character → Hidden behavior

### Decision 4: Phased Rollout vs Big Bang
**Decision:** Deploy in 3 phases (backend → player → GM)

**Rationale:**
- Lower risk per phase
- Can test each component independently
- Easier to rollback if issues found

**Alternatives Considered:**
- Deploy all at once → Higher risk, harder to debug
- Feature flag → Adds complexity to maintain two code paths

---

## 12. Success Metrics

### Deployment Success Criteria
- [ ] Migration completes in <5 minutes
- [ ] Zero data loss during migration
- [ ] Zero errors in production logs (first 24 hours)
- [ ] All automated tests pass
- [ ] Manual testing checklist complete

### User Adoption Metrics (Week 1)
- [ ] % of players with >1 character who submit multiple actions
- [ ] Average actions per player (should increase)
- [ ] User support tickets related to multi-character (target: <5)
- [ ] Player satisfaction survey score >4/5

### Technical Health Metrics
- [ ] API response time <200ms (p95)
- [ ] Database query time <50ms (p95)
- [ ] Frontend bundle size increase <100KB
- [ ] No performance regressions on mobile

---

## 13. Timeline

### Week 1: Backend Foundation
- Mon-Tue: Migration + SQL queries
- Wed: Service layer + API updates
- Thu-Fri: Backend testing + staging deployment

### Week 2: Player Experience
- Mon-Tue: Frontend components (action submission)
- Wed: Results display + TypeScript types
- Thu-Fri: Frontend testing + production deployment

### Week 3: GM Experience + Polish
- Mon-Tue: GM result creation UI
- Wed: E2E testing
- Thu: Documentation
- Fri: Production deployment + monitoring

**Total: 3 weeks (22-24 development hours spread across 3 weeks)**

---

## 14. Rollback Plan

### If Migration Fails
1. Stop deployment immediately
2. Run down migration: `XXXXXX_multi_character_actions.down.sql`
3. Verify database state matches pre-migration backup
4. Investigate failure cause
5. Fix migration script
6. Test on staging again

### If Backend Bugs Found
1. Deploy hotfix for critical bugs
2. For non-critical: add to backlog
3. If unfixable: feature flag to disable multi-character mode
4. Revert backend to previous version if necessary

### If Frontend Bugs Found
1. Deploy frontend hotfix
2. Backend remains deployed (backward compatible)
3. Users can still use API directly
4. Feature flag to show old UI if critical

### If User Confusion High
1. Don't rollback code
2. Add more help text/tooltips
3. Post tutorial in announcement
4. Collect feedback and iterate on UX

---

## Status

**Current Phase:** RESEARCH COMPLETE
**Implementation:** NOT STARTED
**Estimated Effort:** 22-24 hours
**Timeline:** 3 weeks (phased rollout)
**Next Step:** Review plan with team, schedule implementation

---

**Last Updated:** 2025-11-13
**Author:** Claude Code AI Assistant
**Review Status:** Pending user approval
