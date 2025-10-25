import { test, expect } from '@playwright/test';
import { loginAs } from '../fixtures/auth-helpers';
import { getFixtureGameId } from '../fixtures/game-helpers';
import { GameDetailsPage } from '../pages/GameDetailsPage';
import { waitForModal } from '../utils/waits';

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
 * - Uses dedicated E2E_ACTION game (safe to modify)
 *
 * NOTE: Tests run serially to prevent race conditions when modifying the same game
 */
test.describe.serial('GM Edits Game Settings', () => {
  let gameId: number;

  test.beforeAll(async ({ browser }) => {
    // Look up game ID once before all tests
    const page = await browser.newPage();
    await loginAs(page, 'GM');
    gameId = await getFixtureGameId(page, 'E2E_ACTION');
    await page.close();
  });

  test('GM can edit game title and description', async ({ page }) => {
    // Login as GM
    await loginAs(page, 'GM');

    const gamePage = new GameDetailsPage(page);
    await gamePage.goto(gameId);

    // Click "Edit Game" button
    await page.click('button:has-text("Edit Game")');
    await waitForModal(page, 'Edit Game');

    // Update game title and description
    const newTitle = `Updated Game Title ${Date.now()}`;
    const newDescription = `This is an updated description for testing purposes. ${Date.now()}`;

    await page.fill('#title', newTitle);
    await page.fill('#description', newDescription);

    // Click "Save Changes" button
    await page.click('button:has-text("Save Changes")');
    await page.waitForLoadState('networkidle');

    // Verify modal is closed and changes are visible
    await expect(page.locator('h2:has-text("Edit Game")')).not.toBeVisible();
    await expect(page.locator(`h1:has-text("${newTitle}")`)).toBeVisible();
  });

  test('GM can edit game settings (genre, max players)', async ({ page }) => {
    // Login as GM
    await loginAs(page, 'GM');

    const gamePage = new GameDetailsPage(page);
    await gamePage.goto(gameId);

    // Click "Edit Game" button
    await page.click('button:has-text("Edit Game")');
    await waitForModal(page, 'Edit Game');

    // Update genre and max players
    const newGenre = `Fantasy ${Date.now()}`;
    await page.fill('#genre', newGenre);
    await page.fill('#max_players', '6');

    // Click "Save Changes" button
    await page.click('button:has-text("Save Changes")');
    await page.waitForLoadState('networkidle');

    // Verify changes by opening edit modal again
    await page.click('button:has-text("Edit Game")');
    await waitForModal(page, 'Edit Game');

    // Verify genre and max players were saved
    await expect(page.locator('#genre')).toHaveValue(newGenre);
    await expect(page.locator('#max_players')).toHaveValue('6');

    // Close modal
    await page.click('button:has-text("Cancel")');
    await page.waitForLoadState('networkidle');
  });

  test('GM can toggle anonymous mode', async ({ page }) => {
    // Login as GM
    await loginAs(page, 'GM');

    const gamePage = new GameDetailsPage(page);
    await gamePage.goto(gameId);

    // Click "Edit Game" button
    await page.click('button:has-text("Edit Game")');
    await waitForModal(page, 'Edit Game');

    // Get current state of anonymous checkbox
    const anonymousCheckbox = page.locator('#is_anonymous');
    const wasChecked = await anonymousCheckbox.isChecked();

    // Toggle anonymous mode
    await anonymousCheckbox.click();

    // Click "Save Changes" button
    await page.click('button:has-text("Save Changes")');
    await page.waitForLoadState('networkidle');

    // Verify change by opening edit modal again
    await page.click('button:has-text("Edit Game")');
    await waitForModal(page, 'Edit Game');

    // Verify checkbox state changed
    const isNowChecked = await page.locator('#is_anonymous').isChecked();
    expect(isNowChecked).toBe(!wasChecked);

    // Close modal
    await page.click('button:has-text("Cancel")');
    await page.waitForLoadState('networkidle');
  });
});
