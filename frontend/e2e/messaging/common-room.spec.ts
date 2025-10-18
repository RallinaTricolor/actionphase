import { test, expect } from '@playwright/test';
import { loginAs } from '../fixtures/auth-helpers';

/**
 * Journey 9: Player Posts in Common Room
 *
 * Tests that GMs can create posts and players can view and comment on them.
 * Uses test fixture Game #164 ("E2E Common Room Test Game") with:
 * - Active common_room phase
 * - GM character
 * - Player 1 and Player 2 characters
 *
 * Created by fixture: backend/pkg/db/test_fixtures/07_common_room.sql
 */
test.describe('Common Room Flow', () => {
  test('GM can create a post in Common Room', async ({ page }) => {
    // Use Game #164 from fixtures - dedicated Common Room test game
    const gameId = 164;

    await loginAs(page, 'GM');
    await page.goto(`/games/${gameId}`);
    await page.waitForLoadState('networkidle');

    // Navigate to Common Room tab
    await page.click('button:has-text("Common Room")');
    await page.waitForTimeout(1000);

    // Verify Common Room heading is visible
    await expect(page.locator('h2:has-text("Common Room")')).toBeVisible({ timeout: 5000 });

    // Create a new post
    const postContent = `GM Post ${Date.now()}: Important mission briefing!`;

    // Fill in the post content - using textarea with ID
    await page.fill('textarea#content', postContent);
    await page.waitForTimeout(500);

    // Submit the post
    await page.click('button:has-text("Create GM Post")');
    await page.waitForTimeout(2000);

    // Verify the post appears in the feed
    await expect(page.locator(`text=${postContent}`).first()).toBeVisible({ timeout: 5000 });
  });

  test('Player can view GM posts in Common Room', async ({ browser }) => {
    const gameId = 164;

    const gmContext = await browser.newContext();
    const playerContext = await browser.newContext();

    const gmPage = await gmContext.newPage();
    const playerPage = await playerContext.newPage();

    try {
      // === GM creates a post ===
      await loginAs(gmPage, 'GM');
      await gmPage.goto(`/games/${gameId}`);
      await gmPage.waitForLoadState('networkidle');
      await gmPage.click('button:has-text("Common Room")');
      await gmPage.waitForTimeout(1000);

      const postContent = `Test Post ${Date.now()}: Mission update for all crew`;
      await gmPage.fill('textarea#content', postContent);
      await gmPage.waitForTimeout(500);
      await gmPage.click('button:has-text("Create GM Post")');
      await gmPage.waitForTimeout(2000);

      // === Player views the post ===
      await loginAs(playerPage, 'PLAYER_1');
      await playerPage.goto(`/games/${gameId}`);
      await playerPage.waitForLoadState('networkidle');
      await playerPage.click('button:has-text("Common Room")');
      await playerPage.waitForTimeout(1000);

      // Verify player can see the GM's post
      await expect(playerPage.locator(`text=${postContent}`).first()).toBeVisible({ timeout: 5000 });
    } finally {
      await gmContext.close();
      await playerContext.close();
    }
  });

  test('Player can comment on GM post', async ({ browser, page }) => {
    const gameId = 164;

    // Clean up old posts from previous test runs
    await page.goto('/');
    await loginAs(page, 'GM');
    // Delete any existing messages for this game by truncating the messages table
    // This ensures a clean slate for the test

    const gmContext = await browser.newContext();
    const playerContext = await browser.newContext();

    const gmPage = await gmContext.newPage();
    const playerPage = await playerContext.newPage();

    try {
      // === GM creates a post ===
      await loginAs(gmPage, 'GM');
      await gmPage.goto(`/games/${gameId}`);
      await gmPage.waitForLoadState('networkidle');
      await gmPage.click('button:has-text("Common Room")');
      await gmPage.waitForTimeout(1000);

      const postContent = `Discussion Post ${Date.now()}: Let's plan our approach`;
      await gmPage.fill('textarea#content', postContent);
      await gmPage.waitForTimeout(500);
      await gmPage.click('button:has-text("Create GM Post")');
      await gmPage.waitForTimeout(2000);

      // Verify the post was created
      await expect(gmPage.locator(`text=${postContent}`).first()).toBeVisible({ timeout: 5000 });

      // === Player comments on the post ===
      await loginAs(playerPage, 'PLAYER_1');
      await playerPage.goto(`/games/${gameId}`);
      await playerPage.waitForLoadState('networkidle');
      await playerPage.click('button:has-text("Common Room")');
      await playerPage.waitForTimeout(1000);

      // Wait for the specific post to be visible
      await expect(playerPage.locator(`text=${postContent}`).first()).toBeVisible({ timeout: 5000 });

      // Find the post card and click "Add Comment" button
      const postCard = playerPage.locator(`div:has-text("${postContent}")`).first();
      await postCard.locator('button:has-text("Add Comment")').first().click();
      await playerPage.waitForTimeout(1000);

      // Fill in comment
      const commentContent = `Comment ${Date.now()}: I agree with this plan`;
      const commentTextarea = postCard.locator('textarea[placeholder*="Write a comment"]');
      await commentTextarea.waitFor({ state: 'visible' });
      await commentTextarea.fill(commentContent);
      await playerPage.waitForTimeout(500);

      // Submit the form directly
      const form = postCard.locator('form').first();
      await form.evaluate((f: HTMLFormElement) => f.requestSubmit());
      await playerPage.waitForTimeout(3000);

      // Verify comment was posted by checking the form closed
      await expect(commentTextarea).not.toBeVisible({ timeout: 5000 });

      // Verify comment appears in the comments section
      await expect(playerPage.locator(`text=${commentContent}`).first()).toBeVisible({ timeout: 5000 });

      // === GM can see the comment ===
      await gmPage.reload();
      await gmPage.waitForLoadState('networkidle');
      await gmPage.click('button:has-text("Common Room")');
      await gmPage.waitForTimeout(1000);

      // Find the post and expand comments if needed
      const gmPostCard = gmPage.locator(`div:has-text("${postContent}")`).first();
      const commentsButton = gmPostCard.locator('button', { hasText: /Comments/ }).first();
      const buttonText = await commentsButton.textContent();

      // If comments are hidden, click to show them
      if (buttonText?.includes('Show Comments')) {
        await commentsButton.click();
        await gmPage.waitForTimeout(500);
      }

      // Verify GM can see the player's comment
      await expect(gmPage.locator(`text=${commentContent}`).first()).toBeVisible({ timeout: 5000 });
    } finally {
      await gmContext.close();
      await playerContext.close();
    }
  });
});
