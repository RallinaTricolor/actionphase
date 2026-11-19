import { describeScoreboardCut, describeScoreboardSort } from '@/lib/scoreboardFormat';
import type { Scoreboard } from '@/types/scoreboard';

interface ScoreboardOrderSummaryProps {
  board: Scoreboard;
  /** Prefixes the test IDs, so the board and the editor's preview can be told apart. */
  testIdPrefix: 'scoreboard' | 'scoreboard-preview';
}

/** How the board is ordered, and whether this viewer gets only its top rows. */
export function ScoreboardOrderSummary({ board, testIdPrefix }: ScoreboardOrderSummaryProps) {
  return (
    <>
      <p className="text-sm text-content-secondary" data-testid={`${testIdPrefix}-sort`}>
        {describeScoreboardSort(board.sort_description)}
      </p>
      {board.top_count ? (
        <p className="text-sm font-medium text-content-primary" data-testid={`${testIdPrefix}-top-count`}>
          {describeScoreboardCut(board.top_count)}
        </p>
      ) : null}
    </>
  );
}
