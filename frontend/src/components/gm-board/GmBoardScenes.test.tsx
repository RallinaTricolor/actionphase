import { describe, it, expect, beforeEach } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/mocks/server';
import { renderWithProviders } from '@/test-utils/render';
import { makeActionWithDetails, makeCharacter, makeGamePhase, makeGameWithDetails, makeGmItem } from '@/test-utils/factories';
import type { BoardItemChange, GmItem } from '@/types/gmBoard';
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
const sceneDoc = (doc: Record<string, unknown>) => ({ title: '', locationId: 'mill', chunkId: 'k2', conflict: false, participants: [], moments: [], effects: [], ...doc });
const item = (kind: string, key: string, doc: Record<string, unknown>) => [`${kind}/${key}`, makeGmItem({ kind, key, doc })] as const;
const SLOTS = [item('chunk', 'k1', { name: 'Pre-Scenario', position: 1 }), item('chunk', 'k2', { name: 'Slot 1', position: 2 }), item('chunk', 'k3', { name: 'Slot 2', position: 3 })];

beforeEach(() => {
  seq = 10;
  boardSaves = [];
  board = new Map([
    ...SLOTS,
    item('card', 'c-h', cardDoc({ characterId: 1, summary: 'Waits by the wheel' })),
    item('card', 'c-m', cardDoc({ characterId: 2, summary: 'Follows him' })),
  ]);
  const settings = new Map([
    item('codex', 'mill', { type: 'Location', name: 'the Old Mill' }),
    item('codex', 'dock', { type: 'Location', name: 'dock' }),
    item('codex', 'ledger', { type: 'Item', name: 'the ledger' }),
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
      HttpResponse.json([makeActionWithDetails({ id: 1, game_id: GAME_ID, phase_id: PHASE_ID, character_id: 1, content: 'I wait by the wheel.' })]),
    ),
    http.get(`/api/v1/games/${GAME_ID}/phases`, () => HttpResponse.json([phase])),
    http.get(BOARD, () => HttpResponse.json({ items: [...board.values()].filter((i) => !i.deleted), cursor: seq })),
    http.post(`${BOARD}/changes`, async ({ request }) => {
      const { changes } = (await request.json()) as { changes: BoardItemChange[] };
      const items = changes.map((c) => {
        boardSaves.push(c);
        const saved = makeGmItem({ kind: c.kind, key: c.key, version: c.base_version + 1, seq: ++seq, doc: c.doc, deleted: !!c.deleted });
        board.set(`${c.kind}/${c.key}`, saved);
        return saved;
      });
      return HttpResponse.json({ items });
    }),
    http.get(SETTINGS, () => HttpResponse.json({ items: [...settings.values()], cursor: seq, share_gm_board: false })),
  );
});

const renderBoard = (query: string) =>
  renderWithProviders(<GmBoard gameId={GAME_ID} gameTitle="Starfall" phase={phase} />, {
    gameId: GAME_ID,
    initialRoute: `/games/${GAME_ID}/phases/${PHASE_ID}/board?${query}`,
  });

const lastScene = (key?: string) =>
  [...boardSaves].reverse().find((c) => c.kind === 'scene' && (!key || c.key === key)) as BoardItemChange & { doc: Record<string, unknown> };
const sceneSaved = (match: (doc: Record<string, unknown>, c: BoardItemChange) => boolean) =>
  waitFor(() => expect(boardSaves.some((c) => c.kind === 'scene' && !!c.doc && match(c.doc as Record<string, unknown>, c))).toBe(true), { timeout: 3000 });

