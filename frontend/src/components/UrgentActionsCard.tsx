import { Link } from 'react-router-dom';
import type { DashboardGameCard } from '../types/dashboard';
import { AlertTriangle, Clock } from 'lucide-react';

interface UrgentActionsCardProps {
  games: DashboardGameCard[];
}

/**
 * UrgentActionsCard - Highlight urgent games that need immediate attention
 */
export function UrgentActionsCard({ games }: UrgentActionsCardProps) {
  const urgentGames = games.filter((game) => game.is_urgent);

  if (urgentGames.length === 0) {
    return null;
  }

  return (
    <div className="bg-red-50 border-2 border-red-200 rounded-lg p-6">
      <div className="flex items-center mb-4">
        <AlertTriangle className="w-6 h-6 text-red-600 mr-2" />
        <h2 className="text-xl font-bold text-red-900">
          Urgent Actions Required
        </h2>
      </div>
      <p className="text-red-700 mb-4">
        The following games have pending actions with approaching deadlines:
      </p>
      <div className="space-y-3">
        {urgentGames.map((game) => (
          <Link
            key={game.game_id}
            to={`/games/${game.game_id}`}
            className="block bg-white rounded-md p-4 border border-red-200 hover:border-red-300 hover:shadow-md transition-all"
          >
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <h3 className="font-bold text-gray-900">{game.title}</h3>
                {game.current_phase_title && (
                  <p className="text-sm text-gray-600 mt-1">
                    {game.current_phase_title}
                  </p>
                )}
              </div>
              {game.current_phase_deadline && (
                <div className="ml-4 flex items-center text-red-600">
                  <Clock className="w-4 h-4 mr-1" />
                  <span className="text-sm font-medium">
                    {formatDeadline(game.current_phase_deadline)}
                  </span>
                </div>
              )}
            </div>
            {game.has_pending_action && (
              <div className="mt-2 text-sm text-yellow-700 bg-yellow-50 px-2 py-1 rounded inline-block">
                Action submission needed
              </div>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}

/**
 * Format deadline as relative time
 */
function formatDeadline(deadline: string): string {
  const now = new Date();
  const deadlineDate = new Date(deadline);
  const hoursRemaining = Math.floor((deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60));

  if (hoursRemaining < 0) {
    return 'Overdue';
  } else if (hoursRemaining < 1) {
    const minutesRemaining = Math.floor((deadlineDate.getTime() - now.getTime()) / (1000 * 60));
    return `${minutesRemaining} minutes`;
  } else if (hoursRemaining < 24) {
    return `${hoursRemaining} hours`;
  } else {
    const daysRemaining = Math.floor(hoursRemaining / 24);
    return `${daysRemaining} day${daysRemaining > 1 ? 's' : ''}`;
  }
}
