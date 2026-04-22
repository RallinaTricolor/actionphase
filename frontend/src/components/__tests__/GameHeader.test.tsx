import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { GameHeader } from '../GameHeader';
import type { GameListItem } from '../../types/games';

const mockGame: GameListItem = {
  id: 1,
  title: 'Test Game',
  description: 'A test game',
  gm_user_id: 42,
  gm_username: 'theGM',
  state: 'recruitment',
  current_players: 2,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

const renderInRouter = (ui: React.ReactElement) =>
  render(<MemoryRouter>{ui}</MemoryRouter>);

describe('GameHeader - profile links', () => {
  it('links the GM name to their user profile', () => {
    renderInRouter(<GameHeader game={mockGame} />);

    const links = screen.getAllByRole('link', { name: /theGM/i });
    expect(links.length).toBeGreaterThan(0);
    links.forEach(link => {
      expect(link).toHaveAttribute('href', '/users/theGM');
    });
  });

  it('links the co-GM name to their user profile', () => {
    const coGMParticipant = {
      id: 2,
      game_id: 1,
      user_id: 99,
      username: 'theCoGM',
      role: 'co_gm' as const,
      status: 'active' as const,
      joined_at: '2024-01-01T00:00:00Z',
    };

    renderInRouter(<GameHeader game={mockGame} participants={[coGMParticipant]} />);

    const links = screen.getAllByRole('link', { name: /theCoGM/i });
    expect(links.length).toBeGreaterThan(0);
    links.forEach(link => {
      expect(link).toHaveAttribute('href', '/users/theCoGM');
    });
  });
});
