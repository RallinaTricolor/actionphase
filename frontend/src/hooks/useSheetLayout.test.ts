import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import {
  useSheetLayout,
  resolveSheetLayout,
  DEFAULT_SHEET_LAYOUT,
  DEFAULT_SHEET_LABELS,
} from './useSheetLayout';
import { buildCharacterModules, storageFieldName } from '@/types/characters';

const keysOf = (config: Parameters<typeof resolveSheetLayout>[0]) =>
  resolveSheetLayout(config).tabs.map(tab => tab.key);
const labelsOf = (config: Parameters<typeof resolveSheetLayout>[0]) =>
  resolveSheetLayout(config).tabs.map(tab => tab.label);

describe('resolveSheetLayout', () => {
  describe('with no tabs configured (every game today)', () => {
    it('returns the three built-in tabs with default labels and fields', () => {
      const { tabs } = resolveSheetLayout(undefined);

      expect(tabs.map(tab => [tab.key, tab.label])).toEqual([
        ['skills', 'Skills'],
        ['inventory', 'Inventory'],
        ['numbers', 'Numbers'],
      ]);
      expect(tabs.every(tab => tab.isBuiltIn)).toBe(true);
      // The default schemas use the JSON keys existing entries already carry,
      // which is what lets today's data render with no migration.
      expect(tabs[0].fields.map(f => f.key)).toEqual(['rank', 'category', 'description']);
      expect(tabs[1].fields.map(f => f.key)).toEqual(['quantity', 'category', 'value', 'weight', 'description']);
      expect(tabs[2].fields.map(f => [f.key, f.type])).toEqual([['amount', 'track'], ['description', 'markdown']]);
    });

    it('treats an empty config, null and an empty labels object the same way', () => {
      const expected = resolveSheetLayout(undefined);
      expect(resolveSheetLayout(null)).toEqual(expected);
      expect(resolveSheetLayout({})).toEqual(expected);
      expect(resolveSheetLayout({ labels: {} })).toEqual(expected);
    });

    it('applies legacy label overrides per tab, not all-or-nothing', () => {
      expect(labelsOf({ labels: { numbers: 'Stress' } })).toEqual(['Skills', 'Inventory', 'Stress']);
    });

    it('trims an override, and ignores a whitespace-only one', () => {
      expect(labelsOf({ labels: { skills: '  Playbook  ', inventory: '   ' } }))
        .toEqual(['Playbook', 'Inventory', 'Numbers']);
    });
  });

  describe('with tabs configured', () => {
    it('returns exactly those tabs, in that order', () => {
      expect(keysOf({ tabs: [{ key: 'numbers' }, { key: 't_abc123', label: 'Contacts', fields: [] }, { key: 'skills' }] }))
        .toEqual(['numbers', 't_abc123', 'skills']);
    });

    it('ignores legacy labels once tabs are present', () => {
      expect(labelsOf({ labels: { skills: 'Playbook' }, tabs: [{ key: 'skills' }] })).toEqual(['Skills']);
    });

    it('uses a built-in tab\'s own label when set', () => {
      expect(labelsOf({ tabs: [{ key: 'inventory', label: 'Gear' }] })).toEqual(['Gear']);
    });

    it('gives a built-in tab without fields its default schema', () => {
      // Absent and null both mean "default": the generated type allows null.
      for (const fields of [undefined, null]) {
        const [tab] = resolveSheetLayout({ tabs: [{ key: 'inventory', fields }] }).tabs;
        expect(tab.fields.map(f => f.key)).toEqual(['quantity', 'category', 'value', 'weight', 'description']);
      }
    });

    it('keeps a built-in tab whose fields were all removed empty', () => {
      const [tab] = resolveSheetLayout({ tabs: [{ key: 'inventory', fields: [] }] }).tabs;
      expect(tab.fields).toEqual([]);
    });

    it('uses a built-in tab\'s configured fields instead of the defaults', () => {
      const fields = [
        { key: 'quantity', label: 'Quantity', type: 'number' as const },
        { key: 'f_k2m9qa', label: 'Durability', type: 'number' as const },
      ];
      const [tab] = resolveSheetLayout({ tabs: [{ key: 'inventory', fields }] }).tabs;
      expect(tab.fields).toEqual(fields);
      expect(tab.isBuiltIn).toBe(true);
    });

    it('resolves a custom tab', () => {
      const fields = [{ key: 'f_a81x0p', label: 'Relationship', type: 'select' as const, options: ['Ally', 'Rival'] }];
      const [tab] = resolveSheetLayout({ tabs: [{ key: 't_8fjw2c', label: 'Contacts', fields }] }).tabs;
      expect(tab).toEqual({ key: 't_8fjw2c', label: 'Contacts', fields, isBuiltIn: false });
    });

    it('allows a layout with no configurable tabs', () => {
      expect(resolveSheetLayout({ tabs: [] }).tabs).toEqual([]);
    });
  });

  it('never hands out the shared default field arrays', () => {
    // A caller mutating its layout must not rewrite the defaults for every game.
    const [tab] = resolveSheetLayout(undefined).tabs;
    expect(tab.fields).not.toBe(DEFAULT_SHEET_LAYOUT[0].fields);
  });

  it('derives DEFAULT_SHEET_LABELS from the layout, keyed by its own lower-cased label', () => {
    expect(DEFAULT_SHEET_LABELS).toEqual({ skills: 'Skills', inventory: 'Inventory', numbers: 'Numbers' });
    for (const [key, label] of Object.entries(DEFAULT_SHEET_LABELS)) {
      expect(label.toLowerCase()).toBe(key);
    }
  });
});

