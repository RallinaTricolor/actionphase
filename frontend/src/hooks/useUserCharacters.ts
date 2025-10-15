import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/api';
import type { Character } from '../types/characters';

export interface UserCharactersResult {
  // User's controllable characters
  characters: Character[];

  // Loading and error states
  isLoading: boolean;
  error: Error | null;

  // Refetch function
  refetch: () => Promise<void>;
}

/**
 * Hook to fetch the current user's controllable characters for a specific game.
 * This includes player characters they created and any NPCs assigned to them.
 *
 * @param gameId - The ID of the game
 * @returns UserCharactersResult with character list and loading state
 *
 * @example
 * const { characters, isLoading } = useUserCharacters(gameId);
 */
export function useUserCharacters(gameId: number): UserCharactersResult {
  const {
    data: characters,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['userControllableCharacters', gameId],
    queryFn: async () => {
      console.log('[useUserCharacters] Fetching controllable characters for gameId:', gameId);
      const response = await apiClient.getUserControllableCharacters(gameId);
      console.log('[useUserCharacters] Characters loaded:', response.data);
      return response.data || [];
    },
    enabled: !!gameId,
    staleTime: 30000, // Cache for 30 seconds
    retry: 1,
  });

  return {
    characters: characters || [],
    isLoading,
    error: error as Error | null,
    refetch: async () => {
      await refetch();
    },
  };
}
