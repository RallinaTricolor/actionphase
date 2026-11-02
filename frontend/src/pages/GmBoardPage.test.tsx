import { describe, it, expect, afterEach } from 'vitest';
import { screen } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { server } from '@/mocks/server';
import { renderWithProviders } from '@/test-utils/render';
import { makeGamePhase, makeGameWithDetails } from '@/test-utils/factories';
import type { GameWithDetails } from '@/types/games';
import { BOARD_NARROW_QUERY, GmBoardPage } from './GmBoardPage';

const GAME_ID = 7;

// The mocked current user is user 1.
function serveGame(overrides: Partial<GameWithDetails> = {}) {
  server.use(
    http.get(`/api/v1/games/${GAME_ID}/details`, () =>
      HttpResponse.json(makeGameWithDetails({ id: GAME_ID, title: 'Starfall', gm_user_id: 1, state: 'in_progress', ...overrides })),
    ),
    http.get(`/api/v1/games/${GAME_ID}/phases`, () =>
      HttpResponse.json([
        makeGamePhase({ id: 70, game_id: GAME_ID, phase_type: 'action', title: 'Day 2' }),
        makeGamePhase({ id: 71, game_id: GAME_ID, phase_type: 'common_room', title: 'Talk' }),
      ]),
    ),
    http.get(`/api/v1/games/${GAME_ID}/phases/70/gm-board`, () => HttpResponse.json({ items: [], cursor: 0 })),
  );
}

const renderPage = (phaseId = 70) =>
  renderWithProviders(
    <Routes>
      <Route path="/games/:gameId/phases/:phaseId/board" element={<GmBoardPage />} />
    </Routes>,
    { gameId: GAME_ID, initialRoute: `/games/${GAME_ID}/phases/${phaseId}/board` },
  );

describe('GmBoardPage', () => {
  const originalMatchMedia = window.matchMedia;
  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  it('shows the GM the board for an action phase', async () => {
    serveGame();
    renderPage();
    expect(await screen.findByTestId('gm-board')).toBeInTheDocument();
    expect(screen.getByText('Day 2')).toBeInTheDocument();
  });

  it('turns away anyone who isn’t a GM', async () => {
    serveGame({ gm_user_id: 99 });
    renderPage();
    expect(await screen.findByText('Only the game’s GMs can open the results board.')).toBeInTheDocument();
    expect(screen.queryByTestId('gm-board')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to the results' })).toHaveAttribute('href', `/games/${GAME_ID}?tab=actions`);
  });

  it('has no board for a phase that isn’t an action phase', async () => {
    serveGame();
    renderPage(71);
    expect(await screen.findByText('Only action phases have a results board.')).toBeInTheDocument();
  });

  it('shows a notice instead of the board below 1024px', async () => {
    window.matchMedia = ((query: string) => ({
      matches: query === BOARD_NARROW_QUERY,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    })) as unknown as typeof window.matchMedia;
    serveGame();
    renderPage();
    expect(await screen.findByText('The results board needs a wider screen')).toBeInTheDocument();
    expect(screen.queryByTestId('gm-board')).not.toBeInTheDocument();
  });
});
