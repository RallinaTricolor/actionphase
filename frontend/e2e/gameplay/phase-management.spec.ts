import { test, expect } from '@playwright/test';
import { loginAs } from '../fixtures/auth-helpers';
import { getFixtureGameId, FIXTURE_GAMES } from '../fixtures/game-helpers';

/**
 * Journey 4: GM Manages Phases
 *
 * Tests phase creation, activation, and history viewing.
 * Uses test fixtures ("The Heist at Goldstone Bank" - already in in_progress state).
 * This speeds up tests by ~5-8 seconds per test by avoiding game creation and state transitions.
 */
test.describe('Phase Management Flow', () => {
  test('GM can create a phase', async ({ page }) => {
    // Login as GM
    await loginAs(page, 'GM');

    // Use "The Heist at Goldstone Bank" from fixtures (already in in_progress state)
    const gameId = await getFixtureGameId(page, 'HEIST');
    await page.goto(`/games/${gameId}`);
    await page.waitForLoadState('networkidle');

    // Navigate to Phases tab
    await page.click('button:has-text("Phases")');
    await page.waitForTimeout(1000);

    // Click "New Phase"
    await page.click('button:has-text("New Phase")');
    await expect(page.locator('#phase-type')).toBeVisible({ timeout: 5000 });
    await page.waitForTimeout(500);

    // Fill in phase details
    const phaseName = `Test Phase ${Date.now()}`;
    const phaseDescription = 'Test phase description';

    await page.selectOption('#phase-type', 'action');
    await page.fill('#phase-title', phaseName);
    await page.fill('#phase-description', phaseDescription);

    // Set deadline (2 days from now)
    const deadline = new Date();
    deadline.setDate(deadline.getDate() + 2);
    const deadlineStr = deadline.toISOString().slice(0, 16);
    await page.fill('#phase-deadline', deadlineStr);

    // Submit the form
    await page.click('form button[type="submit"]:has-text("Create Phase")');
    await expect(page.locator('#phase-type')).not.toBeVisible({ timeout: 5000 });
    await page.waitForTimeout(1000);

    // Verify phase appears - custom title should be visible
    await expect(page.locator(`h4:has-text("${phaseName}")`)).toBeVisible({ timeout: 5000 });

    // Verify "Activate" button is visible (phases are created but not active)
    await expect(page.locator('button:has-text("Activate")').last()).toBeVisible();
  });

  test('GM can activate a phase', async ({ page }) => {
    // Login as GM
    await loginAs(page, 'GM');

    // Use "The Heist at Goldstone Bank" from fixtures
    const gameId = await getFixtureGameId(page, 'HEIST');
    await page.goto(`/games/${gameId}`);
    await page.waitForLoadState('networkidle');

    // Navigate to Phases tab
    await page.click('button:has-text("Phases")');
    await page.waitForTimeout(1000);

    // Create a phase to activate
    await page.click('button:has-text("New Phase")');
    await expect(page.locator('#phase-type')).toBeVisible({ timeout: 5000 });
    await page.waitForTimeout(500);

    const phaseName = `Activate Test ${Date.now()}`;
    await page.selectOption('#phase-type', 'action');
    await page.fill('#phase-title', phaseName);
    await page.fill('#phase-description', 'Phase to be activated');

    const deadline = new Date();
    deadline.setDate(deadline.getDate() + 2);
    const deadlineStr = deadline.toISOString().slice(0, 16);
    await page.fill('#phase-deadline', deadlineStr);

    await page.click('form button[type="submit"]:has-text("Create Phase")');
    await page.waitForTimeout(2000);

    // Find and click the Activate button for our phase
    // The last "Activate" button should be for the most recently created phase
    await expect(page.locator('button:has-text("Activate")').last()).toBeVisible({ timeout: 5000 });
    await page.locator('button:has-text("Activate")').last().click();
    await page.waitForTimeout(500);

    // Confirm activation in the dialog
    await page.click('button:has-text("Activate Phase")');
    await page.waitForTimeout(2000);

    // Verify phase shows as "Currently Active"
    await expect(page.locator('div:has-text("Currently Active")').last()).toBeVisible({ timeout: 10000 });
  });

  test('GM can view phase history', async ({ page }) => {
    // Login as GM
    await loginAs(page, 'GM');

    // Use "The Heist at Goldstone Bank" from fixtures
    // This game already has Phase 2 active, so we can see Phase 1 and Phase 2
    const gameId = await getFixtureGameId(page, 'HEIST');
    await page.goto(`/games/${gameId}`);
    await page.waitForLoadState('networkidle');

    // Navigate to Phases tab
    await page.click('button:has-text("Phases")');
    await page.waitForTimeout(1000);

    // Fixture game has Phase 1 (common room, previous) and Phase 2 (action, active)
    // Verify we can see both phases
    await expect(page.locator('span:has-text("Phase 1")').first()).toBeVisible({ timeout: 5000 });
    await expect(page.locator('span:has-text("Phase 2")').first()).toBeVisible();

    // Verify phase titles from fixtures
    await expect(page.locator('h4:has-text("Casing the Bank")')).toBeVisible(); // Phase 1
    await expect(page.locator('h4:has-text("Execute the Plan")')).toBeVisible(); // Phase 2 (active)
  });
});
