import { describe, it, expect } from 'vitest';
import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/mocks/server';
import { renderWithProviders } from '@/test-utils';
import { makeGameWithDetails } from '@/test-utils/factories';
import type { GameWithDetails } from '@/types/games';
import { CharacterSheetEditorPage } from './CharacterSheetEditorPage';

const GAME_ID = 7;

// The mocked current user is user 1.
function serveGame(overrides: Partial<GameWithDetails> = {}) {
  server.use(
    http.get(`/api/v1/games/${GAME_ID}/details`, () =>
      HttpResponse.json(makeGameWithDetails({ id: GAME_ID, title: 'Starfall', gm_user_id: 1, ...overrides })),
    ),
    http.get(`/api/v1/games/${GAME_ID}/characters/data`, () => HttpResponse.json({})),
  );
}

const renderPage = () =>
  renderWithProviders(<CharacterSheetEditorPage />, { gameId: GAME_ID, initialRoute: `/games/${GAME_ID}/character-sheet` });

describe('CharacterSheetEditorPage', () => {
  it('shows the editor to the GM, with a way back to the game', async () => {
    serveGame();
    renderPage();

    expect(await screen.findByRole('heading', { name: 'Customize character sheet' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Starfall/ })).toHaveAttribute('href', `/games/${GAME_ID}`);
    expect(await screen.findByTestId('sheet-tab-list')).toBeInTheDocument();
  });

  it('offers no editor to a player', async () => {
    serveGame({ gm_user_id: 99 });
    renderPage();

    expect(await screen.findByText('Only the game’s GMs can customise its character sheet.')).toBeInTheDocument();
    expect(screen.queryByTestId('sheet-tab-list')).not.toBeInTheDocument();
  });

  it.each(['completed', 'cancelled'] as const)('offers no editor once the game is %s', async (state) => {
    serveGame({ state });
    renderPage();

    expect(await screen.findByText(/archived, so its character sheet can no longer be changed/)).toBeInTheDocument();
    expect(screen.queryByTestId('sheet-tab-list')).not.toBeInTheDocument();
  });

  describe('leaving with unsaved changes', () => {
    it('asks first, and leaves only when told to', async () => {
      serveGame();
      const { router } = renderPage();
      const user = userEvent.setup({ delay: null });

      await user.click(await screen.findByRole('button', { name: 'Move Numbers up' }));
      await act(() => router.navigate(`/games/${GAME_ID}`));

      expect(await screen.findByText('Leave without saving your changes to the character sheet?')).toBeInTheDocument();
      expect(router.state.location.pathname).toBe(`/games/${GAME_ID}/character-sheet`);

      await user.click(screen.getByRole('button', { name: 'Stay' }));
      expect(screen.queryByText('Leave without saving your changes to the character sheet?')).not.toBeInTheDocument();

      await act(() => router.navigate(`/games/${GAME_ID}`));
      await user.click(await screen.findByRole('button', { name: 'Leave without saving' }));
      await waitFor(() => expect(router.state.location.pathname).toBe(`/games/${GAME_ID}`));
    });

    it('lets a GM with nothing unsaved leave without asking', async () => {
      serveGame();
      const { router } = renderPage();

      await screen.findByTestId('sheet-tab-list');
      await act(() => router.navigate(`/games/${GAME_ID}`));

      await waitFor(() => expect(router.state.location.pathname).toBe(`/games/${GAME_ID}`));
    });
  });
});
