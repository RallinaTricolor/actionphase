import { describe, expect, it } from 'vitest';
import { resolveSheetLayout } from '@/hooks/useSheetLayout';
import type { CharacterData, SheetTab } from '@/types/characters';
import {
  applyOps,
  defaultOpTab,
  descriptionOnly,
  diffCount,
  draftUpdates,
  driftedItem,
  editOpFrom,
  itemSig,
  keepLine,
  lineEffect,
  lineFromItem,
  lineSteps,
  lineText,
  sameUpdates,
  sheetDiff,
  sheetBeforeFor,
  sheetFor,
  sheetTabsFrom,
  stable,
  syncLine,
  type SheetTabs,
} from './rewards';
import type { RewardItem, RewardLine, SheetOp } from './types';
import { canonicalEntry } from '@/lib/sheetFieldValues';

const challenges: SheetTab = {
  key: 't_chal01',
  label: 'Challenges',
  isBuiltIn: false,
  fields: [
    { key: 'progress', label: 'Progress', type: 'track' },
    { key: 'done', label: 'Done', type: 'checkbox' },
  ],
};
const layout: SheetTab[] = [...resolveSheetLayout(null).tabs, challenges];

const row = (module_type: string, field_name: string, value: unknown): CharacterData =>
  ({ id: 1, character_id: 1, module_type, field_name, field_value: JSON.stringify(value), field_type: 'json', created_at: '', updated_at: '' }) as CharacterData;

const liveSheet = (): SheetTabs =>
  sheetTabsFrom(
    [
      row('numbers', 'numbers', [{ id: 'n1', name: 'Rating', amount: { value: 4 } }]),
      row('inventory', 'items', [{ id: 'i1', name: 'Rope', quantity: 1 }]),
      row('skills', 'skills', [{ id: 's1', name: 'Bane', rank: 'Tier 2' }]),
      row('t_chal01', 't_chal01', [{ id: 'c1', name: 'Versatile', progress: { value: 2, max: 7 } }]),
    ],
    layout,
  );

const line = (id: string, over: Partial<RewardLine> = {}): RewardLine => ({ id, group: 'result', text: '', ops: [], choose: false, ...over });

describe('sheetTabsFrom', () => {
  it('reads each tab through normalizeEntry, so legacy rows read like the sheet shows them', () => {
    const tabs = sheetTabsFrom([row('numbers', 'numbers', [{ id: 'n1', type: 'Gold', amount: 3, max: 9 }])], layout);
    expect(tabs.numbers).toEqual([{ id: 'n1', name: 'Gold', amount: { value: 3, max: 9 } }]);
    expect(tabs.inventory).toEqual([]);
  });

  it('gives rows without an id a stable one, so working them out twice gives the same sheet', () => {
    const rows = [row('inventory', 'items', [{ name: 'Rope' }])];
    expect(sheetTabsFrom(rows, layout).inventory[0].id).toBe(sheetTabsFrom(rows, layout).inventory[0].id);
  });

  it('treats a broken value as an empty tab', () => {
    const broken = { ...row('inventory', 'items', []), field_value: '{not json' } as CharacterData;
    expect(sheetTabsFrom([broken], layout).inventory).toEqual([]);
  });
});

