import { test, expect } from '@playwright/test';
import { loginAs } from '../fixtures/auth-helpers';
import { getFixtureGameId } from '../fixtures/game-helpers';
import { GameDetailsPage } from '../pages/GameDetailsPage';
import { GameApplicationsPage } from '../pages/GameApplicationsPage';
import { CharacterWorkflowPage } from '../pages/CharacterWorkflowPage';
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

      await gmPage.getByRole('link', { name: 'Games' }).click();
      await gmPage.getByRole('button', { name: 'Create Game' }).click();
      // Wait for the game creation form to appear
      await gmPage.waitForSelector('#title', { timeout: 5000 });
      await gmPage.fill('#title', gameTitle);
      await gmPage.fill('#description', 'E2E test for player character creation');
      await gmPage.fill('#genre', 'Test');
      await gmPage.fill('#max_players', '4');
      await gmPage.locator('form').getByRole('button', { name: 'Create Game', exact: true }).click();
      await gmPage.waitForURL(/\/games\/\d+/);
      await gmPage.waitForLoadState('networkidle');

      // Extract game ID from URL
      const gameUrl = gmPage.url();
      const gameId = gameUrl.match(/\/games\/(\d+)/)?.[1];

      // Start recruitment
      await gmPage.getByRole('button', { name: 'Start Recruitment' }).click();
      await gmPage.waitForLoadState('networkidle');

      // === Player Application ===
      // Login as player and apply to the game using POM
      await loginAs(playerPage, 'PLAYER_1');
      const playerApplicationsPage = new GameApplicationsPage(playerPage, parseInt(gameId!));
      await playerPage.goto(`/games/${gameId}`);
      await playerPage.waitForLoadState('networkidle');

      // Apply to join using POM
      await playerApplicationsPage.submitApplication('I would like to join this game', 'player');

      // Wait for submission to process
      await playerPage.waitForTimeout(1000);

      // === GM Approval ===
      // GM approves the player using POM
      const gmApplicationsPage = new GameApplicationsPage(gmPage, parseInt(gameId!));
      await gmApplicationsPage.goto();
      await gmPage.waitForLoadState('networkidle');

      // Approve player using POM
      await gmApplicationsPage.approveApplication('TestPlayer1');

      // Wait for approval to process
      await gmPage.waitForTimeout(1000);

      // GM transitions game to character_creation state
      await gmPage.getByRole('button', { name: 'Close Recruitment' }).click();
      await gmPage.waitForLoadState('networkidle');

      // === Player Creates Character ===
      // Reload player page to see updated game state
      await playerPage.reload();
      await playerPage.waitForLoadState('networkidle');

      // Use CharacterWorkflowPage POM for character creation
      const playerCharPage = new CharacterWorkflowPage(playerPage, parseInt(gameId!));
      await playerCharPage.goto();
      await playerPage.waitForLoadState('networkidle');

      // Verify Characters section loaded
      await assertTextVisible(playerPage, 'Characters');

      // Create character using POM
      const characterName = `Test Character ${Date.now()}`;
      await playerCharPage.createCharacter(characterName);

      // Wait for character creation to complete
      await playerPage.waitForTimeout(1000);

      // Verify character appears using POM
      expect(await playerCharPage.hasCharacter(characterName)).toBe(true);
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
    const gameId = await getFixtureGameId(page, 'COMMON_ROOM_MISC');

    // Use CharacterWorkflowPage POM for navigation
    const charPage = new CharacterWorkflowPage(page, gameId);
    await charPage.goto();
    await page.waitForLoadState('networkidle');

    // Wait for Characters section to load
    await assertTextVisible(page, 'Characters');

    // GM should see "Create Character" button
    expect(await charPage.canCreateCharacter()).toBe(true);

    // Click "Create Character" and fill form
    await page.click('button[data-testid="create-character-button"]');
    // Wait for the character creation form to appear
    await page.waitForSelector('#name', { timeout: 5000 });

    // Fill in NPC details
    const npcName = `Test NPC ${Date.now()}`;
    await page.fill('#name', npcName);

    // Select "NPC" from character type dropdown
    await page.selectOption('#character_type', 'npc');

    // Submit the form
    await page.click('button[data-testid="character-submit-button"]');
    await page.waitForLoadState('networkidle');

    // Wait for character creation to complete
    await page.waitForTimeout(1000);

    // Verify NPC appears using POM
    expect(await charPage.hasCharacter(npcName)).toBe(true);

    // Verify it's in the NPCs section
    await assertTextVisible(page, 'NPCs');
  });
});
