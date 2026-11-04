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
  itemSig,
  keepLine,
  lineEffect,
  lineFromItem,
  lineText,
  sameUpdates,
  sheetDiff,
  sheetFor,
  sheetTabsFrom,
  stable,
  syncLine,
  type SheetTabs,
} from './rewards';
import type { RewardItem, RewardLine } from './types';

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
});

describe('descriptionOnly', () => {
  it('takes the Description column of a table', () => {
    expect(descriptionOnly('Name | Description | Tier\n:--|:--|:--\nRemote | You may **place** a bomb. | 1')).toBe('You may place a bomb.');
  });
  it('else strips markup', () => {
    expect(descriptionOnly('**Bold** [[Rope|item:i1]] and [color:gold]gold[/color]')).toBe('Bold Rope and gold');
  });
});
