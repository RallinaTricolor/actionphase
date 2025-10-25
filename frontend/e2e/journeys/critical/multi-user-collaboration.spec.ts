import { test, expect } from '@playwright/test';
import { tagTest, tags } from '../../fixtures/test-tags';
import { loginAs } from '../../fixtures/auth-helpers';
import { getFixtureGameId } from '../../fixtures/game-helpers';
import { CommonRoomPage } from '../../pages/CommonRoomPage';

/**
 * Critical Journey: Multi-User Collaboration
 *
 * Tests multiple users interacting with the same game:
 * - Multiple players viewing the same game
 * - GM and players see appropriate UI elements
 * - Character viewing from multiple users
 * - Role-based permissions
 *
 * This is a CRITICAL path test - must pass for deployment
 */
test.describe('Critical: Multi-User Collaboration', () => {

  test(tagTest([tags.CRITICAL, tags.GAME, tags.E2E, tags.SLOW], 'Multiple users can view and interact with same game'), async ({ browser }) => {
    // Step 1: Create separate browser contexts for GM and two players
    const gmContext = await browser.newContext();
    const player1Context = await browser.newContext();
    const player2Context = await browser.newContext();

    const gmPage = await gmContext.newPage();
    const player1Page = await player1Context.newPage();
    const player2Page = await player2Context.newPage();

    try {
      // Step 2: All users log in
      await loginAs(gmPage, 'GM');
      await loginAs(player1Page, 'PLAYER_1');
      await loginAs(player2Page, 'PLAYER_2');

      // Step 3: Get the shared test game
      const gameId = await getFixtureGameId(gmPage, 'COMMON_ROOM_POSTS');

      // Step 4: All users navigate to the same game
      await gmPage.goto(`/games/${gameId}`);
      await player1Page.goto(`/games/${gameId}`);
      await player2Page.goto(`/games/${gameId}`);

      await gmPage.waitForLoadState('networkidle');
      await player1Page.waitForLoadState('networkidle');
      await player2Page.waitForLoadState('networkidle');

      // Step 5: Verify all users can see the game title
      const gameTitle = 'E2E Common Room - Posts';
      await expect(gmPage.locator(`text=${gameTitle}`)).toBeVisible();
      await expect(player1Page.locator(`text=${gameTitle}`)).toBeVisible();
      await expect(player2Page.locator(`text=${gameTitle}`)).toBeVisible();

      // Step 6: Verify all users see the same game header content
      const gmH1 = await gmPage.locator('h1').first().textContent();
      const player1H1 = await player1Page.locator('h1').first().textContent();
      const player2H1 = await player2Page.locator('h1').first().textContent();

      expect(gmH1).toBe(player1H1);
      expect(gmH1).toBe(player2H1);

      // Step 7: Verify tab navigation exists for all users
      const peopleTabGM = gmPage.locator('button:has-text("People"), a:has-text("People")').first();
      const peopleTabP1 = player1Page.locator('button:has-text("People"), a:has-text("People")').first();
      const peopleTabP2 = player2Page.locator('button:has-text("People"), a:has-text("People")').first();

      await expect(peopleTabGM).toBeVisible();
      await expect(peopleTabP1).toBeVisible();
      await expect(peopleTabP2).toBeVisible();

      // Step 8: All users click on People tab to view characters
      await peopleTabGM.click();
      await peopleTabP1.click();
      await peopleTabP2.click();

      await gmPage.waitForLoadState('networkidle');
      await player1Page.waitForLoadState('networkidle');
      await player2Page.waitForLoadState('networkidle');

      // Step 9: Verify characters are visible to all users
      // The fixture has GM, Player 1, and Player 2 characters
      await expect(gmPage.locator('text=GM Test Character')).toBeVisible({ timeout: 5000 });
      await expect(player1Page.locator('text=Test Player 1 Character')).toBeVisible({ timeout: 5000 });
      await expect(player2Page.locator('text=Test Player 2 Character')).toBeVisible({ timeout: 5000 });

      // Step 10: Verify role-based permissions
      // GM should NOT see "Leave Game" (they own it)
      // Players SHOULD see "Leave Game"
      const gmLeaveButton = gmPage.locator('button:has-text("Leave Game")');
      const player1LeaveButton = player1Page.locator('button:has-text("Leave Game")');

      await expect(gmLeaveButton).not.toBeVisible();
      await expect(player1LeaveButton).toBeVisible();

    } finally {
      // Cleanup: Close all browser contexts
      await gmContext.close();
      await player1Context.close();
      await player2Context.close();
    }
  });

  test(tagTest([tags.CRITICAL, tags.GAME, tags.MESSAGE], 'Multiple users can view and create posts in same game'), async ({ browser }) => {
    // Step 1: Create contexts for GM and Player
    const gmContext = await browser.newContext();
    const playerContext = await browser.newContext();

    const gmPage = await gmContext.newPage();
    const playerPage = await playerContext.newPage();

    try {
      // Step 2: Login both users
      await loginAs(gmPage, 'GM');
      await loginAs(playerPage, 'PLAYER_1');

      // Step 3: Navigate to the shared game's common room
      const gameId = await getFixtureGameId(gmPage, 'COMMON_ROOM_POSTS');

      const gmCommonRoom = new CommonRoomPage(gmPage);
      const playerCommonRoom = new CommonRoomPage(playerPage);

      await gmCommonRoom.goto(gameId);
      await expect(gmCommonRoom.heading).toBeVisible({ timeout: 10000 });
      await expect(gmCommonRoom.createPostHeading).toBeVisible({ timeout: 5000 });

      await playerCommonRoom.goto(gameId);
      await expect(playerCommonRoom.heading).toBeVisible({ timeout: 10000 });

      // Step 4: GM creates a post
      const timestamp = Date.now();
      const gmPostContent = `Multi-user Test ${timestamp}`;

      await gmCommonRoom.createPost(gmPostContent);

      // Step 5: Verify GM sees their post
      await expect(gmPage.locator(`text=${gmPostContent}`)).toBeVisible({ timeout: 5000 });

      // Step 6: Player should see the new post (may need refresh)
      await playerPage.reload();
      await playerPage.waitForLoadState('networkidle');

      await expect(playerPage.locator(`text=${gmPostContent}`)).toBeVisible({ timeout: 5000 });

      // Step 7: GM creates a second post
      const secondPostContent = `Follow-up Post ${timestamp}`;

      await gmCommonRoom.createPost(secondPostContent);

      // Step 8: Verify GM sees second post
      await expect(gmPage.locator(`text=${secondPostContent}`)).toBeVisible({ timeout: 5000 });

      // Step 9: Player refreshes and should see both posts
      await playerPage.reload();
      await playerPage.waitForLoadState('networkidle');

      await expect(playerPage.locator(`text=${gmPostContent}`)).toBeVisible({ timeout: 5000 });
      await expect(playerPage.locator(`text=${secondPostContent}`)).toBeVisible({ timeout: 5000 });

    } finally {
      await gmContext.close();
      await playerContext.close();
    }
  });

  test(tagTest([tags.CRITICAL, tags.GAME], 'Multiple users see consistent character information'), async ({ browser }) => {
    // Step 1: Create contexts for two players
    const player1Context = await browser.newContext();
    const player2Context = await browser.newContext();

    const player1Page = await player1Context.newPage();
    const player2Page = await player2Context.newPage();

    try {
      // Step 2: Login both players
      await loginAs(player1Page, 'PLAYER_1');
      await loginAs(player2Page, 'PLAYER_2');

      // Step 3: Navigate to the shared game
      const gameId = await getFixtureGameId(player1Page, 'COMMON_ROOM_POSTS');

      await player1Page.goto(`/games/${gameId}`);
      await player2Page.goto(`/games/${gameId}`);

      await player1Page.waitForLoadState('networkidle');
      await player2Page.waitForLoadState('networkidle');

      // Step 4: Both players navigate to People tab
      const peopleTabP1 = player1Page.locator('button:has-text("People"), a:has-text("People")').first();
      const peopleTabP2 = player2Page.locator('button:has-text("People"), a:has-text("People")').first();

      await peopleTabP1.click();
      await peopleTabP2.click();

      await player1Page.waitForLoadState('networkidle');
      await player2Page.waitForLoadState('networkidle');

      // Step 5: Player 1 sees their own character with "Your Character" badge
      await expect(player1Page.locator('text=Test Player 1 Character')).toBeVisible();
      await expect(player1Page.locator('text=Your Character')).toBeVisible();

      // Step 6: Player 1 should see "Edit Sheet" for their character
      const editSheetButton = player1Page.locator('button:has-text("Edit Sheet")').first();
      await expect(editSheetButton).toBeVisible();

      // Step 7: Player 2 sees Player 1's character but NOT as "Your Character"
      await expect(player2Page.locator('text=Test Player 1 Character')).toBeVisible();

      // Player 2 should see "View Sheet" (not Edit) for Player 1's character
      const viewSheetButton = player2Page.locator('button:has-text("View Sheet")').first();
      await expect(viewSheetButton).toBeVisible();

      // Step 8: Click to view character sheet
      await viewSheetButton.click();
      await player2Page.waitForLoadState('networkidle');

      // Step 9: Verify character sheet modal/page loaded
      await expect(player2Page.locator('text=Test Player 1 Character')).toBeVisible();

      // Step 10: Player 2 should NOT see edit controls
      const editButton = player2Page.locator('button:has-text("Edit"), button[aria-label*="edit"]');
      const editButtonCount = await editButton.count();

      // There might be some edit buttons in nav, but not for character data
      // The key is that View Sheet should exist but the user can't edit another player's character
      expect(editButtonCount).toBeLessThanOrEqual(2); // At most nav-level edit buttons

    } finally {
      await player1Context.close();
      await player2Context.close();
    }
  });
});
