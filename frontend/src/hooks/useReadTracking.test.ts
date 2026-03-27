import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import {
  useManualReadCommentIDs,
  usePostManualReadCommentIDs,
  useToggleCommentRead,
} from './useReadTracking';

const mockGetManualReadCommentIDs = vi.fn();
const mockToggleCommentRead = vi.fn();

vi.mock('../lib/api', () => ({
  apiClient: {
    messages: {
      getManualReadCommentIDs: (...args: unknown[]) => mockGetManualReadCommentIDs(...args),
      toggleCommentRead: (...args: unknown[]) => mockToggleCommentRead(...args),
    },
  },
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
}

describe('useManualReadCommentIDs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetManualReadCommentIDs.mockResolvedValue({
      data: [{ post_id: 1, read_comment_ids: [5, 12] }],
    });
  });

  it('is disabled when gameId is undefined', () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useManualReadCommentIDs(undefined), { wrapper });
    expect(result.current.data).toBeUndefined();
    expect(result.current.isPending).toBe(true);
  });

  it('fetches data for a valid gameId', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useManualReadCommentIDs(1), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockGetManualReadCommentIDs).toHaveBeenCalledWith(1);
    expect(result.current.data).toEqual([{ post_id: 1, read_comment_ids: [5, 12] }]);
  });
});

describe('usePostManualReadCommentIDs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetManualReadCommentIDs.mockResolvedValue({
      data: [
        { post_id: 1, read_comment_ids: [5, 12] },
        { post_id: 2, read_comment_ids: [33] },
      ],
    });
  });

  it('returns empty array when postId is undefined', () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => usePostManualReadCommentIDs(1, undefined), { wrapper });
    expect(result.current).toEqual([]);
  });

  it('filters read IDs for the specified post', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => usePostManualReadCommentIDs(1, 1), { wrapper });

    await waitFor(() => expect(result.current).toEqual([5, 12]));
  });

  it('returns empty array when post has no read entries', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => usePostManualReadCommentIDs(1, 99), { wrapper });

    await waitFor(() => expect(result.current).toEqual([]));
  });
});

describe('useToggleCommentRead', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockToggleCommentRead.mockResolvedValue({ data: null });
    // Also mock getManualReadCommentIDs so invalidation doesn't break
    mockGetManualReadCommentIDs.mockResolvedValue({ data: [] });
  });

  it('calls toggleCommentRead API with correct arguments', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useToggleCommentRead(), { wrapper });

    result.current.mutate({ gameId: 1, postId: 2, commentId: 42, read: true });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockToggleCommentRead).toHaveBeenCalledWith(1, 2, 42, true);
  });
});
