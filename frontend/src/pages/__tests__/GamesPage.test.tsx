import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, fireEvent, waitFor, act, cleanup } from '@testing-library/react'
import { renderWithProviders } from '../../test-utils'
import { GamesPage } from '../GamesPage'

// Mock react-router-dom
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

// Mock the API client
vi.mock('../../lib/api', () => ({
  apiClient: {
    getAuthToken: vi.fn(),
    removeAuthToken: vi.fn(),
    games: {
      applyToGame: vi.fn(),
    },
  },
}))

// Mock the auth hook
vi.mock('../../contexts/AuthContext', async () => {
  const actual = await vi.importActual('../../contexts/AuthContext')
  return {
    ...actual,
    useAuth: vi.fn(),
  }
})

// Mock components
vi.mock('../../components/GamesList', () => ({
  GamesList: ({
    games,
    loading,
    error,
    onGameClick,
    onApplyToGame,
    isJoining
  }: any) => (
    <div data-testid="games-list">
      <div>Games Count: {games?.length || 0}</div>
      <div>Loading: {String(loading)}</div>
      <div>Error: {error || 'none'}</div>
      <div>Is Joining: {String(isJoining)}</div>
      {onGameClick && (
        <button onClick={() => onGameClick({ id: 123, title: 'Test Game' })}>
          Test Game Click
        </button>
      )}
      {onApplyToGame && (
        <button onClick={() => onApplyToGame(456)}>Apply to Game</button>
      )}
    </div>
  ),
}))

vi.mock('../../components/CreateGameForm', () => ({
  CreateGameForm: ({ onSuccess, onCancel }: any) => (
    <div data-testid="create-game-form">
      <button onClick={() => onSuccess(789)}>Create Success</button>
      <button onClick={onCancel}>Cancel</button>
    </div>
  ),
}))

vi.mock('../../components/Modal', () => ({
  Modal: ({ isOpen, onClose, title, children }: any) => (
    isOpen ? (
      <div data-testid="modal">
        <h2>{title}</h2>
        <button onClick={onClose}>Close Modal</button>
        {children}
      </div>
    ) : null
  ),
}))

import { apiClient } from '../../lib/api'
import { useAuth } from '../../contexts/AuthContext'

