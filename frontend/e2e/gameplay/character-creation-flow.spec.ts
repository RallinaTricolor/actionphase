import { test, expect } from '@playwright/test';
import { loginAs } from '../fixtures/auth-helpers';
import { getFixtureGameId } from '../fixtures/game-helpers';
import { GameDetailsPage } from '../pages/GameDetailsPage';
import { navigateToGame } from '../utils/navigation';
import { assertTextVisible } from '../utils/assertions';
import { waitForModal } from '../utils/waits';

/**
 * Journey 3: Player Creates Character & Joins Game
 *
 * Tests the complete character creation flow after player is approved.
 * Test 1 creates a full game workflow to test player character creation after approval.
 * Test 2 uses fixtures (Game #165) to test GM NPC creation, saving ~3-4 seconds.
 *
 * REFACTORED: Using Page Object Model and shared utilities
 * - Eliminated all waitForTimeout calls (was 11)
 * - Uses GameDetailsPage for tab navigation
 * - Uses assertion utilities for consistency
 * - Uses waitForModal and smart waits
 */
test.describe('Character Creation Flow', () => {
  test('Player can create a character after being approved', async ({ browser }) => {
    // This test requires two users: GM and Player
    const gmContext = await browser.newContext();
    const playerContext = await browser.newContext();
    const gmPage = await gmContext.newPage();
    const playerPage = await playerContext.newPage();

    try {
      // === GM Setup ===
      // Login as GM and create a game
      await loginAs(gmPage, 'GM');
      const timestamp = Date.now();
      const gameTitle = `E2E Character Test ${timestamp}`;

      await gmPage.click('a[href="/games"]');
      await gmPage.click('button:has-text("Create Game")');
      // Wait for the game creation form to appear
      await gmPage.waitForSelector('#title', { timeout: 5000 });
      await gmPage.fill('#title', gameTitle);
      await gmPage.fill('#description', 'E2E test for player character creation');
      await gmPage.fill('#genre', 'Test');
      await gmPage.fill('#max_players', '4');
      await gmPage.click('form button[type="submit"]:has-text("Create Game")');
      await gmPage.waitForURL(/\/games\/\d+/);

      // Extract game ID from URL
      const gameUrl = gmPage.url();
      const gameId = gameUrl.match(/\/games\/(\d+)/)?.[1];

      // Start recruitment
      await gmPage.click('button:has-text("Start Recruitment")');
      await gmPage.waitForLoadState('networkidle');

      // === Player Application ===
      // Login as player and apply to the game
      await loginAs(playerPage, 'PLAYER_1');
      await navigateToGame(playerPage, parseInt(gameId!));

      // Apply to join the game
      await playerPage.click('button:has-text("Apply to Join")');
      // Wait for the application form to appear
      await playerPage.waitForSelector('button:has-text("Submit Application")', { timeout: 5000 });
      await playerPage.click('button:has-text("Submit Application")');
      await playerPage.waitForLoadState('networkidle');

      // === GM Approval ===
      // GM approves the player using GameDetailsPage
      const gmGamePage = new GameDetailsPage(gmPage);
      await gmGamePage.goToApplications();
      await expect(gmPage.locator('h3:has-text("TestPlayer1")')).toBeVisible({ timeout: 5000 });
      await gmPage.click('button:has-text("Approve")');
      await gmPage.waitForLoadState('networkidle');

      // GM transitions game to character_creation state
      await gmPage.click('button:has-text("Close Recruitment")');
      await gmPage.waitForLoadState('networkidle');

      // === Player Creates Character ===
      // Reload player page to see updated game state
      await playerPage.reload();
      await playerPage.waitForLoadState('networkidle');

      // Use GameDetailsPage for navigation
      const playerGamePage = new GameDetailsPage(playerPage);
      await playerGamePage.goToCharacters();

      // Verify Characters section loaded
      await assertTextVisible(playerPage, 'Characters');

      // Click "Create Character"
      await playerPage.click('button:has-text("Create Character")');
      // Wait for the character creation form to appear
      await playerPage.waitForSelector('#name', { timeout: 5000 });

      // Fill in character details
      const characterName = `Test Character ${Date.now()}`;
      await playerPage.fill('#name', characterName);

      // Submit the form
      await playerPage.click('form button[type="submit"]:has-text("Create Character")');
      await playerPage.waitForLoadState('networkidle');

      // Verify character appears in character list
      await expect(playerPage.locator(`h4:has-text("${characterName}")`)).toBeVisible({ timeout: 10000 });
      await assertTextVisible(playerPage, 'Your Character');
    } finally {
      await gmContext.close();
      await playerContext.close();
    }
  });

  test('GM can create NPC characters', async ({ page }) => {
    // Login as GM
    await loginAs(page, 'GM');

    // Use "The Heist at Goldstone Bank" from fixtures (already in in_progress state)
    // This saves ~3-4 seconds by avoiding game creation
    const gameId = await getFixtureGameId(page, 'HEIST');

    // Use GameDetailsPage for navigation
    const gamePage = new GameDetailsPage(page);
    await gamePage.goto(gameId);
    await gamePage.goToCharacters();

    // Wait for Characters section to load
    await assertTextVisible(page, 'Characters');

    // GM should see "Create Character" button
    await expect(page.locator('button:has-text("Create Character")')).toBeVisible({ timeout: 5000 });

    // Click "Create Character"
    await page.click('button:has-text("Create Character")');
    // Wait for the character creation form to appear
    await page.waitForSelector('#name', { timeout: 5000 });

    // Fill in NPC details
    const npcName = `Test NPC ${Date.now()}`;
    await page.fill('#name', npcName);

    // Select "GM-Controlled NPC" from character type dropdown
    await page.selectOption('#character_type', 'npc_gm');

    // Submit the form
    await page.click('form button[type="submit"]:has-text("Create Character")');
    await page.waitForLoadState('networkidle');

    // Verify NPC appears in character list
    await expect(page.locator(`h4:has-text("${npcName}")`)).toBeVisible({ timeout: 10000 });

    // Verify it's in the GM NPCs section
    await assertTextVisible(page, 'GM NPCs');
  });
});
