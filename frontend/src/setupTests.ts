import '@testing-library/jest-dom'
import { server } from './mocks/server'
import { beforeAll, afterEach, afterAll, beforeEach } from 'vitest'
import { logger } from './services/LoggingService'

// Silence logger in tests — API errors, debug output etc. are not test behavior
logger.setLevel('silent')

// Mock ResizeObserver and IntersectionObserver globally before each test
// These are needed by react-datepicker and infinite scroll components
beforeEach(() => {
  // Mock ResizeObserver
  global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver

  // Mock IntersectionObserver
  global.IntersectionObserver = class IntersectionObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof IntersectionObserver

  // Mock matchMedia — jsdom does not implement it. Default to a non-matching
  // (desktop / light) query; tests that need mobile or dark-mode behavior
  // override window.matchMedia locally.
  if (!window.matchMedia) {
    window.matchMedia = ((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia
  }
})

// Establish API mocking before all tests.
// 'error' rather than 'warn': an unstubbed request 404s, and a component then
// renders its failure branch while the test passes by asserting on something
// else. Failing at the point of introduction is what keeps that from returning.
// Add a base handler in src/mocks/server.ts, or override with server.use().
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))

// Reset any request handlers that we may add during tests,
// so they don't affect other tests
afterEach(() => server.resetHandlers())

// Clean up after tests are finished
afterAll(() => server.close())
