import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import { useSetCharacterHidden } from './useCharacters';

vi.mock('../lib/api', () => ({
  apiClient: {
    characters: {
      setCharacterHidden: vi.fn().mockResolvedValue({
        data: { id: 42, name: 'Masked Informant', is_hidden: true },
      }),
    },
  },
}));

import { apiClient } from '../lib/api';

function createHarness() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
  return { queryClient, wrapper };
}

describe('useSetCharacterHidden', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls the API with the character id and the new hidden state', async () => {
    const { wrapper } = createHarness();
    const { result } = renderHook(() => useSetCharacterHidden(), { wrapper });

    result.current.mutate({ characterId: 42, isHidden: true, gameId: 7 });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiClient.characters.setCharacterHidden).toHaveBeenCalledWith(42, true);
  });

  it('passes through a reveal as well as a hide', async () => {
    const { wrapper } = createHarness();
    const { result } = renderHook(() => useSetCharacterHidden(), { wrapper });

    result.current.mutate({ characterId: 42, isHidden: false, gameId: 7 });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiClient.characters.setCharacterHidden).toHaveBeenCalledWith(42, false);
  });

  it('invalidates the game roster so every consumer of allCharacters refreshes', async () => {
    const { queryClient, wrapper } = createHarness();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useSetCharacterHidden(), { wrapper });
    result.current.mutate({ characterId: 42, isHidden: true, gameId: 7 });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // gameCharacters is what GameContext exposes as allCharacters, and is the
    // single source behind the roster, the mention autocomplete and the
    // new-conversation participant list. Without this the NPC stays on screen
    // until a reload.
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['gameCharacters', 7] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['character', 42] });
  });

  it('skips the game-scoped invalidations when no gameId is supplied', async () => {
    const { queryClient, wrapper } = createHarness();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useSetCharacterHidden(), { wrapper });
    result.current.mutate({ characterId: 42, isHidden: true });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['character', 42] });
    expect(invalidate).not.toHaveBeenCalledWith({ queryKey: ['gameCharacters', undefined] });
  });
});
