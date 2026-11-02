/**
 * Checks before publishing one character's results: possible leaks, the
 * out-of-play and two-places flags that involve them, and the moments they
 * read that no result covers yet. Data only; a component renders it. Reward
 * checks join this list with the rewards module.
 */

import { coverageFor, type ReaderOptions } from './coverage';
import { computeFlags, openFlags, type BoardFlag } from './flags';
import { leaksFor, type Leak, type LeakInputs } from './leaks';
import type { BoardDoc, Moment } from './types';

export interface PublishChecks {
  leaks: Leak[];
  /** Open `out` and `two` flags for this character. */
  flags: BoardFlag[];
  notCovered: Moment[];
  /** Nothing to look at. */
  clear: boolean;
}

export interface CheckInputs extends Omit<LeakInputs, 'board'> {
  board: BoardDoc;
  reader: ReaderOptions;
  /** The board's flags, if the caller already has them; computed otherwise. */
  flags?: BoardFlag[];
}

export function publishChecks({ reader, flags, ...inputs }: CheckInputs): PublishChecks {
  const { board, characterId, drafts } = inputs;
  const leaks = leaksFor(inputs);
  const mine = openFlags(flags ?? computeFlags(board), board.dismissedFlags).filter(
    (f) => (f.kind === 'out' || f.kind === 'two') && f.characterId === characterId,
  );
  const notCovered = coverageFor(board, characterId, drafts, reader).missing;
  return { leaks, flags: mine, notCovered, clear: !leaks.length && !mine.length && !notCovered.length };
}
