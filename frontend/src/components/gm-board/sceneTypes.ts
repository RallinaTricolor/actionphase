import type { CastMember } from '@/lib/gmBoard/cast';
import type { CanRead } from '@/lib/gmBoard/moments';
import type { BoardDoc, CharState, Moment, Scene } from '@/lib/gmBoard/types';

/** What every part of the Scenes step reads: the open scene and the board around it. */
export interface SceneModel {
  board: BoardDoc;
  scene: Scene;
  names: Map<number, string>;
  cast: Map<number, CastMember>;
  canRead: CanRead;
  /** characterId → the names "Make it 'you'" swaps. */
  nameLists: Map<number, string[]>;
  secondPerson: boolean;
  /** Everyone who reads the scene: the cast who can read, then anyone elsewhere ticked on a moment. */
  readers: number[];
  states: Record<number, CharState[]>;
  /** The scene's time slot, as an index in time order (-1 if it was deleted). */
  slotIndex: number;
  /** Read-only: the scene and its moments as text, with no editing controls. */
  readOnly?: boolean;
}

/** The last place the GM's cursor was in a moment, for Insert. */
export interface MomentField {
  momentId: string;
  /** Whose own version, or null for the shared text. */
  readerId: number | null;
  start: number;
  end: number;
}

export interface MomentActions {
  change: (momentId: string, fn: (m: Moment) => Moment) => void;
  addAfter: (momentId: string | null) => void;
  move: (momentId: string, by: -1 | 1) => void;
  remove: (momentId: string) => void;
  focus: (momentId: string) => void;
  /** The cursor moved in a moment's box. */
  field: (field: MomentField) => void;
}

/** The id of a moment's text box (shared, or one reader's own version), so Insert and Ctrl+Enter can find it. */
export const momentTextId = (momentId: string, readerId: number | null) =>
  readerId === null ? `moment-${momentId}-text` : `moment-${momentId}-own-${readerId}`;
