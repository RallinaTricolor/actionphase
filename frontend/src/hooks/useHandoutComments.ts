import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api';
import type { CreateHandoutCommentRequest, UpdateHandoutCommentRequest } from '../types/handouts';

/**
 * Hook for fetching handout comments
 */
export function useHandoutComments(gameId: number, handoutId: number) {
  const queryClient = useQueryClient();

  // Query for all comments on a handout
  const { data: commentsData, isLoading } = useQuery({
    queryKey: ['handoutComments', gameId, handoutId],
    queryFn: () => apiClient.handouts.listHandoutComments(gameId, handoutId).then(res => res.data),
    enabled: !!gameId && !!handoutId,
  });

  const comments = commentsData || [];

  // Mutation for creating a new comment
  const createCommentMutation = useMutation({
    mutationFn: (data: CreateHandoutCommentRequest) =>
      apiClient.handouts.createHandoutComment(gameId, handoutId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['handoutComments', gameId, handoutId] });
    }
  });

  // Mutation for updating a comment
  const updateCommentMutation = useMutation({
    mutationFn: ({ commentId, data }: { commentId: number; data: UpdateHandoutCommentRequest }) =>
      apiClient.handouts.updateHandoutComment(gameId, handoutId, commentId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['handoutComments', gameId, handoutId] });
    }
  });

  // Mutation for deleting a comment
  const deleteCommentMutation = useMutation({
    mutationFn: (commentId: number) =>
      apiClient.handouts.deleteHandoutComment(gameId, handoutId, commentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['handoutComments', gameId, handoutId] });
    }
  });

  return {
    comments,
    isLoading,
    createCommentMutation,
    updateCommentMutation,
    deleteCommentMutation,
  };
}
