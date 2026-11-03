import { describe, it, expect } from 'vitest';
import { makeBoard, makeCard, makeMoment, makeScene } from '@/test-utils/factories';
import { briefFor } from './brief';

// Harrison (1) and Mara (2) fight on the dock in Slot 1; Mara is taken and
// the guards (an NPC, 9) talk privately. Harrison overhears a moment from the
// roof scene (where he isn't). One of his cards is moot, one waits.
const board = makeBoard({
  cards: [
    makeCard({ id: 'late', characterId: 1, chunkId: 'k3', locationId: 'dock', src: [3], outcome: 'happened' }),
    makeCard({ id: 'early', characterId: 1, chunkId: 'k2', locationId: 'dock', src: [0], outcome: 'happened' }),
    makeCard({ id: 'gm', characterId: 1, chunkId: 'k2', locationId: 'dock', src: [], gm: true, outcome: 'partial' }),
    makeCard({ id: 'moot', characterId: 1, chunkId: 'k2', locationId: 'dock', src: [1], outcome: 'moot' }),
    makeCard({ id: 'if', characterId: 1, chunkId: null, locationId: 'dock', isIF: true, cond: 'If the bell rings' }),
    makeCard({ id: 'theirs', characterId: 2, chunkId: 'k2', locationId: 'dock' }),
  ],
  scenes: [
    makeScene({
      id: 'dock',
      chunkId: 'k2',
      locationId: 'dock',
      participants: [1, 2, 9],
      effects: [{ characterId: 2, state: 'captured' }, { characterId: 1, state: 'injured', untilChunkId: 'k3' }],
      moments: [
        makeMoment({ id: 'clash', text: 'Harrison and Mara meet the guards.', readers: [1, 2] }),
        makeMoment({ id: 'aside', text: 'Mara palms the key.', readers: [2] }),
        makeMoment({ id: 'note', text: 'The guards are paid by Orrin.', readers: [] }),
        makeMoment({ id: 'blank', text: '', readers: [2] }),
      ],
    }),
    makeScene({
      id: 'roof',
      chunkId: 'k2',
      locationId: 'roof',
      participants: [2],
      moments: [makeMoment({ id: 'shout', text: 'Mara shouts a warning.', readers: [2, 1] })],
    }),
    makeScene({ id: 'quiet', chunkId: 'k3', locationId: 'hall', participants: [1], moments: [makeMoment({ id: 'q', text: 'Mara waits.', readers: [2] })] }),
  ],
  stances: { '1|2': { value: 'ally' }, '2|1': { value: 'target', note: 'Wants the key' }, '1|3': { value: 'neutral' } },
});

describe('briefFor', () => {
  const brief = briefFor(board, 1, [1, 2, 3]);

  it('lists their slots in time order, cards in submission order, moot cards counted not shown', () => {
    expect(brief.slots.map((s) => s.chunk.id)).toEqual(['k2', 'k3']);
    expect(brief.slots[0].cards.map((c) => c.id)).toEqual(['early', 'gm']);
    expect(brief.mootCount).toBe(1);
    expect(briefFor(board, 1, [], true).slots[0].cards.map((c) => c.id)).toEqual(['early', 'moot', 'gm']);
  });

  it('shows what they read in their scenes and from elsewhere, and what they don’t get in their own', () => {
    const [dock, roof] = brief.slots[0].scenes;
    expect(dock.here).toBe(true);
    expect(dock.moments.map((m) => m.id)).toEqual(['clash']);
    expect(dock.hidden.map((h) => [h.moment.id, h.note])).toEqual([['aside', false], ['note', true]]);
    expect(roof.here).toBe(false);
    expect(roof.moments.map((m) => m.id)).toEqual(['shout']);
    expect(roof.hidden).toEqual([]);
  });

  it('keeps a scene they’re in but read nothing from', () => {
    const quiet = brief.slots[1].scenes[0];
    expect([quiet.scene.id, quiet.moments.length, quiet.hidden.length]).toEqual(['quiet', 0, 1]);
  });

  it('their state changes, and their state at the end of the phase', () => {
    expect(brief.slots[0].effects).toEqual([{ state: 'injured', untilChunkId: 'k3' }]);
    expect(brief.endState).toBe('active');
    expect(briefFor(board, 2, []).endState).toBe('captured');
  });

  it('waiting IF cards, and stances both ways without neutral ones', () => {
    expect(brief.waiting.map((c) => c.id)).toEqual(['if']);
    expect(brief.stances.out).toEqual([{ id: 2, stance: { value: 'ally' } }]);
    expect(brief.stances.in).toEqual([{ id: 2, stance: { value: 'target', note: 'Wants the key' } }]);
  });
});