describe('applyOps', () => {
  it('adds to a track, keeping its max, and fixes the entry name’s capitals', () => {
    const tabs = liveSheet();
    const [rec] = applyOps(layout, tabs, [{ act: 'inc', tab: 't_chal01', entry: 'versatile', by: 1 }], () => 'x');
    expect(rec).toMatchObject({ entry: 'Versatile', field: 'progress', before: '2', after: '3' });
    expect(tabs.t_chal01[0].progress).toEqual({ value: 3, max: 7 });
  });

  it('rounds to two decimals', () => {
    const tabs = liveSheet();
    applyOps(layout, tabs, [{ act: 'inc', tab: 'numbers', entry: 'Rating', by: 0.1 }, { act: 'inc', tab: 'numbers', entry: 'Rating', by: 0.2 }], () => 'x');
    expect(tabs.numbers[0].amount).toEqual({ value: 4.3 });
  });

  it('warns over a max and below 0, but still applies', () => {
    const tabs = liveSheet();
    const [over] = applyOps(layout, tabs, [{ act: 'inc', tab: 't_chal01', entry: 'Versatile', by: 6 }], () => 'x');
    expect(over.warn).toBe('Versatile would be over its max (8/7)');
    const [under] = applyOps(layout, tabs, [{ act: 'inc', tab: 'numbers', entry: 'Rating', by: -5 }], () => 'x');
    expect(under.warn).toBe('Rating would go below 0');
    expect(tabs.numbers[0].amount).toEqual({ value: -1 });
  });

  it('sets a field by its type', () => {
    const tabs = liveSheet();
    const recs = applyOps(
      layout,
      tabs,
      [
        { act: 'set', tab: 'skills', entry: 'Bane', field: 'rank', value: 'Tier 3' },
        { act: 'set', tab: 't_chal01', entry: 'Versatile', field: 'done', value: 'true' },
        { act: 'set', tab: 'inventory', entry: 'Rope', field: 'quantity', value: '4' },
      ],
      () => 'x',
    );
    expect(recs.map((r) => [r.before, r.after])).toEqual([
      ['Tier 2', 'Tier 3'],
      ['—', 'yes'],
      ['1', '4'],
    ]);
    expect(tabs.inventory[0].quantity).toBe(4);
  });

  it('adds an entry with typed fields and the id it’s given, skipping blank fields', () => {
    const tabs = liveSheet();
    const [rec] = applyOps(layout, tabs, [{ act: 'add', tab: 'inventory', entry: ' Remote Explosive ', fields: { quantity: '1', category: '', description: 'Boom' } }], (i) => `new-${i}`);
    expect(rec).toMatchObject({ entry: 'Remote Explosive', after: 'added' });
    expect(tabs.inventory[1]).toEqual({ id: 'new-0', name: 'Remote Explosive', quantity: 1, description: 'Boom' });
  });

  it('warns about a duplicate name and refuses a nameless new entry', () => {
    const tabs = liveSheet();
    const [dup, nameless] = applyOps(
      layout,
      tabs,
      [
        { act: 'add', tab: 'inventory', entry: 'rope', fields: {} },
        { act: 'add', tab: 'inventory', entry: '', fields: {} },
      ],
      (i) => `n${i}`,
    );
    expect(dup.warn).toBe('Inventory already has an entry named rope');
    expect(nameless.err).toBe('A new Inventory entry needs a name');
    expect(tabs.inventory).toHaveLength(2);
  });

  it('removes an entry', () => {
    const tabs = liveSheet();
    applyOps(layout, tabs, [{ act: 'remove', tab: 'inventory', entry: 'ROPE' }], () => 'x');
    expect(tabs.inventory).toEqual([]);
  });

  it('says why an op can’t apply and changes nothing', () => {
    const tabs = liveSheet();
    const recs = applyOps(
      layout,
      tabs,
      [
        { act: 'inc', tab: 'nope', entry: 'Rating', by: 1 },
        { act: 'inc', tab: 'numbers', entry: 'Gold', by: 1 },
        { act: 'inc', tab: 'numbers', entry: '', by: 1 },
      ],
      () => 'x',
    );
    expect(recs.map((r) => r.err)).toEqual(['There’s no sheet tab “nope”', 'There’s no Numbers entry named “Gold”', 'Pick which Numbers entry']);
    expect(tabs).toEqual(liveSheet());
  });
});

