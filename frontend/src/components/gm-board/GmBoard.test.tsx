import { describe, it, expect, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/mocks/server';
import { renderWithProviders } from '@/test-utils/render';
import { makeGamePhase, makeGmItem } from '@/test-utils/factories';
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
    http.get(BOARD, () => HttpResponse.json({ items: stored, cursor: 3 })),
    http.post(`${BOARD}/changes`, async ({ request }) => {
      const { changes } = (await request.json()) as { changes: BoardItemChange[] };
      saves.push(changes);
      const items = changes.map((c, i) => makeGmItem({ kind: c.kind, key: c.key, version: c.base_version + 1, seq: 10 + i, doc: c.doc }));
      return HttpResponse.json({ items });
    }),
  );
});

const renderBoard = (route = `/games/${GAME_ID}/phases/70/board`) =>
  renderWithProviders(<GmBoard gameId={GAME_ID} gameTitle="Starfall" phase={phase} />, { initialRoute: route });

describe('GmBoard', () => {
  it('opens on the step named in the URL, and Read by default', async () => {
    renderBoard(`/games/${GAME_ID}/phases/70/board?step=scenes`);
    expect(await screen.findByTestId('gm-board-step-scenes')).toBeInTheDocument();
    expect(screen.getByText(/Scenes are made from busy cells on the/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Map' })).toHaveAttribute('href', `/games/${GAME_ID}/phases/70/board?step=map`);
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
