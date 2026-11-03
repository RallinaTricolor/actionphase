/**
 * The Map: the board's rows (locations), its time slots, and the moves the GM
 * makes on it (push later, drag a card, delete one). Pure: the components
 * turn the results into item edits.
 */

import { isIF, isWaiting } from './cards';
import { inPhase } from './codex';
import { chunkIndex } from './states';
import type { BoardDoc, Card, Chunk, CodexEntry } from './types';

/** The row for cards whose location is gone from the codex. */
export const NO_LOCATION = '__none__';

export interface BoardRow {
  id: string;
  name: string;
  aliases: string[];
  /**
   * `phase`: a Location for this phase. `other`: a Location scoped to other
   * phases that a card here still uses. `missing`: cards whose location was
   * deleted (or isn't a Location any more).
   */
  kind: 'phase' | 'other' | 'missing';
}

/**
 * The By location rows: this phase's Locations, then any other Location a
 * card here uses (so changing an entry's phases can't hide cards), then a
 * "No location" row when some card's location is gone.
 */
export function boardRows(codex: CodexEntry[], phaseId: number, cards: Pick<Card, 'locationId'>[]): BoardRow[] {
  const locations = codex.filter((e) => e.type === 'Location');
  const used = new Set(cards.map((c) => c.locationId));
  const row = (e: CodexEntry, kind: BoardRow['kind']): BoardRow => ({ id: e.id, name: e.name, aliases: e.aliases, kind });
  const rows = [
    ...locations.filter((e) => inPhase(e, phaseId)).map((e) => row(e, 'phase')),
    ...locations.filter((e) => !inPhase(e, phaseId) && used.has(e.id)).map((e) => row(e, 'other')),
  ];
  const known = new Set(rows.map((r) => r.id));
  if ([...used].some((id) => !known.has(id))) rows.push({ id: NO_LOCATION, name: 'No location', aliases: [], kind: 'missing' });
  return rows;
}

/** The row a card sits in. */
export const rowIdOf = (card: Pick<Card, 'locationId'>, rows: BoardRow[]) =>
  rows.some((r) => r.id === card.locationId && r.kind !== 'missing') ? card.locationId : NO_LOCATION;

// ── Time slots ──

export const sortedChunks = (chunks: Chunk[]) => [...chunks].sort((a, b) => a.position - b.position);

/** A position just before the slot at `index` (time order): the midpoint with the one before it. */
export function positionBefore(chunks: Chunk[], index: number): number {
  const sorted = sortedChunks(chunks);
  const at = sorted[index];
  if (!at) return positionAtEnd(chunks);
  const prev = sorted[index - 1];
  return prev ? (prev.position + at.position) / 2 : at.position - 1;
}

/** A position after the last slot. */
export function positionAtEnd(chunks: Chunk[]): number {
  return chunks.reduce((max, c) => Math.max(max, c.position), 0) + 1;
}

/** A name for a slot added at the end: the next "Slot N" that isn't taken. */
export function nextSlotName(chunks: Chunk[]): string {
  const taken = new Set(chunks.map((c) => c.name.trim().toLowerCase()));
  let n = chunks.filter((c) => !/^pre/i.test(c.name)).length + 1;
  while (taken.has(`slot ${n}`)) n++;
  return `Slot ${n}`;
}

/** A slot with no cards or scenes can be removed. */
export const isChunkEmpty = (board: Pick<BoardDoc, 'cards' | 'scenes'>, chunkId: string) =>
  !board.cards.some((c) => c.chunkId === chunkId) && !board.scenes.some((s) => s.chunkId === chunkId);

/**
 * "Push later": the card's character is delayed here, so each of their cards
 * in a later slot moves one slot later. This card stays. If one of them is in
 * the last slot, a slot is added at the end (`added`, named `addedName`).
 * Returns null when nothing is later.
 */
