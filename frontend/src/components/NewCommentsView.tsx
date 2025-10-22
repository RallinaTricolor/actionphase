import { useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRecentComments } from '../hooks/useRecentComments';
import { CommentWithParentCard } from './CommentWithParentCard';
import { Spinner, Alert } from './ui';

interface NewCommentsViewProps {
  gameId: number;
}

/**
 * Displays a paginated list of recent comments with their parent context.
 * Supports infinite scrolling to load more comments as the user scrolls.
 */
export function NewCommentsView({ gameId }: NewCommentsViewProps) {
  const navigate = useNavigate();
  const {
    data,
    isLoading,
    isError,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useRecentComments(gameId);

  // Infinite scroll sentinel ref
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Set up intersection observer for infinite scrolling
  useEffect(() => {
    if (!sentinelRef.current || !hasNextPage || isFetchingNextPage) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          fetchNextPage();
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(sentinelRef.current);

    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  // Error state
  if (isError) {
    return (
      <Alert variant="danger">
        <p>Failed to load recent comments</p>
        <p className="text-sm text-text-muted mt-1">
          {error instanceof Error ? error.message : 'Unknown error'}
        </p>
      </Alert>
    );
  }

  // Flatten all pages of comments into a single array
  const allComments = data?.pages.flatMap((page) => page.comments) ?? [];

  // Empty state
  if (allComments.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-text-muted">No comments yet</p>
        <p className="text-sm text-text-secondary mt-2">
          Be the first to start a conversation in the Common Room!
        </p>
      </div>
    );
  }

  // Navigate to the comment's parent message in the Common Room
  const handleNavigateToParent = (comment: typeof allComments[0]) => {
    if (!comment.parent_id) return;

    // Navigate to the post with the comment ID in the URL hash
    navigate(`/games/${gameId}/common-room?postId=${comment.parent_id}#comment-${comment.id}`);
  };

  // Navigate to the comment itself in the Common Room
  const handleNavigateToComment = (comment: typeof allComments[0]) => {
    if (!comment.parent_id) return;

    navigate(`/games/${gameId}/common-room?postId=${comment.parent_id}#comment-${comment.id}`);
  };

  return (
    <div className="space-y-4">
      {/* Comments list */}
      {allComments.map((comment) => (
        <CommentWithParentCard
          key={comment.id}
          comment={comment}
          onNavigateToParent={() => handleNavigateToParent(comment)}
          onNavigateToComment={() => handleNavigateToComment(comment)}
        />
      ))}

      {/* Infinite scroll sentinel */}
      <div ref={sentinelRef} className="h-20 flex items-center justify-center">
        {isFetchingNextPage && <Spinner size="md" />}
        {!hasNextPage && allComments.length > 0 && (
          <p className="text-sm text-text-muted">No more comments to load</p>
        )}
      </div>
    </div>
  );
}