// The prod incident behind these: drafts wrote entries the sheet editor reads
// differently, so the next time someone opened the sheet and saved, it erased
// data. Every entry the board writes must be one the editor saves back as is.
describe('applyOps writes entries the sheet editor saves back unchanged', () => {
  const allTypes: SheetTab = {
    key: 't_all001',
    label: 'Contacts',
    isBuiltIn: false,
    fields: [
      { key: 'rank', label: 'Rank', type: 'text' },
      { key: 'quantity', label: 'Quantity', type: 'number' },
      { key: 'description', label: 'Description', type: 'markdown' },
      { key: 'kind', label: 'Kind', type: 'select', options: ['Ally', 'Rival'] },
      { key: 'known', label: 'Known', type: 'checkbox' },
      { key: 'trust', label: 'Trust', type: 'track' },
      { key: 'dice', label: 'Dice', type: 'dice' as SheetTab['fields'][number]['type'] },
    ],
  };
  const allLayout = [...layout, allTypes];
  const mara = { id: 'm1', name: 'Mara', rank: 'Tier 1', quantity: 2, kind: 'Ally', known: true, trust: { value: 2, max: 5, display: 'boxes' }, dice: { sides: 6 } };
  const sheet = (): SheetTabs => sheetTabsFrom([row('t_all001', 't_all001', [mara])], allLayout);

  const expectEditorKeeps = (tabs: SheetTabs) => {
    for (const entry of tabs.t_all001) expect(entry).toEqual(canonicalEntry(allTypes.fields, entry));
  };

  it.each([
    ['set text, with spaces', { act: 'set', field: 'rank', value: '  Tier 2 ' }, { rank: 'Tier 2' }],
    ['clear text', { act: 'set', field: 'rank', value: '' }, { rank: undefined }],
    ['set a number', { act: 'set', field: 'quantity', value: '7' }, { quantity: 7 }],
    ['clear a number', { act: 'set', field: 'quantity', value: '' }, { quantity: undefined }],
    ['set a select', { act: 'set', field: 'kind', value: 'Rival' }, { kind: 'Rival' }],
    ['untick a checkbox', { act: 'set', field: 'known', value: 'false' }, { known: undefined }],
    ['set a track, keeping its max and display', { act: 'set', field: 'trust', value: '4' }, { trust: { value: 4, max: 5, display: 'boxes' } }],
    ['add to a number', { act: 'inc', field: 'quantity', by: -1 }, { quantity: 1 }],
    ['add to a track, keeping its max and display', { act: 'inc', field: 'trust', by: -3 }, { trust: { value: -1, max: 5, display: 'boxes' } }],
  ])('%s', (_, op, expected) => {
    const tabs = sheet();
    const [rec] = applyOps(allLayout, tabs, [{ tab: 't_all001', entry: 'mara', ...op } as SheetOp], () => 'x');
    expect(rec.err).toBeUndefined();
    const entry = tabs.t_all001[0];
    for (const [key, value] of Object.entries(expected)) {
      if (value === undefined) expect(entry).not.toHaveProperty(key);
      else expect(entry[key]).toEqual(value);
    }
    expect(entry.dice).toEqual({ sides: 6 });
    expectEditorKeeps(tabs);
  });

  it('adds an entry from typed strings, blanks and an unticked box left out', () => {
    const tabs = sheet();
    applyOps(
      allLayout,
      tabs,
      [{ act: 'add', tab: 't_all001', entry: 'Oskar', fields: { rank: ' Tier 1 ', quantity: '2', description: '', kind: 'Rival', known: 'false', trust: '3' } }],
      () => 'new',
    );
    expect(tabs.t_all001[1]).toEqual({ id: 'new', name: 'Oskar', rank: 'Tier 1', quantity: 2, kind: 'Rival', trust: { value: 3 } });
    expectEditorKeeps(tabs);
  });

  it('adds to a track the entry doesn’t have yet', () => {
    const tabs = sheetTabsFrom([row('t_all001', 't_all001', [{ id: 'm1', name: 'Mara' }])], allLayout);
    applyOps(allLayout, tabs, [{ act: 'inc', tab: 't_all001', entry: 'Mara', field: 'trust', by: 2 }], () => 'x');
    expect(tabs.t_all001[0].trust).toEqual({ value: 2 });
    expectEditorKeeps(tabs);
  });

  it('refuses a field of a type it can’t write, or one the tab doesn’t have, and changes nothing', () => {
    const tabs = sheet();
    const recs = applyOps(
      allLayout,
      tabs,
      [
        { act: 'set', tab: 't_all001', entry: 'Mara', field: 'dice', value: 'd8' },
        { act: 'set', tab: 't_all001', entry: 'Mara', field: 'gone', value: 'x' },
      ],
      () => 'x',
    );
    expect(recs.map((r) => r.err)).toEqual(['Contacts’s Dice can’t be changed here', 'Contacts has no field “gone”']);
    expect(tabs).toEqual(sheet());
  });

  it('writes the entries no op changed back exactly as they were stored, as the sheet editor does', () => {
    const modern = { name: 'Gold', id: 'n1', amount: { value: 3 }, custom: { kept: [1, 2] } };
    const legacy = { id: 'n2', type: 'Stress', amount: 2, max: 9, display: 'boxes' };
    const noId = { name: 'Rep', amount: { value: 1 } };
    const rows = [row('numbers', 'numbers', [modern, legacy, noId, { id: 'n4', name: 'XP', amount: { value: 5 } }])];
    const state = sheetFor(layout, sheetTabsFrom(rows, layout), [line('l1', { ops: [{ act: 'inc', tab: 'numbers', entry: 'XP', by: 1 }] })]);
    const [update] = draftUpdates(sheetDiff(layout, state));
    expect(update.field_value).toBe(JSON.stringify([modern, legacy, noId, { id: 'n4', name: 'XP', amount: { value: 6 } }]));
  });

  it('edits several fields at once and renames, leaving the rest as it was', () => {
    const tabs = sheet();
    const [rec] = applyOps(
      allLayout,
      tabs,
      [{ act: 'edit', tab: 't_all001', entry: 'mara', name: ' Mara Vey ', values: { rank: ' Tier 3 ', quantity: '5', known: null, trust: { value: 4, max: 5, display: 'boxes' } } }],
      () => 'x',
    );
    expect(rec).toMatchObject({ entry: 'Mara', before: 'Mara', after: 'Mara Vey' });
    expect(rec.err).toBeUndefined();
    expect(tabs.t_all001[0]).toEqual({ id: 'm1', name: 'Mara Vey', rank: 'Tier 3', quantity: 5, kind: 'Ally', trust: { value: 4, max: 5, display: 'boxes' }, dice: { sides: 6 } });
    expectEditorKeeps(tabs);
  });

  it('applies an edit on top of an earlier change to another field', () => {
    const tabs = sheet();
    applyOps(
      allLayout,
      tabs,
      [
        { act: 'inc', tab: 't_all001', entry: 'Mara', field: 'quantity', by: -2 },
        { act: 'edit', tab: 't_all001', entry: 'Mara', values: { rank: 'Tier 2' } },
      ],
      () => 'x',
    );
    expect(tabs.t_all001[0]).toMatchObject({ quantity: 0, rank: 'Tier 2' });
  });

  it('refuses an edit to a field it can’t write, and warns about a rename onto another entry', () => {
    const tabs = sheetTabsFrom([row('t_all001', 't_all001', [mara, { id: 'o1', name: 'Oskar' }])], allLayout);
    const recs = applyOps(
      allLayout,
      tabs,
      [
        { act: 'edit', tab: 't_all001', entry: 'Mara', values: { rank: 'Tier 9', dice: { sides: 8 } } },
        { act: 'edit', tab: 't_all001', entry: 'Mara', name: 'oskar', values: {} },
      ],
      () => 'x',
    );
    expect(recs[0].err).toBe('Contacts’s Dice can’t be changed here');
    expect(recs[1].warn).toBe('Contacts already has an entry named Oskar');
    expect(tabs.t_all001[0].rank).toBe('Tier 1');
  });

  it('writes an old-shape entry an op changed in the current shape', () => {
    const rows = [row('numbers', 'numbers', [{ id: 'n2', type: 'Stress', amount: 2, max: 9, display: 'boxes' }])];
    const state = sheetFor(layout, sheetTabsFrom(rows, layout), [line('l1', { ops: [{ act: 'inc', tab: 'numbers', entry: 'Stress', by: 1 }] })]);
    const [update] = draftUpdates(sheetDiff(layout, state));
    expect(JSON.parse(update.field_value)).toEqual([{ id: 'n2', name: 'Stress', amount: { value: 3, max: 9, display: 'boxes' } }]);
  });
});

