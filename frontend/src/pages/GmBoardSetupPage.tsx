import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { Alert, Badge, Card, CardBody, CardHeader, Spinner } from '@/components/ui';
import { GmBoardConflicts } from '@/components/gm-board/GmBoardConflicts';
import { GmBoardSharing } from '@/components/gm-board/GmBoardSharing';
import { GmCharacterNames } from '@/components/gm-board/GmCharacterNames';
import { GmCodexManager } from '@/components/gm-board/GmCodexManager';
import { GmBoardPrefs } from '@/components/gm-board/GmBoardPrefs';
import { GmRewardBlock } from '@/components/gm-board/GmRewardBlock';
import { GmRewardLists } from '@/components/gm-board/GmRewardLists';
import { useGameContext } from '@/contexts/GameContext';
import { BoardReadOnlyContext } from '@/hooks/useBoardReadOnly';
import { useGmSettings, useGmSettingsStore } from '@/hooks/useGmBoard';
import { apiClient } from '@/lib/api';
import { isGameWritable } from '@/lib/gamePermissions';
import { boardCast } from '@/lib/gmBoard/cast';

/**
 * `/games/:gameId/board-setup`: the results board's game-level setup: sharing,
 * the codex, character names, reward lists and the reward block.
 * It has its own page because a GM needs it before any action phase exists.
 * Viewers the GM shares the boards with read it, and so does the GM once the
 * game is archived; neither can change it.
 */
export function GmBoardSetupPage() {
  const { gameId, game, isLoadingGame, isGM, isAudience, allGameCharacters } = useGameContext();
  const mayView = isGM || (isAudience && !!game?.share_gm_board);
  const readOnly = !isGM || !game || !isGameWritable(game.state);
  const { error: settingsError } = useGmSettings(gameId, { enabled: mayView });
  // The editors below share this store (one cache per game), so its lost edits are theirs.
  const settingsStore = useGmSettingsStore(gameId, { readOnly });
  const phases = useQuery({
    queryKey: ['gamePhases', gameId],
    queryFn: () => apiClient.phases.getGamePhases(gameId).then((res) => res.data),
    enabled: mayView && gameId > 0,
  });
  const actionPhases = useMemo(
    () =>
      (phases.data ?? [])
        .filter((p) => p.phase_type === 'action')
        .map((p) => ({ id: p.id, title: p.title || `Phase ${p.phase_number}` })),
    [phases.data],
  );
  const cast = useMemo(() => boardCast(allGameCharacters), [allGameCharacters]);
  // Who can get a result, and so a reward: the cast someone plays.
  const recipients = useMemo(() => cast.filter((c) => c.reads).map((c) => ({ id: c.id, name: c.name })), [cast]);

  if (isLoadingGame) {
    return (
      <div className="flex justify-center py-16">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!game) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8">
        <Alert variant="danger" title="Game not found">
          This game doesn’t exist, or you can’t view it.
        </Alert>
      </div>
    );
  }

  // A viewer whose next poll is refused: the GM stopped sharing.
  const refused = !isGM && isAxiosError(settingsError) && settingsError.response?.status === 403;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6" data-testid="gm-board-setup">
      <div>
        <Link to={`/games/${gameId}`} className="text-sm text-content-tertiary hover:underline">
          &larr; {game.title}
        </Link>
        <h1 className="text-2xl md:text-3xl font-bold text-content-primary mt-1 flex items-center gap-2">
          Results board setup
          {mayView && readOnly && (
            <Badge variant="neutral" data-testid="gm-board-read-only">
              Read-only
            </Badge>
          )}
        </h1>
        <p className="text-sm text-content-secondary mt-2">
          What the results board knows about this game: places, people and secrets, the names each character goes by,
          and the rewards handed out.
        </p>
      </div>

      {!mayView ? (
        <Alert variant="info">
          {isAudience
            ? 'The GM hasn’t shared this game’s results boards.'
            : 'The results board is for the game’s GMs, and for its audience when the GM shares it.'}
        </Alert>
      ) : refused ? (
        <Alert variant="info" title="This board is no longer shared" data-testid="gm-board-not-shared">
          The GM has stopped sharing this game’s results boards.
        </Alert>
      ) : (
        <>
          {isGM && (
            <Card variant="bordered" padding="md">
              <CardHeader>
                <h2 className="text-xl font-semibold text-content-primary">Sharing</h2>
              </CardHeader>
              <CardBody>
                <GmBoardSharing gameId={gameId} gameState={game.state} />
              </CardBody>
            </Card>
          )}
          {isGM && readOnly && (
            <Alert variant="info">This game is archived, so its results board setup can no longer be changed.</Alert>
          )}
          {!isGM && <p className="text-sm text-content-tertiary">Shared by the GM, read-only.</p>}
          {!readOnly && (
            <GmBoardConflicts
              lost={settingsStore.lost}
              onKeepMine={settingsStore.keepMine}
              onDismiss={settingsStore.dismissLost}
              kindNames={{ notes: 'the notes for every phase' }}
            />
          )}

          <BoardReadOnlyContext.Provider value={readOnly}>
            <Card variant="bordered" padding="md">
              <CardHeader>
                <h2 className="text-xl font-semibold text-content-primary">Codex</h2>
                <p className="text-sm text-content-secondary mt-1">
                  Places, people, items and secrets. Locations become the rows of the map, names are highlighted in
                  submissions, and secrets feed the checks before publishing.
                </p>
              </CardHeader>
              <CardBody>
                <GmCodexManager gameId={gameId} phases={actionPhases} players={cast.filter((c) => !c.npc)} />
              </CardBody>
            </Card>
            <Card variant="bordered" padding="md">
              <CardHeader>
                <h2 className="text-xl font-semibold text-content-primary">Character names</h2>
              </CardHeader>
              <CardBody>
                <GmCharacterNames gameId={gameId} characters={cast} />
              </CardBody>
            </Card>
            <Card variant="bordered" padding="md">
              <CardHeader>
                <h2 className="text-xl font-semibold text-content-primary">Writing results</h2>
              </CardHeader>
              <CardBody>
                <GmBoardPrefs gameId={gameId} />
              </CardBody>
            </Card>
            <Card variant="bordered" padding="md">
              <CardHeader>
                <h2 className="text-xl font-semibold text-content-primary">Reward lists</h2>
              </CardHeader>
              <CardBody>
                <GmRewardLists gameId={gameId} phases={actionPhases} players={recipients} />
              </CardBody>
            </Card>
            <Card variant="bordered" padding="md">
              <CardHeader>
                <h2 className="text-xl font-semibold text-content-primary">Reward block</h2>
              </CardHeader>
              <CardBody>
                <GmRewardBlock gameId={gameId} phases={actionPhases} players={recipients} />
              </CardBody>
            </Card>
          </BoardReadOnlyContext.Provider>
        </>
      )}
    </div>
  );
}
