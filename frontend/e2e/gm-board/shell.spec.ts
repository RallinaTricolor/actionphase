import { test, expect } from '@playwright/test';
import { loginAs } from '../fixtures/auth-helpers';
import { getFixtureGameId } from '../fixtures/game-helpers';
import { boardPhaseId, characterIds } from '../fixtures/gm-board-helpers';
import { GmBoardPage } from '../pages/GmBoardPage';
import { isMobileViewport } from '../utils/viewport';

/**
 * The board's shell: how a GM gets there, what the address keeps (step,
 * reader, scene), the browser's Back button, and the 1024px floor. Nothing
 * here writes.
 *
 * Fixtures: RESULTS_BOARD_GM (#711) for the GM, RESULTS_BOARD_SHARED (#712)
 * for the audience on a phone.
 */
test.describe('GM results board: shell', () => {
  test('the GM opens the board from the results area, on the first submission', async ({ page }) => {
    await loginAs(page, 'GM');
    const gameId = await getFixtureGameId(page, 'RESULTS_BOARD_GM');

    await page.goto(`/games/${gameId}?tab=actions`);
    await page.getByTestId('open-results-board').click();
    await expect(page.getByTestId('gm-board-step-read')).toBeVisible();
    // Submitters are in name order, so Rook's comes first.
    await expect(page.getByTestId('submission-text')).toContainText('sniper position');
  });

  test('the address holds the step, the reader and the scene, and Back walks through them', async ({ page }) => {
    await loginAs(page, 'GM');
    const gameId = await getFixtureGameId(page, 'RESULTS_BOARD_GM');
    const board = new GmBoardPage(page, gameId, await boardPhaseId(page, gameId));
    const silk = (await characterIds(page, gameId))['Silk (Spider)'];

    // A deep link to a reader opens their submission.
    await board.open({ who: silk });
    await expect(page.getByTestId('submission-text')).toContainText('Lady Ashworth');

    // A deep link to a scene opens it.
    await board.open({ step: 'scenes', scene: 'scene-heist-lobby' });
    await expect(page.getByRole('combobox', { name: 'Go to a scene' })).toHaveValue('scene-heist-lobby');

    await board.goToStep('map');
    await expect(page).toHaveURL(/[?&]step=map/);
    await board.goToStep('write');

    await page.goBack();
    await board.waitForLoaded('map');
    await page.goBack();
    await board.waitForLoaded('scenes');
    await expect(page.getByRole('combobox', { name: 'Go to a scene' })).toHaveValue('scene-heist-lobby');
  });

  test('below 1024px wide the board says it needs a wider screen; at 1024px it opens', async ({ page }) => {
    await loginAs(page, 'GM');
    const gameId = await getFixtureGameId(page, 'RESULTS_BOARD_GM');
    const board = new GmBoardPage(page, gameId, await boardPhaseId(page, gameId));

    await page.setViewportSize({ width: 1023, height: 768 });
    await page.goto(board.url());
    const notice = page.getByTestId('gm-board-notice');
    await expect(notice).toContainText('The results board needs a wider screen');
    await expect(notice).toContainText('You can still write results from the results area.');
    await expect(page.getByTestId('gm-board')).toHaveCount(0);

    await page.setViewportSize({ width: 1024, height: 768 });
    await board.waitForLoaded('read');
    await expect(notice).toHaveCount(0);
  });

  test('@mobile on a phone, History offers no board, and the board’s address says why', async ({ page }) => {
    test.skip(!isMobileViewport(page), 'Phones only: the desktop width floor is the 1023px test');
    await loginAs(page, 'AUDIENCE');
    const gameId = await getFixtureGameId(page, 'RESULTS_BOARD_SHARED');
    const phaseId = await boardPhaseId(page, gameId);

    await page.goto(`/games/${gameId}?tab=history&phase=${phaseId}`);
    await expect(page.getByText('Execute the Plan').first()).toBeVisible();
    // The shared board's button is there, but hidden below 1024px, like the board.
    await expect(page.getByTestId('view-results-board')).toBeAttached();
    await expect(page.getByTestId('view-results-board')).toBeHidden();

    await page.goto(`/games/${gameId}/phases/${phaseId}/board`);
    await expect(page.getByTestId('gm-board-notice')).toContainText('You can still read the results in the History tab.');
  });
});
