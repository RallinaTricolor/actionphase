/**
 * Per-character progress through a phase: done reading (Read), ready (Write).
 * Both live on the character's `progress` item.
 */

import { computeFlags, openFlags } from './flags';
import type { BoardStep } from './steps';
import type { BoardDoc, CharacterProgress } from './types';

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

/**
 * What each step tab says about the phase so far: "2/8 read", "3 to resolve"
 * (open checks, unresolved cards among them), the number of scenes, and
 * "1/8 ready". A step with nothing in it yet says nothing. `submitters` are
 * Read's list and `recipients` Write's, so the counts match those lists.
 */
export function stepProgress(
  board: BoardDoc,
  { submitters, recipients }: { submitters: number[]; recipients: number[] },
): Partial<Record<BoardStep, string>> {
  const out: Partial<Record<BoardStep, string>> = {};
  if (submitters.length) out.read = `${submitters.filter((id) => board.readDone[id]).length}/${submitters.length} read`;
  if (board.cards.length || board.scenes.length) {
    const open = openFlags(computeFlags(board), board.dismissedFlags).length;
    out.map = open ? `${open} to resolve` : 'all resolved';
  }
  if (board.scenes.length) out.scenes = String(board.scenes.length);
  if (recipients.length) out.write = `${recipients.filter((id) => board.ready[id]).length}/${recipients.length} ready`;
  return out;
}

