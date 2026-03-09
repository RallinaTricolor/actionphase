import { useGameContext } from '../contexts/GameContext';
import type { Character } from '../types/characters';

export interface UserCharactersResult {
  // User's controllable characters
  characters: Character[];

  // Loading and error states
  isLoading: boolean;
  error: Error | null;

  // Refetch function (no-op: data is managed by GameContext)
  refetch: () => Promise<void>;
}

/**
 * Hook to get the current user's controllable characters for a specific game.
 * Reads from GameContext — data is fetched and cached centrally.
 *
 * @param _gameId - Unused; kept for API compatibility
 * @returns UserCharactersResult with character list and loading state
 *
 * @example
 * const { characters, isLoading } = useUserCharacters(gameId);
 */
export function useUserCharacters(_gameId: number): UserCharactersResult {
  const { userCharacters, isLoadingCharacters } = useGameContext();

  return {
    characters: userCharacters,
    isLoading: isLoadingCharacters,
    error: null,
    refetch: async () => {},
  };
}
