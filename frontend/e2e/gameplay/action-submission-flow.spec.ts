import { test, expect } from '@playwright/test';
import { loginAs } from '../fixtures/auth-helpers';
import { getFixtureGameId } from '../fixtures/game-helpers';
import { GameDetailsPage } from '../pages/GameDetailsPage';
import { ActionSubmissionPage } from '../pages/ActionSubmissionPage';
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
test.describe('@mobile Action Submission Flow', () => {
  test('Player can edit an existing action for active action phase', async ({ page }) => {
    // Login as Player 4 who has an in-progress action
    await loginAs(page, 'PLAYER_4');

    // Use dedicated E2E action submission game (safe to modify)
    const gameId = await getFixtureGameId(page, 'E2E_ACTION');
    const actionPage = new ActionSubmissionPage(page, gameId);

    // Navigate to action submission using POM
    await actionPage.goto();

    // Verify Action Submission section is visible
    await assertTextVisible(page, 'Action Submission');

    // Player 4 has an existing action. Assert that one is shown, not its exact
    // seed text: this test overwrites it, so a retry starts from the edited
    // content and a seed-text check failed it for a reason unrelated to editing.
    await assertTextVisible(page, 'Your Current Action');
    await expect(actionPage.actionContent).not.toBeEmpty();

    // Update the action content using POM — include a timestamp to make it unique
    const newActionContent = `I will execute my plan with precision and care. Updated: ${Date.now()}`;
    await actionPage.editAction(newActionContent);

    // Retrying: the display updates when the actions query refetches after the
    // save, which can land after editAction returns. A one-shot read here
    // caught the pre-edit text.
    await expect(actionPage.actionContent).toContainText(newActionContent, { timeout: 10000 });
    await expect(page.locator('text=Acting as:').locator('..').locator('span:has-text("E2E Test Char 4")')).toBeVisible();
  });

  test('Player can view their submitted action', async ({ page }) => {
    // Login as Player 1 who has a submitted action
    await loginAs(page, 'PLAYER_1');

    // Use dedicated E2E action submission game
    const gameId = await getFixtureGameId(page, 'E2E_ACTION');
    const actionPage = new ActionSubmissionPage(page, gameId);

    // Navigate to action submission using POM
    await actionPage.goto();

    // Verify their submitted action is visible using POM
    expect(await actionPage.hasSubmittedAction()).toBe(true);
    await assertTextVisible(page, 'This is my existing action');
    await expect(page.locator('text=Acting as:').locator('..').locator('span:has-text("E2E Test Char 1")')).toBeVisible();

    // Verify "Edit" button is available since phase is still active using POM
    expect(await actionPage.canEditAction()).toBe(true);
  });

  test('GM can view all submitted actions for active phase', async ({ page }) => {
    // Login as GM
    await loginAs(page, 'GM');

    // Use dedicated E2E action submission game
    const gameId = await getFixtureGameId(page, 'E2E_ACTION');

    const gamePage = new GameDetailsPage(page);
    await gamePage.goto(gameId);
    await gamePage.goToActions();

    // GM should see submitted action from Player 1
    await expect(page.locator('text=E2E Test Char 1').locator('visible=true').first()).toBeVisible({ timeout: 5000 });

    // Click to expand the action card to see content
    await page.getByRole('button', { name: 'E2E Test Char 1' }).locator('visible=true').first().click();

    // Verify action content is visible to GM
    await assertTextVisible(page, 'This is my existing action for testing purposes');
  });

  test('Player can create and submit a new action from scratch', async ({ page }) => {
    // Login as Player 2 who does NOT have an existing action
    await loginAs(page, 'PLAYER_2');

    // Use dedicated E2E action submission game (safe to modify)
    const gameId = await getFixtureGameId(page, 'E2E_ACTION');
    const actionPage = new ActionSubmissionPage(page, gameId);

    // Navigate to action submission using POM
    await actionPage.goto();

    // Verify Action Submission section is visible
    await assertTextVisible(page, 'Action Submission');

    // Precondition, stated rather than left to fail obscurely: PLAYER_2 has no
    // action yet. Actions cannot be deleted, so once this test has submitted
    // one (including on a retry after a failure elsewhere in this test) it
    // cannot run again until fixtures are reloaded.
    await expect(actionPage.actionSubmissionForm.or(actionPage.currentActionDisplay).first()).toBeVisible({ timeout: 10000 });
    await expect(
      actionPage.currentActionDisplay,
      'PLAYER_2 already has an action for this phase. This test is single-use per fixture load; run `just load-e2e`.'
    ).toHaveCount(0);

    // Submit new action using POM
    const newActionContent = `I will scout ahead and report back to the team. This is my first action submission. ${Date.now()}`;
    // submitAction waits for the save and the refetch it triggers
    await actionPage.submitAction(newActionContent);

    // Verify the action was submitted successfully using POM
    expect(await actionPage.hasSubmittedAction()).toBe(true);

    // Verify the new content is displayed
    await assertTextVisible(page, 'I will scout ahead');
    await expect(page.locator('text=Acting as:').locator('..').locator('span:has-text("E2E Test Char 2")')).toBeVisible({ timeout: 10000 });
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
