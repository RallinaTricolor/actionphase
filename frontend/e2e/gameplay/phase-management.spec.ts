import { test, expect } from '@playwright/test';
import { loginAs } from '../fixtures/auth-helpers';
import { getFixtureGameId } from '../fixtures/game-helpers';
import { PhaseManagementPage } from '../pages/PhaseManagementPage';
import { waitForModal } from '../utils/waits';

/**
 * Journey 4: GM Manages Phases
 *
 * Tests phase creation, activation, and history viewing.
 * Uses E2E fixture game "E2E Test: Action Submission" (already in in_progress state with phases).
 * This speeds up tests by ~5-8 seconds per test by avoiding game creation and state transitions.
 *
 * REFACTORED: Using Page Object Model and shared utilities
 * - Eliminated all waitForTimeout calls (was 9)
 * - Uses PhaseManagementPage for all interactions
 * - Improved readability and maintainability
 */
test.describe('Phase Management Flow', () => {
  test('GM can create a phase', async ({ page }) => {
    // Login as GM
    await loginAs(page, 'GM');

    // Use E2E Action Submission game (already in in_progress state with phases)
    const gameId = await getFixtureGameId(page, 'E2E_ACTION');

    const phasePage = new PhaseManagementPage(page);
    await phasePage.goto(gameId);

    // Create a phase
    const phaseName = `Test Phase ${Date.now()}`;
    const deadline = new Date();
    deadline.setDate(deadline.getDate() + 2);

    await phasePage.createPhase({
      type: 'action',
      title: phaseName,
      description: 'Test phase description',
      deadline,
    });

    // Verify phase appears
    await phasePage.verifyPhaseExists(phaseName);

    // Verify "Activate" button is visible (phases are created but not active)
    await expect(page.locator('button:has-text("Activate")').last()).toBeVisible();
  });

  test('GM can activate a phase', async ({ page }) => {
    // Login as GM
    await loginAs(page, 'GM');

    // Use "The Heist at Goldstone Bank" from fixtures
    const gameId = await getFixtureGameId(page, 'E2E_ACTION');

    const phasePage = new PhaseManagementPage(page);
    await phasePage.goto(gameId);

    // Create a phase to activate
    const phaseName = `Activate Test ${Date.now()}`;
    const deadline = new Date();
    deadline.setDate(deadline.getDate() + 2);

    await phasePage.createPhase({
      type: 'action',
      title: phaseName,
      description: 'Phase to be activated',
      deadline,
    });

    // Activate the phase
    await phasePage.activatePhase(phaseName);

    // Verify the SPECIFIC phase we activated shows as "Currently Active"
    // Check the phase card itself shows "Currently Active" indicator
    const activatedPhaseCard = phasePage.getPhaseCard(phaseName);
    await expect(activatedPhaseCard.locator('div:has-text("Currently Active")').last()).toBeVisible({ timeout: 10000 });
  });

  test('GM can view history', async ({ page }) => {
    // Login as GM
    await loginAs(page, 'GM');

    // Use "The Heist at Goldstone Bank" from fixtures
    // This game already has Phase 2 active, so we can see Phase 1 and Phase 2
    const gameId = await getFixtureGameId(page, 'E2E_ACTION');

    const phasePage = new PhaseManagementPage(page);
    await phasePage.goto(gameId);

    // Fixture game has Phase 1 (common room, previous) and Phase 2 (action, active)
    // Verify we can see both phases
    await expect(page.locator('span:has-text("Phase 1")').first()).toBeVisible({ timeout: 5000 });
    await expect(page.locator('span:has-text("Phase 2")').first()).toBeVisible();

    // Verify phase titles from fixtures
    await expect(page.locator('h4:has-text("Discussion Phase")')).toBeVisible(); // Phase 1
    await expect(page.locator('h4:has-text("Action Phase")')).toBeVisible(); // Phase 2 (active)
  });
});
