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
  /** This phase's own reward list (the `reward` board items). */
  rewardItems: RewardItem[];
  /** characterId → their reward lines and text slots (the `rewards` items). */
  rewards: Record<number, CharacterRewards>;
}

// ------------------------------------------------------------------ rewards

/**
 * One change to a character sheet. `tab` is the tab key; `entry` names the
 * entry (case doesn't matter); `field` is a field key, defaulting to the tab's
 * first number or track field for `inc`.
 */
export type SheetOp =
  | { act: 'inc'; tab: string; entry: string; field?: string; by: number }
  | { act: 'set'; tab: string; entry: string; field: string; value: string }
  | { act: 'add'; tab: string; entry: string; fields: Record<string, unknown> }
  | { act: 'remove'; tab: string; entry: string };

/** A reward defined once in a list and given to many characters. */
export interface RewardItem {
  id: string;
  /** Every phase (a game setting) or this phase only (a board item). */
  scope: 'game' | 'phase';
  name: string;
  /** A section key from the game's reward groups. */
  group: string;
  /** Block text. `{{entry}}`, `{{before}}` and `{{after}}` fill in from the first op. */
  text: string;
  ops: SheetOp[];
  /** "Choose 1": the text goes in the block, nothing goes on the sheet. */
  choose: boolean;
  position: number;
}

/** What one character got: a copy of a list item, or a one-off. */
export interface RewardLine {
  id: string;
  /** The list item it was given from, if any. */
  itemId?: string;
  /** The item's signature when given or last synced, for "differs from the list". */
  itemSig?: string;
  group: string;
  text: string;
  ops: SheetOp[];
  choose: boolean;
  /** The submission passage it was awarded for. */
  quote?: string;
  /** The scene it was made from. */
  sceneId?: string;
}

/** A character's rewards in one phase (the `rewards` item, keyed by character). */
export interface CharacterRewards {
  lines: RewardLine[];
  /** `{{text Slot}}` boxes: slot name → text. */
  texts: Record<string, string>;
  /** The head of the result the GM picked to carry the sheet changes. */
  carrierHeadId?: number;
  /** The block text last put in the result, so the next put replaces it. */
  block?: string;
}

export type CodexType = 'Location' | 'NPC' | 'Item' | 'Faction' | 'Objective' | 'Secret' | 'Other';

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
  /** `name` is the Tab/Entry[/Field] ref that `{{label …}}` looks up. */
  scales: { name: string; steps: { min: number; label: string }[] }[];
  /** The every-phase reward list (the `reward` settings items). */
  rewardItems: RewardItem[];
  /** "Make 'you'": on unless the GM turns it off. */
  secondPerson: boolean;
  /** The GM's notes for every phase (the board's own `notes` are one phase's). */
  notes: string;
}
