import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import {
  useCreateStagedResultChain,
  useCancelPendingStagedPart,
  useAppendStagedPart,
  useUpdateStagedPartDelay,
  usePublishActionResult,
  usePublishAllPhaseResults,
} from './useActionResults';
import { apiClient } from '../lib/api';

vi.mock('../lib/api', () => ({
  apiClient: {
    phases: {
      createStagedResultChain: vi.fn(),
      cancelPendingStagedPart: vi.fn(),
      appendStagedPart: vi.fn(),
      updateStagedPartDelay: vi.fn(),
      publishActionResult: vi.fn(),
      publishAllPhaseResults: vi.fn(),
    },
  },
}));

const mockedApi = vi.mocked(apiClient.phases);

const GAME_ID = 164;

// Each test gets its own client so invalidation assertions cannot leak between
// tests through shared cache state.
function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { wrapper, queryClient };
}

describe('useCreateStagedResultChain', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('posts the chain as a single request', async () => {
    mockedApi.createStagedResultChain.mockResolvedValue({ data: [] } as never);
    const { wrapper } = makeWrapper();

    const { result } = renderHook(() => useCreateStagedResultChain(GAME_ID), { wrapper });

    const payload = {
      user_id: 7,
      is_published: true,
      parts: [
        { content: 'The sword whooshes toward your head...', delay_minutes: 0 },
        { content: '...and misses!', delay_minutes: 15 },
      ],
    };

    await act(async () => {
      await result.current.mutateAsync(payload);
    });

    // One call, whole chain. Posting part-by-part would leave a partial chain
    // behind if a later request failed.
    expect(mockedApi.createStagedResultChain).toHaveBeenCalledTimes(1);
    expect(mockedApi.createStagedResultChain).toHaveBeenCalledWith(GAME_ID, payload);
  });

  it('preserves part order and per-part delays in the payload', async () => {
    mockedApi.createStagedResultChain.mockResolvedValue({ data: [] } as never);
    const { wrapper } = makeWrapper();

    const { result } = renderHook(() => useCreateStagedResultChain(GAME_ID), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        user_id: 7,
        parts: [
          { content: 'one', delay_minutes: 0 },
          { content: 'two', delay_minutes: 15 },
          { content: 'three', delay_minutes: 30 },
        ],
      });
    });

    const sent = mockedApi.createStagedResultChain.mock.calls[0][1];
    expect(sent.parts.map((p) => p.content)).toEqual(['one', 'two', 'three']);
    // The head releases on publish, so its delay is always 0; later delays are
    // measured from the previous part's reveal.
    expect(sent.parts.map((p) => p.delay_minutes)).toEqual([0, 15, 30]);
  });

  it('refreshes both result lists after creating a chain', async () => {
    mockedApi.createStagedResultChain.mockResolvedValue({ data: [] } as never);
    const { wrapper, queryClient } = makeWrapper();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useCreateStagedResultChain(GAME_ID), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        user_id: 7,
        parts: [{ content: 'one', delay_minutes: 0 }, { content: 'two', delay_minutes: 15 }],
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // The GM's composing view and the player's own list both show the new head.
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['actionResults', 'game', GAME_ID] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['actionResults', 'user', GAME_ID] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['unpublishedResultsCount'] });
  });

  it('surfaces a rejected chain to the caller', async () => {
    // The API returns 400 with a message naming the offending part, which the
    // composer shows to the GM.
    mockedApi.createStagedResultChain.mockRejectedValue(
      Object.assign(new Error('Request failed'), { response: { status: 400 } })
    );
    const { wrapper } = makeWrapper();

    const { result } = renderHook(() => useCreateStagedResultChain(GAME_ID), { wrapper });

    await act(async () => {
      await result.current
        .mutateAsync({ user_id: 7, parts: [{ content: 'only one', delay_minutes: 0 }] })
        .catch(() => undefined);
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('publishing', () => {
  beforeEach(() => vi.clearAllMocks());

  it('one result: refreshes the draft count and the sheets the board reads', async () => {
    mockedApi.publishActionResult.mockResolvedValue({ data: {} } as never);
    const { wrapper, queryClient } = makeWrapper();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHook(() => usePublishActionResult(GAME_ID), { wrapper });
    await act(async () => {
      await result.current.mutateAsync(42);
    });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['unpublishedResultsCount'] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['gameCharacterData', GAME_ID] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['phaseDraftUpdates', GAME_ID] });
  });

  it('a whole phase: refreshes the sheets the board reads', async () => {
    mockedApi.publishAllPhaseResults.mockResolvedValue({ data: {} } as never);
    const { wrapper, queryClient } = makeWrapper();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHook(() => usePublishAllPhaseResults(GAME_ID, 3), { wrapper });
    await act(async () => {
      await result.current.mutateAsync();
    });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['gameCharacterData', GAME_ID] });
  });
});

