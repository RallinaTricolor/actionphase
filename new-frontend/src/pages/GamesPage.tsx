import { useState } from 'react';
import { GamesList } from '../components/GamesList';
import { CreateGameForm } from '../components/CreateGameForm';
import { Modal } from '../components/Modal';
import { apiClient } from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import type { GameListItem } from '../types/games';

type ViewMode = 'all' | 'recruiting';

export const GamesPage = () => {
  const [viewMode, setViewMode] = useState<ViewMode>('recruiting');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const { isAuthenticated } = useAuth();

  const handleGameClick = (game: GameListItem) => {
    // TODO: Navigate to game details page
    console.log('Navigate to game:', game.id);
  };

  const handleCreateGame = () => {
    setShowCreateModal(true);
  };

  const handleCreateSuccess = (gameId: number) => {
    setShowCreateModal(false);
    // TODO: Navigate to the newly created game
    console.log('Game created with ID:', gameId);
  };

  const handleJoinGame = async (gameId: number, role: 'player' | 'audience' = 'player') => {
    if (isJoining) return;

    // Debug logging
    const token = apiClient.getAuthToken();
    console.log('Join game - isAuthenticated:', isAuthenticated, 'token exists:', !!token);
    console.log('Token type:', typeof token, 'Token length:', token?.length);
    console.log('Token preview:', token ? token.substring(0, 50) + '...' : 'null');
    console.log('Raw localStorage auth_token:', localStorage.getItem('auth_token'));

    // Always check authentication state at runtime
    if (!token || token.trim() === '' || token === 'undefined' || token === 'null') {
      console.log('Invalid token detected, clearing localStorage');
      apiClient.removeAuthToken();
      if (confirm('You need to log in to join a game. Would you like to go to the login page?')) {
        window.location.href = '/login';
      }
      return;
    }

    try {
      setIsJoining(true);
      await apiClient.joinGame(gameId, { role });

      // Show success message
      alert(`Successfully joined game as ${role}!`);

      // TODO: Refresh the games list or navigate to game details
      window.location.reload(); // Simple refresh for now

    } catch (error: any) {
      console.error('Failed to join game:', error);

      // Show user-friendly error message
      let errorMessage = 'Failed to join game. Please try again.';

      if (error?.response?.status === 401) {
        errorMessage = 'Your session has expired or is invalid. Please log in again.';
        console.log('Authentication failed - clearing token and redirecting to login');

        // Clear the invalid token
        apiClient.removeAuthToken();

        if (confirm(`${errorMessage} Would you like to go to the login page?`)) {
          window.location.href = '/login';
        }
        return;
      } else if (error?.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error?.message) {
        errorMessage = error.message;
      }

      alert(`Failed to join game: ${errorMessage}`);
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white border-b border-gray-200">
          <div className="px-6 py-4">
            <h1 className="text-3xl font-bold text-gray-900">Games</h1>
            <p className="text-gray-600 mt-1">
              Discover and join role-playing games in the ActionPhase community
            </p>
          </div>

          {/* Navigation Tabs */}
          <div className="px-6">
            <nav className="flex space-x-8">
              <button
                onClick={() => setViewMode('recruiting')}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  viewMode === 'recruiting'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Recruiting
                <span className="ml-2 bg-green-100 text-green-800 py-1 px-2 rounded-full text-xs">
                  Open
                </span>
              </button>
              <button
                onClick={() => setViewMode('all')}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  viewMode === 'all'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                All Games
              </button>
            </nav>
          </div>
        </div>

        {/* Game Lists */}
        <div className="bg-white">
          <GamesList
            showRecruitingOnly={viewMode === 'recruiting'}
            onGameClick={handleGameClick}
            showCreateButton={true}
            onCreateClick={handleCreateGame}
            onJoinGame={handleJoinGame}
            isJoining={isJoining}
          />
        </div>

        {/* Create Game Modal */}
        <Modal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          title="Create New Game"
        >
          <CreateGameForm
            onSuccess={handleCreateSuccess}
            onCancel={() => setShowCreateModal(false)}
          />
        </Modal>
      </div>
    </div>
  );
};
