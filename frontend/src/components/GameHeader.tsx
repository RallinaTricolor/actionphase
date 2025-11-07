import { GAME_STATE_LABELS, GAME_STATE_COLORS } from '../types/games';
import type { GameListItem, GameWithDetails, GameParticipant } from '../types/games';
import { Badge } from './ui';
import { format } from 'date-fns';

interface GameHeaderProps {
  game: GameListItem | GameWithDetails;
  participants?: GameParticipant[];
  playerCount?: string; // e.g., "3/5" or "3" for current players / max
  actionMenu?: React.ReactNode; // Optional action menu in top-right
}

/**
 * GameHeader - Compact single-line game header
 *
 * Displays:
 * - Line 1: Title + Status Badge + Action Menu (right)
 * - Line 2: GM • Genre • Players (compact metadata chips)
 */
export function GameHeader({ game, participants = [], playerCount, actionMenu }: GameHeaderProps) {
  // Find co-GM from participants
  const coGM = participants.find(p => p.role === 'co_gm');

  return (
    <div className="space-y-1">
      {/* Title + Status + Actions */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <h1 className="text-2xl font-bold text-content-primary truncate">{game.title}</h1>
          <Badge className={GAME_STATE_COLORS[game.state]} data-testid="game-status-badge" size="sm">
            {GAME_STATE_LABELS[game.state]}
          </Badge>
        </div>
        {actionMenu && (
          <div className="flex-shrink-0">
            {actionMenu}
          </div>
        )}
      </div>

      {/* Metadata Line - GM, Genre, Players, Dates */}
      <div className="flex items-center gap-2 text-sm text-content-secondary flex-wrap">
        <span>GM: {game.gm_username}</span>
        {coGM && (
          <>
            <span className="text-content-tertiary">•</span>
            <span>Co-GM: {coGM.username}</span>
          </>
        )}
        {game.genre && (
          <>
            <span className="text-content-tertiary">•</span>
            <span>Genre: {game.genre}</span>
          </>
        )}
        {playerCount && (
          <>
            <span className="text-content-tertiary">•</span>
            <span>{playerCount} Players</span>
          </>
        )}
        {game.start_date && (
          <>
            <span className="text-content-tertiary">•</span>
            <span>Started: {format(new Date(game.start_date), 'MMM d, yyyy')}</span>
          </>
        )}
        {game.end_date && (
          <>
            <span className="text-content-tertiary">•</span>
            <span>Ended: {format(new Date(game.end_date), 'MMM d, yyyy')}</span>
          </>
        )}
      </div>
    </div>
  );
}
