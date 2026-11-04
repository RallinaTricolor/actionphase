import { Badge, Button, Select } from '@/components/ui';
import CharacterAvatar from '@/components/characters/CharacterAvatar';
import { addEffect, laterSlots, updateEffect } from '@/lib/gmBoard/scenes';
import { stateAt } from '@/lib/gmBoard/states';
import { shortName } from '@/lib/gmBoard/text';
import type { CharState, Scene } from '@/lib/gmBoard/types';
import { STATE_LABELS, STATE_TONE } from './mapModel';
import type { SceneModel } from './sceneTypes';

interface SceneCastProps {
  model: SceneModel;
  onJoin: (characterId: number) => void;
  onLeave: (characterId: number) => void;
  /** Changes the scene's effects. */
  onEffects: (fn: (scene: Scene) => Scene) => void;
  onRemoveEffect: (index: number) => void;
}

const STATES = Object.keys(STATE_LABELS) as CharState[];

/**
 * Who is in the scene, with "+ someone", and what the scene does to them:
 * state effects that last from this time slot until a later one or the end
 * of the phase.
 */
export function SceneCast({ model, onJoin, onLeave, onEffects, onRemoveEffect }: SceneCastProps) {
  const { scene, board } = model;
  const name = (id: number) => model.names.get(id) ?? `Character ${id}`;
  const addable = [...model.cast.values()].filter((c) => !scene.participants.includes(c.id));
  const players = addable.filter((c) => !c.npc);
  const npcs = addable.filter((c) => c.npc);
  const later = laterSlots(board, scene);

  return (
    <div className="space-y-2 rounded-lg border border-theme-default surface-raised p-2" data-testid="scene-cast">
      <div className="flex flex-wrap items-center gap-1">
        <span className="mr-1 text-xs font-medium text-content-tertiary">Here</span>
        {scene.participants.map((id) => {
          const c = model.cast.get(id);
          const state = model.slotIndex >= 0 ? stateAt(model.states, id, model.slotIndex) : 'active';
          return (
            <span key={id} className="inline-flex items-center gap-1 rounded-full border border-theme-default surface-base py-0.5 pl-1 pr-0.5 text-sm">
              <CharacterAvatar avatarUrl={c?.avatarUrl} characterName={name(id)} size="xs" />
              <span className="text-content-primary">{shortName(name(id))}</span>
              {c?.npc && <span className="text-xs text-content-tertiary">NPC</span>}
              {c && !c.npc && !model.canRead(id) && <span className="text-xs text-content-tertiary">no player</span>}
              {state !== 'active' && (
                <Badge variant={STATE_TONE[state]} size="sm">
                  {STATE_LABELS[state]}
                </Badge>
              )}
              {!model.readOnly && (
                <Button type="button" size="sm" variant="ghost" className="!px-1 !py-0" aria-label={`Remove ${name(id)} from the scene`} onClick={() => onLeave(id)}>
                  ✕
                </Button>
              )}
            </span>
          );
        })}
        {!scene.participants.length && <span className="text-sm text-content-secondary">Nobody yet</span>}
        {addable.length > 0 && !model.readOnly && (
          <div className="w-44">
            <Select id="scene-add" aria-label="Add someone to the scene" selectSize="sm" value="" onChange={(e) => e.target.value && onJoin(Number(e.target.value))}>
              <option value="">+ someone</option>
              {players.length > 0 && (
                <optgroup label="Players">
                  {players.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </optgroup>
              )}
              {npcs.length > 0 && (
                <optgroup label="NPCs">
                  {npcs.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </optgroup>
              )}
            </Select>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="After the scene">
        <span className="mr-1 text-xs font-medium text-content-tertiary">After the scene</span>
        {model.readOnly && !scene.effects.length && <span className="text-xs text-content-secondary">Nothing lasting.</span>}
        {model.readOnly && scene.effects.map((e, i) => (
          <Badge key={i} variant={STATE_TONE[e.state]} data-testid={`effect-${i}`}>
            {shortName(name(e.characterId))}: {STATE_LABELS[e.state]}
            {e.untilChunkId ? `, back by ${board.chunks.find((c) => c.id === e.untilChunkId)?.name ?? 'a deleted time slot'}` : ', until the end of the phase'}
          </Badge>
        ))}
        {!model.readOnly && scene.effects.map((e, i) => (
          <span key={i} className="inline-flex items-center gap-1" data-testid={`effect-${i}`}>
            <span className="w-36">
              <Select id={`effect-${i}-who`} aria-label={`Effect ${i + 1}: who`} selectSize="sm" value={e.characterId} onChange={(ev) => onEffects((s) => updateEffect(s, i, { characterId: Number(ev.target.value) }))}>
                {[...new Set([...scene.participants, e.characterId])].map((id) => (
                  <option key={id} value={id}>
                    {name(id)}
                  </option>
                ))}
              </Select>
            </span>
            <span className="w-32">
              <Select id={`effect-${i}-state`} aria-label={`Effect ${i + 1}: state`} selectSize="sm" value={e.state} onChange={(ev) => onEffects((s) => updateEffect(s, i, { state: ev.target.value as CharState }))}>
                {STATES.map((st) => (
                  <option key={st} value={st}>
                    {STATE_LABELS[st]}
                  </option>
                ))}
              </Select>
            </span>
            <span className="w-56">
              <Select id={`effect-${i}-until`} aria-label={`Effect ${i + 1}: until`} selectSize="sm" value={e.untilChunkId ?? ''} onChange={(ev) => onEffects((s) => updateEffect(s, i, { untilChunkId: ev.target.value }))}>
                <option value="">until the end of the phase</option>
                {later.map((c) => (
                  <option key={c.id} value={c.id}>
                    back by {c.name}
                  </option>
                ))}
              </Select>
            </span>
            <Button type="button" size="sm" variant="ghost" className="!px-1" aria-label={`Remove effect ${i + 1}`} onClick={() => onRemoveEffect(i)}>
              ✕
            </Button>
          </span>
        ))}
        {!model.readOnly && (
          <>
            {!scene.effects.length && <span className="text-xs text-content-secondary">Who ends up injured, captured or out of play. The Map uses it to check later cards.</span>}
            <Button type="button" size="sm" variant="secondary" disabled={!scene.participants.length} onClick={() => onEffects((s) => addEffect(s, s.participants[0]))}>
              + State
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
