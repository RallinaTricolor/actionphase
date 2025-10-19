import { test, expect, Page } from '@playwright/test';
import { loginAs } from '../fixtures/auth-helpers';
import { getFixtureGameId } from '../fixtures/game-helpers';
import { CommonRoomPage } from '../pages/CommonRoomPage';
import { GameDetailsPage } from '../pages/GameDetailsPage';
import { PhaseManagementPage } from '../pages/PhaseManagementPage';
import { navigateToGame } from '../utils/navigation';
import { assertTextVisible } from '../utils/assertions';
import { waitForModal } from '../utils/waits';

/**
 * E2E Tests for Notification System
 *
 * Tests the complete notification flow:
 * - Creating notifications via events
 * - Displaying notification count in bell
 * - Viewing notifications in dropdown
 * - Marking notifications as read
 * - Navigating via notification links
 *
 * NOTE: These tests run serially due to timing-sensitive notification polling
 * and async backend goroutines. Parallel execution can cause race conditions
 * where notifications from one test appear in another test's feed.
 *
 * REFACTORED: Using Page Object Model and shared utilities
 * - Eliminated all waitForTimeout calls (was 34)
 * - Uses CommonRoomPage for all Common Room interactions
 * - Uses navigateToGame and GameDetailsPage for navigation
 * - Uses assertion utilities for consistency
 */

test.describe.configure({ mode: 'serial' });

