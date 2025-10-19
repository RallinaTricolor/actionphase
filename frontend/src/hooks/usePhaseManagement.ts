import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api';
import type { CreatePhaseRequest, UpdatePhaseRequest, UpdateDeadlineRequest } from '../types/phases';

/**
 * Custom hook for managing game phases
 * Provides queries and mutations for phase CRUD operations
 */
export function usePhaseManagement(gameId: number) {
  const queryClient = useQueryClient();

  // Query for all game phases
  const { data: phasesData, isLoading } = useQuery({
    queryKey: ['gamePhases', gameId],
    queryFn: () => apiClient.getGamePhases(gameId).then(res => res.data),
    enabled: !!gameId,
    refetchOnMount: 'always',
    staleTime: 0
  });

  // Ensure phases is always an array
  const phases = phasesData || [];

  // Query for current active phase
  const { data: currentPhaseData } = useQuery({
    queryKey: ['currentPhase', gameId],
    queryFn: () => apiClient.getCurrentPhase(gameId).then(res => res.data),
    enabled: !!gameId,
    refetchOnMount: 'always',
    staleTime: 0
  });

  // Mutation for creating a new phase
  const createPhaseMutation = useMutation({
    mutationFn: (data: CreatePhaseRequest) => apiClient.createPhase(gameId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gamePhases', gameId] });
      queryClient.invalidateQueries({ queryKey: ['currentPhase', gameId] });
    }
  });

  // Mutation for activating a phase
  const activatePhaseMutation = useMutation({
    mutationFn: (phaseId: number) => apiClient.activatePhase(phaseId),
    onSuccess: async () => {
      // Force immediate refetch instead of just invalidation
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ['gamePhases', gameId] }),
        queryClient.refetchQueries({ queryKey: ['currentPhase', gameId] })
      ]);
    },
    onError: (error) => {
      console.error('Failed to activate phase:', error);
      alert(error instanceof Error ? error.message : 'Failed to activate phase');
    }
  });

  // Mutation for updating phase deadline
  const updateDeadlineMutation = useMutation({
    mutationFn: ({ phaseId, data }: { phaseId: number; data: UpdateDeadlineRequest }) =>
      apiClient.updatePhaseDeadline(phaseId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gamePhases', gameId] });
      queryClient.invalidateQueries({ queryKey: ['currentPhase', gameId] });
    }
  });

  // Mutation for updating phase details
  const updatePhaseMutation = useMutation({
    mutationFn: ({ phaseId, data }: { phaseId: number; data: UpdatePhaseRequest }) =>
      apiClient.updatePhase(phaseId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gamePhases', gameId] });
      queryClient.invalidateQueries({ queryKey: ['currentPhase', gameId] });
    }
  });

  const currentPhase = currentPhaseData?.phase || phases.find(p => p.is_active);

  return {
    phases,
    currentPhase,
    isLoading,
    createPhaseMutation,
    activatePhaseMutation,
    updateDeadlineMutation,
    updatePhaseMutation,
  };
}
