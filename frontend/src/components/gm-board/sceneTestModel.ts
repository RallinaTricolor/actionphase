import { makeBoard, makeScene } from '@/test-utils/factories';
import { canReadRule, type CastMember } from '@/lib/gmBoard/cast';
import { sceneReaders } from '@/lib/gmBoard/moments';
import { characterStates, chunkIndex } from '@/lib/gmBoard/states';
import type { BoardDoc, Scene } from '@/lib/gmBoard/types';
import type { SceneModel } from './sceneTypes';

// Hand-written test data for the Scenes step's tests; never player content.
const SCENE_CAST: CastMember[] = [
  { id: 1, name: 'Harrison Vale', npc: false, reads: true },
  { id: 2, name: 'Mara Quill', npc: false, reads: true },
  { id: 3, name: 'Ilse', npc: false, reads: true },
  { id: 4, name: 'Tov Brand', npc: false, reads: true },
  { id: 9, name: 'Bo Hale', npc: true },
];

export function sceneModel(scene: Partial<Scene> = {}, board: Partial<BoardDoc> = {}, secondPerson = true): SceneModel {
  const s = makeScene({ id: 's1', locationId: 'mill', chunkId: 'k2', ...scene });
  const full = makeBoard({ ...board, scenes: [s, ...(board.scenes ?? [])] });
  const canRead = canReadRule(SCENE_CAST);
  return {
    board: full,
    scene: s,
    names: new Map(SCENE_CAST.map((c) => [c.id, c.name])),
    cast: new Map(SCENE_CAST.map((c) => [c.id, c])),
    canRead,
    nameLists: new Map(SCENE_CAST.map((c) => [c.id, [c.name, c.name.split(' ')[0]]])),
    secondPerson,
    readers: sceneReaders(s, canRead),
    states: characterStates(full),
    slotIndex: chunkIndex(full).get(s.chunkId) ?? -1,
  };
}
