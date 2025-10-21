import { BrowserRouter as Router, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Layout } from './components/Layout';
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { GamesPage } from './pages/GamesPage';
import { GameDetailsPage } from './pages/GameDetailsPage';
import { ThreadViewPage } from './pages/ThreadViewPage';
import NotificationsPage from './pages/NotificationsPage';
import { SettingsPage } from './pages/SettingsPage';
import { AdminPage } from './pages/AdminPage';
import ThemeTestPage from './pages/ThemeTestPage';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { GameProvider } from './contexts/GameContext';
import { ThemeProvider } from './contexts/ThemeContext';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

function AppRoutes() {
  const { isAuthenticated } = useAuth();

  return (
    <Router>
      <Layout>
        <Routes>
          <Route
            path="/login"
            element={
              isAuthenticated ? <Navigate to="/dashboard" replace /> : <LoginPage />
            }
          />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/notifications"
            element={
              <ProtectedRoute>
                <NotificationsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <SettingsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <AdminPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/theme-test"
            element={
              <ProtectedRoute>
                <ThemeTestPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/games"
            element={
              <ProtectedRoute>
                <GamesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/games/recruiting"
            element={<Navigate to="/games?states=recruitment" replace />}
          />
          <Route
            path="/games/:gameId/common-room/thread/:commentId"
            element={
              <ProtectedRoute>
                <ThreadViewPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/games/:gameId"
            element={
              <ProtectedRoute>
                <GameDetailsPageWrapper />
              </ProtectedRoute>
            }
          />
          <Route path="/" element={<HomePage />} />
          <Route
            path="*"
            element={
              <Navigate to={isAuthenticated ? "/dashboard" : "/login"} replace />
            }
          />
        </Routes>
      </Layout>
    </Router>
  );
}

function GameDetailsPageWrapper() {
  const { gameId } = useParams<{ gameId: string }>();

  if (!gameId) {
    return <Navigate to="/games" replace />;
  }

  const gameIdNum = parseInt(gameId, 10);

  return (
    <GameProvider gameId={gameIdNum}>
      <GameDetailsPage gameId={gameIdNum} />
    </GameProvider>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <ThemeProvider>
            <AppRoutes />
          </ThemeProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
