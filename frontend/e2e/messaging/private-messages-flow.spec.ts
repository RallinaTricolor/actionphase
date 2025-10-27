import { test, expect } from '@playwright/test';
import { loginAs } from '../fixtures/auth-helpers';
import { getFixtureGameId } from '../fixtures/game-helpers';
import { navigateToGame } from '../utils/navigation';
import { assertTextVisible } from '../utils/assertions';
import { waitForModal } from '../utils/waits';
import { MessagingPage } from '../pages/MessagingPage';

/**
 * Journey 5: Players Exchange Private Messages
 *
 * Tests the complete private messaging flow between players.
 * Uses E2E fixture game "E2E Test: Action Submission" with existing characters.
 * Character creation is tested separately in Journey 3.
 *
 * REFACTORED: Using Page Object Model and shared utilities
 * - Eliminated all waitForTimeout calls (was 11)
 * - Uses navigateToGame for consistent navigation
 * - Uses assertion utilities for consistency
 * - Uses waitForModal and smart waits
 */
test.describe('Private Messages Flow', () => {
  test('Players can send private messages to each other', async ({ browser }) => {
    const player1Context = await browser.newContext();
    const player2Context = await browser.newContext();
    const player1Page = await player1Context.newPage();
    const player2Page = await player2Context.newPage();

    try {
      // === Player 1 creates a conversation with Player 2 ===
      await loginAs(player1Page, 'PLAYER_1');

      // Use E2E Messages game
      // TestPlayer1 has character: E2E Test Char 1
      // TestPlayer2 has character: E2E Test Char 2
      const gameId = await getFixtureGameId(player1Page, 'E2E_MESSAGES');

      const player1Messaging = new MessagingPage(player1Page);
      await player1Messaging.goto(gameId);

      // Create conversation with Player 2's character
      const conversationTitle = `Test Conversation ${Date.now()}`;
      await player1Messaging.createConversation(conversationTitle, ['E2E Test Char 2']);

      // === Player 1 sends first message ===
      const messageContent = `Hello from Player 1! Test message at ${Date.now()}`;
      await player1Messaging.sendMessage(messageContent);

      // === Player 2 sees the conversation and message ===
      await loginAs(player2Page, 'PLAYER_2');

      const player2Messaging = new MessagingPage(player2Page);
      await player2Messaging.goto(gameId);

      // See conversation in the list
      await player2Messaging.verifyConversationExists(conversationTitle);

      // Open the conversation
      await player2Messaging.openConversation(conversationTitle);

      // Verify Player 1's message is visible
      await player2Messaging.verifyMessageExists(messageContent);

      // === Player 2 replies ===
      const replyContent = `Hi Shade! Got your message. Rook replying at ${Date.now()}`;
      await player2Messaging.sendMessage(replyContent);

      // === Player 1 sees the reply ===
      // Reload to fetch new messages
      await player1Page.reload();
      await player1Page.waitForLoadState('networkidle');

      // Navigate back to Messages and open conversation
      await player1Messaging.navigateToMessages();
      await player1Messaging.openConversation(conversationTitle);

      // Verify Player 2's reply is visible
      await player1Messaging.verifyMessageExists(replyContent);
    } finally {
      await player1Context.close();
      await player2Context.close();
    }
  });

  test('Players can create group conversations with 3+ participants', async ({ browser }) => {
    const player1Context = await browser.newContext();
    const player2Context = await browser.newContext();
    const player3Context = await browser.newContext();
    const player1Page = await player1Context.newPage();
    const player2Page = await player2Context.newPage();
    const player3Page = await player3Context.newPage();

    try {
      // === Player 1 creates a group conversation with Player 2 and Player 3 ===
      await loginAs(player1Page, 'PLAYER_1');

      // Use E2E Messages game
      // TestPlayer1 has character: E2E Test Char 1
      // TestPlayer2 has character: E2E Test Char 2
      // TestPlayer3 has character: E2E Test Char 3
      const gameId = await getFixtureGameId(player1Page, 'E2E_MESSAGES');

      const player1Messaging = new MessagingPage(player1Page);
      await player1Messaging.goto(gameId);

      // Create group conversation with Player 2 and Player 3's characters
      const groupTitle = `Group Chat ${Date.now()}`;
      await player1Messaging.createConversation(groupTitle, ['E2E Test Char 2', 'E2E Test Char 3']);

      // === Player 1 sends first message ===
      const player1Message = `Hello everyone! Player 1 here at ${Date.now()}`;
      await player1Messaging.sendMessage(player1Message);

      // === Player 2 sees the group conversation ===
      await loginAs(player2Page, 'PLAYER_2');

      const player2Messaging = new MessagingPage(player2Page);
      await player2Messaging.goto(gameId);

      // See and open group conversation
      await player2Messaging.verifyConversationExists(groupTitle);
      await player2Messaging.openConversation(groupTitle);

      // Verify Player 1's message is visible
      await player2Messaging.verifyMessageExists(player1Message);

      // Player 2 sends a message
      const player2Message = `Hi from Player 2 at ${Date.now()}`;
      await player2Messaging.sendMessage(player2Message);

      // === Player 3 also sees the group conversation ===
      await loginAs(player3Page, 'PLAYER_3');

      const player3Messaging = new MessagingPage(player3Page);
      await player3Messaging.goto(gameId);

      // See and open group conversation
      await player3Messaging.verifyConversationExists(groupTitle);
      await player3Messaging.openConversation(groupTitle);

      // Verify BOTH previous messages are visible to Player 3
      await player3Messaging.verifyMessageExists(player1Message);
      await player3Messaging.verifyMessageExists(player2Message);

      // Player 3 sends a message
      const player3Message = `Player 3 joining the conversation at ${Date.now()}`;
      await player3Messaging.sendMessage(player3Message);

      // === Verify Player 1 sees all messages from all participants ===
      await player1Page.reload();
      await player1Page.waitForLoadState('networkidle');

      await player1Messaging.navigateToMessages();
      await player1Messaging.openConversation(groupTitle);

      // Verify all three messages are visible
      await player1Messaging.verifyMessageExists(player1Message);
      await player1Messaging.verifyMessageExists(player2Message);
      await player1Messaging.verifyMessageExists(player3Message);

    } finally {
      await player1Context.close();
      await player2Context.close();
      await player3Context.close();
    }
  });
});
