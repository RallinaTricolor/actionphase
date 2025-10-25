import { test, expect } from '@playwright/test';
import { loginAs } from '../fixtures/auth-helpers';
import { getFixtureGameId } from '../fixtures/game-helpers';
import { navigateToGame } from '../utils/navigation';
import { assertTextVisible } from '../utils/assertions';

/**
 * Journey 10: GM Ends Game
 *
 * Tests the complete game lifecycle - GM can end/complete a game.
 * Uses dedicated E2E fixtures for state-modifying tests.
 * This tests the game state transitions: in_progress -> completed, in_progress -> paused -> in_progress, recruitment -> cancelled.
 *
 * REFACTORED: Using Page Object Model and shared utilities
 * - Eliminated all waitForTimeout calls (was 5)
 * - Uses navigateToGame for consistent navigation
 * - Uses assertion utilities for consistency
 */
test.describe('GM Ends Game', () => {
  test('GM can complete an in_progress game', async ({ page }) => {
    // Login as GM
    await loginAs(page, 'GM');

    // Use dedicated E2E game for completion testing (safe to modify)
    const gameId = await getFixtureGameId(page, 'E2E_COMPLETE');
    await navigateToGame(page, gameId);

    // Verify game is in "In Progress" state
    await assertTextVisible(page, 'In Progress');

    // Verify GM sees game control buttons
    await expect(page.locator('button:has-text("Pause Game")')).toBeVisible();
    await expect(page.locator('button:has-text("Complete Game")')).toBeVisible();

    // Click "Complete Game" button
    await page.click('button:has-text("Complete Game")');

    // Handle confirmation modal - type "completed" to confirm
    await page.waitForSelector('input[type="text"]', { timeout: 5000 });
    await page.fill('input[type="text"]', 'completed');

    // Click the confirm button in the modal (use .last() to get the modal button)
    await page.locator('button:has-text("Complete Game")').last().click();
    await page.waitForLoadState('networkidle');

    // Verify game state changed to "Completed"
    await assertTextVisible(page, 'Completed');

    // Verify state action buttons are no longer visible (completed games don't have state transitions)
    await expect(page.locator('button:has-text("Pause Game")')).not.toBeVisible();
    await expect(page.locator('button:has-text("Complete Game")')).not.toBeVisible();
  });

  test('GM can pause and resume a game before completing it', async ({ page }) => {
    // Login as GM
    await loginAs(page, 'GM');

    // Use dedicated E2E game for pause/resume testing (safe to modify)
    const gameId = await getFixtureGameId(page, 'E2E_PAUSE');
    await navigateToGame(page, gameId);

    // Verify game is in "In Progress" state
    await assertTextVisible(page, 'In Progress');

    // Click "Pause Game" button
    await page.click('button:has-text("Pause Game")');

    // Handle confirmation modal - click confirm button
    await page.waitForSelector('button:has-text("Pause Game")', { timeout: 5000 });
    // Click the confirm button in the modal (there will be two "Pause Game" buttons now)
    await page.locator('button:has-text("Pause Game")').last().click();
    await page.waitForLoadState('networkidle');

    // Verify game state changed to "Paused"
    await assertTextVisible(page, 'Paused');

    // Verify "Resume Game" button is visible
    await expect(page.locator('button:has-text("Resume Game")')).toBeVisible();

    // Resume the game
    await page.click('button:has-text("Resume Game")');
    await page.waitForLoadState('networkidle');

    // Verify game is back to "In Progress"
    await assertTextVisible(page, 'In Progress');
  });

  test('Completed game shows appropriate UI to players', async ({ page }) => {
    // Login as GM and use dedicated E2E game for completion testing
    await loginAs(page, 'GM');
    const gameId = await getFixtureGameId(page, 'E2E_COMPLETE');
    await navigateToGame(page, gameId);

    // Check current state - complete if needed
    const currentState = await page.locator('span:has-text("In Progress"), span:has-text("Completed")').first().textContent();

    if (currentState?.includes('In Progress')) {
      // Complete the game
      await page.click('button:has-text("Complete Game")');

      // Handle confirmation modal - type "completed" to confirm
      await page.waitForSelector('input[type="text"]', { timeout: 5000 });
      await page.fill('input[type="text"]', 'completed');

      // Click the confirm button in the modal (use .last() to get the modal button)
      await page.locator('button:has-text("Complete Game")').last().click();
      await page.waitForLoadState('networkidle');
    }

    // Verify game is completed
    await assertTextVisible(page, 'Completed');

    // Now login as a player and verify they see appropriate UI
    await loginAs(page, 'PLAYER_1');
    await navigateToGame(page, gameId);

    // Player should see "Completed" status
    await assertTextVisible(page, 'Completed');

    // Player should NOT see action buttons for ongoing gameplay
    await expect(page.locator('button:has-text("Apply to Join")')).not.toBeVisible();
    await expect(page.locator('button:has-text("Leave Game")')).not.toBeVisible();
  });

  test('GM can cancel a game during recruitment', async ({ page }) => {
    // Login as GM
    await loginAs(page, 'GM');

    // Use dedicated E2E game for cancellation testing (safe to modify)
    const gameId = await getFixtureGameId(page, 'E2E_CANCEL');
    await navigateToGame(page, gameId);

    // Verify game is in "Recruiting Players" state
    await assertTextVisible(page, 'Recruiting Players');

    // Verify GM sees "Cancel Game" button
    await expect(page.locator('button:has-text("Cancel Game")')).toBeVisible();

    // Click "Cancel Game"
    await page.click('button:has-text("Cancel Game")');
    await page.waitForLoadState('networkidle');

    // Verify game state changed to "Cancelled"
    await assertTextVisible(page, 'Cancelled');

    // Verify no state transition buttons are visible
    await expect(page.locator('button:has-text("Start Recruitment")')).not.toBeVisible();
    await expect(page.locator('button:has-text("Cancel Game")')).not.toBeVisible();
  });
});
