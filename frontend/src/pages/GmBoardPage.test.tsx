import { describe, it, expect, afterEach } from 'vitest';
import { act, screen, within } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { server } from '@/mocks/server';
import { renderWithProviders } from '@/test-utils/render';
import { makeGameParticipant, makeGamePhase, makeGameWithDetails } from '@/test-utils/factories';
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

/** The mocked current user (user 1) as an audience member. */
const joinAudience = () =>
  server.use(
    http.get(`/api/v1/games/${GAME_ID}/participants`, () =>
      HttpResponse.json([makeGameParticipant({ game_id: GAME_ID, user_id: 1, role: 'audience' })]),
    ),
  );

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
    expect(screen.queryByTestId('gm-board-read-only')).not.toBeInTheDocument();
  });

  it('turns away a player, shared or not', async () => {
    serveGame({ gm_user_id: 99, share_gm_board: true });
    renderPage();
    expect(await screen.findByText('Not shared with you')).toBeInTheDocument();
    expect(screen.queryByTestId('gm-board')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to the history' })).toHaveAttribute('href', `/games/${GAME_ID}?tab=history&phase=70`);
  });

  it('turns away the audience while the GM doesn’t share the boards', async () => {
    joinAudience();
    serveGame({ gm_user_id: 99, share_gm_board: false });
    renderPage();
    expect(await screen.findByText('The GM hasn’t shared this game’s results boards.')).toBeInTheDocument();
    expect(screen.queryByTestId('gm-board')).not.toBeInTheDocument();
  });

  it('shows the audience the board read-only while it’s shared', async () => {
    joinAudience();
    serveGame({ gm_user_id: 99, share_gm_board: true });
    renderPage();
    expect(await screen.findByTestId('gm-board')).toBeInTheDocument();
    expect(screen.getByTestId('gm-board-read-only')).toBeInTheDocument();
    expect(screen.getByText('Shared by the GM. It updates as the GM works.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Starfall: history/ })).toHaveAttribute('href', `/games/${GAME_ID}?tab=history&phase=70`);
  });

  it('shows anyone a completed game’s shared board, read-only', async () => {
    serveGame({ gm_user_id: 99, state: 'completed', share_gm_board: true });
    renderPage();
    expect(await screen.findByTestId('gm-board')).toBeInTheDocument();
    expect(screen.getByTestId('gm-board-read-only')).toBeInTheDocument();
  });

  it('shows the GM an archived game’s board read-only', async () => {
    serveGame({ state: 'completed' });
    renderPage();
    expect(await screen.findByTestId('gm-board')).toBeInTheDocument();
    expect(screen.getByText('This game is archived, so its boards can no longer be changed.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Starfall: history/ })).toBeInTheDocument();
  });

  describe('a phase that has ended', () => {
    const serveEnded = (overrides: Partial<GameWithDetails> = {}) => {
      serveGame(overrides);
      server.use(
        http.get(`/api/v1/games/${GAME_ID}/phases`, () =>
          HttpResponse.json([
            makeGamePhase({ id: 70, game_id: GAME_ID, phase_type: 'action', title: 'Day 2', is_active: false, has_ended: true }),
            makeGamePhase({ id: 71, game_id: GAME_ID, phase_type: 'common_room', title: 'Talk', is_active: true }),
          ]),
        ),
        http.get(`/api/v1/games/${GAME_ID}/phases/70/results/unpublished-count`, () => HttpResponse.json({ count: 2 })),
      );
    };

    it('is read-only for the GM, who is told how to reopen it', async () => {
      serveEnded();
      renderPage();
      expect(await screen.findByTestId('gm-board-read-only')).toBeInTheDocument();
      const notice = screen.getByTestId('gm-board-ended');
      expect(notice).toHaveTextContent('activate it again from Phases');
      expect(await within(notice).findByText(/including 2 unpublished results/)).toBeInTheDocument();
      expect(within(notice).getByRole('link', { name: 'Phases' })).toHaveAttribute('href', `/games/${GAME_ID}?tab=phases`);
      // The notice says it all, so the header doesn't repeat it.
      expect(screen.queryByText(/its board can’t be changed/)).not.toBeInTheDocument();
    });

    it('goes back to the phase in History, not the Actions tab', async () => {
      serveEnded();
      renderPage();
      expect(await screen.findByRole('link', { name: /Starfall: history/ })).toHaveAttribute('href', `/games/${GAME_ID}?tab=history&phase=70`);
    });

    it('tells a viewer it has ended, without the GM’s notice', async () => {
      joinAudience();
      serveEnded({ gm_user_id: 99, share_gm_board: true });
      renderPage();
      expect(await screen.findByText('Shared by the GM. This phase has ended.')).toBeInTheDocument();
      expect(screen.queryByTestId('gm-board-ended')).not.toBeInTheDocument();
    });
  });

  it('goes back to the results area from the running phase’s board', async () => {
    serveGame();
    server.use(
      http.get(`/api/v1/games/${GAME_ID}/phases`, () =>
        HttpResponse.json([makeGamePhase({ id: 70, game_id: GAME_ID, phase_type: 'action', title: 'Day 2', is_active: true })]),
      ),
    );
    renderPage();
    expect(await screen.findByRole('link', { name: /Starfall: results/ })).toHaveAttribute('href', `/games/${GAME_ID}?tab=actions`);
    expect(screen.queryByTestId('gm-board-read-only')).not.toBeInTheDocument();
  });

  it('tells a viewer of a finished game that the board won’t change', async () => {
    serveGame({ gm_user_id: 99, state: 'completed', share_gm_board: true });
    renderPage();
    expect(await screen.findByText('Shared by the GM. This game is over, so the board won’t change.')).toBeInTheDocument();
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

  it('keeps an open board, and where the GM was on it, while the window is too narrow', async () => {
    let narrow = false;
    const listeners = new Set<() => void>();
    window.matchMedia = ((query: string) => ({
      get matches() {
        return query === BOARD_NARROW_QUERY && narrow;
      },
      media: query,
      addEventListener: (_: string, fn: () => void) => listeners.add(fn),
      removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
    })) as unknown as typeof window.matchMedia;
    const setNarrow = (next: boolean) =>
      act(() => {
        narrow = next;
        listeners.forEach((fn) => fn());
      });
    serveGame();
    renderPage();
    const board = await screen.findByTestId('gm-board');

    setNarrow(true);
    expect(screen.getByText('The results board needs a wider screen')).toBeInTheDocument();
    expect(board).toBeInTheDocument();
    expect(board).not.toBeVisible();

    setNarrow(false);
    expect(screen.queryByText('The results board needs a wider screen')).not.toBeInTheDocument();
    expect(screen.getByTestId('gm-board')).toBe(board);
    expect(board).toBeVisible();
  });
});
