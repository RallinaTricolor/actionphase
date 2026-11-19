import { useState } from 'react';
import { Alert, Button, Spinner } from '@/components/ui';
import { useScoreboard } from '@/hooks/useScoreboard';
import { isGameWritable } from '@/lib/gamePermissions';
import type { CharacterSheetConfig } from '@/types/characters';
import { ScoreboardEditor } from './ScoreboardEditor';
import { ScoreboardOrderSummary } from './ScoreboardOrderSummary';
import { ScoreboardTable } from './ScoreboardTable';

interface ScoreboardViewProps {
  gameId: number;
  /** GM authority. Only someone who can repair the board is told it needs repair. */
  isGM: boolean;
  game: { state?: string; character_sheet?: CharacterSheetConfig };
}

/**
 * The Scoreboard tab. Everything shown here is what the server chose to send
 * this viewer, already filtered and in order. The GM edits the setup here too,
 * while the game still accepts changes.
 */
export function ScoreboardView({ gameId, isGM, game }: ScoreboardViewProps) {
  const { data: board, isLoading, isError, refetch } = useScoreboard(gameId);
  const [editing, setEditing] = useState(false);
  const canEdit = isGM && isGameWritable(game.state);

  if (editing && canEdit) {
    return <ScoreboardEditor gameId={gameId} game={game} onClose={() => setEditing(false)} />;
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="lg" label="Loading scoreboard" />
      </div>
    );
  }

  if (isError) {
    return (
      <Alert variant="danger" title="The scoreboard didn't load">
        <Button type="button" variant="secondary" size="sm" className="mt-2" onClick={() => void refetch()}>
          Try again
        </Button>
      </Alert>
    );
  }

  if (!board) {
    return <p className="py-12 text-center text-content-secondary">This game's scoreboard isn't open to you.</p>;
  }

  const columns = board.columns ?? [];
  const brokenIds = new Set(board.broken_column_ids ?? []);
  const brokenLabels = columns.filter((column) => brokenIds.has(column.id)).map((column) => column.label);

  return (
    <section aria-labelledby="scoreboard-heading" className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="scoreboard-heading" className="text-2xl font-bold text-content-primary">Scoreboard</h2>
          <div className="mt-1 space-y-1">
            <ScoreboardOrderSummary board={board} testIdPrefix="scoreboard" />
          </div>
        </div>
        {canEdit && columns.length > 0 && (
          <Button type="button" variant="secondary" onClick={() => setEditing(true)} data-testid="edit-scoreboard">
            Edit scoreboard
          </Button>
        )}
      </div>

      {isGM && brokenLabels.length > 0 && (
        <Alert variant="warning" title="Some columns have lost their source" data-testid="scoreboard-broken-columns">
          {brokenLabels.join(', ')}: the character sheet tab or field this reads no longer exists, so the column is blank.
          Fix or remove it before saving other scoreboard changes.
        </Alert>
      )}

      {canEdit && columns.length === 0 && (
        <div>
          <Button type="button" variant="primary" size="sm" onClick={() => setEditing(true)}>
            Set up columns
          </Button>
        </div>
      )}

      <ScoreboardTable board={board} />
    </section>
  );
}
