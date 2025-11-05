import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api';
import type { CreateDeadlineRequest, UpdateDeadlineRequest } from '../types/deadlines';

/**
 * Custom hook for managing deadlines
 * Provides queries and mutations for deadline operations
 */
export function useDeadlines(gameId: number, includeExpired: boolean = false) {
  const queryClient = useQueryClient();

  // Query for all game deadlines
  const { data: deadlinesData, isLoading } = useQuery({
    queryKey: ['deadlines', gameId, includeExpired],
    queryFn: () => apiClient.deadlines.getGameDeadlines(gameId, includeExpired).then(res => res.data),
    enabled: !!gameId,
    refetchOnMount: 'always',
    staleTime: 0
  });

  // Ensure deadlines is always an array
  const deadlines = deadlinesData || [];

  // Mutation for creating a new deadline
  const createDeadlineMutation = useMutation({
    mutationFn: (data: CreateDeadlineRequest) => apiClient.deadlines.createDeadline(gameId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deadlines', gameId] });
      queryClient.invalidateQueries({ queryKey: ['upcomingDeadlines'] });
    }
  });

  // Mutation for updating a deadline
  const updateDeadlineMutation = useMutation({
    mutationFn: ({ deadlineId, data }: { deadlineId: number; data: UpdateDeadlineRequest }) =>
      apiClient.deadlines.updateDeadline(deadlineId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deadlines', gameId] });
      queryClient.invalidateQueries({ queryKey: ['upcomingDeadlines'] });
    }
  });

  // Mutation for deleting a deadline
  const deleteDeadlineMutation = useMutation({
    mutationFn: (deadlineId: number) => apiClient.deadlines.deleteDeadline(deadlineId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deadlines', gameId] });
      queryClient.invalidateQueries({ queryKey: ['upcomingDeadlines'] });
    }
  });

  return {
    deadlines,
    isLoading,
    createDeadlineMutation,
    updateDeadlineMutation,
    deleteDeadlineMutation,
  };
}

/**
 * Hook for fetching upcoming deadlines across all user's games
 * Used in dashboard and notifications
 */
export function useUpcomingDeadlines(limit: number = 10) {
  return useQuery({
    queryKey: ['upcomingDeadlines', limit],
    queryFn: () => apiClient.deadlines.getUpcomingDeadlines(limit).then(res => res.data),
    refetchOnMount: 'always',
    staleTime: 60000, // 1 minute
  });
}
