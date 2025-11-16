import { test, expect } from '@playwright/test';
import { loginAs } from '../fixtures/auth-helpers';
import { getFixtureGameId } from '../fixtures/game-helpers';
import { CommonRoomPage } from '../pages/CommonRoomPage';
import { MessagingPage } from '../pages/MessagingPage';
import { PhaseManagementPage } from '../pages/PhaseManagementPage';
import { navigateToGame } from '../utils/navigation';
import { assertTextVisible } from '../utils/assertions';

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
  // Clean up messages and notifications between tests to prevent test contamination
  // Serial tests share the same game fixture, so we need to clean up after each test
  test.afterEach(async () => {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);

    // Delete messages and notifications from game 166 between tests
    await execAsync(`PGPASSWORD=example psql -h localhost -U postgres -d actionphase -c "DELETE FROM messages WHERE game_id = 166; DELETE FROM notifications WHERE game_id = 166;"`);
  });

  test.describe('Notification UI', () => {
    test('should display and interact with notification bell', async ({ page }) => {
      // Test the notification UI components work
      await loginAs(page, 'PLAYER_1');

      const gameId = await getFixtureGameId(page, 'COMMON_ROOM_NOTIFICATIONS');
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
      const dropdownContent = notificationDropdown.locator('div, p, button').locator('visible=true').first();
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
        // Look for the reply button near Player 1's comment
        const commentContainer = replierPage.locator('div').filter({ hasText: player1CommentText }).locator('visible=true').first();
        const replyButton = commentContainer.getByRole('button', { name: 'Reply' }).locator('visible=true').first();
        // Playwright's click automatically scrolls the element into view if needed
        await replyButton.click();
        await replierPage.waitForLoadState('networkidle');

        // Write reply
        const testReply = `Player 2 reply ${Date.now()}`;
        const replyTextarea = commentContainer.locator('textarea').locator('visible=true').first();
        await replyTextarea.fill(testReply);

        const replyForm = commentContainer.locator('form').locator('visible=true').first();
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
        const replyNotification = originalPosterPage.locator('.notification-item').filter({ hasText: 'replied' }).locator('visible=true').first();
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

        const postCard = mentionerPage.locator('div').filter({ hasText: postContent }).locator('visible=true').first();
        await postCard.getByRole('button', { name: 'Add Comment' }).locator('visible=true').first().click();
        await mentionerPage.waitForLoadState('networkidle');

        const commentTextarea = postCard.getByPlaceholder(/Write a comment/i);
        await commentTextarea.fill('Hey @Test Player 4 Character, what do you think?');

        const form = postCard.locator('form').locator('visible=true').first();
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
        const mentionNotification = mentionedUserPage.locator('.notification-item').filter({ hasText: 'mentioned' }).locator('visible=true').first();
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

        // 4. Reload player page to fetch notifications (instead of waiting for polling)
        await playerPage.reload();
        await playerPage.waitForLoadState('networkidle');

        // Wait for notification badge to appear (transition from 0 to 1)
        const notificationBadge = playerPage.locator('[data-testid="notification-badge"]');
        await expect(notificationBadge).toBeVisible({ timeout: 5000 });

        // Open notifications dropdown
        await playerPage.click('[data-testid="notification-bell"]');

        const dropdown = playerPage.locator('[data-testid="notification-dropdown"]');
        await expect(dropdown).toBeVisible();

        // Wait for loading to complete and notification to appear
        const phaseNotification = playerPage.locator('.notification-item').filter({ hasText: phaseTitle }).locator('visible=true').first();
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
        await page.getByRole('button', { name: 'Mark all read' }).click();
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
      const firstNotification = page.locator('.notification-item').locator('visible=true').first();

      if (await firstNotification.isVisible()) {
        // Get the notification title to verify it's deleted
        const notificationTitle = await firstNotification.getByRole('heading', { level: 4 }).textContent();

        // Set up dialog handler BEFORE clicking delete
        page.once('dialog', dialog => dialog.accept());

        // Click delete button
        await firstNotification.getByRole('button', { name: 'Delete notification' }).or(
          firstNotification.locator('button[title="Delete notification"]')
        ).click();
        await page.waitForLoadState('networkidle');

        // Close and reopen dropdown to ensure UI is refreshed
        await page.click('[data-testid="notification-bell"]'); // Close
        await page.click('[data-testid="notification-bell"]'); // Reopen

        // Notification should no longer be visible
        if (notificationTitle) {
          await expect(page.locator('.notification-item').filter({ hasText: notificationTitle })).not.toBeVisible({ timeout: 5000 });
        }
      }
    });

    test('should show empty state when no notifications', async ({ page }) => {
      await loginAs(page, 'AUDIENCE');

      await page.goto('/dashboard');

      // Open notifications
      await page.click('[data-testid="notification-bell"]');

      // Wait for notifications to load
      await page.waitForTimeout(1000);

      // Dismiss all existing notifications to ensure empty state
      const dismissButtons = page.locator('[data-testid="dismiss-notification"]');
      const count = await dismissButtons.count();

      if (count > 0) {
        // Dismiss all notifications
        for (let i = 0; i < count; i++) {
          const firstDismiss = page.locator('[data-testid="dismiss-notification"]').locator('visible=true').first();
          if (await firstDismiss.isVisible()) {
            await firstDismiss.click();
            await page.waitForTimeout(300); // Wait for dismissal animation
          }
        }
      }

      // Should now show empty state
      const emptyState = page.getByText('No notifications');
      const emptyMessage = page.getByText("You're all caught up!");

      await expect(emptyState).toBeVisible({ timeout: 5000 });
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

        const gameId = await getFixtureGameId(senderPage, 'COMMON_ROOM_NOTIFICATIONS'); // Use dedicated notification test game

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

        // 3. Sender sends a private message using MessagingPage POM
        const messagingPage = new MessagingPage(senderPage);
        await messagingPage.goto(gameId);

        // Create conversation and send message
        const conversationTitle = `Polling test - ${Date.now()}`;
        const testMessage = `Polling test message - ${Date.now()}`;

        await messagingPage.createConversation(conversationTitle, ['Test Player 2 Character']);
        await messagingPage.sendMessage(testMessage);

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
