import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import { useCharacterStats } from './useCharacterStats';

vi.mock('../lib/api', () => ({
  apiClient: {
    characters: {
      getCharacterStats: vi.fn().mockResolvedValue({
        data: { public_messages: 5, private_messages: 2 },
      }),
    },
  },
}));

import { apiClient } from '../lib/api';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
}

describe('useCharacterStats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns stats data when characterId is provided', async () => {
    const { result } = renderHook(() => useCharacterStats(42), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual({ public_messages: 5, private_messages: 2 });
    expect(apiClient.characters.getCharacterStats).toHaveBeenCalledWith(42);
  });

  it('does not fetch when characterId is undefined', () => {
    const { result } = renderHook(() => useCharacterStats(undefined), {
      wrapper: createWrapper(),
    });

    // Query is disabled — stays pending without fetching
    expect(result.current.data).toBeUndefined();
    expect(result.current.isPending).toBe(true);
    expect(apiClient.characters.getCharacterStats).not.toHaveBeenCalled();
  });

  it('does not fetch when characterId is 0', () => {
    const { result } = renderHook(() => useCharacterStats(0), {
      wrapper: createWrapper(),
    });

    expect(result.current.data).toBeUndefined();
    expect(apiClient.characters.getCharacterStats).not.toHaveBeenCalled();
  });
});
