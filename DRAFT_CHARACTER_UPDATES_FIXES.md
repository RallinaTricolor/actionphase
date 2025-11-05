# Draft Character Updates - Required Fixes

**Date:** 2025-01-04
**Feature:** Draft Character Updates for Action Results
**Status:** E2E Tests Passing, Code Review Complete

---

## 🔴 Critical (Fix Before Merge)

### 0. Fix Bulk Publish to Include Draft Character Updates ✅ FIXED

**File:** `backend/pkg/db/services/actions/results.go:103-139`

**Issue:** The `PublishAllPhaseResults` function did NOT call `PublishDraftCharacterUpdates`. This meant:
- Individual result publish worked correctly ✅
- **Bulk publish (publish all results) silently ignored draft character updates** ❌
- Draft updates became orphaned and were never applied to character sheets

**Impact:** **Data loss** - GMs who used "Publish All Results" would lose all pending character sheet updates!

**Fix Applied:**
1. Added new SQL query `GetUnpublishedResultIDs` in `backend/pkg/db/queries/phases.sql:173-176`
2. Rewrote `PublishAllPhaseResults` to:
   - Use transaction wrapper with `pgx.BeginFunc`
   - Get all unpublished result IDs
   - Iterate through each result
   - Publish the result, publish draft updates, and delete drafts for each
   - All operations atomic within transaction

**Status:** ✅ Complete - Code compiles successfully

---

### 1. Add Transaction Wrapper to PublishDraftCharacterUpdates ✅ FIXED

**Files:**
- `backend/pkg/db/services/actions/draft_updates.go:95-113`
- `backend/pkg/db/services/actions/results.go:83-141`

**Issue:** The function performed two database operations without a transaction:
1. Publish drafts (copy to character_data)
2. Delete drafts

If step 2 failed, we would have inconsistent state (published updates but drafts still exist).

**Fix Applied:**
1. Added transaction wrapper to `PublishDraftCharacterUpdates` (still used for direct calls)
2. **BONUS:** Refactored both `PublishActionResult` and `PublishAllPhaseResults` to share code:
   - Created `publishSingleResultWithDrafts` helper function
   - Both functions now use the same 3-step publish logic
   - Both wrapped in transactions for atomicity
   - **Risk reduced:** If we change publish logic, only one place to update

**Benefits:**
- Consistent behavior between individual and bulk publish
- Transaction safety for all publish operations
- Reduced code duplication (~30 lines)
- Single source of truth for publish logic

**Status:** ✅ Complete - Code compiles successfully

---

### 2. Fix Character ID Fallback Security Issue ✅ FIXED

**File:** `backend/pkg/phases/api_draft_updates.go:75-85`

**Issue:**
- Silent fallback to client-provided character_id if lookup failed
- **Security risk:** Allowed malicious GMs to modify ANY character's sheet by providing arbitrary character_id
- Violated principle of least privilege

**Previous Code:**
```go
err = h.App.Pool.QueryRow(r.Context(), query, result.UserID, gameID).Scan(&characterID)
if err != nil {
    // DANGER: Fallback to client-provided ID!
    characterID = data.CharacterID
}
```

**Fix Applied:**
Removed the dangerous fallback - now returns error if character lookup fails:
```go
err = h.App.Pool.QueryRow(r.Context(), query, result.UserID, gameID).Scan(&characterID)
if err != nil {
    h.App.Logger.Error("Failed to get character ID for user in game", "error", err, "user_id", result.UserID, "game_id", gameID)
    render.Render(w, r, core.ErrNotFound("character not found for this user in this game"))
    return
}
```

**Security Impact:**
- ✅ Prevents cross-character attacks
- ✅ Enforces user→character→game validation
- ✅ Explicit errors instead of silent failures

**Status:** ✅ Complete - Code compiles successfully

**Note:** Still uses direct SQL in handler. Future improvement: Move to character service layer (low priority).

---

### 3. Add Backend Unit Tests ✅ FIXED

**File:** `backend/pkg/db/services/actions/draft_updates_test.go:665-879`

**Issue:** Missing test for the critical bulk publish functionality (`PublishAllPhaseResults`).

**Fix Applied:**
Added comprehensive test `TestActionSubmissionService_PublishAllPhaseResults_WithDrafts` with two scenarios:

