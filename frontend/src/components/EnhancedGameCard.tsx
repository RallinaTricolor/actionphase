import { formatDistanceToNow } from 'date-fns';
import type { EnrichedGameListItem } from '../types/games';
import { GAME_STATE_LABELS, GAME_STATE_COLORS, DEADLINE_URGENCY_COLORS, USER_RELATIONSHIP_LABELS } from '../types/games';

interface EnhancedGameCardProps {
  game: EnrichedGameListItem;
  onClick?: () => void;
  onApplyClick?: () => void;
  isJoining?: boolean;
  showApplyButton?: boolean;
}

export function EnhancedGameCard({
  game,
  onClick,
  onApplyClick,
  isJoining = false,
  showApplyButton = false
}: EnhancedGameCardProps) {
  const isUserGame = game.user_relationship === 'gm' || game.user_relationship === 'participant';
  const hasApplied = game.user_relationship === 'applied';
  const hasOpenSpots = !game.max_players || game.current_players < game.max_players;

  // Determine deadline to display
  const deadline = game.current_phase_deadline || game.recruitment_deadline;

  // Format date helper
  const formatDate = (dateString?: string) => {
    if (!dateString) return null;
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <div
      className={`bg-white rounded-lg shadow-md border-2 transition-all hover:shadow-lg ${
        onClick ? 'cursor-pointer' : ''
      } ${
        isUserGame
          ? 'border-blue-400 bg-blue-50/30'
          : hasApplied
          ? 'border-yellow-400 bg-yellow-50/30'
          : 'border-gray-200 hover:border-gray-300'
      }`}
      onClick={onClick}
    >
      {/* Card Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-start justify-between mb-2">
          <h3 className="text-lg font-semibold text-gray-900 flex-1 pr-2">
            {game.title}
          </h3>

          {/* User Relationship Badge */}
          {game.user_relationship && game.user_relationship !== 'none' && (
            <span
              className={`ml-2 px-2 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${
                game.user_relationship === 'gm'
                  ? 'bg-purple-100 text-purple-800'
                  : game.user_relationship === 'participant'
                  ? 'bg-blue-100 text-blue-800'
                  : 'bg-yellow-100 text-yellow-800'
              }`}
            >
              {USER_RELATIONSHIP_LABELS[game.user_relationship]}
            </span>
          )}
        </div>

        {/* Badges Row */}
        <div className="flex flex-wrap gap-2 items-center">
          {/* State Badge */}
          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${GAME_STATE_COLORS[game.state]}`}>
            {GAME_STATE_LABELS[game.state]}
          </span>

          {/* Genre Badge */}
          {game.genre && (
            <span className="px-2 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-800">
              {game.genre}
            </span>
          )}

          {/* Recent Activity Indicator */}
          {game.has_recent_activity && (
            <span className="px-2 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800 flex items-center gap-1">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              New Activity
            </span>
          )}

          {/* Deadline Urgency Badge */}
          {deadline && game.deadline_urgency !== 'normal' && (
            <span
              className={`px-2 py-1 rounded-full text-xs font-semibold ${
                game.deadline_urgency === 'critical'
                  ? 'bg-red-100 text-red-800'
                  : 'bg-orange-100 text-orange-800'
              }`}
            >
              {game.deadline_urgency === 'critical' ? '⚠️ Urgent' : '⏰ Soon'}
            </span>
          )}
        </div>
      </div>

      {/* Card Body */}
      <div className="p-4">
        <p className="text-sm text-gray-600 mb-3 line-clamp-2">{game.description}</p>

        {/* Game Info Grid */}
        <div className="grid grid-cols-2 gap-2 text-sm text-gray-700">
          <div>
            <span className="font-medium">GM:</span> {game.gm_username}
          </div>
          <div>
            <span className="font-medium">Players:</span>{' '}
            {game.current_players}
            {game.max_players && ` / ${game.max_players}`}
            {hasOpenSpots && game.state === 'recruitment' && (
              <span className="text-green-600 ml-1">✓ Open</span>
            )}
          </div>

          {game.start_date && (
            <div className="col-span-2">
              <span className="font-medium">Starts:</span>{' '}
              {formatDate(game.start_date)}
            </div>
          )}

          {deadline && (
            <div className="col-span-2">
              <span className="font-medium">
                {game.current_phase_type ? 'Phase Deadline' : 'Application Deadline'}:
              </span>{' '}
              <span
                className={
                  game.deadline_urgency === 'critical'
                    ? 'text-red-600 font-semibold'
                    : game.deadline_urgency === 'warning'
                    ? 'text-orange-600 font-semibold'
                    : ''
                }
              >
                {formatDistanceToNow(new Date(deadline), { addSuffix: true })}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Card Footer Actions */}
      {showApplyButton && !isUserGame && !hasApplied && game.state === 'recruitment' && hasOpenSpots && onApplyClick && (
        <div className="p-4 border-t border-gray-200">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onApplyClick();
            }}
            disabled={isJoining}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed transition-colors font-medium"
          >
            {isJoining ? 'Applying...' : 'Apply to Join'}
          </button>
        </div>
      )}
    </div>
  );
}
