import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
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

/**
 * How many of a game's loot tables roll into each tab, keyed by tab key. The
 * editor won't remove a tab a table targets (the server refuses too).
 *
 * Same key and fetch as useLootTableManagement, so the two share a cache, and
 * refetched on mount for the reason that hook gives: tables are created
 * elsewhere, often while the editor is unmounted.
 */
export function useLootTableTargetCounts(gameId: number): ReadonlyMap<string, number> | undefined {
  const { data } = useQuery({
    queryKey: ['lootTables', gameId],
    queryFn: () => apiClient.games.getLootTables(gameId).then((res) => res.data),
    staleTime: 0,
    refetchOnMount: 'always',
  });
  return useMemo(() => {
    if (!data) return undefined;
    const counts = new Map<string, number>();
    for (const table of data) counts.set(table.target_tab, (counts.get(table.target_tab) ?? 0) + 1);
    return counts;
  }, [data]);
}
