import { test, expect } from '@playwright/test';
import { loginAs } from '../fixtures/auth-helpers';
import { getFixtureGameId } from '../fixtures/game-helpers';
import { GameDetailsPage } from '../pages/GameDetailsPage';
import { assertTextVisible } from '../utils/assertions';

/**
 * Journey 7: Player Views Phase History
 *
 * Tests that players can view phase history and navigate through past phases.
 * Uses E2E fixture game "E2E Test: Action Submission" with Phase 1 (common_room) and Phase 2 (action).
 *
 * REFACTORED: Using Page Object Model and shared utilities
 * - Eliminated all waitForTimeout calls (was 5)
 * - Improved navigation with GameDetailsPage
 */
test.describe('Player Views Phase History', () => {
  test('Player can view phase history list', async ({ page }) => {
    // Login as Player 1
    await loginAs(page, 'PLAYER_1');

    // Use E2E Action Submission game which has phase history
    const gameId = await getFixtureGameId(page, 'E2E_ACTION');

    const gamePage = new GameDetailsPage(page);
    await gamePage.goto(gameId);

    // Navigate to Phase History tab
    await gamePage.goToPhaseHistory();

    // Verify phase history heading is visible
    await assertTextVisible(page, 'Phase History');

    // Verify both phases are visible in the list
    await expect(page.locator('span:has-text("Phase 1")').first()).toBeVisible({ timeout: 5000 });
    await expect(page.locator('span:has-text("Phase 2")').first()).toBeVisible();

    // Verify phase titles from E2E fixtures are displayed
    await expect(page.locator('h4:has-text("Discussion Phase")')).toBeVisible(); // Phase 1 (common_room)
    await expect(page.locator('h4:has-text("Action Phase")')).toBeVisible(); // Phase 2 (active action)

    // Verify active phase is marked as "Active"
    await expect(page.locator('span:has-text("Active")')).toBeVisible();
  });

  test('Player can view details of a common_room phase', async ({ page }) => {
    // Login as Player 1
    await loginAs(page, 'PLAYER_1');

    // Use E2E Action Submission game
    const gameId = await getFixtureGameId(page, 'E2E_ACTION');

    const gamePage = new GameDetailsPage(page);
    await gamePage.goto(gameId);

    // Navigate to Phase History tab
    await gamePage.goToPhaseHistory();

    // Click on Phase 1 (common_room phase)
    await page.locator('button:has-text("Discussion Phase")').click();
    await page.waitForLoadState('networkidle');

    // Verify we're now viewing the phase details
    await expect(page.locator('button:has-text("Back to Phase History")')).toBeVisible({ timeout: 5000 });

    // Verify Common Room content is visible
    await assertTextVisible(page, 'Common Room');
    await assertTextVisible(page, 'Discussion Phase');
  });

  test('Player can navigate back from phase details', async ({ page }) => {
    // Login as Player 1
    await loginAs(page, 'PLAYER_1');

    // Use "The Heist at Goldstone Bank" from fixtures
    const gameId = await getFixtureGameId(page, 'E2E_ACTION');

    const gamePage = new GameDetailsPage(page);
    await gamePage.goto(gameId);

    // Navigate to Phase History tab
    await gamePage.goToPhaseHistory();

    // Click on Phase 1 (common_room phase)
    await page.locator('button:has-text("Discussion Phase")').click();
    await page.waitForLoadState('networkidle');

    // Verify we're viewing phase details
    await expect(page.locator('button:has-text("Back to Phase History")')).toBeVisible({ timeout: 5000 });

    // Click back button
    await page.click('button:has-text("Back to Phase History")');
    await page.waitForLoadState('networkidle');

    // Verify we're back at the phase list
    await assertTextVisible(page, 'Phase History');
    await expect(page.locator('span:has-text("Phase 1")').first()).toBeVisible();
  });
});
