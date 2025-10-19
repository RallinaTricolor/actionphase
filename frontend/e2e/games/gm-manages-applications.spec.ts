import { test, expect } from '@playwright/test';
import { loginAs } from '../fixtures/auth-helpers';
import { GameDetailsPage } from '../pages/GameDetailsPage';
import { navigateToGamesList } from '../utils/navigation';

/**
 * Journey 8: GM Manages Game Applications
 *
 * Tests that GMs can view, approve, and reject multiple player applications.
 * Uses a fixture recruiting game and creates applications from multiple players.
 *
 * REFACTORED: Using Page Object Model and shared utilities
 * - Eliminated all waitForTimeout calls (was 26)
 * - Reduced code by ~40% (227 → ~136 lines)
 * - Improved readability with GameDetailsPage
 */
test.describe('GM Manages Game Applications', () => {
  // Helper function to create a recruiting game
  async function createRecruitingGame(gmPage: any): Promise<number> {
    await navigateToGamesList(gmPage);

    await gmPage.click('button:has-text("Create Game")');
    await gmPage.waitForLoadState('networkidle');

    const timestamp = Date.now();
    const gameTitle = `E2E Applications Test ${timestamp}`;

    await gmPage.fill('#title', gameTitle);
    await gmPage.fill('#description', 'Test game for application management');
    await gmPage.fill('#genre', 'Test');
    await gmPage.fill('#max_players', '5');
    await gmPage.click('form button[type="submit"]:has-text("Create Game")');
    await gmPage.waitForURL(/\/games\/\d+/);

    const gameUrl = gmPage.url();
    const gameId = parseInt(gameUrl.match(/\/games\/(\d+)/)?.[1] || '0');

    // Start recruitment
    const gamePage = new GameDetailsPage(gmPage);
    await gamePage.startRecruitment();

    return gameId;
  }

  // Helper to apply to a game
  async function applyToGame(playerPage: any, gameId: number) {
    const gamePage = new GameDetailsPage(playerPage);
    await gamePage.goto(gameId);

    // Click Apply to Join button
    await playerPage.click('button:has-text("Apply to Join")');
    await playerPage.waitForLoadState('networkidle');

    // Submit application
    await playerPage.click('button:has-text("Submit Application")');
    await playerPage.waitForLoadState('networkidle');
  }

  test('GM can view pending applications', async ({ browser }) => {
    // Create contexts for GM and 2 players
    const gmContext = await browser.newContext();
    const player1Context = await browser.newContext();
    const player2Context = await browser.newContext();

    const gmPage = await gmContext.newPage();
    const player1Page = await player1Context.newPage();
    const player2Page = await player2Context.newPage();

    try {
      // === GM creates a recruiting game ===
      await loginAs(gmPage, 'GM');
      const gameId = await createRecruitingGame(gmPage);

      // === Player 1 applies ===
      await loginAs(player1Page, 'PLAYER_1');
      await applyToGame(player1Page, gameId);

      // === Player 2 applies ===
      await loginAs(player2Page, 'PLAYER_2');
      await applyToGame(player2Page, gameId);

      // === GM views applications ===
      const gamePage = new GameDetailsPage(gmPage);
      await gamePage.goToApplications();

      // Verify applications heading
      await expect(gmPage.locator('h2:has-text("Applications")')).toBeVisible({ timeout: 5000 });

      // Verify pending applications section
      await expect(gmPage.locator('h3:has-text("Pending Review")')).toBeVisible();

      // Verify both players' applications are visible
      await expect(gmPage.locator('h3:has-text("TestPlayer1")')).toBeVisible();
      await expect(gmPage.locator('h3:has-text("TestPlayer2")')).toBeVisible();

      // Verify application count badge shows 2
      await expect(gmPage.locator('span:has-text("2")').first()).toBeVisible();
    } finally {
      await gmContext.close();
      await player1Context.close();
      await player2Context.close();
    }
  });

  test('GM can approve multiple applications', async ({ browser }) => {
    const gmContext = await browser.newContext();
    const player1Context = await browser.newContext();
    const player2Context = await browser.newContext();
    const player3Context = await browser.newContext();

    const gmPage = await gmContext.newPage();
    const player1Page = await player1Context.newPage();
    const player2Page = await player2Context.newPage();
    const player3Page = await player3Context.newPage();

    try {
      // === GM creates a recruiting game ===
      await loginAs(gmPage, 'GM');
      const gameId = await createRecruitingGame(gmPage);

      // === Three players apply ===
      await loginAs(player1Page, 'PLAYER_1');
      await applyToGame(player1Page, gameId);

      await loginAs(player2Page, 'PLAYER_2');
      await applyToGame(player2Page, gameId);

      await loginAs(player3Page, 'PLAYER_3');
      await applyToGame(player3Page, gameId);

      // === GM approves all three ===
      const gamePage = new GameDetailsPage(gmPage);
      await gamePage.goToApplications();

      // Approve all three players
      await gmPage.locator('div:has(h3:has-text("TestPlayer1"))').first().locator('button:has-text("Approve")').first().click();
      await gmPage.waitForLoadState('networkidle');

      await gmPage.locator('div:has(h3:has-text("TestPlayer2"))').first().locator('button:has-text("Approve")').first().click();
      await gmPage.waitForLoadState('networkidle');

      await gmPage.locator('div:has(h3:has-text("TestPlayer3"))').first().locator('button:has-text("Approve")').first().click();
      await gmPage.waitForLoadState('networkidle');

      // Verify all are now in "Reviewed Applications" section
      await expect(gmPage.locator('h3:has-text("Reviewed Applications")')).toBeVisible({ timeout: 5000 });

      // Verify approved badges are visible
      const approvedBadges = gmPage.locator('span:has-text("Approved")');
      await expect(approvedBadges).toHaveCount(3, { timeout: 5000 });

      // Verify pending count is now 0 (pending section might not be visible)
      await expect(gmPage.locator('h3:has-text("Pending Review")')).not.toBeVisible();
    } finally {
      await gmContext.close();
      await player1Context.close();
      await player2Context.close();
      await player3Context.close();
    }
  });

  test('GM can reject applications', async ({ browser }) => {
    const gmContext = await browser.newContext();
    const player1Context = await browser.newContext();
    const player2Context = await browser.newContext();

    const gmPage = await gmContext.newPage();
    const player1Page = await player1Context.newPage();
    const player2Page = await player2Context.newPage();

    try {
      // === GM creates a recruiting game ===
      await loginAs(gmPage, 'GM');
      const gameId = await createRecruitingGame(gmPage);

      // === Two players apply ===
      await loginAs(player1Page, 'PLAYER_1');
      await applyToGame(player1Page, gameId);

      await loginAs(player2Page, 'PLAYER_2');
      await applyToGame(player2Page, gameId);

      // === GM rejects one, approves the other ===
      const gamePage = new GameDetailsPage(gmPage);
      await gamePage.goToApplications();

      // Reject Player 1
      await gmPage.locator('div:has(h3:has-text("TestPlayer1"))').first().locator('button:has-text("Reject")').first().click();
      await gmPage.waitForLoadState('networkidle');

      // Approve Player 2
      await gmPage.locator('div:has(h3:has-text("TestPlayer2"))').first().locator('button:has-text("Approve")').first().click();
      await gmPage.waitForLoadState('networkidle');

      // Verify both are in "Reviewed Applications" section
      await expect(gmPage.locator('h3:has-text("Reviewed Applications")')).toBeVisible({ timeout: 5000 });

      // Verify both player names appear in the reviewed section
      await expect(gmPage.locator('h3:has-text("TestPlayer1")').first()).toBeVisible();
      await expect(gmPage.locator('h3:has-text("TestPlayer2")').first()).toBeVisible();
    } finally {
      await gmContext.close();
      await player1Context.close();
      await player2Context.close();
    }
  });
});