describe('lineSteps', () => {
  const earlier = line('l1', { ops: [{ act: 'add', tab: 'inventory', entry: 'Lockpicks', fields: {} }] });
  const editing = line('l2', {
    ops: [
      { act: 'inc', tab: 'inventory', entry: 'Lockpicks', by: 2 },
      { act: 'remove', tab: 'inventory', entry: 'Rope' },
    ],
  });

  it('starts after the character’s earlier lines and gives the sheet before each op', () => {
    const steps = lineSteps(layout, liveSheet(), [earlier, editing], editing);
    expect(steps.before.inventory.map((e) => e.name)).toEqual(['Rope', 'Lockpicks']);
    expect(steps.steps.map((t) => t.inventory.map((e) => e.name))).toEqual([
      ['Rope', 'Lockpicks'],
      ['Rope', 'Lockpicks'],
    ]);
    expect(steps.after.inventory).toEqual([{ id: 'rw-l1-0', name: 'Lockpicks', quantity: 2 }]);
    expect(steps.recs.map((r) => r.after)).toEqual(['2', 'removed']);
  });

  it('puts a line not in the list yet after all of them, with the ids sheetFor gives', () => {
    const fresh = line('l3', { ops: [{ act: 'add', tab: 'inventory', entry: 'Map', fields: {} }] });
    const steps = lineSteps(layout, liveSheet(), [earlier], fresh);
    expect(steps.after.inventory).toEqual(sheetFor(layout, liveSheet(), [earlier, fresh]).after.inventory);
  });

  it('leaves the sheet alone for Choose 1', () => {
    const steps = lineSteps(layout, liveSheet(), [], { ...editing, choose: true });
    expect(steps.steps).toEqual([]);
    expect(steps.after).toEqual(steps.before);
  });
});

