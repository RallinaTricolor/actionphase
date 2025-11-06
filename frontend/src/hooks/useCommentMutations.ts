import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api';
import type { UpdateCommentRequest, Message } from '../types/messages';

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
    onSuccess: async (updatedComment, variables) => {
      // Update the comment in all relevant query caches immediately
      // This ensures the UI updates without waiting for refetch

      // Update in post comments cache
      queryClient.setQueryData<Message[]>(
        ['postComments', variables.gameId, variables.postId],
        (oldComments) => {
          if (!oldComments) return oldComments;
          return oldComments.map(comment =>
            comment.id === updatedComment.id ? updatedComment : comment
          );
        }
      );

      // Update in comment replies cache (for any parent that might have this as a reply)
      const commentRepliesQueries = queryClient.getQueriesData<Message[]>({
        queryKey: ['commentReplies', variables.gameId]
      });

      commentRepliesQueries.forEach(([queryKey, oldReplies]) => {
        if (oldReplies) {
          const updated = oldReplies.map(comment =>
            comment.id === updatedComment.id ? updatedComment : comment
          );
          queryClient.setQueryData(queryKey, updated);
        }
      });

      // Update in game posts cache if this comment is nested there
      queryClient.setQueryData<Message[]>(
        ['gamePosts', variables.gameId],
        (oldPosts) => {
          if (!oldPosts) return oldPosts;
          return oldPosts.map(post => {
            // Note: Message type doesn't have a replies field
            // Comments are fetched separately, so we just return the post as-is
            return post;
          });
        }
      );

      // Invalidate queries to ensure fresh data on next access
      await queryClient.invalidateQueries({
        queryKey: ['postComments', variables.gameId, variables.postId]
      });

      await queryClient.invalidateQueries({
        queryKey: ['commentReplies', variables.gameId]
      });

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
