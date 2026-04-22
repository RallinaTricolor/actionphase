import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchCommentWithParents } from '../threadUtils';
import { apiClient } from '../../lib/api';
import { AxiosError } from 'axios';
import type { AxiosResponse } from 'axios';
import type { Message } from '../../types/messages';

function mockResponse<T>(data: T): AxiosResponse<T> {
  return { data } as AxiosResponse<T>;
}

// Mock the API client
vi.mock('../../lib/api', () => ({
  apiClient: {
    messages: {
      getMessage: vi.fn(),
    },
  },
}));

// Mock logger
vi.mock('@/services/LoggingService', () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

const mockMessage: Message = {
  id: 123,
  game_id: 1,
  phase_id: 1,
  character_id: 2,
  character_name: 'Test Character',
  content: 'Test comment',
  message_type: 'comment',
  parent_id: 100,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

const mockParentMessage: Message = {
  id: 100,
  game_id: 1,
  phase_id: 1,
  character_id: 1,
  character_name: 'Parent Character',
  content: 'Parent comment',
  message_type: 'comment',
  parent_id: null, // Root comment
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

describe('threadUtils - Retry Logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('fetchCommentWithParents', () => {
    it('fetches comment successfully on first attempt', async () => {
      const getMessageMock = vi.mocked(apiClient.messages.getMessage);
      getMessageMock
        .mockResolvedValueOnce(mockResponse(mockMessage))
        .mockResolvedValueOnce(mockResponse(mockParentMessage));

      const promise = fetchCommentWithParents(1, 123, 3);

      // Advance timers to resolve promises
      await vi.runAllTimersAsync();

      const result = await promise;

      expect(result.messages).toHaveLength(2);
      expect(result.messages[0].id).toBe(100); // Parent first
      expect(result.messages[1].id).toBe(123); // Child last
      expect(result.hasFullThread).toBe(true);
      expect(getMessageMock).toHaveBeenCalledTimes(2);
    });

    it('retries on transient error (500) and succeeds', async () => {
      const getMessageMock = vi.mocked(apiClient.messages.getMessage);

      // First call: 500 error
      const error500 = new AxiosError('Server error');
      error500.response = { status: 500, data: {} } as AxiosError['response'];

      // Second call (retry): Success
      getMessageMock
        .mockRejectedValueOnce(error500)
        .mockResolvedValueOnce(mockResponse(mockMessage))
        .mockResolvedValueOnce(mockResponse(mockParentMessage));

      const promise = fetchCommentWithParents(1, 123, 3);

      // Advance timers for first retry delay (100ms)
      await vi.advanceTimersByTimeAsync(100);

      // Advance timers to complete all promises
      await vi.runAllTimersAsync();

      const result = await promise;

      expect(result.messages).toHaveLength(2);
      expect(getMessageMock).toHaveBeenCalledTimes(3); // 1 fail + 1 success + 1 parent fetch
    });

    it('fast-fails on 404 without retrying', async () => {
      const getMessageMock = vi.mocked(apiClient.messages.getMessage);

      // Create 404 error
      const error404 = new AxiosError('Not found');
      error404.response = { status: 404, data: {} } as AxiosError['response'];

      getMessageMock.mockRejectedValueOnce(error404);

      const promise = fetchCommentWithParents(1, 123, 3);

      // Advance timers
      await vi.runAllTimersAsync();

      const result = await promise;

      // Should return empty array and not have full thread
      expect(result.messages).toHaveLength(0);
      expect(result.hasFullThread).toBe(false);
      expect(getMessageMock).toHaveBeenCalledTimes(1); // No retries on 404
    });

    it('uses exponential backoff for retries', async () => {
      const getMessageMock = vi.mocked(apiClient.messages.getMessage);

      // Create network error (no response)
      const networkError = new AxiosError('Network error');

      // Fail twice, then succeed
      getMessageMock
        .mockRejectedValueOnce(networkError)
        .mockRejectedValueOnce(networkError)
        .mockResolvedValueOnce(mockResponse(mockMessage))
        .mockResolvedValueOnce(mockResponse(mockParentMessage));

      const promise = fetchCommentWithParents(1, 123, 3);

      // First retry after 100ms
      await vi.advanceTimersByTimeAsync(100);

      // Second retry after 200ms
      await vi.advanceTimersByTimeAsync(200);

      // Complete remaining promises
      await vi.runAllTimersAsync();

      const result = await promise;

      expect(result.messages).toHaveLength(2);
      expect(getMessageMock).toHaveBeenCalledTimes(4); // 2 fails + 1 success + 1 parent fetch
    });

    it('gives up after max retries and returns partial results', async () => {
      const getMessageMock = vi.mocked(apiClient.messages.getMessage);

      // Create persistent network error
      const networkError = new AxiosError('Network error');

      // Fail all attempts for first message
      getMessageMock
        .mockRejectedValueOnce(networkError)
        .mockRejectedValueOnce(networkError)
        .mockRejectedValueOnce(networkError);

      const promise = fetchCommentWithParents(1, 123, 3);

      // Advance through all retry delays
      await vi.advanceTimersByTimeAsync(100); // First retry
      await vi.advanceTimersByTimeAsync(200); // Second retry
      await vi.runAllTimersAsync();

      const result = await promise;

      // Should return empty array after all retries fail
      expect(result.messages).toHaveLength(0);
      expect(result.hasFullThread).toBe(false);
      expect(getMessageMock).toHaveBeenCalledTimes(3); // 3 attempts (initial + 2 retries)
    });

    it('handles partial parent chain when middle message fails', async () => {
      const getMessageMock = vi.mocked(apiClient.messages.getMessage);


      // First message succeeds, parent fails
      const error500 = new AxiosError('Server error');
      error500.response = { status: 500, data: {} } as AxiosError['response'];

      getMessageMock
        .mockResolvedValueOnce(mockResponse(mockMessage)) // Child succeeds
        .mockRejectedValueOnce(error500) // Parent fails attempt 1
        .mockRejectedValueOnce(error500) // Parent fails attempt 2
        .mockRejectedValueOnce(error500); // Parent fails attempt 3

      const promise = fetchCommentWithParents(1, 123, 3);

      // Advance through retry delays
      await vi.advanceTimersByTimeAsync(100);
      await vi.advanceTimersByTimeAsync(200);
      await vi.runAllTimersAsync();

      const result = await promise;

      // Should return only the first message (parent chain broken)
      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].id).toBe(123);
      expect(result.hasFullThread).toBe(false); // Doesn't have full thread (parent missing)
    });

    it('does not retry 403 errors', async () => {
      const getMessageMock = vi.mocked(apiClient.messages.getMessage);

      // Create 403 error
      const error403 = new AxiosError('Forbidden');
      error403.response = { status: 403, data: {} } as AxiosError['response'];

      getMessageMock.mockRejectedValueOnce(error403);

      const promise = fetchCommentWithParents(1, 123, 3);

      await vi.runAllTimersAsync();

      const result = await promise;

      // Should return empty array without retries
      expect(result.messages).toHaveLength(0);
      expect(getMessageMock).toHaveBeenCalledTimes(1); // No retries on 403
    });

    it('retries on timeout errors', async () => {
      const getMessageMock = vi.mocked(apiClient.messages.getMessage);

      // Create timeout error (code ECONNABORTED or no response)
      const timeoutError = new AxiosError('timeout');
      timeoutError.code = 'ECONNABORTED';

      getMessageMock
        .mockRejectedValueOnce(timeoutError)
        .mockResolvedValueOnce(mockResponse(mockMessage))
        .mockResolvedValueOnce(mockResponse(mockParentMessage));

      const promise = fetchCommentWithParents(1, 123, 3);

      // Advance through retry delay
      await vi.advanceTimersByTimeAsync(100);
      await vi.runAllTimersAsync();

      const result = await promise;

      expect(result.messages).toHaveLength(2);
      expect(getMessageMock).toHaveBeenCalledTimes(3); // 1 fail + 1 success + 1 parent fetch
    });

    it('respects maxDepth parameter when fetching parent chain', async () => {
      const getMessageMock = vi.mocked(apiClient.messages.getMessage);

      const msg1: Message = { ...mockMessage, id: 1, parent_id: 2 };
      const msg2: Message = { ...mockMessage, id: 2, parent_id: 3 };

      getMessageMock
        .mockResolvedValueOnce(mockResponse(msg1))
        .mockResolvedValueOnce(mockResponse(msg2));

      const promise = fetchCommentWithParents(1, 1, 1); // maxDepth = 1

      await vi.runAllTimersAsync();

      const result = await promise;

      // Should only fetch 2 messages (depth 0 and 1)
      expect(result.messages).toHaveLength(2);
      expect(result.hasFullThread).toBe(false); // Didn't reach root
      expect(getMessageMock).toHaveBeenCalledTimes(2);
    });
  });
});