describe('editOpFrom', () => {
  const contacts: SheetTab = {
    key: 't_con001',
    label: 'Contacts',
    isBuiltIn: false,
    fields: [
      { key: 'rank', label: 'Rank', type: 'text' },
      { key: 'quantity', label: 'Quantity', type: 'number' },
      { key: 'trust', label: 'Trust', type: 'track' },
    ],
  };

  it('keeps only what the form changed, a cleared field as null', () => {
    const entry = { id: 'm1', name: 'Mara', rank: 'Tier 1', quantity: 2, trust: { value: 2, max: 5 } };
    const op = editOpFrom(contacts, entry, { name: 'Mara', values: { rank: undefined, quantity: 3, trust: { value: 2, max: 5 } } });
    expect(op).toEqual({ act: 'edit', tab: 't_con001', entry: 'Mara', values: { rank: null, quantity: 3 } });
  });

  it('compares against what the editor would store, so an untouched legacy value isn’t a change', () => {
    const entry = { id: 'm1', name: 'Mara', rank: ' Tier 1 ', quantity: 2 };
    expect(editOpFrom(contacts, entry, { name: 'Mara', values: { rank: 'Tier 1', quantity: 2, trust: undefined } }).values).toEqual({});
  });

  it('records a rename', () => {
    expect(editOpFrom(contacts, { id: 'm1', name: 'Mara' }, { name: ' Mara Vey ', values: {} })).toMatchObject({ entry: 'Mara', name: 'Mara Vey' });
  });

  it('becomes an op that, applied, gives what the form saved', () => {
    const entry = { id: 'm1', name: 'Mara', rank: 'Tier 1', quantity: 2, trust: { value: 2, max: 5, display: 'boxes' as const } };
    const edit = { name: 'Mara', values: { rank: 'Tier 2', quantity: undefined, trust: { value: 4, max: 5, display: 'boxes' as const } } };
    const tabs: SheetTabs = { t_con001: [entry] };
    applyOps([contacts], tabs, [editOpFrom(contacts, entry, edit)], () => 'x');
    expect(tabs.t_con001[0]).toEqual({ id: 'm1', name: 'Mara', rank: 'Tier 2', trust: { value: 4, max: 5, display: 'boxes' } });
  });
});

