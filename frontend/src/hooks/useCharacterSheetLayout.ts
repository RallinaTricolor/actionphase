import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api';
import type { CharacterSheetConfig } from '../types/characters';

/**
 * Saves a game's whole character sheet layout (the Character Sheet editor).
 *
 * The layout reaches the sheet through the game (GameContext) and, outside a
 * game, through each controllable character's `game_character_sheet`, so both
 * are refetched.
 */
export function useUpdateCharacterSheet(gameId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (config: CharacterSheetConfig) =>
      apiClient.games.updateCharacterSheet(gameId, config).then((res) => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gameDetails', gameId] });
      queryClient.invalidateQueries({ queryKey: ['controllableCharactersAcrossGames'] });
    },
  });
}

/**
 * Every character's sheet rows in a game, keyed by character id. The editor
 * counts from it how many characters a removal would hide data for.
 *
 * Same key and fetch as useGameCharacterSheetItems, so the two share a cache.
 */
export function useGameCharacterData(gameId: number) {
  return useQuery({
    queryKey: ['gameCharacterData', gameId],
    queryFn: () => apiClient.characters.getGameCharacterData(gameId).then((res) => res.data),
    staleTime: 60_000,
  });
}
