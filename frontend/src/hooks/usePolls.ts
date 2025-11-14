import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api';
import type {
  CreatePollRequest,
  UpdatePollRequest,
  SubmitVoteRequest
} from '../types/polls';

/**
 * Custom hook for managing polls in a game
 * Provides queries and mutations for poll operations
 */
export function usePolls(gameId: number, includeExpired: boolean = false) {
  const queryClient = useQueryClient();

  // Query for all game polls
  const { data: pollsData, isLoading } = useQuery({
    queryKey: ['polls', gameId, includeExpired],
    queryFn: () => apiClient.polls.getGamePolls(gameId, includeExpired).then(res => res.data),
    enabled: !!gameId,
    refetchOnMount: 'always',
    staleTime: 0
  });

  // Ensure polls is always an array
  const polls = pollsData || [];

  // Mutation for creating a new poll
  const createPollMutation = useMutation({
    mutationFn: (data: CreatePollRequest) => apiClient.polls.createPoll(gameId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['polls', gameId] });
    }
  });

  // Mutation for updating a poll
  const updatePollMutation = useMutation({
    mutationFn: ({ pollId, data }: { pollId: number; data: UpdatePollRequest }) =>
      apiClient.polls.updatePoll(pollId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['polls', gameId] });
      queryClient.invalidateQueries({ queryKey: ['polls', 'by-phase'] });
      queryClient.invalidateQueries({ queryKey: ['poll'] });
    }
  });

  // Mutation for deleting a poll
  const deletePollMutation = useMutation({
    mutationFn: (pollId: number) => apiClient.polls.deletePoll(pollId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['polls', gameId] });
      queryClient.invalidateQueries({ queryKey: ['polls', 'by-phase'] });
    }
  });

  return {
    polls,
    isLoading,
    createPollMutation,
    updatePollMutation,
    deletePollMutation,
  };
}

/**
 * Custom hook for fetching polls by phase
 * Used in History tab to display polls from historical phases
 */
export function usePollsByPhase(gameId: number, phaseId: number) {
  const { data: pollsData, isLoading, error } = useQuery({
    queryKey: ['polls', 'by-phase', gameId, phaseId],
    queryFn: () => apiClient.polls.getPollsByPhase(gameId, phaseId).then(res => res.data),
    enabled: !!gameId && !!phaseId,
    staleTime: 1000 * 60, // 1 minute cache
  });

  return {
    data: pollsData || [],
    isLoading,
    error,
  };
}

/**
 * Hook for fetching a specific poll with its options
 */
export function usePoll(pollId: number | null) {
  return useQuery({
    queryKey: ['poll', pollId],
    queryFn: () => apiClient.polls.getPoll(pollId!).then(res => res.data),
    enabled: !!pollId,
    refetchOnMount: 'always',
    staleTime: 0
  });
}

/**
 * Hook for fetching poll results
 */
export function usePollResults(pollId: number | null) {
  return useQuery({
    queryKey: ['pollResults', pollId],
    queryFn: () => apiClient.polls.getPollResults(pollId!).then(res => res.data),
    enabled: !!pollId,
    refetchOnMount: 'always',
    staleTime: 0
  });
}

/**
 * Hook for submitting/updating a vote
 */
export function useSubmitVote(pollId: number, gameId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: SubmitVoteRequest) => apiClient.polls.submitVote(pollId, data),
    onSuccess: () => {
      // Invalidate ALL polls queries to update user_has_voted flag
      queryClient.invalidateQueries({ queryKey: ['polls', gameId] });
      queryClient.invalidateQueries({ queryKey: ['polls', 'by-phase'] });

      // Invalidate poll results to show updated vote counts
      queryClient.invalidateQueries({ queryKey: ['pollResults', pollId] });
      queryClient.invalidateQueries({ queryKey: ['poll', pollId] });
    }
  });
}
