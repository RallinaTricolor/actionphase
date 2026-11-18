import { describe, it, expect } from 'vitest';
import { makeCodexEntry } from '@/test-utils/factories';
import { codexDoc, codexTone, defaultPhases, inPhase, newCodexEntry, newLocation, otherPhaseLocations, phaseLocations, withPhase } from './codex';

describe('codex', () => {
  it('applies an entry with no phases to every phase', () => {
    expect(inPhase(makeCodexEntry({ id: 'a', name: 'a' }), 3)).toBe(true);
    expect(inPhase(makeCodexEntry({ id: 'a', name: 'a', phases: [4] }), 3)).toBe(false);
  });

  it('lists the phase’s locations as board rows', () => {
    const codex = [
      makeCodexEntry({ id: 'a', name: 'Mill', type: 'Location' }),
      makeCodexEntry({ id: 'b', name: 'Dock', type: 'Location', phases: [4] }),
      makeCodexEntry({ id: 'c', name: 'Key', type: 'Item' }),
    ];
    expect(phaseLocations(codex, 3).map((e) => e.id)).toEqual(['a']);
  });

  it('starts a Secret-type entry secret, and stores an entry without its id', () => {
    expect(newCodexEntry({ id: 's', name: 'The vault is empty', type: 'Secret' }).secret).toBe(true);
    const entry = newCodexEntry({ id: 'm', name: 'Mill', type: 'Location' });
    expect(entry).toMatchObject({ secret: false, aliases: [], knownBy: [], phases: [] });
    expect(codexDoc(entry)).not.toHaveProperty('id');
  });

  it('tones secrets as danger and locations as places', () => {
    expect(codexTone({ type: 'NPC', secret: true })).toBe('danger');
    expect(codexTone({ type: 'Location', secret: false })).toBe('success');
    expect(codexTone({ type: 'Item', secret: false })).toBe('primary');
  });

  it('starts locations and objectives as one phase’s, and the rest as every phase’s', () => {
    expect(defaultPhases('Location', 7)).toEqual([7]);
    expect(defaultPhases('Objective', 7)).toEqual([7]);
    expect(defaultPhases('NPC', 7)).toEqual([]);
    expect(defaultPhases('Location', undefined)).toEqual([]);
    expect(newLocation('x', 'Dock', 7)).toMatchObject({ type: 'Location', name: 'Dock', phases: [7] });
  });

  it('adds a phase to an entry, leaving an every-phase entry alone', () => {
    expect(withPhase(makeCodexEntry({ id: 'a', name: 'a', phases: [4] }), 5).phases).toEqual([4, 5]);
    const every = makeCodexEntry({ id: 'b', name: 'b' });
    expect(withPhase(every, 5)).toBe(every);
  });

  it('lists other phases’ locations that this phase lacks, by phase', () => {
    const codex = [
      makeCodexEntry({ id: 'mill', name: 'Mill', type: 'Location' }),
      makeCodexEntry({ id: 'dock', name: 'Dock', type: 'Location', phases: [1, 2] }),
      makeCodexEntry({ id: 'pier', name: 'Pier', type: 'Location', phases: [2] }),
      makeCodexEntry({ id: 'here', name: 'Here', type: 'Location', phases: [1, 3] }),
      makeCodexEntry({ id: 'key', name: 'Key', type: 'Item', phases: [1] }),
    ];
    const phases = [{ id: 1, title: 'One' }, { id: 2, title: 'Two' }, { id: 3, title: 'Three' }];
    expect(otherPhaseLocations(codex, phases, 3).map((g) => [g.phase.title, g.entries.map((e) => e.id)])).toEqual([
      ['One', ['dock']],
      ['Two', ['dock', 'pier']],
    ]);
  });
});
