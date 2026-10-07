import { describe, it, expect } from 'vitest';
import { resolveSheetLayout } from '@/hooks/useSheetLayout';
import type { CharacterData, SheetTab } from '@/types/characters';
import {
  charactersWithFieldData,
  charactersWithTabData,
  fieldRemovalMessage,
  tabRemovalMessage,
  generateKey,
  labelProblem,
  layoutProblems,
  missingBuiltInTabs,
  missingDefaultFields,
  newCustomTab,
  newField,
  optionProblems,
  parseOptions,
  sampleEntry,
  toSheetConfig,
  type CastSheetData,
} from './sheetLayoutEditing';

const defaults = () => resolveSheetLayout(undefined).tabs;
const tabNamed = (tabs: SheetTab[], key: string) => tabs.find((tab) => tab.key === key)!;

const contacts = (overrides: Partial<SheetTab> = {}): SheetTab => ({
  key: 't_abc123',
  label: 'Contacts',
  fields: [{ key: 'f_loc001', label: 'Location', type: 'text' }],
  isBuiltIn: false,
  ...overrides,
});

describe('toSheetConfig', () => {
  it('saves the untouched default layout as an empty config', () => {
    expect(toSheetConfig(defaults())).toEqual({});
  });

  // A game from before tab composition resolves its legacy labels into the
  // tabs. Saving unchanged must keep the names while dropping `labels`.
  it('carries legacy labels over as tab labels', () => {
    const tabs = resolveSheetLayout({ labels: { inventory: 'Gear' } }).tabs;
    expect(toSheetConfig(tabs)).toEqual({
      tabs: [{ key: 'skills' }, { key: 'inventory', label: 'Gear' }, { key: 'numbers' }],
    });
  });

  it('omits a built-in label that matches the default, or is blank', () => {
    const tabs = defaults();
    tabNamed(tabs, 'skills').label = '  Skills ';
    tabNamed(tabs, 'numbers').label = '   ';
    expect(toSheetConfig(tabs)).toEqual({});
  });

  it('stores a built-in tab’s full field list once it changes', () => {
    const tabs = defaults();
    const inventory = tabNamed(tabs, 'inventory');
    inventory.fields = inventory.fields.filter((f) => f.key !== 'value' && f.key !== 'weight');

    expect(toSheetConfig(tabs)).toEqual({
      tabs: [
        { key: 'skills' },
        {
          key: 'inventory',
          fields: [
            { key: 'quantity', label: 'Quantity', type: 'number' },
            { key: 'category', label: 'Category', type: 'text' },
            { key: 'description', label: 'Description', type: 'markdown' },
          ],
        },
        { key: 'numbers' },
      ],
    });
  });

  it('stores a reordered default layout', () => {
    const [skills, inventory, numbers] = defaults();
    expect(toSheetConfig([numbers, skills, inventory])).toEqual({
      tabs: [{ key: 'numbers' }, { key: 'skills' }, { key: 'inventory' }],
    });
  });

  it('stores an emptied tab list as no tabs, not the default', () => {
    expect(toSheetConfig([])).toEqual({ tabs: [] });
  });

  it('stores a custom tab whole, trimmed, with options only on a select', () => {
    const tab = contacts({
      label: ' Contacts ',
      fields: [
        { key: 'f_rel001', label: ' Relationship ', type: 'select', options: [' Ally ', 'Rival'] },
        { key: 'f_loc001', label: 'Location', type: 'text', options: ['stray'] },
      ],
    });
    expect(toSheetConfig([tab])).toEqual({
      tabs: [{
        key: 't_abc123',
        label: 'Contacts',
        fields: [
          { key: 'f_rel001', label: 'Relationship', type: 'select', options: ['Ally', 'Rival'] },
          { key: 'f_loc001', label: 'Location', type: 'text' },
        ],
      }],
    });
  });
});

