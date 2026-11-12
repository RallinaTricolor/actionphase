import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError, AxiosHeaders } from 'axios';
import React from 'react';
import { makeActionResult, makeAxiosResponse } from '@/test-utils/factories';
import type { ActionResult } from '@/types/phases';
import { DRAFT_RETRY_MS, DRAFT_SAVE_DELAY_MS, useResultDraft, type DraftTarget } from './useResultDraft';
import { apiClient } from '../lib/api';

vi.mock('../lib/api', () => ({
  apiClient: {
    phases: {
      updateActionResult: vi.fn(),
      createActionResult: vi.fn(),
      appendStagedPart: vi.fn(),
      getGameResults: vi.fn(),
    },
  },
}));

const api = vi.mocked(apiClient.phases);

function setup(target: DraftTarget, list: ActionResult[] = [], onCreated = vi.fn()) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  qc.setQueryData(['actionResults', 'game', 7], list);
  const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  const hook = renderHook(({ t }) => useResultDraft(7, t, onCreated), { wrapper, initialProps: { t: target } });
  return { ...hook, qc, onCreated };
}

const settle = () => act(async () => { await vi.advanceTimersByTimeAsync(DRAFT_SAVE_DELAY_MS); });

function httpError(status: number) {
  const headers = new AxiosHeaders();
  return new AxiosError('fail', String(status), { headers }, null, { status, statusText: '', headers, config: { headers }, data: {} });
}

const part = makeActionResult({ id: 5, character_id: 1, content: 'Mara waits.', updated_at: '2026-11-03T10:00:00.000001Z' });

