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
