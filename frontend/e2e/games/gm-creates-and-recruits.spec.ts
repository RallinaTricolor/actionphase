import { test, expect } from '@playwright/test';
import { loginAs } from '../fixtures/auth-helpers';

/**
 * Journey 2: GM Creates Game & Recruits Players
 *
 * Tests the complete game creation and player recruitment flow
 */
test.describe('GM Creates Game & Recruits Players', () => {
  // Helper function to create a game
  async function createTestGame(page: any) {
    const timestamp = Date.now();
    const gameTitle = `E2E Test Game ${timestamp}`;
    const gameDescription = `Test game created by E2E tests`;

    await page.click('a[href="/games"]');
    await expect(page).toHaveURL('/games');

    // Click "Create Game" button to open modal
    await page.click('button:has-text("Create Game")');

    // Wait for modal to be fully visible and form fields to be ready
    await expect(page.locator('#title')).toBeVisible({ timeout: 5000 });
    await page.waitForTimeout(500); // Wait for modal animation to complete

    // Fill in game details
    await page.fill('#title', gameTitle);
    await page.fill('#description', gameDescription);
    await page.fill('#genre', 'Test Genre');
    await page.fill('#max_players', '4');

    // Submit the form using more specific selector (submit button inside form)
    await page.click('form button[type="submit"]:has-text("Create Game")');

    // Wait for redirect to game details page
    await page.waitForURL(/\/games\/\d+/, { timeout: 10000 });

    return { gameTitle, gameDescription };
  }

  test('GM can create a game', async ({ page }) => {
    // Login as GM
    await loginAs(page, 'GM');
    await expect(page).toHaveURL('/dashboard');

    // Create a game
    const { gameTitle } = await createTestGame(page);

    // Verify we're on game details page with the correct title
    await expect(page.locator(`h1:has-text("${gameTitle}")`)).toBeVisible();
    await expect(page.locator('text=Setup')).toBeVisible(); // Initial state
  });

  test('GM can start recruitment for a game', async ({ page }) => {
    // Login as GM
    await loginAs(page, 'GM');
    await expect(page).toHaveURL('/dashboard');

    // Create a game (each test needs its own game due to test isolation)
    const { gameTitle } = await createTestGame(page);

    // Should be on game details page after creation
    await expect(page.locator(`h1:has-text("${gameTitle}")`)).toBeVisible();
    await expect(page.locator('text=Setup')).toBeVisible();

    // Click "Start Recruitment"
    await page.click('button:has-text("Start Recruitment")');

    // Verify state changed to Recruitment - the button should no longer be visible/enabled
    // and we should see recruiting-specific UI
    await expect(page.locator('button:has-text("Start Recruitment")')).not.toBeVisible({ timeout: 5000 });

    // Verify we see recruitment-specific content (like the recruitment deadline section)
    await expect(page.locator('h3:has-text("Recruitment Deadline")').first()).toBeVisible();
  });
});
