import { describe, it, expect } from 'vitest';
import { applyEntryEdit, createEntry, normalizeEntry } from './sheetEntries';

describe('normalizeEntry', () => {
  describe('skills: level → rank', () => {
    it('stringifies a legacy numeric level into rank, and drops level', () => {
      expect(normalizeEntry('skills', { id: 's1', name: 'Stealth', level: 3 }))
        .toEqual({ id: 's1', name: 'Stealth', rank: '3' });
    });

    it('keeps a legacy string level', () => {
      expect(normalizeEntry('skills', { id: 's1', name: 'Stealth', level: 'Expert' }).rank).toBe('Expert');
    });

    it('prefers rank when a row carries both keys', () => {
      const entry = normalizeEntry('skills', { id: 's1', name: 'Stealth', rank: 'Master', level: 3 });
      expect(entry.rank).toBe('Master');
      expect(entry).not.toHaveProperty('level');
    });

    it('falls back to level when rank is empty', () => {
      expect(normalizeEntry('skills', { id: 's1', name: 'Stealth', rank: '', level: 2 }).rank).toBe('2');
    });

    it('leaves rank unset when neither key has a value', () => {
      for (const level of [undefined, null, '']) {
        expect(normalizeEntry('skills', { id: 's1', name: 'Stealth', level })).toEqual({ id: 's1', name: 'Stealth' });
      }
    });

    it('stringifies a level of zero rather than treating it as absent', () => {
      expect(normalizeEntry('skills', { id: 's1', name: 'Stealth', level: 0 }).rank).toBe('0');
    });
  });

  describe('numbers: type → name, flat amount → track', () => {
    it('reads the legacy type key as the name, and drops it', () => {
      expect(normalizeEntry('numbers', { id: 'n1', type: 'Gold', amount: 5 }))
        .toEqual({ id: 'n1', name: 'Gold', amount: { value: 5 } });
    });

    it('prefers name when a row carries both keys', () => {
      expect(normalizeEntry('numbers', { id: 'n1', name: 'Stress', type: 'Gold', amount: 1 }).name).toBe('Stress');
    });

    it('lifts a flat amount, max and display into one track value', () => {
      expect(normalizeEntry('numbers', { id: 'n1', name: 'Stress', amount: 4, max: 9, display: 'boxes' }))
        .toEqual({ id: 'n1', name: 'Stress', amount: { value: 4, max: 9, display: 'boxes' } });
    });

    it('drops a display value it does not recognise', () => {
      expect(normalizeEntry('numbers', { id: 'n1', name: 'Stress', amount: 4, max: 9, display: 'dial' }).amount)
        .toEqual({ value: 4, max: 9 });
    });

    it('lifts a maximum with no amount as an empty track', () => {
      expect(normalizeEntry('numbers', { id: 'n1', name: 'Clock', max: 6 }).amount).toEqual({ value: 0, max: 6 });
    });

    it('leaves an amount already in the new shape alone', () => {
      const amount = { value: 2, max: 4, display: 'track' };
      expect(normalizeEntry('numbers', { id: 'n1', name: 'Heat', amount }).amount).toEqual(amount);
    });
  });

  it('touches no other tab\'s keys', () => {
    // The legacy keys only ever meant something on their own tab.
    const raw = { id: 'i1', name: 'Rope', level: 2, type: 'Tool', amount: 3, max: 5 };
    expect(normalizeEntry('inventory', raw)).toEqual(raw);
    expect(normalizeEntry('t_abc123', raw)).toEqual(raw);
  });

  it('keeps keys no schema knows about', () => {
    expect(normalizeEntry('skills', { id: 's1', name: 'Stealth', f_old123: 'kept' }).f_old123).toBe('kept');
  });

  it('gives an entry without a usable name an empty one', () => {
    expect(normalizeEntry('skills', { id: 's1' }).name).toBe('');
    expect(normalizeEntry('skills', { id: 's1', name: 7 }).name).toBe('');
  });

  it('does not mutate the stored row', () => {
    const raw = { id: 'n1', type: 'Gold', amount: 5 };
    normalizeEntry('numbers', raw);
    expect(raw).toEqual({ id: 'n1', type: 'Gold', amount: 5 });
  });
});

describe('applyEntryEdit', () => {
  const entry = { id: 's1', name: 'Stealth', rank: '3', category: 'Physical', f_gone00: 'hidden data' };

  it('sets edited values and renames', () => {
    expect(applyEntryEdit(entry, { name: 'Sneak', values: { rank: '4' } }))
      .toEqual({ ...entry, name: 'Sneak', rank: '4' });
  });

  it('removes a cleared field\'s key', () => {
    expect(applyEntryEdit(entry, { name: 'Stealth', values: { category: undefined } })).not.toHaveProperty('category');
  });

  it('keeps keys the edit does not mention, so a removed field\'s data survives', () => {
    expect(applyEntryEdit(entry, { name: 'Stealth', values: { rank: '4' } }).f_gone00).toBe('hidden data');
  });

  it('does not mutate the entry', () => {
    applyEntryEdit(entry, { name: 'Sneak', values: { category: undefined } });
    expect(entry).toEqual({ id: 's1', name: 'Stealth', rank: '3', category: 'Physical', f_gone00: 'hidden data' });
  });
});

describe('createEntry', () => {
  it('builds an entry, leaving cleared fields out', () => {
    expect(createEntry('new1', { name: 'Rope', values: { quantity: 2, description: undefined } }))
      .toEqual({ id: 'new1', name: 'Rope', quantity: 2 });
  });
});
