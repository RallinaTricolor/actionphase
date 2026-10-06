import { test, expect, type Browser, type Page } from '@playwright/test';
import { loginAs } from '../fixtures/auth-helpers';
import { getFixtureGameId } from '../fixtures/game-helpers';
import { CommonRoomPage } from '../pages/CommonRoomPage';

/**
 * Restricted Common Room Posts E2E Tests
 *
 * Covers what no lower test can: a restriction set in the GM's browser going
 * through the real API and deciding what other players' browsers render.
 *
 * Deliberately NOT covered here (handler and component tests already do):
 * - Every read gate answering a hidden ID like a missing one
 * - Who sees the viewer names and the edit action, role by role
 * - The modal's warning copy, departed players, validation and error paths
 * - Notifications for restricted posts
 *
 * Each test logs every user in exactly once, in their own browser context:
 * repeated logout/login inside a test is the flaky part of multi-user specs.
 *
 * Fixtures (33_restricted_posts.sql), both with TestGM, Player 1 ("Ivy
 * Insider") and Player 2 ("Oscar Outsider"):
 *   RESTRICTED_POSTS_GM (#708)         - empty room; the GM test writes here
 *   RESTRICTED_POSTS_VISIBILITY (#709) - read-only: "A post for everyone",
 *     and "A post for Ivy only" restricted to Player 1 with her comment
 */

const IVY = 'Ivy Insider';
const OSCAR = 'Oscar Outsider';

const PUBLIC_POST = 'A post for everyone';
const RESTRICTED_POST = 'A post for Ivy only';
const IVY_COMMENT = 'Ivy replies where Oscar cannot see';

async function newUserPage(browser: Browser, user: 'PLAYER_1' | 'PLAYER_2') {
  const context = await browser.newContext();
  const page = await context.newPage();
  await loginAs(page, user);
  return { context, page };
}

/** The ID of Ivy's comment, read through the API as a user who can see it. */
async function getIvyCommentId(page: Page, gameId: number): Promise<number> {
  return page.evaluate(
    async ({ gid, postContent, commentContent }) => {
      const postsResp = await fetch(`/api/v1/games/${gid}/posts`, { credentials: 'include' });
      if (!postsResp.ok) throw new Error(`Failed to fetch posts: ${postsResp.status}`);
      const posts: Array<{ id: number; content: string }> = await postsResp.json();
      const post = posts.find((p) => p.content === postContent);
      if (!post) throw new Error(`"${postContent}" not found in the restricted-posts fixture`);

      const commentsResp = await fetch(
        `/api/v1/games/${gid}/posts/${post.id}/comments-with-threads?limit=100`,
        { credentials: 'include' }
      );
      if (!commentsResp.ok) throw new Error(`Failed to fetch comments: ${commentsResp.status}`);
      const data = await commentsResp.json();
      const comments: Array<{ id: number; content: string }> = data.comments ?? data;
      const comment = comments.find((c) => c.content === commentContent);
      if (!comment) throw new Error(`"${commentContent}" not found in the restricted-posts fixture`);
      return comment.id;
    },
    { gid: gameId, postContent: RESTRICTED_POST, commentContent: IVY_COMMENT }
  );
}

test.describe('Restricted Common Room posts', () => {
  test('GM restricts a new post to one player, then adds another', async ({ page }) => {
    await loginAs(page, 'GM');
    const gameId = await getFixtureGameId(page, 'RESTRICTED_POSTS_GM');
    const commonRoom = new CommonRoomPage(page);
    await commonRoom.goto(gameId);

    // Unique per run: a retry against the same fixture must not match an
    // earlier attempt's post.
    const content = `Restricted briefing ${Date.now()}`;
    await commonRoom.createPost(content, undefined, { visibleTo: [IVY] });

    const restriction = commonRoom.getPostRestriction(content);
    await expect(restriction.getByTestId('restricted-badge')).toHaveText('Restricted');
    await expect(restriction.getByTestId('post-viewer-names')).toHaveText(`Visible to ${IVY}`);

    // Widen it through the modal.
    await restriction.getByTestId('edit-post-viewers').click();
    const modal = page.getByTestId('post-viewers-modal');
    await expect(modal).toBeVisible();
    await expect(modal.getByLabel(IVY, { exact: true })).toBeChecked();
    await commonRoom.restrictTo(modal, [OSCAR]);
    await modal.getByTestId('save-post-viewers').click();
    await expect(modal).toBeHidden();

    await expect(restriction.getByTestId('post-viewer-names')).toContainText(IVY);
    await expect(restriction.getByTestId('post-viewer-names')).toContainText(OSCAR);

    // The card updates from the response; a reload proves the server kept it.
    await page.reload();
    await page.waitForLoadState('networkidle');
    const reloaded = commonRoom.getPostRestriction(content);
    await expect(reloaded.getByTestId('restricted-badge')).toBeVisible({ timeout: 10000 });
    await expect(reloaded.getByTestId('post-viewer-names')).toContainText(IVY);
    await expect(reloaded.getByTestId('post-viewer-names')).toContainText(OSCAR);
  });

  test('a listed player sees the post and its comments; an unlisted player sees neither', async ({ browser }) => {
    const ivy = await newUserPage(browser, 'PLAYER_1');
    const oscar = await newUserPage(browser, 'PLAYER_2');

    try {
      // --- Player 1: on the list ---
      const gameId = await getFixtureGameId(ivy.page, 'RESTRICTED_POSTS_VISIBILITY');
      const ivyRoom = new CommonRoomPage(ivy.page);
      await ivyRoom.goto(gameId);

      await ivyRoom.verifyPostExists(PUBLIC_POST);
      await ivyRoom.verifyPostExists(RESTRICTED_POST);
      const restriction = ivyRoom.getPostRestriction(RESTRICTED_POST);
      await expect(restriction.getByTestId('restricted-badge')).toHaveText('Restricted');
      // A listed player learns it's restricted, not who else can see it, and
      // can't change it.
      await expect(restriction.getByTestId('post-viewer-names')).toHaveCount(0);
      await expect(restriction.getByTestId('edit-post-viewers')).toHaveCount(0);

      await ivyRoom.expandComments(RESTRICTED_POST);
      await ivyRoom.verifyCommentExists(IVY_COMMENT);

      const hiddenCommentId = await getIvyCommentId(ivy.page, gameId);

      // --- Player 2: not on the list ---
      const oscarRoom = new CommonRoomPage(oscar.page);
      await oscarRoom.goto(gameId);

      // The public post proves the room loaded, so the absences below mean
      // "hidden", not "not rendered yet".
      await oscarRoom.verifyPostExists(PUBLIC_POST);
      await expect(oscar.page.getByText(RESTRICTED_POST)).toHaveCount(0);
      await expect(oscar.page.getByText(IVY_COMMENT)).toHaveCount(0);

      // A deep link to the hidden comment (as a stale notification would
      // carry) gets the same notice as a deleted comment, over a usable room.
      await oscar.page.goto(`/games/${gameId}?tab=common-room&comment=${hiddenCommentId}`);
      await expect(oscar.page.getByTestId('deep-link-not-found')).toBeVisible({ timeout: 10000 });
      await oscarRoom.verifyPostExists(PUBLIC_POST);
      await expect(oscar.page.getByText(IVY_COMMENT)).toHaveCount(0);
    } finally {
      await ivy.context.close();
      await oscar.context.close();
    }
  });
});
