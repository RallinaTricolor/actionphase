import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize from 'rehype-sanitize';
import type { Message } from '../types/messages';
import type { Character } from '../types/characters';
import { ThreadedComment } from './ThreadedComment';
import { ThreadViewModal } from './ThreadViewModal';
import { apiClient } from '../lib/api';
import { CommentEditor } from './CommentEditor';
import CharacterAvatar from './CharacterAvatar';
import { useMarkPostAsRead, usePostUnreadCommentIDs } from '../hooks/useReadTracking';
import { Button, Select } from './ui';

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
  const [threadModalComment, setThreadModalComment] = useState<Message | null>(null);

  // Get unread comment IDs for this post
  const unreadCommentIDs = usePostUnreadCommentIDs(gameId, post.id);

  // Mutation for marking post as read
  const markAsReadMutation = useMarkPostAsRead();

  // Ref for the post container (for intersection observer)
  const postRef = useRef<HTMLDivElement>(null);

  // Track if we've already marked this post as read in this session
  const hasMarkedAsRead = useRef(false);

  // Auto-select first controllable character
  useEffect(() => {
    if (controllableCharacters.length > 0 && selectedCharacterId === null) {
      setSelectedCharacterId(controllableCharacters[0].id);
    }
  }, [controllableCharacters, selectedCharacterId]);

  // Ref to store the mark-as-read callback to avoid re-creating the observer
  const markAsReadRef = useRef<(() => void) | undefined>(undefined);

  // Update the callback ref whenever dependencies change
  useEffect(() => {
    markAsReadRef.current = () => {
      if (hasMarkedAsRead.current) return;
      // Only mark as read if there are unread comments
      if (unreadCommentIDs.length === 0) return;

      // Find the newest comment ID if comments are loaded
      // Comments are sorted DESC (newest first), so the newest is at index 0
      const newestCommentId = topLevelComments.length > 0
        ? topLevelComments[0].id
        : undefined;

      // Mark as read
      markAsReadMutation.mutate({
        gameId,
        postId: post.id,
        data: newestCommentId ? { last_read_comment_id: newestCommentId } : {}
      });

      hasMarkedAsRead.current = true;
    };
  }, [gameId, post.id, topLevelComments, markAsReadMutation, unreadCommentIDs]);

  // Load top-level comments when showing comments
  useEffect(() => {
    let isMounted = true;

    const loadInitialComments = async () => {
      if (showComments && topLevelComments.length === 0) {
        try {
          if (isMounted) setLoadingComments(true);
          const response = await apiClient.messages.getPostComments(gameId, post.id);
          if (isMounted) {
            setTopLevelComments(response.data);

            // Mark as read after comments load successfully (if there are unread comments)
            // This is better UX than waiting for viewport intersection
            if (unreadCommentIDs.length > 0 && !hasMarkedAsRead.current) {
              // Use setTimeout to allow state to settle
              setTimeout(() => {
                markAsReadRef.current?.();
              }, 100);
            }
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
  }, [showComments, topLevelComments.length, gameId, post.id, unreadCommentIDs.length]);

  // Mark as read when comments are shown with unread items
  // This handles the case where comments are already loaded (e.g., from cache or previous view)
  useEffect(() => {
    // Only mark as read if:
    // 1. Comments are visible
    // 2. There are unread comments
    // 3. Comments have loaded (not currently loading)
    // 4. We haven't already marked this post as read
    if (showComments && unreadCommentIDs.length > 0 && !loadingComments && topLevelComments.length > 0 && !hasMarkedAsRead.current) {
      const timer = setTimeout(() => {
        markAsReadRef.current?.();
      }, 1000); // 1 second delay to ensure user is actually viewing

      return () => clearTimeout(timer);
    }
  }, [showComments, unreadCommentIDs.length, loadingComments, topLevelComments.length]);

  const loadComments = async (delayMs: number = 0) => {
    try {
      setLoadingComments(true);
      // Optional delay when reloading after creating a comment
      if (delayMs > 0) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
      const response = await apiClient.messages.getPostComments(gameId, post.id);
      setTopLevelComments(response.data);
    } catch (err) {
      console.error('Failed to load comments:', err);
    } finally {
      setLoadingComments(false);
    }
  };

  const handleShowComments = () => {
    setShowComments(!showComments);
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
    <div ref={postRef} data-testid="post-card" className="mb-8">
      {/* Post Card - Contains both post and comments */}
      <div className="surface-base rounded-xl shadow-lg border border-theme-default overflow-hidden">
      {/* GM Post Header Section */}
      <div className="bg-interactive-primary-subtle border-b-2 border-interactive-primary">
        {/* Post Header - Always visible */}
        <div className="p-4 surface-base bg-opacity-90 border-b border-interactive-primary">
          <div className="flex items-start justify-between mb-2">
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <CharacterAvatar
                  avatarUrl={post.character_avatar_url}
                  characterName={post.character_name}
                  size="md"
                />
                <div className="flex-1">
                  <h3 className="font-bold text-xl text-content-primary">{post.character_name}</h3>
                  <p className="text-sm text-content-secondary">
                    Posted by @{post.author_username} · {formatDate(post.created_at)}
                    {post.is_edited && <span className="ml-1 text-content-tertiary">(edited)</span>}
                    {isAuthor && (
                      <span className="ml-2 text-xs bg-interactive-primary-subtle text-interactive-primary px-2 py-0.5 rounded">You</span>
                    )}
                  </p>
                </div>
                {unreadCommentIDs.length > 0 && (
                  <span className="px-2 py-1 text-xs font-semibold bg-interactive-primary-subtle text-interactive-primary rounded">
                    {unreadCommentIDs.length} new {unreadCommentIDs.length === 1 ? 'comment' : 'comments'}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Toggle Button for Long Content */}
          {isLongContent && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsPostCollapsed(!isPostCollapsed)}
              className="mt-2 text-interactive-primary hover:text-interactive-primary-hover"
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
            </Button>
          )}
        </div>

        {/* Post Content - Collapsible for long content */}
        {(!isLongContent || !isPostCollapsed) && (
          <div className="p-6 surface-base">
            <div className="prose dark:prose-invert prose-sm max-w-none">
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

      {/* Comments Section - Inside the card */}
      <div className="surface-raised border-t border-theme-default">
        <div className="p-4 flex items-center gap-4 text-sm text-content-secondary flex-wrap border-b border-theme-default">
          <Button
            variant="ghost"
            onClick={handleShowComments}
            className="flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <span>
              {showComments ? 'Hide' : 'Show'} Comments ({post.comment_count || 0})
            </span>
          </Button>

          {!isCommenting && (
            <Button
              variant="primary"
              onClick={() => setIsCommenting(true)}
              className="flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
              </svg>
              <span>Add Comment</span>
            </Button>
          )}
        </div>

        {/* Inline Reply Form (at top level) */}
        {isCommenting && (
          <div className="px-4 pb-4">
            <form onSubmit={handleSubmitComment} className="surface-base rounded-lg p-4 border border-theme-default shadow-sm">
            {controllableCharacters.length > 0 ? (
              <>
                {controllableCharacters.length > 1 && (
                  <Select
                    value={selectedCharacterId || ''}
                    onChange={(e) => setSelectedCharacterId(Number(e.target.value))}
                    className="mb-3"
                    disabled={isSubmitting}
                  >
                    {controllableCharacters.map((char) => (
                      <option key={char.id} value={char.id}>
                        Reply as {char.name}
                      </option>
                    ))}
                  </Select>
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
                  <Button
                    type="submit"
                    variant="primary"
                    disabled={isSubmitting || !replyContent.trim()}
                  >
                    {isSubmitting ? 'Posting...' : 'Comment'}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setIsCommenting(false);
                      setReplyContent('');
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
          </div>
        )}

        {/* Threaded Comments */}
        {showComments && (
          <div className="p-4">
          {loadingComments ? (
            <div className="text-sm text-content-secondary text-center py-4">Loading comments...</div>
          ) : topLevelComments.length === 0 ? (
            <p className="text-sm text-content-secondary italic text-center py-4">No comments yet. Be the first to reply!</p>
          ) : (
            <div className="space-y-3">
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
                  maxDepth={5}
                  unreadCommentIDs={unreadCommentIDs}
                  onOpenThread={(comment) => setThreadModalComment(comment)}
                />
              ))}
            </div>
          )}
          </div>
        )}
      </div>
      </div>
      {/* End of Post Card */}

      {/* Thread View Modal */}
      {threadModalComment !== null && (
        <ThreadViewModal
          gameId={gameId}
          comment={threadModalComment}
          characters={characters}
          controllableCharacters={controllableCharacters}
          onClose={() => setThreadModalComment(null)}
          onCreateReply={onCreateComment}
          currentUserId={currentUserId}
          unreadCommentIDs={unreadCommentIDs}
        />
      )}
    </div>
  );
}
