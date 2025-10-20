import type { EnrichedGameListItem } from '../../types/games';

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
  return (
    <div data-testid={`game-card-${game.id}`} onClick={onClick}>
      <div>{game.title}</div>
      <div>{game.description}</div>
      <div>GM: {game.gm_username}</div>
      <div>State: {game.state}</div>
      {showApplyButton && onApplyClick && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onApplyClick();
          }}
          disabled={isJoining}
          data-testid={`apply-button-${game.id}`}
        >
          {isJoining ? 'Applying...' : 'Apply to Join'}
        </button>
      )}
    </div>
  );
}
