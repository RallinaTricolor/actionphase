import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api';

/**
 * Hook to assign an NPC to a user
 */
export function useAssignNPC() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ characterId, assignedUserId, gameId: _gameId }: { characterId: number; assignedUserId: number; gameId: number }) =>
      apiClient.characters.assignNPC(characterId, { assigned_user_id: assignedUserId }),
    onSuccess: (_, variables) => {
      // Invalidate character queries to refresh the list with the correct query key
      queryClient.invalidateQueries({ queryKey: ['gameCharacters', variables.gameId] });
      queryClient.invalidateQueries({ queryKey: ['character', variables.characterId] });
    },
  });
}

/**
 * Hook to rename a character
 */
export function useRenameCharacter() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ characterId, name }: { characterId: number; name: string; gameId?: number }) =>
      apiClient.characters.renameCharacter(characterId, { name }),
    onSuccess: (_data, variables) => {
      // Invalidate character queries to refresh with the new name
      queryClient.invalidateQueries({ queryKey: ['character', variables.characterId] });
      if (variables.gameId) {
        queryClient.invalidateQueries({ queryKey: ['gameCharacters', variables.gameId] });
        queryClient.invalidateQueries({ queryKey: ['userCharacters', variables.gameId] });
      }
      // Also invalidate any dashboard queries that might show this character
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

/**
 * Hook to hide an NPC from regular players, or reveal it. GM only.
 *
 * Invalidates `gameCharacters`, which is the single source GameContext exposes
 * as `allCharacters` — so the roster, the mention autocomplete and the
 * new-conversation participant list all correct themselves from one
 * invalidation. There is no client-side hidden filter to keep in sync: the
 * backend omits hidden NPCs from the response outright.
 */
export function useSetCharacterHidden() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ characterId, isHidden }: { characterId: number; isHidden: boolean; gameId?: number }) =>
      apiClient.characters.setCharacterHidden(characterId, isHidden),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['character', variables.characterId] });
      if (variables.gameId) {
        queryClient.invalidateQueries({ queryKey: ['gameCharacters', variables.gameId] });
        queryClient.invalidateQueries({ queryKey: ['userControllableCharacters', variables.gameId] });
      }
    },
  });
}
