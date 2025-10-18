import { useState, useEffect } from 'react';
import { apiClient } from '../lib/api';
import type { Message } from '../types/messages';
import type { Character } from '../types/characters';
import { MarkdownPreview } from './MarkdownPreview';
import { CommentEditor } from './CommentEditor';

interface ThreadedCommentProps {
  comment: Message;
  gameId: number;
  characters: Character[]; // All game characters (for autocomplete)
  onCreateReply: (parentId: number, characterId: number, content: string) => Promise<void>;
  currentUserId?: number;
  depth?: number;
}

export function ThreadedComment({
  comment,
  gameId,
  characters,
  onCreateReply,
  currentUserId,
  depth = 0
}: ThreadedCommentProps) {
  // Filter to only characters the current user can control (for "Reply as" dropdown)
  const controllableCharacters = characters.filter(char => char.user_id === currentUserId);
  const [replies, setReplies] = useState<Message[]>([]);
  const [loadingReplies, setLoadingReplies] = useState(false);
  const [showReplies, setShowReplies] = useState(true); // Start expanded
  const [isReplying, setIsReplying] = useState(false);
  const [replyContent, setReplyContent] = useState('');
  const [selectedCharacterId, setSelectedCharacterId] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isAuthor = currentUserId === comment.author_id;
  const hasReplies = (comment.reply_count || 0) > 0;

  // Auto-select first character
  useEffect(() => {
    if (controllableCharacters.length > 0 && selectedCharacterId === null) {
      setSelectedCharacterId(controllableCharacters[0].id);
    }
  }, [controllableCharacters, selectedCharacterId]);

  // Load replies immediately when component mounts if there are replies
  useEffect(() => {
    if (hasReplies && replies.length === 0) {
      loadReplies();
    }
  }, [hasReplies]);

  const loadReplies = async () => {
    try {
      setLoadingReplies(true);
      const response = await apiClient.getPostComments(gameId, comment.id);
      setReplies(response.data);
    } catch (err) {
      console.error('Failed to load replies:', err);
    } finally {
      setLoadingReplies(false);
    }
  };


  const handleSubmitReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCharacterId || !replyContent.trim()) return;

    try {
      setIsSubmitting(true);
      console.log('[ThreadedComment] Creating reply to comment:', comment.id);
      await onCreateReply(comment.id, selectedCharacterId, replyContent.trim());
      console.log('[ThreadedComment] Reply created successfully');
      setReplyContent('');
      setIsReplying(false);
      // Ensure replies are shown and reload to display the new one
      setShowReplies(true);
      console.log('[ThreadedComment] Loading replies...');
      await loadReplies();
      console.log('[ThreadedComment] Replies loaded (state may be stale in log)');
    } catch (err) {
      console.error('Failed to submit reply:', err);
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
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  // Calculate left border color based on depth
  const borderColors = [
    'border-l-blue-400',
    'border-l-green-400',
    'border-l-yellow-400',
    'border-l-purple-400',
    'border-l-pink-400',
    'border-l-indigo-400',
  ];
  const borderColor = depth > 0 ? borderColors[depth % borderColors.length] : '';

  return (
    <div className={`${depth > 0 ? 'ml-6 border-l-2 pl-3 ' + borderColor : ''}`}>
      {/* Comment Header and Content */}
      <div className="py-2">
        <div className="flex items-start gap-2 mb-1">
          <div className="flex-1">
            <span className="font-semibold text-sm text-gray-900">{comment.character_name}</span>
            <span className="text-xs text-gray-500 ml-2">
              @{comment.author_username} · {formatDate(comment.created_at)}
              {comment.is_edited && <span className="ml-1">(edited)</span>}
            </span>
            {isAuthor && (
              <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded">You</span>
            )}
          </div>
        </div>

        <div className="text-sm text-gray-800 mb-2">
          <MarkdownPreview
            content={comment.content}
            mentionedCharacters={comment.mentioned_character_ids?.map(id => {
              const char = characters.find(c => c.id === id);
              return char ? { id: char.id, name: char.name } : null;
            }).filter((c): c is { id: number; name: string } => c !== null) || []}
          />
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3 text-xs text-gray-500">
          <button
            onClick={() => setIsReplying(!isReplying)}
            className="hover:text-blue-600 font-medium transition-colors"
          >
            Reply
          </button>

          {hasReplies && (
            <button
              onClick={() => setShowReplies(!showReplies)}
              className="hover:text-blue-600 font-medium transition-colors flex items-center gap-1"
            >
              <span>{showReplies ? '▼' : '▶'}</span>
              <span>{comment.reply_count} {comment.reply_count === 1 ? 'reply' : 'replies'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Reply Form */}
      {isReplying && (
        <div className="mb-3 bg-gray-50 rounded p-3 border border-gray-200">
          <form onSubmit={handleSubmitReply}>
            {controllableCharacters.length > 0 ? (
              <>
                {controllableCharacters.length > 1 && (
                  <select
                    value={selectedCharacterId || ''}
                    onChange={(e) => setSelectedCharacterId(Number(e.target.value))}
                    className="w-full mb-2 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                    disabled={isSubmitting}
                  >
                    {controllableCharacters.map((char) => (
                      <option key={char.id} value={char.id}>
                        Reply as {char.name}
                      </option>
                    ))}
                  </select>
                )}

                <div className="mb-2">
                  <CommentEditor
                    value={replyContent}
                    onChange={setReplyContent}
                    placeholder="Write a reply..."
                    disabled={isSubmitting}
                    characters={characters}
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={isSubmitting || !replyContent.trim()}
                    className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
                  >
                    {isSubmitting ? 'Posting...' : 'Reply'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsReplying(false);
                      setReplyContent('');
                    }}
                    disabled={isSubmitting}
                    className="px-3 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors font-medium"
                  >
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              <p className="text-xs text-gray-600">You need a character to reply.</p>
            )}
          </form>
        </div>
      )}

      {/* Nested Replies */}
      {showReplies && (hasReplies || replies.length > 0) && (
        <div className="space-y-0">
          {loadingReplies ? (
            <div className="ml-6 py-2 text-xs text-gray-500">Loading replies...</div>
          ) : (
            replies.map((reply) => (
              <ThreadedComment
                key={reply.id}
                comment={reply}
                gameId={gameId}
                characters={characters}
                onCreateReply={onCreateReply}
                currentUserId={currentUserId}
                depth={depth + 1}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}
