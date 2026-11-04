import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { useGameContext } from '@/contexts/GameContext';
import { useGameActionResults } from '@/hooks/useActionResults';
import { useGmBoardStore, useGmSettings, useGmSettingsStore } from '@/hooks/useGmBoard';
import { useSheetLayout } from '@/hooks/useSheetLayout';
import { apiClient } from '@/lib/api';
import { chainsFor } from '@/lib/gmBoard/results';
import { lineFromItem, sameUpdates, sheetTabsFrom, stable, type RewardSheetUpdate } from '@/lib/gmBoard/rewards';
import { EMPTY_REWARDS, rewardStateFor, type RewardState } from '@/lib/gmBoard/rewardState';
import { newItemKey } from '@/lib/gmBoard/store';
import type { BoardDoc, CharacterRewards, RewardItem, RewardLine } from '@/lib/gmBoard/types';
import type { CharacterData } from '@/types/characters';
import type { DraftCharacterUpdate } from '@/types/phases';
import { logger } from '@/services/LoggingService';

/** How long the sync waits after the last change before writing drafts. */
export const REWARD_SYNC_DELAY_MS = 1_000;

/**
 * Where a character's generated sheet drafts stand:
 * - `synced`: they match the lines (or there's nothing to write);
 * - `syncing`: a write is waiting or in flight;
 * - `hand-made`: drafts made in the results list are in the way; the GM
 *   decides (replaceHandMade);
 * - `error`: the last write failed; the next change retries.
 */
type RewardSyncState = 'synced' | 'syncing' | 'hand-made' | 'error';
export interface RewardSync {
  state: RewardSyncState;
  /** Drafts made by hand in the results list, on this phase's draft results. */
  handMade: DraftCharacterUpdate[];
  message?: string;
}

const phaseDraftsKey = (gameId: number, phaseId: number) => ['phaseDraftUpdates', gameId, phaseId] as const;
// The same query useGameCharacterSheetItems reads, so the board fetches the sheets once.
const gameSheetsKey = (gameId: number) => ['gameCharacterData', gameId] as const;

/**
 * Every character's rewards in one phase, the edits to them, and the sync
 * that keeps the generated sheet drafts in step with the lines.
 *
 * The drafts are worked out here (lib/gmBoard/rewards.ts) and written with
 * one call per character, which clears them from any other draft result in
 * the phase, so one result carries them. They're resynced whenever the lines,
 * the live sheet or the carrying result change, and by `ensureSynced` just
 * before the board publishes.
 */
