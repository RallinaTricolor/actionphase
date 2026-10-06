import { useId } from 'react';
import { Toggle, Checkbox, Alert } from '@/components/ui';
import { playerLabel, type PickablePlayer } from '@/lib/postViewers';

interface PostViewerPickerProps {
  players: PickablePlayer[];
  restricted: boolean;
  onRestrictedChange: (restricted: boolean) => void;
  selectedUserIds: number[];
  onSelectedChange: (userIds: number[]) => void;
  disabled?: boolean;
}

/**
 * The "restrict who can see this post" switch and, when it's on, one checkbox
 * per active player. Shared by the post form, the draft form and the
 * edit-viewers modal. Callers must block submit while it's on with nobody
 * ticked: the backend rejects an empty allowlist.
 */
export function PostViewerPicker({
  players,
  restricted,
  onRestrictedChange,
  selectedUserIds,
  onSelectedChange,
  disabled = false,
}: PostViewerPickerProps) {
  const idPrefix = useId();

  const toggle = (userId: number) => {
    onSelectedChange(
      selectedUserIds.includes(userId)
        ? selectedUserIds.filter((id) => id !== userId)
        : [...selectedUserIds, userId]
    );
  };

  return (
    <div className="space-y-3" data-testid="post-viewer-picker">
      <Toggle
        checked={restricted}
        onChange={onRestrictedChange}
        disabled={disabled}
        label="Restrict who can see this post"
        description="Only the players you pick, co-GMs and the audience will see it and its comments."
        data-testid="restrict-post-toggle"
      />

      {restricted && (
        players.length === 0 ? (
          <Alert variant="warning">There are no active players to choose from.</Alert>
        ) : (
          <fieldset className="border border-theme-default rounded-lg p-3 space-y-2 surface-raised">
            <legend className="px-1 text-sm font-medium text-content-primary">Visible to</legend>
            {players.map((player) => (
              <Checkbox
                key={player.userId}
                id={`${idPrefix}-viewer-${player.userId}`}
                label={playerLabel(player)}
                helperText={player.characterNames.length > 0 ? `@${player.username}` : undefined}
                checked={selectedUserIds.includes(player.userId)}
                onChange={() => toggle(player.userId)}
                disabled={disabled}
                data-testid={`post-viewer-${player.userId}`}
              />
            ))}
            {selectedUserIds.length === 0 && (
              <p className="text-xs text-content-secondary">Pick at least one player.</p>
            )}
          </fieldset>
        )
      )}
    </div>
  );
}
