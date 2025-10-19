import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { apiClient } from '../lib/api';
import type { GameState, GameApplication } from '../types/games';
import { GAME_STATE_LABELS, GAME_STATE_COLORS } from '../types/games';
import { useAuth } from '../contexts/AuthContext';
import { useGameContext } from '../contexts/GameContext';
import { GameApplicationsList } from '../components/GameApplicationsList';
import { ApplyToGameModal } from '../components/ApplyToGameModal';
import { EditGameModal } from '../components/EditGameModal';
import { CharactersList } from '../components/CharactersList';
import { PhaseManagement } from '../components/PhaseManagement';
import { ActionSubmission } from '../components/ActionSubmission';
import { ActionsList } from '../components/ActionsList';
import { ActionResultsList } from '../components/ActionResultsList';
import { CommonRoom } from '../components/CommonRoom';
import { PrivateMessages } from '../components/PrivateMessages';
import { PhaseHistoryView } from '../components/PhaseHistoryView';
import { TabNavigation, type Tab } from '../components/TabNavigation';

interface GameDetailsPageProps {
  gameId: number;
  isGM?: boolean;
}

export const GameDetailsPage = ({ gameId, isGM: isGMProp = false }: GameDetailsPageProps) => {
  // Get search params for tab navigation
  const [searchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');

  // Get data from contexts
  const { currentUser, isCheckingAuth } = useAuth();
  const {
    game,
    participants,
    isLoadingGame,
    isLoadingParticipants,
    isGM,
    isParticipant,
    userCharacters,
    refetchGameData,
  } = useGameContext();

  const currentUserId = currentUser?.id ?? null;

  // Local UI state only
  const [userApplication, setUserApplication] = useState<GameApplication | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [activeTab, setActiveTab] = useState<string>(tabParam || 'default');

  // Combined loading state
  const loading = isLoadingGame || isLoadingParticipants;

  // Get current phase data using react-query
  const { data: currentPhaseData } = useQuery({
    queryKey: ['currentPhase', gameId],
    queryFn: () => apiClient.getCurrentPhase(gameId).then(res => res.data),
    enabled: !!gameId && game?.state === 'in_progress',
    refetchInterval: 30000, // Refetch every 30 seconds when game is in progress
  });

  // Fetch user's application if not GM and game is in recruitment
  useEffect(() => {
    const fetchUserApplication = async () => {
      if (!isGM && game?.state === 'recruitment' && currentUserId) {
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

    if (game) {
      fetchUserApplication();
    }
  }, [gameId, game, isGM, currentUserId]);

  const handleStateChange = async (newState: GameState) => {
    if (!game) return;

    try {
      setActionLoading(true);
      await apiClient.updateGameState(gameId, { state: newState });
      await refetchGameData(); // Refresh data from context
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update game state');
    } finally {
      setActionLoading(false);
    }
  };

  const handleApplicationSubmitted = () => {
    refetchGameData(); // Refresh data from context
  };

  const handleWithdrawApplication = async () => {
    if (!confirm('Are you sure you want to withdraw your application?')) return;

    try {
      setActionLoading(true);
      await apiClient.withdrawGameApplication(gameId);
      await refetchGameData(); // Refresh data from context
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to withdraw application');
    } finally {
      setActionLoading(false);
    }
  };

  const handleLeaveGame = async () => {
    if (!confirm('Are you sure you want to leave this game?')) return;

    try {
      setActionLoading(true);
      await apiClient.leaveGame(gameId);
      await refetchGameData(); // Refresh data from context
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to leave game');
    } finally {
      setActionLoading(false);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Not set';
    return new Date(dateString).toLocaleString();
  };

  // Phase-aware tab configuration (must be called on every render)
  const tabs: Tab[] = useMemo(() => {
    if (!game) return [];

    const tabList: Tab[] = [];

    if (game.state === 'recruitment') {
      if (isGM) {
        tabList.push({ id: 'applications', label: 'Applications', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg> });
      }
      tabList.push({ id: 'participants', label: 'Participants', badge: participants.length, icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg> });
      tabList.push({ id: 'info', label: 'Game Info', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> });
    } else if (game.state === 'character_creation') {
      tabList.push({ id: 'characters', label: 'Characters', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg> });
      tabList.push({ id: 'participants', label: 'Participants', badge: participants.length, icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg> });
      if (isGM) {
        tabList.push({ id: 'applications', label: 'Applications', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg> });
      }
    } else if (game.state === 'in_progress') {
      // Common Room is primary when it's a common_room phase
      if (currentPhaseData?.phase?.phase_type === 'common_room') {
        tabList.push({ id: 'common-room', label: 'Common Room', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg> });
      }
      // Phases tab (GM only)
      if (isGM) {
        tabList.push({ id: 'phases', label: 'Phases', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> });
      }
      // Actions tab
      tabList.push({ id: 'actions', label: isGM ? 'Actions' : 'Submit Action', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg> });
      // Characters
      tabList.push({ id: 'characters', label: 'Characters', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg> });
      // Private Messages
      tabList.push({ id: 'messages', label: 'Private Messages', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg> });
      // Phase History
      tabList.push({ id: 'history', label: 'Phase History', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> });
      // Participants
      tabList.push({ id: 'participants', label: 'Participants', badge: participants.length, icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg> });
    } else {
      // Default tabs for other states (setup, paused, completed, cancelled)
      tabList.push({ id: 'info', label: 'Game Info', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> });
      tabList.push({ id: 'characters', label: 'Characters', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg> });
      tabList.push({ id: 'participants', label: 'Participants', badge: participants.length, icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg> });
    }

    return tabList;
  }, [game, isGM, participants.length, currentPhaseData?.phase?.phase_type]);

  // Update active tab when URL parameter changes
  useEffect(() => {
    if (tabParam && tabs.find(t => t.id === tabParam)) {
      setActiveTab(tabParam);
    }
  }, [tabParam, tabs]);

  // Set default tab when tabs change
  useEffect(() => {
    if (tabs.length > 0 && !tabs.find(t => t.id === activeTab)) {
      setActiveTab(tabs[0].id);
    }
  }, [tabs, activeTab]);

  const getStateActions = (currentState: GameState) => {
    const actions: { label: string; state: GameState; color: string }[] = [];

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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error || !game) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Error</h2>
          <p className="text-gray-600 mb-4">{error || 'Game not found'}</p>
          <button
            onClick={() => window.history.back()}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  console.log('[GameDetailsPage] Role check:', {
    currentUserId,
    gmUserId: game?.gm_user_id,
    isGM,
    isParticipant,
    participants: participants.map(p => p.user_id)
  });

  const stateActions = isGM ? getStateActions(game.state) : [];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto py-8 px-4">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-md p-8 mb-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">{game.title}</h1>
              <div className="flex items-center gap-4">
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${GAME_STATE_COLORS[game.state]}`}>
                  {GAME_STATE_LABELS[game.state]}
                </span>
                <span className="text-gray-500">GM: {game.gm_username}</span>
                {game.genre && <span className="text-gray-500">Genre: {game.genre}</span>}
              </div>
            </div>
          </div>

          <p className="text-gray-700 mb-6 leading-relaxed">{game.description}</p>

          {/* Current Phase Summary - Only show when game is in progress */}
          {game.state === 'in_progress' && currentPhaseData?.phase && (
            <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-l-4 border-blue-500 rounded-r-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="flex-shrink-0">
                    {currentPhaseData.phase.phase_type === 'common_room' ? (
                      <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
                      </svg>
                    ) : (
                      <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-900">
                        Current Phase: {currentPhaseData.phase.title || `Phase ${currentPhaseData.phase.phase_number}`}
                      </span>
                      <span className="px-2 py-0.5 text-xs rounded-full font-medium bg-blue-100 text-blue-800 border border-blue-200">
                        {currentPhaseData.phase.phase_type === 'common_room' ? 'Discussion' : 'Action'}
                      </span>
                    </div>
                    {currentPhaseData.phase.deadline && (
                      <p className="text-xs text-gray-600 mt-0.5">
                        Deadline: {new Date(currentPhaseData.phase.deadline).toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* User Application Status - Only show during recruitment */}
          {!isGM && userApplication && game.state === 'recruitment' && (
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-blue-900">Your Application Status</h4>
                  <p className="text-sm text-blue-700">
                    Applied as {userApplication.role} • Status: {userApplication.status}
                  </p>
                </div>
                <span className={`px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800`}>
                  {userApplication.status}
                </span>
              </div>
              {userApplication.message && (
                <div className="mt-3 pt-3 border-t border-blue-200">
                  <p className="text-sm text-blue-700">
                    <strong>Your message:</strong> "{userApplication.message}"
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Game Info Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">Players</h3>
              <p className="text-gray-600">
                {game.current_players} / {game.max_players || 'Unlimited'}
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-gray-900 mb-2">Recruitment Deadline</h3>
              <p className="text-gray-600">{formatDate(game.recruitment_deadline)}</p>
            </div>

            <div>
              <h3 className="font-semibold text-gray-900 mb-2">Start Date</h3>
              <p className="text-gray-600">{formatDate(game.start_date)}</p>
            </div>

            <div>
              <h3 className="font-semibold text-gray-900 mb-2">End Date</h3>
              <p className="text-gray-600">{formatDate(game.end_date)}</p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4">
            {isGM && (
              <button
                onClick={() => setShowEditModal(true)}
                disabled={actionLoading}
                className="px-4 py-2 text-indigo-700 bg-indigo-100 hover:bg-indigo-200 rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                Edit Game
              </button>
            )}

            {isGM && stateActions.map((action) => (
              <button
                key={action.state}
                onClick={() => handleStateChange(action.state)}
                disabled={actionLoading}
                className={`px-4 py-2 text-white rounded-lg font-medium transition-colors disabled:opacity-50 ${action.color}`}
              >
                {action.label}
              </button>
            ))}

            {!isGM && !isCheckingAuth && game.state === 'recruitment' && !userApplication && (
              <button
                onClick={() => setShowApplyModal(true)}
                disabled={actionLoading}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                Apply to Join
              </button>
            )}

            {!isGM && userApplication && userApplication.status === 'pending' && game.state === 'recruitment' && (
              <button
                onClick={handleWithdrawApplication}
                disabled={actionLoading}
                className="bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                Withdraw Application
              </button>
            )}

            {!isGM && isParticipant && game.state !== 'completed' && game.state !== 'cancelled' && (
              <button
                onClick={handleLeaveGame}
                disabled={actionLoading}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                Leave Game
              </button>
            )}
          </div>
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
            <div className={`bg-white rounded-b-lg shadow-md ${activeTab === 'common-room' ? 'p-4' : 'p-6'}`}>
              {/* Applications Tab (Recruitment - GM only) */}
              {activeTab === 'applications' && game.state === 'recruitment' && isGM && (
                <GameApplicationsList gameId={gameId} isGM={isGM} gameState={game.state} />
              )}

              {/* Applications Tab (Character Creation - GM only, collapsed) */}
              {activeTab === 'applications' && game.state === 'character_creation' && isGM && (
                <GameApplicationsList gameId={gameId} isGM={isGM} gameState={game.state} />
              )}

              {/* Participants Tab */}
              {activeTab === 'participants' && (
                <>
                  <h2 className="text-2xl font-bold text-gray-900 mb-6">Participants</h2>
                  {participants.length === 0 ? (
                    <p className="text-gray-500">No participants yet.</p>
                  ) : (
                    <div className="space-y-4">
                      {['player', 'co_gm', 'audience'].map((role) => {
                        const roleParticipants = participants.filter(p => p.role === role);
                        if (roleParticipants.length === 0) return null;
                        return (
                          <div key={role}>
                            <h3 className="font-semibold text-gray-900 mb-2 capitalize">
                              {role.replace('_', ' ')}s ({roleParticipants.length})
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                              {roleParticipants.map((participant) => (
                                <div key={participant.id} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                                  <div className="font-medium text-gray-900">{participant.username}</div>
                                  <div className="text-sm text-gray-500">
                                    Joined {new Date(participant.joined_at).toLocaleDateString()}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}

              {/* Game Info Tab (Recruitment & other states) */}
              {activeTab === 'info' && (
                <>
                  <h2 className="text-2xl font-bold text-gray-900 mb-6">Game Information</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-2">Genre</h3>
                      <p className="text-gray-600">{game.genre || 'Not specified'}</p>
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-2">Players</h3>
                      <p className="text-gray-600">
                        {game.current_players} / {game.max_players || 'Unlimited'}
                      </p>
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-2">Recruitment Deadline</h3>
                      <p className="text-gray-600">{formatDate(game.recruitment_deadline)}</p>
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-2">Start Date</h3>
                      <p className="text-gray-600">{formatDate(game.start_date)}</p>
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-2">End Date</h3>
                      <p className="text-gray-600">{formatDate(game.end_date)}</p>
                    </div>
                  </div>
                </>
              )}

              {/* Characters Tab */}
              {activeTab === 'characters' && (
                <CharactersList
                  gameId={gameId}
                  userRole={isGM ? 'gm' : (isParticipant ? 'player' : 'audience')}
                  currentUserId={currentUserId || undefined}
                  gameState={game.state}
                  isAnonymous={game.is_anonymous || false}
                />
              )}

              {/* Common Room Tab (In Progress - common_room phases) */}
              {activeTab === 'common-room' && game.state === 'in_progress' && currentPhaseData?.phase?.phase_type === 'common_room' && (
                <CommonRoom
                  gameId={gameId}
                  phaseId={currentPhaseData?.phase?.id}
                  phaseTitle={currentPhaseData?.phase?.title || `Phase ${currentPhaseData?.phase?.phase_number}`}
                  isCurrentPhase={true}
                  isGM={isGM}
                />
              )}

              {/* Phases Tab (In Progress - GM only) */}
              {activeTab === 'phases' && game.state === 'in_progress' && isGM && (
                <PhaseManagement gameId={gameId} />
              )}

              {/* Actions Tab (In Progress) */}
              {activeTab === 'actions' && game.state === 'in_progress' && (
                <>
                  {isGM ? (
                    <ActionsList
                      gameId={gameId}
                      currentPhase={currentPhaseData?.phase}
                    />
                  ) : (
                    <>
                      <div className="mb-6">
                        <ActionSubmission
                          gameId={gameId}
                          currentPhase={currentPhaseData?.phase}
                        />
                      </div>
                      <div className="mb-6">
                        <ActionResultsList gameId={gameId} />
                      </div>
                    </>
                  )}
                </>
              )}

              {/* Phase History Tab (In Progress) */}
              {activeTab === 'history' && game.state === 'in_progress' && (
                <PhaseHistoryView gameId={gameId} currentPhaseId={currentPhaseData?.phase?.id} isGM={isGM} />
              )}

              {/* Private Messages Tab (In Progress) */}
              {activeTab === 'messages' && game.state === 'in_progress' && (
                <div className="h-[600px]">
                  <PrivateMessages
                    gameId={gameId}
                    characters={userCharacters}
                    isAnonymous={game.is_anonymous || false}
                  />
                </div>
              )}
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
    </div>
  );
};
