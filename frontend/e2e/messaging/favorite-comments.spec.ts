import { test, expect } from '@playwright/test';
import { loginAs } from '../fixtures/auth-helpers';
import { CommonRoomPage } from '../pages/CommonRoomPage';
import { getFixtureGameId } from '../fixtures/game-helpers';

/**
 * Private Comment Favorites E2E Tests
 *
 * Covers the one path no lower test can: a star clicked in the common room
 * reaching a different page, in a different route tree, through the real API.
 *
 * Deliberately NOT covered here (component tests already do, and doing it in a
 * browser would only make the suite slower and flakier):
 * - The star's rendering on each of the three surfaces
 * - Which comments show a star (posts do not, deleted comments do not)
 * - The allowFavoriting={false} opt-out
 * - The favorites page's empty, loading and error states
 * - The undo affordance's dimmed-card behaviour
 *
 * Fixture used:
 *   FAVORITE_COMMENTS (#707) — an active phase whose post 'Favorites Test
 *   Post' has two Player 2 comments (Player 1 stars one and leaves the other
 *   alone), plus an earlier closed phase reachable only from the History tab.
 */

const FIXTURE_POST = 'Favorites Test Post';
const STARRED_COMMENT = 'The comment Player 1 will star';
const UNSTARRED_COMMENT = 'The comment Player 1 will leave alone';
const ARCHIVED_PHASE = 'Archived Discussion';
const ARCHIVED_COMMENT = 'The archived comment Player 1 will star from history';

/**
 * Return the fixture comment's star button, with comments expanded.
 *
 * Scoped to the threaded comment rather than taking `.first()` on the page:
 * the fixture has two comments, and a page-wide first() would silently star
 * whichever happened to render first.
 */
function starFor(page: import('@playwright/test').Page, commentText: string) {
  return page
    .locator('[data-testid="threaded-comment"]')
    .filter({ hasText: commentText })
    .locator('visible=true')
    .first()
    .locator('[data-testid="favorite-button"]')
    .first();
}

