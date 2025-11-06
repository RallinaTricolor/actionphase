import type { UserGame, UserGameHistoryMetadata } from '../types/user-profiles';
import { GameHistoryCard } from './GameHistoryCard';
import { Pagination } from './Pagination';
import { Link } from 'react-router-dom';

interface UserGameHistoryProps {
  games: UserGame[];
  metadata?: UserGameHistoryMetadata;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  isLoading?: boolean;
}

/**
 * UserGameHistory - Displays a user's game participation history
 *
 * Features:
 * - Responsive grid layout (1-3 columns)
 * - Games sorted by backend (in_progress first) then by updated_at
 * - Pagination support
 * - Empty state with call-to-action
 */
export function UserGameHistory({
  games,
  metadata,
  onPageChange,
  onPageSizeChange,
  isLoading = false,
}: UserGameHistoryProps) {
  // Games are already sorted by the backend, no need to sort client-side

  // Empty state
  if (games.length === 0) {
    return (
      <div className="bg-surface-base shadow rounded-lg p-8 text-center">
        <h2 className="text-2xl font-bold text-content-primary mb-4">
          Game History
        </h2>
        <p className="text-content-secondary mb-6">
          No games yet. Browse available games to join!
        </p>
        <Link
          to="/games"
          className="inline-block bg-interactive-primary text-white px-6 py-3 rounded-md font-semibold hover:bg-interactive-primary-hover transition-colors"
        >
          Browse Games
        </Link>
      </div>
    );
  }

  return (
    <section>
      <h2 className="text-2xl font-bold text-content-primary mb-6">
        Game History
      </h2>

      {/* Responsive grid: 1 column on mobile, 2 on tablet, 3 on desktop */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {games.map((game) => (
          <GameHistoryCard key={game.game_id} game={game} />
        ))}
      </div>

      {/* Pagination */}
      {metadata && metadata.total_pages > 1 && onPageChange && onPageSizeChange && (
        <div className="mt-6">
          <Pagination
            currentPage={metadata.page}
            totalPages={metadata.total_pages}
            pageSize={metadata.page_size}
            hasNextPage={metadata.has_next_page}
            hasPreviousPage={metadata.has_previous_page}
            onPageChange={onPageChange}
            onPageSizeChange={onPageSizeChange}
            isLoading={isLoading}
          />
        </div>
      )}
    </section>
  );
}
