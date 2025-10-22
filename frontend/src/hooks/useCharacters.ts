import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api';

/**
 * Hook to assign an NPC to a user
 */
export function useAssignNPC() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ characterId, assignedUserId, gameId }: { characterId: number; assignedUserId: number; gameId: number }) =>
      apiClient.characters.assignNPC(characterId, { assigned_user_id: assignedUserId }),
    onSuccess: (_, variables) => {
      // Invalidate character queries to refresh the list with the correct query key
      queryClient.invalidateQueries({ queryKey: ['gameCharacters', variables.gameId] });
      queryClient.invalidateQueries({ queryKey: ['character', variables.characterId] });
    },
  });
}
