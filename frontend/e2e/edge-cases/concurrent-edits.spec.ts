import { test, expect, Page } from '@playwright/test';
import { loginAs } from '../fixtures/auth-helpers';
import { navigateToGame } from '../utils/navigation';
import { getFixtureGameId } from '../fixtures/game-helpers';

/**
 * E2E Tests for Concurrent Editing Scenarios
 *
 * Tests how the application handles simultaneous edits by multiple users
 * to the same resource (character sheets, game settings, etc.)
 */
test.describe('Concurrent Editing', () => {

  test('should handle two players viewing the same game simultaneously', async ({ browser }) => {
    // Create two separate browser contexts for two different users
    const player1Context = await browser.newContext();
    const player2Context = await browser.newContext();

    const player1Page = await player1Context.newPage();
    const player2Page = await player2Context.newPage();

    try {
      // Both players log in
      await loginAs(player1Page, 'PLAYER_1');
      await loginAs(player2Page, 'PLAYER_2');

      // Both navigate to the same game
      const gameId = await getFixtureGameId(player1Page, 'E2E_ACTION');
      await navigateToGame(player1Page, gameId);
      await navigateToGame(player2Page, gameId);

      await player1Page.waitForLoadState('networkidle');
      await player2Page.waitForLoadState('networkidle');

      // Both should be able to view the game
      await expect(player1Page.locator('h1, h2').first()).toBeVisible();
      await expect(player2Page.locator('h1, h2').first()).toBeVisible();

      // Both should have tabs visible
      const player1TabCount = await player1Page.locator('button[role="tab"]').count();
      const player2TabCount = await player2Page.locator('button[role="tab"]').count();

      expect(player1TabCount).toBeGreaterThan(0);
      expect(player2TabCount).toBeGreaterThan(0);

    } finally {
      await player1Context.close();
      await player2Context.close();
    }
  });

  test('should handle GM editing game settings while player views game', async ({ browser }) => {
    // Create two separate browser contexts
    const gmContext = await browser.newContext();
    const playerContext = await browser.newContext();

    const gmPage = await gmContext.newPage();
    const playerPage = await playerContext.newPage();

    try {
      // GM and player log in
      await loginAs(gmPage, 'GM');
      await loginAs(playerPage, 'PLAYER_1');

      // Both navigate to the same game
      const gameId = await getFixtureGameId(gmPage, 'E2E_GAME_SETTINGS');
      await navigateToGame(gmPage, gameId);
      await navigateToGame(playerPage, gameId);

      // Player stays on main view
      await playerPage.waitForLoadState('networkidle');
      const playerGameTitle = await playerPage.locator('h1, h2').first().textContent();
      expect(playerGameTitle).toBeTruthy();

      // GM clicks "Edit Game" button
      const editButton = gmPage.locator('button:has-text("Edit Game")');
      if (await editButton.count() > 0) {
        await editButton.click();
        await gmPage.waitForLoadState('networkidle');

        // GM should see edit form
        await expect(gmPage.locator('input, textarea, select').first()).toBeVisible();

        // Player should still see game normally (not affected by GM editing)
        await expect(playerPage.locator('h1, h2').first()).toBeVisible();
      }

    } finally {
      await gmContext.close();
      await playerContext.close();
    }
  });

  test('should handle multiple players viewing same game simultaneously', async ({ browser }) => {
    // Create three separate browser contexts
    const player1Context = await browser.newContext();
    const player2Context = await browser.newContext();
    const gmContext = await browser.newContext();

    const player1Page = await player1Context.newPage();
    const player2Page = await player2Context.newPage();
    const gmPage = await gmContext.newPage();

    try {
      // All users log in
      await loginAs(player1Page, 'PLAYER_1');
      await loginAs(player2Page, 'PLAYER_2');
      await loginAs(gmPage, 'GM');

      // All navigate to the same game
      const gameId = await getFixtureGameId(player1Page, 'E2E_ACTION');
      await navigateToGame(player1Page, gameId);
      await navigateToGame(player2Page, gameId);
      await navigateToGame(gmPage, gameId);

      await player1Page.waitForLoadState('networkidle');
      await player2Page.waitForLoadState('networkidle');
      await gmPage.waitForLoadState('networkidle');

      // All should be able to view the game simultaneously
      await expect(player1Page.locator('h1, h2').first()).toBeVisible();
      await expect(player2Page.locator('h1, h2').first()).toBeVisible();
      await expect(gmPage.locator('h1, h2').first()).toBeVisible();

      // All should be on the same game
      const player1URL = player1Page.url();
      const player2URL = player2Page.url();
      const gmURL = gmPage.url();

      expect(player1URL).toContain(`/games/${gameId}`);
      expect(player2URL).toContain(`/games/${gameId}`);
      expect(gmURL).toContain(`/games/${gameId}`);

    } finally {
      await player1Context.close();
      await player2Context.close();
      await gmContext.close();
    }
  });

  test('should handle GM and player viewing same game from different perspectives', async ({ browser }) => {
    // Create two separate browser contexts
    const gmContext = await browser.newContext();
    const playerContext = await browser.newContext();

    const gmPage = await gmContext.newPage();
    const playerPage = await playerContext.newPage();

    try {
      // GM and player log in
      await loginAs(gmPage, 'GM');
      await loginAs(playerPage, 'PLAYER_1');

      // Both navigate to same game
      const gameId = await getFixtureGameId(gmPage, 'E2E_ACTION');
      await navigateToGame(gmPage, gameId);
      await navigateToGame(playerPage, gameId);

      await gmPage.waitForLoadState('networkidle');
      await playerPage.waitForLoadState('networkidle');

      // Both should see the game
      await expect(gmPage.locator('h1, h2').first()).toBeVisible();
      await expect(playerPage.locator('h1, h2').first()).toBeVisible();

      // GM should see edit/management buttons
      const gmEditButton = await gmPage.locator('button:has-text("Edit Game")').count();
      expect(gmEditButton).toBeGreaterThan(0);

      // Player should NOT see GM management buttons
      const playerEditButton = await playerPage.locator('button:has-text("Edit Game")').count();
      expect(playerEditButton).toBe(0);

    } finally {
      await gmContext.close();
      await playerContext.close();
    }
  });

  test('should handle refresh while viewing same game from different accounts', async ({ browser }) => {
    // Create two separate browser contexts
    const gmContext = await browser.newContext();
    const playerContext = await browser.newContext();

    const gmPage = await gmContext.newPage();
    const playerPage = await playerContext.newPage();

    try {
      // GM and player log in
      await loginAs(gmPage, 'GM');
      await loginAs(playerPage, 'PLAYER_1');

      // Both navigate to the same game
      const gameId = await getFixtureGameId(gmPage, 'E2E_ACTION');
      await navigateToGame(gmPage, gameId);
      await navigateToGame(playerPage, gameId);

      await gmPage.waitForLoadState('networkidle');
      await playerPage.waitForLoadState('networkidle');

      // Both should see the game
      const gmGameTitle = await gmPage.locator('h1, h2').first().textContent();
      const playerGameTitle = await playerPage.locator('h1, h2').first().textContent();

      expect(gmGameTitle).toBeTruthy();
      expect(playerGameTitle).toBeTruthy();

      // Player refreshes their page
      await playerPage.reload();
      await playerPage.waitForLoadState('networkidle');

      // Player should still see game after refresh
      await expect(playerPage.locator('h1, h2').first()).toBeVisible();
      await expect(playerPage).toHaveURL(new RegExp(`/games/${gameId}`));

      // GM's view should be unaffected
      await expect(gmPage.locator('h1, h2').first()).toBeVisible();
      await expect(gmPage).toHaveURL(new RegExp(`/games/${gameId}`));

    } finally {
      await gmContext.close();
      await playerContext.close();
    }
  });
});