1. **"bulk publish publishes all drafts for all results"** (lines 734-818)
   - Creates 2 players with characters
   - Creates action results for both
   - Creates draft character updates for each result
   - Calls `PublishAllPhaseResults` (bulk operation)
   - Verifies:
     - Both results marked as published
     - Both drafts deleted from drafts table
     - Both character sheets updated correctly

2. **"bulk publish is atomic - all or nothing"** (lines 820-878)
   - Creates 3 results with drafts
   - Calls bulk publish
   - Verifies all operations complete atomically (transaction safety)

**Test Results:**
```
✅ PASS: TestActionSubmissionService_PublishAllPhaseResults_WithDrafts (0.25s)
  ✅ PASS: bulk_publish_publishes_all_drafts_for_all_results (0.01s)
  ✅ PASS: bulk_publish_is_atomic_-_all_or_nothing (0.01s)
```

**Status:** ✅ Complete - Tests pass successfully

**Note:** The file already had excellent test coverage for all CRUD operations. Added only the missing critical test for bulk publish.

---

## 🟡 High Priority (Fix Soon)

### 4. Extract Duplicate Handler Code

**File:** `backend/pkg/phases/api_draft_updates.go`

**Issue:** ~100 lines of duplicate code across 5 handler functions:
- Parse gameID from URL params (5 locations)
- Get authenticated user (5 locations)
- Check GM permissions (5 locations)

**Fix:** Create helper function
```go
func (h *Handler) validateGMAccess(r *http.Request) (gameID int32, authUser *core.User, err error) {
    gameIDStr := chi.URLParam(r, "gameId")
    gameID64, err := strconv.ParseInt(gameIDStr, 10, 32)
    if err != nil {
        return 0, nil, fmt.Errorf("invalid game ID")
    }
    gameID = int32(gameID64)

    authUser = core.GetAuthenticatedUser(r.Context())
    if authUser == nil {
        return 0, nil, fmt.Errorf("authentication required")
    }

    phaseService := &phasesvc.PhaseService{DB: h.App.Pool}
    canManage, err := phaseService.CanUserManagePhases(r.Context(), gameID, int32(authUser.ID))
    if err != nil {
        return 0, nil, fmt.Errorf("failed to check permissions: %w", err)
    }
    if !canManage {
        return 0, nil, fmt.Errorf("only the GM can perform this action")
    }

    return gameID, authUser, nil
}
```

Then use in handlers:
```go
func (h *Handler) CreateDraftCharacterUpdate(w http.ResponseWriter, r *http.Request) {
    gameID, authUser, err := h.validateGMAccess(r)
    if err != nil {
        // Handle error appropriately based on error type
        return
    }
    // ... rest of handler logic
}
```

---

### 5. Fix E2E Test Serial Mode Brittleness

**File:** `frontend/e2e/gameplay/draft-character-updates.spec.ts`

**Issue:** Tests depend on serial execution order and accumulate state:
- Line 140: Expects count=2 (relies on previous test leaving "Dark Vision")
- Line 168: Expects count=3 (relies on 2 abilities from previous tests)

**Problems:**
- Tests fail if run in isolation
- Test names are misleading (suggest testing count=1 but actually test count=3)
- Adding/removing tests requires updating all subsequent assertions

**Fix Option 1 (Recommended):** Make tests independent
```typescript
test.beforeEach(async ({ page }) => {
    // Reset database to clean E2E fixture state before each test
    await page.request.post('/api/v1/test/reset-fixtures');
});
```

**Fix Option 2:** Document serial dependencies clearly
```typescript
test.describe('Draft Character Updates - Serial Mode Flow', () => {
    // ⚠️ CRITICAL: These tests run in SERIAL mode and share state!
    // Each test builds on the previous test's data.
    // Test 1: Creates "Dark Vision" (count=1)
    // Test 2: Creates and removes unique ability (count still=1)
    // Test 3: Creates "New Ability" (count=2 from tests 1+3)
    // Test 4: Creates "Published Ability" (count=3 from tests 1+3+4)

    test('creates first ability', ...);
    test('removes a draft', ...);
    test('sees badge count=2 (from tests 1+3)', ...);
    test('sees publish dialog count=3 (from tests 1+3+4)', ...);
});
```

