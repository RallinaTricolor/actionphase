import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Badge } from './ui';
import { MarkdownPreview } from './MarkdownPreview';
import type { Character } from '../types/characters';

interface ParentCommentPreviewProps {
  content?: string | null;
  createdAt?: string | null;
  isDeleted?: boolean | null;
  messageType?: string | null;
  authorUsername?: string | null;
  characterName?: string | null;
  onNavigateToParent?: () => void;
  mentionedCharacters?: Character[];
  defaultExpanded?: boolean;
}

/**
 * Shows a preview of the parent message (post or comment) that was replied to.
 * Can be expanded to show the full content, or collapsed to show just a preview.
 */
export function ParentCommentPreview({
  content,
  createdAt,
  isDeleted,
  messageType,
  authorUsername,
  characterName,
  onNavigateToParent,
  mentionedCharacters = [],
  defaultExpanded = false,
}: ParentCommentPreviewProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  // If there's no parent content, don't render anything
  if (!content && !isDeleted) {
    return null;
  }

  const timeAgo = createdAt
    ? formatDistanceToNow(new Date(createdAt), { addSuffix: true })
    : null;

  return (
    <div className="bg-bg-secondary border-l-4 border-border-secondary rounded-lg p-3 mb-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-xs text-text-muted">Replying to</span>
          {messageType && (
            <Badge variant="secondary" size="sm">
              {messageType === 'post' ? 'Post' : 'Comment'}
            </Badge>
          )}
          {characterName && (
            <span className="font-medium text-text-heading">{characterName}</span>
          )}
          {authorUsername && (
            <span className="text-text-muted">@{authorUsername}</span>
          )}
          {timeAgo && <span className="text-xs text-text-muted">{timeAgo}</span>}
        </div>

        {!isDeleted && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-xs text-accent-primary hover:text-accent-secondary flex items-center gap-1"
          >
            <svg
              className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
            {isExpanded ? 'Collapse' : 'Expand'}
          </button>
        )}
      </div>

      {isDeleted ? (
        <div className="text-sm text-text-muted italic">[deleted]</div>
      ) : isExpanded ? (
        <div className="text-sm prose prose-sm max-w-none dark:prose-invert">
          <MarkdownPreview
            content={content || ''}
            mentionedCharacters={mentionedCharacters?.map(char => ({
              id: char.id,
              name: char.name,
              username: char.username,
              character_type: char.character_type,
              avatar_url: char.avatar_url ?? undefined
            }))}
          />
        </div>
      ) : (
        <div className="text-sm text-text-heading italic line-clamp-2">{content}</div>
      )}

      {onNavigateToParent && !isDeleted && (
        <button
          onClick={onNavigateToParent}
          className="text-xs text-accent-primary hover:text-accent-secondary mt-2 flex items-center gap-1"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
          View in thread
        </button>
      )}
    </div>
  );
}
