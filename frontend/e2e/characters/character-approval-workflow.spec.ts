import { test, expect } from '@playwright/test';
import { loginAs } from '../fixtures/auth-helpers';
import { getFixtureGameId, createGameReadyToStart } from '../fixtures/game-helpers';
import { GameDetailsPage } from '../pages/GameDetailsPage';
import { CharacterWorkflowPage } from '../pages/CharacterWorkflowPage';
import { navigateToGameTab } from '../utils/navigation';

/**
 * E2E Tests for Character Approval Workflow
 *
 * Tests the complete character approval process including:
 * - Character starts in pending state after creation
 * - GM can approve characters
 * - Approved characters appear in game
 *
 * There is no reject path (the approve endpoint only accepts "approved"), so
 * there is no rejected → resubmitted workflow to test.
 *
 * Fixtures live in 14_character_workflows.sql. The approval test creates its
 * own pending character so it can be retried.
 */

test.describe('@mobile Character Approval Workflow', () => {

  test('character starts in pending state after creation', async ({ page }) => {
    await loginAs(page, 'PLAYER_1');

    const gameId = await getFixtureGameId(page, 'E2E_CHARACTER_PENDING_STATE');

    // Fixture pre-bakes 'Pending State Test Character' in pending status for PLAYER_1
    const characterPage = new CharacterWorkflowPage(page, gameId);
    await characterPage.goto();

    const characterName = 'Pending State Test Character';
    expect(await characterPage.hasCharacter(characterName)).toBe(true);
    const status = await characterPage.getCharacterStatus(characterName);
    expect(status).toBe('pending');

    // Player should not see an Approve button for their own pending character
    await expect(page.getByRole('button', { name: 'Approve' })).not.toBeVisible();
  });

  test('GM can approve character', async ({ browser }) => {
    const gmContext = await browser.newContext();
    const playerContext = await browser.newContext();
    const gmPage = await gmContext.newPage();
    const playerPage = await playerContext.newPage();

    try {
      await loginAs(gmPage, 'GM');
      await loginAs(playerPage, 'PLAYER_1');

      const gameId = await getFixtureGameId(gmPage, 'E2E_CHARACTER_APPROVE');

      // The player submits a fresh character for this run. Approving the
      // fixture's pre-baked pending character made the test single-use: a retry
      // found it already approved, with no Approve button, and failed for a
      // reason unrelated to approval.
      const characterName = `Approval Test Character ${Date.now()}`;
      const created = await playerPage.request.post(`/api/v1/games/${gameId}/characters`, {
        data: { name: characterName, character_type: 'player_character' },
      });
      expect(created.ok(), `create character: ${created.status()} ${await created.text()}`).toBe(true);

      const gmCharPage = new CharacterWorkflowPage(gmPage, gameId);
      await gmCharPage.goto();
      expect(await gmCharPage.getCharacterStatus(characterName)).toBe('pending');

      await gmCharPage.approveCharacter(characterName);

      // Retrying: the card re-renders when the characters query refetches after
      // the approval, which can land after approveCharacter returns.
      await expect.poll(() => gmCharPage.getCharacterStatus(characterName)).toBe('approved');

      // Player should see approved status too
      const playerCharPage = new CharacterWorkflowPage(playerPage, gameId);
      await playerCharPage.goto();
      await expect.poll(() => playerCharPage.getCharacterStatus(characterName)).toBe('approved');
    } finally {
      await gmContext.close();
      await playerContext.close();
    }
  });

  test('approved characters appear in active game', async ({ browser }) => {
    const gmContext = await browser.newContext();
    const playerContext = await browser.newContext();
    const gmPage = await gmContext.newPage();
    const playerPage = await playerContext.newPage();

    try {
      await loginAs(gmPage, 'GM');
      await loginAs(playerPage, 'PLAYER_3');

      // A game of its own, per run: this test starts it, which is one-way, so a
      // shared fixture game made the test single-use (see createGameReadyToStart).
      const characterName = `In-Game Character ${Date.now()}`;
      const gameId = await createGameReadyToStart(gmPage, playerPage, characterName);

      // Verify the approved character exists before the game starts
      const playerCharPage = new CharacterWorkflowPage(playerPage, gameId);
      await playerCharPage.goto();
      await expect.poll(() => playerCharPage.getCharacterStatus(characterName)).toBe('approved');

      // GM starts the game using POM
      const gmGamePage = new GameDetailsPage(gmPage);
      await gmPage.goto(`/games/${gameId}`);
      await gmPage.waitForLoadState('networkidle');
      await gmGamePage.startGame();

      // Verify game is now in_progress
      await expect(gmPage.getByText(/current phase|in progress/i)).toBeVisible({ timeout: 10000 });

      // Navigate to People tab (in_progress games). One fresh load picks up
      // the new state; this used to reload() and then goto() the same URL,
      // two full page loads that pushed the test past its budget under load.
      await gmPage.goto(`/games/${gameId}`);

      await navigateToGameTab(gmPage, 'People');

      // Verify approved character is visible
      await expect(gmPage.getByText(characterName).locator('visible=true').first()).toBeVisible({ timeout: 10000 });

      // Player should also see their character in the active game
      await playerPage.goto(`/games/${gameId}`);

      await navigateToGameTab(playerPage, 'People');

      await expect(playerPage.getByText(characterName).locator('visible=true').first()).toBeVisible({ timeout: 10000 });
    } finally {
      await gmContext.close();
      await playerContext.close();
    }
  });
});
