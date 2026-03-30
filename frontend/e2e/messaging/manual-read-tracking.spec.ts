import { test, expect, Browser } from '@playwright/test';
import { loginAs } from '../fixtures/auth-helpers';
import { CommonRoomPage } from '../pages/CommonRoomPage';
import { SettingsPage } from '../pages/SettingsPage';
import { HistoryPage } from '../pages/HistoryPage';
import { getFixtureGameId } from '../fixtures/game-helpers';

/**
 * Manual Comment Read Tracking E2E Tests
 *
 * Tests the manual read/unread tracking feature introduced alongside the
 * "comment_read_mode" user preference.
 *
 * Edge cases covered by unit/component tests:
 * - Opacity-50 fading applied to content div, not outer wrapper (no cascade to replies) ✅
 * - Read button hidden in auto mode ✅
 * - Read button hidden when readOnly=true (history view) ✅
 * - Clicking Read calls onToggleRead with correct args ✅
 *
 * These E2E tests validate the full end-to-end flow:
 * - Mark as read button appears in manual mode
 * - Clicking it toggles to "Unread" and persists after page reload
 * - Button is absent in auto mode
 * - Button is absent in the History (read-only) view
 * - Mark as read works from the New Comments page
 */

// Shared state set up once by beforeAll
let sharedGameId: number;
let sharedPostContent: string;

/**
 * Set up shared test state once for the whole suite using separate browser contexts.
 * GM creates a post, Player 2 adds a comment — Player 1 can then mark that comment as read.
 * Using separate contexts avoids login/logout cycles in the main page object.
 */
async function setupSharedPost(browser: Browser): Promise<{ gameId: number; postContent: string }> {
  // GM creates the post
  const gmContext = await browser.newContext();
  const gmPage = await gmContext.newPage();
  let gameId: number;
  let postContent: string;
  try {
    await loginAs(gmPage, 'GM');
    gameId = await getFixtureGameId(gmPage, 'COMMON_ROOM_POSTS');
    postContent = `Manual Read Tracking Suite ${Date.now()}`;
    const commonRoom = new CommonRoomPage(gmPage);
    await commonRoom.goto(gameId);
    await expect(commonRoom.heading).toBeVisible({ timeout: 5000 });
    await commonRoom.createPost(postContent);
  } finally {
    await gmContext.close();
  }

  // Player 2 adds a comment so Player 1 has something to mark as read
  const p2Context = await browser.newContext();
  const p2Page = await p2Context.newPage();
  try {
    await loginAs(p2Page, 'PLAYER_2');
    const commonRoom = new CommonRoomPage(p2Page);
    await commonRoom.goto(gameId);
    await expect(commonRoom.heading).toBeVisible({ timeout: 5000 });
    await commonRoom.addComment(postContent, 'Comment for Player 1 to mark as read');
  } finally {
    await p2Context.close();
  }

  return { gameId, postContent };
}