describe('layoutProblems', () => {
  it('accepts the default layout', () => {
    expect(layoutProblems(defaults())).toEqual([]);
  });

  it('lets a built-in tab go unnamed (it falls back to its default) but not a custom one', () => {
    const skills = { ...tabNamed(defaults(), 'skills'), label: '' };
    expect(layoutProblems([skills, contacts({ label: '  ' })])).toEqual([
      { tabKey: 't_abc123', message: 'Tab name: Needs a name.' },
    ]);
  });

  it('flags too many tabs and fields', () => {
    const many = Array.from({ length: 9 }, (_, i) => contacts({ key: `t_tab00${i}` }));
    many[0].fields = Array.from({ length: 13 }, (_, i) => ({ key: `f_f${i}`, label: `F${i}`, type: 'text' as const }));
    const messages = layoutProblems(many).map((p) => p.message);
    expect(messages).toContain('A character sheet can have at most 8 tabs besides Public Profile and Private Notes.');
    expect(messages).toContain('A tab can have at most 12 fields.');
  });

  it('points a field problem at its field', () => {
    const tab = contacts({ fields: [{ key: 'f_loc001', label: '', type: 'text' }] });
    expect(layoutProblems([tab])).toEqual([
      { tabKey: 't_abc123', fieldKey: 'f_loc001', message: 'Field name: Needs a name.' },
    ]);
  });

  it('checks a select’s options', () => {
    const tab = contacts({ fields: [{ key: 'f_rel001', label: 'Relationship', type: 'select', options: [] }] });
    expect(layoutProblems([tab])[0]).toMatchObject({ fieldKey: 'f_rel001', message: 'A choice needs at least one option.' });
  });
});

describe('labelProblem', () => {
  it('counts characters, not UTF-16 units, like the backend', () => {
    // 24 emoji are 48 UTF-16 units, but 24 runes.
    expect(labelProblem('😀'.repeat(24), 24, true)).toBeNull();
    expect(labelProblem('😀'.repeat(25), 24, true)).toBe('Must be 24 characters or fewer.');
  });

  it('ignores surrounding whitespace, as the backend trims', () => {
    expect(labelProblem(`  ${'a'.repeat(24)}  `, 24, true)).toBeNull();
  });

  it('rejects control characters', () => {
    expect(labelProblem('Tab\tname', 24, true)).toBe('Must not contain control characters.');
  });
});

describe('optionProblems / parseOptions', () => {
  it('reads one option per line, dropping blank lines', () => {
    expect(parseOptions('Ally\n\n  Rival  \n')).toEqual(['Ally', 'Rival']);
  });

  it('flags duplicates, over-long options and too many', () => {
    expect(optionProblems(['Ally', ' Ally '])).toEqual(['Option "Ally" is listed more than once.']);
    expect(optionProblems(['a'.repeat(41)])[0]).toMatch(/40 characters or fewer/);
    expect(optionProblems(Array.from({ length: 21 }, (_, i) => `O${i}`))).toEqual(['A choice can have at most 20 options.']);
  });
});

describe('keys', () => {
  it('generates keys in the shape the backend accepts, avoiding taken ones', () => {
    const taken = new Set<string>();
    for (let i = 0; i < 50; i++) {
      const key = generateKey('f_', taken);
      expect(key).toMatch(/^f_[a-z0-9]{6}$/);
      expect(taken.has(key)).toBe(false);
      taken.add(key);
    }
    expect(generateKey('t_', new Set())).toMatch(/^t_[a-z0-9]{6}$/);
  });

  it('starts a new tab with a description field', () => {
    const tab = newCustomTab('  Contacts ', new Set());
    expect(tab).toMatchObject({ label: 'Contacts', isBuiltIn: false });
    expect(tab.fields).toEqual([{ key: 'description', label: 'Description', type: 'markdown' }]);
  });

  it('gives options only to a select', () => {
    expect(newField('Trust', 'number', ['x'], new Set())).not.toHaveProperty('options');
    expect(newField('Relationship', 'select', [' Ally '], new Set())).toMatchObject({ options: ['Ally'] });
  });
});

