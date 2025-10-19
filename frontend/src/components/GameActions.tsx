import type { Game, GameApplication, GameState } from '../types/games';

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
        <button
          onClick={onEditGame}
          disabled={actionLoading}
          className="px-4 py-2 text-indigo-700 bg-indigo-100 hover:bg-indigo-200 rounded-lg font-medium transition-colors disabled:opacity-50"
        >
          Edit Game
        </button>
      )}

      {isGM && stateActions.map((action) => (
        <button
          key={action.state}
          onClick={() => onStateChange(action.state)}
          disabled={actionLoading}
          className={`px-4 py-2 text-white rounded-lg font-medium transition-colors disabled:opacity-50 ${action.color}`}
        >
          {action.label}
        </button>
      ))}

      {!isGM && !isCheckingAuth && game.state === 'recruitment' && !userApplication && (
        <button
          onClick={onApplyToGame}
          disabled={actionLoading}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
        >
          Apply to Join
        </button>
      )}

      {!isGM && userApplication && userApplication.status === 'pending' && game.state === 'recruitment' && (
        <button
          onClick={onWithdrawApplication}
          disabled={actionLoading}
          className="bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
        >
          Withdraw Application
        </button>
      )}

      {!isGM && isParticipant && game.state !== 'completed' && game.state !== 'cancelled' && (
        <button
          onClick={onLeaveGame}
          disabled={actionLoading}
          className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
        >
          Leave Game
        </button>
      )}
    </div>
  );
}
