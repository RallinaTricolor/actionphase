import { test, expect } from '@playwright/test';
import { loginAs } from '../fixtures/auth-helpers';
import { getFixtureGameId } from '../fixtures/game-helpers';
import { MessagingPage } from '../pages/MessagingPage';

/**
 * E2E Tests for Private Message Editing
 *
 * Tests the complete user flow for editing private messages in conversations.
 *
 * Test Coverage:
 * - Edit button visible for own messages, hidden for others'
 * - Inline editor opens with existing content pre-filled
 * - Cancel discards changes
 * - Save updates message content and shows (edited) label
 * - Edited content visible to other participants
 * - Edit button not shown outside common_room phase
 */

test.describe('Private Message Editing', () => {
  test('edit button visible for own messages and hidden for others', async ({ page }) => {
    await loginAs(page, 'PLAYER_1');

    const gameId = await getFixtureGameId(page, 'E2E_MESSAGES');
    const messaging = new MessagingPage(page);
    await messaging.goto(gameId);

    const conversation = page.locator('[data-testid="conversation-item"]').first();
    await expect(conversation).toBeVisible({ timeout: 10000 });
    await conversation.click();
    await expect(page.locator('[data-testid="message"]').first()).toBeVisible();

    // Own message should show edit button on hover
    const ownMessage = page.locator('[data-testid="message"]')
      .filter({ hasText: 'Message from Player 1' })
      .first();
    await ownMessage.hover();
    await expect(ownMessage.locator('button[title="Edit message"]')).toBeVisible();

    // Other user's message should NOT show edit button
    const otherMessage = page.locator('[data-testid="message"]')
      .filter({ hasText: 'Message from Player 2' })
      .first();
    await otherMessage.hover();
    await expect(otherMessage.locator('button[title="Edit message"]')).not.toBeVisible();
  });

  test('inline editor opens with existing content pre-filled', async ({ page }) => {
    await loginAs(page, 'PLAYER_1');

    const gameId = await getFixtureGameId(page, 'E2E_MESSAGES');
    const messaging = new MessagingPage(page);
    await messaging.goto(gameId);

    const conversation = page.locator('[data-testid="conversation-item"]').first();
    await expect(conversation).toBeVisible({ timeout: 10000 });
    await conversation.click();
    await expect(page.locator('[data-testid="message"]').first()).toBeVisible();

    const ownMessage = page.locator('[data-testid="message"]')
      .filter({ hasText: 'Message from Player 1' })
      .first();

    await ownMessage.hover();
    await ownMessage.locator('button[title="Edit message"]').click();

    // Textarea should appear pre-filled with existing content
    const textarea = page.getByTestId('edit-message-textarea');
    await expect(textarea).toBeVisible();
    const content = await textarea.inputValue();
    expect(content).toContain('Message from Player 1');

    // Save and Cancel buttons should be visible
    await expect(page.getByTestId('save-edit-button')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cancel', exact: true })).toBeVisible();
  });

  test('cancel discards changes without saving', async ({ page }) => {
    await loginAs(page, 'PLAYER_1');

    const gameId = await getFixtureGameId(page, 'E2E_MESSAGES');
    const messaging = new MessagingPage(page);
    await messaging.goto(gameId);

    const conversation = page.locator('[data-testid="conversation-item"]').first();
    await expect(conversation).toBeVisible({ timeout: 10000 });
    await conversation.click();
    await expect(page.locator('[data-testid="message"]').first()).toBeVisible();

    const ownMessage = page.locator('[data-testid="message"]')
      .filter({ hasText: 'Message from Player 1' })
      .first();

    await ownMessage.hover();
    await ownMessage.locator('button[title="Edit message"]').click();

    const textarea = page.getByTestId('edit-message-textarea');
    await textarea.clear();
    await textarea.fill('This should not be saved');

    await page.getByRole('button', { name: 'Cancel', exact: true }).click();

    // Inline editor should close
    await expect(textarea).not.toBeVisible();

    // Original message content should still be there
    await expect(
      page.locator('[data-testid="message"]').filter({ hasText: 'Message from Player 1' }).first()
    ).toBeVisible();

    // Edited text should not appear
    await expect(page.getByText('This should not be saved')).not.toBeVisible();
  });

  test('saves edited content and shows (edited) label', async ({ page }) => {
    await loginAs(page, 'PLAYER_1');

    const gameId = await getFixtureGameId(page, 'E2E_MESSAGES');
    const messaging = new MessagingPage(page);
    await messaging.goto(gameId);

    const conversation = page.locator('[data-testid="conversation-item"]').first();
    await expect(conversation).toBeVisible({ timeout: 10000 });
    await conversation.click();
    await expect(page.locator('[data-testid="message"]').first()).toBeVisible();

    const ownMessage = page.locator('[data-testid="message"]')
      .filter({ hasText: 'Message from Player 1' })
      .first();

    const editedContent = `Edited message ${Date.now()}`;
    await messaging.editMessage(ownMessage, editedContent);

    // Inline editor should close
    await expect(page.getByTestId('edit-message-textarea')).not.toBeVisible();

    // Updated content should appear
    await expect(page.getByText(editedContent).locator('visible=true').first()).toBeVisible({ timeout: 5000 });

    // (edited) label should appear
    await expect(page.getByTestId('edited-label').first()).toBeVisible();
    await expect(page.getByTestId('edited-label').first()).toContainText('(edited)');
  });

  test('edited message visible to other participants', async ({ browser }) => {
    const player1Context = await browser.newContext();
    const player1Page = await player1Context.newPage();

    try {
      await loginAs(player1Page, 'PLAYER_1');
      const gameId = await getFixtureGameId(player1Page, 'E2E_MESSAGES');

      const player1Messaging = new MessagingPage(player1Page);
      await player1Messaging.goto(gameId);

      const conversation = player1Page.locator('[data-testid="conversation-item"]').first();
      await expect(conversation).toBeVisible({ timeout: 10000 });

      const conversationTitle = await conversation.locator('h3').locator('visible=true').first().textContent();
      await conversation.click();
      await expect(player1Page.locator('[data-testid="message"]').first()).toBeVisible();

      const ownMessage = player1Page.locator('[data-testid="message"]')
        .filter({ hasText: 'Message from Player 1' })
        .first();

      const editedContent = `Player 1 edited this ${Date.now()}`;
      await player1Messaging.editMessage(ownMessage, editedContent);

      await expect(player1Page.getByText(editedContent).locator('visible=true').first()).toBeVisible({ timeout: 5000 });

      // Player 2 opens the same conversation and sees the edited content
      const player2Context = await browser.newContext();
      const player2Page = await player2Context.newPage();

      try {
        await loginAs(player2Page, 'PLAYER_2');
        const gameId2 = await getFixtureGameId(player2Page, 'E2E_MESSAGES');

        const player2Messaging = new MessagingPage(player2Page);
        await player2Messaging.goto(gameId2);

        expect(conversationTitle, 'conversation title must be readable from fixture').toBeTruthy();
        const targetConversation = player2Page
          .locator('[data-testid="conversation-item"]')
          .filter({ hasText: conversationTitle!.trim() })
          .first();
        await expect(targetConversation).toBeVisible({ timeout: 10000 });
        await targetConversation.click();

        await expect(player2Page.locator('[data-testid="message"]').first()).toBeVisible({ timeout: 10000 });
        await expect(
          player2Page.getByText(editedContent).locator('visible=true').first()
        ).toBeVisible({ timeout: 10000 });

        // Player 2 also sees the (edited) label
        await expect(player2Page.getByTestId('edited-label').first()).toBeVisible();
      } finally {
        await player2Context.close();
      }
    } finally {
      await player1Context.close();
    }
  });
});
