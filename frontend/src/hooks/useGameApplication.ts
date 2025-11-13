import { useState, useEffect } from 'react';
import { apiClient } from '../lib/api';
import type { GameApplication } from '../types/games';
import { useToast } from '../contexts/ToastContext';

interface UseGameApplicationOptions {
  gameId: number;
  isGM: boolean;
  isInGame: boolean; // True if user has any role in the game (including audience)
  currentUserId: number | null;
  refetchGameData: () => Promise<void>;
}

export function useGameApplication({
  gameId,
  isGM,
  isInGame,
  currentUserId,
  refetchGameData,
}: UseGameApplicationOptions) {
  const { showError } = useToast();
  const [userApplication, setUserApplication] = useState<GameApplication | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [showApplyModal, setShowApplyModal] = useState(false);

  // Fetch user's application if not GM and not already in the game
  // Note: Users can apply during recruitment (player) or anytime (audience)
  useEffect(() => {
    const fetchUserApplication = async () => {
      if (!isGM && !isInGame && currentUserId) {
        try {
          const applicationResponse = await apiClient.games.getMyGameApplication(gameId);
          setUserApplication(applicationResponse.data);
        } catch (appErr) {
          // User has no application - that's fine
          setUserApplication(null);
        }
      } else {
        setUserApplication(null);
      }
    };

    fetchUserApplication();
  }, [gameId, isGM, isInGame, currentUserId]);

  const refetchUserApplication = async () => {
    if (!isGM && !isInGame && currentUserId) {
      try {
        const applicationResponse = await apiClient.games.getMyGameApplication(gameId);
        setUserApplication(applicationResponse.data);
      } catch (appErr) {
        // User has no application - that's fine
        setUserApplication(null);
      }
    }
  };

  const handleApplicationSubmitted = async () => {
    await refetchGameData();
    await refetchUserApplication();
  };

  const handleWithdrawApplication = async () => {
    if (!confirm('Are you sure you want to withdraw your application?')) return;

    try {
      setActionLoading(true);
      await apiClient.games.withdrawGameApplication(gameId);
      await refetchGameData();
      await refetchUserApplication();
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to withdraw application');
    } finally {
      setActionLoading(false);
    }
  };

  return {
    userApplication,
    actionLoading,
    showApplyModal,
    setShowApplyModal,
    handleApplicationSubmitted,
    handleWithdrawApplication,
    refetchUserApplication,
  };
}