describe('sheetFor and sheetDiff', () => {
  it('applies the lines in order, leaving Choose 1 lines off the sheet', () => {
    const lines = [
      line('a', { ops: [{ act: 'inc', tab: 'numbers', entry: 'Rating', by: 2 }] }),
      line('b', { choose: true, ops: [{ act: 'inc', tab: 'numbers', entry: 'Rating', by: 9 }] }),
      line('c', { ops: [{ act: 'inc', tab: 'numbers', entry: 'Rating', by: 0.5 }] }),
    ];
    const state = sheetFor(layout, liveSheet(), lines);
    expect(state.before.numbers[0].amount).toEqual({ value: 4 });
    expect(state.after.numbers[0].amount).toEqual({ value: 6.5 });
    expect(state.recs.b).toEqual([]);
    expect(state.recs.c[0]).toMatchObject({ before: '6', after: '6.5' });
  });

  it('gives a new entry an id from its line, so the same lines give the same drafts', () => {
    const lines = [line('l1', { ops: [{ act: 'add', tab: 'skills', entry: 'Flight', fields: {} }] })];
    const once = draftUpdates(sheetDiff(layout, sheetFor(layout, liveSheet(), lines)));
    const twice = draftUpdates(sheetDiff(layout, sheetFor(layout, liveSheet(), lines)));
    expect(once).toEqual(twice);
    expect(JSON.parse(once[0].field_value)[1].id).toBe('rw-l1-0');
  });

  it('lists adds, changes and removals per tab, leaving out tabs with none', () => {
    const lines = [
      line('a', {
        ops: [
          { act: 'inc', tab: 'numbers', entry: 'Rating', by: 1 },
          { act: 'add', tab: 'inventory', entry: 'Key', fields: {} },
          { act: 'remove', tab: 'inventory', entry: 'Rope' },
        ],
      }),
    ];
    const diff = sheetDiff(layout, sheetFor(layout, liveSheet(), lines));
    expect(diff.map((d) => d.tab.key)).toEqual(['inventory', 'numbers']);
    expect(diff[0].rows).toEqual([
      { kind: 'add', name: 'Key' },
      { kind: 'remove', name: 'Rope' },
    ]);
    expect(diff[1].rows).toEqual([{ kind: 'change', name: 'Rating', fields: [{ key: 'amount', label: 'Amount', before: '4', after: '5' }] }]);
    expect(diffCount(diff)).toBe(3);
  });

  it('becomes one whole-tab draft per changed tab, under the tab’s storage field', () => {
    const lines = [line('a', { ops: [{ act: 'add', tab: 'inventory', entry: 'Key', fields: {} }] })];
    const [update] = draftUpdates(sheetDiff(layout, sheetFor(layout, liveSheet(), lines)));
    expect(update.module_type).toBe('inventory');
    expect(update.field_name).toBe('items');
    expect(JSON.parse(update.field_value).map((e: { name: string }) => e.name)).toEqual(['Rope', 'Key']);
  });

  it('no lines, no drafts', () => {
    expect(draftUpdates(sheetDiff(layout, sheetFor(layout, liveSheet(), [])))).toEqual([]);
  });
});

describe('sameUpdates', () => {
  it('ignores key order and tab order', () => {
    const a = [
      { module_type: 'numbers', field_name: 'numbers', field_value: '[{"id":"n","name":"R","amount":{"value":1}}]' },
      { module_type: 'inventory', field_name: 'items', field_value: '[]' },
    ];
    const b = [
      { module_type: 'inventory', field_name: 'items', field_value: '[]' },
      { module_type: 'numbers', field_name: 'numbers', field_value: '[{"amount":{"value":1},"name":"R","id":"n"}]' },
    ];
    expect(sameUpdates(a, b)).toBe(true);
    expect(sameUpdates(a, b.slice(0, 1))).toBe(false);
  });
});

