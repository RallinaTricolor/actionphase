import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api';

export function useUserActionResults(gameId: number) {
  return useQuery({
    queryKey: ['actionResults', 'user', gameId],
    queryFn: async () => {
      const response = await apiClient.getUserResults(gameId);
      return response.data;
    },
    enabled: !!gameId,
  });
}

export function useGameActionResults(gameId: number) {
  return useQuery({
    queryKey: ['actionResults', 'game', gameId],
    queryFn: async () => {
      const response = await apiClient.getGameResults(gameId);
      return response.data;
    },
    enabled: !!gameId,
  });
}

export function useCreateActionResult(gameId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { user_id: number; content: string; is_published?: boolean }) => {
      const response = await apiClient.createActionResult(gameId, data);
      return response.data;
    },
    onSuccess: () => {
      // Invalidate action results queries to refetch
      queryClient.invalidateQueries({ queryKey: ['actionResults', 'game', gameId] });
      queryClient.invalidateQueries({ queryKey: ['actionResults', 'user', gameId] });
    },
  });
}
