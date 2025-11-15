import '@testing-library/jest-dom'
import { server } from './mocks/server'
import { vi, beforeAll, afterEach, afterAll, beforeEach } from 'vitest'

// Mock ResizeObserver and IntersectionObserver globally before each test
// These are needed by react-datepicker and infinite scroll components
beforeEach(() => {
  // Mock ResizeObserver
  global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as any

  // Mock IntersectionObserver
  global.IntersectionObserver = class IntersectionObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as any
})

// Establish API mocking before all tests
beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }))

// Reset any request handlers that we may add during tests,
// so they don't affect other tests
afterEach(() => server.resetHandlers())

// Clean up after tests are finished
afterAll(() => server.close())
