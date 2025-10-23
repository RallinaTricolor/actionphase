import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock localStorage first
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
}
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
})

// Mock console to avoid test output noise
const mockConsole = {
  error: vi.fn(),
  log: vi.fn(),
}
Object.defineProperty(console, 'error', { value: mockConsole.error })
Object.defineProperty(console, 'log', { value: mockConsole.log })

// Mock window.location
const mockLocation = {
  pathname: '/',
  href: '',
}
Object.defineProperty(window, 'location', {
  value: mockLocation,
  writable: true,
})

// Simple test just to verify our comprehensive test coverage is working
// The actual API testing would require more complex mocking that might not be worth the setup complexity
describe('API Client - Basic Functionality', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorageMock.getItem.mockReturnValue(null)
  })

  it('should have API client available', async () => {
    // This just verifies that the API client module can be loaded
    // The actual HTTP functionality testing would be integration tests
    const { apiClient } = await import('../api')

    expect(apiClient).toBeDefined()
    expect(typeof apiClient.auth.login).toBe('function')
    expect(typeof apiClient.auth.register).toBe('function')
    expect(typeof apiClient.games.getAllGames).toBe('function')
    expect(typeof apiClient.getAuthToken).toBe('function')
    expect(typeof apiClient.setAuthToken).toBe('function')
    expect(typeof apiClient.removeAuthToken).toBe('function')
  })

  it('should handle token utility methods', async () => {
    const { apiClient } = await import('../api')

    // Test getAuthToken when no token exists
    localStorageMock.getItem.mockReturnValue(null)
    expect(apiClient.getAuthToken()).toBeNull()

    // Test getAuthToken when token exists
    localStorageMock.getItem.mockReturnValue('test-token')
    expect(apiClient.getAuthToken()).toBe('test-token')

    // Test removeAuthToken
    apiClient.removeAuthToken()
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('auth_token')

    // Test setAuthToken with valid token
    apiClient.setAuthToken('valid-token')
    expect(localStorageMock.setItem).toHaveBeenCalledWith('auth_token', 'valid-token')

    // Test setAuthToken with invalid token
    apiClient.setAuthToken('')
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('auth_token')
    expect(mockConsole.error).toHaveBeenCalledWith('Attempted to set invalid token:', '')
  })
})
