import { test, expect } from '@playwright/test';
import { loginAs } from '../fixtures/auth-helpers';
import { getFixtureGameId } from '../fixtures/game-helpers';
import { GameDetailsPage } from '../pages/GameDetailsPage';
import { assertTextVisible } from '../utils/assertions';

/**
 * Journey 9: Player Submits Action
 *
 * Tests the complete action submission flow during an active action phase.
 * Uses dedicated E2E fixture (E2E_ACTION) for state-modifying tests.
 * Player 4 has a draft action that can be updated and submitted.
 *
 * REFACTORED: Using Page Object Model and shared utilities
 * - Eliminated all waitForTimeout calls (was 8)
 * - Uses GameDetailsPage for navigation
 * - Uses assertion utilities for consistency
 */
test.describe('Action Submission Flow', () => {
  test('Player can submit a new action for active action phase', async ({ page }) => {
    // Login as Player 4 who has a draft action
    await loginAs(page, 'PLAYER_4');

    // Use dedicated E2E action submission game (safe to modify)
    const gameId = await getFixtureGameId(page, 'E2E_ACTION');

    const gamePage = new GameDetailsPage(page);
    await gamePage.goto(gameId);
    await gamePage.goToSubmitAction();

    // Verify Action Submission section is visible
    await assertTextVisible(page, 'Action Submission');

    // Player 4 has a draft action - verify it's displayed
    await assertTextVisible(page, 'Your Current Action');
    await assertTextVisible(page, 'This is a draft action that needs to be completed');

    // Click "Edit" to modify the draft action
    await page.click('button:has-text("Edit")');
    await page.waitForLoadState('networkidle');

    // Update the action content
    const newActionContent = `I will execute my plan with precision and care. This is my updated action for testing. ${Date.now()}`;

    // Clear existing content and fill in new action
    await page.fill('textarea[placeholder*="Describe what your character does"]', newActionContent);

    // Submit the updated action
    await page.click('button:has-text("Update Action")');
    await page.waitForLoadState('networkidle');

    // Verify the action was submitted successfully
    await assertTextVisible(page, 'Your Current Action');

    // Verify the new content is displayed
    await assertTextVisible(page, 'I will execute my plan');
    await expect(page.locator('text=Acting as:').locator('..').locator('span:has-text("E2E Test Char 4")')).toBeVisible();
  });

  test('Player can view their submitted action', async ({ page }) => {
    // Login as Player 1 who has a submitted action
    await loginAs(page, 'PLAYER_1');

    // Use dedicated E2E action submission game
    const gameId = await getFixtureGameId(page, 'E2E_ACTION');

    const gamePage = new GameDetailsPage(page);
    await gamePage.goto(gameId);
    await gamePage.goToSubmitAction();

    // Verify their submitted action is visible
    await assertTextVisible(page, 'Your Current Action');
    await assertTextVisible(page, 'This is my existing action');
    await expect(page.locator('text=Acting as:').locator('..').locator('span:has-text("E2E Test Char 1")')).toBeVisible();

    // Verify "Edit" button is available since phase is still active
    await expect(page.locator('button:has-text("Edit")')).toBeVisible();
  });

  test('GM can view all submitted actions for active phase', async ({ page }) => {
    // Login as GM
    await loginAs(page, 'GM');

    // Use dedicated E2E action submission game
    const gameId = await getFixtureGameId(page, 'E2E_ACTION');

    const gamePage = new GameDetailsPage(page);
    await gamePage.goto(gameId);
    await gamePage.goToActions();

    // Verify GM can see actions section
    await assertTextVisible(page, 'Actions');

    // GM should see submitted action from Player 1
    await expect(page.locator('text=E2E Test Char 1')).toBeVisible({ timeout: 5000 });

    // Click to expand the action card to see content
    await page.click('button:has-text("TestPlayer1")');
    await page.waitForLoadState('networkidle');

    // Verify action content is visible to GM
    await assertTextVisible(page, 'This is my existing action for testing purposes');
  });

  test('Player cannot submit action when no action phase is active', async ({ page }) => {
    // Login as Player 1
    await loginAs(page, 'PLAYER_1');

    // Use Common Room Misc game (has common_room phase active, NOT action phase)
    const gameId = await getFixtureGameId(page, 'COMMON_ROOM_MISC');

    const gamePage = new GameDetailsPage(page);
    await gamePage.goto(gameId);

    // Try to navigate to Submit Action tab - it should not be visible
    // because there's no active action phase
    const submitActionTab = page.locator('button:has-text("Submit Action")');
    await expect(submitActionTab).not.toBeVisible();
  });
});
