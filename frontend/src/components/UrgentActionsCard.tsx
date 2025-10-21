import { Link } from 'react-router-dom';
import type { DashboardGameCard } from '../types/dashboard';
import { AlertTriangle, Clock } from 'lucide-react';
import { Badge } from './ui';

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
    <div className="bg-semantic-danger-subtle rounded-lg shadow-lg p-8 border-2 border-semantic-danger">
      <div className="flex items-center mb-4">
        <AlertTriangle className="w-6 h-6 text-semantic-danger mr-2" />
        <h2 className="text-xl font-bold text-content-primary">
          Urgent Actions Required
        </h2>
      </div>
      <p className="text-content-secondary mb-4">
        The following games have pending actions with approaching deadlines:
      </p>
      <div className="space-y-3">
        {urgentGames.map((game) => (
          <Link
            key={game.game_id}
            to={`/games/${game.game_id}`}
            className="block surface-base rounded-md p-4 border-2 border-semantic-danger hover:border-semantic-danger hover:shadow-md transition-all"
          >
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <h3 className="font-bold text-content-primary">{game.title}</h3>
                {game.current_phase_title && (
                  <p className="text-sm text-content-secondary mt-1">
                    {game.current_phase_title}
                  </p>
                )}
              </div>
              {game.current_phase_deadline && (
                <div className="ml-4 flex items-center text-semantic-danger">
                  <Clock className="w-4 h-4 mr-1" />
                  <span className="text-sm font-medium">
                    {formatDeadline(game.current_phase_deadline)}
                  </span>
                </div>
              )}
            </div>
            {game.has_pending_action && (
              <Badge variant="warning" className="mt-2">
                Action submission needed
              </Badge>
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
