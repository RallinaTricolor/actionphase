import { test, expect } from '@playwright/test';
import { loginAs } from '../fixtures/auth-helpers';
import { getFixtureGameId } from '../fixtures/game-helpers';

/**
 * Journey 6: GM Edits Game Settings
 *
 * Tests the GM's ability to edit game details after creation.
 * Uses test fixtures (Game #165: "The Heist at Goldstone Bank").
 * This journey tests the game update functionality.
 */
test.describe('GM Edits Game Settings', () => {
  test('GM can edit game title and description', async ({ page }) => {
    // Login as GM
    await loginAs(page, 'GM');

    // Use "The Heist at Goldstone Bank" from fixtures
    const gameId = await getFixtureGameId(page, 'HEIST');
    await page.goto(`/games/${gameId}`);
    await page.waitForLoadState('networkidle');

    // Click "Edit Game" button
    await page.click('button:has-text("Edit Game")');
    await page.waitForTimeout(500);

    // Verify modal is open
    await expect(page.locator('h2:has-text("Edit Game")')).toBeVisible();

    // Update game title and description
    const newTitle = `Updated Game Title ${Date.now()}`;
    const newDescription = `This is an updated description for testing purposes. ${Date.now()}`;

    await page.fill('#title', newTitle);
    await page.fill('#description', newDescription);

    // Click "Save Changes" button
    await page.click('button:has-text("Save Changes")');
    await page.waitForTimeout(2000);

    // Verify modal is closed and changes are visible
    await expect(page.locator('h2:has-text("Edit Game")')).not.toBeVisible();
    await expect(page.locator(`h1:has-text("${newTitle}")`)).toBeVisible();
  });

  test('GM can edit game settings (genre, max players)', async ({ page }) => {
    // Login as GM
    await loginAs(page, 'GM');

    // Use "The Heist at Goldstone Bank" from fixtures
    const gameId = await getFixtureGameId(page, 'HEIST');
    await page.goto(`/games/${gameId}`);
    await page.waitForLoadState('networkidle');

    // Click "Edit Game" button
    await page.click('button:has-text("Edit Game")');
    await page.waitForTimeout(500);

    // Update genre and max players
    const newGenre = `Fantasy ${Date.now()}`;
    await page.fill('#genre', newGenre);
    await page.fill('#maxPlayers', '6');

    // Click "Save Changes" button
    await page.click('button:has-text("Save Changes")');
    await page.waitForTimeout(2000);

    // Verify changes by opening edit modal again
    await page.click('button:has-text("Edit Game")');
    await page.waitForTimeout(500);

    // Verify genre and max players were saved
    await expect(page.locator('#genre')).toHaveValue(newGenre);
    await expect(page.locator('#maxPlayers')).toHaveValue('6');

    // Close modal
    await page.click('button:has-text("Cancel")');
  });

  test('GM can toggle anonymous mode', async ({ page }) => {
    // Login as GM
    await loginAs(page, 'GM');

    // Use "The Heist at Goldstone Bank" from fixtures
    const gameId = await getFixtureGameId(page, 'HEIST');
    await page.goto(`/games/${gameId}`);
    await page.waitForLoadState('networkidle');

    // Click "Edit Game" button
    await page.click('button:has-text("Edit Game")');
    await page.waitForTimeout(500);

    // Get current state of anonymous checkbox
    const anonymousCheckbox = page.locator('#isAnonymous');
    const wasChecked = await anonymousCheckbox.isChecked();

    // Toggle anonymous mode
    await anonymousCheckbox.click();
    await page.waitForTimeout(300);

    // Click "Save Changes" button
    await page.click('button:has-text("Save Changes")');
    await page.waitForTimeout(2000);

    // Verify change by opening edit modal again
    await page.click('button:has-text("Edit Game")');
    await page.waitForTimeout(500);

    // Verify checkbox state changed
    const isNowChecked = await page.locator('#isAnonymous').isChecked();
    expect(isNowChecked).toBe(!wasChecked);

    // Close modal
    await page.click('button:has-text("Cancel")');
  });
});