test.describe('Private Comment Favorites', () => {
  let gameId: number;

  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'PLAYER_1');
    gameId = await getFixtureGameId(page, 'FAVORITE_COMMENTS');

    // Favorites persist server-side, so a previous run (or a failure partway
    // through) can leave the fixture comment starred. Clear the slate through
    // the UI so each test starts from "nothing is favorited".
    await page.goto('/favorites');
    await page.waitForLoadState('networkidle');
    const stars = page.locator('[data-testid="favorite-button"]');
    for (let remaining = await stars.count(); remaining > 0; remaining--) {
      await stars.first().click();
      await page.waitForLoadState('networkidle');
    }
  });

  test('star a comment in the common room, find it on /favorites, unfavorite it there', async ({ page }) => {
    const commonRoom = new CommonRoomPage(page);
    await commonRoom.goto(gameId);
    await commonRoom.expandComments(FIXTURE_POST);

    // 1. Star it. aria-pressed is the button's own record of state, so
    //    asserting on it proves the click registered rather than just fired.
    const star = starFor(page, STARRED_COMMENT);
    await expect(star).toBeVisible({ timeout: 10000 });
    await expect(star).toHaveAttribute('aria-pressed', 'false');
    await star.click();
    await expect(star).toHaveAttribute('aria-pressed', 'true', { timeout: 5000 });

    // 2. Reach the page the way a user does — through the navbar dropdown,
    //    not a page.goto. A working feature behind an unreachable link is the
    //    failure this step exists to catch.
    const userMenu = page.getByRole('button', { name: /^TestPlayer/ }).first();
    await userMenu.click();
    await expect(userMenu).toHaveAttribute('aria-expanded', 'true');
    // Scoped to the navbar: a character called "Favorites GM" also renders a
    // link on this page, and an unscoped name match happily clicks that one.
    await page.getByRole('navigation').getByRole('link', { name: 'Favorites' }).click();
    await page.waitForURL('**/favorites');
    await page.waitForLoadState('networkidle');

    const card = page.locator('[data-testid="favorite-comment-card"]');
    await expect(card).toHaveCount(1, { timeout: 10000 });
    await expect(card).toContainText(STARRED_COMMENT);
    // The game title is what makes a cross-game list legible; assert the card
    // carries it, since nothing else on this page supplies that context.
    await expect(card).toContainText('E2E Test: Favorite Comments');
    // Starring one comment must not sweep in its neighbour.
    await expect(page.getByText(UNSTARRED_COMMENT)).toHaveCount(0);

    // 3. Unfavorite from the page itself and confirm the server agrees. The
    //    card stays on screen (dimmed) as the undo affordance, so a reload is
    //    what distinguishes "removed" from "still there but faded".
    await card.locator('[data-testid="favorite-button"]').click();
    await page.waitForLoadState('networkidle');
    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect(page.locator('[data-testid="favorite-comment-card"]')).toHaveCount(0, { timeout: 10000 });
    await expect(page.getByText('No favorites yet')).toBeVisible();
  });

  test('a comment starred in the common room shows as starred on the New Comments tab', async ({ page }) => {
    const commonRoom = new CommonRoomPage(page);
    await commonRoom.goto(gameId);
    await commonRoom.expandComments(FIXTURE_POST);

    const star = starFor(page, STARRED_COMMENT);
    await expect(star).toBeVisible({ timeout: 10000 });
    await star.click();
    await expect(star).toHaveAttribute('aria-pressed', 'true', { timeout: 5000 });

    // Different component, different query, same underlying favorite. This is
    // the shared-state path: both surfaces read the per-game id set, so a star
    // set on one must already be lit on the other with no further action.
    await page.goto(`/games/${gameId}?tab=common-room&view=newComments`);
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('h3:has-text("Recent Comments")', { timeout: 10000 });

    const starredCard = page
      .locator('[data-testid="comment-with-parent-card"]')
      .filter({ hasText: STARRED_COMMENT })
      .locator('visible=true')
      .first();
    await expect(starredCard.locator('[data-testid="favorite-button"]'))
      .toHaveAttribute('aria-pressed', 'true', { timeout: 10000 });

    // The comment left alone must read as unstarred here too, otherwise the
    // assertion above would pass against a button stuck in the "on" state.
    const untouchedCard = page
      .locator('[data-testid="comment-with-parent-card"]')
      .filter({ hasText: UNSTARRED_COMMENT })
      .locator('visible=true')
      .first();
    await expect(untouchedCard.locator('[data-testid="favorite-button"]'))
      .toHaveAttribute('aria-pressed', 'false');
  });

  test('star a comment in a closed phase from the History tab', async ({ page }) => {
    // The History tab renders the common room readOnly. That correctly stops
    // replying, editing and deleting -- but a favorite is the viewer's own
    // private row, and a finished discussion is exactly when someone goes back
    // to collect the good bits. Only a browser can prove the star survives the
    // readOnly path *and* still reaches /favorites.
    await page.goto(`/games/${gameId}?tab=history`);
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: new RegExp(ARCHIVED_PHASE) }).click();
    await page.waitForLoadState('networkidle');

    const commonRoomPage = new CommonRoomPage(page, gameId);
    await commonRoomPage.expandComments();

    const star = starFor(page, ARCHIVED_COMMENT);
    await expect(star).toBeVisible({ timeout: 10000 });
    await expect(star).toHaveAttribute('aria-pressed', 'false');

    // Replying stays closed here. Asserting this alongside the star is the
    // point: the fix must open up favoriting *without* reopening writes to
    // the conversation itself.
    await expect(
      page.getByRole('button', { name: /^Reply$/ })
    ).toHaveCount(0);

    await star.click();
    await expect(star).toHaveAttribute('aria-pressed', 'true', { timeout: 5000 });

    await page.goto('/favorites');
    await page.waitForLoadState('networkidle');

    const card = page
      .locator('[data-testid="favorite-comment-card"]')
      .filter({ hasText: ARCHIVED_COMMENT });
    await expect(card).toHaveCount(1, { timeout: 10000 });
  });
});
