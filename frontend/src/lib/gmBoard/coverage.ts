/**
 * Coverage: has a character's result told them each moment they read? A
 * moment is covered when its reader text appears in any of the character's
 * results this phase (every part, published or not). A tick or untick the GM
 * sets always wins over the text match.
 */

import { perceivedMoments, readerText } from './moments';
import type { BoardDoc, CharacterProgress, Moment } from './types';

/** How the reader's text is built: their names, and whether second person is on. */
export interface ReaderOptions {
  names: string[];
  secondPerson: boolean;
}

/** All of a character's result text this phase, as one lowercase string to search. */
const draftHaystack = (drafts: string[]) => drafts.join('\n').toLowerCase();

export function isCovered(
  moment: Moment,
  characterId: number,
  drafts: string[],
  ticks: CharacterProgress['covered'],
  reader: ReaderOptions,
): boolean {
  if (ticks && Object.prototype.hasOwnProperty.call(ticks, moment.id)) return !!ticks[moment.id];
  const text = readerText(moment, characterId, reader.names, reader.secondPerson).trim().toLowerCase();
  return text.length > 0 && draftHaystack(drafts).includes(text);
}

/** The covered ticks after the GM ticks (or unticks) a moment. Inserting a moment into a draft ticks it. */
export function setCovered(progress: CharacterProgress | undefined, momentId: string, covered: boolean): CharacterProgress {
  return { ...progress, covered: { ...progress?.covered, [momentId]: covered } };
}

/** The moments a character reads, split into covered and not. */
export function coverageFor(
  board: BoardDoc,
  characterId: number,
  drafts: string[],
  reader: ReaderOptions,
): { total: number; done: number; missing: Moment[] } {
  const ticks = board.covered[characterId];
  const moments = perceivedMoments(board, characterId).flatMap((g) => g.moments);
  const missing = moments.filter((m) => !isCovered(m, characterId, drafts, ticks, reader));
  return { total: moments.length, done: moments.length - missing.length, missing };
}
