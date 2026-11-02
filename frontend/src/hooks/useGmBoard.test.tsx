import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError, AxiosHeaders } from 'axios';
import React from 'react';
import { makeAxiosResponse, makeGmItem } from '@/test-utils/factories';
import type { GmItem } from '@/types/gmBoard';
import {
  GM_BOARD_RETRY_MS,
  GM_BOARD_SAVE_DELAY_MS,
  useGmBoard,
  useGmBoardStore,
  useGmSettings,
} from './useGmBoard';
import { apiClient } from '../lib/api';

vi.mock('../lib/api', () => ({
  apiClient: {
    gmBoard: {
      getBoard: vi.fn(),
      applyBoardChanges: vi.fn(),
      getSettings: vi.fn(),
      applySettingsChanges: vi.fn(),
    },
  },
}));

const api = vi.mocked(apiClient.gmBoard);

function makeWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

const notes = (text: string, version = 1, seq = version) =>
  makeGmItem({ kind: 'notes', key: 'notes', version, seq, doc: { text } });

const boardResponse = (items: GmItem[], cursor: number) => makeAxiosResponse({ items, cursor });
const written = (items: GmItem[]) => makeAxiosResponse({ items });

function conflictError(conflicts: GmItem[] | undefined) {
  const headers = new AxiosHeaders();
  return new AxiosError('Conflict', '409', { headers }, null, {
    status: 409, statusText: 'Conflict', headers, config: { headers },
    data: { status: 409, title: 'Conflict', detail: 'Another editor changed an item you were editing.', conflicts },
  });
}

function networkError() {
  return new AxiosError('Network Error', 'ERR_NETWORK', { headers: new AxiosHeaders() });
}

function renderBoard(wrapper = makeWrapper()) {
  return renderHook(() => ({ view: useGmBoard(7, 70), store: useGmBoardStore(7, 70) }), { wrapper });
}

async function settle(ms = GM_BOARD_SAVE_DELAY_MS) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

