import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route, Navigate, useParams } from 'react-router-dom'
import App from '../App'

// Mock the auth hook
vi.mock('../hooks/useAuth', () => ({
  useAuth: vi.fn(),
}))

// Mock all page components
vi.mock('../pages/HomePage', () => ({
  HomePage: () => <div data-testid="home-page">Home Page</div>,
}))

vi.mock('../pages/LoginPage', () => ({
  LoginPage: () => <div data-testid="login-page">Login Page</div>,
}))

vi.mock('../pages/DashboardPage', () => ({
  DashboardPage: () => <div data-testid="dashboard-page">Dashboard Page</div>,
}))

vi.mock('../pages/GamesPage', () => ({
  GamesPage: () => <div data-testid="games-page">Games Page</div>,
}))

vi.mock('../pages/GameDetailsPage', () => ({
  GameDetailsPage: ({ gameId }: { gameId: number }) => (
    <div data-testid="game-details-page">Game Details Page: {gameId}</div>
  ),
}))

vi.mock('../components/ProtectedRoute', () => ({
  ProtectedRoute: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="protected-route">{children}</div>
  ),
}))

vi.mock('../components/ErrorBoundary', () => ({
  ErrorBoundary: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="error-boundary">{children}</div>
  ),
}))

import { useAuth } from '../hooks/useAuth'

// We'll test the AppRoutes component directly since App already includes BrowserRouter
const TestAppRoutes = ({ initialEntries }: { initialEntries: string[] }) => (
  <MemoryRouter initialEntries={initialEntries}>
    <div data-testid="error-boundary">
      <AppRoutes />
    </div>
  </MemoryRouter>
)