export function pushLater(
  board: Pick<BoardDoc, 'cards' | 'chunks'>,
  cardId: string,
  added: Pick<Chunk, 'id' | 'name'>,
): { moves: { cardId: string; chunkId: string }[]; addedChunk: Chunk | null } | null {
  const card = board.cards.find((c) => c.id === cardId);
  if (!card || card.chunkId === null) return null;
  const sorted = sortedChunks(board.chunks);
  const index = chunkIndex(board);
  const from = index.get(card.chunkId) ?? -1;
  const later = board.cards.filter(
    (c) => c.characterId === card.characterId && c.chunkId !== null && (index.get(c.chunkId) ?? -1) > from,
  );
  if (!later.length) return null;
  const needsSlot = later.some((c) => index.get(c.chunkId as string) === sorted.length - 1);
  const addedChunk = needsSlot ? { ...added, position: positionAtEnd(board.chunks) } : null;
  const slots = addedChunk ? [...sorted, addedChunk] : sorted;
  return {
    moves: later.map((c) => ({ cardId: c.id, chunkId: slots[(index.get(c.chunkId as string) as number) + 1].id })),
    addedChunk,
  };
}

/** How many of the card's character's cards are in later slots (what Push later would move). */
export function laterCardCount(board: Pick<BoardDoc, 'cards' | 'chunks'>, card: Card): number {
  if (card.chunkId === null) return 0;
  const index = chunkIndex(board);
  const from = index.get(card.chunkId) ?? -1;
  return board.cards.filter((c) => c.characterId === card.characterId && c.chunkId !== null && (index.get(c.chunkId) ?? -1) > from).length;
}

// ── Cards ──

export interface CauseGroup {
  /** `same`: this cell. `elsewhere`: this slot, other places. `before`: the slot before. `chosen`: picked earlier, now elsewhere. */
  kind: 'same' | 'elsewhere' | 'before' | 'chosen';
  /** The slot the group is about (for its heading). */
  chunkId: string | null;
  items: { id: string; scene: boolean }[];
}

/** What "Because of…" offers for a card: nearby cards and scenes, then any cause picked earlier that is now further away. */
export function causeCandidates(board: Pick<BoardDoc, 'cards' | 'scenes' | 'chunks'>, card: Card): CauseGroup[] {
  const sorted = sortedChunks(board.chunks);
  const i = sorted.findIndex((c) => c.id === card.chunkId);
  const prevId = i > 0 ? sorted[i - 1].id : null;
  const pick = (test: (o: { locationId: string; chunkId: string | null }) => boolean) => [
    ...board.scenes.filter(test).map((s) => ({ id: s.id, scene: true })),
    ...board.cards.filter((c) => c.id !== card.id && test(c)).map((c) => ({ id: c.id, scene: false })),
  ];
  const groups: CauseGroup[] = [];
  if (card.chunkId !== null) {
    groups.push({ kind: 'same', chunkId: card.chunkId, items: pick((o) => o.chunkId === card.chunkId && o.locationId === card.locationId) });
    groups.push({ kind: 'elsewhere', chunkId: card.chunkId, items: pick((o) => o.chunkId === card.chunkId && o.locationId !== card.locationId) });
  }
  if (prevId) groups.push({ kind: 'before', chunkId: prevId, items: pick((o) => o.chunkId === prevId) });
  const shown = new Set(groups.flatMap((g) => g.items.map((x) => x.id)));
  const sceneIds = new Set(board.scenes.map((s) => s.id));
  const cardIds = new Set(board.cards.map((c) => c.id));
  const chosen = card.causedBy.filter((id) => !shown.has(id) && (sceneIds.has(id) || cardIds.has(id)));
  if (chosen.length) groups.push({ kind: 'chosen', chunkId: null, items: chosen.map((id) => ({ id, scene: sceneIds.has(id) })) });
  return groups.filter((g) => g.items.length);
}

/** Deleting a card: the other cards that cite it, with the citation removed. */
export function cardsCiting(cards: Card[], cardId: string): Card[] {
  return cards
    .filter((c) => c.id !== cardId && (c.causedBy.includes(cardId) || c.branchOf === cardId))
    .map((c) => ({ ...c, causedBy: c.causedBy.filter((id) => id !== cardId), branchOf: c.branchOf === cardId ? null : c.branchOf }));
}

