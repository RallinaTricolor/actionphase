import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { PublicArchiveRoute } from './components/PublicArchiveRoute';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AdminModeProvider } from './contexts/AdminModeContext';
import { GameProvider } from './contexts/GameContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { ToastProvider } from './contexts/ToastContext';
import { logger } from '@/services/LoggingService';

// Lazy load all page components for better code splitting
const HomePage = lazy(() => import('./pages/HomePage').then(m => ({ default: m.HomePage })));
const LoginPage = lazy(() => import('./pages/LoginPage').then(m => ({ default: m.LoginPage })));
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage').then(m => ({ default: m.ForgotPasswordPage })));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage').then(m => ({ default: m.ResetPasswordPage })));
const VerifyEmailPage = lazy(() => import('./pages/VerifyEmailPage').then(m => ({ default: m.VerifyEmailPage })));
const DashboardPage = lazy(() => import('./pages/DashboardPage').then(m => ({ default: m.DashboardPage })));
const GamesPage = lazy(() => import('./pages/GamesPage').then(m => ({ default: m.GamesPage })));
const GameDetailsPage = lazy(() => import('./pages/GameDetailsPage').then(m => ({ default: m.GameDetailsPage })));
const NotificationsPage = lazy(() => import('./pages/NotificationsPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage').then(m => ({ default: m.SettingsPage })));
const AdminPage = lazy(() => import('./pages/AdminPage').then(m => ({ default: m.AdminPage })));
const UserProfilePage = lazy(() => import('./pages/UserProfilePage').then(m => ({ default: m.UserProfilePage })));
const CharacterPage = lazy(() => import('./pages/CharacterPage').then(m => ({ default: m.CharacterPage })));
const ThemeTestPage = lazy(() => import('./pages/ThemeTestPage'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 5 * 60 * 1000, // 5 minutes
      refetchOnWindowFocus: false, // Prevent automatic refetch on tab switch to preserve user input and scroll position
    },
  },
});

// Loading fallback component
function PageLoader() {
  return (
    <div className="min-h-screen surface-page flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-interactive-primary"></div>
    </div>
  );
}

function AppRoutes() {
  const { isAuthenticated, isCheckingAuth } = useAuth();

  return (
    <Router>
      <Layout>
        <Suspense fallback={<PageLoader />}>
          <Routes>
          <Route
            path="/login"
            element={
              // Wait for auth check to complete before making routing decisions
              // This prevents ERR_ABORTED during page navigation in E2E tests
              isCheckingAuth ? null : (
                isAuthenticated ? <Navigate to="/dashboard" replace /> : <LoginPage />
              )
            }
          />
          <Route
            path="/forgot-password"
            element={
              isCheckingAuth ? null : (
                isAuthenticated ? <Navigate to="/dashboard" replace /> : <ForgotPasswordPage />
              )
            }
          />
          <Route
            path="/reset-password"
            element={
              isCheckingAuth ? null : (
                isAuthenticated ? <Navigate to="/dashboard" replace /> : <ResetPasswordPage />
              )
            }
          />
          <Route
            path="/verify-email"
            element={<VerifyEmailPage />}
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
            path="/games/:gameId"
            element={
              <PublicArchiveRoute>
                <GameDetailsPageWrapper />
              </PublicArchiveRoute>
            }
          />
          <Route
            path="/users/:username"
            element={
              <ProtectedRoute>
                <UserProfilePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/characters/:characterId"
            element={
              <ProtectedRoute>
                <CharacterPage />
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
        </Suspense>
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
  useEffect(() => {
    // Log application initialization
    logger.info('ActionPhase application initialized', {
      environment: import.meta.env.MODE,
      baseUrl: import.meta.env.VITE_API_BASE_URL || 'proxy',
      version: import.meta.env.VITE_APP_VERSION || 'development',
    });
  }, []);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <AuthProvider>
            <AdminModeProvider>
              <ThemeProvider>
                  <AppRoutes />
              </ThemeProvider>
            </AdminModeProvider>
          </AuthProvider>
        </ToastProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
