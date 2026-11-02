import { Link } from 'react-router-dom';
import { Alert, Card, CardBody, Spinner } from '@/components/ui';
import { useGameContext } from '@/contexts/GameContext';
import { isGameWritable } from '@/lib/gamePermissions';

/**
 * `/games/:gameId/board-setup`: the results board's game-level setup (the
 * codex, character names, reward lists and the reward template). It has its
 * own page because a GM needs it before any action phase exists. Empty for
 * now.
 */
export function GmBoardSetupPage() {
  const { gameId, game, isLoadingGame, isGM } = useGameContext();

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

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6" data-testid="gm-board-setup">
      <div>
        <Link to={`/games/${gameId}`} className="text-sm text-content-tertiary hover:underline">
          &larr; {game.title}
        </Link>
        <h1 className="text-2xl md:text-3xl font-bold text-content-primary mt-1">Results board setup</h1>
        <p className="text-sm text-content-secondary mt-2">
          What the results board knows about this game: places, people and secrets, the names each character goes by,
          and the rewards you hand out.
        </p>
      </div>

      {!isGM ? (
        <Alert variant="info">Only the game’s GMs can set up the results board.</Alert>
      ) : !isGameWritable(game.state) ? (
        <Alert variant="info">This game is archived, so its results board setup can no longer be changed.</Alert>
      ) : (
        <Card variant="bordered" padding="md">
          <CardBody>
            <p className="text-content-primary">The codex, character names and reward lists will be set up here.</p>
            <p className="text-sm text-content-tertiary mt-2">This page isn’t built yet.</p>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
