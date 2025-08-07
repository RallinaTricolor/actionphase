import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { LoginForm } from '../LoginForm'

// Mock the error handlers and hooks
vi.mock('../../hooks/useAuth', () => ({
  useAuth: vi.fn(),
}))

vi.mock('../../hooks/useErrorHandler', () => ({
  useErrorHandler: vi.fn(),
}))

vi.mock('../../lib/errors', () => ({
  errorHandlers: {
    authentication: vi.fn(),
  },
}))

vi.mock('../ErrorDisplay', () => ({
  ErrorDisplay: ({ error, onRetry, onDismiss }: any) => (
    error ? (
      <div data-testid="error-display">
        <span>{error.message}</span>
        {onRetry && <button onClick={onRetry}>Retry</button>}
        {onDismiss && <button onClick={onDismiss}>Dismiss</button>}
      </div>
    ) : null
  ),
}))

import { useAuth } from '../../hooks/useAuth'
import { useErrorHandler } from '../../hooks/useErrorHandler'
import { errorHandlers } from '../../lib/errors'

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

describe('LoginForm', () => {
  const mockLogin = vi.fn()
  const mockHandleError = vi.fn()
  const mockClearError = vi.fn()
  const mockOnSuccess = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()

    // Default mock implementations
    vi.mocked(useAuth).mockReturnValue({
      login: mockLogin,
      isLoading: false,
      isAuthenticated: false,
      user: null,
      logout: vi.fn(),
    } as any)

    vi.mocked(useErrorHandler).mockReturnValue({
      error: null,
      handleError: mockHandleError,
      clearError: mockClearError,
    } as any)

    vi.mocked(errorHandlers.authentication).mockImplementation((err) => err)
  })

  it('renders login form with all required fields', () => {
    render(<LoginForm />, { wrapper: createWrapper() })

    expect(screen.getByRole('heading', { name: 'Login' })).toBeInTheDocument()
    expect(screen.getByLabelText('Username')).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Login' })).toBeInTheDocument()
  })

  it('handles form input changes', async () => {
    render(<LoginForm />, { wrapper: createWrapper() })

    const usernameInput = screen.getByLabelText('Username')
    const passwordInput = screen.getByLabelText('Password')

    fireEvent.change(usernameInput, { target: { value: 'testuser' } })
    fireEvent.change(passwordInput, { target: { value: 'password123' } })

    expect(usernameInput).toHaveValue('testuser')
    expect(passwordInput).toHaveValue('password123')
  })

  it('submits form with correct data', async () => {
    mockLogin.mockResolvedValue({ user: { id: 1, username: 'testuser' } })

    render(<LoginForm onSuccess={mockOnSuccess} />, { wrapper: createWrapper() })

    const usernameInput = screen.getByLabelText('Username')
    const passwordInput = screen.getByLabelText('Password')
    const submitButton = screen.getByRole('button', { name: 'Login' })

    fireEvent.change(usernameInput, { target: { value: 'testuser' } })
    fireEvent.change(passwordInput, { target: { value: 'password123' } })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith({
        username: 'testuser',
        password: 'password123',
      })
    })

    expect(mockClearError).toHaveBeenCalled()
    expect(mockOnSuccess).toHaveBeenCalled()
  })

  it('prevents form submission with empty fields', () => {
    render(<LoginForm />, { wrapper: createWrapper() })

    const submitButton = screen.getByRole('button', { name: 'Login' })

    // Form should not submit due to required attributes
    fireEvent.click(submitButton)

    expect(mockLogin).not.toHaveBeenCalled()
  })

  it('shows loading state during login', () => {
    vi.mocked(useAuth).mockReturnValue({
      login: mockLogin,
      isLoading: true,
      isAuthenticated: false,
      user: null,
      logout: vi.fn(),
    } as any)

    render(<LoginForm />, { wrapper: createWrapper() })

    const submitButton = screen.getByRole('button', { name: 'Logging in...' })

    expect(submitButton).toBeDisabled()
    expect(submitButton).toHaveTextContent('Logging in...')
  })

  it('handles login errors', async () => {
    const loginError = new Error('Invalid credentials')
    mockLogin.mockRejectedValue(loginError)

    render(<LoginForm />, { wrapper: createWrapper() })

    const usernameInput = screen.getByLabelText('Username')
    const passwordInput = screen.getByLabelText('Password')
    const submitButton = screen.getByRole('button', { name: 'Login' })

    fireEvent.change(usernameInput, { target: { value: 'testuser' } })
    fireEvent.change(passwordInput, { target: { value: 'wrongpassword' } })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalled()
    })

    expect(errorHandlers.authentication).toHaveBeenCalledWith(loginError)
    expect(mockHandleError).toHaveBeenCalled()
  })

  it('displays error messages', () => {
    const testError = { message: 'Authentication failed', type: 'AUTH_ERROR' }

    vi.mocked(useErrorHandler).mockReturnValue({
      error: testError,
      handleError: mockHandleError,
      clearError: mockClearError,
    } as any)

    render(<LoginForm />, { wrapper: createWrapper() })

    expect(screen.getByTestId('error-display')).toBeInTheDocument()
    expect(screen.getByText('Authentication failed')).toBeInTheDocument()
  })

  it('allows error retry', async () => {
    const testError = { message: 'Network error', type: 'NETWORK_ERROR' }

    vi.mocked(useErrorHandler).mockReturnValue({
      error: testError,
      handleError: mockHandleError,
      clearError: mockClearError,
    } as any)

    render(<LoginForm />, { wrapper: createWrapper() })

    const retryButton = screen.getByRole('button', { name: 'Retry' })
    fireEvent.click(retryButton)

    // Note: The retry functionality triggers handleSubmit with a synthetic event
    // This is a simplified test - in reality, the form would need to be filled
    await waitFor(() => {
      expect(mockClearError).toHaveBeenCalled()
    })
  })

  it('allows error dismissal', () => {
    const testError = { message: 'Some error', type: 'GENERIC_ERROR' }

    vi.mocked(useErrorHandler).mockReturnValue({
      error: testError,
      handleError: mockHandleError,
      clearError: mockClearError,
    } as any)

    render(<LoginForm />, { wrapper: createWrapper() })

    const dismissButton = screen.getByRole('button', { name: 'Dismiss' })
    fireEvent.click(dismissButton)

    expect(mockClearError).toHaveBeenCalled()
  })

  it('calls onSuccess callback after successful login', async () => {
    mockLogin.mockResolvedValue({ user: { id: 1, username: 'testuser' } })

    render(<LoginForm onSuccess={mockOnSuccess} />, { wrapper: createWrapper() })

    const usernameInput = screen.getByLabelText('Username')
    const passwordInput = screen.getByLabelText('Password')
    const submitButton = screen.getByRole('button', { name: 'Login' })

    fireEvent.change(usernameInput, { target: { value: 'testuser' } })
    fireEvent.change(passwordInput, { target: { value: 'password123' } })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(mockOnSuccess).toHaveBeenCalled()
    })
  })

  it('works without onSuccess callback', async () => {
    mockLogin.mockResolvedValue({ user: { id: 1, username: 'testuser' } })

    render(<LoginForm />, { wrapper: createWrapper() })

    const usernameInput = screen.getByLabelText('Username')
    const passwordInput = screen.getByLabelText('Password')
    const submitButton = screen.getByRole('button', { name: 'Login' })

    fireEvent.change(usernameInput, { target: { value: 'testuser' } })
    fireEvent.change(passwordInput, { target: { value: 'password123' } })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalled()
    })

    // Should not throw error when onSuccess is undefined
    expect(mockLogin).toHaveBeenCalledWith({
      username: 'testuser',
      password: 'password123',
    })
  })

  it('has proper accessibility attributes', () => {
    render(<LoginForm />, { wrapper: createWrapper() })

    const usernameInput = screen.getByLabelText('Username')
    const passwordInput = screen.getByLabelText('Password')

    expect(usernameInput).toHaveAttribute('type', 'text')
    expect(usernameInput).toHaveAttribute('required')
    expect(usernameInput).toHaveAttribute('placeholder', 'Enter your username')

    expect(passwordInput).toHaveAttribute('type', 'password')
    expect(passwordInput).toHaveAttribute('required')
    expect(passwordInput).toHaveAttribute('placeholder', 'Enter your password')
  })

  it('maintains form state during loading', () => {
    vi.mocked(useAuth).mockReturnValue({
      login: mockLogin,
      isLoading: true,
      isAuthenticated: false,
      user: null,
      logout: vi.fn(),
    } as any)

    render(<LoginForm />, { wrapper: createWrapper() })

    const usernameInput = screen.getByLabelText('Username')
    const passwordInput = screen.getByLabelText('Password')

    fireEvent.change(usernameInput, { target: { value: 'testuser' } })
    fireEvent.change(passwordInput, { target: { value: 'password123' } })

    // Values should be maintained even during loading state
    expect(usernameInput).toHaveValue('testuser')
    expect(passwordInput).toHaveValue('password123')
  })
})
