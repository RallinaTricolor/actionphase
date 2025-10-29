import { useState } from 'react';
import { apiClient } from '../lib/api';
import type { GameState } from '../types/games';
import { useToast } from '../contexts/ToastContext';

interface UseGameStateManagementOptions {
  gameId: number;
  refetchGameData: () => Promise<void>;
}

interface StateAction {
  label: string;
  state: GameState;
  color: string;
}

export function useGameStateManagement({
  gameId,
  refetchGameData,
}: UseGameStateManagementOptions) {
  const { showError } = useToast();
  const [actionLoading, setActionLoading] = useState(false);
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const [showPauseDialog, setShowPauseDialog] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);

  const handleStateChange = async (newState: GameState) => {
    // Show confirmation dialog for completing game
    if (newState === 'completed') {
      setShowCompleteDialog(true);
      return;
    }

    // Show confirmation dialog for pausing game
    if (newState === 'paused') {
      setShowPauseDialog(true);
      return;
    }

    // Show confirmation dialog for cancelling game
    if (newState === 'cancelled') {
      setShowCancelDialog(true);
      return;
    }

    try {
      setActionLoading(true);
      await apiClient.games.updateGameState(gameId, { state: newState });
      await refetchGameData();
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to update game state');
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmComplete = async () => {
    try {
      setActionLoading(true);
      await apiClient.games.updateGameState(gameId, { state: 'completed' });
      await refetchGameData();
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to complete game');
      throw err; // Re-throw so dialog can handle it
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmPause = async () => {
    try {
      setActionLoading(true);
      await apiClient.games.updateGameState(gameId, { state: 'paused' });
      await refetchGameData();
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to pause game');
      throw err; // Re-throw so dialog can handle it
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmCancel = async () => {
    try {
      setActionLoading(true);
      await apiClient.games.updateGameState(gameId, { state: 'cancelled' });
      await refetchGameData();
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to cancel game');
      throw err; // Re-throw so dialog can handle it
    } finally {
      setActionLoading(false);
    }
  };

  const handleLeaveGame = async () => {
    if (!confirm('Are you sure you want to leave this game?')) return;

    try {
      setActionLoading(true);
      await apiClient.games.leaveGame(gameId);
      await refetchGameData();
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to leave game');
    } finally {
      setActionLoading(false);
    }
  };

  const getStateActions = (currentState: GameState): StateAction[] => {
    const actions: StateAction[] = [];

    switch (currentState) {
      case 'setup':
        actions.push({ label: 'Start Recruitment', state: 'recruitment', color: 'bg-semantic-success hover:bg-semantic-success-hover text-white' });
        break;
      case 'recruitment':
        actions.push({ label: 'Close Recruitment', state: 'character_creation', color: 'bg-interactive-primary hover:bg-interactive-primary-hover text-white' });
        actions.push({ label: 'Cancel Game', state: 'cancelled', color: 'bg-semantic-danger hover:bg-semantic-danger-hover text-white' });
        break;
      case 'character_creation':
        actions.push({ label: 'Start Game', state: 'in_progress', color: 'bg-interactive-primary hover:bg-interactive-primary-hover text-white' });
        break;
      case 'in_progress':
        actions.push({ label: 'Pause Game', state: 'paused', color: 'bg-semantic-warning hover:bg-semantic-warning-hover text-white' });
        actions.push({ label: 'Complete Game', state: 'completed', color: 'bg-semantic-success hover:bg-semantic-success-hover text-white' });
        break;
      case 'paused':
        actions.push({ label: 'Resume Game', state: 'in_progress', color: 'bg-interactive-primary hover:bg-interactive-primary-hover text-white' });
        break;
    }

    return actions;
  };

  return {
    actionLoading,
    handleStateChange,
    handleLeaveGame,
    getStateActions,
    showCompleteDialog,
    setShowCompleteDialog,
    handleConfirmComplete,
    showPauseDialog,
    setShowPauseDialog,
    handleConfirmPause,
    showCancelDialog,
    setShowCancelDialog,
    handleConfirmCancel,
  };
}
