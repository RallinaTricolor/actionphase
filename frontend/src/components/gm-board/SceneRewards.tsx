import { useState } from 'react';
import { Badge, Button, HelpTooltip, Select } from '@/components/ui';
import { lineEffect, lineText } from '@/lib/gmBoard/rewards';
import { defaultGroup } from '@/lib/gmBoard/rewardState';
import { shortName, truncate } from '@/lib/gmBoard/text';
import type { BoardDoc, Scene } from '@/lib/gmBoard/types';
import { useOptionalBoardRewards } from './boardRewards';
import { TOOLBAR_LABEL } from './boardToolbarSlot';
import { RewardLineEditor } from './RewardEditors';

interface SceneRewardsProps {
  scene: Scene;
  board: BoardDoc;
  names: ReadonlyMap<number, string>;
  /** Who can get a result: only they get rewards. */
  canRead: (characterId: number) => boolean;
  sceneName: string;
}

/**
 * What people get from the scene: rewards (in the reward block) and sheet
 * changes (damage, an item used up), each for one person in the cast. They
 * join that person's lines in Write like any other.
 */
export function SceneRewards({ scene, board, names, canRead, sceneName }: SceneRewardsProps) {
  const rewards = useOptionalBoardRewards();
  const [editing, setEditing] = useState<{ characterId: number; lineId: string } | null>(null);
  if (!rewards) return null;

  const name = (id: number) => names.get(id) ?? `Character ${id}`;
  const fromScene = Object.entries(board.rewards).flatMap(([id, r]) => r.lines.filter((l) => l.sceneId === scene.id).map((line) => ({ characterId: Number(id), line })));
  const who = scene.participants.filter(canRead);
  const editingState = editing ? rewards.stateFor(editing.characterId) : null;
  const line = editingState?.lines.find((l) => l.id === editing?.lineId) ?? null;

  const add = (choice: string) => {
    const [kind, id] = choice.split(':');
    const characterId = Number(id);
    if (kind !== 'reward' && kind !== 'sheet') return;
    if (rewards.stateFor(characterId).locked) return;
    const lineId = rewards.addLine(characterId, { kind, group: defaultGroup(rewards.groups), text: '', ops: [], choose: false, sceneId: scene.id });
    setEditing({ characterId, lineId });
  };

  return (
    <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Rewards and sheet changes from the scene" data-testid="scene-rewards">
      <span className={`mr-1 ${TOOLBAR_LABEL}`}>Rewards &amp; sheet</span>
      {fromScene.map(({ characterId, line: l }) => {
        const state = rewards.stateFor(characterId);
        const summary = lineText(l, state.sheet.recs[l.id]).trim() || lineEffect(rewards.layout, l) || 'Nothing yet';
        if (rewards.readOnly) {
          return (
            <Badge key={l.id} variant="neutral" title={summary} data-testid={`scene-reward-${l.id}`}>
              {shortName(name(characterId))}: {truncate(summary, 60)}
            </Badge>
          );
        }
        return (
          <Button key={l.id} type="button" size="sm" variant="outline" onClick={() => setEditing({ characterId, lineId: l.id })} data-testid={`scene-reward-${l.id}`}>
            {shortName(name(characterId))}: {truncate(summary, 40)}
          </Button>
        );
      })}
      {!fromScene.length && rewards.readOnly && <span className="text-xs text-content-secondary">None.</span>}
      {!rewards.readOnly && (
        <HelpTooltip text="What someone gets from this scene. A reward goes in their reward block; a sheet change (damage, an item used up) only changes their sheet. Both show up in Write." />
      )}
      {who.length > 0 && !rewards.readOnly && (
        <span>
          <Select aria-label="Add a reward or sheet change for someone in the scene" selectSize="sm" value="" onChange={(e) => e.target.value && add(e.target.value)} data-testid="scene-add-reward">
            <option value="">+ Add</option>
            {(['reward', 'sheet'] as const).map((kind) => (
              <optgroup key={kind} label={kind === 'reward' ? 'Reward for' : 'Sheet change for'}>
                {who.map((id) => (
                  <option key={id} value={`${kind}:${id}`} disabled={rewards.stateFor(id).locked}>
                    {name(id)}
                  </option>
                ))}
              </optgroup>
            ))}
          </Select>
        </span>
      )}
      <RewardLineEditor
        line={line}
        onClose={() => setEditing(null)}
        characterName={editing ? name(editing.characterId) : ''}
        item={line?.itemId ? rewards.items.find((i) => i.id === line.itemId) : undefined}
        sceneName={sceneName}
        groups={rewards.groups}
        layout={rewards.layout}
        entryNames={(tab) => (editingState?.sheet.before[tab] ?? []).map((e) => e.name)}
        sheet={editingState ? { live: editingState.sheet.before, lines: editingState.lines } : undefined}
        locked={editingState?.locked}
        onChange={(next) => editing && rewards.updateLine(editing.characterId, next.id, () => next)}
        onRemove={() => {
          if (editing) rewards.removeLine(editing.characterId, editing.lineId);
          setEditing(null);
        }}
      />
    </div>
  );
}
