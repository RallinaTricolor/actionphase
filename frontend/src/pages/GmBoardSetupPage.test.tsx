import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '@/mocks/server';
import { renderWithProviders } from '@/test-utils/render';
import { makeGameWithDetails } from '@/test-utils/factories';
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

const renderPage = () =>
  renderWithProviders(<GmBoardSetupPage />, { gameId: GAME_ID, initialRoute: `/games/${GAME_ID}/board-setup` });

describe('GmBoardSetupPage', () => {
  // Setup comes before the game starts: a GM writes the codex before there is
  // any action phase to open a board from.
  it('opens for the GM of a game that hasn’t started', async () => {
    serveGame({ state: 'setup' });
    renderPage();
    expect(await screen.findByRole('heading', { name: 'Results board setup' })).toBeInTheDocument();
    expect(await screen.findByText('The codex, character names and reward lists will be set up here.')).toBeInTheDocument();
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
