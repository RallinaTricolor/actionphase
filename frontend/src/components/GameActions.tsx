import type { Game, GameApplication, GameState } from '../types/games';
import { Button } from './ui';

interface StateAction {
  label: string;
  state: GameState;
  color: string;
}

interface GameActionsProps {
  game: Game;
  isGM: boolean;
  isCheckingAuth: boolean;
  isParticipant: boolean;
  userApplication: GameApplication | null;
  actionLoading: boolean;
  stateActions: StateAction[];
  onEditGame: () => void;
  onStateChange: (state: GameState) => void;
  onApplyToGame: () => void;
  onWithdrawApplication: () => void;
  onLeaveGame: () => void;
}

export function GameActions({
  game,
  isGM,
  isCheckingAuth,
  isParticipant,
  userApplication,
  actionLoading,
  stateActions,
  onEditGame,
  onStateChange,
  onApplyToGame,
  onWithdrawApplication,
  onLeaveGame,
}: GameActionsProps) {
  return (
    <div className="flex gap-4">
      {isGM && (
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
        >
          {action.label}
        </Button>
      ))}

      {!isGM && !isCheckingAuth && game.state === 'recruitment' && !userApplication && (
        <Button
          variant="primary"
          onClick={onApplyToGame}
          disabled={actionLoading}
        >
          Apply to Join
        </Button>
      )}

      {!isGM && userApplication && userApplication.status === 'pending' && game.state === 'recruitment' && (
        <Button
          variant="warning"
          onClick={onWithdrawApplication}
          disabled={actionLoading}
        >
          Withdraw Application
        </Button>
      )}

      {!isGM && isParticipant && game.state !== 'completed' && game.state !== 'cancelled' && (
        <Button
          variant="danger"
          onClick={onLeaveGame}
          disabled={actionLoading}
        >
          Leave Game
        </Button>
      )}
    </div>
  );
}
