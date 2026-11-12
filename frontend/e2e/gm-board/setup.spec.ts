import { test, expect, type Page } from '@playwright/test';
import { loginAs } from '../fixtures/auth-helpers';
import { getFixtureGameId } from '../fixtures/game-helpers';
import {
  arrangeBoard,
  arrangeSettings,
  boardItems,
  boardPhaseId,
  characterIds,
  runTag,
  settingsItems,
} from '../fixtures/gm-board-helpers';
import { GmBoardPage } from '../pages/GmBoardPage';
import { API, performAndWaitForMutation } from '../utils/waits';

/**
 * A game's first board: the first-run guide, the codex that gives the Map
 * its rows, and Game setup's reward lists feeding Write. The codex and list
 * editors are component tested (GmCodexManager, GmRewardSetup); these check
 * that what setup saves reaches the board's other steps through the real
 * settings endpoints.
 *
 * Fixture: RESULTS_BOARD_EMPTY (#721), an action phase with submissions, no
 * board and no codex. Each test first deletes what an earlier test or
 * attempt left there, so it starts from the empty board.
 */

let board: GmBoardPage;

/** Back to nothing: no codex entries or reward items, and an empty board. */
async function emptyTheGame(page: Page) {
  const settings = await settingsItems(page, board.gameId);
  await arrangeSettings(
    page,
    board.gameId,
    settings.filter((i) => i.kind === 'codex' || i.kind === 'reward').map((i) => ({ kind: i.kind, key: i.key, deleted: true })),
  );
  const items = await boardItems(page, board.gameId, board.phaseId);
  await arrangeBoard(page, board.gameId, board.phaseId, items.map((i) => ({ kind: i.kind, key: i.key, deleted: true })));
}

test.describe('GM results board: setup', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'GM');
    const gameId = await getFixtureGameId(page, 'RESULTS_BOARD_EMPTY');
    board = new GmBoardPage(page, gameId, await boardPhaseId(page, gameId));
    await emptyTheGame(page);
  });

  test('the first-run guide asks for a location, and the one added becomes a row on the Map', async ({ page }, testInfo) => {
    const place = `Counting House ${runTag(testInfo)}`;
    await board.open();

    const guide = page.getByTestId('gm-board-first-run');
    await expect(guide).toBeVisible();
    await expect(guide).toContainText('This phase has no locations yet');

    await guide.getByRole('button', { name: 'Add locations in the codex' }).click();
    const codex = page.getByTestId('gm-codex');
    await codex.getByLabel('Type').first().selectOption('Location');
    await codex.getByRole('textbox', { name: 'Name' }).first().fill(place);
    await performAndWaitForMutation(page, () => codex.getByRole('button', { name: 'Add to codex' }).click(), API.saveBoardSettings);

    // The guide stays (nothing is on the board yet) but stops asking.
    await page.keyboard.press('Escape');
    await expect(guide).toBeVisible();
    await expect(guide).not.toContainText('This phase has no locations yet');

    // The Map has its row; it asks for time slots before it can draw cells.
    const location = (await settingsItems(page, board.gameId)).find(
      (i) => i.kind === 'codex' && (i.doc as { name: string }).name === place,
    );
    expect(location).toBeDefined();
    await board.goToStep('map');
    await board.saving(() => page.getByRole('button', { name: 'Add Pre-Scenario and Slots 1–3' }).click());
    await expect(page.getByTestId('map-by-location')).toContainText(place);
    await expect(board.cell(location!.key, 'pre')).toBeVisible();
  });

  test('a reward added to the every-phase list on Game setup is offered in Write', async ({ page }, testInfo) => {
    const reward = `Bonus coin ${runTag(testInfo)}`;
    const silk = (await characterIds(page, board.gameId))['Silk (Spider)'];

    await page.goto(`/games/${board.gameId}/board-setup`);
    await page.getByTestId('new-game-reward').click();
    await performAndWaitForMutation(page, () => page.getByTestId('item-name').fill(reward), API.saveBoardSettings);

    await board.open({ step: 'write', who: silk });
    await expect(page.getByTestId('reward-quick-give').getByRole('button', { name: `+ ${reward}` })).toBeVisible();
  });
});
