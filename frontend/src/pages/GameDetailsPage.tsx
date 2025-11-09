import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { useGameContext } from '../contexts/GameContext';
import { useGameApplication } from '../hooks/useGameApplication';
import { useGameStateManagement } from '../hooks/useGameStateManagement';
import { useGameTabs } from '../hooks/useGameTabs';
import { usePolls } from '../hooks';
import { GameHeader } from '../components/GameHeader';
import { GameApplicationStatus } from '../components/GameApplicationStatus';
import { GameActions } from '../components/GameActions';
import { GameInfoGrid } from '../components/GameInfoGrid';
import { TabNavigation } from '../components/TabNavigation';
import { GameTabContent } from '../components/GameTabContent';
import { ApplyToGameModal } from '../components/ApplyToGameModal';
import { EditGameModal } from '../components/EditGameModal';
import { CompleteGameConfirmationDialog } from '../components/CompleteGameConfirmationDialog';
import { PauseGameConfirmationDialog } from '../components/PauseGameConfirmationDialog';
import { CancelGameConfirmationDialog } from '../components/CancelGameConfirmationDialog';
import { LeaveGameConfirmationDialog } from '../components/LeaveGameConfirmationDialog';
import { DeleteGameConfirmationDialog } from '../components/DeleteGameConfirmationDialog';
import { DeadlineStrip } from '../components/DeadlineStrip';
import type { CreateDeadlineRequest } from '../types/deadlines';

interface GameDetailsPageProps {
  gameId: number;
  isGM?: boolean;
}

