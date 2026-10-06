import { useState } from 'react';
import { Modal } from '@/components/common/modals/Modal';
import { Alert, Button } from '@/components/ui';
import { useSetPostViewers } from '@/hooks';
import { extractApiErrorMessage } from '@/lib/errors';
import { describeViewers, type PickablePlayer } from '@/lib/postViewers';
import type { Character } from '@/types/characters';
import type { GameParticipant } from '@/types/games';
import type { Message } from '@/types/messages';
import { PostViewerPicker } from './PostViewerPicker';

interface PostViewersModalProps {
  post: Message;
  players: PickablePlayer[];
  participants: GameParticipant[];
  characters: Character[];
  onClose: () => void;
  onSaved?: (updatedPost: Message) => void;
}

/**
 * Edits an existing post's allowlist, or makes it public or restricted.
 */
export function PostViewersModal({ post, players, participants, characters, onClose, onSaved }: PostViewersModalProps) {
  const [restricted, setRestricted] = useState(post.is_restricted);
  const [viewerIds, setViewerIds] = useState<number[]>(post.viewer_user_ids ?? []);
  const [error, setError] = useState<string | null>(null);
  const mutation = useSetPostViewers();

  // A listed player who has left the game keeps access (the picker only
  // offers active players), but the backend accepts only active players in a
  // new list, so saving drops them.
  const activeIds = new Set(players.map((p) => p.userId));
  const departedIds = (post.viewer_user_ids ?? []).filter((id) => !activeIds.has(id));
  const keptIds = viewerIds.filter((id) => activeIds.has(id));
  const missingViewers = restricted && keptIds.length === 0;

  const handleSave = async () => {
    setError(null);
    try {
      const updated = await mutation.mutateAsync({
        gameId: post.game_id,
        postId: post.id,
        data: restricted ? { restricted: true, user_ids: keptIds } : { restricted: false },
      });
      onSaved?.(updated);
      onClose();
    } catch (err) {
      setError(extractApiErrorMessage(err) ?? 'Failed to save who can see this post.');
    }
  };

  return (
    <Modal isOpen title="Who can see this post" onClose={onClose} testId="post-viewers-modal">
      <div className="space-y-4">
        <Alert variant="warning">
          Players you take off the list lose the whole thread, including their own comments in it.
          Those comments also disappear from their character's page for anyone not on the list.
          Their in-app notifications about the thread are deleted, but Discord messages already sent
          can't be recalled.
        </Alert>

        {error && <Alert variant="danger">{error}</Alert>}

        <PostViewerPicker
          players={players}
          restricted={restricted}
          onRestrictedChange={setRestricted}
          selectedUserIds={viewerIds}
          onSelectedChange={setViewerIds}
          disabled={mutation.isPending}
        />

        {restricted && departedIds.length > 0 && (
          <p className="text-sm text-content-secondary" data-testid="departed-viewers-note">
            {describeViewers(departedIds, participants, characters).join(', ')}{' '}
            {departedIds.length === 1 ? 'is' : 'are'} no longer an active player and will be taken off
            the list when you save.
          </p>
        )}

        <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            type="button"
            variant="primary"
            onClick={handleSave}
            disabled={mutation.isPending || missingViewers}
            data-testid="save-post-viewers"
          >
            {mutation.isPending ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
