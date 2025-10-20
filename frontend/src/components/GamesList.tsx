import { useState, useEffect } from 'react';
import { apiClient } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import type { GameListItem } from '../types/games';
import { GAME_STATE_LABELS, GAME_STATE_COLORS } from '../types/games';

interface GamesListProps {
  showRecruitingOnly?: boolean;
  onGameClick?: (game: GameListItem) => void;
  showCreateButton?: boolean;
  onCreateClick?: () => void;
  onApplyToGame?: (gameId: number, role?: 'player' | 'audience') => void;
  isJoining?: boolean;
}

export const GamesList = ({
  showRecruitingOnly = false,
  onGameClick,
  showCreateButton = false,
  onCreateClick,
  onApplyToGame,
  isJoining = false
}: GamesListProps) => {
  const { currentUser, isCheckingAuth } = useAuth();
  const [games, setGames] = useState<GameListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchGames = async () => {
      try {
        setLoading(true);
        const response = showRecruitingOnly
          ? await apiClient.games.getRecruitingGames()
          : await apiClient.games.getAllGames();
        setGames(response.data || []);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch games');
        console.error('Error fetching games:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchGames();
  }, [showRecruitingOnly]);

  const formatDate = (dateString?: string) => {
    if (!dateString) return null;
    return new Date(dateString).toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-48 mb-4"></div>
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-24 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-red-800 mb-2">Error Loading Games</h3>
          <p className="text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  const title = showRecruitingOnly ? 'Games Recruiting Players' : 'All Games';
  const emptyMessage = showRecruitingOnly
    ? 'No games are currently recruiting players.'
    : 'No games available.';

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
        {showCreateButton && (
          <button
            onClick={onCreateClick}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
          >
            Create Game
          </button>
        )}
      </div>

      {games.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-gray-400 text-lg mb-2">🎲</div>
          <p className="text-gray-600">{emptyMessage}</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {games.map((game) => (
            <div
              key={game.id}
              className={`bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow ${
                onGameClick ? 'cursor-pointer hover:border-blue-300' : ''
              }`}
              onClick={() => onGameClick?.(game)}
            >
              <div className="flex justify-between items-start mb-3">
                <h3 className="text-lg font-semibold text-gray-900 truncate">
                  {game.title}
                </h3>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${GAME_STATE_COLORS[game.state]}`}>
                  {GAME_STATE_LABELS[game.state]}
                </span>
              </div>

              <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                {game.description}
              </p>

              <div className="space-y-2 text-sm text-gray-500">
                <div className="flex justify-between">
                  <span>GM:</span>
                  <span className="font-medium">{game.gm_username}</span>
                </div>

                {game.genre && (
                  <div className="flex justify-between">
                    <span>Genre:</span>
                    <span>{game.genre}</span>
                  </div>
                )}

                {typeof game.current_players === 'number' && game.max_players && (
                  <div className="flex justify-between">
                    <span>Players:</span>
                    <span>{game.current_players} / {game.max_players}</span>
                  </div>
                )}

                {game.recruitment_deadline && game.state === 'recruitment' && (
                  <div className="flex justify-between">
                    <span>Deadline:</span>
                    <span>{formatDate(game.recruitment_deadline)}</span>
                  </div>
                )}

                {game.start_date && (
                  <div className="flex justify-between">
                    <span>Starts:</span>
                    <span>{formatDate(game.start_date)}</span>
                  </div>
                )}
              </div>

              {game.state === 'recruitment' && onApplyToGame && !isCheckingAuth && game.gm_user_id !== currentUser?.id && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <button
                    className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed text-white text-sm py-2 px-4 rounded transition-colors"
                    disabled={isJoining}
                    onClick={(e) => {
                      e.stopPropagation();
                      onApplyToGame(game.id, 'player');
                    }}
                  >
                    {isJoining ? 'Applying...' : 'Apply to Join'}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