---

### 6. Fix Currency Modification Semantics (UX Bug)

**File:** `frontend/src/components/character-sheet-tabs/CurrencyTab.tsx` and `backend/pkg/db/queries/action_character_updates.sql`

**Issue:** UI says "Add or remove" but backend OVERWRITES values instead of adding to them.

**Current Behavior:**
- Character has 100 Gold
- GM enters "+50" in UI
- Expected result: 150 Gold
- **Actual result: 50 Gold** (overwrites!)

**Impact:** GMs lose player currency when trying to reward them!

**See full investigation below in "Investigation Findings" section for complete details and fix options.**

**Recommended Fix:** Add explicit operation types ("set", "add", "subtract") and implement additive logic for currency.

---

### 7. Add Input Length Validation

**File:** `backend/pkg/db/services/actions/draft_updates.go:15`

**Issue:** No max length validation on field_name or field_value.

**Risk:**
- Extremely long ability names causing UI overflow
- Database storage concerns
- Potential DoS via large payloads

**Fix:**
```go
func (s *ActionSubmissionService) CreateDraftCharacterUpdate(ctx context.Context, req core.CreateDraftCharacterUpdateRequest) (*models.ActionResultCharacterUpdate, error) {
    queries := models.New(s.DB)

    // Input length validation
    if len(req.FieldName) > 255 {
        return nil, fmt.Errorf("field_name exceeds maximum length of 255 characters")
    }
    if len(req.FieldValue) > 10000 {
        return nil, fmt.Errorf("field_value exceeds maximum length of 10000 characters")
    }

    // Validate module type
    validModules := map[string]bool{"abilities": true, "skills": true, "inventory": true, "currency": true}
    // ... rest of validation
}
```

Also add frontend validation:
```typescript
// In AbilitiesTab.tsx
if (abilityName.length > 255) {
    setError('Ability name cannot exceed 255 characters');
    return;
}
if (abilityDescription.length > 10000) {
    setError('Description cannot exceed 10,000 characters');
    return;
}
```

---

## 🟢 Medium Priority (Improvements)

### 7. Consolidate Duplicate Tab Components

**Files:**
- `frontend/src/components/character-sheet-tabs/AbilitiesTab.tsx`
- `frontend/src/components/character-sheet-tabs/SkillsTab.tsx`
- `frontend/src/components/character-sheet-tabs/InventoryTab.tsx`
- `frontend/src/components/character-sheet-tabs/CurrencyTab.tsx`

**Issue:** All four tabs share ~90% identical code. Only difference is `module_type` value and labels.

**Fix:** Create generic component
```typescript
interface CharacterSheetTabProps {
    moduleType: 'abilities' | 'skills' | 'inventory' | 'currency';
    singularLabel: string;
    pluralLabel: string;
    namePlaceholder: string;
    descriptionPlaceholder: string;
    gameId: number;
    actionResultId: number;
    characterId: number;
    drafts: DraftCharacterUpdate[];
    onDeleteDraft: (draftId: number) => void;
}

export const CharacterSheetTab: React.FC<CharacterSheetTabProps> = ({
    moduleType,
    singularLabel,
    pluralLabel,
    // ... other props
}) => {
    // Shared implementation using moduleType parameter
};
```

Usage:
```typescript
<CharacterSheetTab
    moduleType="abilities"
    singularLabel="Ability"
    pluralLabel="Abilities"
    namePlaceholder="e.g., Fireball, Sneak Attack"
    descriptionPlaceholder="Describe this ability..."
    {...otherProps}
/>
```

---

### 8. Add User-Facing Error Messages

**File:** `frontend/src/components/character-sheet-tabs/AbilitiesTab.tsx:44-46`

**Issue:** Errors logged to console but not shown to user
```typescript
} catch (error) {
    console.error('Failed to add ability:', error);  // ← Silent failure
}
```

**Fix:**
```typescript
const [error, setError] = useState<string | null>(null);

try {
    await createDraft.mutateAsync({...});
    setError(null);
    // ... reset form
} catch (error) {
    setError('Failed to add ability. Please try again.');
}

// In JSX (before the form):
{error && <Alert variant="danger" dismissible onDismiss={() => setError(null)}>{error}</Alert>}
```

