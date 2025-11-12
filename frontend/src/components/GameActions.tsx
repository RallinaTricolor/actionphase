import { useState, useRef, useEffect } from 'react';
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
  onJoinAsAudience: () => void;
  onWithdrawApplication: () => void;
  onLeaveGame: () => void;
  onDeleteGame?: () => void;
}

/**
 * GameActions - Compact kebab menu for game actions
 *
 * Shows important player actions as buttons (Apply/Withdraw)
 * and editor/GM actions in a dropdown menu
 */
export function GameActions({
  game,
  isGM,
  canEditGame,
  isCheckingAuth,
  isParticipant: _isParticipant,
  userRole,
  userApplication,
  actionLoading,
  stateActions,
  onEditGame,
  onStateChange,
  onApplyToGame,
  onJoinAsAudience,
  onWithdrawApplication,
  onLeaveGame: _onLeaveGame,
  onDeleteGame,
}: GameActionsProps) {
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    }

    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showMenu]);

  // Count menu items to determine if we should show the menu
  const hasEditAction = canEditGame && game.state !== 'completed' && game.state !== 'cancelled';
  const hasStateActions = isGM && stateActions.length > 0;
  const hasDeleteAction = isGM && game.state === 'cancelled' && onDeleteGame;
  const hasMenuItems = hasEditAction || hasStateActions || hasDeleteAction;

  // Player action buttons (always visible when applicable)
  const showApplyButton = !isGM && !isCheckingAuth && game.state === 'recruitment' && !userApplication;
  const showWithdrawButton = !isGM && userApplication && userApplication.status === 'pending' && game.state === 'recruitment';

  // Audience join button - show after recruitment for non-participants
  const showJoinAsAudienceButton = !isGM && !isCheckingAuth && userRole === 'none' &&
    ['character_creation', 'in_progress', 'paused'].includes(game.state) && !userApplication;

  return (
    <div className="flex items-center gap-2">
      {/* Player Actions - Always visible */}
      {showApplyButton && (
        <Button
          variant="primary"
          size="sm"
          onClick={onApplyToGame}
          disabled={actionLoading}
          data-testid={`apply-button-${game.id}`}
        >
          Apply to Join
        </Button>
      )}

      {showWithdrawButton && (
        <Button
          variant="warning"
          size="sm"
          onClick={onWithdrawApplication}
          disabled={actionLoading}
          data-testid="withdraw-application-button"
        >
          Withdraw Application
        </Button>
      )}

      {showJoinAsAudienceButton && (
        <div className="flex flex-col gap-1">
          <Button
            variant="secondary"
            size="sm"
            onClick={onJoinAsAudience}
            disabled={actionLoading}
            data-testid="join-as-audience-button"
          >
            Join as Audience
          </Button>
          <p className="text-xs text-text-secondary">
            Player recruitment has ended. Join as an audience member to follow the game.
          </p>
        </div>
      )}

      {/* Kebab Menu for GM/Editor Actions */}
      {hasMenuItems && (
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-2 rounded hover:bg-surface-raised transition-colors text-content-primary"
            aria-label="Game actions"
            data-testid="game-actions-menu"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
            </svg>
          </button>

          {showMenu && (
            <div className="absolute right-0 top-full mt-1 w-48 rounded-lg border border-theme-default surface-raised shadow-xl py-1 z-50">
              {/* State Change Actions - Phase transitions first */}
              {hasStateActions && stateActions.map((action) => (
                <button
                  key={action.state}
                  onClick={() => {
                    onStateChange(action.state);
                    setShowMenu(false);
                  }}
                  disabled={actionLoading}
                  className="w-full text-left px-4 py-2 text-sm text-content-primary hover:bg-surface-raised transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  data-testid={`${action.state}-button`}
                >
                  {action.label}
                </button>
              ))}

              {/* Edit Game - After phase transitions */}
              {hasEditAction && (
                <>
                  {hasStateActions && (
                    <div className="border-t border-border-primary my-1" />
                  )}
                  <button
                    onClick={() => {
                      onEditGame();
                      setShowMenu(false);
                    }}
                    disabled={actionLoading}
                    className="w-full text-left px-4 py-2 text-sm text-content-primary hover:bg-surface-raised transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Edit Game
                  </button>
                </>
              )}

              {/* Delete Game */}
              {hasDeleteAction && (
                <>
                  {(hasEditAction || hasStateActions) && (
                    <div className="border-t border-border-primary my-1" />
                  )}
                  <button
                    onClick={() => {
                      onDeleteGame?.();
                      setShowMenu(false);
                    }}
                    disabled={actionLoading}
                    className="w-full text-left px-4 py-2 text-sm text-semantic-danger hover:bg-semantic-danger-subtle transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    data-testid="delete-game-button"
                  >
                    Delete Game
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