describe('GmBoardScenes', () => {
  it('points to the Map when there are no scenes', async () => {
    renderBoard('step=scenes');
    expect(await screen.findByText('No scenes yet.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Go to the Map' }));
    expect(await screen.findByTestId('map-by-location')).toBeInTheDocument();
  });

  it('creates a scene from a busy Map cell and opens it, cast and first moment ready', async () => {
    renderBoard('step=map');
    await userEvent.click(await screen.findByRole('button', { name: 'Create scene at the Old Mill, Slot 1' }));
    expect(await screen.findByTestId('gm-board-step-scenes')).toBeInTheDocument();
    expect(within(screen.getByTestId('scene-cast')).getByText('Harrison')).toBeInTheDocument();
    expect(within(screen.getByTestId('scene-cast')).getByText('Mara')).toBeInTheDocument();
    await sceneSaved((doc) => (doc.participants as number[]).join() === '1,2' && (doc.moments as unknown[]).length === 1);
    expect(lastScene().doc).toMatchObject({ locationId: 'mill', chunkId: 'k2', title: '' });
  });

  it('writes moments, adds one below with Ctrl+Enter, and shows each reader their version', async () => {
    board.set('scene/s1', makeGmItem({ kind: 'scene', key: 's1', doc: sceneDoc({ participants: [1, 2], moments: [{ id: 'm1', text: '', readers: [1, 2], ownText: {} }] }) }));
    renderBoard('step=scenes&scene=s1');
    const first = await screen.findByLabelText('What happens, with names');
    fireEvent.change(first, { target: { value: 'Harrison draws on Mara.' } });
    fireEvent.keyDown(first, { key: 'Enter', ctrlKey: true });
    await waitFor(() => expect(screen.getAllByLabelText('What happens, with names')).toHaveLength(2));
    const second = screen.getAllByLabelText('What happens, with names')[1];
    await waitFor(() => expect(second).toHaveFocus());
    fireEvent.change(second, { target: { value: 'Mara ducks.' } });
    await userEvent.click(within(screen.getByRole('group', { name: 'Who reads moment 2' })).getByRole('button', { name: 'Harrison' }));

    const readsAs = screen.getByTestId('scene-reads-as');
    expect(readsAs).toHaveTextContent('You draw on Mara.');
    expect(readsAs).not.toHaveTextContent('Mara ducks.');
    await userEvent.click(within(within(readsAs).getByRole('group', { name: 'Reader' })).getByRole('button', { name: /Mara/ }));
    expect(readsAs).toHaveTextContent('Harrison draws on you.');
    expect(readsAs).toHaveTextContent('You duck.');

    await sceneSaved((doc) => {
      const moments = doc.moments as { text: string; readers: number[] }[];
      return moments.length === 2 && moments[0].text === 'Harrison draws on Mara.' && moments[1].text === 'Mara ducks.' && moments[1].readers.join() === '2';
    });
  });

  it('inserts a codex name where the cursor was', async () => {
    board.set('scene/s1', makeGmItem({ kind: 'scene', key: 's1', doc: sceneDoc({ participants: [1], moments: [{ id: 'm1', text: 'Harrison burns.', readers: [1], ownText: {} }] }) }));
    renderBoard('step=scenes&scene=s1');
    const box = (await screen.findByLabelText('What happens, with names')) as HTMLTextAreaElement;
    box.focus();
    box.setSelectionRange(14, 14);
    fireEvent.select(box);
    await userEvent.click(within(screen.getByRole('group', { name: 'Reference tab' })).getByRole('button', { name: 'Codex' }));
    await userEvent.click(screen.getByRole('button', { name: 'Insert the ledger' }));
    await sceneSaved((doc) => (doc.moments as { text: string }[])[0].text === 'Harrison burns the ledger.');
  });

  it('walks scenes in time order and deletes one with Undo, taking it out of card causes', async () => {
    board.set('card/c-m', makeGmItem({ kind: 'card', key: 'c-m', doc: cardDoc({ characterId: 2, summary: 'Follows him', outcome: 'failed', causedBy: ['s-late'] }) }));
    board.set('scene/s-late', makeGmItem({ kind: 'scene', key: 's-late', doc: sceneDoc({ title: 'The chase', chunkId: 'k3', participants: [2] }) }));
    board.set('scene/s-early', makeGmItem({ kind: 'scene', key: 's-early', doc: sceneDoc({ title: 'The meeting', chunkId: 'k1', participants: [1] }) }));
    renderBoard('step=scenes');
    expect(await screen.findByDisplayValue('The meeting')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Next →' }));
    expect(await screen.findByDisplayValue('The chase')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next →' })).toBeDisabled();

    await userEvent.click(screen.getByRole('button', { name: 'Delete scene' }));
    expect(await screen.findByText('Deleted The chase.')).toBeInTheDocument();
    expect(await screen.findByDisplayValue('The meeting')).toBeInTheDocument();
    await waitFor(() => expect(boardSaves.some((c) => c.kind === 'scene' && c.key === 's-late' && c.deleted)).toBe(true), { timeout: 3000 });
    await waitFor(() => expect(boardSaves.some((c) => c.key === 'c-m' && (c.doc as { causedBy: string[] }).causedBy.length === 0)).toBe(true));

    await userEvent.click(screen.getByRole('button', { name: 'Undo' }));
    await sceneSaved((doc, c) => c.key === 's-late' && doc.title === 'The chase');
    await waitFor(() => expect(boardSaves.some((c) => c.key === 'c-m' && (c.doc as { causedBy: string[] }).causedBy.join() === 's-late')).toBe(true));
  });

  it('opens a scene from its pill on the Map', async () => {
    board.set('scene/s1', makeGmItem({ kind: 'scene', key: 's1', doc: sceneDoc({ title: 'At the wheel', participants: [1, 2], conflict: true }) }));
    renderBoard('step=map');
    await userEvent.click(await screen.findByRole('button', { name: 'Open the conflict here' }));
    expect(await screen.findByDisplayValue('At the wheel')).toBeInTheDocument();
  });
});
