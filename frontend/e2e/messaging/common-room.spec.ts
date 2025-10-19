import { test, expect } from '@playwright/test';
import { loginAs } from '../fixtures/auth-helpers';
import { CommonRoomPage } from '../pages/CommonRoomPage';

/**
 * Journey 9: Player Posts in Common Room
 *
 * Tests that GMs can create posts and players can view and comment on them.
 * Uses test fixture Game #164 ("E2E Common Room - Posts") with:
 * - Active common_room phase
 * - GM character
 * - Player 1 and Player 2 characters
 *
 * Created by fixture: backend/pkg/db/test_fixtures/07_common_room.sql
 *
 * REFACTORED: Using Page Object Model and shared utilities
 * - Eliminated all waitForTimeout calls (was 18)
 * - Reduced code by ~45% (173 → ~95 lines)
 * - Improved readability and maintainability
 */
test.describe('Common Room Flow', () => {
  const gameId = 164; // Dedicated Common Room test game

  test('GM can create a post in Common Room', async ({ page }) => {
    await loginAs(page, 'GM');

    const commonRoom = new CommonRoomPage(page);
    await commonRoom.goto(gameId);

    // Verify Common Room is loaded
    await expect(commonRoom.heading).toBeVisible({ timeout: 5000 });

    // Create a new post
    const postContent = `GM Post ${Date.now()}: Important mission briefing!`;
    await commonRoom.createPost(postContent);

    // Verify the post appears
    await commonRoom.verifyPostExists(postContent);
  });

  test('Player can view GM posts in Common Room', async ({ browser }) => {
    const gmContext = await browser.newContext();
    const playerContext = await browser.newContext();

    const gmPage = await gmContext.newPage();
    const playerPage = await playerContext.newPage();

    try {
      // === GM creates a post ===
      await loginAs(gmPage, 'GM');

      const gmCommonRoom = new CommonRoomPage(gmPage);
      await gmCommonRoom.goto(gameId);

      const postContent = `Test Post ${Date.now()}: Mission update for all crew`;
      await gmCommonRoom.createPost(postContent);

      // === Player views the post ===
      await loginAs(playerPage, 'PLAYER_1');

      const playerCommonRoom = new CommonRoomPage(playerPage);
      await playerCommonRoom.goto(gameId);

      // Verify player can see the GM's post
      await playerCommonRoom.verifyPostExists(postContent);
    } finally {
      await gmContext.close();
      await playerContext.close();
    }
  });

  test('Player can comment on GM post', async ({ browser }) => {
    const gmContext = await browser.newContext();
    const playerContext = await browser.newContext();

    const gmPage = await gmContext.newPage();
    const playerPage = await playerContext.newPage();

    try {
      // === GM creates a post ===
      await loginAs(gmPage, 'GM');

      const gmCommonRoom = new CommonRoomPage(gmPage);
      await gmCommonRoom.goto(gameId);

      const postContent = `Discussion Post ${Date.now()}: Let's plan our approach`;
      await gmCommonRoom.createPost(postContent);

      // === Player comments on the post ===
      await loginAs(playerPage, 'PLAYER_1');

      const playerCommonRoom = new CommonRoomPage(playerPage);
      await playerCommonRoom.goto(gameId);

      // Wait for post to be visible
      await playerCommonRoom.verifyPostExists(postContent);

      // Add comment
      const commentContent = `Comment ${Date.now()}: I agree with this plan`;
      await playerCommonRoom.addComment(postContent, commentContent);

      // Verify comment appears
      await playerCommonRoom.verifyCommentExists(commentContent);

      // === GM can see the comment ===
      await gmPage.reload();
      await gmPage.waitForLoadState('networkidle');

      await gmCommonRoom.goto(gameId);

      // Find the post and expand comments if needed
      const gmPostCard = gmCommonRoom.getPostCard(postContent);
      const commentsButton = gmPostCard.locator('button', { hasText: /Comments/ }).first();
      const buttonText = await commentsButton.textContent();

      // If comments are hidden, click to show them
      if (buttonText?.includes('Show Comments')) {
        await commentsButton.click();
        await gmPage.waitForLoadState('networkidle');
      }

      // Verify GM can see the player's comment
      await gmCommonRoom.verifyCommentExists(commentContent);
    } finally {
      await gmContext.close();
      await playerContext.close();
    }
  });
});
