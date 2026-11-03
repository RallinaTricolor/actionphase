import type { CastMember } from '@/lib/gmBoard/cast';
import type { BoardDoc, Scene } from '@/lib/gmBoard/types';

/** What the Write step's panes share. */
export interface WriteModel {
  board: BoardDoc;
  /** characterId → full name. */
  names: Map<number, string>;
  /** characterId → the names "Make it 'you'" swaps. */
  nameLists: Map<number, string[]>;
  cast: Map<number, CastMember>;
  secondPerson: boolean;
  placeName: (locationId: string) => string;
  slotName: (chunkId: string | null) => string;
  sceneName: (scene: Scene) => string;
}
