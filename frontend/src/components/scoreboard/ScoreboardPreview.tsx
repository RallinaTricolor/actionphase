import { Alert, Button, Spinner } from '@/components/ui';
import { useScoreboardPreview } from '@/hooks/useScoreboard';
import { extractApiErrorMessage } from '@/lib/errors';
import { describeScoreboardCut, describeScoreboardSort } from '@/lib/scoreboardFormat';
import type { ScoreboardConfig } from '@/types/scoreboard';
import { ScoreboardTable } from './ScoreboardTable';

interface ScoreboardPreviewProps {
  gameId: number;
  /** The unsaved setup, as it would be stored. */
  config: ScoreboardConfig;
  /** Players of an archived game see every column. */
  isArchived: boolean;
}

/**
 * The board as players would get it from the unsaved setup. The server builds
 * it, the same way it builds the real one, so it can't disagree with what they
 * would see.
 */
export function ScoreboardPreview({ gameId, config, isArchived }: ScoreboardPreviewProps) {
  const { data: board, isLoading, isError, error, refetch } = useScoreboardPreview(gameId, config);

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="lg" label="Loading preview" />
      </div>
    );
  }

  if (isError || !board) {
    const reason = extractApiErrorMessage(error);
    return (
      <Alert variant="danger" title="The preview didn't load" data-testid="scoreboard-preview-error">
        {reason && <p>{reason}</p>}
        <Button type="button" variant="secondary" size="sm" className="mt-2" onClick={() => void refetch()}>
          Try again
        </Button>
      </Alert>
    );
  }

  return (
    <div className="space-y-3" data-testid="scoreboard-preview">
      {isArchived ? (
        <Alert variant="info">Once a game reaches its epilogue, players see every column.</Alert>
      ) : config.visibility !== 'public' && (
        <Alert variant="info">
          Players can't open this board yet. This is what they'll see if you make it visible to everyone.
        </Alert>
      )}
      <p className="text-sm text-content-secondary" data-testid="scoreboard-preview-sort">
        {describeScoreboardSort(board.sort_description)}
      </p>
      {board.top_count ? (
        <p className="text-sm font-medium text-content-primary" data-testid="scoreboard-preview-top-count">
          {describeScoreboardCut(board.top_count)}
        </p>
      ) : null}
      {!board.columns?.length && <p className="text-sm text-content-secondary">Players see no columns.</p>}
      {board.rows?.length ? (
        <ScoreboardTable board={board} />
      ) : (
        <p className="py-8 text-center text-content-secondary">No characters on the board yet.</p>
      )}
    </div>
  );
}
