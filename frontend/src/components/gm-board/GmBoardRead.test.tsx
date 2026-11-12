import { describe, it, expect, beforeEach } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/mocks/server';
import { renderWithProviders } from '@/test-utils/render';
import { makeActionWithDetails, makeCharacter, makeGamePhase, makeGameWithDetails, makeGmItem } from '@/test-utils/factories';
import type { BoardItemChange, GmItem, SettingsItemChange } from '@/types/gmBoard';
import { GmBoard } from './GmBoard';

// Hand-written test data; never player content.
const GAME_ID = 7;
const PHASE_ID = 70;
const phase = makeGamePhase({ id: PHASE_ID, game_id: GAME_ID, phase_type: 'action', title: 'Day 2' });
const BOARD = `/api/v1/games/${GAME_ID}/phases/${PHASE_ID}/gm-board`;
const SETTINGS = `/api/v1/games/${GAME_ID}/gm-settings`;

const HARRISON = [
  '## Plan',
  '',
  'I sneak into the Old Mill at dusk and wait by the wheel.',
  '',
  'If the dogs bark, I run for the dock.',
].join('\n');

let board: Map<string, GmItem>;
let settings: Map<string, GmItem>;
let boardSaves: BoardItemChange[];
let settingsSaves: SettingsItemChange[];
let seq: number;

function serveItems<C extends BoardItemChange | SettingsItemChange>(store: Map<string, GmItem>, saves: C[]) {
  return async ({ request }: { request: Request }) => {
    const { changes } = (await request.json()) as { changes: C[] };
    const items = changes.map((c) => {
      saves.push(c);
      const item = makeGmItem({ kind: c.kind, key: c.key, version: c.base_version + 1, seq: ++seq, doc: c.doc, deleted: !!c.deleted });
      store.set(`${c.kind}/${c.key}`, item);
      return item;
    });
    return HttpResponse.json({ items });
  };
}

beforeEach(() => {
  seq = 10;
  boardSaves = [];
  settingsSaves = [];
  board = new Map();
  settings = new Map([
    ['codex/cx-mill', makeGmItem({ kind: 'codex', key: 'cx-mill', doc: { type: 'Location', name: 'the Old Mill' } })],
    ['codex/cx-dock', makeGmItem({ kind: 'codex', key: 'cx-dock', doc: { type: 'Location', name: 'dock' } })],
  ]);
  server.use(
    http.get(`/api/v1/games/${GAME_ID}/details`, () => HttpResponse.json(makeGameWithDetails({ id: GAME_ID, gm_user_id: 1, state: 'in_progress' }))),
    http.get(`/api/v1/games/${GAME_ID}/characters`, () =>
      HttpResponse.json([
        makeCharacter({ id: 1, game_id: GAME_ID, name: 'Harrison Vale' }),
        makeCharacter({ id: 2, game_id: GAME_ID, name: 'Mara' }),
        makeCharacter({ id: 3, game_id: GAME_ID, name: 'Ilse' }),
        makeCharacter({ id: 9, game_id: GAME_ID, name: 'Bo Hale', character_type: 'npc' }),
      ]),
    ),
    http.get(`/api/v1/games/${GAME_ID}/actions`, () =>
      HttpResponse.json([
        makeActionWithDetails({ id: 1, game_id: GAME_ID, phase_id: PHASE_ID, character_id: 1, content: HARRISON }),
        makeActionWithDetails({ id: 2, game_id: GAME_ID, phase_id: PHASE_ID, character_id: 2, content: 'I follow Harrison to the mill.' }),
        makeActionWithDetails({ id: 3, game_id: GAME_ID, phase_id: PHASE_ID, character_id: 3, content: 'I fish at the dock.' }),
        makeActionWithDetails({ id: 4, game_id: GAME_ID, phase_id: 69, character_id: 1, content: 'An older phase.' }),
        makeActionWithDetails({ id: 5, game_id: GAME_ID, phase_id: PHASE_ID, content: 'No character.' }),
      ]),
    ),
    http.get(`/api/v1/games/${GAME_ID}/phases`, () => HttpResponse.json([phase])),
    http.get(BOARD, () => HttpResponse.json({ items: [...board.values()].filter((i) => !i.deleted), cursor: seq })),
    http.post(`${BOARD}/changes`, serveItems(board, boardSaves)),
    http.get(SETTINGS, () => HttpResponse.json({ items: [...settings.values()].filter((i) => !i.deleted), cursor: seq, share_gm_board: false })),
    http.post(`${SETTINGS}/changes`, serveItems(settings, settingsSaves)),
  );
});

const renderRead = (query = '') =>
  renderWithProviders(<GmBoard gameId={GAME_ID} gameTitle="Starfall" phase={phase} />, {
    gameId: GAME_ID,
    initialRoute: `/games/${GAME_ID}/phases/${PHASE_ID}/board${query}`,
  });

const waitForBoardSave = (match: (c: BoardItemChange) => boolean) =>
  waitFor(() => expect(boardSaves.some(match)).toBe(true), { timeout: 3000 });

