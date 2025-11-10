import { useState, useEffect } from 'react';
import { ThreadedComment } from './ThreadedComment';
import type { Message } from '../types/messages';
import type { Character } from '../types/characters';
import { Button } from './ui';
import { MarkdownPreview } from './MarkdownPreview';
import CharacterAvatar from './CharacterAvatar';

interface ThreadViewModalProps {
  gameId: number;
  postId: number; // The root post ID
  comment: Message; // Pass the comment object directly instead of just ID
  characters: Character[];
  controllableCharacters: Character[];
  onClose: () => void;
  onCreateReply: (parentId: number, characterId: number, content: string) => Promise<void>;
  currentUserId?: number;
  unreadCommentIDs?: number[];
  // New props for parent chain context (deep-link enhancement)
  parentChain?: Message[]; // Array of parent messages (oldest → target)
  hasFullThread?: boolean; // Whether we fetched all the way to root
  targetCommentId?: number; // ID of the originally requested comment to highlight
  readOnly?: boolean; // Disable all interactive features (for history view)
}

/**
 * Modal view for deeply nested comment threads
 * Shows the comment with its replies without navigating away from Common Room
 * Prevents accidental read-marking when users explore deep threads
 */
export function ThreadViewModal({
  gameId,
  postId,
  comment,
  characters,
  controllableCharacters,
  onClose,
  onCreateReply,
  currentUserId,
  unreadCommentIDs = [],
  parentChain,
  hasFullThread = true,
  targetCommentId,
  readOnly = false,
}: ThreadViewModalProps) {
  // State for nested modal (modal-within-modal for deeply nested threads)
  const [nestedModalComment, setNestedModalComment] = useState<Message | null>(null);

  // Determine if we're showing parent chain context or single comment
  const showingContext = parentChain && parentChain.length > 1;

  // Auto-scroll to target comment when modal opens
  useEffect(() => {
    if (targetCommentId && showingContext) {
      // Wait for DOM to render, then scroll to target
      const timer = setTimeout(() => {
        const element = document.getElementById(`comment-${targetCommentId}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [targetCommentId, showingContext]);

  return (
    <>
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <div
          className="surface-base rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="sticky top-0 surface-base border-b border-theme-default px-6 py-4 z-10">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xl font-bold text-content-primary">Thread View</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                aria-label="Close thread view"
                className="text-content-tertiary hover:text-content-secondary h-auto p-0"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </Button>
            </div>

            {/* Context info and "Show full thread" button */}
            {showingContext && (
              <div className="flex items-center justify-between text-sm">
                <p className="text-content-secondary">
                  Showing {parentChain.length} {parentChain.length === 1 ? 'message' : 'messages'}
                  {!hasFullThread && ' (partial context)'}
                </p>
                {!hasFullThread && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      // Navigate to full thread view
                      window.location.href = `/games/${gameId}/common-room/thread/${comment.id}`;
                    }}
                  >
                    Show full thread
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Content */}
          <div className="px-6 py-6">
            {showingContext ? (
              /* Render parent chain with clear visual hierarchy */
              <div>
                {parentChain.map((msg, index) => {
                  const isLast = index === parentChain.length - 1;

                  // Render parents as simple read-only comments, target as full ThreadedComment
                  if (!isLast) {
                    // Alternating backgrounds for visual separation
                    // Target comment (depth 0 in ThreadedComment) uses 'surface-raised'
                    // Ensure proper alternation: if parent count is even, start with base
                    // This ensures the parent of target always contrasts with target
                    const parentCount = parentChain.length - 1; // Number of parent comments
                    const shouldStartWithBase = parentCount % 2 === 1; // Odd number of parents
                    const bgColor = shouldStartWithBase
                      ? (index % 2 === 0 ? 'surface-base' : 'surface-raised')
                      : (index % 2 === 0 ? 'surface-raised' : 'surface-base');

                    // Simple parent comment rendering
                    return (
                      <div
                        key={msg.id}
                        style={{ marginLeft: `${index * 20}px` }}
                        className={`mb-3 p-4 ${bgColor} rounded-lg`}
                      >
                        <div className="flex items-start gap-2 mb-2">
                          <CharacterAvatar
                            avatarUrl={msg.character_avatar_url}
                            characterName={msg.character_name}
                            size="sm"
                          />
                          <div>
                            <span className="font-semibold text-sm text-content-primary">
                              {msg.character_name}
                            </span>
                            <span className="text-xs text-content-secondary ml-2">
                              @{msg.author_username}
                            </span>
                          </div>
                        </div>
                        <div className="text-sm text-content-primary">
                          <MarkdownPreview content={msg.content} mentionedCharacters={characters} />
                        </div>
                      </div>
                    );
                  }

                  // Target comment - full ThreadedComment with replies
                  return (
                    <div
                      key={msg.id}
                      id={`comment-${msg.id}`}
                      style={{ marginLeft: `${index * 20}px` }}
                      className="ring-2 ring-accent-primary rounded-lg p-1"
                    >
                      <ThreadedComment
                        comment={msg}
                        gameId={gameId}
                        postId={postId}
                        characters={characters}
                        controllableCharacters={controllableCharacters}
                        onCreateReply={onCreateReply}
                        onCommentDeleted={onClose}
                        currentUserId={currentUserId}
                        depth={0}
                        maxDepth={10}  // Show all replies for target
                        unreadCommentIDs={unreadCommentIDs}
                        onOpenThread={(nestedComment) => setNestedModalComment(nestedComment)}
                        readOnly={readOnly}
                      />
                    </div>
                  );
                })}
              </div>
            ) : (
              /* Single comment view (original behavior) */
              <ThreadedComment
                comment={comment}
                gameId={gameId}
                postId={postId}
                characters={characters}
                controllableCharacters={controllableCharacters}
                onCreateReply={onCreateReply}
                onCommentDeleted={onClose}
                currentUserId={currentUserId}
                readOnly={readOnly}
                depth={0}
                maxDepth={10}
                unreadCommentIDs={unreadCommentIDs}
                onOpenThread={(nestedComment) => setNestedModalComment(nestedComment)}
              />
            )}
          </div>
        </div>
      </div>

      {/* Nested Modal - Recursively render another ThreadViewModal if user clicks "Continue thread" in this modal */}
      {nestedModalComment && (
        <ThreadViewModal
          gameId={gameId}
          postId={postId} // Pass through the root post ID
          comment={nestedModalComment}
          characters={characters}
          controllableCharacters={controllableCharacters}
          onClose={() => setNestedModalComment(null)}
          onCreateReply={onCreateReply}
          currentUserId={currentUserId}
          unreadCommentIDs={unreadCommentIDs}
        />
      )}
    </>
  );
}
