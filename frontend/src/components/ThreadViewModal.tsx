import { useState } from 'react';
import { ThreadedComment } from './ThreadedComment';
import type { Message } from '../types/messages';
import type { Character } from '../types/characters';
import { Button } from './ui';

interface ThreadViewModalProps {
  gameId: number;
  comment: Message; // Pass the comment object directly instead of just ID
  characters: Character[];
  controllableCharacters: Character[];
  onClose: () => void;
  onCreateReply: (parentId: number, characterId: number, content: string) => Promise<void>;
  currentUserId?: number;
  unreadCommentIDs?: number[];
}

/**
 * Modal view for deeply nested comment threads
 * Shows the comment with its replies without navigating away from Common Room
 * Prevents accidental read-marking when users explore deep threads
 */
export function ThreadViewModal({
  gameId,
  comment,
  characters,
  controllableCharacters,
  onClose,
  onCreateReply,
  currentUserId,
  unreadCommentIDs = [],
}: ThreadViewModalProps) {
  // State for nested modal (modal-within-modal for deeply nested threads)
  const [nestedModalComment, setNestedModalComment] = useState<Message | null>(null);

  return (
    <>
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <div
          className="surface-base rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="sticky top-0 surface-base border-b border-theme-default px-6 py-4 flex items-center justify-between z-10">
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

          {/* Content */}
          <div className="px-6 py-6">
            {/* Target Comment - Render with depth 0, normal threaded style */}
            <ThreadedComment
              comment={comment}
              gameId={gameId}
              characters={characters}
              controllableCharacters={controllableCharacters}
              onCreateReply={onCreateReply}
              currentUserId={currentUserId}
              depth={0}
              maxDepth={10}  // Allow deep nesting in modal view (up to 10 additional levels)
              unreadCommentIDs={unreadCommentIDs}
              onOpenThread={(nestedComment) => setNestedModalComment(nestedComment)}  // Allow opening nested modals
            />
          </div>
        </div>
      </div>

      {/* Nested Modal - Recursively render another ThreadViewModal if user clicks "Continue thread" in this modal */}
      {nestedModalComment && (
        <ThreadViewModal
          gameId={gameId}
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
