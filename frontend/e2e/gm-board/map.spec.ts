import { test, expect, type Locator, type Page } from '@playwright/test';
import { loginAs } from '../fixtures/auth-helpers';
import { getFixtureGameId } from '../fixtures/game-helpers';
import {
  arrangeBoard,
  boardItems,
  boardPhaseId,
  characterIds,
  freshSlotPosition,
  gmCard,
  HEIST_LOCATIONS,
  runTag,
  timeSlot,
} from '../fixtures/gm-board-helpers';
import { GmBoardPage } from '../pages/GmBoardPage';

/**
 * The Map step in a real browser: native drag and drop, the cause arrows
 * (measured from the page, so jsdom can't place them), the keyboard path,
 * and Map actions that save through the real API and come back on reload.
 * Which arrows are drawn, and each action's effect on the board, are unit
 * and component tested (arrows.test.ts, MapArrowLayer.test.tsx,
 * GmBoardMap.test.tsx); this checks the browser and the server agree.
 *
 * Fixture: RESULTS_BOARD_GM (#711). Each writing test adds its own time
 * slots (after every other column) and GM cards, named with a run tag.
 */

let board: GmBoardPage;
let cast: Record<string, number>;
let tag: string;

test.beforeEach(async ({ page }, testInfo) => {
  await loginAs(page, 'GM');
  const gameId = await getFixtureGameId(page, 'RESULTS_BOARD_GM');
  board = new GmBoardPage(page, gameId, await boardPhaseId(page, gameId));
  cast = await characterIds(page, gameId);
  tag = runTag(testInfo);
});

/** Two empty time slots of this test's own, A then B, as the last columns. */
async function arrangeSlots(...extra: Parameters<typeof arrangeBoard>[3]) {
  const base = freshSlotPosition();
  const a = `slot-${tag}-a`;
  const b = `slot-${tag}-b`;
  await arrangeBoard(board.page, board.gameId, board.phaseId, [
    timeSlot(a, `A ${tag}`, base + 0.1),
    timeSlot(b, `B ${tag}`, base + 0.2),
    ...extra,
  ]);
  return { a, b };
}

/** Each drawn arrow's two ends, in page coordinates. */
async function arrowEnds(page: Page) {
  const svg = page.getByTestId('map-arrows');
  const origin = (await svg.boundingBox())!;
  const ds = await page.getByTestId('map-arrow-cause').evaluateAll((paths) => paths.map((p) => p.getAttribute('d') ?? ''));
  return ds.map((d) => {
    const n = d.match(/-?\d+(\.\d+)?/g)!.map(Number);
    return { from: { x: origin.x + n[0], y: origin.y + n[1] }, to: { x: origin.x + n[4], y: origin.y + n[5] } };
  });
}

/** The point lies on (or within a pixel of) the element's box. */
async function expectOn(element: Locator, point: { x: number; y: number }) {
  const box = (await element.boundingBox())!;
  expect(point.x).toBeGreaterThanOrEqual(box.x - 1);
  expect(point.x).toBeLessThanOrEqual(box.x + box.width + 1);
  expect(point.y).toBeGreaterThanOrEqual(box.y - 1);
  expect(point.y).toBeLessThanOrEqual(box.y + box.height + 1);
}

const arrowEnd = (page: Page, id: string) => page.locator(`[data-arrow-id="${id}"]`).first();

