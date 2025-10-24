import type { GameWithDetails } from '../types/games';

interface GameInfoGridProps {
  game: GameWithDetails;
}

const formatDate = (dateString?: string) => {
  if (!dateString) return 'Not set';
  return new Date(dateString).toLocaleString();
};

export function GameInfoGrid({ game }: GameInfoGridProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
      <div>
        <h3 className="font-semibold text-content-primary mb-2">Players</h3>
        <p className="text-content-secondary">
          {game.current_players} / {game.max_players || 'Unlimited'}
        </p>
      </div>

      <div>
        <h3 className="font-semibold text-content-primary mb-2">Recruitment Deadline</h3>
        <p className="text-content-secondary">{formatDate(game.recruitment_deadline)}</p>
      </div>

      <div>
        <h3 className="font-semibold text-content-primary mb-2">Start Date</h3>
        <p className="text-content-secondary">{formatDate(game.start_date)}</p>
      </div>

      <div>
        <h3 className="font-semibold text-content-primary mb-2">End Date</h3>
        <p className="text-content-secondary">{formatDate(game.end_date)}</p>
      </div>
    </div>
  );
}
