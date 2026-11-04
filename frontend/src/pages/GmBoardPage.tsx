import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Alert, Spinner } from '@/components/ui';
import { GmBoard } from '@/components/gm-board/GmBoard';
import { useGameContext } from '@/contexts/GameContext';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { apiClient } from '@/lib/api';
import { isGameWritable } from '@/lib/gamePermissions';
import { historyPhasePath, resultsAreaPath } from '@/lib/gmBoard/steps';

/** The board is desktop only: below this width the page shows a notice instead. */
export const BOARD_NARROW_QUERY = '(max-width: 1023px)';

/**
 * `/games/:gameId/phases/:phaseId/board`: the results board for one action
 * phase. GMs edit it while the game is writable. Viewers with audience-level
 * access (the audience, or anyone once the game is a public archive) get it
 * read-only while the GM shares it, and so does the GM once the game is
 * archived.
 */
export function GmBoardPage() {
  const { phaseId: phaseParam } = useParams<{ phaseId: string }>();
  const phaseId = Number(phaseParam);
  const { gameId, game, isLoadingGame, isGM, isAudience } = useGameContext();
  const narrow = useMediaQuery(BOARD_NARROW_QUERY);
  const mayView = isGM || (isAudience && !!game?.share_gm_board);

  const phases = useQuery({
    queryKey: ['gamePhases', gameId],
    queryFn: () => apiClient.phases.getGamePhases(gameId).then((res) => res.data),
    enabled: mayView && gameId > 0,
  });
  const phase = phases.data?.find((p) => p.id === phaseId);

  // The GM came from the results area while the game runs; everyone else
  // browses past phases in History.
  const back =
    isGM && game?.state === 'in_progress'
      ? { to: resultsAreaPath(gameId), label: 'Back to the results' }
      : { to: historyPhasePath(gameId, phaseId), label: 'Back to the history' };
  const backLink = (
    <Link to={back.to} className="underline">
      {back.label}
    </Link>
  );

  if (isLoadingGame || (mayView && phases.isLoading)) {
    return (
      <div className="flex justify-center py-16">
        <Spinner size="lg" />
      </div>
    );
  }

  let notice: { title: string; body: string } | null = null;
  if (!game) notice = { title: 'Game not found', body: 'This game doesn’t exist, or you can’t view it.' };
  else if (!isGM && !isAudience) {
    notice = {
      title: 'Not shared with you',
      body: 'The results board is for the game’s GMs, and for its audience when the GM shares it.',
    };
  } else if (!mayView) notice = { title: 'Not shared', body: 'The GM hasn’t shared this game’s results boards.' };
  else if (!phase || phase.phase_type !== 'action') {
    notice = { title: 'No results board', body: 'Only action phases have a results board.' };
  } else if (narrow) {
    notice = {
      title: 'The results board needs a wider screen',
      body: isGM
        ? 'It works on screens at least 1024 pixels wide. You can still write results from the results area.'
        : 'It works on screens at least 1024 pixels wide. You can still read the results in the History tab.',
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

  return (
    <GmBoard
      gameId={gameId}
      gameTitle={game.title}
      phase={phase}
      readOnly={!isGM || !isGameWritable(game.state)}
      viewer={!isGM}
      back={back}
    />
  );
}
