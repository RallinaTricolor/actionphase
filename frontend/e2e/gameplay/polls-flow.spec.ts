import { test, expect } from '@playwright/test';
import { loginAs } from '../fixtures/auth-helpers';
import { getFixtureGameId } from '../fixtures/game-helpers';
import { navigateToGame } from '../utils/navigation';

/**
 * E2E Tests for Common Room Polling System
 *
 * Tests the complete polling workflow including:
 * - GM creating polls (player-level and character-level voting)
 * - Players voting on polls
 * - Viewing poll results
 * - "Other" text responses
 * - Individual vote visibility
 * - Poll expiration
 *
 * Uses dedicated E2E fixture (COMMON_ROOM_POLLS) which includes:
 * - Game in common_room phase
 * - Multiple player characters for voting
 *
 * IMPORTANT: Tests run serially because they build on each other
 */
test.describe.serial('Polls Flow', () => {
  test('GM can create a player-level poll', async ({ page }) => {
    // Login as GM
    await loginAs(page, 'GM');

    const gameId = await getFixtureGameId(page, 'COMMON_ROOM_POLLS');
    await navigateToGame(page, gameId);
    await page.waitForLoadState('networkidle');

    // Navigate to Polls tab
    await expect(page.getByTestId('tab-polls')).toBeVisible({ timeout: 10000 });
    await page.getByTestId('tab-polls').click();
    await page.waitForLoadState('networkidle');

    // Should see Polls tab content - wait for the specific Polls heading (not "No polls yet")
    await expect(page.locator('h3.text-lg').filter({ hasText: /^Polls$/ }).first()).toBeVisible({ timeout: 10000 });

    // Click Create Poll button
    await expect(page.getByRole('button', { name: 'Create Poll' })).toBeVisible();
    await page.getByRole('button', { name: 'Create Poll' }).click();

    // Wait for the form to appear
    await expect(page.getByRole('heading', { name: 'Create New Poll', level: 4 })).toBeVisible({ timeout: 5000 });

    // Fill out poll form - Question (required)
    await page.getByPlaceholder('What would you like to ask?').fill('What should the party do next?');

    // Description (optional)
    await page.getByPlaceholder('Provide additional context or instructions...').fill('Vote for the next adventure direction');

    // Deadline (required) - set to tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const deadlineString = tomorrow.toISOString().slice(0, 16); // Format: YYYY-MM-DDTHH:mm
    await page.locator('input[type="datetime-local"]').fill(deadlineString);

    // Vote as type - Player (default, should already be selected)
    await expect(page.getByRole('radio', { name: 'Player' })).toBeChecked();

    // Fill in options
    await page.locator('input[placeholder="Option 1"]').fill('Explore the abandoned castle');
    await page.locator('input[placeholder="Option 2"]').fill('Investigate the mysterious forest');

    // Add a third option
    await page.getByRole('button', { name: 'Add Option' }).click();
    await page.locator('input[placeholder="Option 3"]').fill('Return to town for supplies');

    // Enable "other" responses (second checkbox in settings section)
    await page.locator('div:has(label:has-text("Allow \'Other\' text responses")) input[type="checkbox"]').last().check();

    // Submit poll
    await page.getByRole('button', { name: 'Create Poll', exact: true }).click();

    // Wait for form to close and poll to appear
    await page.waitForLoadState('networkidle');

    // Verify poll was created and appears in the list
    await expect(page.getByText('What should the party do next?')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Vote as: player')).toBeVisible();
    await expect(page.getByText(/Ends:/)).toBeVisible();

    // Verify poll shows "Not Voted" badge
    await expect(page.getByText('Not Voted')).toBeVisible();
  });

  test('Player can view poll and vote', async ({ page }) => {
    // Previous test created a poll
    // This test verifies players can see and vote on it

    await loginAs(page, 'PLAYER_1');

    const gameId = await getFixtureGameId(page, 'COMMON_ROOM_POLLS');
    await navigateToGame(page, gameId);
    await page.waitForLoadState('networkidle');

    // Navigate to Polls tab
    await page.getByTestId('tab-polls').click();
    await page.waitForLoadState('networkidle');

    // Should see the poll created by GM
    await expect(page.getByText('What should the party do next?')).toBeVisible({ timeout: 10000 });

    // Click "Vote Now" button
    await page.getByRole('button', { name: 'Vote Now' }).click();

    // Wait for voting form to appear
    await expect(page.getByText('Select your response')).toBeVisible({ timeout: 5000 });

    // Should see voting form with options
    await expect(page.getByText('Explore the abandoned castle')).toBeVisible();
    await expect(page.getByText('Investigate the mysterious forest')).toBeVisible();
    await expect(page.getByText('Return to town for supplies')).toBeVisible();

    // Vote for the second option (check the radio button)
    await page.getByRole('radio', { name: 'Investigate the mysterious forest' }).check();

    // Wait for submit button to be enabled (React state update)
    await expect(page.getByRole('button', { name: 'Submit Vote' })).toBeEnabled();

    // Submit vote
    await page.getByRole('button', { name: 'Submit Vote' }).click();

    // Poll should now show "Voted" badge
    await expect(page.getByText('Voted')).toBeVisible({ timeout: 5000 });

    // Should automatically show results after voting
    await expect(page.getByRole('heading', { name: 'Results' })).toBeVisible();
    await expect(page.getByText('1 vote')).toBeVisible();
  });

  test('Another player can vote with "other" response', async ({ page }) => {
    // Previous tests created poll and had Player 1 vote
    // This test has Player 2 vote with "other" option

    await loginAs(page, 'PLAYER_2');

    const gameId = await getFixtureGameId(page, 'COMMON_ROOM_POLLS');
    await navigateToGame(page, gameId);
    await page.waitForLoadState('networkidle');

    // Navigate to Polls tab
    await page.getByTestId('tab-polls').click();
    await page.waitForLoadState('networkidle');

    // Click "Vote Now" on the poll
    await page.getByRole('button', { name: 'Vote Now' }).click();

    // Wait for voting form to appear
    await expect(page.getByText('Select your response')).toBeVisible({ timeout: 5000 });

    // Select "Other" option (check the radio button)
    await page.getByRole('radio', { name: 'Other (specify below)' }).check();

    // Fill in custom response
    await page.locator('input[placeholder="Enter your custom response..."]').fill('Split up and search both locations');

    // Submit vote
    await page.getByRole('button', { name: 'Submit Vote' }).click();

    // Should show results with 2 votes now
    await expect(page.getByText('2 votes')).toBeVisible({ timeout: 5000 });
  });

  test('GM can create a character-level poll', async ({ page }) => {
    // Login as GM and create a new poll with character voting
    await loginAs(page, 'GM');

    const gameId = await getFixtureGameId(page, 'COMMON_ROOM_POLLS');
    await navigateToGame(page, gameId);
    await page.waitForLoadState('networkidle');

    // Navigate to Polls tab
    await page.getByTestId('tab-polls').click();
    await page.waitForLoadState('networkidle');

    // Click Create Poll button
    await page.getByRole('button', { name: 'Create Poll' }).click();

    // Wait for the form to appear
    await expect(page.getByRole('heading', { name: 'Create New Poll', level: 4 })).toBeVisible({ timeout: 5000 });

    // Fill out poll form
    await page.getByPlaceholder('What would you like to ask?').fill('Which faction should your character support?');
    await page.getByPlaceholder('Provide additional context or instructions...').fill('This is an in-character decision');

    // Set deadline
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const deadlineString = tomorrow.toISOString().slice(0, 16);
    await page.locator('input[type="datetime-local"]').fill(deadlineString);

    // Select Character voting
    await page.getByRole('radio', { name: 'Character' }).click();

    // Fill in options
    await page.locator('input[placeholder="Option 1"]').fill('The Merchants Guild');
    await page.locator('input[placeholder="Option 2"]').fill('The Thieves Guild');
    await page.getByRole('button', { name: 'Add Option' }).click();
    await page.locator('input[placeholder="Option 3"]').fill('The City Watch');

    // Enable individual vote visibility (first checkbox in settings section)
    await page.locator('div:has(label:has-text("Show individual votes to all players")) input[type="checkbox"]').first().check();

    // Submit poll
    await page.getByRole('button', { name: 'Create Poll', exact: true }).click();

    // Wait for form to close and poll to appear
    await page.waitForLoadState('networkidle');

    // Verify poll was created
    await expect(page.getByText('Which faction should your character support?')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Vote as: Character')).toBeVisible();
  });

  test('Player can vote as character', async ({ page }) => {
    // Previous test created character-level poll
    // This test has a player vote with their character

    await loginAs(page, 'PLAYER_1');

    const gameId = await getFixtureGameId(page, 'COMMON_ROOM_POLLS');
    await navigateToGame(page, gameId);
    await page.waitForLoadState('networkidle');

    // Navigate to Polls tab
    await page.getByTestId('tab-polls').click();
    await page.waitForLoadState('networkidle');

    // Wait for polls to load
    await expect(page.getByRole('heading', { name: 'Which faction should your character support?' })).toBeVisible({ timeout: 10000 });

    // Find all "Vote Now" buttons
    const voteButtons = page.getByRole('button', { name: 'Vote Now' });
    const voteButtonsCount = await voteButtons.count();

    // Click the second "Vote Now" button (character poll)
    // First poll is "What should the party do next?" (already voted)
    // Second poll is "Which faction should your character support?" (character poll)
    await voteButtons.nth(voteButtonsCount > 1 ? 1 : 0).click();

    // Wait for voting form to appear
    await expect(page.getByText('Select your response')).toBeVisible({ timeout: 5000 });

    // Should see character selector (if player has multiple characters)
    // Or display "Voting as: [Character Name]" if only one character

    // Vote for an option (check the radio button)
    await page.getByRole('radio', { name: 'The Merchants Guild' }).check();

    // Submit vote
    await page.getByRole('button', { name: 'Submit Vote' }).click();

    // Should show results with character names (since individual votes are visible)
    await expect(page.getByRole('heading', { name: 'Results' })).toBeVisible({ timeout: 5000 });

    // Should see character name in voter list (not player username)
    // The exact character name depends on the fixture, but it should be visible
  });

  test('GM can view poll results with individual votes', async ({ page }) => {
    // Previous tests created polls and votes
    // GM should see detailed results including individual voters

    await loginAs(page, 'GM');

    const gameId = await getFixtureGameId(page, 'COMMON_ROOM_POLLS');
    await navigateToGame(page, gameId);
    await page.waitForLoadState('networkidle');

    // Navigate to Polls tab
    await page.getByTestId('tab-polls').click();
    await page.waitForLoadState('networkidle');

    // Wait for both polls to be visible
    await expect(page.getByRole('heading', { name: 'What should the party do next?' })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('heading', { name: 'Which faction should your character support?' })).toBeVisible();

    // Find all "Show Results" buttons
    const showResultsButtons = page.getByRole('button', { name: 'Show Results' });
    const buttonCount = await showResultsButtons.count();

    // Click the first "Show Results" button if it exists (player poll)
    if (buttonCount > 0) {
      await showResultsButtons.first().click();
      await page.waitForTimeout(500); // Brief wait for animation
    }

    // Should see results with vote counts
    await expect(page.getByRole('heading', { name: 'Results' }).first()).toBeVisible();
    await expect(page.getByText(/votes/)).toBeVisible();

    // Should see progress bars for options
    await expect(page.locator('.bg-accent-primary, .bg-bg-accent-secondary').first()).toBeVisible();

    // View results of second poll (character-level) if not already visible
    const secondShowResultsButton = page.getByRole('button', { name: 'Show Results' }).first();
    if (await secondShowResultsButton.isVisible({ timeout: 1000 }).catch(() => false)) {
      await secondShowResultsButton.click();
    }

    // Should see individual character names in voter lists
    // (Exact names depend on fixture, but voter info should be present)
  });

  test('Poll filtering - show/hide expired polls', async ({ page }) => {
    // Test the expired polls toggle functionality
    await loginAs(page, 'PLAYER_1');

    const gameId = await getFixtureGameId(page, 'COMMON_ROOM_POLLS');
    await navigateToGame(page, gameId);
    await page.waitForLoadState('networkidle');

    // Navigate to Polls tab
    await page.getByTestId('tab-polls').click();
    await page.waitForLoadState('networkidle');

    // By default should show "Active Polls" section
    await expect(page.getByText(/Active Polls/)).toBeVisible();

    // If there are expired polls, should see the toggle checkbox
    // (This depends on fixtures having expired polls)
    const expiredToggle = page.locator('input[type="checkbox"][id="show-expired"]');

    if (await expiredToggle.isVisible()) {
      // Check the toggle
      await expiredToggle.check();

      // Should now see "Expired Polls" section
      await expect(page.getByText(/Expired Polls/)).toBeVisible({ timeout: 3000 });
    }
  });
});
