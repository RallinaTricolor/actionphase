import { useAuth } from '../contexts/AuthContext';
import type { EnrichedGameListItem } from '../types/games';
import { EnhancedGameCard } from './EnhancedGameCard';
import { Card, Spinner, Alert } from './ui';

interface GamesListProps {
  games: EnrichedGameListItem[];
  loading: boolean;
  error: string | null;
  onGameClick?: (game: EnrichedGameListItem) => void;
  onApplyToGame?: (game: EnrichedGameListItem) => void;
}

export const GamesList = ({
  games,
  loading,
  error,
  onGameClick,
  onApplyToGame,
}: GamesListProps) => {
  const { currentUser, isCheckingAuth } = useAuth();

  if (loading) {
    return (
      <Card variant="elevated" padding="lg" className="flex items-center justify-center min-h-[300px]">
        <Spinner size="lg" label="Loading games..." />
      </Card>
    );
  }

  if (error) {
    return (
      <Card variant="elevated" padding="lg">
        <Alert variant="danger" title="Error Loading Games">
          {error}
        </Alert>
      </Card>
    );
  }

  if (!games || games.length === 0) {
    return (
      <Card variant="elevated" padding="lg">
        <div className="text-center">
          <div className="text-content-tertiary text-4xl mb-4">🎲</div>
          <p className="text-content-primary text-lg">No games match your current filters.</p>
          <p className="text-content-tertiary text-sm mt-2">Try adjusting your filter criteria.</p>
        </div>
      </Card>
    );
  }

  // Determine if the Apply button should be shown for a game
  const shouldShowApplyButton = (game: EnrichedGameListItem) => {
    if (!onApplyToGame || isCheckingAuth) return false;
    if (game.state !== 'recruitment') return false;
    if (game.gm_user_id === currentUser?.id) return false;
    return true;
  };

  return (
    <Card variant="elevated" padding="lg" data-testid="games-list">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {games.map((game) => (
          <EnhancedGameCard
            key={game.id}
            game={game}
            onClick={onGameClick ? () => onGameClick(game) : undefined}
            onApplyClick={onApplyToGame ? () => onApplyToGame(game) : undefined}
            showApplyButton={shouldShowApplyButton(game)}
            data-testid={`game-card-${game.id}`}
          />
        ))}
      </div>
    </Card>
  );
};
