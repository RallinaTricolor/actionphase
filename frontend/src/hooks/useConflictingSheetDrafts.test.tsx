import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { makeActionResult, makeAxiosResponse } from '@/test-utils/factories';
import type { ActionResult } from '@/types/phases';
import { apiClient } from '../lib/api';
import { useConflictingSheetDrafts, usePhaseSheetDraftConflicts } from './useConflictingSheetDrafts';

vi.mock('../lib/api', () => ({ apiClient: { phases: { getDraftUpdateCount: vi.fn(), getGameResults: vi.fn() } } }));
const api = vi.mocked(apiClient.phases);

const GAME_ID = 7;
const PHASE_ID = 3;
const row = (id: number, parent?: number): ActionResult =>
  makeActionResult({ id, game_id: GAME_ID, phase_id: PHASE_ID, character_id: 1, is_published: false, parent_result_id: parent });

/** Sheet updates sit on these results. */
function withUpdatesOn(...ids: number[]) {
  api.getDraftUpdateCount.mockImplementation(async (_game, resultId) => makeAxiosResponse({ count: ids.includes(resultId) ? 1 : 0 }) as never);
}

function makeWrapper(results: ActionResult[]) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  queryClient.setQueryData(['actionResults', 'game', GAME_ID], results);
  api.getGameResults.mockResolvedValue(makeAxiosResponse(results) as never);
  return ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe('sheet update conflicts', () => {
  beforeEach(() => vi.clearAllMocks());

  const twoParts = [row(10), row(11, 10), row(12, 11)];

  it('never counts another part of the same result', async () => {
    withUpdatesOn(10, 12);
    const { result } = renderHook(() => useConflictingSheetDrafts(GAME_ID, twoParts[2], twoParts), { wrapper: makeWrapper(twoParts) });
    expect(result.current.hasConflict).toBe(false);
    expect(api.getDraftUpdateCount).not.toHaveBeenCalled();
  });

  it('counts a separate result for the same character', async () => {
    withUpdatesOn(12, 20);
    const list = [...twoParts, row(20)];
    const { result } = renderHook(() => useConflictingSheetDrafts(GAME_ID, twoParts[2], list), { wrapper: makeWrapper(list) });
    await waitFor(() => expect(result.current.conflictCount).toBe(1));
    expect(api.getDraftUpdateCount).toHaveBeenCalledWith(GAME_ID, 20);
    expect(api.getDraftUpdateCount).not.toHaveBeenCalledWith(GAME_ID, 10);
  });

  it('Publish all: parts of one result are one, two results conflict', async () => {
    withUpdatesOn(10, 12);
    const one = renderHook(() => usePhaseSheetDraftConflicts(GAME_ID, PHASE_ID), { wrapper: makeWrapper(twoParts) });
    await waitFor(() => expect(api.getDraftUpdateCount).toHaveBeenCalledTimes(3));
    await waitFor(() => expect(one.result.current.hasConflict).toBe(false));

    withUpdatesOn(12, 20);
    const two = renderHook(() => usePhaseSheetDraftConflicts(GAME_ID, PHASE_ID), { wrapper: makeWrapper([...twoParts, row(20)]) });
    await waitFor(() => expect(two.result.current.affectedCharacterCount).toBe(1));
  });
});
