import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize from 'rehype-sanitize';
import { formatDistanceToNow } from 'date-fns';
import type { Message } from '../types/messages';
import type { Character } from '../types/characters';
import { ThreadedComment } from './ThreadedComment';
import { ThreadViewModal } from './ThreadViewModal';
import { apiClient } from '../lib/api';
import { CommentEditor } from './CommentEditor';
import CharacterAvatar from './CharacterAvatar';
import { useMarkPostAsRead, usePostUnreadCommentIDs } from '../hooks/useReadTracking';
import { useUpdatePost } from '../hooks';
import { Button, Select } from './ui';
import { ReadingModeToggle } from './ReadingModeToggle';
import { useReadingMode } from '../contexts/ReadingModeContext';
import { getRootPostId } from '../utils/commentUtils';
import { logger } from '@/services/LoggingService';
import { buildCommentTree, type CommentTreeNode } from '../lib/utils/commentTree';
import { COMMENT_MAX_DEPTH } from '@/config/comments';

interface PostCardProps {
  post: Message;
  gameId: number;
  characters: Character[]; // All game characters (for autocomplete)
  controllableCharacters: Character[]; // Characters the user can control (for "Reply as" dropdown)
  onCreateComment: (postId: number, characterId: number, content: string) => Promise<void>;
  onPostUpdated?: (updatedPost: Message) => void; // Callback when post is edited
  currentUserId?: number;
  'data-testid'?: string;
  readOnly?: boolean; // Disable all interactive features (for history view)
}

