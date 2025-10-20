import { useState, useEffect } from 'react';
import { apiClient } from '../lib/api';
import type { Message } from '../types/messages';
import type { Character } from '../types/characters';

interface CommentThreadProps {
  postId: number;
  gameId: number;
  characters: Character[];
  onCreateComment: (postId: number, characterId: number, content: string) => Promise<void>;
  isCommenting: boolean;
  setIsCommenting: (value: boolean) => void;
  currentUserId?: number;
}

export function CommentThread({
  postId,
  gameId,
  characters,
  onCreateComment,
  isCommenting,
  setIsCommenting,
  currentUserId
}: CommentThreadProps) {
  const [comments, setComments] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCharacterId, setSelectedCharacterId] = useState<number | null>(null);
  const [commentContent, setCommentContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Auto-select first character
  if (characters.length > 0 && selectedCharacterId === null) {
    setSelectedCharacterId(characters[0].id);
  }

  useEffect(() => {
    loadComments();
  }, [postId]);

  const loadComments = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.messages.getPostComments(gameId, postId);
      setComments(response.data);
    } catch (err) {
      console.error('Failed to load comments:', err);
      setError('Failed to load comments');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedCharacterId || !commentContent.trim()) return;

    try {
      setIsSubmitting(true);
      setError(null);
      await onCreateComment(postId, selectedCharacterId, commentContent.trim());
      setCommentContent('');
      setIsCommenting(false);
      // Reload comments to show the new one
      await loadComments();
    } catch (err) {
      console.error('Failed to create comment:', err);
      setError('Failed to post comment');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="flex justify-center py-4">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Comment Form */}
      {isCommenting && (
        <form onSubmit={handleSubmitComment} className="bg-gray-50 rounded-lg p-4 mb-3">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded p-2 mb-3">
              <p className="text-red-800 text-sm">{error}</p>
            </div>
          )}

          {characters.length > 0 ? (
            <>
              <div className="mb-3">
                <select
                  value={selectedCharacterId || ''}
                  onChange={(e) => setSelectedCharacterId(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={isSubmitting}
                >
                  {characters.map((char) => (
                    <option key={char.id} value={char.id}>
                      Reply as {char.name}
                    </option>
                  ))}
                </select>
              </div>

              <textarea
                value={commentContent}
                onChange={(e) => setCommentContent(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2"
                rows={3}
                placeholder="Write a reply..."
                disabled={isSubmitting}
              />

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={isSubmitting || !commentContent.trim()}
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                >
                  {isSubmitting ? 'Posting...' : 'Reply'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsCommenting(false);
                    setCommentContent('');
                    setError(null);
                  }}
                  disabled={isSubmitting}
                  className="px-4 py-2 text-sm bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 disabled:opacity-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </>
          ) : (
            <p className="text-sm text-gray-600">You need a character to comment.</p>
          )}
        </form>
      )}

      {/* Comments List */}
      {comments.length === 0 && !isCommenting ? (
        <p className="text-sm text-gray-500 italic py-2">No comments yet. Be the first to reply!</p>
      ) : (
        <div className="space-y-3">
          {comments.map((comment) => {
            const isAuthor = currentUserId === comment.author_id;
            return (
              <div key={comment.id} className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <span className="font-semibold text-sm text-gray-900">{comment.character_name}</span>
                    <span className="text-xs text-gray-500 ml-2">
                      @{comment.author_username} · {formatDate(comment.created_at)}
                      {comment.is_edited && <span className="ml-1">(edited)</span>}
                    </span>
                  </div>
                  {isAuthor && (
                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">You</span>
                  )}
                </div>
                <p className="text-sm text-gray-800 whitespace-pre-wrap">{comment.content}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
