/**
 * Per-character progress through a phase: done reading (Read), ready (Write).
 * Both live on the character's `progress` item.
 */

import type { CharacterProgress } from './types';

/**
 * The next character after `current` in `order` who isn't done, wrapping
 * around to the start; null when everyone is done. Used by "Done reading →
 * next" and "Ready → next", after marking `current` done.
 */
export function nextNotDone(order: number[], done: Record<number, boolean>, current: number): number | null {
  const at = order.indexOf(current);
  for (let step = 1; step <= order.length; step++) {
    const id = order[(at + step + order.length) % order.length];
    if (!done[id]) return id;
  }
  return null;
}

/** Marks a character ready, or not ("Reopen"). */
export const setReady = (progress: CharacterProgress | undefined, ready: boolean): CharacterProgress => ({ ...progress, ready });

/** Marks a character done reading, or not. */
export const setReadDone = (progress: CharacterProgress | undefined, readDone: boolean): CharacterProgress => ({ ...progress, readDone });
