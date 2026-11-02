import { describe, it, expect } from 'vitest';
import { isAmbush, STANCES, stanceKey, stanceKeysFor, stanceOf } from './stances';

describe('stances', () => {
  it('keys a stance by the ordered pair', () => {
    expect(stanceKey(3, 4)).toBe('3|4');
  });

  it('treats an unset or empty stance as not set', () => {
    const stances = { '3|4': { value: 'wary' as const, note: 'owes money' }, '4|3': { value: '' as const } };
    expect(stanceOf(stances, 3, 4)).toEqual({ value: 'wary', note: 'owes money' });
    expect(stanceOf(stances, 4, 3)).toBeNull();
    expect(stanceOf(stances, 3, 5)).toBeNull();
  });

  it('spots an ambush: one side targets, the other thinks they’re allies', () => {
    expect(isAmbush({ '1|2': { value: 'ally_target' }, '2|1': { value: 'ally' } }, 1, 2)).toBe(true);
    expect(isAmbush({ '1|2': { value: 'target' }, '2|1': { value: 'deal' } }, 1, 2)).toBe(true);
    expect(isAmbush({ '1|2': { value: 'target' }, '2|1': { value: 'wary' } }, 1, 2)).toBe(false);
    expect(isAmbush({ '1|2': { value: 'target' } }, 1, 2)).toBe(false);
    expect(isAmbush({ '1|2': { value: 'ally' }, '2|1': { value: 'target' } }, 1, 2)).toBe(false);
  });

  it('sets several at once without anyone facing themselves', () => {
    expect(stanceKeysFor([1, 2], [2, 3])).toEqual(['1|2', '1|3', '2|3']);
  });

  it('lists every value in the plan’s order', () => {
    expect(STANCES.map((s) => s.value)).toEqual(['ally', 'deal', 'neutral', 'wary', 'target', 'ally_target']);
  });
});
