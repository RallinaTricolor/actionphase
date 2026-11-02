import { describe, it, expect } from 'vitest';
import { makeCodexEntry } from '@/test-utils/factories';
import { codexDoc, codexTone, inPhase, newCodexEntry, phaseLocations } from './codex';

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
});
