import React from 'react'
import { render, RenderOptions } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, MemoryRouterProps } from 'react-router-dom'
import { AuthProvider } from '../contexts/AuthContext'
import { AdminModeProvider } from '../contexts/AdminModeContext'
import { ToastProvider } from '../contexts/ToastContext'
import { ConversationProvider } from '../contexts/ConversationContext'
import { GameProvider } from '../contexts/GameContext'

interface RenderWithProvidersOptions extends Omit<RenderOptions, 'wrapper'> {
  /**
   * Query client instance to use for testing
   * If not provided, a new instance with default test config will be created
   */
  queryClient?: QueryClient

  /**
   * Initial route for MemoryRouter
   * Default: '/'
   */
  initialRoute?: string

  /**
   * Additional routes for MemoryRouter
   */
  initialEntries?: MemoryRouterProps['initialEntries']

  /**
   * When provided, wraps children in a GameProvider with this gameId.
   * Required for components that call useGameContext().
   */
  gameId?: number
}

/**
 * Creates a new QueryClient with test-friendly defaults
 */
export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Disable retries in tests to fail fast
        retry: false,
        // Disable cache to ensure fresh data in each test
        gcTime: 0,
        staleTime: 0,
      },
      mutations: {
        // Disable retries in tests
        retry: false,
      },
    },
    // Suppress error logs during tests
    logger: {
      // eslint-disable-next-line no-console
      log: console.log,
      // eslint-disable-next-line no-console
      warn: console.warn,
      error: () => {}, // Suppress error logs in tests
    },
  })
}

/**
 * Renders a component with all necessary providers for testing:
 * - QueryClientProvider (React Query)
 * - MemoryRouter (React Router)
 * - AuthProvider (Authentication context)
 * - AdminModeProvider (Admin mode context)
 * - ToastProvider (Toast notifications)
 * - ConversationProvider (Conversation context)
 *
 * @example
 * ```tsx
 * const { getByText } = renderWithProviders(<MyComponent />, {
 *   initialRoute: '/games/1',
 * })
 * ```
 */
export function renderWithProviders(
  ui: React.ReactElement,
  options: RenderWithProvidersOptions = {}
) {
  const {
    queryClient = createTestQueryClient(),
    initialRoute = '/',
    initialEntries = [initialRoute],
    gameId,
    ...renderOptions
  } = options

  function Wrapper({ children }: { children: React.ReactNode }) {
    const inner = gameId !== undefined ? (
      <GameProvider gameId={gameId}>{children}</GameProvider>
    ) : children

    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={initialEntries}>
          <ToastProvider>
            <AuthProvider>
              <ConversationProvider>
                <AdminModeProvider>
                    {inner}
                </AdminModeProvider>
              </ConversationProvider>
            </AuthProvider>
          </ToastProvider>
        </MemoryRouter>
      </QueryClientProvider>
    )
  }

  return {
    ...render(ui, { wrapper: Wrapper, ...renderOptions }),
    queryClient,
  }
}

/**
 * Renders a component with providers but without AuthProvider
 * Useful for testing auth-related components in isolation
 */
export function renderWithQueryClient(
  ui: React.ReactElement,
  options: Omit<RenderWithProvidersOptions, 'initialRoute'> = {}
) {
  const { queryClient = createTestQueryClient(), ...renderOptions } = options

  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    )
  }

  return {
    ...render(ui, { wrapper: Wrapper, ...renderOptions }),
    queryClient,
  }
}

// Re-export everything from @testing-library/react
// eslint-disable-next-line react-refresh/only-export-components
export * from '@testing-library/react'
