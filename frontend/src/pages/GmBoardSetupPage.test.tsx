import { describe, it, expect, beforeEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/mocks/server';
import { renderWithProviders } from '@/test-utils/render';
import { makeCharacter, makeGameParticipant, makeGameWithDetails, makeGmItem } from '@/test-utils/factories';
import type { GameWithDetails } from '@/types/games';
import { GmBoardSetupPage } from './GmBoardSetupPage';

const GAME_ID = 7;

// The mocked current user is user 1.
function serveGame(overrides: Partial<GameWithDetails> = {}) {
  server.use(
    http.get(`/api/v1/games/${GAME_ID}/details`, () =>
      HttpResponse.json(makeGameWithDetails({ id: GAME_ID, title: 'Starfall', gm_user_id: 1, ...overrides })),
    ),
  );
}

beforeEach(() => {
  server.use(
    http.get(`/api/v1/games/${GAME_ID}/gm-settings`, () => HttpResponse.json({ items: [], cursor: 0, share_gm_board: false })),
    http.get(`/api/v1/games/${GAME_ID}/characters`, () =>
      HttpResponse.json([
        makeCharacter({ id: 1, game_id: GAME_ID, name: 'Harrison Vale' }),
        makeCharacter({ id: 2, game_id: GAME_ID, name: 'Bo Hale', character_type: 'npc' }),
      ]),
    ),
  );
});

const renderPage = () =>
  renderWithProviders(<GmBoardSetupPage />, { gameId: GAME_ID, initialRoute: `/games/${GAME_ID}/board-setup` });

describe('GmBoardSetupPage', () => {
  // Setup comes before the game starts: a GM writes the codex before there is
  // any action phase to open a board from.
  it('opens for the GM of a game that hasn’t started', async () => {
    serveGame({ state: 'setup' });
    renderPage();
    expect(await screen.findByRole('heading', { name: 'Results board setup' })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Codex' })).toBeInTheDocument();
    expect(await screen.findByText(/The codex is empty/)).toBeInTheDocument();
    expect(await screen.findByLabelText('Harrison Vale')).toHaveValue('Harrison Vale, Harrison');
    expect(screen.getByLabelText('Bo Hale (NPC)')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Starfall/ })).toHaveAttribute('href', `/games/${GAME_ID}`);
  });

  it('offers nothing to a player', async () => {
    serveGame({ gm_user_id: 99, state: 'in_progress', share_gm_board: true });
    renderPage();
    expect(await screen.findByText('The results board is for the game’s GMs, and for its audience when the GM shares it.')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Codex' })).not.toBeInTheDocument();
  });

  it('shows the GM of an archived game the setup read-only, and still lets them share it', async () => {
    serveGame({ state: 'completed' });
    renderPage();
    expect(await screen.findByText(/This game is archived/)).toBeInTheDocument();
    expect(await screen.findByLabelText('Harrison Vale')).toHaveAttribute('readonly');
    expect(screen.getByTestId('gm-board-share')).not.toBeDisabled();
    expect(screen.getByText(/Anyone who can see this game can read every phase’s board/)).toBeInTheDocument();
  });

  it('shares the boards from the Sharing toggle, saying who will see them', async () => {
    let shared = false;
    server.use(
      http.get(`/api/v1/games/${GAME_ID}/gm-settings`, () => HttpResponse.json({ items: [], cursor: 0, share_gm_board: shared })),
      http.put(`/api/v1/games/${GAME_ID}/gm-settings/sharing`, async ({ request }) => {
        shared = ((await request.json()) as { share: boolean }).share;
        return HttpResponse.json({ share_gm_board: shared });
      }),
    );
    serveGame({ state: 'in_progress' });
    renderPage();
    const toggle = await screen.findByTestId('gm-board-share');
    expect(screen.getByText(/The game’s audience can read every phase’s board and this setup while the game runs/)).toBeInTheDocument();
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    await waitFor(() => expect(toggle).not.toBeDisabled());
    await userEvent.click(toggle);
    await waitFor(() => expect(toggle).toHaveAttribute('aria-checked', 'true'));
    expect(shared).toBe(true);
  });

  it('shows the audience the shared setup read-only, without the Sharing toggle', async () => {
    server.use(
      http.get(`/api/v1/games/${GAME_ID}/participants`, () =>
        HttpResponse.json([makeGameParticipant({ game_id: GAME_ID, user_id: 1, role: 'audience' })]),
      ),
      http.get(`/api/v1/games/${GAME_ID}/gm-settings`, () =>
        HttpResponse.json({ items: [makeGmItem({ kind: 'codex', key: 'mill', doc: { type: 'Location', name: 'the Old Mill' } })], cursor: 1, share_gm_board: true }),
      ),
    );
    serveGame({ gm_user_id: 99, state: 'in_progress', share_gm_board: true });
    renderPage();
    expect(await screen.findByTestId('gm-board-read-only')).toBeInTheDocument();
    expect(await screen.findByText('the Old Mill')).toBeInTheDocument();
    expect(screen.queryByTestId('gm-board-share')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /New entry|\+ / })).not.toBeInTheDocument();
    expect(await screen.findByLabelText('Harrison Vale')).toHaveAttribute('readonly');
    expect(within(screen.getByTestId('gm-reward-lists')).queryByRole('button', { name: /^\+/ })).not.toBeInTheDocument();
  });

  it('tells the audience the setup isn’t shared', async () => {
    server.use(
      http.get(`/api/v1/games/${GAME_ID}/participants`, () =>
        HttpResponse.json([makeGameParticipant({ game_id: GAME_ID, user_id: 1, role: 'audience' })]),
      ),
    );
    serveGame({ gm_user_id: 99, state: 'in_progress', share_gm_board: false });
    renderPage();
    expect(await screen.findByText('The GM hasn’t shared this game’s results boards.')).toBeInTheDocument();
  });
});
