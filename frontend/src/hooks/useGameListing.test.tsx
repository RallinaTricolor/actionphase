import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { useGameListing } from './useGameListing';
import { apiClient } from '../lib/api';
import type { GameListingResponse, EnrichedGameListItem, GameState } from '../types/games';

// Mock the API client
vi.mock('../lib/api', () => ({
  apiClient: {
    games: {
      getFilteredGames: vi.fn(),
    },
  },
}));

describe('useGameListing', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
    vi.clearAllMocks();
  });

  const mockGame: EnrichedGameListItem = {
    id: 1,
    title: 'Test Game',
    description: 'A test game',
    gm_user_id: 100,
    gm_username: 'TestGM',
    state: 'recruitment',
    genre: 'Fantasy',
    current_players: 3,
    max_players: 5,
    is_public: true,
    user_relationship: 'none',
    deadline_urgency: 'normal',
    has_recent_activity: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  };

  const mockResponse: GameListingResponse = {
    games: [mockGame],
    metadata: {
      total_count: 10,
      filtered_count: 1,
      available_genres: ['Fantasy', 'Sci-Fi'],
      available_states: ['recruitment', 'in_progress'],
    },
  };

  const createWrapper = (initialUrl = '/games') => {
    return ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[initialUrl]}>
          <Routes>
            <Route path="/games" element={<div>{children}</div>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
  };

  describe('Initial Load', () => {
    it('fetches games with default filters', async () => {
      vi.mocked(apiClient.games.getFilteredGames).mockResolvedValue({
        data: mockResponse,
      } as any);

      const { result } = renderHook(() => useGameListing(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.games).toEqual([mockGame]);
      expect(result.current.metadata).toEqual(mockResponse.metadata);
      expect(apiClient.games.getFilteredGames).toHaveBeenCalledWith(
        expect.objectContaining({
          sort_by: 'recent_activity',
        })
      );
    });

    it('handles error state', async () => {
      const error = new Error('Failed to fetch games');
      vi.mocked(apiClient.games.getFilteredGames).mockRejectedValue(error);

      const { result } = renderHook(() => useGameListing(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isError).toBe(true);
      expect(result.current.error).toEqual(error);
      expect(result.current.games).toEqual([]);
    });

    it('returns empty arrays when no data', async () => {
      vi.mocked(apiClient.games.getFilteredGames).mockResolvedValue({
        data: {
          games: [],
          metadata: {
            total_count: 0,
            filtered_count: 0,
            available_genres: [],
            available_states: [],
          },
        },
      } as any);

      const { result } = renderHook(() => useGameListing(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.games).toEqual([]);
      expect(result.current.metadata.total_count).toBe(0);
    });
  });

  describe('URL Parameter Parsing', () => {
    it('parses states from URL', async () => {
      vi.mocked(apiClient.games.getFilteredGames).mockResolvedValue({
        data: mockResponse,
      } as any);

      const { result } = renderHook(() => useGameListing(), {
        wrapper: createWrapper('/games?states=recruitment,in_progress'),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.filters.states).toEqual(['recruitment', 'in_progress']);
      expect(apiClient.games.getFilteredGames).toHaveBeenCalledWith(
        expect.objectContaining({
          states: ['recruitment', 'in_progress'],
        })
      );
    });

    it('parses genres from URL', async () => {
      vi.mocked(apiClient.games.getFilteredGames).mockResolvedValue({
        data: mockResponse,
      } as any);

      const { result } = renderHook(() => useGameListing(), {
        wrapper: createWrapper('/games?genres=Fantasy,Sci-Fi'),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.filters.genres).toEqual(['Fantasy', 'Sci-Fi']);
      expect(apiClient.games.getFilteredGames).toHaveBeenCalledWith(
        expect.objectContaining({
          genres: ['Fantasy', 'Sci-Fi'],
        })
      );
    });

    it('parses participation filter from URL', async () => {
      vi.mocked(apiClient.games.getFilteredGames).mockResolvedValue({
        data: mockResponse,
      } as any);

      const { result } = renderHook(() => useGameListing(), {
        wrapper: createWrapper('/games?participation=my_games'),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.filters.participation).toBe('my_games');
      expect(apiClient.games.getFilteredGames).toHaveBeenCalledWith(
        expect.objectContaining({
          participation: 'my_games',
        })
      );
    });

    it('parses has_open_spots from URL', async () => {
      vi.mocked(apiClient.games.getFilteredGames).mockResolvedValue({
        data: mockResponse,
      } as any);

      const { result } = renderHook(() => useGameListing(), {
        wrapper: createWrapper('/games?has_open_spots=true'),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.filters.has_open_spots).toBe(true);
      expect(apiClient.games.getFilteredGames).toHaveBeenCalledWith(
        expect.objectContaining({
          has_open_spots: true,
        })
      );
    });

    it('parses sort_by from URL', async () => {
      vi.mocked(apiClient.games.getFilteredGames).mockResolvedValue({
        data: mockResponse,
      } as any);

      const { result } = renderHook(() => useGameListing(), {
        wrapper: createWrapper('/games?sort_by=alphabetical'),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.filters.sort_by).toBe('alphabetical');
      expect(apiClient.games.getFilteredGames).toHaveBeenCalledWith(
        expect.objectContaining({
          sort_by: 'alphabetical',
        })
      );
    });

    it('parses multiple filters from URL', async () => {
      vi.mocked(apiClient.games.getFilteredGames).mockResolvedValue({
        data: mockResponse,
      } as any);

      const url = '/games?states=recruitment&genres=Fantasy&participation=my_games&has_open_spots=true&sort_by=created';
      const { result } = renderHook(() => useGameListing(), {
        wrapper: createWrapper(url),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.filters).toEqual({
        states: ['recruitment'],
        genres: ['Fantasy'],
        participation: 'my_games',
        has_open_spots: true,
        sort_by: 'created',
      });
    });
  });

  describe('Filter Updates', () => {
    it('updates states and triggers refetch', async () => {
      vi.mocked(apiClient.games.getFilteredGames).mockResolvedValue({
        data: mockResponse,
      } as any);

      const { result } = renderHook(() => useGameListing(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const initialCallCount = vi.mocked(apiClient.games.getFilteredGames).mock.calls.length;

      act(() => {
        result.current.setStates(['recruitment', 'in_progress'] as GameState[]);
      });

      await waitFor(() => {
        expect(apiClient.games.getFilteredGames).toHaveBeenCalledTimes(initialCallCount + 1);
      });

      expect(apiClient.games.getFilteredGames).toHaveBeenLastCalledWith(
        expect.objectContaining({
          states: ['recruitment', 'in_progress'],
        })
      );
    });

    it('updates genres and triggers refetch', async () => {
      vi.mocked(apiClient.games.getFilteredGames).mockResolvedValue({
        data: mockResponse,
      } as any);

      const { result } = renderHook(() => useGameListing(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const initialCallCount = vi.mocked(apiClient.games.getFilteredGames).mock.calls.length;

      act(() => {
        result.current.setGenres(['Fantasy', 'Horror']);
      });

      await waitFor(() => {
        expect(apiClient.games.getFilteredGames).toHaveBeenCalledTimes(initialCallCount + 1);
      });

      expect(apiClient.games.getFilteredGames).toHaveBeenLastCalledWith(
        expect.objectContaining({
          genres: ['Fantasy', 'Horror'],
        })
      );
    });

    it('updates participation filter and triggers refetch', async () => {
      vi.mocked(apiClient.games.getFilteredGames).mockResolvedValue({
        data: mockResponse,
      } as any);

      const { result } = renderHook(() => useGameListing(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const initialCallCount = vi.mocked(apiClient.games.getFilteredGames).mock.calls.length;

      act(() => {
        result.current.setParticipation('my_games');
      });

      await waitFor(() => {
        expect(apiClient.games.getFilteredGames).toHaveBeenCalledTimes(initialCallCount + 1);
      });

      expect(apiClient.games.getFilteredGames).toHaveBeenLastCalledWith(
        expect.objectContaining({
          participation: 'my_games',
        })
      );
    });

    it('updates has_open_spots and triggers refetch', async () => {
      vi.mocked(apiClient.games.getFilteredGames).mockResolvedValue({
        data: mockResponse,
      } as any);

      const { result } = renderHook(() => useGameListing(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const initialCallCount = vi.mocked(apiClient.games.getFilteredGames).mock.calls.length;

      act(() => {
        result.current.setHasOpenSpots(true);
      });

      await waitFor(() => {
        expect(apiClient.games.getFilteredGames).toHaveBeenCalledTimes(initialCallCount + 1);
      });

      expect(apiClient.games.getFilteredGames).toHaveBeenLastCalledWith(
        expect.objectContaining({
          has_open_spots: true,
        })
      );
    });

    it('updates sort_by and triggers refetch', async () => {
      vi.mocked(apiClient.games.getFilteredGames).mockResolvedValue({
        data: mockResponse,
      } as any);

      const { result } = renderHook(() => useGameListing(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const initialCallCount = vi.mocked(apiClient.games.getFilteredGames).mock.calls.length;

      act(() => {
        result.current.setSortBy('alphabetical');
      });

      await waitFor(() => {
        expect(apiClient.games.getFilteredGames).toHaveBeenCalledTimes(initialCallCount + 1);
      });

      expect(apiClient.games.getFilteredGames).toHaveBeenLastCalledWith(
        expect.objectContaining({
          sort_by: 'alphabetical',
        })
      );
    });

    it('clears all filters', async () => {
      vi.mocked(apiClient.games.getFilteredGames).mockResolvedValue({
        data: mockResponse,
      } as any);

      const url = '/games?states=recruitment&genres=Fantasy&participation=my_games';
      const { result } = renderHook(() => useGameListing(), {
        wrapper: createWrapper(url),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const initialCallCount = vi.mocked(apiClient.games.getFilteredGames).mock.calls.length;

      act(() => {
        result.current.clearFilters();
      });

      await waitFor(() => {
        expect(apiClient.games.getFilteredGames).toHaveBeenCalledTimes(initialCallCount + 1);
      });

      // After clearing, should only have default sort_by
      expect(apiClient.games.getFilteredGames).toHaveBeenLastCalledWith(
        expect.objectContaining({
          sort_by: 'recent_activity',
        })
      );

      expect(result.current.filters.states).toBeUndefined();
      expect(result.current.filters.genres).toBeUndefined();
      // participation becomes null (from URL params), not undefined
      expect(result.current.filters.participation).toBeNull();
    });

    it('removes filters when set to empty array', async () => {
      vi.mocked(apiClient.games.getFilteredGames).mockResolvedValue({
        data: mockResponse,
      } as any);

      const { result } = renderHook(() => useGameListing(), {
        wrapper: createWrapper('/games?states=recruitment'),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      act(() => {
        result.current.setStates([]);
      });

      await waitFor(() => {
        expect(result.current.filters.states).toBeUndefined();
      });
    });
  });

  describe('React Query Integration', () => {
    it('uses correct query key', async () => {
      vi.mocked(apiClient.games.getFilteredGames).mockResolvedValue({
        data: mockResponse,
      } as any);

      const { result } = renderHook(() => useGameListing(), {
        wrapper: createWrapper('/games?states=recruitment'),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Check that data is cached by verifying we can get it from the query cache
      const cache = queryClient.getQueryCache();
      const queries = cache.getAll();

      // Should have at least one query cached with 'games' and 'filtered' in the key
      const gamesQuery = queries.find(q =>
        Array.isArray(q.queryKey) &&
        q.queryKey[0] === 'games' &&
        q.queryKey[1] === 'filtered'
      );

      expect(gamesQuery).toBeDefined();
      expect(gamesQuery?.state.data).toEqual(mockResponse);
    });

    it('caches data correctly', async () => {
      vi.mocked(apiClient.games.getFilteredGames).mockResolvedValue({
        data: mockResponse,
      } as any);

      const { result } = renderHook(() => useGameListing(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(apiClient.games.getFilteredGames).toHaveBeenCalledTimes(1);

      // Render hook again with same filters - should use cache
      const { result: result2 } = renderHook(() => useGameListing(), {
        wrapper: createWrapper(),
      });

      // Should immediately have data from cache
      expect(result2.current.isLoading).toBe(false);
      expect(result2.current.games).toEqual([mockGame]);
      // Should not make additional API call due to cache
      expect(apiClient.games.getFilteredGames).toHaveBeenCalledTimes(1);
    });

    it('provides refetch function', async () => {
      vi.mocked(apiClient.games.getFilteredGames).mockResolvedValue({
        data: mockResponse,
      } as any);

      const { result } = renderHook(() => useGameListing(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(apiClient.games.getFilteredGames).toHaveBeenCalledTimes(1);

      await act(async () => {
        await result.current.refetch();
      });

      expect(apiClient.games.getFilteredGames).toHaveBeenCalledTimes(2);
    });
  });

  describe('Edge Cases', () => {
    it('handles undefined/null filter values', async () => {
      vi.mocked(apiClient.games.getFilteredGames).mockResolvedValue({
        data: mockResponse,
      } as any);

      const { result } = renderHook(() => useGameListing(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      act(() => {
        result.current.setParticipation(undefined);
      });

      await waitFor(() => {
        // When undefined is set, URL param is removed, and get() returns null
        expect(result.current.filters.participation).toBeNull();
      });
    });

    it('handles malformed URL parameters gracefully', async () => {
      vi.mocked(apiClient.games.getFilteredGames).mockResolvedValue({
        data: mockResponse,
      } as any);

      // URL with empty values
      const { result } = renderHook(() => useGameListing(), {
        wrapper: createWrapper('/games?states=&genres='),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should handle empty strings gracefully
      expect(result.current.games).toEqual([mockGame]);
    });

    it('handles boolean string conversion correctly', async () => {
      vi.mocked(apiClient.games.getFilteredGames).mockResolvedValue({
        data: mockResponse,
      } as any);

      const { result } = renderHook(() => useGameListing(), {
        wrapper: createWrapper('/games?has_open_spots=false'),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.filters.has_open_spots).toBe(false);
    });
  });
});
