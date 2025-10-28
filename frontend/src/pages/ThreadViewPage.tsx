import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/api';
import { ThreadedComment } from '../components/ThreadedComment';
import { getRootPostId } from '../utils/commentUtils';

/**
 * Focused view for a specific comment thread
 * Shows the comment with context from parent comments
 * Used when threads exceed max depth or for deep linking
 */
export function ThreadViewPage() {
  const { gameId, commentId } = useParams<{ gameId: string; commentId: string }>();
  const navigate = useNavigate();

  // Fetch the specific comment
  const { data: commentData, isLoading: isLoadingComment, error: commentError } = useQuery({
    queryKey: ['comment', gameId, commentId],
    queryFn: async () => {
      const response = await apiClient.messages.getMessage(Number(gameId), Number(commentId));
      return response.data;
    },
    enabled: !!gameId && !!commentId,
  });

  // Fetch replies to this comment
  const { data: repliesData, isLoading: isLoadingReplies } = useQuery({
    queryKey: ['commentReplies', gameId, commentId],
    queryFn: async () => {
      const response = await apiClient.messages.getPostComments(Number(gameId), Number(commentId));
      return response.data;
    },
    enabled: !!gameId && !!commentId,
  });

  const isLoading = isLoadingComment || isLoadingReplies;
  const error = commentError;

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
  const replies = repliesData || [];

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

      {/* Target Comment (highlighted) */}
      <div className="bg-semantic-warning-subtle border-2 border-semantic-warning rounded-lg p-6 mb-6">
        <div className="text-xs font-semibold text-semantic-warning uppercase mb-3 flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
          </svg>
          <span>This comment</span>
        </div>
        <ThreadedComment
          comment={comment}
          gameId={Number(gameId)!}
          postId={getRootPostId(comment)} // Calculate root post ID from comment
          characters={[]}
          controllableCharacters={[]}
          onCreateReply={async () => {}}
          depth={0}
          maxDepth={3}  // Allow some nesting in focused view
        />
      </div>

      {/* Children (if any) */}
      {replies.length > 0 && (
        <div>
          <div className="text-sm font-medium text-content-primary mb-3 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
            </svg>
            <span>Replies to this comment:</span>
          </div>
          <div className="surface-base rounded-lg border border-theme-default p-4 space-y-4">
            {replies.map((reply) => (
              <ThreadedComment
                key={reply.id}
                comment={reply}
                gameId={Number(gameId)!}
                postId={getRootPostId(reply)} // Calculate root post ID from reply
                characters={[]}
                controllableCharacters={[]}
                onCreateReply={async () => {}}
                depth={0}
                maxDepth={3}
              />
            ))}
          </div>
        </div>
      )}

      {/* No replies message */}
      {replies.length === 0 && (
        <div className="text-center py-8 text-content-tertiary text-sm italic">
          No replies to this comment yet.
        </div>
      )}
    </div>
  );
}
