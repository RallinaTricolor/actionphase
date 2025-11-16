import { test, expect, Page } from '@playwright/test';
import { loginAs } from '../fixtures/auth-helpers';
import { GameDetailsPage } from '../pages/GameDetailsPage';
import { GamesListPage } from '../pages/GamesListPage';
import { GameSettingsPage } from '../pages/GameSettingsPage';
import { navigateToGamesList } from '../utils/navigation';

/**
 * Journey 2: GM Creates Game & Recruits Players
 *
 * Tests the complete game creation and player recruitment flow
 *
 * REFACTORED: Using Page Object Model and shared utilities
 * - Eliminated all waitForTimeout calls (was 1)
 * - Improved consistency with GameDetailsPage
 */
test.describe('GM Creates Game & Recruits Players', () => {
  // Configure tests to run serially to avoid database conflicts
  test.describe.configure({ mode: 'serial' });

  // Helper function to create a game using POM
  async function createTestGame(page: Page) {
    const timestamp = Date.now();
    const gameTitle = `E2E Test Game ${timestamp}`;
    const gameDescription = `Test game created by E2E tests`;

    await navigateToGamesList(page);

    // Use GamesListPage POM to create the game
    const gamesListPage = new GamesListPage(page);
    await gamesListPage.createGame({
      title: gameTitle,
      description: gameDescription,
      genre: 'Test Genre',
      maxPlayers: 4
    });

    return { gameTitle, gameDescription };
  }

  test('GM can create a game', async ({ page }) => {
    // Login as GM
    await loginAs(page, 'GM');
    await expect(page).toHaveURL('/dashboard');

    // Create a game
    const { gameTitle } = await createTestGame(page);

    // Verify we're on game details page with the correct title
    await assertTextVisible(page, gameTitle);
    await assertTextVisible(page, 'Setup'); // Initial state
  });

  test('GM can start recruitment for a game', async ({ page }) => {
    // Login as GM
    await loginAs(page, 'GM');
    await expect(page).toHaveURL('/dashboard');

    // Create a game
    const { gameTitle } = await createTestGame(page);

    // Should be on game details page after creation
    await assertTextVisible(page, gameTitle);
    await assertTextVisible(page, 'Setup');

    // Start recruitment using GameDetailsPage
    const gamePage = new GameDetailsPage(page);
    await gamePage.startRecruitment();

    // Verify state changed to Recruitment (button no longer visible)
    await expect(page.getByRole('button', { name: 'Start Recruitment' })).not.toBeVisible({ timeout: 5000 });

    // Verify recruitment-specific content
    await expect(page.getByRole('heading', { name: /Recruitment Deadline/i, level: 3 }).locator('visible=true').first()).toBeVisible();
  });

  test('GM can create a game with anonymous mode and auto accept audience enabled', async ({ page }) => {
    // Login as GM
    await loginAs(page, 'GM');
    await expect(page).toHaveURL('/dashboard');

    // Navigate to games list
    await navigateToGamesList(page);

    // Create a game with both settings enabled
    const timestamp = Date.now();
    const gameTitle = `E2E Settings Test ${timestamp}`;
    const gamesListPage = new GamesListPage(page);
    const gameId = await gamesListPage.createGame({
      title: gameTitle,
      description: 'Testing game creation with settings enabled',
      genre: 'Test Genre',
      maxPlayers: 4,
      isAnonymous: true,
      autoAcceptAudience: true
    });

    // Verify we're on game details page
    await assertTextVisible(page, gameTitle);
    await expect(page).toHaveURL(`/games/${gameId}`);

    // Open edit modal to verify settings persisted
    const settingsPage = new GameSettingsPage(page);
    await settingsPage.openEditModal();

    // Verify both settings are enabled
    expect(await settingsPage.isAnonymous()).toBe(true);
    expect(await settingsPage.isAutoAcceptAudience()).toBe(true);

    await settingsPage.cancel();
  });
});
