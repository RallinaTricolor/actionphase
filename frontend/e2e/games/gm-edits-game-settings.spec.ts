import { test, expect } from '@playwright/test';
import { loginAs } from '../fixtures/auth-helpers';
import { getFixtureGameId } from '../fixtures/game-helpers';
import { GameDetailsPage } from '../pages/GameDetailsPage';
import { GameSettingsPage } from '../pages/GameSettingsPage';

/**
 * Journey 6: GM Edits Game Settings
 *
 * Tests the GM's ability to edit game details after creation.
 * Uses dedicated E2E test game for state-modifying operations.
 * This journey tests the game update functionality.
 *
 * REFACTORED: Using Page Object Model and shared utilities
 * - Eliminated all waitForTimeout calls (was 9)
 * - Uses GameDetailsPage for navigation
 * - Uses smart waits for modals
 * - Uses dedicated E2E_GAME_SETTINGS game (safe to modify)
 *
 * NOTE: Tests run serially to prevent race conditions when modifying the same game
 */
test.describe.serial('GM Edits Game Settings', () => {
  let gameId: number;

  test.beforeAll(async ({ browser }) => {
    // Look up game ID once before all tests
    const page = await browser.newPage();
    await loginAs(page, 'GM');
    gameId = await getFixtureGameId(page, 'E2E_GAME_SETTINGS');
    await page.close();
  });

  test('Player cannot edit game settings', async ({ page }) => {
    await loginAs(page, 'PLAYER_1');

    const gamePage = new GameDetailsPage(page);
    await gamePage.goto(gameId);

    // Players should not see the edit game settings button/kebab menu
    await expect(page.getByLabel('Game actions')).not.toBeVisible({ timeout: 10000 });
  });

  test('GM can edit game title and description', async ({ page }) => {
    // Login as GM
    await loginAs(page, 'GM');

    const gamePage = new GameDetailsPage(page);
    await gamePage.goto(gameId);

    const settingsPage = new GameSettingsPage(page);

    // Update game title and description
    const newTitle = `Updated Game Title ${Date.now()}`;
    const newDescription = `This is an updated description for testing purposes. ${Date.now()}`;

    await settingsPage.openEditModal();
    await settingsPage.updateTitle(newTitle);
    await settingsPage.updateDescription(newDescription);
    await settingsPage.saveChanges();

    // Verify modal is closed and changes are visible
    await expect(page.getByRole('heading', { name: 'Edit Game', level: 2 })).not.toBeVisible();
    await expect(page.getByRole('heading', { name: newTitle, level: 1 })).toBeVisible();
  });

  test('GM can edit game settings (genre, max players)', async ({ page }) => {
    // Login as GM
    await loginAs(page, 'GM');

    const gamePage = new GameDetailsPage(page);
    await gamePage.goto(gameId);

    const settingsPage = new GameSettingsPage(page);

    // Update genre and max players
    const newGenre = `Fantasy ${Date.now()}`;
    await settingsPage.openEditModal();
    await settingsPage.updateGenre(newGenre);
    await settingsPage.updateMaxPlayers(6);
    await settingsPage.saveChanges();

    // Verify changes by opening edit modal again
    await settingsPage.openEditModal();
    expect(await settingsPage.getGenre()).toBe(newGenre);
    expect(await settingsPage.getMaxPlayers()).toBe('6');
    await settingsPage.cancel();
  });

  test('GM can toggle anonymous mode', async ({ page }) => {
    // Login as GM
    await loginAs(page, 'GM');

    const gamePage = new GameDetailsPage(page);
    await gamePage.goto(gameId);

    const settingsPage = new GameSettingsPage(page);

    // Get current state and toggle
    await settingsPage.openEditModal();
    const wasChecked = await settingsPage.isAnonymous();
    await settingsPage.toggleAnonymous();
    await settingsPage.saveChanges();

    // Verify change by opening edit modal again
    await settingsPage.openEditModal();
    expect(await settingsPage.isAnonymous()).toBe(!wasChecked);
    await settingsPage.cancel();
  });

  test('GM can toggle auto accept audience', async ({ page }) => {
    // Login as GM
    await loginAs(page, 'GM');

    const gamePage = new GameDetailsPage(page);
    await gamePage.goto(gameId);

    const settingsPage = new GameSettingsPage(page);

    // Get current state and toggle
    await settingsPage.openEditModal();
    const wasChecked = await settingsPage.isAutoAcceptAudience();
    await settingsPage.toggleAutoAcceptAudience();
    await settingsPage.saveChanges();

    // Verify change by opening edit modal again
    await settingsPage.openEditModal();
    expect(await settingsPage.isAutoAcceptAudience()).toBe(!wasChecked);
    await settingsPage.cancel();
  });

  test('GM can edit game dates', async ({ page }) => {
    // Login as GM
    await loginAs(page, 'GM');

    const gamePage = new GameDetailsPage(page);
    await gamePage.goto(gameId);

    const settingsPage = new GameSettingsPage(page);

    // Update all date fields
    // Using datetime-local format: YYYY-MM-DDTHH:mm
    // NOTE: Times must be on 15-minute intervals (datepicker uses 15-minute intervals)
    const recruitmentDeadline = '2026-12-01T15:45';
    const startDate = '2026-12-05T10:00';
    const endDate = '2026-12-20T18:00';

    await settingsPage.openEditModal();
    await settingsPage.updateRecruitmentDeadline(recruitmentDeadline);
    await settingsPage.updateStartDate(startDate);
    await settingsPage.updateEndDate(endDate);
    await settingsPage.saveChanges();

    // Verify changes by opening edit modal again
    // NOTE: DateTimeInput displays formatted dates, not datetime-local format
    // Format is "MMMM d, yyyy h:mm aa" (e.g., "December 1, 2026 3:45 PM")
    await settingsPage.openEditModal();
    const recruitmentValue = await settingsPage.getRecruitmentDeadline();
    const startValue = await settingsPage.getStartDate();
    const endValue = await settingsPage.getEndDate();

    // Verify dates were set (just check they contain the month/day we set)
    expect(recruitmentValue).toContain('December 1, 2026');
    expect(startValue).toContain('December 5, 2026');
    expect(endValue).toContain('December 20, 2026');

    await settingsPage.cancel();
  });
});
