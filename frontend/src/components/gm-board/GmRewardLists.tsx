import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Badge, Button, Select, Spinner } from '@/components/ui';
import { useGameContext } from '@/contexts/GameContext';
import { useGmBoard, useGmBoardStore, useGmSettings, useGmSettingsStore } from '@/hooks/useGmBoard';
import { useBoardReadOnly } from '@/hooks/useBoardReadOnly';
import { useSheetLayout } from '@/hooks/useSheetLayout';
import { apiClient } from '@/lib/api';
import { lineEffect, lineFromItem, sheetTabsFrom } from '@/lib/gmBoard/rewards';
import { defaultGroup } from '@/lib/gmBoard/rewardState';
import { newItemKey } from '@/lib/gmBoard/store';
import { truncate } from '@/lib/gmBoard/text';
import type { CharacterRewards, RewardItem } from '@/lib/gmBoard/types';
import { GmBoardConflicts } from './GmBoardConflicts';
import { RewardItemEditor } from './RewardEditors';

interface GmRewardListsProps {
  gameId: number;
  phases: { id: number; title: string }[];
  /** Who can be given rewards, for the given-to chips. */
  players: { id: number; name: string }[];
}

/**
 * Game setup's reward lists: rewards defined once and given to many from
 * Write. The every-phase list is a game setting; each action phase has its
 * own list, which can be filled in before the phase starts.
 */
