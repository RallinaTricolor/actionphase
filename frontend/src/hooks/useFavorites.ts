import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { apiClient } from '../lib/api';

const FAVORITES_PER_PAGE = 20;

// Every favorite-id cache lives under this prefix, game-scoped keys as
// ['favoriteCommentIDs', gameId] and the cross-game one as
// ['favoriteCommentIDs', 'all']. The optimistic update below walks the whole
// prefix, so a new consumer gets correct star state for free.
const FAVORITE_IDS_KEY = 'favoriteCommentIDs';

/**
 * Comment IDs the caller has starred within one game.
 *
 * Returns a Set so a comment tree can test membership in O(1) while rendering.
 */
export function useGameFavoriteCommentIDs(gameId: number | undefined) {
  const query = useQuery({
    queryKey: [FAVORITE_IDS_KEY, gameId],
    queryFn: async () => {
      if (!gameId) throw new Error('Game ID required');
      return apiClient.messages.getGameFavoriteCommentIDs(gameId);
    },
    enabled: !!gameId,
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000,
  });

  const favoriteIds = useMemo(() => new Set(query.data ?? []), [query.data]);

  return { ...query, favoriteIds };
}

/**
 * Comment IDs the caller has starred across every game.
 *
 * Used where the surface is not scoped to a single game -- the character
 * profile feed, which shows one character's comments from wherever they were
 * posted.
 */
export function useFavoriteCommentIDs() {
  const query = useQuery({
    queryKey: [FAVORITE_IDS_KEY, 'all'],
    queryFn: async () => apiClient.messages.getFavoriteCommentIDs(),
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000,
  });

  const favoriteIds = useMemo(() => new Set(query.data ?? []), [query.data]);

  return { ...query, favoriteIds };
}

/**
 * The /favorites page feed: starred comments newest-starred first, paginated.
 *
 * Cursor-paginated, not offset. Unfavoriting removes a row from the middle of
 * the ordered set, so an offset page boundary shifts up by one and the next
 * favorite is skipped for good. The server returns the cursor for the page
 * after each one; a null cursor is the end of the list.
 */
export function useFavoriteComments() {
  return useInfiniteQuery({
    queryKey: ['favoriteComments'],
    queryFn: async ({ pageParam }: { pageParam?: string | null }) => {
      return apiClient.messages.getFavoriteComments(FAVORITES_PER_PAGE, pageParam);
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.pagination.next_cursor ?? undefined,
  });
}

/**
 * Star or unstar a comment.
 *
 * Optimistic, unlike the read-tracking mutations it is otherwise modelled on.
 * The star has to fill the instant it is pressed; waiting out a round-trip is
 * the single most noticeable way this feature can feel broken.
 *
 * `onMutate` writes into *every* cached favorite-id key rather than just the
 * one the caller is looking at, because the same comment can be on screen in
 * two surfaces at once (a game's common room and the cross-game 'all' set),
 * and a star that fills in one place but not the other looks like a bug.
 */
export function useSetCommentFavorite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ commentId, favorite }: { commentId: number; favorite: boolean }) => {
      await apiClient.messages.setCommentFavorite(commentId, favorite);
    },
    onMutate: async ({ commentId, favorite }) => {
      const queryKey = [FAVORITE_IDS_KEY];
      await queryClient.cancelQueries({ queryKey });

      // Snapshot every id cache so onError can restore them exactly.
      const previous = queryClient.getQueriesData<number[]>({ queryKey });

      queryClient.setQueriesData<number[]>({ queryKey }, (old) => {
        if (!old) return old;
        if (favorite) {
          return old.includes(commentId) ? old : [...old, commentId];
        }
        return old.filter((id) => id !== commentId);
      });

      return { previous };
    },
    onError: (_err, _variables, context) => {
      context?.previous?.forEach(([key, data]) => {
        queryClient.setQueryData(key, data);
      });
    },
    onSettled: () => {
      // Only the id caches are refetched. The /favorites listing is
      // deliberately NOT invalidated: the page keeps an unfavorited card on
      // screen, dimmed, so the star doubles as undo, and refetching would both
      // yank that card away and re-page the cursor-paginated list mid-scroll.
      // The listing refreshes on the next mount, which is when the user has
      // actually left and come back.
      queryClient.invalidateQueries({ queryKey: [FAVORITE_IDS_KEY] });
    },
  });
}
