/**
 * Board flags: things on the Map that are probably mistakes. Each flag has a
 * stable key, so a dismissal (a `flag` item with that key) sticks while the
 * board changes around it, and comes back only if the same problem is new
 * again under a different key.
 */

import { isWaiting } from './cards';
import { characterStates, chunkIndex, outEntering } from './states';
import type { BoardDoc, CharState } from './types';

export type BoardFlag =
  /** Someone out of play has a live card, or is in a scene, in this slot. */
  | { kind: 'out'; key: string; characterId: number; chunkId: string; state: CharState; cardId?: string; sceneId?: string }
  /** Someone is in two or more places in one slot. */
  | { kind: 'two'; key: string; characterId: number; chunkId: string; locationIds: string[] }
  /** Two or more people share a cell with no scene. */
  | { kind: 'meeting'; key: string; locationId: string; chunkId: string; characterIds: number[] }
  /** A placed card has no outcome. */
  | { kind: 'pending'; key: string; characterId: number; chunkId: string; cardId: string };

export function computeFlags(board: BoardDoc): BoardFlag[] {
  const index = chunkIndex(board);
  const states = characterStates(board);
  const out: BoardFlag[] = [];
  const live = board.cards.filter((c) => !isWaiting(c) && c.outcome !== 'moot');

  for (const c of board.cards) {
    if (c.chunkId === null || c.outcome === 'moot' || c.outcome === 'failed') continue;
    const state = outEntering(states, c.characterId, index.get(c.chunkId) ?? -1);
    if (state) out.push({ kind: 'out', key: `out:${c.id}`, characterId: c.characterId, chunkId: c.chunkId, state, cardId: c.id });
  }
  for (const s of board.scenes) {
    for (const p of s.participants) {
      const state = outEntering(states, p, index.get(s.chunkId) ?? -1);
      if (state) out.push({ kind: 'out', key: `out:${s.id}:${p}`, characterId: p, chunkId: s.chunkId, state, sceneId: s.id });
    }
  }

  // characterId → chunkId → the locations they're in.
  const where = new Map<number, Map<string, Set<string>>>();
  const place = (characterId: number, chunkId: string, locationId: string) => {
    const byChunk = where.get(characterId) ?? new Map<string, Set<string>>();
    where.set(characterId, byChunk);
    const locs = byChunk.get(chunkId) ?? new Set<string>();
    byChunk.set(chunkId, locs);
    locs.add(locationId);
  };
  live.forEach((c) => place(c.characterId, c.chunkId as string, c.locationId));
  board.scenes.forEach((s) => s.participants.forEach((p) => place(p, s.chunkId, s.locationId)));
  for (const [characterId, byChunk] of where) {
    for (const [chunkId, locs] of byChunk) {
      if (locs.size > 1) out.push({ kind: 'two', key: `two:${characterId}:${chunkId}`, characterId, chunkId, locationIds: [...locs] });
    }
  }

  // Cells with cards and no scene; a cell with a scene is already handled.
  const sceneCells = new Set(board.scenes.map((s) => `${s.locationId}:${s.chunkId}`));
  const cells = new Map<string, { locationId: string; chunkId: string; people: Set<number> }>();
  for (const c of live) {
    const id = `${c.locationId}:${c.chunkId}`;
    if (sceneCells.has(id)) continue;
    const cell = cells.get(id) ?? { locationId: c.locationId, chunkId: c.chunkId as string, people: new Set<number>() };
    cells.set(id, cell);
    cell.people.add(c.characterId);
  }
  for (const [id, cell] of cells) {
    if (cell.people.size >= 2) {
      out.push({ kind: 'meeting', key: `meet:${id}`, locationId: cell.locationId, chunkId: cell.chunkId, characterIds: [...cell.people] });
    }
  }

  for (const c of board.cards) {
    if (c.outcome === 'pending' && c.chunkId !== null) {
      out.push({ kind: 'pending', key: `pend:${c.id}`, characterId: c.characterId, chunkId: c.chunkId, cardId: c.id });
    }
  }
  return out;
}

/** The flags the GM hasn't dismissed. */
export const openFlags = (flags: BoardFlag[], dismissed: BoardDoc['dismissedFlags']) => flags.filter((f) => !dismissed[f.key]);
