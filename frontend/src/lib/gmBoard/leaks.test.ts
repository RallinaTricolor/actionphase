import { describe, it, expect } from 'vitest';
import { makeBoard, makeCodexEntry, makeMoment, makeScene } from '@/test-utils/factories';
import { inPhase } from './codex';
import { leaksFor, type LeakInputs } from './leaks';

const PHASE = 7;
const heir = makeCodexEntry({ id: 'x1', name: 'The Heir', aliases: ['Orrin'], secret: true, knownBy: [2] });
const board = makeBoard({
  scenes: [
    makeScene({
      id: 's1',
      participants: [1, 2],
      moments: [
        makeMoment({
          id: 'shared',
          text: 'The bridge collapses into the river.',
          readers: [1, 2],
          ownText: { 2: 'You feel the bridge give way beneath you.' },
        }),
        makeMoment({ id: 'secret-plan', text: 'Mara slips the letter into the drawer.', readers: [2] }),
        makeMoment({ id: 'note', text: 'The letter is a forgery made by the GM.', readers: [] }),
        makeMoment({ id: 'short', text: 'He nods.', readers: [2] }),
      ],
    }),
  ],
});

const check = (characterId: number, drafts: string[], extra: Partial<LeakInputs> = {}) =>
  leaksFor({ characterId, phaseId: PHASE, drafts, board, codex: [heir], ...extra });

describe('leaksFor', () => {
  it('flags a secret codex name or alias, for people not allowed to know it', () => {
    expect(check(1, ['You meet Orrin at the gate.'])).toEqual([
      { term: 'Orrin', reason: { kind: 'secret', entryId: 'x1', entryName: 'The Heir' } },
    ]);
    expect(check(2, ['You meet Orrin at the gate.'])).toEqual([]);
  });

  it('skips a secret scoped to other phases', () => {
    const elsewhere = { ...heir, phases: [PHASE + 1] };
    expect(inPhase(elsewhere, PHASE)).toBe(false);
    expect(check(1, ['Orrin waits.'], { codex: [elsewhere] })).toEqual([]);
  });

  it('flags a moment the reader doesn’t get, including a GM note', () => {
    const leaks = check(1, ['Part 1.', 'You see Mara slips the letter into the drawer. The letter is a forgery made by the GM.']);
    expect(leaks.map((l) => l.reason)).toEqual([
      { kind: 'hidden', sceneId: 's1', momentId: 'secret-plan' },
      { kind: 'hidden', sceneId: 's1', momentId: 'note' },
    ]);
  });

  it('flags another reader’s own version, but not the reader’s own or the shared text', () => {
    const leaks = check(1, ['The bridge collapses into the river. You feel the bridge give way beneath you.']);
    expect(leaks).toEqual([
      { term: 'You feel the bridge give way beneath you.', reason: { kind: 'hidden', sceneId: 's1', momentId: 'shared' } },
    ]);
    expect(check(2, ['You feel the bridge give way beneath you.'])).toEqual([]);
  });

  it('ignores moment text too short to mean anything', () => {
    expect(check(1, ['He nods.'])).toEqual([]);
  });

  it('flags an entry from someone else’s sheet that isn’t on the reader’s', () => {
    const sheetItems = new Map([
      [1, [{ name: 'Lantern', tabLabel: 'Items' }]],
      [2, [{ name: 'Lantern', tabLabel: 'Items' }, { name: 'Glass Key', tabLabel: 'Items' }, { name: 'Ax', tabLabel: 'Items' }]],
    ]);
    const leaks = check(1, ['You raise the Lantern and the glass key glints. Ax.'], { sheetItems });
    expect(leaks).toEqual([{ term: 'Glass Key', reason: { kind: 'sheet', characterId: 2, tabLabel: 'Items' } }]);
  });

  it('reports each term once and nothing for an empty draft', () => {
    expect(check(1, ['Orrin. Orrin again.'])).toHaveLength(1);
    expect(check(1, ['  '])).toEqual([]);
  });
});
