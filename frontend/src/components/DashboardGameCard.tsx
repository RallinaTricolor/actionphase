import { Link } from 'react-router-dom';
import type { DashboardGameCard as GameCardType } from '../types/dashboard';
import { Clock, AlertCircle, Users, MessageSquare } from 'lucide-react';

interface DashboardGameCardProps {
  game: GameCardType;
}

/**
 * DashboardGameCard - Display individual game information on dashboard
 */
export function DashboardGameCard({ game }: DashboardGameCardProps) {
  const deadlineColor = {
    critical: 'text-red-600 bg-red-50',
    warning: 'text-yellow-600 bg-yellow-50',
    normal: 'text-green-600 bg-green-50',
  }[game.deadline_status];

  const roleDisplay = game.user_role === 'gm' || game.user_role === 'co_gm' ? 'GM' : 'Player';

  return (
    <Link
      to={`/games/${game.game_id}`}
      className={`block bg-white rounded-lg shadow-md border ${
        game.is_urgent ? 'border-red-300 ring-2 ring-red-100' : 'border-gray-200'
      } hover:shadow-lg transition-shadow duration-200`}
    >
      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <h3 className="text-lg font-bold text-gray-900">{game.title}</h3>
            {game.description && (
              <p className="text-sm text-gray-600 mt-1 line-clamp-2">{game.description}</p>
            )}
          </div>
          {game.is_urgent && (
            <div className="ml-4 flex-shrink-0">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                <AlertCircle className="w-3 h-3 mr-1" />
                Urgent
              </span>
            </div>
          )}
        </div>

        {/* Metadata Row */}
        <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 mb-4">
          <span className="font-medium">{roleDisplay}</span>
          <span className="text-gray-400">•</span>
          <span>{game.state}</span>
          {game.genre && (
            <>
              <span className="text-gray-400">•</span>
              <span>{game.genre}</span>
            </>
          )}
        </div>

        {/* Current Phase Info */}
        {game.current_phase_title && (
          <div className="mb-4 p-3 bg-gray-50 rounded-md">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">
                  {game.current_phase_title}
                </p>
                <p className="text-xs text-gray-600 mt-0.5">
                  {game.current_phase_type}
                </p>
              </div>
              {game.current_phase_deadline && (
                <div className={`ml-4 px-2 py-1 rounded text-xs font-medium ${deadlineColor}`}>
                  <Clock className="w-3 h-3 inline mr-1" />
                  {new Date(game.current_phase_deadline).toLocaleDateString()}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Action Items */}
        <div className="flex items-center gap-4 text-sm">
          {game.has_pending_action && (
            <span className="inline-flex items-center text-yellow-700 bg-yellow-50 px-2 py-1 rounded">
              <AlertCircle className="w-4 h-4 mr-1" />
              Action needed
            </span>
          )}
          {game.pending_applications > 0 && (
            <span className="inline-flex items-center text-blue-700 bg-blue-50 px-2 py-1 rounded">
              <Users className="w-4 h-4 mr-1" />
              {game.pending_applications} application{game.pending_applications > 1 ? 's' : ''}
            </span>
          )}
          {game.unread_messages > 0 && (
            <span className="inline-flex items-center text-gray-700 bg-gray-100 px-2 py-1 rounded">
              <MessageSquare className="w-4 h-4 mr-1" />
              {game.unread_messages} unread
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
