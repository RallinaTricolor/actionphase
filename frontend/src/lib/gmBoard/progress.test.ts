import { describe, it, expect } from 'vitest';
import { nextNotDone, setReadDone, setReady } from './progress';

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
