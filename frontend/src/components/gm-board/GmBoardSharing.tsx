import { Toggle } from '@/components/ui';
import { useToast } from '@/contexts/ToastContext';
import { useGmSettings, useSetGmBoardSharing } from '@/hooks/useGmBoard';
import { isPublicArchive } from '@/lib/gamePermissions';
import { logger } from '@/services/LoggingService';

interface GmBoardSharingProps {
  gameId: number;
  gameState: string;
}

/**
 * "Share the results board": read-only, every phase's board and this setup,
 * with the audience while the game runs and with everyone once it's an
 * epilogue or completed. Works in any game state.
 */
export function GmBoardSharing({ gameId, gameState }: GmBoardSharingProps) {
  const { shareGmBoard, isLoading } = useGmSettings(gameId);
  const setSharing = useSetGmBoardSharing(gameId);
  const { showError } = useToast();
  const who = isPublicArchive(gameState)
    ? 'Anyone who can see this game can read every phase’s board and this setup.'
    : 'The game’s audience can read every phase’s board and this setup while the game runs. Once the game is in its epilogue or completed, anyone who can see it can.';

  return (
    <Toggle
      label="Share the results board"
      description={`${who} They see everything, read-only: your notes, private moments and codex secrets included.`}
      checked={shareGmBoard}
      disabled={isLoading || setSharing.isPending}
      onChange={(on) =>
        setSharing.mutate(on, {
          onError: (error) => {
            logger.error('Failed to change results board sharing', { error, gameId });
            showError('Couldn’t change sharing. Try again.');
          },
        })
      }
      data-testid="gm-board-share"
    />
  );
}