test.describe('GM results board: Map', () => {
  test('dragging a card moves it to another cell; Undo puts it back, and the move survives a reload', async ({ page }) => {
    const cardId = `card-${tag}`;
    const { a, b } = await arrangeSlots(
      gmCard(cardId, { characterId: cast['Rook (Hound)'], locationId: HEIST_LOCATIONS.rooftop, chunkId: `slot-${tag}-a`, summary: `${tag} waits for the flash` }),
    );
    await board.open({ step: 'map' });
    const from = board.cell(HEIST_LOCATIONS.rooftop, a);
    // Rooftop and vault are neighbouring rows: Playwright's drag can't
    // scroll the page mid-drag, so both cells must be on screen at once
    // (dragCard scrolls them into place first).
    const to = board.cell(HEIST_LOCATIONS.vault, b);
    await expect(from.getByTestId(`map-card-${cardId}`)).toBeVisible();

    await board.saving(() => board.dragCard(cardId, to));
    await expect(to.getByTestId(`map-card-${cardId}`)).toBeVisible();

    await board.saving(() => page.getByRole('button', { name: 'Undo' }).click());
    await expect(from.getByTestId(`map-card-${cardId}`)).toBeVisible();

    await board.saving(() => board.dragCard(cardId, to));
    await page.reload();
    await board.waitForLoaded('map');
    await expect(to.getByTestId(`map-card-${cardId}`)).toBeVisible();
    await expect(from.getByTestId(`map-card-${cardId}`)).toHaveCount(0);
  });

  test('an outcome given in the card panel shows on the card, and survives a reload', async ({ page }) => {
    const cardId = `card-${tag}`;
    const { a } = await arrangeSlots(
      gmCard(cardId, { characterId: cast['Rook (Hound)'], locationId: HEIST_LOCATIONS.rooftop, chunkId: `slot-${tag}-a`, summary: `${tag} takes the shot` }),
    );
    await board.open({ step: 'map' });
    await expect(board.cell(HEIST_LOCATIONS.rooftop, a).getByTestId(`map-card-${cardId}`)).not.toHaveAttribute('aria-label', /Happened/);

    await board.openCard(cardId);
    const happened = board.cardPanel.getByRole('button', { name: 'Happened', exact: true });
    await board.saving(() => happened.click());
    await expect(happened).toHaveAttribute('aria-pressed', 'true');
    await expect(board.mapCard(cardId)).toHaveAttribute('aria-label', /Happened/);

    await page.reload();
    await board.waitForLoaded('map');
    await expect(board.mapCard(cardId)).toHaveAttribute('aria-label', /Happened/);
  });

  test('by keyboard: Enter opens a card, its time-slot picker moves it, and Esc returns focus to it', async ({ page }) => {
    const cardId = `card-${tag}`;
    const { b } = await arrangeSlots(
      gmCard(cardId, { characterId: cast['Silk (Spider)'], locationId: HEIST_LOCATIONS.lobby, chunkId: `slot-${tag}-a`, summary: `${tag} asks for the manager` }),
    );
    await board.open({ step: 'map' });

    await board.mapCard(cardId).focus();
    await page.keyboard.press('Enter');
    await expect(board.cardPanel).toBeFocused();

    await board.saving(() => board.cardPanel.getByRole('combobox', { name: 'Time slot' }).selectOption(b));
    await expect(board.cell(HEIST_LOCATIONS.lobby, b).getByTestId(`map-card-${cardId}`)).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(board.cardPanel).toHaveCount(0);
    await expect(board.mapCard(cardId)).toBeFocused();
  });

  test('a hovered card’s arrow runs from its cause to the card, and follows the card when it moves', async ({ page }) => {
    const causeId = `card-${tag}-cause`;
    const cardId = `card-${tag}-effect`;
    const { a, b } = await arrangeSlots(
      gmCard(causeId, { characterId: cast['Vex (Leech)'], locationId: HEIST_LOCATIONS.ducts, chunkId: `slot-${tag}-a`, summary: `${tag} kicks the grate loose` }),
      gmCard(cardId, { characterId: cast['Shade (Whisper)'], locationId: HEIST_LOCATIONS.vault, chunkId: `slot-${tag}-b`, summary: `${tag} hears the grate fall`, causedBy: [causeId] }),
    );

    await board.open({ step: 'map' });
    await board.mapCard(cardId).hover();
    await expect(page.getByTestId('map-arrow-cause')).toHaveCount(1);
    let [arrow] = await arrowEnds(page);
    await expectOn(arrowEnd(page, causeId), arrow.from);
    await expectOn(arrowEnd(page, cardId), arrow.to);

    // Moved a row up (the rooftop, the vault's neighbour), the arrow ends on the card's new place.
    await board.saving(() => board.dragCard(cardId, board.cell(HEIST_LOCATIONS.rooftop, b)));
    await expect(board.cell(HEIST_LOCATIONS.rooftop, b).getByTestId(`map-card-${cardId}`)).toBeVisible();
    await board.mapCard(cardId).hover();
    [arrow] = await arrowEnds(page);
    await expectOn(arrowEnd(page, causeId), arrow.from);
    await expectOn(arrowEnd(page, cardId), arrow.to);
    await expect(board.cell(HEIST_LOCATIONS.ducts, a).getByTestId(`map-card-${causeId}`)).toBeVisible();
  });

  test('the arrow mode is remembered across a reload, and Off draws nothing', async ({ page }) => {
    await board.open({ step: 'map' });
    const mode = page.getByRole('combobox', { name: 'Arrows' });
    await expect(page.getByTestId('map-arrows')).toHaveCount(0);

    await mode.selectOption('all');
    // The seed's causes: several cards and scenes cause others.
    await expect(page.getByTestId('map-arrow-cause').nth(1)).toBeAttached();

    await page.reload();
    await board.waitForLoaded('map');
    await expect(mode).toHaveValue('all');
    await expect(page.getByTestId('map-arrow-cause').nth(1)).toBeAttached();

    await mode.selectOption('off');
    await board.mapCard('card-heist-vex-locks').hover();
    await expect(page.getByTestId('map-arrows')).toHaveCount(0);
  });

  test('Create scene on a busy cell makes the scene with the cell’s cast and opens it in Scenes', async ({ page }) => {
    const { a } = await arrangeSlots(
      gmCard(`card-${tag}-silk`, { characterId: cast['Silk (Spider)'], locationId: HEIST_LOCATIONS.lobby, chunkId: `slot-${tag}-a`, summary: `${tag} faints in the lobby` }),
      gmCard(`card-${tag}-rook`, { characterId: cast['Rook (Hound)'], locationId: HEIST_LOCATIONS.lobby, chunkId: `slot-${tag}-a`, summary: `${tag} walks in to catch her` }),
    );
    await board.open({ step: 'map' });
    const cell = board.cell(HEIST_LOCATIONS.lobby, a);

    await board.saving(() => cell.getByRole('button', { name: /^Create scene at/ }).click());
    await board.waitForLoaded('scenes');
    await expect(page).toHaveURL(/[?&]step=scenes&scene=[^&]+/);
    const castBox = page.getByTestId('scene-cast');
    await expect(castBox).toContainText('Silk');
    await expect(castBox).toContainText('Rook');
    const sceneId = new URL(page.url()).searchParams.get('scene')!;

    // Saved: after a reload the Map shows the scene in the cell, and no longer offers to make one.
    await board.open({ step: 'map' });
    await expect(cell.locator(`[data-arrow-id="${sceneId}"]`)).toBeVisible();
    await expect(cell.getByRole('button', { name: /^Create scene at/ })).toHaveCount(0);
  });

  test('time slots: “+ before” adds one, it can be renamed, and an empty one removed with Undo', async ({ page }) => {
    const { a } = await arrangeSlots();
    await board.open({ step: 'map' });
    const slotKeys = async () => (await boardItems(page, board.gameId, board.phaseId)).filter((i) => i.kind === 'chunk').map((i) => i.key);
    const before = await slotKeys();

    await board.saving(() => page.getByRole('button', { name: `Insert a time slot before A ${tag}` }).click());
    const added = (await slotKeys()).filter((k) => !before.includes(k));
    expect(added).toHaveLength(1);
    const head = page.getByTestId(`slot-head-${added[0]}`);
    await expect(head).toBeVisible();

    const name = `Before ${tag}`;
    await board.saving(() => head.getByRole('textbox').fill(name));
    await page.reload();
    await board.waitForLoaded('map');
    await expect(page.getByTestId(`slot-head-${added[0]}`).getByRole('textbox')).toHaveValue(name);

    await board.saving(() => page.getByRole('button', { name: `Remove the empty slot ${name}` }).click());
    await expect(page.getByTestId(`slot-head-${added[0]}`)).toHaveCount(0);
    await board.saving(() => page.getByRole('button', { name: 'Undo' }).click());
    await expect(page.getByTestId(`slot-head-${added[0]}`)).toBeVisible();
    await expect(page.getByTestId(`slot-head-${a}`)).toBeVisible();
  });

  test('Split at the cursor leaves the first half and puts the rest in the next time slot', async ({ page }) => {
    const cardId = `card-${tag}`;
    const first = `${tag} plants the sword under the floor.`;
    const rest = 'Later, launches the attack from below.';
    const { a, b } = await arrangeSlots(
      gmCard(cardId, { characterId: cast['Vex (Leech)'], locationId: HEIST_LOCATIONS.vault, chunkId: `slot-${tag}-a`, summary: `${first} ${rest}` }),
    );
    await board.open({ step: 'map' });
    await board.openCard(cardId);

    // Put the cursor where the second card should start, as a GM clicking there would.
    await board.cardText.evaluate((el: HTMLTextAreaElement, at) => {
      el.focus();
      el.setSelectionRange(at, at);
    }, first.length + 1);
    await board.saving(() => board.cardPanel.getByRole('button', { name: 'Split at the cursor' }).click());

    await page.reload();
    await board.waitForLoaded('map');
    await expect(board.cell(HEIST_LOCATIONS.vault, a).getByTestId(`map-card-${cardId}`)).toContainText(first);
    await expect(board.cell(HEIST_LOCATIONS.vault, a).getByTestId(`map-card-${cardId}`)).not.toContainText('launches');
    await expect(board.cell(HEIST_LOCATIONS.vault, b).getByRole('button', { name: /launches the attack/ })).toBeVisible();
  });

  test('By character, a scene in a character’s row opens that scene in Scenes', async ({ page }) => {
    await board.open({ step: 'map' });
    await page.getByRole('group', { name: 'View' }).getByRole('button', { name: 'By character' }).click();
    await expect(page.getByTestId('map-by-character')).toBeVisible();

    await page.getByTestId(`char-cell-${cast['Shade (Whisper)']}-slot-2`).getByRole('button', { name: /The ghost in the vault/ }).click();
    await board.waitForLoaded('scenes');
    await expect(page).toHaveURL(/scene=scene-heist-vault/);
    await expect(page.getByTestId('scene-header').getByRole('textbox', { name: 'Scene title' })).toHaveValue('The ghost in the vault');
  });
});