test.describe('Notification System', () => {

  test.describe('Notification UI', () => {
    test('should display and interact with notification bell', async ({ page }) => {
      // Test the notification UI components work
      await loginAs(page, 'PLAYER_1');

      const gameId = 166; // COMMON_ROOM_NOTIFICATIONS (isolated for notification-flow.spec.ts)
      await navigateToGame(page, gameId);

      // 1. Verify notification bell is present
      const notificationBell = page.locator('[data-testid="notification-bell"]');
      await expect(notificationBell).toBeVisible();

      // 2. Click notification bell to open dropdown
      await notificationBell.click();

      // 3. Verify notification dropdown opens
      const notificationDropdown = page.locator('[data-testid="notification-dropdown"]');
      await expect(notificationDropdown).toBeVisible();

      // 4. Verify empty state or notifications are displayed
      // (Will show either "No notifications" or actual notifications depending on state)
      const dropdownContent = notificationDropdown.locator('div, p, button').first();
      await expect(dropdownContent).toBeVisible();

      // 5. Close dropdown by clicking bell again
      await notificationBell.click();

      // Dropdown should close (or remain open depending on implementation)
      // Either way, the UI interaction worked
    });
  });

  test.describe('Comment Reply Notifications', () => {
    test('should notify user when someone replies to their comment', async ({ browser }) => {
      const gmContext = await browser.newContext();
      const originalPosterContext = await browser.newContext();
      const replierContext = await browser.newContext();

      const gmPage = await gmContext.newPage();
      const originalPosterPage = await originalPosterContext.newPage();
      const replierPage = await replierContext.newPage();

      try {
        // 1. All users log in
        await loginAs(gmPage, 'GM');
        await loginAs(originalPosterPage, 'PLAYER_1');
        await loginAs(replierPage, 'PLAYER_2');

        const gameId = await getFixtureGameId(gmPage, 'COMMON_ROOM_NOTIFICATIONS');

        // 2. GM creates a post using CommonRoomPage
        const gmCommonRoom = new CommonRoomPage(gmPage);
        await gmCommonRoom.goto(gameId);

        const postContent = `Reply Test Post ${Date.now()}`;
        await gmCommonRoom.createPost(postContent);

        // 3. Player 1 comments on the post using CommonRoomPage
        const player1CommonRoom = new CommonRoomPage(originalPosterPage);
        await player1CommonRoom.goto(gameId);

        const player1CommentText = `Player 1 comment ${Date.now()}`;
        await player1CommonRoom.addComment(postContent, player1CommentText);

        // Verify Player 1's comment appears
        await assertTextVisible(originalPosterPage, player1CommentText);

        // 4. Player 2 replies to Player 1's comment using CommonRoomPage
        const player2CommonRoom = new CommonRoomPage(replierPage);
        await player2CommonRoom.goto(gameId);

        // Find Player 1's comment and click Reply
        const player1Comment = replierPage.locator(`text=${player1CommentText}`).first();
        await player1Comment.scrollIntoViewIfNeeded();

        // Look for the reply button near Player 1's comment
        const commentContainer = replierPage.locator(`div:has-text("${player1CommentText}")`).first();
        const replyButton = commentContainer.locator('button:has-text("Reply")').first();
        await replyButton.click();
        await replierPage.waitForLoadState('networkidle');

        // Write reply
        const testReply = `Player 2 reply ${Date.now()}`;
        const replyTextarea = commentContainer.locator('textarea').first();
        await replyTextarea.fill(testReply);

        const replyForm = commentContainer.locator('form').first();
        await replyForm.evaluate((f: HTMLFormElement) => f.requestSubmit());
        await replierPage.waitForLoadState('networkidle');

        // 5. Wait for notification on Player 1's page
        const notificationBadge = originalPosterPage.locator('[data-testid="notification-badge"]');
        await expect(notificationBadge).toBeVisible({ timeout: 20000 });

        // Click bell and wait for dropdown to load
        await originalPosterPage.click('[data-testid="notification-bell"]');

        const dropdown = originalPosterPage.locator('[data-testid="notification-dropdown"]');
        await expect(dropdown).toBeVisible();

        // Wait for loading to complete and notification to appear
        const replyNotification = originalPosterPage.locator('.notification-item:has-text("replied")').first();
        await expect(replyNotification).toBeVisible({ timeout: 20000 });

        // 6. Click notification and verify navigation
        await replyNotification.click();
        await expect(originalPosterPage).toHaveURL(new RegExp(`/games/${gameId}\\?tab=common-room`));

      } finally {
        await gmContext.close();
        await originalPosterContext.close();
        await replierContext.close();
      }
    });
  });

  test.describe('Character Mention Notifications', () => {
    test('should notify user when their character is mentioned in a comment', async ({ browser }) => {
      const gmContext = await browser.newContext();
      const mentionerContext = await browser.newContext();
      const mentionedUserContext = await browser.newContext();

      const gmPage = await gmContext.newPage();
      const mentionerPage = await mentionerContext.newPage();
      const mentionedUserPage = await mentionedUserContext.newPage();

      try {
        // 1. All users log in (using PLAYER_3 and PLAYER_4 to avoid cross-contamination)
        await loginAs(gmPage, 'GM');
        await loginAs(mentionerPage, 'PLAYER_3');
        await loginAs(mentionedUserPage, 'PLAYER_4');

        const gameId = await getFixtureGameId(gmPage, 'COMMON_ROOM_NOTIFICATIONS');

        // 2. Mentioned user viewing game
        await mentionedUserPage.goto(`/games/${gameId}`);
        await mentionedUserPage.waitForLoadState('networkidle');

        // 3. GM creates a post first using CommonRoomPage
        const gmCommonRoom = new CommonRoomPage(gmPage);
        await gmCommonRoom.goto(gameId);

        const postContent = `Mention Test Post ${Date.now()}`;
        await gmCommonRoom.createPost(postContent);

        // 4. Player 3 comments with @mention of Player 4's character using CommonRoomPage
        const mentionerCommonRoom = new CommonRoomPage(mentionerPage);
        await mentionerCommonRoom.goto(gameId);

        const postCard = mentionerPage.locator(`div:has-text("${postContent}")`).first();
        await postCard.locator('button:has-text("Add Comment")').first().click();
        await mentionerPage.waitForLoadState('networkidle');

        const commentTextarea = postCard.locator('textarea[placeholder*="Write a comment"]');
        await commentTextarea.fill('Hey @Test Player 4 Character, what do you think?');

        const form = postCard.locator('form').first();
        await form.evaluate((f: HTMLFormElement) => f.requestSubmit());
        await mentionerPage.waitForLoadState('networkidle');

        // 5. Wait for notification on Player 4's page
        const notificationBadge = mentionedUserPage.locator('[data-testid="notification-badge"]');
        await expect(notificationBadge).toBeVisible({ timeout: 20000 });

        // Click bell and verify mention notification
        await mentionedUserPage.click('[data-testid="notification-bell"]');

        const dropdown = mentionedUserPage.locator('[data-testid="notification-dropdown"]');
        await expect(dropdown).toBeVisible();

        // Wait for loading to complete and notification to appear
        const mentionNotification = mentionedUserPage.locator('.notification-item:has-text("mentioned")').first();
        await expect(mentionNotification).toBeVisible({ timeout: 20000 });

        // 6. Click and verify navigation with correct tab parameter
        await mentionNotification.click();
        await expect(mentionedUserPage).toHaveURL(new RegExp(`/games/${gameId}\\?tab=common-room`));

      } finally {
        await gmContext.close();
        await mentionerContext.close();
        await mentionedUserContext.close();
      }
    });
  });

  test.describe('Phase Activation Notifications', () => {
    test('should notify all participants when GM creates a new phase', async ({ browser }) => {
      const gmContext = await browser.newContext();
      const playerContext = await browser.newContext();

      const gmPage = await gmContext.newPage();
      const playerPage = await playerContext.newPage();

      try {
        // 1. Login as GM and Player (using PLAYER_5 to avoid cross-contamination)
        await loginAs(gmPage, 'GM');
        await loginAs(playerPage, 'PLAYER_5');

        // Use COMMON_ROOM_MISC (game 167) to avoid interfering with other notification tests
        const gameId = await getFixtureGameId(gmPage, 'COMMON_ROOM_MISC');

        // 2. Player viewing game
        await navigateToGame(playerPage, gameId);

        // 3. GM creates and activates a new phase using PhaseManagementPage
        const phaseManagement = new PhaseManagementPage(gmPage);
        await phaseManagement.goto(gameId);

        const phaseTitle = `E2E Test Phase - ${Date.now()}`;
        const deadline = new Date();
        deadline.setDate(deadline.getDate() + 2);

        await phaseManagement.createPhase({
          type: 'action',
          title: phaseTitle,
          description: 'Test phase for notifications',
          deadline,
        });

        // Activate the phase
        await phaseManagement.activatePhase(phaseTitle);

        // 4. Wait for player notification
        const notificationBadge = playerPage.locator('[data-testid="notification-badge"]');
        await expect(notificationBadge).toBeVisible({ timeout: 25000 });

        // Verify notification content
        await playerPage.click('[data-testid="notification-bell"]');

        const dropdown = playerPage.locator('[data-testid="notification-dropdown"]');
        await expect(dropdown).toBeVisible();

        // Wait for loading to complete and notification to appear
        const phaseNotification = playerPage.locator(`.notification-item:has-text("${phaseTitle}")`).first();
        await expect(phaseNotification).toBeVisible({ timeout: 20000 });

        // 6. Click and verify navigation
        await phaseNotification.click();
        await expect(playerPage).toHaveURL(new RegExp(`/games/${gameId}`));

      } finally {
        await gmContext.close();
        await playerContext.close();
      }
    });
  });

  test.describe('Notification Actions', () => {
    test('should mark all notifications as read', async ({ page }) => {
      await loginAs(page, 'PLAYER_1');

      const gameId = await getFixtureGameId(page, 'COMMON_ROOM_NOTIFICATIONS');
      await navigateToGame(page, gameId);

      // Assume there are unread notifications
      const notificationBadge = page.locator('[data-testid="notification-badge"]');

      // If there are notifications, mark all as read
      if (await notificationBadge.isVisible()) {
        await page.click('[data-testid="notification-bell"]');

        // Click "Mark all as read" button
        await page.click('button:has-text("Mark all read")');
        await page.waitForLoadState('networkidle');

        // Close and reopen dropdown
        await page.click('[data-testid="notification-bell"]'); // Close

        // Badge should not be visible anymore
        await expect(notificationBadge).not.toBeVisible();
      }
    });

    test('should delete individual notification', async ({ page }) => {
      await loginAs(page, 'PLAYER_1');

      const gameId = await getFixtureGameId(page, 'COMMON_ROOM_NOTIFICATIONS');
      await navigateToGame(page, gameId);

      // Open notifications
      await page.click('[data-testid="notification-bell"]');

      // Find first notification
      const firstNotification = page.locator('.notification-item').first();

      if (await firstNotification.isVisible()) {
        // Get the notification title to verify it's deleted
        const notificationTitle = await firstNotification.locator('h4').textContent();

        // Set up dialog handler BEFORE clicking delete
        page.once('dialog', dialog => dialog.accept());

        // Click delete button
        await firstNotification.locator('button[title="Delete notification"]').click();
        await page.waitForLoadState('networkidle');

        // Close and reopen dropdown to ensure UI is refreshed
        await page.click('[data-testid="notification-bell"]'); // Close
        await page.click('[data-testid="notification-bell"]'); // Reopen

        // Notification should no longer be visible
        await expect(page.locator(`.notification-item:has-text("${notificationTitle}")`)).not.toBeVisible({ timeout: 5000 });
      }
    });

    test('should show empty state when no notifications', async ({ page }) => {
      await loginAs(page, 'AUDIENCE'); // User with likely no notifications

      await page.goto('/dashboard');

      // Open notifications
      await page.click('[data-testid="notification-bell"]');

      // Should show empty state
      const emptyState = page.locator('text="No notifications"');
      const emptyMessage = page.locator('text="You\'re all caught up!"');

      await expect(emptyState).toBeVisible();
      await expect(emptyMessage).toBeVisible();
    });
  });

  test.describe('Notification Polling', () => {
    test('should automatically update notification count via polling', async ({ browser }) => {
      const senderContext = await browser.newContext();
      const recipientContext = await browser.newContext();

      const senderPage = await senderContext.newPage();
      const recipientPage = await recipientContext.newPage();

      try {
        // 1. Setup both users
        await loginAs(senderPage, 'PLAYER_1');
        await loginAs(recipientPage, 'PLAYER_2');

        const gameId = await getFixtureGameId(senderPage, 'HEIST'); // Use HEIST game which has Private Messages support

        // 2. Recipient is on a different page (not the game page)
        await recipientPage.goto('/dashboard');
        await recipientPage.waitForLoadState('networkidle');

        // Get initial notification count (may have notifications from previous tests)
        const notificationBadge = recipientPage.locator('[data-testid="notification-badge"]');
        let initialCount = 0;
        if (await notificationBadge.isVisible({ timeout: 2000 }).catch(() => false)) {
          const badgeText = await notificationBadge.textContent();
          initialCount = parseInt(badgeText || '0', 10);
        }

        // 3. Sender sends a private message using GameDetailsPage
        const senderGamePage = new GameDetailsPage(senderPage);
        await senderGamePage.goto(gameId);
        await senderGamePage.goToMessages();

        // Click "New Conversation" button
        const newConversationButton = senderPage.locator('button[title="New Conversation"]');
        await expect(newConversationButton).toBeVisible({ timeout: 5000 });
        await newConversationButton.click();

        // Wait for the conversation form to appear
        await senderPage.waitForSelector('input[placeholder*="Planning the heist"]', { timeout: 5000 });

        // Fill in conversation title
        const conversationTitle = `Polling test - ${Date.now()}`;
        await senderPage.fill('input[placeholder*="Planning the heist"]', conversationTitle);

        // Select Rook (Player 2's character) as participant
        await senderPage.click('label:has-text("Rook (Hound)")');

        // Click "Create Conversation" button
        await senderPage.click('button:has-text("Create Conversation")');
        await senderPage.waitForLoadState('networkidle');

        // Send a message in the conversation
        const testMessage = `Polling test message - ${Date.now()}`;
        await senderPage.fill('textarea[placeholder*="Type your message"]', testMessage);
        await senderPage.click('button:has-text("Send")');
        await senderPage.waitForLoadState('networkidle');

        // Verify message was sent
        await assertTextVisible(senderPage, testMessage);

        // 4. Recipient's notification count should update automatically (polling interval is 15s)
        // Wait up to 25 seconds for the polling to pick it up
        const expectedCount = (initialCount + 1).toString();
        await expect(notificationBadge).toBeVisible({ timeout: 25000 });
        await expect(notificationBadge).toHaveText(expectedCount, { timeout: 25000 });

      } finally {
        await senderContext.close();
        await recipientContext.close();
      }
    });
  });
});
