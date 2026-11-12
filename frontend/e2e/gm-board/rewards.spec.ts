import { test, expect, type Page } from '@playwright/test';
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
import { API, clickAndWaitForMutation } from '../utils/waits';

/**
 * Rewards on the Write step, against the real sheet-draft and result
 * endpoints: the board turns reward lines into draft sheet updates on the
 * result that carries them, puts the reward block in that result, and asks
 * before replacing sheet updates made by hand in the results list. The
 * sheet maths and the block template are unit tested (rewards.test.ts,
 * rewardTemplate.test.ts); the panel with a mocked API (WriteRewards.test.tsx).
 *
 * Fixture: RESULTS_BOARD_REWARDS (#716). Each test deletes the character's
 * drafts, writes its own (named with a run tag) and sets their reward lines,
 * so it starts the same way every time.
 */

let board: GmBoardPage;
let cast: Record<string, number>;
let tag: string;

test.beforeEach(async ({ page }, testInfo) => {
  await loginAs(page, 'GM');
  const gameId = await getFixtureGameId(page, 'RESULTS_BOARD_REWARDS');
  board = new GmBoardPage(page, gameId, await boardPhaseId(page, gameId));
  cast = await characterIds(page, gameId);
  tag = runTag(testInfo);
});

/** One draft result for the character (this test's), and no reward lines. */
async function freshDraft(page: Page, name: string) {
  const id = cast[name];
  await deleteDraftResults(page, board.gameId, board.phaseId, id);
  await arrangeBoard(page, board.gameId, board.phaseId, [{ kind: 'rewards', key: String(id), doc: { lines: [], texts: {} } }]);
  const text = `${tag}: You make it out with the take.`;
  return { characterId: id, text, resultId: await createDraftResult(page, board.gameId, name, text) };
}

type SheetDraft = { module_type: string; from_rewards: boolean };
const sheetDrafts = (page: Page, resultId: number) =>
  page.evaluate(
    async ({ gid, rid }) => {
      const res = await fetch(`/api/v1/games/${gid}/results/${rid}/character-updates`, { credentials: 'include' });
      if (!res.ok) throw new Error(`Failed to read sheet drafts: ${res.status}`);
      return (await res.json()) as SheetDraft[];
    },
    { gid: board.gameId, rid: resultId },
  );

const resultContent = (page: Page, resultId: number) =>
  page.evaluate(
    async ({ gid, rid }) => {
      const res = await fetch(`/api/v1/games/${gid}/results`, { credentials: 'include' });
      return ((await res.json()) as Array<{ id: number; content: string }>).find((r) => r.id === rid)?.content ?? '';
    },
    { gid: board.gameId, rid: resultId },
  );

const occurrences = (text: string, part: string) => text.split(part).length - 1;

test.describe('GM results board: rewards', () => {
  test('a quick-given reward becomes a draft sheet update on the result, which the results area counts too', async ({ page }) => {
    const { characterId, resultId } = await freshDraft(page, 'Silk (Spider)');
    await board.open({ step: 'write', who: characterId });

    await clickAndWaitForMutation(page, page.getByTestId('give-rw-heist-clean'), API.saveRewardSheetUpdates);
    await expect(page.getByTestId(`board-draft-update-count-${resultId}`)).toContainText('1');
    expect(await sheetDrafts(page, resultId)).toEqual([expect.objectContaining({ module_type: 'numbers', from_rewards: true })]);

    const game = new GameDetailsPage(page);
    await game.goto(board.gameId);
    await game.goToActions();
    await expect(page.getByTestId(`draft-update-count-${resultId}`)).toHaveText('1');
  });

  test('Put block in result adds the reward block to the result, and putting it again replaces it', async ({ page }) => {
    const { characterId, resultId, text } = await freshDraft(page, 'Silk (Spider)');
    await board.open({ step: 'write', who: characterId });

    await clickAndWaitForMutation(page, page.getByTestId('give-rw-heist-clean'), API.saveRewardSheetUpdates);
    await clickAndWaitForMutation(page, page.getByTestId('put-block'), API.updateResult);
    let content = await resultContent(page, resultId);
    expect(content.startsWith(text)).toBe(true);
    expect(occurrences(content, '**Job result:** Clean. 2 coin.')).toBe(1);

    await clickAndWaitForMutation(page, page.getByTestId('give-rw-heist-shaken'), API.saveRewardSheetUpdates);
    await clickAndWaitForMutation(page, page.getByTestId('put-block'), API.updateResult);
    content = await resultContent(page, resultId);
    expect(content.startsWith(text)).toBe(true);
    expect(occurrences(content, '# Rewards')).toBe(1);
    expect(occurrences(content, '**Job result:** Clean. 2 coin.')).toBe(1);
    expect(content).toContain('You take 1 stress from the close call.');
  });

  test('sheet updates made by hand in the results list stay until the GM chooses to replace them', async ({ page }) => {
    // Rook keeps the seed's reward lines; his result gets a sheet update made by hand.
    const rook = cast['Rook (Hound)'];
    await deleteDraftResults(page, board.gameId, board.phaseId, rook);
    const resultId = await createDraftResult(page, board.gameId, 'Rook (Hound)', `${tag}: The roof was cold and the job went clean.`);
    await page.evaluate(
      async ({ gid, rid, cid }) => {
        const res = await fetch(`/api/v1/games/${gid}/results/${rid}/character-updates`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            character_id: cid,
            module_type: 'inventory',
            field_name: 'items',
            field_type: 'json',
            operation: 'upsert',
            field_value: JSON.stringify([{ id: '7d1e0f2a-3b4c-4d5e-8f6a-7b8c9d0e1f2a', name: 'Spare Darts', quantity: 6, category: 'Weapon' }]),
          }),
        });
        if (!res.ok) throw new Error(`Failed to make a sheet update: ${res.status} ${await res.text()}`);
      },
      { gid: board.gameId, rid: resultId, cid: rook },
    );

    await board.open({ step: 'write', who: rook });
    const ask = page.getByTestId('reward-hand-made');
    await expect(ask).toContainText('inventory');
    expect(await sheetDrafts(page, resultId)).toEqual([expect.objectContaining({ module_type: 'inventory', from_rewards: false })]);

    await clickAndWaitForMutation(page, ask.getByRole('button', { name: 'Replace them' }), API.saveRewardSheetUpdates);
    await expect(ask).toHaveCount(0);
    const drafts = await sheetDrafts(page, resultId);
    expect(drafts.length).toBeGreaterThan(0);
    expect(drafts.every((d) => d.from_rewards)).toBe(true);
  });
});
