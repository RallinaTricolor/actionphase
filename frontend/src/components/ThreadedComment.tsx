import { useState, useEffect, useRef, useCallback } from 'react';
import { apiClient } from '../lib/api';
import { useToast } from '../contexts/ToastContext';
import type { Message } from '../types/messages';
import type { Character } from '../types/characters';
import { MarkdownPreview } from './MarkdownPreview';
import { CommentEditor } from './CommentEditor';
import CharacterAvatar from './CharacterAvatar';
import { Button, Select } from './ui';
import { useAdminMode } from '../hooks/useAdminMode';
import { useUpdateComment, useDeleteComment } from '../hooks/useCommentMutations';
import { useGamePermissions } from '../hooks/useGamePermissions';
import { ConfirmModal } from './ConfirmModal';

interface ThreadedCommentProps {
  comment: Message;
  gameId: number;
  characters: Character[]; // All game characters (for autocomplete)
  controllableCharacters: Character[]; // Characters the user can control (for "Reply as" dropdown)
  onCreateReply: (parentId: number, characterId: number, content: string) => Promise<void>;
  currentUserId?: number;
  depth?: number;
  maxDepth?: number; // Maximum nesting depth before showing "Continue thread" button
  unreadCommentIDs?: number[]; // IDs of comments that are "new since last visit"
  onOpenThread?: (comment: Message) => void; // Callback to open thread modal with comment object
  readOnly?: boolean; // Disable all interactive features (for history view)
}