export function usePhaseRewards(gameId: number, phaseId: number, board: BoardDoc | undefined) {
  const qc = useQueryClient();
  const { game, allGameCharacters } = useGameContext();
  const layout = useSheetLayout(game).tabs;
  const { settings } = useGmSettings(gameId);
  const boardStore = useGmBoardStore(gameId, phaseId);
  const settingsStore = useGmSettingsStore(gameId);
  const results = useGameActionResults(gameId);
  const sheets = useQuery({
    queryKey: gameSheetsKey(gameId),
    queryFn: () => apiClient.characters.getGameCharacterData(gameId).then((r) => r.data),
    enabled: gameId > 0,
    staleTime: 30_000,
  });
  const drafts = useQuery({
    queryKey: phaseDraftsKey(gameId, phaseId),
    queryFn: () => apiClient.phases.listPhaseDraftCharacterUpdates(gameId, phaseId).then((r) => r.data),
    enabled: gameId > 0 && phaseId > 0,
  });

  const names = useMemo(() => new Map(allGameCharacters.map((c) => [c.id, c.name])), [allGameCharacters]);
  const phaseResults = useMemo(() => (results.data ?? []).filter((r) => r.phase_id === phaseId), [results.data, phaseId]);
  const unpublishedIds = useMemo(() => new Set(phaseResults.filter((r) => !r.is_published).map((r) => r.id)), [phaseResults]);
  const items = useMemo<RewardItem[]>(() => [...(settings?.rewardItems ?? []), ...(board?.rewardItems ?? [])], [settings?.rewardItems, board?.rewardItems]);

  const stateFor = useCallback(
    (characterId: number, tailText?: string, sheetRows?: CharacterData[]): RewardState =>
      rewardStateFor({
        settings: {
          rewardTemplate: settings?.rewardTemplate ?? '',
          rewardGroups: settings?.rewardGroups ?? [],
          scales: settings?.scales ?? [],
          rewardItems: settings?.rewardItems ?? [],
        },
        phaseItems: board?.rewardItems ?? [],
        layout,
        name: names.get(characterId) ?? `Character ${characterId}`,
        rewards: board?.rewards[characterId],
        live: sheetTabsFrom(sheetRows ?? sheets.data?.[String(characterId)], layout),
        chains: chainsFor(phaseResults, phaseId, characterId),
        tailText,
      }),
    [settings, board, layout, names, sheets.data, phaseResults, phaseId],
  );

  // ---------------------------------------------------------------- edits

  const updateRewards = useCallback(
    (characterId: number, fn: (r: CharacterRewards) => CharacterRewards) =>
      boardStore.update<CharacterRewards>('rewards', String(characterId), (cur) => fn({ ...EMPTY_REWARDS, ...cur, lines: cur?.lines ?? [], texts: cur?.texts ?? {} })),
    [boardStore],
  );
  const addLine = useCallback(
    (characterId: number, line: Omit<RewardLine, 'id'>): string => {
      const id = newItemKey('rl');
      updateRewards(characterId, (r) => ({ ...r, lines: [...r.lines, { ...line, id }] }));
      return id;
    },
    [updateRewards],
  );
  const giveItem = useCallback(
    (characterId: number, item: RewardItem, extra: Partial<RewardLine> = {}): string => {
      const id = newItemKey('rl');
      updateRewards(characterId, (r) => ({ ...r, lines: [...r.lines, lineFromItem(item, id, extra)] }));
      return id;
    },
    [updateRewards],
  );
  const updateLine = useCallback(
    (characterId: number, lineId: string, fn: (l: RewardLine) => RewardLine) =>
      updateRewards(characterId, (r) => ({ ...r, lines: r.lines.map((l) => (l.id === lineId ? fn(l) : l)) })),
    [updateRewards],
  );
  const removeLine = useCallback(
    (characterId: number, lineId: string) => updateRewards(characterId, (r) => ({ ...r, lines: r.lines.filter((l) => l.id !== lineId) })),
    [updateRewards],
  );
  /** Gives the item, or takes back every copy of it (the table's checkbox). */
  const toggleItem = useCallback(
    (characterId: number, item: RewardItem) => {
      const given = (board?.rewards[characterId]?.lines ?? []).some((l) => l.itemId === item.id);
      if (given) updateRewards(characterId, (r) => ({ ...r, lines: r.lines.filter((l) => l.itemId !== item.id) }));
      else giveItem(characterId, item);
    },
    [board?.rewards, updateRewards, giveItem],
  );
  /** Saves a list item in the list its scope names. */
  const saveItem = useCallback(
    (item: RewardItem) => {
      const { id, scope, ...doc } = item;
      if (scope === 'game') settingsStore.update('reward', id, () => doc);
      else boardStore.update('reward', id, () => doc);
    },
    [settingsStore, boardStore],
  );
  const removeItem = useCallback(
    (item: Pick<RewardItem, 'id' | 'scope'>) => (item.scope === 'game' ? settingsStore.remove('reward', item.id) : boardStore.remove('reward', item.id)),
    [settingsStore, boardStore],
  );

  // ---------------------------------------------------------------- sync

  const [syncs, setSyncs] = useState<Record<number, RewardSync>>({});
  const [replaceAsked, setReplaceAsked] = useState<Record<number, boolean>>({});
  const sent = useRef(new Map<number, string>());

  const setSync = useCallback((characterId: number, next: RewardSync) => {
    setSyncs((s) => (stable(s[characterId]) === stable(next) ? s : { ...s, [characterId]: next }));
  }, []);

  /** What a character's drafts should be, and what's stored. */
  const plan = useCallback(
    (characterId: number, rows: DraftCharacterUpdate[], state: RewardState) => {
      const mine = rows.filter((d) => d.character_id === characterId && unpublishedIds.has(d.action_result_id));
      const generated = mine.filter((d) => d.from_rewards);
      const handMade = mine.filter((d) => !d.from_rewards);
      const target = state.carrier.state === 'draft' ? state.carrier.tail?.id : undefined;
      const desired: RewardSheetUpdate[] = target === undefined ? [] : state.updates;
      const stored = generated.map((d) => ({ module_type: d.module_type, field_name: d.field_name, field_value: d.field_value }));
      const inStep = handMade.length === 0 || desired.length === 0 ? generated.every((d) => d.action_result_id === target) && sameUpdates(stored, desired) : false;
      return { target, desired, generated, handMade, inStep };
    },
    [unpublishedIds],
  );

  const write = useCallback(
    async (characterId: number, target: number | undefined, desired: RewardSheetUpdate[], replace: boolean, headId: number | undefined) => {
      await apiClient.phases.replaceRewardSheetUpdates(gameId, phaseId, characterId, {
        result_id: target,
        updates: desired,
        replace_hand_made: replace || undefined,
      });
      await Promise.all([qc.invalidateQueries({ queryKey: phaseDraftsKey(gameId, phaseId) }), qc.invalidateQueries({ queryKey: ['draftUpdateCount', gameId] })]);
      if (headId !== undefined && board?.rewards[characterId]?.carrierHeadId !== headId) updateRewards(characterId, (r) => ({ ...r, carrierHeadId: headId }));
      if (replace) setReplaceAsked((s) => ({ ...s, [characterId]: false }));
    },
    [gameId, phaseId, qc, board?.rewards, updateRewards],
  );

  const ready = !!board && !!settings && results.isSuccess && sheets.isSuccess && drafts.isSuccess;
  const characterIds = useMemo(() => {
    const ids = new Set(Object.keys(board?.rewards ?? {}).map(Number));
    for (const d of drafts.data ?? []) if (d.from_rewards && unpublishedIds.has(d.action_result_id)) ids.add(d.character_id);
    return [...ids];
  }, [board?.rewards, drafts.data, unpublishedIds]);

  useEffect(() => {
    if (!ready) return;
    const timer = setTimeout(() => {
      for (const characterId of characterIds) {
        const state = stateFor(characterId);
        if (state.locked) continue;
        const p = plan(characterId, drafts.data ?? [], state);
        const replace = !!replaceAsked[characterId];
        if (p.handMade.length && p.desired.length && !replace) {
          setSync(characterId, { state: 'hand-made', handMade: p.handMade });
          continue;
        }
        if (p.inStep && !(replace && p.handMade.length)) {
          sent.current.delete(characterId);
          setSync(characterId, { state: 'synced', handMade: [] });
          continue;
        }
        const signature = stable([p.target, p.desired, replace]);
        if (sent.current.get(characterId) === signature) continue;
        sent.current.set(characterId, signature);
        setSync(characterId, { state: 'syncing', handMade: [] });
        write(characterId, p.target, p.desired, replace, state.carrier.chain?.head.id).catch((error: unknown) => {
          // The signature stays in `sent`: the same write isn't retried until
          // something changes (the lines, the sheet, or the results after a 409).
          const status = isAxiosError(error) ? error.response?.status : undefined;
          const message = isAxiosError<{ detail?: string }>(error) ? error.response?.data?.detail : undefined;
          if (status === 409) void qc.invalidateQueries({ queryKey: ['actionResults', 'game', gameId] });
          void qc.invalidateQueries({ queryKey: phaseDraftsKey(gameId, phaseId) });
          logger.error('Failed to sync reward sheet updates', { error, characterId, gameId, phaseId });
          setSync(characterId, { state: 'error', handMade: [], message });
        });
      }
    }, REWARD_SYNC_DELAY_MS);
    return () => clearTimeout(timer);
  }, [ready, characterIds, stateFor, plan, drafts.data, replaceAsked, setSync, write, qc, gameId, phaseId]);

  /**
   * Brings a character's drafts in step with the live sheet now, before the
   * board publishes. Leaves hand-made drafts alone: the Rewards panel asks
   * about those, and the publish dialog warns about conflicting drafts.
   */
  const ensureSynced = useCallback(
    async (characterId: number) => {
      if (!board?.rewards[characterId]?.lines.length && !(drafts.data ?? []).some((d) => d.character_id === characterId && d.from_rewards)) return;
      const [rows, freshDrafts] = await Promise.all([
        qc.fetchQuery({ queryKey: gameSheetsKey(gameId), queryFn: () => apiClient.characters.getGameCharacterData(gameId).then((r) => r.data), staleTime: 0 }),
        qc.fetchQuery({ queryKey: phaseDraftsKey(gameId, phaseId), queryFn: () => apiClient.phases.listPhaseDraftCharacterUpdates(gameId, phaseId).then((r) => r.data), staleTime: 0 }),
      ]);
      const state = stateFor(characterId, undefined, rows[String(characterId)]);
      if (state.locked) return;
      const p = plan(characterId, freshDrafts, state);
      if (p.handMade.length && p.desired.length && !replaceAsked[characterId]) return;
      if (!p.inStep) await write(characterId, p.target, p.desired, !!replaceAsked[characterId], state.carrier.chain?.head.id);
    },
    [board?.rewards, drafts.data, qc, gameId, phaseId, stateFor, plan, write, replaceAsked],
  );

  const syncFor = useCallback((characterId: number): RewardSync => syncs[characterId] ?? { state: 'synced', handMade: [] }, [syncs]);
  const replaceHandMade = useCallback((characterId: number) => setReplaceAsked((s) => ({ ...s, [characterId]: true })), []);

  return {
    ready,
    layout,
    groups: settings?.rewardGroups ?? [],
    scales: settings?.scales ?? [],
    gameItems: settings?.rewardItems ?? [],
    phaseItems: board?.rewardItems ?? [],
    items,
    stateFor,
    syncFor,
    replaceHandMade,
    ensureSynced,
    updateRewards,
    addLine,
    giveItem,
    updateLine,
    removeLine,
    toggleItem,
    saveItem,
    removeItem,
  };
}

export type PhaseRewards = ReturnType<typeof usePhaseRewards>;