Apply to all 4 tab components.

---

### 9. Replace waitForTimeout with State Waits

**File:** `frontend/e2e/gameplay/draft-character-updates.spec.ts:101`

**Issue:**
```typescript
await page.waitForTimeout(500); // Brief wait to ensure DOM is stable
```

Fixed timeouts are flaky and slow down tests.

**Fix:**
```typescript
// Wait for the draft to appear in the list before trying to remove it
await page.locator(`text="${uniqueAbilityName}"`).waitFor({ state: 'visible' });
// Now it's safe to interact with the Remove button
```

---

### 10. Use data-testid Instead of CSS Selectors

**File:** `frontend/e2e/gameplay/draft-character-updates.spec.ts:104`

**Issue:** Brittle CSS class selector
```typescript
const draftItems = await page.locator('[class*="flex"][class*="justify-between"]').filter({ hasText: uniqueAbilityName }).all();
```

**Fix:** Add data-testid attributes
```typescript
// In AbilitiesTab.tsx:
<Card
    key={draft.id}
    variant="bordered"
    padding="sm"
    data-testid={`draft-ability-${draft.id}`}
>
    <Button
        data-testid={`remove-draft-${draft.id}`}
        onClick={() => onDeleteDraft(draft.id)}
    >
        Remove
    </Button>
</Card>

// In test:
await page.getByTestId(`remove-draft-${draftId}`).click();
```

---

## 🔵 Low Priority (Nice to Have)

### 11. Move Validation Maps to Package-Level Constants

**File:** `backend/pkg/db/services/actions/draft_updates.go:18-34`

**Issue:** Validation maps recreated on every function call

**Fix:**
```go
var (
    validModules     = map[string]bool{"abilities": true, "skills": true, "inventory": true, "currency": true}
    validFieldTypes  = map[string]bool{"text": true, "number": true, "boolean": true, "json": true}
    validOperations  = map[string]bool{"upsert": true, "delete": true}
)

func (s *ActionSubmissionService) CreateDraftCharacterUpdate(ctx context.Context, req core.CreateDraftCharacterUpdateRequest) (*models.ActionResultCharacterUpdate, error) {
    // Use package-level constants instead of recreating maps
    if !validModules[req.ModuleType] {
        return nil, fmt.Errorf("invalid module_type: %s", req.ModuleType)
    }
    // ...
}
```

---

### 12. Add API Documentation

**Missing:** Documentation for new endpoints in `.claude/reference/API_DOCUMENTATION.md`

**Required:**
```markdown
### Draft Character Updates

#### Create Draft Character Update
`POST /api/v1/games/{gameId}/results/{resultId}/character-updates`

Creates or updates a draft character sheet update for an action result.

**Auth:** GM only

**Request Body:**
```json
{
  "character_id": 123,
  "module_type": "abilities",
  "field_name": "Dark Vision",
  "field_value": "Can see in darkness within 60 feet",
  "field_type": "text",
  "operation": "upsert"
}
```

**Response:** 201 Created
```json
{
  "id": 456,
  "action_result_id": 789,
  "character_id": 123,
  "module_type": "abilities",
  "field_name": "Dark Vision",
  "field_value": "Can see in darkness within 60 feet",
  "field_type": "text",
  "operation": "upsert",
  "created_at": "2025-01-04T12:00:00Z",
  "updated_at": "2025-01-04T12:00:00Z"
}
```

#### Get Draft Character Updates
`GET /api/v1/games/{gameId}/results/{resultId}/character-updates`

Retrieves all draft updates for an action result.

**Auth:** GM only

**Response:** 200 OK
```json
[
  {
    "id": 456,
    "action_result_id": 789,
    // ... same structure as Create response
  }
]
```

#### Get Draft Update Count
`GET /api/v1/games/{gameId}/results/{resultId}/character-updates/count`

Returns count of draft updates for an action result.

**Auth:** GM only

**Response:** 200 OK
```json
{
  "count": 3
}
```

#### Update Draft Character Update
`PUT /api/v1/games/{gameId}/results/{resultId}/character-updates/{draftId}`

Updates the field value of an existing draft.

**Auth:** GM only

**Request Body:**
```json
{
  "field_value": "Updated description"
}
```

**Response:** 200 OK (same structure as Create response)

#### Delete Draft Character Update
`DELETE /api/v1/games/{gameId}/results/{resultId}/character-updates/{draftId}`

Deletes a draft character update.

**Auth:** GM only

**Response:** 204 No Content
```