describe('useGmBoard and useGmBoardStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    api.getBoard.mockResolvedValue(boardResponse([notes('start', 1, 4)], 4));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('loads the board, then polls only for changes since the cursor', async () => {
    const { result } = renderBoard();
    await waitFor(() => expect(result.current.view.board?.notes).toBe('start'));
    expect(api.getBoard).toHaveBeenLastCalledWith(7, 70, undefined);

    api.getBoard.mockResolvedValue(boardResponse([notes('from the co-GM', 2, 9)], 9));
    await act(async () => {
      await result.current.view.refetch();
    });
    expect(api.getBoard).toHaveBeenLastCalledWith(7, 70, 4);
    await waitFor(() => expect(result.current.view.board?.notes).toBe('from the co-GM'));
  });

  it('saves edits in one batch a second after the last change', async () => {
    api.applyBoardChanges.mockResolvedValue(written([notes('abc', 2, 10)]));
    const { result } = renderBoard();
    await waitFor(() => expect(result.current.view.board).toBeDefined());

    act(() => {
      result.current.store.update<{ text: string }>('notes', 'notes', () => ({ text: 'a' }));
      result.current.store.update<{ text: string }>('notes', 'notes', (d) => ({ text: d!.text + 'bc' }));
    });
    await waitFor(() => expect(result.current.view.board?.notes).toBe('abc')); // optimistic
    expect(result.current.store.status).toBe('unsaved');
    expect(api.applyBoardChanges).not.toHaveBeenCalled();

    await settle();
    await waitFor(() => expect(result.current.store.status).toBe('saved'));
    expect(api.applyBoardChanges).toHaveBeenCalledTimes(1);
    expect(api.applyBoardChanges).toHaveBeenCalledWith(7, 70, [
      { kind: 'notes', key: 'notes', base_version: 1, doc: { text: 'abc' } },
    ]);
  });

  it('an edit made while a save is in flight goes in the next save, based on the version just written', async () => {
    let finishFirst: (v: unknown) => void = () => {};
    api.applyBoardChanges
      .mockImplementationOnce(() => new Promise((resolve) => { finishFirst = resolve; }) as never)
      .mockResolvedValueOnce(written([notes('second', 3, 12)]));
    const { result } = renderBoard();
    await waitFor(() => expect(result.current.view.board).toBeDefined());

    act(() => result.current.store.update('notes', 'notes', () => ({ text: 'first' })));
    await settle();
    await waitFor(() => expect(result.current.store.status).toBe('saving'));

    act(() => result.current.store.update('notes', 'notes', () => ({ text: 'second' })));
    await act(async () => {
      finishFirst(written([notes('first', 2, 11)]));
    });
    await settle();
    await waitFor(() => expect(api.applyBoardChanges).toHaveBeenCalledTimes(2));
    expect(api.applyBoardChanges).toHaveBeenLastCalledWith(7, 70, [
      { kind: 'notes', key: 'notes', base_version: 2, doc: { text: 'second' } },
    ]);
    await waitFor(() => expect(result.current.store.status).toBe('saved'));
    expect(result.current.view.board?.notes).toBe('second');
  });

  it('two components editing the same board share one save queue', async () => {
    api.applyBoardChanges.mockResolvedValue(written([notes('x', 2, 10)]));
    const wrapper = makeWrapper();
    const { result } = renderHook(
      () => ({ view: useGmBoard(7, 70), a: useGmBoardStore(7, 70), b: useGmBoardStore(7, 70) }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.view.board).toBeDefined());

    act(() => {
      result.current.a.update('notes', 'notes', () => ({ text: 'x' }));
      result.current.b.update('card', 'c1', () => ({ summary: 'y' }));
    });
    await settle();
    await waitFor(() => expect(result.current.a.status).toBe('saved'));
    expect(api.applyBoardChanges).toHaveBeenCalledTimes(1);
    expect(api.applyBoardChanges.mock.calls[0][2]).toHaveLength(2);
  });

  it('a poll never overwrites an unsaved edit', async () => {
    const { result } = renderBoard();
    await waitFor(() => expect(result.current.view.board).toBeDefined());
    api.applyBoardChanges.mockImplementation(() => new Promise(() => {}) as never); // keep it unsaved

    act(() => result.current.store.update('notes', 'notes', () => ({ text: 'mine' })));
    api.getBoard.mockResolvedValue(boardResponse([notes('theirs', 2, 9)], 9));
    await act(async () => {
      await result.current.view.refetch();
    });
    // The poll has landed; the edit still shows.
    await waitFor(() => expect(result.current.view.board?.notes).toBe('mine'));
    expect(api.getBoard).toHaveBeenLastCalledWith(7, 70, 4);
  });

  it('a conflict takes their copy for that item, tells the GM, and resends the rest', async () => {
    api.applyBoardChanges
      .mockRejectedValueOnce(conflictError([notes('theirs', 2, 9)]))
      .mockResolvedValueOnce(written([makeGmItem({ kind: 'card', key: 'c1', version: 1, seq: 10 })]))
      .mockResolvedValueOnce(written([notes('mine', 3, 11)]));
    const { result } = renderBoard();
    await waitFor(() => expect(result.current.view.board).toBeDefined());

    act(() => {
      result.current.store.update('notes', 'notes', () => ({ text: 'mine' }));
      result.current.store.update('card', 'c1', () => ({ summary: 'kept' }));
    });
    await settle();
    await waitFor(() => expect(result.current.store.lost).toHaveLength(1));
    expect(result.current.store.lost[0]).toMatchObject({ kind: 'notes', key: 'notes' });
    expect(result.current.view.board?.notes).toBe('theirs');

    await settle();
    await waitFor(() => expect(api.applyBoardChanges).toHaveBeenCalledTimes(2));
    expect(api.applyBoardChanges.mock.calls[1][2]).toEqual([
      { kind: 'card', key: 'c1', base_version: 0, doc: { summary: 'kept' } },
    ]);

    // "Use mine" reapplies the lost edit on top of their version.
    act(() => result.current.store.keepMine(result.current.store.lost[0]));
    await settle();
    await waitFor(() => expect(api.applyBoardChanges).toHaveBeenCalledTimes(3));
    expect(api.applyBoardChanges.mock.calls[2][2]).toEqual([
      { kind: 'notes', key: 'notes', base_version: 2, doc: { text: 'mine' } },
    ]);
    expect(result.current.store.lost).toEqual([]);
  });

  it('a 409 without conflicts (archived game) is an error, not a retry', async () => {
    api.applyBoardChanges.mockRejectedValue(conflictError(undefined));
    const { result } = renderBoard();
    await waitFor(() => expect(result.current.view.board).toBeDefined());

    act(() => result.current.store.update('notes', 'notes', () => ({ text: 'x' })));
    await settle();
    await waitFor(() => expect(result.current.store.status).toBe('error'));
    await settle(GM_BOARD_RETRY_MS);
    expect(api.applyBoardChanges).toHaveBeenCalledTimes(1);
    expect(result.current.view.board?.notes).toBe('x'); // the edit is kept
  });

  it('retries a save that failed on the network', async () => {
    api.applyBoardChanges.mockRejectedValueOnce(networkError()).mockResolvedValueOnce(written([notes('x', 2, 10)]));
    const { result } = renderBoard();
    await waitFor(() => expect(result.current.view.board).toBeDefined());

    act(() => result.current.store.update('notes', 'notes', () => ({ text: 'x' })));
    await settle();
    await waitFor(() => expect(result.current.store.status).toBe('error'));
    await settle(GM_BOARD_RETRY_MS);
    await waitFor(() => expect(result.current.store.status).toBe('saved'));
    expect(api.applyBoardChanges).toHaveBeenCalledTimes(2);
  });

  it('saves pending edits when the board closes', async () => {
    api.applyBoardChanges.mockResolvedValue(written([notes('bye', 2, 10)]));
    const { result, unmount } = renderBoard();
    await waitFor(() => expect(result.current.view.board).toBeDefined());

    act(() => result.current.store.update('notes', 'notes', () => ({ text: 'bye' })));
    unmount();
    await waitFor(() => expect(api.applyBoardChanges).toHaveBeenCalledTimes(1));
  });

  // The store once read the cache through a second useQuery with no queryFn,
  // which replaced the query's options: polls then ran with no fetch function.
  it('polls keep working after the store has saved', async () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    api.applyBoardChanges.mockResolvedValue(written([notes('x', 2, 10)]));
    const { result } = renderBoard();
    await waitFor(() => expect(result.current.view.board).toBeDefined());

    act(() => result.current.store.update('notes', 'notes', () => ({ text: 'x' })));
    await settle();
    await waitFor(() => expect(result.current.store.status).toBe('saved'));
    await act(async () => {
      await result.current.view.refetch();
    });

    expect(errors.mock.calls.flat().join(' ')).not.toMatch(/No queryFn/);
    expect(api.getBoard.mock.calls.length).toBeGreaterThanOrEqual(2);
    errors.mockRestore();
  });

  it('a read-only store changes nothing', async () => {
    const { result } = renderHook(() => ({ view: useGmBoard(7, 70), store: useGmBoardStore(7, 70, { readOnly: true }) }), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current.view.board).toBeDefined());
    act(() => result.current.store.update('notes', 'notes', () => ({ text: 'nope' })));
    expect(result.current.view.board?.notes).toBe('start');
  });
});

describe('useGmSettings', () => {
  beforeEach(() => vi.clearAllMocks());

  it('assembles the settings and reports sharing', async () => {
    api.getSettings.mockResolvedValue(
      makeAxiosResponse({
        items: [makeGmItem({ kind: 'template', key: 'template', doc: { text: '{{name}}' } })],
        cursor: 1,
        share_gm_board: true,
      }),
    );
    const { result } = renderHook(() => useGmSettings(7), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.settings).toBeDefined());
    expect(result.current.settings?.rewardTemplate).toBe('{{name}}');
    expect(result.current.settings?.secondPerson).toBe(true);
    expect(result.current.shareGmBoard).toBe(true);
  });

  it('does not load for an invalid game', () => {
    renderHook(() => useGmSettings(0), { wrapper: makeWrapper() });
    expect(api.getSettings).not.toHaveBeenCalled();
  });
});
