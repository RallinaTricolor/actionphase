import { test, expect } from '@playwright/test';
import { loginAs } from '../fixtures/auth-helpers';
import { getFixtureGameId } from '../fixtures/game-helpers';

/**
 * Journey 3: Player Creates Character & Joins Game
 *
 * Tests the complete character creation flow after player is approved.
 * Test 1 creates a full game workflow to test player character creation after approval.
 * Test 2 uses fixtures (Game #165) to test GM NPC creation, saving ~3-4 seconds.
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
      await expect(gmPage.locator('#title')).toBeVisible({ timeout: 5000 });
      await gmPage.waitForTimeout(500);
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
      await gmPage.waitForTimeout(1000);

      // === Player Application ===
      // Login as player and apply to the game
      await loginAs(playerPage, 'PLAYER_1');
      await playerPage.goto(`/games/${gameId}`);
      await playerPage.waitForLoadState('networkidle');

      // Apply to join the game
      await playerPage.click('button:has-text("Apply to Join")');
      await playerPage.waitForTimeout(500);
      await playerPage.click('button:has-text("Submit Application")');
      await playerPage.waitForTimeout(1000);

      // === GM Approval ===
      // GM approves the player
      await gmPage.click('button:has-text("Applications")');
      await expect(gmPage.locator('h3:has-text("TestPlayer1")')).toBeVisible({ timeout: 5000 });
      await gmPage.click('button:has-text("Approve")');
      await gmPage.waitForTimeout(1000);

      // GM transitions game to character_creation state
      await gmPage.click('button:has-text("Close Recruitment")');
      await gmPage.waitForTimeout(1000);

      // === Player Creates Character ===
      // Reload player page to see updated game state
      await playerPage.reload();
      await playerPage.waitForLoadState('networkidle');

      // Click on "Characters" tab
      await playerPage.click('button:has-text("Characters")');
      await expect(playerPage.locator('h2:has-text("Characters")')).toBeVisible({ timeout: 5000 });

      // Click "Create Character"
      await playerPage.click('button:has-text("Create Character")');
      await expect(playerPage.locator('#name')).toBeVisible({ timeout: 5000 });
      await playerPage.waitForTimeout(500);

      // Fill in character details
      const characterName = `Test Character ${Date.now()}`;
      await playerPage.fill('#name', characterName);

      // Submit the form
      await playerPage.click('form button[type="submit"]:has-text("Create Character")');
      await playerPage.waitForTimeout(2000);

      // Verify character appears in character list
      await expect(playerPage.locator(`h4:has-text("${characterName}")`)).toBeVisible({ timeout: 10000 });
      await expect(playerPage.locator('text=Your Character')).toBeVisible();
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
    await page.goto(`/games/${gameId}`);
    await page.waitForLoadState('networkidle');

    // Click on "Characters" tab
    await page.click('button:has-text("Characters")');

    // Wait for Characters section to load
    await expect(page.locator('h2:has-text("Characters")')).toBeVisible({ timeout: 5000 });

    // GM should see "Create Character" button
    await expect(page.locator('button:has-text("Create Character")')).toBeVisible({ timeout: 5000 });

    // Click "Create Character"
    await page.click('button:has-text("Create Character")');

    // Wait for modal
    await expect(page.locator('#name')).toBeVisible({ timeout: 5000 });
    await page.waitForTimeout(500);

    // Fill in NPC details
    const npcName = `Test NPC ${Date.now()}`;
    await page.fill('#name', npcName);

    // Select "GM-Controlled NPC" from character type dropdown
    await page.selectOption('#character_type', 'npc_gm');

    // Submit the form
    await page.click('form button[type="submit"]:has-text("Create Character")');

    // Wait for modal to close
    await page.waitForTimeout(500);

    // Wait for character list to update
    await page.waitForTimeout(2000);

    // Verify NPC appears in character list
    await expect(page.locator(`h4:has-text("${npcName}")`)).toBeVisible({ timeout: 10000 });

    // Verify it's in the GM NPCs section
    await expect(page.locator('text=GM NPCs')).toBeVisible();
  });
});
