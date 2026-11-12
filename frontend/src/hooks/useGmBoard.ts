import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { hashKey, useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { useBoardReadOnly } from '@/hooks/useBoardReadOnly';
import { apiClient } from '@/lib/api';
import { extractApiErrorMessage } from '@/lib/errors';
import {
  applyConflicts,
  assembleBoard,
  assembleSettings,
  dismissLost,
  editItem,
  hasPendingChanges,
  liveItems,
  loadState,
  markSaved,
  mergeServerItems,
  reapplyLost,
  removeItem,
  toChangeRequests,
  type ChangeRequest,
  type DirtyEdit,
  type StoreState,
} from '@/lib/gmBoard/store';
import type { BoardDoc, GameBoardSettings } from '@/lib/gmBoard/types';
import type {
  BoardItemChange,
  BoardItemKind,
  GmBoardConflict,
  GmItem,
  SettingsItemChange,
  SettingsItemKind,
} from '@/types/gmBoard';

/** How often an open board checks for other editors' changes (while the tab is visible). */
const GM_BOARD_POLL_MS = 15_000;
/** Edits are saved this long after the last one. */
export const GM_BOARD_SAVE_DELAY_MS = 1_000;
/** A save that failed for a reason that may pass (network, 5xx) is retried after this. */
export const GM_BOARD_RETRY_MS = 10_000;

const gmBoardQueryKey = (gameId: number, phaseId: number) => ['gmBoard', gameId, phaseId] as const;
const gmSettingsQueryKey = (gameId: number) => ['gmSettings', gameId] as const;

/** A game's settings items, plus whether the boards are shared. */
export type GmSettingsState = StoreState & { shareGmBoard: boolean };

export type GmSaveStatus = 'saved' | 'unsaved' | 'saving' | 'error';

interface ItemSource<S extends StoreState> {
  queryKey: QueryKey;
  /** A full load (no since) or a poll. */
  load: (since?: number) => Promise<{ items: GmItem[]; cursor: number; extra?: Partial<S> }>;
  save: (changes: ChangeRequest[]) => Promise<GmItem[]>;
}

/**
 * The query holding a board's (or settings') StoreState. Its queryFn polls:
 * the first run is a full load, every later run asks only for what changed
 * since the cursor and merges it into the newest cached state. Reading the
 * cache again after the request matters: edits made while the poll was in
 * flight must not be lost.
 */
function useItemsQuery<S extends StoreState>(source: ItemSource<S>, enabled: boolean) {
  const queryClient = useQueryClient();
  return useQuery<S>({
    queryKey: source.queryKey,
    enabled,
    queryFn: async () => {
      const before = queryClient.getQueryData<S>(source.queryKey);
      const response = await source.load(before?.cursor);
      const latest = queryClient.getQueryData<S>(source.queryKey);
      const base = (latest ?? loadState([], 0)) as S;
      return { ...mergeServerItems(base, response.items, response.cursor), ...response.extra } as S;
    },
    refetchInterval: GM_BOARD_POLL_MS,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });
}

function conflictsOf(error: unknown): GmItem[] | null {
  if (!isAxiosError(error) || error.response?.status !== 409) return null;
  const body = error.response.data as GmBoardConflict | undefined;
  return Array.isArray(body?.conflicts) ? body.conflicts : null;
}

function isRetryable(error: unknown): boolean {
  if (!isAxiosError(error)) return false;
  const status = error.response?.status;
  return status === undefined || status >= 500;
}

/**
 * Edits to a cached StoreState, saved in batches. Every piece of save state
 * (dirty edits, the in-flight flag, the last error, lost edits) lives in the
 * query cache rather than in this hook, so two components using the same
 * board share one queue and can't both send the same edits.
 */
function useItemEditor<S extends StoreState>(source: ItemSource<S>, readOnly: boolean) {
  const queryClient = useQueryClient();
  const { queryKey } = source;
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const get = useCallback(() => queryClient.getQueryData<S>(queryKey), [queryClient, queryKey]);
  const set = useCallback(
    (fn: (s: S) => S) => queryClient.setQueryData<S>(queryKey, (s) => (s ? fn(s) : s)),
    [queryClient, queryKey],
  );

  const flushRef = useRef<() => Promise<void>>(async () => {});
  const schedule = useCallback((delay: number) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => void flushRef.current(), delay);
  }, []);

  const flush = useCallback(async () => {
    clearTimeout(timer.current);
    const state = get();
    if (!state || state.saving || !hasPendingChanges(state)) return;
    const sent: DirtyEdit[] = Object.values(state.dirty);
    set((s) => ({ ...s, saving: true }));
    try {
      const written = await source.save(toChangeRequests(sent));
      set((s) => markSaved(s, sent, written) as S);
      // Poll after each save, so other editors' changes show up promptly.
      void queryClient.invalidateQueries({ queryKey });
    } catch (error) {
      const conflicts = conflictsOf(error);
      if (conflicts) {
        set((s) => applyConflicts(s, conflicts) as S);
        // The refusal only carries the conflicting items: fetch the other
        // editor's other changes now, not at the next poll.
        void queryClient.invalidateQueries({ queryKey });
      } else {
        const message = extractApiErrorMessage(error) ?? 'Saving failed.';
        set((s) => ({ ...s, saving: false, saveError: message }));
        if (isRetryable(error)) schedule(GM_BOARD_RETRY_MS);
        return;
      }
    }
    // Edits made while this save was in flight (or left over after a
    // conflict) go in the next one.
    const after = get();
    if (after && hasPendingChanges(after)) schedule(GM_BOARD_SAVE_DELAY_MS);
  }, [get, set, schedule, queryClient, queryKey, source]);
  useEffect(() => {
    flushRef.current = flush;
  }, [flush]);

  const change = useCallback(
    (fn: (s: S) => S) => {
      if (readOnly) return;
      set(fn);
      schedule(GM_BOARD_SAVE_DELAY_MS);
    },
    [readOnly, set, schedule],
  );

  // Save what's pending when the board closes, rather than dropping it.
  useEffect(
    () => () => {
      clearTimeout(timer.current);
      void flushRef.current();
    },
    [],
  );

  // Read the cached state without a second useQuery: an observer with no
  // queryFn would overwrite the query's options, and the next poll would run
  // with no fetch function at all. Listen to this query only: the cache tells
  // its listeners at once when any component starts a query while rendering,
  // and re-rendering then is an error in React.
  const hash = useMemo(() => hashKey(queryKey), [queryKey]);
  const data = useSyncExternalStore(
    useCallback(
      (onChange: () => void) =>
        queryClient.getQueryCache().subscribe((event) => {
          if (event.query.queryHash === hash) onChange();
        }),
      [queryClient, hash],
    ),
    get,
  );
  const pending = !!data && hasPendingChanges(data);
  const status: GmSaveStatus = data?.saving ? 'saving' : data?.saveError ? 'error' : pending ? 'unsaved' : 'saved';

  // Warn before closing the tab with unsaved edits.
  useEffect(() => {
    if (status === 'saved') return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [status]);

  return {
    status,
    saveError: data?.saveError ?? null,
    /** Edits dropped because someone else changed the item first. */
    lost: data?.lost ?? [],
    flush,
    change,
    /** "Use mine": reapply a lost edit on top of the other editor's version. */
    keepMine: useCallback((edit: DirtyEdit) => change((s) => reapplyLost(s, edit) as S), [change]),
    dismissLost: useCallback(() => set((s) => dismissLost(s) as S), [set]),
  };
}

