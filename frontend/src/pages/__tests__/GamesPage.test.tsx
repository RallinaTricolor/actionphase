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
    applyToGame: vi.fn(),
  },
}))

// Mock the auth hook
vi.mock('../../hooks/useAuth', () => ({
  useAuth: vi.fn(),
}))

// Mock components
vi.mock('../../components/GamesList', () => ({
  GamesList: ({
    showRecruitingOnly,
    onGameClick,
    showCreateButton,
    onCreateClick,
    onApplyToGame,
    isJoining
  }: any) => (
    <div data-testid="games-list">
      <div>Recruiting Only: {String(showRecruitingOnly)}</div>
      <div>Show Create Button: {String(showCreateButton)}</div>
      <div>Is Joining: {String(isJoining)}</div>
      {onGameClick && (
        <button onClick={() => onGameClick({ id: 123, title: 'Test Game' })}>
          Test Game Click
        </button>
      )}
      {onCreateClick && (
        <button onClick={onCreateClick}>Create Game</button>
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
import { useAuth } from '../../hooks/useAuth'

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

  it('renders games page with header and navigation', () => {
    renderWithProviders(<GamesPage />)

    expect(screen.getByRole('heading', { name: 'Games' })).toBeInTheDocument()
    expect(screen.getByText('Discover and join role-playing games in the ActionPhase community')).toBeInTheDocument()

    expect(screen.getByRole('button', { name: /Recruiting/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /All Games/ })).toBeInTheDocument()
  })

  it('defaults to recruiting view mode', () => {
    renderWithProviders(<GamesPage />)

    const recruitingButton = screen.getByRole('button', { name: /Recruiting/ })
    const allGamesButton = screen.getByRole('button', { name: /All Games/ })

    expect(recruitingButton).toHaveClass('border-indigo-500', 'text-indigo-600')
    expect(allGamesButton).toHaveClass('border-transparent', 'text-gray-500')

    // Check GamesList receives correct prop
    expect(screen.getByText('Recruiting Only: true')).toBeInTheDocument()
  })

  it('switches to all games view mode', () => {
    renderWithProviders(<GamesPage />)

    const allGamesButton = screen.getByRole('button', { name: /All Games/ })
    fireEvent.click(allGamesButton)

    expect(allGamesButton).toHaveClass('border-indigo-500', 'text-indigo-600')
    expect(screen.getByText('Recruiting Only: false')).toBeInTheDocument()
  })

  it('switches back to recruiting view mode', () => {
    renderWithProviders(<GamesPage />)

    // Switch to all games first
    fireEvent.click(screen.getByRole('button', { name: /All Games/ }))
    expect(screen.getByText('Recruiting Only: false')).toBeInTheDocument()

    // Switch back to recruiting
    fireEvent.click(screen.getByRole('button', { name: /Recruiting/ }))
    expect(screen.getByText('Recruiting Only: true')).toBeInTheDocument()
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
    vi.mocked(apiClient.applyToGame).mockResolvedValue({ success: true } as any)

    renderWithProviders(<GamesPage />)

    await act(async () => {
      fireEvent.click(screen.getByText('Apply to Game'))
    })

    await waitFor(() => {
      expect(apiClient.applyToGame).toHaveBeenCalledWith(456, {
        role: 'player',
        message: undefined
      })
    })

    expect(global.alert).toHaveBeenCalledWith('Successfully applied to game as player!')
    expect(window.location.reload).toHaveBeenCalled()
  })

  it('prevents multiple simultaneous applications', async () => {
    vi.mocked(apiClient.applyToGame).mockImplementation(() =>
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
      expect(apiClient.applyToGame).toHaveBeenCalledTimes(1)
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
    vi.mocked(apiClient.applyToGame).mockRejectedValue(authError)

    renderWithProviders(<GamesPage />)

    fireEvent.click(screen.getByText('Apply to Game'))

    await waitFor(() => {
      expect(apiClient.applyToGame).toHaveBeenCalled()
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
    vi.mocked(apiClient.applyToGame).mockRejectedValue(apiError)

    renderWithProviders(<GamesPage />)

    fireEvent.click(screen.getByText('Apply to Game'))

    await waitFor(() => {
      expect(apiClient.applyToGame).toHaveBeenCalled()
    })

    expect(global.alert).toHaveBeenCalledWith('Failed to join game: Game is full')
  })

  it('handles generic error with message', async () => {
    const genericError = new Error('Network error')
    vi.mocked(apiClient.applyToGame).mockRejectedValue(genericError)

    renderWithProviders(<GamesPage />)

    fireEvent.click(screen.getByText('Apply to Game'))

    await waitFor(() => {
      expect(apiClient.applyToGame).toHaveBeenCalled()
    })

    expect(global.alert).toHaveBeenCalledWith('Failed to join game: Network error')
  })

  it('handles unknown error', async () => {
    vi.mocked(apiClient.applyToGame).mockRejectedValue({})

    renderWithProviders(<GamesPage />)

    fireEvent.click(screen.getByText('Apply to Game'))

    await waitFor(() => {
      expect(apiClient.applyToGame).toHaveBeenCalled()
    })

    expect(global.alert).toHaveBeenCalledWith('Failed to join game: Failed to join game. Please try again.')
  })

  it('shows joining state during application', async () => {
    vi.mocked(apiClient.applyToGame).mockImplementation(() =>
      new Promise(resolve => setTimeout(resolve, 100))
    )

    renderWithProviders(<GamesPage />)

    fireEvent.click(screen.getByText('Apply to Game'))

    // Should show joining state immediately
    expect(screen.getByText('Is Joining: true')).toBeInTheDocument()

    await waitFor(() => {
      expect(apiClient.applyToGame).toHaveBeenCalled()
    })

    // Should reset joining state after completion
    await waitFor(() => {
      expect(screen.getByText('Is Joining: false')).toBeInTheDocument()
    })
  })

  it('passes correct props to GamesList', () => {
    renderWithProviders(<GamesPage />)

    const gamesList = screen.getByTestId('games-list')

    expect(screen.getByText('Show Create Button: true')).toBeInTheDocument()
    expect(screen.getByText('Is Joining: false')).toBeInTheDocument()
    expect(screen.getByText('Recruiting Only: true')).toBeInTheDocument()
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
    vi.mocked(apiClient.applyToGame).mockRejectedValue(authError)

    renderWithProviders(<GamesPage />)

    fireEvent.click(screen.getByText('Apply to Game'))

    await waitFor(() => {
      expect(apiClient.applyToGame).toHaveBeenCalled()
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
