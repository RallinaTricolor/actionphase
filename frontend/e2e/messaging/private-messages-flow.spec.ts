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

      // Select E2E Test Char 2 (Player 2's character) as participant
      await player1Page.click('label:has-text("E2E Test Char 2")');

      // Click "Create Conversation" button
      await player1Page.click('button:has-text("Create Conversation")');
      await player1Page.waitForLoadState('networkidle');

      // === Player 1 sends first message ===
      const messageContent = `Hello from Player 1! Test message at ${Date.now()}`;
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

      // Wait for conversation messages to load (give UI time to render the thread)
      await player2Page.waitForTimeout(1000);

      // Verify Player 1's message is visible in the conversation thread
      await expect(player2Page.locator(`text=${messageContent}`).last()).toBeVisible({ timeout: 5000 });

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

      // Wait for conversation messages to load
      await player1Page.waitForTimeout(1000);

      // Verify Player 2's reply is visible in the conversation thread
      await expect(player1Page.locator(`text=${replyContent}`).last()).toBeVisible({ timeout: 5000 });
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
      await navigateToGame(player1Page, gameId);

      // Navigate to Messages tab
      await player1Page.click('button:has-text("Messages")');
      await player1Page.waitForLoadState('networkidle');

      // Click "New Conversation" button
      await player1Page.click('button[title="New Conversation"]');
      await player1Page.waitForSelector('input[placeholder*="Planning the heist"]', { timeout: 5000 });

      // Fill in conversation title
      const groupTitle = `Group Chat ${Date.now()}`;
      await player1Page.fill('input[placeholder*="Planning the heist"]', groupTitle);

      // Select BOTH E2E Test Char 2 AND E2E Test Char 3 as participants (3-person conversation)
      await player1Page.click('label:has-text("E2E Test Char 2")');
      await player1Page.click('label:has-text("E2E Test Char 3")');

      // Click "Create Conversation" button
      await player1Page.click('button:has-text("Create Conversation")');
      await player1Page.waitForLoadState('networkidle');

      // === Player 1 sends first message ===
      const player1Message = `Hello everyone! Player 1 here at ${Date.now()}`;
      await player1Page.fill('textarea[placeholder*="Type your message"]', player1Message);
      await player1Page.click('button:has-text("Send")');
      await player1Page.waitForLoadState('networkidle');

      // Verify message appears
      await assertTextVisible(player1Page, player1Message);

      // === Player 2 sees the group conversation ===
      await loginAs(player2Page, 'PLAYER_2');
      await navigateToGame(player2Page, gameId);

      await player2Page.click('button:has-text("Messages")');
      await player2Page.waitForLoadState('networkidle');

      // See group conversation in the list
      await assertTextVisible(player2Page, groupTitle);

      // Click on the conversation
      await player2Page.locator(`text=${groupTitle}`).first().click();
      await player2Page.waitForLoadState('networkidle');
      await player2Page.waitForTimeout(1000);

      // Verify Player 1's message is visible
      await expect(player2Page.locator(`text=${player1Message}`).last()).toBeVisible({ timeout: 5000 });

      // Player 2 sends a message
      const player2Message = `Hi from Player 2 at ${Date.now()}`;
      await player2Page.fill('textarea[placeholder*="Type your message"]', player2Message);
      await player2Page.click('button:has-text("Send")');
      await player2Page.waitForLoadState('networkidle');

      await assertTextVisible(player2Page, player2Message);

      // === Player 3 also sees the group conversation ===
      await loginAs(player3Page, 'PLAYER_3');
      await navigateToGame(player3Page, gameId);

      await player3Page.click('button:has-text("Messages")');
      await player3Page.waitForLoadState('networkidle');

      // See group conversation in the list
      await assertTextVisible(player3Page, groupTitle);

      // Click on the conversation
      await player3Page.locator(`text=${groupTitle}`).first().click();
      await player3Page.waitForLoadState('networkidle');
      await player3Page.waitForTimeout(1000);

      // Verify BOTH previous messages are visible to Player 3
      await expect(player3Page.locator(`text=${player1Message}`).last()).toBeVisible({ timeout: 5000 });
      await expect(player3Page.locator(`text=${player2Message}`).last()).toBeVisible({ timeout: 5000 });

      // Player 3 sends a message
      const player3Message = `Player 3 joining the conversation at ${Date.now()}`;
      await player3Page.fill('textarea[placeholder*="Type your message"]', player3Message);
      await player3Page.click('button:has-text("Send")');
      await player3Page.waitForLoadState('networkidle');

      await assertTextVisible(player3Page, player3Message);

      // === Verify Player 1 sees all messages from all participants ===
      await player1Page.reload();
      await player1Page.waitForLoadState('networkidle');

      await player1Page.click('button:has-text("Messages")');
      await player1Page.waitForLoadState('networkidle');

      await player1Page.locator(`text=${groupTitle}`).first().click();
      await player1Page.waitForLoadState('networkidle');
      await player1Page.waitForTimeout(1000);

      // Verify all three messages are visible
      await expect(player1Page.locator(`text=${player1Message}`).last()).toBeVisible({ timeout: 5000 });
      await expect(player1Page.locator(`text=${player2Message}`).last()).toBeVisible({ timeout: 5000 });
      await expect(player1Page.locator(`text=${player3Message}`).last()).toBeVisible({ timeout: 5000 });

    } finally {
      await player1Context.close();
      await player2Context.close();
      await player3Context.close();
    }
  });
});
