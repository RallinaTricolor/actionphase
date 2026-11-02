/**
 * The GM results board's data model: the shapes `assembleBoard` and
 * `assembleSettings` build from stored items, and the shapes the board's logic
 * takes. IDs inside these documents are client-generated strings; characters,
 * phases and results use their database IDs. Locations are codex entries, so
 * they use the codex entry's id.
 *
 * Each card, scene, chunk and cluster is stored as its own item, keyed by its
 * id, with the rest of the object as the item's doc. See `store.ts`.
 */

export type Outcome = 'pending' | 'happened' | 'partial' | 'failed' | 'interrupted' | 'moot';

export type StanceValue = 'ally' | 'deal' | 'neutral' | 'wary' | 'target' | 'ally_target';

export type CharState = 'active' | 'injured' | 'captured' | 'incapacitated' | 'dead';

export interface Chunk {
  id: string;
  name: string;
  /** Sort key; inserting between two chunks takes the midpoint. */
  position: number;
}

export interface Card {
  id: string;
  characterId: number;
  quote: string;
  summary: string;
  note: string;
  locationId: string;
  /** null: an IF card still waiting in Contingencies. */
  chunkId: string | null;
  outcome: Outcome;
  /** Card or scene ids. */
  causedBy: string[];
  isIF: boolean;
  cond: string;
  branchOf: string | null;
  /** Submission paragraph indexes the card came from. */
  src: number[];
  /** Made by the GM ("+ Card"), not from a submission: labelled "GM card" and left out of a player's card count. */
  gm: boolean;
}

export interface Moment {
  id: string;
  text: string;
  /** Empty: a private GM note. */
  readers: number[];
  /** characterId → that reader's own version. */
  ownText: Record<number, string>;
  cardId?: string;
  ref?: { characterId: number; quote: string };
}

interface StateEffect {
  characterId: number;
  state: CharState;
  untilChunkId?: string;
}

export interface Scene {
  id: string;
  title: string;
  locationId: string;
  chunkId: string;
  /** The GM marked it a conflict: the Map shows a Conflict pill instead of Scene. */
  conflict: boolean;
  participants: number[];
  moments: Moment[];
  effects: StateEffect[];
}

export interface Cluster {
  id: string;
  name: string;
  characterIds: number[];
}

export interface Stance {
  value: StanceValue | '';
  note?: string;
}

/** The `progress` item, one per character. */
export interface CharacterProgress {
  readDone?: boolean;
  ready?: boolean;
  /** momentId → an explicit covered tick (true) or untick (false). */
  covered?: Record<string, boolean>;
}

/** One action phase's board. */
export interface BoardDoc {
  chunks: Chunk[];
  cards: Card[];
  scenes: Scene[];
  clusters: Cluster[];
  /** Keyed `${fromCharacterId}|${toCharacterId}`. */
  stances: Record<string, Stance>;
  readDone: Record<number, boolean>;
  ready: Record<number, boolean>;
  covered: Record<number, Record<string, boolean>>;
  dismissedFlags: Record<string, true>;
  /** GM scratch notes. */
  notes: string;
}

type CodexType = 'Location' | 'NPC' | 'Item' | 'Faction' | 'Objective' | 'Secret' | 'Other';

export interface CodexEntry {
  id: string;
  type: CodexType;
  name: string;
  aliases: string[];
  notes: string;
  secret: boolean;
  /** For a secret: the characters allowed to know it, so the leak check skips them. */
  knownBy: number[];
  /** Phase ids it applies to; empty means every phase. */
  phases: number[];
}

/** A game's board setup. Sharing is `games.share_gm_board`, not part of this. */
export interface GameBoardSettings {
  codex: CodexEntry[];
  /** characterId → the names matched in text (default: full name and first word). */
  names: Record<number, string[]>;
  rewardTemplate: string;
  rewardGroups: { key: string; label: string }[];
  scales: { name: string; steps: { min: number; label: string }[] }[];
  /** "Make 'you'": on unless the GM turns it off. */
  secondPerson: boolean;
}
