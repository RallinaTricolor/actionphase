import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { GamesList } from '../components/GamesList';
import { CreateGameForm } from '../components/CreateGameForm';
import { Modal } from '../components/Modal';
import { FilterBar } from '../components/FilterBar';
import { Input } from '../components/ui';
import { apiClient } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { useGameListing } from '../hooks/useGameListing';
import { useToast } from '../contexts/ToastContext';

export const GamesPage = () => {
  const navigate = useNavigate();
  const { showSuccess, showError } = useToast();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const { isAuthenticated } = useAuth();

  // Use the new game listing hook with URL-synced filters
  const {
    games,
    metadata,
    filters,
    setSearch,
    setStates,
    setParticipation,
    setHasOpenSpots,
    setSortBy,
    clearFilters,
    isLoading,
    isError,
    error,
  } = useGameListing();

  // Debounced search effect
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setSearch(searchInput);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchInput, setSearch]);

  const handleCreateGame = () => {
    setShowCreateModal(true);
  };

  const handleCreateSuccess = (gameId: number) => {
    setShowCreateModal(false);
    navigate(`/games/${gameId}`);
  };

  const handleApplyToGame = async (gameId: number, role: 'player' | 'audience' = 'player', message?: string) => {
    if (isJoining) return;

    // Debug logging
    const token = apiClient.getAuthToken();
    console.log('Apply to game - isAuthenticated:', isAuthenticated, 'token exists:', !!token);
    console.log('Token type:', typeof token, 'Token length:', token?.length);
    console.log('Token preview:', token ? token.substring(0, 50) + '...' : 'null');
    console.log('Raw localStorage auth_token:', localStorage.getItem('auth_token'));

    // Always check authentication state at runtime
    if (!token || token.trim() === '' || token === 'undefined' || token === 'null') {
      console.log('Invalid token detected, clearing localStorage');
      apiClient.removeAuthToken();
      if (confirm('You need to log in to apply to a game. Would you like to go to the login page?')) {
        window.location.href = '/login';
      }
      return;
    }

    try {
      setIsJoining(true);
      await apiClient.games.applyToGame(gameId, { role, message });

      // Show success message
      showSuccess(`Successfully applied to game as ${role}!`);

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

      showError(`Failed to join game: ${errorMessage}`);
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Page Header */}
      <div className="mb-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-content-primary">Browse Games</h1>
            <p className="text-content-secondary mt-2 text-sm">
              Discover and join role-playing games in the ActionPhase community
            </p>
          </div>
          <button
            onClick={handleCreateGame}
            className="bg-interactive-primary hover:bg-interactive-primary text-white px-4 py-2 rounded-lg transition-colors font-medium"
          >
            Create Game
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="mb-4">
        <Input
          id="game-search"
          type="text"
          placeholder="Search games by title or description..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="max-w-2xl"
        />
      </div>

      {/* Filter Bar */}
      <FilterBar
        selectedStates={filters.states || []}
        participation={filters.participation}
        hasOpenSpots={filters.has_open_spots}
        sortBy={filters.sort_by || 'recent_activity'}
        availableStates={metadata.available_states}
        onStatesChange={setStates}
        onParticipationChange={setParticipation}
        onHasOpenSpotsChange={setHasOpenSpots}
        onSortByChange={setSortBy}
        onClearFilters={clearFilters}
        filteredCount={metadata.filtered_count}
        totalCount={metadata.total_count}
      />

      {/* Games List */}
      <div className="mt-6">
        <GamesList
          games={games}
          loading={isLoading}
          error={isError ? (error?.message ?? null) : null}
          onApplyToGame={handleApplyToGame}
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
  );
};
