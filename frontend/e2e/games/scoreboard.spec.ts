import { test, expect, type Page, type Response } from '@playwright/test';
import { loginAs } from '../fixtures/auth-helpers';
import { getFixtureGameId } from '../fixtures/game-helpers';
import { tagTest, tags } from '../fixtures/test-tags';
import { GameDetailsPage } from '../pages/GameDetailsPage';
import { assertTabNotVisible, assertTabVisible } from '../utils/navigation';

/**
 * The scoreboard's acceptance examples (plan §8): what a player, the audience
 * and the GM each get from the same board. Which cells reach which role is
 * decided on the server, so each check that something is hidden reads the
 * network response as well as the page: a value that arrives and is merely not
 * drawn would pass a page-only check.
 *
 * Every fixture game has the same cast (35_scoreboard.sql): Ash 12, Briar 7,
 * Corin 7 and Dell with no Score, plus a pending character and an NPC that
 * never appear. Sorting by Score puts them in exactly that order, the 7-7 tie
 * broken by name and the blank last.
 *
 * Fixtures (all READ-ONLY):
 *   SCOREBOARD_PUBLIC (#722)   - board A: public, Score high to low
 *   SCOREBOARD_RANKED (#723)   - board B: public, Score hidden, high to low then name
 *   SCOREBOARD_PRIVATE (#724)  - board C: GM and audience only, Score and HP
 *   SCOREBOARD_EPILOGUE (#725) - board C's setup with Score hidden, seeded in epilogue
 *   SCOREBOARD_RANGES (#726)   - public, HP shown as Healthy / Bloodied / Critical / Down
 *   SCOREBOARD_TOP (#727)      - board A, but players see only the top 2
 */

const BOARD_ORDER = ['Ash', 'Briar', 'Corin', 'Dell'];

interface BoardResponse {
  top_count?: number;
  columns: { id: string; label: string; hidden?: boolean }[];
  sort_description: { label: string; direction: string }[];
  rows: { character_name: string; values: Record<string, { value?: number; max?: number; label?: string }> }[];
}

const isBoardRequest = (gameId: number) => (response: Response) =>
  response.request().method() === 'GET' &&
  new URL(response.url()).pathname === `/api/v1/games/${gameId}/scoreboard`;

/** Opens the Scoreboard tab and returns the board the server sent this user. */
async function openScoreboard(page: Page, gameId: number): Promise<BoardResponse> {
  const game = new GameDetailsPage(page);
  await game.goto(gameId);
  const response = page.waitForResponse(isBoardRequest(gameId));
  await game.goToTab('Scoreboard');
  return (await response).json();
}

async function columnHeadings(page: Page): Promise<string[]> {
  // Past the position (#) and Character headings.
  const headings = await page.getByTestId('scoreboard-table').locator('thead th').allInnerTexts();
  return headings.slice(2).map((text) => text.trim());
}

/** Each row as [name, ...cells], in the order shown. */
async function boardRows(page: Page): Promise<string[][]> {
  const rows = page.getByTestId('scoreboard-row');
  await expect(rows.first()).toBeVisible();
  return rows.evaluateAll((trs) =>
    trs.map((tr) => [
      (tr.querySelector('[data-testid="scoreboard-character-name"]')?.textContent ?? '').trim(),
      ...Array.from(tr.querySelectorAll('td')).slice(1).map((td) => (td.textContent ?? '').trim()),
    ]));
}

async function positions(page: Page): Promise<string[]> {
  return page.getByTestId('scoreboard-row').evaluateAll((trs) =>
    trs.map((tr) => (tr.querySelector('td')?.textContent ?? '').trim()));
}

