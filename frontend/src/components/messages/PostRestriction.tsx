import { useMemo, useState } from 'react';
import { Badge, Button, type ButtonSize } from '@/components/ui';
import { useOptionalGameContext } from '@/contexts/GameContext';
import { isGameWritable } from '@/lib/gamePermissions';
import { describeViewers, listPickablePlayers } from '@/lib/postViewers';
import type { Message } from '@/types/messages';
import { PostViewersModal } from './PostViewersModal';

function useGameRoster() {
  const gameContext = useOptionalGameContext();
  const participants = useMemo(() => gameContext?.participants ?? [], [gameContext?.participants]);
  const characters = useMemo(() => gameContext?.allGameCharacters ?? [], [gameContext?.allGameCharacters]);
  return { gameContext, participants, characters };
}

interface PostRestrictionProps {
  post: Message;
  className?: string;
}

/**
 * The "Restricted" badge on a post and the list of who can see it (only sent
 * to viewers who see every restricted post). Renders nothing on a public post.
 * The GM's edit action is PostViewersButton, which callers place with their
 * other post actions.
 */
export function PostRestriction({ post, className = '' }: PostRestrictionProps) {
  const { participants, characters } = useGameRoster();

  if (!post.is_restricted) {
    return null;
  }

  return (
    <div className={`flex flex-wrap items-center gap-2 text-sm ${className}`} data-testid="post-restriction">
      <Badge variant="warning" data-testid="restricted-badge">Restricted</Badge>
      {post.viewer_user_ids && (
        <span className="text-content-secondary" data-testid="post-viewer-names">
          Visible to {describeViewers(post.viewer_user_ids, participants, characters).join(', ')}
        </span>
      )}
    </div>
  );
}

interface PostViewersButtonProps {
  post: Message;
  /** Hides the action, e.g. in History or screenshot mode. */
  readOnly?: boolean;
  onPostUpdated?: (updatedPost: Message) => void;
  size?: ButtonSize;
  className?: string;
}

/**
 * The GM's "Restrict" / "Edit viewers" action and the modal it opens.
 */
export function PostViewersButton({ post, readOnly = false, onPostUpdated, size = 'sm', className }: PostViewersButtonProps) {
  const { gameContext, participants, characters } = useGameRoster();
  const [isEditing, setIsEditing] = useState(false);
  const players = useMemo(() => listPickablePlayers(participants, characters), [participants, characters]);

  // viewer_user_ids also reaches audience and public-archive viewers, so it
  // can't decide who may edit. The endpoint takes the GM, a co-GM or an admin
  // in admin mode, which is what the context's isGM (hasGMPowers) means.
  const canEdit = !readOnly && !!gameContext?.isGM && isGameWritable(gameContext?.game?.state);

  if (!canEdit) {
    return null;
  }

  return (
    <>
      <Button
        variant="ghost"
        size={size}
        onClick={() => setIsEditing(true)}
        className={className}
        data-testid="edit-post-viewers"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
        {post.is_restricted ? 'Edit viewers' : 'Restrict'}
      </Button>

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
    </>
  );
}
