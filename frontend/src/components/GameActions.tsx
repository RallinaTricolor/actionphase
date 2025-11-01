import type { Game, GameApplication, GameState } from '../types/games';
import type { UserGameRole } from '../contexts/GameContext';
import { Button } from './ui';

interface StateAction {
  label: string;
  state: GameState;
  color: string;
}

interface GameActionsProps {
  game: Game;
  isGM: boolean;
  canEditGame: boolean;
  isCheckingAuth: boolean;
  isParticipant: boolean;
  userRole: UserGameRole;
  userApplication: GameApplication | null;
  actionLoading: boolean;
  stateActions: StateAction[];
  onEditGame: () => void;
  onStateChange: (state: GameState) => void;
  onApplyToGame: () => void;
  onWithdrawApplication: () => void;
  onLeaveGame: () => void;
  onDeleteGame?: () => void;
}

export function GameActions({
  game,
  isGM,
  canEditGame,
  isCheckingAuth,
  isParticipant: _isParticipant,
  userRole: _userRole,
  userApplication,
  actionLoading,
  stateActions,
  onEditGame,
  onStateChange,
  onApplyToGame,
  onWithdrawApplication,
  onLeaveGame: _onLeaveGame,
  onDeleteGame,
}: GameActionsProps) {
  return (
    <div className="flex gap-4">
      {canEditGame && game.state !== 'completed' && game.state !== 'cancelled' && (
        <Button
          variant="outline"
          onClick={onEditGame}
          disabled={actionLoading}
        >
          Edit Game
        </Button>
      )}

      {isGM && stateActions.map((action) => (
        <Button
          key={action.state}
          variant="primary"
          onClick={() => onStateChange(action.state)}
          disabled={actionLoading}
          className={action.color}
          data-testid={`${action.state}-button`}
        >
          {action.label}
        </Button>
      ))}

      {!isGM && !isCheckingAuth && game.state === 'recruitment' && !userApplication && (
        <Button
          variant="primary"
          onClick={onApplyToGame}
          disabled={actionLoading}
          data-testid={`apply-button-${game.id}`}
        >
          Apply to Join
        </Button>
      )}

      {!isGM && userApplication && userApplication.status === 'pending' && game.state === 'recruitment' && (
        <Button
          variant="warning"
          onClick={onWithdrawApplication}
          disabled={actionLoading}
          data-testid="withdraw-application-button"
        >
          Withdraw Application
        </Button>
      )}

      {isGM && game.state === 'cancelled' && onDeleteGame && (
        <Button
          variant="danger"
          onClick={onDeleteGame}
          disabled={actionLoading}
          data-testid="delete-game-button"
        >
          Delete Game
        </Button>
      )}

    </div>
  );
}
