import { formatDistanceToNow } from 'date-fns';
import type { CommentWithParent } from '../types/messages';
import { ParentCommentPreview } from './ParentCommentPreview';
import { MarkdownPreview } from './MarkdownPreview';
import { Card, CardBody, Badge } from './ui';

interface CommentWithParentCardProps {
  comment: CommentWithParent;
  onNavigateToParent?: () => void;
  onNavigateToComment?: () => void;
}

/**
 * Displays a comment with its parent context in a card.
 * Used in the "New Comments" view to show recent activity.
 */
export function CommentWithParentCard({
  comment,
  onNavigateToParent,
  onNavigateToComment,
}: CommentWithParentCardProps) {
  const timeAgo = formatDistanceToNow(new Date(comment.created_at), {
    addSuffix: true,
  });

  const isEdited = comment.edit_count > 0;

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardBody>
        {/* Parent context preview */}
        <ParentCommentPreview
          content={comment.parent_content}
          createdAt={comment.parent_created_at}
          isDeleted={comment.parent_is_deleted}
          messageType={comment.parent_message_type}
          authorUsername={comment.parent_author_username}
          characterName={comment.parent_character_name}
          onNavigateToParent={onNavigateToParent}
        />

        {/* Comment header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="font-medium text-text-heading">
              {comment.character_name || 'Unknown'}
            </span>
            <span className="text-sm text-text-muted">
              @{comment.author_username}
            </span>
            <span className="text-sm text-text-muted">{timeAgo}</span>
            {isEdited && (
              <Badge variant="secondary" size="sm">
                Edited
              </Badge>
            )}
          </div>
        </div>

        {/* Comment content */}
        <div className="prose prose-sm max-w-none">
          {comment.is_deleted ? (
            <p className="text-text-muted italic">[deleted]</p>
          ) : (
            <MarkdownPreview content={comment.content} />
          )}
        </div>

        {/* Navigate to full thread button */}
        {onNavigateToComment && !comment.is_deleted && (
          <div className="mt-3 pt-3 border-t border-border-primary">
            <button
              onClick={onNavigateToComment}
              className="text-sm text-accent-primary hover:text-accent-secondary font-medium"
            >
              View in thread →
            </button>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
