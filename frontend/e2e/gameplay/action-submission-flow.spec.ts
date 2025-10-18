import { test, expect } from '@playwright/test';
import { loginAs } from '../fixtures/auth-helpers';
import { getFixtureGameId } from '../fixtures/game-helpers';

/**
 * Journey 9: Player Submits Action
 *
 * Tests the complete action submission flow during an active action phase.
 * Uses dedicated E2E fixture (E2E_ACTION) for state-modifying tests.
 * Player 4 has a draft action that can be updated and submitted.
 */
test.describe('Action Submission Flow', () => {
  test('Player can submit a new action for active action phase', async ({ page }) => {
    // Login as Player 4 who has a draft action
    await loginAs(page, 'PLAYER_4');

    // Use dedicated E2E action submission game (safe to modify)
    const gameId = await getFixtureGameId(page, 'E2E_ACTION');
    await page.goto(`/games/${gameId}`);
    await page.waitForLoadState('networkidle');

    // Navigate to Submit Action tab (where ActionSubmission component is displayed)
    await page.click('button:has-text("Submit Action")');
    await page.waitForTimeout(1000);

    // Verify Action Submission section is visible
    await expect(page.locator('h2:has-text("Action Submission")')).toBeVisible({ timeout: 5000 });

    // Player 4 has a draft action - verify it's displayed
    await expect(page.locator('h3:has-text("Your Current Action")')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=This is a draft action')).toBeVisible();

    // Click "Edit" to modify the draft action
    await page.click('button:has-text("Edit")');
    await page.waitForTimeout(500);

    // Update the action content
    const newActionContent = `I will execute my plan with precision and care. This is my updated action for testing. ${Date.now()}`;

    // Clear existing content and fill in new action
    await page.fill('textarea[placeholder*="Describe what your character does"]', newActionContent);
    await page.waitForTimeout(300);

    // Submit the updated action
    await page.click('button:has-text("Update Action")');
    await page.waitForTimeout(2000);

    // Verify the action was submitted successfully
    await expect(page.locator('h3:has-text("Your Current Action")')).toBeVisible({ timeout: 5000 });

    // Verify the new content is displayed
    await expect(page.locator('text=I will execute my plan')).toBeVisible();
    await expect(page.locator('text=Acting as:').locator('..').locator('span:has-text("E2E Test Char 4")')).toBeVisible();
  });

  test('Player can view their submitted action', async ({ page }) => {
    // Login as Player 1 who has a submitted action
    await loginAs(page, 'PLAYER_1');

    // Use dedicated E2E action submission game
    const gameId = await getFixtureGameId(page, 'E2E_ACTION');
    await page.goto(`/games/${gameId}`);
    await page.waitForLoadState('networkidle');

    // Navigate to Submit Action tab
    await page.click('button:has-text("Submit Action")');
    await page.waitForTimeout(1000);

    // Verify their submitted action is visible
    await expect(page.locator('h3:has-text("Your Current Action")')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=This is my existing action')).toBeVisible();
    await expect(page.locator('text=Acting as:').locator('..').locator('span:has-text("E2E Test Char 1")')).toBeVisible();

    // Verify "Edit" button is available since phase is still active
    await expect(page.locator('button:has-text("Edit")')).toBeVisible();
  });

  test('GM can view all submitted actions for active phase', async ({ page }) => {
    // Login as GM
    await loginAs(page, 'GM');

    // Use dedicated E2E action submission game
    const gameId = await getFixtureGameId(page, 'E2E_ACTION');
    await page.goto(`/games/${gameId}`);
    await page.waitForLoadState('networkidle');

    // Navigate to Actions tab (GM view)
    await page.click('button:has-text("Actions")');
    await page.waitForTimeout(1000);

    // Verify GM can see actions section
    await expect(page.locator('h2:has-text("Actions")')).toBeVisible({ timeout: 5000 });

    // GM should see submitted action from Player 1
    await expect(page.locator('text=E2E Test Char 1')).toBeVisible({ timeout: 5000 });

    // Click to expand the action card to see content
    await page.click('button:has-text("TestPlayer1")');
    await page.waitForTimeout(500);

    // Verify action content is visible to GM
    await expect(page.locator('text=This is my existing action for testing purposes')).toBeVisible();
  });

  test('Player cannot submit action when no action phase is active', async ({ page }) => {
    // Login as Player 1
    await loginAs(page, 'PLAYER_1');

    // Use "Shadows Over Innsmouth" from fixtures (has common_room phase active, not action)
    const gameId = await getFixtureGameId(page, 'SHADOWS');
    await page.goto(`/games/${gameId}`);
    await page.waitForLoadState('networkidle');

    // Try to navigate to Submit Action tab
    await page.click('button:has-text("Submit Action")');
    await page.waitForTimeout(1000);

    // Verify "No Action Phase Active" message is displayed
    await expect(page.locator('h3:has-text("No Action Phase Active")')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=Action submissions are only available during Action phases')).toBeVisible();
  });
});
