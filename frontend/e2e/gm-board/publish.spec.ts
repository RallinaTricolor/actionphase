import { test, expect, type Locator, type Page } from '@playwright/test';
import { loginAs } from '../fixtures/auth-helpers';
import { getFixtureGameId } from '../fixtures/game-helpers';
import {
  arrangeBoard,
  boardPhaseId,
  characterIds,
  createDraftResult,
  deleteDraftResults,
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
 * The second test does the same for sheet changes made on Write (finding C:
 * the board covers what the results area's sheet-update modal did), and
 * checks the published sheet entry by entry, so the board's writes are seen
 * to lose nothing a GM didn't change.
 *
 * Fixture: RESULTS_BOARD_PUBLISH (#717). Publishing can't be undone, so each
 * test publishes only a result it wrote (named with a run tag) and clears
 * its character's reward lines first. The first compares the sheet with what
 * it was at the start; the second writes Shade's sheet back to the fixture's
 * before it starts.
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

  test('sheet changes made on Write (harm, a used consumable, an edited entry) reach the sheet when the result is published, losing nothing', async ({ page }, testInfo) => {
    await loginAs(page, 'GM');
    const gameId = await getFixtureGameId(page, 'RESULTS_BOARD_PUBLISH');
    const phaseId = await boardPhaseId(page, gameId);
    const shade = (await characterIds(page, gameId))['Shade (Whisper)'];
    const text = `${runTag(testInfo)}: The ghost fights back before it goes into the bottle.`;

    // Shade starts from the fixture's sheet every run (an earlier run published
    // into it), with no reward lines and one draft: this test's.
    await setSheet(page, shade, SHADE);
    await arrangeBoard(page, gameId, phaseId, [{ kind: 'rewards', key: String(shade), doc: { lines: [], texts: {} } }]);
    await deleteDraftResults(page, gameId, phaseId, shade);
    const resultId = await createDraftResult(page, gameId, 'Shade (Whisper)', text);

    const board = new GmBoardPage(page, gameId, phaseId);
    await board.open({ step: 'write', who: shade });
    await board.resultTab('Rewards');
    await page.getByRole('button', { name: '+ Sheet change' }).click();
    const editor = page.getByTestId('reward-line-editor');

    // 1. Harm: +2 Stress, a track.
    const harm = editor.getByTestId('line-op-0');
    await pickEntry(page, harm, 'Stress');
    await harm.getByLabel('By', { exact: true }).fill('2');
    await expect(editor.getByTestId('line-outcome-0')).toHaveText('Stress · Amount: 4 → 6');

    // 2. A used consumable: −1 Quantity on the Spirit Bottle.
    await editor.getByRole('button', { name: '+ Change' }).click();
    const used = editor.getByTestId('line-op-1');
    await used.getByLabel('Tab', { exact: true }).selectOption('inventory');
    await pickEntry(page, used, 'Spirit Bottle');
    await used.getByLabel('By', { exact: true }).fill('-1');
    await expect(editor.getByTestId('line-outcome-1')).toHaveText('Spirit Bottle · Quantity: 1 → 0');

    // 3. An edited entry, in the sheet's own form: Compel goes to rank 3.
    await editor.getByRole('button', { name: '+ Change' }).click();
    const edited = editor.getByTestId('line-op-2');
    await edited.getByLabel('Tab', { exact: true }).selectOption('skills');
    await edited.getByLabel('Change', { exact: true }).selectOption('edit');
    await pickEntry(page, edited, 'Compel');
    await edited.getByRole('button', { name: 'Edit Compel', exact: true }).click();
    const form = editor.getByTestId('line-edit-2-form');
    await form.getByLabel('Rank', { exact: true }).fill('3');
    await form.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(editor.getByTestId('line-edit-2')).toContainText('Rank: 2 → 3');

    await editor.getByRole('button', { name: 'Done', exact: true }).click();
    await expect(page.getByTestId('reward-sync')).toContainText('Saved as draft sheet updates');
    await expect.poll(async () => (await draftModules(page, gameId, resultId)).sort()).toEqual(['inventory', 'numbers', 'skills']);

    await board.resultTab('Result');
    const chain = page.getByTestId(`result-chain-${resultId}`);
    await chain.getByRole('button', { name: 'Publish', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Publish Action Result?' });
    await clickAndWaitForMutation(page, dialog.getByRole('button', { name: 'Publish', exact: true }), API.publishResult);
    await expect(chain).toContainText('Published');

    // Exactly these changes; every other field, and every id, as it was.
    const sheet = await sheetRows(page, shade);
    expect(sheet.numbers).toEqual([SHADE.numbers[0], { ...SHADE.numbers[1], amount: { value: 6, max: 9, display: 'boxes' } }]);
    expect(sheet.inventory).toEqual([{ ...SHADE.inventory[0], quantity: 0 }]);
    expect(sheet.skills).toEqual([{ ...SHADE.skills[0], rank: '3' }]);
  });
});

/** Shade's sheet in the fixture (34_gm_board.sql). */
const SHADE = {
  numbers: [
    { id: '5e1a0c2d-1b3f-4a51-9c01-0a1b2c3d4e01', name: 'Coin', amount: { value: 6 } },
    { id: '5e1a0c2d-1b3f-4a51-9c01-0a1b2c3d4e02', name: 'Stress', amount: { value: 4, max: 9, display: 'boxes' } },
  ],
  skills: [{ id: '5e1a0c2d-1b3f-4a51-9c01-0a1b2c3d4e03', name: 'Compel', rank: '2', description: 'Force a ghost or spirit to obey.', category: 'Arcane' }],
  inventory: [{ id: '5e1a0c2d-1b3f-4a51-9c01-0a1b2c3d4e04', name: 'Spirit Bottle', description: 'Holds a captured ghost.', quantity: 1, category: 'Arcane' }],
};
const FIELD_NAMES: Record<keyof typeof SHADE, string> = { numbers: 'numbers', skills: 'skills', inventory: 'items' };

/** Writes the stat tabs of a character's sheet, as the GM's sheet editor does. */
async function setSheet(page: Page, characterId: number, tabs: typeof SHADE) {
  await page.evaluate(
    async ({ cid, rows }) => {
      for (const row of rows) {
        const res = await fetch(`/api/v1/characters/${cid}/data`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...row, field_type: 'json', is_public: false }),
        });
        if (!res.ok) throw new Error(`Failed to set ${row.module_type}: ${res.status} ${await res.text()}`);
      }
    },
    {
      cid: characterId,
      rows: (Object.keys(tabs) as (keyof typeof SHADE)[]).map((key) => ({ module_type: key, field_name: FIELD_NAMES[key], field_value: JSON.stringify(tabs[key]) })),
    },
  );
}

