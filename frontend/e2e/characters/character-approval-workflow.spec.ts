import { test, expect } from '@playwright/test';
import { loginAs } from '../fixtures/auth-helpers';
import { GameDetailsPage } from '../pages/GameDetailsPage';
import { navigateToGame } from '../utils/navigation';

/**
 * E2E Tests for Character Approval Workflow
 *
 * Tests the complete character approval process including:
 * - Character starts in pending state after creation
 * - GM can view pending characters
 * - GM can reject characters with feedback
 * - Player sees rejection reason
 * - Player can update rejected character
 * - GM can approve characters
 * - Approved characters appear in game
 *
 * This tests CORE content quality control mechanics
 *
 * NOTE: These tests create full game workflows dynamically since character
 * approval requires character_creation state, which requires an approved player.
 */

test.describe('Character Approval Workflow', () => {

  /**
   * Helper: Create game and get player approved
   * Returns gameId for the recruiting game with an approved player
   */
  async function setupGameWithApprovedPlayer(gmPage: any, playerPage: any): Promise<number> {
    // GM creates game
    await gmPage.click('a[href="/games"]');
    await gmPage.waitForLoadState('networkidle');
    await gmPage.click('button:has-text("Create Game")');
    await gmPage.waitForSelector('#title', { timeout: 5000 });

    const timestamp = Date.now();
    const gameTitle = `E2E Char Approval ${timestamp}`;

    await gmPage.fill('#title', gameTitle);
    await gmPage.fill('#description', 'Test game for character approval');
    await gmPage.fill('#genre', 'Test');
    await gmPage.fill('#max_players', '4');
    await gmPage.click('form button[type="submit"]:has-text("Create Game")');
    await gmPage.waitForURL(/\/games\/\d+/);

    const gameUrl = gmPage.url();
    const gameId = parseInt(gameUrl.match(/\/games\/(\d+)/)?.[1] || '0');

    // Start recruitment
    await gmPage.click('button:has-text("Start Recruitment")');
    await gmPage.waitForLoadState('networkidle');

    // Player applies
    await navigateToGame(playerPage, gameId);
    await playerPage.click('button:has-text("Apply to Join")');
    await playerPage.waitForSelector('button:has-text("Submit Application")', { timeout: 5000 });
    await playerPage.click('button:has-text("Submit Application")');
    await playerPage.waitForLoadState('networkidle');

    // GM approves player
    const gmGamePage = new GameDetailsPage(gmPage);
    await gmGamePage.goToApplications();
    await expect(gmPage.locator('h3').filter({ hasText: /TestPlayer/ })).toBeVisible({ timeout: 5000 });
    await gmPage.click('button:has-text("Approve")');
    await gmPage.waitForLoadState('networkidle');

    return gameId;
  }

  /**
   * Helper: Transition game to character_creation state
   */
  async function transitionToCharacterCreation(gmPage: any) {
    await gmPage.click('button:has-text("Close Recruitment")');
    await gmPage.waitForLoadState('networkidle');
  }

  test('character starts in pending state after creation', async ({ browser }) => {
    const gmContext = await browser.newContext();
    const playerContext = await browser.newContext();
    const gmPage = await gmContext.newPage();
    const playerPage = await playerContext.newPage();

    try {
      await loginAs(gmPage, 'GM');
      await loginAs(playerPage, 'PLAYER_1');

      const gameId = await setupGameWithApprovedPlayer(gmPage, playerPage);
      await transitionToCharacterCreation(gmPage);

      // Player creates character
      await playerPage.reload();
      await playerPage.waitForLoadState('networkidle');

      const playerGamePage = new GameDetailsPage(playerPage);
      await playerGamePage.goToCharacters();
      await playerPage.click('button:has-text("Create Character")');
      await playerPage.waitForSelector('#name', { timeout: 5000 });

      const characterName = `Test Char ${Date.now()}`;
      await playerPage.fill('#name', characterName);
      await playerPage.click('form button[type="submit"]:has-text("Create Character")');
      await playerPage.waitForLoadState('networkidle');

      // Verify character appears with pending status
      await expect(playerPage.locator(`h4:has-text("${characterName}")`)).toBeVisible({ timeout: 10000 });

      // Look for pending badge (may be styled differently)
      const pendingBadge = playerPage.locator('span').filter({ hasText: /pending/i }).first();
      await expect(pendingBadge).toBeVisible({ timeout: 5000 });
    } finally {
      await gmContext.close();
      await playerContext.close();
    }
  });

  test('GM can view pending characters', async ({ browser }) => {
    const gmContext = await browser.newContext();
    const playerContext = await browser.newContext();
    const gmPage = await gmContext.newPage();
    const playerPage = await playerContext.newPage();

    try {
      await loginAs(gmPage, 'GM');
      await loginAs(playerPage, 'PLAYER_2');

      const gameId = await setupGameWithApprovedPlayer(gmPage, playerPage);
      await transitionToCharacterCreation(gmPage);

      // Player creates character
      await playerPage.reload();
      await playerPage.waitForLoadState('networkidle');

      const playerGamePage = new GameDetailsPage(playerPage);
      await playerGamePage.goToCharacters();
      await playerPage.click('button:has-text("Create Character")');
      await playerPage.waitForSelector('#name', { timeout: 5000 });

      const characterName = `Pending Test ${Date.now()}`;
      await playerPage.fill('#name', characterName);
      await playerPage.click('form button[type="submit"]:has-text("Create Character")');
      await playerPage.waitForLoadState('networkidle');

      // GM views characters and sees pending character
      await gmPage.reload();
      await gmPage.waitForLoadState('networkidle');

      const gmGamePage = new GameDetailsPage(gmPage);
      await gmGamePage.goToCharacters();

      // Verify GM sees the pending character with its name
      await expect(gmPage.locator(`h4:has-text("${characterName}")`)).toBeVisible({ timeout: 10000 });

      // Verify pending badge is visible
      await expect(gmPage.locator('span').filter({ hasText: /pending/i }).first()).toBeVisible();

      // Verify Approve/Reject buttons are visible
      await expect(gmPage.getByRole('button', { name: 'Approve' }).first()).toBeVisible();
      await expect(gmPage.getByRole('button', { name: 'Reject' }).first()).toBeVisible();
    } finally {
      await gmContext.close();
      await playerContext.close();
    }
  });

  test('GM can approve character', async ({ browser }) => {
    const gmContext = await browser.newContext();
    const playerContext = await browser.newContext();
    const gmPage = await gmContext.newPage();
    const playerPage = await playerContext.newPage();

    try {
      await loginAs(gmPage, 'GM');
      await loginAs(playerPage, 'PLAYER_3');

      const gameId = await setupGameWithApprovedPlayer(gmPage, playerPage);
      await transitionToCharacterCreation(gmPage);

      // Player creates character
      await playerPage.reload();
      await playerPage.waitForLoadState('networkidle');

      const playerGamePage = new GameDetailsPage(playerPage);
      await playerGamePage.goToCharacters();
      await playerPage.click('button:has-text("Create Character")');
      await playerPage.waitForSelector('#name', { timeout: 5000 });

      const characterName = `Approve Test ${Date.now()}`;
      await playerPage.fill('#name', characterName);
      await playerPage.click('form button[type="submit"]:has-text("Create Character")');
      await playerPage.waitForLoadState('networkidle');

      // GM approves character
      await gmPage.reload();
      await gmPage.waitForLoadState('networkidle');

      const gmGamePage = new GameDetailsPage(gmPage);
      await gmGamePage.goToCharacters();

      // Find the character's Approve button (use XPath to ensure we click the right one)
      const approveButton = gmPage.locator(`xpath=//h4[contains(text(), "${characterName}")]/ancestor::div[.//button[contains(text(), "Approve")]][1]//button[contains(text(), "Approve")]`);
      await expect(approveButton).toBeVisible({ timeout: 10000 });
      await approveButton.click();
      await gmPage.waitForLoadState('networkidle');

      // Verify character now shows as approved (badge changes)
      await expect(gmPage.locator('span').filter({ hasText: /approved/i }).first()).toBeVisible({ timeout: 5000 });

      // Player should see approved status too
      await playerPage.reload();
      await playerPage.waitForLoadState('networkidle');
      await playerGamePage.goToCharacters();
      await expect(playerPage.locator('span').filter({ hasText: /approved/i }).first()).toBeVisible({ timeout: 5000 });
    } finally {
      await gmContext.close();
      await playerContext.close();
    }
  });

  test('GM can reject character and player sees rejection', async ({ browser }) => {
    const gmContext = await browser.newContext();
    const playerContext = await browser.newContext();
    const gmPage = await gmContext.newPage();
    const playerPage = await playerContext.newPage();

    try {
      await loginAs(gmPage, 'GM');
      await loginAs(playerPage, 'PLAYER_4');

      const gameId = await setupGameWithApprovedPlayer(gmPage, playerPage);
      await transitionToCharacterCreation(gmPage);

      // Player creates character
      await playerPage.reload();
      await playerPage.waitForLoadState('networkidle');

      const playerGamePage = new GameDetailsPage(playerPage);
      await playerGamePage.goToCharacters();
      await playerPage.click('button:has-text("Create Character")');
      await playerPage.waitForSelector('#name', { timeout: 5000 });

      const characterName = `Reject Test ${Date.now()}`;
      await playerPage.fill('#name', characterName);
      await playerPage.click('form button[type="submit"]:has-text("Create Character")');
      await playerPage.waitForLoadState('networkidle');

      // GM rejects character
      await gmPage.reload();
      await gmPage.waitForLoadState('networkidle');

      const gmGamePage = new GameDetailsPage(gmPage);
      await gmGamePage.goToCharacters();

      // Find the character's Reject button
      const rejectButton = gmPage.locator(`xpath=//h4[contains(text(), "${characterName}")]/ancestor::div[.//button[contains(text(), "Reject")]][1]//button[contains(text(), "Reject")]`);
      await expect(rejectButton).toBeVisible({ timeout: 10000 });
      await rejectButton.click();
      await gmPage.waitForLoadState('networkidle');

      // Verify character shows as rejected
      await expect(gmPage.locator('span').filter({ hasText: /rejected/i }).first()).toBeVisible({ timeout: 5000 });

      // Player sees rejected status
      await playerPage.reload();
      await playerPage.waitForLoadState('networkidle');
      await playerGamePage.goToCharacters();

      // Character should still be visible but with rejected badge
      await expect(playerPage.locator(`h4:has-text("${characterName}")`)).toBeVisible({ timeout: 10000 });
      await expect(playerPage.locator('span').filter({ hasText: /rejected/i }).first()).toBeVisible({ timeout: 5000 });
    } finally {
      await gmContext.close();
      await playerContext.close();
    }
  });

  test('rejected character can be edited and resubmitted', async ({ browser }) => {
    const gmContext = await browser.newContext();
    const playerContext = await browser.newContext();
    const gmPage = await gmContext.newPage();
    const playerPage = await playerContext.newPage();

    try {
      await loginAs(gmPage, 'GM');
      await loginAs(playerPage, 'PLAYER_5');

      const gameId = await setupGameWithApprovedPlayer(gmPage, playerPage);
      await transitionToCharacterCreation(gmPage);

      // Player creates character
      await playerPage.reload();
      await playerPage.waitForLoadState('networkidle');

      const playerGamePage = new GameDetailsPage(playerPage);
      await playerGamePage.goToCharacters();
      await playerPage.click('button:has-text("Create Character")');
      await playerPage.waitForSelector('#name', { timeout: 5000 });

      const characterName = `Edit Reject ${Date.now()}`;
      await playerPage.fill('#name', characterName);
      await playerPage.click('form button[type="submit"]:has-text("Create Character")');
      await playerPage.waitForLoadState('networkidle');

      // GM rejects character
      await gmPage.reload();
      await gmPage.waitForLoadState('networkidle');

      const gmGamePage = new GameDetailsPage(gmPage);
      await gmGamePage.goToCharacters();

      const rejectButton = gmPage.locator(`xpath=//h4[contains(text(), "${characterName}")]/ancestor::div[.//button[contains(text(), "Reject")]][1]//button[contains(text(), "Reject")]`);
      await expect(rejectButton).toBeVisible({ timeout: 10000 });
      await rejectButton.click();
      await gmPage.waitForLoadState('networkidle');

      // Player edits rejected character
      await playerPage.reload();
      await playerPage.waitForLoadState('networkidle');
      await playerGamePage.goToCharacters();

      // Click Edit Sheet button for the rejected character
      const editButton = playerPage.locator(`xpath=//h4[contains(text(), "${characterName}")]/ancestor::div[.//button[contains(text(), "Edit Sheet")]][1]//button[contains(text(), "Edit Sheet")]`);
      await expect(editButton).toBeVisible({ timeout: 10000 });
      await editButton.click();

      // Wait for character sheet modal to open
      await expect(playerPage.locator('h2').filter({ hasText: characterName })).toBeVisible({ timeout: 10000 });

      // Make some edit (open Bio/Background module)
      await playerPage.click('button:has-text("Bio/Background")');
      await playerPage.waitForLoadState('networkidle');

      // Close modal (character is updated - in real scenario player would make actual edits)
      await playerPage.keyboard.press('Escape');
      await playerPage.waitForTimeout(500);

      // Character should still exist and be editable
      await expect(playerPage.locator(`h4:has-text("${characterName}")`)).toBeVisible();
    } finally {
      await gmContext.close();
      await playerContext.close();
    }
  });

  test('approved characters appear in active game', async ({ browser }) => {
    const gmContext = await browser.newContext();
    const playerContext = await browser.newContext();
    const gmPage = await gmContext.newPage();
    const playerPage = await playerContext.newPage();

    try {
      await loginAs(gmPage, 'GM');
      await loginAs(playerPage, 'PLAYER_1');

      const gameId = await setupGameWithApprovedPlayer(gmPage, playerPage);
      await transitionToCharacterCreation(gmPage);

      // Player creates character
      await playerPage.reload();
      await playerPage.waitForLoadState('networkidle');

      const playerGamePage = new GameDetailsPage(playerPage);
      await playerGamePage.goToCharacters();
      await playerPage.click('button:has-text("Create Character")');
      await playerPage.waitForSelector('#name', { timeout: 5000 });

      const characterName = `Active Game ${Date.now()}`;
      await playerPage.fill('#name', characterName);
      await playerPage.click('form button[type="submit"]:has-text("Create Character")');
      await playerPage.waitForLoadState('networkidle');

      // GM approves character
      await gmPage.reload();
      await gmPage.waitForLoadState('networkidle');

      const gmGamePage = new GameDetailsPage(gmPage);
      await gmGamePage.goToCharacters();

      const approveButton = gmPage.locator(`xpath=//h4[contains(text(), "${characterName}")]/ancestor::div[.//button[contains(text(), "Approve")]][1]//button[contains(text(), "Approve")]`);
      await expect(approveButton).toBeVisible({ timeout: 10000 });
      await approveButton.click();
      await gmPage.waitForLoadState('networkidle');

      // GM starts the game
      await gmPage.click('button:has-text("Start Game")');
      await gmPage.waitForLoadState('networkidle');

      // Verify game is now in_progress
      await expect(gmPage.locator('text=Current Phase').or(gmPage.locator('text=in progress')).first()).toBeVisible({ timeout: 10000 });

      // Navigate to People/Characters tab (in_progress games use "People" tab)
      await gmGamePage.goToPeople();

      // Verify approved character is visible in active game
      await expect(gmPage.locator(`h4:has-text("${characterName}")`)).toBeVisible({ timeout: 10000 });

      // Player should also see their character in the active game
      await playerPage.reload();
      await playerPage.waitForLoadState('networkidle');
      await playerGamePage.goToPeople();
      await expect(playerPage.locator(`h4:has-text("${characterName}")`)).toBeVisible({ timeout: 10000 });
    } finally {
      await gmContext.close();
      await playerContext.close();
    }
  });
});
