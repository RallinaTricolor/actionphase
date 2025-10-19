import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize from 'rehype-sanitize';
import type { Message } from '../types/messages';
import type { Character } from '../types/characters';
import { ThreadedComment } from './ThreadedComment';
import { apiClient } from '../lib/api';
import { CommentEditor } from './CommentEditor';
import CharacterAvatar from './CharacterAvatar';

interface PostCardProps {
  post: Message;
  gameId: number;
  characters: Character[]; // All game characters (for autocomplete)
  controllableCharacters: Character[]; // Characters the user can control (for "Reply as" dropdown)
  onCreateComment: (postId: number, characterId: number, content: string) => Promise<void>;
  currentUserId?: number;
}

export function PostCard({ post, gameId, characters, controllableCharacters, onCreateComment, currentUserId }: PostCardProps) {
  const [showComments, setShowComments] = useState(true);
  const [isCommenting, setIsCommenting] = useState(false);
  const [topLevelComments, setTopLevelComments] = useState<Message[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [replyContent, setReplyContent] = useState('');
  const [selectedCharacterId, setSelectedCharacterId] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPostCollapsed, setIsPostCollapsed] = useState(false);

  // Auto-select first controllable character
  useEffect(() => {
    if (controllableCharacters.length > 0 && selectedCharacterId === null) {
      setSelectedCharacterId(controllableCharacters[0].id);
    }
  }, [controllableCharacters, selectedCharacterId]);

  // Load top-level comments when showing comments
  useEffect(() => {
    let isMounted = true;

    const loadInitialComments = async () => {
      if (showComments && topLevelComments.length === 0) {
        try {
          if (isMounted) setLoadingComments(true);
          const response = await apiClient.getPostComments(gameId, post.id);
          if (isMounted) {
            setTopLevelComments(response.data);
          }
        } catch (err) {
          if (isMounted) {
            console.error('Failed to load comments:', err);
          }
        } finally {
          if (isMounted) setLoadingComments(false);
        }
      }
    };

    loadInitialComments();

    return () => {
      isMounted = false;
    };
  }, [showComments, topLevelComments.length, gameId, post.id]);

  const loadComments = async (delayMs: number = 0) => {
    try {
      setLoadingComments(true);
      // Optional delay when reloading after creating a comment
      if (delayMs > 0) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
      const response = await apiClient.getPostComments(gameId, post.id);
      setTopLevelComments(response.data);
    } catch (err) {
      console.error('Failed to load comments:', err);
    } finally {
      setLoadingComments(false);
    }
  };


  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedCharacterId || !replyContent.trim()) {
      return;
    }

    try {
      setIsSubmitting(true);
      await onCreateComment(post.id, selectedCharacterId, replyContent.trim());
      setReplyContent('');
      setIsCommenting(false);
      // Ensure comments are shown and reload to display the new one
      setShowComments(true);
      await loadComments();
    } catch (err) {
      console.error('Failed to submit comment:', err);
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

  const isAuthor = currentUserId === post.author_id;

  // Determine if post content is long (more than 500 characters)
  const isLongContent = post.content.length > 500;

  return (
    <div data-testid="post-card" className="mb-6 border-b-4 border-gray-200 pb-6">
      {/* Collapsible GM Post Section */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-lg shadow-lg">
        {/* Post Header - Always visible */}
        <div className="p-4 bg-white bg-opacity-90 border-b border-blue-200">
          <div className="flex items-start justify-between mb-2">
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <CharacterAvatar
                  avatarUrl={post.character_avatar_url}
                  characterName={post.character_name}
                  size="md"
                />
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
                  </svg>
                  <h3 className="font-bold text-xl text-gray-900">GM Post: {post.character_name}</h3>
                </div>
              </div>
              <p className="text-sm text-gray-600 mt-1">
                Posted by @{post.author_username} · {formatDate(post.created_at)}
                {post.is_edited && <span className="ml-1 text-gray-400">(edited)</span>}
                {isAuthor && (
                  <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">You</span>
                )}
              </p>
            </div>
          </div>

          {/* Toggle Button for Long Content */}
          {isLongContent && (
            <button
              onClick={() => setIsPostCollapsed(!isPostCollapsed)}
              className="mt-2 flex items-center gap-2 text-sm font-medium text-blue-700 hover:text-blue-800 transition-colors"
            >
              {isPostCollapsed ? (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                  Show Full Post
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                  </svg>
                  Collapse Post
                </>
              )}
            </button>
          )}
        </div>

        {/* Post Content - Collapsible for long content */}
        {(!isLongContent || !isPostCollapsed) && (
          <div className="p-6 bg-white">
            <div className="prose prose-sm max-w-none">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeSanitize]}
              >
                {post.content}
              </ReactMarkdown>
            </div>
          </div>
        )}
      </div>

      {/* Comments Section */}
      <div className="mt-4">
        <div className="flex items-center gap-4 text-sm text-gray-600 mb-3">
          <button
            onClick={() => setShowComments(!showComments)}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors font-medium"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <span>
              {showComments ? 'Hide' : 'Show'} Comments ({post.comment_count || 0})
            </span>
          </button>

          {!isCommenting && (
            <button
              onClick={() => setIsCommenting(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
              </svg>
              <span>Add Comment</span>
            </button>
          )}
        </div>

        {/* Inline Reply Form (at top level) */}
        {isCommenting && (
          <div className="mt-4">
            <form onSubmit={handleSubmitComment} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            {controllableCharacters.length > 0 ? (
              <>
                {controllableCharacters.length > 1 && (
                  <select
                    value={selectedCharacterId || ''}
                    onChange={(e) => setSelectedCharacterId(Number(e.target.value))}
                    className="w-full mb-3 px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={isSubmitting}
                  >
                    {controllableCharacters.map((char) => (
                      <option key={char.id} value={char.id}>
                        Reply as {char.name}
                      </option>
                    ))}
                  </select>
                )}

                <div className="mb-3">
                  <CommentEditor
                    value={replyContent}
                    onChange={setReplyContent}
                    placeholder="Write a comment..."
                    disabled={isSubmitting}
                    characters={characters}
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={isSubmitting || !replyContent.trim()}
                    className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
                  >
                    {isSubmitting ? 'Posting...' : 'Comment'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsCommenting(false);
                      setReplyContent('');
                    }}
                    disabled={isSubmitting}
                    className="px-4 py-2 text-sm bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors font-medium"
                  >
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              <p className="text-sm text-gray-600">You need a character to comment.</p>
            )}
          </form>
          </div>
        )}

        {/* Threaded Comments */}
        {showComments && (
          <div className="mt-4 pt-4 border-t border-gray-200">
          {loadingComments ? (
            <div className="text-sm text-gray-500">Loading comments...</div>
          ) : topLevelComments.length === 0 ? (
            <p className="text-sm text-gray-500 italic">No comments yet. Be the first to reply!</p>
          ) : (
            <div className="space-y-4">
              {topLevelComments.map((comment) => (
                <ThreadedComment
                  key={comment.id}
                  comment={comment}
                  gameId={gameId}
                  characters={characters}
                  controllableCharacters={controllableCharacters}
                  onCreateReply={onCreateComment}
                  currentUserId={currentUserId}
                  depth={0}
                />
              ))}
            </div>
          )}
          </div>
        )}
      </div>
    </div>
  );
}
