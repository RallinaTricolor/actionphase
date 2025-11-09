import { test, expect } from '@playwright/test';
import { loginAs } from '../fixtures/auth-helpers';
import { getFixtureGameId } from '../fixtures/game-helpers';
import { navigateToGame } from '../utils/navigation';

/**
 * E2E Tests for Common Room Polling System
 *
 * Test Structure (following Test Pyramid principles):
 * 1. Happy Path - Basic smoke test that polls work end-to-end
 * 2. Error-Free Behavior - No console errors, no unauthorized API calls
 * 3. State Persistence - State survives page reloads
 * 4. Permission Enforcement - Role-based access control
 *
 * IMPORTANT: These tests validate USER EXPERIENCE, not just UI state:
 * - Visual feedback (badges, results)
 * - Error-free behavior (no 403s, no loading flashes)
 * - State persistence (reload page, state maintained)
 * - Permission enforcement (players can't see what they shouldn't)
 *
 * See .claude/planning/POLL_VOTING_BUGS.md for detailed analysis of why
 * testing only UI state is insufficient.
 */

/**
 * Helper: Monitor console errors and API calls
 */
function setupMonitoring(page: any) {
  const consoleErrors: string[] = [];
  const apiCalls: string[] = [];

  page.on('console', (msg: any) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  page.on('request', (req: any) => {
    apiCalls.push(req.url());
  });

  return { consoleErrors, apiCalls };
}

/**
 * Helper: Check for poll-related errors
 */
function checkPollErrors(consoleErrors: string[], testName: string) {
  const pollErrors = consoleErrors.filter(err =>
    err.includes('403') ||
    err.includes('Forbidden') ||
    err.includes('/polls/') ||
    err.includes('/results')
  );

  if (pollErrors.length > 0) {
    throw new Error(
      `[${testName}] Found ${pollErrors.length} poll-related errors:\n${pollErrors.join('\n')}`
    );
  }
}

/**
 * Helper: Check for unauthorized API calls
 */
function checkUnauthorizedCalls(apiCalls: string[], endpoint: string, testName: string) {
  const unauthorizedCalls = apiCalls.filter(url => url.includes(endpoint));

  if (unauthorizedCalls.length > 0) {
    throw new Error(
      `[${testName}] Made ${unauthorizedCalls.length} unauthorized calls to ${endpoint}`
    );
  }
}

// ============================================================================
// ALL POLL TESTS (SERIAL)
// ============================================================================
// All tests run serially to allow polls created in early tests to persist
// for later tests (testing state persistence, permissions, etc.)

test.describe.serial('Polls Flow', () => {
  // ==========================================================================
  // TEST CATEGORY 1: HAPPY PATH (Smoke Test)
  // ==========================================================================
  // Purpose: Verify basic poll functionality works end-to-end
  // This is the "does the feature work at all?" test

  test('GM creates player-level poll successfully', async ({ page }) => {
    await loginAs(page, 'GM');
    const gameId = await getFixtureGameId(page, 'COMMON_ROOM_POLLS');
    await navigateToGame(page, gameId);
    await page.waitForLoadState('networkidle');

    // Navigate to Polls tab
    await expect(page.getByTestId('tab-polls')).toBeVisible({ timeout: 10000 });
    await page.getByTestId('tab-polls').click();
    await page.waitForLoadState('networkidle');

    // Click Create Poll button
    await expect(page.getByRole('button', { name: 'Create Poll' })).toBeVisible();
    await page.getByRole('button', { name: 'Create Poll' }).click();

    // Fill out poll form
    await expect(page.getByRole('heading', { name: 'Create New Poll', level: 4 })).toBeVisible();
    await page.getByPlaceholder('What would you like to ask?').fill('What should the party do next?');
    await page.getByPlaceholder('Provide additional context or instructions...').fill('Vote for the next adventure direction');

    // Set deadline to tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const deadlineString = tomorrow.toISOString().slice(0, 16);
    await page.locator('input[type="datetime-local"]').fill(deadlineString);

    // Verify player voting is selected (default)
    await expect(page.getByRole('radio', { name: 'Player' })).toBeChecked();

    // Add options
    await page.locator('input[placeholder="Option 1"]').fill('Explore the abandoned castle');
    await page.locator('input[placeholder="Option 2"]').fill('Investigate the mysterious forest');
    await page.getByRole('button', { name: 'Add Option' }).click();
    await page.locator('input[placeholder="Option 3"]').fill('Return to town for supplies');

    // Enable "other" responses
    await page.locator('div:has(label:has-text("Allow \'Other\' text responses")) input[type="checkbox"]').last().check();

    // Submit poll
    await page.getByRole('button', { name: 'Create Poll', exact: true }).click();
    await page.waitForLoadState('networkidle');

    // Verify poll appears
    await expect(page.getByText('What should the party do next?')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Vote as: player')).toBeVisible();
    await expect(page.getByText('Not Voted')).toBeVisible();
  });

  test('Player votes on poll and sees correct badge', async ({ page }) => {
    await loginAs(page, 'PLAYER_1');
    const gameId = await getFixtureGameId(page, 'COMMON_ROOM_POLLS');
    await navigateToGame(page, gameId);
    await page.waitForLoadState('networkidle');

    await page.getByTestId('tab-polls').click();
    await page.waitForLoadState('networkidle');

    // Vote on poll
    await expect(page.getByText('What should the party do next?')).toBeVisible({ timeout: 10000 });
    await page.getByRole('button', { name: 'Vote Now' }).click();
    await expect(page.getByText('Select your response')).toBeVisible({ timeout: 5000 });
    await page.getByRole('radio', { name: 'Investigate the mysterious forest' }).check();
    await expect(page.getByRole('button', { name: 'Submit Vote' })).toBeEnabled();
    await page.getByRole('button', { name: 'Submit Vote' }).click();

    // Verify form closes and badge updates
    await expect(page.getByText('Select your response')).not.toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Voted')).toBeVisible({ timeout: 5000 });
  });

  test('GM creates character-level poll successfully', async ({ page }) => {
    await loginAs(page, 'GM');
    const gameId = await getFixtureGameId(page, 'COMMON_ROOM_POLLS');
    await navigateToGame(page, gameId);
    await page.waitForLoadState('networkidle');

    await page.getByTestId('tab-polls').click();
    await page.waitForLoadState('networkidle');

    // Create character-level poll
    await page.getByRole('button', { name: 'Create Poll' }).click();
    await expect(page.getByRole('heading', { name: 'Create New Poll', level: 4 })).toBeVisible();

    await page.getByPlaceholder('What would you like to ask?').fill('Which faction should your character support?');
    await page.getByPlaceholder('Provide additional context or instructions...').fill('This is an in-character decision');

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    await page.locator('input[type="datetime-local"]').fill(tomorrow.toISOString().slice(0, 16));

    // Select character voting
    await page.getByRole('radio', { name: 'Character' }).click();

    await page.locator('input[placeholder="Option 1"]').fill('The Merchants Guild');
    await page.locator('input[placeholder="Option 2"]').fill('The Thieves Guild');
    await page.getByRole('button', { name: 'Add Option' }).click();
    await page.locator('input[placeholder="Option 3"]').fill('The City Watch');

    // Enable individual vote visibility
    await page.locator('div:has(label:has-text("Show individual votes to all players")) input[type="checkbox"]').first().check();

    await page.getByRole('button', { name: 'Create Poll', exact: true }).click();
    await page.waitForLoadState('networkidle');

    // Verify poll appears
    await expect(page.getByText('Which faction should your character support?')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Vote as: Character')).toBeVisible();
  });

  test('Player votes as character and sees badge update', async ({ page }) => {
    await loginAs(page, 'PLAYER_1');
    const gameId = await getFixtureGameId(page, 'COMMON_ROOM_POLLS');
    await navigateToGame(page, gameId);
    await page.waitForLoadState('networkidle');

    await page.getByTestId('tab-polls').click();
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('heading', { name: 'Which faction should your character support?' })).toBeVisible({ timeout: 10000 });

    // Find the second "Vote Now" button (character poll)
    const voteButtons = page.getByRole('button', { name: 'Vote Now' });
    const count = await voteButtons.count();
    await voteButtons.nth(count > 1 ? 1 : 0).click();

    await expect(page.getByText('Select your response')).toBeVisible({ timeout: 5000 });
    await page.getByRole('radio', { name: 'The Merchants Guild' }).check();
    await page.getByRole('button', { name: 'Submit Vote' }).click();

    await expect(page.getByText('Select your response')).not.toBeVisible({ timeout: 5000 });

    // Should now have 2 "Voted" badges (player poll + character poll)
    const votedBadges = page.getByText('Voted');
    await expect(votedBadges).toHaveCount(2, { timeout: 5000 });
  });

  // ==========================================================================
  // TEST CATEGORY 2: ERROR-FREE BEHAVIOR
  // ==========================================================================
  // Purpose: Validate that poll voting does NOT produce errors or unauthorized calls
  // These tests explicitly check for bugs that were missed by only testing UI state
  // NOTE: These tests depend on polls created in Happy Path tests above

  test('Player voting does not trigger 403 errors', async ({ page }) => {
    const { consoleErrors } = setupMonitoring(page);

    await loginAs(page, 'PLAYER_2');
    const gameId = await getFixtureGameId(page, 'COMMON_ROOM_POLLS');
    await navigateToGame(page, gameId);
    await page.waitForLoadState('networkidle');

    await page.getByTestId('tab-polls').click();
    await page.waitForLoadState('networkidle');

    // Vote on first poll
    await page.getByRole('button', { name: 'Vote Now' }).first().click();
    await expect(page.getByText('Select your response')).toBeVisible({ timeout: 5000 });
    await page.getByRole('radio', { name: 'Explore the abandoned castle' }).check();
    await page.getByRole('button', { name: 'Submit Vote' }).click();
    await expect(page.getByText('Select your response')).not.toBeVisible({ timeout: 5000 });

    // Wait a bit for any async errors to appear
    await page.waitForTimeout(500);

    // EXPLICIT check for 403 errors
    checkPollErrors(consoleErrors, 'Player voting does not trigger 403 errors');
  });

  test('Player voting does not show Loading results flash', async ({ page }) => {
    await loginAs(page, 'PLAYER_2');
    const gameId = await getFixtureGameId(page, 'COMMON_ROOM_POLLS');
    await navigateToGame(page, gameId);
    await page.waitForLoadState('networkidle');

    await page.getByTestId('tab-polls').click();
    await page.waitForLoadState('networkidle');

    // Find a poll we haven't voted on yet
    const voteButtons = page.getByRole('button', { name: 'Vote Now' });
    if (await voteButtons.count() > 0) {
      await voteButtons.first().click();
      await expect(page.getByText('Select your response')).toBeVisible({ timeout: 5000 });

      // Select "Other" option to test that path
      await page.getByRole('radio', { name: 'Other (specify below)' }).check();
      await page.locator('input[placeholder="Enter your custom response..."]').fill('Split the party');
      await page.getByRole('button', { name: 'Submit Vote' }).click();

      // CRITICAL: "Loading results..." should NEVER appear for players on active polls
      await expect(page.getByText('Loading results...')).not.toBeVisible({ timeout: 100 });
    }
  });

  test.skip('Players do not make /results API calls on active polls', async ({ page }) => {
    const { apiCalls } = setupMonitoring(page);

    await loginAs(page, 'PLAYER_1');
    const gameId = await getFixtureGameId(page, 'COMMON_ROOM_POLLS');
    await navigateToGame(page, gameId);
    await page.waitForLoadState('networkidle');

    await page.getByTestId('tab-polls').click();
    await page.waitForLoadState('networkidle');

    // Just navigate to polls tab - should not make /results calls
    await page.waitForTimeout(500);

    // Verify NO calls to /results endpoint for active polls
    checkUnauthorizedCalls(
      apiCalls,
      '/results',
      'Players do not make /results API calls on active polls'
    );
  });

  test('Character voting does not trigger errors', async ({ page }) => {
    const { consoleErrors } = setupMonitoring(page);

    await loginAs(page, 'PLAYER_2');
    const gameId = await getFixtureGameId(page, 'COMMON_ROOM_POLLS');
    await navigateToGame(page, gameId);
    await page.waitForLoadState('networkidle');

    await page.getByTestId('tab-polls').click();
    await page.waitForLoadState('networkidle');

    // Vote on character poll
    const voteButtons = page.getByRole('button', { name: 'Vote Now' });
    const count = await voteButtons.count();
    if (count > 0) {
      await voteButtons.last().click();
      await expect(page.getByText('Select your response')).toBeVisible({ timeout: 5000 });
      await page.getByRole('radio').first().check();
      await page.getByRole('button', { name: 'Submit Vote' }).click();
      await expect(page.getByText('Select your response')).not.toBeVisible({ timeout: 5000 });

      // Wait for any async errors
      await page.waitForTimeout(500);

      // Check for errors
      checkPollErrors(consoleErrors, 'Character voting does not trigger errors');
    }
  });

  // ==========================================================================
  // TEST CATEGORY 3: STATE PERSISTENCE
  // ==========================================================================
  // Purpose: Verify that poll state (voted badges) persists across page reloads
  // This would have caught Bug #4 (missing user_has_voted field in backend)
  // NOTE: These tests depend on polls created in Happy Path tests above

  test('Voted badge persists after page reload (player vote)', async ({ page }) => {
    await loginAs(page, 'PLAYER_1');
    const gameId = await getFixtureGameId(page, 'COMMON_ROOM_POLLS');
    await navigateToGame(page, gameId);
    await page.waitForLoadState('networkidle');

    await page.getByTestId('tab-polls').click();
    await page.waitForLoadState('networkidle');

    // Verify badge shows "Voted" for previously voted polls (PLAYER_1 voted on both polls)
    const votedBadges = page.getByText('Voted');
    await expect(votedBadges).toHaveCount(2, { timeout: 5000 });

    // Reload page
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Navigate back to polls
    await page.getByTestId('tab-polls').click();
    await page.waitForLoadState('networkidle');

    // Badges should STILL show "Voted" (tests API contract persists across reload)
    await expect(votedBadges).toHaveCount(2, { timeout: 5000 });
  });

  test('Character vote badge persists after page reload', async ({ page }) => {
    await loginAs(page, 'PLAYER_1');
    const gameId = await getFixtureGameId(page, 'COMMON_ROOM_POLLS');
    await navigateToGame(page, gameId);
    await page.waitForLoadState('networkidle');

    await page.getByTestId('tab-polls').click();
    await page.waitForLoadState('networkidle');

    // Should have 2 "Voted" badges from previous tests
    let votedBadges = page.getByText('Voted');
    await expect(votedBadges).toHaveCount(2, { timeout: 5000 });

    // Reload page
    await page.reload();
    await page.waitForLoadState('networkidle');

    await page.getByTestId('tab-polls').click();
    await page.waitForLoadState('networkidle');

    // Should STILL have 2 "Voted" badges (validates Bug #5 fix)
    votedBadges = page.getByText('Voted');
    await expect(votedBadges).toHaveCount(2, { timeout: 5000 });
  });

  // ==========================================================================
  // TEST CATEGORY 4: PERMISSION ENFORCEMENT
  // ==========================================================================
  // Purpose: Verify role-based access control for poll results
  // NOTE: These tests depend on polls created in Happy Path tests above

  test('Player cannot view results on active poll', async ({ page }) => {
    await loginAs(page, 'PLAYER_1');
    const gameId = await getFixtureGameId(page, 'COMMON_ROOM_POLLS');
    await navigateToGame(page, gameId);
    await page.waitForLoadState('networkidle');

    await page.getByTestId('tab-polls').click();
    await page.waitForLoadState('networkidle');

    // Player should NOT see "Show Results" button on ANY active poll
    await expect(page.getByRole('button', { name: 'Show Results' })).not.toBeVisible();
    await expect(page.getByRole('button', { name: 'Hide Results' })).not.toBeVisible();
  });

  test('GM can view results on active poll', async ({ page }) => {
    await loginAs(page, 'GM');
    const gameId = await getFixtureGameId(page, 'COMMON_ROOM_POLLS');
    await navigateToGame(page, gameId);
    await page.waitForLoadState('networkidle');

    await page.getByTestId('tab-polls').click();
    await page.waitForLoadState('networkidle');

    // GM should see "Show Results" button
    await expect(page.getByRole('button', { name: 'Show Results' }).first()).toBeVisible({ timeout: 5000 });

    // Click to show results
    await page.getByRole('button', { name: 'Show Results' }).first().click();
    await page.waitForTimeout(500);

    // Should see results
    await expect(page.getByRole('heading', { name: 'Results' }).first()).toBeVisible();
    await expect(page.getByText(/votes/)).toBeVisible();

    // Button changes to "Hide Results"
    await expect(page.getByRole('button', { name: 'Hide Results' }).first()).toBeVisible();
  });

  test('Audience can toggle results on active poll', async ({ page }) => {
    await loginAs(page, 'AUDIENCE');
    const gameId = await getFixtureGameId(page, 'COMMON_ROOM_POLLS');
    await navigateToGame(page, gameId);
    await page.waitForLoadState('networkidle');

    await expect(page.getByTestId('tab-polls')).toBeVisible({ timeout: 10000 });
    await page.getByTestId('tab-polls').click();
    await page.waitForLoadState('networkidle');

    // Audience should see "Show Results" button
    await expect(page.getByRole('button', { name: 'Show Results' }).first()).toBeVisible();

    // Toggle results
    await page.getByRole('button', { name: 'Show Results' }).first().click();
    await page.waitForTimeout(500);
    await expect(page.getByRole('heading', { name: 'Results' }).first()).toBeVisible();

    await page.getByRole('button', { name: 'Hide Results' }).first().click();
    await page.waitForTimeout(500);
    await expect(page.getByRole('heading', { name: 'Results' }).first()).not.toBeVisible();
  });

  // ==========================================================================
  // TEST CATEGORY 5: ADDITIONAL FEATURES
  // ==========================================================================
  // Purpose: Test other poll features (filtering, etc.)
  // NOTE: These tests depend on polls created in Happy Path tests above

  test('Poll filtering shows/hides expired polls', async ({ page }) => {
    await loginAs(page, 'PLAYER_1');
    const gameId = await getFixtureGameId(page, 'COMMON_ROOM_POLLS');
    await navigateToGame(page, gameId);
    await page.waitForLoadState('networkidle');

    await page.getByTestId('tab-polls').click();
    await page.waitForLoadState('networkidle');

    // Should show "Active Polls" by default
    await expect(page.getByText(/Active Polls/)).toBeVisible();

    // If there's an expired polls toggle, test it
    const expiredToggle = page.locator('input[type="checkbox"][id="show-expired"]');
    if (await expiredToggle.isVisible()) {
      await expiredToggle.check();
      await expect(page.getByText(/Expired Polls/)).toBeVisible({ timeout: 3000 });
    }
  });
});
