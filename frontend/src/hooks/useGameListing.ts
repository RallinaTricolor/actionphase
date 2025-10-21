import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { useCallback, useMemo } from 'react';
import { apiClient } from '../lib/api';
import { useAdminMode } from './useAdminMode';
import type {
  GameListingFilters,
  GameState,
  ParticipationFilter,
  SortBy,
} from '../types/games';

/**
 * Custom hook for game listing with URL-synced filters
 *
 * Features:
 * - Fetches filtered games from API
 * - Synchronizes filter state with URL query parameters
 * - Provides methods to update individual filters
 * - Browser back/forward navigation support
 *
 * @example
 * ```tsx
 * const { games, metadata, filters, setStates, setSortBy, isLoading } = useGameListing();
 * ```
 */
export function useGameListing() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { adminModeEnabled } = useAdminMode();

  // Parse filters from URL
  const filters = useMemo<GameListingFilters>(() => {
    const statesParam = searchParams.get('states');
    const participationParam = searchParams.get('participation');
    const openSpotsParam = searchParams.get('has_open_spots');
    const sortByParam = searchParams.get('sort_by');

    return {
      states: statesParam ? (statesParam.split(',') as GameState[]) : undefined,
      participation: participationParam as ParticipationFilter | undefined,
      has_open_spots: openSpotsParam === 'true' ? true : openSpotsParam === 'false' ? false : undefined,
      sort_by: (sortByParam as SortBy) || 'recent_activity',
      admin_mode: adminModeEnabled, // Add admin mode from context
    };
  }, [searchParams, adminModeEnabled]);

  // Fetch games with current filters
  const query = useQuery({
    queryKey: ['games', 'filtered', filters],
    queryFn: async () => {
      const response = await apiClient.games.getFilteredGames(filters);
      return response.data;
    },
    // Keep data fresh when returning to the page
    staleTime: 60000, // 1 minute
    // Refetch when window regains focus
    refetchOnWindowFocus: true,
  });

  // Helper to update search params
  const updateFilters = useCallback(
    (updates: Partial<GameListingFilters>) => {
      const newParams = new URLSearchParams(searchParams);

      // Update or remove states
      if ('states' in updates) {
        if (updates.states && updates.states.length > 0) {
          newParams.set('states', updates.states.join(','));
        } else {
          newParams.delete('states');
        }
      }

      // Update or remove participation filter
      if ('participation' in updates) {
        if (updates.participation) {
          newParams.set('participation', updates.participation);
        } else {
          newParams.delete('participation');
        }
      }

      // Update or remove has_open_spots
      if ('has_open_spots' in updates) {
        if (updates.has_open_spots !== null && updates.has_open_spots !== undefined) {
          newParams.set('has_open_spots', updates.has_open_spots.toString());
        } else {
          newParams.delete('has_open_spots');
        }
      }

      // Update or remove sort_by
      if ('sort_by' in updates) {
        if (updates.sort_by && updates.sort_by !== 'recent_activity') {
          newParams.set('sort_by', updates.sort_by);
        } else {
          newParams.delete('sort_by'); // Default to recent_activity
        }
      }

      setSearchParams(newParams);
    },
    [searchParams, setSearchParams]
  );

  // Convenience methods for updating individual filters
  const setStates = useCallback(
    (states: GameState[]) => {
      updateFilters({ states });
    },
    [updateFilters]
  );

  const setParticipation = useCallback(
    (participation?: ParticipationFilter) => {
      updateFilters({ participation });
    },
    [updateFilters]
  );

  const setHasOpenSpots = useCallback(
    (hasOpenSpots?: boolean | null) => {
      updateFilters({ has_open_spots: hasOpenSpots });
    },
    [updateFilters]
  );

  const setSortBy = useCallback(
    (sortBy: SortBy) => {
      updateFilters({ sort_by: sortBy });
    },
    [updateFilters]
  );

  // Clear all filters
  const clearFilters = useCallback(() => {
    setSearchParams(new URLSearchParams());
  }, [setSearchParams]);

  return {
    // Data
    games: query.data?.games ?? [],
    metadata: query.data?.metadata ?? {
      total_count: 0,
      filtered_count: 0,
      available_states: [],
    },

    // Current filter state
    filters,

    // Filter setters
    setStates,
    setParticipation,
    setHasOpenSpots,
    setSortBy,
    updateFilters,
    clearFilters,

    // Query state
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}
