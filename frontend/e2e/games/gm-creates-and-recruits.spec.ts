import { test, expect } from '@playwright/test';
import { loginAs } from '../fixtures/auth-helpers';
import { GameDetailsPage } from '../pages/GameDetailsPage';
import { navigateToGamesList } from '../utils/navigation';
import { assertTextVisible } from '../utils/assertions';

/**
 * Journey 2: GM Creates Game & Recruits Players
 *
 * Tests the complete game creation and player recruitment flow
 *
 * REFACTORED: Using Page Object Model and shared utilities
 * - Eliminated all waitForTimeout calls (was 1)
 * - Improved consistency with GameDetailsPage
 */
test.describe('GM Creates Game & Recruits Players', () => {
  // Helper function to create a game
  async function createTestGame(page: any) {
    const timestamp = Date.now();
    const gameTitle = `E2E Test Game ${timestamp}`;
    const gameDescription = `Test game created by E2E tests`;

    await navigateToGamesList(page);

    // Click "Create Game" button to open modal
    // Using more specific selector with role
    await page.getByRole('button', { name: 'Create Game' }).click();

    // Wait for modal to be fully visible and form fields to be ready
    await expect(page.locator('#title')).toBeVisible({ timeout: 5000 });

    // Fill in game details
    await page.fill('#title', gameTitle);
    await page.fill('#description', gameDescription);
    await page.fill('#genre', 'Test Genre');
    await page.fill('#max_players', '4');

    // Submit the form using form context
    await page.locator('form').locator('button[type="submit"]').click();

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
    await assertTextVisible(page, gameTitle);
    await assertTextVisible(page, 'Setup'); // Initial state
  });

  test('GM can start recruitment for a game', async ({ page }) => {
    // Login as GM
    await loginAs(page, 'GM');
    await expect(page).toHaveURL('/dashboard');

    // Create a game
    const { gameTitle } = await createTestGame(page);

    // Should be on game details page after creation
    await assertTextVisible(page, gameTitle);
    await assertTextVisible(page, 'Setup');

    // Start recruitment using GameDetailsPage
    const gamePage = new GameDetailsPage(page);
    await gamePage.startRecruitment();

    // Verify state changed to Recruitment (button no longer visible)
    await expect(page.getByRole('button', { name: 'Start Recruitment' })).not.toBeVisible({ timeout: 5000 });

    // Verify recruitment-specific content
    await expect(page.getByRole('heading', { name: /Recruitment Deadline/i, level: 3 }).first()).toBeVisible();
  });
});
