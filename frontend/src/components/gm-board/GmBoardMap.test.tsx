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

let board: Map<string, GmItem>;
let boardSaves: BoardItemChange[];
let seq: number;

const cardDoc = (doc: Record<string, unknown>) => ({
  quote: '', summary: '', note: '', locationId: 'mill', chunkId: 'k2', outcome: 'pending', causedBy: [], isIF: false, cond: '', branchOf: null, src: [], gm: false, ...doc,
});
const item = (kind: string, key: string, doc: Record<string, unknown>) => [`${kind}/${key}`, makeGmItem({ kind, key, doc })] as const;
const SLOTS = [item('chunk', 'k1', { name: 'Pre-Scenario', position: 1 }), item('chunk', 'k2', { name: 'Slot 1', position: 2 }), item('chunk', 'k3', { name: 'Slot 2', position: 3 })];

function serveItems<C extends BoardItemChange | SettingsItemChange>(store: Map<string, GmItem>, saves: C[]) {
  return async ({ request }: { request: Request }) => {
    const { changes } = (await request.json()) as { changes: C[] };
    const items = changes.map((c) => {
      saves.push(c);
      const saved = makeGmItem({ kind: c.kind, key: c.key, version: c.base_version + 1, seq: ++seq, doc: c.doc, deleted: !!c.deleted });
      store.set(`${c.kind}/${c.key}`, saved);
      return saved;
    });
    return HttpResponse.json({ items });
  };
}

beforeEach(() => {
  seq = 10;
  boardSaves = [];
  board = new Map([
    ...SLOTS,
    item('card', 'c-mill', cardDoc({ characterId: 1, summary: 'Waits by the wheel' })),
    item('card', 'c-dock', cardDoc({ characterId: 2, locationId: 'mill', summary: 'Follows him' })),
  ]);
  const settings = new Map([
    item('codex', 'mill', { type: 'Location', name: 'the Old Mill' }),
    item('codex', 'dock', { type: 'Location', name: 'dock' }),
  ]);
  server.use(
    http.get(`/api/v1/games/${GAME_ID}/details`, () => HttpResponse.json(makeGameWithDetails({ id: GAME_ID, gm_user_id: 1, state: 'in_progress' }))),
    http.get(`/api/v1/games/${GAME_ID}/characters`, () =>
      HttpResponse.json([
        makeCharacter({ id: 1, game_id: GAME_ID, name: 'Harrison Vale' }),
        makeCharacter({ id: 2, game_id: GAME_ID, name: 'Mara' }),
        makeCharacter({ id: 3, game_id: GAME_ID, name: 'Ilse' }),
      ]),
    ),
    http.get(`/api/v1/games/${GAME_ID}/actions`, () =>
      HttpResponse.json([
        makeActionWithDetails({ id: 1, game_id: GAME_ID, phase_id: PHASE_ID, character_id: 1, content: 'I wait by the wheel.' }),
        makeActionWithDetails({ id: 2, game_id: GAME_ID, phase_id: PHASE_ID, character_id: 2, content: 'I follow Harrison.' }),
      ]),
    ),
    http.get(`/api/v1/games/${GAME_ID}/phases`, () => HttpResponse.json([phase])),
    http.get(BOARD, () => HttpResponse.json({ items: [...board.values()].filter((i) => !i.deleted), cursor: seq })),
    http.post(`${BOARD}/changes`, serveItems(board, boardSaves)),
    http.get(SETTINGS, () => HttpResponse.json({ items: [...settings.values()], cursor: seq, share_gm_board: false })),
  );
});

const renderMap = (query = '') =>
  renderWithProviders(<GmBoard gameId={GAME_ID} gameTitle="Starfall" phase={phase} />, {
    gameId: GAME_ID,
    initialRoute: `/games/${GAME_ID}/phases/${PHASE_ID}/board?step=map${query}`,
  });

const saved = (match: (c: BoardItemChange) => boolean) => waitFor(() => expect(boardSaves.some(match)).toBe(true), { timeout: 3000 });
const docOf = (c: BoardItemChange) => c.doc as Record<string, unknown>;

