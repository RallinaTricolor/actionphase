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
  onJoinAsAudience: () => void;
}

export function GameActions({
  game,
  isGM,
  isCheckingAuth,
  isParticipant,
  userRole,
  userApplication,
  actionLoading,
  stateActions,
  onEditGame,
  onStateChange,
  onApplyToGame,
  onWithdrawApplication,
  onLeaveGame,
  onJoinAsAudience,
}: GameActionsProps) {
  return (
    <div className="flex gap-4">
      {isGM && game.state !== 'completed' && game.state !== 'cancelled' && (
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

      {/* Join as Audience - Available during recruitment and in_progress for non-participants */}
      {!isGM && !isCheckingAuth && userRole === 'none' && !userApplication &&
       (game.state === 'recruitment' || game.state === 'in_progress') && (
        <Button
          variant="secondary"
          onClick={onJoinAsAudience}
          disabled={actionLoading}
        >
          Join as Audience
        </Button>
      )}

      {/* Leave Game - Available for participants AND audience members */}
      {!isGM && (isParticipant || userRole === 'audience') && game.state !== 'completed' && game.state !== 'cancelled' && (
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