describe('useCancelPendingStagedPart', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('cancels by result id', async () => {
    mockedApi.cancelPendingStagedPart.mockResolvedValue({ data: undefined } as never);
    const { wrapper } = makeWrapper();

    const { result } = renderHook(() => useCancelPendingStagedPart(GAME_ID), { wrapper });

    await act(async () => {
      await result.current.mutateAsync(42);
    });

    expect(mockedApi.cancelPendingStagedPart).toHaveBeenCalledWith(GAME_ID, 42);
  });

  it('refreshes the results first, so the card never asks for the cancelled part’s count', async () => {
    mockedApi.cancelPendingStagedPart.mockResolvedValue({ data: undefined } as never);
    const { wrapper, queryClient } = makeWrapper();
    let finishResults = () => {};
    const resultsRefreshed = new Promise<void>((resolve) => { finishResults = resolve; });
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries').mockImplementation(((filters: { queryKey: unknown[] }) =>
      filters.queryKey[0] === 'actionResults' && filters.queryKey[1] === 'game' ? resultsRefreshed : Promise.resolve()) as never);

    const { result } = renderHook(() => useCancelPendingStagedPart(GAME_ID), { wrapper });
    act(() => result.current.mutate(42));

    await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: ['actionResults', 'game', GAME_ID] }));
    expect(invalidate).not.toHaveBeenCalledWith(expect.objectContaining({ queryKey: ['draftUpdateCount', GAME_ID] }));

    finishResults();
    await waitFor(() => expect(invalidate).toHaveBeenCalledWith(expect.objectContaining({ queryKey: ['draftUpdateCount', GAME_ID] })));
  });

  it('refreshes the counts of the parts that are left, not of the one cancelled', async () => {
    mockedApi.cancelPendingStagedPart.mockResolvedValue({ data: undefined } as never);
    const { wrapper, queryClient } = makeWrapper();
    queryClient.setQueryData(['actionResults', 'game', GAME_ID], [{ id: 41 }]);
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useCancelPendingStagedPart(GAME_ID), { wrapper });
    await act(async () => {
      await result.current.mutateAsync(42);
    });

    const call = invalidate.mock.calls.find(([filters]) => filters?.queryKey?.[0] === 'draftUpdateCount');
    const refreshes = (id: number) => call?.[0]?.predicate?.({ queryKey: ['draftUpdateCount', GAME_ID, id] } as never);
    expect(refreshes(41)).toBe(true);
    expect(refreshes(42)).toBe(false);
  });

  it('refreshes the result lists, the unpublished count and the sheet update counts', async () => {
    mockedApi.cancelPendingStagedPart.mockResolvedValue({ data: undefined } as never);
    const { wrapper, queryClient } = makeWrapper();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useCancelPendingStagedPart(GAME_ID), { wrapper });

    await act(async () => {
      await result.current.mutateAsync(42);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['actionResults', 'game', GAME_ID] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['actionResults', 'user', GAME_ID] });

    // A draft part counts as unpublished, and its sheet updates just moved.
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['unpublishedResultsCount'] });
    expect(invalidate).toHaveBeenCalledWith(expect.objectContaining({ queryKey: ['draftUpdateCount', GAME_ID] }));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['phaseDraftUpdates', GAME_ID] });
  });
});

describe('useAppendStagedPart', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('appends to the named result', async () => {
    mockedApi.appendStagedPart.mockResolvedValue({ data: {} } as never);
    const { wrapper } = makeWrapper();

    const { result } = renderHook(() => useAppendStagedPart(GAME_ID), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        resultId: 42,
        part: { content: 'and misses!', delay_minutes: 15 },
      });
    });

    expect(mockedApi.appendStagedPart).toHaveBeenCalledWith(GAME_ID, 42, {
      content: 'and misses!',
      delay_minutes: 15,
    });
  });

  it('refreshes the unpublished count, unlike cancel', async () => {
    mockedApi.appendStagedPart.mockResolvedValue({ data: {} } as never);
    const { wrapper, queryClient } = makeWrapper();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useAppendStagedPart(GAME_ID), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        resultId: 42,
        part: { content: 'and misses!', delay_minutes: 15 },
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['actionResults', 'game', GAME_ID] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['actionResults', 'user', GAME_ID] });

    // Appending writes a new UNPUBLISHED row, so the GM's "N results waiting"
    // badge is now stale. This is the asymmetry with cancel, which removes an
    // already-published row and correctly leaves the count alone.
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['unpublishedResultsCount'] });
  });
});

describe('useUpdateStagedPartDelay', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('retimes by result id', async () => {
    mockedApi.updateStagedPartDelay.mockResolvedValue({ data: {} } as never);
    const { wrapper } = makeWrapper();

    const { result } = renderHook(() => useUpdateStagedPartDelay(GAME_ID), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ resultId: 42, delayMinutes: 30 });
    });

    expect(mockedApi.updateStagedPartDelay).toHaveBeenCalledWith(GAME_ID, 42, 30);
  });

  // The player-facing invalidation here is load-bearing, not incidental.
  // Retiming a part that is already PUBLISHED but still pending changes the
  // unlocks_at that the recipient's countdown is rendering right now. Drop this
  // key and the player keeps counting down to the old time and sees "Unlocking…"
  // hang, with nothing to tell them the deadline moved.
  it('refreshes the player list so a live countdown is not left on the old time', async () => {
    mockedApi.updateStagedPartDelay.mockResolvedValue({ data: {} } as never);
    const { wrapper, queryClient } = makeWrapper();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useUpdateStagedPartDelay(GAME_ID), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ resultId: 42, delayMinutes: 30 });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['actionResults', 'user', GAME_ID] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['actionResults', 'game', GAME_ID] });

    // A retime never changes how many results are waiting to be published.
    expect(invalidate).not.toHaveBeenCalledWith({ queryKey: ['unpublishedResultsCount'] });
  });
});
