import { describe, it, expect, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '@/mocks/server';
import { renderWithProviders } from '@/test-utils/render';
import { makeCharacter, makeGameWithDetails } from '@/test-utils/factories';
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
    serveGame({ gm_user_id: 99, state: 'in_progress' });
    renderPage();
    expect(await screen.findByText('Only the game’s GMs can set up the results board.')).toBeInTheDocument();
  });

  it('says an archived game can’t be changed', async () => {
    serveGame({ state: 'completed' });
    renderPage();
    expect(await screen.findByText(/This game is archived/)).toBeInTheDocument();
  });
});
