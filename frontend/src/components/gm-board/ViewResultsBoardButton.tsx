import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui';
import { useGmBoardPhases } from '@/hooks/useGmBoard';
import { boardPath } from '@/lib/gmBoard/steps';

interface ViewResultsBoardButtonProps {
  gameId: number;
  phaseId: number;
  /** Whether this viewer may open the game's boards: the GM, or audience-level access while the GM shares them. */
  canView: boolean;
  /** The GM's label says Open; everyone else's says View. */
  isGM: boolean;
}

/**
 * "View results board" for a past action phase, where audience members and
 * archive readers browse phases (History). Shown only when the phase's board
 * has something on it. Hidden on narrow screens, like the board itself.
 */
export function ViewResultsBoardButton({ gameId, phaseId, canView, isGM }: ViewResultsBoardButtonProps) {
  const navigate = useNavigate();
  const phases = useGmBoardPhases(gameId, { enabled: canView });
  if (!canView || !phases.data?.includes(phaseId)) return null;
  return (
    <Button
      type="button"
      size="sm"
      variant="secondary"
      className="hidden lg:inline-flex"
      onClick={() => navigate(boardPath(gameId, phaseId))}
      data-testid="view-results-board"
    >
      {isGM ? 'Open results board' : 'View results board'}
    </Button>
  );
}
