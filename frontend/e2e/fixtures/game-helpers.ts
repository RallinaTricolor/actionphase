import { Page, expect } from '@playwright/test';

/**
 * Game Management Helper Functions for E2E Tests
 */

/**
 * Well-known test fixture games
 * Use these constants with getFixtureGameId() to avoid brittle hardcoded IDs
 */
export const FIXTURE_GAMES = {
  // Shared fixtures (READ-ONLY - do not modify in tests)
  HEIST: 'The Heist at Goldstone Bank',           // In-progress, has phases, characters
  WESTMARCH: 'Chronicles of Westmarch',           // In-progress, lots of phases (pagination test)
  SHADOWS: 'Shadows Over Innsmouth',              // In-progress, common room phase
  DRAGON: 'The Dragon of Mount Krag',             // In-progress, complex phase history
  MANOR: 'The Mystery of Blackwood Manor',        // Recruitment state

  // Dedicated E2E fixtures (STATE-MODIFYING - safe to complete/cancel/modify)
  E2E_COMPLETE: 'E2E Test: Game to Complete',     // For testing game completion
  E2E_CANCEL: 'E2E Test: Game to Cancel',         // For testing game cancellation
  E2E_PAUSE: 'E2E Test: Game to Pause',           // For testing pause/resume
  E2E_ACTION: 'E2E Test: Action Submission',      // For testing action submissions
  E2E_ACTION_RESULTS: 'E2E Test: Action Results', // For testing action results viewing
  E2E_LIFECYCLE: 'E2E Test: Phase Lifecycle',     // For testing complete phase lifecycle
  E2E_MESSAGES: 'E2E Test: Private Messages',     // For testing private messages (dedicated game)
  E2E_PM: 'E2E Test: Private Messages',           // Alias for E2E_MESSAGES
  E2E_CHARACTER_SHEETS: 'E2E Test: Character Sheets', // For testing character sheet management
  E2E_GAME_SETTINGS: 'E2E Test: Game Settings',   // For testing game settings modifications
  E2E_GAME_APPLICATION_SUBMIT: 'E2E Test: Game Application - Submit', // Fresh game for testing player application submission
  E2E_GAME_APPLICATION_VIEW: 'E2E Test: Game Application - View', // Game with pending application for GM to view
  E2E_GAME_APPLICATION_APPROVE: 'E2E Test: Game Application - Approve', // Game with pending application for GM to approve
  E2E_GAME_APPLICATION_REJECT: 'E2E Test: Game Application - Reject', // Game with pending application for GM to reject
  E2E_GAME_APPLICATION_DUPLICATE: 'E2E Test: Game Application - Duplicate', // Game with existing application for duplicate prevention test
  E2E_GAME_LIFECYCLE_START: 'E2E Test: Game Lifecycle - Start', // Game in recruitment ready to start
  E2E_GAME_LIFECYCLE_PAUSE: 'E2E Test: Game Lifecycle - Pause', // Active game ready to pause
  E2E_GAME_LIFECYCLE_RESUME: 'E2E Test: Game Lifecycle - Resume', // Paused game ready to resume
  E2E_GAME_LIFECYCLE_COMPLETE: 'E2E Test: Game Lifecycle - Complete', // Active game ready to complete
  E2E_GAME_LIFECYCLE_CANCEL: 'E2E Test: Game Lifecycle - Cancel', // Active game ready to cancel

  // Isolated Common Room games for parallel E2E testing (one per test file)
  COMMON_ROOM_POSTS: 'E2E Common Room - Posts',           // Game #164 - for common-room.spec.ts
  COMMON_ROOM_MENTIONS: 'E2E Common Room - Mentions',     // Game #165 - for character-mentions.spec.ts
  COMMON_ROOM_NOTIFICATIONS: 'E2E Common Room - Notifications', // Game #166 - for notification-flow.spec.ts
  COMMON_ROOM_MISC: 'E2E Common Room - Misc',             // Game #167 - for misc tests
  CHARACTER_AVATARS: 'E2E Character Avatars',             // Game #168 - for character-avatar.spec.ts

  // Legacy alias (deprecated - use COMMON_ROOM_POSTS instead)
  COMMON_ROOM_TEST: 'E2E Common Room - Posts',    // Alias for Game #164
} as const;

/**
 * Get a game ID by its title (resilient to fixture resets)
 * @param page - Playwright page object
 * @param title - Game title to search for
 * @returns Game ID or null if not found
 */