export const PostCard = React.memo(function PostCard({ post, gameId, characters, controllableCharacters, onCreateComment, onPostUpdated, currentUserId, 'data-testid': dataTestId, readOnly = false }: PostCardProps) {
  const [showComments, setShowComments] = useState(true);
  const [isCommenting, setIsCommenting] = useState(false);
  const [commentTree, setCommentTree] = useState<CommentTreeNode[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [replyContent, setReplyContent] = useState('');
  const [selectedCharacterId, setSelectedCharacterId] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPostCollapsed, setIsPostCollapsed] = useState(false);
  const [threadModalComment, setThreadModalComment] = useState<Message | null>(null);

  // Pagination state
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [totalTopLevel, setTotalTopLevel] = useState(0);
  const [returnedTopLevel, setReturnedTopLevel] = useState(0);
  const COMMENTS_PER_PAGE = 200;

  // Edit state
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(post.content);

  // Get unread comment IDs for this post from the query
  const unreadCommentIDs = usePostUnreadCommentIDs(gameId, post.id);

  // Local state to preserve unread IDs and prevent auto-clearing
  const [localUnreadCommentIDs, setLocalUnreadCommentIDs] = useState<number[]>([]);

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

  // Initialize local unread IDs when query result changes (first load only)
  useEffect(() => {
    if (unreadCommentIDs.length > 0 && localUnreadCommentIDs.length === 0) {
      setLocalUnreadCommentIDs(unreadCommentIDs);
    }
  }, [unreadCommentIDs, localUnreadCommentIDs.length]);

  // Load paginated comments with all nested replies when showing comments
  useEffect(() => {
    let isMounted = true;

    const loadInitialComments = async () => {
      if (showComments && commentTree.length === 0 && offset === 0) {
        try {
          if (isMounted) setLoadingComments(true);
          const response = await apiClient.messages.getPostCommentsWithThreads(
            gameId,
            post.id,
            COMMENTS_PER_PAGE,
            0,
            5 // max_depth
          );
          if (isMounted) {
            // Build tree from flat array
            const tree = buildCommentTree(response.data.comments);
            setCommentTree(tree);
            setTotalTopLevel(response.data.total_top_level);
            setReturnedTopLevel(response.data.returned_top_level);
            setHasMore(response.data.has_more);
            setOffset(COMMENTS_PER_PAGE); // Next page starts here
          }
        } catch (_err) {
          if (isMounted) {
            logger.error('Failed to load comments', { error: _err, gameId, postId: post.id });
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
  }, [showComments, commentTree.length, offset, gameId, post.id, COMMENTS_PER_PAGE]);

  // Mark post as read immediately when user views it (on page load)
  useEffect(() => {
    // Always mark as read on first view to establish a read marker
    // This ensures that future comments will be correctly detected as "new"
    // Without this, users who view a post before any comments exist will never get
    // a read marker, and thus will never see new comments highlighted
    if (!hasMarkedAsRead.current) {
      markAsReadMutation.mutate({
        gameId,
        postId: post.id,
        data: {} // Mark as read with current timestamp
      });

      hasMarkedAsRead.current = true;
    }
  }, [gameId, post.id, markAsReadMutation]);

  // Reload all comments from beginning (resets pagination)
  const loadComments = async (delayMs: number = 0) => {
    try {
      setLoadingComments(true);
      // Optional delay when reloading after creating a comment
      if (delayMs > 0) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
      const response = await apiClient.messages.getPostCommentsWithThreads(
        gameId,
        post.id,
        COMMENTS_PER_PAGE,
        0,
        5 // max_depth
      );
      const tree = buildCommentTree(response.data.comments);
      setCommentTree(tree);
      setTotalTopLevel(response.data.total_top_level);
      setReturnedTopLevel(response.data.returned_top_level);
      setHasMore(response.data.has_more);
      setOffset(COMMENTS_PER_PAGE);
    } catch (_err) {
      logger.error('Failed to reload comments', { error: _err, gameId, postId: post.id });
    } finally {
      setLoadingComments(false);
    }
  };

  // Load more comments (append to existing tree)
  const loadMoreComments = async () => {
    try {
      setLoadingMore(true);
      const response = await apiClient.messages.getPostCommentsWithThreads(
        gameId,
        post.id,
        COMMENTS_PER_PAGE,
        offset,
        5 // max_depth
      );
      const newTree = buildCommentTree(response.data.comments);
      setCommentTree(prev => [...prev, ...newTree]);
      setReturnedTopLevel(prev => prev + response.data.returned_top_level);
      setHasMore(response.data.has_more);
      setOffset(prev => prev + COMMENTS_PER_PAGE);
    } catch (_err) {
      logger.error('Failed to load more comments', { error: _err, gameId, postId: post.id, offset });
    } finally {
      setLoadingMore(false);
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
    } catch (_err) {
      logger.error('Failed to submit comment', { error: _err, gameId, postId: post.id, characterId: selectedCharacterId });
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return '';
    // Backend returns UTC timestamps without 'Z' suffix
    // Append 'Z' to ensure proper UTC parsing
    const utcDateString = dateString.endsWith('Z') ? dateString : `${dateString}Z`;
    const date = new Date(utcDateString);

    // Check if date is valid
    if (isNaN(date.getTime())) {
      return '';
    }

    return formatDistanceToNow(date, {
      addSuffix: true,
    });
  };

  const isAuthor = currentUserId === post.author_id;
  const updatePostMutation = useUpdatePost();

  // Edit handlers
  const handleEdit = () => {
    setEditContent(post.content);
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setEditContent(post.content);
    setIsEditing(false);
  };

  const handleSaveEdit = async () => {
    if (!editContent.trim() || editContent === post.content) {
      setIsEditing(false);
      return;
    }

    try {
      const updatedPost = await updatePostMutation.mutateAsync({
        gameId,
        postId: post.id,
        content: editContent.trim()
      });
      setIsEditing(false);
      // Notify parent component of the update so it can update its local state
      onPostUpdated?.(updatedPost);
    } catch (_err) {
      logger.error('Failed to update post', { error: _err, gameId, postId: post.id });
    }
  };

  // Determine if post content is long (more than 500 characters)
  const isLongContent = post.content.length > 500;

  // Get reading mode context
  const { openThreadModal } = useReadingMode();

  // Handler for "Continue thread" button in reading mode
  const handleOpenThreadInReadingMode = (comment: Message) => {
    // Open thread in modal overlay instead of navigating away
    const threadContent = (
      <ThreadedComment
        comment={comment}
        gameId={gameId}
        postId={getRootPostId(comment)}
        characters={characters}
        controllableCharacters={[]} // No interactions in modal
        onCreateReply={async () => {}}
        onCommentDeleted={() => {}}
        currentUserId={currentUserId}
        depth={0}
        maxDepth={COMMENT_MAX_DEPTH}
        unreadCommentIDs={[]}
        onOpenThread={handleOpenThreadInReadingMode} // Allow nested thread viewing
        readOnly={true}
        parentComment={null}
      />
    );
    openThreadModal(threadContent);
  };

  // Build full reading mode content: post + all threaded comments as React components
  const fullReadingContent = (
    <>
      {/* Post Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-4">{post.character_name}</h1>
        <div className="prose dark:prose-invert max-w-none">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeSanitize]}
          >
            {post.content}
          </ReactMarkdown>
        </div>
      </div>

      {/* Comments Section */}
      {commentTree.length > 0 && (
        <div className="border-t border-border-primary pt-8">
          <h2 className="text-2xl font-bold mb-6">Comments ({post.comment_count || 0})</h2>
          <div className="space-y-6">
            {commentTree.map((commentNode) => (
              <ThreadedComment
                key={commentNode.id}
                comment={commentNode}
                gameId={gameId}
                postId={post.id}
                characters={characters}
                controllableCharacters={[]} // No interactions in reading mode
                onCreateReply={async () => {}} // No interactions in reading mode
                onCommentDeleted={() => {}} // No interactions in reading mode
                currentUserId={currentUserId}
                depth={0}
                maxDepth={COMMENT_MAX_DEPTH} // Same as normal view - "Continue thread" button will appear for deep threads
                unreadCommentIDs={[]}
                onOpenThread={handleOpenThreadInReadingMode} // Navigate to thread view
                readOnly={true} // Disable all interactions
                parentComment={null}
              />
            ))}
          </div>
        </div>
      )}
    </>
  );

  return (
    <div ref={postRef} id={`comment-${post.id}`} data-testid={dataTestId || "post-card"} className="mb-8">
      {/* Post Card - Contains both post and comments */}
      <div className="surface-base md:rounded-xl shadow-lg border border-theme-default overflow-hidden">
      {/* GM Post Header Section */}
      <div className="bg-interactive-primary-subtle border-b-2 border-interactive-primary">
        {/* Post Header - Always visible */}
        <div className="py-3 px-3 md:p-4 surface-base bg-opacity-90 border-b border-interactive-primary">
          <div className="flex items-start justify-between mb-2">
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <CharacterAvatar
                  avatarUrl={post.character_avatar_url}
                  characterName={post.character_name}
                  size="lg"
                  className="md:w-16 md:h-16"
                />
                <div className="flex-1">
                  <h3 className="font-bold text-xl text-content-primary">{post.character_name}</h3>
                  <p className="text-sm text-content-secondary">
                    Posted by @{post.author_username} · {formatDate(post.created_at)}
                    {post.is_edited && <span className="ml-1 text-content-tertiary">(edited)</span>}
                    {isAuthor && (
                      <span className="ml-2 text-xs bg-interactive-primary-subtle text-interactive-primary px-2 py-0.5 rounded">You</span>
                    )}
                    {isAuthor && !readOnly && !isEditing && (
                      <button
                        onClick={handleEdit}
                        className="ml-2 text-xs text-interactive-primary hover:text-interactive-primary-hover underline"
                      >
                        Edit
                      </button>
                    )}
                  </p>
                </div>
                {localUnreadCommentIDs.length > 0 && (
                  <span className="px-2 py-1 text-xs font-semibold bg-interactive-primary-subtle text-interactive-primary rounded">
                    {localUnreadCommentIDs.length} new {localUnreadCommentIDs.length === 1 ? 'comment' : 'comments'}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 mt-2">
            {/* Reading Mode Toggle */}
            {!readOnly && (
              <ReadingModeToggle showLabel={false} content={fullReadingContent} />
            )}

            {/* Toggle Button for Long Content */}
            {isLongContent && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsPostCollapsed(!isPostCollapsed)}
                className="text-interactive-primary hover:text-interactive-primary-hover"
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
        </div>

        {/* Post Content - Collapsible for long content or Edit Mode */}
        {(!isLongContent || !isPostCollapsed) && (
          <div className="py-4 px-3 md:p-6 surface-base">
            {isEditing ? (
              // Edit Mode
              <div className="space-y-3">
                <CommentEditor
                  value={editContent}
                  onChange={setEditContent}
                  placeholder="Edit your post..."
                  disabled={updatePostMutation.isPending}
                  characters={characters}
                  maxLength={50000}
                  showCharacterCount={true}
                />
                <div className="flex gap-2">
                  <Button
                    variant="primary"
                    onClick={handleSaveEdit}
                    disabled={updatePostMutation.isPending || !editContent.trim() || editContent === post.content}
                  >
                    {updatePostMutation.isPending ? 'Saving...' : 'Save'}
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={handleCancelEdit}
                    disabled={updatePostMutation.isPending}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              // View Mode
              <div className="prose dark:prose-invert max-w-prose">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={[rehypeSanitize]}
                >
                  {post.content}
                </ReactMarkdown>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Comments Section - Inside the card */}
      <div className="surface-raised border-t border-theme-default" data-comments-section="true">
        <div className="py-4 px-3 md:p-4 flex items-center gap-4 text-sm text-content-secondary flex-wrap border-b border-theme-default">
          <Button
            variant="ghost"
            onClick={handleShowComments}
            className="flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <span>
              {showComments ? 'Collapse' : 'Expand'} Comments ({post.comment_count || 0})
            </span>
          </Button>

          {!isCommenting && !readOnly && controllableCharacters.length > 0 && (
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
        {isCommenting && !readOnly && (
          <div className="px-3 md:px-4 pb-4">
            <form onSubmit={handleSubmitComment} className="surface-base rounded-lg py-3 px-3 md:p-4 border border-theme-default shadow-sm">
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
                    maxLength={10000}
                    showCharacterCount={true}
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
          loadingComments ? (
            <div className="text-sm text-content-secondary text-center py-4">Loading comments...</div>
          ) : commentTree.length === 0 ? (
            <p className="text-sm text-content-secondary italic text-center py-4">No comments yet. Be the first to reply!</p>
          ) : (
            <>
              <div className="space-y-4">
                {commentTree.map((commentNode) => (
                  <ThreadedComment
                    key={commentNode.id}
                    comment={commentNode}
                    gameId={gameId}
                    postId={post.id} // Pass the root post ID
                    characters={characters}
                    controllableCharacters={controllableCharacters}
                    onCreateReply={onCreateComment}
                    onCommentDeleted={loadComments} // Reload comments when one is deleted
                    currentUserId={currentUserId}
                    depth={0}
                    maxDepth={COMMENT_MAX_DEPTH}
                    unreadCommentIDs={localUnreadCommentIDs}
                    onOpenThread={(comment) => setThreadModalComment(comment)}
                    readOnly={readOnly}
                    parentComment={null}
                  />
                ))}
              </div>

              {/* Load More Button */}
              {hasMore && (
                <div className="mt-6 flex justify-center border-t border-theme-default pt-4">
                  <Button
                    variant="ghost"
                    onClick={loadMoreComments}
                    disabled={loadingMore}
                    className="flex items-center gap-2"
                  >
                    {loadingMore ? (
                      <>
                        <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span>Loading...</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                        <span>
                          Load More Comments ({totalTopLevel - returnedTopLevel} remaining)
                        </span>
                      </>
                    )}
                  </Button>
                </div>
              )}
            </>
          )
        )}
      </div>
      </div>
      {/* End of Post Card */}

      {/* Thread View Modal */}
      {threadModalComment !== null && (
        <ThreadViewModal
          gameId={gameId}
          postId={post.id} // Pass the root post ID
          comment={threadModalComment}
          characters={characters}
          controllableCharacters={controllableCharacters}
          onClose={() => setThreadModalComment(null)}
          onCreateReply={onCreateComment}
          currentUserId={currentUserId}
          unreadCommentIDs={localUnreadCommentIDs}
          readOnly={readOnly}
        />
      )}
    </div>
  );
});
