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
    await loginAs(page, 'PLAYER_1');

    const gameId = await getFixtureGameId(page, 'E2E_MESSAGES');
    const messaging = new MessagingPage(page);
    await messaging.goto(gameId);

    // Open the first conversation (from fixture)
    const conversation = page.locator('[data-testid="conversation-item"]').first();
    await expect(conversation).toBeVisible({ timeout: 10000 });
    await conversation.click();

    // Wait for messages to load
    await expect(page.locator('[data-testid="message"]').first()).toBeVisible();

    // Count initial messages
    const initialMessageCount = await page.locator('[data-testid="message"]').count();

    // Hover over own message to reveal delete button
    const ownMessage = page.locator('[data-testid="message"]')
      .filter({ hasText: 'Message from Player 1' })
      .first();
    await ownMessage.hover();

    // Delete button should appear
    const deleteButton = ownMessage.locator('button[title="Delete message"]');
    await expect(deleteButton).toBeVisible();
    await deleteButton.click();

    // Verify confirmation modal appears
    await expect(page.locator('h3:has-text("Delete Message?")')).toBeVisible();
    await expect(page.locator('text=This will permanently delete your message')).toBeVisible();

    // Verify modal has Cancel and Delete buttons
    await expect(page.getByRole('button', { name: 'Cancel', exact: true }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Delete', exact: true }).first()).toBeVisible();

    // Confirm deletion
    await page.getByRole('button', { name: 'Delete', exact: true }).first().click();

    // Wait for modal to close
    await expect(page.locator('h3:has-text("Delete Message?")')).not.toBeVisible();

    // Verify message shows as deleted (soft delete — count stays the same)
    const deletedMessage = page.locator('[data-testid="message"]')
      .filter({ hasText: '[Message deleted]' })
      .first();
    await expect(deletedMessage).toBeVisible();

    const finalMessageCount = await page.locator('[data-testid="message"]').count();
    expect(finalMessageCount).toBe(initialMessageCount);

    // Sender name and timestamp should still be visible
    const messageHeader = deletedMessage.locator('[data-testid="message-sender"]');
    await expect(messageHeader).toContainText('E2E Test Char 1');
  });

  test('cannot delete other users messages', async ({ page }) => {
    await loginAs(page, 'PLAYER_1');

    const gameId = await getFixtureGameId(page, 'E2E_MESSAGES');
    const messaging = new MessagingPage(page);
    await messaging.goto(gameId);

    // Open the first conversation
    const conversation = page.locator('[data-testid="conversation-item"]').first();
    await expect(conversation).toBeVisible({ timeout: 10000 });
    await conversation.click();
    await expect(page.locator('[data-testid="message"]').first()).toBeVisible();

    // Hover over other user's message
    const otherMessage = page.locator('[data-testid="message"]')
      .filter({ hasText: 'Message from Player 2' })
      .first();
    await otherMessage.hover();

    // Delete button should NOT appear
    await expect(otherMessage.locator('button[title="Delete message"]')).not.toBeVisible();
  });

  test('deleted message visible to all conversation participants', async ({ browser }) => {
    const player1Context = await browser.newContext();
    const player1Page = await player1Context.newPage();

    try {
      await loginAs(player1Page, 'PLAYER_1');
      const gameId = await getFixtureGameId(player1Page, 'E2E_MESSAGES');

      const player1Messaging = new MessagingPage(player1Page);
      await player1Messaging.goto(gameId);

      const conversation = player1Page.locator('[data-testid="conversation-item"]').first();
      await expect(conversation).toBeVisible({ timeout: 10000 });

      // Capture the conversation title so Player 2 can open the same one
      // (title is in an h3 inside the item — use first visible h3 to avoid dual-DOM duplication)
      const conversationTitle = await conversation.locator('h3').locator('visible=true').first().textContent();

      await conversation.click();

      const ownMessage = player1Page.locator('[data-testid="message"]')
        .filter({ hasText: 'Message from Player 1' })
        .first();
      await ownMessage.hover();

      await ownMessage.locator('button[title="Delete message"]').click();
      await player1Page.getByRole('button', { name: 'Delete', exact: true }).first().click();

      // Wait for deletion to complete (modal closes = deletion done)
      await expect(player1Page.locator('h3:has-text("Delete Message?")')).not.toBeVisible();

      // Verify deletion for Player 1
      await expect(
        player1Page.locator('[data-testid="message"]').filter({ hasText: '[Message deleted]' }).first()
      ).toBeVisible();

      // Second user (TestPlayer2) sees the deleted message
      const player2Context = await browser.newContext();
      const player2Page = await player2Context.newPage();

      try {
        await loginAs(player2Page, 'PLAYER_2');
        const gameId2 = await getFixtureGameId(player2Page, 'E2E_MESSAGES');

        const player2Messaging = new MessagingPage(player2Page);
        await player2Messaging.goto(gameId2);

        // Open the same conversation Player 1 was in (by title) to avoid ordering issues
        expect(conversationTitle, 'conversation title must be readable from fixture').toBeTruthy();
        const conversationTitleTrimmed = conversationTitle!.trim();
        const targetConversation = player2Page.locator('[data-testid="conversation-item"]').filter({ hasText: conversationTitleTrimmed }).first();
        await expect(targetConversation).toBeVisible({ timeout: 10000 });
        await targetConversation.click();

        // Wait for messages to load before asserting specific content
        await expect(player2Page.locator('[data-testid="message"]').first()).toBeVisible({ timeout: 10000 });

        await expect(
          player2Page.locator('[data-testid="message"]').filter({ hasText: '[Message deleted]' }).first()
        ).toBeVisible({ timeout: 10000 });
      } finally {
        await player2Context.close();
      }
    } finally {
      await player1Context.close();
    }
  });

  test('cancel button prevents deletion', async ({ page }) => {
    await loginAs(page, 'PLAYER_1');
    const gameId = await getFixtureGameId(page, 'E2E_MESSAGES');

    const messaging = new MessagingPage(page);
    await messaging.goto(gameId);

    const conversation = page.locator('[data-testid="conversation-item"]').first();
    await expect(conversation).toBeVisible({ timeout: 10000 });
    await conversation.click();

    const ownMessage = page.locator('[data-testid="message"]')
      .filter({ hasText: 'Message from Player 1' })
      .first();
    const originalText = await ownMessage.textContent();

    // Open delete modal and cancel
    await ownMessage.hover();
    await ownMessage.locator('button[title="Delete message"]').click();

    await expect(page.locator('h3:has-text("Delete Message?")')).toBeVisible();
    await page.getByRole('button', { name: 'Cancel', exact: true }).first().click();

    // Modal should close, message unchanged
    await expect(page.locator('h3:has-text("Delete Message?")')).not.toBeVisible();

    const messageAfterCancel = page.locator('[data-testid="message"]')
      .filter({ hasText: 'Message from Player 1' })
      .first();
    expect(await messageAfterCancel.textContent()).toBe(originalText);
    await expect(messageAfterCancel).toContainText('Message from Player 1');
  });

  test('deleted message does not show delete button again', async ({ page }) => {
    await loginAs(page, 'PLAYER_1');
    const gameId = await getFixtureGameId(page, 'E2E_MESSAGES');

    const messaging = new MessagingPage(page);
    await messaging.goto(gameId);

    const conversation = page.locator('[data-testid="conversation-item"]').first();
    await expect(conversation).toBeVisible({ timeout: 10000 });
    await conversation.click();

    const ownMessage = page.locator('[data-testid="message"]')
      .filter({ hasText: 'Message from Player 1' })
      .first();
    await ownMessage.hover();

    await ownMessage.locator('button[title="Delete message"]').click();
    await page.getByRole('button', { name: 'Delete', exact: true }).first().click();

    // Wait for deletion to complete
    await expect(page.locator('h3:has-text("Delete Message?")')).not.toBeVisible();

    const deletedMessage = page.locator('[data-testid="message"]')
      .filter({ hasText: '[Message deleted]' })
      .first();
    await expect(deletedMessage).toBeVisible();

    // Hover — delete button should NOT appear on already-deleted message
    await deletedMessage.hover();
    await expect(deletedMessage.locator('button[title="Delete message"]')).not.toBeVisible();
  });
});
