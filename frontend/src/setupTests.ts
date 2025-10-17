import '@testing-library/jest-dom'
import { server } from './mocks/server'

// Establish API mocking before all tests
beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }))

// Reset any request handlers that we may add during tests,
// so they don't affect other tests
afterEach(() => server.resetHandlers())

// Clean up after tests are finished
afterAll(() => server.close())
