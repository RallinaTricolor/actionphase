import { test, expect } from '@playwright/test';
import { loginAs } from '../../fixtures/auth-helpers';
import { getFixtureGameId } from '../../fixtures/game-helpers';

/**
 * Journey 3: Complete Action Phase Workflow
 *
 * Tests the workflow:
 * GM creates action phase → Players submit actions → Draft vs final submission states
 *
 * Uses dedicated E2E fixture game with guaranteed action phase state
 */
test.describe.skip('Action Phase Workflow Journey', () => {

  test('Player can view action submission form during active action phase', async ({ page }) => {
    // Step 1: Login as player 1
    await loginAs(page, 'PLAYER_1');

    // Step 2: Navigate to the dedicated action submission test game
    const gameId = await getFixtureGameId(page, 'E2E_ACTION');
    await page.goto(`/games/${gameId}`);
    await page.waitForLoadState('networkidle');

    // Step 3: Verify action submission container is visible
    const actionContainer = page.locator('[data-testid="action-submission-container"]');
    await expect(actionContainer).toBeVisible({ timeout: 5000 });

    // Step 4: Verify form elements are present and functional
    const actionTextarea = page.locator('[data-testid="action-textarea"]');
    await expect(actionTextarea).toBeVisible();
    await expect(actionTextarea).toBeEnabled();

    // Step 5: Verify submit button is present
    const submitButton = page.locator('[data-testid="submit-action-button"]');
    await expect(submitButton).toBeVisible();
  });

  test('Action submission form shows proper validation states', async ({ page }) => {
    // Step 1: Login as player 2 (no existing action)
    await loginAs(page, 'PLAYER_2');

    // Step 2: Navigate to game
    const gameId = await getFixtureGameId(page, 'E2E_ACTION');
    await page.goto(`/games/${gameId}`);
    await page.waitForLoadState('networkidle');

    // Step 3: Verify action submission form is available
    const actionForm = page.locator('[data-testid="action-submission-form"]');
    await expect(actionForm).toBeVisible({ timeout: 5000 });

    // Step 4: Verify initial state - textarea should be empty or have draft
    const submitButton = page.locator('[data-testid="submit-action-button"]');
    const textarea = page.locator('[data-testid="action-textarea"]');

    await expect(textarea).toBeVisible();
    const initialValue = await textarea.inputValue();

    // Step 5: If empty, submit button should be disabled
    if (initialValue.trim() === '') {
      await expect(submitButton).toBeDisabled();
    }

    // Step 6: Test that adding content enables the button
    await textarea.fill('Test action content for validation');
    await expect(submitButton).toBeEnabled();

    // Step 7: Clear content and verify button is disabled again
    await textarea.fill('');
    await expect(submitButton).toBeDisabled();
  });

  test('Player can view existing action submission', async ({ page }) => {
    // Step 1: Login as player 1 (has existing action in fixtures)
    await loginAs(page, 'PLAYER_1');

    // Step 2: Navigate to game
    const gameId = await getFixtureGameId(page, 'E2E_ACTION');
    await page.goto(`/games/${gameId}`);
    await page.waitForLoadState('networkidle');

    // Step 3: Verify existing action display is visible
    const currentActionDisplay = page.locator('[data-testid="current-action-display"]');
    await expect(currentActionDisplay).toBeVisible({ timeout: 5000 });

    // Step 4: Verify action content is present
    const actionContent = page.locator('[data-testid="action-content"]');
    await expect(actionContent).toBeVisible();

    // Content should not be empty
    const contentText = await actionContent.textContent();
    expect(contentText).toBeTruthy();
    expect(contentText!.length).toBeGreaterThan(0);

    // Step 5: Verify action status is shown
    const actionStatus = page.locator('[data-testid="action-status"]');
    await expect(actionStatus).toBeVisible();
    await expect(actionStatus).toContainText(/Last updated|updated/i);

    // Step 6: Verify edit button is available
    const editButton = page.locator('[data-testid="edit-action-button"]');
    await expect(editButton).toBeVisible();
    await expect(editButton).toBeEnabled();
  });

  test('Phase deadline is displayed when present', async ({ page }) => {
    // Step 1: Login as player
    await loginAs(page, 'PLAYER_1');

    // Step 2: Navigate to game
    const gameId = await getFixtureGameId(page, 'E2E_ACTION');
    await page.goto(`/games/${gameId}`);
    await page.waitForLoadState('networkidle');

    // Step 3: Verify action submission container is visible
    const actionContainer = page.locator('[data-testid="action-submission-container"]');
    await expect(actionContainer).toBeVisible({ timeout: 5000 });

    // Step 4: Verify phase deadline is displayed
    const phaseDeadline = page.locator('[data-testid="phase-deadline"]');
    await expect(phaseDeadline).toBeVisible();

    // Step 5: Deadline should have meaningful content
    const deadlineText = await phaseDeadline.textContent();
    expect(deadlineText).toBeTruthy();
    expect(deadlineText!.trim().length).toBeGreaterThan(0);
  });

  test('Character selection is available for action submission', async ({ page }) => {
    // Step 1: Login as player 1 (has character in fixtures)
    await loginAs(page, 'PLAYER_1');

    // Step 2: Navigate to game
    const gameId = await getFixtureGameId(page, 'E2E_ACTION');
    await page.goto(`/games/${gameId}`);
    await page.waitForLoadState('networkidle');

    // Step 3: Verify action form is present
    const actionForm = page.locator('[data-testid="action-submission-form"]');
    await expect(actionForm).toBeVisible({ timeout: 5000 });

    // Step 4: Verify character select dropdown exists
    // Note: This tests that the character selection UI is present
    // The fixture has 1 character per player, so the select may show only one option
    const characterSelect = page.locator('[data-testid="character-select"]');
    await expect(characterSelect).toBeVisible();
    await expect(characterSelect).toBeEnabled();
  });

  test('Draft action can be viewed and edited', async ({ page }) => {
    // Step 1: Login as player 4 (has draft action in fixtures)
    await loginAs(page, 'PLAYER_4');

    // Step 2: Navigate to game
    const gameId = await getFixtureGameId(page, 'E2E_ACTION');
    await page.goto(`/games/${gameId}`);
    await page.waitForLoadState('networkidle');

    // Step 3: Verify action form is visible
    const actionForm = page.locator('[data-testid="action-submission-form"]');
    await expect(actionForm).toBeVisible({ timeout: 5000 });

    // Step 4: Verify textarea contains the draft content
    const textarea = page.locator('[data-testid="action-textarea"]');
    await expect(textarea).toBeVisible();

    const draftContent = await textarea.inputValue();
    expect(draftContent).toContain('draft'); // Draft fixture says "This is a draft action"

    // Step 5: Verify submit button is enabled (can finalize draft)
    const submitButton = page.locator('[data-testid="submit-action-button"]');
    await expect(submitButton).toBeEnabled();

    // Step 6: Verify draft indicator is shown
    const draftIndicator = page.locator('[data-testid="draft-indicator"]');
    await expect(draftIndicator).toBeVisible();
  });
});
