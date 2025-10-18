import { test, expect } from '@playwright/test';
import { loginAs } from '../fixtures/auth-helpers';
import { getFixtureGameId } from '../fixtures/game-helpers';

/**
 * Journey 10: GM Ends Game
 *
 * Tests the complete game lifecycle - GM can end/complete a game.
 * Uses dedicated E2E fixtures for state-modifying tests.
 * This tests the game state transitions: in_progress -> completed, in_progress -> paused -> in_progress, recruitment -> cancelled.
 */
test.describe('GM Ends Game', () => {
  test('GM can complete an in_progress game', async ({ page }) => {
    // Login as GM
    await loginAs(page, 'GM');

    // Use dedicated E2E game for completion testing (safe to modify)
    const gameId = await getFixtureGameId(page, 'E2E_COMPLETE');
    await page.goto(`/games/${gameId}`);
    await page.waitForLoadState('networkidle');

    // Verify game is in "In Progress" state
    await expect(page.locator('span:has-text("In Progress")')).toBeVisible({ timeout: 5000 });

    // Verify GM sees game control buttons
    await expect(page.locator('button:has-text("Pause Game")')).toBeVisible();
    await expect(page.locator('button:has-text("Complete Game")')).toBeVisible();

    // Click "Complete Game" button
    await page.click('button:has-text("Complete Game")');
    await page.waitForTimeout(2000);

    // Verify game state changed to "Completed"
    await expect(page.locator('span:has-text("Completed")')).toBeVisible({ timeout: 5000 });

    // Verify state action buttons are no longer visible (completed games don't have state transitions)
    await expect(page.locator('button:has-text("Pause Game")')).not.toBeVisible();
    await expect(page.locator('button:has-text("Complete Game")')).not.toBeVisible();
  });

  test('GM can pause and resume a game before completing it', async ({ page }) => {
    // Login as GM
    await loginAs(page, 'GM');

    // Use dedicated E2E game for pause/resume testing (safe to modify)
    const gameId = await getFixtureGameId(page, 'E2E_PAUSE');
    await page.goto(`/games/${gameId}`);
    await page.waitForLoadState('networkidle');

    // Verify game is in "In Progress" state
    await expect(page.locator('span:has-text("In Progress")')).toBeVisible({ timeout: 5000 });

    // Click "Pause Game"
    await page.click('button:has-text("Pause Game")');
    await page.waitForTimeout(2000);

    // Verify game state changed to "Paused"
    await expect(page.locator('span:has-text("Paused")')).toBeVisible({ timeout: 5000 });

    // Verify "Resume Game" button is visible
    await expect(page.locator('button:has-text("Resume Game")')).toBeVisible();

    // Resume the game
    await page.click('button:has-text("Resume Game")');
    await page.waitForTimeout(2000);

    // Verify game is back to "In Progress"
    await expect(page.locator('span:has-text("In Progress")')).toBeVisible({ timeout: 5000 });
  });

  test('Completed game shows appropriate UI to players', async ({ page }) => {
    // Login as GM and complete a different game (not the one we just completed above)
    // We'll use a shared fixture game for this read-only test
    await loginAs(page, 'GM');
    const gameId = await getFixtureGameId(page, 'WESTMARCH');
    await page.goto(`/games/${gameId}`);
    await page.waitForLoadState('networkidle');

    // Check current state - complete if needed
    const currentState = await page.locator('span:has-text("In Progress"), span:has-text("Completed")').first().textContent();

    if (currentState?.includes('In Progress')) {
      // Complete the game
      await page.click('button:has-text("Complete Game")');
      await page.waitForTimeout(2000);
    }

    // Verify game is completed
    await expect(page.locator('span:has-text("Completed")')).toBeVisible({ timeout: 5000 });

    // Now login as a player and verify they see appropriate UI
    await loginAs(page, 'PLAYER_1');
    await page.goto(`/games/${gameId}`);
    await page.waitForLoadState('networkidle');

    // Player should see "Completed" status
    await expect(page.locator('span:has-text("Completed")')).toBeVisible({ timeout: 5000 });

    // Player should NOT see action buttons for ongoing gameplay
    await expect(page.locator('button:has-text("Apply to Join")')).not.toBeVisible();
    await expect(page.locator('button:has-text("Leave Game")')).not.toBeVisible();
  });

  test('GM can cancel a game during recruitment', async ({ page }) => {
    // Login as GM
    await loginAs(page, 'GM');

    // Use dedicated E2E game for cancellation testing (safe to modify)
    const gameId = await getFixtureGameId(page, 'E2E_CANCEL');
    await page.goto(`/games/${gameId}`);
    await page.waitForLoadState('networkidle');

    // Verify game is in "Recruiting Players" state
    await expect(page.locator('span:has-text("Recruiting Players")')).toBeVisible({ timeout: 5000 });

    // Verify GM sees "Cancel Game" button
    await expect(page.locator('button:has-text("Cancel Game")')).toBeVisible();

    // Click "Cancel Game"
    await page.click('button:has-text("Cancel Game")');
    await page.waitForTimeout(2000);

    // Verify game state changed to "Cancelled"
    await expect(page.locator('span:has-text("Cancelled")')).toBeVisible({ timeout: 5000 });

    // Verify no state transition buttons are visible
    await expect(page.locator('button:has-text("Start Recruitment")')).not.toBeVisible();
    await expect(page.locator('button:has-text("Cancel Game")')).not.toBeVisible();
  });
});
