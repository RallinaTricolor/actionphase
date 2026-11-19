import { describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/mocks/server';
import { renderWithProviders } from '@/test-utils/render';
import type { Scoreboard, ScoreboardRow } from '@/types/scoreboard';
import { ScoreboardView } from './ScoreboardView';

const BOARD_URL = '/api/v1/games/7/scoreboard';

const row = (character_id: number, character_name: string, values: ScoreboardRow['values'] = {}): ScoreboardRow => ({
  character_id,
  character_name,
  values,
});

const makeBoard = (overrides: Partial<Scoreboard> = {}): Scoreboard => ({
  columns: [],
  sort_description: [{ key: 'name', label: 'Name', direction: 'asc' }],
  full_view: false,
  rows: [row(1, 'Ash')],
  ...overrides,
});

const serve = (board: Scoreboard) => server.use(http.get(BOARD_URL, () => HttpResponse.json(board)));

const renderBoard = async ({ isGM = false, state = 'in_progress' } = {}) => {
  renderWithProviders(<ScoreboardView gameId={7} isGM={isGM} game={{ state }} />);
  await screen.findByRole('heading', { name: 'Scoreboard' });
};

/** Every row's cells as text, position first. */
const tableRows = () =>
  screen.getAllByTestId('scoreboard-row').map((tr) =>
    Array.from(tr.children).map((cell) => cell.textContent?.trim()),
  );

describe('ScoreboardView', () => {
  it('lists characters in the server’s order, numbered by position', async () => {
    serve(makeBoard({
      columns: [{ id: 'c_score1', label: 'Score', display: 'value' }],
      sort_description: [{ key: 'c_score1', label: 'Score', direction: 'desc' }],
      rows: [
        row(3, 'Cleo', { c_score1: { value: 9 } }),
        row(1, 'Ash', { c_score1: { value: 7 } }),
      ],
    }));
    await renderBoard();

    expect(screen.getByRole('columnheader', { name: 'Score' })).toBeInTheDocument();
    expect(tableRows().map(([position, , score]) => [position, score])).toEqual([['1', '9'], ['2', '7']]);
    expect(screen.getByTestId('scoreboard-sort')).toHaveTextContent('Sorted by Score (high to low)');
  });

  it('numbers tied characters one after another, with nothing marking the tie', async () => {
    serve(makeBoard({
      columns: [{ id: 'c_score1', label: 'Score', display: 'value' }],
      rows: [row(1, 'Ash', { c_score1: { value: 7 } }), row(2, 'Bo', { c_score1: { value: 7 } })],
    }));
    await renderBoard();

    expect(tableRows().map(([position]) => position)).toEqual(['1', '2']);
  });

  it('gives a player of a hidden-score board names in order and no hint of the sort', async () => {
    serve(makeBoard({ sort_description: [], rows: [row(2, 'Bo'), row(1, 'Ash')] }));
    await renderBoard();

    expect(screen.getByTestId('scoreboard-sort')).toHaveTextContent('Ranked by the GM');
    expect(screen.getAllByRole('rowheader').map((cell) => cell.textContent)).toEqual(
      [expect.stringContaining('Bo'), expect.stringContaining('Ash')],
    );
    expect(screen.queryByText('Hidden from players')).not.toBeInTheDocument();
  });

  it('says when a player is shown only the top of the board', async () => {
    serve(makeBoard({ sort_description: [], rows: [row(2, 'Bo'), row(1, 'Ash')], top_count: 2 }));
    await renderBoard();

    expect(screen.getByTestId('scoreboard-top-count')).toHaveTextContent('Showing the top 2');
    expect(tableRows().map(([position]) => position)).toEqual(['1', '2']);
  });

  it('says nothing about a cut when the board is whole', async () => {
    serve(makeBoard());
    await renderBoard();

    expect(screen.queryByTestId('scoreboard-top-count')).not.toBeInTheDocument();
  });

  it('reads each display as the GM chose, and a missing value as a dash', async () => {
    serve(makeBoard({
      columns: [
        { id: 'c_value1', label: 'Score', display: 'value' },
        { id: 'c_track1', label: 'HP', display: 'value_max' },
        { id: 'c_bands1', label: 'State', display: 'bands' },
      ],
      rows: [
        row(1, 'Ash', { c_value1: { value: 3 }, c_track1: { value: 7, max: 12 }, c_bands1: { label: 'Bloodied' } }),
        row(2, 'Bo'),
      ],
    }));
    await renderBoard();

    expect(tableRows().map((cells) => cells.slice(2))).toEqual([
      ['3', '7 / 12', 'Bloodied'],
      ['—', '—', '—'],
    ]);
  });

  it('shows a range label’s formatting, with the number for those who may see it', async () => {
    serve(makeBoard({
      full_view: true,
      columns: [{ id: 'c_bands1', label: 'HP', display: 'bands' }],
      rows: [row(1, 'Ash', { c_bands1: { label: '[color:red]**Bloodied**[/color]', value: 6 } })],
    }));
    await renderBoard({ isGM: true });

    expect(tableRows()[0].slice(2)).toEqual(['Bloodied (6)']);
    const label = screen.getByTestId('scoreboard-label');
    expect(label.querySelector('[data-color="red"] strong')).toHaveTextContent('Bloodied');
  });

  it('marks hidden columns for the people who can see them', async () => {
    serve(makeBoard({
      full_view: true,
      columns: [
        { id: 'c_score1', label: 'Score', display: 'value', hidden: true },
        { id: 'c_hp0001', label: 'HP', display: 'value' },
      ],
    }));
    await renderBoard({ isGM: true });

    const score = screen.getByRole('columnheader', { name: /Score/ });
    expect(within(score).getByRole('img', { name: 'Hidden from players' })).toBeInTheDocument();
    const hp = screen.getByRole('columnheader', { name: 'HP' });
    expect(within(hp).queryByRole('img')).not.toBeInTheDocument();
  });

  describe('columns that lost their source', () => {
    const broken = makeBoard({
      full_view: true,
      columns: [
        { id: 'c_gone01', label: 'Renown', display: 'value' },
        { id: 'c_score1', label: 'Score', display: 'value' },
      ],
      broken_column_ids: ['c_gone01'],
    });

    it('tells the GM which, and that they block saving', async () => {
      serve(broken);
      await renderBoard({ isGM: true });

      const alert = screen.getByTestId('scoreboard-broken-columns');
      expect(alert).toHaveTextContent('Renown');
      expect(alert).not.toHaveTextContent('Score');
      expect(alert).toHaveTextContent('before saving');
    });

    it('doesn’t trouble the audience with it', async () => {
      serve(broken);
      await renderBoard({ isGM: false });
      expect(screen.queryByTestId('scoreboard-broken-columns')).not.toBeInTheDocument();
    });
  });

  it('still lists the characters when no columns are set up', async () => {
    serve(makeBoard());
    await renderBoard();

    expect(screen.getByRole('rowheader', { name: /Ash/ })).toBeInTheDocument();
  });

  it('never tells a player the board has no columns, since the GM may have hidden them all', async () => {
    serve(makeBoard());
    await renderBoard({ isGM: false });

    expect(screen.queryByText(/no columns/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Set up columns' })).not.toBeInTheDocument();
  });

  it('says so when no character qualifies', async () => {
    serve(makeBoard({ rows: [] }));
    await renderBoard();

    expect(screen.getByText('No characters on the board yet.')).toBeInTheDocument();
    expect(screen.queryByTestId('scoreboard-table')).not.toBeInTheDocument();
  });

  describe('getting to the editor', () => {
    const withColumn = makeBoard({ columns: [{ id: 'c_score1', label: 'Score', display: 'value' }] });

    it('offers the GM set-up on an empty board', async () => {
      serve(makeBoard());
      await renderBoard({ isGM: true });

      expect(screen.getByRole('button', { name: 'Set up columns' })).toBeInTheDocument();
      expect(screen.queryByTestId('edit-scoreboard')).not.toBeInTheDocument();
    });

    it('offers the GM editing once there are columns', async () => {
      serve(withColumn);
      await renderBoard({ isGM: true });

      expect(screen.getByTestId('edit-scoreboard')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Set up columns' })).not.toBeInTheDocument();
    });

    it('offers nothing to anyone else', async () => {
      serve(makeBoard());
      await renderBoard({ isGM: false });

      expect(screen.queryByRole('button', { name: 'Set up columns' })).not.toBeInTheDocument();
    });

    it.each(['completed', 'cancelled'])('offers nothing on a %s game, which can no longer change', async (state) => {
      serve(withColumn);
      await renderBoard({ isGM: true, state });

      expect(screen.queryByTestId('edit-scoreboard')).not.toBeInTheDocument();
    });

    it('still lets the GM edit during the epilogue', async () => {
      serve(withColumn);
      await renderBoard({ isGM: true, state: 'epilogue' });

      expect(screen.getByTestId('edit-scoreboard')).toBeInTheDocument();
    });
  });

  it('explains a board that has closed to this viewer', async () => {
    server.use(http.get(BOARD_URL, () => HttpResponse.json({ detail: 'Not found' }, { status: 404 })));
    renderWithProviders(<ScoreboardView gameId={7} isGM={false} game={{ state: 'in_progress' }} />);

    expect(await screen.findByText("This game's scoreboard isn't open to you.")).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument();
  });

  it('offers a retry after a failed load, and recovers', async () => {
    let healthy = false;
    server.use(http.get(BOARD_URL, () =>
      healthy ? HttpResponse.json(makeBoard()) : HttpResponse.json({ detail: 'Boom' }, { status: 500 })));
    renderWithProviders(<ScoreboardView gameId={7} isGM={false} game={{ state: 'in_progress' }} />);

    const retry = await screen.findByRole('button', { name: 'Try again' });
    healthy = true;
    await userEvent.click(retry);

    await waitFor(() => expect(screen.getByRole('rowheader', { name: /Ash/ })).toBeInTheDocument());
  });
});
