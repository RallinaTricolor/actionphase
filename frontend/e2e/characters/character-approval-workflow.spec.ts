import { test, expect } from '@playwright/test';
import { loginAs } from '../fixtures/auth-helpers';
import { getFixtureGameId } from '../fixtures/game-helpers';
import { GameDetailsPage } from '../pages/GameDetailsPage';
import { GameApplicationsPage } from '../pages/GameApplicationsPage';
import { CharacterWorkflowPage } from '../pages/CharacterWorkflowPage';
import { navigateToGame } from '../utils/navigation';

/**
 * E2E Tests for Character Approval Workflow
 *
 * Tests the complete character approval process including:
 * - Character starts in pending state after creation
 * - GM can view pending characters
 * - GM can approve characters
 * - Approved characters appear in game
 * - Character resubmission workflow (rejected → edited → resubmitted → pending)
 *
 * This tests CORE content quality control mechanics
 *
 * NOTE: These tests now use the E2E_CHARACTER_APPROVAL fixture which provides
 * a game in character_creation state with approved players (no characters yet).
 * This saves ~30-36 seconds of duplicated setup time across the test suite.
 */

test.describe('Character Approval Workflow', () => {

  /**
   * Helper: Create game and get player approved (DEPRECATED - use E2E_CHARACTER_APPROVAL fixture instead)
   * Returns gameId for the recruiting game with an approved player
   * @deprecated Use E2E_CHARACTER_APPROVAL fixture with getFixtureGameId instead
   */
  async function setupGameWithApprovedPlayer_DEPRECATED(gmPage: any, playerPage: any): Promise<number> {
    // GM creates game
    await gmPage.getByRole('link', { name: 'Games' }).click();
    await gmPage.waitForLoadState('networkidle');
    await gmPage.getByRole('button', { name: 'Create Game' }).click();
    await gmPage.waitForSelector('#title', { timeout: 5000 });

    const timestamp = Date.now();
    const gameTitle = `E2E Char Approval ${timestamp}`;

    await gmPage.fill('#title', gameTitle);
    await gmPage.fill('#description', 'Test game for character approval');
    await gmPage.fill('#genre', 'Test');
    await gmPage.fill('#max_players', '4');
    await gmPage.getByTestId('create-game-submit').click();
    await gmPage.waitForURL(/\/games\/\d+/);
    await gmPage.waitForLoadState('networkidle');

    const gameUrl = gmPage.url();
    const gameId = parseInt(gameUrl.match(/\/games\/(\d+)/)?.[1] || '0');

    // Start recruitment using POM
    const gmGamePage = new GameDetailsPage(gmPage);
    await gmGamePage.startRecruitment();

    // Player applies using POM
    const playerApplicationsPage = new GameApplicationsPage(playerPage, gameId);
    await navigateToGame(playerPage, gameId);
    await playerPage.waitForLoadState('networkidle');

    // Verify Apply button is visible
    expect(await playerApplicationsPage.hasApplyButton()).toBe(true);

    // Submit application using POM
    await playerApplicationsPage.submitApplication('I would like to join this game.', 'player');

    // Wait for submission to process
    await playerPage.waitForTimeout(1000);

    // Verify application was submitted by checking Apply button is gone
    await navigateToGame(playerPage, gameId);
    await playerPage.waitForLoadState('networkidle');
    expect(await playerApplicationsPage.hasApplyButton()).toBe(false);

    // GM approves player using POM
    const gmApplicationsPage = new GameApplicationsPage(gmPage, gameId);
    await gmApplicationsPage.goto();

    // Get the player's username (TestPlayer1, TestPlayer2, etc.) from the pending applications
    const pendingApplications = await gmApplicationsPage.getPendingApplications();
    expect(pendingApplications.length).toBeGreaterThan(0);

    // Approve the first pending application
    await gmApplicationsPage.approveApplication(pendingApplications[0]);

    return gameId;
  }

  /**
   * Helper: Transition game to character_creation state
   */
  async function transitionToCharacterCreation(gmPage: any) {
    await gmPage.getByRole('button', { name: 'Close Recruitment' }).click();
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

      // Use isolated fixture for parallel testing (Game #301)
      const gameId = await getFixtureGameId(playerPage, 'E2E_CHARACTER_PENDING_STATE');

      // Player creates character using POM
      const characterPage = new CharacterWorkflowPage(playerPage, gameId);
      await characterPage.goto();

      const characterName = `Test Char ${Date.now()}`;
      await characterPage.createCharacter(characterName);

      // Verify character appears with pending status using POM
      expect(await characterPage.hasCharacter(characterName)).toBe(true);
      const status = await characterPage.getCharacterStatus(characterName);
      expect(status).toBe('pending');
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

      // Use isolated fixture for parallel testing (Game #303)
      const gameId = await getFixtureGameId(playerPage, 'E2E_CHARACTER_VIEW_PENDING');

      // Player creates character using POM
      const playerCharPage = new CharacterWorkflowPage(playerPage, gameId);
      await playerCharPage.goto();

      const characterName = `Pending Test ${Date.now()}`;
      await playerCharPage.createCharacter(characterName);

      // GM views characters and sees pending character using POM
      await gmPage.reload();
      await gmPage.waitForLoadState('networkidle');

      const gmCharPage = new CharacterWorkflowPage(gmPage, gameId);
      await gmCharPage.goto();

      // Verify GM sees the pending character
      expect(await gmCharPage.hasCharacter(characterName)).toBe(true);
      const status = await gmCharPage.getCharacterStatus(characterName);
      expect(status).toBe('pending');

      // Verify pending characters count
      const pendingCount = await gmCharPage.getCharactersCountByStatus('pending');
      expect(pendingCount).toBeGreaterThan(0);
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
      await loginAs(playerPage, 'PLAYER_1');

      // Use isolated fixture for parallel testing (Game #304)
      const gameId = await getFixtureGameId(playerPage, 'E2E_CHARACTER_APPROVE');

      // Player creates character using POM
      const playerCharPage = new CharacterWorkflowPage(playerPage, gameId);
      await playerCharPage.goto();

      const characterName = `Approve Test ${Date.now()}`;
      await playerCharPage.createCharacter(characterName);

      // GM approves character using POM
      await gmPage.reload();
      await gmPage.waitForLoadState('networkidle');

      const gmCharPage = new CharacterWorkflowPage(gmPage, gameId);
      await gmCharPage.goto();

      // Approve character using POM (no more xpath!)
      await gmCharPage.approveCharacter(characterName);

      // Verify character now shows as approved
      const gmStatus = await gmCharPage.getCharacterStatus(characterName);
      expect(gmStatus).toBe('approved');

      // Player should see approved status too
      await playerPage.reload();
      await playerPage.waitForLoadState('networkidle');
      await playerCharPage.goto();

      const playerStatus = await playerCharPage.getCharacterStatus(characterName);
      expect(playerStatus).toBe('approved');
    } finally {
      await gmContext.close();
      await playerContext.close();
    }
  });

  test('rejected character can be edited and resubmitted', async ({ browser }) => {
    const gmContext = await browser.newContext();
    const gmPage = await gmContext.newPage();

    try {
      await loginAs(gmPage, 'GM');

      // Use isolated fixture for parallel testing (Game #306)
      // This character simulates a workflow where: player created → GM rejected → player edited → player resubmitted
      // The character is now in "pending" status waiting for GM approval
      const gameId = await getFixtureGameId(gmPage, 'E2E_CHARACTER_RESUBMIT');

      const gmCharPage = new CharacterWorkflowPage(gmPage, gameId);
      await gmCharPage.goto();

      // Character that was previously rejected and has been resubmitted (now pending)
      const characterName = 'Resubmitted Test Character';
      await expect(gmPage.getByText(characterName).first()).toBeVisible({ timeout: 5000 });

      // Verify it's in pending state (simulating resubmission after rejection)
      const status = await gmCharPage.getCharacterStatus(characterName);
      expect(status).toBe('pending');

      // GM approves the resubmitted character
      await gmCharPage.approveCharacter(characterName);

      // Verify character now shows as approved
      const approvedStatus = await gmCharPage.getCharacterStatus(characterName);
      expect(approvedStatus).toBe('approved');
    } finally {
      await gmContext.close();
    }
  });

  test('approved characters appear in active game', async ({ browser }) => {
    const gmContext = await browser.newContext();
    const playerContext = await browser.newContext();
    const gmPage = await gmContext.newPage();
    const playerPage = await playerContext.newPage();

    try {
      await loginAs(gmPage, 'GM');
      await loginAs(playerPage, 'PLAYER_3'); // Player 3 has the approved character in fixture

      // Use isolated fixture for parallel testing (Game #307)
      const gameId = await getFixtureGameId(playerPage, 'E2E_CHARACTER_IN_GAME');

      // Verify approved character exists
      const characterName = 'Approved Test Character';
      const playerCharPage = new CharacterWorkflowPage(playerPage, gameId);
      await playerCharPage.goto();

      const status = await playerCharPage.getCharacterStatus(characterName);
      expect(status).toBe('approved');

      // GM starts the game using POM
      const gmGamePage = new GameDetailsPage(gmPage);
      await gmPage.goto(`/games/${gameId}`);
      await gmPage.waitForLoadState('networkidle');
      await gmGamePage.startGame();

      // Verify game is now in_progress
      await expect(gmPage.getByText(/current phase|in progress/i)).toBeVisible({ timeout: 10000 });

      // Navigate to People tab (in_progress games)
      await gmPage.reload();
      await gmPage.waitForLoadState('networkidle');
      await gmPage.goto(`/games/${gameId}`);
      await gmPage.waitForLoadState('networkidle');

      const peopleTab = gmPage.getByRole('tab', { name: /People/i });
      await expect(peopleTab).toBeVisible({ timeout: 5000 });
      await peopleTab.click();
      await gmPage.waitForLoadState('networkidle');

      // Verify approved character is visible
      await expect(gmPage.getByText(characterName).first()).toBeVisible({ timeout: 10000 });

      // Player should also see their character in the active game
      await playerPage.reload();
      await playerPage.waitForLoadState('networkidle');
      await playerPage.goto(`/games/${gameId}`);
      await playerPage.waitForLoadState('networkidle');

      const playerPeopleTab = playerPage.getByRole('tab', { name: /People/i });
      await expect(playerPeopleTab).toBeVisible({ timeout: 5000 });
      await playerPeopleTab.click();
      await playerPage.waitForLoadState('networkidle');

      await expect(playerPage.getByText(characterName).first()).toBeVisible({ timeout: 10000 });
    } finally {
      await gmContext.close();
      await playerContext.close();
    }
  });
});
