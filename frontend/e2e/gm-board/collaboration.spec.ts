import { test, expect, type Browser, type Page } from '@playwright/test';
import { loginAs } from '../fixtures/auth-helpers';
import { getFixtureGameId } from '../fixtures/game-helpers';
import {
  arrangeBoard,
  boardItem,
  boardPhaseId,
  characterIds,
  gmCard,
  HEIST_LOCATIONS,
  runTag,
  timeSlot,
} from '../fixtures/gm-board-helpers';
import { GmBoardPage } from '../pages/GmBoardPage';

/**
 * Two GMs on one board: the item store's saves, polls and conflicts against
 * the real API. The store's merge and conflict rules are unit tested
 * (lib/gmBoard/store.test.ts) and the hook's with a mocked API
 * (hooks/useGmBoard.test.tsx); these check that the server's versions, its
 * 409s and its `since` cursor drive them as those tests assume.
 *
 * Fixture: RESULTS_BOARD_CO_GM (#718), the Heist's board, with TestPlayer5
 * as co-GM. Each test makes its own time slot and card, named with a run
 * tag, so it never depends on what another test or an earlier attempt did.
 *
 * Polls are driven with Playwright's clock (`GmBoardPage.nextPoll`), never
 * by waiting out the real 15 seconds.
 */

interface Editor {
  page: Page;
  board: GmBoardPage;
  close: () => Promise<void>;
}

async function openAs(browser: Browser, user: 'GM' | 'PLAYER_5', phaseId: number | null): Promise<Editor & { gameId: number; phaseId: number }> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await loginAs(page, user);
  const gameId = await getFixtureGameId(page, 'RESULTS_BOARD_CO_GM');
  const pid = phaseId ?? (await boardPhaseId(page, gameId));
  await page.clock.install();
  return { page, board: new GmBoardPage(page, gameId, pid), close: () => context.close(), gameId, phaseId: pid };
}

test.describe('GM results board: two editors', () => {
  let gm: Editor & { gameId: number; phaseId: number };
  let coGm: Editor;
  let cardId: string;
  let original: string;

  test.beforeEach(async ({ browser }, testInfo) => {
    gm = await openAs(browser, 'GM', null);
    coGm = await openAs(browser, 'PLAYER_5', gm.phaseId);

    const tag = runTag(testInfo);
    const cast = await characterIds(gm.page, gm.gameId);
    cardId = `card-${tag}`;
    original = `${tag} slips past the tellers`;
    await arrangeBoard(gm.page, gm.gameId, gm.phaseId, [
      timeSlot(`slot-${tag}`, `Slot ${tag}`),
      gmCard(cardId, { characterId: cast['Silk (Spider)'], locationId: HEIST_LOCATIONS.lobby, chunkId: `slot-${tag}`, summary: original }),
    ]);

    await gm.board.open({ step: 'map' });
    await coGm.board.open({ step: 'map' });
    await expect(gm.board.mapCard(cardId)).toContainText(original);
    await expect(coGm.board.mapCard(cardId)).toContainText(original);
  });

  test.afterEach(async () => {
    await gm?.close();
    await coGm?.close();
  });

  test('a co-GM’s edit shows on the GM’s open board at the next poll', async () => {
    const edited = `${original}, unseen`;
    await coGm.board.openCard(cardId);
    await coGm.board.saving(() => coGm.board.cardText.fill(edited));

    await expect(gm.board.mapCard(cardId)).toContainText(original);
    await gm.board.nextPoll();
    await expect(gm.board.mapCard(cardId)).toContainText(edited);
  });

  test('a card one GM deletes goes from the other GM’s board at the next poll', async () => {
    await coGm.board.openCard(cardId);
    await coGm.board.saving(() => coGm.board.cardPanel.getByRole('button', { name: 'Delete card' }).click());
    await expect(coGm.board.mapCard(cardId)).toHaveCount(0);

    await gm.board.nextPoll();
    await expect(gm.board.mapCard(cardId)).toHaveCount(0);
  });

  test('two GMs edit the same card: the later save loses, says so, and “Use mine” puts it back', async () => {
    const theirs = `${original} (co-GM)`;
    const mine = `${original} (GM)`;

    // Hold the GM's polls, so the GM's edit is made on the version the GM
    // loaded, as it would be when two GMs type at once.
    let releasePolls!: () => void;
    const pollsHeld = new Promise<void>((resolve) => (releasePolls = resolve));
    await gm.page.route(/\/gm-board\?since=\d+$/, async (route) => {
      await pollsHeld;
      // The 409 starts a fresh poll, which cancels the one held here: that
      // one can no longer be continued, and doesn't need to be.
      await route.continue().catch(() => {});
    });

    await coGm.board.openCard(cardId);
    await coGm.board.saving(() => coGm.board.cardText.fill(theirs));

    await gm.board.openCard(cardId);
    const refused = gm.page.waitForResponse(
      (r) => r.request().method() === 'POST' && r.url().endsWith('/gm-board/changes'),
    );
    await gm.board.cardText.fill(mine);
    expect((await refused).status()).toBe(409);

    // The GM's board now shows the co-GM's version and names what was lost.
    await expect(gm.board.conflictNotice).toContainText('a card');
    await expect(gm.board.mapCard(cardId)).toContainText(theirs);

    releasePolls();
    await gm.page.unroute(/\/gm-board\?since=\d+$/);
    await gm.board.saving(() => gm.board.conflictNotice.getByRole('button', { name: 'Use mine' }).click());
    await expect(gm.board.conflictNotice).toHaveCount(0);
    await expect(gm.board.mapCard(cardId)).toContainText(mine);

    // Mine is what the server kept, and the co-GM gets it at their next poll.
    const saved = await boardItem(gm.page, gm.gameId, gm.phaseId, 'card', cardId);
    expect((saved?.doc as { summary: string }).summary).toBe(mine);
    await coGm.board.nextPoll();
    await expect(coGm.board.mapCard(cardId)).toContainText(mine);
  });
});
