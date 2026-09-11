import { test, expect } from '@playwright/test';
import { loginAs } from '../fixtures/auth-helpers';
import { getFixtureGameId, getDeepLinkingCommentIds } from '../fixtures/game-helpers';

/**
 * Deep Linking Regression Tests
 *
 * Tests the comment deep linking functionality in Common Room.
 *
 * BACKGROUND:
 * CommonRoom.tsx implements deep linking via URL parameter: ?comment=ID
 * When present, it should:
 * 1. Switch to the 'posts' tab if on a different tab
 * 2. Scroll the comment into view
 * 3. Highlight the comment with a ring for 3 seconds
 * 4. Remove the comment parameter from URL
 *
 * REGRESSION CONTEXT:
 * A mobile support change rendered 2 copies of each comment (one hidden, one visible)
 * with the same ID. This broke scrollIntoView because getElementById() returns the
 * first match, which might be the hidden mobile version on desktop.
 *
 * These tests ensure:
 * - Only ONE element with a given comment ID exists in the DOM at any time
 * - Deep linking scrolls to the VISIBLE comment, not a hidden duplicate
 * - The scroll and highlight functionality works correctly
 *
 * Uses Game #701 (E2E Deep Linking Test) with 7 levels of nested comments.
 */

test.describe('@mobile Deep Linking in Common Room', () => {

  test('should only have ONE element with each comment ID in the DOM (no duplicates)', async ({ page }) => {
    await loginAs(page, 'GM');

    const gameId = await getFixtureGameId(page, 'DEEP_LINKING_TEST');
    await page.goto(`/games/${gameId}?tab=common-room`);
    await page.waitForLoadState('networkidle');

    await page.locator('h2').filter({ hasText: /Common Room/ }).waitFor({ timeout: 10000 });

    const allCommentIds = await page.evaluate(() => {
      const comments = Array.from(document.querySelectorAll('[id^="comment-"]'));
      const idCounts = new Map<string, number>();

      comments.forEach(el => {
        idCounts.set(el.id, (idCounts.get(el.id) || 0) + 1);
      });

      return {
        totalComments: comments.length,
        duplicates: Array.from(idCounts.entries()).filter(([, count]) => count > 1),
      };
    });

    expect(allCommentIds.duplicates).toEqual([]);
    expect(allCommentIds.totalComments).toBeGreaterThan(0);
  });

  test('should scroll to visible comments at shallow and deep levels via ?comment= parameter', async ({ page }) => {
    await loginAs(page, 'GM');

    const gameId = await getFixtureGameId(page, 'DEEP_LINKING_TEST');

    // Navigate once to establish auth context, then fetch IDs via API
    await page.goto(`/games/${gameId}?tab=common-room`);
    await page.waitForLoadState('networkidle');

    const { shallowCommentId, deepCommentId, bulkyCommentId } = await getDeepLinkingCommentIds(page, gameId);

    // Mobile renders fewer nesting levels — deepCommentId (depth 5) is beyond mobile's
    // render cutoff and never appears in the DOM, so only test shallowCommentId on mobile.
    const mobileSelect = page.locator('select#tab-select');
    const isMobile = await mobileSelect.isVisible({ timeout: 2000 }).catch(() => false);
    // bulkyCommentId is the one that matters for the scroll-position assertion
    // below: it is the only fixture comment whose subtree dwarfs the comment.
    const commentIds = isMobile
      ? [shallowCommentId, bulkyCommentId]
      : [shallowCommentId, deepCommentId, bulkyCommentId];

    for (const commentId of commentIds) {
      await page.goto(`/games/${gameId}?tab=common-room&comment=${commentId}`);
      await page.waitForLoadState('networkidle');

      // URL param removed indicates deep-link logic completed
      await expect(page).toHaveURL(new RegExp(`games/${gameId}\\?tab=common-room$`), { timeout: 5000 });

      // Handle -desktop/-mobile suffix IDs from dual DOM rendering
      const comment = page.locator(`#comment-${commentId}`)
        .or(page.locator(`#comment-${commentId}-mobile`))
        .or(page.locator(`#comment-${commentId}-desktop`))
        .locator('visible=true').first();
      await expect(comment).toBeVisible();

      // toBeVisible() is not enough on its own, and that gap is what let a real
      // bug ship: an element scrolled hundreds of pixels outside the window is
      // still "visible" to Playwright. The anchor used to wrap the comment *and*
      // its whole reply subtree, so centering that box left the comment itself
      // off-screen -- worst for shallow comments, which have the most
      // descendants. Assert the geometry the user actually experiences.
      //
      // Wait for the smooth scroll to SETTLE, then assert once on where it came
      // to rest. Polling the assertion itself would be wrong: it passes the
      // moment the element is ever in frame, which a broken scroll can satisfy
      // in passing, so the test would stop detecting the bug it exists for.
      //
      // Measure through the resolved locator, never a fresh getElementById:
      // the dual desktop/mobile render means the same id appears twice, and a
      // by-id lookup returns the hidden copy, silently measuring an element
      // other than the visible one asserted on below.
      const settledY = await comment.evaluate(async (el) => {
        let last = NaN;
        let stableFor = 0;
        // ~3s ceiling; settled means two consecutive identical frames.
        for (let i = 0; i < 180; i++) {
          await new Promise(requestAnimationFrame);
          const y = Math.round(el.getBoundingClientRect().y);
          stableFor = y === last ? stableFor + 1 : 0;
          last = y;
          if (stableFor >= 2) break;
        }
        return last;
      });

      const viewportHeight = page.viewportSize()!.height;
      // The comment's top edge must come to rest inside the viewport. A long
      // comment may still run past the fold on a narrow screen, which is why
      // this checks the top edge rather than requiring the whole box to fit.
      expect(settledY).toBeGreaterThanOrEqual(0);
      expect(settledY).toBeLessThan(viewportHeight);
    }
  });

  test('should switch to posts tab when deep linking from newComments tab', async ({ page }) => {
    await loginAs(page, 'GM');

    const gameId = await getFixtureGameId(page, 'DEEP_LINKING_TEST');

    // Navigate once to establish auth context, then fetch IDs via API
    await page.goto(`/games/${gameId}?tab=common-room`);
    await page.waitForLoadState('networkidle');

    const { shallowCommentId } = await getDeepLinkingCommentIds(page, gameId);

    // Navigate to New Comments tab
    await page.goto(`/games/${gameId}?tab=common-room&view=newComments`);
    await page.waitForLoadState('networkidle');

    const newCommentsButton = page.locator('button').filter({ hasText: /^New Comments$/ });
    await expect(newCommentsButton).toHaveClass(/border-interactive-primary/);

    // Deep link — should switch to Posts tab
    await page.goto(`/games/${gameId}?tab=common-room&comment=${shallowCommentId}`);
    await page.waitForLoadState('networkidle');

    const postsButton = page.locator('button').filter({ hasText: /^Posts$/ });
    await expect(postsButton).toHaveClass(/border-interactive-primary/);

    const comment = page.locator(`#comment-${shallowCommentId}`)
      .or(page.locator(`#comment-${shallowCommentId}-mobile`))
      .or(page.locator(`#comment-${shallowCommentId}-desktop`))
      .locator('visible=true').first();
    await expect(comment).toBeVisible();
  });
});
