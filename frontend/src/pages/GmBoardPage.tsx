import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Alert, Spinner } from '@/components/ui';
import { GmBoard } from '@/components/gm-board/GmBoard';
import { useGameContext } from '@/contexts/GameContext';
import { GM_BOARD_POLL_MS } from '@/hooks/useGmBoard';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { apiClient } from '@/lib/api';
import { isGameWritable } from '@/lib/gamePermissions';
import { historyPhasePath, resultsAreaPath } from '@/lib/gmBoard/steps';

/** The board is desktop only: below this width the page shows a notice. */
export const BOARD_NARROW_QUERY = '(max-width: 1023px)';

/**
 * `/games/:gameId/phases/:phaseId/board`: the results board for one action
 * phase. GMs edit it while the game is writable and the phase hasn't ended.
 * Viewers with audience-level access (the audience, or anyone once the game is
 * a public archive) get it read-only while the GM shares it. So does the GM
 * once the game is archived or the phase has ended; activating an ended phase
 * again reopens its board. It needs a wide window: below that, a notice shows instead.
 */
export function GmBoardPage() {
  const { phaseId: phaseParam } = useParams<{ phaseId: string }>();
  const phaseId = Number(phaseParam);
  const { gameId, game, isLoadingGame, isGM, isAudience } = useGameContext();
  const narrow = useMediaQuery(BOARD_NARROW_QUERY);
  // A board once shown stays mounted while the window is too narrow, so the
  // step's open tab, dialogs and typed text are there when it widens again.
  const [hasBeenWide, setHasBeenWide] = useState(!narrow);
  if (!narrow && !hasBeenWide) setHasBeenWide(true);
  const mayView = isGM || (isAudience && !!game?.share_gm_board);
  const writable = !!game && isGameWritable(game.state);

  const phases = useQuery({
    queryKey: ['gamePhases', gameId],
    queryFn: () => apiClient.phases.getGamePhases(gameId).then((res) => res.data),
    enabled: mayView && gameId > 0,
    // A phase can end while the board is open (a scheduled phase starts on its
    // own), and the board has to lock when it does.
    refetchInterval: isGM && writable ? GM_BOARD_POLL_MS : false,
    refetchOnWindowFocus: true,
  });
  const phase = phases.data?.find((p) => p.id === phaseId);
  const phaseEnded = !!phase?.has_ended;

  // The running phase's board goes back to the results area. Past phases are
  // browsed in History, for the GM as for everyone else.
  const back =
    isGM && game?.state === 'in_progress' && phase?.is_active
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
  }

  const noticeView = (shown: { title: string; body: string } | null) => (
    <div className="max-w-3xl mx-auto px-4 py-8" data-testid="gm-board-notice">
      <Alert variant="info" title={shown?.title}>
        <p>{shown?.body}</p>
        <p className="mt-2">{backLink}</p>
      </Alert>
    </div>
  );

  if (notice || !game || !phase) return noticeView(notice);

  return (
    <>
      {narrow &&
        noticeView({
          title: 'The results board needs a wider screen',
          body: isGM
            ? 'It works on screens at least 1024 pixels wide. You can still write results from the results area.'
            : 'It works on screens at least 1024 pixels wide. You can still read the results in the History tab.',
        })}
      {hasBeenWide && (
        <div hidden={narrow}>
          <GmBoard
            gameId={gameId}
            gameTitle={game.title}
            phase={phase}
            readOnly={!isGM || !writable || phaseEnded}
            viewer={!isGM}
            archived={!writable}
            phaseEnded={phaseEnded}
            back={back}
          />
        </div>
      )}
    </>
  );
}