// ------------------------------------------------------------------ board

function boardSource(gameId: number, phaseId: number): ItemSource<StoreState> {
  return {
    queryKey: gmBoardQueryKey(gameId, phaseId),
    load: async (since) => (await apiClient.gmBoard.getBoard(gameId, phaseId, since)).data,
    save: async (changes) =>
      (await apiClient.gmBoard.applyBoardChanges(gameId, phaseId, changes as BoardItemChange[])).data.items,
  };
}

/**
 * A phase's results board, assembled, kept current by polling every 15
 * seconds while the tab is visible, on focus, and after each save.
 */
export function useGmBoard(gameId: number, phaseId: number, options: { enabled?: boolean } = {}) {
  const source = useMemo(() => boardSource(gameId, phaseId), [gameId, phaseId]);
  const query = useItemsQuery(source, (options.enabled ?? true) && gameId > 0 && phaseId > 0);
  const board = useMemo<BoardDoc | undefined>(
    () => (query.data ? assembleBoard(liveItems(query.data)) : undefined),
    [query.data],
  );
  return { board, isLoading: query.isLoading, error: query.error, refetch: query.refetch };
}

/**
 * Edits to a phase's board: optimistic, saved about a second after the last
 * change. Read-only (the option, or the board's BoardReadOnlyContext) drops
 * every edit, so nothing is saved.
 */
