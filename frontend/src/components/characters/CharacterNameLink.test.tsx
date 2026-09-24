import { describe, it, expect } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '@/mocks/server';
import { renderWithProviders } from '@/test-utils/render';
import { makeCharacter } from '@/test-utils/factories';
import { CharacterNameLink } from './CharacterNameLink';

/**
 * The gate under test is roster membership, so these drive a real GameProvider
 * over MSW rather than stubbing the context: the roster response IS the
 * entitlement signal, and a stub would assert the plumbing instead of the rule.
 *
 * The backend omits hidden NPCs from GET /games/{id}/characters for callers who
 * may not see them, so "absent from this response" is precisely "hidden from
 * this viewer".
 */
const VISIBLE_NPC = makeCharacter({ id: 7, game_id: 1, name: 'Town Crier' });

function serveRoster(characters: ReturnType<typeof makeCharacter>[]) {
  server.use(
    http.get('/api/v1/games/:gameId/characters', () => HttpResponse.json(characters))
  );
}

describe('CharacterNameLink', () => {
  it('links to the profile when the character is on the viewer roster', async () => {
    serveRoster([VISIBLE_NPC]);

    renderWithProviders(<CharacterNameLink characterId={7} name="Town Crier" />, {
      gameId: 1,
    });

    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'Town Crier' })).toHaveAttribute(
        'href',
        '/characters/7'
      );
    });
  });

  it('renders plain text for a hidden NPC the roster omits', async () => {
    // The GM's hidden NPC posted, so its name reaches the player on the message,
    // but the roster never lists it. Linking would offer a profile that 404s.
    serveRoster([VISIBLE_NPC]);

    renderWithProviders(<CharacterNameLink characterId={99} name="Masked Informant" />, {
      gameId: 1,
    });

    // Wait for the roster to settle so this cannot pass merely by being early.
    await waitFor(() => {
      expect(screen.getByText('Masked Informant')).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.queryByRole('link', { name: 'Masked Informant' })).not.toBeInTheDocument();
    });
  });

  it('links a hidden NPC for the GM, whose roster includes it', async () => {
    serveRoster([VISIBLE_NPC, makeCharacter({ id: 99, game_id: 1, name: 'Masked Informant', is_hidden: true })]);

    renderWithProviders(<CharacterNameLink characterId={99} name="Masked Informant" />, {
      gameId: 1,
    });

    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'Masked Informant' })).toHaveAttribute(
        'href',
        '/characters/99'
      );
    });
  });

  it('renders plain text with no GameProvider above it', () => {
    // Cross-game views (favorites, inbox) render message cards outside any one
    // game. There is no roster to check, so plain text is the safe answer.
    renderWithProviders(<CharacterNameLink characterId={7} name="Town Crier" />);

    expect(screen.getByText('Town Crier')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Town Crier' })).not.toBeInTheDocument();
  });

  it('renders plain text when there is no character id', async () => {
    serveRoster([VISIBLE_NPC]);

    renderWithProviders(<CharacterNameLink characterId={null} name="Unknown" />, {
      gameId: 1,
    });

    expect(screen.getByText('Unknown')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Unknown' })).not.toBeInTheDocument();
  });

  it('keeps the caller class and test id in both the link and the plain-text form', async () => {
    serveRoster([VISIBLE_NPC]);

    const { unmount } = renderWithProviders(
      <CharacterNameLink characterId={7} name="Town Crier" className="font-bold" data-testid="author" />,
      { gameId: 1 }
    );

    await waitFor(() => {
      expect(screen.getByTestId('author').tagName).toBe('A');
    });
    expect(screen.getByTestId('author')).toHaveClass('font-bold');
    unmount();

    renderWithProviders(
      <CharacterNameLink characterId={99} name="Masked Informant" className="font-bold" data-testid="author" />,
      { gameId: 1 }
    );

    expect(screen.getByTestId('author').tagName).toBe('SPAN');
    expect(screen.getByTestId('author')).toHaveClass('font-bold');
  });
});
