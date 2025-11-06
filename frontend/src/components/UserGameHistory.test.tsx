import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { UserGameHistory } from './UserGameHistory';
import type { UserGame, UserGameHistoryMetadata } from '../types/user-profiles';

const mockGames: UserGame[] = [
  {
    game_id: 1,
    title: 'Test Game 1',
    gm_username: 'gm1',
    state: 'recruiting',
    user_role: 'player',
    is_anonymous: false,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    characters: [
      {
        id: 101,
        name: 'Character 1',
        avatar_url: null,
        character_type: 'warrior',
      },
    ],
  },
  {
    game_id: 2,
    title: 'Test Game 2',
    gm_username: 'gm2',
    state: 'active',
    user_role: 'gm',
    is_anonymous: false,
    created_at: '2024-01-02T00:00:00Z',
    updated_at: '2024-01-02T00:00:00Z',
    characters: [],
  },
];

const mockMetadata: UserGameHistoryMetadata = {
  page: 1,
  page_size: 12,
  total_pages: 1,
  total_count: 2,
  has_next_page: false,
  has_previous_page: false,
};

const mockMetadataWithMultiplePages: UserGameHistoryMetadata = {
  page: 1,
  page_size: 12,
  total_pages: 3,
  total_count: 30,
  has_next_page: true,
  has_previous_page: false,
};

// Wrapper to provide Router context
const renderWithRouter = (ui: React.ReactElement) => {
  return render(<BrowserRouter>{ui}</BrowserRouter>);
};

describe('UserGameHistory', () => {
  it('renders empty state when no games', () => {
    renderWithRouter(<UserGameHistory games={[]} />);

    expect(screen.getByText('Game History')).toBeInTheDocument();
    expect(screen.getByText('No games yet. Browse available games to join!')).toBeInTheDocument();
    expect(screen.getByText('Browse Games')).toBeInTheDocument();
  });

  it('renders games in a grid when games are provided', () => {
    renderWithRouter(<UserGameHistory games={mockGames} />);

    expect(screen.getByText('Test Game 1')).toBeInTheDocument();
    expect(screen.getByText('Test Game 2')).toBeInTheDocument();
  });

  it('does not render pagination when total_pages is 1', () => {
    const onPageChange = vi.fn();
    const onPageSizeChange = vi.fn();

    renderWithRouter(
      <UserGameHistory
        games={mockGames}
        metadata={mockMetadata}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
      />
    );

    // Pagination component should not be visible for single page
    expect(screen.queryByText(/Page/i)).not.toBeInTheDocument();
  });

  it('renders pagination when total_pages > 1', () => {
    const onPageChange = vi.fn();
    const onPageSizeChange = vi.fn();

    renderWithRouter(
      <UserGameHistory
        games={mockGames}
        metadata={mockMetadataWithMultiplePages}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
      />
    );

    // Pagination should be visible
    expect(screen.getByText(/Page 1 of 3/i)).toBeInTheDocument();
  });

  it('does not render pagination when onPageChange is not provided', () => {
    renderWithRouter(
      <UserGameHistory
        games={mockGames}
        metadata={mockMetadataWithMultiplePages}
      />
    );

    // Pagination should not appear without handlers
    expect(screen.queryByText(/Page/i)).not.toBeInTheDocument();
  });

  it('renders correct number of game cards', () => {
    renderWithRouter(<UserGameHistory games={mockGames} />);

    // Each game should have a link to its detail page
    const gameLinks = screen.getAllByRole('link');
    // Should have at least 2 game cards (possibly more links inside cards)
    expect(gameLinks.length).toBeGreaterThanOrEqual(2);
  });

  it('displays "Game History" heading when games exist', () => {
    renderWithRouter(<UserGameHistory games={mockGames} />);

    const headings = screen.getAllByText('Game History');
    expect(headings.length).toBeGreaterThanOrEqual(1);
  });
});