const paragraph = (index: number) => screen.getByTestId(`submission-block-${index}`);

describe('GmBoardRead', () => {
  it('lists this phase’s submitters and opens the first', async () => {
    renderRead();
    const list = await screen.findByTestId('read-player-list');
    expect(within(list).getByText('0/3 read')).toBeInTheDocument();
    expect(within(list).getAllByRole('button').map((b) => b.textContent)).toEqual(['Harrison Vale0', 'Mara0', 'Ilse0']);
    expect(await screen.findByRole('heading', { name: 'Harrison Vale' })).toBeInTheDocument();
    expect(screen.getByText(/1 submission has no character/)).toBeInTheDocument();
    expect(screen.queryByText('An older phase.')).not.toBeInTheDocument();
  });

  it('cards a whole paragraph where it says, making the board’s first time slots', async () => {
    renderRead();
    await screen.findByText(/I sneak into the Old Mill/);
    await userEvent.click(within(paragraph(0)).getByRole('button', { name: '+ Whole paragraph' }));

    expect(await screen.findByText('Card added to the Old Mill · Slot 1.')).toBeInTheDocument();
    await waitForBoardSave((c) => c.kind === 'card');
    const card = boardSaves.find((c) => c.kind === 'card');
    expect(card?.doc).toMatchObject({
      characterId: 1,
      quote: 'I sneak into the Old Mill at dusk and wait by the wheel.',
      locationId: 'cx-mill',
      chunkId: 'slot-1',
      src: [0],
      isIF: false,
      outcome: 'pending',
    });
    expect(boardSaves.filter((c) => c.kind === 'chunk').map((c) => [c.key, (c.doc as { name: string }).name])).toEqual([
      ['pre', 'Pre-Scenario'],
      ['slot-1', 'Slot 1'],
      ['slot-2', 'Slot 2'],
      ['slot-3', 'Slot 3'],
    ]);
    expect(within(paragraph(0)).getByText('1')).toBeInTheDocument();
    expect(within(screen.getByTestId('read-sidebar')).getByText('Board cards (1)')).toBeInTheDocument();
  });

  it('cards a paragraph as an IF card waiting in Contingencies, with its condition', async () => {
    renderRead();
    await screen.findByText(/If the dogs bark/);
    await userEvent.click(within(paragraph(1)).getByRole('button', { name: '+ as IF' }));

    expect(await screen.findByText('IF card added to Contingencies until it triggers.')).toBeInTheDocument();
    await waitForBoardSave((c) => c.kind === 'card');
    expect(boardSaves.find((c) => c.kind === 'card')?.doc).toMatchObject({
      isIF: true,
      chunkId: null,
      cond: 'If the dogs bark',
      locationId: 'cx-dock',
      src: [1],
    });
  });

  it('cards selected text from the toolbar', async () => {
    renderRead();
    const text = await screen.findByText(/I sneak into the Old Mill/);
    const node = text.firstChild as Text;
    const range = document.createRange();
    range.setStart(node, 0);
    range.setEnd(node, 'I sneak into the Old Mill'.length);
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);
    fireEvent.mouseUp(text);

    const toolbar = await screen.findByTestId('selection-toolbar');
    await userEvent.click(within(toolbar).getByRole('button', { name: '+ Card' }));
    await waitForBoardSave((c) => c.kind === 'card');
    expect(boardSaves.find((c) => c.kind === 'card')?.doc).toMatchObject({ quote: 'I sneak into the Old Mill', src: [0], locationId: 'cx-mill' });
  });

  it('starts a codex entry from selected text', async () => {
    renderRead();
    const text = await screen.findByText(/I sneak into the Old Mill/);
    const node = text.firstChild as Text;
    const range = document.createRange();
    range.setStart(node, node.data.indexOf('the wheel'));
    range.setEnd(node, node.data.indexOf('the wheel') + 'the wheel'.length);
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);
    fireEvent.mouseUp(text);

    await userEvent.click(within(await screen.findByTestId('selection-toolbar')).getByRole('button', { name: '+ Codex' }));
    expect(await screen.findByLabelText('Name')).toHaveValue('the wheel');
    expect(screen.getByLabelText('Day 2 only')).toBeChecked();
  });

  it('asks for a location before the first card', async () => {
    settings.clear();
    renderRead();
    await screen.findByText(/I sneak into the Old Mill/);
    await userEvent.click(within(paragraph(0)).getByRole('button', { name: '+ Whole paragraph' }));
    expect(await screen.findByText(/Add a location to the codex first/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Open the codex' }));
    expect(await screen.findByRole('button', { name: 'Add to codex' })).toBeInTheDocument();
    expect(boardSaves).toEqual([]);
  });

  it('marks a submission read and moves to the next unread one', async () => {
    board.set('progress/2', makeGmItem({ kind: 'progress', key: '2', doc: { readDone: true } }));
    const { router } = renderRead();
    await userEvent.click(await screen.findByRole('button', { name: 'Done reading → next' }));

    expect(await screen.findByRole('heading', { name: 'Ilse' })).toBeInTheDocument();
    expect(router.state.location.search).toContain('who=3');
    expect(within(screen.getByTestId('read-player-list')).getByText('2/3 read')).toBeInTheDocument();
    await waitForBoardSave((c) => c.kind === 'progress' && c.key === '1');
    expect(boardSaves.find((c) => c.key === '1')?.doc).toEqual({ readDone: true });
  });

  it('opens the submission named in the URL, and shows who it connects to', async () => {
    renderRead('?who=2');
    expect(await screen.findByRole('heading', { name: 'Mara' })).toBeInTheDocument();
    const sidebar = screen.getByTestId('read-sidebar');
    expect(within(sidebar).getByText('Names (1)')).toBeInTheDocument();
    expect(within(sidebar).getByRole('button', { name: 'Harrison Vale' })).toBeInTheDocument();
    expect(within(sidebar).getByText('Nobody else names Mara.')).toBeInTheDocument();
  });

  it('finds someone in the same place who names neither', async () => {
    renderRead('?who=3');
    const sidebar = await screen.findByTestId('read-sidebar');
    expect(within(sidebar).getByText('also names dock')).toBeInTheDocument();
  });

  it('sets a stance from the sidebar', async () => {
    renderRead();
    await userEvent.selectOptions(await screen.findByLabelText('Harrison Vale toward Mara'), 'target');
    await waitForBoardSave((c) => c.kind === 'stance');
    expect(boardSaves.find((c) => c.kind === 'stance')).toMatchObject({ key: '1|2', doc: { value: 'target' } });
  });

  describe('the card panel', () => {
    beforeEach(() => {
      board.set('chunk/pre', makeGmItem({ kind: 'chunk', key: 'pre', doc: { name: 'Pre-Scenario', position: 1 } }));
      board.set('chunk/slot-1', makeGmItem({ kind: 'chunk', key: 'slot-1', doc: { name: 'Slot 1', position: 2 } }));
      board.set(
        'card/card-1',
        makeGmItem({
          kind: 'card',
          key: 'card-1',
          doc: {
            characterId: 1, quote: 'I sneak into the Old Mill at dusk and wait by the wheel.', summary: '', note: '',
            locationId: 'cx-mill', chunkId: 'slot-1', outcome: 'pending', causedBy: [], isIF: false, cond: '', branchOf: null, src: [0], gm: false,
          },
        }),
      );
    });

    const openCard = async () => {
      const sidebar = await screen.findByTestId('read-sidebar');
      await userEvent.click(within(sidebar).getByRole('button', { name: /I sneak into the Old Mill at dusk/ }));
      return screen.findByTestId('card-panel');
    };

    it('moves a card to another time slot', async () => {
      renderRead();
      const panel = await openCard();
      expect(within(panel).getByLabelText('Location')).toHaveValue('the Old Mill');
      await userEvent.selectOptions(within(panel).getByLabelText('Time slot'), 'pre');
      await waitForBoardSave((c) => c.kind === 'card');
      expect(boardSaves.find((c) => c.kind === 'card')?.doc).toMatchObject({ chunkId: 'pre', locationId: 'cx-mill' });
    });

    it('adds a new location to the codex from the location picker', async () => {
      renderRead();
      const panel = await openCard();
      const picker = within(panel).getByLabelText('Location');
      await userEvent.clear(picker);
      await userEvent.type(picker, 'Lighthouse');
      await userEvent.click(within(panel).getByRole('option', { name: 'Add “Lighthouse” to the codex' }));

      await waitFor(() => expect(settingsSaves.length).toBe(1), { timeout: 3000 });
      expect(settingsSaves[0]).toMatchObject({ kind: 'codex', doc: { type: 'Location', name: 'Lighthouse', phases: [] } });
      await waitForBoardSave((c) => c.kind === 'card');
      expect(boardSaves.find((c) => c.kind === 'card')?.doc).toMatchObject({ locationId: settingsSaves[0].key });
    });

    it('turns a card into an IF card that waits', async () => {
      renderRead();
      const panel = await openCard();
      await userEvent.click(within(panel).getByLabelText(/IF card/));
      await userEvent.type(within(panel).getByLabelText('Condition'), 'if the miller sleeps');
      await userEvent.selectOptions(within(panel).getByLabelText('Time slot'), '');
      expect(within(panel).getByText('Waiting in Contingencies')).toBeInTheDocument();
      await waitFor(
        () => expect(boardSaves.filter((c) => c.kind === 'card').at(-1)?.doc).toMatchObject({ isIF: true, cond: 'if the miller sleeps', chunkId: null }),
        { timeout: 3000 },
      );
    });

    it('deletes a card, with Undo', async () => {
      renderRead();
      const panel = await openCard();
      await userEvent.click(within(panel).getByRole('button', { name: 'Delete card' }));
      expect(screen.queryByTestId('card-panel')).not.toBeInTheDocument();
      expect(within(screen.getByTestId('read-sidebar')).getByText('Board cards (0)')).toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: 'Undo' }));
      expect(within(screen.getByTestId('read-sidebar')).getByText('Board cards (1)')).toBeInTheDocument();
    });
  });
});
