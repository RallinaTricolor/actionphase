# Remaining POM Implementation Plan

**Created**: 2025-10-26
**Last Updated**: 2025-10-26
**Status**: ✅ COMPLETE - All 4 POMs created and 2 high-priority tests refactored
**Purpose**: Complete implementation of missing POMs and refactor tests to use them

**Completed This Session**:
- ✅ Extended CharacterSheetPage with 16 new modal navigation methods
- ✅ Created GameSettingsPage from scratch (12 methods)
- ✅ Created ParticipantsPage from scratch (10 methods)
- ✅ Created AvatarManagementPage from scratch (11 methods)
- ✅ Refactored character-sheet-management.spec.ts (~15-20 lines eliminated)
- ✅ Refactored gm-edits-game-settings.spec.ts (~20-25 lines eliminated)

---

## Progress Summary

### ✅ Completed POMs
1. **CharacterSheetPage** - Extended with modal navigation methods
   - Location: `e2e/pages/CharacterSheetPage.ts`
   - Methods added: Module navigation (Bio, Abilities & Skills, Inventory), tab switching, permission checks
   - Ready to use in: character-sheet-management.spec.ts

2. **GameSettingsPage** - Newly created
   - Location: `e2e/pages/GameSettingsPage.ts`
   - Methods: Edit modal workflow, update fields, toggle settings, save/cancel
   - Ready to use in: gm-edits-game-settings.spec.ts

### ✅ Additional POMs Created
3. **ParticipantsPage** - COMPLETE
   - Location: `e2e/pages/ParticipantsPage.ts`
   - Methods: 10 methods for participant management (list, filter, search, permissions)
   - Ready to use in: Participant listing tests, multi-user collaboration tests

4. **AvatarManagementPage** - COMPLETE
   - Location: `e2e/pages/AvatarManagementPage.ts`
   - Methods: 11 methods for avatar upload workflow
   - Ready to use in: character-avatar.spec.ts, profile picture updates

---

## 3. ParticipantsPage (Medium Priority)

**Location**: `e2e/pages/ParticipantsPage.ts`

**Purpose**: Manage participants/people view in games

**Constructor**:
```typescript
constructor(page: Page, gameId: number)
```

**Required Methods**:

```typescript
/**
 * Navigate to participants/people tab
 */
async goto(): Promise<void>

/**
 * Get list of all participants
 */
async getParticipantsList(): Promise<string[]>

/**
 * Get participants by role
 * @param role - 'player' | 'gm' | 'audience'
 */
async getParticipantsByRole(role: string): Promise<string[]>

/**
 * Get participant count
 */
async getParticipantsCount(): Promise<number>

/**
 * Check if specific participant is visible
 * @param username - Username to check
 */
async hasParticipant(username: string): Promise<boolean>

/**
 * Get participant role badge
 * @param username - Username to check
 */
async getParticipantRole(username: string): Promise<string>

/**
 * Filter participants by search
 * @param searchTerm - Term to search for
 */
async searchParticipants(searchTerm: string): Promise<void>

/**
 * Check if user can manage participants (GM only)
 */
async canManageParticipants(): Promise<boolean>
```

**Selectors to Use**:
- Tabs: `getByTestId('tab-participants')` or `getByTestId('tab-people')`
- Participant cards: Look for data-testid patterns
- Role badges: `getByTestId('participant-role-badge')`
- Search: Standard input patterns

**Tests That Would Use This**:
- Participant listing tests
- Role verification tests
- Multi-user collaboration tests

---

## 4. AvatarManagementPage (Low Priority)

**Location**: `e2e/pages/AvatarManagementPage.ts`

**Purpose**: Handle avatar upload and management workflow

**Constructor**:
```typescript
constructor(page: Page)
```

**Required Methods**:

```typescript
/**
 * Upload avatar file
 * @param filePath - Absolute path to image file
 */
async uploadAvatar(filePath: string): Promise<void>

/**
 * Wait for upload to complete and preview to appear
 */
async waitForPreview(): Promise<void>

/**
 * Save uploaded avatar
 */
async saveAvatar(): Promise<void>

/**
 * Cancel avatar upload
 */
async cancelUpload(): Promise<void>

/**
 * Delete current avatar
 */
async deleteAvatar(): Promise<void>

/**
 * Check if avatar preview is visible
 */
async hasPreview(): Promise<boolean>

/**
 * Check if avatar upload is allowed (permissions)
 */
async canUploadAvatar(): Promise<boolean>

/**
 * Get avatar upload error message if any
 */
async getUploadError(): Promise<string | null>
```

**Selectors to Use**:
- File input: `input[type="file"]`
- Preview: `getByTestId('avatar-preview')`
- Buttons: `getByRole('button', { name: 'Save' })`, etc.
- Error messages: Look for error display patterns

**Tests That Would Use This**:
- character-avatar.spec.ts (currently not refactored)
- Avatar upload in character creation
- Profile picture updates

