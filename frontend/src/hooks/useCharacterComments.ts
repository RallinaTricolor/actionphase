import { useInfiniteQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/api';

const MESSAGES_PER_PAGE = 20;

/**
 * Hook to fetch a character's public posts and comments with infinite scrolling
 */
export function useCharacterComments(characterId: number | undefined) {
  return useInfiniteQuery({
    queryKey: ['characters', characterId, 'comments'],
    queryFn: async ({ pageParam }: { pageParam?: number }) => {
      if (!characterId) {
        throw new Error('Character ID is required');
      }
      const response = await apiClient.characters.getCharacterComments(
        characterId,
        MESSAGES_PER_PAGE,
        pageParam ?? 0
      );
      return response.data;
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.messages.length < MESSAGES_PER_PAGE) {
        return undefined;
      }
      return allPages.length * MESSAGES_PER_PAGE;
    },
    enabled: !!characterId,
  });
}
