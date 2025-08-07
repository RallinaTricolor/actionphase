import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement } from 'react'
import { useAuth, usePing } from '../useAuth'

// Mock the API clients
vi.mock('../../lib/api', () => ({
  apiClient: {
    login: vi.fn(),
    register: vi.fn(),
    setAuthToken: vi.fn(),
    removeAuthToken: vi.fn(),
    getAuthToken: vi.fn(),
  },
}))

vi.mock('../../lib/simple-api', () => ({
  simpleApi: {
    ping: vi.fn(),
  },
}))

import { apiClient } from '../../lib/api'
import { simpleApi } from '../../lib/simple-api'

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })

  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children)
}

describe('useAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return isAuthenticated false when no token', async () => {
    vi.mocked(apiClient.getAuthToken).mockReturnValue(null)

    const { result } = renderHook(() => useAuth(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(false)
    })
  })

  it('should return isAuthenticated true when token exists', async () => {
    vi.mocked(apiClient.getAuthToken).mockReturnValue('test-token')

    const { result } = renderHook(() => useAuth(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(true)
    })
  })

  it('should clear token on logout', async () => {
    const { result } = renderHook(() => useAuth(), {
      wrapper: createWrapper(),
    })

    result.current.logout()

    expect(apiClient.removeAuthToken).toHaveBeenCalled()
  })
})

describe('usePing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should call ping API', async () => {
    vi.mocked(simpleApi.ping).mockResolvedValue({ success: true })

    const { result } = renderHook(() => usePing(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(simpleApi.ping).toHaveBeenCalled()
  })
})
