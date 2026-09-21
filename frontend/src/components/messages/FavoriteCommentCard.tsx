import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import type { FavoriteComment } from '@/types/messages';
import { ParentCommentPreview } from './ParentCommentPreview';
import { MarkdownPreview } from '@/components/common/markdown/MarkdownPreview';
import { Card, CardBody, Badge, Button } from '@/components/ui';
import CharacterAvatar from '@/components/characters/CharacterAvatar';
import { FavoriteButton } from './FavoriteButton';

interface FavoriteCommentCardProps {
  comment: FavoriteComment;
  onNavigateToComment: () => void;
  onToggleFavorite: (commentId: number, currentlyFavorited: boolean) => void;
  // True once the star has been clicked off but the card is still on screen,
  // so the user can undo without hunting for the comment again.
  isUnfavorited?: boolean;
}

/**
 * A single starred comment in the cross-game favorites list.
 *
 * Deliberately not CommentWithParentCard: that component calls useGameContext
 * (which throws outside a GameProvider) and carries edit/delete/reply
 * mutations that need a game's characters and GM status. This list spans every
 * game the user plays, so it is read-only — its only actions are unfavoriting
 * and jumping to the comment in context.
 */
export function FavoriteCommentCard({
  comment,
  onNavigateToComment,
  onToggleFavorite,
  isUnfavorited = false,
}: FavoriteCommentCardProps) {
  const favoritedAt = comment.favorited_at.endsWith('Z')
    ? comment.favorited_at
    : `${comment.favorited_at}Z`;
  const favoritedAgo = formatDistanceToNow(new Date(favoritedAt), { addSuffix: true });
  const isEdited = comment.edit_count > 0;

  return (
    <Card
      className={`transition-shadow ${isUnfavorited ? 'opacity-60' : 'hover:shadow-md'}`}
      data-testid="favorite-comment-card"
    >
      <CardBody>
        {/* The game this comment belongs to. A flat cross-game list has no
            grouping to supply that context, so each card carries it. */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <Link
            to={`/games/${comment.game_id}`}
            className="min-w-0"
            data-faro-user-action-name="open-favorite-game"
          >
            <Badge variant="neutral">{comment.game_title}</Badge>
          </Link>
          <span className="text-sm text-content-tertiary whitespace-nowrap">
            Favorited {favoritedAgo}
          </span>
        </div>

        {comment.parent && (
          <ParentCommentPreview
            content={comment.parent.content}
            createdAt={comment.parent.created_at}
            isDeleted={comment.parent.is_deleted}
            messageType={comment.parent.message_type}
            authorUsername={comment.parent.author_username}
            characterName={comment.parent.character_name}
            characterAvatarUrl={comment.parent.character_avatar_url}
            hideViewInThread
          />
        )}

        <div className="flex items-center gap-3 mb-2">
          <CharacterAvatar
            avatarUrl={comment.character_avatar_url}
            characterName={comment.character_name || comment.author_username}
            size="sm"
          />
          <div className="flex flex-col min-w-0">
            <span className="font-medium text-content-primary leading-tight">
              {comment.character_name || comment.author_username}
            </span>
            <div className="flex items-center gap-2">
              {comment.author_username && (
                <>
                  <span className="text-sm text-content-tertiary">@{comment.author_username}</span>
                  <span className="text-sm text-content-tertiary">·</span>
                </>
              )}
              <span className="text-sm text-content-tertiary">
                {formatDistanceToNow(
                  new Date(comment.created_at.endsWith('Z') ? comment.created_at : `${comment.created_at}Z`),
                  { addSuffix: true }
                )}
              </span>
              {isEdited && <Badge variant="neutral">Edited</Badge>}
            </div>
          </div>
        </div>

        <div>
          {comment.is_deleted ? (
            <p className="text-content-tertiary italic">[deleted]</p>
          ) : (
            <MarkdownPreview content={comment.content} />
          )}
        </div>

        <div className="mt-3 pt-3 border-t border-theme-default flex items-center justify-between gap-2">
          <Button
            variant="ghost"
            onClick={onNavigateToComment}
            className="p-2 md:p-0 min-h-[44px] md:min-h-0 h-auto text-xs"
            data-faro-user-action-name="open-favorite-comment"
          >
            View in thread →
          </Button>
          {/* Unfavoriting is the whole point of a curated list, so it happens
              on one click with no confirm; the card stays put, dimmed, until
              the next load so the star doubles as undo. */}
          <FavoriteButton
            commentId={comment.id}
            isFavorited={!isUnfavorited}
            onToggle={onToggleFavorite}
          />
        </div>
      </CardBody>
    </Card>
  );
}
