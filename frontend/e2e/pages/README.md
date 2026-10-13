# Page Object Models (POMs)

This directory contains Page Object Models for E2E testing with Playwright.

## What are POMs?

Page Object Models (POMs) encapsulate page interactions into reusable, maintainable classes. They provide stable, semantic methods that make tests more readable and resilient to UI changes.

## POM-First Development Rule

**Always create or use POMs when writing tests. Never use inline selectors directly in tests.**

### Why?
- ✅ **Stable**: Uses semantic selectors (`getByRole`, `getByTestId`) instead of brittle class names
- ✅ **Maintainable**: UI changes only require updating the POM, not every test
- ✅ **Readable**: Tests read like user stories, not technical implementation
- ✅ **Reusable**: Share methods across multiple test files

## Available POMs

There are **20** page objects. Each documents its methods in JSDoc in the
file itself — read the source rather than a copy here, which drifts. (This file
used to document methods per POM; by 2026-10 many of those methods, and five of
the documented classes, no longer existed.)

Add a method when a spec needs it, not in anticipation. A helper nothing calls
is never run, so it silently goes stale: an audit in 2026-10 removed ~170 such
methods, including one for an "End Game" action the app does not have.

| File | Purpose |
|---|---|
| `ActionResultsPage.ts` | Page Object for Action Results (History) |
| `ActionSubmissionPage.ts` | Page Object for Action Submission |
| `AdminCommunitiesPage.ts` | Page Object for the Communities tab of the site-admin panel (/admin/communities). |
| `AudiencePage.ts` | Page Object Model for Audience Tab |
| `CharacterSheetPage.ts` | Page Object for Character Sheet interactions |
| `CharacterWorkflowPage.ts` | Page Object for Character Workflow |
| `CommonRoomPage.ts` | Page Object Model for Common Room interactions |
| `CommunityPage.ts` | Page Object for a community's public page and its management shell. |
| `DashboardPage.ts` | Page Object for the Dashboard (incl. the unread Inbox) |
| `GameApplicationsPage.ts` | Page Object for Game Applications |
| `GameDetailsPage.ts` | Page Object Model for Game Details Page |
| `GameHandoutsPage.ts` | Page Object for Game Handouts |
| `GameSettingsPage.ts` | Page Object for Game Settings Modal |
| `GamesListPage.ts` | Page Object for the Games list and game creation |
| `HistoryPage.ts` | Page Object Model for History Page |
| `LoginPage.ts` | Page Object for User Login |
| `MessagingPage.ts` | Page Object Model for Private Messaging |
| `PhaseManagementPage.ts` | Page Object Model for Phase Management |
| `PollsPage.ts` | Page Object for Common Room Polls |
| `SettingsPage.ts` | Page Object Model for the Settings page |

## Creating New POMs

When you need to create a new POM:

### 1. Identify the Workflow
What user actions does the test cover? Group related actions together.

### 2. Create the POM Class
```typescript
import { Page } from '@playwright/test';

export class MyFeaturePage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto('/my-feature');
    await this.page.waitForLoadState('networkidle');
  }

  // Add your methods here
}
```

### 3. Use Stable Selectors
**Prefer** (in order):
1. `getByRole('button', { name: 'Submit' })`
2. `getByTestId('submit-button')`
3. `getByText('exact text')`
4. `getByPlaceholder('Search...')`

**Avoid**:
- ❌ `locator('.btn-primary')` - class names change
- ❌ `locator('button:has-text("Submit")')` - brittle
- ❌ `locator('xpath=//...')` - very brittle

### 4. Method Naming Conventions
- `goto()` - Navigate to page/tab
- `get*()` - Retrieve data (returns value)
- `has*()` - Boolean checks (returns boolean)
- `can*()` - Permission checks (returns boolean)
- `[action]*()` - Perform action (e.g., `updateTitle()`, `saveChanges()`)

### 5. Handle Waits Internally
```typescript
async saveChanges() {
  await this.page.getByRole('button', { name: 'Save' }).click();
  await this.page.waitForLoadState('networkidle');
}
```

### 6. Return Promises
All async methods should return Promises. Use appropriate return types.

## Testing Best Practices

### ✅ Good Test Structure
```typescript
test('user can edit game settings', async ({ page }) => {
  // Setup
  await loginAs(page, 'GM');
  const gameId = await getFixtureGameId(page, 'TEST_GAME');

  // Initialize POMs
  const gamePage = new GameDetailsPage(page);
  const settingsPage = new GameSettingsPage(page);

  // Navigate
  await gamePage.goto(gameId);

  // Act using POM methods
  await settingsPage.openEditModal();
  await settingsPage.updateTitle('New Title');
  await settingsPage.saveChanges();

  // Assert
  await expect(page.getByRole('heading', { name: 'New Title' })).toBeVisible();
});
```

### ❌ Avoid Inline Selectors
```typescript
// DON'T DO THIS:
await page.click('button:has-text("Edit Game")');
await page.fill('#title', 'New Title');
await page.click('button:has-text("Save")');

// DO THIS:
await settingsPage.openEditModal();
await settingsPage.updateTitle('New Title');
await settingsPage.saveChanges();
```

## Documentation

For more information:
- **E2E Quick Start**: `/docs-site/developer/testing/E2E_QUICK_START.md`
- **E2E Guide**: `/frontend/e2e/README.md`
- **Playwright Docs**: https://playwright.dev/docs/pom

---

**Remember**: Always use POMs. Tests should read like user stories, not technical implementations!
