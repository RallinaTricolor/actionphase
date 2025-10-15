import { useMemo } from 'react';
import { useUserCharacters } from './useUserCharacters';

export interface CharacterOwnershipResult {
  // Checker function
  isUserCharacter: (characterId: number) => boolean;

  // User's character IDs as a Set for easy lookup
  userCharacterIds: Set<number>;

  // Loading state
  isLoading: boolean;
}

/**
 * Hook to check character ownership for the current user in a specific game.
 * Returns a memoized checker function that efficiently determines if a character
 * belongs to the current user.
 *
 * @param gameId - The ID of the game
 * @returns CharacterOwnershipResult with checker function and loading state
 *
 * @example
 * const { isUserCharacter, isLoading } = useCharacterOwnership(gameId);
 * if (isUserCharacter(characterId)) {
 *   // Allow editing
 * }
 */
export function useCharacterOwnership(gameId: number): CharacterOwnershipResult {
  const { characters, isLoading } = useUserCharacters(gameId);

  // Create a Set of user's character IDs for efficient lookup
  const userCharacterIds = useMemo(() => {
    return new Set(characters.map(c => c.id));
  }, [characters]);

  // Memoized checker function
  const isUserCharacter = useMemo(() => {
    return (characterId: number) => userCharacterIds.has(characterId);
  }, [userCharacterIds]);

  return {
    isUserCharacter,
    userCharacterIds,
    isLoading,
  };
}
