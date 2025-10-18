import { test, expect } from '@playwright/test';
import { loginAs } from '../fixtures/auth-helpers';
import { getFixtureGameId } from '../fixtures/game-helpers';

/**
 * Journey 7: Player Views Phase History
 *
 * Tests that players can view phase history and navigate through past phases.
 * Uses test fixtures (Game #242: "The Heist at Goldstone Bank") with Phase 1 (common_room) and Phase 2 (action).
 */
test.describe('Player Views Phase History', () => {
  test('Player can view phase history list', async ({ page }) => {
    // Login as Player 1
    await loginAs(page, 'PLAYER_1');

    // Use "The Heist at Goldstone Bank" from fixtures
    // Phase 1: "Casing the Bank" (common_room, completed)
    // Phase 2: "Execute the Plan" (action, active)
    const gameId = await getFixtureGameId(page, 'HEIST');
    await page.goto(`/games/${gameId}`);
    await page.waitForLoadState('networkidle');

    // Navigate to Phase History tab
    await page.click('button:has-text("Phase History")');
    await page.waitForTimeout(1000);

    // Verify phase history heading is visible
    await expect(page.locator('h2:has-text("Phase History")')).toBeVisible({ timeout: 5000 });

    // Verify both phases are visible in the list
    await expect(page.locator('span:has-text("Phase 1")').first()).toBeVisible({ timeout: 5000 });
    await expect(page.locator('span:has-text("Phase 2")').first()).toBeVisible();

    // Verify phase titles from fixtures are displayed
    await expect(page.locator('h4:has-text("Casing the Bank")')).toBeVisible(); // Phase 1
    await expect(page.locator('h4:has-text("Execute the Plan")')).toBeVisible(); // Phase 2 (active)

    // Verify active phase is marked as "Active"
    await expect(page.locator('span:has-text("Active")')).toBeVisible();
  });

  test('Player can view details of a common_room phase', async ({ page }) => {
    // Login as Player 1
    await loginAs(page, 'PLAYER_1');

    // Use "The Heist at Goldstone Bank" from fixtures
    const gameId = await getFixtureGameId(page, 'HEIST');
    await page.goto(`/games/${gameId}`);
    await page.waitForLoadState('networkidle');

    // Navigate to Phase History tab
    await page.click('button:has-text("Phase History")');
    await page.waitForTimeout(1000);

    // Click on Phase 1 (common_room phase) - it shows "Casing the Bank" title
    await page.locator('button:has-text("Casing the Bank")').click();
    await page.waitForTimeout(1000);

    // Verify we're now viewing the phase details
    await expect(page.locator('button:has-text("Back to Phase History")')).toBeVisible({ timeout: 5000 });

    // Verify Common Room content is visible (should show the phase title in the heading)
    await expect(page.locator('h2:has-text("Common Room")')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=Casing the Bank')).toBeVisible();
  });

  test('Player can navigate back from phase details', async ({ page }) => {
    // Login as Player 1
    await loginAs(page, 'PLAYER_1');

    // Use "The Heist at Goldstone Bank" from fixtures
    const gameId = await getFixtureGameId(page, 'HEIST');
    await page.goto(`/games/${gameId}`);
    await page.waitForLoadState('networkidle');

    // Navigate to Phase History tab
    await page.click('button:has-text("Phase History")');
    await page.waitForTimeout(1000);

    // Click on Phase 1 (common_room phase) - it shows "Casing the Bank" title
    await page.locator('button:has-text("Casing the Bank")').click();
    await page.waitForTimeout(1000);

    // Verify we're viewing phase details
    await expect(page.locator('button:has-text("Back to Phase History")')).toBeVisible({ timeout: 5000 });

    // Click back button
    await page.click('button:has-text("Back to Phase History")');
    await page.waitForTimeout(500);

    // Verify we're back at the phase list
    await expect(page.locator('h2:has-text("Phase History")')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('span:has-text("Phase 1")').first()).toBeVisible();
  });
});