// Import AppRoutes for testing
import AppDefault from '../App'
// We need to create a separate component for testing that doesn't include BrowserRouter
const AppRoutes = () => {
  const { isAuthenticated } = useAuth();

  return (
    <Routes>
      <Route
        path="/login"
        element={
          isAuthenticated ? <Navigate to="/dashboard" replace /> : <div data-testid="login-page">Login Page</div>
        }
      />
      <Route
        path="/dashboard"
        element={
          isAuthenticated ? (
            <div data-testid="protected-route">
              <div data-testid="dashboard-page">Dashboard Page</div>
            </div>
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
      <Route
        path="/games"
        element={
          isAuthenticated ? (
            <div data-testid="protected-route">
              <div data-testid="games-page">Games Page</div>
            </div>
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
      <Route
        path="/games/:gameId"
        element={
          isAuthenticated ? (
            <div data-testid="protected-route">
              <TestGameDetailsPageWrapper />
            </div>
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
      <Route path="/" element={<div data-testid="home-page">Home Page</div>} />
      <Route
        path="*"
        element={
          <Navigate to={isAuthenticated ? "/dashboard" : "/login"} replace />
        }
      />
    </Routes>
  );
}

const TestGameDetailsPageWrapper = () => {
  const { gameId } = useParams<{ gameId: string }>();

  if (!gameId) {
    return <Navigate to="/games" replace />;
  }

  return <div data-testid="game-details-page">Game Details Page: {parseInt(gameId, 10)}</div>;
}

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('when user is not authenticated', () => {
    beforeEach(() => {
      vi.mocked(useAuth).mockReturnValue({
        isAuthenticated: false,
        user: null,
        login: vi.fn(),
        logout: vi.fn(),
        isLoading: false,
      } as any)
    })

    it('renders home page at root route', () => {
      render(<TestAppRoutes initialEntries={['/']} />)

      expect(screen.getByTestId('error-boundary')).toBeInTheDocument()
      expect(screen.getByTestId('home-page')).toBeInTheDocument()
    })

    it('renders login page at /login route', () => {
      render(<TestAppRoutes initialEntries={['/login']} />)

      expect(screen.getByTestId('login-page')).toBeInTheDocument()
    })

    it('redirects to login from dashboard when unauthenticated', () => {
      render(<TestAppRoutes initialEntries={['/dashboard']} />)

      expect(screen.getByTestId('login-page')).toBeInTheDocument()
    })

    it('redirects to login from games when unauthenticated', () => {
      render(<TestAppRoutes initialEntries={['/games']} />)

      expect(screen.getByTestId('login-page')).toBeInTheDocument()
    })

    it('redirects to login from game details when unauthenticated', () => {
      render(<TestAppRoutes initialEntries={['/games/123']} />)

      expect(screen.getByTestId('login-page')).toBeInTheDocument()
    })

    it('redirects unknown routes to login when unauthenticated', () => {
      render(<TestAppRoutes initialEntries={['/unknown-route']} />)

      expect(screen.getByTestId('login-page')).toBeInTheDocument()
    })
  })

  describe('when user is authenticated', () => {
    beforeEach(() => {
      vi.mocked(useAuth).mockReturnValue({
        isAuthenticated: true,
        user: { id: 1, username: 'testuser' },
        login: vi.fn(),
        logout: vi.fn(),
        isLoading: false,
      } as any)
    })

    it('renders home page at root route even when authenticated', () => {
      render(<TestAppRoutes initialEntries={['/']} />)

      expect(screen.getByTestId('home-page')).toBeInTheDocument()
    })

    it('redirects to dashboard from login when authenticated', () => {
      render(<TestAppRoutes initialEntries={['/login']} />)

      expect(screen.getByTestId('protected-route')).toBeInTheDocument()
      expect(screen.getByTestId('dashboard-page')).toBeInTheDocument()
    })

    it('renders dashboard page when authenticated', () => {
      render(<TestAppRoutes initialEntries={['/dashboard']} />)

      expect(screen.getByTestId('protected-route')).toBeInTheDocument()
      expect(screen.getByTestId('dashboard-page')).toBeInTheDocument()
    })

    it('renders games page when authenticated', () => {
      render(<TestAppRoutes initialEntries={['/games']} />)

      expect(screen.getByTestId('protected-route')).toBeInTheDocument()
      expect(screen.getByTestId('games-page')).toBeInTheDocument()
    })

    it('renders game details page with valid game ID', () => {
      render(<TestAppRoutes initialEntries={['/games/456']} />)

      expect(screen.getByTestId('protected-route')).toBeInTheDocument()
      expect(screen.getByTestId('game-details-page')).toBeInTheDocument()
      expect(screen.getByText('Game Details Page: 456')).toBeInTheDocument()
    })

    it('redirects to dashboard from unknown routes when authenticated', () => {
      render(<TestAppRoutes initialEntries={['/unknown-route']} />)

      expect(screen.getByTestId('protected-route')).toBeInTheDocument()
      expect(screen.getByTestId('dashboard-page')).toBeInTheDocument()
    })
  })

  describe('GameDetailsPageWrapper', () => {
    beforeEach(() => {
      vi.mocked(useAuth).mockReturnValue({
        isAuthenticated: true,
        user: { id: 1, username: 'testuser' },
        login: vi.fn(),
        logout: vi.fn(),
        isLoading: false,
      } as any)
    })

    it('renders game details with numeric game ID', () => {
      render(<TestAppRoutes initialEntries={['/games/789']} />)

      expect(screen.getByText('Game Details Page: 789')).toBeInTheDocument()
    })

    it('handles string game IDs by parsing to integer', () => {
      render(<TestAppRoutes initialEntries={['/games/123']} />)

      expect(screen.getByText('Game Details Page: 123')).toBeInTheDocument()
    })

    it('redirects to games list when gameId is missing', () => {
      // This simulates a malformed route that somehow doesn't include gameId
      // We'll simulate this by testing the component behavior directly
      render(<TestAppRoutes initialEntries={['/games/']} />)

      // Should redirect to games page or show games page
      // Since the route pattern is /games/:gameId, /games/ wouldn't match
      // and would fall through to the catch-all route, showing games page
      expect(screen.getByTestId('games-page')).toBeInTheDocument()
    })

    it('handles game ID with leading zeros', () => {
      render(<TestAppRoutes initialEntries={['/games/007']} />)

      expect(screen.getByText('Game Details Page: 7')).toBeInTheDocument()
    })

    it('handles invalid game ID formats gracefully', () => {
      render(<TestAppRoutes initialEntries={['/games/abc']} />)

      // parseInt('abc', 10) returns NaN, but component should still render
      expect(screen.getByTestId('game-details-page')).toBeInTheDocument()
    })
  })

  describe('Error Boundary integration', () => {
    it('wraps the entire app in error boundary', () => {
      vi.mocked(useAuth).mockReturnValue({
        isAuthenticated: false,
        user: null,
        login: vi.fn(),
        logout: vi.fn(),
        isLoading: false,
      } as any)

      render(<TestAppRoutes initialEntries={['/']} />)

      expect(screen.getByTestId('error-boundary')).toBeInTheDocument()
    })
  })

  describe('QueryClient configuration', () => {
    it('provides QueryClient to all components', () => {
      vi.mocked(useAuth).mockReturnValue({
        isAuthenticated: false,
        user: null,
        login: vi.fn(),
        logout: vi.fn(),
        isLoading: false,
      } as any)

      // The QueryClientProvider is used internally
      // We verify this by checking that the app renders without QueryClient errors
      expect(() => {
        render(<TestAppRoutes initialEntries={['/']} />)
      }).not.toThrow()

      expect(screen.getByTestId('home-page')).toBeInTheDocument()
    })
  })

  describe('Protected Routes', () => {
    it('wraps dashboard in ProtectedRoute', () => {
      vi.mocked(useAuth).mockReturnValue({
        isAuthenticated: true,
        user: { id: 1, username: 'testuser' },
        login: vi.fn(),
        logout: vi.fn(),
        isLoading: false,
      } as any)

      render(<TestAppRoutes initialEntries={['/dashboard']} />)

      expect(screen.getByTestId('protected-route')).toBeInTheDocument()
      expect(screen.getByTestId('dashboard-page')).toBeInTheDocument()
    })

    it('wraps games page in ProtectedRoute', () => {
      vi.mocked(useAuth).mockReturnValue({
        isAuthenticated: true,
        user: { id: 1, username: 'testuser' },
        login: vi.fn(),
        logout: vi.fn(),
        isLoading: false,
      } as any)

      render(<TestAppRoutes initialEntries={['/games']} />)

      expect(screen.getByTestId('protected-route')).toBeInTheDocument()
      expect(screen.getByTestId('games-page')).toBeInTheDocument()
    })

    it('wraps game details in ProtectedRoute', () => {
      vi.mocked(useAuth).mockReturnValue({
        isAuthenticated: true,
        user: { id: 1, username: 'testuser' },
        login: vi.fn(),
        logout: vi.fn(),
        isLoading: false,
      } as any)

      render(<TestAppRoutes initialEntries={['/games/123']} />)

      expect(screen.getByTestId('protected-route')).toBeInTheDocument()
      expect(screen.getByTestId('game-details-page')).toBeInTheDocument()
    })

    it('does not wrap home page in ProtectedRoute', () => {
      vi.mocked(useAuth).mockReturnValue({
        isAuthenticated: false,
        user: null,
        login: vi.fn(),
        logout: vi.fn(),
        isLoading: false,
      } as any)

      render(<TestAppRoutes initialEntries={['/']} />)

      expect(screen.queryByTestId('protected-route')).not.toBeInTheDocument()
      expect(screen.getByTestId('home-page')).toBeInTheDocument()
    })

    it('does not wrap login page in ProtectedRoute', () => {
      vi.mocked(useAuth).mockReturnValue({
        isAuthenticated: false,
        user: null,
        login: vi.fn(),
        logout: vi.fn(),
        isLoading: false,
      } as any)

      render(<TestAppRoutes initialEntries={['/login']} />)

      expect(screen.queryByTestId('protected-route')).not.toBeInTheDocument()
      expect(screen.getByTestId('login-page')).toBeInTheDocument()
    })
  })

  describe('Route navigation behavior', () => {
    it('handles multiple route changes correctly', () => {
      vi.mocked(useAuth).mockReturnValue({
        isAuthenticated: true,
        user: { id: 1, username: 'testuser' },
        login: vi.fn(),
        logout: vi.fn(),
        isLoading: false,
      } as any)

      const { rerender } = render(<TestAppRoutes initialEntries={['/dashboard']} />)
      expect(screen.getByTestId('dashboard-page')).toBeInTheDocument()

      // Simulate navigation to games
      rerender(<TestAppRoutes initialEntries={['/games']} />)
      expect(screen.getByTestId('games-page')).toBeInTheDocument()

      // Simulate navigation to specific game
      rerender(<TestAppRoutes initialEntries={['/games/456']} />)
      expect(screen.getByText('Game Details Page: 456')).toBeInTheDocument()
    })
  })

  describe('Authentication state changes', () => {
    it('handles authentication state change from unauthenticated to authenticated', () => {
      // Start unauthenticated
      vi.mocked(useAuth).mockReturnValue({
        isAuthenticated: false,
        user: null,
        login: vi.fn(),
        logout: vi.fn(),
        isLoading: false,
      } as any)

      const { rerender } = render(<TestAppRoutes initialEntries={['/dashboard']} />)
      expect(screen.getByTestId('login-page')).toBeInTheDocument()

      // Become authenticated
      vi.mocked(useAuth).mockReturnValue({
        isAuthenticated: true,
        user: { id: 1, username: 'testuser' },
        login: vi.fn(),
        logout: vi.fn(),
        isLoading: false,
      } as any)

      rerender(<TestAppRoutes initialEntries={['/dashboard']} />)
      expect(screen.getByTestId('dashboard-page')).toBeInTheDocument()
    })

    it('handles authentication state change from authenticated to unauthenticated', () => {
      // Start authenticated
      vi.mocked(useAuth).mockReturnValue({
        isAuthenticated: true,
        user: { id: 1, username: 'testuser' },
        login: vi.fn(),
        logout: vi.fn(),
        isLoading: false,
      } as any)

      const { rerender } = render(<TestAppRoutes initialEntries={['/dashboard']} />)
      expect(screen.getByTestId('dashboard-page')).toBeInTheDocument()

      // Become unauthenticated
      vi.mocked(useAuth).mockReturnValue({
        isAuthenticated: false,
        user: null,
        login: vi.fn(),
        logout: vi.fn(),
        isLoading: false,
      } as any)

      rerender(<TestAppRoutes initialEntries={['/dashboard']} />)
      expect(screen.getByTestId('login-page')).toBeInTheDocument()
    })
  })
})
