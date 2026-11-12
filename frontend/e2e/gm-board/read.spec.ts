import { test, expect, type Page } from '@playwright/test';
import { loginAs } from '../fixtures/auth-helpers';
import { getFixtureGameId } from '../fixtures/game-helpers';
import {
  arrangeBoard,
  arrangeSettings,
  boardItems,
  boardPhaseId,
  characterIds,
  settingsItems,
} from '../fixtures/gm-board-helpers';
import { GmBoardPage } from '../pages/GmBoardPage';
import { API, clickAndWaitForMutation } from '../utils/waits';

/**
 * The Read step with a real text selection: the GM drags the mouse across a
 * submission and the toolbar offers + Card, + IF card and + Codex. jsdom
 * has no layout or real Selection behaviour, so the component tests set the
 * selection by hand (GmBoardRead.test.tsx); this drives it with the mouse
 * and checks what the board stored.
 *
 * Fixture: RESULTS_BOARD_READ (#713). Selections make new cards each time
 * (a card is the board's copy of the text, so two from one passage are
 * fine), and the tests look for the cards they made by comparing the board
 * before and after. The codex test removes its entry first, and the
 * progress test sets progress first.
 */

let board: GmBoardPage;
let cast: Record<string, number>;

test.beforeEach(async ({ page }) => {
  await loginAs(page, 'GM');
  const gameId = await getFixtureGameId(page, 'RESULTS_BOARD_READ');
  board = new GmBoardPage(page, gameId, await boardPhaseId(page, gameId));
  cast = await characterIds(page, gameId);
});

/** Selects a phrase in the open submission by dragging the mouse across it, as a GM would. */
async function selectWithMouse(page: Page, phrase: string) {
  const ends = await page.getByTestId('submission-text').evaluate((root, text) => {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const at = node.textContent?.indexOf(text) ?? -1;
      if (at < 0) continue;
      const range = document.createRange();
      range.setStart(node, at);
      range.setEnd(node, at + text.length);
      const rects = Array.from(range.getClientRects());
      const first = rects[0];
      const last = rects[rects.length - 1];
      return { x1: first.left + 1, y1: first.top + first.height / 2, x2: last.right - 1, y2: last.top + last.height / 2 };
    }
    throw new Error(`“${text}” isn't in one text run of the submission`);
  }, phrase);
  await page.mouse.move(ends.x1, ends.y1);
  await page.mouse.down();
  await page.mouse.move(ends.x2, ends.y2, { steps: 8 });
  await page.mouse.up();
  await expect(page.getByTestId('selection-toolbar')).toBeVisible();
}

const cardKeys = async (page: Page) =>
  new Set((await boardItems(page, board.gameId, board.phaseId)).filter((i) => i.kind === 'card').map((i) => i.key));

type CardDoc = { quote: string; isIF: boolean; chunkId: string | null; characterId: number };

test.describe('GM results board: Read', () => {
  test('selecting a passage and choosing + Card makes a card from it, which opens beside the submission', async ({ page }) => {
    const rook = cast['Rook (Hound)'];
    const phrase = 'pre-arranged mirror flashes';
    await board.open({ who: rook });
    const before = await cardKeys(page);

    await selectWithMouse(page, phrase);
    await board.saving(() => page.getByTestId('selection-toolbar').getByRole('button', { name: '+ Card' }).click());

    // The toast says where it went and opens it, in the column beside the
    // submission, which stays in view.
    await page.getByRole('button', { name: 'Open card' }).click();
    await expect(board.cardPanel).toBeVisible();
    await expect(board.cardText).toHaveValue(phrase);
    await expect(page.getByTestId('submission-text')).toBeVisible();

    const made = (await boardItems(page, board.gameId, board.phaseId)).filter((i) => i.kind === 'card' && !before.has(i.key));
    expect(made).toHaveLength(1);
    const doc = made[0].doc as CardDoc;
    expect(doc).toMatchObject({ quote: phrase, characterId: rook, isIF: false });
  });

  test('+ IF card makes a card that waits in Contingencies on the Map', async ({ page }) => {
    const phrase = 'live rounds ready if things go badly';
    await board.open({ who: cast['Rook (Hound)'] });
    const before = await cardKeys(page);

    await selectWithMouse(page, phrase);
    await board.saving(() => page.getByTestId('selection-toolbar').getByRole('button', { name: '+ IF card' }).click());

    const made = (await boardItems(page, board.gameId, board.phaseId)).filter((i) => i.kind === 'card' && !before.has(i.key));
    expect(made).toHaveLength(1);
    expect(made[0].doc as CardDoc).toMatchObject({ quote: phrase, isIF: true, chunkId: null });

    await board.goToStep('map');
    await expect(page.getByTestId('contingencies').getByTestId(`map-card-${made[0].key}`)).toBeVisible();
  });

  test('+ Codex adds the selected name to the codex, and the sidebar then lists it as a match', async ({ page }) => {
    const name = 'spyglass';
    const stale = (await settingsItems(page, board.gameId)).filter((i) => i.kind === 'codex' && (i.doc as { name: string }).name === name);
    await arrangeSettings(page, board.gameId, stale.map((i) => ({ kind: 'codex' as const, key: i.key, deleted: true as const })));

    await board.open({ who: cast['Rook (Hound)'] });
    const matches = page.getByTestId('read-sidebar').locator('section').filter({ has: page.getByRole('heading', { name: 'Codex matches' }) });
    await expect(matches).not.toContainText(name);

    await selectWithMouse(page, name);
    await page.getByTestId('selection-toolbar').getByRole('button', { name: '+ Codex' }).click();
    const form = page.getByRole('form', { name: 'Add to the codex' });
    await expect(form.getByLabel('Name', { exact: true })).toHaveValue(name);
    await form.getByLabel('Type').selectOption('Item');
    await clickAndWaitForMutation(page, form.getByRole('button', { name: 'Add to codex' }), API.saveBoardSettings);
    await page.keyboard.press('Escape');

    await expect(matches).toContainText(name);
    await page.reload();
    await board.waitForLoaded('read');
    await expect(matches).toContainText(name);
  });

  test('Done reading → next marks the submission read and opens the next one not read yet', async ({ page }) => {
    const [shade, rook, vex, silk] = ['Shade (Whisper)', 'Rook (Hound)', 'Vex (Leech)', 'Silk (Spider)'].map((n) => cast[n]);
    await arrangeBoard(page, board.gameId, board.phaseId, [
      { kind: 'progress', key: String(shade), doc: { readDone: true } },
      { kind: 'progress', key: String(rook), doc: {} },
      { kind: 'progress', key: String(vex), doc: { readDone: true } },
      { kind: 'progress', key: String(silk), doc: {} },
    ]);
    await board.open({ who: rook });
    const players = page.getByTestId('read-player-list');
    await expect(players).toContainText('2/4 read');

    await board.saving(() => page.getByRole('button', { name: 'Done reading → next' }).click());
    // Vex is read already, so next is Silk.
    await expect(page).toHaveURL(new RegExp(`[?&]who=${silk}(&|$)`));
    await expect(page.getByTestId('submission-text')).toContainText('Lady Ashworth');
    await expect(players).toContainText('3/4 read');

    await page.reload();
    await board.waitForLoaded('read');
    await expect(players).toContainText('3/4 read');
  });
});
