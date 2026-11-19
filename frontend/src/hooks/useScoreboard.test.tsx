import { createElement, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { server } from '@/mocks/server';
import { extractApiErrorMessage } from '@/lib/errors';
import type { Scoreboard, ScoreboardConfig, ScoreboardEntryNames } from '@/types/scoreboard';
import {
  scoreboardConfigQueryKey,
  useScoreboard,
  useScoreboardConfig,
  useScoreboardEntryNames,
  useScoreboardPreview,
  useUpdateScoreboardConfig,
} from './useScoreboard';

const GAME_ID = 7;
const BOARD_URL = `/api/v1/games/${GAME_ID}/scoreboard`;
const CONFIG_URL = `${BOARD_URL}/config`;

const board: Scoreboard = {
  columns: [{ id: 'c_score1', label: 'Score', display: 'value' }],
  sort_description: [{ label: 'Score', direction: 'desc' }],
  full_view: false,
  rows: [{ character_id: 1, character_name: 'Ash', values: { c_score1: { value: 7 } } }],
};

const config: ScoreboardConfig = {
  visibility: 'public',
  columns: [{ id: 'c_score1', label: 'Score', tab_key: 'numbers', entry: 'Score', field_key: 'amount' }],
  sort: [{ key: 'c_score1', direction: 'desc' }],
};

let client: QueryClient;

function wrapper({ children }: { children: ReactNode }) {
  return createElement(QueryClientProvider, { client }, children);
}

beforeEach(() => {
  // Keeps unobserved entries: these tests read the cache directly.
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});

describe('useScoreboard', () => {
  it('returns the board the server sends', async () => {
    server.use(http.get(BOARD_URL, () => HttpResponse.json(board)));
    const { result } = renderHook(() => useScoreboard(GAME_ID), { wrapper });
    await waitFor(() => expect(result.current.data).toEqual(board));
  });

  it('treats a 404 as no board rather than a failure', async () => {
    server.use(http.get(BOARD_URL, () => HttpResponse.json({ detail: 'Not found' }, { status: 404 })));
    const { result } = renderHook(() => useScoreboard(GAME_ID), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('reports any other failure as an error', async () => {
    server.use(http.get(BOARD_URL, () => HttpResponse.json({ detail: 'Boom' }, { status: 500 })));
    const { result } = renderHook(() => useScoreboard(GAME_ID), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.data).toBeUndefined();
  });

  it.each([
    ['it is disabled', GAME_ID, false],
    ['the game ID is not known yet', Number.NaN, true],
  ])('makes no request when %s', async (_name, gameId, enabled) => {
    const requested = vi.fn();
    server.use(http.get('/api/v1/games/:gameId/scoreboard', () => {
      requested();
      return HttpResponse.json(board);
    }));
    const { result } = renderHook(() => useScoreboard(gameId, { enabled }), { wrapper });
    await act(async () => { await Promise.resolve(); });
    expect(result.current.fetchStatus).toBe('idle');
    expect(requested).not.toHaveBeenCalled();
  });
});

describe('useScoreboardConfig', () => {
  it('returns the stored setup', async () => {
    server.use(http.get(CONFIG_URL, () => HttpResponse.json(config)));
    const { result } = renderHook(() => useScoreboardConfig(GAME_ID), { wrapper });
    await waitFor(() => expect(result.current.data).toEqual(config));
  });
});

describe('useScoreboardEntryNames', () => {
  it('returns the names in use on each tab', async () => {
    const names: ScoreboardEntryNames = { tabs: [{ tab_key: 'numbers', entry_names: ['HP', 'Score'] }] };
    server.use(http.get(`${BOARD_URL}/entry-names`, () => HttpResponse.json(names)));
    const { result } = renderHook(() => useScoreboardEntryNames(GAME_ID), { wrapper });
    await waitFor(() => expect(result.current.data).toEqual(names));
  });
});

describe('useUpdateScoreboardConfig', () => {
  it('sends the setup and keeps what the server stored', async () => {
    const stored: ScoreboardConfig = { columns: config.columns };
    let received: unknown;
    server.use(http.put(CONFIG_URL, async ({ request }) => {
      received = await request.json();
      return HttpResponse.json(stored);
    }));
    const { result } = renderHook(() => useUpdateScoreboardConfig(GAME_ID), { wrapper });

    await act(() => result.current.mutateAsync(config));

    expect(received).toEqual(config);
    expect(client.getQueryData(scoreboardConfigQueryKey(GAME_ID))).toEqual(stored);
  });

  it('refreshes the open board and the game details after a save', async () => {
    const renamed: Scoreboard = { ...board, columns: [{ id: 'c_score1', label: 'Points', display: 'value' }] };
    let boardResponse = board;
    server.use(
      http.get(BOARD_URL, () => HttpResponse.json(boardResponse)),
      http.put(CONFIG_URL, () => HttpResponse.json(config)),
    );
    client.setQueryData(['gameDetails', GAME_ID], { id: GAME_ID });
    const { result } = renderHook(
      () => ({ board: useScoreboard(GAME_ID), save: useUpdateScoreboardConfig(GAME_ID) }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.board.data).toEqual(board));

    boardResponse = renamed;
    await act(() => result.current.save.mutateAsync(config));

    await waitFor(() => expect(result.current.board.data).toEqual(renamed));
    expect(client.getQueryState(['gameDetails', GAME_ID])?.isInvalidated).toBe(true);
  });

  it('leaves the cached setup alone and exposes the reason when a save is refused', async () => {
    client.setQueryData(scoreboardConfigQueryKey(GAME_ID), config);
    server.use(http.put(CONFIG_URL, () =>
      HttpResponse.json({ detail: 'Add at least one bound to the range' }, { status: 422 })));
    const { result } = renderHook(() => useUpdateScoreboardConfig(GAME_ID), { wrapper });

    await act(async () => { await result.current.mutateAsync({}).catch(() => undefined); });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(extractApiErrorMessage(result.current.error)).toBe('Add at least one bound to the range');
    expect(client.getQueryData(scoreboardConfigQueryKey(GAME_ID))).toEqual(config);
  });
});

describe('useScoreboardPreview', () => {
  const PREVIEW_URL = `${BOARD_URL}/preview`;

  it('sends the draft and returns the board players would get', async () => {
    let sent: unknown;
    server.use(http.post(PREVIEW_URL, async ({ request }) => {
      sent = await request.json();
      return HttpResponse.json(board);
    }));
    const { result } = renderHook(() => useScoreboardPreview(GAME_ID, config), { wrapper });

    await waitFor(() => expect(result.current.data).toEqual(board));
    expect(sent).toEqual(config);
  });

  it('asks only once about a draft the server refuses', async () => {
    let requests = 0;
    server.use(http.post(PREVIEW_URL, () => {
      requests += 1;
      return HttpResponse.json({ detail: 'Range 1 needs a label' }, { status: 422 });
    }));
    client = new QueryClient();
    const { result } = renderHook(() => useScoreboardPreview(GAME_ID, config), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(requests).toBe(1);
    expect(extractApiErrorMessage(result.current.error)).toBe('Range 1 needs a label');
  });
});