---

## Tests to Refactor

### High Priority (Use Newly Created POMs)

#### 1. character-sheet-management.spec.ts
**File**: `e2e/characters/character-sheet-management.spec.ts`
**POM to use**: CharacterSheetPage
**Current status**: Partially refactored (uses CharacterWorkflowPage only)

**Refactoring needed**:
```typescript
// Add import
import { CharacterSheetPage } from '../pages/CharacterSheetPage';

// In each test, after opening character sheet:
const sheetPage = new CharacterSheetPage(page);

// Test 1: Replace module navigation
// BEFORE:
await page.getByRole('button', { name: 'Abilities & Skills' }).click();
await page.getByRole('button', { name: 'Abilities (2)' }).click();

// AFTER:
await sheetPage.goToAbilitiesModule();
await sheetPage.goToAbilitiesTab(2);

// Test 1: Replace inventory navigation
// BEFORE:
await page.getByRole('button', { name: 'Inventory' }).click();
await page.getByRole('button', { name: 'Currency (2)' }).click();

// AFTER:
await sheetPage.goToInventoryModule();
await sheetPage.goToCurrencyTab(2);

// Test 3: Replace module visibility checks
// BEFORE:
await expect(page.getByRole('button', { name: 'Bio/Background' })).toBeVisible();
await expect(page.getByRole('button', { name: 'Abilities & Skills' })).not.toBeVisible();

// AFTER:
expect(await sheetPage.isModuleVisible('Bio/Background')).toBe(true);
expect(await sheetPage.isModuleVisible('Abilities & Skills')).toBe(false);

// Test 4 (skipped): Replace permission checks
// BEFORE:
await expect(page.getByRole('button', { name: 'Add Ability' })).not.toBeVisible();

// AFTER:
expect(await sheetPage.canAddAbility()).toBe(false);

// Test 5 (skipped): Replace add ability workflow
// BEFORE:
await page.getByRole('button', { name: 'Add Ability' }).click();
await page.fill('input[placeholder*="ability name" i]', 'Test Ability');
await page.fill('textarea[placeholder*="description" i]', 'Test description');
const saveButton = page.getByRole('button', { name: /Save|Add/ }).first();
await saveButton.click();

// AFTER:
await sheetPage.addAbility('Test Ability', 'Test description');
```

**Estimated cleanup**: ~15-20 lines of brittle selectors

---

#### 2. gm-edits-game-settings.spec.ts
**File**: `e2e/games/gm-edits-game-settings.spec.ts`
**POM to use**: GameSettingsPage
**Current status**: Basic refactoring done (uses getByRole)

**Refactoring needed**:
```typescript
// Add import
import { GameSettingsPage } from '../pages/GameSettingsPage';

// In beforeAll or each test:
const settingsPage = new GameSettingsPage(page);

// Test 1: Edit title and description
// BEFORE:
await page.getByRole('button', { name: 'Edit Game' }).click();
await waitForModal(page, 'Edit Game');
await page.fill('#title', newTitle);
await page.fill('#description', newDescription);
await page.getByRole('button', { name: 'Save Changes' }).click();

// AFTER:
await settingsPage.openEditModal();
await settingsPage.updateTitle(newTitle);
await settingsPage.updateDescription(newDescription);
await settingsPage.saveChanges();

// Test 2: Edit genre and max players
// BEFORE:
await page.getByRole('button', { name: 'Edit Game' }).click();
await waitForModal(page, 'Edit Game');
await page.fill('#genre', newGenre);
await page.fill('#max_players', '6');
await page.getByRole('button', { name: 'Save Changes' }).click();
await page.getByRole('button', { name: 'Edit Game' }).click();
await expect(page.locator('#genre')).toHaveValue(newGenre);
await expect(page.locator('#max_players')).toHaveValue('6');
await page.getByRole('button', { name: 'Cancel' }).click();

// AFTER:
await settingsPage.openEditModal();
await settingsPage.updateGenre(newGenre);
await settingsPage.updateMaxPlayers(6);
await settingsPage.saveChanges();
await settingsPage.openEditModal();
expect(await settingsPage.getGenre()).toBe(newGenre);
expect(await settingsPage.getMaxPlayers()).toBe('6');
await settingsPage.cancel();

// Test 3: Toggle anonymous
// BEFORE:
await page.getByRole('button', { name: 'Edit Game' }).click();
await waitForModal(page, 'Edit Game');
const anonymousCheckbox = page.locator('#is_anonymous');
const wasChecked = await anonymousCheckbox.isChecked();
await anonymousCheckbox.click();
await page.getByRole('button', { name: 'Save Changes' }).click();
await page.getByRole('button', { name: 'Edit Game' }).click();
const isNowChecked = await page.locator('#is_anonymous').isChecked();
expect(isNowChecked).toBe(!wasChecked);
await page.getByRole('button', { name: 'Cancel' }).click();

// AFTER:
await settingsPage.openEditModal();
const wasChecked = await settingsPage.isAnonymous();
await settingsPage.toggleAnonymous();
await settingsPage.saveChanges();
await settingsPage.openEditModal();
expect(await settingsPage.isAnonymous()).toBe(!wasChecked);
await settingsPage.cancel();
```

