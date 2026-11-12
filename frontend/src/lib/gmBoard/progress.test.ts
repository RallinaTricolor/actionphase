import { describe, it, expect } from 'vitest';
import { makeBoard, makeCard, makeScene } from '@/test-utils/factories';
import { nextNotDone, setReadDone, setReady, stepProgress } from './progress';

const order = [1, 2, 3, 4];

describe('Ready → next', () => {
  it('skips players who are already ready', () => {
    expect(nextNotDone(order, { 1: true, 2: true, 3: true }, 1)).toBe(4);
  });

  it('wraps around to the start', () => {
    expect(nextNotDone(order, { 4: true, 1: true }, 4)).toBe(2);
  });

  it('gives null when everyone is ready', () => {
    expect(nextNotDone(order, { 1: true, 2: true, 3: true, 4: true }, 2)).toBeNull();
  });

  it('starts from the top when the current player isn’t in the list', () => {
    expect(nextNotDone(order, {}, 99)).toBe(1);
  });

  it('Reopen clears ready and keeps the rest of the progress', () => {
    expect(setReady({ ready: true, readDone: true, covered: { m: true } }, false)).toEqual({
      ready: false,
      readDone: true,
      covered: { m: true },
    });
    expect(setReady(undefined, true)).toEqual({ ready: true });
    expect(setReadDone({ ready: true }, true)).toEqual({ ready: true, readDone: true });
  });
});

describe('stepProgress (the step tabs)', () => {
  const people = { submitters: [1, 2, 3], recipients: [1, 2, 3, 4] };

  it('counts who is read, what is left to resolve, the scenes and who is ready', () => {
    const board = makeBoard({
      readDone: { 1: true, 3: true },
      ready: { 2: true },
      cards: [
        makeCard({ id: 'a', characterId: 1, outcome: 'happened' }),
        makeCard({ id: 'b', characterId: 2, chunkId: 'k2' }),
        makeCard({ id: 'c', characterId: 3, chunkId: 'k3' }),
      ],
      scenes: [makeScene({ id: 's1', participants: [1] })],
    });
    expect(stepProgress(board, people)).toEqual({ read: '2/3 read', map: '2 to resolve', scenes: '1', write: '1/4 ready' });
  });

  it('leaves dismissed checks out of what is left to resolve', () => {
    const board = makeBoard({ cards: [makeCard({ id: 'b', characterId: 2 })], dismissedFlags: { 'pend:b': true } });
    expect(stepProgress(board, people).map).toBe('all resolved');
  });

  it('says nothing for a step with nothing in it yet', () => {
    expect(stepProgress(makeBoard(), { submitters: [], recipients: [] })).toEqual({});
  });

  it('counts only people still in the lists', () => {
    const board = makeBoard({ readDone: { 9: true }, ready: { 9: true } });
    expect(stepProgress(board, people)).toEqual({ read: '0/3 read', write: '0/4 ready' });
  });
});