test.describe('Scoreboard', () => {
  // Also on a phone, where the tab is a select and the values scroll inside the card.
  test(tagTest([tags.MOBILE], 'board A: a player sees every character’s score, highest first'), async ({ page }) => {
    await loginAs(page, 'PLAYER_1');
    const gameId = await getFixtureGameId(page, 'SCOREBOARD_PUBLIC');

    await openScoreboard(page, gameId);

    await expect(page.getByTestId('scoreboard-sort')).toHaveText('Sorted by Score (high to low)');
    expect(await columnHeadings(page)).toEqual(['Score']);
    // Positions only: the 7-7 tie gets 2 and 3, with nothing marking it.
    expect(await positions(page)).toEqual(['1', '2', '3', '4']);
    expect(await boardRows(page)).toEqual([
      ['Ash', '12'],
      ['Briar', '7'],
      ['Corin', '7'],
      ['Dell', '—'],
    ]);
    // The table scrolls inside its card; the page itself never scrolls sideways.
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });

  test('board B: a player gets the GM’s order but none of the hidden scores behind it', async ({ page }) => {
    await loginAs(page, 'GM');
    const gameId = await getFixtureGameId(page, 'SCOREBOARD_RANKED');
    await openScoreboard(page, gameId);
    await expect(page.getByTestId('scoreboard-table').getByRole('img', { name: 'Hidden from players' })).toBeVisible();
    const gmRows = await boardRows(page);
    expect(gmRows.map(([name]) => name)).toEqual(BOARD_ORDER);

    await loginAs(page, 'PLAYER_1');
    const sent = await openScoreboard(page, gameId);

    // What reached the browser: names in order, and nothing about Score.
    expect(sent.columns).toEqual([]);
    expect(sent.sort_description).toEqual([]);
    expect(sent.rows.map((row) => row.character_name)).toEqual(BOARD_ORDER);
    expect(sent.rows.every((row) => Object.keys(row.values).length === 0)).toBe(true);

    await expect(page.getByTestId('scoreboard-sort')).toHaveText('Ranked by the GM');
    expect(await columnHeadings(page)).toEqual([]);
    expect(await boardRows(page)).toEqual(BOARD_ORDER.map((name) => [name]));
  });

  test('board C: a GM-only board doesn’t exist for a player, and the audience sees all of it', async ({ page }) => {
    await loginAs(page, 'PLAYER_1');
    const gameId = await getFixtureGameId(page, 'SCOREBOARD_PRIVATE');

    await new GameDetailsPage(page).goto(gameId);
    await assertTabVisible(page, 'Common Room');
    await assertTabNotVisible(page, 'Scoreboard');
    const direct = await page.request.get(`/api/v1/games/${gameId}/scoreboard`);
    expect(direct.status()).toBe(404);

    await loginAs(page, 'AUDIENCE');
    await openScoreboard(page, gameId);

    expect(await columnHeadings(page)).toEqual(['Score', 'HP']);
    // No sort set up: by name.
    expect(await boardRows(page)).toEqual([
      ['Ash', '12', '11 / 12'],
      ['Briar', '7', '6 / 12'],
      ['Corin', '7', '3 / 10'],
      ['Dell', '—', '0 / 12'],
    ]);
  });

  test('board C in the epilogue: players see the whole board, hidden columns included', async ({ page }) => {
    await loginAs(page, 'PLAYER_1');
    const gameId = await getFixtureGameId(page, 'SCOREBOARD_EPILOGUE');

    const sent = await openScoreboard(page, gameId);

    // Score is hidden from players in the setup; an epilogue shows it anyway,
    // and nothing is marked hidden because nothing is.
    expect(sent.columns.map((column) => column.label)).toEqual(['Score', 'HP']);
    expect(sent.columns.some((column) => column.hidden)).toBe(false);
    expect(await columnHeadings(page)).toEqual(['Score', 'HP']);
    await expect(page.getByRole('img', { name: 'Hidden from players' })).toHaveCount(0);
    expect(await boardRows(page)).toEqual([
      ['Ash', '12', '11 / 12'],
      ['Briar', '7', '6 / 12'],
      ['Corin', '7', '3 / 10'],
      ['Dell', '—', '0 / 12'],
    ]);
  });

  test('ranges: a player sees only the range, while the GM sees the number too', async ({ page }) => {
    await loginAs(page, 'PLAYER_1');
    const gameId = await getFixtureGameId(page, 'SCOREBOARD_RANGES');

    const sent = await openScoreboard(page, gameId);

    // Labels only: no HP value or maximum reaches the player.
    const cells = sent.rows.flatMap((row) => Object.values(row.values));
    expect(cells).toHaveLength(4);
    for (const cell of cells) {
      expect(Object.keys(cell)).toEqual(['label']);
    }
    expect(await boardRows(page)).toEqual([
      ['Ash', 'Healthy'],
      ['Briar', 'Bloodied'],
      ['Corin', 'Critical'],
      ['Dell', 'Down'],
    ]);

    await loginAs(page, 'GM');
    await openScoreboard(page, gameId);
    expect(await boardRows(page)).toEqual([
      ['Ash', 'Healthy (11)'],
      ['Briar', 'Bloodied (6)'],
      ['Corin', 'Critical (3)'],
      ['Dell', 'Down (0)'],
    ]);
  });

  test('top 2: players get only the leaders, cut inside a tie, while the GM sees everyone', async ({ page }) => {
    await loginAs(page, 'PLAYER_1');
    const gameId = await getFixtureGameId(page, 'SCOREBOARD_TOP');

    const sent = await openScoreboard(page, gameId);

    // Briar and Corin tie on 7: the cut takes exactly two, by name, so nothing
    // tells players a tie was split. Corin and Dell never reach the browser.
    expect(sent.top_count).toBe(2);
    expect(sent.rows.map((row) => row.character_name)).toEqual(['Ash', 'Briar']);
    await expect(page.getByTestId('scoreboard-top-count')).toHaveText('Showing the top 2');
    expect(await boardRows(page)).toEqual([
      ['Ash', '12'],
      ['Briar', '7'],
    ]);

    await loginAs(page, 'GM');
    const full = await openScoreboard(page, gameId);
    expect(full.top_count).toBeUndefined();
    await expect(page.getByTestId('scoreboard-top-count')).toHaveCount(0);
    expect((await boardRows(page)).map(([name]) => name)).toEqual(BOARD_ORDER);
  });
});
