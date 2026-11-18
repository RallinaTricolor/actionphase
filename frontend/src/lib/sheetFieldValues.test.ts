import { describe, expect, it } from 'vitest';
import type { CharacterSheetField } from '@/types/characters';
import { canonicalEntry, canonicalValue, fieldCodecOf, lootDataToEdit } from './sheetFieldValues';

const field = (type: string, key = 'f'): CharacterSheetField => ({ key, label: key, type }) as CharacterSheetField;

const FIELDS: CharacterSheetField[] = [
  { key: 'rank', label: 'Rank', type: 'text' },
  { key: 'quantity', label: 'Quantity', type: 'number' },
  { key: 'description', label: 'Description', type: 'markdown' },
  { key: 'kind', label: 'Kind', type: 'select', options: ['Ally', 'Rival'] },
  { key: 'known', label: 'Known', type: 'checkbox' },
  { key: 'trust', label: 'Trust', type: 'track' },
];

describe('canonicalValue: what the sheet editor stores after an unchanged save', () => {
  it.each([
    ['text', '  Tier 2 ', 'Tier 2'],
    ['text', '   ', undefined],
    ['number', '3', 3],
    ['number', '', undefined],
    ['number', 'lots', undefined],
    ['checkbox', true, true],
    ['checkbox', false, undefined],
    ['checkbox', 'true', undefined],
    ['track', { value: 2, max: 7, display: 'boxes' }, { value: 2, max: 7, display: 'boxes' }],
    ['track', { value: 2, max: 7, display: 'number' }, { value: 2, max: 7 }],
    ['track', { value: 2, display: 'boxes' }, { value: 2 }],
  ])('%s %j → %j', (type, stored, expected) => {
    expect(canonicalValue(field(type), stored)).toEqual(expected);
  });

  it('erases a track stored as a bare number: why every writer must use the codecs', () => {
    expect(canonicalValue(field('track'), 5)).toBeUndefined();
  });

  it('leaves a value of a type this client does not know alone', () => {
    expect(fieldCodecOf(field('dice'))).toBeUndefined();
    expect(canonicalValue(field('dice'), { sides: 6 })).toEqual({ sides: 6 });
  });
});

describe('canonicalEntry', () => {
  it('is a fixed point for an entry the editor wrote', () => {
    const entry = { id: 'e1', name: 'Mara', rank: 'Tier 2', quantity: 3, kind: 'Ally', known: true, trust: { value: 2, max: 5, display: 'track' } };
    expect(canonicalEntry(FIELDS, entry)).toEqual(entry);
  });

  it('shows what an unchanged save would change, keeping keys the schema does not know', () => {
    const entry = { id: 'e1', name: ' Mara ', rank: ' x ', known: false, trust: 4, legacy: 'kept' };
    expect(canonicalEntry(FIELDS, entry)).toEqual({ id: 'e1', name: 'Mara', rank: 'x', legacy: 'kept' });
  });
});

describe('lootDataToEdit', () => {
  it('stores known fields as the form would, and carries unknown keys over', () => {
    expect(lootDataToEdit(FIELDS, 'Rope', { id: 'x', name: 'y', quantity: '3', known: false, extra: 'kept' })).toEqual({
      name: 'Rope',
      values: { quantity: 3, known: undefined, extra: 'kept' },
    });
  });
});
