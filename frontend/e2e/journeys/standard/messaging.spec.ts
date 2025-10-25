import { test, expect } from '@playwright/test';
import { tagTest, tags } from '../../fixtures/test-tags';
import { loginAs } from '../../fixtures/auth-helpers';
import { getFixtureGameId } from '../../fixtures/game-helpers';

/**
 * Journey 4: Messaging Workflow
 *
 * Tests the messaging and communication workflow:
 * - GM broadcasts messages via posts
 * - Players create and reply to posts
 * - Conversation functionality
 * - Notification system
 *
 * Uses dedicated Common Room fixture game with messaging enabled
 */
test.describe.skip('Messaging Journey', () => {

  test(tagTest([tags.MESSAGE, tags.E2E], 'GM can create and publish a post'), async ({ page }) => {
    // Step 1: Login as GM
    await loginAs(page, 'GM');

    // Step 2: Navigate to dedicated Common Room game
    const gameId = await getFixtureGameId(page, 'COMMON_ROOM_POSTS');
    await page.goto(`/games/${gameId}`);
    await page.waitForLoadState('networkidle');

    // Step 3: Navigate to Common Room tab
    const commonRoomTab = page.locator('button[role="tab"]:has-text("Common Room")');
    await expect(commonRoomTab).toBeVisible({ timeout: 5000 });
    await commonRoomTab.click();
    await page.waitForLoadState('networkidle');

    // Step 4: Verify we're in the game and can see the common room
    await expect(page.locator('text=E2E Common Room - Posts')).toBeVisible();

    // Step 5: Verify "Create Post" button exists
    const createPostButton = page.locator('button:has-text("Create Post"), button:has-text("New Post")').first();
    await expect(createPostButton).toBeVisible({ timeout: 5000 });

    // Step 5: Click to create new post
    await createPostButton.click();
    await page.waitForLoadState('networkidle');

    // Step 6: Fill in post form
    const titleInput = page.locator('input[name="title"], input[placeholder*="title"]').first();
    await expect(titleInput).toBeVisible();

    const timestamp = Date.now();
    const postTitle = `E2E Test Post ${timestamp}`;
    await titleInput.fill(postTitle);

    // Step 7: Fill in content
    const contentTextarea = page.locator('textarea[name="content"], textarea[placeholder*="content"]').first();
    await expect(contentTextarea).toBeVisible();
    await contentTextarea.fill(`Broadcast message to all players - Test ${timestamp}`);

    // Step 8: Submit the post
    const submitButton = page.locator('button[type="submit"]:has-text("Post"), button[type="submit"]:has-text("Create")').first();
    await expect(submitButton).toBeVisible();
    await submitButton.click();
    await page.waitForLoadState('networkidle');

    // Step 9: Verify post appears in the list
    await expect(page.locator(`text=${postTitle}`)).toBeVisible({ timeout: 5000 });
  });

  test(tagTest([tags.MESSAGE, tags.E2E], 'Player can reply to a post'), async ({ page }) => {
    // Step 1: Login as player
    await loginAs(page, 'PLAYER_1');

    // Step 2: Navigate to game
    const gameId = await getFixtureGameId(page, 'COMMON_ROOM_POSTS');
    await page.goto(`/games/${gameId}`);
    await page.waitForLoadState('networkidle');

    // Step 3: Navigate to Common Room tab
    const commonRoomTab = page.locator('button[role="tab"]:has-text("Common Room")');
    await expect(commonRoomTab).toBeVisible({ timeout: 5000 });
    await commonRoomTab.click();
    await page.waitForLoadState('networkidle');

    // Step 4: Verify game page loaded
    await expect(page.locator('text=E2E Common Room - Posts')).toBeVisible();

    // Step 5: Wait for posts area to be visible
    const postsContainer = page.locator('[data-testid="posts-container"], .posts-list, main').first();
    await expect(postsContainer).toBeVisible({ timeout: 5000 });

    // Step 6: Create a new post first to ensure we have something to reply to
    const createPostButton = page.locator('button:has-text("Create Post"), button:has-text("New Post")').first();
    await expect(createPostButton).toBeVisible();
    await createPostButton.click();
    await page.waitForLoadState('networkidle');

    const timestamp = Date.now();
    const postTitle = `Test Post for Reply ${timestamp}`;

    const titleInput = page.locator('input[name="title"]').first();
    await titleInput.fill(postTitle);

    const contentTextarea = page.locator('textarea[name="content"]').first();
    await contentTextarea.fill('Original post content');

    const submitButton = page.locator('button[type="submit"]:has-text("Post"), button[type="submit"]:has-text("Create")').first();
    await submitButton.click();
    await page.waitForLoadState('networkidle');

    // Step 6: Verify post was created
    await expect(page.locator(`text=${postTitle}`)).toBeVisible();

    // Step 7: Click on the post to view it
    await page.locator(`text=${postTitle}`).click();
    await page.waitForLoadState('networkidle');

    // Step 8: Verify comment form is visible
    const commentTextarea = page.locator('textarea[placeholder*="comment"], textarea[placeholder*="reply"], textarea').first();
    await expect(commentTextarea).toBeVisible({ timeout: 5000 });

    // Step 9: Add a reply
    const replyContent = `E2E test reply ${timestamp}`;
    await commentTextarea.fill(replyContent);

    // Step 10: Submit the reply
    const replyButton = page.locator('button:has-text("Comment"), button:has-text("Reply"), button[type="submit"]').first();
    await expect(replyButton).toBeVisible();
    await replyButton.click();
    await page.waitForLoadState('networkidle');

    // Step 11: Verify reply appears
    await expect(page.locator(`text=${replyContent}`)).toBeVisible({ timeout: 5000 });
  });

  test(tagTest([tags.MESSAGE, tags.E2E], 'Player can view list of posts'), async ({ page }) => {
    // Step 1: Login as player
    await loginAs(page, 'PLAYER_2');

    // Step 2: Navigate to game
    const gameId = await getFixtureGameId(page, 'COMMON_ROOM_POSTS');
    await page.goto(`/games/${gameId}`);
    await page.waitForLoadState('networkidle');

    // Step 3: Navigate to Common Room tab
    const commonRoomTab = page.locator('button[role="tab"]:has-text("Common Room")');
    await expect(commonRoomTab).toBeVisible({ timeout: 5000 });
    await commonRoomTab.click();
    await page.waitForLoadState('networkidle');

    // Step 4: Verify posts area is visible
    const postsContainer = page.locator('[data-testid="posts-container"], .posts-list, main').first();
    await expect(postsContainer).toBeVisible({ timeout: 5000 });

    // Step 5: Verify "Create Post" button is available (confirms user has post access)
    const createPostButton = page.locator('button:has-text("Create Post"), button:has-text("New Post")').first();
    await expect(createPostButton).toBeVisible();

    // Step 5: Count posts - there should be at least the posts created by previous tests or fixtures
    const postElements = page.locator('[data-testid="post-card"], .post-item, article').filter({ hasText: /Test|E2E/ });

    // Wait for at least one post to appear (may be from fixtures or previous tests)
    await expect(postElements.first()).toBeVisible({ timeout: 5000 });
  });

  test(tagTest([tags.MESSAGE, tags.E2E], 'Character mentions work in posts'), async ({ browser }) => {
    // Step 1: Create two separate browser contexts
    const player1Context = await browser.newContext();
    const player2Context = await browser.newContext();

    const player1Page = await player1Context.newPage();
    const player2Page = await player2Context.newPage();

    try {
      // Step 2: Login as different players
      await loginAs(player1Page, 'PLAYER_1');
      await loginAs(player2Page, 'PLAYER_2');

      // Step 3: Navigate both to the game
      const gameId = await getFixtureGameId(player1Page, 'COMMON_ROOM_POSTS');

      await player1Page.goto(`/games/${gameId}`);
      await player1Page.waitForLoadState('networkidle');

      await player2Page.goto(`/games/${gameId}`);
      await player2Page.waitForLoadState('networkidle');

      // Step 4: Navigate both to Common Room tab
      const commonRoomTab1 = player1Page.locator('button[role="tab"]:has-text("Common Room")');
      await expect(commonRoomTab1).toBeVisible({ timeout: 5000 });
      await commonRoomTab1.click();
      await player1Page.waitForLoadState('networkidle');

      const commonRoomTab2 = player2Page.locator('button[role="tab"]:has-text("Common Room")');
      await expect(commonRoomTab2).toBeVisible({ timeout: 5000 });
      await commonRoomTab2.click();
      await player2Page.waitForLoadState('networkidle');

      // Step 5: Player 1 creates a post with a mention
      const createPostButton = player1Page.locator('button:has-text("Create Post")').first();
      await expect(createPostButton).toBeVisible();
      await createPostButton.click();
      await player1Page.waitForLoadState('networkidle');

      const timestamp = Date.now();
      const titleInput = player1Page.locator('input[name="title"]').first();
      await titleInput.fill(`Mention Test ${timestamp}`);

      const contentTextarea = player1Page.locator('textarea[name="content"]').first();
      await contentTextarea.fill(`Hey @TestPlayer2, check this out!`);

      const submitButton = player1Page.locator('button[type="submit"]:has-text("Post"), button[type="submit"]:has-text("Create")').first();
      await submitButton.click();
      await player1Page.waitForLoadState('networkidle');

      // Step 5: Verify post was created with mention
      await expect(player1Page.locator(`text=Mention Test ${timestamp}`)).toBeVisible();
      await expect(player1Page.locator('text=@TestPlayer2')).toBeVisible();

      // Step 6: Player 2 should be able to see the post with mention
      await player2Page.reload();
      await player2Page.waitForLoadState('networkidle');

      await expect(player2Page.locator(`text=Mention Test ${timestamp}`)).toBeVisible({ timeout: 5000 });
      await expect(player2Page.locator('text=@TestPlayer2')).toBeVisible();

    } finally {
      await player1Context.close();
      await player2Context.close();
    }
  });

  test(tagTest([tags.MESSAGE, tags.E2E], 'Nested replies create threaded discussions'), async ({ page }) => {
    // Step 1: Login as player
    await loginAs(page, 'PLAYER_1');

    // Step 2: Navigate to game
    const gameId = await getFixtureGameId(page, 'COMMON_ROOM_POSTS');
    await page.goto(`/games/${gameId}`);
    await page.waitForLoadState('networkidle');

    // Step 3: Navigate to Common Room tab
    const commonRoomTab = page.locator('button[role="tab"]:has-text("Common Room")');
    await expect(commonRoomTab).toBeVisible({ timeout: 5000 });
    await commonRoomTab.click();
    await page.waitForLoadState('networkidle');

    // Step 4: Create a new post
    const createPostButton = page.locator('button:has-text("Create Post")').first();
    await createPostButton.click();
    await page.waitForLoadState('networkidle');

    const timestamp = Date.now();
    const titleInput = page.locator('input[name="title"]').first();
    await titleInput.fill(`Thread Test ${timestamp}`);

    const contentTextarea = page.locator('textarea[name="content"]').first();
    await contentTextarea.fill('Starting a threaded discussion');

    const submitButton = page.locator('button[type="submit"]:has-text("Post")').first();
    await submitButton.click();
    await page.waitForLoadState('networkidle');

    // Step 4: Click on post to view it
    await page.locator(`text=Thread Test ${timestamp}`).click();
    await page.waitForLoadState('networkidle');

    // Step 5: Add first-level comment
    const commentTextarea = page.locator('textarea[placeholder*="comment"], textarea[placeholder*="reply"], textarea').first();
    await commentTextarea.fill('First level comment');

    const replyButton = page.locator('button:has-text("Comment"), button:has-text("Reply")').first();
    await replyButton.click();
    await page.waitForLoadState('networkidle');

    // Step 6: Verify first comment appears
    await expect(page.locator('text=First level comment')).toBeVisible();

    // Step 7: Look for reply button on the comment to create nested reply
    const nestedReplyButton = page.locator('button:has-text("Reply")').last();
    await expect(nestedReplyButton).toBeVisible({ timeout: 5000 });
    await nestedReplyButton.click();
    await page.waitForTimeout(500);

    // Step 8: Add nested reply
    const nestedTextarea = page.locator('textarea').last();
    await expect(nestedTextarea).toBeVisible();
    await nestedTextarea.fill('Nested reply - second level');

    const nestedSubmitButton = page.locator('button:has-text("Comment"), button:has-text("Reply")').last();
    await nestedSubmitButton.click();
    await page.waitForLoadState('networkidle');

    // Step 9: Verify nested reply appears
    await expect(page.locator('text=Nested reply - second level')).toBeVisible();
  });
});