describe('restoring defaults', () => {
  it('lists the default fields a built-in tab has lost', () => {
    const inventory = tabNamed(defaults(), 'inventory');
    inventory.fields = inventory.fields.filter((f) => f.key !== 'weight');
    expect(missingDefaultFields(inventory)).toEqual([{ key: 'weight', label: 'Weight', type: 'number' }]);
    expect(missingDefaultFields(contacts())).toEqual([]);
  });

  it('lists the built-in tabs a layout has removed', () => {
    const [skills] = defaults();
    expect(missingBuiltInTabs([skills, contacts()]).map((t) => t.key)).toEqual(['inventory', 'numbers']);
  });
});

describe('character data counts', () => {
  const row = (characterId: number, moduleType: string, fieldName: string, value: unknown): CharacterData => ({
    id: characterId,
    character_id: characterId,
    module_type: moduleType,
    field_name: fieldName,
    field_value: typeof value === 'string' ? value : JSON.stringify(value),
    field_type: 'json',
    created_at: '',
    updated_at: '',
  }) as CharacterData;

  const cast: CastSheetData = {
    '1': [row(1, 'inventory', 'items', [{ id: 'a', name: 'Rope', weight: 2 }])],
    '2': [row(2, 'inventory', 'items', [{ id: 'b', name: 'Lamp' }])],
    '3': [row(3, 'inventory', 'items', [])],
    '4': [row(4, 'skills', 'skills', [{ id: 'c', name: 'Stealth', level: 3 }])],
    '5': [row(5, 't_abc123', 't_abc123', 'not json')],
  };

  it('counts characters with entries on a tab, under its storage name', () => {
    expect(charactersWithTabData(cast, 'inventory')).toBe(2);
    expect(charactersWithTabData(cast, 't_abc123')).toBe(0);
    expect(charactersWithTabData(undefined, 'inventory')).toBe(0);
  });

  it('counts characters with a value in a field, reading legacy keys', () => {
    expect(charactersWithFieldData(cast, 'inventory', 'weight')).toBe(1);
    expect(charactersWithFieldData(cast, 'inventory', 'value')).toBe(0);
    // Stored as the legacy `level`, shown as Rank.
    expect(charactersWithFieldData(cast, 'skills', 'rank')).toBe(1);
  });
});

describe('sampleEntry', () => {
  it('fills every field with something its type can show', () => {
    expect(sampleEntry([
      { key: 'f_a', label: 'A', type: 'text' },
      { key: 'f_b', label: 'B', type: 'select', options: ['Ally', 'Rival'] },
      { key: 'f_c', label: 'C', type: 'track' },
      { key: 'f_d', label: 'D', type: 'select', options: [] },
    ])).toEqual({
      id: 'preview',
      name: 'Sample entry',
      f_a: 'Example',
      f_b: 'Ally',
      f_c: { value: 3, max: 5, display: 'track' },
    });
  });
});

describe('removal messages', () => {
  it('says how many characters lose sight of their data, and whether it comes back', () => {
    expect(tabRemovalMessage(3, true)).toBe("3 characters have entries here. They'll be hidden, not deleted. Restoring the tab shows them again.");
    expect(tabRemovalMessage(1, false)).toBe("1 character has entries here. They'll be hidden, not deleted. A removed custom tab can't be restored.");
    expect(tabRemovalMessage(undefined, true)).toBe('Any entries here will be hidden, not deleted. Restoring the tab shows them again.');
    expect(fieldRemovalMessage(2, true)).toBe("2 characters have a value in this field. It'll be hidden, not deleted. Restoring the default field shows it again.");
    expect(fieldRemovalMessage(undefined, false)).toBe("Any values in this field will be hidden, not deleted. A removed custom field can't be restored.");
  });
});