export function GmRewardLists({ gameId, phases, players }: GmRewardListsProps) {
  const { game } = useGameContext();
  const layout = useSheetLayout(game).tabs;
  const { settings, isLoading } = useGmSettings(gameId);
  const settingsStore = useGmSettingsStore(gameId);
  const readOnly = useBoardReadOnly();
  const [phaseId, setPhaseId] = useState<number | null>(phases[phases.length - 1]?.id ?? null);
  const activePhase = phaseId ?? phases[phases.length - 1]?.id ?? 0;
  const { board } = useGmBoard(gameId, activePhase, { enabled: activePhase > 0 });
  const boardStore = useGmBoardStore(gameId, activePhase);
  const [editing, setEditing] = useState<{ id: string; scope: RewardItem['scope'] } | null>(null);
  const sheets = useQuery({
    queryKey: ['gameCharacterData', gameId],
    queryFn: () => apiClient.characters.getGameCharacterData(gameId).then((r) => r.data),
    enabled: gameId > 0,
    staleTime: 60_000,
  });

  const groups = settings?.rewardGroups ?? [];
  const gameItems = settings?.rewardItems ?? [];
  const phaseItems = board?.rewardItems ?? [];
  const phaseTitle = phases.find((p) => p.id === activePhase)?.title;

  // Every player's entries per tab, for the entry picker on a list item.
  const entryNames = useMemo(() => {
    const byTab = new Map<string, Set<string>>();
    for (const rows of Object.values(sheets.data ?? {})) {
      const tabs = sheetTabsFrom(rows, layout);
      for (const [key, entries] of Object.entries(tabs)) for (const e of entries) byTab.set(key, (byTab.get(key) ?? new Set()).add(e.name));
    }
    return (tabKey: string) => [...(byTab.get(tabKey) ?? [])].sort();
  }, [sheets.data, layout]);

  const given = (itemId: string) => Object.entries(board?.rewards ?? {}).filter(([, r]) => r.lines.some((l) => l.itemId === itemId)).map(([id]) => Number(id));

  const save = (item: RewardItem) => {
    const { id, scope, ...doc } = item;
    if (scope === 'game') settingsStore.update('reward', id, () => doc);
    else boardStore.update('reward', id, () => doc);
  };
  const remove = (item: RewardItem) => (item.scope === 'game' ? settingsStore.remove('reward', item.id) : boardStore.remove('reward', item.id));
  const create = (scope: RewardItem['scope']) => {
    const list = scope === 'game' ? gameItems : phaseItems;
    const item: RewardItem = { id: newItemKey('rw'), scope, name: '', group: defaultGroup(groups), text: '', ops: [], choose: false, position: (list[list.length - 1]?.position ?? 0) + 1 };
    save(item);
    setEditing({ id: item.id, scope });
  };
  const move = (item: RewardItem, scope: RewardItem['scope']) => {
    if (item.scope === scope || (scope === 'phase' && !activePhase)) return;
    const list = scope === 'game' ? gameItems : phaseItems;
    // Saved under the same id, so given copies still know where they came from.
    save({ ...item, scope, position: (list[list.length - 1]?.position ?? 0) + 1 });
    remove(item);
    setEditing({ id: item.id, scope });
  };
  const toggleGiven = (item: RewardItem, characterId: number) =>
    boardStore.update<CharacterRewards>('rewards', String(characterId), (cur) => {
      const r = { lines: [], texts: {}, ...cur };
      return r.lines.some((l) => l.itemId === item.id)
        ? { ...r, lines: r.lines.filter((l) => l.itemId !== item.id) }
        : { ...r, lines: [...r.lines, lineFromItem(item, newItemKey('rl'))] };
    });

  if (isLoading || !settings) return <Spinner />;

  const editingItem = editing ? (editing.scope === 'game' ? gameItems : phaseItems).find((i) => i.id === editing.id) ?? null : null;

  const list = (items: RewardItem[]) => {
    if (!items.length) return <p className="text-sm text-content-secondary">Nothing yet.</p>;
    const sections = [...groups.map((g) => g.key), ...new Set(items.map((i) => i.group).filter((k) => !groups.some((g) => g.key === k)))];
    return sections.map((key) => {
      const inSection = items.filter((i) => i.group === key);
      if (!inSection.length) return null;
      const label = groups.find((g) => g.key === key)?.label;
      return (
        <div key={key} className="space-y-1">
          <p className="text-xs text-content-tertiary">{label ?? `${key} (not a section in the reward block)`}</p>
          {inSection.map((i) => (
            <div key={i.id} className="flex items-start gap-2 rounded border border-theme-default p-2" data-testid={`reward-item-${i.id}`}>
              <div className="min-w-0 flex-1 text-sm">
                <p className="font-medium text-content-primary">
                  {i.name || 'Unnamed'}{' '}
                  {i.choose && (
                    <Badge size="sm" variant="warning">
                      Player chooses
                    </Badge>
                  )}
                </p>
                <p className={readOnly ? 'whitespace-pre-wrap text-content-secondary' : 'text-content-secondary'}>{readOnly ? i.text : truncate(i.text, 90)}</p>
                {!i.choose && i.ops.length > 0 && <p className="text-xs text-content-tertiary">{lineEffect(layout, i)}</p>}
              </div>
              {board && <span className="text-xs text-content-tertiary">{given(i.id).length} given</span>}
              {!readOnly && (
                <Button type="button" size="sm" variant="ghost" onClick={() => setEditing({ id: i.id, scope: i.scope })}>
                  Edit
                </Button>
              )}
            </div>
          ))}
        </div>
      );
    });
  };

  return (
    <div className="space-y-6" data-testid="gm-reward-lists">
      {!readOnly && boardStore.lost.length > 0 && (
        // The page shows the game settings' conflicts; a phase's list saves to that phase's board.
        <div data-testid="reward-list-conflicts">
          <GmBoardConflicts lost={boardStore.lost} onKeepMine={boardStore.keepMine} onDismiss={boardStore.dismissLost} />
        </div>
      )}
      <p className="text-sm text-content-secondary">
        {readOnly
          ? 'Rewards the GM defines once and gives to people from Write. Everyone who gets one gets a copy of the same text and sheet change.'
          : 'Define each reward once, then give it to people from Write. Everyone who gets it gets a copy of the same text and sheet change.'}
      </p>
      <section className="space-y-2">
        <h3 className="text-base font-semibold text-content-primary">Every phase</h3>
        <p className="text-sm text-content-secondary">Rewards you hand out in every phase: scenario results, minor objectives, recurring prizes.</p>
        {list(gameItems)}
        {!readOnly && (
          <Button type="button" size="sm" variant="secondary" onClick={() => create('game')} data-testid="new-game-reward">
            + Reward for every phase
          </Button>
        )}
      </section>
      <section className="space-y-2">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h3 className="text-base font-semibold text-content-primary">One phase only</h3>
          {phases.length > 0 && (
            <Select id="reward-list-phase-box" label="Phase" selectSize="sm" value={String(activePhase)} onChange={(e) => setPhaseId(Number(e.target.value))} data-testid="reward-list-phase">
              {phases.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </Select>
          )}
        </div>
        {phases.length === 0 ? (
          <p className="text-sm text-content-secondary">This game has no action phases yet. Each one gets its own list once it’s created.</p>
        ) : (
          <>
            <p className="text-sm text-content-secondary">This phase’s own bonus objectives and one-offs. “Given” counts are for this phase.</p>
            {list(phaseItems)}
            {!readOnly && (
              <Button type="button" size="sm" variant="secondary" onClick={() => create('phase')} disabled={!board} data-testid="new-phase-reward">
                + Reward for {phaseTitle}
              </Button>
            )}
          </>
        )}
      </section>

      <RewardItemEditor
        item={readOnly ? null : editingItem}
        onClose={() => setEditing(null)}
        phaseTitle={activePhase ? phaseTitle : undefined}
        groups={groups}
        layout={layout}
        entryNames={entryNames}
        onChange={save}
        onMove={editingItem ? (scope) => move(editingItem, scope) : undefined}
        onDelete={() => {
          if (editingItem) remove(editingItem);
          setEditing(null);
        }}
        givenTo={board && editingItem ? players.map((p) => ({ ...p, given: given(editingItem.id).includes(p.id) })) : undefined}
        onToggleGiven={editingItem ? (id) => toggleGiven(editingItem, id) : undefined}
      />
    </div>
  );
}
