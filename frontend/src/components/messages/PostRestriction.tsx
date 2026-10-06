import { useMemo, useState } from 'react';
import { Badge, Button } from '@/components/ui';
import { useOptionalGameContext } from '@/contexts/GameContext';
import { isGameWritable } from '@/lib/gamePermissions';
import { describeViewers, listPickablePlayers } from '@/lib/postViewers';
import type { Message } from '@/types/messages';
import { PostViewersModal } from './PostViewersModal';

interface PostRestrictionProps {
  post: Message;
  /** Hides the edit action, e.g. in History or screenshot mode. */
  readOnly?: boolean;
  onPostUpdated?: (updatedPost: Message) => void;
  className?: string;
}

/**
 * The "Restricted" badge on a post, the list of who can see it (only sent to
 * viewers who see every restricted post), and the GM's edit action.
 */
export function PostRestriction({ post, readOnly = false, onPostUpdated, className = '' }: PostRestrictionProps) {
  const gameContext = useOptionalGameContext();
  const [isEditing, setIsEditing] = useState(false);

  const participants = useMemo(() => gameContext?.participants ?? [], [gameContext?.participants]);
  const characters = useMemo(() => gameContext?.allGameCharacters ?? [], [gameContext?.allGameCharacters]);
  const players = useMemo(() => listPickablePlayers(participants, characters), [participants, characters]);

  // viewer_user_ids also reaches audience and public-archive viewers, so it
  // can't decide who may edit. The endpoint takes the GM, a co-GM or an admin
  // in admin mode, which is what the context's isGM (hasGMPowers) means.
  const canEdit = !readOnly && !!gameContext?.isGM && isGameWritable(gameContext?.game?.state);

  if (!post.is_restricted && !canEdit) {
    return null;
  }

  return (
    <div className={`flex flex-wrap items-center gap-2 text-sm ${className}`} data-testid="post-restriction">
      {post.is_restricted && (
        <Badge variant="warning" data-testid="restricted-badge">Restricted</Badge>
      )}
      {post.is_restricted && post.viewer_user_ids && (
        <span className="text-content-secondary" data-testid="post-viewer-names">
          Visible to {describeViewers(post.viewer_user_ids, participants, characters).join(', ')}
        </span>
      )}
      {canEdit && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsEditing(true)}
          data-testid="edit-post-viewers"
        >
          {post.is_restricted ? 'Edit viewers' : 'Restrict'}
        </Button>
      )}

      {isEditing && (
        <PostViewersModal
          post={post}
          players={players}
          participants={participants}
          characters={characters}
          onClose={() => setIsEditing(false)}
          onSaved={onPostUpdated}
        />
      )}
    </div>
  );
}