describe('useResultDraft', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });
  afterEach(() => vi.useRealTimers());

  it('saves a second after the last keystroke, with the updated_at it last saw, then the new one', async () => {
    api.updateActionResult
      .mockResolvedValueOnce(makeAxiosResponse({ ...part, content: 'Mara waits. The bell', updated_at: '2026-11-03T10:00:01Z' }))
      .mockResolvedValueOnce(makeAxiosResponse({ ...part, updated_at: '2026-11-03T10:00:02Z' }));
    const { result, qc } = setup({ kind: 'part', part }, [part]);

    act(() => result.current.setText('Mara waits. The'));
    act(() => result.current.setText('Mara waits. The bell'));
    expect(result.current.status).toBe('unsaved');
    await settle();
    expect(api.updateActionResult).toHaveBeenCalledTimes(1);
    expect(api.updateActionResult).toHaveBeenLastCalledWith(7, 5, { content: 'Mara waits. The bell', expected_updated_at: part.updated_at });
    expect(result.current.status).toBe('saved');
    expect(qc.getQueryData<ActionResult[]>(['actionResults', 'game', 7])?.[0].content).toBe('Mara waits. The bell');

    act(() => result.current.setText('Mara waits. The bell rings.'));
    await settle();
    expect(api.updateActionResult).toHaveBeenLastCalledWith(7, 5, { content: 'Mara waits. The bell rings.', expected_updated_at: '2026-11-03T10:00:01Z' });
  });

  it('creates the result on the first save of non-blank text, linking the submission, and reports it', async () => {
    api.createActionResult.mockResolvedValue(makeAxiosResponse({ ...part, id: 9, content: 'You', updated_at: '2026-11-03T10:00:01Z' }));
    api.updateActionResult.mockResolvedValue(makeAxiosResponse({ ...part, id: 9, updated_at: '2026-11-03T10:00:02Z' }));
    const { result, onCreated } = setup({ kind: 'new-result', userId: 100, characterId: 1, submissionId: 44 });

    act(() => result.current.setText('   '));
    await settle();
    expect(api.createActionResult).not.toHaveBeenCalled();

    act(() => result.current.setText('You'));
    await settle();
    expect(api.createActionResult).toHaveBeenCalledWith(7, { user_id: 100, character_id: 1, action_submission_id: 44, content: 'You', is_published: false });
    expect(onCreated).toHaveBeenCalledWith(expect.objectContaining({ id: 9, character_id: 1 }));

    // Later typing updates the row it made.
    act(() => result.current.setText('You enter.'));
    await settle();
    expect(api.createActionResult).toHaveBeenCalledTimes(1);
    expect(api.updateActionResult).toHaveBeenLastCalledWith(7, 9, { content: 'You enter.', expected_updated_at: '2026-11-03T10:00:01Z' });
  });

  it('a new part appends to the chain with its delay', async () => {
    api.appendStagedPart.mockResolvedValue(makeAxiosResponse({ ...part, id: 6, content: 'Then the floor gives.', parent_result_id: 5 }));
    const { result, onCreated } = setup({ kind: 'new-part', tail: part, delayMinutes: 30 });
    act(() => result.current.setText('Then the floor gives.'));
    await settle();
    expect(api.appendStagedPart).toHaveBeenCalledWith(7, 5, { content: 'Then the floor gives.', delay_minutes: 30 });
    expect(onCreated).toHaveBeenCalledWith(expect.objectContaining({ id: 6 }));
  });

  it('on a stale save, keeps the GM’s text and offers theirs; Keep mine resends with their updated_at', async () => {
    const theirs = { ...part, content: 'Co-GM text.', updated_at: '2026-11-03T10:05:00Z' };
    api.updateActionResult.mockRejectedValueOnce(httpError(409)).mockResolvedValueOnce(makeAxiosResponse({ ...part, updated_at: '2026-11-03T10:06:00Z' }));
    api.getGameResults.mockResolvedValue(makeAxiosResponse([theirs]));
    const { result, qc } = setup({ kind: 'part', part }, [part]);
    qc.setQueryDefaults(['actionResults', 'game', 7], { queryFn: () => apiClient.phases.getGameResults(7).then((r) => r.data) });
    // An observer, so the invalidation refetches.
    void qc.prefetchQuery({ queryKey: ['actionResults', 'game', 7] });

    act(() => result.current.setText('My text.'));
    await settle();
    await waitFor(() => expect(result.current.status).toBe('conflict'));
    expect(result.current.text).toBe('My text.');
    expect(result.current.theirs?.content).toBe('Co-GM text.');

    // Blocked until the GM chooses: more typing doesn't save.
    act(() => result.current.setText('My text, longer.'));
    await settle();
    expect(api.updateActionResult).toHaveBeenCalledTimes(1);

    act(() => result.current.keepMine());
    await waitFor(() => expect(api.updateActionResult).toHaveBeenCalledTimes(2));
    expect(api.updateActionResult).toHaveBeenLastCalledWith(7, 5, { content: 'My text, longer.', expected_updated_at: theirs.updated_at });
  });

  it('Use theirs replaces the GM’s text', async () => {
    const theirs = { ...part, content: 'Co-GM text.', updated_at: '2026-11-03T10:05:00Z' };
    api.updateActionResult.mockRejectedValueOnce(httpError(409));
    api.getGameResults.mockResolvedValue(makeAxiosResponse([theirs]));
    const { result, qc } = setup({ kind: 'part', part }, [part]);
    qc.setQueryDefaults(['actionResults', 'game', 7], { queryFn: () => apiClient.phases.getGameResults(7).then((r) => r.data) });
    void qc.prefetchQuery({ queryKey: ['actionResults', 'game', 7] });

    act(() => result.current.setText('My text.'));
    await settle();
    await waitFor(() => expect(result.current.status).toBe('conflict'));
    act(() => result.current.takeTheirs());
    expect(result.current.text).toBe('Co-GM text.');
    expect(result.current.status).toBe('saved');
  });

  it('says so when the part was published or deleted meanwhile', async () => {
    api.updateActionResult.mockRejectedValueOnce(httpError(404));
    const { result } = setup({ kind: 'part', part }, [part]);
    act(() => result.current.setText('Too late.'));
    await settle();
    expect(result.current.status).toBe('gone');
  });

  it('shows a newer saved copy that arrives while nothing is waiting to save', async () => {
    const { result, rerender } = setup({ kind: 'part', part }, [part]);
    rerender({ t: { kind: 'part', part: { ...part, content: 'Added from Scenes.', updated_at: '2026-11-03T11:00:00Z' } } });
    expect(result.current.text).toBe('Added from Scenes.');
    // An older copy (a refetch that raced a save) never replaces it.
    rerender({ t: { kind: 'part', part } });
    expect(result.current.text).toBe('Added from Scenes.');
  });

  it('sends waiting text when it unmounts', async () => {
    api.updateActionResult.mockResolvedValue(makeAxiosResponse({ ...part, updated_at: '2026-11-03T10:00:01Z' }));
    const { result, unmount } = setup({ kind: 'part', part }, [part]);
    act(() => result.current.setText('Leaving now.'));
    unmount();
    await act(async () => { await Promise.resolve(); });
    expect(api.updateActionResult).toHaveBeenCalledWith(7, 5, { content: 'Leaving now.', expected_updated_at: part.updated_at });
  });

  // Regression: a failed save left the text only in the box, with nothing
  // that would send it again unless the GM typed more. Changing step or
  // closing the tab then dropped it silently, even once the network was back.
  describe('after a save fails', () => {
    const networkError = () => new AxiosError('Network Error', 'ERR_NETWORK', { headers: new AxiosHeaders() });
    const saved = () => makeAxiosResponse({ ...part, updated_at: '2026-11-03T10:00:01Z' });

    it('tries again on its own, without more typing', async () => {
      api.updateActionResult.mockRejectedValueOnce(networkError()).mockResolvedValue(saved());
      const { result } = setup({ kind: 'part', part }, [part]);
      act(() => result.current.setText('The last paragraph.'));
      await settle();
      expect(result.current.status).toBe('error');

      await act(async () => { await vi.advanceTimersByTimeAsync(DRAFT_RETRY_MS); });
      expect(api.updateActionResult).toHaveBeenCalledTimes(2);
      expect(api.updateActionResult).toHaveBeenLastCalledWith(7, 5, { content: 'The last paragraph.', expected_updated_at: part.updated_at });
      expect(result.current.status).toBe('saved');
    });

    it('still asks before the tab closes', async () => {
      api.updateActionResult.mockRejectedValue(networkError());
      const { result } = setup({ kind: 'part', part }, [part]);
      act(() => result.current.setText('The last paragraph.'));
      await settle();
      expect(result.current.status).toBe('error');

      const leaving = new Event('beforeunload', { cancelable: true });
      window.dispatchEvent(leaving);
      expect(leaving.defaultPrevented).toBe(true);
    });

    it('sends the text when it unmounts', async () => {
      api.updateActionResult.mockRejectedValueOnce(networkError()).mockResolvedValue(saved());
      const { result, unmount } = setup({ kind: 'part', part }, [part]);
      act(() => result.current.setText('The last paragraph.'));
      await settle();
      expect(api.updateActionResult).toHaveBeenCalledTimes(1);

      unmount();
      await act(async () => { await Promise.resolve(); });
      expect(api.updateActionResult).toHaveBeenCalledTimes(2);
      expect(api.updateActionResult).toHaveBeenLastCalledWith(7, 5, { content: 'The last paragraph.', expected_updated_at: part.updated_at });
    });
  });

  it('while a conflict waits for the GM’s choice, asks before the tab closes but sends nothing on unmount', async () => {
    api.updateActionResult.mockRejectedValueOnce(httpError(409));
    const theirs = { ...part, content: 'Their version.', updated_at: '2026-11-03T10:05:00Z' };
    api.getGameResults.mockResolvedValue(makeAxiosResponse([theirs]));
    const { result, unmount, qc } = setup({ kind: 'part', part }, [part]);
    qc.setQueryDefaults(['actionResults', 'game', 7], { queryFn: () => apiClient.phases.getGameResults(7).then((r) => r.data) });
    void qc.prefetchQuery({ queryKey: ['actionResults', 'game', 7] });
    act(() => result.current.setText('Mine.'));
    await settle();
    await waitFor(() => expect(result.current.status).toBe('conflict'));
    const leaving = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(leaving);
    expect(leaving.defaultPrevented).toBe(true);

    unmount();
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
    expect(api.updateActionResult).toHaveBeenCalledTimes(1);
  });
});
