import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError, AxiosHeaders } from 'axios';
import React from 'react';
import { makeActionResult, makeAxiosResponse, makeBoard } from '@/test-utils/factories';
import type { BoardDoc, GameBoardSettings, RewardLine } from '@/lib/gmBoard/types';
import type { ActionResult, DraftCharacterUpdate } from '@/types/phases';
import { apiClient } from '../lib/api';
import { REWARD_SYNC_DELAY_MS, usePhaseRewards } from './usePhaseRewards';

vi.mock('../lib/api', () => ({
  apiClient: {
    phases: { getGameResults: vi.fn(), listPhaseDraftCharacterUpdates: vi.fn(), replaceRewardSheetUpdates: vi.fn() },
    characters: { getGameCharacterData: vi.fn() },
  },
}));

const boardUpdate = vi.fn();
const settings: GameBoardSettings = {
  codex: [], names: {}, rewardTemplate: '{{lines result}}', rewardGroups: [{ key: 'result', label: 'Result' }], scales: [], secondPerson: true, rewardItems: [], notes: '',
};
vi.mock('./useGmBoard', () => ({
  useGmSettings: () => ({ settings }),
  useGmBoardStore: () => ({ update: boardUpdate, remove: vi.fn() }),
  useGmSettingsStore: () => ({ update: vi.fn(), remove: vi.fn() }),
}));
vi.mock('@/contexts/GameContext', () => ({
  useGameContext: () => ({ game: null, allGameCharacters: [{ id: 3, name: 'Vex' }] }),
}));

const api = vi.mocked(apiClient.phases);
const chars = vi.mocked(apiClient.characters);

const PHASE = 20;
const rating: RewardLine = { id: 'l1', group: 'result', text: 'Rating +1', ops: [{ act: 'inc', tab: 'numbers', entry: 'Rating', by: 1 }], choose: false };
const sheet = { 3: [{ id: 1, character_id: 3, module_type: 'numbers', field_name: 'numbers', field_value: JSON.stringify([{ id: 'n', name: 'Rating', amount: { value: 2 } }]), field_type: 'json' }] };
const expected = JSON.stringify([{ id: 'n', name: 'Rating', amount: { value: 3 } }]);
const draftResult = makeActionResult({ id: 40, phase_id: PHASE, character_id: 3, is_published: false, content: '' });

const draftRow = (over: Partial<DraftCharacterUpdate>): DraftCharacterUpdate =>
  ({ id: 1, action_result_id: 40, character_id: 3, module_type: 'numbers', field_name: 'numbers', field_value: expected, field_type: 'json', operation: 'upsert', from_rewards: true, created_at: '', updated_at: '', ...over }) as DraftCharacterUpdate;

function setup({ results = [draftResult], drafts = [] as DraftCharacterUpdate[], board = makeBoard({ rewards: { 3: { lines: [rating], texts: {} } } }) as BoardDoc } = {}) {
  api.getGameResults.mockResolvedValue(makeAxiosResponse(results as ActionResult[]));
  api.listPhaseDraftCharacterUpdates.mockResolvedValue(makeAxiosResponse(drafts));
  chars.getGameCharacterData.mockResolvedValue(makeAxiosResponse(sheet as never));
  api.replaceRewardSheetUpdates.mockResolvedValue(makeAxiosResponse([]));
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  return renderHook(() => usePhaseRewards(7, PHASE, board), { wrapper });
}

const settle = () => act(async () => { await vi.advanceTimersByTimeAsync(REWARD_SYNC_DELAY_MS + 10); });

describe('usePhaseRewards sync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });
  afterEach(() => vi.useRealTimers());

  it('writes the generated drafts on the first draft result and remembers it as the carrier', async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.ready).toBe(true));
    await settle();
    expect(api.replaceRewardSheetUpdates).toHaveBeenCalledWith(7, PHASE, 3, {
      result_id: 40,
      updates: [{ module_type: 'numbers', field_name: 'numbers', field_value: expected }],
      replace_hand_made: undefined,
    });
    await waitFor(() => expect(boardUpdate).toHaveBeenCalledWith('rewards', '3', expect.any(Function)));
    expect(boardUpdate.mock.calls[0][2]({ lines: [rating], texts: {} }).carrierHeadId).toBe(40);
  });

  it('does nothing when the stored drafts already match', async () => {
    const { result } = setup({ drafts: [draftRow({})] });
    await waitFor(() => expect(result.current.ready).toBe(true));
    await settle();
    expect(api.replaceRewardSheetUpdates).not.toHaveBeenCalled();
    expect(result.current.syncFor(3).state).toBe('synced');
  });

  it('stops at hand-made drafts until the GM says replace them', async () => {
    const { result } = setup({ drafts: [draftRow({ from_rewards: false, module_type: 'inventory', field_name: 'items', field_value: '[]' })] });
    await waitFor(() => expect(result.current.ready).toBe(true));
    await settle();
    expect(api.replaceRewardSheetUpdates).not.toHaveBeenCalled();
    expect(result.current.syncFor(3)).toMatchObject({ state: 'hand-made', handMade: [expect.objectContaining({ module_type: 'inventory' })] });

    act(() => result.current.replaceHandMade(3));
    await settle();
    expect(api.replaceRewardSheetUpdates).toHaveBeenCalledWith(7, PHASE, 3, expect.objectContaining({ result_id: 40, replace_hand_made: true }));
  });

  it('clears generated drafts once the lines are gone', async () => {
    const { result } = setup({ drafts: [draftRow({})], board: makeBoard({ rewards: { 3: { lines: [], texts: {} } } }) });
    await waitFor(() => expect(result.current.ready).toBe(true));
    await settle();
    expect(api.replaceRewardSheetUpdates).toHaveBeenCalledWith(7, PHASE, 3, { result_id: 40, updates: [], replace_hand_made: undefined });
  });

  it('leaves a published carrier alone', async () => {
    const published = { ...draftResult, is_published: true };
    const { result } = setup({ results: [published], board: makeBoard({ rewards: { 3: { lines: [rating], texts: {}, carrierHeadId: 40 } } }) });
    await waitFor(() => expect(result.current.ready).toBe(true));
    await settle();
    expect(api.replaceRewardSheetUpdates).not.toHaveBeenCalled();
    expect(result.current.stateFor(3).locked).toBe(true);
  });

  it('reports a failed write, with the server’s sentence', async () => {
    const headers = new AxiosHeaders();
    const err = new AxiosError('fail', '409', { headers }, null, { status: 409, statusText: '', headers, config: { headers }, data: { detail: 'That result is already published' } });
    const { result } = setup();
    api.replaceRewardSheetUpdates.mockRejectedValue(err);
    await waitFor(() => expect(result.current.ready).toBe(true));
    await settle();
    await waitFor(() => expect(result.current.syncFor(3)).toMatchObject({ state: 'error', message: 'That result is already published' }));
  });
});
