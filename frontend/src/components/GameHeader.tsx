import { GAME_STATE_LABELS, GAME_STATE_COLORS } from '../types/games';
import type { Game } from '../types/games';

interface GameHeaderProps {
  game: Game;
}

export function GameHeader({ game }: GameHeaderProps) {
  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-2">{game.title}</h1>
      <div className="flex items-center gap-4">
        <span className={`px-3 py-1 rounded-full text-sm font-medium ${GAME_STATE_COLORS[game.state]}`}>
          {GAME_STATE_LABELS[game.state]}
        </span>
        <span className="text-gray-500">GM: {game.gm_username}</span>
        {game.genre && <span className="text-gray-500">Genre: {game.genre}</span>}
      </div>
    </div>
  );
}
