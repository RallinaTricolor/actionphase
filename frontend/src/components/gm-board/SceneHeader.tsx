import { Button, Checkbox, Input, Select } from '@/components/ui';
import { useBoundText } from '@/hooks/useBoundText';
import type { BoardRow } from '@/lib/gmBoard/map';
import { castNames, sceneGroups, sceneName, sceneNeighbours } from '@/lib/gmBoard/scenes';
import type { Chunk, Scene } from '@/lib/gmBoard/types';
import type { SceneModel } from './sceneTypes';

interface SceneHeaderProps {
  model: SceneModel;
  slots: Chunk[];
  /** Locations a scene can be moved to. */
  locations: BoardRow[];
  placeName: (locationId: string) => string;
  onGo: (sceneId: string) => void;
  onChange: (fields: Partial<Pick<Scene, 'title' | 'locationId' | 'chunkId' | 'conflict'>>) => void;
  onDelete: () => void;
}

/**
 * The top of the Scenes step: every scene grouped by time slot, previous and
 * next in time order, and the open scene's title, place, time and Conflict tick.
 */
export function SceneHeader({ model, slots, locations, placeName, onGo, onChange, onDelete }: SceneHeaderProps) {
  const { scene, board, names } = model;
  const groups = sceneGroups(board);
  const { prev, next, index, total } = sceneNeighbours(board, scene.id);
  const title = useBoundText(scene.title);
  const placeKnown = locations.some((l) => l.id === scene.locationId);
  const slotKnown = slots.some((s) => s.id === scene.chunkId);

  return (
    <div className="space-y-2" data-testid="scene-header">
      <div className="flex flex-wrap items-center gap-2">
        <div className="w-80">
          <Select id="scene-picker" aria-label="Go to a scene" selectSize="sm" value={scene.id} onChange={(e) => onGo(e.target.value)}>
            {groups.map((g) => (
              <optgroup key={g.chunk?.id ?? '__gone'} label={g.chunk?.name ?? 'Deleted time slot'}>
                {g.scenes.map((s) => (
                  <option key={s.id} value={s.id}>
                    {placeName(s.locationId)} · {sceneName(s, names)}
                  </option>
                ))}
              </optgroup>
            ))}
          </Select>
        </div>
        <Button type="button" size="sm" variant="secondary" disabled={!prev} onClick={() => prev && onGo(prev.id)}>
          ← Previous
        </Button>
        <Button type="button" size="sm" variant="secondary" disabled={!next} onClick={() => next && onGo(next.id)}>
          Next →
        </Button>
        <span className="text-xs text-content-tertiary">
          Scene {index + 1} of {total}
        </span>
        <span className="flex-1" />
        <Button type="button" size="sm" variant="ghost" onClick={onDelete}>
          Delete scene
        </Button>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[16rem] flex-1">
          <Input
            id="scene-title"
            aria-label="Scene title"
            placeholder={castNames(scene.participants, names, 6)}
            value={title.text}
            {...title.bind}
            onChange={(e) => {
              title.setText(e.target.value);
              onChange({ title: e.target.value });
            }}
          />
        </div>
        <div className="w-48">
          <Select id="scene-location" aria-label="Location" selectSize="sm" value={scene.locationId} onChange={(e) => onChange({ locationId: e.target.value })}>
            {!placeKnown && <option value={scene.locationId}>{placeName(scene.locationId)}</option>}
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="w-40">
          <Select id="scene-slot" aria-label="Time slot" selectSize="sm" value={scene.chunkId} onChange={(e) => onChange({ chunkId: e.target.value })}>
            {!slotKnown && <option value={scene.chunkId}>Deleted time slot</option>}
            {slots.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </div>
        <Checkbox
          id="scene-conflict"
          label="Conflict"
          title="The Map shows a Conflict pill for this cell"
          checked={scene.conflict}
          onChange={(e) => onChange({ conflict: e.target.checked })}
        />
      </div>
    </div>
  );
}
