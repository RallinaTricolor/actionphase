import { GAME_STATE_LABELS, GAME_STATE_COLORS } from '../types/games';
import type { Game } from '../types/games';
import { Badge } from './ui';

interface GameHeaderProps {
  game: Game;
}

export function GameHeader({ game }: GameHeaderProps) {
  return (
    <div>
      <h1 className="text-3xl font-bold text-content-primary mb-2">{game.title}</h1>
      <div className="flex items-center gap-4">
        <Badge className={GAME_STATE_COLORS[game.state]}>
          {GAME_STATE_LABELS[game.state]}
        </Badge>
        <span className="text-content-secondary">GM: {game.gm_username}</span>
        {game.genre && <span className="text-content-secondary">Genre: {game.genre}</span>}
      </div>
    </div>
  );
}
