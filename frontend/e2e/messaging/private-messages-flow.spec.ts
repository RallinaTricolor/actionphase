import { test, expect } from '@playwright/test';
import { loginAs } from '../fixtures/auth-helpers';
import { getFixtureGameId } from '../fixtures/game-helpers';
import { navigateToGame } from '../utils/navigation';
import { assertTextVisible } from '../utils/assertions';
import { waitForModal } from '../utils/waits';

/**
 * Journey 5: Players Exchange Private Messages
 *
 * Tests the complete private messaging flow between players.
 * Uses test fixtures (Game #2: "The Heist at Goldstone Bank") with existing characters.
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

      // Use "The Heist at Goldstone Bank" from fixtures
      // TestPlayer1 has character: Shade (Whisper)
      // TestPlayer2 has character: Rook (Hound)
      const gameId = await getFixtureGameId(player1Page, 'HEIST');
      await navigateToGame(player1Page, gameId);

      // Navigate to Messages tab
      await player1Page.click('button:has-text("Messages")');
      await player1Page.waitForLoadState('networkidle');

      // Click "New Conversation" button (it has title attribute, no text)
      await player1Page.click('button[title="New Conversation"]');
      // Wait for the conversation form to appear
      await player1Page.waitForSelector('input[placeholder*="Planning the heist"]', { timeout: 5000 });

      // Fill in conversation title
      const conversationTitle = `Test Conversation ${Date.now()}`;
      await player1Page.fill('input[placeholder*="Planning the heist"]', conversationTitle);

      // Select Rook as participant (checkbox in the modal)
      await player1Page.click('label:has-text("Rook (Hound)")');

      // Click "Create Conversation" button
      await player1Page.click('button:has-text("Create Conversation")');
      await player1Page.waitForLoadState('networkidle');

      // === Player 1 sends first message ===
      const messageContent = `Hello Rook! This is a test message from Shade at ${Date.now()}`;
      await player1Page.fill('textarea[placeholder*="Type your message"]', messageContent);
      await player1Page.click('button:has-text("Send")');
      await player1Page.waitForLoadState('networkidle');

      // Verify message appears in Player 1's view
      await assertTextVisible(player1Page, messageContent);

      // === Player 2 sees the conversation and message ===
      await loginAs(player2Page, 'PLAYER_2');
      await navigateToGame(player2Page, gameId);

      // Navigate to Messages tab
      await player2Page.click('button:has-text("Messages")');
      await player2Page.waitForLoadState('networkidle');

      // See conversation in the list (should show the conversation title or participant names)
      await assertTextVisible(player2Page, conversationTitle);

      // Click on the conversation to open it
      await player2Page.locator(`text=${conversationTitle}`).first().click();
      await player2Page.waitForLoadState('networkidle');

      // Verify Player 1's message is visible
      await assertTextVisible(player2Page, messageContent);

      // === Player 2 replies ===
      const replyContent = `Hi Shade! Got your message. Rook replying at ${Date.now()}`;
      await player2Page.fill('textarea[placeholder*="Type your message"]', replyContent);
      await player2Page.click('button:has-text("Send")');
      await player2Page.waitForLoadState('networkidle');

      // Verify reply appears in Player 2's view
      await assertTextVisible(player2Page, replyContent);

      // === Player 1 sees the reply ===
      // Reload to fetch new messages
      await player1Page.reload();
      await player1Page.waitForLoadState('networkidle');

      // Navigate back to Messages
      await player1Page.click('button:has-text("Messages")');
      await player1Page.waitForLoadState('networkidle');

      // Conversation should already be selected or click it again
      await player1Page.locator(`text=${conversationTitle}`).first().click();
      await player1Page.waitForLoadState('networkidle');

      // Verify Player 2's reply is visible
      await assertTextVisible(player1Page, replyContent);
    } finally {
      await player1Context.close();
      await player2Context.close();
    }
  });
});
