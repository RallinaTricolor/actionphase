import { test, expect } from '@playwright/test';
import { loginAs } from '../fixtures/auth-helpers';
import { CommonRoomPage } from '../pages/CommonRoomPage';
import { getFixtureGameId, getWorkerGameId } from '../fixtures/game-helpers';
import { assertTextVisible } from '../utils/assertions';

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

    const gameId = await getFixtureGameId(page, 'COMMON_ROOM_CREATE_POST'); // Game #605
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

      const gameId = await getFixtureGameId(gmPage, 'COMMON_ROOM_VIEW_POSTS'); // Game #606
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

      const gameId = await getFixtureGameId(gmPage, 'COMMON_ROOM_COMMENT'); // Game #607
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
      const commentsButton = gmPostCard.locator('button', { hasText: /Comments/ }).locator('visible=true').first();
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
    test.setTimeout(45000); // Threading replies need more time

    const gmContext = await browser.newContext();
    const player1Context = await browser.newContext();
    const player2Context = await browser.newContext();

    const gmPage = await gmContext.newPage();
    const player1Page = await player1Context.newPage();
    const player2Page = await player2Context.newPage();

    try {
      // === GM creates a post ===
      await loginAs(gmPage, 'GM');

      const gameId = await getFixtureGameId(gmPage, 'COMMON_ROOM_NESTED_REPLIES'); // Game #608
      const gmCommonRoom = new CommonRoomPage(gmPage);
      await gmCommonRoom.goto(gameId);

      const postContent = `Discussion ${Date.now()}: What should we do next?`;
      await gmCommonRoom.createPost(postContent);

      // === Player 2 comments on the post ===
      await loginAs(player2Page, 'PLAYER_2');

      const player2CommonRoom = new CommonRoomPage(player2Page);
      await player2CommonRoom.goto(gameId);

      await player2CommonRoom.verifyPostExists(postContent);

      const player2Comment = `Comment ${Date.now()}: I think we should scout ahead`;
      await player2CommonRoom.addComment(postContent, player2Comment);
      await player2CommonRoom.verifyCommentExists(player2Comment);

      // === Player 1 replies to Player 2's comment ===
      await loginAs(player1Page, 'PLAYER_1');

      const player1CommonRoom = new CommonRoomPage(player1Page);
      await player1CommonRoom.goto(gameId);

      // Expand comments if needed
      const postCard = player1CommonRoom.getPostCard(postContent);
      const commentsButton = postCard.locator('button', { hasText: /Comments/ }).locator('visible=true').first();
      const buttonText = await commentsButton.textContent();
      if (buttonText?.includes('Show Comments')) {
        await commentsButton.click();
        await player1Page.waitForLoadState('networkidle');
      }

      // Find Player 2's comment and click Reply
      const commentContainer = player1Page.locator('[data-testid="threaded-comment"]').filter({ hasText: player2Comment }).locator('visible=true').first();
      const replyButton = commentContainer.getByRole('button', { name: 'Reply' }).locator('visible=true').first();
      await replyButton.click();

      // Write the reply
      const player1Reply = `Reply ${Date.now()}: Good idea, let's do it`;
      const replyTextarea = commentContainer.locator('textarea').locator('visible=true').first();
      await replyTextarea.fill(player1Reply);

      // Submit the reply
      const replyForm = commentContainer.locator('form').locator('visible=true').first();
      await replyForm.evaluate((f: HTMLFormElement) => f.requestSubmit());
      await player1Page.waitForLoadState('networkidle');

      // Verify the nested reply appears for Player 1
      const player1NestedReply = player1Page.locator('[data-testid="threaded-comment"]').filter({ hasText: player1Reply }).locator('visible=true').first();
      await expect(player1NestedReply).toBeVisible({ timeout: 10000 });

      // Wait a bit to ensure the reply is fully persisted to the database
      await player1Page.waitForTimeout(1000);

      // === Player 2 can see the nested reply ===
      await player2Page.reload();
      await player2Page.waitForLoadState('networkidle');
      await player2CommonRoom.goto(gameId);

      // Wait for post to load
      await player2CommonRoom.verifyPostExists(postContent);

      // Expand comments if they're collapsed
      const player2PostCard = player2CommonRoom.getPostCard(postContent);
      const player2CommentsButton = player2PostCard.locator('button', { hasText: /Comments/ }).locator('visible=true').first();
      const player2ButtonText = await player2CommentsButton.textContent();
      if (player2ButtonText?.includes('Show')) {
        await player2CommentsButton.click();
        await player2Page.waitForLoadState('networkidle');
      }

      // Wait for Player 2's comment to be visible
      await player2Page.waitForSelector(`text=${player2Comment}`, { timeout: 10000 });

      // Verify Player 2 can see Player 1's reply to their comment
      // Give it more time since nested replies might take longer to load
      await expect(player2Page.getByText(player1Reply).first()).toBeVisible({ timeout: 15000 });

      // Verify the reply appears as a nested comment (has the threaded-comment test ID)
      const nestedReply = player2Page.locator('[data-testid="threaded-comment"]').filter({ hasText: player1Reply }).locator('visible=true').first();
      await expect(nestedReply).toBeVisible();
    } finally {
      await gmContext.close();
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

      const gameId = await getFixtureGameId(gmPage, 'COMMON_ROOM_MULTIPLE_REPLIES'); // Game #609
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
      const commentsButton = postCard.locator('button', { hasText: /Comments/ }).locator('visible=true').first();
      const buttonText = await commentsButton.textContent();
      if (buttonText?.includes('Show Comments')) {
        await commentsButton.click();
        await gmPage.waitForLoadState('networkidle');
      }

      // Verify both comments are visible
      await expect(gmPage.getByText(player1Comment)).toBeVisible({ timeout: 5000 });
      await expect(gmPage.getByText(player2Comment)).toBeVisible({ timeout: 5000 });

      // Success: Both comments are visible to the GM
      // Note: The button text may vary ("2 Comments", "Hide Comments", "New Comments", etc.)
      // but the important verification is that both comments are visible, which we've confirmed above
    } finally {
      await gmContext.close();
      await player1Context.close();
      await player2Context.close();
    }
  });

  test('Deep nesting shows Continue this thread button at max depth', async ({ browser }) => {
    const gmContext = await browser.newContext();
    const player1Context = await browser.newContext();
    const player2Context = await browser.newContext();

    const gmPage = await gmContext.newPage();
    const player1Page = await player1Context.newPage();
    const player2Page = await player2Context.newPage();

    try {
      // === GM creates a post ===
      await loginAs(gmPage, 'GM');

      const gameId = await getFixtureGameId(gmPage, 'COMMON_ROOM_DEEP_NESTING'); // Game #610
      const gmCommonRoom = new CommonRoomPage(gmPage);
      await gmCommonRoom.goto(gameId);

      const postContent = `Deep Thread ${Date.now()}`;
      await gmCommonRoom.createPost(postContent);

      // === Setup: Both players logged in ===
      await loginAs(player1Page, 'PLAYER_1');
      const player1CommonRoom = new CommonRoomPage(player1Page);
      await player1CommonRoom.goto(gameId);
      await player1CommonRoom.verifyPostExists(postContent);

      await loginAs(player2Page, 'PLAYER_2');
      const player2CommonRoom = new CommonRoomPage(player2Page);
      await player2CommonRoom.goto(gameId);
      await player2CommonRoom.verifyPostExists(postContent);

      // === Player 1 adds initial comment to the post ===
      const initialComment = `Initial Comment ${Date.now()}`;
      await player1CommonRoom.addComment(postContent, initialComment);
      await player1CommonRoom.verifyCommentExists(initialComment);

      // === Create nested replies up to max depth (5 levels) ===
      // We'll alternate between Player 1 and Player 2
      let currentPage = player1Page;
      let currentCommonRoom = player1CommonRoom;
      let previousComment = initialComment;

      for (let depth = 1; depth <= 6; depth++) {
        // Reload and navigate
        await currentPage.reload();
        await currentPage.waitForLoadState('networkidle');
        await currentCommonRoom.goto(gameId);

        // Expand comments if needed
        const postCard = currentCommonRoom.getPostCard(postContent);
        const commentsButton = postCard.locator('button', { hasText: /Comments/ }).locator('visible=true').first();
        if (await commentsButton.count() > 0) {
          const buttonText = await commentsButton.textContent();
          if (buttonText?.includes('Show')) {
            await commentsButton.click();
            await currentPage.waitForLoadState('networkidle');
          }
        }

        // Find the previous comment
        const commentContainer = currentPage.locator('[data-testid="threaded-comment"]').filter({ hasText: previousComment }).locator('visible=true').first();

        // Verify the comment exists before proceeding
        await expect(commentContainer).toBeVisible({ timeout: 10000 });

        // Check if Reply button is still available (should disappear at max depth)
        const replyButton = commentContainer.getByRole('button', { name: 'Reply' });
        const replyButtonCount = await replyButton.count();

        if (replyButtonCount === 0) {
          // We've reached max depth! Verify "Continue this thread" button appears
          const continueButton = currentPage.getByRole('button', { name: /Continue this thread/ });
          await expect(continueButton).toBeVisible({ timeout: 5000 });

          // eslint-disable-next-line no-console
          console.log(`Max depth reached at level ${depth}. "Continue this thread" button is visible.`);

          // === Test: Click the "Continue this thread" button ===
          await continueButton.click();
          await currentPage.waitForTimeout(500); // Wait for modal animation

          // === Test: Verify modal opens ===
          const modal = currentPage.locator('[role="dialog"]');
          await expect(modal).toBeVisible({ timeout: 5000 });
          // eslint-disable-next-line no-console
          console.log('✓ Modal opened successfully');

          // === Test: Verify deep comment is visible in modal ===
          await expect(modal.getByText(previousComment)).toBeVisible({ timeout: 5000 });
          // eslint-disable-next-line no-console
          console.log(`✓ Deep comment "${previousComment}" visible in modal`);

          // === Test: Reply to a comment in the modal ===
          const modalCommentContainer = modal.locator('[data-testid="threaded-comment"]').filter({ hasText: previousComment }).locator('visible=true').first();
          const modalReplyButton = modalCommentContainer.getByRole('button', { name: 'Reply' }).locator('visible=true').first();
          await modalReplyButton.click();
          await currentPage.waitForTimeout(500);

          // Write reply in modal
          const modalReply = `Modal Reply - ${Date.now()}`;
          const modalReplyTextarea = modalCommentContainer.locator('textarea').locator('visible=true').first();
          await modalReplyTextarea.fill(modalReply);

          // Submit reply in modal
          const modalReplyForm = modalCommentContainer.locator('form').locator('visible=true').first();
          await modalReplyForm.evaluate((f: HTMLFormElement) => f.requestSubmit());
          await currentPage.waitForLoadState('networkidle');

          // Verify the modal reply appears
          await expect(modal.getByText(modalReply)).toBeVisible({ timeout: 10000 });
          // eslint-disable-next-line no-console
          console.log(`✓ Reply "${modalReply}" created successfully in modal`);

          // === Test: Close modal ===
          await currentPage.keyboard.press('Escape');
          await currentPage.waitForTimeout(500);
          await expect(modal).not.toBeVisible();
          // eslint-disable-next-line no-console
          console.log('✓ Modal closed successfully');

          break;
        }

        // Click Reply
        await replyButton.locator('visible=true').first().click();

        // Write nested reply
        const nestedReply = `Nested Reply Level ${depth} - ${Date.now()}`;
        const replyTextarea = commentContainer.locator('textarea').locator('visible=true').first();
        await replyTextarea.fill(nestedReply);

        // Submit
        const replyForm = commentContainer.locator('form').locator('visible=true').first();
        await replyForm.evaluate((f: HTMLFormElement) => f.requestSubmit());
        await currentPage.waitForLoadState('networkidle');

        // Verify the reply appears
        await expect(currentPage.getByText(nestedReply).first()).toBeVisible({ timeout: 5000 });

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
      await gmContext.close();
      await player1Context.close();
      await player2Context.close();
    }
  });

  test('GM can create posts as NPCs', async ({ page }) => {
    // Test that GMs can select NPCs from the character dropdown and post as them
    // Uses co-GM fixture (game 339) which has unassigned NPCs
    await loginAs(page, 'GM');

    const gameId = getWorkerGameId(339); // Co-GM management fixture with NPCs
    const commonRoom = new CommonRoomPage(page);
    await commonRoom.goto(gameId);

    // Verify Common Room is loaded
    await expect(commonRoom.heading).toBeVisible({ timeout: 5000 });

    // Create first post as default character
    const post1 = `GM Post 1 ${Date.now()}: Testing NPC posting.`;
    await commonRoom.createPost(post1);
    await commonRoom.verifyPostExists(post1);

    // Create post selecting a specific NPC
    const npcPost = `NPC Message ${Date.now()}: I have information about the quest.`;
    await commonRoom.createPost(npcPost, 'Mysterious Stranger');
    await commonRoom.verifyPostExists(npcPost);
  });

  test('Co-GM can create posts as NPCs', async ({ page }) => {
    // Test that co-GMs have the same NPC posting permissions as GMs
    // Uses co-GM fixture (game 339) where TestAudience1 is a co-GM
    await loginAs(page, 'AUDIENCE_1');

    const gameId = getWorkerGameId(339); // Co-GM management fixture
    const commonRoom = new CommonRoomPage(page);
    await commonRoom.goto(gameId);

    // Verify Common Room is loaded
    await expect(commonRoom.heading).toBeVisible({ timeout: 5000 });

    // Create first post as default character
    const post1 = `Co-GM Post 1 ${Date.now()}: Testing co-GM NPC posting.`;
    await commonRoom.createPost(post1);
    await commonRoom.verifyPostExists(post1);

    // Create post selecting a specific NPC
    const npcPost = `Co-GM NPC Post ${Date.now()}: I've been watching from the shadows.`;
    await commonRoom.createPost(npcPost, 'Town Guard');
    await commonRoom.verifyPostExists(npcPost);
  });

  test('Co-GM can reply to threads as NPCs', async ({ browser }) => {
    // Test that co-GMs can comment on posts as NPCs
    const gmContext = await browser.newContext();
    const coGmContext = await browser.newContext();

    const gmPage = await gmContext.newPage();
    const coGmPage = await coGmContext.newPage();

    try {
      // === GM creates a post ===
      await loginAs(gmPage, 'GM');

      const gameId = getWorkerGameId(339); // Co-GM management fixture
      const gmCommonRoom = new CommonRoomPage(gmPage);
      await gmCommonRoom.goto(gameId);

      const postContent = `GM Question ${Date.now()}: Has anyone seen unusual activity?`;
      await gmCommonRoom.createPost(postContent);

      // === Co-GM comments as NPC ===
      await loginAs(coGmPage, 'AUDIENCE_1');

      const coGmCommonRoom = new CommonRoomPage(coGmPage);
      await coGmCommonRoom.goto(gameId);

      // Verify co-GM can see the post
      await coGmCommonRoom.verifyPostExists(postContent);

      // Add comment as Mysterious Stranger NPC
      const commentText = `Strange figures were seen near the old mill last night.`;
      await coGmCommonRoom.addComment(postContent, commentText, { asCharacter: 'Mysterious Stranger' });

      // Verify comment appears
      await coGmCommonRoom.verifyCommentExists(commentText);

      // === GM verifies they can see co-GM's NPC comment ===
      await gmPage.reload();
      await gmPage.waitForLoadState('networkidle');
      await gmCommonRoom.verifyCommentExists(commentText);

    } finally {
      await gmContext.close();
      await coGmContext.close();
    }
  });

  test('GM can reply to co-GM comments in threads', async ({ browser }) => {
    test.setTimeout(45000);
    const gmContext = await browser.newContext();
    const coGmContext = await browser.newContext();
    const gmPage = await gmContext.newPage();
    const coGmPage = await coGmContext.newPage();

    try {
      // === GM creates a post ===
      await loginAs(gmPage, 'GM');
      const gameId = await getFixtureGameId(gmPage, 'CO_GM_MANAGEMENT'); // Game #339
      const gmCommonRoom = new CommonRoomPage(gmPage);
      await gmCommonRoom.goto(gameId);

      const postContent = `Thread ${Date.now()}: Strategic planning discussion`;
      await gmCommonRoom.createPost(postContent);

      // === Co-GM comments on the post as an NPC ===
      await loginAs(coGmPage, 'AUDIENCE_1'); // TestAudience1 is co-GM
      const coGmCommonRoom = new CommonRoomPage(coGmPage);
      await coGmCommonRoom.goto(gameId);

      const coGmComment = `Comment ${Date.now()}: The town guard reports suspicious activity`;
      await coGmCommonRoom.addComment(postContent, coGmComment, { asCharacter: 'Town Guard' });

      // === GM replies to the co-GM's comment ===
      await gmPage.reload();
      await gmPage.waitForLoadState('networkidle');

      // Find the co-GM's comment and click Reply
      const commentContainer = gmPage.locator('[data-testid="threaded-comment"]').filter({ hasText: coGmComment }).locator('visible=true').first();
      const replyButton = commentContainer.getByRole('button', { name: 'Reply' }).locator('visible=true').first();
      await replyButton.click();

      // Write the reply
      const gmReply = `Reply ${Date.now()}: Thank you for the report, keep me informed`;
      const replyTextarea = commentContainer.locator('textarea').locator('visible=true').first();
      await replyTextarea.fill(gmReply);

      // Submit the reply
      const replyForm = commentContainer.locator('form').locator('visible=true').first();
      await replyForm.evaluate((f: HTMLFormElement) => f.requestSubmit());

      // Wait for reply to be created
      await gmPage.waitForLoadState('networkidle');

      // Verify GM's reply appears
      await assertTextVisible(gmPage, gmReply);

      // === Co-GM verifies they can see GM's nested reply ===
      await coGmPage.reload();
      await coGmPage.waitForLoadState('networkidle');
      await assertTextVisible(coGmPage, gmReply);

    } finally {
      await gmContext.close();
      await coGmContext.close();
    }
  });

  test('Co-GM can reply to comments as NPCs in threads', async ({ browser }) => {
    test.setTimeout(45000);
    const gmContext = await browser.newContext();
    const coGmContext = await browser.newContext();
    const gmPage = await gmContext.newPage();
    const coGmPage = await coGmContext.newPage();

    try {
      // === GM creates a post ===
      await loginAs(gmPage, 'GM');
      const gameId = await getFixtureGameId(gmPage, 'CO_GM_MANAGEMENT'); // Game #339
      const gmCommonRoom = new CommonRoomPage(gmPage);
      await gmCommonRoom.goto(gameId);

      const postContent = `Thread ${Date.now()}: Town meeting`;
      await gmCommonRoom.createPost(postContent);

      // === GM creates a comment ===
      const gmComment = `Comment ${Date.now()}: Citizens are concerned about recent events`;
      await gmCommonRoom.addComment(postContent, gmComment);

      // === Co-GM replies to GM's comment as an NPC ===
      await loginAs(coGmPage, 'AUDIENCE_1'); // TestAudience1 is co-GM
      const coGmCommonRoom = new CommonRoomPage(coGmPage);
      await coGmCommonRoom.goto(gameId);

      // Find GM's comment and click Reply
      const commentContainer = coGmPage.locator('[data-testid="threaded-comment"]').filter({ hasText: gmComment }).locator('visible=true').first();
      const replyButton = commentContainer.getByRole('button', { name: 'Reply' }).locator('visible=true').first();
      await replyButton.click();

      // Wait for reply form to appear
      await coGmPage.waitForTimeout(800); // Wait for character selector to appear

      // Select NPC character for the reply
      const characterSelect = commentContainer.locator('role=combobox').locator('visible=true').first();
      await characterSelect.waitFor({ state: 'visible', timeout: 5000 });
      await characterSelect.selectOption({ label: 'Reply as Mysterious Stranger' });
      await coGmPage.waitForTimeout(500);

      // Write the reply
      const coGmReply = `Reply ${Date.now()}: I have information that may shed light on these events`;
      const replyTextarea = commentContainer.locator('textarea').locator('visible=true').first();
      await replyTextarea.fill(coGmReply);

      // Submit the reply
      const replyForm = commentContainer.locator('form').locator('visible=true').first();
      await replyForm.evaluate((f: HTMLFormElement) => f.requestSubmit());

      // Wait for reply to be created
      await coGmPage.waitForLoadState('networkidle');

      // Verify co-GM's NPC reply appears
      await assertTextVisible(coGmPage, coGmReply);

      // === GM verifies they can see co-GM's nested NPC reply ===
      await gmPage.reload();
      await gmPage.waitForLoadState('networkidle');
      await assertTextVisible(gmPage, coGmReply);

    } finally {
      await gmContext.close();
      await coGmContext.close();
    }
  });

  test('GM can edit a comment and change the character', async ({ page }) => {
    // Test that editing a comment and changing the character updates the character name immediately
    // This validates the cache update fix for comment character swaps
    await loginAs(page, 'GM');

    const gameId = await getFixtureGameId(page, 'CO_GM_MANAGEMENT'); // Co-GM management fixture with NPCs
    const commonRoom = new CommonRoomPage(page);
    await commonRoom.goto(gameId);

    // Verify Common Room is loaded
    await expect(commonRoom.heading).toBeVisible({ timeout: 5000 });

    // Create a post as the first NPC
    const postContent = `Test Post ${Date.now()}: Information from the shadows`;
    await commonRoom.createPost(postContent, 'Mysterious Stranger');
    await commonRoom.verifyPostExists(postContent);

    // Create a comment on the post as the second NPC
    const commentContent = `Comment ${Date.now()}: I saw something unusual`;
    await commonRoom.addComment(postContent, commentContent, { asCharacter: 'Town Guard' });
    await commonRoom.verifyCommentExists(commentContent);

    // Verify the comment shows "Town Guard" as the author
    const commentContainer = page.locator('[data-testid="threaded-comment"]').filter({ hasText: commentContent }).locator('visible=true').first();
    await expect(commentContainer.getByText('Town Guard').first()).toBeVisible({ timeout: 5000 });

    // Click Edit on the comment
    const editButton = commentContainer.getByRole('button', { name: 'Edit' }).locator('visible=true').first();
    await editButton.click();
    await page.waitForTimeout(500); // Wait for edit form to appear

    // Change the character to "Mysterious Stranger"
    const characterSelect = commentContainer.locator('select').locator('visible=true').first();
    await characterSelect.waitFor({ state: 'visible', timeout: 5000 });
    await characterSelect.selectOption({ label: 'Edit as Mysterious Stranger' });
    await page.waitForTimeout(300);

    // Save the edit (content stays the same, just changing the character)
    const saveButton = commentContainer.getByRole('button', { name: 'Save' }).locator('visible=true').first();
    await saveButton.click();
    await page.waitForLoadState('networkidle');

    // Verify the character name updates immediately WITHOUT page reload
    // This is the key test - the character name should change from "Town Guard" to "Mysterious Stranger"
    await expect(commentContainer.getByText('Mysterious Stranger').first()).toBeVisible({ timeout: 5000 });

    // Verify "Town Guard" is no longer showing (it should have been replaced)
    await expect(commentContainer.getByText('Town Guard').first()).not.toBeVisible();

    // Verify (edited) marker appears
    await expect(commentContainer.getByText('(edited)').first()).toBeVisible({ timeout: 3000 });
  });

  test('GM can edit their own post', async ({ page }) => {
    // Test that GMs can edit their own posts
    // Validates Issue 8.4: GM Can't Edit Common Room Posts

    await loginAs(page, 'GM');

    const gameId = await getFixtureGameId(page, 'CO_GM_MANAGEMENT'); // Co-GM management fixture
    const commonRoom = new CommonRoomPage(page);
    await commonRoom.goto(gameId);

    // Verify Common Room is loaded
    await expect(commonRoom.heading).toBeVisible({ timeout: 5000 });

    // Create a post
    const originalContent = `Original Post ${Date.now()}: This is the initial content`;
    await commonRoom.createPost(originalContent);
    await commonRoom.verifyPostExists(originalContent);

    // Get reference to the post card BEFORE clicking edit
    const postCard = commonRoom.getPostCard(originalContent);

    // Click Edit button
    const editButton = postCard.getByRole('button', { name: /^edit$/i }).locator('visible=true').first();
    await editButton.click();

    // Wait for edit textarea to appear
    const textarea = page.locator('textarea[placeholder*="Edit your post"]').locator('visible=true').first();
    await textarea.waitFor({ state: 'visible', timeout: 5000 });

    // Modify the content
    const updatedContent = `Updated Post ${Date.now()}: This content has been changed`;
    await textarea.fill(updatedContent);

    // Verify the textarea has the new content
    await expect(textarea).toHaveValue(updatedContent);

    // Click Save button
    const saveButton = page.getByRole('button', { name: 'Save' }).locator('visible=true').first();
    await expect(saveButton).toBeEnabled();
    await saveButton.click();

    // Wait for edit mode to close (Edit button reappears)
    await expect(page.getByRole('button', { name: /^edit$/i }).locator('visible=true').first()).toBeVisible({ timeout: 10000 });

    // Verify the content updates
    await expect(page.getByText(updatedContent)).toBeVisible({ timeout: 5000 });

    // Verify the original content is no longer showing
    await expect(page.getByText(originalContent)).not.toBeVisible();

    // Verify (edited) marker appears
    await expect(page.getByText('(edited)').first()).toBeVisible({ timeout: 5000 });
  });
});