test.describe('Manual Comment Read Tracking', () => {
  test.beforeAll(async ({ browser }) => {
    const result = await setupSharedPost(browser);
    sharedGameId = result.gameId;
    sharedPostContent = result.postContent;
  });

  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'PLAYER_1');
    const settingsPage = new SettingsPage(page);
    await settingsPage.goto();
    await settingsPage.clickReadingSection();
    await settingsPage.selectCommentReadMode('manual');
  });

  test.afterEach(async ({ page }) => {
    const settingsPage = new SettingsPage(page);
    await settingsPage.goto();
    await settingsPage.clickReadingSection();
    await settingsPage.selectCommentReadMode('auto');
  });

  test('Read button appears in manual mode and toggles to Unread when clicked', async ({ page }) => {
    const commonRoom = new CommonRoomPage(page);
    await commonRoom.goto(sharedGameId);

    const postCard = commonRoom.getPostCard(sharedPostContent);
    const commentsButton = postCard.locator('button').filter({ hasText: /Show Comments/ }).locator('visible=true').first();
    if (await commentsButton.isVisible().catch(() => false)) {
      await commentsButton.click();
      await page.waitForLoadState('networkidle');
    }

    const readButton = postCard.locator('[data-testid="toggle-read-button"]').first();
    await expect(readButton).toBeVisible({ timeout: 5000 });
    await expect(readButton).toHaveText('Read');

    await readButton.click();
    await page.waitForLoadState('networkidle');
    await expect(readButton).toHaveText('Unread', { timeout: 5000 });

    // Reset read state so subsequent tests start with an unread comment
    await readButton.click();
    await page.waitForLoadState('networkidle');
    await expect(readButton).toHaveText('Read', { timeout: 5000 });
  });

  test('Read state persists after page reload', async ({ page }) => {
    const commonRoom = new CommonRoomPage(page);
    await commonRoom.goto(sharedGameId);

    const postCard = commonRoom.getPostCard(sharedPostContent);
    const commentsButton = postCard.locator('button').filter({ hasText: /Show Comments/ }).locator('visible=true').first();
    if (await commentsButton.isVisible().catch(() => false)) {
      await commentsButton.click();
      await page.waitForLoadState('networkidle');
    }

    const readButton = postCard.locator('[data-testid="toggle-read-button"]').first();
    await expect(readButton).toBeVisible({ timeout: 5000 });
    await readButton.click();
    await expect(readButton).toHaveText('Unread', { timeout: 5000 });

    // Reload and verify state persisted server-side
    await commonRoom.goto(sharedGameId);
    const reloadedPostCard = commonRoom.getPostCard(sharedPostContent);
    const reloadedCommentsButton = reloadedPostCard.locator('button').filter({ hasText: /Show Comments/ }).locator('visible=true').first();
    if (await reloadedCommentsButton.isVisible().catch(() => false)) {
      await reloadedCommentsButton.click();
      await page.waitForLoadState('networkidle');
    }

    const reloadedReadButton = reloadedPostCard.locator('[data-testid="toggle-read-button"]').first();
    await expect(reloadedReadButton).toBeVisible({ timeout: 5000 });
    await expect(reloadedReadButton).toHaveText('Unread');

    // Reset read state for subsequent tests
    await reloadedReadButton.click();
    await page.waitForLoadState('networkidle');
    await expect(reloadedReadButton).toHaveText('Read', { timeout: 5000 });
  });

  test('Read button is absent in auto mode', async ({ page }) => {
    // Override: switch back to auto for this test only
    const settingsPage = new SettingsPage(page);
    await settingsPage.goto();
    await settingsPage.clickReadingSection();
    await settingsPage.selectCommentReadMode('auto');

    const commonRoom = new CommonRoomPage(page);
    await commonRoom.goto(sharedGameId);

    const postCard = commonRoom.getPostCard(sharedPostContent);
    const commentsButton = postCard.locator('button').filter({ hasText: /Show Comments/ }).locator('visible=true').first();
    if (await commentsButton.isVisible().catch(() => false)) {
      await commentsButton.click();
      await page.waitForLoadState('networkidle');
    }

    const readButtons = postCard.locator('[data-testid="toggle-read-button"]');
    await expect(readButtons).toHaveCount(0);
  });

  test('Read button is absent in history (read-only) view', async ({ page }) => {
    const gameId = await getFixtureGameId(page, 'E2E_ACTION');
    const historyPage = new HistoryPage(page, gameId);
    await historyPage.goto();
    await historyPage.verifyOnPage();
    await historyPage.viewPhaseDetails('Discussion Phase');

    const readButtons = page.locator('[data-testid="toggle-read-button"]');
    await expect(readButtons).toHaveCount(0);
  });

  test('Can mark comment as read from New Comments page', async ({ page }) => {
    // Player 2's comment from beforeAll setup will appear in Player 1's Recent Comments feed
    await page.goto(`/games/${sharedGameId}?tab=common-room&view=newComments`);
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('h3:has-text("Recent Comments")', { timeout: 10000 });

    const readButton = page.locator('[data-testid="toggle-read-button"]').first();
    await expect(readButton).toBeVisible({ timeout: 10000 });
    await expect(readButton).toHaveText('Read');

    await readButton.click();
    await page.waitForLoadState('networkidle');
    await expect(readButton).toHaveText('Unread', { timeout: 5000 });

    // Reset read state for subsequent tests
    await readButton.click();
    await page.waitForLoadState('networkidle');
    await expect(readButton).toHaveText('Read', { timeout: 5000 });
  });
});
