import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/api';

const COMMENTS_PER_PAGE = 20;

/**
 * Hook to fetch recent comments with their parent context
 * Supports infinite scrolling via cursor-based pagination
 */
export function useRecentComments(gameId: number | undefined) {
  return useInfiniteQuery({
    queryKey: ['games', gameId, 'recentComments'],
    queryFn: async ({ pageParam }: { pageParam?: number }) => {
      if (!gameId) {
        throw new Error('Game ID is required');
      }

      const response = await apiClient.messages.getRecentComments(
        gameId,
        COMMENTS_PER_PAGE,
        pageParam ?? 0
      );
      return response.data;
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage: { comments: any[]; offset: number }) => {
      // If the last page had fewer items than the page size, we're at the end
      if (lastPage.comments.length < COMMENTS_PER_PAGE) {
        return undefined;
      }
      // Return the next offset
      return lastPage.offset + COMMENTS_PER_PAGE;
    },
    enabled: !!gameId,
    // Refetch when window regains focus to show new comments
    refetchOnWindowFocus: true,
  });
}

/**
 * Hook to fetch the total comment count for a game
 * Used for pagination info and empty states
 */
export function useTotalCommentCount(gameId: number | undefined) {
  return useQuery({
    queryKey: ['games', gameId, 'totalCommentCount'],
    queryFn: async () => {
      if (!gameId) {
        throw new Error('Game ID is required');
      }

      const count = await apiClient.messages.getTotalCommentCount(gameId);
      return count;
    },
    enabled: !!gameId,
    // Refetch when window regains focus
    refetchOnWindowFocus: true,
  });
}
