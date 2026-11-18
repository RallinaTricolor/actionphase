import { test, expect } from '@playwright/test';
import { loginAs } from '../fixtures/auth-helpers';
import { getFixtureGameId } from '../fixtures/game-helpers';
import { boardPhaseId, setBoardSharing } from '../fixtures/gm-board-helpers';
import { GmBoardPage } from '../pages/GmBoardPage';
import { API, performAndWaitForMutation } from '../utils/waits';

/**
 * Who else sees the board: the audience while the GM shares it, and anyone
 * once a shared game is an archive. Read-only mode itself (no enabled field
 * or edit control in any step) is covered by GmBoardReadOnly.test.tsx, and
 * the endpoints' refusals role by role by the handler tests; these check the
 * sharing setting decides what another user's browser actually gets.
 *
 * Desktop only: the board needs a screen at least 1024px wide.
 *
 * Fixtures:
 *   RESULTS_BOARD_SHARED (#712)  - shared, running (READ-ONLY)
 *   RESULTS_BOARD_GM (#711)      - not shared, running (read here, not written)
 *   RESULTS_BOARD_SHARING (#719) - the GM turns sharing off; each test turns it back on first
 *   RESULTS_BOARD_ARCHIVE (#720) - completed and shared; TestPlayer5 isn't a member
 */
test.describe('GM results board: sharing', () => {
  test('the audience follows a shared board read-only, and is told when a board is not shared', async ({ page }) => {
    await loginAs(page, 'AUDIENCE');
    const sharedId = await getFixtureGameId(page, 'RESULTS_BOARD_SHARED');
    const unsharedId = await getFixtureGameId(page, 'RESULTS_BOARD_GM');

    // Shared: History offers the board, and it opens read-only.
    const sharedPhase = await boardPhaseId(page, sharedId);
    await page.goto(`/games/${sharedId}?tab=history&phase=${sharedPhase}`);
    await page.getByTestId('view-results-board').click();
    await expect(page.getByTestId('gm-board-read-only')).toBeVisible();
    await expect(page.getByTestId('submission-text')).toContainText('sniper position');
    await expect(page.getByRole('button', { name: 'Done reading → next' })).toHaveCount(0);

    // Not shared: no link in History, and the board's address says why.
    const unsharedPhase = await boardPhaseId(page, unsharedId);
    await page.goto(`/games/${unsharedId}?tab=history&phase=${unsharedPhase}`);
    await expect(page.getByText('Execute the Plan').first()).toBeVisible();
    await expect(page.getByTestId('view-results-board')).toHaveCount(0);
    await page.goto(`/games/${unsharedId}/phases/${unsharedPhase}/board`);
    await expect(page.getByTestId('gm-board-notice')).toContainText('Not shared');
  });

  test('when the GM stops sharing, an audience member’s open board says so at its next poll', async ({ browser }) => {
    const gmContext = await browser.newContext();
    const viewerContext = await browser.newContext();
    try {
      const gm = await gmContext.newPage();
      await loginAs(gm, 'GM');
      const gameId = await getFixtureGameId(gm, 'RESULTS_BOARD_SHARING');
      // A retry starts shared, whatever the last attempt left.
      await setBoardSharing(gm, gameId, true);

      const viewer = await viewerContext.newPage();
      await loginAs(viewer, 'AUDIENCE');
      await viewer.clock.install();
      const board = new GmBoardPage(viewer, gameId, await boardPhaseId(viewer, gameId));
      await board.open({ step: 'map' });
      await expect(viewer.getByTestId('gm-board-read-only')).toBeVisible();

      // The GM turns it off on Game setup.
      await gm.goto(`/games/${gameId}/board-setup`);
      const share = gm.getByRole('switch', { name: 'Share the results board' });
      await expect(share).toHaveAttribute('aria-checked', 'true');
      await performAndWaitForMutation(gm, () => share.click(), API.setBoardSharing);
      await expect(share).toHaveAttribute('aria-checked', 'false');

      // The viewer's board is still up until it next asks the server.
      await expect(viewer.getByTestId('gm-board')).toBeVisible();
      await board.nextPoll();
      await expect(viewer.getByTestId('gm-board-not-shared')).toContainText('This board is no longer shared');
      await expect(viewer.getByTestId('gm-board')).toHaveCount(0);
    } finally {
      await gmContext.close();
      await viewerContext.close();
    }
  });

  test('once a shared game is completed, anyone can read its board, and its GM sees it read-only too', async ({ page }) => {
    // TestPlayer5 has no part in this game: it's a public archive.
    await loginAs(page, 'PLAYER_5');
    const gameId = await getFixtureGameId(page, 'RESULTS_BOARD_ARCHIVE');
    const phaseId = await boardPhaseId(page, gameId);

    await page.goto(`/games/${gameId}?tab=history&phase=${phaseId}`);
    await page.getByTestId('view-results-board').click();
    const board = new GmBoardPage(page, gameId, phaseId);
    await board.waitForLoaded('read');
    await expect(page.getByTestId('gm-board-read-only')).toBeVisible();
    await expect(page.getByTestId('submission-text')).toContainText('sniper position');
    await board.goToStep('map');
    await expect(board.mapCard('card-heist-rook-rifle')).toBeVisible();

    // The game's own GM can't change a finished game's board either.
    await loginAs(page, 'GM');
    await board.open({ step: 'map' });
    await expect(page.getByTestId('gm-board-read-only')).toBeVisible();
    await expect(board.mapCard('card-heist-rook-rifle')).not.toHaveAttribute('draggable', 'true');
    await expect(board.saveStatus).toHaveCount(0);
  });
});
