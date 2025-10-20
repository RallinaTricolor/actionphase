import { useAuth } from '../contexts/AuthContext';
import type { EnrichedGameListItem } from '../types/games';
import { EnhancedGameCard } from './EnhancedGameCard';

interface GamesListProps {
  games: EnrichedGameListItem[];
  loading: boolean;
  error: string | null;
  onGameClick?: (game: EnrichedGameListItem) => void;
  onApplyToGame?: (gameId: number, role?: 'player' | 'audience') => void;
  isJoining?: boolean;
}

export const GamesList = ({
  games,
  loading,
  error,
  onGameClick,
  onApplyToGame,
  isJoining = false
}: GamesListProps) => {
  const { currentUser, isCheckingAuth } = useAuth();

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="animate-pulse">
          <div className="space-y-4">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-red-800 mb-2">Error Loading Games</h3>
          <p className="text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  if (games.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12">
        <div className="text-center">
          <div className="text-gray-400 text-4xl mb-4">🎲</div>
          <p className="text-gray-600 text-lg">No games match your current filters.</p>
          <p className="text-gray-500 text-sm mt-2">Try adjusting your filter criteria.</p>
        </div>
      </div>
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
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {games.map((game) => (
          <EnhancedGameCard
            key={game.id}
            game={game}
            onClick={onGameClick ? () => onGameClick(game) : undefined}
            onApplyClick={onApplyToGame ? () => onApplyToGame(game.id, 'player') : undefined}
            isJoining={isJoining}
            showApplyButton={shouldShowApplyButton(game)}
          />
        ))}
      </div>
    </div>
  );
};
