import { useState } from 'react';
import { Badge, Button, Select } from '@/components/ui';
import { lineEffect, lineText } from '@/lib/gmBoard/rewards';
import { defaultGroup } from '@/lib/gmBoard/rewardState';
import { shortName, truncate } from '@/lib/gmBoard/text';
import type { BoardDoc, Scene } from '@/lib/gmBoard/types';
import { useOptionalBoardRewards } from './boardRewards';
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
 * The scene's sheet updates: reward lines made from it, each for one person
 * in the cast. They join that person's rewards in Write like any other line.
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

  const add = (characterId: number) => {
    if (rewards.stateFor(characterId).locked) return;
    const lineId = rewards.addLine(characterId, { group: defaultGroup(rewards.groups), text: '', ops: [], choose: false, sceneId: scene.id });
    setEditing({ characterId, lineId });
  };

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-theme-default surface-raised p-2" role="group" aria-label="Sheet updates from the scene" data-testid="scene-rewards">
      <span className="mr-1 text-xs font-medium text-content-tertiary">Sheet updates</span>
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
      {!fromScene.length && (
        <span className="text-xs text-content-secondary">
          {rewards.readOnly ? 'None.' : 'Rewards or sheet changes someone gets from this scene. They show up in Write with their other rewards.'}
        </span>
      )}
      {who.length > 0 && !rewards.readOnly && (
        <span className="w-48">
          <Select aria-label="Add a sheet update for someone in the scene" selectSize="sm" value="" onChange={(e) => e.target.value && add(Number(e.target.value))} data-testid="scene-add-reward">
            <option value="">+ Sheet update</option>
            {who.map((id) => (
              <option key={id} value={id} disabled={rewards.stateFor(id).locked}>
                {name(id)}
              </option>
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
