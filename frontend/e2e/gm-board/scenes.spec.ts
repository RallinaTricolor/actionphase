import { test, expect } from '@playwright/test';
import { loginAs } from '../fixtures/auth-helpers';
import { getFixtureGameId } from '../fixtures/game-helpers';
import {
  arrangeBoard,
  boardItem,
  boardPhaseId,
  characterIds,
  freshSlotPosition,
  gmCard,
  HEIST_LOCATIONS,
  runTag,
  scene,
  timeSlot,
} from '../fixtures/gm-board-helpers';
import { GmBoardPage } from '../pages/GmBoardPage';

/**
 * The Scenes step: moments saved through the real store and read back, a
 * scene's state effect reaching the Map's checks, and the narrow layout.
 * Readers, second person and the effect rules are unit tested
 * (scenes.test.ts, secondPerson.test.ts, flags.test.ts) and the step's
 * wiring with a mocked API (GmBoardScenes.test.tsx).
 *
 * Fixture: RESULTS_BOARD_SCENES (#714). Each writing test makes its own
 * time slots, cards and scene, named with a run tag.
 */

let board: GmBoardPage;
let cast: Record<string, number>;
let tag: string;

test.beforeEach(async ({ page }, testInfo) => {
  await loginAs(page, 'GM');
  const gameId = await getFixtureGameId(page, 'RESULTS_BOARD_SCENES');
  board = new GmBoardPage(page, gameId, await boardPhaseId(page, gameId));
  cast = await characterIds(page, gameId);
  tag = runTag(testInfo);
});

/** This test's own scene in the lobby with Silk and Rook, in its own time slot (A), with two slots after it (B, C). */
async function arrangeScene(...extra: Parameters<typeof arrangeBoard>[3]) {
  const base = freshSlotPosition();
  const ids = { scene: `scene-${tag}`, a: `slot-${tag}-a`, b: `slot-${tag}-b`, c: `slot-${tag}-c` };
  await arrangeBoard(board.page, board.gameId, board.phaseId, [
    timeSlot(ids.a, `A ${tag}`, base + 0.1),
    timeSlot(ids.b, `B ${tag}`, base + 0.2),
    timeSlot(ids.c, `C ${tag}`, base + 0.3),
    scene(ids.scene, { title: `Lobby ${tag}`, locationId: HEIST_LOCATIONS.lobby, chunkId: ids.a, participants: [cast['Silk (Spider)'], cast['Rook (Hound)']] }),
    ...extra,
  ]);
  return ids;
}

test.describe('GM results board: Scenes', () => {
  test('a moment read by one of the cast reads in second person for them, and is saved', async ({ page }) => {
    const ids = await arrangeScene();
    await board.open({ step: 'scenes', scene: ids.scene });

    await board.saving(() => page.getByRole('button', { name: '+ Moment', exact: true }).click());
    const moment = page.locator('[data-testid^="moment-"]').first();
    await board.saving(() => moment.getByRole('textbox', { name: 'What happens, with names' }).fill('Silk slips the key from the manager’s waistcoat.'));
    // Both of the cast read a new moment; Rook, on the roof, doesn't see this.
    const rookChip = moment.getByRole('group', { name: 'Who reads moment 1' }).getByRole('button', { name: 'Rook', exact: true });
    await expect(rookChip).toHaveAttribute('aria-pressed', 'true');
    await board.saving(() => rookChip.click());
    await expect(rookChip).toHaveAttribute('aria-pressed', 'false');

    const readsAs = page.getByTestId('scene-reads-as');
    await readsAs.getByRole('group', { name: 'Reader' }).getByRole('button', { name: /Silk/ }).click();
    await expect(readsAs).toContainText('You slip the key');

    const saved = await boardItem(page, board.gameId, board.phaseId, 'scene', ids.scene);
    const [stored] = (saved?.doc as { moments: Array<{ text: string; readers: number[] }> }).moments;
    expect(stored.text).toBe('Silk slips the key from the manager’s waistcoat.');
    expect(stored.readers).toEqual([cast['Silk (Spider)']]);
  });

  test('a captured effect puts the character out of play, and the Map flags their later card', async ({ page }) => {
    const rook = cast['Rook (Hound)'];
    const cardId = `card-${tag}`;
    const ids = await arrangeScene(
      gmCard(cardId, { characterId: rook, locationId: HEIST_LOCATIONS.rooftop, chunkId: `slot-${tag}-b`, summary: `${tag} climbs back to the roof` }),
    );
    await board.open({ step: 'map' });
    await expect(board.mapCard(cardId)).not.toHaveAttribute('aria-label', /out of play/);

    await board.open({ step: 'scenes', scene: ids.scene });
    const after = page.getByRole('group', { name: 'After the scene' });
    await board.saving(() => after.getByRole('button', { name: '+ State' }).click());
    await board.saving(() => after.getByRole('combobox', { name: 'Effect 1: who' }).selectOption(String(rook)));
    await board.saving(() => after.getByRole('combobox', { name: 'Effect 1: state' }).selectOption('captured'));
    // Back by this test's last slot, so the effect can't reach a later attempt's slots.
    await board.saving(() => after.getByRole('combobox', { name: 'Effect 1: until' }).selectOption(ids.c));

    await board.goToStep('map');
    await expect(board.mapCard(cardId)).toHaveAttribute('aria-label', /out of play/);
  });

  test('Delete scene removes it and the causes citing it; Undo brings both back', async ({ page }) => {
    const cardId = `card-${tag}`;
    const ids = await arrangeScene(
      gmCard(cardId, { characterId: cast['Silk (Spider)'], locationId: HEIST_LOCATIONS.lobby, chunkId: `slot-${tag}-b`, summary: `${tag} leaves in a hurry`, causedBy: [`scene-${tag}`] }),
    );
    await board.open({ step: 'scenes', scene: ids.scene });

    await board.saving(() => page.getByRole('button', { name: 'Delete scene' }).click());
    expect(await boardItem(page, board.gameId, board.phaseId, 'scene', ids.scene)).toBeUndefined();
    expect((await boardItem(page, board.gameId, board.phaseId, 'card', cardId))?.doc).toMatchObject({ causedBy: [] });

    await board.saving(() => page.getByRole('button', { name: 'Undo' }).click());
    expect(await boardItem(page, board.gameId, board.phaseId, 'scene', ids.scene)).toBeDefined();
    expect((await boardItem(page, board.gameId, board.phaseId, 'card', cardId))?.doc).toMatchObject({ causedBy: [ids.scene] });
  });

  test('at 1024px wide, Reference and Reads as share the side column as two tabs', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await board.open({ step: 'scenes', scene: 'scene-heist-vault' });
    const pane = page.getByRole('group', { name: 'Side pane' });
    await expect(pane.getByRole('button', { name: 'Reference' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('scene-reference')).toBeVisible();
    await expect(page.getByTestId('scene-reads-as')).toHaveCount(0);

    await pane.getByRole('button', { name: 'Reads as' }).click();
    await expect(page.getByTestId('scene-reads-as')).toBeVisible();
    await expect(page.getByTestId('scene-reference')).toHaveCount(0);
    // The moments stay in view beside it.
    await expect(page.getByTestId('moment-m-heist-v1')).toBeVisible();
  });
});
