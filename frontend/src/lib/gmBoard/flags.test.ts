import { describe, it, expect } from 'vitest';
import { makeBoard, makeCard, makeScene } from '@/test-utils/factories';
import { computeFlags, openFlags, type BoardFlag } from './flags';

const kinds = (flags: BoardFlag[], kind: BoardFlag['kind']) => flags.filter((f) => f.kind === kind);

describe('computeFlags', () => {
  it('flags a live card of someone out of play, but not in the slot they’re taken out', () => {
    const board = makeBoard({
      scenes: [makeScene({ id: 's1', chunkId: 'k1', locationId: 'loc-pit', participants: [1], effects: [{ characterId: 1, state: 'captured' }] })],
      cards: [
        makeCard({ id: 'here', characterId: 1, chunkId: 'k1', locationId: 'loc-pit', outcome: 'happened' }),
        makeCard({ id: 'later', characterId: 1, chunkId: 'k2', locationId: 'loc-pit', outcome: 'happened' }),
        makeCard({ id: 'failed', characterId: 1, chunkId: 'k3', locationId: 'loc-pit', outcome: 'failed' }),
        makeCard({ id: 'moot', characterId: 1, chunkId: 'k3', locationId: 'loc-pit', outcome: 'moot' }),
      ],
    });
    expect(kinds(computeFlags(board), 'out')).toEqual([
      { kind: 'out', key: 'out:later', characterId: 1, chunkId: 'k2', state: 'captured', cardId: 'later' },
    ]);
  });

  it('flags someone out of play who is in a later scene', () => {
    const board = makeBoard({
      scenes: [
        makeScene({ id: 's1', chunkId: 'k1', participants: [1], effects: [{ characterId: 1, state: 'dead' }] }),
        makeScene({ id: 's2', chunkId: 'k3', locationId: 'loc-dock', participants: [1, 2] }),
      ],
    });
    expect(kinds(computeFlags(board), 'out')).toEqual([
      { kind: 'out', key: 'out:s2:1', characterId: 1, chunkId: 'k3', state: 'dead', sceneId: 's2' },
    ]);
  });

  it('flags someone in two places in one slot, counting scenes but not moot cards', () => {
    const board = makeBoard({
      cards: [
        makeCard({ id: 'a', characterId: 1, chunkId: 'k2', locationId: 'loc-hall', outcome: 'happened' }),
        makeCard({ id: 'b', characterId: 1, chunkId: 'k2', locationId: 'loc-hall', outcome: 'happened' }),
        makeCard({ id: 'm', characterId: 1, chunkId: 'k2', locationId: 'loc-roof', outcome: 'moot' }),
        makeCard({ id: 'c', characterId: 2, chunkId: 'k2', locationId: 'loc-hall', outcome: 'happened' }),
      ],
      scenes: [makeScene({ id: 's', chunkId: 'k2', locationId: 'loc-dock', participants: [2] })],
    });
    const two = kinds(computeFlags(board), 'two');
    expect(two).toEqual([{ kind: 'two', key: 'two:2:k2', characterId: 2, chunkId: 'k2', locationIds: ['loc-hall', 'loc-dock'] }]);
  });

  it('flags a cell with two or more people and no scene', () => {
    const cards = [
      makeCard({ id: 'a', characterId: 1, chunkId: 'k2', locationId: 'loc-hall', outcome: 'happened' }),
      makeCard({ id: 'b', characterId: 2, chunkId: 'k2', locationId: 'loc-hall', outcome: 'happened' }),
      makeCard({ id: 'c', characterId: 3, chunkId: 'k2', locationId: 'loc-roof', outcome: 'happened' }),
    ];
    expect(kinds(computeFlags(makeBoard({ cards })), 'meeting')).toEqual([
      { kind: 'meeting', key: 'meet:loc-hall:k2', locationId: 'loc-hall', chunkId: 'k2', characterIds: [1, 2] },
    ]);
    const withScene = makeBoard({ cards, scenes: [makeScene({ id: 's', chunkId: 'k2', locationId: 'loc-hall', participants: [1, 2] })] });
    expect(kinds(computeFlags(withScene), 'meeting')).toEqual([]);
  });

  it('doesn’t count one person with two cards as a meeting', () => {
    const cards = [
      makeCard({ id: 'a', characterId: 1, chunkId: 'k2', outcome: 'happened' }),
      makeCard({ id: 'b', characterId: 1, chunkId: 'k2', outcome: 'happened' }),
    ];
    expect(kinds(computeFlags(makeBoard({ cards })), 'meeting')).toEqual([]);
  });

  it('flags placed cards with no outcome, but not waiting IF cards', () => {
    const cards = [
      makeCard({ id: 'p', characterId: 1, chunkId: 'k1' }),
      makeCard({ id: 'w', characterId: 1, chunkId: null, isIF: true }),
      makeCard({ id: 'h', characterId: 1, chunkId: 'k2', outcome: 'happened' }),
    ];
    expect(kinds(computeFlags(makeBoard({ cards })), 'pending')).toEqual([
      { kind: 'pending', key: 'pend:p', characterId: 1, chunkId: 'k1', cardId: 'p' },
    ]);
  });
});

describe('dismissal', () => {
  it('sticks while the board changes, and doesn’t hide other flags', () => {
    const one = makeBoard({ cards: [makeCard({ id: 'p', characterId: 1, chunkId: 'k1' })] });
    const dismissed = { 'pend:p': true as const };
    expect(openFlags(computeFlags(one), dismissed)).toEqual([]);

    const changed = makeBoard({
      cards: [
        makeCard({ id: 'p', characterId: 1, chunkId: 'k1', summary: 'edited' }),
        makeCard({ id: 'q', characterId: 2, chunkId: 'k3' }),
      ],
    });
    expect(openFlags(computeFlags(changed), dismissed).map((f) => f.key)).toEqual(['pend:q']);
  });
});
