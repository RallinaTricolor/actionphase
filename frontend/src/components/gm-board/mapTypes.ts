import type { CastMember } from '@/lib/gmBoard/cast';
import type { BoardFlag } from '@/lib/gmBoard/flags';
import type { BoardRow } from '@/lib/gmBoard/map';
import type { BoardDoc, Card, CharState, Chunk } from '@/lib/gmBoard/types';

/** What every Map view reads: the board plus what's derived from it once. */
export interface MapModel {
  board: BoardDoc;
  /** Time slots in time order. */
  slots: Chunk[];
  rows: BoardRow[];
  names: Map<number, string>;
  /** characterId → the names the board knows them by, for trimming card labels. */
  nameLists: Map<number, string[]>;
  cast: Map<number, CastMember>;
  /** Players who submitted this phase. */
  submitters: Set<number>;
  flags: BoardFlag[];
  /** Flags not dismissed. */
  open: BoardFlag[];
  /** Cards flagged as played by someone out of play. */
  outCards: Set<string>;
  states: Record<number, CharState[]>;
  /** The cluster filter: only these characters, or everyone (null). */
  visible: Set<number> | null;
  /** The slot being resolved, or null. */
  resolving: string | null;
}

/** Where a dragged card is dropped: a slot (null: Contingencies) and its row. */
export interface DropTarget {
  chunkId: string | null;
  locationId?: string;
  characterId?: number;
}

export interface MapActions {
  openCard: (id: string) => void;
  /** Starts "+ GM cards" with the cell's place, time or character filled in. */
  addGmCards: (prefill: { characterIds?: number[]; locationId?: string; chunkId?: string }) => void;
  moveCard: (card: Card, target: DropTarget) => void;
  renameSlot: (id: string, name: string) => void;
  insertSlotBefore: (index: number) => void;
  removeSlot: (id: string) => void;
  resolveAt: (id: string) => void;
  readSubmission: (characterId: number) => void;
  openStances: (characterId: number) => void;
}

/** The drag in progress, shared by the cells so they can show where it will land. */
export interface DragState {
  cardId: string | null;
  start: (cardId: string) => void;
  end: () => void;
}