describe('list items and drift', () => {
  const item: RewardItem = { id: 'it1', scope: 'game', name: 'Partial', group: 'result', text: '**Partial** - 1 rating', ops: [{ act: 'inc', tab: 'numbers', entry: 'Rating', by: 1 }], choose: false, position: 1 };

  it('stable ignores key order', () => {
    expect(stable({ b: 1, a: [{ d: 2, c: 3 }] })).toBe(stable({ a: [{ c: 3, d: 2 }], b: 1 }));
  });

  it('a given line is a copy with the item’s signature', () => {
    const l = lineFromItem(item, 'l1', { quote: 'I climb' });
    expect(l).toMatchObject({ id: 'l1', itemId: 'it1', itemSig: itemSig(item), group: 'result', text: item.text, quote: 'I climb' });
    l.ops[0] = { act: 'remove', tab: 'numbers', entry: 'Rating' };
    expect(item.ops[0].act).toBe('inc');
  });

  it('flags a line once its item changes, but not for a rename', () => {
    const l = lineFromItem(item, 'l1');
    expect(driftedItem(l, [{ ...item, name: 'Partly' }])).toBeUndefined();
    const changed = { ...item, text: '**Partial** - 2 rating' };
    expect(driftedItem(l, [changed])).toBe(changed);
    expect(driftedItem(keepLine(l, changed), [changed])).toBeUndefined();
    const synced = syncLine({ ...l, quote: 'q', sceneId: 's' }, changed);
    expect(synced).toMatchObject({ id: 'l1', text: changed.text, quote: 'q', sceneId: 's' });
    expect(driftedItem(synced, [changed])).toBeUndefined();
  });

  it('a one-off or a deleted item never drifts', () => {
    expect(driftedItem(line('x'), [item])).toBeUndefined();
    expect(driftedItem(lineFromItem(item, 'l'), [])).toBeUndefined();
  });

  it('describes a line’s effect', () => {
    expect(lineEffect(layout, item)).toBe('Numbers · Rating +1');
    expect(lineEffect(layout, { choose: true, ops: [] })).toBe('Player chooses after publishing. No sheet change now.');
    expect(lineEffect(layout, { choose: false, ops: [{ act: 'add', tab: 'skills', entry: '', fields: {} }, { act: 'set', tab: 'skills', entry: 'Bane', field: 'rank', value: 'Tier 3' }] })).toBe(
      'Skills: + (name it), Skills · Bane: Rank = Tier 3',
    );
    expect(lineEffect(layout, { choose: false, ops: [{ act: 'edit', tab: 'skills', entry: 'Bane', name: 'Banes', values: { rank: 'Tier 3' } }, { act: 'edit', tab: 'skills', entry: 'Bane', values: {} }] })).toBe(
      'Skills · Bane → Banes: Rank, Skills · Bane: no changes yet',
    );
  });
});

describe('defaultOpTab', () => {
  const defaults = resolveSheetLayout(null).tabs;
  const inc = (tab: string) => ({ act: 'inc' as const, tab, entry: '', by: 1 });

  it('starts on the first tab with a track, not the first with a number', () => {
    expect(defaultOpTab(defaults, [])?.key).toBe('numbers');
    expect(defaultOpTab([defaults[1], challenges], [])?.key).toBe('t_chal01');
  });

  it('falls back to a number field, then to the first tab', () => {
    expect(defaultOpTab([defaults[0], defaults[1]], [])?.key).toBe('inventory');
    expect(defaultOpTab([defaults[0]], [])?.key).toBe('skills');
    expect(defaultOpTab([], [])).toBeUndefined();
  });

  it("stays on the previous change's tab", () => {
    expect(defaultOpTab(layout, [inc('t_chal01'), inc('inventory')])?.key).toBe('inventory');
  });

  it('ignores a previous tab that is no longer on the sheet', () => {
    expect(defaultOpTab(defaults, [inc('gone')])?.key).toBe('numbers');
  });
});