describe('useSheetLayout', () => {
  it('reads the config off a game-shaped source', () => {
    const { result } = renderHook(() =>
      useSheetLayout({ character_sheet: { labels: { inventory: 'Load' } } })
    );
    expect(result.current.tabs.map(tab => tab.label)).toEqual(['Skills', 'Load', 'Numbers']);
  });

  it('yields the default layout for a game that has not loaded yet', () => {
    expect(renderHook(() => useSheetLayout(undefined)).result.current.tabs).toHaveLength(3);
    expect(renderHook(() => useSheetLayout(null)).result.current.tabs).toHaveLength(3);
  });

  it('keeps a stable identity across re-renders with the same config', () => {
    // The result feeds tab construction; a new object every render would
    // remount the active manager under an open editor.
    const config = { labels: { skills: 'Playbook' } };
    const { result, rerender } = renderHook(() => useSheetLayout({ character_sheet: config }));
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });
});

describe('buildCharacterModules', () => {
  it('builds today\'s five tabs for a game with no config', () => {
    const modules = buildCharacterModules(resolveSheetLayout(undefined));
    expect(modules.map(m => [m.type, m.name, m.fields[0].name])).toEqual([
      ['bio', 'Public Profile', 'background'],
      ['notes', 'Private Notes', 'private_notes'],
      ['skills', 'Skills', 'skills'],
      ['inventory', 'Inventory', 'items'],
      ['numbers', 'Numbers', 'numbers'],
    ]);
  });

  it('always leads with the fixed profile tabs, then follows the layout', () => {
    const modules = buildCharacterModules(resolveSheetLayout({
      tabs: [{ key: 't_abc123', label: 'Contacts', fields: [] }, { key: 'skills', label: 'Talents' }],
    }));
    expect(modules.map(m => [m.type, m.name, m.fields[0].name])).toEqual([
      ['bio', 'Public Profile', 'background'],
      ['notes', 'Private Notes', 'private_notes'],
      ['t_abc123', 'Contacts', 't_abc123'],
      ['skills', 'Talents', 'skills'],
    ]);
  });
});

describe('storageFieldName', () => {
  it('stores inventory under items and every other tab under its own key', () => {
    expect(storageFieldName('inventory')).toBe('items');
    expect(storageFieldName('skills')).toBe('skills');
    expect(storageFieldName('t_abc123')).toBe('t_abc123');
  });
});
