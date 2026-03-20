import { test, expect } from '@playwright/test';
import { loginAs } from '../fixtures/auth-helpers';
import { getWorkerGameId, getWorkerUsername } from '../fixtures/game-helpers';
import { GameDetailsPage } from '../pages/GameDetailsPage';
import { MessagingPage } from '../pages/MessagingPage';

/**
 * Co-GM Management E2E Tests
 *
 * Tests the full co-GM lifecycle:
 * 1. Primary GM promotes audience member to co-GM
 * 2. Co-GM has GM permissions (can manage phases, view actions, etc.)
 * 3. Co-GM cannot edit game settings or promote others
 * 4. Primary GM demotes co-GM back to audience
 * 5. Only one co-GM allowed per game
 *
 * Uses E2E_GAME_SETTINGS fixture game for testing
 *
 * NOTE: Tests run serially to prevent race conditions
 */
test.describe.serial('Co-GM Management', () => {
  // Game ID 339 for worker 0, offset by 10000 per worker
  const gameId = getWorkerGameId(339);

  test('Setup: Primary GM demotes existing co-GM first', async ({ page }) => {
    // NOTE: Fixture has TestAudience1 as co-GM (for NPC messaging tests).
    // We need to demote them first since only 1 co-GM is allowed per game.
    await loginAs(page, 'GM');

    const gamePage = new GameDetailsPage(page);
    await gamePage.goto(gameId);

    // Navigate to People tab > Participants sub-tab
    await page.getByRole('tab', { name: 'People' }).click();
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /Game Participants/ }).click();

    // Wait for co-GM section and find TestAudience1's actions button
    await expect(page.getByRole('heading', { name: /Co-GMs/ })).toBeVisible();
    const coGmSection = page.locator('div:has(> h3:has-text("Co-GMs"))').first();
    const actionsButton = coGmSection.getByRole('button', { name: 'Participant actions' }).first();
    await actionsButton.click();

    // Click "Demote from Co-GM"
    await page.getByRole('menuitem', { name: 'Demote from Co-GM' }).click();

    // Confirm in modal
    await expect(page.getByRole('heading', { name: 'Demote from Co-GM?' })).toBeVisible();
    await page.getByRole('button', { name: 'Demote to Audience' }).click();

    // Wait for demotion to complete
    await page.waitForLoadState('networkidle');

    // Verify modal closes and co-GM section disappears
    await expect(page.getByRole('heading', { name: 'Demote from Co-GM?' })).not.toBeVisible();
    await expect(page.getByRole('heading', { name: /Co-GMs/ })).not.toBeVisible();
  });

  test('Primary GM can promote audience member to co-GM', async ({ page }) => {
    // Now that there's no co-GM, promote TestAudience2
    await loginAs(page, 'GM');

    const gamePage = new GameDetailsPage(page);
    await gamePage.goto(gameId);

    // Navigate to People tab > Participants sub-tab
    await page.getByRole('tab', { name: 'People' }).click();
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /Game Participants/ }).click();

    // Wait for participant data to load and find the audience heading
    await expect(page.getByRole('heading', { name: /Audience/ })).toBeVisible();

    // Find TestAudience2's participant card by username, then click their actions button
    const audience2Username = getWorkerUsername('TestAudience2');
    const audience2Card = page.getByTestId('participant-card').filter({ hasText: audience2Username });
    await audience2Card.getByRole('button', { name: 'Participant actions' }).click();

    // Wait for menu to appear and click "Promote to Co-GM" option
    const promoteMenuItem = page.getByRole('menuitem', { name: 'Promote to Co-GM' });
    await promoteMenuItem.waitFor({ state: 'visible', timeout: 5000 });
    await promoteMenuItem.click();

    // Confirm in modal
    await expect(page.getByRole('heading', { name: 'Promote to Co-GM?' })).toBeVisible();
    await expect(page.getByText(/Co-GMs can do everything you can except/)).toBeVisible();
    await page.getByRole('button', { name: 'Promote to Co-GM' }).click();

    // Wait for the API call to complete
    await page.waitForLoadState('networkidle');

    // Verify modal closes and co-GM appears in Co GMs section
    await expect(page.getByRole('heading', { name: 'Promote to Co-GM?' })).not.toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('heading', { name: /Co-GMs/ })).toBeVisible();
  });

  test('Co-GM appears in game header', async ({ page }) => {
    // Login as primary GM
    await loginAs(page, 'GM');

    const gamePage = new GameDetailsPage(page);
    await gamePage.goto(gameId);

    // Wait for page to fully load
    await page.waitForLoadState('networkidle');

    // Verify co-GM is displayed in header metadata line (with timeout)
    await expect(page.getByText(/Co-GM:/).locator('visible=true').first()).toBeVisible({ timeout: 10000 });

    // Verify the full co-GM text (includes username)
    const coGmUsername = getWorkerUsername('TestAudience2');
    await expect(page.getByText(new RegExp(`Co-GM: ${coGmUsername}`)).locator('visible=true').first()).toBeVisible({ timeout: 10000 });
  });

  test('Co-GM can access GM features (phase management)', async ({ page }) => {
    // Login as the co-GM (TestAudience2 was promoted in previous test)
    await loginAs(page, 'AUDIENCE_2');

    const gamePage = new GameDetailsPage(page);
    await gamePage.goto(gameId);

    // Verify co-GM sees GM-only tabs
    await expect(page.getByRole('tab', { name: 'Phases' })).toBeVisible();
    // Note: Applications tab only shows during recruitment, game is in_progress so won't be visible

    // Navigate to Phases tab (GM-only feature)
    await page.getByRole('tab', { name: 'Phases' }).click();
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: 'Phase Management' })).toBeVisible();

    // Verify co-GM can see phase management UI
    await expect(page.getByRole('button', { name: 'New Phase' })).toBeVisible();
  });

  test('Co-GM cannot edit game settings', async ({ page }) => {
    // Login as the co-GM (TestAudience2)
    await loginAs(page, 'AUDIENCE_2');

    const gamePage = new GameDetailsPage(page);
    await gamePage.goto(gameId);

    // Verify "Edit Game" button is NOT visible (co-GMs cannot edit settings)
    await expect(page.getByRole('button', { name: 'Edit Game' })).not.toBeVisible();
  });

  test('Co-GM cannot promote others to co-GM', async ({ page }) => {
    // Login as the co-GM (TestAudience2)
    await loginAs(page, 'AUDIENCE_2');

    const gamePage = new GameDetailsPage(page);
    await gamePage.goto(gameId);

    // Navigate to People tab > Participants sub-tab
    await page.getByRole('tab', { name: 'People' }).click();
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /Game Participants/ }).click();

    // Wait for participant data to load
    await page.waitForSelector('h3:has-text("audiences")', { timeout: 5000 }).catch(() => {
      // If no audiences heading, there are no audience members - test passes
    });

    // Check if there are any audience members by looking for "Participant actions" buttons
    const actionsButtons = page.getByRole('button', { name: 'Participant actions' });
    const buttonCount = await actionsButtons.count();

    if (buttonCount > 0) {
      // Click the first participant actions button
      await actionsButtons.first().click();

      // Verify "Promote to Co-GM" option is NOT visible
      await expect(page.getByRole('menuitem', { name: 'Promote to Co-GM' })).not.toBeVisible();
    }
  });

  test('Primary GM can demote co-GM back to audience', async ({ page }) => {
    // Login as primary GM
    await loginAs(page, 'GM');

    const gamePage = new GameDetailsPage(page);
    await gamePage.goto(gameId);

    // Navigate to People tab > Participants sub-tab
    await page.getByRole('tab', { name: 'People' }).click();
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /Game Participants/ }).click();

    // Wait for co-GM section to load
    await expect(page.getByRole('heading', { name: /Co-GMs/ })).toBeVisible({ timeout: 10000 });

    // Find the actions button scoped to the Co-GMs section (avoids fragile global index)
    const coGmSection = page.locator('div:has(> h3:has-text("Co-GMs"))').first();
    const coGmActionsButton = coGmSection.getByRole('button', { name: 'Participant actions' }).first();
    await coGmActionsButton.click();

    // Click "Demote from Co-GM" option
    await page.getByRole('menuitem', { name: 'Demote from Co-GM' }).click();

    // Confirm in modal
    await expect(page.getByRole('heading', { name: 'Demote from Co-GM?' })).toBeVisible();
    await page.getByRole('button', { name: 'Demote to Audience' }).click();

    // Wait for the API call to complete
    await page.waitForLoadState('networkidle');

    // Verify modal closes and user moves back to Audience section
    await expect(page.getByRole('heading', { name: 'Demote from Co-GM?' })).not.toBeVisible();

    const coGMSectionAfter = page.locator('h3:has-text("Co-GMs")');
    // Co-GM section should disappear since we demoted the only co-GM
    await expect(coGMSectionAfter).not.toBeVisible();
  });

  test('Demoted co-GM loses GM permissions', async ({ page }) => {
    // Login as the former co-GM (TestAudience2 who was promoted then demoted)
    await loginAs(page, 'AUDIENCE_2');

    const gamePage = new GameDetailsPage(page);
    await gamePage.goto(gameId);

    // Verify former co-GM no longer sees GM-only tabs
    await expect(page.getByRole('tab', { name: 'Phases' })).not.toBeVisible();

    // Verify only sees player/audience tabs (not GM tabs)
    await expect(page.getByRole('tab', { name: 'People' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Audience' })).toBeVisible();
  });

  test('Co-GM badge removed from header after demotion', async ({ page }) => {
    // Login as primary GM
    await loginAs(page, 'GM');

    const gamePage = new GameDetailsPage(page);
    await gamePage.goto(gameId);

    // Verify co-GM is no longer displayed in header
    await expect(page.getByText(/Co-GM:/)).not.toBeVisible();
  });
  /**
   * Co-GM Functional Tests
   *
   * Tests that co-GMs can actually PERFORM GM actions, not just see UI:
   * - Create and manage phases
   * - View player actions
   * - Publish phases
   * - Advance game state
   *
   * NOTE: TestAudience2 was demoted in the previous test, so we need to re-promote them
   * These tests run in the same serial suite to ensure they use the same worker's promoted co-GM
   */

  test('Setup: Re-promote TestAudience2 to co-GM for functional testing', async ({ page }) => {
    // TestAudience2 was demoted in the "Primary GM can demote co-GM back to audience" test
    // We need to promote them again to test co-GM functional abilities
    // NOTE: Both TestAudience1 and TestAudience2 are in audience, we need to click the RIGHT one
    await loginAs(page, 'GM');

    const gamePage = new GameDetailsPage(page);
    await gamePage.goto(gameId);

    // Navigate to People tab > Participants sub-tab
    await page.getByRole('tab', { name: 'People' }).click();
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /Game Participants/ }).click();

    // Wait for audience section
    await page.waitForSelector('h3:has-text("Audience")');

    // Find TestAudience2 specifically (should be second audience member)
    // TestAudience1 was demoted first, TestAudience2 was demoted second
    // So TestAudience2 should be the last one in the audience list
    const audienceSection = page.locator('div:has(> h3:has-text("Audience"))').first();
    const actionsButtons = await audienceSection.getByRole('button', { name: 'Participant actions' }).all();

    // Click the LAST audience member's actions button (TestAudience2)
    await actionsButtons[actionsButtons.length - 1].click();

    // Click "Promote to Co-GM"
    await page.getByRole('menuitem', { name: 'Promote to Co-GM' }).click();

    // Confirm in modal - verify we're promoting TestAudience2
    await expect(page.getByRole('heading', { name: 'Promote to Co-GM?' })).toBeVisible();
    await expect(page.getByText(/Promote.*TestAudience2.*to co-GM/i)).toBeVisible();
    await page.getByRole('button', { name: 'Promote to Co-GM' }).click();

    // Wait for promotion to complete
    await page.waitForLoadState('networkidle');

    // Verify modal closes and co-GM section appears
    await expect(page.getByRole('heading', { name: 'Promote to Co-GM?' })).not.toBeVisible({ timeout: 10000 });
    await expect(page.locator('h3:has-text("Co-GMs")')).toBeVisible();
  });

  test('Co-GM can create a new phase', async ({ page }) => {
    // Login as co-GM (TestAudience2 was just promoted in previous test)
    await loginAs(page, 'AUDIENCE_2');

    const gamePage = new GameDetailsPage(page);
    await gamePage.goto(gameId);

    // Reload page to ensure fresh participant data after promotion (React Query cache)
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Verify we're logged in as the correct user and they're shown as co-GM in header
    await expect(page.getByText(/Co-GM:.*TestAudience2/).locator('visible=true').first()).toBeVisible({ timeout: 10000 });

    // Wait for Phases tab to appear (GM-only tab, confirms co-GM permissions)
    await expect(page.getByRole('tab', { name: 'Phases' })).toBeVisible({ timeout: 10000 });

    // Navigate to Phases tab
    await page.getByRole('tab', { name: 'Phases' }).click();
    await page.waitForLoadState('networkidle');

    // Click "New Phase" button
    await page.getByRole('button', { name: 'New Phase' }).click();

    // Fill in phase details
    await expect(page.getByRole('heading', { name: 'Create New Phase' })).toBeVisible();

    // Select phase type using native select element
    await page.getByLabel('Phase Type').selectOption('action');

    // Fill in title and description
    await page.getByLabel(/Title/).fill('Co-GM Test Phase');
    await page.getByLabel(/Description/).fill('Phase created by co-GM to test functionality');

    // Submit the form
    await page.getByRole('button', { name: 'Create Phase' }).click();
    await page.waitForLoadState('networkidle');

    // Verify phase was created (use first() to handle multiple headings)
    await expect(page.getByRole('heading', { name: 'Co-GM Test Phase' }).first()).toBeVisible();
  });

  test('Co-GM can edit phase details', async ({ page }) => {
    // Login as co-GM
    await loginAs(page, 'AUDIENCE_2');

    const gamePage = new GameDetailsPage(page);
    await gamePage.goto(gameId);

    // Navigate to Phases tab
    await page.getByRole('tab', { name: 'Phases' }).click();
    await page.waitForLoadState('networkidle');

    // Verify co-GM can see the phase they created
    await expect(page.getByRole('heading', { name: 'Co-GM Test Phase' })).toBeVisible();

    // Verify co-GM can edit the phase (has edit button)
    const editButton = page.getByRole('button', { name: 'Edit phase details' }).first();
    await expect(editButton).toBeVisible();

    // Click edit to verify co-GM has permission
    await editButton.click();

    // Verify edit modal opens
    await expect(page.getByRole('heading', { name: 'Edit Phase' })).toBeVisible();

    // Close modal
    await page.getByRole('button', { name: 'Cancel' }).click();
  });

  test('Co-GM can send private messages as GM NPC', async ({ page }) => {
    // TestAudience2 is promoted to co-GM in test "Primary GM can promote audience member to co-GM"
    // Fixture provides a GM NPC ("GM Test NPC") that the co-GM can use for messaging
    // Messages tab is visible because co-GM role grants access (hasGMRole || isCoGM)
    // NOTE: This test runs BEFORE action phase activation to ensure common_room phase is active (Issue #10)

    await loginAs(page, 'AUDIENCE_2');

    const messagingPage = new MessagingPage(page);
    await messagingPage.goto(gameId);

    // Reload to ensure fresh auth state
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Navigate to Messages tab using POM method
    await messagingPage.navigateToMessages();

    // Verify co-GM can access conversation creation (GM-only permission)
    // GMs can create conversations and send messages as their NPCs
    await expect(messagingPage.newConversationButton).toBeVisible();
    await expect(messagingPage.newConversationButton).toBeEnabled();

    // Open conversation modal to verify co-GM has full access
    await messagingPage.openNewConversationForm();

    // Verify modal opens with conversation form
    await expect(messagingPage.conversationTitleInput).toBeVisible();

    // Close modal without creating (prevents test data accumulation)
    await page.keyboard.press('Escape');

    // Note: Full messaging flow is already tested in private-messages-flow.spec.ts for GMs
    // This test verifies co-GMs have the same messaging permissions (access to New Conversation button and form)
  });

  test('Co-GM can view player actions on Actions tab', async ({ page }) => {
    // First, activate the action phase so the Actions tab becomes visible
    await loginAs(page, 'GM');

    const gamePage = new GameDetailsPage(page);
    await gamePage.goto(gameId);

    // Navigate to Phases tab and activate the action phase
    await page.getByRole('tab', { name: 'Phases' }).click();
    await page.waitForLoadState('networkidle');

    // Find "Test Phase 1" (Phase 2, the action phase) card and click its Activate button
    // Use both "Phase 2" text and heading to uniquely identify the correct phase card
    const phaseCard = page.locator('div').filter({ hasText: 'Phase 2' }).filter({ has: page.getByRole('heading', { name: 'Test Phase 1', exact: true }) });
    await phaseCard.getByRole('button', { name: 'Activate', exact: true }).first().click();

    // Confirm phase activation in the modal
    await expect(page.getByRole('heading', { name: 'Activate Phase 2?' })).toBeVisible();
    await page.getByRole('button', { name: 'Activate Phase' }).click();

    // Wait for phase activation to complete
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: 'Activate Phase 2?' })).not.toBeVisible();

    // Now login as co-GM and verify Actions tab access
    await loginAs(page, 'AUDIENCE_2');
    await gamePage.goto(gameId);

    // Reload to ensure fresh auth state
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Navigate to Actions tab (GM-only, now visible because action phase is active)
    await page.getByRole('tab', { name: 'Actions' }).click();
    await page.waitForLoadState('networkidle');

    // Verify co-GM can see the actions interface
    await expect(page.getByRole('heading', { name: 'Submitted Actions' })).toBeVisible();

    // Verify action count badge is visible (even if 0) - use first() to avoid footer text match
    await expect(page.getByText(/\d+ Actions?/).first()).toBeVisible();
  });

  test('Co-GM has full access to phase management', async ({ page }) => {
    // Login as co-GM
    await loginAs(page, 'AUDIENCE_2');

    const gamePage = new GameDetailsPage(page);
    await gamePage.goto(gameId);

    // Reload to ensure fresh auth state
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Navigate to Phases tab
    await page.getByRole('tab', { name: 'Phases' }).click();
    await page.waitForLoadState('networkidle');

    // Verify co-GM can see phase management interface
    await expect(page.getByRole('heading', { name: 'Phase Management' })).toBeVisible();

    // Verify co-GM can create new phases
    await expect(page.getByRole('button', { name: 'New Phase' })).toBeVisible();

    // Verify co-GM can see existing phases
    await expect(page.getByRole('heading', { name: 'Test Phase 1' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Co-GM Test Phase' })).toBeVisible();

    // Verify co-GM can see "Currently Active" section (phase management feature)
    await expect(page.getByRole('heading', { name: 'Currently Active' })).toBeVisible();
  });

  test('Co-GM can create handouts', async ({ page }) => {
    // Login as co-GM
    await loginAs(page, 'AUDIENCE_2');

    const gamePage = new GameDetailsPage(page);
    await gamePage.goto(gameId);

    // Reload to ensure fresh auth state
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Navigate to Handouts tab
    await page.getByRole('tab', { name: 'Handouts' }).click();
    await page.waitForLoadState('networkidle');

    // Verify co-GM can access handout creation form (GM-only feature)
    const createButton = page.getByRole('button', { name: 'Create Handout' });
    await expect(createButton).toBeVisible();
    await createButton.click();

    // Verify modal opens with all form fields accessible to co-GM
    await expect(page.getByRole('heading', { name: 'Create New Handout' })).toBeVisible();
    await expect(page.getByLabel('Title')).toBeVisible();
    await expect(page.getByLabel('Content')).toBeVisible();
    await expect(page.getByLabel('Status')).toBeVisible();

    // Verify co-GM can select published status (GM permission)
    await page.getByLabel('Status').selectOption('published');
    await expect(page.getByLabel('Status')).toHaveValue('published');

    // Close modal without creating (prevents test data accumulation)
    await page.getByRole('button', { name: 'Cancel' }).click();

    // Note: Full handout creation is already tested in handouts-flow.spec.ts for GMs
    // This test verifies co-GMs have the same handout creation permissions
  });

  test('Co-GM can manage participants', async ({ page }) => {
    // Login as co-GM
    await loginAs(page, 'AUDIENCE_2');

    const gamePage = new GameDetailsPage(page);
    await gamePage.goto(gameId);

    // Reload to ensure fresh auth state
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Navigate to People tab
    await page.getByRole('tab', { name: 'People' }).click();
    await page.waitForLoadState('networkidle');

    // Click on Game Participants sub-tab
    await page.getByRole('button', { name: /Game Participants/ }).click();

    // Verify co-GM can see participant management UI
    await expect(page.getByRole('heading', { name: /Audience/i })).toBeVisible();

    // Verify co-GM can see participant action menus (but not promote to co-GM, tested elsewhere)
    const participantActions = page.getByRole('button', { name: 'Participant actions' });
    if ((await participantActions.count()) > 0) {
      await expect(participantActions.first()).toBeVisible();
    }
  });

  test('Co-GM can create NPCs', async ({ page }) => {
    // Login as co-GM
    await loginAs(page, 'AUDIENCE_2');

    const gamePage = new GameDetailsPage(page);
    await gamePage.goto(gameId);

    // Reload to ensure fresh auth state
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Navigate to People tab > Characters sub-tab
    await page.getByRole('tab', { name: 'People' }).click();
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: 'Characters' }).click();

    // Click "Create Character" button
    const createCharacterButton = page.getByRole('button', { name: 'Create Character' });
    await expect(createCharacterButton).toBeVisible();
    await createCharacterButton.click();

    // Fill in NPC details (pattern from gm-creates-player-character.spec.ts:104-135)
    const characterForm = page.getByTestId('character-form');
    await expect(characterForm).toBeVisible();

    const npcName = `Co-GM Test NPC ${Date.now()}`;
    const nameInput = page.getByTestId('character-name-input');
    await nameInput.fill(npcName);

    // Select NPC type
    const characterTypeSelect = page.getByLabel('Character Type');
    await characterTypeSelect.selectOption('npc');

    // Submit the character
    const submitButton = page.getByTestId('character-submit-button');
    await expect(submitButton).toBeEnabled();
    await submitButton.click();

    // Wait for modal to close
    await expect(characterForm).toBeHidden({ timeout: 5000 });
    await page.waitForLoadState('networkidle');

    // Verify NPC appears in character list
    await expect(page.getByText(npcName).locator('visible=true').first()).toBeVisible({ timeout: 5000 });
  });

  test('Co-GM can access Audience tab', async ({ page }) => {
    // Login as co-GM
    await loginAs(page, 'AUDIENCE_2');

    const gamePage = new GameDetailsPage(page);
    await gamePage.goto(gameId);

    // Reload to ensure fresh auth state
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Verify co-GM can see Audience tab (GM-only during in_progress)
    await expect(page.getByRole('tab', { name: 'Audience' })).toBeVisible();

    // Navigate to Audience tab
    await page.getByRole('tab', { name: 'Audience' }).click();
    await page.waitForLoadState('networkidle');

    // Verify co-GM can see audience content area
    // The audience tab shows private messages and action submissions
    // Check for the sub-navigation buttons as evidence the tab loaded
    await expect(page.getByRole('button', { name: 'Private Messages' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Action Submissions' })).toBeVisible();
  });

  test('Co-GM can edit Action Results', async ({ page }) => {
    // Action phase was activated in the previous test, so Actions tab should be visible
    // If we need to re-activate: the fixture has "Test Phase 1" as an action phase

    await loginAs(page, 'AUDIENCE_2');

    const gamePage = new GameDetailsPage(page);
    await gamePage.goto(gameId);

    // Reload to ensure fresh auth state
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Navigate to Actions tab where GMs manage action results
    // (visible because action phase is active from previous test)
    await page.getByRole('tab', { name: 'Actions' }).click();
    await page.waitForLoadState('networkidle');

    // Verify co-GM can see the Action Results heading (GM-only view)
    // This is the key permission check - only GMs and co-GMs can access action results
    await expect(page.getByRole('heading', { name: 'Action Results', exact: true })).toBeVisible({ timeout: 10000 });

    // Note: Full action results editing flow is tested in action-results-flow.spec.ts for GMs
    // This test verifies co-GMs have the same access to the Action Results section
  });

  test('Co-GM can access character management', async ({ page }) => {
    await loginAs(page, 'AUDIENCE_2');
    const gamePage = new GameDetailsPage(page);
    await gamePage.goto(gameId);

    // Reload to ensure fresh auth state
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Navigate to People tab > Characters
    await page.getByRole('tab', { name: 'People' }).click();
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: 'Characters' }).click();

    // Verify co-GM can see the Characters heading (GM-only permission check)
    // This is the key permission - only GMs and co-GMs can access character management
    await expect(page.getByRole('heading', { name: 'Characters', exact: true })).toBeVisible();

    // Verify co-GM can see Create Character button (GM-only permission)
    const createButton = page.getByRole('button', { name: 'Create Character' });
    await expect(createButton).toBeVisible();

    // Note: Full character approval workflow tested in character-approval-workflow.spec.ts
    // This test verifies co-GMs have same access to character management
  });

});
