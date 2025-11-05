import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api';
import type { CreateDraftCharacterUpdateRequest, UpdateDraftCharacterUpdateRequest } from '../types/phases';

/**
 * Hook to fetch draft character updates for an action result
 */
export function useDraftCharacterUpdates(gameId: number, resultId: number) {
  return useQuery({
    queryKey: ['draftCharacterUpdates', gameId, resultId],
    queryFn: async () => {
      const response = await apiClient.phases.getDraftCharacterUpdates(gameId, resultId);
      return response.data;
    },
    enabled: !!gameId && !!resultId,
  });
}

/**
 * Hook to fetch the count of draft updates for an action result
 */
export function useDraftUpdateCount(gameId: number, resultId: number) {
  return useQuery({
    queryKey: ['draftUpdateCount', gameId, resultId],
    queryFn: async () => {
      const response = await apiClient.phases.getDraftUpdateCount(gameId, resultId);
      return response.data.count;
    },
    enabled: !!gameId && !!resultId,
  });
}

/**
 * Hook to create a new draft character update
 */
export function useCreateDraftCharacterUpdate(gameId: number, resultId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateDraftCharacterUpdateRequest) => {
      const response = await apiClient.phases.createDraftCharacterUpdate(gameId, resultId, data);
      return response.data;
    },
    onSuccess: () => {
      // Invalidate draft queries to refetch
      queryClient.invalidateQueries({ queryKey: ['draftCharacterUpdates', gameId, resultId] });
      queryClient.invalidateQueries({ queryKey: ['draftUpdateCount', gameId, resultId] });
    },
  });
}

/**
 * Hook to update an existing draft character update
 */
export function useUpdateDraftCharacterUpdate(gameId: number, resultId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ draftId, fieldValue }: { draftId: number; fieldValue: string }) => {
      const data: UpdateDraftCharacterUpdateRequest = { field_value: fieldValue };
      const response = await apiClient.phases.updateDraftCharacterUpdate(gameId, resultId, draftId, data);
      return response.data;
    },
    onSuccess: () => {
      // Invalidate draft queries to refetch
      queryClient.invalidateQueries({ queryKey: ['draftCharacterUpdates', gameId, resultId] });
    },
  });
}

/**
 * Hook to delete a draft character update
 */
export function useDeleteDraftCharacterUpdate(gameId: number, resultId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (draftId: number) => {
      await apiClient.phases.deleteDraftCharacterUpdate(gameId, resultId, draftId);
    },
    onSuccess: () => {
      // Invalidate draft queries to refetch
      queryClient.invalidateQueries({ queryKey: ['draftCharacterUpdates', gameId, resultId] });
      queryClient.invalidateQueries({ queryKey: ['draftUpdateCount', gameId, resultId] });
    },
  });
}
