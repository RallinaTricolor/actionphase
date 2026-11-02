import { describe, it, expect } from 'vitest';
import { makeBoard, makeCard, makeScene } from '@/test-utils/factories';
import { cellPresent, characterStates, chunkIndex, outEntering, stateAt } from './states';

// Four slots: k1..k4.
const board = (scenes: ReturnType<typeof makeScene>[]) =>
  makeBoard({
    chunks: [
      { id: 'k3', name: 'C', position: 3 },
      { id: 'k1', name: 'A', position: 1 },
      { id: 'k4', name: 'D', position: 4 },
      { id: 'k2', name: 'B', position: 2 },
    ],
    scenes,
  });

describe('characterStates', () => {
  it('orders slots by position', () => {
    expect([...chunkIndex(board([])).entries()]).toEqual([['k1', 0], ['k2', 1], ['k3', 2], ['k4', 3]]);
  });

  it('lasts from the scene’s slot to the end of the phase', () => {
    const s = characterStates(board([makeScene({ id: 's1', chunkId: 'k2', effects: [{ characterId: 5, state: 'captured' }] })]));
    expect(s[5]).toEqual(['active', 'captured', 'captured', 'captured']);
  });

  it('stops before `until`', () => {
    const s = characterStates(
      board([makeScene({ id: 's1', chunkId: 'k2', effects: [{ characterId: 5, state: 'injured', untilChunkId: 'k4' }] })]),
    );
    expect(s[5]).toEqual(['active', 'injured', 'injured', 'active']);
  });

  it('ignores an `until` that isn’t after the start', () => {
    const s = characterStates(
      board([makeScene({ id: 's1', chunkId: 'k3', effects: [{ characterId: 5, state: 'dead', untilChunkId: 'k2' }] })]),
    );
    expect(s[5]).toEqual(['active', 'active', 'dead', 'dead']);
  });

  it('lets a later effect override an earlier one, whatever the scene order', () => {
    const s = characterStates(
      board([
        makeScene({ id: 's2', chunkId: 'k3', effects: [{ characterId: 5, state: 'active' }] }),
        makeScene({ id: 's1', chunkId: 'k1', effects: [{ characterId: 5, state: 'captured' }] }),
      ]),
    );
    expect(s[5]).toEqual(['captured', 'captured', 'active', 'active']);
  });

  it('treats everyone without an effect as active', () => {
    expect(stateAt({}, 9, 2)).toBe('active');
  });
});

describe('outEntering', () => {
  const s = characterStates(board([makeScene({ id: 's1', chunkId: 'k2', effects: [{ characterId: 5, state: 'incapacitated' }] })]));

  it('isn’t out of play in the slot where they’re taken out', () => {
    expect(outEntering(s, 5, 1)).toBeNull();
  });

  it('is out of play from the next slot on', () => {
    expect(outEntering(s, 5, 2)).toBe('incapacitated');
    expect(outEntering(s, 5, 3)).toBe('incapacitated');
  });

  it('never counts injured as out of play', () => {
    const hurt = characterStates(board([makeScene({ id: 's1', chunkId: 'k1', effects: [{ characterId: 5, state: 'injured' }] })]));
    expect(outEntering(hurt, 5, 2)).toBeNull();
  });
});

describe('cellPresent', () => {
  it('counts live cards and scene casts in that cell only', () => {
    const b = makeBoard({
      cards: [
        makeCard({ id: 'a', characterId: 1, locationId: 'loc-hall', chunkId: 'k1' }),
        makeCard({ id: 'b', characterId: 2, locationId: 'loc-hall', chunkId: 'k1', outcome: 'moot' }),
        makeCard({ id: 'c', characterId: 3, locationId: 'loc-dock', chunkId: 'k1' }),
        makeCard({ id: 'd', characterId: 4, locationId: 'loc-hall', chunkId: 'k2' }),
      ],
      scenes: [makeScene({ id: 's', locationId: 'loc-hall', chunkId: 'k1', participants: [6] })],
    });
    expect([...cellPresent(b, 'loc-hall', 'k1')].sort()).toEqual([1, 6]);
  });
});
