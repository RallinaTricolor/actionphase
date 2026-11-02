import { describe, it, expect } from 'vitest';
import { makeBoard, makeCard, makeCodexEntry, makeMoment, makeScene } from '@/test-utils/factories';
import { publishChecks } from './checks';

const reader = { names: ['Harrison'], secondPerson: true };
const board = makeBoard({
  scenes: [
    makeScene({
      id: 's1',
      chunkId: 'k1',
      locationId: 'loc-dock',
      participants: [1, 2],
      effects: [{ characterId: 1, state: 'captured' }],
      moments: [
        makeMoment({ id: 'grab', text: 'Guards seize Harrison on the dock.', readers: [1, 2] }),
        makeMoment({ id: 'escape', text: 'Mara slips away under the pier.', readers: [2] }),
      ],
    }),
  ],
  cards: [
    makeCard({ id: 'later', characterId: 1, chunkId: 'k2', locationId: 'loc-hall', outcome: 'happened' }),
    makeCard({ id: 'two-a', characterId: 2, chunkId: 'k2', locationId: 'loc-hall', outcome: 'happened' }),
    makeCard({ id: 'two-b', characterId: 2, chunkId: 'k2', locationId: 'loc-roof', outcome: 'happened' }),
  ],
});
const codex = [makeCodexEntry({ id: 'x', name: 'Orrin', secret: true })];
const base = { characterId: 1, phaseId: 7, board, codex, reader };

describe('publishChecks', () => {
  it('collects leaks, this character’s out and two flags, and uncovered moments', () => {
    const c = publishChecks({ ...base, drafts: ['Orrin watches as Mara slips away under the pier.'] });
    expect(c.leaks.map((l) => l.reason.kind)).toEqual(['secret', 'hidden']);
    expect(c.flags.map((f) => f.key)).toEqual(['out:later']);
    expect(c.notCovered.map((m) => m.id)).toEqual(['grab']);
    expect(c.clear).toBe(false);
  });

  it('leaves out flags the GM dismissed and other characters’ flags', () => {
    const c = publishChecks({ ...base, characterId: 2, board: { ...board, dismissedFlags: { 'two:2:k2': true } }, drafts: [] });
    expect(c.flags).toEqual([]);
  });

  it('is clear when the result covers everything and nothing leaks', () => {
    const quiet = { ...board, cards: [], dismissedFlags: {} };
    const c = publishChecks({ ...base, board: quiet, drafts: ['Guards seize you on the dock.'] });
    expect(c).toEqual({ leaks: [], flags: [], notCovered: [], clear: true });
  });
});