export async function getGameIdByTitle(page: Page, title: string): Promise<number | null> {
  // Use page.evaluate to make fetch call with auth token from localStorage
  // This ensures we're using the same context as the logged-in user
  const result = await page.evaluate(async (titleToFind) => {
    const token = localStorage.getItem('auth_token');

    const response = await fetch('/api/v1/games/public', {
      headers: token ? { 'Authorization': `Bearer ${token}` } : {}
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch games: ${response.status}`);
    }

    const games = await response.json();
    const game = games.find((g: any) => g.title === titleToFind);

    return game ? game.id : null;
  }, title);

  return result;
}

/**
 * Get the ID for a well-known fixture game
 * @param page - Playwright page object
 * @param gameKey - Key from FIXTURE_GAMES
 * @returns Game ID
 * @throws Error if game not found
 */
export async function getFixtureGameId(
  page: Page,
  gameKey: keyof typeof FIXTURE_GAMES
): Promise<number> {
  const title = FIXTURE_GAMES[gameKey];
  const gameId = await getGameIdByTitle(page, title);

  if (gameId === null) {
    throw new Error(`Fixture game not found: ${title}. Did you apply test fixtures?`);
  }

  return gameId;
}

export interface CreateGameOptions {
  title: string;
  description?: string;
  maxPlayers?: number;
  isPublic?: boolean;
}

/**
 * Create a new game
 * @param page - Playwright page object
 * @param options - Game creation options
 * @returns Object with gameId
 */
export async function createGame(
  page: Page,
  options: CreateGameOptions
): Promise<{ gameId: number }> {
  await page.goto('/games');

  // Click create game button
  await page.click('text=Create Game');

  // Fill in game details
  await page.fill('input[name="title"]', options.title);

  if (options.description) {
    await page.fill('textarea[name="description"]', options.description);
  }

  if (options.maxPlayers) {
    await page.fill('input[name="maxPlayers"]', options.maxPlayers.toString());
  }

  // Submit form
  await page.click('button:has-text("Create")');

  // Wait for navigation to game details page
  await page.waitForURL(/\/games\/\d+/, { timeout: 10000 });

  // Extract game ID from URL
  const url = page.url();
  const gameId = parseInt(url.match(/\/games\/(\d+)/)?.[1] || '0');

  return { gameId };
}

/**
 * Start recruitment for a game
 * @param page - Playwright page object
 * @param gameId - Game ID
 */
export async function startRecruitment(page: Page, gameId: number) {
  await page.goto(`/games/${gameId}`);

  // Click start recruitment button
  await page.click('button:has-text("Start Recruitment")');

  // Wait for state change confirmation
  await expect(page.locator('text=Recruitment')).toBeVisible({ timeout: 5000 });
}

/**
 * Apply to join a game
 * @param page - Playwright page object
 * @param gameId - Game ID
 */
export async function applyToGame(page: Page, gameId: number) {
  await page.goto(`/games/${gameId}`);

  // Click apply to join button
  await page.click('button:has-text("Apply to Join")');

  // Wait for confirmation
  await expect(page.locator('text=Application Submitted')).toBeVisible({ timeout: 5000 });
}

/**
 * Approve a player's application to join a game
 * @param page - Playwright page object (must be logged in as GM)
 * @param gameId - Game ID
 * @param playerUsername - Username of player to approve
 */
export async function approveApplication(
  page: Page,
  gameId: number,
  playerUsername: string
) {
  await page.goto(`/games/${gameId}`);

  // Open applications tab/section
  await page.click('text=Applications');

  // Find the player's application row and approve
  const applicationRow = page.locator(`tr:has-text("${playerUsername}")`);
  await applicationRow.locator('button:has-text("Approve")').click();

  // Wait for confirmation
  await expect(page.locator(`text=${playerUsername}`).first()).toBeVisible();
}

/**
 * Navigate to game details page
 * @param page - Playwright page object
 * @param gameId - Game ID
 */
export async function goToGame(page: Page, gameId: number) {
  await page.goto(`/games/${gameId}`);
  await page.waitForLoadState('networkidle');
}

/**
 * Navigate to games list page
 * @param page - Playwright page object
 */
export async function goToGamesList(page: Page) {
  await page.goto('/games');
  await page.waitForLoadState('networkidle');
}

/**
 * Check if game is visible in games list
 * @param page - Playwright page object
 * @param gameTitle - Title of the game to find
 */
export async function isGameVisible(page: Page, gameTitle: string): Promise<boolean> {
  await goToGamesList(page);

  try {
    await page.waitForSelector(`text=${gameTitle}`, { timeout: 2000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * Create a phase for a game
 * @param page - Playwright page object (must be logged in as GM)
 * @param gameId - Game ID
 * @param phaseType - Type of phase ('common_room', 'action', 'results')
 * @param options - Phase creation options
 */
export async function createPhase(
  page: Page,
  gameId: number,
  phaseType: 'common_room' | 'action' | 'results',
  options: {
    title: string;
    description?: string;
    deadline?: Date;
  }
) {
  await page.goto(`/games/${gameId}`);

  // Open phase management tab
  await page.click('[role="tab"]:has-text("Phase Management")');

  // Click create phase button
  await page.click('button:has-text("Create Phase")');

  // Select phase type
  await page.selectOption('select[name="phaseType"]', phaseType);

  // Fill in phase details
  await page.fill('input[name="title"]', options.title);

  if (options.description) {
    await page.fill('textarea[name="description"]', options.description);
  }

  if (options.deadline) {
    // Format date for input (YYYY-MM-DDTHH:mm)
    const formatted = options.deadline.toISOString().slice(0, 16);
    await page.fill('input[name="deadline"]', formatted);
  }

  // Submit form
  await page.click('button:has-text("Create")');

  // Wait for phase to appear in list
  await expect(page.locator(`text=${options.title}`)).toBeVisible({ timeout: 5000 });
}
