import { test, expect } from '@playwright/test';
import { loginAs } from '../fixtures/auth-helpers';
import { getFixtureGameId } from '../fixtures/game-helpers';
import { navigateToGame } from '../utils/navigation';

/**
 * E2E Tests for Complete Phase Lifecycle
 *
 * Tests the full game loop from common room -> action phase -> results -> common room
 *
 * Uses dedicated E2E fixture (E2E_LIFECYCLE) which includes:
 * - Fresh game in initial common room phase
 * - 3 player characters ready to participate
 * - No action results yet (will create through UI)
 *
 * CRITICAL: This tests the COMPLETE game workflow end-to-end
 * IMPORTANT: Tests run serially because they build on each other (lifecycle flow)
 */
test.describe.serial('Complete Phase Lifecycle', () => {
  test('GM can create and activate action phase from common room', async ({ page }) => {
    // Login as GM
    await loginAs(page, 'GM');

    const gameId = await getFixtureGameId(page, 'E2E_LIFECYCLE');
    await navigateToGame(page, gameId);

    // Navigate to Phases tab (GM-only)
    await page.click('button:has-text("Phases")');
    await page.waitForLoadState('networkidle');

    // Verify we see the Phase Management interface
    await expect(page.locator('h2:has-text("Phase Management")')).toBeVisible({ timeout: 10000 });

    // Verify current phase is "Initial Common Room"
    await expect(page.locator('h3:has-text("Currently Active")')).toBeVisible();
    await expect(page.locator('p:has-text("Initial Common Room")').first()).toBeVisible();

    // Create new action phase
    await page.click('button:has-text("New Phase")');
    await page.waitForLoadState('networkidle');

    // Fill in phase details
    await page.selectOption('select#phase-type', 'action');
    await page.fill('input#phase-title', 'Test Action Phase');
    await page.fill('textarea#phase-description', 'Players submit their actions for this phase');

    // Set deadline (tomorrow)
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const deadlineStr = tomorrow.toISOString().slice(0, 16); // Format: YYYY-MM-DDTHH:mm
    await page.fill('input#phase-deadline', deadlineStr);

    // Submit the form
    await page.click('button[type="submit"]:has-text("Create")');
    await page.waitForLoadState('networkidle');

    // Verify the new phase appears in the list
    await expect(page.locator('text=Test Action Phase')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=Phase 2')).toBeVisible();

    // Activate the new action phase
    await page.click('text=Test Action Phase');
    await page.waitForLoadState('networkidle');

    // Click the "Activate" button for this phase
    await page.click('button:has-text("Activate")');

    // Handle activation confirmation dialog if it appears
    const confirmButton = page.locator('button:has-text("Activate Phase")');
    if (await confirmButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await confirmButton.click();
    }

    await page.waitForLoadState('networkidle');

    // Verify the phase is now active
    await expect(page.locator('h3:has-text("Currently Active")')).toBeVisible();
    await expect(page.locator('text=Test Action Phase')).toBeVisible();
  });

  test('players can access action submission during action phase', async ({ page }) => {
    // Test 1 created and activated an action phase
    // This test verifies players can access the action submission UI
    // (Detailed submission testing is in action-submission-flow.spec.ts)

    await loginAs(page, 'PLAYER_1');

    const gameId = await getFixtureGameId(page, 'E2E_LIFECYCLE');
    await navigateToGame(page, gameId);
    await page.waitForLoadState('networkidle');

    // During action phase, players should see "Submit Action" tab
    await expect(page.locator('button[role="tab"]:has-text("Submit Action")')).toBeVisible({ timeout: 10000 });

    // Click Submit Action tab
    await page.click('button[role="tab"]:has-text("Submit Action")');
    await page.waitForLoadState('networkidle');

    // Should see action submission form
    await expect(page.locator('text=Action Submission')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Acting as:').first()).toBeVisible();
    await expect(page.locator('text=Lifecycle Char 1')).toBeVisible();

    // Verify submission form is available
    await expect(page.locator('textarea[placeholder*="Describe what your character does"]')).toBeVisible();
    await expect(page.getByTestId('submit-action-button')).toBeVisible();

    // Note: Detailed action submission flow is tested in action-submission-flow.spec.ts
  });

  test('GM can access actions tab during action phase', async ({ page }) => {
    // Test 1 created an action phase
    // This test verifies GM can access the Actions tab to view submissions
    // (Detailed action viewing is tested in other test files)

    await loginAs(page, 'GM');

    const gameId = await getFixtureGameId(page, 'E2E_LIFECYCLE');
    await navigateToGame(page, gameId);
    await page.waitForLoadState('networkidle');

    // During action phase, GM should see "Actions" tab
    await expect(page.locator('button[role="tab"]:has-text("Actions")')).toBeVisible({ timeout: 10000 });

    // GM should also still see phase management
    await expect(page.locator('button[role="tab"]:has-text("Phases")')).toBeVisible();

    // Click Actions tab
    await page.click('button[role="tab"]:has-text("Actions")');
    await page.waitForLoadState('networkidle');

    // Should see the actions interface
    await expect(page.getByRole('heading', { name: 'Submitted Actions' })).toBeVisible({ timeout: 10000 });
  });

  test('complete lifecycle: verify phase history shows all created phases', async ({ page }) => {
    // Previous tests created and activated an action phase
    // This test verifies the complete phase history is visible

    await loginAs(page, 'PLAYER_1');

    const gameId = await getFixtureGameId(page, 'E2E_LIFECYCLE');
    await navigateToGame(page, gameId);

    // Navigate to History tab
    await page.click('button:has-text("History")');
    await page.waitForLoadState('networkidle');

    // Wait for phase history to load
    await expect(page.locator('h2:has-text("Phase History")')).toBeVisible({ timeout: 10000 });

    // Verify we see both the initial common room (Phase 1)
    await expect(page.locator('text=Initial Common Room').first()).toBeVisible();
    await expect(page.locator('text=Phase 1').first()).toBeVisible();

    // Verify we see the created action phase (Phase 2)
    // Use getByRole to target the specific phase button in history
    await expect(page.getByRole('button', { name: /Phase 2.*Test Action Phase/ })).toBeVisible();

    // Verify phases are displayed in order
    const phases = page.locator('[class*="border rounded-lg p-4"]');
    await expect(phases).toHaveCount(2, { timeout: 5000 });
  });
});
