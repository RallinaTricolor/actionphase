import { useState, useEffect } from 'react';
import { apiClient } from '../lib/api';
import type { Message } from '../types/messages';
import type { Character } from '../types/characters';
import { Button, Select, Textarea, Alert, Badge } from './ui';
import { logger } from '@/services/LoggingService';

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
      logger.error('Failed to load comments', { error: err, gameId, postId });
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
      logger.error('Failed to create comment', { error: err, gameId, postId, characterId: selectedCharacterId });
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
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-interactive-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Comment Form */}
      {isCommenting && (
        <form onSubmit={handleSubmitComment} className="surface-raised rounded-lg p-4 mb-3">
          {error && (
            <Alert variant="danger" className="mb-3">
              {error}
            </Alert>
          )}

          {characters.length > 0 ? (
            <>
              <div className="mb-3">
                <Select
                  value={selectedCharacterId || ''}
                  onChange={(e) => setSelectedCharacterId(Number(e.target.value))}
                  disabled={isSubmitting}
                >
                  {characters.map((char) => (
                    <option key={char.id} value={char.id}>
                      Reply as {char.name}
                    </option>
                  ))}
                </Select>
              </div>

              <Textarea
                value={commentContent}
                onChange={(e) => setCommentContent(e.target.value)}
                rows={3}
                placeholder="Write a reply..."
                disabled={isSubmitting}
                className="mb-2"
              />

              <div className="flex gap-2">
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={isSubmitting || !commentContent.trim()}
                >
                  {isSubmitting ? 'Posting...' : 'Reply'}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setIsCommenting(false);
                    setCommentContent('');
                    setError(null);
                  }}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
              </div>
            </>
          ) : (
            <p className="text-sm text-content-secondary">You need a character to comment.</p>
          )}
        </form>
      )}

      {/* Comments List */}
      {comments.length === 0 && !isCommenting ? (
        <p className="text-sm text-content-secondary italic py-2">No comments yet. Be the first to reply!</p>
      ) : (
        <div className="space-y-4">
          {comments.map((comment) => {
            const isAuthor = currentUserId === comment.author_id;
            return (
              <div key={comment.id} className="surface-raised rounded-lg p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <span className="font-semibold text-sm text-content-primary">{comment.character_name}</span>
                    <span className="text-xs text-content-secondary ml-2">
                      @{comment.author_username} · {formatDate(comment.created_at)}
                      {comment.is_edited && <span className="ml-1">(edited)</span>}
                    </span>
                  </div>
                  {isAuthor && (
                    <Badge variant="primary">You</Badge>
                  )}
                </div>
                <p className="text-base text-content-primary whitespace-pre-wrap max-w-prose">{comment.content}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
