import { useState, useEffect } from 'react';
import { apiClient } from '../lib/api';
import type { GameWithDetails, GameParticipant, GameState, GameApplication } from '../types/games';
import { GAME_STATE_LABELS, GAME_STATE_COLORS } from '../types/games';
import { GameApplicationsList } from '../components/GameApplicationsList';
import { ApplyToGameModal } from '../components/ApplyToGameModal';

interface GameDetailsPageProps {
  gameId: number;
  isGM?: boolean;
}

export const GameDetailsPage = ({ gameId, isGM = false }: GameDetailsPageProps) => {
  const [game, setGame] = useState<GameWithDetails | null>(null);
  const [participants, setParticipants] = useState<GameParticipant[]>([]);
  const [userApplication, setUserApplication] = useState<GameApplication | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [showApplyModal, setShowApplyModal] = useState(false);

  useEffect(() => {
    fetchGameData();
  }, [gameId]);

  const fetchGameData = async () => {
    try {
      setLoading(true);
      const [gameResponse, participantsResponse] = await Promise.all([
        apiClient.getGameWithDetails(gameId),
        apiClient.getGameParticipants(gameId)
      ]);

      setGame(gameResponse.data);
      setParticipants(participantsResponse.data);

      // For now, we'll set userApplication to null as we need proper user context
      // In a real implementation, you'd fetch the user's application here
      setUserApplication(null);

      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load game details');
    } finally {
      setLoading(false);
    }
  };

  const handleStateChange = async (newState: GameState) => {
    if (!game) return;

    try {
      setActionLoading(true);
      await apiClient.updateGameState(gameId, { state: newState });
      await fetchGameData(); // Refresh data
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update game state');
    } finally {
      setActionLoading(false);
    }
  };

  const handleApplicationSubmitted = () => {
    fetchGameData(); // Refresh data after application is submitted
  };

  const handleWithdrawApplication = async () => {
    if (!confirm('Are you sure you want to withdraw your application?')) return;

    try {
      setActionLoading(true);
      await apiClient.withdrawGameApplication(gameId);
      await fetchGameData(); // Refresh data
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
      await fetchGameData(); // Refresh data
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

          {/* User Application Status */}
          {!isGM && userApplication && (
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

            {!isGM && game.state === 'recruitment' && !userApplication && (
              <button
                onClick={() => setShowApplyModal(true)}
                disabled={actionLoading}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                Apply to Join
              </button>
            )}

            {!isGM && userApplication && userApplication.status === 'pending' && (
              <button
                onClick={handleWithdrawApplication}
                disabled={actionLoading}
                className="bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                Withdraw Application
              </button>
            )}

            {!isGM && (
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

        {/* Applications (GM only) */}
        {isGM && <GameApplicationsList gameId={gameId} isGM={isGM} />}

        {/* Participants */}
        <div className="bg-white rounded-lg shadow-md p-8">
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
                        <div
                          key={participant.id}
                          className="border border-gray-200 rounded-lg p-4 bg-gray-50"
                        >
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
        </div>
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
    </div>
  );
};