export type DropResult =
  | { ok: true; fields: Pick<Card, 'chunkId'> & Partial<Pick<Card, 'locationId'>>; triggered: boolean }
  | { ok: false; reason: 'other-character' | 'not-if' | 'no-location' };

/**
 * Dropping a card on a cell. A cell names its slot (null: Contingencies), and
 * its location (By location) or its character (By character). Cards stay
 * with their character, and only IF cards wait in Contingencies. A waiting IF
 * card dropped in a slot has triggered.
 */
export function dropCard(card: Card, target: { chunkId: string | null; locationId?: string; characterId?: number }): DropResult {
  if (target.characterId !== undefined && target.characterId !== card.characterId) return { ok: false, reason: 'other-character' };
  if (target.chunkId === null && !isIF(card)) return { ok: false, reason: 'not-if' };
  if (target.locationId === NO_LOCATION) return { ok: false, reason: 'no-location' };
  const fields: Pick<Card, 'chunkId'> & Partial<Pick<Card, 'locationId'>> = { chunkId: target.chunkId };
  if (target.locationId !== undefined) fields.locationId = target.locationId;
  return { ok: true, fields, triggered: isWaiting(card) && target.chunkId !== null };
}

// ── Who is where ──

/** Everyone with a live card or a scene in a slot. */
export function presentInChunk(board: Pick<BoardDoc, 'cards' | 'scenes'>, chunkId: string): Set<number> {
  const here = new Set<number>();
  board.cards.forEach((c) => c.chunkId === chunkId && c.outcome !== 'moot' && here.add(c.characterId));
  board.scenes.forEach((s) => s.chunkId === chunkId && s.participants.forEach((p) => here.add(p)));
  return here;
}

/**
 * Where a character is by slot `index`: the location of their latest scene or
 * live card at or before it, or null. "+ GM card" in their row starts there.
 */
export function locationAt(board: Pick<BoardDoc, 'cards' | 'scenes' | 'chunks'>, characterId: number, index: number): string | null {
  const sorted = sortedChunks(board.chunks);
  for (let k = Math.min(index, sorted.length - 1); k >= 0; k--) {
    const id = sorted[k].id;
    const scene = board.scenes.find((s) => s.chunkId === id && s.participants.includes(characterId));
    if (scene) return scene.locationId;
    const card = board.cards.find((c) => c.characterId === characterId && c.chunkId === id && c.outcome !== 'moot');
    if (card) return card.locationId;
  }
  return null;
}

/**
 * Groups of players who share a cell somewhere on the board, biggest first,
 * for "Make cluster". Players who share nothing are groups of one.
 */
export function suggestClusters(board: Pick<BoardDoc, 'cards' | 'scenes'>, playerIds: number[]): number[][] {
  const parent = new Map(playerIds.map((id) => [id, id]));
  const find = (id: number): number => {
    const p = parent.get(id) as number;
    if (p === id) return id;
    const root = find(p);
    parent.set(id, root);
    return root;
  };
  const cells = new Map<string, Set<number>>();
  const add = (locationId: string, chunkId: string, id: number) => {
    if (!parent.has(id)) return;
    const key = `${locationId}|${chunkId}`;
    const s = cells.get(key) ?? new Set<number>();
    cells.set(key, s);
    s.add(id);
  };
  board.cards.forEach((c) => c.chunkId !== null && c.outcome !== 'moot' && add(c.locationId, c.chunkId, c.characterId));
  board.scenes.forEach((s) => s.participants.forEach((p) => add(s.locationId, s.chunkId, p)));
  for (const people of cells.values()) {
    const [first, ...rest] = [...people];
    rest.forEach((id) => parent.set(find(id), find(first)));
  }
  const groups = new Map<number, number[]>();
  playerIds.forEach((id) => {
    const root = find(id);
    groups.set(root, [...(groups.get(root) ?? []), id]);
  });
  return [...groups.values()].sort((a, b) => b.length - a.length);
}
