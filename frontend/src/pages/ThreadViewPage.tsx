import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/api';
import { ThreadedComment } from '../components/ThreadedComment';
import { getRootPostId } from '../utils/commentUtils';
import { THREAD_VIEW_MAX_DEPTH } from '@/config/comments';

/**
 * Focused view for a specific comment thread
 * Shows the comment with context from parent comments
 * Used when threads exceed max depth or for deep linking
 */
export function ThreadViewPage() {
  const { gameId, commentId } = useParams<{ gameId: string; commentId: string }>();
  const navigate = useNavigate();

  // Fetch the specific comment with its full thread tree
  const { data: commentData, isLoading, error } = useQuery({
    queryKey: ['comment', gameId, commentId],
    queryFn: async () => {
      const response = await apiClient.messages.getMessage(Number(gameId), Number(commentId));
      return response.data;
    },
    enabled: !!gameId && !!commentId,
  });

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="text-content-secondary">Loading thread...</div>
      </div>
    );
  }

  if (error || !commentData) {
    return (
      <div className="text-center py-12">
        <div className="text-semantic-danger font-semibold mb-2">Failed to load thread</div>
        <p className="text-content-secondary mb-4">The comment you're looking for could not be found.</p>
        <button
          onClick={() => navigate(`/games/${gameId}?tab=common-room`)}
          className="text-interactive-primary hover:text-interactive-primary-hover font-medium"
        >
          ← Back to Common Room
        </button>
      </div>
    );
  }

  const comment = commentData;

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {/* Breadcrumb Navigation */}
      <div className="mb-6">
        <button
          onClick={() => navigate(`/games/${gameId}?tab=common-room`)}
          className="inline-flex items-center gap-2 text-interactive-primary hover:text-interactive-primary-hover font-medium text-sm transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          <span>Back to Common Room</span>
        </button>
      </div>

      {/* Thread Title */}
      <h1 className="text-2xl font-bold text-content-primary mb-6">Thread View</h1>

      {/* Render the comment with its full nested thread tree */}
      <ThreadedComment
        comment={comment}
        gameId={Number(gameId)!}
        postId={getRootPostId(comment)}
        characters={[]}
        controllableCharacters={[]}
        onCreateReply={async () => {}}
        depth={0}
        maxDepth={THREAD_VIEW_MAX_DEPTH}  // Show deep nesting in thread view modal (depth 10)
      />
    </div>
  );
}
