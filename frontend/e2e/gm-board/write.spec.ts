import { test, expect } from '@playwright/test';
import { loginAs } from '../fixtures/auth-helpers';
import { getFixtureGameId } from '../fixtures/game-helpers';
import {
  arrangeBoard,
  boardPhaseId,
  characterIds,
  createDraftResult,
  deleteDraftResults,
  runTag,
} from '../fixtures/gm-board-helpers';
import { GameDetailsPage } from '../pages/GameDetailsPage';
import { GmBoardPage } from '../pages/GmBoardPage';
import { API, clickAndWaitForMutation, performAndWaitForMutation } from '../utils/waits';

/**
 * The Write step against the real results endpoints. The board writes
 * results in the same tables as the results area, so a GM can switch
 * between the two at any point (the plan's parity rule); these tests hold
 * that in both directions. Coverage ticks, Ready → next and the leak check
 * are component tested with mocked results (GmBoardWrite.test.tsx); here
 * they run on results the server stored.
 *
 * Fixture: RESULTS_BOARD_WRITE (#715). Tests that need "nothing written
 * yet" delete that character's drafts first; tests that need a result write
 * their own, named with a run tag; tests that use progress set it first.
 */

let board: GmBoardPage;
let cast: Record<string, number>;
let tag: string;

test.beforeEach(async ({ page }, testInfo) => {
  await loginAs(page, 'GM');
  const gameId = await getFixtureGameId(page, 'RESULTS_BOARD_WRITE');
  board = new GmBoardPage(page, gameId, await boardPhaseId(page, gameId));
  cast = await characterIds(page, gameId);
  tag = runTag(testInfo);
});

test.describe('GM results board: Write', () => {
  test('typing for someone with nothing written creates their result, and the results area shows it', async ({ page }) => {
    const rook = cast['Rook (Hound)'];
    await deleteDraftResults(page, board.gameId, board.phaseId, rook);
    const text = `${tag}: From the roof you watch the alley stay empty.`;

    await board.open({ step: 'write', who: rook });
    await performAndWaitForMutation(page, () => page.getByTestId('result-draft').fill(text), API.createResult);
    await expect(page.getByTestId('result-draft-status')).toContainText('Saved');

    await page.reload();
    await board.waitForLoaded('write');
    await expect(page.locator('[data-testid^="result-chain-"]').filter({ hasText: text })).toBeVisible();

    const game = new GameDetailsPage(page);
    await game.goto(board.gameId);
    await game.goToActions();
    await expect(page.getByText(text).first()).toBeVisible();
  });

  test('a draft written in the results area shows on the board', async ({ page }) => {
    const rook = cast['Rook (Hound)'];
    const text = `${tag}: The patrol never comes, and the mirror stays dark.`;
    const game = new GameDetailsPage(page);
    await game.goto(board.gameId);
    await game.goToActions();

    await page.getByTestId('standalone-result-button').click();
    await page.getByTestId('standalone-result-recipient').selectOption(String(rook));
    await page.getByTestId('result-content').fill(text);
    await clickAndWaitForMutation(page, page.getByRole('button', { name: /^Create Draft Result/ }), API.createResult);

    await board.open({ step: 'write', who: rook });
    await expect(page.locator('[data-testid^="result-chain-"]').filter({ hasText: text })).toBeVisible();
  });

  test('Insert puts a moment in the draft and ticks it, and the tick holds after a reload', async ({ page }) => {
    const silk = cast['Silk (Spider)'];
    await deleteDraftResults(page, board.gameId, board.phaseId, silk);
    await arrangeBoard(page, board.gameId, board.phaseId, [{ kind: 'progress', key: String(silk), doc: {} }]);

    await board.open({ step: 'write', who: silk });
    const moment = page.getByTestId('brief-moment-m-heist-l2');
    const tick = moment.getByRole('checkbox', { name: /^Covered in/ });
    await expect(tick).not.toBeChecked();

    await performAndWaitForMutation(page, () => moment.getByRole('button', { name: 'Insert' }).click(), API.createResult);
    await expect(page.getByTestId('result-draft')).toHaveValue(/Inspector Dalton tips his hat/);
    await expect(tick).toBeChecked();
    await expect(page.getByTestId('result-draft-status')).toContainText('Saved');

    await page.reload();
    await board.waitForLoaded('write');
    await expect(page.getByTestId('brief-moment-m-heist-l2').getByRole('checkbox', { name: /^Covered in/ })).toBeChecked();
  });

  test('+ Part adds a timed part to a draft result', async ({ page }) => {
    const vex = cast['Vex (Leech)'];
    const head = `${tag}: The acid eats through the lock.`;
    const part = `${tag}: Then the alarm bell starts to ring.`;
    const headId = await createDraftResult(page, board.gameId, 'Vex (Leech)', head);

    await board.open({ step: 'write', who: vex });
    const chain = page.getByTestId(`result-chain-${headId}`);
    await chain.getByRole('button', { name: '+ Part' }).click();
    await page.getByTestId('new-part-delay').selectOption('30');
    await performAndWaitForMutation(page, () => page.getByTestId('result-draft').fill(part), API.appendResultPart);

    await page.reload();
    await board.waitForLoaded('write');
    await expect(chain.locator('[data-testid^="result-part-"]')).toHaveCount(2);
    await expect(chain).toContainText(part);
    // Stored as a later part of this chain, revealed 30 minutes after the first.
    const stored = await page.evaluate(async ({ gid, headId }) => {
      const res = await fetch(`/api/v1/games/${gid}/results`, { credentials: 'include' });
      const results: Array<{ parent_result_id?: number; reveal_delay_minutes?: number }> = await res.json();
      return results.filter((r) => r.parent_result_id === headId).map((r) => r.reveal_delay_minutes);
    }, { gid: board.gameId, headId });
    expect(stored).toEqual([30]);
  });

  test('Ready → next skips players already ready, and Reopen takes it back', async ({ page }) => {
    const [shade, rook, vex, silk] = ['Shade (Whisper)', 'Rook (Hound)', 'Vex (Leech)', 'Silk (Spider)'].map((n) => cast[n]);
    await arrangeBoard(page, board.gameId, board.phaseId, [
      { kind: 'progress', key: String(shade), doc: { readDone: true, ready: true } },
      { kind: 'progress', key: String(rook), doc: { readDone: true } },
      { kind: 'progress', key: String(vex), doc: { readDone: true, ready: true } },
      { kind: 'progress', key: String(silk), doc: {} },
    ]);

    await board.open({ step: 'write', who: rook });
    await board.saving(() => page.getByRole('button', { name: 'Ready → next' }).click());
    // Vex is ready already, so next is Silk.
    await expect(page).toHaveURL(new RegExp(`[?&]who=${silk}(&|$)`));
    await expect(page.getByTestId('write-brief')).toHaveAttribute('aria-label', /^Silk/);

    await board.open({ step: 'write', who: rook });
    await board.saving(() => page.getByRole('button', { name: 'Reopen' }).click());
    await page.reload();
    await board.waitForLoaded('write');
    await expect(page.getByRole('button', { name: 'Ready → next' })).toBeVisible();
  });

  test('the checks before publishing flag a secret in a draft', async ({ page }) => {
    // Vex's seeded draft names "the manager's debts", a secret only Silk may know.
    await board.open({ step: 'write', who: cast['Vex (Leech)'] });
    await board.resultTab('Checks');
    await expect(page.getByTestId('write-check-leak').filter({ hasText: /the manager.s debts/ })).toBeVisible();
  });
});
