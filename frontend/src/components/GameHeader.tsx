import { GAME_STATE_LABELS, GAME_STATE_COLORS } from '../types/games';
import type { GameListItem, GameWithDetails, GameParticipant } from '../types/games';
import { Badge } from './ui';

interface GameHeaderProps {
  game: GameListItem | GameWithDetails;
  participants?: GameParticipant[];
}

export function GameHeader({ game, participants = [] }: GameHeaderProps) {
  // Find co-GM from participants
  const coGM = participants.find(p => p.role === 'co_gm');

  return (
    <div>
      <h1 className="text-3xl font-bold text-content-primary mb-2">{game.title}</h1>
      <div className="flex items-center gap-4">
        <Badge className={GAME_STATE_COLORS[game.state]} data-testid="game-status-badge">
          {GAME_STATE_LABELS[game.state]}
        </Badge>
        <div className="flex items-center gap-2 text-content-secondary">
          <span>GM: {game.gm_username}</span>
          {coGM && (
            <>
              <span className="text-content-tertiary">•</span>
              <span className="flex items-center gap-1">
                Co-GM: {coGM.username}
                <Badge variant="secondary" className="text-xs">
                  Co-GM
                </Badge>
              </span>
            </>
          )}
        </div>
        {game.genre && <span className="text-content-secondary">Genre: {game.genre}</span>}
      </div>
    </div>
  );
}
