import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api';

/**
 * Custom hook for managing phase activation logic
 * Handles unpublished results check and publishing before activation
 */
export function usePhaseActivation(gameId: number, currentPhaseId: number | undefined, enabled: boolean) {
  const queryClient = useQueryClient();

  // Query for unpublished results count in the current phase
  const { data: unpublishedCountData } = useQuery({
    queryKey: ['unpublishedResultsCount', gameId, currentPhaseId],
    queryFn: () => apiClient.getUnpublishedResultsCount(gameId, currentPhaseId!).then(res => res.data),
    enabled: !!gameId && !!currentPhaseId && enabled,
  });

  const unpublishedCount = unpublishedCountData?.count || 0;

  // Mutation for publishing all results
  const publishAllMutation = useMutation({
    mutationFn: () => apiClient.publishAllPhaseResults(gameId, currentPhaseId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['unpublishedResultsCount'] });
      queryClient.invalidateQueries({ queryKey: ['userResults'] });
    }
  });

  return {
    unpublishedCount,
    publishAllMutation,
  };
}