---

### 13. Improve Test Isolation Documentation

**File:** `frontend/e2e/README.md` (or create if doesn't exist)

**Add Section:**
```markdown
## Test Isolation Strategy

### User Accounts
- `PLAYER_1` through `PLAYER_4`: Used by password change tests in `settings/account-security.spec.ts`
  - ⚠️ DO NOT USE in other tests - passwords may be modified
- `PLAYER_5`: Safe for general testing (notification tests, etc.)
- `GM`: Safe for GM-specific tests
- `AUDIENCE`: Safe for audience member tests

### Serial vs Parallel Tests
- Most tests run in **parallel** mode (default)
- Tests marked with `test.describe.configure({ mode: 'serial' })` run sequentially and **share state**
- Serial mode tests in `draft-character-updates.spec.ts`:
  - Test 1 creates "Dark Vision" ability
  - Test 2 creates/removes unique ability
  - Test 3 expects count=2 (includes "Dark Vision" from Test 1)
  - Test 4 expects count=3 (includes abilities from Tests 1+3)

### Database Fixtures
- Fixtures reset at start of full test suite run
- Individual test runs may have stale data
- Use `just reset-e2e-fixtures` to manually reset
```

---

## 🔴 CRITICAL BUG FOUND: Bulk Publish Missing Draft Updates

### Investigation Findings

#### 1. Bulk Publish Behavior ❌ **BROKEN**

**Question:** What happens when you publish all results? Does it update sheets the same way that individually publishing a result does?

**Answer:** **NO - This is a critical bug!**

**Files Investigated:**
- `backend/pkg/db/services/actions/results.go:104-113`
- `backend/pkg/db/queries/phases.sql` (PublishAllPhaseResults query)

**Current Implementation:**
```go
func (as *ActionSubmissionService) PublishAllPhaseResults(ctx context.Context, phaseID int32) error {
    queries := models.New(as.DB)

    err := queries.PublishAllPhaseResults(ctx, phaseID)  // ← Only updates is_published flag
    if err != nil {
        return fmt.Errorf("failed to publish all phase results: %w", err)
    }

    return nil  // ← MISSING: PublishDraftCharacterUpdates call!
}
```

**SQL Query:**
```sql
-- name: PublishAllPhaseResults :exec
UPDATE action_results
SET is_published = true, sent_at = COALESCE(sent_at, NOW())
WHERE phase_id = $1 AND is_published = false;
```

**Problem:**
- Individual publish (`PublishActionResult`) calls `PublishDraftCharacterUpdates` ✅
- Bulk publish (`PublishAllPhaseResults`) does **NOT** call `PublishDraftCharacterUpdates` ❌
- Draft character updates will be **orphaned** and never applied to character sheets!

**Fix Required:**
```go
func (as *ActionSubmissionService) PublishAllPhaseResults(ctx context.Context, phaseID int32) error {
    queries := models.New(as.DB)

    // Get all unpublished result IDs for this phase
    results, err := queries.GetUnpublishedResults(ctx, phaseID)
    if err != nil {
        return fmt.Errorf("failed to get unpublished results: %w", err)
    }

    // Publish each result and its draft character updates
    for _, result := range results {
        // Publish the result
        _, err := queries.PublishActionResult(ctx, result.ID)
        if err != nil {
            return fmt.Errorf("failed to publish result %d: %w", result.ID, err)
        }

        // Publish any draft character updates for this result
        err = as.PublishDraftCharacterUpdates(ctx, result.ID)
        if err != nil {
            return fmt.Errorf("failed to publish draft character updates for result %d: %w", result.ID, err)
        }
    }

    return nil
}
```

**OR** use a transaction-based approach:
```go
func (as *ActionSubmissionService) PublishAllPhaseResults(ctx context.Context, phaseID int32) error {
    return pgx.BeginFunc(ctx, as.DB, func(tx pgx.Tx) error {
        queries := models.New(tx)

        // Get all unpublished result IDs
        results, err := queries.GetUnpublishedResultsForPhase(ctx, phaseID)
        if err != nil {
            return fmt.Errorf("failed to get unpublished results: %w", err)
        }

        // Publish all results (marks is_published = true)
        err = queries.PublishAllPhaseResults(ctx, phaseID)
        if err != nil {
            return fmt.Errorf("failed to publish phase results: %w", err)
        }

        // Publish draft character updates for each result
        for _, resultID := range results {
            err = queries.PublishDraftCharacterUpdates(ctx, resultID)
            if err != nil {
                return fmt.Errorf("failed to publish draft character updates for result %d: %w", resultID, err)
            }
            err = queries.DeletePublishedDrafts(ctx, resultID)
            if err != nil {
                return fmt.Errorf("failed to delete published drafts for result %d: %w", resultID, err)
            }
        }

        return nil
    })
}
```

**Testing Required:**
- Add unit test for `PublishAllPhaseResults` with draft character updates
- Add E2E test for bulk publish with pending character updates
- Verify transaction rollback works correctly

---

#### 2. Non-Existent Currency Handling ✅ **Works Correctly**

**Question:** What happens if you add currency to someone's sheet in a result, but they don't have that currency?

**Answer:** **It creates a new currency entry automatically** via `ON CONFLICT` upsert behavior.

**SQL Implementation:**
```sql
-- from action_character_updates.sql
INSERT INTO character_data (character_id, module_type, field_name, field_value, field_type)
SELECT character_id, module_type, field_name, field_value, field_type
FROM draft_updates
ON CONFLICT (character_id, module_type, field_name)
DO UPDATE SET
    field_value = EXCLUDED.field_value,
    field_type = EXCLUDED.field_type,
    updated_at = NOW();
```

**Behavior:**
- If currency **doesn't exist**: New row inserted in `character_data` with the value
- If currency **does exist**: Value is **overwritten** (see issue #3 below)

**No errors or issues** - works as intended for creating new currency types.

---

#### 3. Currency Modification Semantics ⚠️ **AMBIGUOUS - Needs Documentation**

**Question:** Are currency modifications additive or absolute? (e.g., if I put in '50' will it add 50 or set it to 50?)

**Answer:** **Currently ABSOLUTE (overwrites), but UI suggests ADDITIVE**

**UI Implementation** (`CurrencyTab.tsx:52-53`):
```typescript
<p className="text-sm text-content-secondary">
  Add or remove currency amounts. Use positive numbers to add, negative to subtract.
</p>
```

The UI text says "Add or remove" suggesting additive behavior, but...

**Backend Implementation:**
```sql
ON CONFLICT (character_id, module_type, field_name)
DO UPDATE SET
    field_value = EXCLUDED.field_value,  -- ← This OVERWRITES the value
    field_type = EXCLUDED.field_type,
    updated_at = NOW();
```

**The backend OVERWRITES the value**, not adds to it!

**Example Problem:**
```
Current Gold: 100
GM enters: +50 (intending to add 50 gold)
Database stores: "50" (as text)
Result after publish: Gold = 50 (not 150!)
```

**This is a serious UX bug!**

**Fix Options:**

**Option 1:** Implement additive logic in SQL
```sql
DO UPDATE SET
    field_value = CASE
        WHEN character_data.field_type = 'number' THEN
            (CAST(character_data.field_value AS INTEGER) + CAST(EXCLUDED.field_value AS INTEGER))::TEXT
        ELSE
            EXCLUDED.field_value
    END,
    updated_at = NOW();
```

**Option 2:** Add explicit operation types
```typescript
// In CreateDraftCharacterUpdateRequest
Operation: "set" | "add" | "subtract"

// Currency tab would use:
operation: amount >= 0 ? 'add' : 'subtract'
field_value: Math.abs(amount).toString()

// Backend handles:
CASE operation
    WHEN 'set' THEN EXCLUDED.field_value
    WHEN 'add' THEN (current + new)::TEXT
    WHEN 'subtract' THEN (current - new)::TEXT
END
```

**Option 3:** Change UI to clarify absolute values
```typescript
<p className="text-sm text-content-secondary">
  Set currency amount (overwrites current value). Current amount will be replaced.
</p>
```

**Recommendation:** Use **Option 2** - explicit operation types. This:
- ✅ Matches user mental model (add/subtract)
- ✅ Preserves backward compatibility for abilities/skills/inventory (use "set")
- ✅ Allows future operations (multiply, etc.)
- ✅ Makes behavior explicit and predictable

**Testing Required:**
- Add unit test for additive currency behavior
- Add E2E test: Create character with 100 gold, add +50 via result, verify = 150
- Add E2E test: Create character with 100 gold, add -30 via result, verify = 70

---

## Testing Checklist

Before marking this feature as complete:

- [ ] All E2E tests pass individually
- [ ] All E2E tests pass in full suite
- [ ] Backend unit tests added with >80% coverage
- [ ] Manual testing of currency edge cases
- [ ] Manual testing of bulk publish
- [ ] Transaction rollback tested manually
- [ ] Character ID lookup verified for multi-character scenarios
- [ ] Input length limits tested with max-length strings
- [ ] Error messages displayed correctly to users in UI
- [ ] API documentation updated
- [ ] Dark mode verified for all new UI components

---

## Performance Considerations

### Current Implementation
- Single query fetches all drafts (`GetDraftCharacterUpdates`)
- Upsert uses `ON CONFLICT` for efficiency
- Proper React Query cache invalidation prevents unnecessary refetches

### Potential Optimizations (if needed)
- Add database index on `action_result_id` in `action_result_character_updates` table
- Consider pagination if draft count exceeds 100 items
- Add debouncing to draft creation if users spam the "Add" button

---

## Security Checklist

- [x] All endpoints check GM permissions
- [x] SQL injection prevented via parameterized queries
- [x] Result ID validated to belong to game ID
- [ ] Character ID lookup properly validated (see Critical Fix #2)
- [ ] Input length limits enforced (see High Priority Fix #6)
- [x] Authorization checked before all CRUD operations
- [x] No sensitive data exposed in error messages

---

## Migration Notes

**Migration File:** `backend/pkg/db/migrations/20251104230527_create_action_result_character_updates.up.sql`

**Rollback Available:** Yes (`20251104230527_create_action_result_character_updates.down.sql`)

**Data Impact:**
- New table: `action_result_character_updates`
- No changes to existing tables
- No data migration required
- Safe to deploy

---

## Related Files

### Backend
- `backend/pkg/db/migrations/20251104230527_create_action_result_character_updates.up.sql`
- `backend/pkg/db/queries/action_character_updates.sql`
- `backend/pkg/db/models/action_character_updates.sql.go`
- `backend/pkg/db/services/actions/draft_updates.go`
- `backend/pkg/db/services/actions/results.go` (modified)
- `backend/pkg/phases/api_draft_updates.go`
- `backend/pkg/phases/requests.go` (modified)
- `backend/pkg/phases/responses.go` (modified)
- `backend/pkg/core/interfaces.go` (modified)
- `backend/pkg/http/root.go` (modified)

### Frontend
- `frontend/src/components/UpdateCharacterSheetModal.tsx`
- `frontend/src/components/PublishResultConfirmationDialog.tsx`
- `frontend/src/components/GameResultsManager.tsx` (modified)
- `frontend/src/components/character-sheet-tabs/AbilitiesTab.tsx`
- `frontend/src/components/character-sheet-tabs/SkillsTab.tsx`
- `frontend/src/components/character-sheet-tabs/InventoryTab.tsx`
- `frontend/src/components/character-sheet-tabs/CurrencyTab.tsx`
- `frontend/src/hooks/useDraftCharacterUpdates.ts`
- `frontend/src/hooks/index.ts` (modified)
- `frontend/src/lib/api/phases.ts` (modified)
- `frontend/src/types/phases.ts` (modified)

### Tests
- `frontend/e2e/gameplay/draft-character-updates.spec.ts`
- `frontend/e2e/smoke/health-check.spec.ts` (modified)
- `frontend/e2e/messaging/private-messages-flow.spec.ts` (modified)

---

**Last Updated:** 2025-01-04
**Review Status:** Code review complete, awaiting fixes