describe('lineText', () => {
  it('fills entry, before and after from the first op', () => {
    const l = line('a', { text: 'Upgraded {{entry}} {{before}} -> {{ after }}', ops: [{ act: 'set', tab: 'skills', entry: 'bane', field: 'rank', value: 'Tier 3' }] });
    const state = sheetFor(layout, liveSheet(), [l]);
    expect(lineText(l, state.recs.a)).toBe('Upgraded Bane Tier 2 -> Tier 3');
    expect(lineText({ text: '{{entry}}' }, [])).toBe('?');
  });

  it('{{gain}} is what the first op added; ? when it changed no number', () => {
    const l = line('a', { text: '{{gain}} / {{before}} -> {{after}}', ops: [{ act: 'inc', tab: 'numbers', entry: 'rating', by: 2 }] });
    expect(lineText(l, sheetFor(layout, liveSheet(), [l]).recs.a)).toBe('+2 / 4 -> 6');
    const down = line('b', { text: '{{gain}}', ops: [{ act: 'inc', tab: 'numbers', entry: 'Rating', by: -1.5 }] });
    expect(lineText(down, sheetFor(layout, liveSheet(), [down]).recs.b)).toBe('-1.5');
    const add = line('c', { text: '{{gain}}', ops: [{ act: 'add', tab: 'inventory', entry: 'Key', fields: {} }] });
    expect(lineText(add, sheetFor(layout, liveSheet(), [add]).recs.c)).toBe('?');
  });

  it('a Tab/Entry ref picks the op on that entry, by tab label or key, any capitals', () => {
    const l = line('a', {
      text: '{{gain Numbers/Rating}} {{after numbers/rating}} {{before Challenges/Versatile}} {{gain t_chal01/Versatile/Progress}} {{entry Inventory/Key}}',
      ops: [
        { act: 'add', tab: 'inventory', entry: 'Key', fields: {} },
        { act: 'inc', tab: 'numbers', entry: 'Rating', by: 3 },
        { act: 'inc', tab: 't_chal01', entry: 'Versatile', by: 1 },
      ],
    });
    expect(lineText(l, sheetFor(layout, liveSheet(), [l]).recs.a, layout)).toBe('+3 7 2 +1 Key');
  });

  it('a ref to an entry the line doesn\u2019t change is ?, and other tags are left for the block', () => {
    const l = line('a', { text: '{{gain Numbers/Gold}} {{after Skills/Bane}} {{value Numbers/Rating}}', ops: [{ act: 'inc', tab: 'numbers', entry: 'Rating', by: 1 }] });
    expect(lineText(l, sheetFor(layout, liveSheet(), [l]).recs.a, layout)).toBe('? ? {{value Numbers/Rating}}');
  });
});

describe('descriptionOnly', () => {
  it('takes the Description column of a table', () => {
    expect(descriptionOnly('Name | Description | Tier\n:--|:--|:--\nRemote | You may **place** a bomb. | 1')).toBe('You may place a bomb.');
  });
  it('else strips markup', () => {
    expect(descriptionOnly('**Bold** [[Rope|item:i1]] and [color:gold]gold[/color]')).toBe('Bold Rope and gold');
  });
});

describe('sheetBeforeFor', () => {
  const coin = { id: 'n', name: 'Coin', amount: { value: 4 } };
  const before = { numbers: [coin], skills: [{ id: 's', name: 'Consort' }], inventory: [] };
  const line = (over = {}) => ({ choose: false, ops: [{ act: 'inc' as const, tab: 'numbers', entry: 'Coin', by: 2 }], ...over });

  it('keeps only the tabs the lines change', () => {
    expect(sheetBeforeFor(before, [line()])).toEqual({ numbers: [coin] });
  });

  it('is nothing when no line changes the sheet', () => {
    expect(sheetBeforeFor(before, [line({ ops: [] }), line({ choose: true })])).toBeUndefined();
  });

  it('is nothing when the tab is too big to keep on the board', () => {
    const huge = { numbers: [{ ...coin, description: 'é'.repeat(20_000) }] };
    expect(sheetBeforeFor(huge, [line()])).toBeUndefined();
  });
});
