import { describe, it, expect } from 'vitest';
import type { CharacterSheetField } from '@/types/characters';
import { lootCsvHelp, lootTableToCsv, parseLootTableCsv } from './lootTableCsv';

const CONTACT_FIELDS: CharacterSheetField[] = [
  { key: 'f_rel001', label: 'Relationship', type: 'select', options: ['Ally', 'Rival'] },
  { key: 'f_trust1', label: 'Trust', type: 'track' },
  { key: 'f_age001', label: 'Age', type: 'number' },
  { key: 'f_met001', label: 'Met in person', type: 'checkbox' },
  { key: 'description', label: 'Description', type: 'markdown' },
];

const dataOf = (result: ReturnType<typeof parseLootTableCsv>, index = 0) => {
  if ('error' in result) throw new Error(result.error);
  return JSON.parse(result.items[index].data);
};

describe('parseLootTableCsv', () => {
  it('maps columns by field label or key, case-insensitively', () => {
    const result = parseLootTableCsv('Name,relationship,f_age001\nOld Zadok,Ally,90\n', CONTACT_FIELDS);
    expect(dataOf(result)).toEqual({ name: 'Old Zadok', f_rel001: 'Ally', f_age001: 90 });
  });

  it('coerces each column by its field type', () => {
    const result = parseLootTableCsv(
      'name,Relationship,Trust,Age,Met in person\nZadok,rival,3/5,90,yes\nMira,,4,,no\n',
      CONTACT_FIELDS,
    );
    // A select value takes its option's spelling; a server-side roll writes
    // these verbatim, so the number must be a number, not "90".
    expect(dataOf(result, 0)).toEqual({
      name: 'Zadok', f_rel001: 'Rival', f_trust1: { value: 3, max: 5 }, f_age001: 90, f_met001: true,
    });
    // Blank cells and an unchecked box are left out, as the entry form stores them.
    expect(dataOf(result, 1)).toEqual({ name: 'Mira', f_trust1: { value: 4 } });
  });

  it('reads a track written as JSON, keeping its display mode', () => {
    const result = parseLootTableCsv(
      'name,Trust\nZadok,"{""value"":2,""max"":4,""display"":""boxes""}"\n',
      CONTACT_FIELDS,
    );
    expect(dataOf(result).f_trust1).toEqual({ value: 2, max: 4, display: 'boxes' });
  });

  it.each([
    ['a number', 'name,Age\nZadok,old\n', 'Row 1: "Age" must be a number, not "old".'],
    ['a checkbox', 'name,Met in person\nZadok,maybe\n', 'Row 1: "Met in person" must be yes or no, not "maybe".'],
    ['a track', 'name,Trust\nZadok,lots\n', 'Row 1: "Trust" must be a number or current/max like 3/5, not "lots".'],
  ])('names the row and column of a value that is not %s', (_type, csv, error) => {
    expect(parseLootTableCsv(csv, CONTACT_FIELDS)).toEqual({ error });
  });

  it('keeps a select value that is not an option, as the form does', () => {
    expect(dataOf(parseLootTableCsv('name,Relationship\nZadok,Patron\n', CONTACT_FIELDS)).f_rel001).toBe('Patron');
  });

  it('keeps columns the schema does not know, as text', () => {
    expect(dataOf(parseLootTableCsv('name,rumour\nZadok,Knows the reef\n', CONTACT_FIELDS))).toEqual({
      name: 'Zadok', rumour: 'Knows the reef',
    });
  });

  it('never imports an id or the retired equipped key', () => {
    expect(dataOf(parseLootTableCsv('name,id,equipped\nRope,abc,false\n', []))).toEqual({ name: 'Rope' });
  });

  it('accepts a Name header in any case', () => {
    expect('items' in parseLootTableCsv('NAME\nRope\n', [])).toBe(true);
  });

  it('rejects a file with no name column', () => {
    expect(parseLootTableCsv('title;age\nRope;1\n', [])).toEqual({
      error: 'The CSV needs a "name" column. Columns must be separated by ",".',
    });
  });
});

describe('lootTableToCsv', () => {
  const content = (data: Record<string, unknown>) => ({ id: 1, name: String(data.name), data: JSON.stringify(data) });

  it('writes name, then the schema fields by label, then other keys', () => {
    const csv = lootTableToCsv(
      [content({ name: 'Zadok', rumour: 'Knows the reef', f_age001: 90, f_rel001: 'Ally' })],
      CONTACT_FIELDS,
    );
    expect(csv).toBe('name,Relationship,Age,rumour\r\nZadok,Ally,90,Knows the reef');
  });

  it('round-trips through import unchanged', () => {
    const entries = [
      { name: 'Zadok', f_rel001: 'Rival', f_trust1: { value: 3, max: 5 }, f_age001: 90, f_met001: true },
      { name: 'Mira', f_trust1: { value: 2, max: 4, display: 'boxes' }, description: 'Sharp, very sharp' },
      { name: 'Ghost', f_trust1: { value: 1 } },
    ];
    const csv = lootTableToCsv(entries.map(content), CONTACT_FIELDS);
    const result = parseLootTableCsv(csv, CONTACT_FIELDS);
    expect(entries.map((_entry, i) => dataOf(result, i))).toEqual(entries);
  });

  it('exports a field by key when its label would read back as another column', () => {
    const fields: CharacterSheetField[] = [
      { key: 'f_aaaaaa', label: 'Name', type: 'text' },
      { key: 'f_bbbbbb', label: 'Rank', type: 'text' },
      { key: 'f_cccccc', label: 'rank', type: 'number' },
    ];
    const csv = lootTableToCsv([content({ name: 'X', f_aaaaaa: 'a', f_bbbbbb: 'b', f_cccccc: 3 })], fields);
    expect(csv.split('\r\n')[0]).toBe('name,f_aaaaaa,f_bbbbbb,f_cccccc');
  });

  // A GM who drops the default `value` field and adds their own "Value" leaves
  // the old values under `value`. Exported by label, the two columns would both
  // read back into the new field, the leftover overwriting it.
  it('keeps a field apart from a leftover key that spells its label', () => {
    const fields: CharacterSheetField[] = [{ key: 'f_val001', label: 'Value', type: 'text' }];
    const entries = [{ name: 'Lantern', f_val001: 'Heirloom', value: '40' }];
    const csv = lootTableToCsv(entries.map(content), fields);
    expect(csv.split('\r\n')[0]).toBe('name,f_val001,value');
    expect(dataOf(parseLootTableCsv(csv, fields))).toEqual(entries[0]);
  });

  it('survives an item whose data is not JSON', () => {
    expect(lootTableToCsv([{ id: 1, name: 'Broken', data: 'not json' }], [])).toBe('name\r\nBroken');
  });
});

describe('lootCsvHelp', () => {
  it('lists the tab\'s fields as the optional columns', () => {
    expect(lootCsvHelp(CONTACT_FIELDS)).toContain('Optional columns: Relationship, Trust, Age, Met in person, Description');
  });
});