**Estimated cleanup**: ~20-25 lines of code reduction, improved readability

---

### Medium Priority (When Refactoring Those Test Files)

#### 3. Participant/People Management Tests
**Files to refactor when found**: Any tests dealing with participant lists
**POM to use**: ParticipantsPage (once created)

#### 4. character-avatar.spec.ts
**File**: `e2e/characters/character-avatar.spec.ts`
**POM to use**: AvatarManagementPage (once created)
**Current status**: Not yet refactored

---

## Implementation Checklist

### Phase 1: Complete POM Creation ✅ COMPLETE
- [x] CharacterSheetPage - Extended with modal methods
- [x] GameSettingsPage - Created
- [x] ParticipantsPage - Created
- [x] AvatarManagementPage - Created

### Phase 2: Refactor Tests to Use POMs (High Priority Complete)
- [x] Refactor character-sheet-management.spec.ts with CharacterSheetPage
- [x] Refactor gm-edits-game-settings.spec.ts with GameSettingsPage
- [ ] (Future) Refactor participant tests with ParticipantsPage (when tests are created)
- [ ] (Future) Refactor character-avatar.spec.ts with AvatarManagementPage (when needed)

### Phase 3: Documentation Updates ✅ COMPLETE
- [x] Update TEST_SELECTOR_IMPROVEMENT_PLAN.md with new POMs
- [x] Add POM usage examples to test documentation (E2E_QUICK_START.md)
- [x] Document POM naming conventions and patterns (e2e/pages/README.md)

---

## Best Practices Going Forward

### **RULE: Always Create POMs Before Writing Tests**

When creating a new test or refactoring an existing one:

1. **Identify the workflow** - What user actions does the test cover?
2. **Check for existing POM** - Does a POM already exist for this workflow?
3. **Create POM if missing** - Write the POM FIRST before the test
4. **Use POM methods in test** - Tests should read like user stories

### POM Naming Conventions

- **Page**: For full page navigation (e.g., GameDetailsPage)
- **WorkflowPage**: For multi-step workflows (e.g., CharacterWorkflowPage)
- **[Feature]Page**: For specific features (e.g., GameSettingsPage)

### POM Method Naming

- `goto()` - Navigate to the page/tab
- `get*()` - Retrieve data
- `has*()` - Boolean checks
- `can*()` - Permission checks
- `[action]*()` - Perform action (e.g., updateTitle, saveChanges)

### Test Structure with POMs

```typescript
test('description', async ({ page }) => {
  // Setup
  await loginAs(page, 'USER');
  const gameId = await getFixtureGameId(page, 'FIXTURE');

  // Initialize POMs
  const detailsPage = new GameDetailsPage(page);
  const settingsPage = new GameSettingsPage(page);

  // Navigate
  await detailsPage.goto(gameId);

  // Act using POM methods
  await settingsPage.openEditModal();
  await settingsPage.updateTitle('New Title');
  await settingsPage.saveChanges();

  // Assert using POM methods or page assertions
  await expect(page.getByRole('heading', { name: 'New Title' })).toBeVisible();
});
```

---

## Estimated Impact

### Code Reduction
- character-sheet-management.spec.ts: ~15-20 lines
- gm-edits-game-settings.spec.ts: ~20-25 lines
- **Total**: ~35-45 lines of brittle selectors eliminated

### Readability Improvement
- Tests become self-documenting
- Workflow steps clearly visible
- Easier to maintain when UI changes

### Reusability
- POMs can be reused across multiple test files
- Consistent patterns across all tests
- Easier onboarding for new test writers

---

## ✅ All Primary Work Complete

### Completed
1. ✅ Create GameSettingsPage - DONE
2. ✅ Extend CharacterSheetPage - DONE
3. ✅ Create ParticipantsPage - DONE
4. ✅ Create AvatarManagementPage - DONE
5. ✅ Refactor character-sheet-management.spec.ts - DONE
6. ✅ Refactor gm-edits-game-settings.spec.ts - DONE

### Future Tasks (Optional)
7. Update TEST_SELECTOR_IMPROVEMENT_PLAN.md with new POMs
8. Use ParticipantsPage in future participant listing tests
9. Use AvatarManagementPage when refactoring character-avatar.spec.ts

---

## Notes

- All POMs use stable selectors (getByRole, getByTestId)
- POMs handle waits internally (waitForLoadState, waitForModal)
- POMs return Promises for async operations
- POMs throw errors for missing elements (fail fast)
- Tests remain readable and maintainable

**This document should be updated as POMs are created and tests are refactored.**