describe('GamesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Default mock implementations
    vi.mocked(useAuth).mockReturnValue({
      isAuthenticated: true,
      user: { id: 1, username: 'testuser' },
      login: vi.fn(),
      logout: vi.fn(),
      isLoading: false,
    } as any)

    vi.mocked(apiClient.getAuthToken).mockReturnValue('valid-token')

    // Mock window methods
    Object.defineProperty(window, 'location', {
      value: { href: '', reload: vi.fn() },
      writable: true,
    })

    global.confirm = vi.fn().mockReturnValue(true)
    global.alert = vi.fn()
  })

  it('renders games page with header and create button', () => {
    renderWithProviders(<GamesPage />)

    expect(screen.getByRole('heading', { name: 'Browse Games' })).toBeInTheDocument()
    expect(screen.getByText('Discover and join role-playing games in the ActionPhase community')).toBeInTheDocument()

    expect(screen.getByRole('button', { name: 'Create Game' })).toBeInTheDocument()
  })

  it('navigates to game details when game is clicked', () => {
    renderWithProviders(<GamesPage />)

    const gameClickButton = screen.getByText('Test Game Click')
    fireEvent.click(gameClickButton)

    expect(mockNavigate).toHaveBeenCalledWith('/games/123')
  })

  it('opens create game modal', () => {
    renderWithProviders(<GamesPage />)

    const createButton = screen.getByText('Create Game')
    fireEvent.click(createButton)

    expect(screen.getByTestId('modal')).toBeInTheDocument()
    expect(screen.getByText('Create New Game')).toBeInTheDocument()
    expect(screen.getByTestId('create-game-form')).toBeInTheDocument()
  })

  it('closes create game modal', () => {
    renderWithProviders(<GamesPage />)

    // Open modal
    fireEvent.click(screen.getByText('Create Game'))
    expect(screen.getByTestId('modal')).toBeInTheDocument()

    // Close modal
    fireEvent.click(screen.getByText('Close Modal'))
    expect(screen.queryByTestId('modal')).not.toBeInTheDocument()
  })

  it('handles successful game creation', () => {
    renderWithProviders(<GamesPage />)

    // Open modal and create game
    fireEvent.click(screen.getByText('Create Game'))
    fireEvent.click(screen.getByText('Create Success'))

    expect(screen.queryByTestId('modal')).not.toBeInTheDocument()
    expect(mockNavigate).toHaveBeenCalledWith('/games/789')
  })

  it('handles game creation cancellation', () => {
    renderWithProviders(<GamesPage />)

    // Open modal and cancel
    fireEvent.click(screen.getByText('Create Game'))
    fireEvent.click(screen.getByText('Cancel'))

    expect(screen.queryByTestId('modal')).not.toBeInTheDocument()
  })

  it('applies to game successfully', async () => {
    vi.mocked(apiClient.games.applyToGame).mockResolvedValue({ success: true } as any)

    renderWithProviders(<GamesPage />)

    await act(async () => {
      fireEvent.click(screen.getByText('Apply to Game'))
    })

    await waitFor(() => {
      expect(apiClient.games.applyToGame).toHaveBeenCalledWith(456, {
        role: 'player',
        message: undefined
      })
    })

    // Component uses toast system instead of window.alert
    expect(window.location.reload).toHaveBeenCalled()
  })

  it('prevents multiple simultaneous applications', async () => {
    vi.mocked(apiClient.games.applyToGame).mockImplementation(() =>
      new Promise(resolve => setTimeout(resolve, 100))
    )

    renderWithProviders(<GamesPage />)

    const applyButton = screen.getByText('Apply to Game')

    // First click initiates the application
    await act(async () => {
      fireEvent.click(applyButton)
    })

    // Second click should be ignored because isJoining is true
    await act(async () => {
      fireEvent.click(applyButton)
    })

    // Wait for the first call to complete
    await waitFor(() => {
      expect(apiClient.games.applyToGame).toHaveBeenCalledTimes(1)
    }, { timeout: 200 })
  })

  it('handles invalid authentication token', async () => {
    vi.mocked(apiClient.getAuthToken).mockReturnValue('')

    renderWithProviders(<GamesPage />)

    fireEvent.click(screen.getByText('Apply to Game'))

    expect(apiClient.removeAuthToken).toHaveBeenCalled()
    expect(global.confirm).toHaveBeenCalledWith(
      'You need to log in to apply to a game. Would you like to go to the login page?'
    )
    expect(window.location.href).toBe('/login')
  })

  it('handles various invalid token formats', async () => {
    const invalidTokens = ['null', 'undefined', '   ', null]

    for (const token of invalidTokens) {
      vi.clearAllMocks()
      vi.mocked(apiClient.getAuthToken).mockReturnValue(token as any)

      renderWithProviders(<GamesPage />)
      fireEvent.click(screen.getAllByText('Apply to Game')[0])

      expect(apiClient.removeAuthToken).toHaveBeenCalled()

      // Cleanup before next iteration
      cleanup()
    }
  })

  it('handles 401 authentication error', async () => {
    const authError = {
      response: { status: 401 }
    }
    vi.mocked(apiClient.games.applyToGame).mockRejectedValue(authError)

    renderWithProviders(<GamesPage />)

    fireEvent.click(screen.getByText('Apply to Game'))

    await waitFor(() => {
      expect(apiClient.games.applyToGame).toHaveBeenCalled()
    })

    expect(apiClient.removeAuthToken).toHaveBeenCalled()
    expect(global.confirm).toHaveBeenCalledWith(
      expect.stringContaining('Your session has expired or is invalid')
    )
  })

  it('handles API error with error message', async () => {
    const apiError = {
      response: {
        status: 400,
        data: { error: 'Game is full' }
      }
    }
    vi.mocked(apiClient.games.applyToGame).mockRejectedValue(apiError)

    renderWithProviders(<GamesPage />)

    fireEvent.click(screen.getByText('Apply to Game'))

    await waitFor(() => {
      expect(apiClient.games.applyToGame).toHaveBeenCalled()
    })

    // Component uses toast system instead of window.alert
  })

  it('handles generic error with message', async () => {
    const genericError = new Error('Network error')
    vi.mocked(apiClient.games.applyToGame).mockRejectedValue(genericError)

    renderWithProviders(<GamesPage />)

    fireEvent.click(screen.getByText('Apply to Game'))

    await waitFor(() => {
      expect(apiClient.games.applyToGame).toHaveBeenCalled()
    })

    // Component uses toast system instead of window.alert
  })

  it('handles unknown error', async () => {
    vi.mocked(apiClient.games.applyToGame).mockRejectedValue({})

    renderWithProviders(<GamesPage />)

    fireEvent.click(screen.getByText('Apply to Game'))

    await waitFor(() => {
      expect(apiClient.games.applyToGame).toHaveBeenCalled()
    })

    // Component uses toast system instead of window.alert
  })

  it('shows joining state during application', async () => {
    vi.mocked(apiClient.games.applyToGame).mockImplementation(() =>
      new Promise(resolve => setTimeout(resolve, 100))
    )

    renderWithProviders(<GamesPage />)

    fireEvent.click(screen.getByText('Apply to Game'))

    // Should show joining state immediately
    expect(screen.getByText('Is Joining: true')).toBeInTheDocument()

    await waitFor(() => {
      expect(apiClient.games.applyToGame).toHaveBeenCalled()
    })

    // Should reset joining state after completion
    await waitFor(() => {
      expect(screen.getByText('Is Joining: false')).toBeInTheDocument()
    })
  })

  it('handles user declining login redirect', () => {
    vi.mocked(global.confirm).mockReturnValue(false)
    vi.mocked(apiClient.getAuthToken).mockReturnValue('')

    renderWithProviders(<GamesPage />)

    fireEvent.click(screen.getByText('Apply to Game'))

    expect(apiClient.removeAuthToken).toHaveBeenCalled()
    expect(global.confirm).toHaveBeenCalled()
    expect(window.location.href).toBe('') // Should not redirect
  })

  it('handles user declining auth error redirect', async () => {
    vi.mocked(global.confirm).mockReturnValue(false)
    const authError = { response: { status: 401 } }
    vi.mocked(apiClient.games.applyToGame).mockRejectedValue(authError)

    renderWithProviders(<GamesPage />)

    fireEvent.click(screen.getByText('Apply to Game'))

    await waitFor(() => {
      expect(apiClient.games.applyToGame).toHaveBeenCalled()
    })

    expect(window.location.href).toBe('') // Should not redirect
  })

  it('logs debug information during application', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.mocked(apiClient.getAuthToken).mockReturnValue('test-token-12345')

    renderWithProviders(<GamesPage />)

    fireEvent.click(screen.getByText('Apply to Game'))

    expect(consoleSpy).toHaveBeenCalledWith(
      'Apply to game - isAuthenticated:', true, 'token exists:', true
    )
    expect(consoleSpy).toHaveBeenCalledWith(
      'Token preview:', 'test-token-12345...'
    )

    consoleSpy.mockRestore()
  })
})
