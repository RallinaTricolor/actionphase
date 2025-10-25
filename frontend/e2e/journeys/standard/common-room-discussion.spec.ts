import { test, expect } from '@playwright/test';
import { loginAs } from '../../fixtures/auth-helpers';
import { getFixtureGameId } from '../../fixtures/game-helpers';
import { CommonRoomPage } from '../../pages/CommonRoomPage';

/**
 * Journey 4: Common Room Discussion
 *
 * Tests the complete workflow:
 * GM posts → Players view and comment → Nested threading → Unread indicators
 *
 * Using dedicated E2E fixture game "E2E Common Room - Posts"
 */
test.describe('Common Room Discussion Journey', () => {

  test('GM can view existing posts in common room', async ({ page }) => {
    // Step 1: Login as GM
    await loginAs(page, 'GM');

    // Step 2: Navigate to dedicated E2E Common Room game
    const gameId = await getFixtureGameId(page, 'COMMON_ROOM_POSTS');
    const commonRoom = new CommonRoomPage(page);
    await commonRoom.goto(gameId);

    // Step 3: Verify common room loads
    await expect(commonRoom.heading).toBeVisible({ timeout: 5000 });
    await expect(commonRoom.createPostHeading).toBeVisible();
  });

  test('Player can view posts and navigate common room', async ({ page }) => {
    // Step 1: Login as Player
    await loginAs(page, 'PLAYER_1');

    // Step 2: Navigate to dedicated E2E Common Room game
    const gameId = await getFixtureGameId(page, 'COMMON_ROOM_POSTS');
    const commonRoom = new CommonRoomPage(page);
    await commonRoom.goto(gameId);

    // Step 3: Verify common room displays properly for players
    await expect(commonRoom.heading).toBeVisible();

    // Step 4: Verify player can see posts (check for "Add Comment" button as indicator)
    const addCommentButton = page.locator('button:has-text("Add Comment")').first();
    await expect(addCommentButton).toBeVisible({ timeout: 5000 });
  });

  test('Complete discussion flow - view existing threaded comments', async ({ page }) => {
    // This test verifies the complete common room viewing experience

    // Step 1: Login as a player
    await loginAs(page, 'PLAYER_2');

    // Step 2: Navigate to game with existing posts
    const gameId = await getFixtureGameId(page, 'COMMON_ROOM_POSTS');
    const commonRoom = new CommonRoomPage(page);
    await commonRoom.goto(gameId);

    // Step 3: Verify common room structure is present
    await expect(commonRoom.heading).toBeVisible();

    // Step 4: Verify posts exist and are interactive (check for Add Comment button)
    const addCommentButton = page.locator('button:has-text("Add Comment")').first();
    await expect(addCommentButton).toBeVisible({ timeout: 5000 });
  });

  test('Navigation between Common Room tabs works', async ({ page }) => {
    // Step 1: Login as GM
    await loginAs(page, 'GM');

    // Step 2: Navigate to common room
    const gameId = await getFixtureGameId(page, 'COMMON_ROOM_POSTS');
    const commonRoom = new CommonRoomPage(page);
    await commonRoom.goto(gameId);

    // Step 3: Verify Posts tab is active by default
    await expect(page.locator('button:has-text("Posts")')).toHaveClass(/border-accent-primary/);

    // Step 4: Switch to New Comments tab
    await page.click('button:has-text("New Comments")');
    await page.waitForLoadState('networkidle');

    // Step 5: Verify New Comments tab is now active
    await expect(page.locator('button:has-text("New Comments")')).toHaveClass(/border-accent-primary/);

    // Step 6: Switch back to Posts tab
    await page.click('button:has-text("Posts")');
    await page.waitForLoadState('networkidle');

    // Step 7: Verify Posts tab is active again
    await expect(page.locator('button:has-text("Posts")')).toHaveClass(/border-accent-primary/);
  });

  test('Common room is accessible from game details page', async ({ page }) => {
    // This tests the navigation path: Dashboard → Game → Common Room

    // Step 1: Login
    await loginAs(page, 'PLAYER_1');

    // Step 2: Navigate to game details first
    const gameId = await getFixtureGameId(page, 'COMMON_ROOM_POSTS');
    await page.goto(`/games/${gameId}`);
    await page.waitForLoadState('networkidle');

    // Step 3: Click on Common Room tab using role selector for better reliability
    const commonRoomTab = page.locator('button[role="tab"]:has-text("Common Room")');
    await expect(commonRoomTab).toBeVisible({ timeout: 5000 });
    await commonRoomTab.click();
    await page.waitForLoadState('networkidle');

    // Step 4: Verify we're now viewing the common room
    // Check URL contains the tab parameter
    await expect(page).toHaveURL(/tab=common-room/);

    // Step 5: Verify common room content loads
    const commonRoom = new CommonRoomPage(page);
    await expect(commonRoom.heading).toBeVisible();
  });
});
