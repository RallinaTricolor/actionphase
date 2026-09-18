import '@testing-library/jest-dom'
import { server } from './mocks/server'
import { beforeAll, afterEach, afterAll, beforeEach, vi } from 'vitest'
import { logger } from './services/LoggingService'

// FingerprintJS probes canvas and WebGL, which jsdom does not implement, so the
// real library floods the output with "Not implemented:
// HTMLCanvasElement.prototype.getContext". It degrades gracefully in the app
// (getDeviceFingerprint catches and returns null), so the errors are noise
// rather than a failure -- but noise that hides real ones.
//
// Mocked here rather than per-file because any test that renders a login or
// register path pulls it in transitively. A test that asserts on the
// fingerprint value overrides this with its own vi.mock.
vi.mock('./lib/fingerprint', () => ({
  getDeviceFingerprint: vi.fn().mockResolvedValue('test-device-fingerprint'),
}))

// Silence logger in tests — API errors, debug output etc. are not test behavior
logger.setLevel('silent')

// jsdom does not implement the Web Animations API. Headless UI installs its own
// getAnimations polyfill when it finds none, and that one warns on every call.
// Defining it first means Headless UI leaves it alone.
//
// [] is the correct answer here, not a placeholder: Headless UI filters the
// result for in-flight CSSTransitions to decide when a transition has finished,
// and jsdom runs no CSS transitions, so "none in flight" completes them
// immediately. Must be module scope, not beforeEach -- Headless UI checks at
// import time. A test needing real animation timing would want jsdom-testing-mocks.
if (!Element.prototype.getAnimations) {
  Element.prototype.getAnimations = function () {
    return []
  }
}

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
