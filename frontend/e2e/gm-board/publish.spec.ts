import { test, expect } from '@playwright/test';
import { loginAs } from '../fixtures/auth-helpers';
import { getFixtureGameId } from '../fixtures/game-helpers';
import {
  arrangeBoard,
  boardPhaseId,
  characterIds,
  createDraftResult,
  runTag,
  sheetNumber,
} from '../fixtures/gm-board-helpers';
import { GmBoardPage } from '../pages/GmBoardPage';
import { API, clickAndWaitForMutation } from '../utils/waits';

/**
 * Publishing from the board, end to end: a reward given on the board turns
 * into sheet drafts on the result (written by the board through
 * reward-sheet-updates), the board publishes through the same endpoint and
 * dialog as the results area, and the player reads the result and has the
 * sheet change. Each layer is tested on its own (rewards.test.ts for the
 * sheet maths, the reward-sheet-updates handler tests, ResultChainCard's
 * component test); only this sees them hand over to each other.
 *
 * Fixture: RESULTS_BOARD_PUBLISH (#717). Publishing can't be undone, so the
 * test publishes only a result it wrote (named with a run tag), clears
 * Silk's reward lines first, and compares the sheet with what it was at the
 * start rather than with the fixture's value.
 */
test.describe('GM results board: publishing', () => {
  test('a reward given on the board reaches the player’s sheet when the result is published', async ({ page }, testInfo) => {
    await loginAs(page, 'GM');
    const gameId = await getFixtureGameId(page, 'RESULTS_BOARD_PUBLISH');
    const phaseId = await boardPhaseId(page, gameId);
    const silk = (await characterIds(page, gameId))['Silk (Spider)'];
    const text = `${runTag(testInfo)}: The manager never feels the key leave his waistcoat.`;

    // Silk starts with no reward lines, and with one draft: this test's.
    await arrangeBoard(page, gameId, phaseId, [{ kind: 'rewards', key: String(silk), doc: { lines: [], texts: {} } }]);
    const resultId = await createDraftResult(page, gameId, 'Silk (Spider)', text);
    const coinBefore = await sheetNumber(page, silk, 'Coin');
    expect(coinBefore).toBeDefined();

    const board = new GmBoardPage(page, gameId, phaseId);
    await board.open({ step: 'write', who: silk });
    const chain = page.getByTestId(`result-chain-${resultId}`);
    await expect(chain).toContainText(text);

    // "Clean job" adds 2 Coin. The board writes the sheet drafts onto the
    // result that carries Silk's changes: this one, her only draft.
    await board.resultTab('Rewards');
    await clickAndWaitForMutation(page, page.getByTestId('give-rw-heist-clean'), API.saveRewardSheetUpdates);
    await board.resultTab('Result');
    await expect(page.getByTestId(`board-draft-update-count-${resultId}`)).toBeVisible();

    await chain.getByRole('button', { name: 'Publish', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Publish Action Result?' });
    await clickAndWaitForMutation(page, dialog.getByRole('button', { name: 'Publish', exact: true }), API.publishResult);
    await expect(chain).toContainText('Published');

    // Silk's player reads it, and the sheet has the 2 Coin.
    await loginAs(page, 'PLAYER_4');
    await page.goto(`/games/${gameId}?tab=actions`);
    await expect(page.getByText(text).first()).toBeVisible();
    expect(await sheetNumber(page, silk, 'Coin')).toBe((coinBefore ?? 0) + 2);
  });
});
