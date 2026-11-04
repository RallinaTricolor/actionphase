import { describe, it, expect, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/mocks/server';
import { renderWithProviders } from '@/test-utils/render';
import { makeGamePhase, makeGameWithDetails, makeGmItem } from '@/test-utils/factories';
import type { BoardItemChange, GmItem } from '@/types/gmBoard';
import { GmBoard } from './GmBoard';

const GAME_ID = 7;
const phase = makeGamePhase({ id: 70, game_id: GAME_ID, phase_type: 'action', title: 'Day 2' });
const BOARD = `/api/v1/games/${GAME_ID}/phases/70/gm-board`;

let stored: GmItem[];
let saves: BoardItemChange[][];

beforeEach(() => {
  stored = [makeGmItem({ kind: 'notes', key: 'notes', version: 1, seq: 3, doc: { text: 'check the vault' } })];
  saves = [];
  server.use(
    http.get(`/api/v1/games/${GAME_ID}/details`, () => HttpResponse.json(makeGameWithDetails({ id: GAME_ID, gm_user_id: 1 }))),
    http.get(BOARD, () => HttpResponse.json({ items: stored, cursor: 3 })),
    http.get(`/api/v1/games/${GAME_ID}/gm-settings`, () => HttpResponse.json({ items: [], cursor: 0, share_gm_board: false })),
    http.post(`${BOARD}/changes`, async ({ request }) => {
      const { changes } = (await request.json()) as { changes: BoardItemChange[] };
      saves.push(changes);
      const items = changes.map((c, i) => makeGmItem({ kind: c.kind, key: c.key, version: c.base_version + 1, seq: 10 + i, doc: c.doc }));
      return HttpResponse.json({ items });
    }),
  );
});

const renderBoard = (route = `/games/${GAME_ID}/phases/70/board`) =>
  renderWithProviders(<GmBoard gameId={GAME_ID} gameTitle="Starfall" phase={phase} />, { gameId: GAME_ID, initialRoute: route });

describe('GmBoard', () => {
  it('opens on the step named in the URL, and Read by default', async () => {
    renderBoard(`/games/${GAME_ID}/phases/70/board?step=scenes`);
    expect(await screen.findByTestId('gm-board-step-scenes')).toBeInTheDocument();
    expect(await screen.findByText('No scenes yet.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Go to the Map' })).toBeInTheDocument();
  });

  it('guides the GM on an empty board, starting with locations', async () => {
    renderBoard();
    const guide = await screen.findByTestId('gm-board-first-run');
    expect(guide).toHaveTextContent('How the results board works');
    expect(guide).toHaveTextContent('This phase has no locations yet');
    await userEvent.click(screen.getByRole('button', { name: 'Add locations in the codex' }));
    expect(await screen.findByRole('dialog', { name: 'Codex' })).toBeInTheDocument();
  });

  it('drops the location warning once the phase has a location', async () => {
    server.use(
      http.get(`/api/v1/games/${GAME_ID}/gm-settings`, () =>
        HttpResponse.json({ items: [makeGmItem({ kind: 'codex', key: 'mill', doc: { type: 'Location', name: 'the Old Mill' } })], cursor: 1, share_gm_board: false }),
      ),
    );
    renderBoard();
    const guide = await screen.findByTestId('gm-board-first-run');
    await waitFor(() => expect(guide).not.toHaveTextContent('This phase has no locations yet'));
  });

  it('shows no guide once the board has a card', async () => {
    stored = [
      ...stored,
      makeGmItem({
        kind: 'card', key: 'c1', seq: 4,
        doc: { characterId: 1, quote: '', summary: 'Waits', note: '', locationId: 'mill', chunkId: null, outcome: 'pending', causedBy: [], isIF: true, cond: 'x', branchOf: null, src: [], gm: true },
      }),
    ];
    renderBoard();
    expect(await screen.findByTestId('gm-board-step-read')).toBeInTheDocument();
    expect(screen.queryByTestId('gm-board-first-run')).not.toBeInTheDocument();
  });

  it('points the GM at the codex and the Map while there are no submissions', async () => {
    renderBoard();
    expect(await screen.findByText('No submissions in this phase yet.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Go to the Map' }));
    expect(await screen.findByTestId('gm-board-step-map')).toBeInTheDocument();
  });

  it('puts the step in the URL when the GM switches', async () => {
    const { router } = renderBoard();
    expect(await screen.findByTestId('gm-board-step-read')).toBeInTheDocument();

    await userEvent.click(screen.getByTestId('tab-write'));
    expect(await screen.findByTestId('gm-board-step-write')).toBeInTheDocument();
    expect(router.state.location.search).toBe('?step=write');
  });

  it('links back to the results area and on to game setup', async () => {
    const { router } = renderBoard();
    expect(screen.getByRole('link', { name: /Starfall: results/ })).toHaveAttribute('href', `/games/${GAME_ID}?tab=actions`);
    await userEvent.click(screen.getByRole('button', { name: 'Game setup' }));
    expect(router.state.location.pathname).toBe(`/games/${GAME_ID}/board-setup`);
  });

  it('saves the notes, based on the version it loaded', async () => {
    renderBoard();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Notes' })).toBeEnabled());
    await userEvent.click(screen.getByRole('button', { name: 'Notes' }));

    const box = await screen.findByLabelText('Notes for this phase');
    expect(box).toHaveValue('check the vault');
    await userEvent.clear(box);
    await userEvent.type(box, 'vault is empty');

    await waitFor(() => expect(saves).toHaveLength(1), { timeout: 3000 });
    expect(saves[0]).toEqual([{ kind: 'notes', key: 'notes', base_version: 1, doc: { text: 'vault is empty' } }]);
    await waitFor(() => expect(screen.getByTestId('gm-board-save-status')).toHaveTextContent('Saved'));
  });

  it('tells the GM when another editor changed the notes first', async () => {
    server.use(
      http.post(`${BOARD}/changes`, () =>
        HttpResponse.json(
          {
            status: 409, title: 'Conflict', detail: 'Another editor changed an item you were editing.',
            conflicts: [makeGmItem({ kind: 'notes', key: 'notes', version: 2, seq: 8, doc: { text: 'co-GM was here' } })],
          },
          { status: 409 },
        ),
      ),
    );
    renderBoard();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Notes' })).toBeEnabled());
    await userEvent.click(screen.getByRole('button', { name: 'Notes' }));
    await userEvent.type(await screen.findByLabelText('Notes for this phase'), '!');

    expect(await screen.findByText('Someone else changed what you were editing', {}, { timeout: 3000 })).toBeInTheDocument();
    expect(screen.getByText('the notes')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Use mine' })).toBeInTheDocument();
  });
});
