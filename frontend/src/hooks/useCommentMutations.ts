import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api';
import type { UpdateCommentRequest } from '../types/messages';

/**
 * Hook to update a comment
 */
export function useUpdateComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      gameId,
      postId,
      commentId,
      data
    }: {
      gameId: number;
      postId: number;
      commentId: number;
      data: UpdateCommentRequest
    }) => {
      const response = await apiClient.messages.updateComment(gameId, postId, commentId, data);
      return response.data;
    },
    onSuccess: async (_updatedComment, variables) => {
      // Invalidate post comments to reflect the edit
      await queryClient.invalidateQueries({
        queryKey: ['postComments', variables.gameId, variables.postId]
      });

      // Also invalidate game posts if the updated comment is cached there
      await queryClient.invalidateQueries({
        queryKey: ['gamePosts', variables.gameId]
      });
    },
  });
}

/**
 * Hook to delete a comment
 */
export function useDeleteComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      gameId,
      postId,
      commentId
    }: {
      gameId: number;
      postId: number;
      commentId: number
    }) => {
      const response = await apiClient.messages.deleteComment(gameId, postId, commentId);
      return response.data;
    },
    onSuccess: async (_, variables) => {
      // Invalidate all queries related to comments in this game
      // This ensures all comment lists (including nested replies) are refetched
      await queryClient.invalidateQueries({
        queryKey: ['postComments', variables.gameId]
      });

      // Also invalidate game posts to update comment counts
      await queryClient.invalidateQueries({
        queryKey: ['gamePosts', variables.gameId]
      });

      // Invalidate comment replies queries
      await queryClient.invalidateQueries({
        queryKey: ['commentReplies', variables.gameId]
      });
    },
  });
}