export function useGmBoardStore(gameId: number, phaseId: number, options: { readOnly?: boolean } = {}) {
  const source = useMemo(() => boardSource(gameId, phaseId), [gameId, phaseId]);
  const boardReadOnly = useBoardReadOnly();
  const editor = useItemEditor(source, !!options.readOnly || boardReadOnly);
  const { change } = editor;
  return {
    ...editor,
    update: useCallback(
      <T>(kind: BoardItemKind, key: string, fn: (current: T | undefined) => T) => change((s) => editItem(s, kind, key, fn)),
      [change],
    ),
    remove: useCallback((kind: BoardItemKind, key: string) => change((s) => removeItem(s, kind, key)), [change]),
  };
}

// ------------------------------------------------------------------ settings

function settingsSource(gameId: number): ItemSource<GmSettingsState> {
  return {
    queryKey: gmSettingsQueryKey(gameId),
    load: async (since) => {
      const { data } = await apiClient.gmBoard.getSettings(gameId, since);
      return { items: data.items, cursor: data.cursor, extra: { shareGmBoard: data.share_gm_board } };
    },
    save: async (changes) =>
      (await apiClient.gmBoard.applySettingsChanges(gameId, changes as SettingsItemChange[])).data.items,
  };
}

/** A game's results board settings (codex, names, template), polled like a board. */
export function useGmSettings(gameId: number, options: { enabled?: boolean } = {}) {
  const source = useMemo(() => settingsSource(gameId), [gameId]);
  const query = useItemsQuery(source, (options.enabled ?? true) && gameId > 0);
  const settings = useMemo<GameBoardSettings | undefined>(
    () => (query.data ? assembleSettings(liveItems(query.data)) : undefined),
    [query.data],
  );
  return {
    settings,
    shareGmBoard: query.data?.shareGmBoard ?? false,
    isLoading: query.isLoading,
    error: query.error,
  };
}

/**
 * Edits to a game's board settings (codex entries, character names, the
 * template), saved like a board's: optimistic, about a second after the last
 * change, with the same conflict handling.
 */
export function useGmSettingsStore(gameId: number, options: { readOnly?: boolean } = {}) {
  const source = useMemo(() => settingsSource(gameId), [gameId]);
  const boardReadOnly = useBoardReadOnly();
  const editor = useItemEditor(source, !!options.readOnly || boardReadOnly);
  const { change } = editor;
  return {
    ...editor,
    update: useCallback(
      <T>(kind: SettingsItemKind, key: string, fn: (current: T | undefined) => T) =>
        change((s) => editItem(s, kind, key, fn) as GmSettingsState),
      [change],
    ),
    remove: useCallback(
      (kind: SettingsItemKind, key: string) => change((s) => removeItem(s, kind, key) as GmSettingsState),
      [change],
    ),
  };
}

// ------------------------------------------------------------------ sharing

/**
 * The action phases whose board has something on it, for "View results
 * board" links. Same viewers as a board: ask only as the GM, or when the
 * game shares its boards.
 */
export function useGmBoardPhases(gameId: number, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ['gmBoardPhases', gameId],
    queryFn: () => apiClient.gmBoard.listBoardPhases(gameId).then((res) => res.data.phase_ids),
    enabled: (options.enabled ?? true) && gameId > 0,
  });
}

/** Turns read-only sharing of the game's boards on or off (GM only, any game state). */
export function useSetGmBoardSharing(gameId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (share: boolean) => apiClient.gmBoard.setSharing(gameId, share).then((res) => res.data.share_gm_board),
    onSuccess: (shared) => {
      queryClient.setQueryData<GmSettingsState>(gmSettingsQueryKey(gameId), (s) => (s ? { ...s, shareGmBoard: shared } : s));
      // The game itself carries the flag too (History reads it for the links).
      void queryClient.invalidateQueries({ queryKey: ['gameDetails', gameId] });
    },
  });
}
