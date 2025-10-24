/**
 * Player Management Hooks
 *
 * Custom React Query hooks for GM player management operations:
 * - Remove players from games
 * - Add players directly (bypass application)
 * - List and reassign inactive characters
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api';
import type { Character } from '../types/characters';
import type { GameParticipant } from '../types/games';

/**
 * Hook to remove a player from a game (GM only)
 * Automatically deactivates player's characters
 */
export function useRemovePlayer(gameId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId: number) =>
      apiClient.games.removePlayer(gameId, userId),
    onSuccess: () => {
      // Invalidate participants list to reflect removal (matches GameContext query key)
      queryClient.invalidateQueries({ queryKey: ['gameParticipants', gameId] });
      // Invalidate inactive characters list (character just became inactive)
      queryClient.invalidateQueries({ queryKey: ['inactive-characters', gameId] });
      // Invalidate game characters list
      queryClient.invalidateQueries({ queryKey: ['game-characters', gameId] });
    },
  });
}

/**
 * Hook to add a player directly to a game (GM only)
 * Bypasses the application process
 */
export function useAddPlayer(gameId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId: number) =>
      apiClient.games.addPlayerDirectly(gameId, { user_id: userId }),
    onSuccess: () => {
      // Invalidate participants list to show new player (matches GameContext query key)
      queryClient.invalidateQueries({ queryKey: ['gameParticipants', gameId] });
    },
  });
}

/**
 * Hook to fetch inactive characters for a game (GM only)
 * Returns characters whose owners have been removed
 */
export function useInactiveCharacters(gameId: number) {
  return useQuery<Character[]>({
    queryKey: ['inactive-characters', gameId],
    queryFn: async () => {
      const response = await apiClient.characters.getInactiveCharacters(gameId);
      return response.data || [];
    },
    enabled: !!gameId,
  });
}

/**
 * Hook to reassign an inactive character to a new owner (GM only)
 * Useful for reassigning characters when players leave
 */
export function useReassignCharacter() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      characterId,
      newOwnerUserId,
    }: {
      characterId: number;
      newOwnerUserId: number;
    }) => {
      const response = await apiClient.characters.reassignCharacter(characterId, { new_owner_user_id: newOwnerUserId });
      return response.data;
    },
    onSuccess: (data: Character) => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['characters'] });
      queryClient.invalidateQueries({ queryKey: ['game-characters', data.game_id] });
      queryClient.invalidateQueries({
        queryKey: ['inactive-characters', data.game_id],
      });
      queryClient.invalidateQueries({ queryKey: ['controllable-characters', data.game_id] });
    },
  });
}

/**
 * Hook to fetch game participants (active only by default)
 */
export function useGameParticipants(gameId: number) {
  return useQuery<GameParticipant[]>({
    queryKey: ['game-participants', gameId],
    queryFn: async () => {
      const response = await apiClient.games.getGameParticipants(gameId);
      return response.data || [];
    },
    enabled: !!gameId,
  });
}
