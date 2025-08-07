import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BackendStatus } from '../BackendStatus'

// Mock the useAuth hook
vi.mock('../../hooks/useAuth', () => ({
  usePing: vi.fn(),
}))

// Import the mocked hook
import { usePing } from '../../hooks/useAuth'

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

describe('BackendStatus', () => {
  it('shows loading state', () => {
    vi.mocked(usePing).mockReturnValue({
      isLoading: true,
      error: null,
      data: undefined,
      isError: false,
      isSuccess: false,
    } as any)

    render(<BackendStatus />, { wrapper: createWrapper() })

    expect(screen.getByText('Backend Status: Checking...')).toBeInTheDocument()
  })

  it('shows online state', () => {
    vi.mocked(usePing).mockReturnValue({
      isLoading: false,
      error: null,
      data: { success: true },
      isError: false,
      isSuccess: true,
    } as any)

    render(<BackendStatus />, { wrapper: createWrapper() })

    expect(screen.getByText('Backend Status: Online')).toBeInTheDocument()
  })

  it('shows offline state with error message', () => {
    vi.mocked(usePing).mockReturnValue({
      isLoading: false,
      error: new Error('Network error'),
      data: undefined,
      isError: true,
      isSuccess: false,
    } as any)

    render(<BackendStatus />, { wrapper: createWrapper() })

    expect(screen.getByText('Backend Status: Offline')).toBeInTheDocument()
    expect(screen.getByText('Make sure the Go backend is running on port 3000')).toBeInTheDocument()
  })
})
