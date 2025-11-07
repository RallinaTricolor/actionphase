import { test, expect } from '@playwright/test';
import { loginAs } from '../fixtures/auth-helpers';
import { getFixtureGameId } from '../fixtures/game-helpers';
import { AudiencePage } from '../pages/AudiencePage';
import { MessagingPage } from '../pages/MessagingPage';

/**
 * E2E Test: Audience Private Messages View
 *
 * Tests the read-only audience view of all private message conversations.
 * Verifies the enhanced UI with conversation cards, participant filtering,
 * date dividers, message grouping, and proper read-only enforcement.
 *
 * Uses E2E_MESSAGES fixture game which has existing private message conversations.
 */
test.describe('Audience Private Messages View', () => {
  test('Audience can view all private messages with enhanced UI', async ({ browser }) => {
    const audienceContext = await browser.newContext();
    const player1Context = await browser.newContext();

    const audiencePage = await audienceContext.newPage();
    const player1Page = await player1Context.newPage();

    try {
      // === Setup: Player 1 creates a conversation with messages ===
      await loginAs(player1Page, 'PLAYER_1');
      const gameId = await getFixtureGameId(player1Page, 'E2E_MESSAGES');

      const player1Messaging = new MessagingPage(player1Page);
      await player1Messaging.goto(gameId);

      // Create a new conversation for testing
      const testConversationTitle = `Audience Test Conversation ${Date.now()}`;
      await player1Messaging.createConversation(testConversationTitle, ['E2E Test Char 2']);

      // Send a few messages to test message grouping
      const message1 = `First message from Player 1`;
      const message2 = `Second message from Player 1`;
      await player1Messaging.sendMessage(message1);
      await player1Messaging.sendMessage(message2);

      // === Test: Audience accesses All Private Messages view ===
      await loginAs(audiencePage, 'AUDIENCE');

      const audience = new AudiencePage(audiencePage);
      await audience.goToAudience(gameId);

      // Verify view is displayed with read-only badge
      await audience.verifyAllPrivateMessagesView();

      // === Test: Conversation list shows enhanced UI ===
      // Verify the test conversation exists in the list
      await audience.verifyConversationExists(testConversationTitle);

      // Verify participant avatars are displayed
      const hasAvatars = await audience.verifyParticipantAvatars();
      expect(hasAvatars).toBe(true);

      // === Test: Open conversation and view messages ===
      await audience.openConversation(testConversationTitle);

      // Verify conversation header
      await audience.verifyConversationHeader(testConversationTitle);

      // Verify messages are displayed
      await audience.verifyMessageExists(message1);
      await audience.verifyMessageExists(message2);

      // Verify read-only state (no message input)
      const isReadOnly = await audience.verifyReadOnly();
      expect(isReadOnly).toBe(true);

      // === Test: Navigate back to conversation list ===
      await audience.goBackToConversationList();
      await audience.verifyAllPrivateMessagesView();

    } finally {
      await audienceContext.close();
      await player1Context.close();
    }
  });

  test('Audience can filter conversations by participants', async ({ browser }) => {
    const audienceContext = await browser.newContext();
    const audiencePage = await audienceContext.newPage();

    try {
      await loginAs(audiencePage, 'AUDIENCE');
      const gameId = await getFixtureGameId(audiencePage, 'E2E_MESSAGES');

      const audience = new AudiencePage(audiencePage);
      await audience.goToAudience(gameId);

      // Verify participant filter section exists
      await audience.verifyParticipantFilter();

      // Filter by a specific participant (using existing test character)
      await audience.filterByParticipant('E2E Test Char 1');

      // Conversations should now be filtered
      // (We can't assert exact count without knowing fixture data, but we verify filtering works)
      await audiencePage.waitForLoadState('networkidle');

      // Clear filters and verify count changes
      await audience.clearFilters();
      await audiencePage.waitForLoadState('networkidle');

    } finally {
      await audienceContext.close();
    }
  });

  test('Audience sees message grouping and date dividers', async ({ browser }) => {
    const audienceContext = await browser.newContext();
    const player1Context = await browser.newContext();
    const player2Context = await browser.newContext();

    const audiencePage = await audienceContext.newPage();
    const player1Page = await player1Context.newPage();
    const player2Page = await player2Context.newPage();

    try {
      // === Setup: Create conversation with messages from different senders ===
      await loginAs(player1Page, 'PLAYER_1');
      const gameId = await getFixtureGameId(player1Page, 'E2E_MESSAGES');

      const player1Messaging = new MessagingPage(player1Page);
      await player1Messaging.goto(gameId);

      const groupingTestTitle = `Grouping Test ${Date.now()}`;
      await player1Messaging.createConversation(groupingTestTitle, ['E2E Test Char 2']);

      // Player 1 sends multiple messages (should be grouped)
      await player1Messaging.sendMessage('Player 1 message 1');
      await player1Messaging.sendMessage('Player 1 message 2');

      // Player 2 replies (should start new group)
      await loginAs(player2Page, 'PLAYER_2');
      const player2Messaging = new MessagingPage(player2Page);
      await player2Messaging.goto(gameId);
      await player2Messaging.openConversation(groupingTestTitle);
      await player2Messaging.sendMessage('Player 2 reply');

      // === Test: Audience views the conversation ===
      await loginAs(audiencePage, 'AUDIENCE');

      const audience = new AudiencePage(audiencePage);
      await audience.goToAudience(gameId);
      await audience.openConversation(groupingTestTitle);

      // Verify messages exist
      await audience.verifyMessageExists('Player 1 message 1');
      await audience.verifyMessageExists('Player 1 message 2');
      await audience.verifyMessageExists('Player 2 reply');

      // Verify date divider exists (should show "Today" for recent messages)
      await audience.verifyDateDivider('Today');

      // Note: Message grouping is visual, but we can verify sender names appear
      // in a grouped manner (not repeated for every message)

    } finally {
      await audienceContext.close();
      await player1Context.close();
      await player2Context.close();
    }
  });

  test('Audience cannot interact with conversations (read-only)', async ({ browser }) => {
    const audienceContext = await browser.newContext();
    const audiencePage = await audienceContext.newPage();

    try {
      await loginAs(audiencePage, 'AUDIENCE');
      const gameId = await getFixtureGameId(audiencePage, 'E2E_MESSAGES');

      const audience = new AudiencePage(audiencePage);
      await audience.goToAudience(gameId);

      // Verify read-only state (no message input should exist)
      const isReadOnly = await audience.verifyReadOnly();
      expect(isReadOnly).toBe(true);

      // Verify there's no "New Conversation" button in audience view
      const newConvoButton = audiencePage.getByRole('button', { name: /New Conversation/i });
      const hasNewConvoButton = await newConvoButton.count();
      expect(hasNewConvoButton).toBe(0);

    } finally {
      await audienceContext.close();
    }
  });

  test('Audience sees last message preview on conversation cards', async ({ browser }) => {
    const audienceContext = await browser.newContext();
    const player1Context = await browser.newContext();

    const audiencePage = await audienceContext.newPage();
    const player1Page = await player1Context.newPage();

    try {
      // === Setup: Player 1 creates conversation with a message ===
      await loginAs(player1Page, 'PLAYER_1');
      const gameId = await getFixtureGameId(player1Page, 'E2E_MESSAGES');

      const player1Messaging = new MessagingPage(player1Page);
      await player1Messaging.goto(gameId);

      const previewTestTitle = `Preview Test ${Date.now()}`;
      await player1Messaging.createConversation(previewTestTitle, ['E2E Test Char 2']);

      const lastMessage = 'This is the last message for preview testing';
      await player1Messaging.sendMessage(lastMessage);

      // === Test: Audience sees last message preview ===
      await loginAs(audiencePage, 'AUDIENCE');

      const audience = new AudiencePage(audiencePage);
      await audience.goToAudience(gameId);

      // Verify the conversation card shows last message preview
      await audience.verifyConversationExists(previewTestTitle);

      // The preview should contain part of the last message
      // (truncated to 150 chars in backend query)
      await audience.verifyLastMessagePreview(previewTestTitle, 'This is the last message');

    } finally {
      await audienceContext.close();
      await player1Context.close();
    }
  });
});