/** The stat tabs of a character's live sheet, parsed. */
async function sheetRows(page: Page, characterId: number): Promise<Record<string, unknown[]>> {
  return page.evaluate(async (cid) => {
    const res = await fetch(`/api/v1/characters/${cid}/data`, { credentials: 'include' });
    if (!res.ok) throw new Error(`Failed to read the sheet: ${res.status}`);
    const rows: Array<{ module_type: string; field_value: string }> = await res.json();
    return Object.fromEntries(rows.filter((r) => ['numbers', 'skills', 'inventory'].includes(r.module_type)).map((r) => [r.module_type, JSON.parse(r.field_value)]));
  }, characterId);
}

/** The tabs a result's draft sheet updates write. */
async function draftModules(page: Page, gameId: number, resultId: number): Promise<string[]> {
  return page.evaluate(
    async ({ gid, rid }) => {
      const res = await fetch(`/api/v1/games/${gid}/results/${rid}/character-updates`, { credentials: 'include' });
      if (!res.ok) throw new Error(`Failed to read sheet drafts: ${res.status}`);
      return (((await res.json()) as Array<{ module_type: string }> | null) ?? []).map((d) => d.module_type);
    },
    { gid: gameId, rid: resultId },
  );
}

/** Picks an entry from a sheet change's Entry box, by its exact name. */
async function pickEntry(page: Page, op: Locator, name: string) {
  await op.getByRole('combobox', { name: 'Entry', exact: true }).fill(name);
  await page.getByRole('option', { name, exact: true }).click();
}

