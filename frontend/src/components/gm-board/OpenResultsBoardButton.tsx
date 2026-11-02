import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui';
import { boardPath } from '@/lib/gmBoard/steps';
import type { GamePhase } from '@/types/phases';

interface OpenResultsBoardButtonProps {
  gameId: number;
  phase: GamePhase | null | undefined;
}

/**
 * Opens the results board for the current phase, from the GM's results area.
 * Only action phases have a board. Switching between the board and the
 * results area is safe both ways: results live in the same place for both.
 */
export function OpenResultsBoardButton({ gameId, phase }: OpenResultsBoardButtonProps) {
  const navigate = useNavigate();
  if (!phase || phase.phase_type !== 'action') return null;
  return (
    <div className="hidden lg:flex justify-end mb-4">
      <Button
        type="button"
        variant="secondary"
        onClick={() => navigate(boardPath(gameId, phase.id))}
        data-testid="open-results-board"
      >
        Open results board
      </Button>
    </div>
  );
}
