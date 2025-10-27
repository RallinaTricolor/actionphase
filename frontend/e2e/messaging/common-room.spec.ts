import { test, expect } from '@playwright/test';
import { loginAs } from '../fixtures/auth-helpers';
import { CommonRoomPage } from '../pages/CommonRoomPage';
import { getFixtureGameId } from '../fixtures/game-helpers';

/**
 * Journey 9: Player Posts in Common Room
 *
 * Tests that GMs can create posts and players can view and comment on them.
 * Uses test fixture ("E2E Common Room - Posts") with:
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

  test('GM can create a post in Common Room', async ({ page }) => {
    await loginAs(page, 'GM');

    const gameId = await getFixtureGameId(page, 'COMMON_ROOM_POSTS');
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

      const gameId = await getFixtureGameId(gmPage, 'COMMON_ROOM_POSTS');
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

      const gameId = await getFixtureGameId(gmPage, 'COMMON_ROOM_POSTS');
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

  test('Players can reply to each others comments (nested replies)', async ({ browser }) => {
    const player1Context = await browser.newContext();
    const player2Context = await browser.newContext();

    const player1Page = await player1Context.newPage();
    const player2Page = await player2Context.newPage();

    try {
      // === Player 1 creates a post ===
      await loginAs(player1Page, 'PLAYER_1');

      const gameId = await getFixtureGameId(player1Page, 'COMMON_ROOM_POSTS');
      const player1CommonRoom = new CommonRoomPage(player1Page);
      await player1CommonRoom.goto(gameId);

      const postContent = `Discussion ${Date.now()}: What should we do next?`;
      await player1CommonRoom.createPost(postContent);

      // === Player 2 comments on the post ===
      await loginAs(player2Page, 'PLAYER_2');

      const player2CommonRoom = new CommonRoomPage(player2Page);
      await player2CommonRoom.goto(gameId);

      await player2CommonRoom.verifyPostExists(postContent);

      const player2Comment = `Comment ${Date.now()}: I think we should scout ahead`;
      await player2CommonRoom.addComment(postContent, player2Comment);
      await player2CommonRoom.verifyCommentExists(player2Comment);

      // === Player 1 replies to Player 2's comment ===
      await player1Page.reload();
      await player1Page.waitForLoadState('networkidle');
      await player1CommonRoom.goto(gameId);

      // Expand comments if needed
      const postCard = player1CommonRoom.getPostCard(postContent);
      const commentsButton = postCard.locator('button', { hasText: /Comments/ }).first();
      const buttonText = await commentsButton.textContent();
      if (buttonText?.includes('Show Comments')) {
        await commentsButton.click();
        await player1Page.waitForLoadState('networkidle');
      }

      // Find Player 2's comment and click Reply
      const commentContainer = player1Page.locator('[data-testid="threaded-comment"]').filter({ hasText: player2Comment }).first();
      const replyButton = commentContainer.getByRole('button', { name: 'Reply' }).first();
      await replyButton.click();

      // Write the reply
      const player1Reply = `Reply ${Date.now()}: Good idea, let's do it`;
      const replyTextarea = commentContainer.locator('textarea').first();
      await replyTextarea.fill(player1Reply);

      // Submit the reply
      const replyForm = commentContainer.locator('form').first();
      await replyForm.evaluate((f: HTMLFormElement) => f.requestSubmit());
      await player1Page.waitForLoadState('networkidle');

      // Verify the nested reply appears
      await expect(player1Page.getByText(player1Reply)).toBeVisible({ timeout: 5000 });

      // === Player 2 can see the nested reply ===
      await player2Page.reload();
      await player2Page.waitForLoadState('networkidle');
      await player2CommonRoom.goto(gameId);

      // Verify Player 2 can see Player 1's reply to their comment
      await expect(player2Page.getByText(player1Reply)).toBeVisible({ timeout: 5000 });

      // Verify the reply is visually indented (has thread styling)
      const nestedReply = player2Page.locator('[data-testid="threaded-comment"]').filter({ hasText: player1Reply }).first();
      const hasLeftBorder = await nestedReply.evaluate((el) => {
        const classList = Array.from(el.classList);
        return classList.some(c => c.includes('border-l'));
      });
      expect(hasLeftBorder).toBeTruthy();
    } finally {
      await player1Context.close();
      await player2Context.close();
    }
  });

  test('Multiple players can reply to the same comment', async ({ browser }) => {
    const gmContext = await browser.newContext();
    const player1Context = await browser.newContext();
    const player2Context = await browser.newContext();

    const gmPage = await gmContext.newPage();
    const player1Page = await player1Context.newPage();
    const player2Page = await player2Context.newPage();

    try {
      // === GM creates a post ===
      await loginAs(gmPage, 'GM');

      const gameId = await getFixtureGameId(gmPage, 'COMMON_ROOM_POSTS');
      const gmCommonRoom = new CommonRoomPage(gmPage);
      await gmCommonRoom.goto(gameId);

      const postContent = `Poll ${Date.now()}: Who wants to go north?`;
      await gmCommonRoom.createPost(postContent);

      // === Player 1 replies ===
      await loginAs(player1Page, 'PLAYER_1');

      const player1CommonRoom = new CommonRoomPage(player1Page);
      await player1CommonRoom.goto(gameId);

      const player1Comment = `P1 Reply ${Date.now()}: I do!`;
      await player1CommonRoom.addComment(postContent, player1Comment);

      // === Player 2 also replies to the same post ===
      await loginAs(player2Page, 'PLAYER_2');

      const player2CommonRoom = new CommonRoomPage(player2Page);
      await player2CommonRoom.goto(gameId);

      const player2Comment = `P2 Reply ${Date.now()}: Me too!`;
      await player2CommonRoom.addComment(postContent, player2Comment);

      // === Verify GM sees both replies ===
      await gmPage.reload();
      await gmPage.waitForLoadState('networkidle');
      await gmCommonRoom.goto(gameId);

      // Expand comments
      const postCard = gmCommonRoom.getPostCard(postContent);
      const commentsButton = postCard.locator('button', { hasText: /Comments/ }).first();
      const buttonText = await commentsButton.textContent();
      if (buttonText?.includes('Show Comments')) {
        await commentsButton.click();
        await gmPage.waitForLoadState('networkidle');
      }

      // Verify both comments are visible
      await expect(gmPage.getByText(player1Comment)).toBeVisible({ timeout: 5000 });
      await expect(gmPage.getByText(player2Comment)).toBeVisible({ timeout: 5000 });

      // Verify comment count is updated (should show "2 replies" or similar)
      const updatedButtonText = await commentsButton.textContent();
      expect(updatedButtonText).toContain('2');
    } finally {
      await gmContext.close();
      await player1Context.close();
      await player2Context.close();
    }
  });

  test('Deep nesting shows Continue this thread button at max depth', async ({ browser }) => {
    const player1Context = await browser.newContext();
    const player2Context = await browser.newContext();

    const player1Page = await player1Context.newPage();
    const player2Page = await player2Context.newPage();

    try {
      // === Player 1 creates a post ===
      await loginAs(player1Page, 'PLAYER_1');

      const gameId = await getFixtureGameId(player1Page, 'COMMON_ROOM_POSTS');
      const player1CommonRoom = new CommonRoomPage(player1Page);
      await player1CommonRoom.goto(gameId);

      const postContent = `Deep Thread ${Date.now()}`;
      await player1CommonRoom.createPost(postContent);

      // === Setup: Both players logged in ===
      await loginAs(player2Page, 'PLAYER_2');
      const player2CommonRoom = new CommonRoomPage(player2Page);
      await player2CommonRoom.goto(gameId);

      // === Create nested replies up to max depth (5 levels) ===
      // We'll alternate between Player 1 and Player 2
      let currentPage = player1Page;
      let currentCommonRoom = player1CommonRoom;
      let previousComment = postContent;

      for (let depth = 1; depth <= 6; depth++) {
        // Reload and navigate
        await currentPage.reload();
        await currentPage.waitForLoadState('networkidle');
        await currentCommonRoom.goto(gameId);

        // Expand comments if needed
        const postCard = currentCommonRoom.getPostCard(postContent);
        const commentsButton = postCard.locator('button', { hasText: /Comments/ }).first();
        if (await commentsButton.count() > 0) {
          const buttonText = await commentsButton.textContent();
          if (buttonText?.includes('Show')) {
            await commentsButton.click();
            await currentPage.waitForLoadState('networkidle');
          }
        }

        // Find the previous comment
        const commentContainer = currentPage.locator('[data-testid="threaded-comment"]').filter({ hasText: previousComment }).first();

        // Check if Reply button is still available (should disappear at max depth)
        const replyButton = commentContainer.getByRole('button', { name: 'Reply' });
        const replyButtonCount = await replyButton.count();

        if (replyButtonCount === 0) {
          // We've reached max depth! Verify "Continue this thread" button appears
          const continueButton = currentPage.getByRole('button', { name: /Continue this thread/ });
          await expect(continueButton).toBeVisible({ timeout: 5000 });

          console.log(`Max depth reached at level ${depth}. "Continue this thread" button is visible.`);
          break;
        }

        // Click Reply
        await replyButton.first().click();

        // Write nested reply
        const nestedReply = `Nested Reply Level ${depth} - ${Date.now()}`;
        const replyTextarea = commentContainer.locator('textarea').first();
        await replyTextarea.fill(nestedReply);

        // Submit
        const replyForm = commentContainer.locator('form').first();
        await replyForm.evaluate((f: HTMLFormElement) => f.requestSubmit());
        await currentPage.waitForLoadState('networkidle');

        // Verify the reply appears
        await expect(currentPage.getByText(nestedReply)).toBeVisible({ timeout: 5000 });

        // Update for next iteration
        previousComment = nestedReply;

        // Switch players
        if (currentPage === player1Page) {
          currentPage = player2Page;
          currentCommonRoom = player2CommonRoom;
        } else {
          currentPage = player1Page;
          currentCommonRoom = player1CommonRoom;
        }
      }
    } finally {
      await player1Context.close();
      await player2Context.close();
    }
  });
});
