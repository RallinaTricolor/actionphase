import { describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/mocks/server';
import { renderWithProviders } from '@/test-utils/render';
import type { CharacterSheetConfig } from '@/types/characters';
import type { Scoreboard, ScoreboardColumn, ScoreboardConfig } from '@/types/scoreboard';
import { ScoreboardEditor } from './ScoreboardEditor';

const BASE = '/api/v1/games/7/scoreboard';

const SCORE: ScoreboardColumn = { id: 'c_score1', label: 'Score', tab_key: 'numbers', entry: 'Score', field_key: 'amount' };
const GOLD: ScoreboardColumn = { id: 'c_gold01', label: 'Gold', tab_key: 'inventory', entry: 'Gold', field_key: 'quantity' };

const PLAYER_BOARD: Scoreboard = {
  columns: [{ id: 'c_state1', label: 'State', display: 'bands' }],
  sort_description: [],
  full_view: false,
  rows: [{ character_id: 1, character_name: 'Ash', values: { c_state1: { label: 'Winning' } } }],
};

interface Setup {
  config?: ScoreboardConfig;
  entryNames?: Record<string, string[]>;
  game?: { state?: string; character_sheet?: CharacterSheetConfig };
}

/** Serves the editor's data, records what it sends, and opens it. */
async function openEditor({
  config = {},
  entryNames = { numbers: ['Renown', 'Score'], inventory: ['Gold'] },
  game = { state: 'in_progress' },
}: Setup = {}) {
  const saved: ScoreboardConfig[] = [];
  const previewed: ScoreboardConfig[] = [];
  server.use(
    http.get(`${BASE}/config`, () => HttpResponse.json(config)),
    http.get(`${BASE}/entry-names`, () => HttpResponse.json({
      tabs: Object.entries(entryNames).map(([tab_key, entry_names]) => ({ tab_key, entry_names })),
    })),
    http.put(`${BASE}/config`, async ({ request }) => {
      const body = await request.json() as ScoreboardConfig;
      saved.push(body);
      return HttpResponse.json(body);
    }),
    http.post(`${BASE}/preview`, async ({ request }) => {
      previewed.push(await request.json() as ScoreboardConfig);
      return HttpResponse.json(PLAYER_BOARD);
    }),
  );
  const onClose = vi.fn();
  renderWithProviders(<ScoreboardEditor gameId={7} game={game} onClose={onClose} />);
  await screen.findByRole('heading', { name: 'Edit scoreboard' });
  return { saved, previewed, onClose, user: userEvent.setup() };
}

type User = ReturnType<typeof userEvent.setup>;

const columnCard = (name: string) => {
  const card = screen.getAllByTestId('scoreboard-column-editor')
    .find((candidate) => within(candidate).queryByRole('heading', { name: new RegExp(`^${name}`) }));
  if (!card) throw new Error(`No column called ${name}`);
  return within(card);
};

/** The always-present "Add a column" picker, which is the last one on the page. */
const addPicker = () => within(screen.getAllByTestId('scoreboard-column-picker').at(-1)!);

async function addColumn(user: User, entry: string) {
  await user.click(addPicker().getByRole('combobox', { name: 'Entry' }));
  await user.click(await screen.findByRole('option', { name: entry }));
  await user.click(addPicker().getByRole('button', { name: 'Add column' }));
}

const save = (user: User) => user.click(screen.getByTestId('save-scoreboard'));

async function showRanges(user: User, name: string) {
  await user.selectOptions(columnCard(name).getByLabelText('Cells show'), 'bands');
}

describe('ScoreboardEditor', () => {
  it('adds a column from the names characters use, and saves the whole setup', async () => {
    const { user, saved, onClose } = await openEditor({ config: { columns: [SCORE] } });

    await addColumn(user, 'Renown');
    await save(user);

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(saved).toHaveLength(1);
    expect(saved[0].columns).toEqual([
      SCORE,
      { id: expect.stringMatching(/^c_[a-z0-9]{6}$/), label: 'Renown', tab_key: 'numbers', entry: 'Renown', field_key: 'amount' },
    ]);
  });

  it('takes an entry no character has yet', async () => {
    const { user, saved } = await openEditor();

    await user.type(addPicker().getByRole('combobox', { name: 'Entry' }), 'Infamy');
    await user.click(await screen.findByRole('option', { name: 'Use “Infamy”' }));
    await user.click(addPicker().getByRole('button', { name: 'Add column' }));
    await save(user);

    await waitFor(() => expect(saved).toHaveLength(1));
    expect(saved[0].columns?.[0]).toMatchObject({ entry: 'Infamy', label: 'Infamy' });
  });

  it('still works when the entry names can’t be loaded', async () => {
    server.use(http.get(`${BASE}/config`, () => HttpResponse.json({})));
    server.use(http.get(`${BASE}/entry-names`, () => HttpResponse.json({ detail: 'Boom' }, { status: 500 })));
    renderWithProviders(<ScoreboardEditor gameId={7} game={{}} onClose={vi.fn()} />);

    expect(await screen.findByRole('heading', { name: 'Edit scoreboard' }, { timeout: 5000 })).toBeInTheDocument();
    expect(addPicker().getByRole('combobox', { name: 'Entry' })).toBeInTheDocument();
  });

  it('asks which field only when the tab has several numbers', async () => {
    const { user, saved } = await openEditor();
    expect(addPicker().queryByLabelText('Field')).not.toBeInTheDocument();

    await user.selectOptions(addPicker().getByLabelText('Sheet tab'), 'inventory');
    await user.selectOptions(addPicker().getByLabelText('Field'), 'weight');
    await addColumn(user, 'Gold');
    await save(user);

    await waitFor(() => expect(saved).toHaveLength(1));
    expect(saved[0].columns?.[0]).toMatchObject({ tab_key: 'inventory', entry: 'Gold', field_key: 'weight' });
  });

  it('has nothing to save until something changes, and nothing once it’s changed back', async () => {
    const { user } = await openEditor({ config: { columns: [SCORE] } });
    const saveButton = screen.getByTestId('save-scoreboard');
    expect(saveButton).toBeDisabled();

    const heading = columnCard('Score').getByLabelText('Heading');
    await user.type(heading, '!');
    expect(saveButton).toBeEnabled();

    await user.type(heading, '{Backspace}');
    expect(saveButton).toBeDisabled();
  });

  it('saves visibility, heading, hiding and column order', async () => {
    const { user, saved } = await openEditor({ config: { columns: [SCORE, GOLD] } });

    await user.selectOptions(screen.getByLabelText('Who can see the board'), 'public');
    await user.clear(columnCard('Score').getByLabelText('Heading'));
    await user.type(screen.getAllByLabelText('Heading')[0], 'Points');
    await user.click(columnCard('Points').getByRole('switch', { name: /Hide from players/ }));
    await user.click(columnCard('Gold').getByRole('button', { name: 'Move Gold up' }));
    await save(user);

    await waitFor(() => expect(saved).toHaveLength(1));
    expect(saved[0]).toEqual({
      visibility: 'public',
      columns: [GOLD, { ...SCORE, label: 'Points', hidden: true }],
    });
  });

  it('won’t save a column without a heading', async () => {
    const { user } = await openEditor({ config: { columns: [SCORE] } });

    await user.clear(columnCard('Score').getByLabelText('Heading'));

    expect(screen.getByText('Add a heading')).toBeInTheDocument();
    expect(screen.getByTestId('save-scoreboard')).toBeDisabled();
  });

  it('offers value of max only on a track', async () => {
    await openEditor({ config: { columns: [SCORE, GOLD] } });

    const options = (name: string) =>
      within(columnCard(name).getByLabelText('Cells show')).getAllByRole('option').map((option) => option.textContent);
    expect(options('Score')).toEqual(['Value', 'Value of max', 'Ranges']);
    expect(options('Gold')).toEqual(['Value', 'Ranges']);
  });

  it('removes a column only after asking, along with its place in the sort', async () => {
    const { user, saved } = await openEditor({
      config: { columns: [SCORE, GOLD], sort: [{ key: 'c_score1', direction: 'desc' }] },
    });

    await user.click(columnCard('Score').getByRole('button', { name: 'Remove Score' }));
    const confirmation = columnCard('Score').getByRole('alertdialog');
    expect(confirmation).toHaveTextContent('stop sorting by it');
    await user.click(within(confirmation).getByRole('button', { name: 'Keep' }));
    expect(columnCard('Score').queryByRole('alertdialog')).not.toBeInTheDocument();

    await user.click(columnCard('Score').getByRole('button', { name: 'Remove Score' }));
    await user.click(within(columnCard('Score').getByRole('alertdialog')).getByRole('button', { name: 'Remove' }));
    await save(user);

    await waitFor(() => expect(saved).toHaveLength(1));
    expect(saved[0]).toEqual({ columns: [GOLD] });
  });

  it('points out two columns reading the same value', async () => {
    await openEditor({ config: { columns: [SCORE, { ...SCORE, id: 'c_score2', label: 'Hidden score' }] } });

    expect(columnCard('Score').getByText('Another column reads the same value.')).toBeInTheDocument();
  });

  it('stops at the column limit', async () => {
    const columns = Array.from({ length: 10 }, (_, i) => ({ ...SCORE, id: `c_col00${i}`, label: `Column ${i}` }));
    await openEditor({ config: { columns } });

    expect(screen.getByText('A board can have 10 columns.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add column' })).not.toBeInTheDocument();
  });

  describe('ranges', () => {
    it('saves a range written as the GM would say it', async () => {
      const { user, saved } = await openEditor({ config: { columns: [SCORE] } });

      await showRanges(user, 'Score');
      await user.type(screen.getByLabelText('Range 1 lower bound'), '5');
      await user.selectOptions(screen.getByLabelText('Range 1 lower comparison'), 'strict');
      await user.type(screen.getByLabelText('Range 1 upper bound'), '10');
      await user.selectOptions(screen.getByLabelText('Range 1 upper comparison'), 'strict');
      await user.type(screen.getByLabelText('Range 1 label'), 'Bloodied');
      await user.type(screen.getByLabelText(/Label when no range matches/), 'Unknown');
      await save(user);

      await waitFor(() => expect(saved).toHaveLength(1));
      expect(saved[0].columns?.[0]).toEqual({
        ...SCORE,
        display: 'bands',
        bands: [{ label: 'Bloodied', min: 5, min_strict: true, max: 10, max_strict: true }],
        fallback_label: 'Unknown',
      });
    });

    const twoRanges = {
      ...SCORE,
      display: 'bands' as const,
      bands: [{ label: 'Low', max: 5 }, { label: 'High', min: 5 }],
    };

    it('keeps rows in the order the GM puts them', async () => {
      const { user, saved } = await openEditor({ config: { columns: [twoRanges] } });

      await user.click(screen.getByRole('button', { name: 'Move range 2 up' }));
      await save(user);

      await waitFor(() => expect(saved).toHaveLength(1));
      expect(saved[0].columns?.[0].bands?.map((band) => band.label)).toEqual(['High', 'Low']);
    });

    it('removes a row only after asking', async () => {
      const { user, saved } = await openEditor({ config: { columns: [twoRanges] } });

      await user.click(screen.getByRole('button', { name: 'Remove range 1' }));
      const confirmation = screen.getByRole('alertdialog');
      expect(confirmation).toHaveTextContent('Low');
      await user.click(within(confirmation).getByRole('button', { name: 'Remove' }));
      await save(user);

      await waitFor(() => expect(saved).toHaveLength(1));
      expect(saved[0].columns?.[0].bands).toEqual([{ label: 'High', min: 5 }]);
    });

    it('tests a value against the ranges, first match winning', async () => {
      const { user } = await openEditor({ config: { columns: [twoRanges] } });

      await user.type(screen.getByLabelText('Test a value'), '5');
      expect(screen.getByTestId('scoreboard-band-test-result')).toHaveTextContent('Shows Low');

      await user.type(screen.getByLabelText('Test a value'), '0');
      expect(screen.getByTestId('scoreboard-band-test-result')).toHaveTextContent('Shows High');
    });

    it('says a value matching nothing shows a blank, never the number', async () => {
      const { user } = await openEditor({
        config: { columns: [{ ...SCORE, display: 'bands', bands: [{ label: 'High', min: 100 }] }] },
      });

      await user.type(screen.getByLabelText('Test a value'), '7');
      expect(screen.getByTestId('scoreboard-band-test-result')).toHaveTextContent('Shows a blank cell');
    });

    it('saves a formatted label as written, counting only its text', async () => {
      const { user, saved } = await openEditor({ config: { columns: [SCORE] } });
      const label = `[color:red]**${'x'.repeat(24)}**[/color]`;

      await showRanges(user, 'Score');
      await user.type(screen.getByLabelText('Range 1 lower bound'), '0');
      await user.click(screen.getByLabelText('Range 1 label'));
      await user.paste(label);
      expect(screen.queryByText(/not counting formatting$/)).not.toBeInTheDocument();
      await save(user);

      await waitFor(() => expect(saved).toHaveLength(1));
      expect(saved[0].columns?.[0].bands).toEqual([{ label, min: 0 }]);
    });

    it('won’t save a label whose text is too long, or that is only formatting', async () => {
      const { user } = await openEditor({ config: { columns: [SCORE] } });

      await showRanges(user, 'Score');
      await user.type(screen.getByLabelText('Range 1 lower bound'), '0');
      await user.click(screen.getByLabelText('Range 1 label'));
      await user.paste(`[color:red]${'x'.repeat(25)}[/color]`);
      expect(screen.getByText('Keep it to 24 characters, not counting formatting')).toBeInTheDocument();
      expect(screen.getByTestId('save-scoreboard')).toBeDisabled();

      await user.clear(screen.getByLabelText('Range 1 label'));
      await user.type(screen.getByLabelText('Range 1 label'), 'Low');
      expect(screen.getByTestId('save-scoreboard')).toBeEnabled();

      await user.click(screen.getByLabelText(/Label when no range matches/));
      await user.paste('[color:gray]**[/color]');
      expect(screen.getByText('Add some text, not just formatting')).toBeInTheDocument();
      expect(screen.getByTestId('save-scoreboard')).toBeDisabled();
    });

    it('won’t save a range just added until it has a label and a bound', async () => {
      const { user, saved } = await openEditor({ config: { columns: [SCORE] } });

      await showRanges(user, 'Score');
      expect(screen.getByTestId('scoreboard-bands-problem')).toHaveTextContent('Range 1 needs a label');
      expect(screen.getByTestId('scoreboard-editor-blocked')).toHaveTextContent('Finish the columns marked above to save.');
      expect(screen.getByTestId('save-scoreboard')).toBeDisabled();

      await user.type(screen.getByLabelText('Range 1 label'), 'Low');
      expect(screen.getByTestId('scoreboard-bands-problem')).toHaveTextContent('Range 1 needs a lower or upper bound');
      expect(screen.getByTestId('save-scoreboard')).toBeDisabled();

      await user.type(screen.getByLabelText('Range 1 upper bound'), '5');
      expect(screen.queryByTestId('scoreboard-bands-problem')).not.toBeInTheDocument();
      expect(screen.queryByTestId('scoreboard-editor-blocked')).not.toBeInTheDocument();
      await save(user);

      await waitFor(() => expect(saved).toHaveLength(1));
      expect(saved[0].columns?.[0].bands).toEqual([{ label: 'Low', max: 5 }]);
    });

    it('won’t save a range that can never match', async () => {
      const { user } = await openEditor({ config: { columns: [twoRanges] } });

      await user.type(screen.getByLabelText('Range 2 upper bound'), '1');

      expect(screen.getByTestId('scoreboard-bands-problem')).toHaveTextContent('Range 2 can never match');
      expect(screen.getByTestId('save-scoreboard')).toBeDisabled();
    });

    it('shows the label’s formatting when testing a value', async () => {
      const { user } = await openEditor({
        config: { columns: [{ ...SCORE, display: 'bands', bands: [{ label: '[color:red]**Low**[/color]', max: 5 }] }] },
      });

      await user.type(screen.getByLabelText('Test a value'), '3');
      const result = screen.getByTestId('scoreboard-band-test-result');
      expect(result).toHaveTextContent('Shows Low');
      expect(result.querySelector('[data-color="red"] strong')).toHaveTextContent('Low');
    });

    it('warns about an overlap', async () => {
      await openEditor({ config: { columns: [twoRanges] } });

      expect(screen.getByTestId('scoreboard-band-warnings'))
        .toHaveTextContent('“Low” and “High” overlap. “Low” is higher in the list');
    });

    it('warns about a gap until a label covers it', async () => {
      const { user } = await openEditor({
        config: { columns: [{ ...SCORE, display: 'bands', bands: [{ label: 'High', min: 10 }] }] },
      });
      expect(screen.getByTestId('scoreboard-band-warnings')).toHaveTextContent('No range covers Score < 10');

      await user.type(screen.getByLabelText(/Label when no range matches/), 'Low');
      expect(screen.queryByTestId('scoreboard-band-warnings')).not.toBeInTheDocument();
    });

    it('can measure a track as a percentage, but not a plain number', async () => {
      const { user, saved } = await openEditor({ config: { columns: [SCORE, GOLD] } });

      await showRanges(user, 'Gold');
      expect(columnCard('Gold').queryByLabelText('Ranges measure')).not.toBeInTheDocument();
      await user.selectOptions(columnCard('Gold').getByLabelText('Cells show'), 'value');

      await showRanges(user, 'Score');
      await user.selectOptions(columnCard('Score').getByLabelText('Ranges measure'), 'percent');
      expect(columnCard('Score').getByLabelText('Test a percentage')).toBeInTheDocument();
      await user.type(screen.getByLabelText('Range 1 upper bound'), '50');
      await user.type(screen.getByLabelText('Range 1 label'), 'Bloodied');
      await save(user);

      await waitFor(() => expect(saved).toHaveLength(1));
      expect(saved[0].columns?.[0]).toMatchObject({ band_basis: 'percent', bands: [{ label: 'Bloodied', max: 50 }] });
      expect(saved[0].columns?.[1]).toEqual(GOLD);
    });

    it('sends no ranges for a column switched back to a value, and restores them if switched again', async () => {
      const { user, saved } = await openEditor({ config: { columns: [twoRanges] } });

      await user.selectOptions(columnCard('Score').getByLabelText('Cells show'), 'value');
      await showRanges(user, 'Score');
      expect(screen.getByLabelText('Range 2 label')).toHaveValue('High');

      await user.selectOptions(columnCard('Score').getByLabelText('Cells show'), 'value');
      await save(user);

      await waitFor(() => expect(saved).toHaveLength(1));
      expect(saved[0].columns?.[0]).toEqual(SCORE);
    });
  });

  describe('sorting', () => {
    it('saves a primary and a secondary key, starting columns at high to low', async () => {
      const { user, saved } = await openEditor({ config: { columns: [SCORE, GOLD] } });

      await user.selectOptions(screen.getByLabelText('Sort by'), 'c_score1');
      expect(screen.getByRole('combobox', { name: 'Order' })).toHaveValue('desc');
      await user.selectOptions(screen.getByLabelText('Then by'), 'name');
      await user.selectOptions(screen.getByLabelText('Then order'), 'desc');
      await save(user);

      await waitFor(() => expect(saved).toHaveLength(1));
      expect(saved[0].sort).toEqual([
        { key: 'c_score1', direction: 'desc' },
        { key: 'name', direction: 'desc' },
      ]);
    });

    it('doesn’t let one key be used twice', async () => {
      const { user, saved } = await openEditor({
        config: { columns: [SCORE], sort: [{ key: 'name', direction: 'asc' }, { key: 'c_score1', direction: 'desc' }] },
      });

      expect(within(screen.getByLabelText('Then by')).queryByRole('option', { name: 'Name' })).not.toBeInTheDocument();
      await user.selectOptions(screen.getByLabelText('Sort by'), 'c_score1');
      expect(screen.getByLabelText('Then by')).toHaveValue('');
      await save(user);

      await waitFor(() => expect(saved).toHaveLength(1));
      expect(saved[0].sort).toEqual([{ key: 'c_score1', direction: 'desc' }]);
    });

    it('explains what players get when the order rests on a hidden column', async () => {
      await openEditor({
        config: { columns: [{ ...SCORE, hidden: true }], sort: [{ key: 'c_score1', direction: 'desc' }] },
      });

      expect(screen.getByTestId('scoreboard-sort-hidden-note')).toHaveTextContent('Ranked by the GM');
      expect(screen.getByRole('option', { name: 'Score (hidden)', hidden: false })).toBeInTheDocument();
    });

    it('warns that sorting by ranges gives away the order within them', async () => {
      await openEditor({
        config: {
          columns: [{ ...SCORE, display: 'bands', bands: [{ label: 'Any', min: 0 }] }],
          sort: [{ key: 'c_score1', direction: 'desc' }],
        },
      });

      expect(screen.getByTestId('scoreboard-sort-ranges-note')).toBeInTheDocument();
    });
  });

  describe('showing players only the top', () => {
    const scoreOrder: ScoreboardConfig = { columns: [SCORE], sort: [{ key: 'c_score1', direction: 'desc' }] };

    it('saves how many rows players see', async () => {
      const { user, saved } = await openEditor({ config: scoreOrder });

      await user.type(screen.getByLabelText(/Players see only the top/), '3');
      await save(user);

      await waitFor(() => expect(saved).toHaveLength(1));
      expect(saved[0]).toEqual({ ...scoreOrder, top_count: 3 });
    });

    it('saves every row again once the box is cleared', async () => {
      const { user, saved } = await openEditor({ config: { ...scoreOrder, top_count: 3 } });

      await user.clear(screen.getByLabelText(/Players see only the top/));
      await save(user);

      await waitFor(() => expect(saved).toHaveLength(1));
      expect(saved[0]).toEqual(scoreOrder);
    });

    it.each(['0', '51', '2.5'])('won’t save %s', async (typed) => {
      const { user } = await openEditor({ config: scoreOrder });

      await user.type(screen.getByLabelText(/Players see only the top/), typed);

      expect(screen.getByText('Enter a whole number from 1 to 50')).toBeInTheDocument();
      expect(screen.getByTestId('save-scoreboard')).toBeDisabled();
    });

    it('points out that a board in name order cuts by name', async () => {
      const { user } = await openEditor({ config: { columns: [SCORE] } });

      await user.type(screen.getByLabelText(/Players see only the top/), '3');

      expect(screen.getByTestId('scoreboard-top-count-name-note')).toHaveTextContent('first 3 by name');
      await user.selectOptions(screen.getByLabelText('Sort by'), 'c_score1');
      expect(screen.queryByTestId('scoreboard-top-count-name-note')).not.toBeInTheDocument();
    });

    it('previews the cut players would get', async () => {
      const { user, previewed } = await openEditor({ config: scoreOrder });
      server.use(http.post(`${BASE}/preview`, async ({ request }) => {
        previewed.push(await request.json() as ScoreboardConfig);
        return HttpResponse.json({ ...PLAYER_BOARD, top_count: 1 });
      }));

      await user.type(screen.getByLabelText(/Players see only the top/), '1');
      await user.click(screen.getByTestId('scoreboard-preview-toggle'));

      expect(await screen.findByTestId('scoreboard-preview-top-count')).toHaveTextContent('Showing the top 1');
      expect(previewed.at(-1)).toEqual({ ...scoreOrder, top_count: 1 });
    });
  });

  describe('a column that lost its source', () => {
    const broken: ScoreboardColumn = { id: 'c_gone01', label: 'Renown', tab_key: 't_gone00', entry: 'Renown', field_key: 'f_gone00' };

    it('blocks saving until it has a new source', async () => {
      const { user, saved } = await openEditor({ config: { columns: [broken] } });

      expect(columnCard('Renown').getByTestId('scoreboard-column-broken')).toBeInTheDocument();
      expect(screen.getByTestId('scoreboard-editor-blocked')).toBeInTheDocument();

      // Any other change would otherwise make the draft saveable.
      await user.selectOptions(screen.getByLabelText('Who can see the board'), 'public');
      expect(screen.getByTestId('save-scoreboard')).toBeDisabled();

      await user.click(columnCard('Renown').getByRole('combobox', { name: 'Entry' }));
      await user.click(await screen.findByRole('option', { name: 'Score' }));
      await user.click(columnCard('Renown').getByRole('button', { name: 'Use this source' }));

      expect(screen.queryByTestId('scoreboard-editor-blocked')).not.toBeInTheDocument();
      await save(user);
      await waitFor(() => expect(saved).toHaveLength(1));
      expect(saved[0].columns?.[0]).toMatchObject({ tab_key: 'numbers', entry: 'Score', field_key: 'amount' });
    });

    it('can simply be removed', async () => {
      const { user } = await openEditor({ config: { columns: [broken] } });

      await user.click(columnCard('Renown').getByRole('button', { name: 'Remove Renown' }));
      await user.click(within(columnCard('Renown').getByRole('alertdialog')).getByRole('button', { name: 'Remove' }));

      expect(screen.queryByTestId('scoreboard-editor-blocked')).not.toBeInTheDocument();
      expect(screen.getByTestId('save-scoreboard')).toBeEnabled();
    });
  });

  it('can move a healthy column to another source', async () => {
    const { user, saved } = await openEditor({ config: { columns: [{ ...SCORE, display: 'value_max' }] } });

    await user.click(columnCard('Score').getByRole('button', { name: 'Change source' }));
    await user.selectOptions(columnCard('Score').getByLabelText('Sheet tab'), 'inventory');
    await user.click(columnCard('Score').getByRole('combobox', { name: 'Entry' }));
    await user.click(await screen.findByRole('option', { name: 'Gold' }));
    await user.click(columnCard('Score').getByRole('button', { name: 'Use this source' }));
    await save(user);

    await waitFor(() => expect(saved).toHaveLength(1));
    expect(saved[0].columns?.[0]).toEqual({ ...GOLD, id: SCORE.id });
  });

  it('shows why the server refused, and keeps the draft', async () => {
    const { user, onClose } = await openEditor({ config: { columns: [SCORE] } });
    server.use(http.put(`${BASE}/config`, () =>
      HttpResponse.json({ detail: 'Column "Score!" needs a label' }, { status: 422 })));

    await user.type(columnCard('Score').getByLabelText('Heading'), '!');
    await save(user);

    expect(await screen.findByText('Column "Score!" needs a label')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getAllByLabelText('Heading')[0]).toHaveValue('Score!');
  });

  describe('previewing as a player', () => {
    it('shows the server’s player board for the unsaved setup, and saves nothing', async () => {
      const { user, saved, previewed } = await openEditor({ config: { columns: [SCORE] } });
      await user.click(columnCard('Score').getByRole('switch', { name: /Hide from players/ }));

      await user.click(screen.getByTestId('scoreboard-preview-toggle'));

      const preview = within(await screen.findByTestId('scoreboard-preview'));
      expect(preview.getByRole('columnheader', { name: 'State' })).toBeInTheDocument();
      expect(preview.getByText('Winning')).toBeInTheDocument();
      expect(preview.getByTestId('scoreboard-preview-sort')).toHaveTextContent('Ranked by the GM');
      expect(previewed).toEqual([{ columns: [{ ...SCORE, hidden: true }] }]);
      expect(saved).toEqual([]);
    });

    it('says players can’t open a board that is still GM and audience only', async () => {
      const { user } = await openEditor();
      await user.click(screen.getByTestId('scoreboard-preview-toggle'));

      expect(await screen.findByText(/Players can't open this board yet/)).toBeInTheDocument();
    });

    it('doesn’t say so once the draft opens it to everyone', async () => {
      const { user } = await openEditor();
      await user.selectOptions(screen.getByLabelText('Who can see the board'), 'public');
      await user.click(screen.getByTestId('scoreboard-preview-toggle'));

      await screen.findByTestId('scoreboard-preview');
      expect(screen.queryByText(/Players can't open this board yet/)).not.toBeInTheDocument();
    });

    it('returns to the same draft', async () => {
      const { user } = await openEditor({ config: { columns: [SCORE] } });
      await user.type(columnCard('Score').getByLabelText('Heading'), '!');

      await user.click(screen.getByTestId('scoreboard-preview-toggle'));
      await screen.findByTestId('scoreboard-preview');
      await user.click(screen.getByRole('button', { name: 'Back to editing' }));

      expect(screen.getByLabelText('Heading')).toHaveValue('Score!');
    });

    it('names what’s wrong with a draft it can’t show', async () => {
      const { user } = await openEditor({ config: { columns: [SCORE] } });
      server.use(http.post(`${BASE}/preview`, () =>
        HttpResponse.json({ detail: 'Column "Score" range 1 needs a label' }, { status: 422 })));

      await user.click(screen.getByTestId('scoreboard-preview-toggle'));

      expect(await screen.findByTestId('scoreboard-preview-error')).toHaveTextContent('range 1 needs a label');
    });
  });

  describe('leaving', () => {
    it('leaves at once with nothing to lose', async () => {
      const { user, onClose } = await openEditor();

      await user.click(screen.getByRole('button', { name: 'Cancel' }));

      expect(onClose).toHaveBeenCalled();
    });

    it('asks before throwing changes away', async () => {
      const { user, onClose } = await openEditor({ config: { columns: [SCORE] } });
      await user.type(columnCard('Score').getByLabelText('Heading'), '!');

      await user.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(onClose).not.toHaveBeenCalled();
      const dialog = within(await screen.findByTestId('discard-draft-modal'));

      await user.click(dialog.getByRole('button', { name: 'Keep editing' }));
      expect(onClose).not.toHaveBeenCalled();
      expect(screen.getByLabelText('Heading')).toHaveValue('Score!');

      await user.click(screen.getByRole('button', { name: 'Cancel' }));
      await user.click(within(await screen.findByTestId('discard-draft-modal')).getByRole('button', { name: 'Discard' }));
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('explains a setup that didn’t load, with a way back', async () => {
    server.use(
      http.get(`${BASE}/config`, () => HttpResponse.json({ detail: 'Boom' }, { status: 500 })),
      http.get(`${BASE}/entry-names`, () => HttpResponse.json({ tabs: [] })),
    );
    const onClose = vi.fn();
    renderWithProviders(<ScoreboardEditor gameId={7} game={{}} onClose={onClose} />);

    await userEvent.click(await screen.findByRole('button', { name: 'Back to the board' }, { timeout: 5000 }));
    expect(onClose).toHaveBeenCalled();
  });
});