describe('GmBoardMap', () => {
  it('offers the default time slots when the board has none', async () => {
    board = new Map([item('card', 'c', cardDoc({ characterId: 1, chunkId: null, isIF: true }))]);
    renderMap();
    await userEvent.click(await screen.findByRole('button', { name: 'Add Pre-Scenario and Slots 1–3' }));
    await saved((c) => c.kind === 'chunk' && docOf(c).name === 'Slot 3');
    expect(await screen.findByTestId('map-by-location')).toBeInTheDocument();
  });

  it('draws causes on hover by default, every one in All, and remembers the choice', async () => {
    localStorage.removeItem('gmBoardArrows');
    board.set('card/c-dock', makeGmItem({ kind: 'card', key: 'c-dock', doc: cardDoc({ characterId: 2, summary: 'Follows him', causedBy: ['c-mill'] }) }));
    const { unmount } = renderMap();
    const follows = await screen.findByRole('button', { name: /Mara: Follows him/ });
    expect(screen.getByLabelText('Arrows')).toHaveValue('hover');
    expect(screen.queryByTestId('map-arrows')).not.toBeInTheDocument();
    fireEvent.mouseOver(follows);
    expect(screen.getAllByTestId('map-arrow-cause')).toHaveLength(1);

    await userEvent.selectOptions(screen.getByLabelText('Arrows'), 'off');
    expect(screen.queryByTestId('map-arrows')).not.toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText('Arrows'), 'all');
    expect(screen.getAllByTestId('map-arrow-cause')).toHaveLength(1);
    unmount();

    renderMap();
    expect(await screen.findByLabelText('Arrows')).toHaveValue('all');
    localStorage.removeItem('gmBoardArrows');
  });

  it('works from the keyboard: Enter opens a card, focus moves into it, Esc closes it and returns focus', async () => {
    renderMap();
    const mapCard = await screen.findByRole('button', { name: /Harrison Vale: Waits by the wheel/ });
    mapCard.focus();
    await userEvent.keyboard('{Enter}');
    const panel = await screen.findByTestId('card-panel');
    expect(panel).toHaveFocus();
    await userEvent.tab();
    expect(within(panel).getByRole('button', { name: 'Close the card' })).toHaveFocus();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByTestId('card-panel')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Harrison Vale: Waits by the wheel/ })).toHaveFocus();
  });

  it('returns focus to a card moved by its time-slot picker, in the cell it moved to', async () => {
    renderMap();
    const mapCard = await screen.findByRole('button', { name: /Harrison Vale: Waits by the wheel/ });
    mapCard.focus();
    await userEvent.keyboard('{Enter}');
    const panel = await screen.findByTestId('card-panel');
    // Moving the card re-renders it in another cell: the button that opened the panel is gone.
    await userEvent.selectOptions(within(panel).getByLabelText('Time slot'), 'k3');
    expect(mapCard).not.toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByTestId('card-panel')).not.toBeInTheDocument();
    const moved = within(screen.getByTestId('cell-mill-k3')).getByRole('button', { name: /Harrison Vale: Waits by the wheel/ });
    expect(moved).toHaveFocus();
  });

  it('opens a card beside the grid and sets its outcome', async () => {
    renderMap();
    await userEvent.click(await screen.findByRole('button', { name: /Harrison Vale: Waits by the wheel/ }));
    const panel = screen.getByTestId('card-panel');
    await userEvent.click(within(panel).getByRole('button', { name: 'Happened' }));
    await saved((c) => c.kind === 'card' && c.key === 'c-mill' && docOf(c).outcome === 'happened');
    await userEvent.click(within(panel).getByRole('button', { name: 'Close the card' }));
    expect(screen.getByTestId('map-checks')).toBeInTheDocument();
  });

  it('moves a dragged card to another cell, with Undo', async () => {
    renderMap();
    const card = await screen.findByRole('button', { name: /Mara: Follows him/ });
    fireEvent.dragStart(card, { dataTransfer: { setData: () => {}, effectAllowed: '' } });
    fireEvent.drop(screen.getByTestId('cell-dock-k3'), { dataTransfer: { getData: () => 'c-dock' } });
    expect(await screen.findByText('Moved to dock · Slot 2.')).toBeInTheDocument();
    await saved((c) => c.key === 'c-dock' && docOf(c).locationId === 'dock' && docOf(c).chunkId === 'k3');
    await userEvent.click(screen.getByRole('button', { name: 'Undo' }));
    await saved((c) => c.key === 'c-dock' && docOf(c).locationId === 'mill' && docOf(c).chunkId === 'k2');
  });

  it('refuses to park a card that isn’t IF in Contingencies', async () => {
    renderMap();
    const card = await screen.findByRole('button', { name: /Mara: Follows him/ });
    fireEvent.dragStart(card, { dataTransfer: { setData: () => {}, effectAllowed: '' } });
    fireEvent.drop(screen.getByTestId('contingencies'), { dataTransfer: { getData: () => 'c-dock' } });
    expect(await screen.findByText(/Only IF cards wait in Contingencies/)).toBeInTheDocument();
  });

  it('dismisses a check, with Undo', async () => {
    renderMap();
    await userEvent.click(await screen.findByRole('button', { name: /^Dismiss: Mara, Harrison Vale are at the Old Mill/ }));
    await saved((c) => c.kind === 'flag' && c.key === 'meet:mill:k2' && !c.deleted);
    await userEvent.click(screen.getByRole('button', { name: 'Undo' }));
    await saved((c) => c.kind === 'flag' && c.key === 'meet:mill:k2' && !!c.deleted);
  });

  it('adds GM cards for several people in one cell', async () => {
    renderMap();
    await userEvent.click(await screen.findByRole('button', { name: 'Add GM cards at dock, Slot 2' }));
    const form = await screen.findByTestId('gm-cards-form');
    await userEvent.click(within(form).getByLabelText('Mara'));
    await userEvent.click(within(form).getByLabelText('Ilse'));
    await userEvent.type(within(form).getByLabelText('What happens'), 'A storm');
    await userEvent.click(within(form).getByRole('button', { name: 'Add 2 cards' }));
    expect(await screen.findByText('Added 2 GM cards to dock · Slot 2.')).toBeInTheDocument();
    await waitFor(() =>
      expect(boardSaves.filter((c) => c.kind === 'card' && docOf(c).gm && docOf(c).summary === 'A storm').map((c) => docOf(c).characterId)).toEqual([2, 3]),
    );
  });

  it('switches to By character, then to Stances from a row, and sets several stances with Undo', async () => {
    renderMap();
    await userEvent.click(await screen.findByRole('button', { name: 'By character' }));
    expect(await screen.findByTestId('map-by-character')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Mara’s stances' }));
    expect(await screen.findByTestId('stance-matrix')).toBeInTheDocument();
    const several = screen.getByRole('region', { name: 'Set several at once' });
    await userEvent.click(within(within(several).getByRole('group', { name: 'Toward' })).getByLabelText('Ilse'));
    await userEvent.click(within(several).getByRole('button', { name: 'Set 1 stance' }));
    await saved((c) => c.kind === 'stance' && c.key === '2|3' && docOf(c).value === 'neutral');
    await userEvent.click(screen.getByRole('button', { name: 'Undo' }));
    await saved((c) => c.kind === 'stance' && c.key === '2|3' && !!c.deleted);
  });

  it('adds a time slot and resolves one slot at a time', async () => {
    renderMap();
    await userEvent.click(await screen.findByRole('button', { name: '+ Time slot' }));
    await saved((c) => c.kind === 'chunk' && docOf(c).name === 'Slot 3' && docOf(c).position === 4);
    await userEvent.click(screen.getByRole('button', { name: 'Resolve ▸' }));
    expect(screen.getByRole('heading', { name: 'Resolving Slot 1' })).toBeInTheDocument();
  });
});
