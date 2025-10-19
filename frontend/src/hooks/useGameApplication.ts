import { useState, useEffect } from 'react';
import { apiClient } from '../lib/api';
import type { GameApplication } from '../types/games';

interface UseGameApplicationOptions {
  gameId: number;
  isGM: boolean;
  gameState: string;
  currentUserId: number | null;
  refetchGameData: () => Promise<void>;
}

export function useGameApplication({
  gameId,
  isGM,
  gameState,
  currentUserId,
  refetchGameData,
}: UseGameApplicationOptions) {
  const [userApplication, setUserApplication] = useState<GameApplication | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [showApplyModal, setShowApplyModal] = useState(false);

  // Fetch user's application if not GM and game is in recruitment
  useEffect(() => {
    const fetchUserApplication = async () => {
      if (!isGM && gameState === 'recruitment' && currentUserId) {
        try {
          const applicationResponse = await apiClient.getMyGameApplication(gameId);
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
  }, [gameId, isGM, gameState, currentUserId]);

  const handleApplicationSubmitted = async () => {
    await refetchGameData();
  };

  const handleWithdrawApplication = async () => {
    if (!confirm('Are you sure you want to withdraw your application?')) return;

    try {
      setActionLoading(true);
      await apiClient.withdrawGameApplication(gameId);
      await refetchGameData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to withdraw application');
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
  };
}
