import { useState } from 'react';
import { apiClient } from '../lib/api';
import type { GameState } from '../types/games';

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
  const [actionLoading, setActionLoading] = useState(false);

  const handleStateChange = async (newState: GameState) => {
    try {
      setActionLoading(true);
      await apiClient.updateGameState(gameId, { state: newState });
      await refetchGameData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update game state');
    } finally {
      setActionLoading(false);
    }
  };

  const handleLeaveGame = async () => {
    if (!confirm('Are you sure you want to leave this game?')) return;

    try {
      setActionLoading(true);
      await apiClient.leaveGame(gameId);
      await refetchGameData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to leave game');
    } finally {
      setActionLoading(false);
    }
  };

  const getStateActions = (currentState: GameState): StateAction[] => {
    const actions: StateAction[] = [];

    switch (currentState) {
      case 'setup':
        actions.push({ label: 'Start Recruitment', state: 'recruitment', color: 'bg-green-600 hover:bg-green-700' });
        break;
      case 'recruitment':
        actions.push({ label: 'Close Recruitment', state: 'character_creation', color: 'bg-blue-600 hover:bg-blue-700' });
        actions.push({ label: 'Cancel Game', state: 'cancelled', color: 'bg-red-600 hover:bg-red-700' });
        break;
      case 'character_creation':
        actions.push({ label: 'Start Game', state: 'in_progress', color: 'bg-purple-600 hover:bg-purple-700' });
        break;
      case 'in_progress':
        actions.push({ label: 'Pause Game', state: 'paused', color: 'bg-yellow-600 hover:bg-yellow-700' });
        actions.push({ label: 'Complete Game', state: 'completed', color: 'bg-green-600 hover:bg-green-700' });
        break;
      case 'paused':
        actions.push({ label: 'Resume Game', state: 'in_progress', color: 'bg-purple-600 hover:bg-purple-700' });
        break;
    }

    return actions;
  };

  return {
    actionLoading,
    handleStateChange,
    handleLeaveGame,
    getStateActions,
  };
}
