import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Alert, Spinner } from '@/components/ui';
import { GmBoard } from '@/components/gm-board/GmBoard';
import { useGameContext } from '@/contexts/GameContext';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { apiClient } from '@/lib/api';
import { resultsAreaPath } from '@/lib/gmBoard/steps';

/** The board is desktop only: below this width the page shows a notice instead. */
export const BOARD_NARROW_QUERY = '(max-width: 1023px)';

/**
 * `/games/:gameId/phases/:phaseId/board`: the GM results board for one
 * action phase. GMs only for now; sharing with viewers comes later.
 */
export function GmBoardPage() {
  const { phaseId: phaseParam } = useParams<{ phaseId: string }>();
  const phaseId = Number(phaseParam);
  const { gameId, game, isLoadingGame, isGM } = useGameContext();
  const narrow = useMediaQuery(BOARD_NARROW_QUERY);

  const phases = useQuery({
    queryKey: ['gamePhases', gameId],
    queryFn: () => apiClient.phases.getGamePhases(gameId).then((res) => res.data),
    enabled: isGM && gameId > 0,
  });
  const phase = phases.data?.find((p) => p.id === phaseId);

  const backLink = (
    <Link to={resultsAreaPath(gameId)} className="underline">
      Back to the results
    </Link>
  );

  if (isLoadingGame || (isGM && phases.isLoading)) {
    return (
      <div className="flex justify-center py-16">
        <Spinner size="lg" />
      </div>
    );
  }

  let notice: { title: string; body: string } | null = null;
  if (!game) notice = { title: 'Game not found', body: 'This game doesn’t exist, or you can’t view it.' };
  else if (!isGM) notice = { title: 'GMs only', body: 'Only the game’s GMs can open the results board.' };
  else if (!phase || phase.phase_type !== 'action') {
    notice = { title: 'No results board', body: 'Only action phases have a results board.' };
  } else if (narrow) {
    notice = {
      title: 'The results board needs a wider screen',
      body: 'It works on screens at least 1024 pixels wide. You can still write results from the results area.',
    };
  }

  if (notice || !game || !phase) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8" data-testid="gm-board-notice">
        <Alert variant="info" title={notice?.title}>
          <p>{notice?.body}</p>
          <p className="mt-2">{backLink}</p>
        </Alert>
      </div>
    );
  }

  return <GmBoard gameId={gameId} gameTitle={game.title} phase={phase} />;
}
