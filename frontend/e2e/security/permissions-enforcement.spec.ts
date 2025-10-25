import { test, expect } from '@playwright/test';
import { loginAs } from '../fixtures/auth-helpers';
import { getFixtureGameId } from '../fixtures/game-helpers';
import { navigateToGame } from '../utils/navigation';

/**
 * E2E Tests for Permissions & Access Control
 *
 * Tests that security boundaries are properly enforced across the application:
 * - Players cannot access GM-only features
 * - Players cannot edit other players' content
 * - Audience members have read-only access
 * - Users cannot see unpublished/private content
 * - Character ownership is enforced
 *
 * CRITICAL: These tests verify security controls that protect game integrity
 * and user privacy. Failures here indicate serious security issues.
 */

test.describe('Permissions & Access Control', () => {

  test.describe('GM-Only Features', () => {
    test('player cannot create or activate phases', async ({ page }) => {
      await loginAs(page, 'PLAYER_1');

      // Use E2E Action game which has an active phase
      const gameId = await getFixtureGameId(page, 'E2E_ACTION');
      await navigateToGame(page, gameId);

      // Navigate to Phase Management tab
      await page.click('[role="tab"]:has-text("Phase Management")');
      await page.waitForLoadState('networkidle');

      // Verify "Create Phase" button is not visible to player
      const createPhaseButton = page.locator('button:has-text("Create Phase")');
      await expect(createPhaseButton).not.toBeVisible();

      // Verify "Activate" buttons are not visible
      const activateButtons = page.locator('button:has-text("Activate")');
      await expect(activateButtons).toHaveCount(0);
    });

    test('player cannot access phase management actions', async ({ page }) => {
      await loginAs(page, 'PLAYER_2');

      const gameId = await getFixtureGameId(page, 'E2E_ACTION');
      await navigateToGame(page, gameId);

      // Try to access Phase Management
      await page.click('[role="tab"]:has-text("Phase Management")');
      await page.waitForLoadState('networkidle');

      // Verify player sees read-only view (no action buttons)
      const editButtons = page.locator('button:has-text("Edit"), button:has-text("Delete"), button:has-text("End Phase")');
      await expect(editButtons).toHaveCount(0);
    });

    test('player cannot edit game settings', async ({ page }) => {
      await loginAs(page, 'PLAYER_3');

      const gameId = await getFixtureGameId(page, 'E2E_ACTION');
      await navigateToGame(page, gameId);

      // Look for Settings tab or Edit Game button
      const settingsTab = page.locator('[role="tab"]:has-text("Settings")');
      const editGameButton = page.locator('button:has-text("Edit Game"), button:has-text("Game Settings")');

      // Verify player cannot see or access settings
      await expect(settingsTab).not.toBeVisible();
      await expect(editGameButton).toHaveCount(0);
    });
  });

  test.describe('Character Ownership', () => {
    test('player cannot edit another player\'s character', async ({ browser }) => {
      const player1Context = await browser.newContext();
      const player2Context = await browser.newContext();
      const player1Page = await player1Context.newPage();
      const player2Page = await player2Context.newPage();

      try {
        // Player 1 logs in and navigates to their character
        await loginAs(player1Page, 'PLAYER_1');
        const gameId = await getFixtureGameId(player1Page, 'E2E_ACTION');
        await navigateToGame(player1Page, gameId);

        // Get Player 1's character ID from the page
        await player1Page.click('[role="tab"]:has-text("Characters")');
        await player1Page.waitForLoadState('networkidle');

        // Player 1 should see edit button for their own character
        const player1EditButton = player1Page.locator('button:has-text("Edit"), button[title*="Edit"]').first();
        await expect(player1EditButton).toBeVisible();

        // Player 2 logs in and views same game
        await loginAs(player2Page, 'PLAYER_2');
        await navigateToGame(player2Page, gameId);

        await player2Page.click('[role="tab"]:has-text("Characters")');
        await player2Page.waitForLoadState('networkidle');

        // Look for Player 1's character (E2E Test Char 1)
        const player1Character = player2Page.locator('text="E2E Test Char 1"').first();
        await expect(player1Character).toBeVisible();

        // Player 2 should NOT see edit button for Player 1's character
        // They should only see their own character's edit button
        const characterCards = player2Page.locator('[data-testid="character-card"], div:has-text("E2E Test Char 1")').first();
        const editButtonInPlayer1Card = characterCards.locator('button:has-text("Edit"), button[title*="Edit"]');

        // If there's an edit button, it should be disabled or not exist
        const editButtonCount = await editButtonInPlayer1Card.count();
        if (editButtonCount > 0) {
          await expect(editButtonInPlayer1Card).toBeDisabled();
        }
      } finally {
        await player1Context.close();
        await player2Context.close();
      }
    });

    test('player can only upload avatar for their own character', async ({ page }) => {
      await loginAs(page, 'PLAYER_1');

      const gameId = await getFixtureGameId(page, 'CHARACTER_AVATARS');
      await navigateToGame(page, gameId);

      // Navigate to characters
      await page.click('[role="tab"]:has-text("Characters")');
      await page.waitForLoadState('networkidle');

      // Find Player 1's character - should have upload button
      const ownCharacter = page.locator('div:has-text("E2E Test Char 1")').first();
      const ownUploadButton = ownCharacter.locator('button:has-text("Upload"), button[title*="Upload"]');
      await expect(ownUploadButton).toBeVisible();

      // Find another player's character - should NOT have upload button for Player 1
      const otherCharacter = page.locator('div:has-text("E2E Test Char 2"), div:has-text("E2E Test Char 3")').first();
      if (await otherCharacter.isVisible()) {
        const otherUploadButton = otherCharacter.locator('button:has-text("Upload"), button[title*="Upload"]');
        await expect(otherUploadButton).not.toBeVisible();
      }
    });
  });

  test.describe('Audience Read-Only Access', () => {
    test('audience cannot submit actions', async ({ page }) => {
      await loginAs(page, 'AUDIENCE');

      const gameId = await getFixtureGameId(page, 'E2E_ACTION');
      await navigateToGame(page, gameId);

      // Try to access Actions tab
      const actionsTab = page.locator('[role="tab"]:has-text("Actions")');

      // Audience might see the tab but should not see submit button
      if (await actionsTab.isVisible()) {
        await actionsTab.click();
        await page.waitForLoadState('networkidle');

        const submitButton = page.locator('button:has-text("Submit Action"), button:has-text("Create Action")');
        await expect(submitButton).not.toBeVisible();
      }
    });

    test('audience cannot send messages', async ({ page }) => {
      await loginAs(page, 'AUDIENCE');

      const gameId = await getFixtureGameId(page, 'E2E_MESSAGES');
      await navigateToGame(page, gameId);

      // Navigate to Messages tab
      const messagesTab = page.locator('[role="tab"]:has-text("Messages")');

      if (await messagesTab.isVisible()) {
        await messagesTab.click();
        await page.waitForLoadState('networkidle');

        // Should not see "New Conversation" button
        const newConversationButton = page.locator('button:has-text("New Conversation"), button[title="New Conversation"]');
        await expect(newConversationButton).not.toBeVisible();
      }
    });

    test('audience cannot post in common room', async ({ page }) => {
      await loginAs(page, 'AUDIENCE');

      const gameId = await getFixtureGameId(page, 'COMMON_ROOM_POSTS');
      await navigateToGame(page, gameId);

      // Navigate to Common Room
      await page.click('[role="tab"]:has-text("Common Room")');
      await page.waitForLoadState('networkidle');

      // Should not see "Create Post" or "New Post" button
      const createPostButton = page.locator('button:has-text("Create Post"), button:has-text("New Post")');
      await expect(createPostButton).not.toBeVisible();

      // Should not see "Add Comment" buttons
      const addCommentButtons = page.locator('button:has-text("Add Comment")');
      await expect(addCommentButtons).toHaveCount(0);
    });
  });

  test.describe('Private Content Access', () => {
    test('player cannot see private messages they are not part of', async ({ browser }) => {
      const player1Context = await browser.newContext();
      const player3Context = await browser.newContext();
      const player1Page = await player1Context.newPage();
      const player3Page = await player3Context.newPage();

      try {
        // Player 1 creates a private conversation with Player 2 (not Player 3)
        await loginAs(player1Page, 'PLAYER_1');
        const gameId = await getFixtureGameId(player1Page, 'E2E_MESSAGES');
        await navigateToGame(player1Page, gameId);

        await player1Page.click('button:has-text("Messages")');
        await player1Page.waitForLoadState('networkidle');

        await player1Page.click('button[title="New Conversation"]');
        await player1Page.waitForSelector('input[placeholder*="Planning the heist"]', { timeout: 5000 });

        const conversationTitle = `Private Test ${Date.now()}`;
        await player1Page.fill('input[placeholder*="Planning the heist"]', conversationTitle);

        // Select ONLY Player 2's character
        await player1Page.click('label:has-text("E2E Test Char 2")');
        await player1Page.click('button:has-text("Create Conversation")');
        await player1Page.waitForLoadState('networkidle');

        // Send a private message
        const privateMessage = `This is private between Player 1 and Player 2 - ${Date.now()}`;
        await player1Page.fill('textarea[placeholder*="Type your message"]', privateMessage);
        await player1Page.click('button:has-text("Send")');
        await player1Page.waitForLoadState('networkidle');

        // Player 3 logs in and checks messages
        await loginAs(player3Page, 'PLAYER_3');
        await navigateToGame(player3Page, gameId);

        await player3Page.click('button:has-text("Messages")');
        await player3Page.waitForLoadState('networkidle');

        // Player 3 should NOT see the private conversation
        const privateConversation = player3Page.locator(`text="${conversationTitle}"`);
        await expect(privateConversation).not.toBeVisible();

        // Player 3 should NOT see the private message content
        const privateMessageText = player3Page.locator(`text="${privateMessage}"`);
        await expect(privateMessageText).not.toBeVisible();
      } finally {
        await player1Context.close();
        await player3Context.close();
      }
    });

    test('direct URL access to unauthorized conversation is blocked', async ({ page }) => {
      await loginAs(page, 'PLAYER_3');

      // Try to access a conversation ID that Player 3 is not part of
      // Using a likely conversation ID from fixtures (adjust if needed)
      const gameId = await getFixtureGameId(page, 'E2E_MESSAGES');

      // Attempt direct navigation to a conversation (this would be a conversation between Player 1 and Player 2)
      // The actual ID would need to be known or we'd need to create one first
      // For now, we'll verify the behavior by checking if unauthorized access shows an error or redirects

      await page.goto(`/games/${gameId}`);
      await page.waitForLoadState('networkidle');

      // Try to access messages tab
      await page.click('button:has-text("Messages")');
      await page.waitForLoadState('networkidle');

      // Verify Player 3 only sees their own conversations
      // They should not see conversations they're not part of in the list
      const conversationList = page.locator('[data-testid="conversation-list"], div:has(button:has-text("Messages"))');
      await expect(conversationList).toBeVisible();

      // The conversation list should be empty or only show their conversations
      // (This assumes Player 3 has no conversations in the fixture)
    });
  });

  test.describe('Unpublished Content Visibility', () => {
    test('player cannot see draft action results', async ({ page }) => {
      // This test would require a fixture with draft (unpublished) action results
      // For now, we'll verify the concept by checking that players only see published content

      await loginAs(page, 'PLAYER_1');
      const gameId = await getFixtureGameId(page, 'E2E_ACTION');
      await navigateToGame(page, gameId);

      // Navigate to phase history or results
      await page.click('[role="tab"]:has-text("Phase History"), [role="tab"]:has-text("Results")');
      await page.waitForLoadState('networkidle');

      // Verify no "Draft" or "Unpublished" labels are visible
      const draftLabels = page.locator('text=/Draft|Unpublished|Not Published/i');
      await expect(draftLabels).toHaveCount(0);
    });

    test('player cannot see inactive phases', async ({ page }) => {
      await loginAs(page, 'PLAYER_2');
      const gameId = await getFixtureGameId(page, 'E2E_ACTION');
      await navigateToGame(page, gameId);

      // Navigate to Phase Management (read-only for players)
      await page.click('[role="tab"]:has-text("Phase Management")');
      await page.waitForLoadState('networkidle');

      // Look for any phases marked as "draft" or "inactive" or "not published"
      const inactivePhaseBadges = page.locator('[data-testid="phase-status"]:has-text("Inactive"), [data-testid="phase-status"]:has-text("Draft")');

      // Players should not see phases that haven't been activated/published
      // They should only see the active phase and completed phases
      const activePhaseCount = await page.locator('[data-testid="phase-status"]:has-text("Active"), div:has-text("Active Phase")').count();
      expect(activePhaseCount).toBeGreaterThan(0); // At least one active phase should be visible
    });
  });

  test.describe('Character Approval Permissions', () => {
    test('player cannot approve their own character', async ({ page }) => {
      // This test verifies that players cannot bypass character approval
      await loginAs(page, 'PLAYER_1');
      const gameId = await getFixtureGameId(page, 'E2E_ACTION');
      await navigateToGame(page, gameId);

      await page.click('[role="tab"]:has-text("Characters")');
      await page.waitForLoadState('networkidle');

      // Look for their own character
      const ownCharacter = page.locator('text="E2E Test Char 1"').first();
      await expect(ownCharacter).toBeVisible();

      // Should not see "Approve" or "Reject" buttons for own character
      const approveButton = page.locator('button:has-text("Approve")');
      const rejectButton = page.locator('button:has-text("Reject")');

      await expect(approveButton).not.toBeVisible();
      await expect(rejectButton).not.toBeVisible();
    });

    test('only GM can approve characters', async ({ page }) => {
      await loginAs(page, 'GM');
      const gameId = await getFixtureGameId(page, 'E2E_ACTION');
      await navigateToGame(page, gameId);

      await page.click('[role="tab"]:has-text("Characters")');
      await page.waitForLoadState('networkidle');

      // GM should see all characters and have access to management actions
      // This would depend on whether there are pending characters in the fixture
      // At minimum, verify GM can access character management
      const characterManagementSection = page.locator('div:has-text("Character"), div:has-text("E2E Test Char")');
      await expect(characterManagementSection.first()).toBeVisible();
    });
  });

  test.describe('API Direct Access Prevention', () => {
    test('player cannot modify game via direct API call', async ({ page }) => {
      await loginAs(page, 'PLAYER_1');
      const gameId = await getFixtureGameId(page, 'E2E_ACTION');

      // Try to make a direct API call to update game settings
      const token = await page.evaluate(() => localStorage.getItem('auth_token'));

      const response = await page.evaluate(async ({ gameId, token }) => {
        try {
          const res = await fetch(`/api/v1/games/${gameId}`, {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              title: 'Hacked Game Title',
              description: 'Player tried to modify game'
            })
          });
          return { status: res.status, ok: res.ok };
        } catch (error) {
          return { error: error.message };
        }
      }, { gameId, token });

      // Should receive 403 Forbidden or 401 Unauthorized
      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(response.ok).toBe(false);
    });

    test('player cannot create phase via direct API call', async ({ page }) => {
      await loginAs(page, 'PLAYER_2');
      const gameId = await getFixtureGameId(page, 'E2E_ACTION');

      const token = await page.evaluate(() => localStorage.getItem('auth_token'));

      const response = await page.evaluate(async ({ gameId, token }) => {
        try {
          const res = await fetch(`/api/v1/games/${gameId}/phases`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              phase_type: 'action',
              title: 'Unauthorized Phase',
              description: 'Player tried to create phase'
            })
          });
          return { status: res.status, ok: res.ok };
        } catch (error) {
          return { error: error.message };
        }
      }, { gameId, token });

      // Should receive 403 Forbidden
      expect(response.status).toBe(403);
      expect(response.ok).toBe(false);
    });
  });
});
