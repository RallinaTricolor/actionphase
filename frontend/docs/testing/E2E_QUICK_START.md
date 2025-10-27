# E2E Testing Quick Start

**Quick reference for running end-to-end tests in ActionPhase**

For the complete implementation plan and architecture details, see `.claude/planning/E2E_TESTING_PLAN.md`.

---

## Prerequisites

Before running E2E tests, ensure:

1. **Database is running**
   ```bash
   just db_up
   ```

2. **Test fixtures are loaded**
   ```bash
   just test-fixtures
   ```

3. **Backend server is running**
   ```bash
   just dev
   # Or in a separate terminal:
   cd backend && go run main.go
   ```

The **frontend dev server will be auto-started** by Playwright when you run E2E tests.

---

## Running E2E Tests

### Quick Commands

```bash
# Run all E2E tests (headless)
just e2e

# Run with UI (interactive mode) - RECOMMENDED for development
just e2e-ui

# Run with visible browser
just e2e-headed

# Debug tests (step-through mode)
just e2e-debug

# Show HTML test report
just e2e-report

# Run specific test file
just e2e-test e2e/auth/login.spec.ts
```

---

## Test Users

All test users have the password: **`testpassword123`**

| Role | Email | Purpose |
|------|-------|---------|
| GM | `test_gm@example.com` | Game master |
| Player 1-5 | `test_player1@example.com` | Players |
| Audience | `test_audience@example.com` | Audience member |

---

## Page Object Models (POMs)

**Rule: Always use Page Object Models when writing or refactoring tests.**

POMs encapsulate page interactions and provide stable, reusable methods for test automation.

### Available POMs

All POMs are located in `frontend/e2e/pages/`:

#### **CharacterSheetPage** - `CharacterSheetPage.ts`
Character sheet viewing and editing
- Module navigation: `goToBioModule()`, `goToAbilitiesModule()`, `goToInventoryModule()`
- Tab navigation: `goToAbilitiesTab()`, `goToSkillsTab()`, `goToCurrencyTab()`
- Workflows: `addAbility()`, `isModuleVisible()`
- Permissions: `canAddAbility()`, `canAddSkill()`, `canAddItem()`, `canAddCurrency()`

#### **GameSettingsPage** - `GameSettingsPage.ts`
Edit Game modal workflow
- Modal control: `openEditModal()`, `saveChanges()`, `cancel()`
- Updates: `updateTitle()`, `updateDescription()`, `updateGenre()`, `updateMaxPlayers()`
- Toggles: `toggleAnonymous()`, `isAnonymous()`

#### **ParticipantsPage** - `ParticipantsPage.ts`
Participant/people management
- Navigation: `goto()`, `goToParticipantsTab()`
- Lists: `getParticipantsList()`, `getParticipantsByRole()`, `getParticipantsCount()`
- Search: `searchParticipants()`, `hasParticipant()`, `getParticipantRole()`

#### **AvatarManagementPage** - `AvatarManagementPage.ts`
Avatar upload and management
- Upload: `uploadAvatar()`, `uploadAndSaveAvatar()`, `waitForPreview()`
- Actions: `saveAvatar()`, `cancelUpload()`, `deleteAvatar()`
- Checks: `hasPreview()`, `canUploadAvatar()`, `getUploadError()`

### Usage Example

```typescript
import { CharacterSheetPage } from '../pages/CharacterSheetPage';
import { GameSettingsPage } from '../pages/GameSettingsPage';

test('example test', async ({ page }) => {
  // Initialize POMs
  const sheetPage = new CharacterSheetPage(page);
  const settingsPage = new GameSettingsPage(page);

  // Use POM methods instead of inline selectors
  await sheetPage.goToAbilitiesModule();
  await sheetPage.goToAbilitiesTab(2);

  await settingsPage.openEditModal();
  await settingsPage.updateTitle('New Title');
  await settingsPage.saveChanges();
});
```

### POM-First Development

When writing new tests:
1. Check if a POM exists for the workflow
2. If not, create the POM first (in `e2e/pages/`)
3. Use POM methods in your test
4. Tests should read like user stories

**Benefits:**
- ✅ Stable, semantic selectors (`getByRole`, `getByTestId`)
- ✅ UI changes only require POM updates
- ✅ Tests are self-documenting
- ✅ Reusable across multiple test files

---

## Current Test Coverage

### ✅ Implemented

**Journey 1: User Authentication** (`e2e/auth/login.spec.ts`)
- Login and logout flows
- Invalid credentials handling
- Protected route redirects
- Auth persistence

---

## Resources

- **Implementation Plan**: `.claude/planning/E2E_TESTING_PLAN.md`
- **Playwright Docs**: https://playwright.dev/docs/intro
- **Test Helpers**: `frontend/e2e/fixtures/`
