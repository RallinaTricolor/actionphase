/**
 * Character state over a phase. Scene effects set a character's state from the
 * scene's time slot until a later one (`untilChunkId`, not included) or the end
 * of the phase. Captured, incapacitated and dead are out of play.
 */

import type { BoardDoc, CharState } from './types';

const OUT_OF_PLAY: ReadonlySet<CharState> = new Set<CharState>(['captured', 'incapacitated', 'dead']);

/** chunkId → its index in time order. */
export function chunkIndex(board: Pick<BoardDoc, 'chunks'>): Map<string, number> {
  const sorted = [...board.chunks].sort((a, b) => a.position - b.position);
  return new Map(sorted.map((c, i) => [c.id, i]));
}

/**
 * characterId → their state in each time slot. Only characters with an effect
 * are listed; everyone else is active throughout (`stateAt`). Effects apply in
 * time order, so a later effect overrides an earlier one from its slot on.
 */
export function characterStates(board: Pick<BoardDoc, 'chunks' | 'scenes'>): Record<number, CharState[]> {
  const index = chunkIndex(board);
  const n = index.size;
  const effects: { from: number; until: number; characterId: number; state: CharState }[] = [];
  for (const scene of board.scenes) {
    const from = index.get(scene.chunkId);
    if (from === undefined) continue;
    for (const e of scene.effects) {
      const until = e.untilChunkId ? (index.get(e.untilChunkId) ?? -1) : -1;
      effects.push({ from, until, characterId: e.characterId, state: e.state });
    }
  }
  effects.sort((a, b) => a.from - b.from);
  const states: Record<number, CharState[]> = {};
  for (const e of effects) {
    const row = (states[e.characterId] ??= Array<CharState>(n).fill('active'));
    const end = e.until > e.from ? e.until : n;
    for (let k = e.from; k < end; k++) row[k] = e.state;
  }
  return states;
}

export function stateAt(states: Record<number, CharState[]>, characterId: number, i: number): CharState {
  return states[characterId]?.[i] ?? 'active';
}

/**
 * The out-of-play state a character is in throughout slot `i`, or null. A
 * character taken out during slot `i` isn't out of play in it: that slot holds
 * the fight that took them out. They are from the next slot on.
 */
export function outEntering(states: Record<number, CharState[]>, characterId: number, i: number): CharState | null {
  if (i <= 0) return null;
  const now = stateAt(states, characterId, i);
  return OUT_OF_PLAY.has(now) && OUT_OF_PLAY.has(stateAt(states, characterId, i - 1)) ? now : null;
}

/** Who is in a cell: characters with a live (not moot) card there, plus each scene's cast there. */
export function cellPresent(board: Pick<BoardDoc, 'cards' | 'scenes'>, locationId: string, chunkId: string): Set<number> {
  const present = new Set<number>();
  for (const c of board.cards) {
    if (c.locationId === locationId && c.chunkId === chunkId && c.outcome !== 'moot') present.add(c.characterId);
  }
  for (const s of board.scenes) {
    if (s.locationId === locationId && s.chunkId === chunkId) s.participants.forEach((p) => present.add(p));
  }
  return present;
}
