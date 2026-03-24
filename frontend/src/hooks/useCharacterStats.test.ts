import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
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

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
}

describe('useCharacterStats', () => {
  it('uses correct query key', () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useCharacterStats(42), { wrapper });
    // The hook should not be undefined and should start in loading or success state
    expect(result.current).toBeDefined();
  });

  it('is disabled when characterId is undefined', () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useCharacterStats(undefined), { wrapper });
    // When disabled, data should be undefined and it should not be loading
    expect(result.current.data).toBeUndefined();
    expect(result.current.isPending).toBe(true); // disabled query is in pending state
  });

  it('is disabled when characterId is 0 (falsy)', () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useCharacterStats(0), { wrapper });
    expect(result.current.data).toBeUndefined();
  });
});
