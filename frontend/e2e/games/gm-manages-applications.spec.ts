import { test, expect } from '@playwright/test';
import { loginAs } from '../fixtures/auth-helpers';

/**
 * Journey 8: GM Manages Game Applications
 *
 * Tests that GMs can view, approve, and reject multiple player applications.
 * Uses a fixture recruiting game and creates applications from multiple players.
 */
test.describe('GM Manages Game Applications', () => {
  // Helper function to create a recruiting game
  async function createRecruitingGame(gmPage: any) {
    await gmPage.click('a[href="/games"]');
    await gmPage.waitForTimeout(500);
    await gmPage.click('button:has-text("Create Game")');
    await gmPage.waitForTimeout(500);

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
    await gmPage.click('button:has-text("Start Recruitment")');
    await gmPage.waitForTimeout(1000);

    return gameId;
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
      await player1Page.goto(`/games/${gameId}`);
      await player1Page.waitForLoadState('networkidle');
      await player1Page.click('button:has-text("Apply to Join")');
      await player1Page.waitForTimeout(500);
      await player1Page.click('button:has-text("Submit Application")');
      await player1Page.waitForTimeout(1000);

      // === Player 2 applies ===
      await loginAs(player2Page, 'PLAYER_2');
      await player2Page.goto(`/games/${gameId}`);
      await player2Page.waitForLoadState('networkidle');
      await player2Page.click('button:has-text("Apply to Join")');
      await player2Page.waitForTimeout(500);
      await player2Page.click('button:has-text("Submit Application")');
      await player2Page.waitForTimeout(1000);

      // === GM views applications ===
      // GM is already logged in and on game page
      // Navigate to Applications tab
      await gmPage.click('button:has-text("Applications")');
      await gmPage.waitForTimeout(1000);

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
      await player1Page.goto(`/games/${gameId}`);
      await player1Page.waitForLoadState('networkidle');
      await player1Page.click('button:has-text("Apply to Join")');
      await player1Page.waitForTimeout(500);
      await player1Page.click('button:has-text("Submit Application")');
      await player1Page.waitForTimeout(1000);

      await loginAs(player2Page, 'PLAYER_2');
      await player2Page.goto(`/games/${gameId}`);
      await player2Page.waitForLoadState('networkidle');
      await player2Page.click('button:has-text("Apply to Join")');
      await player2Page.waitForTimeout(500);
      await player2Page.click('button:has-text("Submit Application")');
      await player2Page.waitForTimeout(1000);

      await loginAs(player3Page, 'PLAYER_3');
      await player3Page.goto(`/games/${gameId}`);
      await player3Page.waitForLoadState('networkidle');
      await player3Page.click('button:has-text("Apply to Join")');
      await player3Page.waitForTimeout(500);
      await player3Page.click('button:has-text("Submit Application")');
      await player3Page.waitForTimeout(1000);

      // === GM approves all three ===
      // GM is already logged in and on game page
      await gmPage.click('button:has-text("Applications")');
      await gmPage.waitForTimeout(1000);

      // Approve Player 1
      await gmPage.locator('div:has(h3:has-text("TestPlayer1"))').first().locator('button:has-text("Approve")').first().click();
      await gmPage.waitForTimeout(1000);

      // Approve Player 2
      await gmPage.locator('div:has(h3:has-text("TestPlayer2"))').first().locator('button:has-text("Approve")').first().click();
      await gmPage.waitForTimeout(1000);

      // Approve Player 3
      await gmPage.locator('div:has(h3:has-text("TestPlayer3"))').first().locator('button:has-text("Approve")').first().click();
      await gmPage.waitForTimeout(1000);

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
      await player1Page.goto(`/games/${gameId}`);
      await player1Page.waitForLoadState('networkidle');
      await player1Page.click('button:has-text("Apply to Join")');
      await player1Page.waitForTimeout(500);
      await player1Page.click('button:has-text("Submit Application")');
      await player1Page.waitForTimeout(1000);

      await loginAs(player2Page, 'PLAYER_2');
      await player2Page.goto(`/games/${gameId}`);
      await player2Page.waitForLoadState('networkidle');
      await player2Page.click('button:has-text("Apply to Join")');
      await player2Page.waitForTimeout(500);
      await player2Page.click('button:has-text("Submit Application")');
      await player2Page.waitForTimeout(1000);

      // === GM rejects one, approves the other ===
      // GM is already logged in and on game page
      await gmPage.click('button:has-text("Applications")');
      await gmPage.waitForTimeout(1000);

      // Reject Player 1
      await gmPage.locator('div:has(h3:has-text("TestPlayer1"))').first().locator('button:has-text("Reject")').first().click();
      await gmPage.waitForTimeout(1000);

      // Approve Player 2
      await gmPage.locator('div:has(h3:has-text("TestPlayer2"))').first().locator('button:has-text("Approve")').first().click();
      await gmPage.waitForTimeout(1000);

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