export const GameDetailsPage = ({ gameId }: GameDetailsPageProps) => {
  // Get data from contexts
  const { currentUser, isCheckingAuth } = useAuth();
  const {
    game,
    participants,
    isLoadingGame,
    isLoadingParticipants,
    isGM,
    isParticipant,
    canEditGame,
    userRole,
    userCharacters,
    refetchGameData,
  } = useGameContext();

  const currentUserId = currentUser?.id ?? null;
  const loading = isLoadingGame || isLoadingParticipants;

  // Get current phase data
  const { data: currentPhaseData, isLoading: isLoadingPhase } = useQuery({
    queryKey: ['currentPhase', gameId],
    queryFn: () => apiClient.phases.getCurrentPhase(gameId).then(res => res.data),
    enabled: !!gameId && game?.state === 'in_progress',
    refetchInterval: 30000, // Refetch every 30 seconds when game is in progress
  });

  // Custom hooks for application management
  const {
    userApplication,
    actionLoading: appActionLoading,
    showApplyModal,
    setShowApplyModal,
    handleApplicationSubmitted,
    handleWithdrawApplication,
  } = useGameApplication({
    gameId,
    isGM,
    gameState: game?.state || 'setup',
    currentUserId,
    refetchGameData,
  });

  // Custom hooks for state management
  const {
    actionLoading: stateActionLoading,
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
    showLeaveDialog,
    setShowLeaveDialog,
    handleConfirmLeave,
  } = useGameStateManagement({
    gameId,
    refetchGameData,
  });

  // Fetch polls to calculate unvoted count for badge
  const { polls } = usePolls(gameId, false);
  const unvotedPollsCount = polls.filter(poll => !poll.user_has_voted).length;

  // Custom hooks for tab management
  const { tabs, activeTab, setActiveTab } = useGameTabs({
    gameState: game?.state || 'setup',
    isGM,
    participantCount: participants.length,
    currentPhaseType: currentPhaseData?.phase?.phase_type,
    isAudience: userRole === 'audience',
    isParticipant,
    hasCharacters: userCharacters.length > 0,
    unvotedPollsCount,
  });

  const actionLoading = appActionLoading || stateActionLoading;
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);

  const queryClient = useQueryClient();

  // Fetch deadlines
  const { data: deadlines = [], isLoading: isLoadingDeadlines } = useQuery({
    queryKey: ['deadlines', gameId],
    queryFn: () => apiClient.deadlines.getGameDeadlines(gameId, false).then(res => res.data),
    enabled: !!gameId,
  });

  // Create deadline mutation
  const createDeadlineMutation = useMutation({
    mutationFn: (data: CreateDeadlineRequest) =>
      apiClient.deadlines.createDeadline(gameId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deadlines', gameId] });
    },
  });

  // Update deadline mutation
  const updateDeadlineMutation = useMutation({
    mutationFn: ({ deadlineId, data }: { deadlineId: number; data: CreateDeadlineRequest }) =>
      apiClient.deadlines.updateDeadline(deadlineId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deadlines', gameId] });
    },
  });

  // Delete deadline mutation
  const deleteDeadlineMutation = useMutation({
    mutationFn: (deadlineId: number) =>
      apiClient.deadlines.deleteDeadline(deadlineId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deadlines', gameId] });
    },
  });

  // Deadline handlers
  const handleCreateDeadline = async (data: CreateDeadlineRequest) => {
    await createDeadlineMutation.mutateAsync(data);
  };

  const handleUpdateDeadline = async (deadlineId: number, data: CreateDeadlineRequest) => {
    await updateDeadlineMutation.mutateAsync({ deadlineId, data });
  };

  const handleDeleteDeadline = async (deadlineId: number) => {
    await deleteDeadlineMutation.mutateAsync(deadlineId);
  };

  const handleExtendDeadline = async (deadlineId: number, hours: number) => {
    const deadline = deadlines.find(d => d.id === deadlineId);
    if (!deadline?.deadline) return;

    // Calculate new deadline by adding hours to current deadline
    const currentDate = new Date(deadline.deadline);
    const newDate = new Date(currentDate.getTime() + hours * 60 * 60 * 1000);

    await updateDeadlineMutation.mutateAsync({
      deadlineId,
      data: {
        title: deadline.title,
        description: deadline.description || '',
        deadline: newDate.toISOString(),
      },
    });
  };

  // Delete game handler
  const handleDeleteGame = () => {
    setShowDeleteDialog(true);
  };

  const handleConfirmDelete = async () => {
    try {
      await apiClient.games.deleteGame(gameId);
      // Redirect to games list after successful deletion
      window.location.href = '/games';
    } catch (error) {
      console.error('Failed to delete game:', error);
      // Error will be shown by the API client
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen surface-page flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-interactive-primary"></div>
      </div>
    );
  }

  if (!game) {
    return (
      <div className="min-h-screen surface-page flex items-center justify-center">
        <div className="surface-base p-8 rounded-lg shadow-md max-w-md w-full">
          <h2 className="text-xl font-semibold text-content-primary mb-4">Error</h2>
          <p className="text-content-secondary mb-4">Game not found</p>
          <button
            onClick={() => window.history.back()}
            className="w-full bg-interactive-primary hover:bg-interactive-primary-hover text-white py-2 px-4 rounded-lg transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const stateActions = isGM ? getStateActions(game.state) : [];

  // Check if user is viewing as public (completed game, not a participant)
  const isPublicViewer = game?.state === 'completed' && userRole === 'none';

  return (
    <div className="min-h-screen surface-page">
      <div className="max-w-6xl mx-auto py-8 px-4">
        {/* Public Archive Notice */}
        {isPublicViewer && (
          <div className="bg-interactive-primary/10 border border-interactive-primary rounded-lg p-4 mb-6">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-interactive-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              <div>
                <p className="font-semibold text-content-primary">Public Archive</p>
                <p className="text-sm text-content-secondary">
                  This completed game is publicly viewable as a read-only archive. You can browse the game's history, but cannot create new content.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Header - Compact Layout */}
        <div className="surface-base rounded-lg shadow-md p-6 mb-6">
          {/* Compact Header with integrated action menu */}
          <GameHeader
            game={game}
            participants={participants}
            playerCount={`${game.current_players || 0}/${game.max_players || '∞'}`}
            actionMenu={
              <GameActions
                game={game}
                isGM={isGM}
                canEditGame={canEditGame}
                isCheckingAuth={isCheckingAuth}
                isParticipant={isParticipant}
                userRole={userRole}
                userApplication={userApplication}
                actionLoading={actionLoading}
                stateActions={stateActions}
                onEditGame={() => setShowEditModal(true)}
                onStateChange={handleStateChange}
                onApplyToGame={() => setShowApplyModal(true)}
                onWithdrawApplication={handleWithdrawApplication}
                onLeaveGame={handleLeaveGame}
                onDeleteGame={handleDeleteGame}
              />
            }
          />

          {/* Description - Truncated with expand */}
          {game.description && (
            <div className="mt-3 mb-4">
              <p className={`text-content-secondary leading-relaxed ${!isDescriptionExpanded && game.description.length > 200 ? 'line-clamp-1' : ''}`}>
                {game.description}
              </p>
              {game.description.length > 200 && (
                <button
                  onClick={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
                  className="text-sm text-interactive-primary hover:text-interactive-primary-hover font-medium mt-1 transition-colors inline-flex items-center gap-1"
                >
                  {isDescriptionExpanded ? (
                    <>
                      <span>Show Less</span>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                      </svg>
                    </>
                  ) : (
                    <>
                      <span>Show More</span>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </>
                  )}
                </button>
              )}
            </div>
          )}

          {/* Game Info Grid - Show game metadata */}
          <GameInfoGrid game={game} />

          {/* User Application Status - Only show during recruitment */}
          {!isGM && userApplication && game.state === 'recruitment' && (
            <div className="mb-4">
              <GameApplicationStatus application={userApplication} />
            </div>
          )}

          {/* Deadline Strip - Horizontal layout with cards */}
          <DeadlineStrip
            deadlines={deadlines}
            isLoading={isLoadingDeadlines}
            isGM={isGM}
            gameState={game.state}
            onCreateDeadline={handleCreateDeadline}
            onUpdateDeadline={handleUpdateDeadline}
            onDeleteDeadline={handleDeleteDeadline}
            onExtendDeadline={handleExtendDeadline}
          />
        </div>

        {/* Tab Navigation */}
        {tabs.length > 0 && (
          <div className="mb-6">
            <TabNavigation
              tabs={tabs}
              activeTab={activeTab}
              onTabChange={setActiveTab}
            />

            {/* Tab Content */}
            <div className={`surface-base rounded-b-lg shadow-md ${activeTab === 'common-room' ? 'p-4' : 'p-6'}`}>
              <GameTabContent
                activeTab={activeTab}
                gameId={gameId}
                game={game}
                participants={participants}
                currentPhaseData={currentPhaseData}
                isLoadingPhase={isLoadingPhase}
                isGM={isGM}
                isParticipant={isParticipant}
                isAudience={userRole === 'audience'}
                currentUserId={currentUserId}
                userCharacters={userCharacters}
                onLeaveGame={handleLeaveGame}
                actionLoading={actionLoading}
              />
            </div>
          </div>
        )}
      </div>

      {/* Apply to Game Modal */}
      {game && (
        <ApplyToGameModal
          gameId={gameId}
          gameTitle={game.title}
          isOpen={showApplyModal}
          onClose={() => setShowApplyModal(false)}
          onApplicationSubmitted={handleApplicationSubmitted}
        />
      )}

      {/* Edit Game Modal */}
      {game && (
        <EditGameModal
          game={game}
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
          onGameUpdated={refetchGameData}
        />
      )}

      {/* Complete Game Confirmation Dialog */}
      {game && (
        <CompleteGameConfirmationDialog
          isOpen={showCompleteDialog}
          onClose={() => setShowCompleteDialog(false)}
          onConfirm={handleConfirmComplete}
          gameTitle={game.title}
        />
      )}

      {/* Pause Game Confirmation Dialog */}
      {game && (
        <PauseGameConfirmationDialog
          isOpen={showPauseDialog}
          onClose={() => setShowPauseDialog(false)}
          onConfirm={handleConfirmPause}
          gameTitle={game.title}
        />
      )}

      {/* Cancel Game Confirmation Dialog */}
      {game && (
        <CancelGameConfirmationDialog
          isOpen={showCancelDialog}
          onClose={() => setShowCancelDialog(false)}
          onConfirm={handleConfirmCancel}
          gameTitle={game.title}
        />
      )}

      {/* Leave Game Confirmation Dialog */}
      {game && (
        <LeaveGameConfirmationDialog
          isOpen={showLeaveDialog}
          onClose={() => setShowLeaveDialog(false)}
          onConfirm={handleConfirmLeave}
          gameTitle={game.title}
          isSubmitting={actionLoading}
        />
      )}

      {/* Delete Game Confirmation Dialog */}
      {game && (
        <DeleteGameConfirmationDialog
          isOpen={showDeleteDialog}
          onClose={() => setShowDeleteDialog(false)}
          onConfirm={handleConfirmDelete}
          gameTitle={game.title}
        />
      )}
    </div>
  );
};
