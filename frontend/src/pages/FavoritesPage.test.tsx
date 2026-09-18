import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../test-utils/render';
import { FavoritesPage } from './FavoritesPage';
import type { FavoriteComment } from '../types/messages';
import * as useFavoritesModule from '../hooks/useFavorites';

vi.mock('../hooks/useFavorites', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../hooks/useFavorites')>();
  return {
    ...actual,
    useFavoriteComments: vi.fn(),
    useSetCommentFavorite: vi.fn(),
  };
});

vi.mock('../components/MarkdownPreview', () => ({
  MarkdownPreview: ({ content }: { content: string }) => <div>{content}</div>,
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

function makeFavorite(overrides: Partial<FavoriteComment> = {}): FavoriteComment {
  return {
    id: 1,
    game_id: 7,
    game_title: 'Curse of Strahd',
    parent_id: null,
    post_id: 50,
    author_id: 10,
    character_id: 20,
    content: 'A memorable line',
    created_at: '2026-09-01T10:00:00Z',
    edited_at: null,
    edit_count: 0,
    deleted_at: null,
    is_deleted: false,
    author_username: 'someplayer',
    character_name: 'Ireena',
    character_avatar_url: null,
    favorited_at: '2026-09-08T10:00:00Z',
    ...overrides,
  };
}

const mockMutate = vi.fn();

function mockFavorites(favorites: FavoriteComment[], overrides = {}) {
  vi.mocked(useFavoritesModule.useFavoriteComments).mockReturnValue({
    data: {
      pages: [{ favorites, pagination: { limit: 20, next_cursor: null } }],
      pageParams: [0],
    },
    isLoading: false,
    isError: false,
    error: null,
    fetchNextPage: vi.fn(),
    hasNextPage: false,
    isFetchingNextPage: false,
    ...overrides,
  } as never);
}

describe('FavoritesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useFavoritesModule.useSetCommentFavorite).mockReturnValue({
      mutate: mockMutate,
    } as never);
  });

  it('shows a spinner while loading', () => {
    mockFavorites([], { isLoading: true });

    renderWithProviders(<FavoritesPage />);

    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('explains how to favorite something when the list is empty', () => {
    mockFavorites([]);

    renderWithProviders(<FavoritesPage />);

    expect(screen.getByText('No favorites yet')).toBeInTheDocument();
    expect(screen.getByText(/star a comment/i)).toBeInTheDocument();
  });

  it('shows an error when the list fails to load', () => {
    mockFavorites([], { isError: true, error: new Error('nope') });

    renderWithProviders(<FavoritesPage />);

    expect(screen.getByText(/couldn't load favorites/i)).toBeInTheDocument();
  });

  // The list is flat and cross-game, so ordering comes straight from the API
  // and each card has to name its own game.
  it('renders favorites from several games in the order returned', () => {
    mockFavorites([
      makeFavorite({ id: 1, game_id: 7, game_title: 'Curse of Strahd', content: 'Newest' }),
      makeFavorite({ id: 2, game_id: 9, game_title: 'Blades in the Dark', content: 'Older' }),
    ]);

    renderWithProviders(<FavoritesPage />);

    const cards = screen.getAllByTestId('favorite-comment-card');
    expect(cards).toHaveLength(2);
    expect(cards[0]).toHaveTextContent('Newest');
    expect(cards[0]).toHaveTextContent('Curse of Strahd');
    expect(cards[1]).toHaveTextContent('Older');
    expect(cards[1]).toHaveTextContent('Blades in the Dark');
  });

  it('deep-links to the comment in its own game', async () => {
    mockFavorites([makeFavorite({ id: 42, game_id: 9 })]);
    const user = userEvent.setup({ delay: null });

    renderWithProviders(<FavoritesPage />);
    await user.click(screen.getByRole('button', { name: /view in thread/i }));

    expect(mockNavigate).toHaveBeenCalledWith('/games/9?tab=common-room&comment=42');
  });

  it('unfavorites a comment when its star is clicked', async () => {
    mockFavorites([makeFavorite({ id: 42 })]);
    const user = userEvent.setup({ delay: null });

    renderWithProviders(<FavoritesPage />);
    await user.click(screen.getByTestId('favorite-button'));

    expect(mockMutate).toHaveBeenCalledWith({ commentId: 42, favorite: false });
  });

  // Removing the card on click would make a misclick unrecoverable without
  // hunting down the comment again, so it stays until the next load.
  it('keeps an unfavorited card on screen so the action can be undone', async () => {
    mockFavorites([makeFavorite({ id: 42 })]);
    const user = userEvent.setup({ delay: null });

    renderWithProviders(<FavoritesPage />);
    await user.click(screen.getByTestId('favorite-button'));

    expect(screen.getByTestId('favorite-comment-card')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /favorite this comment/i })).toBeInTheDocument();
  });

  it('re-favorites when the star is clicked again', async () => {
    mockFavorites([makeFavorite({ id: 42 })]);
    const user = userEvent.setup({ delay: null });

    renderWithProviders(<FavoritesPage />);
    await user.click(screen.getByTestId('favorite-button'));
    await user.click(screen.getByTestId('favorite-button'));

    expect(mockMutate).toHaveBeenLastCalledWith({ commentId: 42, favorite: true });
  });

  it('renders the parent preview when the comment has a parent', () => {
    mockFavorites([
      makeFavorite({
        parent: {
          content: 'The line being replied to',
          created_at: '2026-09-01T09:00:00Z',
          deleted_at: null,
          is_deleted: false,
          message_type: 'post',
          author_username: 'gm',
          character_name: 'Narrator',
          character_avatar_url: null,
        },
      }),
    ]);

    renderWithProviders(<FavoritesPage />);

    expect(screen.getByText('The line being replied to')).toBeInTheDocument();
  });

  it('shows a deleted favorite as removed rather than dropping it', () => {
    mockFavorites([makeFavorite({ is_deleted: true, content: 'gone' })]);

    renderWithProviders(<FavoritesPage />);

    expect(screen.getByText('[deleted]')).toBeInTheDocument();
    expect(screen.queryByText('gone')).not.toBeInTheDocument();
  });
});