export function ThreadedComment({
  comment,
  gameId,
  characters,
  controllableCharacters,
  onCreateReply,
  currentUserId,
  depth = 0,
  maxDepth = 5,
  unreadCommentIDs = [],
  onOpenThread,
  readOnly = false
}: ThreadedCommentProps) {
  const { showSuccess: _showSuccess, showError } = useToast();
  const [replies, setReplies] = useState<Message[]>([]);
  const [loadingReplies, setLoadingReplies] = useState(false);
  const [showReplies, setShowReplies] = useState(true); // Start expanded
  const [isReplying, setIsReplying] = useState(false);
  const [replyContent, setReplyContent] = useState('');
  const [selectedCharacterId, setSelectedCharacterId] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(comment.content);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const isMountedRef = useRef(true);
  const hasLoadedRef = useRef(false);

  const { adminModeEnabled } = useAdminMode();
  const { isGM } = useGamePermissions(gameId);
  const updateCommentMutation = useUpdateComment();
  const deleteCommentMutation = useDeleteComment();
  const isAuthor = currentUserId === comment.author_id;
  const hasReplies = (comment.reply_count || 0) > 0;
  const isUnread = unreadCommentIDs.includes(comment.id);
  const isAtMaxDepth = depth >= maxDepth;
  const [linkCopied, setLinkCopied] = useState(false);

  // Track component mount status
  useEffect(() => {
    isMountedRef.current = true; // Explicitly set to true on mount
    return () => {
      isMountedRef.current = false;
      hasLoadedRef.current = false; // Reset so component can reload if remounted
    };
  }, []);

  // Auto-select first character
  useEffect(() => {
    if (controllableCharacters.length > 0 && selectedCharacterId === null) {
      setSelectedCharacterId(controllableCharacters[0].id);
    }
  }, [controllableCharacters, selectedCharacterId]);

  // Define loadReplies as a regular function (not useCallback to avoid dependency issues)
  const loadReplies = async () => {
    if (!isMountedRef.current || hasLoadedRef.current) return;

    try {
      setLoadingReplies(true);
      const response = await apiClient.messages.getPostComments(gameId, comment.id);
      if (isMountedRef.current) {
        setReplies(response.data);
        hasLoadedRef.current = true; // Only mark as loaded after successful state update
      }
    } catch (err) {
      console.error('Failed to load replies:', err);
    } finally {
      if (isMountedRef.current) {
        setLoadingReplies(false);
      }
    }
  };

  // Load replies immediately when component mounts if there are replies
  useEffect(() => {
    if (hasReplies && !hasLoadedRef.current) {
      loadReplies();
    }
  }, [hasReplies]);

  const handleCopyLink = async () => {
    const url = `${window.location.origin}/games/${gameId}?tab=common-room&comment=${comment.id}`;
    try {
      await navigator.clipboard.writeText(url);
      if (isMountedRef.current) {
        setLinkCopied(true);
        // Reset after 2 seconds
        setTimeout(() => {
          if (isMountedRef.current) {
            setLinkCopied(false);
          }
        }, 2000);
      }
    } catch (err) {
      console.error('Failed to copy link:', err);
      // Fallback: show toast with link if clipboard API fails
      if (isMountedRef.current) {
        showError(`Failed to copy. Link: ${url}`);
      }
    }
  };

  const handleEdit = () => {
    setEditContent(comment.content);
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setEditContent(comment.content);
    setIsEditing(false);
  };

  const handleSaveEdit = async () => {
    if (!editContent.trim() || editContent === comment.content) {
      setIsEditing(false);
      return;
    }

    try {
      await updateCommentMutation.mutateAsync({
        gameId,
        postId: comment.parent_id || comment.id,
        commentId: comment.id,
        data: { content: editContent.trim() }
      });
      setIsEditing(false);
    } catch (err) {
      console.error('Failed to update comment:', err);
      showError('Failed to update comment. Please try again.');
    }
  };

  const handleDeleteClick = () => {
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = async () => {
    try {
      setIsDeleting(true);
      await deleteCommentMutation.mutateAsync({
        gameId,
        postId: comment.parent_id || comment.id,
        commentId: comment.id
      });
    } catch (err) {
      console.error('Failed to delete comment:', err);
      showError('Failed to delete comment. Please try again.');
    } finally {
      setIsDeleting(false);
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
      hasLoadedRef.current = false; // Reset so we can reload with new reply
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

  // Use consistent semantic color for thread borders (maintains visual hierarchy through indentation)
  const borderColor = depth > 0 ? 'border-l-interactive-primary' : '';

  // Alternating background colors for better visual separation between comment levels
  const backgroundColors = [
    '', // depth 0 - no background (uses parent's surface-raised)
    'surface-base', // depth 1 - base surface
    'surface-raised', // depth 2 - raised surface
    'surface-base', // depth 3 - base surface
    'surface-raised', // depth 4 - raised surface
    'surface-base', // depth 5 - base surface
  ];
  const bgColor = backgroundColors[depth % backgroundColors.length];

  return (
    <div
      id={`comment-${comment.id}`}
      data-testid="threaded-comment"
      className={`${depth > 0 ? 'ml-6 border-l-2 pl-3 ' + borderColor : ''} ${bgColor} ${depth > 0 ? 'py-3 my-2 rounded-r-lg' : 'py-2'}`}
    >
      {/* Comment Header and Content */}
      <div className={`${isUnread ? 'border-2 border-semantic-warning bg-semantic-warning-subtle rounded-lg p-3 -ml-3' : ''}`}>
        <div className="flex items-start gap-2 mb-1">
          <CharacterAvatar
            avatarUrl={comment.character_avatar_url}
            characterName={comment.character_name}
            size="sm"
          />
          <div className="flex-1">
            <span className="font-semibold text-sm text-content-primary">{comment.character_name}</span>
            <span className="text-xs text-content-secondary ml-2">
              @{comment.author_username} · {formatDate(comment.created_at)}
              {comment.is_edited && (
                <span className="ml-1 text-content-tertiary" title={comment.edited_at ? `Last edited ${formatDate(comment.edited_at)}` : undefined}>
                  (edited{comment.edit_count && comment.edit_count > 1 ? ` ${comment.edit_count}x` : ''})
                </span>
              )}
            </span>
            {isAuthor && (
              <span className="ml-2 text-xs bg-interactive-primary-subtle text-interactive-primary px-1.5 py-0.5 rounded">You</span>
            )}
            {isUnread && (
              <span className="ml-2 text-xs bg-semantic-warning-subtle text-semantic-warning px-2 py-0.5 rounded font-semibold">NEW</span>
            )}
          </div>
        </div>

        {/* Comment Content - Edit Mode or Display Mode */}
        {isEditing ? (
          <div className="mb-3">
            <CommentEditor
              value={editContent}
              onChange={setEditContent}
              placeholder="Edit comment..."
              disabled={updateCommentMutation.isPending}
              characters={characters}
            />
            <div className="flex gap-2 mt-2">
              <Button
                variant="primary"
                size="sm"
                onClick={handleSaveEdit}
                disabled={updateCommentMutation.isPending || !editContent.trim()}
              >
                {updateCommentMutation.isPending ? 'Saving...' : 'Save'}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCancelEdit}
                disabled={updateCommentMutation.isPending}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-sm text-content-primary mb-2">
            <MarkdownPreview
              content={comment.content}
              mentionedCharacters={comment.mentioned_character_ids?.map(id => {
                const char = characters.find(c => c.id === id);
                return char ? { id: char.id, name: char.name } : null;
              }).filter((c): c is { id: number; name: string } => c !== null) || []}
            />
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center gap-3 text-xs text-content-secondary">
          {!isAtMaxDepth && !isEditing && !readOnly && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsReplying(!isReplying)}
              className="text-xs h-auto p-0 hover:text-interactive-primary-hover font-medium"
            >
              Reply
            </Button>
          )}

          {hasReplies && !isAtMaxDepth && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowReplies(!showReplies)}
              className="text-xs h-auto p-0 hover:text-interactive-primary-hover font-medium flex items-center gap-1"
            >
              <span>{showReplies ? '▼' : '▶'}</span>
              <span>{comment.reply_count} {comment.reply_count === 1 ? 'reply' : 'replies'}</span>
            </Button>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopyLink}
            className="text-xs h-auto p-0 hover:text-interactive-primary-hover font-medium flex items-center gap-1"
            title="Copy link to this comment"
          >
            {linkCopied ? (
              <>
                <svg className="w-3.5 h-3.5 text-semantic-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-semantic-success">Copied!</span>
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
                <span>Copy link</span>
              </>
            )}
          </Button>

          {isAuthor && !isEditing && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleEdit}
              className="text-xs h-auto p-0 hover:text-interactive-primary-hover font-medium flex items-center gap-1"
              title="Edit this comment"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              <span>Edit</span>
            </Button>
          )}

          {(isAuthor || isGM || adminModeEnabled) && !isEditing && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDeleteClick}
              disabled={isDeleting}
              className="text-xs h-auto p-0 hover:text-semantic-danger font-medium text-semantic-danger flex items-center gap-1"
              title={isAuthor ? "Delete this comment" : (isGM ? "Delete this comment (GM)" : "Delete this comment (admin)")}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              <span>{isDeleting ? 'Deleting...' : 'Delete'}</span>
            </Button>
          )}

          {comment.parent_id && (
            <a
              href={
                comment.thread_depth === 1
                  ? `/games/${gameId}?tab=common-room&postId=${comment.parent_id}`
                  : `/games/${gameId}?tab=common-room&comment=${comment.parent_id}`
              }
              className="hover:text-interactive-primary-hover font-medium transition-colors flex items-center gap-1"
              title={comment.thread_depth === 1 ? "Go to parent post" : "Go to parent comment"}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span>Parent</span>
            </a>
          )}
        </div>
      </div>

      {/* Reply Form */}
      {isReplying && !readOnly && (
        <div className="mb-3 surface-raised rounded p-3 border border-theme-default">
          <form onSubmit={handleSubmitReply}>
            {controllableCharacters.length > 0 ? (
              <>
                {controllableCharacters.length > 1 && (
                  <Select
                    value={selectedCharacterId || ''}
                    onChange={(e) => setSelectedCharacterId(Number(e.target.value))}
                    className="mb-2"
                    disabled={isSubmitting}
                  >
                    {controllableCharacters.map((char) => (
                      <option key={char.id} value={char.id}>
                        Reply as {char.name}
                      </option>
                    ))}
                  </Select>
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
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    disabled={isSubmitting || !replyContent.trim()}
                  >
                    {isSubmitting ? 'Posting...' : 'Reply'}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setIsReplying(false);
                      setReplyContent('');
                    }}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </Button>
                </div>
              </>
            ) : (
              <p className="text-xs text-content-secondary">You need a character to reply.</p>
            )}
          </form>
        </div>
      )}

      {/* Continue Thread Button (if at max depth with replies) */}
      {isAtMaxDepth && hasReplies && (
        <div className="mt-2 ml-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenThread?.(comment)}
            className="inline-flex items-center gap-1 text-sm font-medium text-interactive-primary hover:text-interactive-primary-hover h-auto p-0"
          >
            <span>Continue this thread</span>
            <span className="text-content-secondary">({comment.reply_count} {comment.reply_count === 1 ? 'reply' : 'replies'})</span>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Button>
        </div>
      )}

      {/* Nested Replies (only if under max depth) */}
      {!isAtMaxDepth && showReplies && (hasReplies || replies.length > 0) && (
        <div className="space-y-0">
          {loadingReplies ? (
            <div className="ml-6 py-2 text-xs text-content-secondary">Loading replies...</div>
          ) : (
            replies.map((reply) => (
              <ThreadedComment
                key={reply.id}
                comment={reply}
                gameId={gameId}
                characters={characters}
                controllableCharacters={controllableCharacters}
                onCreateReply={onCreateReply}
                currentUserId={currentUserId}
                depth={depth + 1}
                maxDepth={maxDepth}
                unreadCommentIDs={unreadCommentIDs}
                onOpenThread={onOpenThread}
                readOnly={readOnly}
              />
            ))
          )}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleConfirmDelete}
        title="Delete Comment"
        message="Are you sure you want to delete this comment? This action cannot be undone."
        confirmText="Delete"
        variant="danger"
        isLoading={isDeleting}
      />
    </div>
  );
}
