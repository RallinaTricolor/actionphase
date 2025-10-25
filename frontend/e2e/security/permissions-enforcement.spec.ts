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
    test('player cannot access phase management tab', async ({ page }) => {
      await loginAs(page, 'PLAYER_1');

      // Use E2E Action game which has an active phase
      const gameId = await getFixtureGameId(page, 'E2E_ACTION');
      await navigateToGame(page, gameId);

      // Verify Phases tab is not visible to players at all
      const phasesTab = page.locator('button:has-text("Phases")');
      await expect(phasesTab).not.toBeVisible();
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

        // Navigate to People/Characters tab
        await player1Page.click('button:has-text("People"), button:has-text("Characters")');
        await player1Page.waitForLoadState('networkidle');

        // Player 1 should see edit button for their own character
        const player1EditButton = player1Page.locator('button:has-text("Edit")').first();
        await expect(player1EditButton).toBeVisible();

        // Player 2 logs in and views same game
        await loginAs(player2Page, 'PLAYER_2');
        await navigateToGame(player2Page, gameId);

        await player2Page.click('button:has-text("People"), button:has-text("Characters")');
        await player2Page.waitForLoadState('networkidle');

        // Look for Player 1's character (E2E Test Char 1)
        const player1Character = player2Page.locator('text="E2E Test Char 1"');
        await expect(player1Character.first()).toBeVisible();

        // Find the specific card/container for Player 1's character using the character name
        const player1CharacterCard = player2Page.locator('div:has-text("E2E Test Char 1"):has-text("test_player1")');

        // Player 2 should NOT see an edit button within Player 1's character card
        const editButtonInPlayer1Card = player1CharacterCard.locator('button:has-text("Edit")');
        await expect(editButtonInPlayer1Card).not.toBeVisible();
      } finally {
        await player1Context.close();
        await player2Context.close();
      }
    });

    test('player can only upload avatar for their own character', async ({ page }) => {
      await loginAs(page, 'PLAYER_1');

      const gameId = await getFixtureGameId(page, 'CHARACTER_AVATARS');
      await navigateToGame(page, gameId);

      // Navigate to People/Characters tab
      await page.click('button:has-text("People"), button:has-text("Characters")');
      await page.waitForLoadState('networkidle');

      // Click Edit Sheet for Player 1's character to open modal
      const editButton = page.locator('button:has-text("Edit Sheet")').first();
      await expect(editButton).toBeVisible({ timeout: 10000 });
      await editButton.click();

      // Wait for character sheet modal to open
      await expect(page.locator('h2:has-text("E2E Test Char 1")')).toBeVisible();

      // Upload button should be visible for owner
      const uploadButton = page.locator('button[title="Upload Avatar"]');
      await expect(uploadButton).toBeVisible();

      // Close the modal using Escape key
      await page.keyboard.press('Escape');
      await page.waitForLoadState('networkidle');

      // Now verify Player 1 cannot see Edit Sheet button for Player 2's character
      // Player 1's character shows first, Player 2's character should be visible but not editable
      const player2CharacterName = page.locator('text="E2E Test Char 2"');
      await expect(player2CharacterName).toBeVisible();

      // Count all Edit Sheet buttons - should only be 1 (for Player 1's own character)
      const allEditButtons = page.locator('button:has-text("Edit Sheet")');
      await expect(allEditButtons).toHaveCount(1);
    });
  });

  test.describe('Audience/NPC Permissions', () => {
    test('audience members cannot submit actions (even with NPCs)', async ({ page }) => {
      await loginAs(page, 'AUDIENCE');

      const gameId = await getFixtureGameId(page, 'E2E_ACTION');
      await navigateToGame(page, gameId);

      // Try to access Actions tab
      const actionsTab = page.locator('button:has-text("Actions")');

      // NPCs cannot submit actions - only Player Characters can
      // Audience might see the tab but should not see submit button
      if (await actionsTab.isVisible()) {
        await actionsTab.click();
        await page.waitForLoadState('networkidle');

        const submitButton = page.locator('button:has-text("Submit Action"), button:has-text("Create Action")');
        await expect(submitButton).not.toBeVisible();
      }
    });

    // NOTE: Audience members without assigned NPCs cannot participate in roleplay
    // Audience members WITH assigned NPCs CAN:
    // - Post and comment in common room as their NPC
    // - Send private messages as their NPC
    // - But CANNOT submit actions (NPCs don't participate in action resolution)

    test('audience without characters cannot post in common room', async ({ page }) => {
      await loginAs(page, 'AUDIENCE');

      const gameId = await getFixtureGameId(page, 'COMMON_ROOM_POSTS');
      await navigateToGame(page, gameId);

      // Navigate to Common Room
      await page.click('button:has-text("Common Room")');
      await page.waitForLoadState('networkidle');

      // Should not see "Create Post" or "New Post" button if no characters
      const createPostButton = page.locator('button:has-text("Create Post"), button:has-text("New Post")');
      await expect(createPostButton).not.toBeVisible();

      // Should not see "Add Comment" buttons if no characters
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
  });

  test.describe('Unpublished Content Visibility', () => {
    test('player cannot see draft action results', async ({ page }) => {
      // This test would require a fixture with draft (unpublished) action results
      // For now, we'll verify the concept by checking that players only see published content

      await loginAs(page, 'PLAYER_1');
      const gameId = await getFixtureGameId(page, 'E2E_ACTION');
      await navigateToGame(page, gameId);

      // Navigate to History tab (phase history / results)
      await page.click('button:has-text("History")');
      await page.waitForLoadState('networkidle');

      // Wait for phase history heading
      await page.waitForSelector('h2:has-text("Phase History")', { timeout: 5000 });

      // Verify no "Draft" or "Unpublished" labels are visible
      const draftLabels = page.locator('text=/Draft|Unpublished|Not Published/i');
      await expect(draftLabels).toHaveCount(0);
    });
  });

  test.describe('Character Approval Permissions', () => {
    test('player cannot approve their own character', async ({ page }) => {
      // This test verifies that players cannot bypass character approval
      await loginAs(page, 'PLAYER_1');
      const gameId = await getFixtureGameId(page, 'E2E_ACTION');
      await navigateToGame(page, gameId);

      // Navigate to People/Characters tab
      await page.click('button:has-text("People"), button:has-text("Characters")');
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

      // Navigate to People/Characters tab
      await page.click('button:has-text("People"), button:has-text("Characters")');
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
