import { test, expect } from '@playwright/test';
import { loginAs } from '../fixtures/auth-helpers';
import { getFixtureGameId } from '../fixtures/game-helpers';
import { MessagingPage } from '../pages/MessagingPage';

/**
 * E2E Tests for Private Message Deletion
 *
 * Tests the complete user flow for deleting private messages in conversations.
 *
 * Test Coverage:
 * - Delete button visibility (own vs other users' messages)
 * - Confirmation modal flow
 * - Successful deletion
 * - Authorization (cannot delete others' messages)
 * - Deleted message visibility to all participants
 */

test.describe('Private Message Deletion', () => {
  test('allows user to delete own message', async ({ page }) => {
    // Login as TestPlayer1
    await loginAs(page, 'PLAYER_1');

    // Get the PM deletion test game
    const gameId = await getFixtureGameId(page, 'E2E_MESSAGES');

    // Navigate to Messages
    const messaging = new MessagingPage(page);
    await messaging.goto(gameId);

    // Wait for conversations to load
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Open the first conversation (from fixture)
    const conversation = page.locator('[data-testid="conversation-item"]').locator('visible=true').first();
    await expect(conversation).toBeVisible({ timeout: 10000 });
    await conversation.click();

    // Wait for messages to load
    await expect(page.locator('[data-testid="message"]').locator('visible=true').first()).toBeVisible();

    // Count initial messages
    const initialMessageCount = await page.locator('[data-testid="message"]').count();

    // Find and hover over own message to reveal delete button
    const ownMessage = page.locator('[data-testid="message"]')
      .filter({ hasText: 'Message from Player 1' })
      .locator('visible=true').first();
    await ownMessage.hover();

    // Delete button should appear
    const deleteButton = ownMessage.locator('button[title="Delete message"]');
    await expect(deleteButton).toBeVisible();

    // Click delete button
    await deleteButton.click();

    // Verify confirmation modal appears
    await expect(page.locator('h3:has-text("Delete Message?")')).toBeVisible();
    await expect(page.locator('text=This will permanently delete your message')).toBeVisible();

    // Verify modal has Cancel and Delete buttons
    await expect(page.getByRole('button', { name: 'Cancel', exact: true }).locator('visible=true').first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Delete', exact: true }).locator('visible=true').first()).toBeVisible();

    // Confirm deletion
    await page.getByRole('button', { name: 'Delete', exact: true }).locator('visible=true').first().click();

    // Wait for modal to close
    await expect(page.locator('h3:has-text("Delete Message?")')).not.toBeVisible();

    // Verify message shows as deleted
    const deletedMessage = page.locator('[data-testid="message"]')
      .filter({ hasText: '[Message deleted]' })
      .locator('visible=true').first();
    await expect(deletedMessage).toBeVisible();

    // Message count should remain the same (soft delete)
    const finalMessageCount = await page.locator('[data-testid="message"]').count();
    expect(finalMessageCount).toBe(initialMessageCount);

    // Sender name and timestamp should still be visible
    const messageHeader = deletedMessage.locator('[data-testid="message-sender"]');
    await expect(messageHeader).toContainText('E2E Test Char 1'); // TestPlayer1's character from Game 354
  });

  test('cannot delete other users messages', async ({ page }) => {
    // Login as TestPlayer1
    await loginAs(page, 'PLAYER_1');

    // Get the PM deletion test game
    const gameId = await getFixtureGameId(page, 'E2E_MESSAGES');

    // Navigate to Messages
    const messaging = new MessagingPage(page);
    await messaging.goto(gameId);

    // Wait for conversations to load
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Open the first conversation
    const conversation = page.locator('[data-testid="conversation-item"]').locator('visible=true').first();
    await expect(conversation).toBeVisible({ timeout: 10000 });
    await conversation.click();
    await expect(page.locator('[data-testid="message"]').locator('visible=true').first()).toBeVisible();

    // Try to find delete button on other user's message
    const otherMessage = page.locator('[data-testid="message"]')
      .filter({ hasText: 'Message from Player 2' })
      .locator('visible=true').first();
    await otherMessage.hover();

    // Delete button should NOT appear
    const deleteButton = otherMessage.locator('button[title="Delete message"]');
    await expect(deleteButton).not.toBeVisible();
  });

  test('deleted message visible to all conversation participants', async ({ browser }) => {
    // This test uses two browser contexts to simulate two different users

    // First user (TestPlayer1) deletes a message
    const player1Context = await browser.newContext();
    const player1Page = await player1Context.newPage();

    try {
      await loginAs(player1Page, 'PLAYER_1');
      const gameId = await getFixtureGameId(player1Page, 'E2E_MESSAGES');

      const player1Messaging = new MessagingPage(player1Page);
      await player1Messaging.goto(gameId);

      // Wait for conversations to load
      await player1Page.waitForLoadState('networkidle');
      await player1Page.waitForTimeout(1000);

      const conversation = player1Page.locator('[data-testid="conversation-item"]').locator('visible=true').first();
      await expect(conversation).toBeVisible({ timeout: 10000 });
      await conversation.click();

      const ownMessage = player1Page.locator('[data-testid="message"]')
        .filter({ hasText: 'Message from Player 1' })
        .locator('visible=true').first();
      await ownMessage.hover();

      const deleteButton = ownMessage.locator('button[title="Delete message"]');
      await deleteButton.click();

      await player1Page.getByRole('button', { name: 'Delete', exact: true }).locator('visible=true').first().click();

      // Wait for deletion to complete
      await player1Page.waitForLoadState('networkidle');
      await player1Page.waitForTimeout(1000);

      // Verify deletion for Player 1
      const deletedMessage = player1Page.locator('[data-testid="message"]')
        .filter({ hasText: '[Message deleted]' })
        .locator('visible=true').first();
      await expect(deletedMessage).toBeVisible();

      // Second user (TestPlayer2) sees the deleted message
      const player2Context = await browser.newContext();
      const player2Page = await player2Context.newPage();

      try {
        await loginAs(player2Page, 'PLAYER_2');
        const gameId2 = await getFixtureGameId(player2Page, 'E2E_MESSAGES');

        const player2Messaging = new MessagingPage(player2Page);
        await player2Messaging.goto(gameId2);

        // Wait for conversations to load
        await player2Page.waitForLoadState('networkidle');
        await player2Page.waitForTimeout(1000);

        const conversation2 = player2Page.locator('[data-testid="conversation-item"]').locator('visible=true').first();
        await expect(conversation2).toBeVisible({ timeout: 10000 });
        await conversation2.click();

        // Wait for messages to load
        await player2Page.waitForLoadState('networkidle');
        await player2Page.waitForTimeout(1000);

        // Player 2 should also see "[Message deleted]"
        const deletedMessage2 = player2Page.locator('[data-testid="message"]')
          .filter({ hasText: '[Message deleted]' })
          .locator('visible=true').first();
        await expect(deletedMessage2).toBeVisible({ timeout: 10000 });
      } finally {
        await player2Context.close();
      }
    } finally {
      await player1Context.close();
    }
  });

  test('cancel button prevents deletion', async ({ page }) => {
    // Login and navigate to conversation
    await loginAs(page, 'PLAYER_1');
    const gameId = await getFixtureGameId(page, 'E2E_MESSAGES');

    const messaging = new MessagingPage(page);
    await messaging.goto(gameId);

    // Wait for conversations to load
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    const conversation = page.locator('[data-testid="conversation-item"]').locator('visible=true').first();
    await expect(conversation).toBeVisible({ timeout: 10000 });
    await conversation.click();

    // Get original message text
    const ownMessage = page.locator('[data-testid="message"]')
      .filter({ hasText: 'Message from Player 1' })
      .locator('visible=true').first();
    const originalText = await ownMessage.textContent();

    // Open delete modal and cancel
    await ownMessage.hover();
    const deleteButton = ownMessage.locator('button[title="Delete message"]');
    await deleteButton.click();

    await expect(page.locator('h3:has-text("Delete Message?")')).toBeVisible();

    // Click Cancel
    await page.getByRole('button', { name: 'Cancel', exact: true }).locator('visible=true').first().click();

    // Modal should close
    await expect(page.locator('h3:has-text("Delete Message?")')).not.toBeVisible();

    // Verify message unchanged
    const messageAfterCancel = page.locator('[data-testid="message"]')
      .filter({ hasText: 'Message from Player 1' })
      .locator('visible=true').first();
    const textAfterCancel = await messageAfterCancel.textContent();

    expect(textAfterCancel).toBe(originalText);

    // Verify message still shows actual content, not "[Message deleted]"
    await expect(messageAfterCancel).toContainText('Message from Player 1');
  });

  test('deleted message does not show delete button again', async ({ page }) => {
    // Login and navigate to conversation
    await loginAs(page, 'PLAYER_1');
    const gameId = await getFixtureGameId(page, 'E2E_MESSAGES');

    const messaging = new MessagingPage(page);
    await messaging.goto(gameId);

    // Wait for conversations to load
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    const conversation = page.locator('[data-testid="conversation-item"]').locator('visible=true').first();
    await expect(conversation).toBeVisible({ timeout: 10000 });
    await conversation.click();

    // Delete a message
    const ownMessage = page.locator('[data-testid="message"]')
      .filter({ hasText: 'Message from Player 1' })
      .locator('visible=true').first();
    await ownMessage.hover();

    const deleteButton = ownMessage.locator('button[title="Delete message"]');
    await deleteButton.click();
    await page.getByRole('button', { name: 'Delete', exact: true }).locator('visible=true').first().click();

    // Verify message shows as deleted
    const deletedMessage = page.locator('[data-testid="message"]')
      .filter({ hasText: '[Message deleted]' })
      .locator('visible=true').first();
    await expect(deletedMessage).toBeVisible();

    // Hover over deleted message
    await deletedMessage.hover();

    // Delete button should NOT appear
    const deleteButtonAfter = deletedMessage.locator('button[title="Delete message"]');
    await expect(deleteButtonAfter).not.toBeVisible();
  });
});
