import { type ReactNode } from 'react';
import { Navigate, useLocation, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { apiClient } from '../lib/api';

interface PublicArchiveRouteProps {
  children: ReactNode;
}

/**
 * PublicArchiveRoute - Conditional route protection for game pages
 *
 * Allows access to:
 * - Completed games: Public archive mode (any user, including unauthenticated)
 * - Non-completed games: Requires authentication
 *
 * This implements the public archive feature where completed games become
 * publicly viewable read-only archives.
 */
export const PublicArchiveRoute = ({ children }: PublicArchiveRouteProps) => {
  const { isAuthenticated, isCheckingAuth } = useAuth();
  const location = useLocation();
  const { gameId } = useParams<{ gameId: string }>();

  // Fetch game to check if it's completed (public archive)
  const { data: game, isLoading: isLoadingGame, error } = useQuery({
    queryKey: ['gameForAccessCheck', gameId],
    queryFn: async () => {
      if (!gameId) return null;
      const response = await apiClient.games.getGame(parseInt(gameId, 10));
      return response.data;
    },
    enabled: !!gameId,
    retry: false, // Don't retry on 403/404
    staleTime: 60000, // Cache for 1 minute
  });

  // Show loading spinner while checking auth or fetching game state
  if (isCheckingAuth || isLoadingGame) {
    return (
      <div className="min-h-screen surface-page flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-interactive-primary"></div>
      </div>
    );
  }

  // If game fetch failed, let the error bubble up to the child component
  // (it will show "Game not found" message)
  if (error && !isAuthenticated) {
    // Unauthenticated user trying to access non-existent or private game
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Public Archive Mode: Completed games are viewable by anyone
  if (game?.state === 'completed') {
    // Allow access regardless of authentication status
    return <>{children}</>;
  }

  // Non-completed games require authentication
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Authenticated user - allow access
  return <>{children}</>;
};
