/**
 * Stances: how one character sees another this phase, set by the GM. Stored
 * one item per ordered pair, keyed `${from}|${to}`.
 */

import type { BoardDoc, Stance, StanceValue } from './types';

export const STANCES: { value: StanceValue; label: string; tone: 'neutral' | 'success' | 'warning' | 'danger' | 'primary' }[] = [
  { value: 'ally', label: 'Ally', tone: 'success' },
  { value: 'deal', label: 'Deal', tone: 'success' },
  { value: 'neutral', label: 'Neutral', tone: 'neutral' },
  { value: 'wary', label: 'Wary', tone: 'warning' },
  { value: 'target', label: 'Target', tone: 'danger' },
  { value: 'ally_target', label: 'Ally ⇢ Target', tone: 'primary' },
];

export const stanceKey = (from: number, to: number) => `${from}|${to}`;

/** How `from` sees `to`, or null if the GM hasn't set it. */
export function stanceOf(stances: BoardDoc['stances'], from: number, to: number): Stance | null {
  const s = stances[stanceKey(from, to)];
  return s && s.value ? s : null;
}

/**
 * `from` means to strike `to`, while `to` thinks they're allies: the Map
 * marks it "They think it's an alliance."
 */
export function isAmbush(stances: BoardDoc['stances'], from: number, to: number): boolean {
  const mine = stanceOf(stances, from, to);
  const theirs = stanceOf(stances, to, from);
  return (
    !!mine && (mine.value === 'target' || mine.value === 'ally_target') &&
    !!theirs && (theirs.value === 'ally' || theirs.value === 'deal')
  );
}

/** "Set several at once": every ordered pair from `fromIds` to `toIds`, skipping anyone to themselves. */
export function stanceKeysFor(fromIds: number[], toIds: number[]): string[] {
  const keys: string[] = [];
  for (const a of fromIds) for (const b of toIds) if (a !== b) keys.push(stanceKey(a, b));
  return keys;
}
