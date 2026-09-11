import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFavoriteComments, useSetCommentFavorite } from '../hooks/useFavorites';
import { useInfiniteScrollSentinel } from '../hooks/useInfiniteScrollSentinel';
import { FavoriteCommentCard } from '../components/FavoriteCommentCard';
import { Spinner, Alert } from '../components/ui';

/**
 * The cross-game list of comments the user has privately starred.
 *
 * Flat and newest-favorited-first, matching the order the API returns, so
 * pages render as they arrive with no client-side regrouping. Each card
 * carries its own game title in place of grouping.
 */
export function FavoritesPage() {
  const navigate = useNavigate();
  const {
    data,
    isLoading,
    isError,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useFavoriteComments();
  const setFavoriteMutation = useSetCommentFavorite();

  // Unfavoriting drops the comment from the server's list, but yanking the
  // card out from under the cursor makes a misclick unrecoverable without
  // finding the comment again. The card stays, dimmed, until the next load.
  const [unfavorited, setUnfavorited] = useState<Set<number>>(new Set());

  const handleToggleFavorite = useCallback(
    (commentId: number, currentlyFavorited: boolean) => {
      setUnfavorited((prev) => {
        const next = new Set(prev);
        if (currentlyFavorited) {
          next.add(commentId);
        } else {
          next.delete(commentId);
        }
        return next;
      });
      setFavoriteMutation.mutate({ commentId, favorite: !currentlyFavorited });
    },
    [setFavoriteMutation]
  );

  const allFavorites = useMemo(
    () => data?.pages.flatMap((page) => page.favorites) ?? [],
    [data]
  );

  const sentinelRef = useInfiniteScrollSentinel({
    enabled: !!hasNextPage && !isFetchingNextPage,
    onIntersect: fetchNextPage,
    threshold: 0.1,
  });

  const isEmpty = !isLoading && allFavorites.length === 0;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-content-primary">Favorites</h1>
        <p className="text-sm text-content-secondary mt-1">
          Comments you've starred, newest first. Only you can see these.
        </p>
      </div>

      {isLoading && (
        <div className="flex justify-center py-12">
          <Spinner size="lg" />
        </div>
      )}

      {isError && (
        <Alert variant="danger" title="Couldn't load favorites">
          {error instanceof Error ? error.message : 'Something went wrong.'}
        </Alert>
      )}

      {isEmpty && !isError && (
        <div className="text-center py-12">
          <p className="text-content-secondary">No favorites yet</p>
          <p className="text-sm text-content-secondary mt-2">
            Star a comment with the ☆ button in any game — including finished
            ones, from the History tab — to save it here.
          </p>
        </div>
      )}

      <div className="space-y-4">
        {allFavorites.map((comment) => (
          <FavoriteCommentCard
            key={comment.id}
            comment={comment}
            isUnfavorited={unfavorited.has(comment.id)}
            onToggleFavorite={handleToggleFavorite}
            onNavigateToComment={() =>
              navigate(`/games/${comment.game_id}?tab=common-room&comment=${comment.id}`)
            }
          />
        ))}
      </div>

      {!isEmpty && !isError && (
        <div ref={sentinelRef} className="h-20 flex items-center justify-center">
          {isFetchingNextPage && <Spinner size="md" />}
          {!hasNextPage && allFavorites.length > 0 && (
            <p className="text-sm text-content-tertiary">No more favorites to load</p>
          )}
        </div>
      )}
    </div>
  );
}
