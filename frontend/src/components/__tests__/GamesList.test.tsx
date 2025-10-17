import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, fireEvent, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../test-utils'
import { GamesList } from '../GamesList'
import { http, HttpResponse } from 'msw'
import { server } from '../../mocks/server'
import type { GameListItem } from '../../types/games'

// Mock the auth hook
vi.mock('../../hooks/useAuth', () => ({
  useAuth: vi.fn(),
}))

import { useAuth } from '../../hooks/useAuth'

describe('GamesList', () => {
  const mockOnGameClick = vi.fn()
  const mockOnCreateClick = vi.fn()
  const mockOnApplyToGame = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GM Cannot Apply Bug - Regression Test', () => {
    const gmUser = { id: 1, username: 'gm_user', email: 'gm@example.com', created_at: '', updated_at: '' }
    const regularUser = { id: 2, username: 'player_user', email: 'player@example.com', created_at: '', updated_at: '' }

    const gmOwnedGame: GameListItem = {
      id: 1,
      title: 'GMs Game',
      description: 'A game owned by the GM',
      gm_user_id: 1, // Owned by gmUser
      gm_username: 'gm_user',
      state: 'recruitment',
      max_players: 4,
      current_players: 0,
      is_public: true,
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z',
    }

    const otherGame: GameListItem = {
      id: 2,
      title: 'Other GMs Game',
      description: 'A game owned by another GM',
      gm_user_id: 99, // Owned by different user
      gm_username: 'other_gm',
      state: 'recruitment',
      max_players: 4,
      current_players: 0,
      is_public: true,
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z',
    }

    it('GM should NOT see apply button on their own game', async () => {
      // Setup: Mock localStorage to have an auth token (so AuthProvider knows user is authenticated)
      const mockLocalStorage = {
        getItem: vi.fn((key: string) => key === 'auth_token' ? 'mock-gm-token' : null),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
        length: 0,
        key: vi.fn(),
      }
      Object.defineProperty(window, 'localStorage', {
        value: mockLocalStorage,
        writable: true,
      })

      // Mock API to return the GM user when AuthProvider fetches /api/v1/auth/me
      server.use(
        http.get('http://localhost:3000/api/v1/auth/me', () => {
          return HttpResponse.json(gmUser)
        }),
        http.get('http://localhost:3000/api/v1/games/recruiting', () => {
          return HttpResponse.json([gmOwnedGame])
        })
      )

      // Setup: GM is logged in (this mock may not be needed, but keeping for compatibility)
      vi.mocked(useAuth).mockReturnValue({
        currentUser: gmUser,
        isAuthenticated: true,
        isCheckingAuth: false,
        isLoading: false,
        login: vi.fn(),
        register: vi.fn(),
        logout: vi.fn(),
        error: null,
      } as any)

      renderWithProviders(
        <GamesList
          showRecruitingOnly={true}
          onApplyToGame={mockOnApplyToGame}
        />
      )

      // Wait for games to load
      await waitFor(() => {
        expect(screen.getByText('GMs Game')).toBeInTheDocument()
      })

      // CRITICAL: GM should NOT see "Apply to Join" button on their own game
      expect(screen.queryByText('Apply to Join')).not.toBeInTheDocument()
      expect(screen.queryByText('Applying...')).not.toBeInTheDocument()
    })

    it('GM should see apply button on other GMs games', async () => {
      // Setup: Mock localStorage with auth token
      const mockLocalStorage = {
        getItem: vi.fn((key: string) => key === 'auth_token' ? 'mock-gm-token' : null),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
        length: 0,
        key: vi.fn(),
      }
      Object.defineProperty(window, 'localStorage', {
        value: mockLocalStorage,
        writable: true,
      })

      // Mock API to return GM user and another GM's game
      server.use(
        http.get('http://localhost:3000/api/v1/auth/me', () => {
          return HttpResponse.json(gmUser)
        }),
        http.get('http://localhost:3000/api/v1/games/recruiting', () => {
          return HttpResponse.json([otherGame])
        })
      )

      // Setup: GM is logged in
      vi.mocked(useAuth).mockReturnValue({
        currentUser: gmUser,
        isAuthenticated: true,
        isCheckingAuth: false,
        isLoading: false,
        login: vi.fn(),
        register: vi.fn(),
        logout: vi.fn(),
        error: null,
      } as any)

      renderWithProviders(
        <GamesList
          showRecruitingOnly={true}
          onApplyToGame={mockOnApplyToGame}
        />
      )

      // Wait for games to load
      await waitFor(() => {
        expect(screen.getByText('Other GMs Game')).toBeInTheDocument()
      })

      // GM SHOULD see "Apply to Join" button on other games
      expect(screen.getByText('Apply to Join')).toBeInTheDocument()
    })

    it('Regular user should see apply button on all recruiting games', async () => {
      // Setup: Mock localStorage with auth token
      const mockLocalStorage = {
        getItem: vi.fn((key: string) => key === 'auth_token' ? 'mock-player-token' : null),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
        length: 0,
        key: vi.fn(),
      }
      Object.defineProperty(window, 'localStorage', {
        value: mockLocalStorage,
        writable: true,
      })

      // Mock API to return regular user and multiple games
      server.use(
        http.get('http://localhost:3000/api/v1/auth/me', () => {
          return HttpResponse.json(regularUser)
        }),
        http.get('http://localhost:3000/api/v1/games/recruiting', () => {
          return HttpResponse.json([gmOwnedGame, otherGame])
        })
      )

      // Setup: Regular player is logged in
      vi.mocked(useAuth).mockReturnValue({
        currentUser: regularUser,
        isAuthenticated: true,
        isCheckingAuth: false,
        isLoading: false,
        login: vi.fn(),
        register: vi.fn(),
        logout: vi.fn(),
        error: null,
      } as any)

      renderWithProviders(
        <GamesList
          showRecruitingOnly={true}
          onApplyToGame={mockOnApplyToGame}
        />
      )

      // Wait for games to load
      await waitFor(() => {
        expect(screen.getByText('GMs Game')).toBeInTheDocument()
        expect(screen.getByText('Other GMs Game')).toBeInTheDocument()
      })

      // Regular user should see "Apply to Join" on BOTH games
      const applyButtons = screen.getAllByText('Apply to Join')
      expect(applyButtons).toHaveLength(2)
    })

    it('Apply button should call onApplyToGame with correct game ID', async () => {
      // Setup: Mock localStorage with auth token
      const mockLocalStorage = {
        getItem: vi.fn((key: string) => key === 'auth_token' ? 'mock-player-token' : null),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
        length: 0,
        key: vi.fn(),
      }
      Object.defineProperty(window, 'localStorage', {
        value: mockLocalStorage,
        writable: true,
      })

      // Mock API to return regular user and other GM's game
      server.use(
        http.get('http://localhost:3000/api/v1/auth/me', () => {
          return HttpResponse.json(regularUser)
        }),
        http.get('http://localhost:3000/api/v1/games/recruiting', () => {
          return HttpResponse.json([otherGame])
        })
      )

      // Setup: Regular player is logged in
      vi.mocked(useAuth).mockReturnValue({
        currentUser: regularUser,
        isAuthenticated: true,
        isCheckingAuth: false,
        isLoading: false,
        login: vi.fn(),
        register: vi.fn(),
        logout: vi.fn(),
        error: null,
      } as any)

      renderWithProviders(
        <GamesList
          showRecruitingOnly={true}
          onApplyToGame={mockOnApplyToGame}
        />
      )

      // Wait for games to load
      await waitFor(() => {
        expect(screen.getByText('Other GMs Game')).toBeInTheDocument()
      })

      // Click the apply button
      const applyButton = screen.getByText('Apply to Join')
      fireEvent.click(applyButton)

      // Should call onApplyToGame with game ID and role
      expect(mockOnApplyToGame).toHaveBeenCalledWith(2, 'player')
    })

    it('Apply button should not appear when onApplyToGame is not provided', async () => {
      // Setup: Mock localStorage with auth token
      const mockLocalStorage = {
        getItem: vi.fn((key: string) => key === 'auth_token' ? 'mock-player-token' : null),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
        length: 0,
        key: vi.fn(),
      }
      Object.defineProperty(window, 'localStorage', {
        value: mockLocalStorage,
        writable: true,
      })

      // Mock API
      server.use(
        http.get('http://localhost:3000/api/v1/auth/me', () => {
          return HttpResponse.json(regularUser)
        }),
        http.get('http://localhost:3000/api/v1/games/recruiting', () => {
          return HttpResponse.json([otherGame])
        })
      )

      // Setup: Regular player is logged in
      vi.mocked(useAuth).mockReturnValue({
        currentUser: regularUser,
        isAuthenticated: true,
        isCheckingAuth: false,
        isLoading: false,
        login: vi.fn(),
        register: vi.fn(),
        logout: vi.fn(),
        error: null,
      } as any)

      renderWithProviders(
        <GamesList
          showRecruitingOnly={true}
          // Note: onApplyToGame NOT provided
        />
      )

      // Wait for games to load
      await waitFor(() => {
        expect(screen.getByText('Other GMs Game')).toBeInTheDocument()
      })

      // Should NOT see apply button when callback not provided
      expect(screen.queryByText('Apply to Join')).not.toBeInTheDocument()
    })

    it('Apply button should be disabled when isJoining is true', async () => {
      // Setup: Mock localStorage with auth token
      const mockLocalStorage = {
        getItem: vi.fn((key: string) => key === 'auth_token' ? 'mock-player-token' : null),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
        length: 0,
        key: vi.fn(),
      }
      Object.defineProperty(window, 'localStorage', {
        value: mockLocalStorage,
        writable: true,
      })

      // Mock API
      server.use(
        http.get('http://localhost:3000/api/v1/auth/me', () => {
          return HttpResponse.json(regularUser)
        }),
        http.get('http://localhost:3000/api/v1/games/recruiting', () => {
          return HttpResponse.json([otherGame])
        })
      )

      // Setup: Regular player is logged in
      vi.mocked(useAuth).mockReturnValue({
        currentUser: regularUser,
        isAuthenticated: true,
        isCheckingAuth: false,
        isLoading: false,
        login: vi.fn(),
        register: vi.fn(),
        logout: vi.fn(),
        error: null,
      } as any)

      renderWithProviders(
        <GamesList
          showRecruitingOnly={true}
          onApplyToGame={mockOnApplyToGame}
          isJoining={true}
        />
      )

      // Wait for games to load
      await waitFor(() => {
        expect(screen.getByText('Other GMs Game')).toBeInTheDocument()
      })

      // Should show "Applying..." text and be disabled
      const applyButton = screen.getByRole('button', { name: /Applying.../i })
      expect(applyButton).toBeDisabled()
    })

    it('Apply button should not appear on non-recruiting games', async () => {
      const activeGame: GameListItem = {
        ...otherGame,
        state: 'active', // Not recruiting
      }

      // Setup: Mock localStorage with auth token
      const mockLocalStorage = {
        getItem: vi.fn((key: string) => key === 'auth_token' ? 'mock-player-token' : null),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
        length: 0,
        key: vi.fn(),
      }
      Object.defineProperty(window, 'localStorage', {
        value: mockLocalStorage,
        writable: true,
      })

      // Mock API to return active game
      server.use(
        http.get('http://localhost:3000/api/v1/auth/me', () => {
          return HttpResponse.json(regularUser)
        }),
        http.get('http://localhost:3000/api/v1/games/public', () => {
          return HttpResponse.json([activeGame])
        })
      )

      // Setup: Regular player is logged in
      vi.mocked(useAuth).mockReturnValue({
        currentUser: regularUser,
        isAuthenticated: true,
        isCheckingAuth: false,
        isLoading: false,
        login: vi.fn(),
        register: vi.fn(),
        logout: vi.fn(),
        error: null,
      } as any)

      renderWithProviders(
        <GamesList
          showRecruitingOnly={false}
          onApplyToGame={mockOnApplyToGame}
        />
      )

      // Wait for games to load
      await waitFor(() => {
        expect(screen.getByText('Other GMs Game')).toBeInTheDocument()
      })

      // Should NOT see apply button on non-recruiting games
      expect(screen.queryByText('Apply to Join')).not.toBeInTheDocument()
    })
  })

  describe('Basic functionality', () => {
    beforeEach(() => {
      vi.mocked(useAuth).mockReturnValue({
        currentUser: null,
        isAuthenticated: false,
        isCheckingAuth: false,
        isLoading: false,
        login: vi.fn(),
        register: vi.fn(),
        logout: vi.fn(),
        error: null,
      } as any)
    })

    it('renders loading state initially', () => {
      renderWithProviders(<GamesList />)

      // Should show loading skeleton
      expect(document.querySelector('.animate-pulse')).toBeInTheDocument()
    })

    it('renders games list after loading', async () => {
      const mockGames: GameListItem[] = [
        {
          id: 1,
          title: 'Test Game',
          description: 'Test description',
          gm_user_id: 1,
          gm_username: 'testgm',
          state: 'recruitment',
          max_players: 4,
          current_players: 2,
          is_public: true,
          created_at: '2025-01-01T00:00:00Z',
          updated_at: '2025-01-01T00:00:00Z',
        },
      ]

      server.use(
        http.get('http://localhost:3000/api/v1/games/public', () => {
          return HttpResponse.json(mockGames)
        })
      )

      renderWithProviders(<GamesList showRecruitingOnly={false} />)

      await waitFor(() => {
        expect(screen.getByText('Test Game')).toBeInTheDocument()
      })

      expect(screen.getByText('Test description')).toBeInTheDocument()
      expect(screen.getByText('testgm')).toBeInTheDocument()
    })

    it('renders empty state when no games', async () => {
      server.use(
        http.get('http://localhost:3000/api/v1/games/public', () => {
          return HttpResponse.json([])
        })
      )

      renderWithProviders(<GamesList showRecruitingOnly={false} />)

      await waitFor(() => {
        expect(screen.getByText('No games available.')).toBeInTheDocument()
      })
    })

    it('handles game click', async () => {
      const mockGames: GameListItem[] = [
        {
          id: 1,
          title: 'Clickable Game',
          description: 'Click me',
          gm_user_id: 1,
          gm_username: 'testgm',
          state: 'recruitment',
          max_players: 4,
          current_players: 0,
          is_public: true,
          created_at: '2025-01-01T00:00:00Z',
          updated_at: '2025-01-01T00:00:00Z',
        },
      ]

      server.use(
        http.get('http://localhost:3000/api/v1/games/public', () => {
          return HttpResponse.json(mockGames)
        })
      )

      renderWithProviders(<GamesList onGameClick={mockOnGameClick} />)

      await waitFor(() => {
        expect(screen.getByText('Clickable Game')).toBeInTheDocument()
      })

      // Click the game card
      fireEvent.click(screen.getByText('Clickable Game'))

      expect(mockOnGameClick).toHaveBeenCalledWith(mockGames[0])
    })

    it('renders create button when showCreateButton is true', async () => {
      server.use(
        http.get('http://localhost:3000/api/v1/games/public', () => {
          return HttpResponse.json([])
        })
      )

      renderWithProviders(
        <GamesList
          showCreateButton={true}
          onCreateClick={mockOnCreateClick}
        />
      )

      await waitFor(() => {
        expect(screen.getByText('Create Game')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Create Game'))
      expect(mockOnCreateClick).toHaveBeenCalled()
    })
  })
})
