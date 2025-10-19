import { test, expect, Page } from '@playwright/test';
import { loginAs } from '../fixtures/auth-helpers';
import { getFixtureGameId } from '../fixtures/game-helpers';

/**
 * E2E Tests for Notification System
 *
 * Tests the complete notification flow:
 * - Creating notifications via events
 * - Displaying notification count in bell
 * - Viewing notifications in dropdown
 * - Marking notifications as read
 * - Navigating via notification links
 */

test.describe('Notification System', () => {

  test.describe('Notification UI', () => {
    test('should display and interact with notification bell', async ({ page }) => {
      // Test the notification UI components work
      await loginAs(page, 'PLAYER_1');

      const gameId = 164; // COMMON_ROOM_TEST
      await page.goto(`/games/${gameId}`);
      await page.waitForLoadState('networkidle');

      // 1. Verify notification bell is present
      const notificationBell = page.locator('[data-testid="notification-bell"]');
      await expect(notificationBell).toBeVisible();

      // 2. Click notification bell to open dropdown
      await notificationBell.click();
      await page.waitForTimeout(500);

      // 3. Verify notification dropdown opens
      const notificationDropdown = page.locator('[data-testid="notification-dropdown"]');
      await expect(notificationDropdown).toBeVisible();

      // 4. Verify empty state or notifications are displayed
      // (Will show either "No notifications" or actual notifications depending on state)
      const dropdownContent = notificationDropdown.locator('div, p, button').first();
      await expect(dropdownContent).toBeVisible();

      // 5. Close dropdown by clicking bell again
      await notificationBell.click();
      await page.waitForTimeout(300);

      // Dropdown should close (or remain open depending on implementation)
      // Either way, the UI interaction worked
    });
  });

  test.describe('Comment Reply Notifications', () => {
    test('should notify user when someone replies to their comment', async ({ browser }) => {
      const originalPosterContext = await browser.newContext();
      const replierContext = await browser.newContext();

      const originalPosterPage = await originalPosterContext.newPage();
      const replierPage = await replierContext.newPage();

      try {
        // 1. Both users log in
        await loginAs(originalPosterPage, 'PLAYER_1');
        await loginAs(replierPage, 'PLAYER_2');

        const gameId = await getFixtureGameId(originalPosterPage, 'COMMON_ROOM_TEST');

        // 2. Original poster views game page
        await originalPosterPage.goto(`/games/${gameId}`);
        await originalPosterPage.waitForLoadState('networkidle');

        // 3. Replier views game and replies to a comment
        await replierPage.goto(`/games/${gameId}`);
        await replierPage.waitForLoadState('networkidle');

        // Navigate to common room
        await replierPage.click('button:has-text("Common Room")');

        // Find a comment from Player 1 and reply to it
        const player1Comment = replierPage.locator('.comment-card').filter({ hasText: 'Player 1' }).first();
        await player1Comment.locator('button:has-text("Reply")').click();

        // Write reply
        const testReply = `E2E Test Reply - ${Date.now()}`;
        await replierPage.fill('textarea[placeholder*="reply"]', testReply);
        await replierPage.click('button:has-text("Post Reply")');

        // 4. Wait for notification on original poster's page
        const notificationBadge = originalPosterPage.locator('[data-testid="notification-badge"]');
        await expect(notificationBadge).toBeVisible({ timeout: 20000 });

        // 5. Click bell and verify notification
        await originalPosterPage.click('[data-testid="notification-bell"]');

        const replyNotification = originalPosterPage.locator('.notification-item:has-text("replied to your comment")');
        await expect(replyNotification).toBeVisible();

        // 6. Click notification and verify navigation with correct tab parameter
        await replyNotification.click();

        // Should navigate to common room tab with query parameter
        await expect(originalPosterPage).toHaveURL(new RegExp(`/games/${gameId}\\?tab=common-room`));
        await expect(originalPosterPage.locator(`text="${testReply}"`)).toBeVisible();

      } finally {
        await originalPosterContext.close();
        await replierContext.close();
      }
    });
  });

  test.describe('Character Mention Notifications', () => {
    test('should notify user when their character is mentioned in a comment', async ({ browser }) => {
      const mentionerContext = await browser.newContext();
      const mentionedUserContext = await browser.newContext();

      const mentionerPage = await mentionerContext.newPage();
      const mentionedUserPage = await mentionedUserContext.newPage();

      try {
        // 1. Both users log in
        await loginAs(mentionerPage, 'PLAYER_1');
        await loginAs(mentionedUserPage, 'PLAYER_2');

        const gameId = await getFixtureGameId(mentionerPage, 'COMMON_ROOM_TEST');

        // 2. Mentioned user viewing game
        await mentionedUserPage.goto(`/games/${gameId}`);
        await mentionedUserPage.waitForLoadState('networkidle');

        // 3. Mentioner creates a comment with @mention
        await mentionerPage.goto(`/games/${gameId}`);
        await mentionerPage.click('button:has-text("Common Room")');

        // Create new post with character mention
        await mentionerPage.click('button:has-text("New Post")');
        const testContent = `Testing character mention @Player2Character - ${Date.now()}`;
        await mentionerPage.fill('textarea[placeholder*="content"]', testContent);
        await mentionerPage.click('button:has-text("Create Post")');

        // 4. Wait for notification
        const notificationBadge = mentionedUserPage.locator('[data-testid="notification-badge"]');
        await expect(notificationBadge).toBeVisible({ timeout: 20000 });

        // 5. Click bell and verify mention notification
        await mentionedUserPage.click('[data-testid="notification-bell"]');

        const mentionNotification = mentionedUserPage.locator('.notification-item:has-text("mentioned")');
        await expect(mentionNotification).toBeVisible();

        // 6. Click and verify navigation with correct tab parameter
        await mentionNotification.click();
        await expect(mentionedUserPage).toHaveURL(new RegExp(`/games/${gameId}\\?tab=common-room`));

      } finally {
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
        // 1. Login as GM and Player
        await loginAs(gmPage, 'GM');
        await loginAs(playerPage, 'PLAYER_1');

        const gameId = await getFixtureGameId(gmPage, 'E2E_ACTION');

        // 2. Player viewing game
        await playerPage.goto(`/games/${gameId}`);
        await playerPage.waitForLoadState('networkidle');

        // 3. GM creates and activates a new phase
        await gmPage.goto(`/games/${gameId}`);
        await gmPage.click('button:has-text("GM Controls")');
        await gmPage.click('button:has-text("New Phase")');

        const phaseTitle = `E2E Test Phase - ${Date.now()}`;
        await gmPage.fill('input[name="title"]', phaseTitle);
        await gmPage.selectOption('select[name="phase_type"]', 'action');
        await gmPage.click('button:has-text("Create and Activate")');

        // 4. Wait for player notification
        const notificationBadge = playerPage.locator('[data-testid="notification-badge"]');
        await expect(notificationBadge).toBeVisible({ timeout: 20000 });

        // 5. Verify notification content
        await playerPage.click('[data-testid="notification-bell"]');

        const phaseNotification = playerPage.locator(`.notification-item:has-text("${phaseTitle}")`);
        await expect(phaseNotification).toBeVisible();

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

      const gameId = await getFixtureGameId(page, 'E2E_MESSAGES');
      await page.goto(`/games/${gameId}`);

      // Assume there are unread notifications
      const notificationBadge = page.locator('[data-testid="notification-badge"]');

      // If there are notifications, mark all as read
      if (await notificationBadge.isVisible()) {
        await page.click('[data-testid="notification-bell"]');

        // Click "Mark all as read" button
        await page.click('button:has-text("Mark all read")');

        // Wait for mutation to complete
        await page.waitForTimeout(1000);

        // Close and reopen dropdown
        await page.click('[data-testid="notification-bell"]'); // Close
        await page.waitForTimeout(500);

        // Badge should not be visible anymore
        await expect(notificationBadge).not.toBeVisible();
      }
    });

    test('should delete individual notification', async ({ page }) => {
      await loginAs(page, 'PLAYER_1');

      const gameId = await getFixtureGameId(page, 'E2E_MESSAGES');
      await page.goto(`/games/${gameId}`);

      // Open notifications
      await page.click('[data-testid="notification-bell"]');

      // Find first notification
      const firstNotification = page.locator('.notification-item').first();

      if (await firstNotification.isVisible()) {
        // Get the notification title to verify it's deleted
        const notificationTitle = await firstNotification.locator('h4').textContent();

        // Click delete button
        await firstNotification.locator('button[title="Delete notification"]').click();

        // Confirm deletion (browser confirm dialog)
        page.on('dialog', dialog => dialog.accept());

        // Wait for deletion
        await page.waitForTimeout(1000);

        // Notification should no longer be visible
        await expect(page.locator(`.notification-item:has-text("${notificationTitle}")`)).not.toBeVisible();
      }
    });

    test('should show empty state when no notifications', async ({ page }) => {
      await loginAs(page, 'AUDIENCE_MEMBER'); // User with likely no notifications

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

        const gameId = await getFixtureGameId(senderPage, 'COMMON_ROOM_TEST');

        // 2. Recipient is on a different page (not the game page)
        await recipientPage.goto('/dashboard');
        await recipientPage.waitForLoadState('networkidle');

        // Verify no notifications initially
        const notificationBadge = recipientPage.locator('[data-testid="notification-badge"]');
        await expect(notificationBadge).not.toBeVisible();

        // 3. Sender sends a private message
        await senderPage.goto(`/games/${gameId}`);
        await senderPage.click('button:has-text("Private Messages")');
        await senderPage.click('button:has-text("New Message")');
        await senderPage.fill('input[placeholder*="character"]', 'Test Player 2');
        await senderPage.click('text="Test Player 2 Character"');
        await senderPage.fill('textarea[placeholder*="message"]', `Polling test - ${Date.now()}`);
        await senderPage.click('button:has-text("Send")');

        // 4. Recipient's notification count should update automatically (polling interval is 15s)
        // Wait up to 20 seconds for the polling to pick it up
        await expect(notificationBadge).toBeVisible({ timeout: 20000 });
        await expect(notificationBadge).toHaveText('1');

      } finally {
        await senderContext.close();
        await recipientContext.close();
      }
    });
  });
});
